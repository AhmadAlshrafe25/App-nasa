import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoiceLogEntry } from './daily-log.ts';

const draft = {
  id: 'voice-test',
  capturedAt: new Date(2026, 10, 14, 23, 59),
  audio: 'data:audio/webm;codecs=opus;base64,YXVkaW8=',
  duration: 3,
  transcript: '  Completed the daily exercise.  ',
  mood: 'Good',
  stress: 4,
};

test('voice logs derive their day and hour automatically from recording time', () => {
  const entry = createVoiceLogEntry(draft);
  assert.equal(entry.earthDay, '2026-11-14');
  assert.equal(entry.earthHour, '23:59');
  assert.equal(entry.createdAt, draft.capturedAt.toISOString());
  assert.equal(entry.voiceTranscript, 'Completed the daily exercise.');
  assert.equal(entry.voiceCaptureSource, 'microphone');
  assert.equal(entry.note, entry.voiceTranscript);
  assert.equal(entry.mood, 'Good');
  assert.equal(entry.stress, 4);
  assert.equal(entry.heartRate, undefined);
});

test('audio-only logs never invent a transcript', () => {
  const entry = createVoiceLogEntry({ ...draft, transcript: '' });
  assert.equal(entry.voiceAudioDataUrl, draft.audio);
  assert.equal(entry.voiceTranscript, undefined);
  assert.match(entry.note, /no on-device transcript/);
});

test('no voice recording or invalid mood/stress cannot create an entry', () => {
  assert.throws(() => createVoiceLogEntry({ ...draft, audio: '' }));
  assert.throws(() => createVoiceLogEntry({ ...draft, duration: 0 }));
  assert.throws(() => createVoiceLogEntry({ ...draft, stress: 11 }));
  assert.throws(() => createVoiceLogEntry({ ...draft, capturedAt: new Date('invalid') }));
});
