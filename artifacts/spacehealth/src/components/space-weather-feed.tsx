import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Radio, RefreshCw } from 'lucide-react';
import {
  parseGoESProtonFlux,
  parsePlanetaryKIndex,
  SPACE_WEATHER_SOURCES,
  type SpaceWeatherObservation,
} from '@/lib/space-weather';
import { SpaceWeatherHistory } from '@/components/space-weather-history';
import './space-weather-feed.css';

type FeedValue = { observation: SpaceWeatherObservation | null; error: boolean };
type Feed = { kp: FeedValue; protonFlux: FeedValue };

const POLL_MS = 60_000;
const KP_FRESH_MS = 4 * 60 * 60_000;
const PROTON_FRESH_MS = 20 * 60_000;
const EMPTY_FEED: Feed = {
  kp: { observation: null, error: false },
  protonFlux: { observation: null, error: false },
};

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`NOAA returned ${response.status}`);
    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getObservation(
  url: string,
  parse: (raw: unknown) => SpaceWeatherObservation | null,
): Promise<SpaceWeatherObservation> {
  const result = parse(await getJson(url));
  if (!result) throw new Error('No valid observation was returned.');
  return result;
}

function freshness(observation: SpaceWeatherObservation | null, now: number, threshold: number) {
  if (!observation) return 'Unavailable';
  return now - Date.parse(observation.observedAt) <= threshold ? 'Current' : 'Delayed';
}

function formatTimestamp(value: string | null) {
  if (!value) return 'No observation';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function formatAge(value: string | null, now: number) {
  if (!value) return '';
  const minutes = Math.max(0, Math.floor((now - Date.parse(value)) / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hr${hours === 1 ? '' : 's'} ago`;
}

export function SpaceWeatherFeed() {
  const [feed, setFeed] = useState<Feed>(EMPTY_FEED);
  const [loading, setLoading] = useState(true);
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current || document.visibilityState !== 'visible') return;
    inFlight.current = true;
    setLoading(true);
    const [kp, protonFlux] = await Promise.allSettled([
      getObservation(SPACE_WEATHER_SOURCES.kp, parsePlanetaryKIndex),
      getObservation(SPACE_WEATHER_SOURCES.protonFlux, parseGoESProtonFlux),
    ]);
    setFeed(previous => ({
      kp: kp.status === 'fulfilled'
        ? { observation: kp.value, error: false }
        : { observation: previous.kp.observation, error: true },
      protonFlux: protonFlux.status === 'fulfilled'
        ? { observation: protonFlux.value, error: false }
        : { observation: previous.protonFlux.observation, error: true },
    }));
    setCheckedAt(Date.now());
    setNow(Date.now());
    setLoading(false);
    inFlight.current = false;
  }, []);

  useEffect(() => {
    void refresh();
    const poll = window.setInterval(() => void refresh(), POLL_MS);
    const clock = window.setInterval(() => setNow(Date.now()), 30_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(poll);
      window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [refresh]);

  const kpState = freshness(feed.kp.observation, now, KP_FRESH_MS);
  const protonState = freshness(feed.protonFlux.observation, now, PROTON_FRESH_MS);
  const available = [kpState, protonState].filter(state => state !== 'Unavailable').length;
  const current = [kpState, protonState].filter(state => state === 'Current').length;
  const overall = loading && !checkedAt
    ? 'Connecting'
    : current === 2 ? 'Current'
      : current > 0 ? 'Partial'
        : available > 0 ? 'Delayed'
          : 'Unavailable';

  return <section className="panel space-weather-panel" aria-labelledby="space-weather-title" data-testid="panel-space-weather">
    <header className="space-weather-head">
      <div className="space-weather-title-wrap">
        <Radio size={19} aria-hidden="true" />
        <h2 id="space-weather-title">Space weather</h2>
        <span className={`space-weather-status status-${overall.toLowerCase()}`} role="status" aria-live="polite" data-testid="status-space-weather">
          <span className="space-weather-dot" aria-hidden="true" />{overall}
        </span>
      </div>
      <button type="button" className="space-weather-refresh" onClick={() => void refresh()} disabled={loading} aria-label="Refresh space weather" data-testid="button-space-weather-refresh">
        <RefreshCw size={15} className={loading ? 'is-spinning' : ''} aria-hidden="true" />
        <span>{loading ? 'Updating' : 'Refresh'}</span>
      </button>
    </header>
    <p className="space-weather-location">NOAA SWPC · near-Earth public observations · not spacecraft-local sensors</p>
    <div className="space-weather-grid">
      <article className="space-weather-metric" data-testid="metric-space-weather-kp">
        <div className="space-weather-metric-head">
          <strong>Geomagnetic activity</strong>
          <span className={`space-weather-freshness freshness-${kpState.toLowerCase()}`}>{kpState}</span>
        </div>
        <div className="space-weather-value" data-testid="value-space-weather-kp">
          {feed.kp.observation ? feed.kp.observation.value.toFixed(2) : '—'} <span>Kp</span>
        </div>
        <p>Observed {formatTimestamp(feed.kp.observation?.observedAt ?? null)}
          {feed.kp.observation && <> · {formatAge(feed.kp.observation.observedAt, now)}</>}
        </p>
        {feed.kp.error && <small className="space-weather-error"><AlertTriangle size={13} />Could not refresh this reading</small>}
      </article>
      <article className="space-weather-metric" data-testid="metric-space-weather-protons">
        <div className="space-weather-metric-head">
          <strong>GOES proton flux</strong>
          <span className={`space-weather-freshness freshness-${protonState.toLowerCase()}`}>{protonState}</span>
        </div>
        <div className="space-weather-value" data-testid="value-space-weather-protons">
          {feed.protonFlux.observation ? feed.protonFlux.observation.value.toPrecision(3) : '—'} <span>pfu</span>
        </div>
        <p>≥10 MeV · observed {formatTimestamp(feed.protonFlux.observation?.observedAt ?? null)}
          {feed.protonFlux.observation && <> · {formatAge(feed.protonFlux.observation.observedAt, now)}</>}
        </p>
        {feed.protonFlux.error && <small className="space-weather-error"><AlertTriangle size={13} />Could not refresh this reading</small>}
      </article>
    </div>
    <SpaceWeatherHistory />
    <footer className="space-weather-foot">
      <span>Public near-Earth data, not an onboard reading, dose estimate, or safety alarm.</span>
      <span>{checkedAt ? `Checked ${new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(checkedAt)}` : 'Waiting for first update'}</span>
    </footer>
  </section>;
}
