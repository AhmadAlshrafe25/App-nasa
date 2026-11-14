import { lazy, Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CircleDot, Eye, Unplug, ZoomIn, ZoomOut, X, RotateCcw } from 'lucide-react';
import { getBodyRegions, regionKey, statusLabel, type BodyRegion, type BodySystem, type RegionStatus } from '@/lib/body-regions';
import { isBackFacing, MODEL_URL, yawLabel } from '@/lib/body-3d';
import type { MeshPick } from './body-viewer-3d';
import './body-map.css';
import './body-viewer-3d.css';

const BodyViewer3D = lazy(() => import('./body-viewer-3d'));
const SCENARIO = 'simulated' as const;
const norm = (y: number) => ((y % 360) + 360) % 360;

type Anchor = { x: number; y: number; w: number; h: number; inView: boolean };

/** Short, plain meaning per status and system. Demo only, never a diagnosis. */
function issueCopy(region: BodyRegion): { what: string; next?: string } {
  const bone = region.system === 'bone';
  const place = region.label.toLowerCase();
  switch (region.status) {
    case 'attention': return bone
      ? { what: `Low bone loading in the ${place}.`, next: 'Review the sample trend and exercise plan.' }
      : { what: `Low muscle activity in the ${place}.`, next: 'Review the sample trend and exercise plan.' };
    case 'flagged': return bone
      ? { what: `Weakness warning in the ${place}. Not a detected fracture.`, next: 'For a real concern, contact the medical team before loading this area.' }
      : { what: `Weakness warning in the ${place}. Not a diagnosed injury.`, next: 'For a real concern, contact the medical team.' };
    case 'unavailable': return { what: 'No sample available.' };
    default: return { what: 'No concern in this sample.' };
  }
}

