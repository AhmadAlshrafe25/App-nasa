import { Link } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { ArrowRight, Lightbulb, Radio } from 'lucide-react';
import { useListens, useMessages, useMission, useRecommendations, useSnapshot } from '@/lib/companion-context';
import { SAMPLE_RULES } from '@/lib/recommendations';
import { usePageMeta } from '@/hooks/use-page-meta';
import { ErrorState, Eyebrow, Meter, Panel, SampleBadge, SkeletonBlock, moodLabel, Tag } from '@/components/bits';
import { MessagePlayer } from '@/components/message-player';

export default function HomePage() {
  usePageMeta('Home', 'Mission day, family-message activity and a gently recommended voice message. Demonstration data.');
  const mission = useMission();
  const snap = useSnapshot();
  const msgs = useMessages();
  const listens = useListens();
  const recs = useRecommendations(snap.data, msgs.data);
  const rec = recs.data?.[0];
  const byId = new Map((msgs.data ?? []).map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      <Panel className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:p-0">
        {mission.isLoading ? <SkeletonBlock className="h-40" /> : mission.isError ? <ErrorState what="mission context" onRetry={() => mission.refetch()} /> : mission.data && (
          <div>
            <div className="flex flex-wrap items-center gap-2"><Eyebrow>Mission {mission.data.missionName}</Eyebrow><SampleBadge /></div>
            <h1 className="mt-3 font-display text-5xl leading-none sm:text-7xl" data-testid="text-mission-day">
              Day <span className="italic text-primary">{mission.data.missionDay}</span>
              <span className="text-muted-foreground text-3xl sm:text-4xl"> of {mission.data.totalDays}</span>
            </h1>
            <div className="mt-5 h-1.5 max-w-xl rounded-full bg-muted" role="progressbar" aria-label="Mission progress"
              aria-valuemin={0} aria-valuemax={mission.data.totalDays} aria-valuenow={mission.data.missionDay}>
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: (mission.data.missionDay / mission.data.totalDays) * 100 + '%' }} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {Math.round((mission.data.missionDay / mission.data.totalDays) * 1000) / 10}% complete · {mission.data.totalDays - mission.data.missionDay} days until home ·
              last family message {mission.data.daysSinceLastMessage} days ago
            </p>
          </div>
        )}
      </Panel>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel delay={80} aria-labelledby="rec-h" className="bg-gradient-to-br from-secondary/50 to-card/80">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow><span id="rec-h">Suggested for right now</span></Eyebrow>
            <Radio className="h-4 w-4 text-accent" aria-hidden="true" />
          </div>
          {(recs.isLoading || msgs.isLoading || snap.isLoading) ? <SkeletonBlock className="mt-4 h-40" />
            : (recs.isError || msgs.isError) ? <div className="mt-4"><ErrorState what="recommendation" onRetry={() => { msgs.refetch(); recs.refetch(); }} /></div>
            : !rec ? <p className="mt-4 text-sm text-muted-foreground">No messages available to suggest yet.</p>
            : (
              <div className="mt-3">
                <h2 className="font-display text-3xl leading-tight" data-testid="text-rec-title">{rec.message.title}</h2>
                <p className="text-sm text-muted-foreground">{rec.message.sender} · {rec.message.relationship}</p>
                <div className="mt-2 flex gap-1.5">{rec.message.tags.map((t) => <Tag key={t} t={t} />)}</div>
                <div className="mt-4"><MessagePlayer message={rec.message} /></div>
                <p className="mt-1 text-[11px] text-muted-foreground">Demonstration audio – a soft tone stands in for the voice.</p>
                <details className="mt-3 rounded-xl border border-border bg-background/40 p-4">
                  <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Transcript (sample)</summary>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{rec.message.transcript}</p>
                </details>
                <details className="group mt-4 rounded-xl border border-border bg-background/40 p-4" data-testid="details-why">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm font-medium">
                    <Lightbulb className="h-4 w-4 text-accent" aria-hidden="true" />Why this message?
                  </summary>
                  <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                    {rec.reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-primary" aria-hidden="true">›</span>{r}</li>)}
                  </ul>
                  <p className="mt-3 font-mono text-[11px] text-muted-foreground">
                    Rule: {rec.rule}. Thresholds (sleep &lt; {SAMPLE_RULES.sleepUnderHours} h, stress ≥ {SAMPLE_RULES.stressAtLeast}, mood ≤ {SAMPLE_RULES.moodAtMost}) are illustrative sample rules — not validated, not clinical.
                  </p>
                </details>
              </div>
            )}
        </Panel>

        <Panel delay={160} aria-labelledby="wb-h">
          <div className="flex items-center justify-between"><Eyebrow><span id="wb-h">Today's indicators</span></Eyebrow><SampleBadge /></div>
          {snap.isLoading ? <SkeletonBlock className="mt-4 h-40" /> : snap.isError ? <div className="mt-4"><ErrorState what="indicators" onRetry={() => snap.refetch()} /></div> : snap.data && (
            <div className="mt-4 space-y-5">
              <Meter testId="meter-sleep" label="Sleep" value={snap.data.sleepHours} max={9} display={snap.data.sleepHours.toFixed(1) + ' h'}
                note={snap.data.sleepHours < 6 ? 'Shorter than the 6 h sample reference' : 'At or above the 6 h sample reference'} />
              <Meter testId="meter-stress" label="Stress (self-reported)" value={snap.data.stress} max={10} display={snap.data.stress + ' / 10'}
                note={snap.data.stress >= 6 ? 'Elevated relative to sample rule' : 'Within sample range'} />
              <Meter testId="meter-mood" label="Mood" value={snap.data.mood} max={5} display={snap.data.mood + ' / 5 · ' + moodLabel(snap.data.mood)}
                note="From your latest sample check-in" />
            </div>
          )}
        </Panel>
      </div>

      <Panel delay={240} aria-labelledby="act-h">
        <div className="flex items-center justify-between gap-2">
          <Eyebrow><span id="act-h">Recent family activity</span></Eyebrow>
          <Link href="/messages" className="inline-flex min-h-11 items-center gap-1 text-sm text-primary" data-testid="link-all-messages">All messages <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>
        {msgs.isLoading ? <SkeletonBlock className="mt-3 h-24" /> : (
          <ul className="mt-2 divide-y divide-border/60">
            {(msgs.data ?? []).slice(0, 3).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span><span className="text-foreground">{m.sender}</span> <span className="text-muted-foreground">sent “{m.title}”</span></span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{m.recordedOn}</span>
              </li>
            ))}
            {(listens.data ?? []).slice(0, 2).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="text-muted-foreground">You played “{byId.get(e.messageId)?.title ?? 'a message'}”</span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">{formatDistanceToNow(new Date(e.date), { addSuffix: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
