import { useEffect, useState, type FormEvent } from 'react';
import { Bell, Check, Mic, Square, Trash2, Volume2 } from 'lucide-react';
import { Link } from 'wouter';
import './daily-log.css';
import type { DailyReminderControls } from '@/hooks/use-daily-reminder';
import { useVoiceLog } from '@/hooks/use-voice-log';
import { useDeviceJourney } from '@/hooks/use-device-journey';
import { JourneyStatus, JourneyStorageFooter, ProtectedImport } from './device-journey-storage';
import {
  createVoiceLogEntry, earthHourLabel, formatAstronautLogHeader, hasLogForDay,
  localDay,
} from '@/lib/daily-log';

export function DailyLog({ reminder }: { reminder: DailyReminderControls }) {
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [mood, setMood] = useState('Good');
  const [stress, setStress] = useState(4);
  const voice = useVoiceLog();
  const journey = useDeviceJourney();
  const entries = journey.entries;
  const date = localDay(now);
  const hour = earthHourLabel(now);

  useEffect(() => {
    const clock = window.setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(clock);
  }, []);

  const blocked = journey.phase !== 'ready' || journey.saving || journey.importing;
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked || !voice.audio || !voice.capturedAt || voice.recording || voice.processing) return;
    try {
      const entry = createVoiceLogEntry({
        id: crypto.randomUUID(), capturedAt: voice.capturedAt, audio: voice.audio,
        duration: voice.seconds, transcript: voice.transcript, mood, stress,
      });
      await journey.save(entry);
      voice.clear();
      setSaved(true); setSaveError('');
    } catch {
      setSaveError('Log not saved. Your voice recording is still here. Check on-device storage space and try again.');
      setSaved(false);
    }
  };

  const loggedToday = journey.phase === 'ready' && hasLogForDay(entries, reminder.today);
  const busy = voice.recording || voice.pending || voice.processing || blocked;

  return <div className="fade-in daily-log">
    <section className="dl-box" data-testid="section-voice-log" aria-labelledby="dl-title">
      <header className="dl-head" data-testid="banner-astronaut-log">
        <h1 id="dl-title">Daily log</h1>
        <span className={`dl-today ${loggedToday ? 'is-done' : ''}`}>{journey.phase !== 'ready' ? '' : loggedToday ? 'Logged today' : 'Not logged today'}</span>
        <span className="dl-clock" data-testid="text-earth-timestamp">Day {date} · {hour}</span>
      </header>

      {reminder.notice && <div className="dl-notice" role="status">
        <Bell size={18} aria-hidden="true" /><strong>Time for your daily log</strong>
        <button type="button" className="dl-btn ghost" onClick={reminder.dismiss}>Dismiss today</button>
      </div>}
      {reminder.error && <p className="log-error" role="alert">{reminder.error}</p>}
      <JourneyStatus journey={journey} />
      <ProtectedImport journey={journey} />

      <form className="dl-form" onSubmit={save} onChange={() => setSaved(false)} data-testid="form-daily-log">
        <div className="dl-record">
          {voice.recording || voice.pending ? <button type="button" className="dl-btn dl-big is-live" onClick={voice.stop} data-testid="button-stop-voice-log">
            <Square size={20} aria-hidden="true" />{voice.pending ? 'Cancel' : 'Stop'}
          </button> : <button type="button" className="dl-btn dl-big" disabled={voice.processing || blocked} onClick={() => { setSaved(false); voice.start(); }} data-testid="button-start-voice-log">
            <Mic size={20} aria-hidden="true" />{voice.processing ? 'Preparing…' : voice.audio ? 'Record again' : 'Record'}
          </button>}
          {voice.recording && <span className="dl-rec" data-testid="status-voice-recording"><span className="dl-rec-dot" aria-hidden="true" />REC {voice.seconds}s</span>}
          {voice.audio && !(voice.recording || voice.pending || voice.processing) && <div className="dl-clip">
            <audio controls src={voice.audio} className="voice-audio-preview" data-testid="audio-voice-preview" />
            <button type="button" className="dl-btn ghost" onClick={voice.clear} disabled={blocked} aria-label="Clear recording" data-testid="button-clear-voice-clip"><Trash2 size={16} aria-hidden="true" />Clear</button>
          </div>}
        </div>
        {voice.status && <p className="dl-hint" role="status" data-testid="status-voice-log">{voice.status}</p>}
        {voice.capturedAt && voice.audio && <p className="dl-hint" data-testid="text-recorded-timestamp">Recorded {localDay(voice.capturedAt)} · {earthHourLabel(voice.capturedAt)}</p>}
        {voice.transcript && <p className="dl-transcript" dir="auto" data-testid="text-voice-transcript">{voice.transcript}</p>}

        <div className="dl-row">
          <label className="dl-field" htmlFor="log-mood"><span>Mood</span>
            <select className="log-input" id="log-mood" required value={mood} onChange={event => setMood(event.target.value)} data-testid="input-log-mood">
              {['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(value => <option key={value}>{value}</option>)}
            </select>
          </label>
          <label className="dl-field dl-stress" htmlFor="log-stress"><span>Stress <strong>{stress}/10</strong></span>
            <input id="log-stress" type="range" min="1" max="10" value={stress} aria-valuetext={`${stress} of 10, 1 low, 10 high`} onChange={event => setStress(Number(event.target.value))} data-testid="input-log-stress" />
          </label>
        </div>

        <button className="dl-btn dl-big dl-save" type="submit" disabled={!voice.audio || busy} data-testid="button-save-log"><Check size={20} aria-hidden="true" />Save log</button>
        {!voice.audio && !busy && <p className="dl-hint">Record first, then save.</p>}
        {journey.saving && <p className="dl-hint" role="status">Saving…</p>}
        {saved && <p className="saved-status dl-saved" role="status" data-testid="status-log-saved"><Check size={16} aria-hidden="true" />Saved</p>}
        {saveError && <p className="log-error" role="alert" data-testid="status-log-error">{saveError}</p>}
      </form>

      <details className="dl-fold">
        <summary data-testid="button-reminder-settings"><Bell size={16} aria-hidden="true" />Reminder<span>{reminder.settings.enabled ? reminder.settings.time : 'Off'}</span></summary>
        <div className="dl-fold-body">
          <label className="toggle-label"><input type="checkbox" checked={reminder.settings.enabled} onChange={event => reminder.update({ enabled: event.target.checked })} data-testid="input-reminder-enabled" />Every day</label>
          <label className="dl-field" htmlFor="reminder-time"><span>Time</span>
            <input className="log-input" type="time" id="reminder-time" required value={reminder.settings.time} onChange={event => reminder.update({ time: event.target.value })} data-testid="input-reminder-time" />
          </label>
          <label className="toggle-label"><input type="checkbox" checked={reminder.settings.voiceEnabled} onChange={event => reminder.update({ voiceEnabled: event.target.checked })} data-testid="input-reminder-voice" />Spoken</label>
          <div className="dl-inline">
            <button className="dl-btn ghost" type="button" onClick={reminder.speak} data-testid="button-test-voice"><Volume2 size={16} aria-hidden="true" />Test voice</button>
            <button className="dl-btn ghost" type="button" onClick={reminder.requestNotifications} data-testid="button-allow-notifications">Allow notifications</button>
          </div>
          {reminder.voiceStatus && <p className="dl-hint" role="status">{reminder.voiceStatus}</p>}
          {reminder.notificationStatus && <p className="dl-hint" role="status">{reminder.notificationStatus}</p>}
          <p className="dl-hint">Keep the app open. Sleep or browser limits can delay it. Skipped once today is logged.</p>
        </div>
      </details>

      <details className="dl-fold" data-testid="section-log-history">
        <summary>Past logs<span className="score-label">{entries.length}</span></summary>
        <div className="dl-fold-body">
          {entries.length === 0 ? <p className="dl-hint" data-testid="empty-log-history">No logs yet</p> : <div className="dl-list">
            {entries.map(entry => {
              const day = entry.earthDay || entry.logDate || localDay(new Date(entry.createdAt));
              const hour = entry.earthHour || earthHourLabel(new Date(entry.createdAt));
              return <details className="dl-entry log-history" key={entry.id} data-testid={`history-log-${entry.id}`}>
                <summary>
                  <strong>{entry.captainHeader || formatAstronautLogHeader(day, hour)}</strong>
                  <span>{entry.mood} · Stress {entry.stress}/10</span>
                  {entry.voiceAudioDataUrl && entry.voiceCaptureSource !== 'microphone' && <span>Legacy recording · source unverified</span>}
                  {entry.readingsSource === 'simulated' && <span>Sample readings</span>}
                </summary>
                {entry.voiceAudioDataUrl && <audio controls src={entry.voiceAudioDataUrl} className="voice-audio-player" data-testid={`audio-log-${entry.id}`} />}
                {entry.note && <p className="dl-transcript" dir="auto">{entry.note}</p>}
                <p className="dl-hint">Day {day} · {hour}</p>
              </details>;
            })}
          </div>}
        </div>
      </details>

      <JourneyStorageFooter journey={journey} />
    </section>
    <Link href="/" className="section-link">Back to readings</Link>
  </div>;
}
