import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendEntry, defaultReminder, earthHourLabel, formatAstronautLogHeader,
  hasLogForDay, localDay, logStorageKey,
  readEntries, readReminder, reminderDue, reminderStorageKey,
} from './daily-log.ts';
import { defaultBodyReadings, evaluateAllVitals } from './vitals.ts';

function store() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
const legacy = { id: 'previous-checkin', createdAt: '2026-11-13T12:00:00Z', mood: 'Good', stress: 4, sleep: 'Restful', note: 'An earlier note', extraField: 'preserved' };
const current = { id: 'daily-log', createdAt: '2026-11-14T12:00:00Z', logDate: '2026-11-14', mood: 'Okay', stress: 5, sleep: '7.5 hours', note: '', heartRate: 64, sleepHours: 7.5, activityMinutes: 90 };

test('new daily logs retain old check-ins and unknown legacy fields', () => {
  const storage = store();
  storage.setItem(logStorageKey, JSON.stringify([legacy]));
  const result = appendEntry(storage, current);
  assert.deepEqual(result, [current, legacy]);
  assert.deepEqual(readEntries(storage), result);
  assert.equal(result[1].sleep, 'Restful');
});
test('malformed stored logs are not overwritten when saving', () => {
  const storage = store();
  storage.setItem(logStorageKey, 'broken-json');
  assert.throws(() => appendEntry(storage, current));
  assert.equal(storage.getItem(logStorageKey), 'broken-json');
});
test('a failed storage write cannot report a saved log', () => {
  const storage = store();
  storage.setItem(logStorageKey, JSON.stringify([legacy]));
  const full = { getItem: storage.getItem, setItem: () => { throw new Error('Quota exceeded'); } };
  assert.throws(() => appendEntry(full, current), /Quota/);
  assert.deepEqual(readEntries(storage), [legacy]);
});
test('appending reads the latest stored records instead of a stale screen copy', () => {
  const storage = store();
  appendEntry(storage, legacy);
  appendEntry(storage, current);
  appendEntry(storage, { ...current, id: 'another-tab' });
  assert.equal(readEntries(storage).length, 3);
});
test('daily reminders fire at or after the chosen device-local minute', () => {
  const settings = { ...defaultReminder, enabled: true, time: '20:00' };
  assert.equal(reminderDue(settings, new Date(2026, 10, 14, 19, 59), false), false);
  assert.equal(reminderDue(settings, new Date(2026, 10, 14, 20, 0), false), true);
  assert.equal(reminderDue(settings, new Date(2026, 10, 14, 22, 0), false), true);
});
test('a reminder does not repeat today after reload or time changes, but returns tomorrow', () => {
  const settings = { ...defaultReminder, enabled: true, time: '18:00', lastFired: '2026-11-14' };
  assert.equal(reminderDue(settings, new Date(2026, 10, 14, 22), false), false);
  assert.equal(reminderDue(settings, new Date(2026, 10, 15, 22), false), true);
});
test('disabled reminders, an invalid time, or a completed daily log never trigger', () => {
  const now = new Date(2026, 10, 14, 22);
  assert.equal(reminderDue(defaultReminder, now, false), false);
  assert.equal(reminderDue({ ...defaultReminder, enabled: true }, now, true), false);
  assert.equal(reminderDue({ ...defaultReminder, enabled: true, time: '99:99' }, now, false), false);
});
test('log-day matching supports old entries and explicit diary dates', () => {
  assert.equal(hasLogForDay([current], '2026-11-14'), true);
  assert.equal(hasLogForDay([current], '2026-11-15'), false);
  assert.equal(hasLogForDay([legacy], localDay(new Date(legacy.createdAt))), true);
});
test('reminder settings survive reload and invalid settings are not silently enabled', () => {
  const storage = store();
  const settings = { ...defaultReminder, enabled: true, time: '09:15', lastFired: '2026-11-14' };
  storage.setItem(reminderStorageKey, JSON.stringify(settings));
  assert.deepEqual(readReminder(storage), settings);
  storage.setItem(reminderStorageKey, JSON.stringify({ enabled: true, time: 'not-time' }));
  assert.throws(() => readReminder(storage));
});
test('formats Astronaut Log header with Earth Day and Hour', () => {
  const d = new Date(2026, 10, 14, 6, 45);
  assert.equal(earthHourLabel(d), '06:45');
  assert.equal(
    formatAstronautLogHeader('2026-11-14', '06:45', 142),
    "Astronaut's Log, Earth Day 2026-11-14, Hour 06:45 · Mission Day 142",
  );
});
test('evaluates wrist and body sensor thresholds into normal, yellow, and red emergency zones', () => {
  assert.equal(evaluateAllVitals(defaultBodyReadings).overall, 'normal');
  const yellowState = evaluateAllVitals({ ...defaultBodyReadings, heartRate: 112 });
  assert.equal(yellowState.overall, 'yellow');
  assert.equal(yellowState.yellowItems.length, 1);
  const redState = evaluateAllVitals({ ...defaultBodyReadings, heartRate: 148, oxygen: 88 });
  assert.equal(redState.overall, 'red');
  assert.equal(redState.redItems.length, 2);
});
