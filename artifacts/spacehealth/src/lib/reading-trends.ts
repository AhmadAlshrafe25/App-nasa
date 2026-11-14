import type { BodyReadings } from './vitals';

// Fictional daily examples retained from the former Trends page.
const history: Partial<Record<keyof BodyReadings, readonly number[]>> = {
  heartRate: [61, 63, 62, 64, 60, 62, 65, 63, 64, 61, 63, 62, 66, 64],
  oxygen: [98, 97, 98, 98, 97, 98, 99, 98, 97, 98, 98, 97, 98, 98],
  sleep: [7.1, 6.8, 7.4, 6.9, 7.6, 7.2, 6.6, 7.8, 7.1, 7.4, 6.9, 7.7, 7.3, 7.4],
  hrv: [26, 29, 27, 31, 34, 28, 26, 32, 35, 30, 27, 33, 31, 29],
};

export const primaryReadingKeys: readonly (keyof BodyReadings)[] = ['heartRate', 'oxygen', 'sleep', 'hrv'];

export function getReadingTrend(key: keyof BodyReadings, current: number, days: 7 | 14): number[] | null {
  const previous = history[key];
  if (!previous || !Number.isFinite(current)) return null;
  return [...previous.slice(0, -1), current].slice(-days);
}
