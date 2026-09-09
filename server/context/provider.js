// Vision provider adapter — one interface, two backends.
//
// - Mock (default, no key needed): deterministic, dataset-grounded proposal
//   from canonical rubric lesions. Keeps the demo + rural offline story alive.
// - API (set VISION_API_URL + VISION_API_KEY): OpenAI-compatible chat
//   completions with vision. The SAME context packet is sent, so results are
//   comparable and the ablation table (mock vs api) stays honest.
// Any API failure falls back to mock with degraded:true — analyze never 500s.

import { canonicalLesions } from './rubric.js';
import { VERDICTS } from './verdicts.js';

// Read lazily (function, not module const) so server/.env loading in
// index.js takes effect despite ESM import hoisting.
function cfg() {
  return {
    url: process.env.VISION_API_URL || '',
    key: process.env.VISION_API_KEY || '',
    model: process.env.VISION_MODEL || 'drishti-vision-1',
    timeout: Number(process.env.VISION_TIMEOUT_MS || 30000),
  };
}

export function providerName() { const c = cfg(); return c.url && c.key ? 'api' : 'mock'; }

// Cheap deterministic image stats (also used for the local quality estimate).
export function imageStats(buf) {
  if (!buf || !buf.length) return { seed: 33, dark: false, avg: 120 };
  let s = 0; const n = Math.min(buf.length, 20000);
  for (let i = 0; i < n; i += 7) s += buf[i];
  const avg = s / Math.ceil(n / 7);
  return { seed: Math.floor(avg) % 90 + 5, dark: avg < 70, avg: Math.round(avg) };
}

function mockProposal({ forcedGrade, stats: st }) {
  const grade = forcedGrade != null
    ? Math.max(0, Math.min(4, Number(forcedGrade)))
    : st.dark ? 2 : [0, 1, 2, 2, 4][Math.floor(st.avg) % 5];
  const conf = VERDICTS[grade].conf - (st.dark ? 6 : 0);
  return {
    grade,
    confidence: conf,
    lesions: canonicalLesions(grade),
    plainSummary: VERDICTS[grade].action,
  };
}

// Tolerant JSON extraction: models often wrap output in prose/fences or
// emit unquoted keys. Try strict parse first, then progressively repair.
function extractJson(text) {
  const t = String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = t.indexOf('{'), end = t.lastIndexOf('}');
  const slice = start >= 0 && end > start ? t.slice(start, end + 1) : t;
  const attempts = [
    slice,
    slice.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":'),
  ];
  let last = null;
  for (const a of attempts) {
    try { return JSON.parse(a); } catch (e) { last = e; }
  }
  throw new Error(`unparseable provider JSON (${last?.message}); preview: ${slice.slice(0, 160)}`);
}

const KNOWN = new Set(['microaneurysm', 'hemorrhage', 'hard_exudate', 'soft_exudate', 'venous_beading', 'neovascularization']);

function sanitizeProposal(p) {
  const lesions = Array.isArray(p.lesions) ? p.lesions : [];
  const clean = [];
  let unknown = 0;
  for (const l of lesions) {
    if (!l || !KNOWN.has(l.type)) { unknown += 1; continue; }
    clean.push({ type: l.type, count: Math.max(1, Math.min(99, Math.round(Number(l.count) || 1))), location: String(l.location || 'unspecified').slice(0, 80) });
  }
  return {
    grade: Math.max(0, Math.min(4, Math.round(Number(p.grade) || 0))),
    confidence: Math.max(0, Math.min(100, Math.round(Number(p.confidence) || 0))),
    lesions: clean,
    plainSummary: String(p.plainSummary || '').slice(0, 300),
    unknownLesionTypes: unknown,
  };
}

async function apiProposal({ packet, imageBuffer, mime }) {
  const { url, key, model, timeout } = cfg();
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const content = [{ type: 'text', text: packet.userText }];
    if (imageBuffer) content.push({ type: 'image_url', image_url: { url: `data:${mime || 'image/jpeg'};base64,${imageBuffer.toString('base64')}` } });
    const r = await fetch(url, {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: 1500,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: packet.system },
          { role: 'user', content },
        ],
      }),
    });
    if (!r.ok) throw new Error(`provider ${r.status}`);
    const j = await r.json();
    const text = j?.choices?.[0]?.message?.content || '';
    const parsed = extractJson(text);
    return sanitizeProposal(parsed);
  } finally { clearTimeout(t); }
}

export async function gradeWithVision({ imageBuffer = null, mime = 'image/jpeg', forcedGrade = null, packet }) {
  const t0 = Date.now();
  const { url, key } = cfg();
  const st = imageBuffer ? imageStats(imageBuffer) : { seed: 33, dark: false, avg: 120 };
  if (!url || !key) {
    return { proposal: mockProposal({ forcedGrade, stats: st }), provider: 'mock', latencyMs: Date.now() - t0, degraded: false, stats: st };
  }
  try {
    const proposal = await apiProposal({ packet, imageBuffer, mime });
    return { proposal, provider: 'api', latencyMs: Date.now() - t0, degraded: false, stats: st };
  } catch (e) {
    return { proposal: mockProposal({ forcedGrade, stats: st }), provider: 'mock', latencyMs: Date.now() - t0, degraded: true, apiError: String(e?.message || e).slice(0, 200), stats: st };
  }
}
