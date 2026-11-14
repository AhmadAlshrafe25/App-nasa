import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, AlertTriangle, ArrowDownRight, Bell, Check, CheckCircle2, ClipboardList,
  Droplets, Flame, Gauge, HeartPulse, Moon, Orbit, Radiation as RadiationIcon,
  ShieldAlert, Siren, Thermometer, Watch, Waves, Wind,
} from 'lucide-react';
import {
  analyzeRadiation, defaultRadiationDemo, getRadiationSamples,
  normalizeRadiationDemo, radiationStorageKey,
  type RadiationAnalysis, type RadiationDemo, type RadiationScenario,
} from '@/lib/radiation';
import { describeRadiation } from '@/lib/radiation-copy';
import { DailyLog } from '@/components/daily-log';
import { useDailyReminder } from '@/hooks/use-daily-reminder';
import {
  defaultBodyReadings, evaluateAllVitals, normalizeBodyReadings,
  readingsStorageKey, VITAL_SPECS,
  type BodyReadings, type EvaluatedVital, type VitalSeverity,
} from '@/lib/vitals';

const navItems = [
  { href: '/', label: 'Readings', icon: RadiationIcon },
  { href: '/signals', label: 'Trends', icon: Activity },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/log', label: 'Log', icon: ClipboardList },
];

const telemetry = {
  pulse: [61, 63, 62, 64, 60, 62, 65, 63, 64, 61, 63, 62, 66, 64],
  oxygen: [98, 97, 98, 98, 97, 98, 99, 98, 97, 98, 98, 97, 98, 98],
  sleep: [7.1, 6.8, 7.4, 6.9, 7.6, 7.2, 6.6, 7.8, 7.1, 7.4, 6.9, 7.7, 7.3, 7.4],
  stress: [26, 29, 27, 31, 34, 28, 26, 32, 35, 30, 27, 33, 31, 29],
};

const storageKeys = {
  reviewed: 'spacehealth-alert-reviewed-v1',
  readings: readingsStorageKey,
};

const readingsChangedEvent = 'spacehealth-readings-changed';

function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch { return fallback; }
}

function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial));
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      window.dispatchEvent(new CustomEvent(readingsChangedEvent, { detail: { key } }));
    } catch { /* local-only prototype */ }
  }, [key, value]);
  useEffect(() => {
    const onSync = () => setValue(readStored(key, initial));
    window.addEventListener('storage', onSync);
    window.addEventListener(readingsChangedEvent, onSync);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener(readingsChangedEvent, onSync);
    };
  }, [key, initial]);
  return [value, setValue] as const;
}

const VITAL_ICONS: Record<keyof BodyReadings, typeof HeartPulse> = {
  heartRate: HeartPulse,
  oxygen: Waves,
  respiration: Wind,
  temperature: Thermometer,
  systolicBP: Gauge,
  hrv: Flame,
  sleep: Moon,
  activity: Activity,
  water: Droplets,
};

// Synthesize an unmistakable spacecraft emergency klaxon using Web Audio API
function playEmergencyKlaxonBurst() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [0, 0.28, 0.56].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(idx % 2 === 0 ? 880 : 660, now + offset);
      osc.frequency.linearRampToValueAtTime(idx % 2 === 0 ? 980 : 520, now + offset + 0.22);
      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.24);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + offset);
      osc.stop(now + offset + 0.25);
    });
    window.setTimeout(() => { void ctx.close().catch(() => {}); }, 1000);
  } catch {
    // Ignore if audio context is blocked before user gesture
  }
}

function playYellowCautionChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
    window.setTimeout(() => { void ctx.close().catch(() => {}); }, 500);
  } catch {
    // Ignore
  }
}

