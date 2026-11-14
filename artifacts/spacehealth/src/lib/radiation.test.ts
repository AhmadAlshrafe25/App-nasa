import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeRadiation, getRadiationSamples, normalizeRadiationDemo } from './radiation.ts';
import { describeRadiation } from './radiation-copy.ts';

test('a synthetic spike is derived from the prior baseline, not a hardcoded alert', () => {
  const result = analyzeRadiation(getRadiationSamples('spike'));
  assert.equal(result.status, 'spike');
  assert.equal(result.doseRate, 30);
  assert.ok(Math.abs(result.baseline! - 12) < 0.001);
  assert.ok(Math.abs(result.trigger! - 15) < 0.001);
  assert.ok(Math.abs(result.deltaPercent! - 150) < 0.001);
});
test('background samples produce no radiation deviation', () => {
  assert.equal(analyzeRadiation(getRadiationSamples('baseline')).status, 'baseline');
});
test('a lost signal is unknown, not a baseline result or a zero dose', () => {
  const result = analyzeRadiation(getRadiationSamples('signal-loss'));
  assert.equal(result.status, 'unavailable');
  assert.equal(result.doseRate, null);
  assert.equal(result.sampleDose, null);
});
test('integrates rate over elapsed hours with a trapezoidal rule', () => {
  const samples = Array.from({ length: 13 }, (_, index) => ({ minute: index * 5, doseRate: 12 }));
  const result = analyzeRadiation(samples);
  assert.equal(result.windowMinutes, 60);
  assert.equal(result.sampleDose, 12);
});
test('does not infer full-window dose across missing or widely spaced samples', () => {
  const missing = getRadiationSamples('baseline');
  missing[3]!.doseRate = null;
  assert.equal(analyzeRadiation(missing).sampleDose, null);
  assert.equal(analyzeRadiation(missing).status, 'insufficient');
  assert.equal(analyzeRadiation([{ minute: 0, doseRate: 12 }, { minute: 60, doseRate: 12 }]).sampleDose, null);
});
test('invalid measurements and timestamps cannot yield a reassuring status', () => {
  assert.equal(analyzeRadiation([]).status, 'unavailable');
  const invalid = getRadiationSamples('baseline');
  invalid.at(-1)!.doseRate = -1;
  assert.equal(analyzeRadiation(invalid).status, 'unavailable');
  invalid.at(-1)!.doseRate = Number.NaN;
  assert.equal(analyzeRadiation(invalid).status, 'unavailable');
  assert.equal(analyzeRadiation([{ minute: 5, doseRate: 12 }, { minute: 0, doseRate: 12 }]).status, 'unavailable');
});
test('too little baseline is reported explicitly', () => {
  assert.equal(analyzeRadiation([{ minute: 0, doseRate: 12 }]).status, 'insufficient');
});
test('invalid saved demo settings normalize without trusting an acknowledgement', () => {
  assert.deepEqual(normalizeRadiationDemo(null), { scenario: 'spike', acknowledged: false });
  assert.deepEqual(normalizeRadiationDemo({ scenario: 'other', acknowledged: true }), { scenario: 'spike', acknowledged: false });
  assert.deepEqual(normalizeRadiationDemo({ scenario: 'baseline', acknowledged: 'true' }), { scenario: 'baseline', acknowledged: false });
});
test('explains a spike as a comparison anyone can read, not a safety rating', () => {
  const copy = describeRadiation(analyzeRadiation(getRadiationSamples('spike')));
  assert.equal(copy.value, '2.5');
  assert.equal(copy.unit, '×');
  assert.equal(copy.status, 'Higher than usual');
  assert.equal(copy.comparison, 'the usual sample level');
});
test('background copy describes the pattern without claiming it is safe', () => {
  const copy = describeRadiation(analyzeRadiation(getRadiationSamples('baseline')));
  assert.equal(copy.status, 'No unusual rise');
  assert.equal(copy.value, '1.0');
  assert.doesNotMatch(copy.status, /\bsafe\b/i);
});
test('missing or insufficient readings stay unknown in plain-language output', () => {
  const lost = describeRadiation(analyzeRadiation(getRadiationSamples('signal-loss')));
  assert.equal(lost.value, 'Unknown');
  assert.equal(lost.status, 'No reading available');
  assert.equal(lost.unit, '');
  const insufficient = describeRadiation(analyzeRadiation([{ minute: 0, doseRate: 12 }]));
  assert.equal(insufficient.value, 'Unknown');
  assert.equal(insufficient.status, 'More readings needed');
});
