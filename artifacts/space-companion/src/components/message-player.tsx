import { Pause, Play } from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/lib/player-context';
import { fmtTime } from '@/lib/audio';
import type { FamilyMessage } from '@/lib/types';
import { cn } from '@/lib/utils';

export function MessagePlayer({ message, compact }: { message: FamilyMessage; compact?: boolean }) {
  const p = usePlayer();
  const active = p.currentId === message.id;
  const playing = active && p.playing;
  const dur = active ? p.duration : message.durationSeconds;
  const t = active ? p.time : 0;
  return (
    <div className={cn('flex items-center gap-3', compact ? '' : 'rounded-xl bg-background/40 p-2 pr-4')}>
      <button
        type="button"
        onClick={() => p.toggle(message)}
        aria-label={(playing ? 'Pause' : 'Play') + ' message "' + message.title + '" from ' + message.sender}
        aria-pressed={playing}
        data-testid={'button-play-' + message.id}
        className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform active:scale-95',
          playing ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground hover:scale-105')}
      >
        {playing ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5 translate-x-px" aria-hidden="true" />}
      </button>
      <div className="flex-1 min-w-0">
        <Slider
          value={[t]} min={0} max={dur || 1} step={0.1}
          onValueChange={([v]) => p.seek(message, v)}
          aria-label={'Seek within "' + message.title + '"'}
          data-testid={'slider-seek-' + message.id}
          className="py-3"
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground" aria-live="off" data-testid={'text-time-' + message.id}>
        {fmtTime(t)} / {fmtTime(dur)}
      </span>
    </div>
  );
}
