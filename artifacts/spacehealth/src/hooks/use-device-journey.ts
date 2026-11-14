import { useCallback, useEffect, useRef, useState } from 'react';
import { hasLogForDay, localDay, logChangedEvent, logDayMarkerKey, type DailyEntry } from '@/lib/daily-log';
import { hasProtectedJourney, importProtectedJourney, loadDeviceJourney, saveJourneyEntry } from '@/lib/device-journey';

export function useDeviceJourney() {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [error, setError] = useState('');
  const [importError, setImportError] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [protectedArchive, setProtectedArchive] = useState(false);
  const [persistence, setPersistence] = useState<'unknown' | 'granted' | 'denied' | 'unsupported'>('unknown');
  const mounted = useRef(true);
  const busy = useRef(false);
  const loading = useRef(false);
  const revision = useRef(0);

  const markDay = (loaded: DailyEntry[]) => {
    if (hasLogForDay(loaded, localDay())) {
      try { localStorage.setItem(logDayMarkerKey, localDay()); } catch { /* optional reminder hint */ }
    }
  };
  const refresh = useCallback(async () => {
    if (loading.current || busy.current) return;
    loading.current = true;
    const currentRevision = ++revision.current;
    try {
      const loaded = await loadDeviceJourney();
      markDay(loaded);
      if (mounted.current && currentRevision === revision.current) { setEntries(loaded); setError(''); setPhase('ready'); }
      try { const found = await hasProtectedJourney(); if (mounted.current && currentRevision === revision.current) setProtectedArchive(found); }
      catch { if (mounted.current && currentRevision === revision.current) setImportError('Older protected logs could not be checked. They have not been removed.'); }
    } catch (e) {
      if (mounted.current && currentRevision === revision.current) { setError(e instanceof Error ? e.message : 'Device storage could not be read.'); setPhase('error'); }
    } finally { loading.current = false; }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    if (navigator.storage?.persisted) void navigator.storage.persisted().then(granted => {
      if (mounted.current && granted) setPersistence('granted');
    }).catch(() => undefined);
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('spacehealth-journey') : null;
    if (channel) channel.onmessage = () => void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('storage', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      mounted.current = false;
      channel?.close();
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [refresh]);

  const announce = (loaded: DailyEntry[]) => {
    markDay(loaded);
    window.dispatchEvent(new Event(logChangedEvent));
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('spacehealth-journey') : null;
    channel?.postMessage('changed'); channel?.close();
  };
  const save = async (entry: DailyEntry) => {
    if (busy.current || phase !== 'ready') throw new Error('Device storage is not ready.');
    busy.current = true; revision.current++; setSaving(true);
    try {
      const loaded = await saveJourneyEntry(entry);
      if (mounted.current) { setEntries(loaded); setError(''); }
      announce(loaded);
    } finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const importProtected = async (password: string) => {
    if (busy.current || phase !== 'ready') throw new Error('Wait for device storage to be ready.');
    busy.current = true; revision.current++; setImporting(true); setImportError('');
    try {
      const loaded = await importProtectedJourney(password);
      if (mounted.current) { setEntries(loaded); setProtectedArchive(false); }
      announce(loaded);
    } catch (e) {
      if (mounted.current) setImportError(e instanceof Error ? e.message : 'Older recordings could not be imported. Originals were kept.');
      throw e;
    } finally { busy.current = false; if (mounted.current) setImporting(false); }
  };
  const requestPersistence = async () => {
    if (!navigator.storage?.persist) { setPersistence('unsupported'); return; }
    try { setPersistence(await navigator.storage.persist() ? 'granted' : 'denied'); }
    catch { setPersistence('denied'); }
  };
  return { phase, entries, error, saving, importing, protectedArchive, importError, persistence, save, importProtected, requestPersistence, retry: refresh };
}
