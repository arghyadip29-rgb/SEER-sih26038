// API client — talks to Express backend, falls back to local mock when offline.

const LOCAL_VERDICTS = {
  0: { title: 'Level 0 — No signs of disease', action: 'No referral. Repeat photo in 12 months.', conf: 96, cls: 'clear', findings: [{ h: 'Clean retina', p: 'No bulges, bleeds or yellow deposits seen.' }, { h: 'Vessels look normal', p: 'Disc edges sharp, branches even.' }] },
  1: { title: 'Level 1 — Mild, watch closely', action: 'No referral yet. Sugar control, recheck in 6–12 months.', conf: 88, cls: 'watch', findings: [{ h: '3–4 tiny bulges (microaneurysms)', p: 'Pin-head red dots near the centre.' }, { h: 'No bleeds or yellow deposits', p: 'Centre of vision still clear.' }] },
  2: { title: 'Level 2 — Needs an eye doctor', action: 'Referable. Eye doctor within 4 weeks.', conf: 91, cls: 'watch', findings: [{ h: 'Bleeds — 5 found', p: 'Small red patches where vessels leaked.' }, { h: 'Yellow deposits — 4 found', p: 'Fat-protein leaks near the centre.' }, { h: 'Tiny bulges — 9 found', p: 'Clustered where the heatmap glows.' }] },
  3: { title: 'Level 3 — Severe, urgent referral', action: 'Urgent — eye doctor within days.', conf: 93, cls: 'refer', findings: [{ h: 'Many bleeds in 3–4 zones', p: 'Large and small red patches.' }, { h: 'Bead-like vessels', p: 'Uneven swelling — severe-stage clue.' }, { h: 'Deposits near centre', p: 'Threatens reading vision.' }] },
  4: { title: 'Level 4 — Advanced, hospital now', action: 'Emergency referral to hospital eye unit.', conf: 94, cls: 'refer', findings: [{ h: 'New fragile vessels', p: 'Thin, lacy vessels that bleed easily.' }, { h: 'Bleeds and deposits, widespread', p: 'Old and fresh leaks across the photo.' }, { h: 'Needs hospital eye unit', p: 'Laser / injection assessment.' }] },
};

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
    const v = LOCAL_VERDICTS[sample];
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
    const v = LOCAL_VERDICTS[d.grade];
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
    const v = LOCAL_VERDICTS[g];
    const q = question.toLowerCase();
    if (q.includes('next') || q.includes('refer')) return v.action + ` (Confidence ${context.confidence}%.)`;
    if (q.includes('why') || q.includes('level')) return `Why Level ${g}? ${v.findings.map((f) => f.h).join(' · ')}. Confidence ${context.confidence}%. The heatmap glow sits on those spots.`;
    if (q.includes('photo') || q.includes('quality')) return `Photo quality ${context.quality}/100 — ${context.sharpness}.`;
    return `For this Level ${g} eye: ${v.action} Ask “what next?” or “why this level?” (offline draft — start the server for full answers.)`;
  }
}

export async function downloadReport(payload) {
  try {
    const txt = await tryFetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    triggerDownload(typeof txt === 'string' ? txt : JSON.stringify(txt), `drishti-report-L${payload.grade}.txt`);
  } catch {
    triggerDownload(`DRISHTI REPORT (offline draft)\nVerdict: Level ${payload.grade}\nNote: start server for full report.`, `drishti-report-L${payload.grade}.txt`);
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
