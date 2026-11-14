import test from 'node:test';
import assert from 'node:assert/strict';
import {
  axialLoadingScore, emptyCountermeasureState, getExampleAlert,
  getExampleTrends, normalizeCountermeasureState, validateWorkout,
} from './countermeasures.ts';

test('sample workload accepts explicit zero load, rejects blank, invalid and out-of-range fields', () => {
  const workout = { loadKg: 60, repetitions: 10, sets: 3 };
  assert.equal(validateWorkout(workout), null);
  assert.equal(validateWorkout({ ...workout, loadKg: 0 }), null);
  for (const loadKg of ['', null, undefined, NaN, Infinity, -1, 301]) {
    assert.ok(validateWorkout({ ...workout, loadKg }));
  }
  for (const repetitions of ['', null, 0, -1, 1.5, 101, Infinity]) {
    assert.ok(validateWorkout({ ...workout, repetitions }));
  }
  for (const sets of ['', null, 0, 1.5, 21, NaN]) {
    assert.ok(validateWorkout({ ...workout, sets }));
  }
});

test('axial illustration is a bounded arbitrary points calculation, not a physical measure', () => {
  assert.equal(axialLoadingScore({ loadKg: 60, repetitions: 10, sets: 3 }), 30);
  assert.equal(axialLoadingScore({ loadKg: 0, repetitions: 1, sets: 1 }), 0);
  assert.equal(axialLoadingScore({ loadKg: 300, repetitions: 100, sets: 20 }), 100);
  assert.throws(() => axialLoadingScore({ loadKg: NaN, repetitions: 1, sets: 1 }));
});

test('fictional indices share an explicit preflight baseline and 30-day duration', () => {
  for (const scenario of ['example', 'low'] as const) {
    const trend = getExampleTrends(scenario);
    assert.equal(trend.days.at(-1), 30);
    assert.equal(trend.muscle[0], 100);
    assert.equal(trend.bone[0], 100);
    assert.equal(trend.days.length, trend.muscle.length);
    assert.equal(trend.days.length, trend.bone.length);
  }
  const low = getExampleTrends('low');
  assert.equal(low.muscle.at(-1), 98.5);
  assert.equal(low.bone.at(-1), 99);
  assert.match(getExampleAlert('low')!, /Unvalidated.*fictional 1%/);
  assert.match(getExampleAlert('low')!, /not measured loss, diagnosis, or a prediction/);
});

test('missing samples stay unavailable, never zero or a reassuring alert status', () => {
  const trend = getExampleTrends('missing');
  assert.ok([...trend.muscle, ...trend.bone].every(value => value === null));
  assert.match(getExampleAlert('missing')!, /unavailable.*No comparison/);
});

test('sessions and plan completions roundtrip without changing fictional physiology', () => {
  const before = getExampleTrends('low');
  const workout = { loadKg: 60, repetitions: 10, sets: 3 };
  const recordedAt = '2026-11-14T12:00:00.000Z';
  const state = normalizeCountermeasureState(JSON.parse(JSON.stringify({
    ...emptyCountermeasureState, scenario: 'low',
    sessions: [{ ...workout, recordedAt, axialScore: 30 }],
    completions: [recordedAt],
  })));
  assert.equal(state.sessions[0].axialScore, 30);
  assert.equal(state.completions[0], recordedAt);
  assert.equal(state.scenario, 'low');
  assert.deepEqual(getExampleTrends(state.scenario), before);
  assert.match(getExampleAlert(state.scenario)!, /early-alert/);
});

test('invalid saved simulation fails explicitly instead of becoming default or healthy data', () => {
  for (const invalid of [null, {}, [], { ...emptyCountermeasureState, version: 2 },
    { ...emptyCountermeasureState, scenario: 'healthy' },
    { ...emptyCountermeasureState, completions: ['invalid'] },
    { ...emptyCountermeasureState, sessions: [{ loadKg: null }] }]) {
    assert.throws(() => normalizeCountermeasureState(invalid), /Existing data has not been changed/);
  }
});

test('stored derived scores are recomputed and histories are bounded', () => {
  const recordedAt = '2026-11-14T12:00:00.000Z';
  const session = { loadKg: 60, repetitions: 10, sets: 3, recordedAt, axialScore: 999 };
  const state = normalizeCountermeasureState({
    ...emptyCountermeasureState, sessions: Array(60).fill(session), completions: Array(60).fill(recordedAt),
  });
  assert.equal(state.sessions.length, 50);
  assert.equal(state.completions.length, 50);
  assert.equal(state.sessions[0].axialScore, 30);
});
