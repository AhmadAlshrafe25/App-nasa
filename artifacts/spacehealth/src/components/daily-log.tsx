import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { Link } from 'wouter';
import type { DailyReminderControls } from '@/hooks/use-daily-reminder';
import { useVoiceLog } from '@/hooks/use-voice-log';
import {
  appendEntry, createVoiceLogEntry, earthHourLabel, formatAstronautLogHeader, hasLogForDay,
  localDay, logChangedEvent, readEntries, type DailyEntry,
} from '@/lib/daily-log';

export function DailyLog({ reminder }: { reminder: DailyReminderControls }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [mood, setMood] = useState('Good');
  const [stress, setStress] = useState(4);
  const voice = useVoiceLog();
  const date = localDay(now);
  const hour = earthHourLabel(now);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(clock);
  }, []);
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
    if (loadError || !voice.audio || !voice.capturedAt || voice.recording || voice.processing) return;
    try {
      const entry = createVoiceLogEntry({
        id: crypto.randomUUID(), capturedAt: voice.capturedAt, audio: voice.audio,
        duration: voice.seconds, transcript: voice.transcript, mood, stress,
      });
      setEntries(appendEntry(localStorage, entry));
      window.dispatchEvent(new Event(logChangedEvent));
      voice.clear();
      setSaved(true); setSaveError('');
    } catch {
      setSaveError('Log not saved. Your voice recording is still here. Check on-device storage space and try again.');
      setSaved(false);
    }
  };

  return <div className="fade-in daily-log">
    <div className="captain-log-banner" data-testid="banner-astronaut-log">
      <div className="captain-log-top">
        <strong>Astronaut’s Log</strong>
        <span className="captain-stardate" data-testid="text-earth-timestamp">EARTH DAY {date} · HOUR {hour}</span>
      </div>
      <div className="page-heading" style={{ marginBottom: 4 }}>
        <h1>Daily voice log</h1>
        <span className="log-today">{hasLogForDay(entries, reminder.today) ? 'Logged today' : 'Awaiting entry'}</span>
      </div>
      <p className="short-hint" style={{ color: '#dce8ff' }}>Day and time are set automatically from this device when recording starts.</p>
    </div>

    {reminder.notice && <section className="panel reminder-banner" role="status">
      <Bell size={20} /><div><strong>Time for your daily log</strong><p>Record your voice, crew mood, and stress.</p></div>
      <button className="btn outline small" onClick={reminder.dismiss}>Dismiss today</button>
    </section>}

    <section className="panel voice-log-deck" data-testid="section-voice-log">
      <div className="section-head">
        <h2 className="section-title"><Mic size={17} /> Voice log entry</h2>
        {voice.recording && <span className="recording-pill" data-testid="status-voice-recording">● REC {voice.seconds}s</span>}
      </div>
      <p className="short-hint">Your recording is the log entry. A transcript appears only when on-device speech recognition is available. No audio is uploaded.</p>
      <div className="voice-controls-row">
        {voice.recording || voice.pending ? <button type="button" className="btn voice-stop-btn" onClick={voice.stop} data-testid="button-stop-voice-log">
          <Square size={16} />{voice.pending ? 'Cancel microphone request' : `Stop recording (${voice.seconds}s)`}
        </button> : <button type="button" className="btn voice-record-btn" disabled={voice.processing} onClick={() => { setSaved(false); voice.start(); }} data-testid="button-start-voice-log">
          <Mic size={16} />{voice.processing ? 'Preparing recording…' : voice.audio ? 'Record again' : 'Record Astronaut’s Voice Log'}
        </button>}
        {voice.audio && <><audio controls src={voice.audio} className="voice-audio-preview" data-testid="audio-voice-preview" />
          <button type="button" className="btn outline small" onClick={voice.clear} data-testid="button-clear-voice-clip"><Trash2 size={14} />Clear</button></>}
      </div>
      {voice.status && <p className="short-hint" role="status" data-testid="status-voice-log">{voice.status}</p>}
      {voice.capturedAt && voice.audio && <p className="short-hint" data-testid="text-recorded-timestamp">Recorded {localDay(voice.capturedAt)} at {earthHourLabel(voice.capturedAt)} · device local time</p>}
      {voice.transcript && <div className="history-note" data-testid="text-voice-transcript"><strong>On-device transcript</strong><p>{voice.transcript}</p></div>}
    </section>

    <details className="panel reminder-settings">
      <summary data-testid="button-reminder-settings"><Bell size={16} /><strong>Daily log reminder</strong><span>{reminder.settings.enabled ? reminder.settings.time : 'Off'}</span></summary>
      <div className="reminder-options">
        <label className="toggle-label"><input type="checkbox" checked={reminder.settings.enabled} onChange={event => reminder.update({ enabled: event.target.checked })} data-testid="input-reminder-enabled" />Remind me every day</label>
        <label className="form-label" htmlFor="reminder-time">Time <span className="short-hint">device local time</span></label>
        <input className="log-input" type="time" id="reminder-time" required value={reminder.settings.time} onChange={event => reminder.update({ time: event.target.value })} data-testid="input-reminder-time" />
        <label className="toggle-label"><input type="checkbox" checked={reminder.settings.voiceEnabled} onChange={event => reminder.update({ voiceEnabled: event.target.checked })} data-testid="input-reminder-voice" />Spoken notification</label>
        <button className="btn outline" type="button" onClick={reminder.speak} data-testid="button-test-voice"><Volume2 size={16} />Test voice</button>
        {reminder.voiceStatus && <p className="short-hint" role="status">{reminder.voiceStatus}</p>}
        <button className="btn outline" type="button" onClick={reminder.requestNotifications} data-testid="button-allow-notifications">Allow device notifications</button>
        {reminder.notificationStatus && <p className="short-hint" role="status">{reminder.notificationStatus}</p>}
        <p className="short-hint">Keep this app open. Device sleep or browser limits can delay reminders. No reminder after today’s log is saved.</p>
      </div>
    </details>
    {reminder.error && <p className="log-error" role="alert">{reminder.error}</p>}

    <div className="grid log-layout" style={{ gridTemplateColumns: 'minmax(0, 1fr)', gap: 16 }}>
      <form className="panel form-panel" onSubmit={save} onChange={() => setSaved(false)} data-testid="form-daily-log">
        <label className="form-label" htmlFor="log-mood" style={{ marginTop: 0 }}>Crew Mood</label>
        <select className="log-input" id="log-mood" required value={mood} onChange={event => setMood(event.target.value)} data-testid="input-log-mood">
          {['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(value => <option key={value}>{value}</option>)}
        </select>
        <label className="form-label" htmlFor="log-stress">Stress Level <strong>{stress}/10</strong><span className="short-hint">1 low · 10 high</span></label>
        <input id="log-stress" type="range" min="1" max="10" value={stress} onChange={event => setStress(Number(event.target.value))} data-testid="input-log-stress" />
        <div className="checkin-actions">
          <span className="short-hint">{voice.audio ? 'Voice recording ready · saved on this device' : 'Record your voice before saving'}</span>
          <button className="btn" type="submit" disabled={Boolean(loadError) || !voice.audio || voice.recording || voice.pending || voice.processing} data-testid="button-save-log"><Check size={16} />Save voice log</button>
        </div>
        {saved && <p className="saved-status" role="status" data-testid="status-log-saved">Recorded in Astronaut’s Log Archive</p>}
        {saveError && <p className="log-error" role="alert" data-testid="status-log-error">{saveError}</p>}
      </form>

      <section className="panel panel-pad" data-testid="section-log-history">
        <div className="section-head"><h2 className="section-title">Astronaut’s Log Archive</h2><span className="score-label">{entries.length}</span></div>
        {loadError ? <p className="log-error" role="alert">{loadError}</p> : entries.length === 0 ? <p className="short-hint" data-testid="empty-log-history">No Astronaut’s Logs recorded yet</p> : <div className="history-list">
          {entries.map((entry, index) => {
            const day = entry.earthDay || entry.logDate || localDay(new Date(entry.createdAt));
            const hour = entry.earthHour || earthHourLabel(new Date(entry.createdAt));
            return <details className="history-item log-history captain-log-item" key={entry.id} open={index === 0} data-testid={`history-log-${entry.id}`}>
              <summary>
                <strong>{entry.captainHeader || formatAstronautLogHeader(day, hour)}</strong>
                <span>{entry.mood} · Stress {entry.stress}/10</span>
                {entry.voiceAudioDataUrl && <span>{entry.voiceCaptureSource === 'microphone' ? 'Microphone recording' : 'Legacy recording · capture source unverified'}</span>}
                {entry.readingsSource === 'simulated' && <span>Legacy simulated sensor readings</span>}
              </summary>
              {entry.voiceAudioDataUrl && <audio controls src={entry.voiceAudioDataUrl} className="voice-audio-player" data-testid={`audio-log-${entry.id}`} />}
              {entry.note && <p className="history-note captain-entry-text">{entry.note}</p>}
              <p className="short-hint">Earth Day {day} · Hour {hour} · on-device archive</p>
            </details>;
          })}
        </div>}
        <p className="short-hint">Stored only in this browser. Clearing browser data removes the archive.</p>
      </section>
    </div>
    <Link href="/" className="section-link">Back to readings</Link>
  </div>;
}
