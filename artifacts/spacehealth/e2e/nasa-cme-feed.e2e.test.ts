import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { type Harness, byId, expectText, startHarness } from './harness.ts';

const WIDE = { width: 1280, height: 900 };
let harness: Harness;
before(async () => { harness = await startHarness(); }, { timeout: 150_000 });
after(async () => { await harness?.stop(); });

test('Readings integrates NASA CME analysis as a compact space-environment metric', async () => {
  const { page, context } = await harness.openPage(WIDE);
  let calls = 0;
  await page.route('**/api/space-weather/nasa-cmes', async route => {
    calls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        source: 'NASA DONKI',
        sourceUrl: 'https://api.nasa.gov/DONKI/CME',
        windowStart: '2026-11-09',
        windowEnd: '2026-11-15',
        retrievedAt: '2026-11-15T14:00:00Z',
        cached: false,
        events: [{
          activityId: '2026-11-15T12:40:00-CME-001',
          startTime: '2026-11-15T12:40:00Z',
          sourceLocation: 'N10E20',
          activeRegion: 14200,
          analysisSpeedKmPerSecond: 721.4,
          eventUrl: 'https://ccmc.gsfc.nasa.gov/DONKI/view/CME/1/-1',
        }],
      }),
    });
  });

  try {
    await page.goto(`${harness.appUrl}/`);
    await expectText(page, 'status-nasa-cme', /^Connected$/);
    await expectText(page, 'value-nasa-cme', /^721 km\/s$/);
    const tile = byId(page, 'panel-nasa-cme');
    assert.match(await tile.textContent() ?? '', /Latest report/);
    assert.match(await byId(page, 'panel-space-weather').textContent() ?? '', /not spacecraft-local sensors/i);
    const detail = byId(page, 'details-nasa-cme');
    assert.equal(await byId(page, 'event-nasa-cme-0').isVisible(), false, 'raw event list is collapsed by default');
    await detail.locator('summary').click();
    await expectText(page, 'event-nasa-cme-0', /N10E20/);
    const event = await byId(page, 'event-nasa-cme-0').textContent();
    assert.match(event ?? '', /721 km\/s/);
    assert.match(event ?? '', /2026-11-15T12:40:00-CME-001/);
    assert.equal(await byId(page, 'link-nasa-cme-0').getAttribute('href'), 'https://ccmc.gsfc.nasa.gov/DONKI/view/CME/1/-1');
    await byId(page, 'button-nasa-cme-refresh').click();
    assert.equal(calls, 2);
  } finally {
    await context.close();
  }
});

test('NASA errors show unavailable without inventing an event', async () => {
  const { page, context } = await harness.openPage(WIDE);
  await page.route('**/api/space-weather/nasa-cmes', route => route.fulfill({
    status: 502,
    contentType: 'application/json',
    body: JSON.stringify({ detail: 'NASA DONKI is temporarily unavailable.' }),
  }));
  try {
    await page.goto(`${harness.appUrl}/`);
    await expectText(page, 'status-nasa-cme', /^Unavailable$/);
    await expectText(page, 'text-nasa-cme-unavailable', /No substitute data is shown/);
  } finally {
    await context.close();
  }
});
