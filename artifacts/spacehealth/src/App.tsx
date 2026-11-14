import { type ReactNode, useEffect, useRef, useState } from 'react';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation } from 'wouter';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import {
  Activity, AlertTriangle, ArrowDownRight, Bell, Check, CheckCircle2, ClipboardList,
  Droplets, Dumbbell, Flame, Gauge, HeartPulse, Moon, Orbit,
  Radiation as RadiationIcon, ShieldAlert, Siren, Sun, Thermometer, Watch, Waves, Wind, X,
} from 'lucide-react';
import {
  getGetEarthMessageSessionQueryKey,
  getListEarthMessagesQueryKey,
  useCreateEarthMessageInvite,
  useGetEarthMessageSession,
  useListEarthMessages,
  useMarkEarthMessageViewed,
  type EarthFamilyMessage,
} from '@workspace/api-client-react';
import {
  analyzeRadiation, defaultRadiationDemo, getRadiationSamples,
  normalizeRadiationDemo, radiationStorageKey,
  type RadiationAnalysis, type RadiationDemo, type RadiationScenario, type RadiationSample,
} from '@/lib/radiation';
import { describeRadiation } from '@/lib/radiation-copy';
import { DailyLog } from '@/components/daily-log';
import { Countermeasures } from '@/components/countermeasures';
import { EarthClock } from '@/components/earth-clock';
import { useDailyReminder } from '@/hooks/use-daily-reminder';
import {
  defaultBodyReadings, evaluateAllVitals, normalizeBodyReadings,
  readingsStorageKey, VITAL_SPECS,
  type BodyReadings, type EvaluatedVital,
} from '@/lib/vitals';
import { mergeStoredValue } from '@/lib/persistent-state';
import { getReadingTrend, primaryReadingKeys } from '@/lib/reading-trends';
import { applyTheme, normalizeTheme, themeStorageKey, type DisplayTheme } from '@/lib/theme';

import { AiFindings } from '@/components/ai-findings';
import { CompanionPanel } from '@/components/companion-panel';
import { MissionSyncProvider, SyncBar, SyncOverview } from '@/components/mission-sync';
import { useIsMobile } from '@/hooks/use-mobile';

const navItems = [
  { href: '/', label: 'Readings', icon: RadiationIcon },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/log', label: 'Log', icon: ClipboardList },
];

const storageKeys = {
  reviewed: 'spacehealth-alert-reviewed-v1',
  readings: readingsStorageKey,
};

const readingsChangedEvent = 'spacehealth-readings-changed';
const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY.');
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

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
      const serialized = JSON.stringify(value);
      if (localStorage.getItem(key) !== serialized) {
        localStorage.setItem(key, serialized);
        window.dispatchEvent(new CustomEvent(readingsChangedEvent, { detail: { key } }));
      }
    } catch { /* local-only prototype */ }
  }, [key, value]);
  useEffect(() => {
    const onSync = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== key && event.key !== null) return;
      if (event instanceof CustomEvent && event.detail?.key !== key) return;
      setValue(previous => mergeStoredValue(previous, readStored(key, initial)));
    };
    window.addEventListener('storage', onSync);
    window.addEventListener(readingsChangedEvent, onSync);
    return () => {
      window.removeEventListener('storage', onSync);
      window.removeEventListener(readingsChangedEvent, onSync);
    };
  }, [key, initial]);
  return [value, setValue] as const;
}

