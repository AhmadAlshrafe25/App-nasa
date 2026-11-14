import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OFFLINE_SAMPLE_MESSAGE, SAMPLE_CHECKIN, addLocalMessage, markLocalViewed, pickLocalMessage,
  queueLocalPacket, syncLocalQueue, syncResultText, validateNewMessage,
} from './space-fallback.ts';

const valid = { sender_name: 'Sam', relationship: 'Sibling', title: 'Hello', message_text: 'Thinking of you', mood_tag: 'general' as const };

test('sample check-in uses the backend normal-scenario values', () => {
  assert.equal(SAMPLE_CHECKIN.heart_rate_bpm, 63);
  assert.equal(SAMPLE_CHECKIN.mood, 'calm');
  assert.equal(SAMPLE_CHECKIN.radiation_msv, 0.55);
});

test('message validation reports the first missing field and overlong values', () => {
  assert.equal(validateNewMessage(valid), null);
  assert.equal(validateNewMessage({ ...valid, sender_name: '  ' }), 'Sender is required.');
  assert.equal(validateNewMessage({ ...valid, message_text: '' }), 'Message text is required.');
  assert.match(validateNewMessage({ ...valid, title: 'x'.repeat(121) })!, /120/);
});

test('offline messages can be viewed and added during the session', () => {
  const list = [OFFLINE_SAMPLE_MESSAGE];
  assert.equal(pickLocalMessage(list).message?.id, -1);
  const viewed = markLocalViewed(list, -1);
  assert.equal(pickLocalMessage(viewed).message, null);
  const added = addLocalMessage(viewed, valid, new Date('2026-01-01T00:00:00Z'));
  assert.equal(added.length, 2);
  assert.equal(pickLocalMessage(added).message?.sender_name, 'Sam');
  assert.equal(list[0].is_viewed, false);
});

test('local sync queue counts packets and clears on sync', () => {
  let pending = queueLocalPacket(queueLocalPacket(0));
  assert.equal(pending, 2);
  const result = syncLocalQueue(pending);
  assert.deepEqual(result, { synced: 2, pending: 0 });
  assert.match(syncResultText(result.synced), /Synced 2 packets · simulated, no real transfer/);
  assert.match(syncResultText(0), /Nothing to sync/);
});
