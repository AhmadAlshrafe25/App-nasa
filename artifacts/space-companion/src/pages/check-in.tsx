import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { CheckCircle2, Headphones } from 'lucide-react';
import { useMessages, useSaveCheckIn, useSaveReflection } from '@/lib/companion-context';
import { usePlayer } from '@/lib/player-context';
import { usePageMeta } from '@/hooks/use-page-meta';
import { EmptyState, Eyebrow, MOODS, Panel, SampleBadge } from '@/components/bits';
import { cn } from '@/lib/utils';

function MoodRadios({ name, value, onChange, legend }: { name: string; value: number | null; onChange: (v: number) => void; legend: string }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">{legend}</legend>
      <div className="mt-3 grid grid-cols-5 gap-2">
        {MOODS.map((m) => (
          <label key={m.v} className={cn('relative flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring',
            value === m.v ? 'border-primary bg-primary/15' : 'border-border hover:bg-muted/50')}>
            <input type="radio" name={name} value={m.v} checked={value === m.v} onChange={() => onChange(m.v)} className="sr-only" data-testid={'radio-' + name + '-' + m.v} />
            <span className="font-mono text-lg">{m.v}</span>
            <span className="text-xs">{m.label}</span>
            <span className="hidden text-[10px] text-muted-foreground sm:block">{m.hint}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Success({ text }: { text: string }) {
  return <p role="status" className="mt-4 flex items-center gap-2 rounded-lg bg-primary/10 p-3 text-sm" data-testid="status-saved"><CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />{text}</p>;
}

export default function CheckInPage() {
  usePageMeta('Check-in', 'A daily mood check-in and after-listening reflection. Not a diagnostic tool.');
  const saveC = useSaveCheckIn();
  const saveR = useSaveReflection();
  const msgs = useMessages();
  const { lastPlayedId } = usePlayer();

  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [cDone, setCDone] = useState(false);

  const [msgId, setMsgId] = useState<string>('');
  const [feel, setFeel] = useState<number | null>(null);
  const [rNote, setRNote] = useState('');
  const [rDone, setRDone] = useState(false);
  useEffect(() => { if (lastPlayedId && !msgId) setMsgId(lastPlayedId); }, [lastPlayedId, msgId]);

  return (
    <div className="space-y-6">
      <div>
        <div className="rise flex flex-wrap items-center gap-2"><Eyebrow>A minute for yourself</Eyebrow><SampleBadge>Saved locally</SampleBadge></div>
        <h1 className="rise mt-2 font-display text-5xl">Check-in</h1>
        <p className="mt-2 max-w-xl text-sm text-muted-foreground">Private notes, stored only in this browser as sample history. Nothing here is a health assessment.</p>
      </div>

      <Panel delay={60} aria-labelledby="ci-h">
        <h2 id="ci-h" className="font-display text-3xl">How are you arriving today?</h2>
        <form className="mt-4 space-y-4" onSubmit={(e) => {
          e.preventDefault(); if (!mood) return;
          saveC.mutate({ mood, note: note.trim() }, { onSuccess: () => { setCDone(true); setMood(null); setNote(''); } });
        }}>
          <MoodRadios name="mood" legend="Mood" value={mood} onChange={(v) => { setMood(v); setCDone(false); }} />
          <div>
            <label htmlFor="ci-note" className="text-sm font-medium">Note <span className="text-muted-foreground">(optional)</span></label>
            <textarea id="ci-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={500} data-testid="input-checkin-note"
              placeholder="Watched the terminator cross the Pacific…" className="mt-2 w-full rounded-xl border border-input bg-background/60 p-3 text-sm placeholder:text-muted-foreground/70" />
          </div>
          <button type="submit" disabled={!mood || saveC.isPending} data-testid="button-save-checkin"
            className="min-h-11 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {saveC.isPending ? 'Saving…' : 'Save check-in'}
          </button>
          {saveC.isError && <p role="alert" className="text-sm text-destructive">Couldn't save. Please try again.</p>}
        </form>
        {cDone && <Success text="Check-in saved. Thank you for pausing." />}
      </Panel>

      <Panel delay={120} aria-labelledby="rf-h">
        <h2 id="rf-h" className="font-display text-3xl">After listening</h2>
        {!lastPlayedId ? (
          <div className="mt-4"><EmptyState icon={<Headphones className="h-5 w-5" aria-hidden="true" />} title="Play a message first"
            body="Reflections are tied to a message you've played this session."
            action={<Link href="/messages" className="inline-flex min-h-11 items-center rounded-full border border-primary px-5 text-sm text-primary" data-testid="link-go-messages">Open messages</Link>} /></div>
        ) : (
          <form className="mt-4 space-y-4" onSubmit={(e) => {
            e.preventDefault(); if (!feel || !msgId) return;
            saveR.mutate({ messageId: msgId, feelingAfter: feel, note: rNote.trim() }, { onSuccess: () => { setRDone(true); setFeel(null); setRNote(''); } });
          }}>
            <div>
              <label htmlFor="rf-msg" className="text-sm font-medium">Message</label>
              <select id="rf-msg" value={msgId} onChange={(e) => setMsgId(e.target.value)} data-testid="select-reflection-message"
                className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background/60 px-3 text-sm">
                {(msgs.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.title} — {m.sender}{m.id === lastPlayedId ? ' (last played)' : ''}</option>)}
              </select>
            </div>
            <MoodRadios name="feel" legend="How do you feel after listening?" value={feel} onChange={(v) => { setFeel(v); setRDone(false); }} />
            <div>
              <label htmlFor="rf-note" className="text-sm font-medium">Reflection <span className="text-muted-foreground">(optional)</span></label>
              <textarea id="rf-note" value={rNote} onChange={(e) => setRNote(e.target.value)} rows={3} maxLength={500} data-testid="input-reflection-note"
                className="mt-2 w-full rounded-xl border border-input bg-background/60 p-3 text-sm" />
            </div>
            <button type="submit" disabled={!feel || saveR.isPending} data-testid="button-save-reflection"
              className="min-h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-foreground disabled:opacity-50">
              {saveR.isPending ? 'Saving…' : 'Save reflection'}
            </button>
            {saveR.isError && <p role="alert" className="text-sm text-destructive">Couldn't save. Please try again.</p>}
          </form>
        )}
        {rDone && <Success text="Reflection saved to your local history." />}
      </Panel>
    </div>
  );
}
