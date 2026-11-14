import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, Check, CheckCircle2,
  ChevronRight, CircleHelp, Clock3, Droplets, Heart, HeartPulse, Info, MessageCircle,
  Moon, Orbit, Send, ShieldAlert, ShieldCheck, Sparkles, Sun, TrendingUp,
  Waves, Wind, X,
} from 'lucide-react';

type CheckIn = { id: string; createdAt: string; mood: string; stress: number; sleep: string; note: string };
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; at: string };

const navItems = [
  { href: '/', label: 'Overview', icon: Orbit },
  { href: '/signals', label: 'Body signals', icon: Activity },
  { href: '/alerts', label: 'Pattern review', icon: Bell },
  { href: '/wellbeing', label: 'Wellbeing', icon: Heart },
  { href: '/companion', label: 'Space Companion', icon: MessageCircle },
];
const telemetry = {
  pulse: [61, 63, 62, 64, 60, 62, 65, 63, 64, 61, 63, 62, 66, 64],
  oxygen: [98, 97, 98, 98, 97, 98, 99, 98, 97, 98, 98, 97, 98, 98],
  sleep: [7.1, 6.8, 7.4, 6.9, 7.6, 7.2, 6.6, 7.8, 7.1, 7.4, 6.9, 7.7, 7.3, 7.4],
  stress: [26, 29, 27, 31, 34, 28, 26, 32, 35, 30, 27, 33, 31, 29],
};
const syntheticCheckins: CheckIn[] = [];
const initialMessage: ChatMessage = {
  id: 'welcome', role: 'assistant',
  text: 'I’m here with you, Mara. We can take a moment to check in, make sense of a pattern, or just talk through how this stretch is feeling.',
  at: 'Ready when you are',
};
const storageKeys = {
  checkins: 'spacehealth-checkins-v1',
  reviewed: 'spacehealth-alert-reviewed-v1',
  messages: 'spacehealth-companion-messages-v1',
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
function dateLabel() {
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
}
function timeLabel(date: string) {
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(date));
}
function Sparkline({ values, color = '#659b83', alert = false }: { values: number[]; color?: string; alert?: boolean }) {
  const min = Math.min(...values), max = Math.max(...values);
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 300},${65 - ((v - min) / (max - min || 1)) * 48}`).join(' ');
  return <svg className="sparkline" viewBox="0 0 300 74" role="img" aria-label="Synthetic trend line over the last 14 days">
    <path d="M0 68H300" stroke="#e8e4d9" strokeWidth="1" />
    <polyline points={points} fill="none" stroke={alert ? '#c1854f' : color} strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="300" cy={65 - ((values.at(-1)! - min) / (max - min || 1)) * 48} r="3.5" fill={alert ? '#c1854f' : color} />
  </svg>;
}
function MiniBars() {
  const values = [44, 57, 62, 51, 73, 67, 86, 70, 78, 62, 91, 82, 68, 76];
  return <div className="mini-chart" aria-label="Fourteen day movement trend">
    {values.map((v, i) => <div className="bar-wrap" key={i}><div className={`bar ${i === values.length - 1 ? 'current' : ''}`} style={{ height: `${v}%` }} /></div>)}
  </div>;
}
function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <div className="app-shell">
    <aside className="sidebar">
      <Link href="/" className="brand" data-testid="link-brand">
        <span className="brand-mark"><Orbit size={19} /></span>
        <span><span className="brand-name">SpaceHealth</span><span className="brand-sub">Crew companion · demo</span></span>
      </Link>
      <div className="nav-label">Mission companion</div>
      <nav className="nav-list" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${location === href ? 'active' : ''}`} aria-current={location === href ? 'page' : undefined} data-testid={`link-nav-${label.toLowerCase().replaceAll(' ', '-')}`}>
          <Icon aria-hidden="true" /><span>{label}</span>{href === '/alerts' && <span style={{ marginLeft: 'auto', font: '10px var(--app-font-mono)', color: '#e6c08d' }}>1</span>}
        </Link>)}
      </nav>
      <div className="sidebar-bottom">
        <div className="orbit-card">
          <div className="orbit-caption"><span className="live-dot" /> Flight profile</div>
          <strong>Mara Velez</strong>
          <small>Expedition 08 · Flight day 142</small>
        </div>
        <div className="sidebar-note">A private space for noticing patterns and checking in with yourself.</div>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="crumb"><span>EXPEDITION 08</span><ChevronRight size={13} /><span>{navItems.find(n => n.href === location)?.label ?? 'SpaceHealth'}</span></div>
        <div className="top-meta"><span className="live-dot" /> SYNTHETIC SAMPLE TELEMETRY <span style={{ color: '#c6c0b4' }}>·</span><span>FLIGHT DAY 142</span></div>
      </header>
      <main className="main-content">{children}</main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} aria-label={label} aria-current={location === href ? 'page' : undefined} data-testid={`mobile-link-${href.slice(1) || 'overview'}`}><Icon /><span>{label === 'Body signals' ? 'Signals' : label === 'Pattern review' ? 'Alerts' : label === 'Space Companion' ? 'Companion' : label}</span></Link>)}
    </nav>
  </div>;
}
function Heading({ eyebrow, title, description, right }: { eyebrow: string; title: string; description: string; right?: ReactNode }) {
  return <div className="page-heading fade-in"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p className="page-subtitle">{description}</p></div>{right}</div>;
}
function LegalNotice() {
  return <div className="legal-strip" data-testid="notice-synthetic-disclaimer"><Info size={15} /><span><strong>Prototype boundary.</strong> All displayed readings are fictional synthetic sample data for Mara Velez. This prototype is not medical advice or a clinical monitoring system, and has no live device or spacecraft connection.</span></div>;
}
function MetricCard({ icon: Icon, label, value, unit, foot, trend }: { icon: typeof HeartPulse; label: string; value: string; unit: string; foot: string; trend?: string }) {
  return <article className="panel metric-card" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon /></span></div>
    <div className="metric-value">{value} <span className="metric-unit">{unit}</span></div>
    <div className="metric-foot">{trend && <span className="trend">{trend}</span>}{foot}</div>
  </article>;
}
function Overview() {
  const [reviewed] = usePersistentState(storageKeys.reviewed, false);
  return <div className="fade-in">
    <Heading eyebrow="Flight day 142 · personal health" title="Your body, in context." description="A steady read on your signals and how you’re feeling. Take what’s useful; this space is yours." right={<div className="date-chip"><Clock3 size={13} />{dateLabel()}</div>} />
    <div className="grid overview-top">
      <section className="panel hero-panel" data-testid="status-overview">
        <div className="hero-top"><span className="hero-caption">Latest status · sample telemetry</span><span className="status-pill"><CheckCircle2 size={13} /> Steady overall</span></div>
        <h2 className="hero-title">Your signals are holding a familiar rhythm.</h2>
        <p className="hero-copy">Most readings sit close to your recent personal baseline. One pattern is worth a closer look—see the review note when you’re ready.</p>
        <div className="hero-footer"><Sparkles size={14} /> A useful moment to check in with how you feel, too.</div>
      </section>
      <section className="panel score-panel" data-testid="status-recovery-context">
        <div className="score-label">Recovery context · sample index</div>
        <div className="score-row"><div className="score-ring"><strong>78</strong></div><div><div className="score-title">Room to recharge</div><div className="score-sub">Sleep and resting pulse trend</div></div></div>
        <div className="score-foot"><span>Compared with your 14-day pattern</span><span>+4 pts</span></div>
      </section>
    </div>
    <div className="section-head"><h2 className="section-title">Today’s body signals</h2><Link className="section-link" href="/signals" data-testid="link-view-signals">Explore signals <ArrowRight size={13} /></Link></div>
    <div className="grid metrics-grid">
      <MetricCard icon={HeartPulse} label="Resting pulse" value="64" unit="bpm" foot="near your recent range" trend="−2" />
      <MetricCard icon={Waves} label="Blood oxygen" value="98" unit="%" foot="sample reading · steady" trend="within range" />
      <MetricCard icon={Moon} label="Sleep" value="7.4" unit="hrs" foot="last sleep period" trend="+0.3 hr" />
      <MetricCard icon={Droplets} label="Hydration" value="1.6" unit="L" foot="logged today · 2.2 L guide" trend="73%" />
    </div>
    <div className="grid overview-bottom">
      <section className="panel panel-pad">
        <div className="section-head" style={{ margin: 0 }}><h2 className="section-title">Movement rhythm</h2><span className="score-label">14-DAY VIEW</span></div>
        <MiniBars /><div className="chart-labels"><span>14 days ago</span><span>Daily movement · relative sample units</span><span>Today</span></div>
      </section>
      <section className="panel panel-pad">
        <div className="section-head" style={{ margin: 0 }}><h2 className="section-title">Stress &amp; recovery</h2><Link className="section-link" href="/wellbeing" data-testid="link-check-in">Check in <ArrowRight size={13} /></Link></div>
        <div className="activity-card"><div className="activity-icon"><Wind size={17} /></div><div className="activity-info"><strong>Stress pattern</strong><span>Lower than your recent midpoint</span></div><div className="activity-value">29 / 100</div></div>
        <div className="activity-card"><div className="activity-icon"><TrendingUp size={17} /></div><div className="activity-info"><strong>Recovery context</strong><span>Sleep and pulse trend together</span></div><div className="activity-value">Good</div></div>
        {!reviewed && <div className="notice" style={{ marginTop: 14 }}><ShieldAlert size={16} /><div><strong>One pattern to review</strong><p>A pulse sample differs from your recent personal baseline.</p></div></div>}
      </section>
    </div>
    <LegalNotice />
  </div>;
}
const signalCards = [
  { title: 'Resting pulse', value: '64', unit: 'bpm', sub: 'Personal baseline: 58–72 bpm', change: '−2 bpm vs. prior 14 days', data: telemetry.pulse, icon: HeartPulse },
  { title: 'Blood oxygen', value: '98', unit: '%', sub: 'Sample range: 97–99%', change: 'Stable across the sample window', data: telemetry.oxygen, icon: Waves },
  { title: 'Sleep duration', value: '7.4', unit: 'hrs', sub: 'Recent midpoint: 7.1 hours', change: '+0.3 hours vs. prior 14 days', data: telemetry.sleep, icon: Moon },
  { title: 'Stress index', value: '29', unit: '/ 100', sub: 'Relative sample index', change: 'Near your recent midpoint', data: telemetry.stress, icon: Wind },
];
function Signals() {
  const [period, setPeriod] = useState('14 days');
  return <div className="fade-in">
    <Heading eyebrow="Physiological trends" title="Signals, not verdicts." description="Look at the shape over time. These fictional readings are designed to illustrate context, not clinical thresholds." right={<div className="period-tabs" aria-label="Trend period">{['7 days', '14 days', '30 days'].map(x => <button key={x} className={period === x ? 'selected' : ''} onClick={() => setPeriod(x)} data-testid={`button-period-${x.split(' ')[0]}`}>{x}</button>)}</div>} />
    <div className="notice" style={{ marginBottom: 18 }}><Info size={16} /><div><strong>Sample telemetry only</strong><p>Trends below are generated example data for fictional crew member Mara Velez. No sensors are connected.</p></div></div>
    <div className="grid signal-grid">
      {signalCards.map(({ title, value, unit, sub, change, data, icon: Icon }) => <article className="panel signal-card" key={title} data-testid={`signal-card-${title.toLowerCase().replaceAll(' ', '-')}`}>
        <div className="signal-head"><div><div className="signal-name">{title}</div><div className="signal-large">{value} <span>{unit}</span></div></div><span className="metric-icon"><Icon /></span></div>
        <Sparkline values={data} />
        <div className="signal-foot"><span>{sub}</span><span>{change}</span></div>
        <div className="chart-labels"><span>{period} ago</span><span>Latest sample</span></div>
      </article>)}
    </div>
    <div className="section-head"><h2 className="section-title">Daily context</h2><span className="score-label">FICTIONAL SAMPLE</span></div>
    <div className="grid overview-bottom">
      <section className="panel panel-pad">
        <div className="activity-card"><div className="activity-icon"><Droplets size={17} /></div><div className="activity-info"><strong>Hydration logged</strong><span>1.6 L of a suggested personal guide of 2.2 L</span></div><div className="activity-value">73%</div></div>
        <div className="activity-card"><div className="activity-icon"><Activity size={17} /></div><div className="activity-info"><strong>Movement</strong><span>Relative activity sample over the last 24 hours</span></div><div className="activity-value">6,840 steps</div></div>
      </section>
      <section className="panel panel-pad"><div className="section-title" style={{ marginBottom: 10 }}>How to read this</div><p className="page-subtitle">These illustrative summaries describe how sample data compares with its own recent pattern. They are not safety thresholds or clinical interpretations.</p><Link href="/alerts" className="section-link" style={{ marginTop: 14 }} data-testid="link-review-pattern">See pattern review <ArrowRight size={13} /></Link></section>
    </div>
    <LegalNotice />
  </div>;
}
function Alerts() {
  const [reviewed, setReviewed] = usePersistentState(storageKeys.reviewed, false);
  return <div className="fade-in">
    <Heading eyebrow="Transparent pattern review" title="A pattern to notice." description="A small, explainable anomaly-detection demo. It highlights a difference from this fictional profile’s baseline; it does not identify a cause." />
    <div className="panel alert-panel" data-testid="alert-anomaly">
      {reviewed ? <div className="reviewed-box" data-testid="status-alert-reviewed"><CheckCircle2 size={22} /><div><strong>Marked reviewed</strong><span>This sample finding is still available here. Your review state is saved on this device.</span></div></div> : <div className="alert-callout"><span className="alert-symbol"><ShieldAlert size={18} /></span><div><h3>Resting pulse sample outside recent pattern</h3><p>One fictional resting-pulse sample reached <strong>81 bpm</strong>, above the sample baseline band. The other sample readings remain near their recent pattern.</p></div></div>}
      <div className="rule-box"><div className="rule-label">Why it was flagged · simple demo rule</div><p>For this example, the 14-day fictional resting-pulse baseline is <strong>58–72 bpm</strong>. The sample at <strong>81 bpm</strong> is 9 bpm above the top of that personal band, so the demo marks it for review. The band is an illustrative comparison—not a medical threshold.</p></div>
      <table className="readings-table"><thead><tr><th>Sample window</th><th>Pulse</th><th>Compared with baseline</th><th>Pattern</th></tr></thead><tbody>
        <tr><td>Prior sample · Day 141</td><td>64 bpm</td><td>Inside 58–72 bpm</td><td>Typical</td></tr>
        <tr><td>Flagged sample · Day 142</td><td className="reading-outlier">81 bpm</td><td className="reading-outlier">9 bpm above upper band</td><td className="reading-outlier">Review</td></tr>
        <tr><td>Latest sample · Day 142</td><td>66 bpm</td><td>Inside 58–72 bpm</td><td>Typical</td></tr>
      </tbody></table>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 19, gap: 14, flexWrap: 'wrap' }}>
        <span style={{ color: '#8c9086', fontSize: 10 }}>Anomaly-detection demo · not a diagnosis</span>
        {reviewed ? <button className="btn outline small" onClick={() => setReviewed(false)} data-testid="button-unreview-alert"><ArrowDownRight size={13} /> Reopen review</button> : <button className="btn small" onClick={() => setReviewed(true)} data-testid="button-review-alert"><Check size={14} /> Mark as reviewed</button>}
      </div>
    </div>
    <div className="notice" style={{ marginTop: 16 }}><CircleHelp size={16} /><div><strong>What this does—and doesn’t—say</strong><p>This rule only compares one made-up value to a made-up personal band. It cannot determine whether a person is well or unwell. If you feel unwell or concerned, contact mission medical staff.</p></div></div>
    <LegalNotice />
  </div>;
}
function reflectionFor(mood: string, stress: number, sleep: string) {
  if (stress >= 7) return 'You’ve noted a lot of pressure today. Naming it is a meaningful first step; you deserve a little room to pause.';
  if (mood === 'Low' || sleep === 'Rough') return 'It sounds like today may be asking more of you. You don’t have to solve it all at once—one small, kind moment counts.';
  if (mood === 'Good' || mood === 'Bright') return 'There’s some steadiness in what you shared. It may be worth noticing what helped make space for that.';
  return 'Thanks for taking a moment to check in. Your experience matters beyond what any signal can show.';
}
function Wellbeing() {
  const [entries, setEntries] = usePersistentState<CheckIn[]>(storageKeys.checkins, syntheticCheckins);
  const [mood, setMood] = useState('');
  const [stress, setStress] = useState(4);
  const [sleep, setSleep] = useState('');
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState<CheckIn | null>(null);
  const save = () => {
    if (!mood || !sleep) return;
    const entry: CheckIn = { id: `${Date.now()}`, createdAt: new Date().toISOString(), mood, stress, sleep, note: note.trim() };
    setEntries([entry, ...entries]);
    setSaved(entry);
    setMood(''); setStress(4); setSleep(''); setNote('');
  };
  return <div className="fade-in">
    <Heading eyebrow="Private by design · stored on this device" title="How are you, really?" description="A gentle check-in can hold what numbers can’t. Share as much or as little as feels right." />
    <div className="grid overview-bottom" style={{ marginTop: 0 }}>
      <section className="panel form-panel" data-testid="form-wellbeing">
        <div className="section-title" style={{ marginBottom: 5 }}>A moment for yourself</div><p className="page-subtitle" style={{ marginBottom: 22 }}>Nothing here is scored as good or bad.</p>
        <label className="form-label">How’s your mood?</label>
        <div className="choice-row" role="group" aria-label="Choose a mood">{['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(m => <button type="button" className={`choice ${mood === m ? 'active' : ''}`} onClick={() => setMood(m)} aria-pressed={mood === m} key={m} data-testid={`button-mood-${m.toLowerCase()}`}>{m}</button>)}</div>
        <label className="form-label" htmlFor="stress-range">How much stress are you carrying? <span style={{ color: '#9a9e95', fontWeight: 400 }}>1 = very little · 10 = a lot</span></label>
        <div className="range-row"><span style={{ color: '#9a9e95', fontSize: 10 }}>1</span><input id="stress-range" aria-label="Stress level from one to ten" type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} data-testid="input-stress-level" /><span style={{ color: '#9a9e95', fontSize: 10 }}>10</span><span className="range-value" data-testid="value-stress-level">{stress}/10</span></div>
        <label className="form-label">How did sleep feel?</label>
        <div className="choice-row" role="group" aria-label="Choose sleep quality">{['Rough', 'Restless', 'Mixed', 'Restful'].map(s => <button type="button" className={`choice ${sleep === s ? 'active' : ''}`} onClick={() => setSleep(s)} aria-pressed={sleep === s} key={s} data-testid={`button-sleep-${s.toLowerCase()}`}>{s}</button>)}</div>
        <label className="form-label" htmlFor="wellbeing-note">Anything you’d like to remember? <span style={{ color: '#92978e', fontWeight: 400 }}>Optional and private</span></label>
        <textarea id="wellbeing-note" className="text-area" maxLength={500} placeholder="A thought, a small win, or nothing at all…" value={note} onChange={e => setNote(e.target.value)} data-testid="input-wellbeing-note" />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, gap: 12 }}><span style={{ color: '#96998f', fontSize: 10 }}>Saved only in this browser</span><button className="btn" onClick={save} disabled={!mood || !sleep} data-testid="button-save-checkin"><Check size={14} /> Save check-in</button></div>
        {saved && <div className="reflection" role="status" data-testid="reflection-latest"><strong>A reflection for this moment</strong>{reflectionFor(saved.mood, saved.stress, saved.sleep)}</div>}
      </section>
      <section className="panel panel-pad" data-testid="section-checkin-history"><div className="section-head" style={{ margin: '0 0 15px' }}><h2 className="section-title">Your check-in history</h2><span className="score-label">{entries.length} {entries.length === 1 ? 'ENTRY' : 'ENTRIES'}</span></div>
        {entries.length === 0 ? <div className="empty-state" data-testid="empty-checkin-history"><div className="empty-icon"><Sun size={19} /></div><strong>Your first check-in starts here</strong><p>Entries stay on this device and are visible only in this browser.</p></div> :
          <div className="history-list">{entries.map(entry => <article className="history-item" key={entry.id} data-testid={`history-checkin-${entry.id}`}><div><div className="history-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt))}</div><div className="history-summary">{entry.mood} mood · {entry.sleep.toLowerCase()} sleep</div>{entry.note && <div className="history-note">{entry.note}</div>}</div><div className="history-score">Stress {entry.stress}/10<small>Personal note</small></div></article>)}</div>}
      </section>
    </div>
    <div className="notice" style={{ marginTop: 16 }}><ShieldCheck size={16} /><div><strong>Your privacy matters</strong><p>Notes and check-ins are stored in local browser storage on this device. They are not sent to a server and are not monitored by a mission health team.</p></div></div>
    <LegalNotice />
  </div>;
}
const prompts = ['Help me settle after a busy day', 'Can we look at my sleep pattern?', 'I want to put today into words'];
const urgentPattern = /\b(chest pain|can.t breathe|cannot breathe|trouble breathing|difficulty breathing|severe bleeding|fainting|passed out|urgent|emergency|hurt myself|harm myself|suicid|danger|immediate danger)\b/i;
function supportiveReply(text: string) {
  if (urgentPattern.test(text)) return 'I’m glad you told me. This needs a person’s attention now: please contact mission medical staff immediately using your mission’s established urgent channel. I can stay with you while you reach out, but I can’t assess or respond to emergencies.';
  const s = text.toLowerCase();
  if (s.includes('sleep') || s.includes('tired') || s.includes('rest')) return 'Sleep can feel different in a demanding environment. What part of the last rest period is staying with you most—the settling in, waking, or how you feel now?';
  if (s.includes('stress') || s.includes('busy') || s.includes('overwhelm')) return 'That sounds like a lot to carry at once. Would it help to name just one thing that feels most present, without needing to fix it right now?';
  if (s.includes('pattern') || s.includes('signal') || s.includes('pulse')) return 'We can look at the sample pattern together, while keeping in mind it’s fictional and not a health assessment. What stands out to you about it?';
  if (s.includes('thank') || s.includes('good') || s.includes('win')) return 'I’m glad you made room to notice that. What do you want to remember about this moment?';
  return 'Thank you for sharing that with me. It makes sense to take this one moment at a time. What feels most important for you right now?';
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
    <Heading eyebrow="A quiet place to talk" title="Space Companion" description="A supportive, non-clinical conversation—here to listen, not to diagnose or direct your care." right={<button className="btn outline small" onClick={clear} data-testid="button-clear-conversation"><X size={13} /> Start fresh</button>} />
    <div className="chat-layout">
      <section className="panel chat-panel" aria-label="Space Companion conversation">
        <div className="chat-header"><div className="companion-avatar"><Orbit size={19} /></div><div><strong>Space Companion</strong><small>Supportive conversation · stays on this device</small></div><span className="live-dot" style={{ marginLeft: 'auto' }} /></div>
        <div className="chat-messages" role="log" aria-live="polite" data-testid="conversation-messages">
          {messages.map(message => <div key={message.id} className={`message ${message.role}`} data-testid={`message-${message.role}-${message.id}`}><div>{message.text}</div><div className="message-time">{message.role === 'assistant' && message.id === 'welcome' ? message.at : timeLabel(message.at)}</div></div>)}
          <div ref={bottomRef} />
        </div>
        <form className="chat-compose" onSubmit={e => { e.preventDefault(); send(); }}>
          <input className="chat-input" aria-label="Write a message" placeholder="Write what’s on your mind…" value={text} onChange={e => setText(e.target.value)} data-testid="input-companion-message" />
          <button className="btn" type="submit" disabled={!text.trim()} aria-label="Send message" data-testid="button-send-message"><Send size={15} /></button>
        </form>
      </section>
      <aside className="panel chat-aside"><h3>Where shall we begin?</h3><p>Choose a starting point or say something in your own words.</p><div className="prompt-list">{prompts.map((prompt, i) => <button key={prompt} className="prompt-chip" onClick={() => send(prompt)} data-testid={`button-prompt-${i + 1}`}>{prompt}<ArrowUpRight size={12} style={{ float: 'right' }} /></button>)}</div>
        <div className="legal-strip" style={{ padding: '11px 0 0', marginTop: 18, background: 'transparent' }}><Info size={14} /><span>If you mention urgent symptoms or danger, contact mission medical staff immediately.</span></div>
      </aside>
    </div>
    <LegalNotice />
  </div>;
}
function NotFound() {
  return <div className="empty-state"><div className="empty-icon"><Orbit size={20} /></div><strong>This route is outside the flight plan.</strong><p>Head back to your overview.</p><Link href="/" className="btn" style={{ marginTop: 14 }}>Return to overview</Link></div>;
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