function Callout({ pick, region, anchor, onClose }: { pick: MeshPick; region: BodyRegion; anchor: Anchor; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 260, h: 160 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(s => (s.w === el.offsetWidth && s.h === el.offsetHeight) ? s : { w: el.offsetWidth, h: el.offsetHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pad = 8, gap = 18;
  const cx = Math.min(Math.max(anchor.x, 0), anchor.w), cy = Math.min(Math.max(anchor.y, 0), anchor.h);
  const right = cx + gap + size.w <= anchor.w - pad || cx < anchor.w / 2;
  let left = right ? cx + gap : cx - gap - size.w;
  left = Math.min(Math.max(left, pad), Math.max(pad, anchor.w - size.w - pad));
  const top = Math.min(Math.max(cy - size.h / 2, pad), Math.max(pad, anchor.h - size.h - pad - 52));
  const arrowY = Math.min(Math.max(cy - top, 14), size.h - 14);
  const overlapsTarget = cx > left && cx < left + size.w;
  const copy = issueCopy(region);
  const st = region.status;
  return <div ref={ref} className={`bm-callout status-${st} ${right ? 'is-right' : 'is-left'}`} role="dialog" aria-modal="false"
    aria-labelledby="bm-callout-title" style={{ transform: `translate(${Math.round(left)}px, ${Math.round(top)}px)` }}
    onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} onPointerMove={e => e.stopPropagation()}
    onWheel={e => e.stopPropagation()}
    onKeyDown={e => { if (e.key === 'Escape') onClose(); e.stopPropagation(); }}
    data-testid="panel-body-region-detail">
    {anchor.inView && !overlapsTarget && <span className="bm-callout-pin" style={{ top: arrowY }} aria-hidden="true" />}
    <button type="button" className="bm-close" aria-label="Close" onClick={onClose} data-testid="button-body-detail-close"><X size={16} aria-hidden="true" /></button>
    <span className="bm-callout-tag">Simulated</span>
    <h3 id="bm-callout-title" data-testid="text-body-region-label">{pick.name}</h3>
    <p className="bm-status" data-testid="status-body-region"><StatusIcon status={st} />{statusLabel[st]}</p>
    <p className="bm-callout-what" data-testid="text-body-region-issue">{copy.what}</p>
    {copy.next && <p className="bm-callout-next">{copy.next}</p>}
    <p className="bm-sample" data-testid="text-body-region-reading"><span>Demo · {region.label}</span><strong>{region.sampleReading ?? 'Unavailable'}</strong></p>
    {!anchor.inView && <p className="bm-callout-off">Selected part is out of view. Rotate to see it.</p>}
  </div>;
}

const StatusIcon = ({ status }: { status: RegionStatus }) => {
  const Icon = status === 'flagged' ? AlertTriangle : status === 'attention' ? Eye : status === 'unavailable' ? Unplug : CircleDot;
  return <Icon size={15} aria-hidden="true" />;
};

/** All demo regions for both systems, keyed "muscle:thigh-L" / "bone:thigh-L" so they never collide. */
function useRegionIndex(back: boolean) {
  return useMemo(() => {
    const idx: Record<string, BodyRegion> = {};
    for (const system of ['muscle', 'bone'] as BodySystem[]) {
      // Back-view labels first then current view overrides, so spine (back only) is always present.
      for (const view of back ? ['front', 'back'] as const : ['back', 'front'] as const)
        for (const r of getBodyRegions(system, view, SCENARIO)) idx[`${system}:${regionKey(r)}`] = r;
    }
    return idx;
  }, [back]);
}

export function BodyMap() {
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [yaw, setYawRaw] = useState(0);
  const setYaw = (y: number) => setYawRaw(norm(Math.round(y)));
  const [zoom, setZoomRaw] = useState(1);
  const setZoom = (value: number) => setZoomRaw(Math.max(1, Math.min(3, Math.round(value * 100) / 100)));
  const [hover, setHover] = useState<MeshPick | null>(null);
  const [selected, setSelectedRaw] = useState<MeshPick | null>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const setSelected = (p: MeshPick | null) => { if (p?.uuid !== selected?.uuid) setAnchor(null); setSelectedRaw(p); };
  const [keys, setKeys] = useState<MeshPick[]>([]);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const index = useRegionIndex(isBackFacing(yaw));
  const statusByKey = useMemo(() => {
    const out: Record<string, RegionStatus> = {};
    for (const [k, r] of Object.entries(index)) out[k] = r.status;
    return out;
  }, [index]);

  const focusPick = focusIdx !== null ? keys[focusIdx] ?? null : null;
  const readout = hover ?? focusPick;
  const readoutRegion = readout ? index[readout.key] : undefined;
  const selRegion = selected ? index[selected.key] : undefined;

  return <div className="body-map" data-testid="panel-body-map">
    <div className="bm-stage">
      {loadError ? <div className="viewer3d-error" role="alert" data-testid="status-body-3d-error">
        <AlertTriangle size={18} aria-hidden="true" />
        <p>{loadError}</p>
        <button type="button" onClick={() => { setLoadError(null); setAttempt(a => a + 1); }} data-testid="button-body-3d-retry"><RotateCcw size={15} aria-hidden="true" /> Retry</button>
      </div> : <div className="viewer3d-frame holo" tabIndex={0} role="application"
        aria-label={`Body model, ${yawLabel(yaw)}. Drag to rotate, scroll to zoom. Left and Right rotate. Plus and Minus zoom. Up and Down move through parts, Enter selects.`}
        onBlur={() => setFocusIdx(null)}
        onKeyDown={event => {
          const step = event.shiftKey ? 45 : 15;
          if (event.key === 'ArrowLeft') setYaw(yaw - step);
          else if (event.key === 'ArrowRight') setYaw(yaw + step);
          else if (event.key === '+' || event.key === '=') setZoom(zoom + 0.1);
          else if (event.key === '-') setZoom(zoom - 0.1);
          else if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && keys.length) {
            const d = event.key === 'ArrowDown' ? 1 : -1;
            setFocusIdx(i => i === null ? (d > 0 ? 0 : keys.length - 1) : (i + d + keys.length) % keys.length);
          } else if (event.key === 'Enter' && focusPick) setSelected(focusPick);
          else if (event.key === 'Escape') { setSelected(null); setFocusIdx(null); }
          else return;
          event.preventDefault();
        }} data-testid="viewer-body-3d">
        <span className="holo-grid" aria-hidden="true" />
        <span className="holo-scan" aria-hidden="true" />
        <Suspense fallback={<div className="viewer3d-loading" role="status"><span className="viewer3d-skeleton" aria-hidden="true" />Loading body model...</div>}>
          <BodyViewer3D key={attempt} url={MODEL_URL} statusByKey={statusByKey}
            selectedUuid={selected?.uuid ?? null} focusKey={focusPick?.key ?? null}
            yaw={yaw} zoom={zoom} label={yawLabel(yaw)} onYawChange={setYaw} onZoomChange={setZoom}
            onSelect={setSelected} onHover={setHover} onKeys={setKeys} onError={setLoadError} onAnchor={setAnchor} />
        </Suspense>
        <div className={`bm-hover ${readoutRegion ? `status-${readoutRegion.status}` : ''}`} aria-live="polite" data-testid="text-body-hover-readout">
          {readout && readoutRegion
            ? <><StatusIcon status={readoutRegion.status} /><strong>{focusPick && !hover ? readoutRegion.label : readout.name}</strong><span>{statusLabel[readoutRegion.status]}</span></>
            : <span className="bm-hint">Drag to rotate · Scroll to zoom · Tap a part</span>}
        </div>
        {selected && selRegion && anchor && <Callout key={selected.uuid} pick={selected} region={selRegion} anchor={anchor} onClose={() => setSelected(null)} />}
      </div>}

      <div className="bm-controls">
        <div className="bm-seg" role="group" aria-label="Facing">
          <button type="button" aria-pressed={!isBackFacing(yaw)} onClick={() => setYaw(0)} data-testid="button-body-view-front">Front</button>
          <button type="button" aria-pressed={isBackFacing(yaw)} onClick={() => setYaw(180)} data-testid="button-body-view-back">Back</button>
        </div>
        <input className="bm-yaw" type="range" min={0} max={359} step={1} value={yaw} aria-label="Rotate body"
          aria-valuetext={yawLabel(yaw)} onChange={e => setYaw(Number(e.target.value))} data-testid="input-body-yaw" />
      </div>
      <div className="bm-zoom-controls" role="group" aria-label="Zoom controls">
        <label htmlFor="body-zoom">Zoom</label>
        <button type="button" aria-label="Zoom out" disabled={zoom <= 1} onClick={() => setZoom(zoom - 0.1)} data-testid="button-body-zoom-out"><ZoomOut size={17} aria-hidden="true" /></button>
        <input id="body-zoom" type="range" min={1} max={3} step={0.01} value={zoom} aria-valuetext={`${Math.round(zoom * 100)} percent`} onChange={e => setZoom(Number(e.target.value))} data-testid="input-body-zoom" />
        <button type="button" aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(zoom + 0.1)} data-testid="button-body-zoom-in"><ZoomIn size={17} aria-hidden="true" /></button>
        <output htmlFor="body-zoom" data-testid="value-body-zoom">{Math.round(zoom * 100)}%</output>
        <button type="button" onClick={() => setZoom(1)} disabled={zoom === 1} data-testid="button-body-zoom-reset">Reset</button>
      </div>
    </div>


    <div className="bm-legend" aria-label="Status colors">
      {(['normal', 'attention', 'flagged', 'unavailable'] as const).map(s => <span key={s} className={`status-${s}`}><StatusIcon status={s} />{statusLabel[s].replace(' · demo', '')}</span>)}
    </div>
    <details className="bm-credits" data-testid="text-body-model-credit">
      <summary>Model credits</summary>
      <p><a href="https://github.com/Charleeh/ecorche" target="_blank" rel="noreferrer">Écorché by Charleeh</a>, CC BY-SA 4.0, based on BodyParts3D © The Database Center for Life Science, CC BY 4.0, and Z-Anatomy by Gauthier Kervyn, CC BY-SA 4.0. Region colors are an illustrative demo overlay.</p>
    </details>
  </div>;
}
