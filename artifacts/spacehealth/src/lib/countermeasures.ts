/** Device-local examples only. None of these values represents physiology or flight hardware. */
export const countermeasureStorageKey = 'spacehealth-countermeasures-v1';

export type Workout = { loadKg: number; repetitions: number; sets: number };
export type SampleSession = Workout & { recordedAt: string; axialScore: number };
export type CountermeasureState = {
  version: 1;
  scenario: 'example' | 'low' | 'missing';
  sessions: SampleSession[];
  completions: string[];
};

export const emptyCountermeasureState: CountermeasureState = {
  version: 1, scenario: 'example', sessions: [], completions: [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function validateWorkout(value: unknown): string | null {
  if (!isRecord(value)) return 'Enter a sample load, repetitions, and sets.';
  const { loadKg, repetitions, sets } = value;
  if (typeof loadKg !== 'number' || !Number.isFinite(loadKg) || loadKg < 0 || loadKg > 300) {
    return 'Enter a sample resistance load from 0 to 300 kg.';
  }
  if (typeof repetitions !== 'number' || !Number.isInteger(repetitions) || repetitions < 1 || repetitions > 100) {
    return 'Enter whole repetitions from 1 to 100.';
  }
  if (typeof sets !== 'number' || !Number.isInteger(sets) || sets < 1 || sets > 20) {
    return 'Enter whole sets from 1 to 20.';
  }
  return null;
}

/** An arbitrary workload illustration in points, NOT axial force, dose, or a health score. */
export function axialLoadingScore(workout: Workout): number {
  const error = validateWorkout(workout);
  if (error) throw new Error(error);
  return Math.round(Math.min(100, workout.loadKg * workout.repetitions * workout.sets / 60) * 10) / 10;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value));
}

/**
 * Reject unreadable stored data instead of replacing it with reassuring defaults.
 * The UI must surface the error and leave the original storage untouched.
 */
export function normalizeCountermeasureState(value: unknown): CountermeasureState {
  if (!isRecord(value) || value.version !== 1
    || !['example', 'low', 'missing'].includes(String(value.scenario))
    || !Array.isArray(value.sessions) || !Array.isArray(value.completions)
    || !value.sessions.every(session => isRecord(session) && !validateWorkout(session)
      && validTimestamp(session.recordedAt) && typeof session.axialScore === 'number'
      && Number.isFinite(session.axialScore))
    || !value.completions.every(validTimestamp)) {
    throw new Error('Saved simulation could not be read. Existing data has not been changed.');
  }
  return {
    version: 1,
    scenario: value.scenario as CountermeasureState['scenario'],
    sessions: value.sessions.slice(0, 50).map(session => ({
      loadKg: session.loadKg, repetitions: session.repetitions, sets: session.sets,
      recordedAt: session.recordedAt,
      // Recompute the arbitrary score rather than trusting a stored derived value.
      axialScore: axialLoadingScore(session),
    })),
    completions: value.completions.slice(0, 50),
  };
}

export function getExampleTrends(scenario: CountermeasureState['scenario']) {
  const days = [0, 5, 10, 15, 20, 25, 30];
  if (scenario === 'low') {
    return {
      days,
      muscle: [100, 99.7, 99.5, 99.2, 99, 98.8, 98.5] as (number | null)[],
      bone: [100, 99.9, 99.8, 99.7, 99.5, 99.3, 99] as (number | null)[],
    };
  }
  if (scenario === 'example') {
    return {
      days,
      muscle: [100, 99.9, 99.9, 99.8, 99.9, 99.8, 99.8] as (number | null)[],
      bone: [100, 100, 99.9, 99.9, 99.9, 99.8, 99.8] as (number | null)[],
    };
  }
  return { days, muscle: days.map(() => null), bone: days.map(() => null) };
}

export function getExampleAlert(scenario: CountermeasureState['scenario']): string | null {
  if (scenario === 'missing') return 'Sample data unavailable. No comparison or alert assessment is possible.';
  if (scenario === 'low') {
    return 'Unvalidated early-alert example: the fictional 1% change trigger is reached. The sample illustrates 0.5–1.5% changes over 30 days, not measured loss, diagnosis, or a prediction.';
  }
  return null;
}
