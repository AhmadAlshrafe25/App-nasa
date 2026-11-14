import { useEffect, useState } from 'react';
import { formatEasternClock } from '@/lib/earth-clock';

export function EarthClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    // Refresh immediately when returning from a suspended/background tab.
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  return <span className="earth-clock" aria-live="off" data-testid="earth-clock">
    <span className="earth-clock-label">Earth · Eastern</span>
    <time dateTime={now.toISOString()}>{formatEasternClock(now)}</time>
  </span>;
}
