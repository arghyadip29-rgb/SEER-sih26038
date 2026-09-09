// Packet composer — assembles L0…L4 into one context packet per request.
// The API never sees a naked image; it always reads through this layer.

import { SYSTEM_PROMPT, RAW_SYSTEM } from './systemPrompt.js';
import { RUBRIC, PRIORS, LESION_GLOSSARY, PACKET_VERSION } from './rubric.js';
import { ANCHORS, LESION_ATLAS, STUB_NEIGHBORS } from './atlas.js';

export { PACKET_VERSION };

const LAYERS = ['L0-instructions', 'L1-rubric', 'L2-anchors', 'L3-neighbors(stub)', 'L4-case'];

export const VARIANTS = ['raw', 'rubric', 'anchors', 'full'];

// variant controls how much context rides along — the ablation axis:
// raw     = no context layer (baseline)
// rubric  = L0 + L1 + L4 (instructions, criteria, case facts)
// anchors = + L2 (grade pins + lesion atlas)
// full    = + L3 (precedent cases) — the production packet
export function buildPacket(caseCtx = {}, variant = 'full') {
  if (!VARIANTS.includes(variant)) throw new Error(`unknown packet variant: ${variant}`);
  if (variant === 'raw') {
    return { version: PACKET_VERSION, variant, layers: ['raw (no context)'], system: RAW_SYSTEM, userText: 'Grade this fundus photo 0-4. JSON only.', anchors: [], atlas: [], neighbors: {} };
  }
  const { age = '-', years = '-', eye = '-', camera = '-', quality = '-', sharpness = '-', source = '-' } = caseCtx;
  const rubricText = RUBRIC.map((r) => `L${r.grade} ${r.name}: ${r.rule} Next: ${r.action}`).join('\n');
  const lesionText = Object.entries(LESION_GLOSSARY).map(([k, v]) => `${k}: ${v.label} — ${v.plain}`).join('\n');
  const anchorText = variant === 'rubric' ? '(withheld for this variant)'
    : ANCHORS.map((a) => `${a.id} (grade ${a.grade}, ${a.dataset} ${a.ref}): ${a.note}`).join('\n');
  const atlasText = variant === 'rubric' ? '(withheld for this variant)'
    : LESION_ATLAS.map((a) => `${a.id} [${a.type}, ${a.dataset}]: ${a.note}`).join('\n');
  const neighborEntries = Object.entries(STUB_NEIGHBORS).filter(([, ns]) => ns.length);
  const neighborText = variant === 'full'
    ? (neighborEntries.length
      ? neighborEntries.map(([g, ns]) => `L${g}: ${ns.map((n) => `${n.id} — ${n.note}`).join('; ')}`).join('\n')
      : '(no confirmed precedent cases yet — grading from rubric + anchors only)')
    : '(withheld for this variant)';
  const layers = variant === 'full' ? LAYERS : variant === 'anchors'
    ? ['L0-instructions', 'L1-rubric', 'L2-anchors', 'L4-case']
    : ['L0-instructions', 'L1-rubric', 'L4-case'];

  const userText =
`CASE CONTEXT (L4): ${age}y, diabetes ${years}y, ${eye}, camera ${camera}. Local quality ${quality}/100 (${sharpness}), source ${source}.

GRADING RUBRIC (L1) — apply exactly:
${rubricText}

PRIORS: ${PRIORS}

LESION TYPES (only these six):
${lesionText}

GRADE ANCHORS (L2) — fixed references, do not drift from them:
${anchorText}

LESION ATLAS (L2):
${atlasText}

PRECEDENT CASES (L3) — similar confirmed eyes:
${neighborText}

Now read the attached fundus photo in the order: quality → structures → lesions → grade → referral. JSON only.`;

  return {
    version: PACKET_VERSION,
    variant,
    layers,
    system: SYSTEM_PROMPT,
    userText,
    anchors: ANCHORS,
    atlas: LESION_ATLAS,
    neighbors: STUB_NEIGHBORS,
  };
}

// Human-readable preview for GET /api/context/packet (transparency + audit UI).
export function packetPreview() {
  const p = buildPacket({ age: 54, years: 8, eye: 'Right eye', camera: 'Portable — Remidio', quality: 84, sharpness: 'Sharp · even light', source: 'preview' });
  return { version: p.version, layers: p.layers, system: p.system, userText: p.userText, anchors: p.anchors, atlas: p.atlas, neighbors: p.neighbors };
}
