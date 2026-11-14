import { useMemo, useState } from 'react';
import { Inbox } from 'lucide-react';
import { useListens, useMessages } from '@/lib/companion-context';
import { usePageMeta } from '@/hooks/use-page-meta';
import { EmptyState, ErrorState, Eyebrow, SampleBadge, SkeletonBlock } from '@/components/bits';
import { MessageCard } from '@/components/message-card';
import { cn } from '@/lib/utils';

const FILTERS = ['all', 'comfort', 'sleep', 'celebration', 'humor'] as const;

export default function MessagesPage() {
  usePageMeta('Messages', 'Library of family voice messages with an accessible player. Demonstration audio only.');
  const msgs = useMessages();
  const listens = useListens();
  const [f, setF] = useState<(typeof FILTERS)[number]>('all');
  const heard = useMemo(() => new Set((listens.data ?? []).map((e) => e.messageId)), [listens.data]);
  const list = (msgs.data ?? []).filter((m) => f === 'all' || m.tags.includes(f));
  return (
    <div>
      <div className="rise flex flex-wrap items-center gap-2"><Eyebrow>Voices from home</Eyebrow><SampleBadge /></div>
      <h1 className="rise mt-2 font-display text-5xl">Messages</h1>
      <p className="mt-2 max-w-xl text-sm text-muted-foreground">Fictional family members, demonstration audio. Only one message plays at a time.</p>
      <div role="group" aria-label="Filter by tag" className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <button key={x} type="button" aria-pressed={f === x} onClick={() => setF(x)} data-testid={'button-filter-' + x}
            className={cn('min-h-11 rounded-full border px-4 text-sm capitalize', f === x ? 'border-primary bg-primary/15 text-foreground' : 'border-border text-muted-foreground hover:text-foreground')}>
            {x}
          </button>
        ))}
      </div>
      <div className="mt-6">
        {msgs.isLoading ? <div className="space-y-3">{[0, 1, 2].map((i) => <SkeletonBlock key={i} className="h-40" />)}</div>
          : msgs.isError ? <ErrorState what="messages" onRetry={() => msgs.refetch()} />
          : list.length === 0 ? <EmptyState icon={<Inbox className="h-5 w-5" aria-hidden="true" />} title="Nothing here yet" body="No messages match this tag." />
          : <ul className="grid gap-4 md:grid-cols-2">{list.map((m) => <MessageCard key={m.id} m={m} heard={heard.has(m.id)} />)}</ul>}
      </div>
    </div>
  );
}
