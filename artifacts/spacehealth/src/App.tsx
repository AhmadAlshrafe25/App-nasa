import { type ReactNode, useEffect, useState } from 'react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, Bell, Check, CheckCircle2, ClipboardList,
  Droplets, HeartPulse, Moon, Orbit, Radiation as RadiationIcon, ShieldAlert,
  Waves, Wind,
} from 'lucide-react';
import {
  analyzeRadiation, defaultRadiationDemo, getRadiationSamples,
  normalizeRadiationDemo, radiationStorageKey,
  type RadiationAnalysis, type RadiationDemo, type RadiationScenario,
} from '@/lib/radiation';
import { describeRadiation } from '@/lib/radiation-copy';
import { DailyLog } from '@/components/daily-log';
import { useDailyReminder } from '@/hooks/use-daily-reminder';

type BodyReadings = {
  heartRate: number;
  activity: number;
  sleep: number;
  oxygen: number;
  water: number;
};

const navItems = [
  { href: '/', label: 'Readings', icon: RadiationIcon },
  { href: '/signals', label: 'Trends', icon: Activity },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/log', label: 'Log', icon: ClipboardList },
];
const defaultBodyReadings: BodyReadings = {
  heartRate: 64,
  activity: 90,
  sleep: 7.4,
  oxygen: 98,
  water: 1.6,
};
function normalizeBodyReadings(raw: unknown): BodyReadings {
  if (!raw || typeof raw !== 'object') return defaultBodyReadings;
  const r = raw as Partial<BodyReadings>;
  const num = (val: unknown, fallback: number, min: number, max: number) =>
    typeof val === 'number' && Number.isFinite(val) ? Math.min(max, Math.max(min, val)) : fallback;
  return {
    heartRate: Math.round(num(r.heartRate, defaultBodyReadings.heartRate, 30, 220)),
    activity: Math.round(num(r.activity, defaultBodyReadings.activity, 0, 600)),
    sleep: Math.round(num(r.sleep, defaultBodyReadings.sleep, 0, 24) * 10) / 10,
    oxygen: Math.round(num(r.oxygen, defaultBodyReadings.oxygen, 70, 100)),
    water: Math.round(num(r.water, defaultBodyReadings.water, 0, 10) * 10) / 10,
  };
}
const telemetry = {
  pulse: [61, 63, 62, 64, 60, 62, 65, 63, 64, 61, 63, 62, 66, 64],
  oxygen: [98, 97, 98, 98, 97, 98, 99, 98, 97, 98, 98, 97, 98, 98],
  sleep: [7.1, 6.8, 7.4, 6.9, 7.6, 7.2, 6.6, 7.8, 7.1, 7.4, 6.9, 7.7, 7.3, 7.4],
  stress: [26, 29, 27, 31, 34, 28, 26, 32, 35, 30, 27, 33, 31, 29],
};
const storageKeys = {
  reviewed: 'spacehealth-alert-reviewed-v1',
  readings: 'spacehealth-readings-v1',
};
function readStored<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch { return fallback; }
}
function usePersistentState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => readStored(key, initial));
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* local-only prototype */ } }, [key, value]);
  return [value, setValue] as const;
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
function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div className="app-shell">
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
        <span className="wrist-day">Day 142</span>
        <details className="demo-disclosure">
          <summary data-testid="button-demo-info">Demo</summary>
          <div className="demo-info" role="note">Sample data. No live dosimeter, sensors, or team connection. Radiation flags show statistical changes, not exposure limits. Not medical advice. For urgent symptoms, contact mission medical staff.</div>
        </details>
      </header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} aria-label={label} aria-current={location === href ? 'page' : undefined} data-testid={`mobile-link-${href.slice(1) || 'overview'}`}><Icon /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
