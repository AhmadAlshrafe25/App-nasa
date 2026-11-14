import type { BodySystem } from './body-regions';

/**
 * Named anatomical meshes map into illustrative demo regions. Unmatched mesh names use
 * normalized bounds as a fallback; sensor mapping is not clinically validated.
 */

/**
 * Single openly licensed model (Écorché by Charleeh, CC BY-SA 4.0) used for both tabs.
 * Loaded directly from the upstream repository for now. To pin or self-host later, change
 * only this constant (e.g. a commit-pinned raw URL or `${import.meta.env.BASE_URL}api/storage/public-objects/anatomy/ecorche-360.glb`).
 */
export const MODEL_URL = 'https://raw.githubusercontent.com/Charleeh/ecorche/320805e06aee51e2e6f6b22533eb2a59d43f2d4d/model/ecorche.meshopt.glb';

/**
 * Model orientation fixes. Convention after correction: the person faces +Z (toward the camera
 * at yaw 0), head is +Y, and the person's LEFT is +X.
 * - If the model shows its back at yaw 0, set MODEL_YAW_OFFSET_DEG to 180.
 * - If it faces sideways, use 90 or -90.
 * - If left/right appear swapped after facing is correct, set MODEL_MIRROR_X to true.
 */
export const MODEL_YAW_OFFSET_DEG = 0;
export const MODEL_MIRROR_X = false;

const PAIRED = new Set(['chest', 'shoulder', 'upperArm', 'forearm', 'hand', 'thigh', 'knee', 'lowerLeg', 'foot']);

/**
 * h: 0 at feet, 1 at top of head. xn: -1..1 across body width (+ = person's left).
 * zn: -1..1 front-back (+ = front).
 */
export function classifyPoint(h: number, xn: number, zn: number, system: BodySystem): string {
  const ax = Math.abs(xn);
  let seg: string;
  if (h > 0.875) seg = 'head';
  else if (h > 0.825 && ax < 0.2) seg = 'neck';
  else if (h > 0.45 && ax > 0.36) {
    // Arms (assumes arms roughly at the sides / slightly abducted)
    if (h > 0.76) seg = 'shoulder';
    else if (h > 0.62) seg = 'upperArm';
    else if (h > 0.5) seg = 'forearm';
    else seg = 'hand';
  } else if (h > 0.765) seg = ax > 0.22 ? 'shoulder' : 'chest';
  else if (h > 0.62) seg = 'chest';
  else if (h > 0.53) seg = 'core';
  else if (h > 0.45) seg = ax > 0.36 ? 'hand' : 'pelvis';
  else if (h > 0.3) seg = 'thigh';
  else if (h > 0.25) seg = 'knee';
  else if (h > 0.045) seg = 'lowerLeg';
  else seg = 'foot';

  if (system === 'bone' && ax < 0.07 && zn < 0 && h > 0.53 && h < 0.83 && (seg === 'chest' || seg === 'core')) return 'spine-C';
  if (!PAIRED.has(seg)) return `${seg}-C`;
  return `${seg}-${xn >= 0 ? 'L' : 'R'}`;
}

/** Human-readable label for the current yaw. Yaw 90 shows the person's right side. */
export function yawLabel(yaw: number): string {
  const y = ((Math.round(yaw) % 360) + 360) % 360;
  const sector = y <= 22 || y >= 338 ? 'Front' : y < 68 ? 'Front, right side' : y <= 112 ? 'Right side' : y < 158 ? 'Back, right side'
    : y <= 202 ? 'Back' : y < 248 ? 'Back, left side' : y <= 292 ? 'Left side' : 'Front, left side';
  return `${sector} · ${y} degrees`;
}

export const isBackFacing = (yaw: number) => Math.cos((yaw * Math.PI) / 180) < 0;

type Seg = string;
/** Ordered keyword rules: first match wins. Ambiguous names (e.g. phalanges) fall back to position. */
const RULES: [RegExp, Seg][] = [
  [/capitis|cervic|atlas|axis\b|hyoid|sternocleidomastoid|scalen|platysma|splenius|levator scapulae|larynx|thyroid|cricoid|trachea/, 'neck'],
  [/skull|cran|frontal|parietal|occipit|temporal|mandib|maxill|zygomat|nasal|sphenoid|ethmoid|lacrimal|vomer|palatin|masseter|orbicularis|buccinator|mentalis|labii|auricul|tooth|teeth|eye|procerus|corrugator|risorius|depressor anguli|nasalis/, 'head'],
  [/(thoracic|lumbar) vertebra|vertebra|intervertebral/, 'spine'],
  [/deltoid|clavic|supraspinatus|infraspinatus|teres|subscapularis|acromi/, 'shoulder'],
  [/scapula|pectoral|\brib\b|ribs|costal|stern(um|al)|intercostal|serratus|trapezius|latissimus|rhomboid|subclavius/, 'chest'],
  [/abdomin|oblique|erector|spinalis|longissimus|iliocostalis|multifidus|quadratus lumborum|rotatores/, 'core'],
  [/humer|biceps brachii|triceps|brachialis|coracobrachialis|anconeus/, 'upperArm'],
  [/radius|ulna|brachioradialis|pronator|supinator|carpi|palmaris longus|pollicis longus/, 'forearm'],
  [/scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|carpal|thenar|pollicis|of hand|palmar/, 'hand'],
  [/patella|popliteus|menisc/, 'knee'],
  [/tibia|fibula|gastrocnemius|soleus|peroneus|fibularis|plantaris|hallucis longus|digitorum longus/, 'lowerLeg'],
  [/tars|calcane|talus|navicular|cuboid|cuneiform|of foot|plantar|hallucis/, 'foot'],
  [/femur|femoris|vastus|sartorius|gracilis|adductor|semitendinosus|semimembranosus|tensor fasciae|pectineus/, 'thigh'],
  [/glute|piriformis|iliacus|psoas|hip bone|coxal|ilium|ischium|pubi|sacrum|sacral|coccyx|obturator|gemell/, 'pelvis'],
];

/** Classify a named anatomical mesh into a demo region key. Returns null when the name is ambiguous. */
export function classifyByName(name: string, side: 'L' | 'R' | 'C', system: BodySystem): string | null {
  const n = name.toLowerCase();
  const rule = RULES.find(([re]) => re.test(n));
  if (!rule) return null;
  const seg = rule[1];
  if (seg === 'spine' && system === 'muscle') return null;
  if (seg === 'spine' || !PAIRED.has(seg)) return `${seg}-C`;
  return side === 'C' ? null : `${seg}-${side}`;
}
