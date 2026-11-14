import type { CheckInRequest, FamilyMessage, RecommendedFamilyMedia } from '@workspace/api-client-react';

/** The backend's "normal" scenario values. A labelled sample, not a sensor reading. */
export const SAMPLE_CHECKIN: CheckInRequest = {
  heart_rate_bpm: 63, systolic_bp: 118, diastolic_bp: 76, sleep_hours: 7.4, stress_score: 3,
  mood: 'calm', activity_minutes: 110, radiation_msv: 0.55, isolation_level: 3,
};

export const MARS_DELAY_MINUTES = 14;

/** Local stand-in used only when the API cannot be reached. Not generated from any real data. */
export const OFFLINE_COMPANION = {
  summary: 'Offline sample. Your check-in looks steady. This is general support, not a diagnosis.',
  relaxation_action: 'A 5-minute body scan: relax shoulders, jaw and hands, one breath at a time.',
};

export const OFFLINE_SAMPLE_MESSAGE: FamilyMessage = {
  id: -1, astronaut_id: 'AST-01', sender_name: 'Sample sender', relationship: 'Sample', media_type: 'text',
  title: 'Sample note', message_text: 'Sample text only. Not a real family message or recording.',
  media_url: null, mood_tag: 'general', is_viewed: false, created_at: '1970-01-01T00:00:00Z',
};

export type NewMessageInput = Pick<FamilyMessage, 'sender_name' | 'relationship' | 'title' | 'mood_tag'> & { message_text: string };

export function validateNewMessage(input: NewMessageInput): string | null {
  const limits: [string, string, number][] = [
    ['Sender', input.sender_name, 80], ['Relationship', input.relationship, 60], ['Title', input.title, 120],
  ];
  for (const [label, value, max] of limits) {
    if (!value.trim()) return `${label} is required.`;
    if (value.trim().length > max) return `${label} must be ${max} characters or fewer.`;
  }
  if (!input.message_text.trim()) return 'Message text is required.';
  if (input.message_text.trim().length > 4000) return 'Message text must be 4000 characters or fewer.';
  return null;
}

/** Newest unviewed message first, matching the backend's "no matching state" wording. */
export function pickLocalMessage(messages: FamilyMessage[]): RecommendedFamilyMedia {
  const next = [...messages].filter(m => !m.is_viewed).sort((a, b) => b.id - a.id)[0];
  return next
    ? { message: next, selection_reason: 'Offline sample: newest unviewed message shown.' }
    : { message: null, selection_reason: 'No unviewed messages in this offline session.' };
}

export function markLocalViewed(messages: FamilyMessage[], id: number): FamilyMessage[] {
  return messages.map(m => (m.id === id ? { ...m, is_viewed: true } : m));
}

export function addLocalMessage(messages: FamilyMessage[], input: NewMessageInput, now: Date = new Date()): FamilyMessage[] {
  const nextId = Math.max(0, ...messages.map(m => m.id)) + 1;
  const added: FamilyMessage = {
    id: nextId, astronaut_id: 'AST-01', sender_name: input.sender_name.trim(), relationship: input.relationship.trim(),
    media_type: 'text', title: input.title.trim(), message_text: input.message_text.trim(), media_url: null,
    mood_tag: input.mood_tag, is_viewed: false, created_at: now.toISOString(),
  };
  return [...messages, added];
}

/** Local simulated Earth-sync queue: a plain packet counter. */
export const queueLocalPacket = (pending: number) => pending + 1;
export const syncLocalQueue = (pending: number) => ({ synced: pending, pending: 0 });

export function syncResultText(synced: number): string {
  const noun = synced === 1 ? 'packet' : 'packets';
  return synced === 0 ? 'Nothing to sync · simulated, no real transfer' : `Synced ${synced} ${noun} · simulated, no real transfer`;
}