function AstroDialog({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');
  const sessionQuery = useGetEarthMessageSession({
    query: { queryKey: getGetEarthMessageSessionQueryKey() },
  });
  const role = sessionQuery.data?.role;
  const canReadMessages = role === 'astronaut' || role === 'family';
  const messagesQuery = useListEarthMessages({
    query: {
      enabled: canReadMessages,
      queryKey: getListEarthMessagesQueryKey(),
    },
  });
  const createInvite = useCreateEarthMessageInvite();
  const markViewed = useMarkEarthMessageViewed();
  const queryClient = useQueryClient();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  const closeDialog = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    onClose();
  };

  const createFamilyInvite = async () => {
    setInviteStatus('');
    try {
      const invite = await createInvite.mutateAsync(undefined);
      const url = new URL('/space-companion/send', window.location.origin);
      url.searchParams.set('invite', invite.token);
      setInviteLink(url.toString());
      try {
        await navigator.clipboard.writeText(url.toString());
        setInviteStatus('One-time invitation copied. Share it privately with a family member.');
      } catch {
        setInviteStatus('Invitation ready. Copy the link below and share it privately.');
      }
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : 'Could not create an invitation.');
    }
  };

  const copyFamilyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setInviteStatus('Invitation copied.');
    } catch {
      setInviteStatus('Select and copy the invitation link below.');
    }
  };

  const onMessagePlay = (message: EarthFamilyMessage) => {
    if (role !== 'astronaut' || message.viewedAt) return;
    markViewed.mutate({ id: message.id }, {
      onSuccess: (updated) => {
        queryClient.setQueryData<EarthFamilyMessage[]>(
          getListEarthMessagesQueryKey(),
          (current) => current?.map((item) => item.id === updated.id ? updated : item),
        );
      },
    });
  };

  return <dialog
    ref={dialogRef}
    className="astro-dialog"
    aria-labelledby="astro-dialog-title"
    aria-describedby="astro-disclosure"
    data-testid="dialog-astro"
    onCancel={event => { event.preventDefault(); closeDialog(); }}
    onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}
  >
    <div className="astro-dialog-content">
      <div className="astro-dialog-heading">
        <span className="astro-mark" aria-hidden="true"><Orbit size={20} /></span>
        <div><span className="astro-kicker">PRIVATE EARTH CHANNEL</span><h2 id="astro-dialog-title">Messages from Earth</h2></div>
        <button type="button" className="astro-close" onClick={closeDialog} aria-label="Close Astro messages" data-testid="button-astro-close"><X size={19} /></button>
      </div>
      <p className="astro-disclosure" id="astro-disclosure" data-testid="status-astro-disclosure">
        Real voice and video messages are private. Only the astronaut account and invited family members can access them.
      </p>

      {sessionQuery.isLoading && <p role="status" data-testid="status-astro-loading">Checking the private inbox…</p>}
      {sessionQuery.isError && <p role="alert" data-testid="status-astro-error">Could not load the inbox. Try again shortly.</p>}
      {role === 'signed-out' && <div className="astro-access-prompt" data-testid="panel-astro-sign-in">
        <p>Sign in with the astronaut account to open your family messages.</p>
        <Link href="/sign-in" className="btn" data-testid="link-astro-sign-in">Sign in</Link>
      </div>}
      {role === 'unlinked' && <div className="astro-access-prompt" data-testid="panel-astro-unlinked">
        <p>This account is not the astronaut inbox or an invited family account.</p>
        <Link href="/space-companion/send" className="btn outline" data-testid="link-astro-family-portal">Open family message portal</Link>
      </div>}
      {role === 'astronaut' && <section className="astro-invite-panel" aria-label="Invite family">
        <p>Create a one-time link for a family member to create an account and send a recording. The link expires in seven days.</p>
        <button type="button" className="btn" onClick={createFamilyInvite} disabled={createInvite.isPending} data-testid="button-astro-create-invite">
          {createInvite.isPending ? 'Creating link…' : 'Create family invite'}
        </button>
        {inviteLink && <div className="astro-invite-link">
          <label htmlFor="astro-invite-url">Family invitation link</label>
          <input id="astro-invite-url" type="url" readOnly value={inviteLink} data-testid="input-astro-invite-link" />
          <button type="button" className="btn outline" onClick={copyFamilyInvite} data-testid="button-astro-copy-invite">Copy link</button>
        </div>}
        {inviteStatus && <p role="status" aria-live="polite" data-testid="status-astro-invite">{inviteStatus}</p>}
      </section>}

      {canReadMessages && <section className="astro-message-section" aria-label="Family messages">
        <h3>Family recordings</h3>
        {messagesQuery.isLoading && <p role="status" data-testid="status-astro-messages-loading">Loading messages…</p>}
        {messagesQuery.isError && <p role="alert" data-testid="status-astro-messages-error">Could not load messages. Close Astro and try again.</p>}
        {!messagesQuery.isLoading && !messagesQuery.isError && messagesQuery.data?.length === 0 && <p className="astro-empty" data-testid="status-astro-empty">No recordings yet. Invite someone you trust to send a voice note or video from Earth.</p>}
        <div className="astro-message-list">
          {messagesQuery.data?.map((message) => <article className="astro-message" key={message.id} data-testid={`card-astro-message-${message.id}`}>
            <div className="astro-message-heading">
              <div><strong data-testid={`text-astro-message-title-${message.id}`}>{message.title}</strong><span>{message.senderName} · {message.relationship}</span></div>
              <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
            </div>
            {message.note && <p data-testid={`text-astro-message-note-${message.id}`}>{message.note}</p>}
            {message.mediaType === 'audio'
              ? <audio controls preload="metadata" src={message.mediaUrl} onPlay={() => onMessagePlay(message)} data-testid={`audio-astro-message-${message.id}`} />
              : <video controls preload="metadata" src={message.mediaUrl} onPlay={() => onMessagePlay(message)} data-testid={`video-astro-message-${message.id}`} />}
            <span className="astro-message-viewed">{message.viewedAt ? 'Viewed' : 'New message'}</span>
          </article>)}
        </div>
      </section>}
    </div>
  </dialog>;
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

