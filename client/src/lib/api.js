// API client — talks to Express backend, falls back to local mock when offline.
import { gradeInfo, FALLBACK_FINDINGS, offlineChatResponse } from './icdr.js';

// ICDR-aligned fallback verdicts for offline mode
function buildLocalVerdict(g) {
  const gi = gradeInfo(g);
  return {
    title: `${gi.label} — ${gi.title}`,
    action: gi.action,
    conf: [96, 88, 91, 93, 94][g] ?? 88,
    cls: g >= 3 ? 'refer' : g === 0 ? 'clear' : 'watch',
    findings: FALLBACK_FINDINGS[g] || [],
  };
}

async function tryFetch(url, opts, timeoutMs = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    if (!r.ok) throw new Error('bad status');
    const ct = r.headers.get('content-type') || '';
    return ct.includes('application/json') ? await r.json() : await r.text();
  } finally { clearTimeout(t); }
}

export function localGradeFromFileMeta(name = '', size = 0) {
  let s = 0; for (const c of name) s += c.charCodeAt(0);
  s += size % 997;
  const seed = (s % 90) + 5;
  const m = s % 5;
  return { grade: [0, 1, 2, 2, 4][m], seed, dark: false };
}

export async function analyzeSample(sample) {
  try {
    return await tryFetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sample }) }, 120000);
  } catch {
    const v = buildLocalVerdict(sample);
    return { grade: sample, confidence: v.conf, quality: 84, sharpness: 'Sharp · even light', seed: [11, 22, 33, 44, 55][sample], dark: false, findings: v.findings, title: v.title, action: v.action, source: 'local-fallback' };
  }
}

export async function analyzeUpload(file) {
  const fd = new FormData();
  fd.append('image', file);
  try {
    return await tryFetch('/api/analyze', { method: 'POST', body: fd }, 120000);
  } catch {
    const d = localGradeFromFileMeta(file.name, file.size);
    const v = buildLocalVerdict(d.grade);
    return { grade: d.grade, confidence: v.conf, quality: 88, sharpness: 'Sharp · even light', seed: d.seed, dark: false, findings: v.findings, title: v.title, action: v.action, source: 'local-fallback' };
  }
}

export async function askChat(question, context) {
  try {
    const r = await tryFetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, context }) });
    return r.answer;
  } catch {
    const g = context?.grade;
    if (g == null) return 'No verdict yet — upload a photo and press Analyze, or pick a sample.';
    return offlineChatResponse(g, question, context.confidence);
  }
}

export async function downloadReport(payload) {
  try {
    const txt = await tryFetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    triggerDownload(typeof txt === 'string' ? txt : JSON.stringify(txt), `seer-report-grade${payload.grade}.txt`);
  } catch {
    triggerDownload(`SEER REPORT (offline draft)\nClassification: Grade ${payload.grade}\nNote: start server for full report.`, `seer-report-grade${payload.grade}.txt`);
  }
}

function triggerDownload(text, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Context layer + memory (P0). Offline-safe: null when the server is down.
export async function getPacket() {
  try { return await tryFetch('/api/context/packet', {}); } catch { return null; }
}
export async function getMemoryStats() {
  try { return await tryFetch('/api/memory/stats', {}); } catch { return null; }
}
export async function getAudit(limit = 20) {
  try { return await tryFetch(`/api/audit?limit=${limit}`, {}); } catch { return null; }
}
export async function submitCorrection(payload) {
  return tryFetch('/api/corrections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}
export async function getEvalLast() {
  try { return await tryFetch('/api/eval/last', {}); } catch { return null; }
}
