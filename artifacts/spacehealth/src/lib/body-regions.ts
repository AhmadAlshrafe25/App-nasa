export type BodySystem = 'muscle' | 'bone';
export type BodyView = 'front' | 'back';
export type RegionStatus = 'normal' | 'attention' | 'flagged' | 'unavailable';
export type BodyScenario = 'simulated' | 'flagged' | 'disconnected';
type Side = 'L' | 'R' | 'C';

export type BodyRegion = {
  id: string;
  label: string;
  system: BodySystem;
  view: BodyView;
  side: Side;
  status: RegionStatus;
  /** Fictional sample text; null when unavailable (never shown as 0 or normal). */
  sampleReading: string | null;
  sensorLabel: string;
  explanation: string;
  /** SVG hotspot path in the 512 x 512 image coordinate space. */
  d: string;
};

type E = [number, number, number, number]; // cx, cy, rx, ry in 512x512 image space (viewer-left side)
type Hot = { center: number; seg: Record<string, E> };
/** Hotspots aligned to the illustrative anatomy images (see components/body-map.tsx). */
const HOT: Record<BodySystem, Record<BodyView, Hot>> = {
  muscle: {
    front: { center: 268, seg: { head: [268, 36, 22, 30], neck: [268, 74, 18, 11], shoulder: [216, 100, 18, 16], chest: [241, 122, 25, 22], core: [268, 172, 30, 36], upperArm: [205, 146, 13, 28], forearm: [190, 200, 13, 30], hand: [174, 246, 15, 22], pelvis: [268, 226, 38, 18], thigh: [244, 282, 21, 42], knee: [240, 336, 15, 15], lowerLeg: [240, 392, 13, 38], foot: [234, 456, 16, 13] } },
    back: { center: 241, seg: { head: [241, 30, 22, 28], neck: [241, 63, 18, 11], shoulder: [190, 105, 18, 18], chest: [213, 135, 26, 32], core: [241, 186, 22, 22], upperArm: [180, 152, 13, 28], forearm: [165, 202, 12, 30], hand: [147, 248, 14, 22], pelvis: [241, 225, 40, 24], thigh: [215, 290, 21, 42], knee: [215, 341, 15, 14], lowerLeg: [213, 387, 13, 38], foot: [207, 455, 14, 12] } },
  },
  bone: {
    front: { center: 267, seg: { head: [267, 30, 22, 30], neck: [267, 70, 10, 11], shoulder: [218, 90, 15, 13], chest: [245, 125, 22, 34], core: [267, 180, 16, 20], upperArm: [205, 136, 10, 32], forearm: [186, 200, 11, 32], hand: [168, 250, 15, 24], pelvis: [267, 220, 42, 24], thigh: [240, 280, 11, 42], knee: [238, 335, 12, 14], lowerLeg: [236, 395, 10, 40], foot: [232, 460, 15, 15] } },
    back: { center: 241, seg: { head: [241, 25, 22, 25], neck: [241, 60, 10, 11], shoulder: [198, 95, 15, 13], chest: [215, 135, 21, 30], core: [241, 190, 10, 14], upperArm: [178, 136, 10, 32], forearm: [160, 200, 11, 32], hand: [143, 255, 14, 22], pelvis: [241, 222, 40, 26], thigh: [213, 285, 11, 42], knee: [212, 340, 12, 14], lowerLeg: [213, 395, 10, 40], foot: [210, 460, 15, 13], spine: [241, 125, 7, 58] } },
  },
};
const PAIRED = new Set(['chest', 'shoulder', 'upperArm', 'forearm', 'hand', 'thigh', 'knee', 'lowerLeg', 'foot']);
const ellipseD = ([cx, cy, rx, ry]: E) => `M${cx - rx} ${cy} a${rx} ${ry} 0 1 0 ${2 * rx} 0 a${rx} ${ry} 0 1 0 ${-2 * rx} 0 Z`;

type Names = Record<string, string>;
const names: Record<BodySystem, Record<BodyView, Names>> = {
  muscle: {
    front: { head: 'Face and jaw (masseter)', neck: 'Neck (sternocleidomastoid)', chest: 'Chest (pectoralis)', core: 'Abdomen (rectus abdominis)', shoulder: 'Shoulder (anterior deltoid)', upperArm: 'Upper arm (biceps)', forearm: 'Forearm (flexors)', hand: 'Hand (palm, grip muscles)', pelvis: 'Hip flexors (iliopsoas)', thigh: 'Thigh (quadriceps)', knee: 'Knee (patellar tendon area)', lowerLeg: 'Shin (tibialis anterior)', foot: 'Foot (top, extensors)' },
    back: { head: 'Back of head (occipital)', neck: 'Neck (upper trapezius)', chest: 'Upper back (trapezius, latissimus)', core: 'Lower back (erector spinae)', shoulder: 'Shoulder (posterior deltoid)', upperArm: 'Upper arm (triceps)', forearm: 'Forearm (extensors)', hand: 'Hand (back)', pelvis: 'Buttocks (gluteals)', thigh: 'Thigh (hamstrings)', knee: 'Back of knee (popliteus)', lowerLeg: 'Calf (gastrocnemius, soleus)', foot: 'Heel and sole' },
  },
  bone: {
    front: { head: 'Skull and jaw (front)', neck: 'Cervical region (front)', chest: 'Ribs and sternum', core: 'Lower ribs and abdomen region', shoulder: 'Clavicle and shoulder joint', upperArm: 'Humerus', forearm: 'Radius and ulna', hand: 'Hand bones (carpals, metacarpals)', pelvis: 'Pelvis and hip joints', thigh: 'Femur', knee: 'Patella and knee joint', lowerLeg: 'Tibia and fibula', foot: 'Foot bones (metatarsals)' },
    back: { head: 'Skull (occipital)', neck: 'Cervical spine', chest: 'Scapula and posterior ribs', core: 'Lumbar region', shoulder: 'Shoulder blade joint', upperArm: 'Humerus (back)', forearm: 'Radius and ulna (back)', hand: 'Hand bones (back)', pelvis: 'Sacrum and pelvis', thigh: 'Femur (back)', knee: 'Knee joint (back)', lowerLeg: 'Tibia and fibula (back)', foot: 'Heel bone (calcaneus)', spine: 'Thoracic and lumbar spine' },
  },
};

