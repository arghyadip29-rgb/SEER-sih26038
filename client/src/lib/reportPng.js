// PNG medical report renderer — pure canvas, no dependencies.
// A4-ish portrait (1240×1754): header, patient details, eye image, verdict,
// findings, doctor-validation stamp, footer. Returns a dataURL for download.

import { paintFundus } from './fundus.js';

const W = 1240, H = 1754, M = 64;
const INK = '#0f1e33', MUTED = '#5b6b84', LINE = '#e2e8f0', PRIMARY = '#0b5bd3';
const GRADE_C = ['#0e9f8a', '#65a30d', '#b45309', '#ea580c', '#dc2626'];
const STATUS = {
  queued: { t: 'IN REVIEW', c: '#b45309', bg: '#fef3c7' },
  referred: { t: 'REFERRED', c: '#b45309', bg: '#fef3c7' },
  urgent: { t: 'URGENT', c: '#dc2626', bg: '#fee2e2' },
  cleared: { t: 'CLEARED', c: '#0e9f8a', bg: '#e0f2ee' },
  pending: { t: 'PENDING CONFIRMATION', c: '#5b6b84', bg: '#eef3f9' },
};

function wrap(ctx, text, maxW) {
  const words = String(text || '—').split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; }
    else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = () => resolve(null);
    im.src = src;
  });
}

function proceduralImage(seed, grade) {
  const c = document.createElement('canvas');
  c.width = 880; c.height = 620;
  paintFundus(c.getContext('2d'), 880, 620, { seed: seed ?? 33, grade: grade ?? 2, lesions: true });
  return c;
}

function drawCover(ctx, img, x, y, w, h) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  ctx.fillStyle = '#0b1226'; ctx.fillRect(x, y, w, h);
  if (img) {
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = MUTED; ctx.font = '500 28px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No image on file', x + w / 2, y + h / 2);
  }
  ctx.restore();
  ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
}

// Downscaled JPEG thumbnail for localStorage (keeps cases light).
export function captureThumb(source, w = 480) {
  try {
    if (!source) return null;
    const iw = source.naturalWidth || source.width, ih = source.naturalHeight || source.height;
    if (!iw || !ih) return null;
    const c = document.createElement('canvas');
    c.width = w; c.height = Math.round((w * ih) / iw);
    c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } catch { return null; }
}

const fmtDate = (ts) => new Date(ts || Date.now()).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

