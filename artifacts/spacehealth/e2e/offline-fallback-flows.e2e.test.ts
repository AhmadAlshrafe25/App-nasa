import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { type Harness, byId, eventually, expectGone, expectText, startHarness, textOf } from './harness.ts';

const WIDE = { width: 1280, height: 900 };
const NARROW = { width: 390, height: 844 };

let harness: Harness;
before(async () => { harness = await startHarness(); }, { timeout: 150_000 });
after(async () => { await harness?.stop(); });

async function open(viewport: { width: number; height: number }, path = '/') {
  const opened = await harness.openPage(viewport);
  opened.network.online = false;
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

describe('with the API unreachable', () => {
  test('Readings shows crew and cabin values and keeps cabin alerts after reload', async () => {
    const { page, context } = await open(NARROW);
    try {
      assert.equal(await page.locator('[data-testid^="status-zone-"]').count(), 11, 'all crew readings are shown');
      for (const key of ['oxygen', 'co2', 'pressure', 'temperature', 'humidity']) {
        await byId(page, `card-cabin-${key}`).waitFor();
      }
      await expectText(page, 'value-cabin-o2-partial', /21\.3 kPa/);
      await expectText(page, 'badge-sensor-origin', /no live sensors/i);
      await expectText(page, 'status-cabin-co2', /^Normal$/);

      await byId(page, 'details-cabin-co2').click();
      await byId(page, 'input-cabin-co2').evaluate(element => {
        const input = element as HTMLInputElement;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, '6000');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      await expectText(page, 'value-cabin-co2', /^6000/);
      await expectText(page, 'status-cabin-co2', /^Alert$/);
      await byId(page, 'banner-cabin-red').waitFor();

      await page.reload();
      await expectText(page, 'value-cabin-co2', /^6000/);
      await expectText(page, 'status-cabin-co2', /^Alert$/);
      await byId(page, 'button-cabin-reset').click();
      await expectText(page, 'value-cabin-co2', /^1800/);
      await expectGone(page, 'banner-cabin-red');
    } finally { await context.close(); }
  });

  test('Companion shows "Offline sample" and the sample message', async () => {
    const { page, context } = await open(WIDE);
    try {
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      await expectText(page, 'text-family-title', /^Sample note$/);
      await expectText(page, 'text-family-body', /Not a real family message/);
      assert.deepEqual(await counts(page), { total: 1, unviewed: 1 });
      await byId(page, 'button-companion-retry').waitFor();
    } finally { await context.close(); }
  });

  test('Mark viewed changes only this session', async () => {
    const { page, context } = await open(WIDE);
    try {
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      await byId(page, 'button-mark-viewed').click();
      await expectText(page, 'text-family-notice', /^Marked viewed for this session only\.$/);
      await eventually(async () => assert.deepEqual(await counts(page), { total: 1, unviewed: 0 }));
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      await expectGone(page, 'button-mark-viewed');

      await page.reload();
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      assert.deepEqual(await counts(page), { total: 1, unviewed: 1 }, 'a reload starts from the sample again');
      const stored = await apiJson<{ is_viewed: boolean }[]>('/api/family/messages/AST-01');
      assert.ok(stored.some(m => !m.is_viewed), 'nothing reached the API');
    } finally { await context.close(); }
  });

  test('Add family message stays local to the session', async () => {
    const { page, context } = await open(WIDE);
    try {
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      await byId(page, 'button-add-message-toggle').click();
      await byId(page, 'button-add-message').click();
      await expectText(page, 'text-family-error', /Sender is required/);
      assert.equal((await counts(page)).total, 1, 'invalid input adds nothing');

      await byId(page, 'input-family-sender').fill('Test Sender');
      await byId(page, 'input-family-relationship').fill('Friend');
      await byId(page, 'input-family-title').fill('Offline browser test note');
      await byId(page, 'input-family-text').fill('Browser test message.');
      await byId(page, 'button-add-message').click();
      await expectText(page, 'text-family-notice', /^Added for this session only\.$/);
      await eventually(async () => assert.deepEqual(await counts(page), { total: 2, unviewed: 2 }));
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      await expectText(page, 'text-family-title', /^Offline browser test note$/);
      assert.equal(await byId(page, 'input-family-title').inputValue(), '', 'form is cleared');

      await page.reload();
      await expectText(page, 'text-companion-source', /^Offline sample$/);
      assert.equal((await counts(page)).total, 1, 'a reload drops the local message');
      const stored = await apiJson<{ title: string }[]>('/api/family/messages/AST-01');
      assert.ok(!stored.some(m => m.title === 'Offline browser test note'), 'nothing reached the API');
    } finally { await context.close(); }
  });

  for (const [name, viewport, suffix] of [['wide top bar', WIDE, ''], ['narrow overview', NARROW, '-narrow']] as const) {
    test(`Queue sample packet and Sync Earth run a local simulation (${name})`, async () => {
      const { page, context } = await open(viewport);
      try {
        await expectText(page, `text-sync-source${suffix}`, /^Sample$/);
        assert.equal(await pendingCount(page, suffix), 0);
        const apiBefore = await apiJson<{ pending_count: number }>('/api/mission/sync-status');

        await byId(page, 'button-queue-sample-packet').click();
        await expectText(page, `text-sync-message${suffix}`, /^Sample check-in queued\.$/);
        await eventually(async () => assert.equal(await pendingCount(page, suffix), 1));
        await expectText(page, `status-earth-sync${suffix}`, /^PENDING_EARTH_SYNC/);

        await byId(page, `button-sync-earth${suffix}`).click();
        await expectText(page, `text-sync-message${suffix}`, /^Local queue · Synced 1 packet · simulated, no real transfer$/);
        await eventually(async () => assert.equal(await pendingCount(page, suffix), 0));
        await expectText(page, `status-earth-sync${suffix}`, /^Queue clear/);
        await expectText(page, `text-sync-source${suffix}`, /^Sample$/);

        await byId(page, `button-sync-earth${suffix}`).click();
        await expectText(page, `text-sync-message${suffix}`, /^Local queue · Nothing to sync/);

        await byId(page, 'button-queue-sample-packet').click();
        await eventually(async () => assert.equal(await pendingCount(page, suffix), 1));
        await page.reload();
        await expectText(page, `text-sync-source${suffix}`, /^Sample$/);
        assert.equal(await pendingCount(page, suffix), 0, 'a reload starts the local queue empty');
        assert.deepEqual(await apiJson<{ pending_count: number }>('/api/mission/sync-status'), apiBefore, 'the API queue is untouched');
      } finally { await context.close(); }
    });
  }

  test('Alerts findings block says "Offline sample" and shows no scores, then recovers on retry', async () => {
    const { page, context, network } = await open(WIDE, '/alerts');
    try {
      await byId(page, 'button-radiation-details').click();
      await byId(page, 'status-ai-offline').waitFor();
      assert.match(await textOf(page, 'status-ai-offline'), /Trends unavailable/);
      await expectGone(page, 'text-ai-risk');
      await expectGone(page, 'table-baseline-comparison');

      await byId(page, 'button-ai-retry').click();
      await byId(page, 'status-ai-offline').waitFor();

      network.online = true;
      await byId(page, 'button-ai-retry').click();
      await byId(page, 'text-ai-risk').waitFor();
      await expectGone(page, 'status-ai-offline');
    } finally { await context.close(); }
  });
});
