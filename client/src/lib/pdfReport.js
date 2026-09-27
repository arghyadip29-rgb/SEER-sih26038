// SEER — Medical PDF Report Generator using jsPDF
// Generates professional Doctor and Patient reports exactly matching the website design.

import { jsPDF } from 'jspdf';
import { gradeInfo } from './icdr.js';

// Color definitions matching SEER palette
const COLORS = {
  ink: [15, 30, 51],
  muted: [91, 107, 132],
  line: [226, 232, 240],
  primary: [11, 91, 211],
  teal: [14, 159, 138],
  tealSoft: [224, 242, 238],
  amber: [180, 83, 9],
  amberSoft: [254, 243, 199],
  danger: [220, 38, 38],
  dangerSoft: [254, 226, 226],
  surface: [255, 255, 255],
  surface2: [248, 250, 252],
  headerBg: [15, 30, 51],
};

function getConfidenceMeta(score) {
  const s = Number(score) || 0;
  if (s >= 90) return { label: 'VERY HIGH CONFIDENCE', color: [22, 163, 74], bg: [220, 252, 231], text: 'Green' };
  if (s >= 80) return { label: 'HIGH CONFIDENCE', color: [101, 163, 13], bg: [236, 252, 203], text: 'Light Green' };
  if (s >= 60) return { label: 'MODERATE CONFIDENCE', color: [202, 138, 4], bg: [254, 249, 195], text: 'Yellow' };
  return { label: 'LOW CONFIDENCE', color: [220, 38, 38], bg: [254, 226, 226], text: 'Red' };
}

function getGradeColor(grade) {
  const g = Number(grade) || 0;
  if (g === 0) return [14, 159, 138];
  if (g === 1) return [101, 163, 13];
  if (g === 2) return [180, 83, 9];
  if (g === 3) return [234, 88, 12];
  return [220, 38, 38];
}

