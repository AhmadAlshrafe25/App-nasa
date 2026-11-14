import { logStorageKey, readEntries, type DailyEntry } from './daily-log';
import { readVaultConfig, readVaultEntries, readVaultEntryCount, unlockDeviceVault } from './device-vault';

/** Intentionally readable without an app password, including by someone using the device later. */
export const journeyDatabaseName = 'spacehealth-device-journey';
type LegacyStore = Pick<Storage, 'getItem' | 'removeItem'>;

async function openDatabase(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('Device storage is unavailable in this browser.');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(journeyDatabaseName, 1);
    let blocked = false;
    req.onupgradeneeded = () => {
      req.result.createObjectStore('entries', { keyPath: 'id' });
      req.result.createObjectStore('meta');
    };
    req.onerror = () => reject(new Error('Device storage could not be opened. Existing logs were not changed.'));
    req.onblocked = () => { blocked = true; reject(new Error('Close other SpaceHealth tabs and retry.')); };
    req.onsuccess = () => {
      if (blocked) { req.result.close(); return; }
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
  });
}

async function transaction<T>(stores: string[], mode: IDBTransactionMode, queue: (tx: IDBTransaction) => () => T) {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result: () => T;
      try { result = queue(tx); } catch (e) { tx.abort(); reject(e); return; }
      tx.oncomplete = () => resolve(result());
      tx.onerror = tx.onabort = () => reject(new Error('Device storage failed. Existing logs and source recordings were not removed.'));
    });
  } finally { db.close(); }
}

function validateEntries(entries: unknown): DailyEntry[] {
  try {
    const valid = readEntries({ getItem: () => JSON.stringify(entries), setItem: () => undefined });
    if (new Set(valid.map(e => e.id)).size !== valid.length) throw new Error('Duplicate identifiers');
    return valid;
  } catch {
    throw new Error('Existing recordings could not be read safely. Originals were kept unchanged; do not clear browser storage.');
  }
}

export async function readJourneyEntries() {
  const entries = await transaction(['entries'], 'readonly', tx => {
    const req = tx.objectStore('entries').getAll();
    return () => req.result;
  });
  return validateEntries(entries).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Merge without overwriting a different recording sharing an identifier. */
async function mergeVerified(source: DailyEntry[]) {
  validateEntries(source);
  const existing = new Map((await readJourneyEntries()).map(e => [e.id, e]));
  const missing: DailyEntry[] = [];
  for (const entry of source) {
    const current = existing.get(entry.id);
    if (current && JSON.stringify(current) !== JSON.stringify(entry)) {
      throw new Error('An older recording conflicts with an existing entry. Both copies were kept unchanged.');
    }
    if (!current) missing.push(entry);
  }
  if (missing.length) await transaction(['entries'], 'readwrite', tx => {
    for (const entry of missing) tx.objectStore('entries').add(entry);
    return () => undefined;
  });
  const verified = await readJourneyEntries();
  const copies = new Map(verified.map(entry => [entry.id, entry]));
  for (const entry of source) {
    if (JSON.stringify(copies.get(entry.id)) !== JSON.stringify(entry)) {
      throw new Error('Copied recordings could not be verified. Originals were kept unchanged.');
    }
  }
  return verified;
}

export async function loadDeviceJourney(store: LegacyStore = localStorage) {
  const raw = store.getItem(logStorageKey);
  if (raw === null) return readJourneyEntries();
  let source: DailyEntry[];
  try { source = validateEntries(JSON.parse(raw)); }
  catch { throw new Error('Old recordings could not be read. Originals were kept unchanged; do not clear browser storage.'); }
  const entries = await mergeVerified(source);
  if (store.getItem(logStorageKey) !== raw) throw new Error('Old logs changed in another tab. Close that tab and retry; originals were kept.');
  // Remove the old plaintext copy only after the IndexedDB transaction and readback both succeed.
  store.removeItem(logStorageKey);
  return entries;
}

export async function saveJourneyEntry(entry: DailyEntry) {
  validateEntries([entry]);
  await transaction(['entries'], 'readwrite', tx => {
    tx.objectStore('entries').add(entry);
    return () => undefined;
  });
  const entries = await readJourneyEntries();
  if (JSON.stringify(entries.find(e => e.id === entry.id)) !== JSON.stringify(entry)) {
    throw new Error('Recording could not be verified. Keep your draft and retry.');
  }
  return entries;
}

export async function hasProtectedJourney() {
  const imported = await transaction(['meta'], 'readonly', tx => {
    const req = tx.objectStore('meta').get('protected-import-complete');
    return () => req.result;
  });
  if (imported) return false;
  return Boolean(await readVaultConfig()) && await readVaultEntryCount() > 0;
}

/** Only old password-encrypted files need their old password once. The normal journey never does. */
export async function importProtectedJourney(password: string) {
  const key = await unlockDeviceVault(password);
  const source = await readVaultEntries(key);
  const entries = await mergeVerified(source);
  await transaction(['meta'], 'readwrite', tx => {
    tx.objectStore('meta').put(true, 'protected-import-complete');
    return () => undefined;
  });
  // Original encrypted database is retained as a recovery copy; never delete it here.
  return entries;
}
