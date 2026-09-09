// Dataset normalizer — converts each public set into harness format:
//   <out>/images/<file> + <out>/labels.csv  (header: file,grade 0-4)
// plus a manifest.json describing what was found.
//
//   node eval/datasets/prepare.js --dataset aptos --src ./raw/aptos --out ./data/eval-aptos
//   node eval/datasets/prepare.js --dataset idrid-grade --src ./raw/idrid --out ./data/eval-idrid
//   node eval/datasets/prepare.js --dataset idrid-lesions --src ./raw/idrid --out ./data/lesions-idrid
//   node eval/datasets/prepare.js --dataset drive --src ./raw/drive --out ./data/vessels-drive
//   node eval/datasets/prepare.js --dataset messidor --src ./raw/messidor --out ./data/eval-messidor [--labels grades.csv] [--pairing pairing.xls]
//
// Lesion/vessel sets produce a manifest (masks staged under masks/) instead of
// labels.csv — they feed the grounding/segmentation checks, not the grader.

import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, basename, extname } from 'path';

const IMG_EXTS = new Set(['.jpg', '.jpeg', '.png', '.tif', '.tiff']);

function args() {
  const a = process.argv.slice(2);
  const o = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) o[a[i].slice(2)] = a[i + 1]?.startsWith('--') || a[i + 1] === undefined ? true : a[++i];
  }
  if (!o.dataset || !o.src || !o.out) throw new Error('need --dataset aptos|idrid-grade|idrid-lesions|drive|messidor --src DIR --out DIR');
  return o;
}

// Minimal CSV reader (handles quoted commas).
function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; }
      else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cur += c;
  }
  row.push(cur);
  if (row.length > 1 || row[0] !== '') rows.push(row);
  return rows;
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function findImages(dir) {
  return walk(dir).filter((p) => IMG_EXTS.has(extname(p).toLowerCase()));
}

function ensureOut(out) {
  mkdirSync(join(out, 'images'), { recursive: true });
  mkdirSync(join(out, 'masks'), { recursive: true });
}

function writeLabels(out, rows) {
  writeFileSync(join(out, 'labels.csv'), 'file,grade\n' + rows.map(([f, g]) => `${f},${g}`).join('\n') + '\n');
}

function copyInto(src, out, sub = 'images') {
  const dest = join(out, sub, basename(src));
  copyFileSync(src, dest);
  return basename(src);
}

// Flexible header matching: returns {idCol, gradeCol} or throws listing headers.
function detectColumns(headers, { idHints, gradeHints, exclude = [] }) {
  const H = headers.map((h) => h.trim());
  const low = H.map((h) => h.toLowerCase());
  const idCol = H.findIndex((_, i) => idHints.some((re) => re.test(low[i])));
  const gradeCol = H.findIndex((_, i) =>
    gradeHints.some((re) => re.test(low[i])) && !exclude.some((re) => re.test(low[i])));
  if (idCol < 0 || gradeCol < 0) throw new Error(`columns not detected. headers: [${H.join(' | ')}]`);
  return { idCol, gradeCol, idName: H[idCol], gradeName: H[gradeCol] };
}

function resolveImage(imagesByBase, id) {
  const key = String(id).trim();
  return imagesByBase.get(key) || imagesByBase.get(key.toLowerCase()) || null;
}

function indexByBase(files) {
  const m = new Map();
  for (const f of files) {
    const base = basename(f, extname(f));
    if (!m.has(base)) m.set(base, f);
    const l = base.toLowerCase();
    if (!m.has(l)) m.set(l, f);
  }
  return m;
}

// ---- APTOS 2019: train.csv(id_code,diagnosis) + train_images/*.png ----
function aptos(src, out) {
  const csvPath = join(src, 'train.csv');
  if (!existsSync(csvPath)) throw new Error(`missing ${csvPath} (Kaggle download first)`);
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const H = rows[0].map((h) => h.trim().toLowerCase());
  const idCol = H.indexOf('id_code'), gCol = H.indexOf('diagnosis');
  if (idCol < 0 || gCol < 0) throw new Error(`unexpected train.csv headers: [${rows[0].join('|')}]`);
  const pool = indexByBase(findImages(src));
  const labels = [];
  let missing = 0;
  for (const r of rows.slice(1)) {
    const f = resolveImage(pool, r[idCol]);
    if (!f) { missing += 1; continue; }
    labels.push([copyInto(f, out), Math.max(0, Math.min(4, Number(r[gCol])))]);
  }
  writeLabels(out, labels);
  return { images: labels.length, missing, note: 'APTOS rural-camp photos → grading/kappa' };
}

// ---- IDRiD grading: 516 imgs + CSV with DR (+DME) grades, flexible headers ----
function idridGrade(src, out, opt) {
  const csvPath = opt.labels || walk(src).find((p) => p.toLowerCase().endsWith('.csv'));
  if (!csvPath) throw new Error('no CSV found — pass --labels <csv>');
  const rows = parseCsv(readFileSync(csvPath, 'utf8'));
  const { idCol, gradeCol, idName, gradeName } = detectColumns(rows[0], {
    idHints: [/^(image|file|image name|filename|id)$/, /name/],
    gradeHints: [/diabetic retinopathy/, /^dr( grade| severity)?$/, /retinopathy grade/, /grade/],
    exclude: [/edema|macula|dme|oedema/],
  });
  const pool = indexByBase(findImages(src));
  const labels = [];
  let missing = 0, dme = 0;
  for (const r of rows.slice(1)) {
    if (!r[idCol]) continue;
    const f = resolveImage(pool, r[idCol]);
    if (!f) { missing += 1; continue; }
    const g = Math.max(0, Math.min(4, Number(r[gradeCol])));
    if (!Number.isInteger(g)) continue;
    labels.push([copyInto(f, out), g]);
  }
  writeLabels(out, labels);
  return { images: labels.length, missing, dmeFlagged: dme, note: `id cols: ${idName} → ${gradeName}. Verify mapping above.` };
}

