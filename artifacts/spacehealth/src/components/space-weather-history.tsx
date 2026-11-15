import { useState } from 'react';
import { GEOMAGNETIC_STORM_HISTORY } from '@/lib/geomagnetic-storm-history';
import './space-weather-history.css';

const RECENT_YEARS = 12;
const DATASET_URL = 'https://www.kaggle.com/datasets/liveatlasearth/geomagnetic-storms-since-1932';
const GFZ_URL = 'https://doi.org/10.5880/Kp.0001';

export function SpaceWeatherHistory() {
  const [range, setRange] = useState<'recent' | 'all'>('recent');
  const [selectedYear, setSelectedYear] = useState(2025);
  const rows = range === 'recent'
    ? GEOMAGNETIC_STORM_HISTORY.slice(-RECENT_YEARS)
    : GEOMAGNETIC_STORM_HISTORY;
  const selected = rows.find(row => row.year === selectedYear) ?? rows[rows.length - 1];
  const maxStormDays = Math.max(1, ...rows.map(row => row.stormDaysG1Plus));

  return <details className="space-weather-history" data-testid="details-space-weather-history">
    <summary>Historical storm activity</summary>
    <p className="space-weather-history-note">
      Historical planetary Kp context only · not an onboard reading, dose, forecast, or safety limit.
    </p>
    <div className="space-weather-history-controls" role="group" aria-label="History range">
      <button
        type="button"
        aria-pressed={range === 'recent'}
        onClick={() => setRange('recent')}
        data-testid="button-history-recent"
      >
        Recent 12 years
      </button>
      <button
        type="button"
        aria-pressed={range === 'all'}
        onClick={() => setRange('all')}
        data-testid="button-history-all"
      >
        Since 1932
      </button>
    </div>
    <div className="space-weather-history-scroll" tabIndex={0} aria-label="Scroll through yearly storm-day bars">
      <div className={`space-weather-history-chart ${range === 'all' ? 'chart-all-years' : ''}`} role="group" aria-label="Geomagnetic storm days by year">
        {rows.map(row => {
          const height = Math.max(3, (row.stormDaysG1Plus / maxStormDays) * 100);
          const selectedState = row.year === selected.year;
          const label = `${row.year}${row.partial ? ' year to date' : ''}: ${row.stormDaysG1Plus} G1-or-higher storm days, ${row.stormDaysG4Plus} G4-or-higher days including ${row.stormDaysG5} G5 days, peak Kp ${row.maxKp}`;
          return <button
            key={row.year}
            type="button"
            className={`space-weather-history-year ${row.partial ? 'year-partial' : ''}`}
            aria-label={label}
            aria-pressed={selectedState}
            title={label}
            onClick={() => setSelectedYear(row.year)}
            data-testid={`history-year-${row.year}`}
          >
            <span className="space-weather-history-bar-wrap" aria-hidden="true">
              <span className="space-weather-history-bar" style={{ height: `${height}%` }} />
            </span>
            <span className="space-weather-history-year-label" aria-hidden="true">
              {range === 'recent' || row.year % 5 === 0 || row.year === 2026 ? row.year : '·'}
            </span>
          </button>;
        })}
      </div>
    </div>
    <div className="space-weather-history-detail" aria-live="polite" data-testid="history-year-detail">
      <strong data-testid="history-selected-year">
        {selected.year}{selected.partial ? ' · partial year' : ''}
      </strong>
      <span data-testid="history-selected-storm-days">
        {selected.stormDaysG1Plus} days at G1 or higher
      </span>
      <span>
        {selected.stormDaysG4Plus} G4+ days including {selected.stormDaysG5} G5 · peak Kp {selected.maxKp}
      </span>
      {selected.partial && <span className="space-weather-history-partial" data-testid="history-partial-note">
        2026 data through October 29 ({selected.observedDays} days reported)
      </span>}
    </div>
    <footer className="space-weather-history-source">
      <span>Annual summary · Live Atlas, CC BY 4.0 · GFZ Potsdam</span>
      <span>
        <a href={DATASET_URL} target="_blank" rel="noreferrer">Kaggle source</a>
        {' · '}
        <a href={GFZ_URL} target="_blank" rel="noreferrer">Original Kp data</a>
      </span>
    </footer>
  </details>;
}
