import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, RefreshCw, Satellite } from 'lucide-react';
import { apiRequest } from '@/lib/space-api';
import './nasa-cme-feed.css';

type NasaCmeEvent = {
  activityId: string | null;
  startTime: string;
  sourceLocation: string | null;
  activeRegion: string | number | null;
  analysisSpeedKmPerSecond: number | null;
  eventUrl: string | null;
};

type NasaCmeFeed = {
  source: 'NASA DONKI';
  sourceUrl: string;
  windowStart: string;
  windowEnd: string;
  retrievedAt: string;
  cached: boolean;
  events: NasaCmeEvent[];
};

type FeedState = { data: NasaCmeFeed | null; error: boolean };
const REFRESH_MS = 15 * 60_000;

function formatUtc(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return 'Time unavailable';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(date);
}

export function NasaCmeFeed() {
  const [feed, setFeed] = useState<FeedState>({ data: null, error: false });
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    setLoading(true);
    const result = await apiRequest<NasaCmeFeed>('/space-weather/nasa-cmes');
    if (result.status === 'ok' && result.data?.source === 'NASA DONKI' && Array.isArray(result.data.events)) {
      setFeed({ data: result.data, error: false });
    } else {
      setFeed(previous => ({ ...previous, error: true }));
    }
    setLoading(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const feedStatus = loading && !feed.data
    ? 'Loading'
    : feed.error
      ? feed.data ? 'Showing last response' : 'Unavailable'
      : 'NASA data';

  return <section className="panel nasa-cme-panel" aria-labelledby="nasa-cme-title" data-testid="panel-nasa-cme">
    <header className="nasa-cme-head">
      <div className="nasa-cme-title-wrap">
        <Satellite size={19} aria-hidden="true" />
        <h2 id="nasa-cme-title">NASA space-weather events</h2>
        <span className={`nasa-cme-state nasa-cme-${feedStatus.toLowerCase().replaceAll(' ', '-')}`} role="status" aria-live="polite" data-testid="status-nasa-cme">
          {feedStatus}
        </span>
      </div>
      <button type="button" className="nasa-cme-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh NASA event reports" data-testid="button-nasa-cme-refresh">
        <RefreshCw size={15} aria-hidden="true" className={loading ? 'is-spinning' : ''} />
        <span>{loading ? 'Updating' : 'Refresh'}</span>
      </button>
    </header>
    <p className="nasa-cme-intro">
      NASA DONKI coronal mass ejection reports · recent 7-day window · real event data
    </p>
    {feed.data?.events.length ? <div className="nasa-cme-events" data-testid="list-nasa-cme-events">
      {feed.data.events.map((event, index) => <article className="nasa-cme-event" key={event.activityId ?? event.startTime} data-testid={`event-nasa-cme-${index}`}>
        <div className="nasa-cme-event-heading">
          <strong>{event.sourceLocation ?? 'Source location not reported'}</strong>
          <time dateTime={event.startTime}>{formatUtc(event.startTime)}</time>
        </div>
        <div className="nasa-cme-event-details">
          {event.activeRegion !== null && <span>Active region {event.activeRegion}</span>}
          {event.analysisSpeedKmPerSecond !== null && <span>NASA analysis speed {Math.round(event.analysisSpeedKmPerSecond)} km/s</span>}
          {event.activityId && <span>Event {event.activityId}</span>}
          {event.eventUrl && <a href={event.eventUrl} target="_blank" rel="noreferrer" data-testid={`link-nasa-cme-${index}`}>NASA event details <ExternalLink size={12} aria-hidden="true" /></a>}
        </div>
      </article>)}
    </div> : feed.data && <p className="nasa-cme-empty" data-testid="text-nasa-cme-empty">No CME reports in this period.</p>}
    {!feed.data && feed.error && <p className="nasa-cme-empty" role="alert" data-testid="text-nasa-cme-unavailable">
      NASA reports are unavailable right now. No sample events are substituted.
    </p>}
    {feed.data && <footer className="nasa-cme-foot">
      <span>Retrieved {formatUtc(feed.data.retrievedAt)}{feed.data.cached ? ' · cached' : ''}</span>
      <a href={feed.data.sourceUrl} target="_blank" rel="noreferrer">NASA DONKI source <ExternalLink size={12} aria-hidden="true" /></a>
    </footer>}
    <p className="nasa-cme-disclaimer">NASA event reports are not onboard sensor readings, mission-specific forecasts, or exposure limits.</p>
  </section>;
}
