import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeStoredValue } from './persistent-state.ts';

test('object-valued self-notifications settle without creating a new state object', () => {
  const readings = { heartRate: 68, oxygen: 98 };
  let state = readings;
  for (let notification = 0; notification < 100; notification++) {
    state = mergeStoredValue(state, JSON.parse(JSON.stringify(state)));
    assert.equal(state, readings);
  }
});

test('a real object-valued update applies once and then settles', () => {
  const previous = { scenario: 'baseline', acknowledged: false };
  const incoming = { scenario: 'spike', acknowledged: false };
  const updated = mergeStoredValue(previous, incoming);
  assert.equal(updated, incoming);
  assert.equal(mergeStoredValue(updated, { ...incoming }), updated);
});
