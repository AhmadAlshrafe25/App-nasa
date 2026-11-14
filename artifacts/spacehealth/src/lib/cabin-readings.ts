import type { VitalSeverity } from './vitals';

export type CabinKey = 'oxygen' | 'co2' | 'pressure' | 'temperature' | 'humidity';
export type CabinReadings = Record<CabinKey, number>;
export const cabinStorageKey = 'spacehealth-cabin-samples-v1';
export const cabinChangedEvent = 'spacehealth-cabin-samples-changed';
export const DEFAULT_CABIN_READINGS: CabinReadings = {
  oxygen: 21, co2: 1800, pressure: 101.3, temperature: 22, humidity: 45,
};

type CabinSpec = {
  key: CabinKey; label: string; unit: string;
  min: number; max: number; step: number; decimals: number;
  normalRangeText: string;
  evaluate: (value: number) => VitalSeverity;
};
const band = (value: number, normal: readonly [number, number], outer: readonly [number, number]): VitalSeverity =>
  value < outer[0] || value > outer[1] ? 'red'
    : value < normal[0] || value > normal[1] ? 'yellow' : 'normal';

/** Illustrative bands for an Earth-like cabin demo, not spacecraft operating or exposure limits.
 *  Real oxygen decisions require partial pressure, duration, mission rules and calibrated hardware.
 */
export const CABIN_SPECS: readonly CabinSpec[] = [
  {
    key: 'oxygen', label: 'Cabin oxygen', unit: '%', min: 0, max: 35, step: 0.1, decimals: 1,
    normalRangeText: '20–22%', evaluate: v => band(v, [20, 22], [19, 24]),
  },
  {
    key: 'co2', label: 'Carbon dioxide', unit: 'ppm', min: 0, max: 10000, step: 100, decimals: 0,
    normalRangeText: '0–3,000 ppm', evaluate: v => v > 5000 ? 'red' : v > 3000 ? 'yellow' : 'normal',
  },
  {
    key: 'pressure', label: 'Cabin pressure', unit: 'kPa', min: 40, max: 130, step: 0.1, decimals: 1,
    normalRangeText: '95–105 kPa', evaluate: v => band(v, [95, 105], [90, 110]),
  },
  {
    key: 'temperature', label: 'Cabin temperature', unit: '°C', min: 0, max: 45, step: 0.5, decimals: 1,
    normalRangeText: '18–27 °C', evaluate: v => band(v, [18, 27], [15, 32]),
  },
  {
    key: 'humidity', label: 'Humidity', unit: '%', min: 0, max: 100, step: 1, decimals: 0,
    normalRangeText: '30–60%', evaluate: v => band(v, [30, 60], [20, 75]),
  },
];

export function normalizeCabinReadings(raw: unknown): CabinReadings {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Cabin readings are unavailable.');
  const input = raw as Record<string, unknown>;
  const result = {} as CabinReadings;
  for (const spec of CABIN_SPECS) {
    const value = input[spec.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < spec.min || value > spec.max) {
      throw new Error('Cabin readings are unavailable. Reset the sample to continue.');
    }
    result[spec.key] = Number(value.toFixed(spec.decimals));
  }
  return result;
}

export function parseCabinReadings(raw: string | null): CabinReadings {
  if (raw === null) return { ...DEFAULT_CABIN_READINGS };
  try { return normalizeCabinReadings(JSON.parse(raw)); }
  catch { throw new Error('Saved cabin readings could not be read. Reset the sample to continue.'); }
}

export function evaluateCabin(readings: CabinReadings) {
  const checked = normalizeCabinReadings(readings);
  const items = CABIN_SPECS.map(spec => ({
    spec, value: checked[spec.key], formattedValue: checked[spec.key].toFixed(spec.decimals),
    severity: spec.evaluate(checked[spec.key]),
  }));
  const redItems = items.filter(item => item.severity === 'red');
  const yellowItems = items.filter(item => item.severity === 'yellow');
  const overall: VitalSeverity = redItems.length ? 'red' : yellowItems.length ? 'yellow' : 'normal';
  return { items, redItems, yellowItems, overall };
}
