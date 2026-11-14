import { format } from 'date-fns';
import { Headphones, NotebookPen, SmilePlus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCheckIns, useListens, useMessages, useReflections } from '@/lib/companion-context';
import { usePageMeta } from '@/hooks/use-page-meta';
import { EmptyState, ErrorState, Eyebrow, Panel, SampleBadge, SkeletonBlock, moodLabel } from '@/components/bits';

function Section<T extends { id: string }>({ title, q, icon, empty, render, delay }: {
  title: string; q: { data?: T[]; isLoading: boolean; isError: boolean; refetch: () => unknown }; icon: ReactNode; empty: string; render: (x: T) => ReactNode; delay: number;
}) {
  return (
    <Panel delay={delay} aria-label={title}>
      <h2 className="flex items-center gap-2 font-display text-2xl"><span className="text-accent">{icon}</span>{title}</h2>
      <div className="mt-3">
        {q.isLoading ? <SkeletonBlock className="h-24" /> : q.isError ? <ErrorState what={title.toLowerCase()} onRetry={() => q.refetch()} />
          : !q.data?.length ? <EmptyState icon={icon} title="Nothing yet" body={empty} />
          : <ul className="divide-y divide-border/60">{q.data.slice(0, 20).map((x) => <li key={x.id} className="py-3 text-sm">{render(x)}</li>)}</ul>}
      </div>
    </Panel>
  );
}

const when = (d: string) => <time dateTime={d} className="font-mono text-xs text-muted-foreground">{format(new Date(d), 'd MMM, HH:mm')}</time>;

export default function HistoryPage() {
  usePageMeta('History', 'Recent check-ins, reflections and listening events stored locally as sample history.');
  const msgs = useMessages();
  const title = (id: string) => msgs.data?.find((m) => m.id === id)?.title ?? 'Unknown message';
  return (
    <div className="space-y-6">
      <div>
        <div className="rise flex flex-wrap items-center gap-2"><Eyebrow>Your log</Eyebrow><SampleBadge>Local sample history</SampleBadge></div>
        <h1 className="rise mt-2 font-display text-5xl">History</h1>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Section delay={60} title="Check-ins" q={useCheckIns()} icon={<SmilePlus className="h-5 w-5" aria-hidden="true" />} empty="Your daily check-ins will appear here."
          render={(c) => <div><div className="flex justify-between gap-2"><span>Mood {c.mood}/5 · {moodLabel(c.mood)}</span>{when(c.date)}</div>{c.note && <p className="mt-1 text-muted-foreground">{c.note}</p>}</div>} />
        <Section delay={120} title="Reflections" q={useReflections()} icon={<NotebookPen className="h-5 w-5" aria-hidden="true" />} empty="Reflections after listening will appear here."
          render={(r) => <div><div className="flex justify-between gap-2"><span>“{title(r.messageId)}” · felt {r.feelingAfter}/5 ({moodLabel(r.feelingAfter)})</span>{when(r.date)}</div>{r.note && <p className="mt-1 text-muted-foreground">{r.note}</p>}</div>} />
      </div>
      <Section delay={180} title="Listening" q={useListens()} icon={<Headphones className="h-5 w-5" aria-hidden="true" />} empty="Messages you play will be logged here."
        render={(e) => <div className="flex justify-between gap-2"><span>Played “{title(e.messageId)}”</span>{when(e.date)}</div>} />
    </div>
  );
}
