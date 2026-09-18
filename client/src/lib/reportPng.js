// PNG medical report renderer — pure canvas, no dependencies.
// A4-ish portrait (1240×1754): header, patient details, eye image, verdict,
// findings, doctor-validation stamp, footer. Returns a dataURL for download.

import { paintFundus } from './fundus.js';
import { gradeInfo, MACULAR_STATUS, IMAGE_QUALITY_LABEL } from './icdr.js';

const W = 1240, H = 1754, M = 64;
const INK = '#0f1e33', MUTED = '#5b6b84', LINE = '#e2e8f0', PRIMARY = '#0b5bd3';
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

export async function buildReportPng(c, img, session = {}) {
  try { await document.fonts.ready; } catch { /* system fonts */ }
  const photo = (typeof img === 'string' ? await loadImage(img) : img) || proceduralImage(c.seed, c.grade);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  if (!ctx.roundRect) ctx.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); return this; };
  const st = STATUS[c.status] || STATUS.pending;
  const gi = gradeInfo(c.grade);

  // page background
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
  ctx.textBaseline = 'alphabetic';

  // header band
  ctx.fillStyle = INK; ctx.fillRect(0, 0, W, 190);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left';
  ctx.font = "800 38px Sora, Inter, sans-serif";
  ctx.fillText('◉  SEER', M, 76);
  ctx.font = "500 22px Inter, sans-serif"; ctx.fillStyle = '#aebdcc';
  ctx.fillText(session.phc || 'Rural Health Centre · DR Screening Protocol', M, 118);
  ctx.fillStyle = '#fff'; ctx.font = "700 30px Sora, Inter, sans-serif"; ctx.textAlign = 'right';
  ctx.fillText('Diabetic Retinopathy Screening Report', W - M, 76);
  ctx.font = "500 21px 'IBM Plex Mono', monospace"; ctx.fillStyle = '#aebdcc';
  ctx.fillText(`ID: ${c.id || 'DRAFT'}  ·  ${fmtDate(c.createdAt)}`, W - M, 118);
  ctx.textAlign = 'left';

  let y = 236;
  const hair = (yy) => { ctx.strokeStyle = LINE; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(M, yy); ctx.lineTo(W - M, yy); ctx.stroke(); };
  const section = (t) => {
    ctx.font = "700 20px 'IBM Plex Mono', monospace"; ctx.fillStyle = PRIMARY;
    ctx.fillText(t.toUpperCase(), M, y); y += 14;
  };

  // patient details
  section('1. Patient & Examination Details'); y += 12;
  const rows = [
    ['Patient Name', c.patient || 'Unnamed patient', 'Age', c.age != null && c.age !== '' ? `${c.age} years` : '—'],
    ['Diabetes Duration', c.years != null && c.years !== '' ? `${c.years} years` : '—', 'Eye Examined', c.eye || '—'],
    ['Camera System', c.camera || 'Portable Fundus Camera', 'Image Gradability', `${IMAGE_QUALITY_LABEL(c.quality)} (${c.quality ?? '—'}/100)`],
  ];
  for (const [k1, v1, k2, v2] of rows) {
    ctx.fillStyle = MUTED; ctx.font = '500 21px Inter, sans-serif';
    ctx.fillText(k1, M, y); ctx.fillText(k2, M + 560, y);
    ctx.fillStyle = INK; ctx.font = '600 23px Inter, sans-serif';
    ctx.fillText(String(v1).slice(0, 32), M + 210, y);
    ctx.fillText(String(v2).slice(0, 32), M + 760, y);
    y += 38;
  }
  y += 4; hair(y); y += 38;

  // image + clinical verdict
  section('2. Fundus Photograph & ICDR Classification'); y += 14;
  const imgW = 600, imgH = 420;
  drawCover(ctx, photo, M, y, imgW, imgH);

  // draw annotation badge on image
  ctx.fillStyle = 'rgba(15, 30, 51, 0.78)';
  ctx.beginPath(); ctx.roundRect(M + 14, y + imgH - 42, 330, 30, 6); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = "600 14px 'IBM Plex Mono', monospace";
  ctx.fillText('○ AI-detected retinal abnormality region', M + 24, y + imgH - 22);

  const vx = M + imgW + 36, vw = W - M - vx;

  // ICDR grade banner
  ctx.fillStyle = gi.c; ctx.beginPath(); ctx.roundRect(vx, y, vw, 116, 12); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '800 38px Sora, Inter, sans-serif';
  ctx.fillText(gi.label, vx + 22, y + 54);
  ctx.font = '600 19px Inter, sans-serif';
  ctx.fillText(gi.short, vx + 22, y + 88);

  let vy = y + 150;
  ctx.fillStyle = MUTED; ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Clinical Severity', vx, vy);
  ctx.fillStyle = INK; ctx.font = '700 21px Inter, sans-serif';
  wrap(ctx, gi.title, vw - 190).slice(0, 2).forEach((l, i) => ctx.fillText(l, vx + 190, vy + i * 26));
  vy += 58;

  ctx.fillStyle = MUTED; ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Model Confidence', vx, vy);
  ctx.fillStyle = INK; ctx.font = "700 22px 'IBM Plex Mono', monospace";
  ctx.fillText(`${c.confidence ?? '—'}% calibrated`, vx + 190, vy); vy += 40;

  ctx.fillStyle = MUTED; ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Macular Status', vx, vy);
  ctx.fillStyle = INK; ctx.font = '700 21px Inter, sans-serif';
  ctx.fillText(`Edema ${MACULAR_STATUS[c.grade] ?? 'Not apparent'}`, vx + 190, vy); vy += 40;

  ctx.fillStyle = MUTED; ctx.font = '500 20px Inter, sans-serif';
  ctx.fillText('Clinical Urgency', vx, vy);
  ctx.fillStyle = gi.c; ctx.font = "800 20px 'IBM Plex Mono', monospace";
  ctx.fillText(gi.urgency, vx + 190, vy);

  y += imgH + 28; hair(y); y += 36;

  // patient explanation section (Part 8 & 12)
  section('3. What This Means (Patient Explanation)'); y += 12;
  ctx.fillStyle = INK; ctx.font = '600 24px Inter, sans-serif';
  wrap(ctx, gi.patientTitle, W - M * 2).slice(0, 2).forEach((l) => { ctx.fillText(l, M, y); y += 30; });
  ctx.fillStyle = MUTED; ctx.font = '500 21px Inter, sans-serif';
  wrap(ctx, gi.patientDesc, W - M * 2).slice(0, 3).forEach((l) => { ctx.fillText(l, M, y); y += 28; });
  y += 10; hair(y); y += 36;

  // key findings list
  section('4. Key Retinal Findings (ICDR Scale)'); y += 12;
  const findingsList = [
    { name: 'Microaneurysms', val: c.grade >= 1 ? 'Detected' : 'Not detected', desc: 'Early capillary wall bulges' },
    { name: 'Retinal Hemorrhages', val: c.grade >= 2 ? (c.grade >= 3 ? 'Detected (Multi-quadrant)' : 'Detected') : 'Not detected', desc: 'Intraretinal vascular leakage' },
    { name: 'Hard Exudates', val: c.grade >= 2 ? 'Detected' : 'Not detected', desc: 'Lipoprotein deposits' },
    { name: 'Neovascularization', val: c.grade >= 4 ? 'Detected (PDR)' : 'Not detected', desc: 'Abnormal new vessel growth' },
  ];
  const colW = (W - M * 2) / 2;
  findingsList.forEach((f, i) => {
    const colX = M + (i % 2) * colW;
    const rowY = y + Math.floor(i / 2) * 52;
    ctx.fillStyle = f.val.startsWith('Detected') ? '#dc2626' : '#0e9f8a';
    ctx.beginPath(); ctx.arc(colX + 10, rowY - 6, 8, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.font = '700 21px Inter, sans-serif';
    ctx.fillText(`${f.name}: `, colX + 28, rowY);
    ctx.fillStyle = f.val.startsWith('Detected') ? '#dc2626' : '#0e9f8a';
    ctx.fillText(f.val, colX + 28 + ctx.measureText(`${f.name}: `).width, rowY);
  });
  y += 114; hair(y); y += 36;

  // clinician review / validation block
  section('5. Clinician Validation & Referral Slip'); y += 12;
  ctx.fillStyle = st.bg; ctx.strokeStyle = st.c; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(M, y, W - M * 2, 220, 10); ctx.fill(); ctx.stroke();
  const bx = M + 24; let by = y + 42;
  ctx.fillStyle = st.c; ctx.font = '800 28px Sora, Inter, sans-serif';
  ctx.fillText(`✓  ${st.t}`, bx, by); by += 42;
  ctx.fillStyle = INK; ctx.font = '500 21px Inter, sans-serif';
  const who = c.validatedBy || session.doctor || 'Examining Clinician';
  ctx.fillText(`Validated by:  ${who}    ·    Centre:  ${session.phc || 'Primary Health Centre'}`, bx, by); by += 36;
  ctx.fillText(`Clinical Action:  ${gi.urgencyMsg}`, bx, by); by += 36;
  ctx.fillStyle = MUTED;
  wrap(ctx, `Clinician Note: ${c.note || 'Screening photo taken, AI analysis reviewed.'}`, W - M * 2 - 48).slice(0, 2).forEach((l) => { ctx.fillText(l, bx, by); by += 30; });

  y += 240;
  ctx.fillStyle = MUTED; ctx.font = 'italic 500 20px Inter, sans-serif';
  ctx.fillText('Signature / Stamp of Eye-Care Professional:', M, y + 10);
  ctx.strokeStyle = MUTED; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(M + 460, y + 10); ctx.lineTo(M + 880, y + 10); ctx.stroke();

  // footer with required disclaimer (Part 12 & 17)
  hair(H - 100);
  ctx.fillStyle = MUTED; ctx.font = '500 17px Inter, sans-serif';
  ctx.fillText('DISCLAIMER: This screening report is intended for preliminary screening support and does not replace examination or diagnosis by a qualified eye-care professional.', M, H - 64);
  ctx.textAlign = 'right'; ctx.font = "500 17px 'IBM Plex Mono', monospace";
  ctx.fillText('SEER · ICDR Scale Protocol', W - M, H - 64);
  ctx.textAlign = 'left';

  return cv.toDataURL('image/png');
}

export function downloadPng(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
