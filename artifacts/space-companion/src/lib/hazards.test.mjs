import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_MISSION_DAYS,
  EXAMPLE_TRIGGERS,
  HAZARD_GUIDE_OFFLINE,
  HAZARDS,
  RESEARCH_SOURCES,
  SAMPLE_REFERENCE_NOTE,
  getChangedReadings,
} from './hazards.ts';

test('the local guide covers all five spaceflight hazards and links each to a source', () => {
  assert.deepEqual(HAZARDS.map((hazard) => hazard.id), ['radiation', 'isolation', 'distance', 'gravity', 'environment']);
  for (const hazard of HAZARDS) {
    assert.ok(hazard.summary.length > 20);
    assert.ok(hazard.indicators.length > 0);
    assert.ok(hazard.sourceIds.length > 0);
    for (const sourceId of hazard.sourceIds) assert.ok(RESEARCH_SOURCES[sourceId]?.href.startsWith('https://'));
  }
});

test('the three fictional records retain their supplied Normal, Warning, Danger order', () => {
  assert.deepEqual(DEMO_MISSION_DAYS.map((day) => [day.missionDay, day.status]), [
    [140, 'normal'],
    [141, 'warning'],
    [142, 'danger'],
  ]);
  assert.ok(DEMO_MISSION_DAYS.every((day) => day.statusExplanation.includes('supplied example')));
});

test('day comparisons explain which readings changed without inventing missing measurements', () => {
  assert.deepEqual(getChangedReadings(DEMO_MISSION_DAYS[0]), []);
  const warningChanges = getChangedReadings(DEMO_MISSION_DAYS[1]);
  assert.equal(warningChanges.find((item) => item.label === 'Heart rate')?.change, '+18 bpm');
  assert.equal(warningChanges.find((item) => item.label === 'Sleep')?.change, '−2.1 h');
  assert.equal(DEMO_MISSION_DAYS[2].readings.bloodPressure, null);
  assert.equal(DEMO_MISSION_DAYS[2].readings.isolationLevel, null);
});

test('the example trigger guide uses the newest provided values and makes their status explicit', () => {
  assert.ok(EXAMPLE_TRIGGERS.some((item) => item.example.includes('1.40 mSv/day')));
  assert.ok(EXAMPLE_TRIGGERS.some((item) => item.example.includes('85 bpm')));
  assert.match(SAMPLE_REFERENCE_NOTE, /not NASA-approved/i);
  assert.match(SAMPLE_REFERENCE_NOTE, /does not provide trigger bands for SpO₂ or cabin CO₂/i);
});

test('the guide is local and its research links are explicit HTTPS links', () => {
  assert.equal(HAZARD_GUIDE_OFFLINE, true);
  assert.equal(Object.keys(RESEARCH_SOURCES).length, 5);
  assert.ok(Object.values(RESEARCH_SOURCES).every((source) => source.href.startsWith('https://')));
});
