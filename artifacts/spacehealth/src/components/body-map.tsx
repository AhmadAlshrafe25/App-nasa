import { useEffect, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CircleDot, Info, Unplug, Eye, ZoomIn, ZoomOut, X } from 'lucide-react';
import muscleFront from '@/assets/anatomy/body-0.webp';
import muscleBack from '@/assets/anatomy/body-1.webp';
import boneFront from '@/assets/anatomy/body-2.webp';
import boneBack from '@/assets/anatomy/body-3.webp';

import { getBodyRegions, statusLabel, type BodyScenario, type BodySystem, type BodyView, type RegionStatus } from '@/lib/body-regions';
import './body-map.css';

const ART = { muscle: { front: muscleFront, back: muscleBack }, bone: { front: boneFront, back: boneBack } } as const;
const ZOOMS = [1, 1.4, 1.8];

const scenarios: { id: BodyScenario; label: string }[] = [
  { id: 'simulated', label: 'Mixed demo (default)' },
  { id: 'flagged', label: 'Flagged regions' },
  { id: 'disconnected', label: 'Disconnected sensors' },
];

const StatusIcon = ({ status }: { status: RegionStatus }) => {
  const Icon = status === 'flagged' ? AlertTriangle : status === 'attention' ? Eye : status === 'unavailable' ? Unplug : CircleDot;
  return <Icon size={15} aria-hidden="true" />;
};

