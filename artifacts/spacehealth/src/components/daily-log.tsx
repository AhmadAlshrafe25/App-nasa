import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Volume2 } from 'lucide-react';
import { Link } from 'wouter';
import type { DailyReminderControls } from '@/hooks/use-daily-reminder';
import { appendEntry, hasLogForDay, localDay, logChangedEvent, readEntries, type DailyEntry } from '@/lib/daily-log';

export type DailyReadings = { heartRate: number; sleep: number; activity: number };

export function DailyLog({ reminder, readings }: { reminder: DailyReminderControls; readings: DailyReadings }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [date, setDate] = useState(localDay());
  const [heartRate, setHeartRate] = useState(String(readings.heartRate));
  const [sleepHours, setSleepHours] = useState(readings.sleep.toFixed(1));
  const [activity, setActivity] = useState(String(readings.activity));
  const [mood, setMood] = useState('');
  const [stress, setStress] = useState(4);
  const [radiation, setRadiation] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    const load = () => {
      try { setEntries(readEntries(localStorage)); setLoadError(''); }
      catch { setLoadError('Saved logs could not be read. Existing data has not been changed.'); }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);
  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity() || !mood || loadError) return;
    const entry: DailyEntry = {
      id: crypto.randomUUID(), createdAt: new Date().toISOString(), logDate: date,
      heartRate: Number(heartRate), sleepHours: Number(sleepHours),
      activityMinutes: Number(activity), mood, stress,
      sleep: `${sleepHours} hours`, note: note.trim(),
      ...(radiation !== '' ? { radiationDose: Number(radiation) } : {}),
    };
    try {
      setEntries(appendEntry(localStorage, entry));
      window.dispatchEvent(new Event(logChangedEvent));
      setSaved(true); setSaveError('');
      setHeartRate(''); setSleepHours(''); setActivity(''); setMood('');
      setStress(4); setRadiation(''); setNote('');
    } catch {
      setSaveError('Log not saved. Your entries are still in the form. Check on-device storage access.');
      setSaved(false);
    }
  };
  return <div className="fade-in daily-log">
    <div className="page-heading"><h1>Daily log</h1><span className="log-today">{hasLogForDay(entries, reminder.today) ? 'Logged today' : 'Not logged today'}</span></div>
    <section className="panel log-reading-source" data-testid="summary-pulled-readings">
      <div className="section-head"><h2 className="section-title">From Readings · sample</h2><Link href="/" className="section-link" data-testid="link-edit-readings">Adjust</Link></div>
      <p>Review or edit these values before saving today’s log.</p>
      <div className="log-readings-grid">
        <div className="log-reading-pill" data-testid="log-reading-heart-rate"><span>Heart rate</span><strong>{readings.heartRate} <span>beats/min</span></strong></div>
        <div className="log-reading-pill" data-testid="log-reading-activity"><span>Activity</span><strong>{readings.activity} <span>minutes</span></strong></div>
        <div className="log-reading-pill" data-testid="log-reading-sleep"><span>Sleep</span><strong>{readings.sleep.toFixed(1)} <span>hours</span></strong></div>
      </div>
    </section>
    <details className="panel reminder-settings">
      <summary data-testid="button-reminder-settings"><Bell size={16} /><strong>Daily reminder</strong><span>{reminder.settings.enabled ? reminder.settings.time : 'Off'}</span></summary>
      <div className="reminder-options">
        <label className="toggle-label"><input type="checkbox" checked={reminder.settings.enabled} onChange={e => reminder.update({ enabled: e.target.checked })} data-testid="input-reminder-enabled" />Remind me every day</label>
        <label className="form-label" htmlFor="reminder-time">Time <span className="short-hint">device local time</span></label>
        <input className="log-input" type="time" id="reminder-time" required value={reminder.settings.time} onChange={e => reminder.update({ time: e.target.value })} data-testid="input-reminder-time" />
        <label className="toggle-label"><input type="checkbox" checked={reminder.settings.voiceEnabled} onChange={e => reminder.update({ voiceEnabled: e.target.checked })} data-testid="input-reminder-voice" />Spoken notification</label>
        <button className="btn outline" type="button" onClick={reminder.speak} data-testid="button-test-voice"><Volume2 size={16} />Test voice</button>
        <p className="short-hint">Tap Test voice once to allow audio. Uses an offline device voice if available.</p>
        {reminder.voiceStatus && <p className="short-hint" role="status" data-testid="status-reminder-voice">{reminder.voiceStatus}</p>}
        <button className="btn outline" type="button" onClick={reminder.requestNotifications} data-testid="button-allow-notifications">Allow device notifications</button>
        {reminder.notificationStatus && <p className="short-hint" role="status">{reminder.notificationStatus}</p>}
        <p className="short-hint"><strong>Keep this app open.</strong> Device sleep or browser limits can delay alerts. No reminder after today’s log is saved.</p>
      </div>
    </details>
    {reminder.error && <p className="log-error" role="alert">{reminder.error}</p>}
    <div className="grid overview-bottom log-layout">
      <form className="panel form-panel" onSubmit={save} onChange={() => setSaved(false)} data-testid="form-daily-log">
        <label className="form-label" htmlFor="log-date">Log date</label>
        <input className="log-input" type="date" id="log-date" required max={reminder.today} value={date} onChange={e => setDate(e.target.value)} />
        <div className="log-number-fields">
          <label className="form-label" htmlFor="log-heart-rate">Heart rate <span className="short-hint">beats per minute</span><input className="log-input" id="log-heart-rate" type="number" inputMode="numeric" required min="30" max="220" step="1" value={heartRate} onChange={e => setHeartRate(e.target.value)} data-testid="input-log-heart-rate" /></label>
          <label className="form-label" htmlFor="log-sleep">Sleep <span className="short-hint">hours in past day</span><input className="log-input" id="log-sleep" type="number" inputMode="decimal" required min="0" max="24" step="0.1" value={sleepHours} onChange={e => setSleepHours(e.target.value)} data-testid="input-log-sleep" /></label>
          <label className="form-label" htmlFor="log-activity">Activity <span className="short-hint">minutes in past day</span><input className="log-input" id="log-activity" type="number" inputMode="numeric" required min="0" max="1440" step="1" value={activity} onChange={e => setActivity(e.target.value)} data-testid="input-log-activity" /></label>
        </div>
        <label className="form-label" htmlFor="log-mood">Mood</label>
        <select className="log-input" id="log-mood" required value={mood} onChange={e => setMood(e.target.value)} data-testid="input-log-mood"><option value="">Choose mood</option>{['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(value => <option key={value}>{value}</option>)}</select>
        <label className="form-label" htmlFor="log-stress">Stress <strong>{stress}/10</strong><span className="short-hint">1 low · 10 high</span></label>
        <input id="log-stress" type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} data-testid="input-log-stress" />
        <details className="log-optional"><summary>Radiation & note <span className="short-hint">optional</span></summary>
          <label className="form-label" htmlFor="log-radiation">Radiation dose <span className="short-hint">past 24 hours · microsieverts</span></label>
          <input className="log-input" id="log-radiation" type="number" min="0" max="1000000" step="any" inputMode="decimal" value={radiation} onChange={e => setRadiation(e.target.value)} data-testid="input-log-radiation" />
          <p className="short-hint">Copy the total from your dosimeter, not its hourly rate. Leave blank if unknown. Microsieverts measure radiation dose.</p>
          <label className="form-label" htmlFor="log-note">Note</label>
          <textarea className="text-area" id="log-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} data-testid="input-log-note" />
        </details>
        <div className="checkin-actions"><span className="short-hint">On-device only</span><button className="btn" type="submit" disabled={Boolean(loadError)} data-testid="button-save-log"><Check size={16} />Save log</button></div>
        {saved && <p className="saved-status" role="status" data-testid="status-log-saved">Saved on this device</p>}
        {saveError && <p className="log-error" role="alert" data-testid="status-log-error">{saveError}</p>}
      </form>
      <section className="panel panel-pad" data-testid="section-log-history">
        <div className="section-head"><h2 className="section-title">Past logs</h2><span>{entries.length}</span></div>
        {loadError ? <p className="log-error" role="alert">{loadError}</p> : entries.length === 0 ? <p className="short-hint">No logs yet</p> : <div className="history-list">
          {entries.map(entry => <details className="history-item log-history" key={entry.id} data-testid={`history-log-${entry.id}`}>
            <summary><strong>{entry.logDate || localDay(new Date(entry.createdAt))}</strong><span>{entry.mood} · Stress {entry.stress}/10</span></summary>
            <dl><dt>Sleep</dt><dd>{entry.sleep}</dd>
              {entry.heartRate !== undefined && <><dt>Heart rate</dt><dd>{entry.heartRate} beats/min</dd></>}
              {entry.activityMinutes !== undefined && <><dt>Activity</dt><dd>{entry.activityMinutes} minutes</dd></>}
              <dt>Radiation dose</dt><dd>{entry.radiationDose === undefined ? 'Not logged' : `${entry.radiationDose} microsieverts / 24h`}</dd>
            </dl>
            {entry.note && <p className="history-note">{entry.note}</p>}
          </details>)}
        </div>}
      </section>
    </div>
  </div>;
}
