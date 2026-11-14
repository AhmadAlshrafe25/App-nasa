import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import type { BodySystem, RegionStatus } from '@/lib/body-regions';
import { classifyByName, classifyPoint, MODEL_MIRROR_X, MODEL_YAW_OFFSET_DEG } from '@/lib/body-3d';

/** A picked anatomical mesh. key is namespaced: "bone:thigh-L" or "muscle:thigh-L". */
export type MeshPick = { key: string; name: string; uuid: string };

export type Viewer3DProps = {
  url: string;
  statusByKey: Record<string, RegionStatus>;
  selectedUuid: string | null;
  /** Keyboard focus highlight: highlights every mesh in this namespaced region key. */
  focusKey: string | null;
  yaw: number;
  zoom: number;
  label: string;
  onYawChange: (yaw: number) => void;
  onZoomChange: (zoom: number) => void;
  onSelect: (pick: MeshPick) => void;
  onHover: (pick: MeshPick | null) => void;
  onKeys: (keys: { key: string; name: string; uuid: string }[]) => void;
  onError: (message: string) => void;
  /** Selected mesh center in host pixels; null when nothing selected. Fired after each render. */
  onAnchor?: (a: { x: number; y: number; w: number; h: number; inView: boolean } | null) => void;
};

const CYAN = new THREE.Color('#62F5E2');
const BASE_EMISSIVE = new THREE.Color('#0b3f3b');
const STATUS_COLOR: Record<RegionStatus, THREE.Color> = {
  normal: new THREE.Color('#4ade80'), attention: new THREE.Color('#facc15'),
  flagged: new THREE.Color('#f87171'), unavailable: new THREE.Color('#9ca3af'),
};
const MIX: Record<RegionStatus, number> = { normal: 0.8, attention: 0.85, flagged: 0.9, unavailable: 0.8 };

type Layer = 'muscle' | 'skeleton';
type Data = { regionKey: string; layer: Layer; displayName: string; own: THREE.MeshPhongMaterial };
type Tagged = THREE.Mesh<THREE.BufferGeometry, THREE.Material> & { userData: Data };

function inherited(obj: THREE.Object3D, field: string): string {
  for (let o: THREE.Object3D | null = obj; o; o = o.parent) {
    const v = (o.userData as Record<string, unknown>)?.[field];
    if (typeof v === 'string' && v) return v;
  }
  return '';
}
const pretty = (s: string) => s.replace(/[_.]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/^./, c => c.toUpperCase());

