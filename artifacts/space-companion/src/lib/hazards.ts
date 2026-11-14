export const HAZARD_GUIDE_OFFLINE = true as const;

export const RESEARCH_SOURCES = {
  hrp: {
    label: 'NASA Human Research Program',
    title: 'NASA HRP',
    href: 'https://www.nasa.gov/hrp/',
  },
  risks: {
    label: 'NASA · Risks of Human Spaceflight',
    title: 'Risks of Human Spaceflight',
    href: 'https://www.nasa.gov/hrp/risks/',
  },
  research: {
    label: 'NASA · Ongoing HRP Research',
    title: 'Ongoing HRP Research in Space',
    href: 'https://www.nasa.gov/hrp/ongoing-hrp-research/',
  },
  radiation: {
    label: 'Canadian Space Agency · Radiation monitoring',
    title: 'Monitoring Radiation for Astronaut Health',
    href: 'https://www.asc-csa.gc.ca/eng/news/articles/2026/2026-02-26-monitoring-radiation-astronaut-health.asp',
  },
  science: {
    label: 'Canadian Space Agency · Space science',
    title: 'Why Do We Conduct Science Experiments in Space?',
    href: 'https://www.asc-csa.gc.ca/eng/iss/science/',
  },
} as const;

export type ResearchSourceId = keyof typeof RESEARCH_SOURCES;
export type HazardId = 'radiation' | 'isolation' | 'distance' | 'gravity' | 'environment';
export type SampleStatus = 'normal' | 'warning' | 'danger';

export interface HazardReference {
  id: HazardId;
  number: string;
  title: string;
  summary: string;
  indicators: string[];
  possibleEffects: string[];
  demoResponse: string;
  sourceIds: ResearchSourceId[];
}

export const HAZARDS: HazardReference[] = [
  {
    id: 'radiation',
    number: '01',
    title: 'Space Radiation',
    summary: 'Radiation cannot be felt directly. A real mission uses dosimeters and approved space-weather information to understand exposure.',
    indicators: ['Dose reading in mSv/day', 'Radiation source and timestamp', 'Solar activity, when available'],
    possibleEffects: ['Long-term tissue and cancer risks', 'Possible acute effects during major solar events'],
    demoResponse: 'Confirm the source, units, and timestamp, then follow the mission’s approved radiation procedures. This page has no live dosimeter feed.',
    sourceIds: ['hrp', 'risks', 'radiation'],
  },
  {
    id: 'isolation',
    number: '02',
    title: 'Isolation & Confinement',
    summary: 'Long stays in a small crew environment can disrupt sleep and routines and affect mood or team wellbeing.',
    indicators: ['Sleep duration and quality', 'Self-reported stress and mood', 'Isolation check-in, when provided'],
    possibleEffects: ['Sleep and circadian disruption', 'Changes in mood, focus, or team interaction'],
    demoResponse: 'Use the private on-device check-in or normal crew-support routines. The sample status is not a mental-health assessment.',
    sourceIds: ['hrp', 'risks', 'research'],
  },
  {
    id: 'distance',
    number: '03',
    title: 'Distance from Earth',
    summary: 'Deep-space communication can have a long delay, so crews and onboard tools need to work without an immediate reply from Earth.',
    indicators: ['Mission distance and simulated one-way delay', 'Whether local sample tools are available offline'],
    possibleEffects: ['Delayed outside support', 'Greater need for onboard planning and autonomy'],
    demoResponse: 'This example guide is bundled on the device and does not send a message or wait for a network response.',
    sourceIds: ['hrp', 'risks', 'research'],
  },
  {
    id: 'gravity',
    number: '04',
    title: 'Gravity Fields',
    summary: 'Moving between microgravity, a planetary surface, and Earth gravity can affect movement and cardiovascular conditioning.',
    indicators: ['Heart-rate trend against a personal baseline', 'Blood pressure, if recorded', 'Exercise routine, if recorded'],
    possibleEffects: ['Changes in cardiovascular conditioning', 'Balance, movement, or fluid-shift effects'],
    demoResponse: 'Compare available readings with the person’s own history and follow mission procedures. Missing blood pressure stays unknown.',
    sourceIds: ['hrp', 'risks', 'science'],
  },
  {
    id: 'environment',
    number: '05',
    title: 'Hostile / Closed Environments',
    summary: 'A spacecraft is a closed habitat. Air and other cabin conditions matter, but this demonstration has no live life-support sensors.',
    indicators: ['SpO₂ or cabin CO₂, only when a valid sample is supplied', 'Sensor source and timestamp'],
    possibleEffects: ['Cabin air or life-support concerns', 'Health or concentration effects that require mission procedures'],
    demoResponse: 'Check an approved cabin-system display for real conditions. The newest brief supplies no example trigger bands for SpO₂ or CO₂.',
    sourceIds: ['hrp', 'risks', 'research'],
  },
];

