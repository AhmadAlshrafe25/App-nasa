import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { type Harness, byId, eventually, expectGone, expectText, startHarness, textOf } from './harness.ts';

const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 390, height: 844 };

let harness: Harness;
before(async () => { harness = await startHarness(); }, { timeout: 150_000 });
after(async () => { await harness?.stop(); });

async function open(viewport: { width: number; height: number }, online: boolean, path = '/') {
  const opened = await harness.openPage(viewport);
  opened.network.online = online;
  opened.page.on('response', response => {
    if (response.url().includes('/dashboard')) console.log('Dashboard response:', response.status(), response.url());
  });
  opened.page.on('requestfailed', request => {
    if (request.url().includes('/dashboard')) console.log('Dashboard request failed:', request.failure()?.errorText);
  });
  await opened.page.goto(`${harness.appUrl}${path}`);
  const mission = byId(opened.page, 'section-mission-overview');
  if (await mission.count() && !(await mission.evaluate(element => (element as HTMLDetailsElement).open))) {
    await mission.locator(':scope > summary').click();
  }
  return opened;
}

async function counts(page: Page) {
  const match = /(\d+) messages? · (\d+) unviewed/.exec(await textOf(page, 'text-family-count'));
  assert.ok(match, 'family count line is shown');
  return { total: Number(match[1]), unviewed: Number(match[2]) };
}

async function pendingCount(page: Page, suffix: string) {
  const match = /^(\d+) pending/.exec(await textOf(page, `text-sync-pending${suffix}`));
  assert.ok(match, 'pending count is shown');
  return Number(match[1]);
}

async function apiJson<T>(path: string): Promise<T> {
  const response = await fetch(`${harness.apiUrl}${path}`);
  assert.ok(response.ok, `${path} returned ${response.status}`);
  return response.json() as Promise<T>;
}

/** Expects the Add family message section to be open already. */
const fillMessage = async (page: Page, title: string) => {
  await byId(page, 'input-family-sender').fill('Test Sender');
  await byId(page, 'input-family-relationship').fill('Friend');
  await byId(page, 'input-family-title').fill(title);
  await byId(page, 'input-family-text').fill('Browser test message.');
  await byId(page, 'select-family-mood').selectOption('tired');
};

describe('with the API running', () => {
  test('Companion shows the live label and Mark viewed persists to the API', async () => {
    const { page, context } = await open(WIDE, true);
    try {
      await expectText(page, 'text-companion-source', /^Sample data$/);
      await byId(page, 'card-family-media').waitFor();
      const before = await counts(page);
      assert.ok(before.unviewed > 0, 'seed data has an unviewed message');
      await byId(page, 'button-mark-viewed').click();
      await expectText(page, 'text-family-notice', /^Marked viewed\.$/);
      await eventually(async () => assert.equal((await counts(page)).unviewed, before.unviewed - 1));
      const stored = await apiJson<{ is_viewed: boolean }[]>('/api/family/messages/AST-01');
      assert.equal(stored.filter(m => !m.is_viewed).length, before.unviewed - 1, 'the API recorded the change');
      await page.reload();
      await eventually(async () => assert.equal((await counts(page)).unviewed, before.unviewed - 1), 15_000);
      await expectText(page, 'text-companion-source', /^Sample data$/);
    } finally { await context.close(); }
  });

  test('Add family message validates, saves to the API and survives a reload', async () => {
    const { page, context } = await open(WIDE, true);
    try {
      await expectText(page, 'text-companion-source', /^Sample data$/);
      const before = await counts(page);
      await byId(page, 'button-add-message-toggle').click();
      await byId(page, 'button-add-message').click();
      await expectText(page, 'text-family-error', /Sender is required/);
      assert.equal((await counts(page)).total, before.total, 'invalid input adds nothing');

      await fillMessage(page, 'Live browser test note');
      await byId(page, 'button-add-message').click();
      await expectText(page, 'text-family-notice', /^Message added\.$/);
      await eventually(async () => assert.deepEqual(await counts(page), { total: before.total + 1, unviewed: before.unviewed + 1 }));
      assert.equal(await byId(page, 'input-family-title').inputValue(), '', 'form is cleared');
      const stored = await apiJson<{ title: string }[]>('/api/family/messages/AST-01');
      assert.ok(stored.some(m => m.title === 'Live browser test note'), 'the API stored the message');
      await page.reload();
      await eventually(async () => assert.equal((await counts(page)).total, before.total + 1), 15_000);
    } finally { await context.close(); }
  });

  for (const [name, viewport, suffix] of [['wide top bar', WIDE, ''], ['narrow overview', NARROW, '-narrow']] as const) {
    test(`Queue sample packet then Sync Earth use the API (${name})`, async () => {
      const { page, context } = await open(viewport, true);
      try {
        await expectText(page, `status-earth-sync${suffix}`, /Mars Delay/);
        await expectGone(page, `text-sync-source${suffix}`);
        const start = await pendingCount(page, suffix);

        await byId(page, 'button-queue-sample-packet').click();
        await expectText(page, `text-sync-message${suffix}`, /^Sample packet queued · processed onboard first$/);
        await eventually(async () => assert.equal(await pendingCount(page, suffix), start + 1));
        await expectText(page, `status-earth-sync${suffix}`, /^PENDING_EARTH_SYNC/);
        const queued = await apiJson<{ pending_count: number }>('/api/mission/sync-status');
        assert.equal(queued.pending_count, start + 1, 'the API queue grew');

        await byId(page, `button-sync-earth${suffix}`).click();
        await expectText(page, `text-sync-message${suffix}`, new RegExp(`^Synced ${start + 1} packets? · simulated, no real transfer$`));
        await eventually(async () => assert.equal(await pendingCount(page, suffix), 0));
        await expectText(page, `status-earth-sync${suffix}`, /^Queue clear/);
        assert.equal((await apiJson<{ pending_count: number }>('/api/mission/sync-status')).pending_count, 0);
        await expectGone(page, `text-sync-source${suffix}`);

        await byId(page, `button-sync-earth${suffix}`).click();
        await expectText(page, `text-sync-message${suffix}`, /^Nothing to sync/);
      } finally { await context.close(); }
    });
  }

  test('Alerts findings block loads statistical findings from the API', async () => {
    const { page, context } = await open(WIDE, true, '/alerts');
    try {
      await byId(page, 'button-radiation-details').click();
      await byId(page, 'section-ai-findings').waitFor();
      await page.waitForTimeout(3000);
      console.log('AI finding state:', await byId(page, 'section-ai-findings').innerText());
      await byId(page, 'text-ai-risk').waitFor();
      await byId(page, 'button-ai-pattern-details').click();
      await byId(page, 'table-baseline-comparison').waitFor();
      await expectGone(page, 'status-ai-offline');
      await expectGone(page, 'status-ai-error');
      assert.match(await textOf(page, 'text-ai-risk'), /^Overall: .+/);
      assert.ok((await byId(page, 'list-ai-actions').locator('li').count()) > 0, 'next steps are listed');
    } finally { await context.close(); }
  });
});