export default function BodyViewer3D(props: Viewer3DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const api = useRef<{ render: () => void; recolor: () => void } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      propsRef.current.onError('3D is not supported on this device.');
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = 'viewer3d-canvas';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    scene.add(new THREE.AmbientLight(0x9ff8ee, 0.8));
    const keyLight = new THREE.DirectionalLight(0xe5fffb, 1.4); keyLight.position.set(2, 3, 4); scene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x62f5e2, 1.1); rim.position.set(-3, 1, -4); scene.add(rim);
    const pivot = new THREE.Group(); scene.add(pivot);
    const meshes: Tagged[] = [];
    let hoverUuid: string | null = null;

    let frame = 0;
    let disposed = false;
    const anchorBox = new THREE.Box3(), anchorV = new THREE.Vector3();
    let lastAnchor = '';
    const emitAnchor = () => {
      const p = propsRef.current;
      const mesh = p.selectedUuid ? meshes.find(m => m.uuid === p.selectedUuid) : undefined;
      const w = host.clientWidth, h = host.clientHeight;
      let a: { x: number; y: number; w: number; h: number; inView: boolean } | null = null;
      if (mesh && w && h) {
        scene.updateMatrixWorld(true);
        camera.updateMatrixWorld();
        anchorBox.setFromObject(mesh).getCenter(anchorV).project(camera);
        const x = Math.round((anchorV.x + 1) / 2 * w), y = Math.round((1 - anchorV.y) / 2 * h);
        a = { x, y, w, h, inView: anchorV.z >= -1 && anchorV.z <= 1 && x >= 0 && x <= w && y >= 0 && y <= h };
      }
      const sig = a ? `${mesh!.uuid},${a.x},${a.y},${a.w},${a.h},${a.inView}` : '';
      if (sig === lastAnchor) return;
      lastAnchor = sig;
      p.onAnchor?.(a);
    };
    const render = () => {
      if (frame || disposed) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const p = propsRef.current;
        pivot.rotation.y = THREE.MathUtils.degToRad(p.yaw);
        camera.position.set(0, 0, 4.5 / p.zoom);
        camera.lookAt(0, 0, 0);
        renderer.render(scene, camera);
        emitAnchor();
      });
    };
    /** Materials only: severity color always kept; hover/selection strengthen emissive and opacity. */
    const recolor = () => {
      const { statusByKey, selectedUuid, focusKey } = propsRef.current;
      for (const mesh of meshes) {
        const d = mesh.userData;
        const status = statusByKey[d.regionKey] ?? 'unavailable';
        const sc = STATUS_COLOR[status];
        const selected = mesh.uuid === selectedUuid;
        const hovered = mesh.uuid === hoverUuid || (focusKey !== null && d.regionKey === focusKey);
        const m = d.own;
        const isMuscle = d.layer === 'muscle';
        m.color.copy(selected || hovered ? sc : CYAN.clone().lerp(sc, MIX[status]));
        m.emissive.copy(selected ? sc.clone().multiplyScalar(0.6) : hovered ? sc.clone().multiplyScalar(0.45) : BASE_EMISSIVE);
        m.opacity = isMuscle ? (selected ? 0.75 : hovered ? 0.6 : 0.22) : (selected || hovered ? 1 : 0.92);
        m.depthWrite = !isMuscle || selected || hovered;
      }
      render();
    };
    api.current = { render, recolor };

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(host);
    resize();

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(propsRef.current.url, gltf => {
      const model = gltf.scene;
      const originals = new Set<THREE.Material>();
      model.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => originals.add(x)); });
      const disposeOriginals = () => originals.forEach(m => {
        Object.values(m).forEach(val => { if (val instanceof THREE.Texture) val.dispose(); });
        m.dispose();
      });
      if (disposed) { disposeOriginals(); model.traverse(o => (o as THREE.Mesh).geometry?.dispose()); return; }
      model.rotation.y = THREE.MathUtils.degToRad(MODEL_YAW_OFFSET_DEG);
      if (MODEL_MIRROR_X) model.scale.x *= -1;
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 2 / Math.max(size.y, 1e-9);
      const holder = new THREE.Group();
      holder.scale.setScalar(scale);
      holder.position.set(-center.x * scale, -center.y * scale, -center.z * scale);
      const halfW = Math.max(size.x / 2, 1e-9), halfD = Math.max(size.z / 2, 1e-9);
      const mb = new THREE.Box3(), mc = new THREE.Vector3();
      model.traverse(obj => {
        const mesh = obj as Tagged;
        if (!mesh.isMesh) return;
        const name = inherited(mesh, 'name') || mesh.name || '';
        const layerRaw = inherited(mesh, 'layer').toLowerCase();
        const tissue = inherited(mesh, 'tissue').toLowerCase();
        const sideRaw = (inherited(mesh, 'side') || name.split(' ')[0]).toLowerCase();
        const layer: Layer = layerRaw ? (layerRaw.includes('muscle') ? 'muscle' : 'skeleton')
          : ['bone', 'cartilage', 'tooth'].includes(tissue) ? 'skeleton' : 'muscle';
        mb.setFromObject(mesh).getCenter(mc);
        const xn = (mc.x - center.x) / halfW;
        const side = sideRaw.startsWith('left') ? 'L' : sideRaw.startsWith('right') ? 'R' : 'C';
        const system: BodySystem = layer === 'muscle' ? 'muscle' : 'bone';
        const key = classifyByName(name, side, system)
          ?? classifyPoint((mc.y - box.min.y) / size.y, side === 'L' ? Math.abs(xn) : side === 'R' ? -Math.abs(xn) : xn, (mc.z - center.z) / halfD, system);
        const own = new THREE.MeshPhongMaterial({ transparent: true, shininess: 70, specular: new THREE.Color('#62F5E2') });
        mesh.material = own;
        mesh.renderOrder = layer === 'muscle' ? 2 : 1;
        mesh.userData = { ...mesh.userData, regionKey: `${system}:${key}`, layer, displayName: pretty(name) || 'Unnamed part', own };
        meshes.push(mesh);
      });
      // Classify fallback mesh bounds before normalization changes their coordinate space.
      holder.add(model);
      pivot.add(holder);
      disposeOriginals();
      if (!meshes.length) { propsRef.current.onError('The model has no parts.'); return; }
      const seen = new Map<string, { key: string; name: string; uuid: string }>();
      for (const m of meshes) if (!seen.has(m.userData.regionKey)) seen.set(m.userData.regionKey, { key: m.userData.regionKey, name: m.userData.displayName, uuid: m.uuid });
      propsRef.current.onKeys([...seen.values()].sort((a, b) => (a.key.startsWith('bone') ? 0 : 1) - (b.key.startsWith('bone') ? 0 : 1)));
      setLoading(false);
      recolor();
    }, undefined, () => {
      if (!disposed) propsRef.current.onError('Could not load the 3D model.');
    });

    // Picking: closest BONE along the ray wins (through translucent muscle); muscles are the fallback.
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const pick = (clientX: number, clientY: number): Tagged | null => {
      const r = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(meshes, false);
      const bone = hits.find(h => (h.object as Tagged).userData.layer === 'skeleton');
      return ((bone ?? hits[0])?.object as Tagged | undefined) ?? null;
    };
    const toPick = (m: Tagged): MeshPick => ({ key: m.userData.regionKey, name: m.userData.displayName, uuid: m.uuid });
    const setHover = (m: Tagged | null) => {
      const id = m?.uuid ?? null;
      if (id === hoverUuid) return;
      hoverUuid = id;
      recolor();
      propsRef.current.onHover(m ? toPick(m) : null);
    };

    let down: { x: number; y: number; yaw: number; id: number } | null = null;
    let dragging = false;
    let hoverFrame = 0;
    const el = renderer.domElement;
    const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, yaw: propsRef.current.yaw, id: e.pointerId }; dragging = false; };
    const onMove = (e: PointerEvent) => {
      if (down && e.pointerId === down.id) {
        const dx = e.clientX - down.x, dy = e.clientY - down.y;
        if (!dragging && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) { dragging = true; el.setPointerCapture(e.pointerId); setHover(null); }
        if (dragging) { propsRef.current.onYawChange(down.yaw + dx * 0.6); return; }
      }
      if (e.pointerType !== 'mouse' || hoverFrame) return;
      const { clientX, clientY } = e;
      hoverFrame = requestAnimationFrame(() => { hoverFrame = 0; setHover(pick(clientX, clientY)); });
    };
    const onUp = (e: PointerEvent) => {
      if (down && !dragging && e.pointerId === down.id) {
        const m = pick(e.clientX, e.clientY);
        if (m) propsRef.current.onSelect(toPick(m));
      }
      down = null; dragging = false;
    };
    const onCancel = () => { down = null; dragging = false; };
    const onLeave = () => { cancelAnimationFrame(hoverFrame); hoverFrame = 0; setHover(null); };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setHover(null);
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? host.clientHeight : 1;
      const delta = Math.max(-200, Math.min(200, e.deltaY * unit));
      propsRef.current.onZoomChange(propsRef.current.zoom * Math.exp(-delta * 0.002));
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hoverFrame);
      ro.disconnect();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('wheel', onWheel);
      for (const m of meshes) { m.geometry.dispose(); m.userData.own.dispose(); }
      renderer.dispose();
      renderer.forceContextLoss();
      el.remove();
      api.current = null;
    };
  }, [props.url]);

  useEffect(() => { api.current?.render(); }, [props.yaw, props.zoom]);
  useEffect(() => { api.current?.recolor(); }, [props.statusByKey, props.selectedUuid, props.focusKey]);

  return <div className="viewer3d-host" ref={hostRef} aria-busy={loading}>
    {loading && <div className="viewer3d-loading" role="status" data-testid="status-body-3d-loading">
      <span className="viewer3d-skeleton" aria-hidden="true" />Loading body model...
    </div>}
    <span className="sr-only">{props.label}</span>
  </div>;
}
