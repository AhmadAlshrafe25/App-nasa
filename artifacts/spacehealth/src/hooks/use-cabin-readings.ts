import { useEffect, useState } from 'react';
import {
  CABIN_SPECS, DEFAULT_CABIN_READINGS, cabinChangedEvent, cabinStorageKey, normalizeCabinReadings, parseCabinReadings,
  type CabinKey, type CabinReadings,
} from '@/lib/cabin-readings';

function readState(): { readings: CabinReadings | null; error: string } {
  try { return { readings: parseCabinReadings(localStorage.getItem(cabinStorageKey)), error: '' }; }
  catch (e) { return { readings: null, error: e instanceof Error ? e.message : 'Cabin readings unavailable.' }; }
}

export function useCabinReadings() {
  const [state, setState] = useState(readState);
  useEffect(() => {
    const refresh = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== cabinStorageKey) return;
      setState(readState());
    };
    window.addEventListener('storage', refresh);
    window.addEventListener(cabinChangedEvent, refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener(cabinChangedEvent, refresh);
    };
  }, []);

  const persist = (next: CabinReadings) => {
    const checked = normalizeCabinReadings(next);
    localStorage.setItem(cabinStorageKey, JSON.stringify(checked));
    setState({ readings: checked, error: '' });
    window.dispatchEvent(new Event(cabinChangedEvent));
  };
  const setReading = (key: CabinKey, value: number) => {
    try {
      const spec = CABIN_SPECS.find(item => item.key === key);
      if (!spec || !Number.isFinite(value)) throw new Error('Choose a valid sample value.');
      // Merge against the current stored record, not a stale view from another component or tab.
      const current = parseCabinReadings(localStorage.getItem(cabinStorageKey));
      persist({ ...current, [key]: Math.max(spec.min, Math.min(spec.max, value)) });
    } catch (e) {
      setState(previous => ({ ...previous, error: e instanceof Error ? e.message : 'Cabin sample could not be saved.' }));
    }
  };
  const reset = () => {
    try { persist({ ...DEFAULT_CABIN_READINGS }); }
    catch { setState(previous => ({ ...previous, error: 'Cabin sample could not be saved. Check browser storage.' })); }
  };
  return { ...state, setReading, reset };
}
