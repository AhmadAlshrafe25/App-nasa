import type { ReactNode } from 'react';
import { AlertTriangle, FlaskConical, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export const MOODS = [
  { v: 1, label: 'Heavy', hint: 'A hard day' },
  { v: 2, label: 'Low', hint: 'Below usual' },
  { v: 3, label: 'Steady', hint: 'About usual' },
  { v: 4, label: 'Bright', hint: 'Better than usual' },
  { v: 5, label: 'Soaring', hint: 'A great day' },
];
export const moodLabel = (v: number) => MOODS.find((m) => m.v === v)?.label ?? String(v);

export function Panel({ className, children, delay = 0, ...rest }: { className?: string; children: ReactNode; delay?: number } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...rest} style={{ animationDelay: delay + 'ms' }}
      className={cn('rise relative rounded-2xl border border-card-border bg-card/70 backdrop-blur-sm p-5 sm:p-6 shadow-[0_20px_50px_-30px_hsl(240_80%_2%)]', className)}>
      {children}
    </section>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{children}</p>;
}

export function SampleBadge({ children = 'Sample data' }: { children?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent/40 bg-secondary/60 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-secondary-foreground">
      <FlaskConical className="h-3 w-3" aria-hidden="true" />{children}
    </span>
  );
}

export function Meter({ label, value, max, display, note, testId }: { label: string; value: number; max: number; display: string; note: string; testId: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div data-testid={testId}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="font-mono text-lg text-foreground">{display}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={display + ' — ' + note}>
        <div className="h-full origin-left rounded-full bg-gradient-to-r from-primary to-accent" style={{ width: pct + '%' }} />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

export function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-muted/70', className)} aria-hidden="true" />;
}

export function ErrorState({ onRetry, what }: { onRetry: () => void; what: string }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm"><AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />Couldn't load {what}.</p>
      <button onClick={onRetry} data-testid="button-retry" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-input px-4 text-sm hover:bg-muted">
        <RotateCcw className="h-4 w-4" aria-hidden="true" />Try again
      </button>
    </div>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border px-6 py-10 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-secondary/60 text-accent">{icon}</div>
      <p className="font-display text-2xl">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{body}</p>
      {action}
    </div>
  );
}

export function Tag({ t }: { t: string }) {
  return <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">#{t}</span>;
}
