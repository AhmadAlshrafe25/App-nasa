import test from 'node:test';
import assert from 'node:assert/strict';
import { planSoundscape, SOUNDSCAPE_DURATION_S } from './soundscape.ts';

test('chord is 432 Hz and 528 Hz lasting 4 seconds', () => {
  const plan = planSoundscape(10);
  assert.deepEqual([...plan.frequencies], [432, 528]);
  assert.equal(SOUNDSCAPE_DURATION_S, 4);
  assert.equal(plan.stopAt - plan.startAt, 4);
});

test('fade in and out stay inside the duration and do not overlap', () => {
  const plan = planSoundscape(0);
  assert.ok(plan.fadeInEnd > plan.startAt);
  assert.ok(plan.fadeInEnd <= plan.fadeOutStart);
  assert.ok(plan.fadeOutStart < plan.stopAt);
  assert.ok(plan.peakGain > 0 && plan.peakGain <= 0.2);
});
