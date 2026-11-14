import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';

const APP_DIR = path.resolve(import.meta.dirname, '..');
const ROOT = path.resolve(APP_DIR, '..', '..');
const CHROMIUM = process.env.E2E_CHROMIUM_PATH ?? '/repl/tools/bin/chromium';

export type NetworkState = { online: boolean };
export type Harness = {
  appUrl: string;
  apiUrl: string;
  browser: Browser;
  /** Opens a page whose /api calls go to the test API while `network.online` is true, and fail like an unreachable server otherwise. */
  openPage: (viewport: { width: number; height: number }) => Promise<{ page: Page; context: BrowserContext; network: NetworkState }>;
  stop: () => Promise<void>;
};

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url: string, child: ChildProcess, label: string, accept: (response: Response) => boolean = r => r.ok) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`${label} exited early with code ${child.exitCode}`);
    try {
      if (accept(await fetch(url))) return;
    } catch { /* not listening yet */ }
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  throw new Error(`${label} did not become ready at ${url}`);
}

function start(command: string, args: string[], cwd: string, env: Record<string, string>): ChildProcess {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  const tail: string[] = [];
  const keep = (chunk: Buffer) => { tail.push(chunk.toString()); if (tail.length > 40) tail.shift(); };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);
  child.on('exit', code => { if (code && code !== 143 && code !== 130) process.stderr.write(`[${command}] exited ${code}\n${tail.join('')}\n`); });
  return child;
}

/**
 * Starts the Python API on a throwaway SQLite file (so the demo database is never touched), the SpaceHealth dev server,
 * and a system Chromium. Nothing here uses the managed workflows' ports.
 */
export async function startHarness(): Promise<Harness> {
  const dir = mkdtempSync(path.join(tmpdir(), 'spacehealth-e2e-'));
  const [apiPort, appPort] = [await freePort(), await freePort()];
  const apiUrl = `http://127.0.0.1:${apiPort}`;
  const appUrl = `http://127.0.0.1:${appPort}`;

  const api = start('uv', ['run', '--frozen', 'python', '-m', 'backend.main'], ROOT, {
    PORT: String(apiPort), ASTRONAUT_DB_PATH: path.join(dir, 'e2e.db'),
  });
  const app = start(path.join(APP_DIR, 'node_modules', '.bin', 'vite'), ['--config', 'vite.config.ts', '--host', '127.0.0.1'], APP_DIR, {
    PORT: String(appPort), BASE_PATH: '/',
  });
  let browser: Browser | undefined;
  const stop = async () => {
    await browser?.close().catch(() => undefined);
    api.kill('SIGTERM'); app.kill('SIGTERM');
    rmSync(dir, { recursive: true, force: true });
  };

  try {
    await Promise.all([
      waitFor(`${apiUrl}/api/healthz`, api, 'API'),
      waitFor(`${appUrl}/`, app, 'SpaceHealth dev server'),
    ]);
    browser = await chromium.launch({ executablePath: CHROMIUM, args: ['--no-sandbox'] });
  } catch (error) {
    await stop();
    throw error;
  }

  const launched = browser;
  const openPage: Harness['openPage'] = async viewport => {
    const context = await launched.newContext({ viewport });
    const network: NetworkState = { online: true };
    await context.route('**/api/**', async route => {
      if (!network.online) { await route.abort('connectionrefused'); return; }
      const { pathname, search } = new URL(route.request().url());
      try {
        await route.fulfill({ response: await route.fetch({ url: `${apiUrl}${pathname}${search}` }) });
      } catch {
        await route.abort('connectionrefused');
      }
    });
    return { page: await context.newPage(), context, network };
  };
  return { appUrl, apiUrl, browser, openPage, stop };
}

/** Retries an assertion until it passes or the timeout elapses, then throws the last failure. */
export async function eventually<T>(check: () => Promise<T> | T, timeoutMs = 10_000): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try { return await check(); } catch (error) {
      if (Date.now() > deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, 150));
    }
  }
}

export const byId = (page: Page, id: string) => page.getByTestId(id);

export async function textOf(page: Page, id: string): Promise<string> {
  return (await byId(page, id).first().textContent({ timeout: 10_000 }))?.trim() ?? '';
}

export async function expectText(page: Page, id: string, pattern: RegExp) {
  await eventually(async () => {
    const actual = await byId(page, id).first().textContent({ timeout: 1000 });
    if (!pattern.test(actual ?? '')) throw new Error(`[data-testid=${id}] was "${actual}", expected ${pattern}`);
  });
}

export async function expectGone(page: Page, id: string) {
  await eventually(async () => {
    const count = await byId(page, id).count();
    if (count !== 0) throw new Error(`[data-testid=${id}] is still present`);
  });
}
