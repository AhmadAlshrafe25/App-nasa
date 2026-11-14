import { AlertTriangle, CloudFog, Droplets, Gauge, RotateCcw, Thermometer, Waves } from 'lucide-react';
import { Link } from 'wouter';
import { CABIN_SPECS, evaluateCabin, type CabinKey } from '@/lib/cabin-readings';
import { useCabinReadings } from '@/hooks/use-cabin-readings';
import './cabin-readings.css';

const CABIN_ICONS: Record<CabinKey, typeof Gauge> = {
  oxygen: Waves,
  co2: CloudFog,
  pressure: Gauge,
  temperature: Thermometer,
  humidity: Droplets,
};

const statusLabel = (severity: string) => severity === 'red' ? 'Alert' : severity === 'yellow' ? 'Attention' : 'Normal';

export function CabinReadingsPanel({ compact = false }: { compact?: boolean }) {
  const { readings, error, setReading, reset } = useCabinReadings();
  const evaluated = readings ? evaluateCabin(readings) : null;
  const summary = !evaluated ? 'Unknown'
    : evaluated.redItems.length ? `${evaluated.redItems.length} alert`
    : evaluated.yellowItems.length ? `${evaluated.yellowItems.length} attention` : 'Normal';

  return <section className="panel cabin-panel" aria-labelledby="cabin-title" data-testid="panel-cabin">
    <header className="cabin-head">
      <h2 id="cabin-title">Cabin air</h2>
      <span className={`vital-zone-pill zone-${evaluated?.overall ?? 'unknown'}`} data-testid="status-cabin-overall">{summary}</span>
      <span className="cabin-note">Cabin demo · no live sensors</span>
    </header>
    {error && <p className="cabin-error" role="alert" data-testid="status-cabin-error"><AlertTriangle size={16} aria-hidden="true" />{error}</p>}
    {!evaluated ? <div className="cabin-unknown" data-testid="status-cabin-unknown">
      <strong>Cabin readings unknown</strong>
      <span>Saved sample data is unavailable. Unknown is not Normal.</span>
      <button type="button" className="btn small" onClick={reset} data-testid="button-cabin-reset-unknown"><RotateCcw size={15} />Reset sample values</button>
    </div> : <>
      <div className="cabin-grid">
        {evaluated.items.map(({ spec, value, formattedValue, severity }) => {
          const Icon = CABIN_ICONS[spec.key];
          return <article key={spec.key} className={`metric-card compact-reading cabin-card vital-card-${severity}`} data-testid={`card-cabin-${spec.key}`}
            aria-label={`Cabin ${spec.label}: ${formattedValue} ${spec.unit}, ${statusLabel(severity)}`}>
            <div className="metric-top"><span>{spec.label}</span><span className="metric-icon"><Icon aria-hidden="true" /></span></div>
            <div className="metric-value" data-testid={`value-cabin-${spec.key}`}>{formattedValue} <span className="metric-unit">{spec.unit}</span></div>
            <span className={`vital-zone-pill zone-${severity}`} data-testid={`status-cabin-${spec.key}`}>{statusLabel(severity)}</span>
            {!compact && <details className="reading-controls">
              <summary data-testid={`details-cabin-${spec.key}`}>Adjust sample</summary>
              <span className="short-hint">Sample band {spec.normalRangeText} · not a flight limit</span>
              <div className="metric-adjust">
                <input type="range" min={spec.min} max={spec.max} step={spec.step} value={value}
                  onChange={e => setReading(spec.key, Number(e.target.value))}
                  aria-label={`Cabin ${spec.label} sample`} data-testid={`input-cabin-${spec.key}`} />
                <div className="metric-step-row">
                  <button type="button" className="choice metric-step-btn" aria-label={`Decrease cabin ${spec.label}`} data-testid={`button-cabin-decrease-${spec.key}`}
                    onClick={() => setReading(spec.key, Math.max(spec.min, Number((value - spec.step).toFixed(spec.decimals))))}>−</button>
                  <button type="button" className="choice metric-step-btn" aria-label={`Increase cabin ${spec.label}`} data-testid={`button-cabin-increase-${spec.key}`}
                    onClick={() => setReading(spec.key, Math.min(spec.max, Number((value + spec.step).toFixed(spec.decimals))))}>+</button>
                </div>
              </div>
            </details>}
          </article>;
        })}
      </div>
      <div className="cabin-foot">
        <span className="short-hint">Sample bands, not approved flight limits.</span>
        <button type="button" className="btn small outline" onClick={reset} data-testid="button-cabin-reset"><RotateCcw size={15} />Reset sample values</button>
      </div>
    </>}
  </section>;
}

export function CabinAlertBanner() {
  const { readings } = useCabinReadings();
  if (!readings) return <aside className="cabin-banner cabin-banner-unknown" role="status" data-testid="banner-cabin-unknown">
    <AlertTriangle size={17} aria-hidden="true" /><span><strong>Cabin air unknown</strong> · demo data unavailable</span>
    <Link href="/alerts" className="btn small outline" data-testid="link-cabin-banner-unknown">Check</Link>
  </aside>;
  const { redItems } = evaluateCabin(readings);
  if (!redItems.length) return null;
  return <aside className="cabin-banner" role="status" aria-live="polite" data-testid="banner-cabin-red">
    <AlertTriangle size={17} aria-hidden="true" />
    <span><strong>Cabin demo alert</strong> · {redItems.map(i => `${i.spec.label} ${i.formattedValue} ${i.spec.unit}`).join(' · ')}</span>
    <Link href="/alerts" className="btn small outline" data-testid="link-cabin-banner">View</Link>
  </aside>;
}

export { CABIN_SPECS };
