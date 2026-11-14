export type VitalSeverity = 'normal' | 'yellow' | 'red';

export type BodyReadings = {
  heartRate: number;      // beats/min (Wrist PPG + Chest ECG)
  oxygen: number;         // % SpO2 (Wrist Optical Oximeter)
  respiration: number;    // breaths/min (Thoracic Body Vest)
  temperature: number;    // °C (Wrist & Torso Thermal Sensor)
  systolicBP: number;     // mmHg (Wrist Pulse-Transit Sensor)
  diastolicBP: number;    // mmHg, lower blood-pressure value (demo)
  stress: number;         // self-reported 0–10 score (demo)
  hrv: number;            // ms (Wrist/Chest Autonomic Sensor)
  sleep: number;          // hours (Wrist Actigraphy & Body Rest)
  activity: number;       // min (3-Axis Wrist & Body Accelerometer)
  water: number;          // litres (Bio-Impedance / Intake Sensor)
};

export const readingsStorageKey = 'spacehealth-readings-v1';

export const defaultBodyReadings: BodyReadings = {
  heartRate: 64,
  oxygen: 98,
  respiration: 14,
  temperature: 36.8,
  systolicBP: 118,
  diastolicBP: 76,
  stress: 3,
  hrv: 58,
  sleep: 7.4,
  activity: 90,
  water: 1.8,
};

export function normalizeBodyReadings(raw: unknown): BodyReadings {
  if (!raw || typeof raw !== 'object') return { ...defaultBodyReadings };
  const r = raw as Partial<BodyReadings>;
  const num = (val: unknown, fallback: number, min: number, max: number) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : fallback;
  return {
    heartRate: Math.round(num(r.heartRate, defaultBodyReadings.heartRate, 30, 220)),
    oxygen: Math.round(num(r.oxygen, defaultBodyReadings.oxygen, 70, 100)),
    respiration: Math.round(num(r.respiration, defaultBodyReadings.respiration, 4, 45)),
    temperature: Math.round(num(r.temperature, defaultBodyReadings.temperature, 34, 41) * 10) / 10,
    systolicBP: Math.round(num(r.systolicBP, defaultBodyReadings.systolicBP, 70, 200)),
    diastolicBP: Math.round(num(r.diastolicBP, defaultBodyReadings.diastolicBP, 40, 140)),
    stress: Math.round(num(r.stress, defaultBodyReadings.stress, 0, 10)),
    hrv: Math.round(num(r.hrv, defaultBodyReadings.hrv, 10, 140)),
    sleep: Math.round(num(r.sleep, defaultBodyReadings.sleep, 0, 24) * 10) / 10,
    activity: Math.round(num(r.activity, defaultBodyReadings.activity, 0, 600)),
    water: Math.round(num(r.water, defaultBodyReadings.water, 0, 10) * 10) / 10,
  };
}

export type VitalSpec = {
  key: keyof BodyReadings;
  label: string;
  unit: string;
  sensorLocation: 'Wrist Sensor' | 'Body Vest Sensor' | 'Wrist + Body Sensors' | 'Self-report';
  sensorDetail: string;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  normalRangeText: string;
  yellowRangeText: string;
  redRangeText: string;
  evaluate: (value: number) => { severity: VitalSeverity; reason: string };
};

