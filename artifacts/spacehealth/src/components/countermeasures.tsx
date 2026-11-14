import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowLeft, Check, Dumbbell, Volume2 } from 'lucide-react';
import {
  axialLoadingScore, countermeasureStorageKey, emptyCountermeasureState, getExampleAlert,
  getExampleTrends, normalizeCountermeasureState, validateWorkout,
  type CountermeasureState,
} from '@/lib/countermeasures';
import { SOUNDSCAPE_DISCLAIMER, startSoundscape, type SoundscapeHandle } from '@/lib/soundscape';
import './countermeasures.css';

const LIMIT = 50;
type Scenario = CountermeasureState['scenario'];
const scenarios: { value: Scenario; label: string }[] = [
  { value: 'example', label: 'Example' },
  { value: 'low', label: 'Low workload' },
  { value: 'missing', label: 'Missing data' },
];

function loadState(): { state: CountermeasureState; error: string | null; blocked: boolean } {
  let raw: string | null;
  try { raw = localStorage.getItem(countermeasureStorageKey); }
  catch { return { state: emptyCountermeasureState, error: 'Local storage is unreadable. Saving is blocked so existing data is not overwritten.', blocked: true }; }
  if (raw === null) return { state: emptyCountermeasureState, error: null, blocked: false };
  try { return { state: normalizeCountermeasureState(JSON.parse(raw)), error: null, blocked: false }; }
  catch (error) {
    return { state: emptyCountermeasureState, error: `Saved countermeasure data is invalid${error instanceof Error && error.message ? ` (${error.message})` : ''}. Saving is blocked so it is not overwritten; values shown as unavailable.`, blocked: true };
  }
}

