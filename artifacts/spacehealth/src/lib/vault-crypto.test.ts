import test from 'node:test';
import assert from 'node:assert/strict';
import { createVaultConfig, verifyVaultPassword, sealValue, openValue } from './vault-crypto.ts';

test('device vault uses a non-exportable AES key and rejects short passwords', async () => {
  await assert.rejects(createVaultConfig('too-short'), /12 characters/);
  const { key } = await createVaultConfig('temporary-test-password-only');
  assert.equal(key.extractable, false);
  assert.equal(key.algorithm.name, 'AES-GCM');
});

test('recordings decrypt after re-deriving the key, never with a wrong password', async () => {
  const { key, config } = await createVaultConfig('temporary-test-password-only');
  const sealed = await sealValue(key, '{"audio":"sample voice","mood":"Good"}', 'entry:sample');
  const unlocked = await verifyVaultPassword('temporary-test-password-only', config);
  assert.equal(await openValue(unlocked, sealed, 'entry:sample'), '{"audio":"sample voice","mood":"Good"}');
  assert.ok(!new TextDecoder().decode(sealed.ciphertext).includes('sample voice'));
  await assert.rejects(verifyVaultPassword('different-test-password-only', config), /Incorrect password/);
});

test('each encrypted write has a fresh nonce; tampered or swapped entries fail closed', async () => {
  const { key } = await createVaultConfig('temporary-test-password-only');
  const a = await sealValue(key, 'secret recording', 'entry:a');
  const b = await sealValue(key, 'secret recording', 'entry:a');
  assert.notDeepEqual(a.iv, b.iv);
  await assert.rejects(openValue(key, a, 'entry:b'));
  const corrupted = new Uint8Array(a.ciphertext.slice(0));
  corrupted[0] ^= 1;
  await assert.rejects(openValue(key, { ...a, ciphertext: corrupted.buffer }, 'entry:a'));
});
