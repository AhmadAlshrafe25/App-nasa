export const logStorageKey = 'spacehealth-checkins-v1';
export const reminderStorageKey = 'spacehealth-daily-reminder-v1';
export const logChangedEvent = 'spacehealth-log-saved';
export const reminderMessage = "SpaceHealth reminder. It's time to record your daily health log.";

// Keep the original fields/key so existing on-device check-ins remain readable.
export type DailyEntry = {
  id: string; createdAt: string; mood: string; stress: number; sleep: string; note: string;
  logDate?: string; heartRate?: number; sleepHours?: number; activityMinutes?: number;
  radiationDose?: number;
};
export type DailyReminder = {
  enabled: boolean; time: string; voiceEnabled: boolean; lastFired: string; dismissedOn: string;
};
export const defaultReminder: DailyReminder = {
  enabled: false, time: '20:00', voiceEnabled: true, lastFired: '', dismissedOn: '',
};
type Store = Pick<Storage, 'getItem' | 'setItem'>;
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function readEntries(store: Store): DailyEntry[] {
  const raw = store.getItem(logStorageKey);
  if (raw === null) return [];
  const entries: unknown = JSON.parse(raw);
  if (!Array.isArray(entries) || !entries.every(entry =>
    entry && typeof entry === 'object' && typeof entry.id === 'string'
    && typeof entry.createdAt === 'string' && Number.isFinite(Date.parse(entry.createdAt))
    && typeof entry.mood === 'string' && typeof entry.sleep === 'string'
    && typeof entry.stress === 'number' && Number.isFinite(entry.stress)
    && typeof entry.note === 'string'
  )) throw new Error('Saved logs could not be read. Existing data has not been changed.');
  return entries;
}
export function appendEntry(store: Store, entry: DailyEntry) {
  const entries = [entry, ...readEntries(store)];
  // Persist before reporting success; a failed write must keep the form intact.
  store.setItem(logStorageKey, JSON.stringify(entries));
  return entries;
}
export function readReminder(store: Store): DailyReminder {
  const raw = store.getItem(reminderStorageKey);
  if (raw === null) return { ...defaultReminder };
  const value = JSON.parse(raw);
  if (!value || typeof value.enabled !== 'boolean' || typeof value.voiceEnabled !== 'boolean'
    || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time)
    || typeof value.lastFired !== 'string' || typeof value.dismissedOn !== 'string') {
    throw new Error('Reminder settings could not be read. Existing settings have not been changed.');
  }
  return value as DailyReminder;
}
export function hasLogForDay(entries: DailyEntry[], day: string) {
  return entries.some(entry => (entry.logDate || localDay(new Date(entry.createdAt))) === day);
}
export function reminderDue(settings: DailyReminder, now: Date, alreadyLogged: boolean) {
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  return settings.enabled && !alreadyLogged && settings.lastFired !== localDay(now)
    && /^([01]\d|2[0-3]):[0-5]\d$/.test(settings.time) && time >= settings.time;
}