function Heading({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="page-heading fade-in"><h1>{title}</h1>{right}</div>;
}
type MetricRangeControl = {
  min: number;
  max: number;
  step: number;
  numericValue: number;
  onChange: (next: number) => void;
};
function MetricCard({ icon: Icon, label, value, unit, control }: { icon: typeof HeartPulse; label: string; value: string; unit: string; control?: MetricRangeControl }) {
  const slug = label.toLowerCase().replaceAll(' ', '-');
  return <article className="panel metric-card" data-testid={`metric-${slug}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon /></span></div>
    <div className="metric-value">{value} <span className="metric-unit">{unit}</span></div>
    {control && <div className="metric-adjust" aria-label={`Adjust ${label}`}>
      <input
        type="range"
        min={control.min}
        max={control.max}
        step={control.step}
        value={control.numericValue}
        onChange={e => control.onChange(Number(e.target.value))}
        aria-label={`${label} reading`}
        data-testid={`input-reading-${slug}`}
      />
      <div className="metric-step-row">
        <button
          type="button"
          className="choice metric-step-btn"
          onClick={() => control.onChange(Math.max(control.min, Number((control.numericValue - control.step).toFixed(1))))}
          aria-label={`Decrease ${label}`}
          data-testid={`button-decrease-${slug}`}
        >−</button>
        <button
          type="button"
          className="choice metric-step-btn"
          onClick={() => control.onChange(Math.min(control.max, Number((control.numericValue + control.step).toFixed(1))))}
          aria-label={`Increase ${label}`}
          data-testid={`button-increase-${slug}`}
        >+</button>
      </div>
    </div>}
  </article>;
}
function RadiationSummary({ analysis, acknowledged }: { analysis: RadiationAnalysis; acknowledged: boolean }) {
  const flagged = analysis.status !== 'baseline';
  const description = describeRadiation(analysis);
  return <section className={`panel radiation-panel ${flagged ? 'radiation-flagged' : ''}`} aria-label="Sample dosimeter" data-testid="card-radiation">
    <div className="radiation-caption"><RadiationIcon size={18} /><strong>Radiation now</strong><span>Sample</span></div>
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
function Overview() {
  const [reviewed] = usePersistentState(storageKeys.reviewed, false);
  const [savedDemo] = usePersistentState<RadiationDemo>(radiationStorageKey, defaultRadiationDemo);
  const [savedReadings, setReadings] = usePersistentState<BodyReadings>(storageKeys.readings, defaultBodyReadings);
  const readings = normalizeBodyReadings(savedReadings);
  const demo = normalizeRadiationDemo(savedDemo);
  const analysis = analyzeRadiation(getRadiationSamples(demo.scenario));
  const pendingCount = Number(!reviewed) + Number(analysis.status !== 'baseline' && !demo.acknowledged);
  return <div className="fade-in">
    <Heading title="Readings" right={<Link href="/alerts" className={`wrist-alert ${pendingCount === 0 ? 'is-reviewed' : ''}`} data-testid="link-alert-status"><Bell size={15} />{pendingCount ? `${pendingCount} new` : 'Seen'}</Link>} />
    <Link href="/alerts" className="radiation-open" aria-label="View radiation anomaly details" data-testid="link-radiation-details"><RadiationSummary analysis={analysis} acknowledged={demo.acknowledged} /></Link>
    <ReadingsExplained analysis={analysis} />
    <details className="secondary-vitals" open>
      <summary data-testid="button-body-vitals">Body vitals</summary>
      <div className="grid metrics-grid">
      <MetricCard
        icon={HeartPulse}
        label="Heart rate"
        value={String(readings.heartRate)}
        unit="beats/min"
        control={{
          min: 40,
          max: 180,
          step: 1,
          numericValue: readings.heartRate,
          onChange: heartRate => setReadings({ ...readings, heartRate }),
        }}
      />
      <MetricCard
        icon={Activity}
        label="Activity"
        value={String(readings.activity)}
        unit="min"
        control={{
          min: 0,
          max: 240,
          step: 5,
          numericValue: readings.activity,
          onChange: activity => setReadings({ ...readings, activity }),
        }}
      />
      <MetricCard
        icon={Moon}
        label="Sleep"
        value={readings.sleep.toFixed(1)}
        unit="hours"
        control={{
          min: 0,
          max: 14,
          step: 0.1,
          numericValue: readings.sleep,
          onChange: sleep => setReadings({ ...readings, sleep }),
        }}
      />
      <MetricCard icon={Waves} label="Oxygen" value={String(readings.oxygen)} unit="%" />
      <MetricCard icon={Droplets} label="Water" value={readings.water.toFixed(1)} unit="litres" />
      </div>
    </details>
  </div>;
}
function Signals() {
  const [period, setPeriod] = useState('14 days');
  const [savedReadings] = usePersistentState<BodyReadings>(storageKeys.readings, defaultBodyReadings);
  const readings = normalizeBodyReadings(savedReadings);
  const cards = [
    { title: 'Pulse', value: String(readings.heartRate), unit: 'beats/min', data: [...telemetry.pulse.slice(0, -1), readings.heartRate], icon: HeartPulse },
    { title: 'Oxygen', value: String(readings.oxygen), unit: '%', data: telemetry.oxygen, icon: Waves },
    { title: 'Sleep', value: readings.sleep.toFixed(1), unit: 'hours', data: [...telemetry.sleep.slice(0, -1), readings.sleep], icon: Moon },
    { title: 'Stress', value: '29', unit: '/100', data: telemetry.stress, icon: Wind },
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
function Alerts() {
  const [reviewed, setReviewed] = usePersistentState(storageKeys.reviewed, false);
  const [savedDemo, setDemo] = usePersistentState<RadiationDemo>(radiationStorageKey, defaultRadiationDemo);
  const demo = normalizeRadiationDemo(savedDemo);
  const samples = getRadiationSamples(demo.scenario);
  const analysis = analyzeRadiation(samples);
  const flagged = analysis.status !== 'baseline';
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
    <details className="secondary-vitals body-alerts">
    <summary data-testid="button-pulse-alert">Pulse · {reviewed ? 'seen' : '1 new'}</summary>
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
          <tr><td>Latest</td><td>66 bpm</td><td>In band</td></tr>
        </tbody></table>
      </details>
    </div>
    </details>
  </div>;
}
function NotFound() {
  return <div className="empty-state"><strong>Page not found</strong><Link href="/" className="btn" style={{ marginTop: 14 }} data-testid="link-back-vitals">Back to radiation</Link></div>;
}
function DailyLogPage({ reminder }: { reminder: ReturnType<typeof useDailyReminder> }) {
  const [savedReadings] = usePersistentState<BodyReadings>(storageKeys.readings, defaultBodyReadings);
  return <DailyLog reminder={reminder} readings={normalizeBodyReadings(savedReadings)} />;
}
function RoutedApp() {
  const reminder = useDailyReminder();
  return <Layout>
    {reminder.notice && <section className="daily-reminder-notice" role="alert" aria-label="Daily log reminder" data-testid="notice-daily-reminder"><Bell size={19} /><div><strong>Time for your daily log</strong>{reminder.settings.voiceEnabled && reminder.voiceStatus && <p className="short-hint">{reminder.voiceStatus}</p>}<div className="reminder-notice-actions"><Link href="/log" className="btn small" data-testid="link-reminder-log">Open log</Link><button className="btn outline small" onClick={reminder.dismiss} data-testid="button-dismiss-reminder">Dismiss</button></div></div></section>}
    <Switch>
    <Route path="/" component={Overview} />
    <Route path="/signals" component={Signals} />
    <Route path="/alerts" component={Alerts} />
    <Route path="/log"><DailyLogPage reminder={reminder} /></Route>
    <Route path="/wellbeing"><Redirect to="/log" replace /></Route>
    <Route path="/companion"><Redirect to="/log" replace /></Route>
    <Route component={NotFound} />
  </Switch></Layout>;
}
function App() {
  return <WouterRouter><RoutedApp /></WouterRouter>;
}
export default App;
