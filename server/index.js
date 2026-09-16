import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load server/.env (gitignored) so the vision provider sees VISION_API_URL/KEY.
// process.env always wins — safe on hosts that inject env vars directly.
try {
  const envFile = join(dirname(fileURLToPath(import.meta.url)), '.env');
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
} catch { /* env optional — mock provider covers offline */ }
import { VERDICTS } from './context/verdicts.js';
import { PACKET_VERSION, buildPacket, packetPreview } from './context/packet.js';
import { lesionsToFindings } from './context/rubric.js';
import { applyRules } from './context/rules.js';
import { gradeWithVision, imageStats } from './context/provider.js';
import { recordAnalysis, recordCorrection, stats as memoryStats, recentAudit, recentCorrections } from './context/memory.js';
import { initDb, pgMode } from './db/store.js';

const app = express();
const PORT = process.env.PORT || 4000;
app.use(cors());
app.use(express.json({ limit: '2mb' }));
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024 } });

const SEEDS = [11, 22, 33, 44, 55];

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'drishti-api', packet: PACKET_VERSION, time: new Date().toISOString() }));

// Unified analysis pipeline: packet (L0–L4) → vision provider → rules (L5) → memory.
// JSON sample path: { sample: 0..4 }  OR multipart with image + meta fields.
app.post('/api/analyze', upload.single('image'), async (req, res) => {
  const t0 = Date.now();
  try {
    const hasSample = req.body && typeof req.body.sample !== 'undefined' && req.body.sample !== '';
    const forcedGrade = hasSample ? Math.max(0, Math.min(4, Number(req.body.sample))) : null;
    const imageBuffer = req.file?.buffer || null;
    const mime = req.file?.mimetype || 'image/jpeg';
    const { age = '-', years = '-', eye = '-', camera = '-' } = req.body || {};
    const source = imageBuffer ? 'upload' : hasSample ? 'sample' : 'empty';

    // Local quality estimate first (free pre-gate — bad photos never waste API).
    const st = imageBuffer ? imageStats(imageBuffer) : { seed: SEEDS[forcedGrade ?? 2], dark: false, avg: 120 };
    const quality = imageBuffer ? (st.dark ? 58 : 84 + (st.seed % 10)) : 84;
    const sharpness = st.dark ? 'Soft · dim left edge' : 'Sharp · even light';

    const packet = buildPacket({ age, years, eye, camera, quality, sharpness, source });
    const out = await gradeWithVision({ imageBuffer, mime, forcedGrade, packet });
    const ruled = applyRules({ proposal: out.proposal, quality, sharpness });

    const v = VERDICTS[ruled.grade];
    const findings = ruled.lesions.length ? lesionsToFindings(ruled.lesions) : v.findings;
    const action = ruled.action || v.action;

    const trace = {
      aid: null,
      packetVersion: PACKET_VERSION,
      layers: packet.layers,
      anchors: packet.anchors.map((a) => a.id),
      neighbors: Object.entries(packet.neighbors).map(([g, ns]) => `L${g}:${ns.map((n) => n.id).join(',')}`),
      rulesApplied: ruled.rulesApplied,
      provider: out.provider,
      latencyMs: Date.now() - t0,
      degraded: out.degraded,
      apiError: out.apiError || null,
    };
    trace.aid = await recordAnalysis({ grade: ruled.grade, confidence: ruled.confidence, quality, source, provider: out.provider, rules: ruled.rulesApplied });

    res.json({
      grade: ruled.grade,
      confidence: ruled.confidence,
      quality, sharpness,
      seed: imageBuffer ? st.seed : SEEDS[ruled.grade],
      dark: !!st.dark,
      title: v.title, action, findings,
      source,
      needsRetake: ruled.needsRetake,
      needsReview: ruled.needsReview,
      notes: ruled.notes,
      trace,
    });
  } catch (e) {
    res.status(500).json({ error: 'Analysis failed', detail: String(e?.message || e) });
  }
});

// Transparency: inspect the exact packet the API reads through.
app.get('/api/context/packet', (_req, res) => res.json(packetPreview()));

// Memory: stats, audit trail, doctor corrections (the P1 training signal).
app.get('/api/memory/stats', async (_req, res) => res.json({ store: pgMode() ? 'pg' : 'file', packet: PACKET_VERSION, ...(await memoryStats()) }));
app.get('/api/audit', async (req, res) => res.json({ audits: await recentAudit(req.query.limit), corrections: await recentCorrections(req.query.limit) }));

// Last ablation run (written by `npm run eval`). Null until first run.
app.get('/api/eval/last', (_req, res) => {
  try {
    const f = join(dirname(fileURLToPath(import.meta.url)), 'data', 'eval-last.json');
    if (!existsSync(f)) return res.json(null);
    res.json(JSON.parse(readFileSync(f, 'utf8')));
  } catch { res.json(null); }
});
app.post('/api/corrections', async (req, res) => {
  try {
    const { aid = null, caseId = null, correctedGrade, reason = '', doctor = '' } = req.body || {};
    res.json(await recordCorrection({ aid, caseId, correctedGrade, reason, doctor }));
  } catch (e) {
    res.status(400).json({ error: String(e?.message || e) });
  }
});

