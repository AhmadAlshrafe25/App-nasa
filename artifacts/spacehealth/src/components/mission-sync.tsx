import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Rocket, Send } from 'lucide-react';
import { getSyncStatus, queueSampleCheckin, syncEarth } from '@/lib/space-api';
import {
  MARS_DELAY_MINUTES, SAMPLE_CHECKIN, queueLocalPacket, syncLocalQueue, syncResultText,
} from '@/lib/space-fallback';

type Source = 'loading' | 'live' | 'local';
type Message = { kind: 'ok' | 'error' | 'info'; text: string };
type Busy = 'sync' | 'sample' | null;

type MissionSync = {
  source: Source;
  pending: number | null;
  delayMinutes: number;
  message: Message | null;
  busy: Busy;
  sync: () => Promise<void>;
  queueSample: () => Promise<void>;
};

const Context = createContext<MissionSync | null>(null);
const REFRESH_MS = 30_000;

export function MissionSyncProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<Source>('loading');
  const [pending, setPending] = useState<number | null>(null);
  const [delayMinutes, setDelayMinutes] = useState(MARS_DELAY_MINUTES);
  const [message, setMessage] = useState<Message | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const localPending = useRef(0);

  const goLocal = useCallback((count: number) => {
    localPending.current = count;
    setSource('local'); setPending(count); setDelayMinutes(MARS_DELAY_MINUTES);
  }, []);

  const refresh = useCallback(async () => {
    const result = await getSyncStatus();
    if (result.status === 'ok') {
      setSource('live'); setPending(result.data.pending_count); setDelayMinutes(result.data.mars_delay_minutes);
    } else if (result.status === 'offline') {
      goLocal(localPending.current);
    }
  }, [goLocal]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const sync = useCallback(async () => {
    setBusy('sync'); setMessage(null);
    const result = await syncEarth();
    if (result.status === 'ok') {
      setSource('live'); setPending(0); setDelayMinutes(result.data.mars_delay_minutes);
      setMessage({ kind: 'ok', text: syncResultText(result.data.synced_count) });
    } else if (result.status === 'error') {
      setMessage({ kind: 'error', text: `Sync failed: ${result.message}` });
    } else {
      const { synced, pending: left } = syncLocalQueue(localPending.current);
      goLocal(left);
      setMessage({ kind: 'info', text: `Local queue · ${syncResultText(synced)}` });
    }
    setBusy(null);
  }, [goLocal]);

  const queueSample = useCallback(async () => {
    setBusy('sample'); setMessage(null);
    const result = await queueSampleCheckin(SAMPLE_CHECKIN);
    if (result.status === 'ok') {
      await refresh();
      setMessage({ kind: 'ok', text: 'Sample packet queued · processed onboard first' });
    } else if (result.status === 'error') {
      setMessage({ kind: 'error', text: `Could not queue: ${result.message}` });
    } else {
      goLocal(queueLocalPacket(localPending.current));
      setMessage({ kind: 'info', text: 'Sample check-in queued.' });
    }
    setBusy(null);
  }, [goLocal, refresh]);

  const value = useMemo(() => ({ source, pending, delayMinutes, message, busy, sync, queueSample }), [source, pending, delayMinutes, message, busy, sync, queueSample]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useMissionSync(): MissionSync {
  const value = useContext(Context);
  if (!value) throw new Error('MissionSyncProvider is missing');
  return value;
}

function SyncReadout({ suffix }: { suffix: string }) {
  const { source, pending, delayMinutes } = useMissionSync();
  const state = pending === null ? 'Checking Earth sync…' : pending > 0 ? 'PENDING_EARTH_SYNC' : 'Queue clear';
  return <div className="sync-readout">
    <span className="sync-count" data-testid={`text-sync-pending${suffix}`}>{pending === null ? '–' : pending} pending</span>
    <span className="sync-state" data-testid={`status-earth-sync${suffix}`}>{pending === null ? state : `${state} · ${delayMinutes}m Mars Delay`}</span>
    {source === 'local' && <span className="sync-source" data-testid={`text-sync-source${suffix}`}>Sample</span>}
  </div>;
}

function SyncMessage({ suffix }: { suffix: string }) {
  const { message } = useMissionSync();
  return <p className={`sync-message sync-message-${message?.kind ?? 'none'}`} role="status" data-testid={`text-sync-message${suffix}`}>{message?.text ?? ''}</p>;
}

function SyncEarthButton({ suffix }: { suffix: string }) {
  const { busy, sync } = useMissionSync();
  return <button type="button" className="sync-btn" disabled={busy !== null} onClick={() => void sync()} data-testid={`button-sync-earth${suffix}`}><RefreshCw size={14} aria-hidden="true" />Sync Earth</button>;
}

/** Compact top-bar indicator for wide screens. */
export function SyncBar() {
  return <div className="sync-bar" aria-label="Earth sync" data-testid="bar-earth-sync">
    <Send size={14} aria-hidden="true" />
    <SyncReadout suffix="" />
    <SyncEarthButton suffix="" />
    <SyncMessage suffix="" />
  </div>;
}

/** Overview controls: the sample-packet button always, plus the full status on narrow screens. */
export function SyncOverview({ narrow }: { narrow: boolean }) {
  const { busy, queueSample } = useMissionSync();
  return <div className="sync-overview" data-testid="panel-sync-overview">
    <div className="care-subhead"><Rocket size={14} aria-hidden="true" /><strong>Earth sync</strong></div>
    {narrow && <div className="sync-row"><SyncReadout suffix="-narrow" /><SyncEarthButton suffix="-narrow" /></div>}
    <div className="sync-row">
      <button type="button" className="care-btn" disabled={busy !== null} onClick={() => void queueSample()} data-testid="button-queue-sample-packet">Queue check-in</button>
      <span className="care-reason">Sample check-in</span>
    </div>
    {narrow && <SyncMessage suffix="-narrow" />}
  </div>;
}
