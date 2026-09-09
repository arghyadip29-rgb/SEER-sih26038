// L2 — Visual anchors (few-shot pins) + L3 stub neighbors.
//
// P0: anchors are dataset-grounded DESCRIPTORS. Drop real images into
// server/context/anchors/ named anchor-L0.jpg … anchor-L4.jpg and
// atlas-ma.jpg / atlas-he.jpg / atlas-ex.jpg / atlas-nv.jpg — the loader
// below picks them up automatically and attaches them to API calls.
// P1 replaces STUB_NEIGHBORS with vector retrieval over screened cases.

import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
export const ANCHOR_DIR = join(here, 'anchors');
const MAX_ANCHOR_BYTES = 800 * 1024;

export const ANCHORS = [
  { id: 'anchor-L0', grade: 0, dataset: 'IDRiD', ref: 'healthy pool (516-image grading set)', note: 'Even vessel tree, sharp disc, clean macula. The "normal" everything is measured against.' },
  { id: 'anchor-L1', grade: 1, dataset: 'IDRiD', ref: 'microaneurysm-only cases', note: 'A few pin-head red dots, nothing else. Boundary that stops L0 overcalls.' },
  { id: 'anchor-L2', grade: 2, dataset: 'IDRiD + APTOS rural', ref: 'bleed/exudate-positive cases', note: 'First bleed or yellow deposit = referral threshold. The most important boundary.' },
  { id: 'anchor-L3', grade: 3, dataset: 'IDRiD', ref: 'multi-zone bleed cases', note: 'Bleeds in several zones + beaded vessels. Urgency, not routine referral.' },
  { id: 'anchor-L4', grade: 4, dataset: 'IDRiD', ref: 'neovascularization cases', note: 'Lacy new vessels at disc/arcades. Any trace forces L4 — emergency.' },
];

export const LESION_ATLAS = [
  { id: 'atlas-ma', type: 'microaneurysm', dataset: 'IDRiD masks (81 imgs)', note: '2–5 px red dots near capillaries. ≈0.1% of image area — small counts matter.' },
  { id: 'atlas-he', type: 'hemorrhage', dataset: 'IDRiD masks (80 imgs)', note: 'Blot/flame red patches, larger than MAs. Count zones, not just spots.' },
  { id: 'atlas-ex', type: 'hard_exudate', dataset: 'IDRiD masks (81 imgs)', note: 'Sharp yellow-white deposits, often ringed near the macula.' },
  { id: 'atlas-nv', type: 'neovascularization', dataset: 'IDRiD severe cases', note: 'Fine lacy loops that ignore normal branching. Never normal — always L4.' },
];

// P0 stub: empty until real confirmed cases exist. P1 replaces this with
// embedding retrieval over the analyses/corrections tables. Kept as a map so
// the packet shape (and the ablation axis) stays stable.
export const STUB_NEIGHBORS = { 0: [], 1: [], 2: [], 3: [], 4: [] };

// Optional real anchor images. Returns [{id, mime, base64}] — empty when the
// folder has no matching files, so the demo runs without the dataset on disk.
export function loadAnchorImages() {
  try {
    if (!existsSync(ANCHOR_DIR)) return [];
    const out = [];
    for (const f of readdirSync(ANCHOR_DIR)) {
      const m = f.match(/^(anchor-L[0-4]|atlas-[a-z]+)\.(jpg|jpeg|png)$/i);
      if (!m) continue;
      const p = join(ANCHOR_DIR, f);
      if (statSync(p).size > MAX_ANCHOR_BYTES) continue;
      const ext = m[2].toLowerCase() === 'png' ? 'png' : 'jpeg';
      out.push({ id: m[1].toUpperCase() === m[1] ? m[1] : m[1], mime: `image/${ext}`, base64: readFileSync(p).toString('base64') });
    }
    return out;
  } catch { return []; }
}
