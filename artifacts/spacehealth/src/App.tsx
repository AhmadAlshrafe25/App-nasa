import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, CheckCircle2,
  Droplets, Heart, HeartPulse, MessageCircle,
  Moon, Orbit, Radiation as RadiationIcon, Send, ShieldAlert,
  Waves, Wind, X,
} from 'lucide-react';
import {
  analyzeRadiation, defaultRadiationDemo, getRadiationSamples,
  normalizeRadiationDemo, radiationStorageKey,
  type RadiationAnalysis, type RadiationDemo, type RadiationScenario,
} from '@/lib/radiation';
import { describeRadiation } from '@/lib/radiation-copy';

type CheckIn = {
  id: string;
  createdAt: string;
  mood: string;
  stress: number;
  sleep: string;
  heartRate?: number;
  activity?: number;
  note: string;
};
type BodyReadings = {
  heartRate: number;
  activity: number;
  sleep: number;
  oxygen: number;
  water: number;
};
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; at: string };

const navItems = [
  { href: '/', label: 'Readings', icon: RadiationIcon },
  { href: '/signals', label: 'Trends', icon: Activity },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/wellbeing', label: 'Log', icon: Heart },
  { href: '/companion', label: 'Chat', icon: MessageCircle },
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
const syntheticCheckins: CheckIn[] = [];
const initialMessage: ChatMessage = {
  id: 'welcome', role: 'assistant',
  text: 'How are you feeling, Mara?',
  at: 'Companion',
};
const storageKeys = {
  checkins: 'spacehealth-checkins-v1',
  reviewed: 'spacehealth-alert-reviewed-v1',
  messages: 'spacehealth-companion-messages-v1',
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
function timeLabel(date: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
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
function Wellbeing() {
  const [entries, setEntries] = usePersistentState<CheckIn[]>(storageKeys.checkins, syntheticCheckins);
  const [savedReadings] = usePersistentState<BodyReadings>(storageKeys.readings, defaultBodyReadings);
  const readings = normalizeBodyReadings(savedReadings);
  const [mood, setMood] = useState('');
  const [stress, setStress] = useState(4);
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<CheckIn | null>(null);
  const save = () => {
    if (!mood) return;
    const entry: CheckIn = {
      id: `${Date.now()}`,
      createdAt: new Date().toISOString(),
      mood,
      stress,
      sleep: `${readings.sleep.toFixed(1)} hrs`,
      heartRate: readings.heartRate,
      activity: readings.activity,
      note: note.trim(),
    };
    setEntries([entry, ...entries]);
    setSaved(entry);
    setMood(''); setStress(4); setNote('');
  };
  return <div className="fade-in">
    <Heading title="Log" />
    <div className="grid overview-bottom" style={{ marginTop: 0 }}>
      <section className="panel form-panel" data-testid="form-wellbeing">
        <div className="section-head" style={{ margin: '0 0 10px' }}>
          <span className="form-label" style={{ marginBottom: 0 }}>From Readings</span>
          <Link href="/" className="section-link" data-testid="link-edit-readings">Adjust in Readings</Link>
        </div>
        <div className="log-readings-grid" data-testid="summary-pulled-readings">
          <div className="log-reading-pill" data-testid="log-reading-heart-rate">
            <span className="log-reading-label"><HeartPulse size={14} /> Heart rate</span>
            <strong>{readings.heartRate} <span>bpm</span></strong>
          </div>
          <div className="log-reading-pill" data-testid="log-reading-activity">
            <span className="log-reading-label"><Activity size={14} /> Activity</span>
            <strong>{readings.activity} <span>min</span></strong>
          </div>
          <div className="log-reading-pill" data-testid="log-reading-sleep">
            <span className="log-reading-label"><Moon size={14} /> Sleep</span>
            <strong>{readings.sleep.toFixed(1)} <span>hrs</span></strong>
          </div>
        </div>
        <label className="form-label">Mood</label>
        <div className="choice-row" role="group" aria-label="Choose a mood">{['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(m => <button type="button" className={`choice ${mood === m ? 'active' : ''}`} onClick={() => setMood(m)} aria-pressed={mood === m} key={m} data-testid={`button-mood-${m.toLowerCase()}`}>{m}</button>)}</div>
        <label className="form-label" htmlFor="stress-range">Stress <span className="short-hint">1 low · 10 high</span></label>
        <div className="range-row"><span style={{ color: 'var(--supporting-ink)', fontSize: 13 }}>1</span><input id="stress-range" aria-label="Stress level from one to ten" type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} data-testid="input-stress-level" /><span style={{ color: 'var(--supporting-ink)', fontSize: 13 }}>10</span><span className="range-value" data-testid="value-stress-level">{stress}/10</span></div>
        <label className="form-label" htmlFor="wellbeing-note">Note <span className="short-hint">optional</span></label>
        <textarea id="wellbeing-note" className="text-area" maxLength={500} placeholder="Add note…" value={note} onChange={e => setNote(e.target.value)} data-testid="input-wellbeing-note" />
        <div className="checkin-actions"><span className="short-hint">On-device only</span><button className="btn" onClick={save} disabled={!mood} data-testid="button-save-checkin"><Check size={16} /> Save</button></div>
        {saved && <div className="saved-status" role="status" data-testid="reflection-latest"><CheckCircle2 size={16} /> Saved</div>}
      </section>
      <section className="panel panel-pad" data-testid="section-checkin-history"><div className="section-head" style={{ margin: '0 0 15px' }}><h2 className="section-title">History</h2><span className="score-label">{entries.length}</span></div>
        {entries.length === 0 ? <div className="empty-state" data-testid="empty-checkin-history">No logs yet</div> :
          <div className="history-list">{entries.map(entry => <article className="history-item" key={entry.id} data-testid={`history-checkin-${entry.id}`}><div><div className="history-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt))}</div><div className="history-summary">{entry.mood} · {entry.heartRate !== undefined ? `${entry.heartRate} bpm · ` : ''}{entry.activity !== undefined ? `${entry.activity} min · ` : ''}{entry.sleep}</div>{entry.note && <div className="history-note">{entry.note}</div>}</div><div className="history-score">{entry.stress}/10</div></article>)}</div>}
      </section>
    </div>
  </div>;
}
const prompts = ['Feeling stressed', 'Sleep check', 'Talk about today'];
const urgentPattern = /\b(chest pain|can.t breathe|cannot breathe|trouble breathing|difficulty breathing|severe bleeding|fainting|passed out|urgent|emergency|hurt myself|harm myself|suicid|danger|immediate danger)\b/i;
function supportiveReply(text: string) {
  if (urgentPattern.test(text)) return 'Contact mission medical staff immediately through your urgent channel. I cannot assess emergencies.';
  const s = text.toLowerCase();
  if (s.includes('sleep') || s.includes('tired') || s.includes('rest')) return 'What was hardest: falling asleep, waking up, or feeling rested?';
  if (s.includes('stress') || s.includes('busy') || s.includes('overwhelm')) return 'What is the main thing weighing on you?';
  if (s.includes('pattern') || s.includes('signal') || s.includes('pulse')) return 'What stands out in the sample readings?';
  if (s.includes('thank') || s.includes('good') || s.includes('win')) return 'What would you like to remember about that?';
  return 'I’m listening. What matters most right now?';
}
function Companion() {
  const [messages, setMessages] = usePersistentState<ChatMessage[]>(storageKeys.messages, [initialMessage]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  const send = (value = text) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const now = new Date().toISOString();
    const reply: ChatMessage[] = [
      { id: `${Date.now()}-you`, role: 'user', text: trimmed, at: now },
      { id: `${Date.now()}-reply`, role: 'assistant', text: supportiveReply(trimmed), at: new Date(Date.now() + 1).toISOString() },
    ];
    setMessages([...messages, ...reply]); setText('');
  };
  const clear = () => setMessages([initialMessage]);
  return <div className="fade-in">
    <Heading title="Chat" right={<button className="btn outline small" onClick={clear} data-testid="button-clear-conversation"><X size={15} /> New chat</button>} />
    <div className="chat-layout">
      <section className="panel chat-panel" aria-label="Space Companion conversation">
        <div className="chat-header"><strong>Companion</strong><small>Scripted · on-device</small></div>
        <div className="chat-messages" role="log" aria-live="polite" data-testid="conversation-messages">
          {messages.map(message => <div key={message.id} className={`message ${message.role}`} data-testid={`message-${message.role}-${message.id}`}><div>{message.id === 'welcome' ? initialMessage.text : message.text}</div><div className="message-time">{message.id !== 'welcome' && timeLabel(message.at)}</div></div>)}
          <div ref={bottomRef} />
        </div>
        <form className="chat-compose" onSubmit={e => { e.preventDefault(); send(); }}>
          <input className="chat-input" aria-label="Write a message" placeholder="Message…" value={text} onChange={e => setText(e.target.value)} data-testid="input-companion-message" />
          <button className="btn" type="submit" disabled={!text.trim()} aria-label="Send message" data-testid="button-send-message"><Send size={15} /></button>
        </form>
      </section>
      <aside className="panel chat-aside"><div className="prompt-list">{prompts.map((prompt, i) => <button key={prompt} className="prompt-chip" onClick={() => send(prompt)} data-testid={`button-prompt-${i + 1}`}>{prompt}<ArrowUpRight size={12} style={{ float: 'right' }} /></button>)}</div></aside>
    </div>
  </div>;
}
function NotFound() {
  return <div className="empty-state"><strong>Page not found</strong><Link href="/" className="btn" style={{ marginTop: 14 }} data-testid="link-back-vitals">Back to vitals</Link></div>;
}
function RoutedApp() {
  return <Layout><Switch>
    <Route path="/" component={Overview} />
    <Route path="/signals" component={Signals} />
    <Route path="/alerts" component={Alerts} />
    <Route path="/wellbeing" component={Wellbeing} />
    <Route path="/companion" component={Companion} />
    <Route component={NotFound} />
  </Switch></Layout>;
}
function App() {
  return <WouterRouter><RoutedApp /></WouterRouter>;
}
export default App;
