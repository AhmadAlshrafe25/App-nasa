import type { CompanionProvider } from './provider';
import type { CheckIn, ListenEvent, Reflection } from '../types';
import { SAMPLE_MESSAGES, SAMPLE_MISSION, SAMPLE_SNAPSHOT } from '../sample-data';
import { recommend } from '../recommendations';

const KEY = 'space-companion:v1:';
const delay = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 180));
const uid = () => Math.random().toString(36).slice(2, 10);

function read<T>(k: string): T[] {
  try { return JSON.parse(localStorage.getItem(KEY + k) ?? '[]') as T[]; } catch { return []; }
}
function write<T>(k: string, v: T[]) {
  try { localStorage.setItem(KEY + k, JSON.stringify(v.slice(0, 200))); } catch { /* storage unavailable */ }
}

export function createSampleProvider(): CompanionProvider {
  return {
    name: 'Sample (in-memory + localStorage)',
    getMessages: () => delay(SAMPLE_MESSAGES),
    getWellbeingSnapshot: () => delay(SAMPLE_SNAPSHOT),
    getMissionContext: () => delay(SAMPLE_MISSION),
    async getRecommendations(snapshot, messages) {
      const heard = read<ListenEvent>('listens').map((e) => e.messageId);
      const r = recommend(snapshot, messages, heard);
      return delay(r ? [r] : []);
    },
    async saveCheckIn(input) {
      const c: CheckIn = { ...input, id: uid(), date: new Date().toISOString() };
      write('checkins', [c, ...read<CheckIn>('checkins')]);
      return delay(c);
    },
    async saveReflection(input) {
      const r: Reflection = { ...input, id: uid(), date: new Date().toISOString() };
      write('reflections', [r, ...read<Reflection>('reflections')]);
      return delay(r);
    },
    async logListen(messageId) {
      const e: ListenEvent = { id: uid(), messageId, date: new Date().toISOString() };
      write('listens', [e, ...read<ListenEvent>('listens')]);
      return e;
    },
    listCheckIns: () => delay(read<CheckIn>('checkins')),
    listReflections: () => delay(read<Reflection>('reflections')),
    listListenEvents: () => delay(read<ListenEvent>('listens')),
  };
}
