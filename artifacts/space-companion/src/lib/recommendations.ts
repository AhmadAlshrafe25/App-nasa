import type { FamilyMessage, MessageTag, Recommendation, WellbeingSnapshot } from './types';

/**
 * Transparent, rule-based recommender.
 * THRESHOLDS ARE ILLUSTRATIVE SAMPLE RULES — not validated, not clinical.
 */
export const SAMPLE_RULES = {
  sleepUnderHours: 6,
  stressAtLeast: 6,
  moodAtMost: 2,
} as const;

function newestFirst(a: FamilyMessage, b: FamilyMessage) {
  return b.recordedOn.localeCompare(a.recordedOn);
}

function pick(messages: FamilyMessage[], tags: MessageTag[], heard: Set<string>) {
  const tagged = messages.filter((m) => m.tags.some((t) => tags.includes(t))).sort(newestFirst);
  return tagged.find((m) => !heard.has(m.id)) ?? tagged[0];
}

export function recommend(
  snapshot: WellbeingSnapshot,
  messages: FamilyMessage[],
  heardIds: string[] = [],
): Recommendation | null {
  if (messages.length === 0) return null;
  const heard = new Set(heardIds);
  const r = SAMPLE_RULES;

  if (snapshot.sleepHours < r.sleepUnderHours) {
    const m = pick(messages, ['sleep', 'comfort'], heard);
    if (m) return {
      message: m, rule: 'low-sleep',
      reasons: [
        `Sleep ${snapshot.sleepHours.toFixed(1)} h is under the ${r.sleepUnderHours} h sample rule.`,
        `Preferring messages tagged "sleep" or "comfort" — this one is tagged ${m.tags.join(', ')}.`,
        heard.has(m.id) ? 'All matching messages were already heard; showing the newest.' : 'You have not played it yet in this sample history.',
      ],
    };
  }
  if (snapshot.stress >= r.stressAtLeast) {
    const m = pick(messages, ['comfort'], heard);
    if (m) return {
      message: m, rule: 'high-stress',
      reasons: [
        `Stress ${snapshot.stress}/10 meets the ${r.stressAtLeast}+ sample rule.`,
        'Preferring messages tagged "comfort".',
      ],
    };
  }
  if (snapshot.mood <= r.moodAtMost) {
    const m = pick(messages, ['comfort', 'celebration'], heard);
    if (m) return {
      message: m, rule: 'low-mood',
      reasons: [
        `Mood ${snapshot.mood}/5 is at or under the ${r.moodAtMost}/5 sample rule.`,
        'Preferring messages tagged "comfort" or "celebration".',
      ],
    };
  }
  const sorted = [...messages].sort(newestFirst);
  const m = sorted.find((x) => !heard.has(x.id)) ?? sorted[0];
  return {
    message: m, rule: 'most-recent',
    reasons: [
      'No sample rule fired for sleep, stress, or mood.',
      heard.has(m.id) ? 'Showing the most recent message.' : 'Showing the most recent message you have not heard yet.',
    ],
  };
}
