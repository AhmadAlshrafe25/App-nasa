import test from 'node:test';
import assert from 'node:assert/strict';
import { getReadingTrend, primaryReadingKeys } from './reading-trends.ts';

test('merged reading trends always end at the displayed current value', () => {
  for (const key of primaryReadingKeys) {
    assert.equal(getReadingTrend(key, 84, 7)?.at(-1), 84);
    assert.equal(getReadingTrend(key, 84, 7)?.length, 7);
    assert.equal(getReadingTrend(key, 84, 14)?.length, 14);
  }
});

test('changing demo readings never rewrites the fictional history', () => {
  const original = getReadingTrend('heartRate', 64, 14);
  getReadingTrend('heartRate', 112, 7);
  assert.deepEqual(getReadingTrend('heartRate', 64, 14), original);
});

test('readings without history do not receive invented trend lines', () => {
  assert.equal(getReadingTrend('temperature', 37, 7), null);
  assert.equal(getReadingTrend('heartRate', NaN, 7), null);
});