function EmergencyMonitor({
  readings,
  onChangeReadings,
}: {
  readings: BodyReadings;
  onChangeReadings: (next: BodyReadings) => void;
}) {
  const { overall, yellowItems, redItems } = evaluateAllVitals(readings);

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
          <span className="yellow-toast-badge"><AlertTriangle size={16} /> YELLOW DEMO · EXAMPLE BAND</span>
          <span className="yellow-toast-source"><Watch size={13} /> Simulated readings</span>
        </div>
        <p className="yellow-toast-body">
          {yellowItems.map(item => (
            <span key={item.spec.key} className="yellow-vital-chip" data-testid={`yellow-chip-${item.spec.key}`}>
              <strong>{item.spec.label}: {item.formattedValue} {item.spec.unit}</strong> (yellow example band)
            </span>
          ))}
        </p>
        <div className="yellow-toast-actions">
          <Link href="/" className="btn small outline" data-testid="link-yellow-inspect">Inspect Readings</Link>
          <button type="button" className="btn small" onClick={stabilizeAllToNormal} data-testid="button-yellow-stabilize">
            Reset demo readings
          </button>
        </div>
      </section>
    );
  }

  // Fictional examples must not trigger operational alarms.
  return (
    <section
      className="panel"
      role="status"
      aria-live="polite"
      data-testid="banner-red-emergency"
    >
      <div className="red-emergency-inner">
        <div className="red-emergency-header">
          <span className="red-siren-icon"><Siren size={26} /></span>
          <div>
            <div className="red-emergency-kicker">SIMULATED READINGS · UNVALIDATED EXAMPLE BANDS</div>
            <h2>Red demo state</h2>
            <p>Editable fictional data, not a medical emergency or live sensor alert. No emergency alarm is played. Follow approved mission procedures for real concerns.</p>
          </div>
        </div>

        <div className="red-breach-list">
          {redItems.map(item => (
            <div className="red-breach-card" key={item.spec.key} data-testid={`red-breach-${item.spec.key}`}>
              <div className="red-breach-top">
                <strong>{item.spec.label}: {item.formattedValue} {item.spec.unit}</strong>
                <span className="red-sensor-tag">Simulated {item.spec.sensorLocation} · {item.spec.sensorDetail}</span>
              </div>
              <div className="red-breach-reason">Unvalidated red example band: {item.spec.redRangeText}</div>
              <div className="red-inline-control">
                <span>Edit demo {item.spec.label}:</span>
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
            Load yellow demo values
          </button>
          <button
            type="button"
            className="btn red-to-normal-btn"
            onClick={stabilizeAllToNormal}
            data-testid="button-emergency-to-normal"
          >
            Reset demo readings
          </button>
        </div>
      </div>
    </section>
  );
}

function Sparkline({ values, label = 'Simulated trend', alert = false }: { values: (number | null)[]; label?: string; alert?: boolean }) {
  const valid = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (!valid.length) return <span className="short-hint">No trend available</span>;
  const min = Math.min(...valid), max = Math.max(...valid);
  const x = (index: number) => 6 + index / Math.max(1, values.length - 1) * 288;
  const y = (value: number) => max === min ? 37 : 64 - (value - min) / (max - min) * 52;
  const segments: string[][] = [[]];
  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) segments.push([]);
    else segments.at(-1)!.push(`${x(index)},${y(value)}`);
  });
  const last = values.at(-1);
  const color = alert ? 'var(--trend-alert)' : 'var(--signal-color)';
  return <svg className="sparkline" viewBox="0 0 300 74" role="img" aria-label={label}>
    <title>{label}</title>
    <path d="M6 68H294" stroke="var(--space-line)" strokeWidth="1" />
    {segments.filter(segment => segment.length > 1).map((segment, index) => <polyline key={index} points={segment.join(' ')} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
    {last !== null && last !== undefined && Number.isFinite(last) && <circle cx={x(values.length - 1)} cy={y(last)} r="4" fill={color} />}
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
  const [astroOpen, setAstroOpen] = useState(false);
  const isNarrow = useIsMobile();
  const [storedTheme, setTheme] = usePersistentState<DisplayTheme>(themeStorageKey, 'space');
  const theme = normalizeTheme(storedTheme);
  useEffect(() => applyTheme(theme), [theme]);
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
        <button type="button" className="nav-link astro-nav-button" onClick={() => setAstroOpen(true)} data-testid="button-astro-desktop"><Orbit aria-hidden="true" /><span>Astro</span></button>
      </nav>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <div className="crew-branding">
          <strong className="crew-name" data-testid="text-crew-name">Mara Velez</strong>
        </div>
        <span className="sensor-live-pill" data-testid="badge-sensor-origin">
          <Watch size={13} /> Demo · no connected sensors
        </span>
        {!isNarrow && <SyncBar />}
        <div className="mission-time">
          <span className="wrist-day">Day 142</span>
          <EarthClock />
        </div>
        <details className="demo-disclosure">
          <summary data-testid="button-demo-info" title="Space / Sky theme" aria-label={`Display settings; current theme ${theme}`}>
            {theme === 'space' ? <Orbit size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
            <span className="theme-summary">{theme === 'space' ? 'Space' : 'Sky'}</span>
          </summary>
          <div className="demo-info">
            <strong>Display theme</strong>
            <div className="theme-picker" role="group" aria-label="Display theme">
              {(['space', 'sky'] as const).map(choice => <button key={choice} type="button" aria-pressed={theme === choice} data-testid={`button-theme-${choice}`} onClick={event => {
                setTheme(choice);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}>
                {choice === 'space' ? <Orbit size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
                {choice === 'space' ? 'Space' : 'Sky'}
              </button>)}
            </div>
            <p className="theme-demo-note" role="note">Simulated readings; no connected sensors. Flags are sample comparisons, not safety limits or medical advice.</p>
          </div>
        </details>
      </header>
      <main className="main-content">
        <EmergencyMonitor readings={readings} onChangeReadings={onChangeReadings} />
        {children}
      </main>
      <footer className="mission-footer" data-testid="footer-mission-motto">
        <strong className="mission-motto" data-testid="mission-motto">Ad astra per asphera</strong>
        <span>To the stars through adversity.</span>
      </footer>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">
      {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={location === href ? 'active' : ''} aria-label={label} aria-current={location === href ? 'page' : undefined} data-testid={`mobile-link-${href.slice(1) || 'overview'}`}><Icon /><span>{label}</span></Link>)}
      <button type="button" className="mobile-astro-button" onClick={() => setAstroOpen(true)} data-testid="button-astro-mobile"><Orbit aria-hidden="true" /><span>Astro</span></button>
    </nav>
    {astroOpen && <AstroDialog onClose={() => setAstroOpen(false)} />}
  </div>;
}

function Heading({ title, right }: { title: string; right?: ReactNode }) {
  return <div className="page-heading fade-in"><h1>{title}</h1>{right}</div>;
}

function VitalSensorCard({
  item,
  onChange,
  trend,
  days = 14,
}: {
  item: EvaluatedVital;
  onChange: (nextValue: number) => void;
  trend?: number[] | null;
  days?: 7 | 14;
}) {
  const { spec, value, formattedValue, severity } = item;
  const Icon = VITAL_ICONS[spec.key];
  const slug = spec.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    <article
      className={`panel metric-card compact-reading vital-card-${severity}`}
      data-testid={`metric-${slug}`}
    >
      <div className="metric-top">
        <div>
          <span>{spec.label}</span>
        </div>
        <span className="metric-icon"><Icon /></span>
      </div>
      <div className="vital-status-row">
        <div className="metric-value">
          {formattedValue} <span className="metric-unit">{spec.unit}</span>
        </div>
        <span className={`vital-zone-pill zone-${severity}`} data-testid={`status-zone-${spec.key}`}>
          {severity === 'red' ? 'RED · DEMO' : severity === 'yellow' ? 'YELLOW · DEMO' : 'NORMAL · DEMO'}
        </span>
      </div>
      {trend && <div className="reading-inline-trend" data-testid={`trend-${spec.key}`}>
        <Sparkline values={trend} label={`${spec.label}: ${days} simulated daily readings in ${spec.unit}; latest ${formattedValue}`} />
        <div className="chart-labels"><span>{days} days · demo</span><span>Now</span></div>
      </div>}
      <details className="reading-controls">
        <summary data-testid={`details-reading-${spec.key}`}>Details &amp; adjust</summary>
        <small className="sensor-origin-line">Simulated {spec.sensorLocation} · {spec.sensorDetail}</small>
        <div className="vital-reason-line">{severity === 'normal' ? 'Within the default demo band' : 'Outside the default demo band'} · not a clinical assessment</div>
      <div className="vital-thresholds-guide">
        <span>Unvalidated example bands:</span>
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
      </details>
    </article>
  );
}

function RadiationSummary({ analysis, acknowledged, trend }: { analysis: RadiationAnalysis; acknowledged: boolean; trend?: RadiationSample[] }) {
  const flagged = analysis.status !== 'baseline';
  const description = describeRadiation(analysis);
  return <section className={`panel radiation-panel ${flagged ? 'radiation-flagged' : ''}`} aria-label="Sample dosimeter" data-testid="card-radiation">
    <div className="radiation-caption"><RadiationIcon size={18} /><strong>{trend ? 'Radiation' : 'Radiation now · Wrist Dosimeter'}</strong><span>Sample</span></div>
    <div className={trend ? 'radiation-with-trend' : undefined}>
    <div>
    <div className={`radiation-value ${description.unknown ? 'reading-unknown' : ''}`} data-testid="value-radiation-rate">{description.value}<span>{description.unit}</span></div>
    <div className="radiation-comparison" data-testid="text-radiation-comparison">{trend && !description.unknown ? 'the usual level' : description.comparison}</div>
    <div className="radiation-state" data-testid="status-radiation">{flagged && <ShieldAlert size={16} />}<strong>{description.status}</strong>{flagged && acknowledged && <span className="radiation-seen">Seen</span>}</div>
    </div>
    {trend && <div className="radiation-inline-trend" data-testid="trend-radiation">
      <Sparkline values={trend.map(sample => sample.doseRate)} label="Radiation: simulated dose rate over the last hour in microsieverts per hour" alert={analysis.status === 'spike'} />
      <div className="chart-labels"><span>1h · µSv/h</span><span>{analysis.doseRate === null ? 'Missing' : 'Now'}</span></div>
    </div>}
    </div>
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
  const samples = getRadiationSamples(demo.scenario);
  const analysis = analyzeRadiation(samples);
  const [period, setPeriod] = useState<7 | 14>(7);
  const isNarrow = useIsMobile();
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

  return <div className="fade-in wrist-overview" data-testid="page-readings-trends">
    <Heading title="Readings" right={<Link href="/alerts" className={`wrist-alert ${pendingCount === 0 ? 'is-reviewed' : ''}`} data-testid="link-alert-status"><Bell size={15} />{pendingCount ? `${pendingCount} demo flags` : 'No demo flags'}</Link>} />

    <Link href="/alerts" className="radiation-open" aria-label="View radiation anomaly details" data-testid="link-radiation-details"><RadiationSummary analysis={analysis} acknowledged={demo.acknowledged} trend={samples} /></Link>
    <section className="mission-context" aria-label="Mission overview" data-testid="section-mission-overview">
      <div className="mission-context-heading"><Orbit size={15} aria-hidden="true" /><strong>Mission overview</strong><span>Day 142</span></div>
      <CompanionPanel />
      <SyncOverview narrow={isNarrow} />
    </section>
    <div className="readings-trend-heading">
      <strong>Readings + trends</strong>
      <div className="period-tabs" role="group" aria-label="Trend period">{([7, 14] as const).map(days => <button key={days} type="button" aria-pressed={period === days} className={period === days ? 'selected' : ''} onClick={() => setPeriod(days)} data-testid={`button-period-${days}`}>{days}d</button>)}</div>
    </div>
    <div className="grid wrist-reading-grid">
      {primaryReadingKeys.map(key => {
        const item = evaluated.items.find(item => item.spec.key === key)!;
        return <VitalSensorCard key={key} item={item} trend={getReadingTrend(key, item.value, period)} days={period} onChange={next => onChangeReadings({ ...readings, [key]: next })} />;
      })}
    </div>
    <details className="secondary-vitals">
      <summary data-testid="button-body-vitals">More readings · {VITAL_SPECS.length - primaryReadingKeys.length}</summary>
      <div className="grid wrist-reading-grid">
        {evaluated.items.filter(item => !primaryReadingKeys.includes(item.spec.key)).map(item => <VitalSensorCard key={item.spec.key} item={item} onChange={next => onChangeReadings({ ...readings, [item.spec.key]: next })} />)}
      </div>
    </details>
    <Link href="/countermeasures" className="cm-entry-link" data-testid="link-countermeasures"><Dumbbell size={16} aria-hidden="true" />Countermeasures · local demo</Link>
    <ReadingsExplained analysis={analysis} />
    <details className="panel sensor-architecture-banner compact-demo-settings" data-testid="banner-sensor-architecture">
      <summary>Demo settings · no connected sensors</summary>
      <div className="sensor-arch-head">
        <span className="sensor-arch-icon"><Watch size={20} /></span>
        <div>
          <strong>Simulated wrist and body readings</strong>
          <p>These readings and trends are local examples, <strong>not measurements from connected devices</strong>. Colors use unvalidated demonstration bands, not medical safety limits.</p>
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
          Load red demo values · silent
        </button>
      </div>
    </details>
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
      <AiFindings />
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
        Simulated wrist &amp; body status · {evaluated.overall === 'red' ? `${evaluated.redItems.length} red examples` : evaluated.overall === 'yellow' ? `${evaluated.yellowItems.length} yellow examples` : reviewed ? 'seen' : '1 demo flag'}
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

  return <MissionSyncProvider><Layout readings={readings} onChangeReadings={setReadings}>
    {reminder.notice && <section className="daily-reminder-notice" role="alert" aria-label="Daily log reminder" data-testid="notice-daily-reminder"><Bell size={19} /><div><strong>Time for your Astronaut’s Log</strong>{reminder.settings.voiceEnabled && reminder.voiceStatus && <p className="short-hint">{reminder.voiceStatus}</p>}<div className="reminder-notice-actions"><Link href="/log" className="btn small" data-testid="link-reminder-log">Open Astronaut’s Log</Link><button className="btn outline small" onClick={reminder.dismiss} data-testid="button-dismiss-reminder">Dismiss</button></div></div></section>}
    <Switch>
      <Route path="/"><Overview readings={readings} onChangeReadings={setReadings} /></Route>
      <Route path="/signals"><Redirect to="/" replace /></Route>
      <Route path="/alerts"><Alerts readings={readings} /></Route>
      <Route path="/countermeasures"><Countermeasures /></Route>
      <Route path="/log"><DailyLog reminder={reminder} /></Route>
      <Route path="/wellbeing"><Redirect to="/log" replace /></Route>
      <Route path="/companion"><Redirect to="/log" replace /></Route>
      <Route component={NotFound} />
    </Switch>
  </Layout></MissionSyncProvider>;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#a893ee',
    colorForeground: '#f4efdf',
    colorMutedForeground: '#bdc8d8',
    colorDanger: '#ed8f79',
    colorBackground: '#151c2e',
    colorInput: '#222d43',
    colorInputForeground: '#f4efdf',
    colorNeutral: '#f4efdf',
    fontFamily: 'Arabic Typesetting, serif',
    borderRadius: '16px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#151c2e] border border-[#46536d] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#f4efdf]',
    headerSubtitle: 'text-[#bdc8d8]',
    socialButtonsBlockButtonText: 'text-[#f4efdf]',
    formFieldLabel: 'text-[#f4efdf]',
    footerActionLink: 'text-[#a893ee]',
    footerActionText: 'text-[#bdc8d8]',
    dividerText: 'text-[#bdc8d8]',
    identityPreviewEditButton: 'text-[#a893ee]',
    formFieldSuccessText: 'text-[#9fcebd]',
    alertText: 'text-[#f4efdf]',
    logoBox: 'rounded-xl',
    logoImage: 'rounded-xl',
    socialButtonsBlockButton: 'border border-[#46536d] bg-[#202a3e]',
    formButtonPrimary: 'bg-[#a893ee] text-[#17172a] hover:bg-[#b6a3f4]',
    formFieldInput: 'border border-[#46536d] bg-[#222d43] text-[#f4efdf]',
    footerAction: 'text-[#bdc8d8]',
    dividerLine: 'bg-[#46536d]',
    alert: 'border border-[#a45f54] bg-[#34242a]',
    otpCodeFieldInput: 'border border-[#46536d] bg-[#222d43] text-[#f4efdf]',
    formFieldRow: 'text-[#f4efdf]',
    main: 'text-[#f4efdf]',
  },
};

function SignInPage() {
  return <div className="clerk-page">
    <p className="clerk-page-label">SPACEHEALTH · PRIVATE FAMILY MESSAGES</p>
    <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
  </div>;
}

function SignUpPage() {
  return <div className="clerk-page">
    <p className="clerk-page-label">SPACEHEALTH · PRIVATE FAMILY MESSAGES</p>
    <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
  </div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkAppRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: { start: { title: 'Welcome back', subtitle: 'Open your private mission inbox.' } },
      signUp: { start: { title: 'Create your account', subtitle: 'Join your astronaut’s private family channel.' } },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <Switch>
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={RoutedApp} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  return <WouterRouter base={basePath}><ClerkAppRoutes /></WouterRouter>;
}

export default App;