export const VITAL_SPECS: VitalSpec[] = [
  {
    key: 'heartRate',
    label: 'Heart rate',
    unit: 'beats/min',
    sensorLocation: 'Wrist + Body Sensors',
    sensorDetail: 'Wrist PPG + Thoracic ECG strap',
    min: 35,
    max: 190,
    step: 1,
    normalRangeText: '52–100 bpm',
    yellowRangeText: '45–51 or 101–130 bpm',
    redRangeText: '<45 or >130 bpm',
    evaluate: (v) => {
      if (v < 45) return { severity: 'red', reason: `Critical bradycardia (${v} bpm < 45 bpm)` };
      if (v > 130) return { severity: 'red', reason: `Critical tachycardia (${v} bpm > 130 bpm)` };
      if (v < 52) return { severity: 'yellow', reason: `Below nominal resting band (${v} bpm)` };
      if (v > 100) return { severity: 'yellow', reason: `Elevated heart rate (${v} bpm > 100 bpm)` };
      return { severity: 'normal', reason: 'Nominal sinus rhythm' };
    },
  },
  {
    key: 'oxygen',
    label: 'Blood oxygen (SpO₂)',
    unit: '%',
    sensorLocation: 'Wrist Sensor',
    sensorDetail: 'Wrist optical pulse oximeter',
    min: 80,
    max: 100,
    step: 1,
    normalRangeText: '95–100%',
    yellowRangeText: '91–94%',
    redRangeText: '≤90%',
    evaluate: (v) => {
      if (v <= 90) return { severity: 'red', reason: `Severe hypoxia risk (SpO₂ ${v}% ≤ 90%)` };
      if (v <= 94) return { severity: 'yellow', reason: `Mild desaturation (SpO₂ ${v}%)` };
      return { severity: 'normal', reason: 'Optimal arterial oxygenation' };
    },
  },
  {
    key: 'respiration',
    label: 'Respiration',
    unit: 'breaths/min',
    sensorLocation: 'Body Vest Sensor',
    sensorDetail: 'Thoracic inductance chest band',
    min: 5,
    max: 36,
    step: 1,
    normalRangeText: '10–20 br/min',
    yellowRangeText: '8–9 or 21–26 br/min',
    redRangeText: '<8 or >26 br/min',
    evaluate: (v) => {
      if (v < 8) return { severity: 'red', reason: `Critical Bradypnea (${v} breaths/min)` };
      if (v > 26) return { severity: 'red', reason: `Critical Tachypnea (${v} breaths/min)` };
      if (v < 10 || v > 20) return { severity: 'yellow', reason: `Off-nominal breathing rate (${v} breaths/min)` };
      return { severity: 'normal', reason: 'Steady respiratory cycle' };
    },
  },
  {
    key: 'temperature',
    label: 'Body temp',
    unit: '°C',
    sensorLocation: 'Wrist + Body Sensors',
    sensorDetail: 'Wrist skin & torso thermal patch',
    min: 34.5,
    max: 40.5,
    step: 0.1,
    decimals: 1,
    normalRangeText: '36.1–37.5 °C',
    yellowRangeText: '35.5–36.0 or 37.6–38.4 °C',
    redRangeText: '<35.5 or ≥38.5 °C',
    evaluate: (v) => {
      if (v < 35.5) return { severity: 'red', reason: `Hypothermic alert (${v.toFixed(1)} °C)` };
      if (v >= 38.5) return { severity: 'red', reason: `High fever / thermal strain (${v.toFixed(1)} °C)` };
      if (v < 36.1 || v > 37.5) return { severity: 'yellow', reason: `Temperature drift (${v.toFixed(1)} °C)` };
      return { severity: 'normal', reason: 'Nominal thermal balance' };
    },
  },
  {
    key: 'systolicBP',
    label: 'Blood pressure · upper',
    unit: 'mmHg',
    sensorLocation: 'Wrist Sensor',
    sensorDetail: 'Wrist pulse-transit cuffless sensor',
    min: 75,
    max: 185,
    step: 1,
    normalRangeText: '95–130 mmHg',
    yellowRangeText: '88–94 or 131–155 mmHg',
    redRangeText: '<88 or >155 mmHg',
    evaluate: (v) => {
      if (v < 88) return { severity: 'red', reason: `Critical hypotension (${v} mmHg)` };
      if (v > 155) return { severity: 'red', reason: `Critical hypertension (${v} mmHg)` };
      if (v < 95 || v > 130) return { severity: 'yellow', reason: `Blood pressure outside baseline (${v} mmHg)` };
      return { severity: 'normal', reason: 'Nominal vascular pressure' };
    },
  },
  {
    key: 'diastolicBP',
    label: 'Blood pressure · lower',
    unit: 'mmHg',
    sensorLocation: 'Wrist Sensor',
    sensorDetail: 'Simulated lower blood-pressure value, not a cuff measurement',
    min: 40, max: 140, step: 1,
    normalRangeText: '60–90 mmHg',
    yellowRangeText: '50–59 or 91–110 mmHg',
    redRangeText: '<50 or >110 mmHg',
    evaluate: v => v < 50 || v > 110
      ? { severity: 'red', reason: 'Outside the high-priority sample range' }
      : v < 60 || v > 90
        ? { severity: 'yellow', reason: 'Outside the usual sample range' }
        : { severity: 'normal', reason: 'Within the usual sample range' },
  },
  {
    key: 'stress',
    label: 'Stress',
    unit: '/10',
    sensorLocation: 'Self-report',
    sensorDetail: 'Self-reported sample score, not inferred from a sensor',
    min: 0, max: 10, step: 1,
    normalRangeText: '0–5',
    yellowRangeText: '6–7',
    redRangeText: '8–10',
    evaluate: v => v >= 8
      ? { severity: 'red', reason: 'High sample stress score' }
      : v >= 6
        ? { severity: 'yellow', reason: 'Raised sample stress score' }
        : { severity: 'normal', reason: 'Lower sample stress score' },
  },
  {
    key: 'hrv',
    label: 'Heart variability (HRV)',
    unit: 'ms',
    sensorLocation: 'Wrist + Body Sensors',
    sensorDetail: 'Autonomic R-R interval sensor',
    min: 12,
    max: 110,
    step: 1,
    normalRangeText: '40–110 ms',
    yellowRangeText: '25–39 ms',
    redRangeText: '<25 ms',
    evaluate: (v) => {
      if (v < 25) return { severity: 'red', reason: `Severe autonomic strain (HRV ${v} ms)` };
      if (v < 40) return { severity: 'yellow', reason: `Reduced recovery reserve (HRV ${v} ms)` };
      return { severity: 'normal', reason: 'Healthy autonomic recovery' };
    },
  },
  {
    key: 'sleep',
    label: 'Sleep',
    unit: 'hours',
    sensorLocation: 'Wrist + Body Sensors',
    sensorDetail: 'Wrist actigraphy & body rest tracker',
    min: 0,
    max: 14,
    step: 0.1,
    decimals: 1,
    normalRangeText: '6.0–10.0 hrs',
    yellowRangeText: '4.0–5.9 hrs',
    redRangeText: '<4.0 hrs',
    evaluate: (v) => {
      if (v < 4.0) return { severity: 'red', reason: `Critical sleep deprivation (${v.toFixed(1)} hrs)` };
      if (v < 6.0) return { severity: 'yellow', reason: `Short sleep window (${v.toFixed(1)} hrs)` };
      return { severity: 'normal', reason: 'Restorative sleep duration' };
    },
  },
  {
    key: 'activity',
    label: 'Activity',
    unit: 'min',
    sensorLocation: 'Wrist + Body Sensors',
    sensorDetail: '3-axis wrist & torso accelerometer',
    min: 0,
    max: 240,
    step: 5,
    normalRangeText: '30–180 min',
    yellowRangeText: '10–29 or 181–220 min',
    redRangeText: '<10 or >220 min',
    evaluate: (v) => {
      if (v < 10) return { severity: 'red', reason: `Critical inactivity / zero-G deconditioning (${v} min)` };
      if (v > 220) return { severity: 'red', reason: `Extreme overexertion (${v} min)` };
      if (v < 30 || v > 180) return { severity: 'yellow', reason: `Activity outside daily target (${v} min)` };
      return { severity: 'normal', reason: 'Countermeasure target met' };
    },
  },
  {
    key: 'water',
    label: 'Hydration',
    unit: 'litres',
    sensorLocation: 'Body Vest Sensor',
    sensorDetail: 'Bio-impedance & drink-bag telemetry',
    min: 0.2,
    max: 4.0,
    step: 0.1,
    decimals: 1,
    normalRangeText: '1.5–3.5 L',
    yellowRangeText: '1.0–1.4 L',
    redRangeText: '<1.0 L',
    evaluate: (v) => {
      if (v < 1.0) return { severity: 'red', reason: `Critical dehydration risk (${v.toFixed(1)} L)` };
      if (v < 1.5) return { severity: 'yellow', reason: `Low fluid intake (${v.toFixed(1)} L)` };
      return { severity: 'normal', reason: 'Hydration on target' };
    },
  },
];

export type EvaluatedVital = {
  spec: VitalSpec;
  value: number;
  formattedValue: string;
  severity: VitalSeverity;
  reason: string;
};

export function evaluateAllVitals(readings: BodyReadings): {
  overall: VitalSeverity;
  items: EvaluatedVital[];
  yellowItems: EvaluatedVital[];
  redItems: EvaluatedVital[];
} {
  const items: EvaluatedVital[] = VITAL_SPECS.map(spec => {
    const value = readings[spec.key];
    const formattedValue = spec.decimals ? value.toFixed(spec.decimals) : String(value);
    const { severity, reason } = spec.evaluate(value);
    return { spec, value, formattedValue, severity, reason };
  });
  const redItems = items.filter(i => i.severity === 'red');
  const yellowItems = items.filter(i => i.severity === 'yellow');
  const overall: VitalSeverity = redItems.length > 0 ? 'red' : yellowItems.length > 0 ? 'yellow' : 'normal';
  return { overall, items, yellowItems, redItems };
}
