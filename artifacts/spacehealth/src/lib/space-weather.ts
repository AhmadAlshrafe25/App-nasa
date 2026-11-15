export type SpaceWeatherObservation = {
  value: number;
  observedAt: string;
};

const timestamp = (raw: unknown, now: number): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const normalized = raw.endsWith('Z') ? raw : `${raw}Z`;
  const epoch = Date.parse(normalized);
  if (!Number.isFinite(epoch) || epoch > now + 5 * 60_000) return null;
  return new Date(epoch).toISOString();
};

const records = (raw: unknown): Record<string, unknown>[] =>
  Array.isArray(raw)
    ? raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    : [];

const latest = (items: SpaceWeatherObservation[]) =>
  items.sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt))[0] ?? null;

/** NOAA planetary K-index observations are reported in 3-hour intervals. */
export function parsePlanetaryKIndex(raw: unknown, now = Date.now()): SpaceWeatherObservation | null {
  const observations = records(raw).flatMap(record => {
    const observedAt = timestamp(record.time_tag, now);
    const value = Number(record.Kp);
    return observedAt && Number.isFinite(value) && value >= 0 && value <= 9
      ? [{ value, observedAt }]
      : [];
  });
  return latest(observations);
}

/** Latest GOES integral proton flux sample for particles at or above 10 MeV. */
export function parseGoESProtonFlux(raw: unknown, now = Date.now()): SpaceWeatherObservation | null {
  const observations = records(raw).flatMap(record => {
    const energy = typeof record.energy === 'string' ? record.energy.replace(/\s+/g, '').toLowerCase() : '';
    const observedAt = timestamp(record.time_tag, now);
    const value = Number(record.flux);
    return energy === '>=10mev' && observedAt && Number.isFinite(value) && value >= 0
      ? [{ value, observedAt }]
      : [];
  });
  return latest(observations);
}

export const SPACE_WEATHER_SOURCES = {
  kp: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json',
  protonFlux: 'https://services.swpc.noaa.gov/json/goes/primary/integral-protons-1-day.json',
} as const;