function persist(next: CountermeasureState): string | null {
  try {
    localStorage.setItem(countermeasureStorageKey, JSON.stringify(next));
    return null;
  } catch (error) {
    return `Not saved: local storage failed${error instanceof Error && error.message ? ` (${error.message})` : ''}. Your draft is kept.`;
  }
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'Unknown time' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const fmtPct = (v: number | null | undefined) => v === null || v === undefined || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(1)}%`;
const latest = (values: (number | null)[]) => values.length ? values[values.length - 1] : null;

export function Countermeasures() {
  const [initial] = useState(loadState);
  const [state, setState] = useState<CountermeasureState>(initial.state);
  const [draft, setDraft] = useState({ loadKg: '', repetitions: '', sets: '' });
  const [formError, setFormError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(initial.error);
  const [status, setStatus] = useState<string | null>(null);
  const [audio, setAudio] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const tone = useRef<SoundscapeHandle | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; tone.current?.stop(); tone.current = null; };
  }, []);

  const toggleAudio = async () => {
    if (tone.current) {
      tone.current.stop(); tone.current = null;
      setPlaying(false); setAudio(`Stopped. ${SOUNDSCAPE_DISCLAIMER}`);
      return;
    }
    if (pending.current) return;
    pending.current = true;
    try {
      const handle = await startSoundscape(() => {
        tone.current = null;
        if (mounted.current) { setPlaying(false); setAudio(`Finished. ${SOUNDSCAPE_DISCLAIMER}`); }
      });
      if (!mounted.current) { handle.stop(); return; }
      tone.current = handle;
      setPlaying(true); setAudio(`Playing a calm 4-second tone (432 Hz and 528 Hz). ${SOUNDSCAPE_DISCLAIMER}`);
    } catch (error) {
      setPlaying(false);
      if (mounted.current) setAudio(`${error instanceof Error ? error.message : 'Audio could not start. Nothing is playing.'} ${SOUNDSCAPE_DISCLAIMER}`);
    } finally { pending.current = false; }
  };

  const blocked = initial.blocked;
  const commit = (next: CountermeasureState, okMessage: string) => {
    if (blocked) { setStorageError(initial.error); setStatus(null); return false; }
    const error = persist(next);
    if (error) { setStorageError(error); setStatus(null); return false; }
    setStorageError(null); setState(next); setStatus(okMessage); return true;
  };

  const blank = Object.values(draft).some(v => v.trim() === '');
  const candidate = { loadKg: Number(draft.loadKg), repetitions: Number(draft.repetitions), sets: Number(draft.sets) };
  const preview = !blank && validateWorkout(candidate) === null ? axialLoadingScore(candidate) : null;

  const save = (event: FormEvent) => {
    event.preventDefault();
    const error = blank ? 'Enter load, reps and sets; blank fields are not saved.' : validateWorkout(candidate);
    if (error) { setFormError(error); setStatus(null); return; }
    setFormError(null);
    const session = { ...candidate, recordedAt: new Date().toISOString(), axialScore: axialLoadingScore(candidate) };
    if (commit({ ...state, sessions: [session, ...state.sessions].slice(0, LIMIT) }, `Sample session saved locally · score ${session.axialScore.toFixed(1)} pts`)) {
      setDraft({ loadKg: '', repetitions: '', sets: '' });
    }
  };

  const trends = getExampleTrends(state.scenario);
  const alert = getExampleAlert(state.scenario);
  const muscleNow = latest(trends.muscle), boneNow = latest(trends.bone);
  const unknown = blocked || muscleNow === null || boneNow === null || state.scenario === 'missing';
  const span = trends.days.length ? trends.days[trends.days.length - 1] - trends.days[0] : 0;
  const lastSession = state.sessions[0];

  return <div className="fade-in cm-page" data-testid="page-countermeasures">
    <div className="page-heading cm-heading">
      <h1>Countermeasures</h1>
      <Link href="/" className="cm-back" data-testid="link-back-readings"><ArrowLeft size={15} aria-hidden="true" />Readings</Link>
    </div>
    <p className="cm-local" role="note" data-testid="text-local-simulation">Local simulation · no ARED or wearable connection · stored on this device only</p>

    <section className={`panel cm-glance ${alert ? 'cm-flag' : ''} ${unknown ? 'cm-unknown' : ''}`} aria-label="Fictional demo trend summary" data-testid="card-cm-glance">
      <div className="cm-glance-head"><strong>Demo indices · {span}-day</strong><span>Fictional</span></div>
      <div className="cm-glance-values">
        <div><small>Muscle retention</small><b data-testid="value-muscle-latest">{unknown ? 'Unavailable' : fmtPct(muscleNow)}</b></div>
        <div><small>Bone density</small><b data-testid="value-bone-latest">{unknown ? 'Unavailable' : fmtPct(boneNow)}</b></div>
      </div>
      <div className="cm-status" data-testid="status-cm-alert">
        {unknown ? <><AlertTriangle size={15} aria-hidden="true" /><strong>{!blocked && alert ? alert : 'Status unavailable — demo data missing or unreadable'}</strong></>
          : alert ? <><AlertTriangle size={15} aria-hidden="true" /><strong>{alert}</strong></>
          : <span>Demo mechanic not triggered for this example. Not a health assessment.</span>}
      </div>
      <p className="cm-fine">Demo indices: % of a fictional pre-flight 100% baseline. Not a measurement, no g/cm². Unvalidated mechanics, never a diagnosis or prediction.</p>
    </section>

    <div className="cm-scenarios" role="group" aria-label="Demo scenario">
      {scenarios.map(s => <button key={s.value} type="button" className={`choice ${state.scenario === s.value ? 'active' : ''}`} aria-pressed={state.scenario === s.value} data-testid={`button-cm-scenario-${s.value}`}
        onClick={() => commit({ ...state, scenario: s.value }, `Scenario set: ${s.label}`)}>{s.label}</button>)}
    </div>

    <details className="rule-box cm-details">
      <summary data-testid="button-cm-trend-table">Trend table · days 0–{span}</summary>
      <table className="readings-table" data-testid="table-cm-trends">
        <caption className="cm-fine">Fictional demo indices, % of pre-flight baseline</caption>
        <thead><tr><th scope="col">Day</th><th scope="col">Muscle</th><th scope="col">Bone</th></tr></thead>
        <tbody>{(blocked ? [] : trends.days).map((day, i) => <tr key={day} data-testid={`row-cm-trend-${day}`}><td>{day}</td><td>{fmtPct(trends.muscle[i])}</td><td>{fmtPct(trends.bone[i])}</td></tr>)}</tbody>
      </table>
      <p>Low-workload example shows a 0.5–1.5% demo decline; the early flag at a 1% or greater drop is an unvalidated mechanic only. Saved workouts never change these values.</p>
    </details>

    <form className="panel cm-form" onSubmit={save} noValidate data-testid="form-cm-session">
      <div className="cm-form-head"><Dumbbell size={16} aria-hidden="true" /><strong>Record sample session</strong></div>
      <div className="cm-fields">
        {([['loadKg', 'Load kg', '0–300', 'decimal'], ['repetitions', 'Reps', '1–100', 'numeric'], ['sets', 'Sets', '1–20', 'numeric']] as const).map(([key, label, hint, mode]) =>
          <label key={key}><span>{label}</span>
            <input inputMode={mode} value={draft[key]} placeholder={hint} aria-invalid={!!formError}
              onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setFormError(null); }} data-testid={`input-cm-${key}`} />
          </label>)}
      </div>
      <div className="cm-form-foot">
        <span className="cm-score" data-testid="text-cm-score-preview">Axial score: {preview === null ? '—' : `${preview.toFixed(1)} pts`}</span>
        <button type="submit" className="btn small" data-testid="button-cm-save">Save session</button>
      </div>
      <p className="cm-fine">Arbitrary 0–100 points: min(100, load × reps × sets ÷ 60). Not a physical or clinical measure.</p>
      {formError && <p className="cm-error" role="alert" data-testid="error-cm-validation">{formError}</p>}
    </form>
    {storageError && <p className="cm-error" role="alert" data-testid="error-cm-storage">{storageError}</p>}
    {status && <p className="cm-ok" role="status" data-testid="status-cm-save"><Check size={14} aria-hidden="true" />{status}</p>}

    <section className="cm-list" aria-label="Saved sessions" data-testid="list-cm-sessions">
      <h2>Sessions <span>{state.sessions.length}/{LIMIT}</span></h2>
      {lastSession ? <ul>{state.sessions.map((s, i) => <li key={`${s.recordedAt}-${i}`} data-testid={`row-cm-session-${i}`}>
        <span>{fmtTime(s.recordedAt)}</span><span>{s.loadKg} kg · {s.repetitions}×{s.sets}</span><b>{s.axialScore.toFixed(1)} pts</b>
      </li>)}</ul> : <p className="cm-empty" data-testid="text-cm-no-sessions">No workout recorded yet.</p>}
    </section>

    <details className="rule-box cm-details" data-testid="details-cm-recovery">
      <summary data-testid="button-cm-recovery">Recovery prompts</summary>
      <p className="cm-fine">ARED-style discussion examples, not prescribed workouts: squat, heel raise, deadlift.</p>
      <ul className="cm-prompts">
        <li>Discuss your approved resistance and mobility plans with the flight team.</li>
        <li>Review any concerns about these demo indices with the flight team.</li>
        <li>Nutrition: follow only your approved flight food and medical plan.</li>
      </ul>
      <button type="button" className="btn small outline" data-testid="button-cm-plan-complete"
        onClick={() => commit({ ...state, completions: [new Date().toISOString(), ...state.completions].slice(0, LIMIT) }, 'Plan completion time recorded. Scenario and trends unchanged.')}>
        <Check size={15} aria-hidden="true" />Plan completed
      </button>
      <p className="cm-fine">Records your action only, not muscle or bone recovery. The newest 50 sessions and completion times stay on this device.</p>
      <h3 className="cm-sub">Completion history <span>{state.completions.length}/{LIMIT}</span></h3>
      {state.completions.length ? <ul className="cm-completions" data-testid="list-cm-completions">{state.completions.map((c, i) => <li key={`${c}-${i}`} data-testid={`row-cm-completion-${i}`}>{fmtTime(c)}</li>)}</ul>
        : <p className="cm-empty" data-testid="text-cm-no-completions">No completions recorded.</p>}
    </details>

    <div className="cm-audio">
      <button type="button" className="btn small outline" data-testid="button-cm-check-audio"
        aria-pressed={playing} onClick={toggleAudio}>
        <Volume2 size={15} aria-hidden="true" />{playing ? 'Stop local audio' : 'Check local audio'}
      </button>
      {audio && <p className="cm-fine" role="status" data-testid="status-cm-audio">{audio}</p>}
    </div>
  </div>;
}
