import { useState, type FormEvent } from 'react';
import { AlertTriangle, Archive, HardDrive, RotateCcw } from 'lucide-react';
import type { useDeviceJourney } from '@/hooks/use-device-journey';

type Journey = ReturnType<typeof useDeviceJourney>;

/** Loading / error strip. Error blocks recording and saving so existing data is never overwritten. */
export function JourneyStatus({ journey }: { journey: Journey }) {
  if (journey.phase === 'loading') return <p className="dl-hint" role="status" data-testid="status-journey-loading">Opening device storage…</p>;
  if (journey.phase !== 'error') return null;
  return <div className="dl-gate-error" role="alert" data-testid="status-journey-error">
    <AlertTriangle size={18} aria-hidden="true" />
    <p>{journey.error || 'Device storage could not be opened. Saving is paused so nothing is overwritten.'}</p>
    <button type="button" className="dl-btn ghost" onClick={() => { void journey.retry(); }} data-testid="button-journey-retry"><RotateCcw size={16} aria-hidden="true" />Retry</button>
  </div>;
}

/** One-time import of older password-protected logs. Not an access gate. */
export function ProtectedImport({ journey }: { journey: Journey }) {
  const [password, setPassword] = useState('');
  if (!journey.protectedArchive) return null;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (journey.importing || !password) return;
    try { await journey.importProtected(password); setPassword(''); } catch { /* shown via importError */ }
  };
  return <details className="dl-fold dl-import" data-testid="section-import-protected">
    <summary><Archive size={16} aria-hidden="true" />Older protected logs found</summary>
    <form className="dl-fold-body" onSubmit={submit}>
      <p className="dl-hint">Old protected recordings need their old password once. New recordings need no password.</p>
      <label className="dl-field" htmlFor="import-password"><span>Old password</span>
        <input className="log-input" id="import-password" type="password" autoComplete="current-password" required
          value={password} disabled={journey.importing} onChange={e => setPassword(e.target.value)} data-testid="import-password" />
      </label>
      <button type="submit" className="dl-btn" disabled={journey.importing || !password} data-testid="button-import-protected">
        {journey.importing ? 'Importing…' : 'Import older logs'}
      </button>
      {journey.importError && <p className="log-error" role="alert" data-testid="status-import-error">{journey.importError}</p>}
    </form>
  </details>;
}

export function JourneyStorageFooter({ journey }: { journey: Journey }) {
  const p = journey.persistence;
  const status = p === 'granted' ? 'Browser agreed to keep this storage.' : p === 'denied' ? 'Browser declined. Logs may be cleared if space runs low.' : p === 'unsupported' ? 'Not supported in this browser.' : '';
  return <details className="dl-foot">
    <summary><HardDrive size={14} aria-hidden="true" />On this device · no password</summary>
    <p>Anyone who can open this app in this browser can read and play these logs. Nothing is uploaded. Clearing browser data may erase them.</p>
    {p !== 'granted' && p !== 'unsupported' && <button type="button" className="dl-btn ghost" onClick={() => { void journey.requestPersistence(); }} data-testid="button-journey-persist">Keep storage on this device</button>}
    {status && <p role="status" data-testid="status-journey-persistence">{status} Not a guarantee.</p>}
  </details>;
}
