import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGoESProtonFlux, parsePlanetaryKIndex } from './space-weather.ts';

const now = Date.parse('2026-11-15T14:00:00Z');

test('planetary K-index chooses the latest valid observation and treats NOAA timestamps as UTC', () => {
  assert.deepEqual(parsePlanetaryKIndex([
    { time_tag: '2026-11-15T09:00:00', Kp: 2.67 },
    { time_tag: '2026-11-15T12:00:00', Kp: 3.33 },
    { time_tag: '2026-11-15T15:00:00', Kp: 4.0 },
    { time_tag: '2026-11-15T06:00:00', Kp: 12 },
  ], now), {
    value: 3.33,
    observedAt: '2026-11-15T12:00:00.000Z',
  });
});

test('GOES parser selects the newest >=10 MeV proton flux sample', () => {
  assert.deepEqual(parseGoESProtonFlux([
    { time_tag: '2026-11-15T13:10:00Z', energy: '>= 10 MeV', flux: 0.22 },
    { time_tag: '2026-11-15T13:20:00Z', energy: '>=10 MeV', flux: 0.24 },
    { time_tag: '2026-11-15T13:25:00Z', energy: '>=100 MeV', flux: 0.03 },
  ], now), {
    value: 0.24,
    observedAt: '2026-11-15T13:20:00.000Z',
  });
});

test('parsers reject missing, malformed, and future observations', () => {
  assert.equal(parsePlanetaryKIndex(null, now), null);
  assert.equal(parsePlanetaryKIndex([{ time_tag: 'invalid', Kp: 3 }], now), null);
  assert.equal(parsePlanetaryKIndex([{ time_tag: '2026-11-15T15:00:00Z', Kp: 3 }], now), null);
  assert.equal(parseGoESProtonFlux([{ time_tag: '2026-11-15T13:00:00Z', energy: '>=10 MeV', flux: -1 }], now), null);
});
