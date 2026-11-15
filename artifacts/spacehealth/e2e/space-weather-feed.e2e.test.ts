import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { type Harness, byId, eventually, expectText, startHarness } from './harness.ts';

const WIDE = { width: 1280, height: 900 };
const KP_URL = 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json';
const PROTON_URL = 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json';

let harness: Harness;
before(async () => { harness = await startHarness(); }, { timeout: 150_000 });
after(async () => { await harness?.stop(); });

test('Readings shows current NOAA observations and refreshes the public feed', async () => {
  const { page, context } = await harness.openPage(WIDE);
  let kpCalls = 0;
  let protonCalls = 0;
  const kpTime = new Date(Date.now() - 30 * 60_000).toISOString().slice(0, 19);
  const protonTime = new Date(Date.now() - 5 * 60_000).toISOString();

  await page.route(KP_URL, async route => {
    kpCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ time_tag: kpTime, Kp: 2.67 }]),
    });
  });
  await page.route(PROTON_URL, async route => {
    protonCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{ time_tag: protonTime, energy: '>=10 MeV', flux: 0.24 }]),
    });
  });

  try {
    await page.goto(`${harness.appUrl}/`);
    await expectText(page, 'value-space-weather-kp', /^2\.67 Kp$/);
    await expectText(page, 'value-space-weather-protons', /^0\.240 pfu$/);
    await expectText(page, 'status-space-weather', /^Current$/);
    assert.match(await byId(page, 'panel-space-weather').textContent() ?? '', /not spacecraft-local sensors/i);

    await byId(page, 'button-space-weather-refresh').click();
    await eventually(() => {
      assert.ok(kpCalls >= 2, 'Kp feed was fetched again');
      assert.ok(protonCalls >= 2, 'GOES proton feed was fetched again');
    });
    await expectText(page, 'status-space-weather', /^Current$/);
  } finally {
    await context.close();
  }
});

test('Readings marks unavailable NOAA data instead of filling in sample values', async () => {
  const { page, context } = await harness.openPage(WIDE);
  await page.route(KP_URL, route => route.fulfill({ status: 503, body: 'offline' }));
  await page.route(PROTON_URL, route => route.fulfill({ status: 503, body: 'offline' }));
  try {
    await page.goto(`${harness.appUrl}/`);
    await expectText(page, 'status-space-weather', /^Unavailable$/);
    await expectText(page, 'value-space-weather-kp', /^— Kp$/);
    await expectText(page, 'value-space-weather-protons', /^— pfu$/);
  } finally {
    await context.close();
  }
});
