import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultBodyReadings, normalizeBodyReadings, evaluateAllVitals, VITAL_SPECS } from './vitals.ts';
import { CABIN_SPECS, DEFAULT_CABIN_READINGS, evaluateCabin, normalizeCabinReadings, parseCabinReadings } from './cabin-readings.ts';

test('all eleven crew readings are available, including complete blood pressure and stress', () => {
  assert.equal(VITAL_SPECS.length, 11);
  assert.equal(new Set(VITAL_SPECS.map(s => s.key)).size, 11);
  assert.equal(evaluateAllVitals(defaultBodyReadings).overall, 'normal');
  assert.ok(VITAL_SPECS.some(s => s.key === 'diastolicBP' && s.unit === 'mmHg'));
  assert.equal(VITAL_SPECS.find(s => s.key === 'stress')?.sensorLocation, 'Self-report');
});

test('older saved body samples receive new demo fields without changing existing readings', () => {
  const sample = normalizeBodyReadings({ heartRate: 83, oxygen: 96, sleep: 6.5 });
  assert.equal(sample.heartRate, 83);
  assert.equal(sample.diastolicBP, 76);
  assert.equal(sample.stress, 3);
  assert.equal(normalizeBodyReadings({ diastolicBP: Infinity, stress: NaN }).stress, 3);
});

test('new body samples participate in the existing alert evaluation', () => {
  const evaluation = evaluateAllVitals({ ...defaultBodyReadings, diastolicBP: 120, stress: 8 });
  assert.equal(evaluation.overall, 'red');
  assert.deepEqual(evaluation.redItems.map(i => i.spec.key).sort(), ['diastolicBP', 'stress']);
});

test('five cabin readings have units, formatting and normal default demo states', () => {
  const evaluated = evaluateCabin(DEFAULT_CABIN_READINGS);
  assert.equal(evaluated.items.length, 5);
  assert.equal(evaluated.overall, 'normal');
  assert.equal(evaluated.items.find(i => i.spec.key === 'pressure')?.formattedValue, '101.3');
  assert.equal(evaluated.items.find(i => i.spec.key === 'co2')?.spec.unit, 'ppm');
});

test('cabin demo flags oxygen, CO2, pressure, temperature and humidity independently', () => {
  const high = { oxygen: 18, co2: 6000, pressure: 85, temperature: 35, humidity: 80 };
  for (const spec of CABIN_SPECS) {
    const evaluated = evaluateCabin({ ...DEFAULT_CABIN_READINGS, [spec.key]: high[spec.key] });
    assert.deepEqual(evaluated.redItems.map(i => i.spec.key), [spec.key]);
  }
  assert.equal(evaluateCabin({ ...DEFAULT_CABIN_READINGS, co2: 4000 }).overall, 'yellow');
});

test('corrupt or missing saved values never turn into an all-normal cabin', () => {
  for (const value of [{}, [], null, { ...DEFAULT_CABIN_READINGS, oxygen: NaN }, { ...DEFAULT_CABIN_READINGS, co2: 10001 }]) {
    assert.throws(() => normalizeCabinReadings(value));
  }
  assert.throws(() => parseCabinReadings('{ broken'));
  assert.deepEqual(parseCabinReadings(null), DEFAULT_CABIN_READINGS);
  assert.deepEqual(parseCabinReadings(JSON.stringify(DEFAULT_CABIN_READINGS)), DEFAULT_CABIN_READINGS);
});