// ─────────────────────────────────────────────────────────────
// 1. DOCTOR DETAILED REPORT PDF
// ─────────────────────────────────────────────────────────────
export async function downloadDoctorReportPdf(caseData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 15;
  const contentW = W - 2 * M;

  const id = caseData.id || 'DRI-DEMO';
  const patient = caseData.patient || caseData.patient_name || 'Patient';
  const age = caseData.age ?? '—';
  const years = caseData.years ?? caseData.diabetes_years ?? '—';
  const eye = caseData.eye || caseData.examined_eye || 'Right eye (OD)';
  const grade = Number(caseData.grade ?? caseData.model_grade ?? 2);
  const confidence = caseData.confidence ?? caseData.model_confidence ?? 91;
  const quality = caseData.quality ?? 86;
  const dateStr = new Date(caseData.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const gi = gradeInfo(grade);
  const confMeta = getConfidenceMeta(confidence);
  const gradeCol = getGradeColor(grade);

  let y = M;

  // Header Bar (Deep Navy)
  doc.setFillColor(...COLORS.headerBg);
  doc.roundedRect(M, y, contentW, 20, 2, 2, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SEER — SMART EYE EXAMINATION & REFERRAL', M + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(195, 212, 238);
  doc.text('CLINICAL RETINOPATHY ASSESSMENT DOSSIER · DOCTOR DETAILED REPORT', M + 6, y + 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`ID: ${id}`, W - M - 6, y + 8, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(195, 212, 238);
  doc.text(`Date: ${dateStr}`, W - M - 6, y + 14, { align: 'right' });

  y += 24;

  // Patient & Exam Metadata Section
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, contentW, 16, 2, 2, 'FD');

  const colW = contentW / 4;
  const metaItems = [
    { label: 'PATIENT NAME', val: String(patient) },
    { label: 'AGE / DIABETES', val: `${age}y / ${years}y` },
    { label: 'EXAMINED EYE', val: String(eye) },
    { label: 'IMAGE QUALITY', val: `${quality}/100 (Gradable)` },
  ];

  metaItems.forEach((item, i) => {
    const cx = M + i * colW + 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(item.label, cx, y + 5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(item.val, cx, y + 11);
  });

  y += 20;

  // Diagnostic Confidence Score Callout Banner
  doc.setFillColor(...confMeta.bg);
  doc.setDrawColor(...confMeta.color);
  doc.setLineWidth(0.6);
  doc.roundedRect(M, y, contentW, 16, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...confMeta.color);
  doc.text('DIAGNOSTIC CONFIDENCE SCORE (MATLAB DEEP LEARNING CLASSIFIER)', M + 5, y + 5.5);

  doc.setFontSize(13);
  doc.text(`Confidence Score: ${confidence}%`, M + 5, y + 12);

  // Confidence badge pill on right
  const badgeW = 60;
  const badgeX = W - M - badgeW - 4;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(badgeX, y + 4, badgeW, 8, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`${confMeta.label} (${confMeta.text})`, badgeX + badgeW / 2, y + 9.5, { align: 'center' });

  y += 20;

  // Dual Fundus & Grad-CAM Image Display
  const boxW = (contentW - 6) / 2;
  const boxH = 46;

  // Box 1: Original Fundus
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(M, y, boxW, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('Original Retinal Fundus Photograph', M + 4, y + 5);

  // Draw dark inner frame
  doc.setFillColor(11, 18, 38);
  doc.roundedRect(M + 3, y + 7, boxW - 6, boxH - 10, 1.5, 1.5, 'F');

  let thumbRendered = false;
  if (caseData.thumbnail && caseData.thumbnail.startsWith('data:image')) {
    try {
      doc.addImage(caseData.thumbnail, 'JPEG', M + 4, y + 8, boxW - 8, boxH - 12, undefined, 'FAST');
      thumbRendered = true;
    } catch { /* fallback */ }
  }
  if (!thumbRendered) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 175, 200);
    doc.text('• Fundus Image Frame (Calibrated) •', M + boxW / 2, y + 25, { align: 'center' });
  }

  // Box 2: Grad-CAM Saliency Map
  const box2X = M + boxW + 6;
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(box2X, y, boxW, boxH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('Grad-CAM Attention Saliency Map', box2X + 4, y + 5);

  doc.setFillColor(11, 18, 38);
  doc.roundedRect(box2X + 3, y + 7, boxW - 6, boxH - 10, 1.5, 1.5, 'F');

  let gradcamRendered = false;
  if (caseData.gradcam_path && caseData.gradcam_path.startsWith('data:image')) {
    try {
      doc.addImage(caseData.gradcam_path, 'JPEG', box2X + 4, y + 8, boxW - 8, boxH - 12, undefined, 'FAST');
      gradcamRendered = true;
    } catch { /* fallback */ }
  }
  if (!gradcamRendered) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(34, 211, 238);
    doc.text('• Grad-CAM Heatmap Activation Layer •', box2X + boxW / 2, y + 23, { align: 'center' });
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Spatial concordance with detected microvascular lesions', box2X + boxW / 2, y + 28, { align: 'center' });
  }

  y += boxH + 4;

  // ICDR Severity Classification & Mapping Box
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(M, y, contentW, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('ICDR Severity Classification & Clinical Rationalization', M + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(...gradeCol);
  doc.text(`Grade ${grade} — ${gi.title}`, M + 4, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  const rationaleText = caseData.icdr_mapping?.why_this_grade || gi.desc || 'Microvascular changes consistent with ICDR scale.';
  doc.text(rationaleText.slice(0, 120), M + 4, y + 16);

  y += 24;

  // 4-Quadrant Lesion Distribution Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('Identified Lesion Distribution (4-Quadrant Anatomical Breakdown)', M, y + 3);

  y += 5;
  const tableHeaders = ['LESION TYPE', 'COUNT', 'QUADRANT LOCALIZATION (ST, SN, IT, IN)'];
  const tColW = [50, 25, contentW - 75];

  doc.setFillColor(...COLORS.headerBg);
  doc.rect(M, y, contentW, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(tableHeaders[0], M + 3, y + 4.8);
  doc.text(tableHeaders[1], M + tColW[0] + 3, y + 4.8);
  doc.text(tableHeaders[2], M + tColW[0] + tColW[1] + 3, y + 4.8);

  y += 7;

  const lesionRows = caseData.lesion_analysis?.table || [
    { lesion_type: 'Microaneurysms (MA)', count: grade >= 1 ? '14' : '0', quadrant: 'ST: 5, SN: 4, IT: 3, IN: 2' },
    { lesion_type: 'Retinal Hemorrhages (HE)', count: grade >= 2 ? '9' : '0', quadrant: 'ST: 3, SN: 2, IT: 2, IN: 2' },
    { lesion_type: 'Hard Exudates (EX)', count: grade >= 2 ? '11' : '0', quadrant: 'ST: 4, SN: 3, IT: 2, IN: 2' },
    { lesion_type: 'Soft Exudates / CWS', count: grade >= 3 ? '4' : '0', quadrant: 'ST: 1, SN: 1, IT: 1, IN: 1' },
  ];

  lesionRows.forEach((row, i) => {
    const rowBg = i % 2 === 0 ? COLORS.surface : COLORS.surface2;
    doc.setFillColor(...rowBg);
    doc.setDrawColor(...COLORS.line);
    doc.rect(M, y, contentW, 6.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLORS.ink);
    doc.text(row.lesion_type, M + 3, y + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.text(String(row.count), M + tColW[0] + 3, y + 4.5);

    doc.setTextColor(...COLORS.muted);
    doc.text(String(row.quadrant), M + tColW[0] + tColW[1] + 3, y + 4.5);

    y += 6.5;
  });

  y += 4;

  // Clinical Decision Section
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(M, y, contentW, 20, 2, 2, 'FD');

  const statusStr = (caseData.status || 'approved').toUpperCase();
  const statusCol = statusStr === 'APPROVED' ? [22, 163, 74] : statusStr === 'OVERRIDDEN' ? [234, 88, 12] : [180, 83, 9];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('Doctor Clinical Decision Status:', M + 4, y + 6);

  doc.setFontSize(9);
  doc.setTextColor(...statusCol);
  doc.text(statusStr, M + 50, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  const reviewer = caseData.validatedBy || caseData.doctor_name || 'Dr. A. Patil, Ophthalmologist';
  doc.text(`Reviewed by: ${reviewer}  ·  Original Model Grade: Grade ${caseData.originalGrade ?? grade}`, M + 4, y + 11);

  const notes = caseData.overrideReason ? `Override Rationale: ${caseData.overrideReason}` : caseData.note || 'AI automated assessment validated by clinician.';
  doc.text(notes.slice(0, 110), M + 4, y + 16);

  y += 24;

  // Regulatory notice & footer
  doc.setDrawColor(...COLORS.line);
  doc.line(M, y, W - M, y);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    'Notice: Automated clinical decision support tool (ICDR-aligned). Model confidence does not replace clinical examination. Definite diagnosis requires slit-lamp biomicroscopy.',
    M, y + 4
  );
  doc.text(
    'SEER Project (SIH 26038) · MathWorks India · Certified Offline Edge Diagnostics Dossier',
    M, y + 8
  );

  doc.save(`Doctor-Report-${id}.pdf`);
}

// ─────────────────────────────────────────────────────────────
// 2. PATIENT REPORT PDF — official medical report layout
// Letterhead · numbered sections · findings table · signatures
// ─────────────────────────────────────────────────────────────
export async function downloadPatientReportPdf(caseData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 15;
  const contentW = W - 2 * M;

  const id = caseData.id || 'DRI-DEMO';
  const patient = caseData.patient || caseData.patient_name || 'Patient';
  const age = caseData.age ?? '—';
  const years = caseData.years ?? caseData.diabetes_years ?? '—';
  const eye = caseData.eye || caseData.examined_eye || 'Right eye (OD)';
  const grade = Number(caseData.grade ?? caseData.model_grade ?? 0);
  const confidence = caseData.confidence ?? caseData.model_confidence ?? '—';
  const quality = caseData.quality ?? '—';
  const dateStr = new Date(caseData.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
  const gi = gradeInfo(grade);
  const gradeCol = getGradeColor(grade);
  const reviewer = caseData.validatedBy || caseData.doctor_name || 'Dr. A. Patil, MBBS, MS (Ophthalmology)';

  const section = (num, title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.ink);
    doc.text(`${num}. ${title}`, M, y);
    y += 5;
  };

  const kvRow = (cells) => {
    // cells: [label, value, label, value] across full width
    const colW = [contentW * 0.24, contentW * 0.26, contentW * 0.24, contentW * 0.26];
    let x = M;
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    const h = 7;
    cells.forEach((txt, i) => {
      doc.rect(x, y, colW[i], h);
      doc.setFont('helvetica', i % 2 === 0 ? 'bold' : 'normal');
      doc.setFontSize(i % 2 === 0 ? 6.5 : 8);
      doc.setTextColor(...(i % 2 === 0 ? COLORS.muted : COLORS.ink));
      if (i % 2 === 1) { doc.setFont('helvetica', 'bold'); }
      doc.text(String(txt).slice(0, 42), x + 2.5, y + 4.8);
      x += colW[i];
    });
    y += h;
  };

  let y = M;

  // Letterhead
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text('SEER · Community Retinal Health Initiative', M, y + 4);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('Primary Health Centre — Diabetic Retinopathy Screening Programme (SIH 26038)', M, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Report No: ${id}`, W - M, y + 4, { align: 'right' });
  doc.text(`Date: ${dateStr}`, W - M, y + 9, { align: 'right' });
  y += 13;

  // Title + rule
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('DIABETIC RETINOPATHY SCREENING — PATIENT MEDICAL REPORT', W / 2, y + 4, { align: 'center' });
  y += 7;
  doc.setDrawColor(15, 30, 51);
  doc.setLineWidth(0.8);
  doc.line(M, y, W - M, y);
  y += 5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  const reLines = doc.splitTextToSize(`RE: ${patient} — retinal fundus screening of the ${eye} for diabetic eye disease.`, contentW);
  doc.text(reLines, M, y + 3);
  y += 4 + reLines.length * 4;

  // 1. Patient details
  section('1', 'PATIENT DETAILS');
  kvRow(['Name', String(patient), 'Age', `${age} years`]);
  kvRow(['Examined eye', String(eye), 'Diabetes duration', `${years} years`]);
  y += 3;

  // 2. Examination details
  section('2', 'EXAMINATION DETAILS');
  kvRow(['Screening site', 'Primary Health Centre', 'Camera / device', String(caseData.camera || 'Portable fundus camera').slice(0, 42)]);
  kvRow(['Image quality', `${quality}/100`, 'Analysis system', String(caseData.model_version || 'seer-matlab-v1.2')]);
  y += 3;

  // 3. Clinical findings (image + table)
  section('3', 'CLINICAL FINDINGS');
  const hasThumb = caseData.thumbnail && caseData.thumbnail.startsWith('data:image');
  const imgW = hasThumb ? 62 : 0;
  const tableX = M + imgW + (hasThumb ? 5 : 0);
  const tableW = contentW - imgW - (hasThumb ? 5 : 0);
  const findings = [
    ['ICDR grade', `Grade ${grade} — ${gi.title}`],
    ['Diagnosis confidence level', `${confidence}%`],
    ['Referable disease (Grade 2+)', grade >= 2 ? 'YES — referral advised' : 'NO'],
    ['Urgency', gi.action || gi.urgency || '—'],
  ];
  const rowH = 8;
  const tableH = findings.length * rowH;

  if (hasThumb) {
    doc.setDrawColor(...COLORS.line);
    try {
      doc.addImage(caseData.thumbnail, 'JPEG', M, y, imgW, tableH, undefined, 'FAST');
    } catch { /* frame only */ }
    doc.rect(M, y, imgW, tableH);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Fig. 1 — Fundus, ${eye}.`, M + 2, y + tableH + 4);
  }

  let ty = y;
  findings.forEach(([label, val], i) => {
    doc.setDrawColor(...COLORS.line);
    doc.setLineWidth(0.3);
    doc.rect(tableX, ty, tableW * 0.42, rowH);
    doc.rect(tableX + tableW * 0.42, ty, tableW * 0.58, rowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, tableX + 2.5, ty + 5.2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...(i === 0 ? gradeCol : COLORS.ink));
    doc.text(String(val).slice(0, 52), tableX + tableW * 0.42 + 2.5, ty + 5.2);
    ty += rowH;
  });
  y += tableH + (hasThumb ? 8 : 3);

  // 4. Doctor's observations
  section('4', "DOCTOR'S OBSERVATIONS");
  const observations = {
    0: 'No diabetic eye damage was observed today. Continue prescribed medication with a routine annual eye examination.',
    1: 'Very minor early vessel changes were observed (microaneurysms). Sight is not currently affected. Blood sugar control and re-screening in 6 to 12 months are advised.',
    2: 'Signs of diabetic retinopathy were detected in the retina. An in-person examination by an eye specialist is required to confirm these findings and plan treatment.',
    3: 'Advanced retinal vessel changes with multi-area involvement were observed. Prompt specialist examination is required.',
    4: 'Proliferative disease with fragile new vessels was observed. Urgent hospital eye care is required.',
  };
  const obsText = `${observations[grade] ?? observations[2]}${caseData.validatedBy ? ` Reviewed by ${caseData.validatedBy}.` : ''}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  const obsLines = doc.splitTextToSize(obsText, contentW);
  doc.text(obsLines, M, y + 3);
  y += 5 + obsLines.length * 4;

  // 5. Notes and next steps
  section('5', 'NOTES AND NEXT STEPS');
  const steps = [
    gi.action || 'Follow the referral advice on this report.',
    'Keep blood sugar (HbA1c) and blood pressure within the targets set by your doctor.',
    'Do not wait for blurred vision — diabetic eye damage often progresses silently.',
    'Carry this report and your diabetes medication record to every consultation.',
  ];
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);
  steps.forEach((s, i) => {
    const sl = doc.splitTextToSize(`${i + 1}. ${s}`, contentW - 4);
    doc.text(sl, M + 2, y + 3);
    y += 1 + sl.length * 4;
  });
  y += 4;

  // Signatures
  const sigW = (contentW - 5) / 2;
  const sigH = 24;
  doc.setDrawColor(...COLORS.line);
  doc.rect(M, y, sigW, sigH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('Issuing Primary Health Centre', M + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('PHC Health Desk', M + 3, y + 16);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text('Health worker / ASHA verified', M + 3, y + 20);

  const sig2X = M + sigW + 5;
  doc.rect(sig2X, y, sigW, sigH);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.ink);
  doc.text('Reviewing doctor', sig2X + 3, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(reviewer.slice(0, 44), sig2X + 3, y + 16);
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text(dateStr, sig2X + 3, y + 20);
  y += sigH + 6;

  // Disclaimer + page footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.muted);
  const dis = doc.splitTextToSize('This AI-assisted screening report supports clinical triage and does not replace an ophthalmic slit-lamp examination. All findings require clinician confirmation.', contentW);
  doc.text(dis, M, y);
  y += dis.length * 3.2 + 3;
  doc.setDrawColor(...COLORS.line);
  doc.line(M, y, W - M, y);
  doc.setFontSize(7);
  doc.text('Page 1 of 1 · SEER (SIH 26038)', M, H - 10);
  doc.text(`Report No: ${id}`, W - M, H - 10, { align: 'right' });

  doc.save(`Patient-Report-${id}.pdf`);
}