function answerChat(question = '', ctx = {}) {
  const s = String(question).toLowerCase();
  const has = (a) => s.includes(a);
  const g = ctx.grade;
  const v = g != null && VERDICTS[g] ? VERDICTS[g] : null;
  if (!v && (has('see') || has('grade') || has('level') || has('verdict') || has('find'))) return 'No verdict yet — upload a fundus photograph and select Analyze, or pick a standard sample. Retinal findings will be itemized according to ICDR criteria.';
  if (has('photo') || has('quality') || has('blur') || has('dark') || has('good enough') || has('retake'))
    return v ? `Image quality assessment: ${ctx.quality}/100 — ${ctx.sharpness}. ${ctx.quality < 65 ? 'Suboptimal illumination or focus; treat findings cautiously and consider acquiring a repeat fundus photograph.' : 'Gradable quality meeting screening criteria. Automated contrast normalization performed.'}` : 'Upload a fundus image first — image gradability (focus, illumination, field of view) is evaluated prior to grading.';
  if (has('why') || has('this grade') || has('grade') || has('level') || has('sure') || has('confiden'))
    return `Diagnostic rationale for Grade ${g}: ${v.findings.map((f) => f.h).join(' · ')}. Classifier confidence: ${ctx.confidence}%. Saliency map demonstrates spatial concordance with identified lesions. Findings should be clinician-verified.`;
  if (has('spot') || has('see') || has('bleed') || has('yellow') || has('vessel') || has('lesion') || has('find') || has('micro') || has('exudate') || has('hemorrhage'))
    return `Identified retinal features: ${v.findings.map((f) => f.h).join(' — ')}. Clinical significance: Microaneurysms represent capillary outpouchings; Hard Exudates represent lipoprotein leakage; Retinal Hemorrhages denote vessel integrity loss; Neovascularization (Grade 4) denotes ischemia-driven preretinal vessel proliferation.`;
  if (has('next') || has('refer') || has('tell') || has('patient') || has('treat') || has('advice') || has('hindi'))
    return ({ 0: 'No referral indicated for DR. Patient advice: “Retinal appearance within normal limits. Maintain target glycemic and blood pressure levels; schedule annual dilated screening.”', 1: 'Routine review in 6–12 months. Patient advice: “Mild early microvascular changes detected. Emphasize glycemic control; re-screen in 6–12 months.”', 2: 'Priority ophthalmology referral (within 4–6 weeks). Patient advice: “Diabetic changes present in retina requiring ophthalmic examination. Vision preservation interventions are available.”', 3: 'Urgent ophthalmologist consultation (within 1–2 weeks). Patient advice: “Severe non-proliferative changes with multiple quadrants involved. Prompt ophthalmic intervention advised.”', 4: 'Urgent same-day / immediate ophthalmology evaluation. Patient advice: “Active proliferative vessels present with imminent risk of vitreous hemorrhage or vision impairment. Urgent hospital evaluation required.”' })[g] + ` (Confidence ${ctx.confidence}%.)`;
  if (has('heatmap') || has('grad') || has('explain') || has('proof') || has('attention'))
    return 'The attention overlay (Grad-CAM saliency map) highlights retinal regions providing maximal feature contribution to the ICDR severity grade. Validate spatial concordance with segmented retinal lesions.';
  if (has('simulink') || has('scale') || has('bandwidth') || has('matlab'))
    return 'Screening throughput modeling: images compressed (~150 KB), edge-capable offline inference, deferred telemetry sync. Simulink hardware sizing projects capacity for 100,000+ patient encounters per district annually with target >90% sensitivity for referable DR (Grade 2+).';
  if (has('hello') || has('namaste') || s.trim() === 'hi') return v ? `Greetings. Current case is classified as Grade ${g} (${v.title}) — ask “what next?” for clinical referral recommendations.` : 'Greetings. Upload a retinal fundus photograph or choose a reference sample to begin screening.';
  return v ? `For this Grade ${g} case: ${v.action} Ask regarding “identified findings”, “grading criteria”, or “image quality” for clinical details.` : 'Upload or pick a reference sample first, then inquire regarding lesions, ICDR grade, referral urgency, or image quality.';
}

app.post('/api/chat', (req, res) => {
  const { question, context } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Empty question' });
  res.json({ answer: answerChat(question, context || {}) });
});

app.post('/api/report', (req, res) => {
  const { grade = 2, age = '-', years = '-', eye = '-', confidence = '-', quality = '-' } = req.body || {};
  const v = VERDICTS[Math.max(0, Math.min(4, Number(grade)))] || VERDICTS[2];
  const txt = `SEER — DIABETIC RETINOPATHY SCREENING REPORT (ICDR Framework)\nPatient: ${age}y, diabetes duration ${years}y, ${eye}\nICDR Classification: ${v.title} (${confidence}% confidence)\nImage Gradability: ${quality}/100\nKey Retinal Findings:\n${v.findings.map((f) => '- ' + f.h + ': ' + f.p).join('\n')}\nClinical Recommendation: ${v.action}\nNotice: AI-assisted screening assessment. Definitive diagnosis requires clinician examination.`;
  res.type('text/plain').send(txt);
});

const db = await initDb().catch((e) => ({ mode: 'file', reason: String(e?.message || e).slice(0, 120) }));
app.listen(PORT, () => console.log(`drishti-api listening on http://localhost:${PORT} (packet ${PACKET_VERSION}, store ${db.mode}${db.reason ? `: ${db.reason}` : ''})`));
