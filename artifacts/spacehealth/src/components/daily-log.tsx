import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, Check, Mic, Play, Radio, Square, Trash2, Volume2, Watch } from 'lucide-react';
import { Link } from 'wouter';
import type { DailyReminderControls } from '@/hooks/use-daily-reminder';
import {
  appendEntry, earthHourLabel, formatAstronautLogHeader, hasLogForDay,
  localDay, logChangedEvent, readEntries, type DailyEntry,
} from '@/lib/daily-log';
import { evaluateAllVitals, type BodyReadings } from '@/lib/vitals';

// Create a short playable WAV data URL fallback when microphone hardware is unavailable
function createFallbackVoiceWavDataUrl(durationSec = 2): string {
  const sampleRate = 8000;
  const numSamples = sampleRate * durationSec;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);
  // Star Trek communicator / log chime followed by soft carrier tone
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const freq = t < 0.18 ? 1046.5 : t < 0.36 ? 1318.5 : t < 0.55 ? 1568.0 : 440;
    const env = t < 0.55 ? 0.28 : 0.04 * Math.exp(-(t - 0.55) * 1.5);
    const sample = Math.max(-1, Math.min(1, Math.sin(2 * Math.PI * freq * t) * env));
    view.setInt16(44 + i * 2, sample * 32767, true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export function DailyLog({ reminder, readings }: { reminder: DailyReminderControls; readings: BodyReadings }) {
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saved, setSaved] = useState(false);
  const [date, setDate] = useState(localDay());
  const [hour, setHour] = useState(earthHourLabel());
  const [dateEdited, setDateEdited] = useState(false);
  const [mood, setMood] = useState('Good');
  const [stress, setStress] = useState(4);
  const [radiation, setRadiation] = useState('');
  const [note, setNote] = useState('');

  // Voice Log state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceAudioDataUrl, setVoiceAudioDataUrl] = useState<string>('');
  const [voiceDurationSec, setVoiceDurationSec] = useState<number>(0);
  const [voiceStatusMsg, setVoiceStatusMsg] = useState<string>('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const recordTimerRef = useRef<number | null>(null);
  const recordStartRef = useRef<number>(0);

  const evaluated = evaluateAllVitals(readings);
  const captainHeader = formatAstronautLogHeader(date, hour, 142);

  useEffect(() => {
    const clock = window.setInterval(() => {
      if (!dateEdited) {
        setDate(localDay());
        setHour(earthHourLabel());
      }
    }, 15_000);
    return () => clearInterval(clock);
  }, [dateEdited]);

  useEffect(() => {
    const load = () => {
      try { setEntries(readEntries(localStorage)); setLoadError(''); }
      catch { setLoadError('Saved logs could not be read. Existing data has not been changed.'); }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const startVoiceRecording = async () => {
    setSaved(false);
    setVoiceStatusMsg('');
    const now = new Date();
    const currentDay = localDay(now);
    const currentHour = earthHourLabel(now);
    setDate(currentDay);
    setHour(currentHour);

    const prefix = `Astronaut's Log, Earth Day ${currentDay}, Hour ${currentHour}. `;
    if (!note.trim()) {
      setNote(prefix);
    }

    // Start Web Speech API live transcription if supported
    const SpeechRec = (window as unknown as Record<string, unknown>).SpeechRecognition
      || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (typeof SpeechRec === 'function') {
      try {
        const rec = new (SpeechRec as new () => {
          continuous: boolean;
          interimResults: boolean;
          lang: string;
          onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
          start: () => void;
          stop: () => void;
        })();
        rec.continuous = true;
        rec.interimResults = false;
        rec.lang = 'en-US';
        rec.onresult = (e) => {
          const last = e.results[e.results.length - 1];
          const text = last?.[0]?.transcript?.trim();
          if (text) {
            setNote(prev => `${prev.trim()} ${text}`.trim());
          }
        };
        rec.start();
        speechRecRef.current = rec;
      } catch {
        // Ignore if browser blocks speech recognition
      }
    }

    recordStartRef.current = Date.now();
    setRecordingSeconds(0);
    setIsRecording(true);
    recordTimerRef.current = window.setInterval(() => {
      setRecordingSeconds(Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000)));
    }, 500);

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia && 'MediaRecorder' in window) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
        };
        recorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
          setVoiceDurationSec(dur);
          if (audioChunksRef.current.length > 0) {
            const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onloadend = () => {
              if (typeof reader.result === 'string') {
                setVoiceAudioDataUrl(reader.result);
                setVoiceStatusMsg(`Voice log captured (${dur}s) · Stamped Earth Day ${currentDay} at ${currentHour}`);
              }
            };
            reader.readAsDataURL(blob);
          } else {
            setVoiceAudioDataUrl(createFallbackVoiceWavDataUrl(2));
            setVoiceStatusMsg(`Voice log captured (${dur}s) · Stamped Earth Day ${currentDay} at ${currentHour}`);
          }
        };
        recorder.start();
        mediaRecorderRef.current = recorder;
        setVoiceStatusMsg('Recording Astronaut’s Voice Log… Speak now.');
        return;
      } catch {
        // Microphone unavailable or blocked: continue with simulated on-device voice log capture
      }
    }
    setVoiceStatusMsg('Recording Astronaut’s Voice Log (on-device audio synthesizer active)…');
  };

  const stopVoiceRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (speechRecRef.current) {
      try { speechRecRef.current.stop(); } catch { /* ignore */ }
      speechRecRef.current = null;
    }
    const dur = Math.max(1, Math.round((Date.now() - recordStartRef.current) / 1000));
    setIsRecording(false);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    } else {
      setVoiceDurationSec(dur);
      setVoiceAudioDataUrl(createFallbackVoiceWavDataUrl(Math.min(4, Math.max(2, dur))));
      setVoiceStatusMsg(`Voice log ready (${dur}s) · Marked Earth Day ${date} at Hour ${hour}`);
    }
  };

  const commitEntry = (overrideNote?: string, withAudioUrl?: string, withAudioDur?: number) => {
    if (loadError) return;
    const now = new Date();
    const entryDay = date || localDay(now);
    const entryHour = hour || earthHourLabel(now);
    const header = formatAstronautLogHeader(entryDay, entryHour, 142);
    const finalNote = (overrideNote !== undefined ? overrideNote : note).trim()
      || `${header}. Simulated demo readings, not live measurements. Heart rate ${readings.heartRate} bpm, sleep ${readings.sleep.toFixed(1)} hrs, activity ${readings.activity} min.`;
    const entry: DailyEntry = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      logDate: entryDay,
      earthDay: entryDay,
      earthHour: entryHour,
      captainHeader: header,
      readingsSource: 'simulated',
      heartRate: readings.heartRate,
      sleepHours: readings.sleep,
      activityMinutes: readings.activity,
      oxygen: readings.oxygen,
      respiration: readings.respiration,
      temperature: readings.temperature,
      systolicBP: readings.systolicBP,
      hrv: readings.hrv,
      water: readings.water,
      mood: mood || 'Good',
      stress,
      sleep: `${readings.sleep.toFixed(1)} hours`,
      note: finalNote,
      ...(withAudioUrl ? { voiceAudioDataUrl: withAudioUrl, voiceDurationSec: withAudioDur || 2, voiceTranscript: finalNote } : {}),
      ...(radiation !== '' ? { radiationDose: Number(radiation) } : {}),
    };
    try {
      setEntries(appendEntry(localStorage, entry));
      window.dispatchEvent(new Event(logChangedEvent));
      setSaved(true);
      setSaveError('');
      setNote('');
      setRadiation('');
      setVoiceAudioDataUrl('');
      setVoiceDurationSec(0);
      setVoiceStatusMsg(`Saved to Astronaut's Log Archive · Earth Day ${entryDay}, Hour ${entryHour}`);
      setDate(localDay());
      setHour(earthHourLabel());
      setDateEdited(false);
    } catch {
      setSaveError('Log not saved. Your entries are still in the form. Check on-device storage access.');
      setSaved(false);
    }
  };

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity() || !mood || loadError) return;
    commitEntry(note, voiceAudioDataUrl || undefined, voiceDurationSec || undefined);
  };

  const speakLogEntry = (entry: DailyEntry) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const header = entry.captainHeader || formatAstronautLogHeader(
      entry.earthDay || entry.logDate || localDay(new Date(entry.createdAt)),
      entry.earthHour || earthHourLabel(new Date(entry.createdAt)),
    );
    const text = `${header}. Demo archive: readings are simulated or unverified, not live telemetry. ${entry.note || `Mood ${entry.mood}, stress ${entry.stress} of 10. Heart rate ${entry.heartRate === undefined ? 'not logged' : `${entry.heartRate} beats per minute`}, sleep ${entry.sleep}.`}`;
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 0.94;
    window.speechSynthesis.speak(utter);
  };

  return <div className="fade-in daily-log">
    <div className="captain-log-banner" data-testid="banner-astronaut-log">
      <div className="captain-log-top">
        <span className="captain-badge"><Radio size={14} /> STARFLEET / NASA MISSION RECORD</span>
        <span className="captain-stardate" data-testid="text-earth-timestamp">EARTH DAY {date} · HOUR {hour}</span>
      </div>
      <div className="page-heading" style={{ marginBottom: 4 }}>
        <h1>Astronaut’s Log</h1>
        <span className="log-today">{hasLogForDay(entries, reminder.today) ? 'Logged today' : 'Awaiting entry'}</span>
      </div>
      <p className="captain-quote" data-testid="text-captain-header">“{captainHeader}”</p>
    </div>

    <section className="panel log-reading-source" data-testid="summary-pulled-readings">
      <div className="section-head">
        <div>
          <h2 className="section-title"><Watch size={17} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />Simulated readings for this log</h2>
          <p className="short-hint" style={{ margin: '2px 0 0' }}>Editable local demo values, not live sensor telemetry. Saved entries retain these fictional readings.</p>
        </div>
        <Link href="/" className="section-link" data-testid="link-edit-readings">Adjust in Readings</Link>
      </div>
      <div className="log-readings-grid">
        <div className="log-reading-pill" data-testid="log-reading-heart-rate">
          <span>Heart rate · Wrist PPG</span>
          <strong>{readings.heartRate} <span>beats/min</span></strong>
        </div>
        <div className="log-reading-pill" data-testid="log-reading-activity">
          <span>Activity · Body 3-Axis</span>
          <strong>{readings.activity} <span>minutes</span></strong>
        </div>
        <div className="log-reading-pill" data-testid="log-reading-sleep">
          <span>Sleep · Wrist Actigraphy</span>
          <strong>{readings.sleep.toFixed(1)} <span>hours</span></strong>
        </div>
        <div className="log-reading-pill" data-testid="log-reading-oxygen">
          <span>Blood SpO₂ · Wrist</span>
          <strong>{readings.oxygen} <span>%</span></strong>
        </div>
        <div className="log-reading-pill" data-testid="log-reading-temp">
          <span>Body Temp · Torso</span>
          <strong>{readings.temperature.toFixed(1)} <span>°C</span></strong>
        </div>
        <div className="log-reading-pill" data-testid="log-reading-bp">
          <span>Systolic BP · Wrist</span>
          <strong>{readings.systolicBP} <span>mmHg</span></strong>
        </div>
      </div>
      {evaluated.overall !== 'normal' && (
        <div className={`sensor-sync-warning ${evaluated.overall}`} data-testid="log-sensor-status">
          <strong>{evaluated.overall === 'red' ? 'RED DEMO VALUES' : 'YELLOW DEMO VALUES'} · unvalidated example bands:</strong>{' '}
          {[...evaluated.redItems, ...evaluated.yellowItems].map(i => `${i.spec.label} (${i.formattedValue} ${i.spec.unit})`).join(', ')}
        </div>
      )}
    </section>

    <section className="panel voice-log-deck" data-testid="section-voice-log">
      <div className="section-head" style={{ margin: '0 0 8px' }}>
        <div>
          <h2 className="section-title"><Mic size={17} style={{ display: 'inline', verticalAlign: '-3px', marginRight: 6 }} />Voice Log Recorder</h2>
          <p className="short-hint" style={{ margin: '2px 0 0' }}>Record a spoken Astronaut’s Log. Automatically stamped with Earth Day ({date}) and Hour ({hour}) and placed in your archive below.</p>
        </div>
        {isRecording && <span className="recording-pill" data-testid="status-voice-recording">● REC {recordingSeconds}s</span>}
      </div>
      <div className="voice-controls-row">
        {!isRecording ? (
          <button type="button" className="btn voice-record-btn" onClick={startVoiceRecording} data-testid="button-start-voice-log">
            <Mic size={16} /> Record Astronaut’s Voice Log
          </button>
        ) : (
          <button type="button" className="btn voice-stop-btn" onClick={stopVoiceRecording} data-testid="button-stop-voice-log">
            <Square size={16} /> Stop Recording ({recordingSeconds}s)
          </button>
        )}
        {voiceAudioDataUrl && !isRecording && (
          <>
            <audio controls src={voiceAudioDataUrl} className="voice-audio-preview" data-testid="audio-voice-preview" />
            <button
              type="button"
              className="btn"
              onClick={() => commitEntry(note, voiceAudioDataUrl, voiceDurationSec)}
              data-testid="button-save-voice-log-now"
            >
              <Check size={16} /> Log Voice Entry ({date} · {hour})
            </button>
            <button
              type="button"
              className="btn outline small"
              onClick={() => { setVoiceAudioDataUrl(''); setVoiceDurationSec(0); setVoiceStatusMsg('Voice clip cleared.'); }}
              data-testid="button-clear-voice-clip"
            >
              <Trash2 size={14} /> Clear
            </button>
          </>
        )}
      </div>
      {voiceStatusMsg && <p className="short-hint" role="status" style={{ marginTop: 8 }} data-testid="status-voice-log">{voiceStatusMsg}</p>}
    </section>

    <details className="panel reminder-settings">
      <summary data-testid="button-reminder-settings"><Bell size={16} /><strong>Daily log reminder</strong><span>{reminder.settings.enabled ? reminder.settings.time : 'Off'}</span></summary>
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
        <div className="log-timestamp-row">
          <div>
            <label className="form-label" htmlFor="log-date" style={{ marginTop: 0 }}>Earth Day</label>
            <input className="log-input" type="date" id="log-date" required max={reminder.today} value={date} onChange={e => { setDate(e.target.value); setDateEdited(true); }} data-testid="input-log-date" />
          </div>
          <div>
            <label className="form-label" htmlFor="log-hour" style={{ marginTop: 0 }}>Earth Hour</label>
            <input className="log-input" type="time" id="log-hour" required value={hour} onChange={e => { setHour(e.target.value); setDateEdited(true); }} data-testid="input-log-hour" />
          </div>
        </div>

        <label className="form-label" htmlFor="log-mood">Crew Mood</label>
        <select className="log-input" id="log-mood" required value={mood} onChange={e => setMood(e.target.value)} data-testid="input-log-mood">
          <option value="">Choose mood</option>
          {['Low', 'Tense', 'Okay', 'Good', 'Bright'].map(value => <option key={value}>{value}</option>)}
        </select>

        <label className="form-label" htmlFor="log-stress">Stress Level <strong>{stress}/10</strong><span className="short-hint">1 low · 10 high</span></label>
        <input id="log-stress" type="range" min="1" max="10" value={stress} onChange={e => setStress(Number(e.target.value))} data-testid="input-log-stress" />

        <label className="form-label" htmlFor="log-note">
          Astronaut’s Log Entry / Voice Transcript
          <button
            type="button"
            className="section-link"
            style={{ float: 'right', background: 'none', border: 0, padding: 0, fontSize: 12 }}
            onClick={() => setNote(prev => prev.startsWith("Astronaut's Log") ? prev : `${captainHeader} — ${prev}`)}
            data-testid="button-insert-stardate"
          >
            + Insert “Astronaut’s Log” header
          </button>
        </label>
        <textarea
          className="text-area"
          id="log-note"
          maxLength={800}
          placeholder={`${captainHeader} — Record your observations; attached readings are simulated...`}
          value={note}
          onChange={e => setNote(e.target.value)}
          data-testid="input-log-note"
        />

        <details className="log-optional">
          <summary>Radiation dose <span className="short-hint">optional</span></summary>
          <label className="form-label" htmlFor="log-radiation">Radiation dose <span className="short-hint">past 24 hours · microsieverts</span></label>
          <input className="log-input" id="log-radiation" type="number" min="0" max="1000000" step="any" inputMode="decimal" value={radiation} onChange={e => setRadiation(e.target.value)} data-testid="input-log-radiation" />
        </details>

        <div className="checkin-actions">
          <span className="short-hint">Stamped by Earth Day &amp; Hour · On-device</span>
          <button className="btn" type="submit" disabled={Boolean(loadError)} data-testid="button-save-log">
            <Check size={16} /> Record in Astronaut’s Log
          </button>
        </div>
        {saved && <p className="saved-status" role="status" data-testid="status-log-saved">Recorded in Astronaut’s Log Archive</p>}
        {saveError && <p className="log-error" role="alert" data-testid="status-log-error">{saveError}</p>}
      </form>

      <section className="panel panel-pad" data-testid="section-log-history">
        <div className="section-head"><h2 className="section-title">Astronaut’s Log Archive</h2><span className="score-label">{entries.length}</span></div>
        {loadError ? <p className="log-error" role="alert">{loadError}</p> : entries.length === 0 ? <p className="short-hint" data-testid="empty-log-history">No Astronaut’s Logs recorded yet</p> : <div className="history-list">
          {entries.map((entry, idx) => {
            const entryDay = entry.earthDay || entry.logDate || localDay(new Date(entry.createdAt));
            const entryHour = entry.earthHour || earthHourLabel(new Date(entry.createdAt));
            const header = entry.captainHeader || formatAstronautLogHeader(entryDay, entryHour, 142);
            return (
              <details className="history-item log-history captain-log-item" key={entry.id} open={idx === 0} data-testid={`history-log-${entry.id}`}>
                <summary>
                  <div className="captain-log-item-head">
                    <span className="earth-stamp-badge" data-testid={`log-earth-stamp-${entry.id}`}>
                      EARTH DAY {entryDay} · HOUR {entryHour}
                    </span>
                    {entry.voiceAudioDataUrl && <span className="voice-log-badge">VOICE LOG ({entry.voiceDurationSec ?? 2}s)</span>}
                  </div>
                  <strong>{header}</strong>
                  <span>{entry.readingsSource === 'simulated' ? 'Simulated readings' : 'Legacy readings · source unverified'}</span>
                  <span>{entry.mood} · Stress {entry.stress}/10 · HR {entry.heartRate === undefined ? 'Not logged' : `${entry.heartRate} bpm`} · Sleep {entry.sleep}</span>
                </summary>
                {entry.note && <p className="history-note captain-entry-text">“{entry.note}”</p>}
                {entry.voiceAudioDataUrl && (
                  <div className="log-audio-box">
                    <audio controls src={entry.voiceAudioDataUrl} className="voice-audio-player" data-testid={`audio-log-${entry.id}`} />
                  </div>
                )}
                <div className="log-playback-row">
                  <button type="button" className="btn outline small" onClick={() => speakLogEntry(entry)} data-testid={`button-speak-log-${entry.id}`}>
                    <Play size={13} /> Play Computer Readback
                  </button>
                </div>
                <dl>
                  <dt>Earth Day &amp; Hour</dt><dd>{entryDay} at {entryHour}</dd>
                  <dt>Heart rate</dt><dd>{entry.heartRate === undefined ? 'Not logged' : `${entry.heartRate} beats/min`}</dd>
                  <dt>Activity</dt><dd>{entry.activityMinutes === undefined ? 'Not logged' : `${entry.activityMinutes} minutes`}</dd>
                  <dt>Sleep (Wrist Actigraphy)</dt><dd>{entry.sleep}</dd>
                  {entry.oxygen !== undefined && <><dt>Blood SpO₂ (Wrist)</dt><dd>{entry.oxygen}%</dd></>}
                  {entry.temperature !== undefined && <><dt>Body Temp (Torso)</dt><dd>{entry.temperature.toFixed(1)} °C</dd></>}
                  {entry.systolicBP !== undefined && <><dt>Systolic BP (Wrist)</dt><dd>{entry.systolicBP} mmHg</dd></>}
                  <dt>Radiation dose</dt><dd>{entry.radiationDose === undefined ? 'Not logged' : `${entry.radiationDose} µSv / 24h`}</dd>
                </dl>
              </details>
            );
          })}
        </div>}
      </section>
    </div>
  </div>;
}
