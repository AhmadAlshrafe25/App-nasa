/** Demo-only dosimeter adapter. Never interpret its statistical band as an exposure limit. */
export type RadiationScenario = 'baseline' | 'spike' | 'signal-loss';
export type RadiationSample = { minute: number; doseRate: number | null };
export type RadiationDemo = { scenario: RadiationScenario; acknowledged: boolean };
export type RadiationAnalysis = {
  status: 'baseline' | 'spike' | 'unavailable' | 'insufficient';
  doseRate: number | null;
  baseline: number | null;
  trigger: number | null;
  deltaPercent: number | null;
  sampleDose: number | null;
  windowMinutes: number;
};

export const radiationStorageKey = 'spacehealth-radiation-demo-v1';
export const defaultRadiationDemo: RadiationDemo = { scenario: 'spike', acknowledged: false };

export function normalizeRadiationDemo(value: unknown): RadiationDemo {
  if (!value || typeof value !== 'object') return defaultRadiationDemo;
  const candidate = value as Partial<RadiationDemo>;
  if (!['baseline', 'spike', 'signal-loss'].includes(candidate.scenario ?? '')) return defaultRadiationDemo;
  return { scenario: candidate.scenario as RadiationScenario, acknowledged: candidate.acknowledged === true };
}

export function getRadiationSamples(scenario: RadiationScenario): RadiationSample[] {
  const background = [11.8, 12.1, 11.9, 12.2, 12, 11.7, 12.1, 12.3, 11.9, 12, 12.2, 11.8];
  return [
    ...background.map((doseRate, index) => ({ minute: index * 5, doseRate })),
    { minute: 60, doseRate: scenario === 'signal-loss' ? null : scenario === 'spike' ? 30 : 12.2 },
  ];
}

const validRate = (rate: number | null): rate is number =>
  rate !== null && Number.isFinite(rate) && rate >= 0;

/** Detect an upward deviation from prior samples, not a medical or mission safety limit. */
export function analyzeRadiation(samples: RadiationSample[]): RadiationAnalysis {
  const empty: RadiationAnalysis = {
    status: 'unavailable', doseRate: null, baseline: null, trigger: null,
    deltaPercent: null, sampleDose: null, windowMinutes: 0,
  };
  if (!samples.length) return empty;
  if (samples.some((sample, index) => !Number.isFinite(sample.minute) ||
    (index > 0 && sample.minute <= samples[index - 1]!.minute))) return empty;

  const latest = samples.at(-1)!;
  const windowMinutes = latest.minute - samples[0]!.minute;
  // Missing samples or gaps over the demo's five-minute sampling interval make
  // a full-window dose unavailable. Do not silently display a partial total.
  const complete = samples.length > 1 && samples.every((sample, index) =>
    validRate(sample.doseRate) &&
    (index === 0 || sample.minute - samples[index - 1]!.minute <= 5));
  const sampleDose = complete ? samples.slice(1).reduce((dose, sample, index) => {
    const previous = samples[index]!;
    return dose + ((previous.doseRate! + sample.doseRate!) / 2) *
      ((sample.minute - previous.minute) / 60);
  }, 0) : null;
  if (!validRate(latest.doseRate)) return { ...empty, windowMinutes };

  const previous = samples.slice(0, -1).slice(-12);
  if (previous.length < 6 || previous.some((sample) => !validRate(sample.doseRate)) ||
    samples.slice(1).some((sample, index) => sample.minute - samples[index]!.minute > 5)) {
    return { ...empty, status: 'insufficient', doseRate: latest.doseRate, sampleDose, windowMinutes };
  }
  const baseline = previous.reduce((total, sample) => total + sample.doseRate!, 0) / previous.length;
  const deviation = Math.sqrt(previous.reduce((total, sample) =>
    total + (sample.doseRate! - baseline) ** 2, 0) / previous.length);
  // A 25% minimum deviation avoids tiny noise flags in this synthetic example.
  const trigger = baseline + Math.max(3 * deviation, baseline * 0.25, 0.1);
  return {
    status: latest.doseRate > trigger ? 'spike' : 'baseline',
    doseRate: latest.doseRate, baseline, trigger, sampleDose, windowMinutes,
    deltaPercent: baseline > 0 ? ((latest.doseRate - baseline) / baseline) * 100 : null,
  };
}