export const EXAMPLE_TRIGGERS = [
  { label: 'Heart rate', example: 'A persistent rise above 85 bpm; compare with the person’s own baseline.' },
  { label: 'Blood pressure', example: 'Above 132/84 mmHg when accompanied by strain.' },
  { label: 'Sleep', example: 'Below 5.5 hours on repeated readings.' },
  { label: 'Stress and isolation', example: 'Stress at 7/10 or above together with high isolation.' },
  { label: 'Radiation', example: 'A sample spike above 1.40 mSv/day; verify the real instrument and mission guidance.' },
] as const;

export const SAMPLE_REFERENCE_NOTE =
  'These are user-supplied example rules, not NASA-approved medical or radiation-safety limits. The newest reference does not provide trigger bands for SpO₂ or cabin CO₂.';

export interface DemoReadings {
  heartRateBpm: number;
  spo2Percent: number;
  sleepHours: number;
  stressScore: number;
  radiationMsvDay: number;
  radiationSource: string;
  cabinCo2Ppm: number;
  commDelayMinutes: number;
  bloodPressure: string | null;
  isolationLevel: number | null;
}

export interface DemoMissionDay {
  missionDay: number;
  status: SampleStatus;
  statusLabel: string;
  statusExplanation: string;
  primaryHazards: HazardId[];
  gravityPhase: string;
  readings: DemoReadings;
}

/** Fictional sample rows from the supplied research payload; statuses are source labels, not computed assessments. */
export const DEMO_MISSION_DAYS: DemoMissionDay[] = [
  {
    missionDay: 140,
    status: 'normal',
    statusLabel: 'Normal',
    statusExplanation: 'The supplied example labels this day Normal. Some fields, including blood pressure, were not included.',
    primaryHazards: [],
    gravityPhase: '0g transit to Mars',
    readings: {
      heartRateBpm: 68, spo2Percent: 98.5, sleepHours: 7.6, stressScore: 2,
      radiationMsvDay: 0.48, radiationSource: 'Baseline galactic cosmic radiation (GCR)',
      cabinCo2Ppm: 650, commDelayMinutes: 14, bloodPressure: null, isolationLevel: null,
    },
  },
  {
    missionDay: 141,
    status: 'warning',
    statusLabel: 'Warning',
    statusExplanation: 'The supplied example labels this day Warning as several sample readings shift from Day 140. This guide does not recalculate that source label.',
    primaryHazards: ['isolation', 'environment'],
    gravityPhase: '0g transit to Mars',
    readings: {
      heartRateBpm: 86, spo2Percent: 96.4, sleepHours: 5.5, stressScore: 6,
      radiationMsvDay: 0.85, radiationSource: 'Elevated solar proton activity',
      cabinCo2Ppm: 1250, commDelayMinutes: 15, bloodPressure: null, isolationLevel: null,
    },
  },
  {
    missionDay: 142,
    status: 'danger',
    statusLabel: 'Danger · sample only',
    statusExplanation: 'The supplied example labels this day Danger after several readings change together. This is fictional and is not a live alert.',
    primaryHazards: ['radiation', 'isolation', 'environment'],
    gravityPhase: '0g transit to Mars',
    readings: {
      heartRateBpm: 108, spo2Percent: 93.2, sleepHours: 4, stressScore: 9,
      radiationMsvDay: 1.75, radiationSource: 'Solar storm spike + GCR',
      cabinCo2Ppm: 2150, commDelayMinutes: 16, bloodPressure: null, isolationLevel: null,
    },
  },
];

export interface ChangedReading {
  label: string;
  before: string;
  after: string;
  change: string;
}

const COMPARISON_METRICS = [
  { key: 'heartRateBpm', label: 'Heart rate', unit: 'bpm', digits: 0 },
  { key: 'spo2Percent', label: 'SpO₂', unit: '%', digits: 1 },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', digits: 1 },
  { key: 'stressScore', label: 'Stress', unit: '/10', digits: 0 },
  { key: 'radiationMsvDay', label: 'Radiation', unit: 'mSv/day', digits: 2 },
  { key: 'cabinCo2Ppm', label: 'Cabin CO₂', unit: 'ppm', digits: 0 },
  { key: 'commDelayMinutes', label: 'One-way delay', unit: 'min', digits: 0 },
] as const;

function formatValue(value: number, digits: number) {
  return digits === 0 ? String(value) : value.toFixed(digits);
}

export function getChangedReadings(day: DemoMissionDay): ChangedReading[] {
  const currentIndex = DEMO_MISSION_DAYS.findIndex((item) => item.missionDay === day.missionDay);
  const previous = currentIndex > 0 ? DEMO_MISSION_DAYS[currentIndex - 1] : undefined;
  if (!previous) return [];

  return COMPARISON_METRICS.flatMap(({ key, label, unit, digits }) => {
    const before = previous.readings[key];
    const after = day.readings[key];
    if (typeof before !== 'number' || typeof after !== 'number' || before === after) return [];
    const difference = after - before;
    const sign = difference > 0 ? '+' : '−';
    const amount = formatValue(Math.abs(difference), digits);
    return [{
      label,
      before: `${formatValue(before, digits)} ${unit}`,
      after: `${formatValue(after, digits)} ${unit}`,
      change: `${sign}${amount} ${unit}`,
    }];
  });
}

export function getHazard(id: HazardId) {
  return HAZARDS.find((hazard) => hazard.id === id);
}
