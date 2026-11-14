import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { History, Home, Info, MessageCircleHeart, Orbit, Send, ShieldAlert, SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/hazards', label: 'Hazards', icon: ShieldAlert },
  { href: '/messages', label: 'Messages', icon: MessageCircleHeart },
  { href: '/send', label: 'Send', icon: Send },
  { href: '/check-in', label: 'Check-in', icon: SmilePlus },
  { href: '/history', label: 'History', icon: History },
];

export function Layout({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  return (
    <div className="relative min-h-[100dvh]">
      <div className="starfield" aria-hidden="true" />
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground">Skip to content</a>
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 rounded-md min-h-11" data-testid="link-brand">
            <Orbit className="h-6 w-6 text-accent" aria-hidden="true" />
            <span className="font-display text-2xl italic">Space Companion</span>
          </Link>
          <nav aria-label="Primary" className="hidden md:block">
            <ul className="flex gap-1">
              {NAV.map((n) => {
                const on = loc === n.href;
                return (
                  <li key={n.href}>
                    <Link href={n.href} aria-current={on ? 'page' : undefined} data-testid={'link-nav-' + n.label.toLowerCase()}
                      className={cn('flex min-h-11 items-center gap-2 rounded-full px-4 text-sm transition-colors',
                        on ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:text-foreground')}>
                      <n.icon className="h-4 w-4" aria-hidden="true" />{n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main id="main" className="relative z-10 mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6 md:pb-16">
        {children}
        <aside className="mt-12 flex gap-3 rounded-xl border border-border/70 bg-card/40 p-4 text-xs text-muted-foreground" aria-label="Notice" data-testid="text-notice">
          <Info className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Space Companion includes offline examples for connection, reflection, and the five spaceflight hazards. It is <strong className="text-foreground">not a medical or diagnostic tool</strong>.
            All statuses, values, messages, and rules shown are demonstrations, not live measurements or validated safety limits. Follow mission procedures for real concerns.
          </p>
        </aside>
      </main>

      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/90 backdrop-blur-md md:hidden">
        <ul className="grid grid-cols-6 pb-[env(safe-area-inset-bottom)]">
          {NAV.map((n) => {
            const on = loc === n.href;
            return (
              <li key={n.href}>
                <Link href={n.href} aria-current={on ? 'page' : undefined} data-testid={'link-tab-' + n.label.toLowerCase()}
                  className={cn('flex min-h-16 flex-col items-center justify-center gap-1 text-[11px]', on ? 'text-primary' : 'text-muted-foreground')}>
                  <n.icon className="h-5 w-5" aria-hidden="true" />{n.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
