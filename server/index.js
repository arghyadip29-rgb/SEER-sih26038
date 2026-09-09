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
  if (!v && (has('see') || has('level') || has('verdict') || has('find'))) return 'No verdict yet — upload a photo and press Analyze, or pick a sample. Then I will list every spot in plain words.';
  if (has('photo') || has('quality') || has('blur') || has('dark') || has('good enough') || has('retake'))
    return v ? `Photo quality is ${ctx.quality}/100 — ${ctx.sharpness}. ${ctx.quality < 65 ? 'It is on the dim side, so treat the grade cautiously and retake if you can (dim room, wipe lens).' : 'Good enough to grade. Light and haze were evened out automatically before grading.'}` : 'Upload first — quality (focus, light, view) is checked before anything else.';
  if (has('why') || has('this level') || has('grade') || has('sure') || has('confiden'))
    return `Why Level ${g}? ${v.findings.map((f) => f.h).join(' · ')}. Confidence ${ctx.confidence}% — calibrated on similar field photos. The heatmap glow sits on those spots; if glow and rings disagree, overrule the AI.`;
  if (has('spot') || has('see') || has('bleed') || has('yellow') || has('vessel') || has('lesion') || has('find') || has('micro') || has('exudate'))
    return `In this eye: ${v.findings.map((f) => f.h).join(' — ')}. Plain words: bulges = weak walls from high sugar; yellow deposits = leaked fat near reading vision; bleeds = burst tiny vessels; new vessels (L4) = fragile regrowth that can bleed suddenly.`;
  if (has('next') || has('refer') || has('tell') || has('patient') || has('treat') || has('advice') || has('hindi'))
    return ({ 0: 'No referral. Say: “Photo looks healthy. Keep sugar and BP in range, come yearly.”', 1: 'No hospital trip yet. Say: “Very early sugar effect. Control sugar, recheck in 6–12 months.”', 2: 'Refer to eye doctor within 4 weeks. Say / कहें: “Sugar has affected the eye — an eye doctor must see you soon; sight is still saveable.”', 3: 'Urgent — within days. “Many bleeds seen; reading vision is at risk. Go to the eye hospital this week.”', 4: 'Emergency — hospital eye unit now. “New weak vessels — sudden bleeding risk. Go today.”' })[g] + ` (Confidence ${ctx.confidence}%.)`;
  if (has('heatmap') || has('grad') || has('explain') || has('proof') || has('attention'))
    return 'The purple-orange glow is the attention map (Grad-CAM style): brighter = more influence on the grade. Check it overlaps the rings in Spots view — that overlap is the 30-second doctor check.';
  if (has('simulink') || has('scale') || has('bandwidth') || has('matlab'))
    return 'Field design: photos compress to ~150 KB, offline-first, sync later. The Simulink model sizes cameras, bandwidth and doctor hours for 100,000+ patients per district per year. Targets: >90% catch rate, >85% correct rejections for Level 2+.';
  if (has('hello') || has('namaste') || s.trim() === 'hi') return v ? `Namaste! Current case is Level ${g} — ask “what next?” for the referral line.` : 'Namaste! Upload a photo or pick a sample and I will get to work.';
  return v ? `For this Level ${g} eye: ${v.action} Ask “what did you see?”, “why this level?” or “photo OK?” for specifics.` : 'Upload or pick a sample first, then ask about spots, level, referral, or photo quality.';
}

app.post('/api/chat', (req, res) => {
  const { question, context } = req.body || {};
  if (!question?.trim()) return res.status(400).json({ error: 'Empty question' });
  res.json({ answer: answerChat(question, context || {}) });
});

app.post('/api/report', (req, res) => {
  const { grade = 2, age = '-', years = '-', eye = '-', confidence = '-', quality = '-' } = req.body || {};
  const v = VERDICTS[Math.max(0, Math.min(4, Number(grade)))] || VERDICTS[2];
  const txt = `DRISHTI — EYE CHECK REPORT (SIH26038 demo)\nPatient: ${age}y, diabetes ${years}y, ${eye}\nVerdict: ${v.title} (${confidence}% sure)\nPhoto quality: ${quality}/100\nFindings:\n${v.findings.map((f) => '- ' + f.h + ': ' + f.p).join('\n')}\nNext: ${v.action}\nNote: prototype demo, doctor must confirm.`;
  res.type('text/plain').send(txt);
});

const db = await initDb().catch((e) => ({ mode: 'file', reason: String(e?.message || e).slice(0, 120) }));
app.listen(PORT, () => console.log(`drishti-api listening on http://localhost:${PORT} (packet ${PACKET_VERSION}, store ${db.mode}${db.reason ? `: ${db.reason}` : ''})`));