// ---- IDRiD lesions: 81 imgs + *_MA/*_HE/*_EX/*_SE/*_OD masks → manifest ----
function idridLesions(src, out) {
  const files = walk(src);
  const masks = { ma: new Map(), he: new Map(), ex: new Map(), se: new Map(), od: new Map() };
  for (const f of files) {
    const m = basename(f).match(/^(.*)_(MA|HE|EX|SE|OD)\.tiff?$/i);
    if (m && IMG_EXTS.has(extname(f).toLowerCase())) masks[m[2].toLowerCase()].set(m[1], f);
  }
  const pool = indexByBase(files.filter((f) => IMG_EXTS.has(extname(f).toLowerCase()) && !/_(MA|HE|EX|SE|OD)\.tiff?$/i.test(basename(f))));
  const items = [];
  for (const id of masks.ma.keys()) {
    const img = pool.get(id) || pool.get(id.toLowerCase());
    if (!img) continue;
    const entry = { file: copyInto(img, out), id, masks: {} };
    for (const k of Object.keys(masks)) {
      if (masks[k].has(id)) entry.masks[k] = 'masks/' + copyInto(masks[k].get(id), out, 'masks');
    }
    items.push(entry);
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ kind: 'idrid-lesions', images: items }, null, 1));
  const counts = Object.fromEntries(Object.entries(masks).map(([k, v]) => [k, v.size]));
  return { images: items.length, masks: counts, note: 'pixel masks → grounding eval (overlap of claimed lesions vs truth)' };
}

// ---- DRIVE: training/{images,1st_manual,mask} + test/{images,mask} → manifest ----
function drive(src, out) {
  const stage = (split) => {
    const d = join(src, split);
    if (!existsSync(d)) return [];
    const pool = indexByBase(walk(d));
    const imgs = findImages(join(d, 'images').toLowerCase && existsSync(join(d, 'images')) ? join(d, 'images') : d)
      .filter((f) => !/manual|mask/i.test(f));
    return imgs.map((f) => {
      const base = basename(f, extname(f)).replace(/_(training|test)$/i, '');
      const num = (base.match(/^\d+/) || [''])[0];
      const sameNum = (p) => ((basename(p).match(/^\d+/) || [''])[0] === num && num !== '');
      const vessel = [...pool.values()].find((p) => /manual/i.test(p) && sameNum(p));
      const mask = [...pool.values()].find((p) => /mask/i.test(p) && !/manual/i.test(p) && sameNum(p));
      return {
        file: copyInto(f, out), id: base,
        vessel: vessel ? 'masks/' + copyInto(vessel, out, 'masks') : null,
        mask: mask ? 'masks/' + copyInto(mask, out, 'masks') : null,
      };
    });
  };
  const train = stage('training'), test = stage('test');
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ kind: 'drive-vessels', train, test }, null, 1));
  return { train: train.length, test: test.length, note: 'vessel tracings → segmentation sanity check (Dice vs 1st_manual)' };
}

// ---- Messidor-2: images + optional third-party grades (no official labels) ----
function messidor(src, out, opt) {
  const imgs = findImages(src);
  const items = imgs.map((f) => ({ file: copyInto(f, out), id: basename(f, extname(f)) }));
  let labels = 0;
  if (opt.labels) {
    const rows = parseCsv(readFileSync(opt.labels, 'utf8'));
    const { idCol, gradeCol, idName, gradeName } = detectColumns(rows[0], {
      idHints: [/^(image|file|filename|id|name)$/, /name/],
      gradeHints: [/referable|dr|retinopathy|grade|label|diagnosis/],
    });
    const byId = new Map(items.map((i) => [i.id.toLowerCase(), i]));
    const lab = [];
    for (const r of rows.slice(1)) {
      const it = byId.get(String(r[idCol]).trim().toLowerCase());
      if (!it) continue;
      const g = Math.max(0, Math.min(4, Number(r[gradeCol])));
      if (!Number.isInteger(g)) continue;
      lab.push([it.file, g]); labels += 1;
    }
    writeLabels(out, lab);
    return { images: items.length, labels, note: `third-party grades via ${idName} → ${gradeName}. Cite the label source separately — NOT official Messidor-2 truth.` };
  }
  writeFileSync(join(out, 'manifest.json'), JSON.stringify({ kind: 'messidor-unlabeled', images: items.map((i) => i.file) }, null, 1));
  return { images: items.length, labels: 0, note: 'NO official grades ship with Messidor-2 — re-run with --labels <third-party.csv> for referable eval' };
}

const o = args();
ensureOut(o.out);
const FN = { aptos, 'idrid-grade': idridGrade, 'idrid-lesions': idridLesions, drive, messidor };
if (!FN[o.dataset]) throw new Error(`unknown --dataset (aptos|idrid-grade|idrid-lesions|drive|messidor)`);
const summary = FN[o.dataset](o.src, o.out, o);
console.log(JSON.stringify({ dataset: o.dataset, out: o.out, ...summary }, null, 1));
if (o.dataset === 'aptos' || o.dataset === 'idrid-grade' || (o.dataset === 'messidor' && summary.labels > 0)) console.log(`next: npm run eval -- --images ${o.out}/images --labels ${o.out}/labels.csv --limit 200`);