export function BodyMap({ system }: { system: BodySystem }) {
  const [scenario, setScenario] = useState<BodyScenario>('simulated');
  const [view, setView] = useState<BodyView>('front');
  const [zoom, setZoom] = useState(0);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const regions = getBodyRegions(system, view, scenario);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => { setSelectedId(null); setHoverId(null); }, [system, view]);
  const selected = regions.find(r => r.id === selectedId);
  const readout = regions.find(r => r.id === hoverId) ?? selected;
  const counts = regions.reduce<Record<RegionStatus, number>>((acc, r) => { acc[r.status]++; return acc; }, { normal: 0, attention: 0, flagged: 0, unavailable: 0 });

  const onKey = (event: KeyboardEvent, index: number) => {
    const map: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next: number | null = null;
    if (event.key in map) next = (index + map[event.key] + regions.length) % regions.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = regions.length - 1;
    if (next === null) return;
    event.preventDefault();
    setSelectedId(regions[next].id);
    document.getElementById(`body-region-shape-${regions[next].id}`)?.focus();
  };

  return <div className={`body-map system-${system}`} data-testid="panel-body-map">
    <div className="body-map-banner" data-testid="status-body-map-disclosure">
      <Info size={16} aria-hidden="true" />
      <p><strong>SIMULATED SENSOR MAP.</strong> No hardware connected. Not a scan or diagnosis. Statuses are fictional demo flags for review, not confirmed damage.</p>
    </div>
    <div className="body-scenario" role="group" aria-label="Demo sensor scenario">
      <span className="body-scenario-label">Demo scenario</span>
      {scenarios.map(s => <button key={s.id} type="button" aria-pressed={scenario === s.id}
        className={scenario === s.id ? 'active' : ''} onClick={() => setScenario(s.id)}
        data-testid={`button-body-scenario-${s.id}`}>{s.label}</button>)}
    </div>
    <div className="body-scenario" role="group" aria-label="Body view">
      <span className="body-scenario-label">View</span>
      {(['front', 'back'] as const).map(v => <button key={v} type="button" aria-pressed={view === v}
        className={view === v ? 'active' : ''} onClick={() => setView(v)}
        data-testid={`button-body-view-${v}`}>{v === 'front' ? 'Front' : 'Back'}</button>)}
    </div>
    <div className={`body-map-grid ${selected ? 'has-selection' : 'no-selection'}`}>
      <figure className="body-figure">
        <div className="body-orient" data-testid="text-body-orientation">
          {view === 'front'
            ? <><span>Person's RIGHT</span><b>FRONT · facing you</b><span>Person's LEFT</span></>
            : <><span>Person's LEFT</span><b>BACK · facing away</b><span>Person's RIGHT</span></>}
        </div>
        <div className="body-zoom-bar">
          <span className="body-art-note" data-testid="text-body-art-disclosure">Illustrative anatomy · simulated sensor overlay · not validated diagnostic anatomy</span>
          <button type="button" aria-label="Zoom out" disabled={zoom === 0} onClick={() => setZoom(z => Math.max(0, z - 1))} data-testid="button-body-zoom-out"><ZoomOut size={18} aria-hidden="true" /></button>
          <output data-testid="value-body-zoom">{Math.round(ZOOMS[zoom] * 100)}%</output>
          <button type="button" aria-label="Zoom in" disabled={zoom === ZOOMS.length - 1} onClick={() => setZoom(z => Math.min(ZOOMS.length - 1, z + 1))} data-testid="button-body-zoom-in"><ZoomIn size={18} aria-hidden="true" /></button>
        </div>
        {readout ? <div className={`holo-readout status-${readout.status}`} aria-live="polite" data-testid="text-body-hover-readout">
          <StatusIcon status={readout.status} />
          <span className="holo-readout-name">{readout.label}</span>
          <span className="holo-readout-status">{statusLabel[readout.status]}</span>
        </div> : <p className="holo-readout" data-testid="text-body-select-hint">Tap a body part to see its status and simulation sample. Keyboard: Tab to a region, then Enter.</p>}
        <div className="body-art-scroll">
          <div className="body-art holo" style={{ width: `${ZOOMS[zoom] * 100}%` }}>
            <img src={ART[system][view]} alt={`Illustrative ${system === 'muscle' ? 'muscle' : 'skeleton'} anatomy, ${view} view. Not a scan.`} width={512} height={512} draggable={false} data-testid="img-body-anatomy" />
            <span className="holo-grid" aria-hidden="true" />
            <span className="holo-scan" aria-hidden="true" />
            <svg viewBox="0 0 512 512" role="group" aria-label="Select a body part for its simulation sample" onPointerLeave={() => setHoverId(null)}>
              {regions.map((r, index) => <path key={r.id} d={r.d} id={`body-region-shape-${r.id}`}
                role="button" tabIndex={0} aria-label={`${r.label}: ${statusLabel[r.status]}. Show simulation sample`}
                aria-pressed={r.id === selectedId}
                className={`region-shape status-${r.status} ${r.id === selectedId ? 'is-selected' : ''}`}
                onPointerEnter={() => setHoverId(r.id)}
                onFocus={() => setHoverId(r.id)} onBlur={() => setHoverId(null)}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedId(r.id); setHoverId(null); }
                  else onKey(event, index);
                }}
                onClick={() => { setSelectedId(r.id); setHoverId(null); }} data-testid={`shape-body-region-${r.id}`}><title>{`${r.label}: ${statusLabel[r.status]}`}</title></path>)}
            </svg>
          </div>
        </div>
        <figcaption className="body-legend-row">
          {(['normal', 'attention', 'flagged', 'unavailable'] as const).map(s => <span key={s} className={`legend-chip status-${s}`}><StatusIcon status={s} />{statusLabel[s]} <b>{counts[s]}</b></span>)}
        </figcaption>
      </figure>
      {selected && <div className="body-side">
        <article className={`region-detail status-${selected.status}`} aria-live="polite" data-testid="panel-body-region-detail">
          <button type="button" className="region-detail-close" aria-label="Close body part details" onClick={() => setSelectedId(null)}><X size={18} aria-hidden="true" /></button>
          <span className="region-detail-kicker">Selected region · simulated sample</span>
          <h3 data-testid="text-body-region-label">{selected.label}</h3>
          <p className="region-detail-status" data-testid="status-body-region"><StatusIcon status={selected.status} />{statusLabel[selected.status]}</p>
          <dl>
            <dt>Sample reading (fictional)</dt>
            <dd data-testid="text-body-region-reading">{selected.sampleReading ?? 'Unavailable — sensor disconnected, no value'}</dd>
            <dt>Sensor (simulated, not connected)</dt>
            <dd>{selected.sensorLabel}</dd>
          </dl>
          <p className="region-detail-explain">{selected.explanation}</p>
          {selected.status === 'flagged' && <p className="region-detail-next">Review the sample. For any real concern, follow mission protocol and contact the medical team.</p>}
        </article>
      </div>}
    </div>
  </div>;
}
