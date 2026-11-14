import test, { after, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import type { Page } from 'playwright-core';
import { type Harness, byId, eventually, expectText, startHarness } from './harness.ts';

const VIEWPORT = { width: 390, height: 844 };

let harness: Harness;
before(async () => { harness = await startHarness(); }, { timeout: 150_000 });
after(async () => { await harness?.stop(); });

type AudioMode = 'ok' | 'slow' | 'blocked' | 'missing';
type FakeAudioLog = { contexts: { state: string; closed: boolean; oscillators: { frequency: number; stopCalls: number }[] }[] };

/**
 * Replaces Web Audio with a recording fake so the test can see what the page asked the browser to play.
 * 'blocked' mimics an autoplay policy: the context stays suspended and resume() never starts it.
 * 'slow' takes 700 ms to start, so the page can be left while a press is still pending.
 * 'missing' removes Web Audio entirely.
 */
async function open(mode: AudioMode) {
  const opened = await harness.openPage(VIEWPORT);
  await opened.page.addInitScript((audioMode: AudioMode) => {
    const log: FakeAudioLog = { contexts: [] };
    (window as unknown as { __audioLog: FakeAudioLog }).__audioLog = log;
    if (audioMode === 'missing') {
      delete (window as unknown as Record<string, unknown>).AudioContext;
      delete (window as unknown as Record<string, unknown>).webkitAudioContext;
      return;
    }
    class FakeAudioContext {
      state = audioMode === 'blocked' || audioMode === 'slow' ? 'suspended' : 'running';
      currentTime = 0;
      destination = {};
      entry: FakeAudioLog['contexts'][number] = { state: this.state, closed: false, oscillators: [] };
      constructor() { log.contexts.push(this.entry); }
      async resume() {
        if (audioMode === 'blocked') throw new DOMException('The play() request was not allowed', 'NotAllowedError');
        if (audioMode === 'slow') await new Promise(resolve => setTimeout(resolve, 700));
        this.state = 'running'; this.entry.state = 'running';
      }
      async close() { this.state = 'closed'; this.entry.state = 'closed'; this.entry.closed = true; }
      createGain() {
        const param = { setValueAtTime() {}, linearRampToValueAtTime() {} };
        return { gain: param, connect() {} };
      }
      createOscillator() {
        const record = { frequency: 0, stopCalls: 0 };
        this.entry.oscillators.push(record);
        return {
          type: 'sine',
          frequency: { set value(v: number) { record.frequency = v; } },
          connect() {}, start() {}, stop() { record.stopCalls += 1; },
        };
      }
    }
    (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  }, mode);
  await opened.page.goto(`${harness.appUrl}/countermeasures`);
  await byId(opened.page, 'button-cm-check-audio').waitFor();
  return opened;
}

const audioLog = (page: Page) => page.evaluate(() => (window as unknown as { __audioLog: FakeAudioLog }).__audioLog);
const label = async (page: Page) => (await byId(page, 'button-cm-check-audio').textContent())?.trim();
const pressed = (page: Page) => byId(page, 'button-cm-check-audio').getAttribute('aria-pressed');

describe('Countermeasures local audio button', () => {
  test('starts the 432 + 528 Hz tone, then stops it on the second press', async () => {
    const { page, context } = await open('ok');
    try {
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');

      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Playing a calm 4-second tone \(432 Hz and 528 Hz\)\..*not a clinical/);
      assert.equal(await label(page), 'Stop local audio');
      assert.equal(await pressed(page), 'true');
      const started = await audioLog(page);
      assert.equal(started.contexts.length, 1);
      assert.deepEqual(started.contexts[0].oscillators.map(o => o.frequency), [432, 528]);
      assert.equal(started.contexts[0].closed, false);

      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Stopped\./);
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');
      const stopped = await audioLog(page);
      assert.equal(stopped.contexts[0].closed, true, 'the audio context is closed');
      assert.ok(stopped.contexts[0].oscillators.every(o => o.stopCalls > 0), 'both oscillators were stopped');

      // A stopped tone must not report "Finished" when its 4 seconds would have elapsed.
      await page.waitForTimeout(4300);
      await expectText(page, 'status-cm-audio', /^Stopped\./);
      assert.equal(await label(page), 'Check local audio');

      // The button is reusable after stopping.
      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Playing/);
      assert.equal((await audioLog(page)).contexts.length, 2);
    } finally { await context.close(); }
  });

  test('finishes by itself after 4 seconds and can be started again', async () => {
    const { page, context } = await open('ok');
    try {
      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Playing/);
      const startedAt = Date.now();
      await expectText(page, 'status-cm-audio', /^Finished\./);
      const elapsed = Date.now() - startedAt;
      assert.ok(elapsed >= 3000 && elapsed <= 6500, `finished after ${elapsed} ms, expected about 4000`);
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');
      assert.equal((await audioLog(page)).contexts[0].closed, true, 'the audio context is released');

      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Playing/);
      assert.equal(await label(page), 'Stop local audio');
      assert.equal((await audioLog(page)).contexts.length, 2);
    } finally { await context.close(); }
  });

  test('tells the user when the browser blocks playback and does not get stuck', async () => {
    const { page, context } = await open('blocked');
    try {
      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Audio was blocked by the browser\..*nothing is playing\..*not a clinical/);
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');
      const log = await audioLog(page);
      assert.equal(log.contexts[0].closed, true, 'the failed context is closed');
      assert.equal(log.contexts[0].oscillators.length, 0, 'no tone was created');

      // Pressing again retries instead of being ignored.
      await byId(page, 'button-cm-check-audio').click();
      await eventually(async () => assert.equal((await audioLog(page)).contexts.length, 2));
      await expectText(page, 'status-cm-audio', /^Audio was blocked by the browser\./);
      assert.equal(await label(page), 'Check local audio');
    } finally { await context.close(); }
  });

  test('tells the user when Web Audio is missing', async () => {
    const { page, context } = await open('missing');
    try {
      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Web Audio is unavailable in this browser\. Nothing will play\..*not a clinical/);
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');
    } finally { await context.close(); }
  });

  test('leaving the page stops the tone', async () => {
    const { page, context } = await open('ok');
    try {
      await byId(page, 'button-cm-check-audio').click();
      await expectText(page, 'status-cm-audio', /^Playing/);
      const before = await audioLog(page);
      assert.equal(before.contexts[0].closed, false);

      await byId(page, 'link-back-readings').click();
      await byId(page, 'page-countermeasures').waitFor({ state: 'detached' });
      await eventually(async () => {
        const after = await audioLog(page);
        assert.equal(after.contexts[0].closed, true, 'the audio context is closed');
        assert.ok(after.contexts[0].oscillators.every(o => o.stopCalls > 0), 'both oscillators were stopped');
      });

      // Coming back starts from a clean button, with nothing left playing.
      await page.goBack();
      await byId(page, 'button-cm-check-audio').waitFor();
      assert.equal(await label(page), 'Check local audio');
      assert.equal(await pressed(page), 'false');
      assert.equal(await byId(page, 'status-cm-audio').count(), 0);
    } finally { await context.close(); }
  });

  test('leaving the page while playback is still starting does not leave a tone running', async () => {
    const { page, context } = await open('slow');
    try {
      await byId(page, 'button-cm-check-audio').click();
      await byId(page, 'link-back-readings').click();
      await byId(page, 'page-countermeasures').waitFor({ state: 'detached' });
      await eventually(async () => {
        const log = await audioLog(page);
        assert.equal(log.contexts.length, 1);
        assert.equal(log.contexts[0].closed, true, 'a tone that finished starting after leaving is stopped');
      }, 5000);
    } finally { await context.close(); }
  });
});
