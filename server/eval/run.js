// Ablation runner — measures what each context layer adds.
//
// Usage:
//   node eval/run.js --synthetic 120
//   node eval/run.js --images ./data/eval-imgs --labels ./data/eval-labels.csv --variants raw,rubric,anchors,full --limit 60
//
// Labels CSV: header `file,grade` with grade 0-4, files resolved under --images.
// --synthetic N: N pseudo-cases with balanced expected grades (validates the
//   harness plumbing + metrics math; the mock provider will mostly disagree,
//   which is the honest baseline — real gains appear with VISION_API_KEY set).
// Results: prints a markdown table + writes server/data/eval-last.json
// (served at GET /api/eval/last for the Memory page).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import { buildPacket, VARIANTS } from '../context/packet.js';
import { gradeWithVision, providerName } from '../context/provider.js';
import { accuracy, qwk, referableMetrics } from './metrics.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, '..', 'data');
const OUT_FILE = join(DATA_DIR, 'eval-last.json');

function args() {
  const a = process.argv.slice(2);
  const o = { variants: VARIANTS.join(','), limit: 200, synthetic: 0 };
  for (let i = 0; i < a.length; i++) {
    const k = a[i];
    if (k === '--images') o.images = a[++i];
    else if (k === '--labels') o.labels = a[++i];
    else if (k === '--variants') o.variants = a[++i];
    else if (k === '--limit') o.limit = Number(a[++i]);
    else if (k === '--synthetic') o.synthetic = Number(a[++i]);
    else if (k === '--out') o.out = a[++i];
  }
  return o;
}

function loadCases(o) {
  if (o.synthetic) {
    const cases = [];
    for (let i = 0; i < o.synthetic; i++) {
      cases.push({ id: `SYN-${String(i).padStart(3, '0')}`, buffer: randomBytes(4096), mime: 'image/jpeg', expected: i % 5 });
    }
    return cases;
  }
  if (!o.images || !o.labels) throw new Error('need --images DIR --labels labels.csv (or --synthetic N)');
  const rows = readFileSync(o.labels, 'utf8').trim().split(/\r?\n/).slice(1);
  const cases = [];
  for (const r of rows) {
    const [file, grade] = r.split(',').map((s) => s.trim());
    const p = join(o.images, file);
    if (!existsSync(p)) { console.warn(`skip missing ${file}`); continue; }
    cases.push({ id: basename(file), buffer: readFileSync(p), mime: file.endsWith('.png') ? 'image/png' : 'image/jpeg', expected: Number(grade) });
    if (cases.length >= o.limit) break;
  }
  return cases;
}

const estTokens = (packet) => Math.round(((packet.system.length + packet.userText.length) / 4) + 1000); // ~1k image tokens, rough

async function runVariant(variant, cases) {
  const expected = [], predicted = [];
  let latency = 0, provider = providerName();
  for (const c of cases) {
    const packet = buildPacket({ age: 54, years: 8, eye: 'Right eye', camera: 'Portable', quality: 84, sharpness: 'Sharp', source: 'eval' }, variant);
    const t0 = Date.now();
    const out = await gradeWithVision({ imageBuffer: c.buffer, mime: c.mime, packet });
    latency += Date.now() - t0;
    provider = out.provider;
    expected.push(c.expected);
    predicted.push(out.proposal.grade);
  }
  const ref = referableMetrics(expected, predicted);
  const samplePacket = buildPacket({}, variant);
  return {
    variant, n: cases.length, provider,
    accuracy: +accuracy(expected, predicted).toFixed(3),
    qwk: +qwk(expected, predicted).toFixed(3),
    sensL2: +ref.sensitivity.toFixed(3),
    specL2: +ref.specificity.toFixed(3),
    tp: ref.tp, tn: ref.tn, fp: ref.fp, fn: ref.fn,
    avgLatencyMs: Math.round(latency / cases.length),
    estTokensPerCase: estTokens(samplePacket),
  };
}

const o = args();
const variants = o.variants.split(',').map((s) => s.trim()).filter((v) => VARIANTS.includes(v));
if (!variants.length) throw new Error(`no valid variants (choose from ${VARIANTS.join(',')})`);
const cases = loadCases(o);
if (!cases.length) throw new Error('no cases loaded');
console.log(`cases=${cases.length} provider=${providerName()} variants=${variants.join(',')}`);

const rows = [];
for (const v of variants) {
  process.stdout.write(`running ${v}… `);
  const r = await runVariant(v, cases);
  rows.push(r);
  console.log(`acc=${r.accuracy} qwk=${r.qwk} sens=${r.sensL2} spec=${r.specL2}`);
}

// Sanity line: perfect predictions must score 1.0 (validates the math, not the model).
const perfect = cases.map((c) => c.expected);
console.log(`sanity qwk(perfect)=${qwk(perfect, perfect)} (must be 1)`);

mkdirSync(DATA_DIR, { recursive: true });
const payload = { at: new Date().toISOString(), provider: providerName(), synthetic: !!o.synthetic, rows };
writeFileSync(o.out || OUT_FILE, JSON.stringify(payload, null, 1));

console.log('\n| variant | n | acc | qwk | sens L2+ | spec L2+ | ms/case | ~tok |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.variant} | ${r.n} | ${r.accuracy} | ${r.qwk} | ${r.sensL2} | ${r.specL2} | ${r.avgLatencyMs} | ${r.estTokensPerCase} |`);
console.log(`\nwrote ${o.out || OUT_FILE}`);
if (!process.env.VISION_API_KEY) console.log('NOTE: mock provider active — this run validates plumbing + math. Set VISION_API_KEY for real layer gains.');