const order = ['head', 'neck', 'shoulder', 'chest', 'core', 'upperArm', 'forearm', 'hand', 'pelvis', 'thigh', 'knee', 'lowerLeg', 'foot'];

// Overrides keyed by `${segment}:${anatomical side}` or `${segment}` (applies to all sides). Same across views.
const overrides: Record<BodyScenario, Record<BodySystem, Record<string, RegionStatus>>> = {
  simulated: { muscle: { core: 'attention', 'shoulder:R': 'attention', 'thigh:L': 'flagged' }, bone: { pelvis: 'attention', spine: 'attention', 'lowerLeg:L': 'flagged' } },
  flagged: {
    muscle: { 'thigh:L': 'flagged', 'lowerLeg:R': 'attention', core: 'attention', 'shoulder:R': 'flagged' },
    bone: { 'thigh:R': 'flagged', spine: 'attention', core: 'attention', 'foot:L': 'flagged', pelvis: 'attention' },
  },
  disconnected: {
    muscle: { lowerLeg: 'unavailable', foot: 'unavailable', 'shoulder:R': 'unavailable', 'hand:L': 'unavailable', core: 'attention' },
    bone: { lowerLeg: 'unavailable', foot: 'unavailable', 'hand:L': 'unavailable', neck: 'unavailable' },
  },
};

const statusNote: Record<RegionStatus, string> = {
  normal: 'Good · demo: within the fictional example pattern. Nothing to review.',
  attention: 'Danger · demo: the fictional sample drifted from the example pattern and is marked for a closer look during review.',
  flagged: 'Weakness/break concern · demo: a fictional concern flagged for review. No injury, weakness or break has been detected or diagnosed.',
  unavailable: 'Sensor disconnected in this demo. No sample is available, so no status is inferred.',
};

function hash(s: string) { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973; return h; }

export function getBodyRegions(system: BodySystem, view: BodyView, scenario: BodyScenario): BodyRegion[] {
  const keys = system === 'bone' && view === 'back' ? [...order, 'spine'] : order;
  const out: BodyRegion[] = [];
  for (const seg of keys) {
    const hot = HOT[system][view];
    const e = hot.seg[seg];
    const paired = PAIRED.has(seg);
    // Front view: viewer-left is the person's RIGHT. Back view: viewer-left is the person's LEFT.
    const mirrored: E = [2 * hot.center - e[0], e[1], e[2], e[3]];
    const sides: { side: Side; shape: E }[] = paired
      ? [{ side: view === 'front' ? 'R' : 'L', shape: e }, { side: view === 'front' ? 'L' : 'R', shape: mirrored }]
      : [{ side: 'C', shape: e }];
    for (const { side, shape } of sides) {
      const base = names[system][view][seg];
      const label = side === 'C' ? base : `${side === 'L' ? 'Left' : 'Right'} ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
      const ov = overrides[scenario][system];
      const status = ov[`${seg}:${side}`] ?? ov[seg] ?? 'normal';
      const id = `${system}-${view}-${seg}-${side}`;
      const n = hash(`${system}-${seg}-${side}`);
      const value = (0.32 + (n % 38) / 100).toFixed(2);
      const kind = system === 'muscle' ? 'Activity index' : 'Loading index';
      const sensor = `${system === 'muscle' ? 'Sim. EMG patch' : 'Sim. strain tag'} ${seg.slice(0, 2).toUpperCase()}${side === 'C' ? '' : '-' + side}${view === 'back' ? '-B' : ''}`;
      out.push({
        id, label, system, view, side, status, d: ellipseD(shape),
        sampleReading: status === 'unavailable' ? null : `${kind} ${value}`,
        sensorLabel: sensor,
        explanation: `Imagined ${system === 'muscle' ? 'surface activity' : 'mechanical loading'} sample for this region. Not a measurement, density scan or imaging result. ${statusNote[status]}`,
      });
    }
  }
  return out;
}

export const statusLabel: Record<RegionStatus, string> = {
  normal: 'Good · demo', attention: 'Danger · demo', flagged: 'Weakness/break concern · demo', unavailable: 'Unavailable',
};
