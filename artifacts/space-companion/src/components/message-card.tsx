import { format } from 'date-fns';
import type { FamilyMessage } from '@/lib/types';
import { MessagePlayer } from './message-player';
import { Tag } from './bits';
import { usePlayer } from '@/lib/player-context';
import { cn } from '@/lib/utils';
import { fmtTime } from '@/lib/audio';

export function initials(n: string) { return n.split(' ').map((p) => p[0]).slice(0, 2).join(''); }

export function MessageCard({ m, heard }: { m: FamilyMessage; heard: boolean }) {
  const { currentId } = usePlayer();
  return (
    <li data-testid={'card-message-' + m.id}
      className={cn('rounded-2xl border bg-card/70 p-4 sm:p-5 transition-colors', currentId === m.id ? 'border-primary/60' : 'border-card-border')}>
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary/30 to-accent/30 font-mono text-sm" aria-hidden="true">{initials(m.sender)}</div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-xl leading-tight">{m.title}</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            <span className="text-foreground">{m.sender}</span> · {m.relationship} · <time dateTime={m.recordedOn}>{format(new Date(m.recordedOn), 'd MMM yyyy')}</time> · {fmtTime(m.durationSeconds)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {m.tags.map((t) => <Tag key={t} t={t} />)}
            <span className={cn('ml-1 text-[11px] font-mono', heard ? 'text-muted-foreground' : 'text-primary')}>{heard ? 'heard' : 'new'}</span>
          </div>
        </div>
      </div>
      <div className="mt-3"><MessagePlayer message={m} /></div>
      <p className="mt-1 text-[11px] text-muted-foreground">Demonstration audio – a soft tone stands in for the voice. Read the fictional transcript below.</p>
      <details className="mt-2 rounded-xl border border-card-border bg-background/40 p-3">
        <summary className="cursor-pointer min-h-[44px] flex items-center text-sm font-medium">Transcript (sample)</summary>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{m.transcript}</p>
      </details>
    </li>
  );
}
