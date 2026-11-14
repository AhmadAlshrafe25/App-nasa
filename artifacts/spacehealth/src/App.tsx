import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, CheckCircle2,
  Droplets, Heart, HeartPulse, MessageCircle,
  Moon, Orbit, Send, ShieldAlert,
  Waves, Wind, X,
} from 'lucide-react';

type CheckIn = { id: string; createdAt: string; mood: string; stress: number; sleep: string; note: string };
type ChatMessage = { id: string; role: 'assistant' | 'user'; text: string; at: string };

const navItems = [
  { href: '/', label: 'Vitals', icon: Orbit },
  { href: '/signals', label: 'Trends', icon: Activity },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/wellbeing', label: 'Check-in', icon: Heart },
  { href: '/companion', label: 'Chat', icon: MessageCircle },
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
  text: 'How are you feeling, Mara?',
  at: 'Companion',
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
          <div className="demo-info" role="note">Sample data. No live sensors or team connection. Not medical advice. For urgent symptoms, contact mission medical staff.</div>
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
function MetricCard({ icon: Icon, label, value, unit }: { icon: typeof HeartPulse; label: string; value: string; unit: string }) {
  return <article className="panel metric-card" data-testid={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon /></span></div>
    <div className="metric-value">{value} <span className="metric-unit">{unit}</span></div>
  </article>;
}
function Overview() {
  const [reviewed] = usePersistentState(storageKeys.reviewed, false);
  return <div className="fade-in">
    <Heading title="Vitals" right={<Link href="/alerts" className={`wrist-alert ${reviewed ? 'is-reviewed' : ''}`} data-testid="link-alert-status"><Bell size={15} />{reviewed ? 'Reviewed' : '1 alert'}</Link>} />
    <div className="grid metrics-grid">
      <MetricCard icon={HeartPulse} label="Pulse" value="64" unit="bpm" />
      <MetricCard icon={Waves} label="Oxygen" value="98" unit="%" />
      <MetricCard icon={Moon} label="Sleep" value="7.4" unit="h" />
      <MetricCard icon={Droplets} label="Water" value="1.6" unit="L" />
    </div>
  </div>;
}
const signalCards = [
  { title: 'Pulse', value: '64', unit: 'bpm', data: telemetry.pulse, icon: HeartPulse },
  { title: 'Oxygen', value: '98', unit: '%', data: telemetry.oxygen, icon: Waves },
  { title: 'Sleep', value: '7.4', unit: 'h', data: telemetry.sleep, icon: Moon },
  { title: 'Stress', value: '29', unit: '/100', data: telemetry.stress, icon: Wind },
];
function Signals() {
  const [period, setPeriod] = useState('14 days');
  return <div className="fade-in">
    <Heading title="Trends" right={<div className="period-tabs" aria-label="Trend period">{['7 days', '14 days'].map(x => <button key={x} className={period === x ? 'selected' : ''} onClick={() => setPeriod(x)} data-testid={`button-period-${x.split(' ')[0]}`}>{x.split(' ')[0]}d</button>)}</div>} />
    <div className="grid signal-grid">
      {signalCards.map(({ title, value, unit, data, icon: Icon }) => <article className="panel signal-card" key={title} data-testid={`signal-card-${title.toLowerCase().replaceAll(' ', '-')}`}>
        <div className="signal-head"><div><div className="signal-name">{title}</div><div className="signal-large">{value} <span>{unit}</span></div></div><span className="metric-icon"><Icon /></span></div>
        <Sparkline values={data.slice(-parseInt(period))} />
        <div className="chart-labels"><span>{period}</span><span>Now</span></div>
      </article>)}
    </div>
  </div>;
}
function Alerts() {
  const [reviewed, setReviewed] = usePersistentState(storageKeys.reviewed, false);
  return <div className="fade-in">
    <Heading title="Alerts" />
    <div className="panel alert-panel" data-testid="alert-anomaly">
      {reviewed ? <div className="reviewed-box" data-testid="status-alert-reviewed"><CheckCircle2 size={22} /><strong>Reviewed</strong></div> : <div className="alert-callout"><span className="alert-symbol"><ShieldAlert size={18} /></span><div><h3>Pulse outside baseline</h3><p><strong>81 bpm</strong> · +9 above band</p></div></div>}
      <div className="alert-actions">
        {reviewed ? <button className="btn outline" onClick={() => setReviewed(false)} data-testid="button-unreview-alert"><ArrowDownRight size={16} /> Reopen</button> : <button className="btn" onClick={() => setReviewed(true)} data-testid="button-review-alert"><Check size={16} /> Mark reviewed</button>}
      </div>
      <details className="rule-box">
        <summary data-testid="button-alert-details">Details</summary>
        <p>14-day baseline: <strong>58–72 bpm</strong>. Demo comparison, not a clinical threshold.</p>
        <table className="readings-table"><thead><tr><th>Sample</th><th>Pulse</th><th>Status</th></tr></thead><tbody>
          <tr><td>Prior</td><td>64 bpm</td><td>In band</td></tr>
          <tr><td>Flagged</td><td className="reading-outlier">81 bpm</td><td className="reading-outlier">Review</td></tr>
          <tr><td>Latest</td><td>66 bpm</td><td>In band</td></tr>
        </tbody></table>
      </details>
    </div>
  </div>;
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
    <Heading title="Check-in" />
    <div className="grid overview-bottom" style={{ marginTop: 0 }}>
      <section className="panel form-panel" data-testid="form-wellbeing">
        <label className="form-label">Mood</label>
        <div className="choice-row" role="group" aria-label="Choose a mood">{['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(m => <button type="button" className={`choice ${mood === m ? 'active' : ''}`} onClick={() => setMood(m)} aria-pressed={mood === m} key={m} data-testid={`button-mood-${m.toLowerCase()}`}>{m}</button>)}</div>
        <label className="form-label" htmlFor="stress-range">Stress <span className="short-hint">1 low · 10 high</span></label>
        <div className="range-row"><span style={{ color: 'var(--supporting-ink)', fontSize: 13 }}>1</span><input id="stress-range" aria-label="Stress level from one to ten" type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} data-testid="input-stress-level" /><span style={{ color: 'var(--supporting-ink)', fontSize: 13 }}>10</span><span className="range-value" data-testid="value-stress-level">{stress}/10</span></div>
        <label className="form-label">Sleep</label>
        <div className="choice-row" role="group" aria-label="Choose sleep quality">{['Rough', 'Restless', 'Mixed', 'Restful'].map(s => <button type="button" className={`choice ${sleep === s ? 'active' : ''}`} onClick={() => setSleep(s)} aria-pressed={sleep === s} key={s} data-testid={`button-sleep-${s.toLowerCase()}`}>{s}</button>)}</div>
        <label className="form-label" htmlFor="wellbeing-note">Note <span className="short-hint">optional</span></label>
        <textarea id="wellbeing-note" className="text-area" maxLength={500} placeholder="Add note…" value={note} onChange={e => setNote(e.target.value)} data-testid="input-wellbeing-note" />
        <div className="checkin-actions"><span className="short-hint">On-device only</span><button className="btn" onClick={save} disabled={!mood || !sleep} data-testid="button-save-checkin"><Check size={16} /> Save</button></div>
        {saved && <div className="saved-status" role="status" data-testid="reflection-latest"><CheckCircle2 size={16} /> Saved</div>}
      </section>
      <section className="panel panel-pad" data-testid="section-checkin-history"><div className="section-head" style={{ margin: '0 0 15px' }}><h2 className="section-title">History</h2><span className="score-label">{entries.length}</span></div>
        {entries.length === 0 ? <div className="empty-state" data-testid="empty-checkin-history">No check-ins</div> :
          <div className="history-list">{entries.map(entry => <article className="history-item" key={entry.id} data-testid={`history-checkin-${entry.id}`}><div><div className="history-date">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt))}</div><div className="history-summary">{entry.mood} · {entry.sleep}</div>{entry.note && <div className="history-note">{entry.note}</div>}</div><div className="history-score">{entry.stress}/10</div></article>)}</div>}
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
