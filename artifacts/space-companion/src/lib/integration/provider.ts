import type {
  CheckIn, FamilyMessage, ListenEvent, MissionContext, Recommendation, Reflection, WellbeingSnapshot,
} from '../types';

/** The only surface the UI depends on. Swap implementations via CompanionContext. */
export interface CompanionProvider {
  readonly name: string;
  getMessages(): Promise<FamilyMessage[]>;
  getWellbeingSnapshot(): Promise<WellbeingSnapshot>;
  getMissionContext(): Promise<MissionContext>;
  getRecommendations(snapshot: WellbeingSnapshot, messages: FamilyMessage[]): Promise<Recommendation[]>;
  saveCheckIn(input: Omit<CheckIn, 'id' | 'date'>): Promise<CheckIn>;
  saveReflection(input: Omit<Reflection, 'id' | 'date'>): Promise<Reflection>;
  logListen(messageId: string): Promise<ListenEvent>;
  listCheckIns(): Promise<CheckIn[]>;
  listReflections(): Promise<Reflection[]>;
  listListenEvents(): Promise<ListenEvent[]>;
}