// c: case/result {id, patient, age, years, eye, grade, confidence, quality, sharpness, findings, status, note, validatedBy, validatedAt, createdAt, aid, seed, thumbnail}
// img: HTMLImage/Canvas/dataURL (eye photo) — falls back to procedural render.
// session: {doctor, phc} for the validation block header.
export async function buildReportPng(c, img, session = {}) {
  try { await document.fonts.ready; } catch { /* system fonts are fine */ }
  const photo = (typeof img === 'string' ? await loadImage(img) : img) || proceduralImage(c.seed, c.grade);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this; };
  const st = STATUS[c.status] || STATUS.pending;
  const gc = GRADE_C[c.grade] ?? PRIMARY;

  // page
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // header band
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.font = "800 40px Sora, Inter, sans-serif";
  ctx.fillText('◉  Drishti', M, 78);
  ctx.font = "500 24px Inter, sans-serif"; ctx.fillStyle = '#aebdcc';
  ctx.fillText(session.phc || 'Rural Eye Screening · SIH26038', M, 122);
  ctx.fillStyle = '#fff'; ctx.font = "700 34px Sora, Inter, sans-serif"; ctx.textAlign = 'right';
  ctx.fillText('Diabetic Eye Check — Report', W - M, 78);
  ctx.font = "500 23px 'IBM Plex Mono', monospace"; ctx.fillStyle = '#aebdcc';
  ctx.fillText(`${c.id || 'DRAFT'}  ·  ${fmtDate(c.createdAt)}`, W - M, 122);
  ctx.textAlign = 'left';

  let y = 250;
  const hair = (yy) => { ctx.strokeStyle = LINE; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(M, yy); ctx.lineTo(W - M, yy); ctx.stroke(); };
  const section = (t) => {
    ctx.font = "600 21px 'IBM Plex Mono', monospace"; ctx.fillStyle = PRIMARY;
    ctx.fillText(t.toUpperCase(), M, y); y += 16;
  };

  // patient details
  section('Patient details'); y += 14;
  ctx.font = '500 26px Inter, sans-serif';
  const rows = [
    ['Name', c.patient || 'Unnamed patient', 'Age', c.age != null && c.age !== '' ? `${c.age} years` : '—'],
    ['Diabetes', c.years != null && c.years !== '' ? `${c.years} years` : '—', 'Eye', c.eye || '—'],
    ['Camera', c.camera || 'Portable fundus camera', 'Analysis', c.aid ? `${c.aid} · ${c.source || 'upload'}` : (c.source || 'upload')],
  ];
  for (const [k1, v1, k2, v2] of rows) {
    ctx.fillStyle = MUTED; ctx.font = '500 22px Inter, sans-serif';
    ctx.fillText(k1, M, y); ctx.fillText(k2, M + 560, y);
    ctx.fillStyle = INK; ctx.font = '600 25px Inter, sans-serif';
    ctx.fillText(String(v1).slice(0, 30), M + 150, y);
    ctx.fillText(String(v2).slice(0, 30), M + 710, y);
    y += 44;
  }
  y += 8; hair(y); y += 44;

  // image + verdict
  section('Eye image  ·  Verdict'); y += 14;
  const imgW = 640, imgH = 448;
  drawCover(ctx, photo, M, y, imgW, imgH);
  const vx = M + imgW + 40, vw = W - M - vx;
  // grade badge
  ctx.fillStyle = gc; ctx.beginPath(); ctx.roundRect(vx, y, vw, 120, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '800 44px Sora, Inter, sans-serif';
  ctx.fillText(`Level ${c.grade ?? '—'}`, vx + 26, y + 62);
  ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText(String(STATUS[c.status]?.t || `Grade ${c.grade ?? ''}`).slice(0, 26), vx + 26, y + 96);
  let vy = y + 160;
  ctx.fillStyle = MUTED; ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('Confidence', vx, vy);
  ctx.fillStyle = INK; ctx.font = "600 24px 'IBM Plex Mono', monospace";
  ctx.fillText(`${c.confidence ?? '—'}% sure`, vx + 200, vy); vy += 42;
  ctx.fillStyle = MUTED; ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('Photo quality', vx, vy);
  ctx.fillStyle = INK; ctx.font = "600 24px 'IBM Plex Mono', monospace";
  ctx.fillText(`${c.quality ?? '—'} / 100`, vx + 200, vy); vy += 42;
  ctx.fillStyle = MUTED; ctx.font = '500 22px Inter, sans-serif';
  ctx.fillText('Sharpness', vx, vy);
  ctx.fillStyle = INK; ctx.font = '600 22px Inter, sans-serif';
  wrap(ctx, c.sharpness || '—', vw - 200).slice(0, 2).forEach((l, i) => ctx.fillText(l, vx + 200, vy + i * 30));
  y += imgH + 36; hair(y); y += 44;

  // findings
  section('Findings (plain words)'); y += 14;
  ctx.font = '500 25px Inter, sans-serif';
  const findings = (c.findings || []).map((f) => ({ h: f.h || f.title || '', p: f.p || f.desc || '' }));
  if (!findings.length) { ctx.fillStyle = MUTED; ctx.fillText('No findings recorded.', M, y); y += 40; }
  findings.slice(0, 6).forEach((f, i) => {
    ctx.fillStyle = gc;
    ctx.beginPath(); ctx.arc(M + 14, y - 8, 12, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '700 20px Inter, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(String(i + 1), M + 14, y - 1);
    ctx.textAlign = 'left'; ctx.fillStyle = INK; ctx.font = '700 25px Inter, sans-serif';
    ctx.fillText(String(f.h).slice(0, 62), M + 44, y);
    y += 34;
    ctx.fillStyle = MUTED; ctx.font = '500 23px Inter, sans-serif';
    wrap(ctx, f.p, W - M * 2 - 44).slice(0, 2).forEach((l) => { ctx.fillText(l, M + 44, y); y += 32; });
    y += 10;
  });
  hair(y); y += 44;

  // doctor validation
  section('Doctor validation'); y += 14;
  ctx.fillStyle = st.bg; ctx.strokeStyle = st.c; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect(M, y, W - M * 2, 300, 14); ctx.fill(); ctx.stroke();
  const bx = M + 30; let by = y + 52;
  ctx.fillStyle = st.c; ctx.font = '800 34px Sora, Inter, sans-serif';
  ctx.fillText(`✓  ${st.t}`, bx, by); by += 52;
  ctx.fillStyle = INK; ctx.font = '500 24px Inter, sans-serif';
  const who = c.validatedBy || session.doctor || 'Duty doctor';
  ctx.fillText(`Validated by:  ${who}`, bx, by); by += 42;
  ctx.fillText(`Centre:  ${session.phc || '—'}`, bx, by); by += 42;
  ctx.fillText(`On:  ${fmtDate(c.validatedAt || c.createdAt)}`, bx, by); by += 42;
  ctx.fillStyle = MUTED;
  wrap(ctx, `Note: ${c.note || 'No note recorded.'}`, W - M * 2 - 60).slice(0, 2).forEach((l) => { ctx.fillText(l, bx, by); by += 36; });
  y += 336;
  ctx.fillStyle = MUTED; ctx.font = 'italic 500 22px Inter, sans-serif';
  ctx.fillText('Signature / stamp:', M, y + 8);
  ctx.strokeStyle = MUTED; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(M + 260, y + 8); ctx.lineTo(M + 700, y + 8); ctx.stroke();
  y += 64;

  // footer
  hair(H - 120);
  ctx.fillStyle = MUTED; ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Prototype screening aid for SIH26038 — final diagnosis rests with the ophthalmologist.', M, H - 78);
  ctx.textAlign = 'right'; ctx.font = "500 20px 'IBM Plex Mono', monospace";
  ctx.fillText('drishti · sih26038', W - M, H - 78);
  ctx.textAlign = 'left';

  return cv.toDataURL('image/png');
}

export function downloadPng(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
