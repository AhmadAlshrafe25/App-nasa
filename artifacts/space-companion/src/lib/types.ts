export type MessageTag = 'comfort' | 'sleep' | 'celebration' | 'humor';

export interface FamilyMessage {
  id: string;
  sender: string;
  relationship: string;
  durationSeconds: number;
  recordedOn: string; // ISO date
  title: string;
  /** Fictional written text of the message, shown as an accessible transcript. */
  transcript: string;
  tags: MessageTag[];
  /** Demonstration audio. Sample provider uses "tone:<seed>" which is synthesized in-browser. */
  audioSrc: string;
}

export interface WellbeingSnapshot {
  sleepHours: number;
  stress: number; // 0-10
  mood: number; // 1-5
}

export interface MissionContext {
  missionName: string;
  missionDay: number;
  totalDays: number;
  daysSinceLastMessage: number;
}

export interface CheckIn {
  id: string;
  date: string;
  mood: number;
  note: string;
}

export interface Reflection {
  id: string;
  messageId: string;
  date: string;
  feelingAfter: number;
  note: string;
}

export interface ListenEvent {
  id: string;
  messageId: string;
  date: string;
}

export interface Recommendation {
  message: FamilyMessage;
  rule: string;
  reasons: string[];
}
