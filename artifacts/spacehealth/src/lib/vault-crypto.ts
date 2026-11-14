const ITERATIONS = 600_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SealedValue = { iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };
export type VaultConfig = {
  version: 1;
  salt: Uint8Array<ArrayBuffer>;
  iterations: number;
  check: SealedValue;
};
const CHECK = 'SpaceHealth device vault v1';

function cryptoApi() {
  if (!globalThis.crypto?.subtle) throw new Error('Device encryption is unavailable. Use a supported browser on HTTPS.');
  return globalThis.crypto;
}

export async function deriveVaultKey(password: string, salt: Uint8Array<ArrayBuffer>, iterations = ITERATIONS) {
  const crypto = cryptoApi();
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'],
  );
}

export async function sealValue(key: CryptoKey, value: string, context: string): Promise<SealedValue> {
  const crypto = cryptoApi();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: encoder.encode(context) }, key, encoder.encode(value),
  );
  return { iv, ciphertext };
}

export async function openValue(key: CryptoKey, sealed: SealedValue, context: string) {
  const bytes = await cryptoApi().subtle.decrypt(
    { name: 'AES-GCM', iv: sealed.iv, additionalData: encoder.encode(context) }, key, sealed.ciphertext,
  );
  return decoder.decode(bytes);
}

export async function createVaultConfig(password: string) {
  if (password.length < 12) throw new Error('Use a password with at least 12 characters.');
  const salt = cryptoApi().getRandomValues(new Uint8Array(16));
  const key = await deriveVaultKey(password, salt);
  const config: VaultConfig = {
    version: 1, salt, iterations: ITERATIONS,
    check: await sealValue(key, CHECK, 'vault-check'),
  };
  return { key, config };
}

export async function verifyVaultPassword(password: string, config: VaultConfig) {
  if (config.version !== 1 || config.iterations !== ITERATIONS) throw new Error('Unsupported device vault format. Existing data has not been changed.');
  const key = await deriveVaultKey(password, config.salt, config.iterations);
  try {
    if (await openValue(key, config.check, 'vault-check') !== CHECK) throw new Error('Invalid check');
  } catch {
    throw new Error('Incorrect password, or the protected database could not be verified.');
  }
  return key;
}