function EmergencyMonitor({
  readings,
  onChangeReadings,
}: {
  readings: BodyReadings;
  onChangeReadings: (next: BodyReadings) => void;
}) {
  const { overall, yellowItems, redItems } = evaluateAllVitals(readings);
  const prevSeverityRef = useRef<VitalSeverity>('normal');

  // Continuous non-stop alarm loop while in RED state
  useEffect(() => {
    if (overall === 'yellow' && prevSeverityRef.current !== 'yellow') {
      playYellowCautionChime();
    }
    prevSeverityRef.current = overall;

    if (overall !== 'red') {
      window.speechSynthesis?.cancel();
      return;
    }

    const triggerAlarmCycle = () => {
      playEmergencyKlaxonBurst();
      if ('speechSynthesis' in window && !window.speechSynthesis.speaking) {
        try {
          const names = redItems.map(r => `${r.spec.label} ${r.formattedValue} ${r.spec.unit}`).join(', ');
          const msg = new SpeechSynthesisUtterance(
            `Red Alert! Critical wrist and body sensor emergency: ${names}. Stabilize astronaut readings immediately.`,
          );
          msg.rate = 1.05;
          msg.pitch = 1.1;
          window.speechSynthesis.speak(msg);
        } catch {
          // Ignore speech error
        }
      }
    };

    triggerAlarmCycle();
    const interval = window.setInterval(triggerAlarmCycle, 2600);
    return () => {
      clearInterval(interval);
    };
  }, [overall, redItems]);

  const bringRedToYellow = () => {
    const next = { ...readings };
    for (const item of redItems) {
      switch (item.spec.key) {
        case 'heartRate': next.heartRate = item.value < 45 ? 48 : 112; break;
        case 'oxygen': next.oxygen = 93; break;
        case 'respiration': next.respiration = item.value < 8 ? 9 : 23; break;
        case 'temperature': next.temperature = item.value < 35.5 ? 35.8 : 37.9; break;
        case 'systolicBP': next.systolicBP = item.value < 88 ? 91 : 140; break;
        case 'hrv': next.hrv = 32; break;
        case 'sleep': next.sleep = 5.0; break;
        case 'activity': next.activity = item.value < 10 ? 20 : 195; break;
        case 'water': next.water = 1.2; break;
      }
    }
    onChangeReadings(next);
  };

  const stabilizeAllToNormal = () => {
    onChangeReadings({ ...defaultBodyReadings });
  };

  if (overall === 'normal') return null;

  if (overall === 'yellow') {
    return (
      <section
        className="yellow-emergency-toast"
        role="status"
        aria-live="polite"
        data-testid="banner-yellow-emergency"
      >
        <div className="yellow-toast-head">
          <span className="yellow-toast-badge"><AlertTriangle size={16} /> YELLOW CAUTION · SMALL EMERGENCY NOTIFICATION</span>
          <span className="yellow-toast-source"><Watch size={13} /> Wrist &amp; Body Sensors</span>
        </div>
        <p className="yellow-toast-body">
          {yellowItems.map(item => (
            <span key={item.spec.key} className="yellow-vital-chip" data-testid={`yellow-chip-${item.spec.key}`}>
              <strong>{item.spec.label}: {item.formattedValue} {item.spec.unit}</strong> ({item.reason})
            </span>
          ))}
        </p>
        <div className="yellow-toast-actions">
          <Link href="/" className="btn small outline" data-testid="link-yellow-inspect">Inspect Readings</Link>
          <button type="button" className="btn small" onClick={stabilizeAllToNormal} data-testid="button-yellow-stabilize">
            Normalize Sensors
          </button>
        </div>
      </section>
    );
  }

  // RED CRITICAL EMERGENCY — NON-STOP ALARM UNTIL RESOLVED TO YELLOW OR NORMAL
  return (
    <section
      className="red-emergency-takeover"
      role="alert"
      aria-live="assertive"
      data-testid="banner-red-emergency"
    >
      <div className="red-emergency-stripes" />
      <div className="red-emergency-inner">
        <div className="red-emergency-header">
          <span className="red-siren-icon"><Siren size={26} /></span>
          <div>
            <div className="red-emergency-kicker">UNSTOPPABLE LEVEL-3 CRITICAL BIOMETRIC ALARM · WRIST &amp; BODY SENSORS</div>
            <h2>RED EMERGENCY — ASTRONAUT VITAL THRESHOLD BREACHED</h2>
            <p>This emergency alarm <strong>cannot be dismissed</strong> and will continue sounding until all Red readings return to the <strong>Yellow</strong> or <strong>Normal</strong> range.</p>
          </div>
        </div>

        <div className="red-breach-list">
          {redItems.map(item => (
            <div className="red-breach-card" key={item.spec.key} data-testid={`red-breach-${item.spec.key}`}>
              <div className="red-breach-top">
                <strong>{item.spec.label}: {item.formattedValue} {item.spec.unit}</strong>
                <span className="red-sensor-tag">{item.spec.sensorLocation} · {item.spec.sensorDetail}</span>
              </div>
              <div className="red-breach-reason">{item.reason} · Red zone: {item.spec.redRangeText}</div>
              <div className="red-inline-control">
                <span>Adjust {item.spec.label} now:</span>
                <input
                  type="range"
                  min={item.spec.min}
                  max={item.spec.max}
                  step={item.spec.step}
                  value={item.value}
                  onChange={e => onChangeReadings({ ...readings, [item.spec.key]: Number(e.target.value) })}
                  aria-label={`Emergency adjust ${item.spec.label}`}
                  data-testid={`input-emergency-${item.spec.key}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="red-emergency-actions">
          <button
            type="button"
            className="btn red-to-yellow-btn"
            onClick={bringRedToYellow}
            data-testid="button-emergency-to-yellow"
          >
            Step Down to Yellow Caution
          </button>
          <button
            type="button"
            className="btn red-to-normal-btn"
            onClick={stabilizeAllToNormal}
            data-testid="button-emergency-to-normal"
          >
            Stabilize All to Normal
          </button>
        </div>
      </div>
    </section>
  );
}

function Sparkline({ values, color = 'var(--signal-color)', alert = false }: { values: number[]; color?: string; alert?: boolean }) {
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 300},${65 - ((v - min) / (max - min || 1)) * 48}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 300 74" role="img" aria-label="Sample trend">
    <path d="M0 68H300" stroke="#d4e0f2" strokeWidth="1" />
    <polyline points={points} fill="none" stroke={alert ? '#c1854f' : color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="300" cy={65 - ((values.at(-1)! - min) / (max - min || 1)) * 48} r="3.5" fill={alert ? '#c1854f' : color} />
  </svg>;
}

function Layout({
  children,
  readings,
  onChangeReadings,
}: {
  children: ReactNode;
  readings: BodyReadings;
  onChangeReadings: (next: BodyReadings) => void;
}) {
  const [location] = useLocation();
  const evaluated = evaluateAllVitals(readings);
  return <div className={`app-shell ${evaluated.overall === 'red' ? 'shell-red-alert' : evaluated.overall === 'yellow' ? 'shell-yellow-caution' : ''}`}>
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark"><Orbit size={19} /></span>
        <span className="brand-name">SpaceHealth</span>
      </Link>
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
          <Icon aria-hidden="true" /><span>{label}</span>
        </Link>)}
      </nav>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <strong className="crew-name" data-testid="text-crew-name">Mara Velez</strong>
        <span className="sensor-live-pill" data-testid="badge-sensor-origin">
          <Watch size={13} /> Wrist &amp; Body Sensors Active
        </span>
        <span className="wrist-day">Day 142</span>
        <details className="demo-disclosure">
          <summary data-testid="button-demo-info">Demo</summary>
          <div className="demo-info" role="note">Sample data from simulated wrist &amp; body biometric sensors and dosimeter. Radiation flags show statistical changes, not exposure limits. Not medical advice. For urgent symptoms, contact mission medical staff.</div>
        </details>
      </header>
      <main className="main-content">
        <EmergencyMonitor readings={readings} onChangeReadings={onChangeReadings} />
        {children}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} aria-label={label} aria-current={location === href ? 'page' : undefined} data-testid={`mobile-link-${href.slice(1) || 'overview'}`}><Icon /><span>{label}</span></Link>)}
    </nav>
  </div>;
}

function Heading({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="page-heading fade-in"><h1>{title}</h1>{right}</div>;
}

function VitalSensorCard({
  item,
  onChange,
}: {
  item: EvaluatedVital;
  onChange: (nextValue: number) => void;
}) {
  const { spec, value, formattedValue, severity, reason } = item;
  const Icon = VITAL_ICONS[spec.key];
  const slug = spec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <article
      className={`panel metric-card vital-card-${severity}`}
      data-testid={`metric-${slug}`}
    >
      <div className="metric-top">
        <div>
          <span>{spec.label}</span>
          <small className="sensor-origin-line">{spec.sensorLocation} · {spec.sensorDetail}</small>
        </div>
        <span className="metric-icon"><Icon /></span>
      </div>
      <div className="vital-status-row">
        <div className="metric-value">
          {formattedValue} <span className="metric-unit">{spec.unit}</span>
        </div>
        <span className={`vital-zone-pill zone-${severity}`} data-testid={`status-zone-${spec.key}`}>
          {severity === 'red' ? 'RED · CRITICAL' : severity === 'yellow' ? 'YELLOW · CAUTION' : 'NORMAL'}
        </span>
      </div>
      <div className="vital-reason-line">{reason}</div>
      <div className="vital-thresholds-guide">
        <span className="th-normal">Normal: {spec.normalRangeText}</span>
        <span className="th-yellow">Yellow: {spec.yellowRangeText}</span>
        <span className="th-red">Red: {spec.redRangeText}</span>
      </div>
      <div className="metric-adjust" aria-label={`Adjust ${spec.label}`}>
        <input
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={`${spec.label} reading`}
          data-testid={`input-reading-${spec.key}`}
        />
        <div className="metric-step-row">
          <button
            type="button"
            className="choice metric-step-btn"
            onClick={() => onChange(Math.max(spec.min, Number((value - spec.step).toFixed(1))))}
            aria-label={`Decrease ${spec.label}`}
            data-testid={`button-decrease-${spec.key}`}
          >−</button>
          <button
            type="button"
            className="choice metric-step-btn"
            onClick={() => onChange(Math.min(spec.max, Number((value + spec.step).toFixed(1))))}
            aria-label={`Increase ${spec.label}`}
            data-testid={`button-increase-${spec.key}`}
          >+</button>
        </div>
      </div>
    </article>
  );
}

function RadiationSummary({ analysis, acknowledged }: { analysis: RadiationAnalysis; acknowledged: boolean }) {
  const flagged = analysis.status !== 'baseline';
  const description = describeRadiation(analysis);
  return <section className={`panel radiation-panel ${flagged ? 'radiation-flagged' : ''}`} aria-label="Sample dosimeter" data-testid="card-radiation">
    <div className="radiation-caption"><RadiationIcon size={18} /><strong>Radiation now · Wrist Dosimeter</strong><span>Sample</span></div>
    <div className={`radiation-value ${description.unknown ? 'reading-unknown' : ''}`} data-testid="value-radiation-rate">{description.value}<span>{description.unit}</span></div>
    <div className="radiation-comparison" data-testid="text-radiation-comparison">{description.comparison}</div>
    <div className="radiation-state" data-testid="status-radiation">{flagged && <ShieldAlert size={16} />}<strong>{description.status}</strong>{flagged && acknowledged && <span className="radiation-seen">Seen</span>}</div>
  </section>;
}

function ReadingsExplained({ analysis }: { analysis: RadiationAnalysis }) {
  const rate = (value: number | null) => value === null ? 'Unavailable' : `${value.toFixed(1)} microsieverts per hour`;
  return <details className="rule-box radiation-explained">
    <summary data-testid="button-readings-explained">Readings explained</summary>
    <dl className="reading-definitions">
      <dt>Right now</dt><dd data-testid="value-technical-rate">{rate(analysis.doseRate)}</dd>
      <dt>Usual sample level</dt><dd>{rate(analysis.baseline)}</dd>
      <dt>Total over this sample hour</dt><dd>{analysis.sampleDose === null ? 'Unavailable — missing readings' : `${analysis.sampleDose.toFixed(1)} microsieverts`}</dd>
    </dl>
    <p>A <strong>microsievert</strong> is a unit of radiation dose. <strong>Per hour</strong> means how quickly that dose adds up.</p>
    <p>The large number compares now with earlier samples. For example, <strong>2.5×</strong> means two and a half times the earlier average.</p>
    <p>Higher does not by itself mean unsafe. These sample readings are not a safety assessment.</p>
  </details>;
}

function Overview({
  readings,
  onChangeReadings,
}: {
  readings: BodyReadings;
  onChangeReadings: (next: BodyReadings) => void;
}) {
  const [reviewed] = usePersistentState(storageKeys.reviewed, false);
  const [savedDemo] = usePersistentState<RadiationDemo>(radiationStorageKey, defaultRadiationDemo);
  const demo = normalizeRadiationDemo(savedDemo);
  const analysis = analyzeRadiation(getRadiationSamples(demo.scenario));
  const evaluated = evaluateAllVitals(readings);
  const pendingCount = Number(!reviewed)
    + Number(analysis.status !== 'baseline' && !demo.acknowledged)
    + evaluated.yellowItems.length
    + evaluated.redItems.length;

  const triggerYellowPreset = () => {
    onChangeReadings({
      ...defaultBodyReadings,
      heartRate: 112,
      oxygen: 93,
      sleep: 5.2,
    });
  };

  const triggerRedPreset = () => {
    onChangeReadings({
      ...defaultBodyReadings,
      heartRate: 148,
      oxygen: 88,
      temperature: 38.9,
    });
  };

  return <div className="fade-in">
    <Heading title="Readings" right={<Link href="/alerts" className={`wrist-alert ${pendingCount === 0 ? 'is-reviewed' : ''}`} data-testid="link-alert-status"><Bell size={15} />{pendingCount ? `${pendingCount} active` : 'All nominal'}</Link>} />

    <section className="panel sensor-architecture-banner" data-testid="banner-sensor-architecture">
      <div className="sensor-arch-head">
        <span className="sensor-arch-icon"><Watch size={20} /></span>
        <div>
          <strong>On-Astronaut Biometric Telemetry · Wrist Band &amp; Body Vest Sensors</strong>
          <p>All physiological readings below come directly from sensors worn on <strong>Mara Velez’s wrist</strong> (PPG heart rate, optical SpO₂, pulse-transit BP, actigraphy) and <strong>smart-textile body vest</strong> (thoracic ECG, respiration band, torso temperature, 3-axis movement). These readings automatically sync into your <strong>Astronaut’s Log</strong>.</p>
        </div>
      </div>
      <div className="sensor-preset-bar" role="group" aria-label="Test sensor alert thresholds">
        <span className="short-hint">Simulate sensor state:</span>
        <button type="button" className="choice" onClick={() => onChangeReadings({ ...defaultBodyReadings })} data-testid="button-preset-normal">
          All Normal (Green)
        </button>
        <button type="button" className="choice preset-yellow-btn" onClick={triggerYellowPreset} data-testid="button-preset-yellow">
          Test Yellow Point (Small Alert)
        </button>
        <button type="button" className="choice preset-red-btn" onClick={triggerRedPreset} data-testid="button-preset-red">
          Test Red Point (Big Non-Stop Emergency)
        </button>
      </div>
    </section>

    <Link href="/alerts" className="radiation-open" aria-label="View radiation anomaly details" data-testid="link-radiation-details"><RadiationSummary analysis={analysis} acknowledged={demo.acknowledged} /></Link>
    <ReadingsExplained analysis={analysis} />

    <details className="secondary-vitals" open>
      <summary data-testid="button-body-vitals">Wrist &amp; Body Sensor Readings ({ VITAL_SPECS.length } live channels)</summary>
      <div className="grid metrics-grid">
        {evaluated.items.map(item => (
          <VitalSensorCard
            key={item.spec.key}
            item={item}
            onChange={nextVal => onChangeReadings({ ...readings, [item.spec.key]: nextVal })}
          />
        ))}
      </div>
    </details>
  </div>;
}

function Signals({ readings }: { readings: BodyReadings }) {
  const [period, setPeriod] = useState('14 days');
  const cards = [
    { title: 'Pulse (Wrist PPG)', value: String(readings.heartRate), unit: 'beats/min', data: [...telemetry.pulse.slice(0, -1), readings.heartRate], icon: HeartPulse },
    { title: 'Blood Oxygen (Wrist)', value: String(readings.oxygen), unit: '%', data: [...telemetry.oxygen.slice(0, -1), readings.oxygen], icon: Waves },
    { title: 'Sleep (Wrist Actigraphy)', value: readings.sleep.toFixed(1), unit: 'hours', data: [...telemetry.sleep.slice(0, -1), readings.sleep], icon: Moon },
    { title: 'HRV / Autonomic (Body)', value: String(readings.hrv), unit: 'ms', data: [...telemetry.stress.slice(0, -1), readings.hrv], icon: Wind },
  ];
  return <div className="fade-in">
    <Heading title="Trends" right={<div className="period-tabs" aria-label="Trend period">{['7 days', '14 days'].map(x => <button key={x} className={period === x ? 'selected' : ''} onClick={() => setPeriod(x)} data-testid={`button-period-${x.split(' ')[0]}`}>{x.split(' ')[0]}d</button>)}</div>} />
    <div className="grid signal-grid">
      {cards.map(({ title, value, unit, data, icon: Icon }) => <article className="panel signal-card" key={title} data-testid={`signal-card-${title.toLowerCase().replaceAll(' ', '-')}`}>
        <div className="signal-head"><div><div className="signal-name">{title}</div><div className="signal-large">{value} <span>{unit}</span></div></div><span className="metric-icon"><Icon /></span></div>
        <Sparkline values={data.slice(-parseInt(period))} />
        <div className="chart-labels"><span>{period}</span><span>Now</span></div>
      </article>)}
    </div>
  </div>;
}

function Alerts({ readings }: { readings: BodyReadings }) {
  const [reviewed, setReviewed] = usePersistentState(storageKeys.reviewed, false);
  const [savedDemo, setDemo] = usePersistentState<RadiationDemo>(radiationStorageKey, defaultRadiationDemo);
  const demo = normalizeRadiationDemo(savedDemo);
  const samples = getRadiationSamples(demo.scenario);
  const analysis = analyzeRadiation(samples);
  const flagged = analysis.status !== 'baseline';
  const evaluated = evaluateAllVitals(readings);
  const scenarios: { value: RadiationScenario; label: string }[] = [
    { value: 'baseline', label: 'Usual' },
    { value: 'spike', label: 'Sudden rise' },
    { value: 'signal-loss', label: 'Lost signal' },
  ];
  return <div className="fade-in">
    <Heading title="Alerts" />
    <RadiationSummary analysis={analysis} acknowledged={demo.acknowledged} />
    {flagged && <div className="radiation-review">
      <button className={`btn ${demo.acknowledged ? 'outline' : ''}`} onClick={() => setDemo({ ...demo, acknowledged: !demo.acknowledged })} data-testid="button-review-radiation">{demo.acknowledged ? <ArrowDownRight size={16} /> : <Check size={16} />}{demo.acknowledged ? 'Mark as not seen' : 'I’ve seen this'}</button>
      {demo.acknowledged && <span className="short-hint" role="status">Marked seen. The reading has not changed.</span>}
    </div>}
    <details className="rule-box radiation-rule">
      <summary data-testid="button-radiation-details">{flagged ? 'Why this alert?' : 'What this means'}</summary>
      {analysis.status === 'spike' ? <p>The reading rose above its earlier pattern. This flags a change, not a confirmed unsafe exposure.</p> : analysis.status === 'baseline' ? <p>The reading is close to its earlier pattern. This does not confirm it is safe.</p> : <p>Readings are missing or incomplete. Unknown does not mean zero radiation.</p>}
      <p>Marking an alert seen does not clear the condition.</p>
      <details className="technical-rule"><summary data-testid="button-technical-rule">Technical rule</summary>
      {analysis.trigger !== null && <p>Baseline {analysis.baseline!.toFixed(1)} µSv/h. Flag above {analysis.trigger.toFixed(1)} µSv/h. Not an exposure limit.</p>}
      <p>Prior mean + the greater of 3 standard deviations, 25% of baseline, or 0.1 µSv/h. Dose uses trapezoidal integration over the sample hour.</p>
      <table className="readings-table"><thead><tr><th>Minute</th><th>µSv/h</th></tr></thead><tbody>
        {samples.slice(-3).map((sample) => <tr key={sample.minute}><td>{sample.minute}</td><td>{sample.doseRate === null ? 'No signal' : sample.doseRate.toFixed(1)}</td></tr>)}
      </tbody></table>
      </details>
    </details>
    <ReadingsExplained analysis={analysis} />
    <details className="rule-box radiation-demo">
      <summary data-testid="button-demo-scenarios">Try sample readings</summary>
      <div className="radiation-scenarios" role="group" aria-label="Sample dosimeter scenarios">
        {scenarios.map(({ value, label }) => <button key={value} className={`choice ${demo.scenario === value ? 'active' : ''}`} aria-pressed={demo.scenario === value} onClick={() => setDemo({ scenario: value, acknowledged: false })} data-testid={`button-radiation-${value}`}>{label}</button>)}
      </div>
    </details>
    <details className="secondary-vitals body-alerts" open>
      <summary data-testid="button-pulse-alert">
        Wrist &amp; Body Sensor Status · {evaluated.overall === 'red' ? `${evaluated.redItems.length} RED EMERGENCY` : evaluated.overall === 'yellow' ? `${evaluated.yellowItems.length} YELLOW CAUTION` : reviewed ? 'seen' : '1 new'}
      </summary>
      <div className="panel alert-panel" data-testid="alert-anomaly">
        {reviewed ? <div className="reviewed-box" data-testid="status-alert-reviewed"><CheckCircle2 size={22} /><strong>Reviewed</strong></div> : <div className="alert-callout"><span className="alert-symbol"><ShieldAlert size={18} /></span><div><h3>Heartbeat above usual</h3><p><strong>81 beats/min</strong> · 9 above usual range</p></div></div>}
        <div className="alert-actions">
          {reviewed ? <button className="btn outline" onClick={() => setReviewed(false)} data-testid="button-unreview-alert"><ArrowDownRight size={16} /> Reopen</button> : <button className="btn" onClick={() => setReviewed(true)} data-testid="button-review-alert"><Check size={16} /> Mark reviewed</button>}
        </div>
        <details className="rule-box">
          <summary data-testid="button-alert-details">Details</summary>
          <p>Usual sample range: <strong>58–72 beats per minute</strong> over 14 days. This is a comparison, not a safety limit.</p>
          <table className="readings-table"><thead><tr><th>Sample</th><th>Pulse</th><th>Status</th></tr></thead><tbody>
            <tr><td>Prior</td><td>64 bpm</td><td>In band</td></tr>
            <tr><td>Flagged</td><td className="reading-outlier">81 bpm</td><td className="reading-outlier">Review</td></tr>
            <tr><td>Latest</td><td>{readings.heartRate} bpm</td><td>{evaluated.items[0].severity.toUpperCase()}</td></tr>
          </tbody></table>
        </details>
      </div>
    </details>
  </div>;
}

function NotFound() {
  return <div className="empty-state"><strong>Page not found</strong><Link href="/" className="btn" style={{ marginTop: 14 }} data-testid="link-back-vitals">Back to readings</Link></div>;
}

function RoutedApp() {
  const reminder = useDailyReminder();
  const [savedReadings, setReadings] = usePersistentState<BodyReadings>(storageKeys.readings, defaultBodyReadings);
  const readings = normalizeBodyReadings(savedReadings);

  return <Layout readings={readings} onChangeReadings={setReadings}>
    {reminder.notice && <section className="daily-reminder-notice" role="alert" aria-label="Daily log reminder" data-testid="notice-daily-reminder"><Bell size={19} /><div><strong>Time for your Astronaut’s Log</strong>{reminder.settings.voiceEnabled && reminder.voiceStatus && <p className="short-hint">{reminder.voiceStatus}</p>}<div className="reminder-notice-actions"><Link href="/log" className="btn small" data-testid="link-reminder-log">Open Astronaut’s Log</Link><button className="btn outline small" onClick={reminder.dismiss} data-testid="button-dismiss-reminder">Dismiss</button></div></div></section>}
    <Switch>
      <Route path="/"><Overview readings={readings} onChangeReadings={setReadings} /></Route>
      <Route path="/signals"><Signals readings={readings} /></Route>
      <Route path="/alerts"><Alerts readings={readings} /></Route>
      <Route path="/log"><DailyLog reminder={reminder} readings={readings} /></Route>
      <Route path="/wellbeing"><Redirect to="/log" replace /></Route>
      <Route path="/companion"><Redirect to="/log" replace /></Route>
      <Route component={NotFound} />
    </Switch>
  </Layout>;
}

function App() {
  return <WouterRouter><RoutedApp /></WouterRouter>;
}

export default App;
