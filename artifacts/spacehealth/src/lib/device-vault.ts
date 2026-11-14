import { logStorageKey, readEntries, type DailyEntry } from './daily-log';
import { createVaultConfig, verifyVaultPassword, sealValue, openValue, type SealedValue, type VaultConfig } from './vault-crypto';

export const vaultDatabaseName = 'spacehealth-protected-device-log';
export const vaultChangedEvent = 'spacehealth-vault-changed';
export { logDayMarkerKey } from './daily-log';
type EncryptedEntry = SealedValue & { id: string };
type LegacyStore = Pick<Storage, 'getItem' | 'removeItem'>;

async function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('This browser cannot open the protected device database.');
  if (!globalThis.crypto?.subtle) throw new Error('Device encryption is unavailable. Use a supported browser on HTTPS.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(vaultDatabaseName, 1);
    let blocked = false;
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('meta');
      db.createObjectStore('recordings', { keyPath: 'id' });
    };
    request.onerror = () => reject(new Error('Device database could not be opened. Existing recordings have not been changed.'));
    request.onblocked = () => {
      blocked = true;
      reject(new Error('Close other SpaceHealth tabs, then try again.'));
    };
    request.onsuccess = () => {
      if (blocked) { request.result.close(); return; }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

/** Resolves only on transaction completion, never merely on a put request's success. */
function transaction<T>(db: IDBDatabase, stores: string[], mode: IDBTransactionMode, queue: (tx: IDBTransaction) => () => T): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let result: () => T;
    try { result = queue(tx); } catch (error) { tx.abort(); reject(error); return; }
    tx.oncomplete = () => resolve(result());
    tx.onabort = tx.onerror = () => reject(new Error('Device database write/read failed. Your existing recordings have not been removed.'));
  });
}

async function withDatabase<T>(work: (db: IDBDatabase) => Promise<T>) {
  const db = await database();
  try { return await work(db); } finally { db.close(); }
}

export function readVaultConfig() {
  return withDatabase(db => transaction(db, ['meta'], 'readonly', tx => {
    const req = tx.objectStore('meta').get('config');
    return () => req.result as VaultConfig | undefined;
  }));
}

async function encryptedEntries(db: IDBDatabase) {
  return transaction(db, ['recordings'], 'readonly', tx => {
    const req = tx.objectStore('recordings').getAll();
    return () => req.result as EncryptedEntry[];
  });
}

async function decodeEntry(key: CryptoKey, row: EncryptedEntry): Promise<DailyEntry> {
  const entry = JSON.parse(await openValue(key, row, `entry:${row.id}`)) as DailyEntry;
  // Reuse legacy validation, including preservation of unknown fields.
  return readEntries({ getItem: () => JSON.stringify([entry]), setItem: () => undefined })[0];
}

export async function readVaultEntries(key: CryptoKey) {
  return withDatabase(async db => {
    const entries = await Promise.all((await encryptedEntries(db)).map(row => decodeEntry(key, row)));
    return entries.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  });
}

export function readVaultEntryCount() {
  return withDatabase(db => transaction(db, ['recordings'], 'readonly', tx => {
    const req = tx.objectStore('recordings').count();
    return () => req.result;
  }));
}

function legacySnapshot(store: LegacyStore) {
  const raw = store.getItem(logStorageKey);
  let entries: DailyEntry[];
  try {
    entries = readEntries({ getItem: () => raw, setItem: () => undefined });
  } catch {
    // JSON parser messages can contain excerpts of a private transcript.
    throw new Error('Existing on-device recordings could not be read. Originals were kept unchanged; do not clear browser storage.');
  }
  if (new Set(entries.map(e => e.id)).size !== entries.length) {
    throw new Error('Old recordings contain duplicate identifiers. They were kept unchanged; migration needs review.');
  }
  return { raw, entries };
}

async function encryptEntry(key: CryptoKey, entry: DailyEntry): Promise<EncryptedEntry> {
  return { id: entry.id, ...await sealValue(key, JSON.stringify(entry), `entry:${entry.id}`) };
}

/** Verify every encrypted copy before removing any plaintext archive. Safe to retry after a failed migration. */
async function verifyMigration(key: CryptoKey, snapshot: ReturnType<typeof legacySnapshot>, store: LegacyStore) {
  const copied = new Map((await readVaultEntries(key)).map(entry => [entry.id, entry]));
  for (const entry of snapshot.entries) {
    if (JSON.stringify(copied.get(entry.id)) !== JSON.stringify(entry)) {
      throw new Error('Encrypted copy verification failed. Original recordings were kept unchanged.');
    }
  }
  if (store.getItem(logStorageKey) !== snapshot.raw) {
    throw new Error('Old recordings changed in another tab. They were kept; close the other tab and unlock again.');
  }
  if (snapshot.raw !== null) store.removeItem(logStorageKey);
}

export async function setupDeviceVault(password: string, store: LegacyStore = localStorage) {
  const snapshot = legacySnapshot(store);
  const { key, config } = await createVaultConfig(password);
  const rows = await Promise.all(snapshot.entries.map(entry => encryptEntry(key, entry)));
  await withDatabase(db => transaction(db, ['meta', 'recordings'], 'readwrite', tx => {
    // add, not put: a second tab must never overwrite an existing vault/key.
    tx.objectStore('meta').add(config, 'config');
    for (const row of rows) tx.objectStore('recordings').add(row);
    return () => undefined;
  }));
  await verifyMigration(key, snapshot, store);
  announceVaultChange();
  return key;
}

export async function unlockDeviceVault(password: string, store: LegacyStore = localStorage) {
  const config = await readVaultConfig();
  if (!config) throw new Error('Set up protection on this device first.');
  const key = await verifyVaultPassword(password, config);
  const snapshot = legacySnapshot(store);
  if (snapshot.raw !== null) {
    const existing = new Map((await readVaultEntries(key)).map(entry => [entry.id, entry]));
    const missing: DailyEntry[] = [];
    for (const entry of snapshot.entries) {
      const old = existing.get(entry.id);
      if (old && JSON.stringify(old) !== JSON.stringify(entry)) {
        throw new Error('An old recording conflicts with its encrypted copy. Both were kept; migration needs review.');
      }
      if (!old) missing.push(entry);
    }
    const rows = await Promise.all(missing.map(entry => encryptEntry(key, entry)));
    if (rows.length) await withDatabase(db => transaction(db, ['recordings'], 'readwrite', tx => {
      for (const row of rows) tx.objectStore('recordings').add(row);
      return () => undefined;
    }));
    await verifyMigration(key, snapshot, store);
  }
  // Fail closed if any encrypted entry cannot be read.
  await readVaultEntries(key);
  announceVaultChange();
  return key;
}

export async function saveVaultEntry(key: CryptoKey, entry: DailyEntry) {
  const row = await encryptEntry(key, entry);
  await withDatabase(db => transaction(db, ['recordings'], 'readwrite', tx => {
    tx.objectStore('recordings').add(row);
    return () => undefined;
  }));
  // A successful save must be durable and decryptable before the UI clears its draft.
  const verified = await withDatabase(db => transaction(db, ['recordings'], 'readonly', tx => {
    const req = tx.objectStore('recordings').get(entry.id);
    return () => req.result as EncryptedEntry;
  }));
  if (JSON.stringify(await decodeEntry(key, verified)) !== JSON.stringify(entry)) throw new Error('Saved recording could not be verified. Keep this draft and retry.');
  return readVaultEntries(key);
}

export function announceVaultChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(vaultChangedEvent));
}
