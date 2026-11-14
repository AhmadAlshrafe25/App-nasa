import test from 'node:test';
import assert from 'node:assert/strict';
import { formatEasternClock } from './earth-clock.ts';

test('Eastern clock shows winter EST and summer EDT in 24-hour time', () => {
  assert.equal(formatEasternClock(new Date('2026-01-15T18:05:09Z')), '13:05:09 EST');
  assert.equal(formatEasternClock(new Date('2026-07-15T18:05:09Z')), '14:05:09 EDT');
  assert.equal(formatEasternClock(new Date('2026-01-15T05:00:00Z')), '00:00:00 EST');
});

test('Eastern clock follows spring and autumn daylight-saving changes', () => {
  assert.equal(formatEasternClock(new Date('2026-03-08T06:59:59Z')), '01:59:59 EST');
  assert.equal(formatEasternClock(new Date('2026-03-08T07:00:00Z')), '03:00:00 EDT');
  assert.equal(formatEasternClock(new Date('2026-11-01T05:59:59Z')), '01:59:59 EDT');
  assert.equal(formatEasternClock(new Date('2026-11-01T06:00:00Z')), '01:00:00 EST');
});

test('Eastern clock is independent of the device time zone', () => {
  const previous = process.env.TZ;
  try {
    for (const zone of ['UTC', 'Asia/Tokyo', 'Pacific/Honolulu', 'Europe/London']) {
      process.env.TZ = zone;
      assert.equal(formatEasternClock(new Date('2026-07-15T18:05:09Z')), '14:05:09 EDT');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});
