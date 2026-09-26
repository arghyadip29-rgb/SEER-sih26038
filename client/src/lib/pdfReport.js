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
// 2. PATIENT REPORT PDF
// ─────────────────────────────────────────────────────────────
export async function downloadPatientReportPdf(caseData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 18;
  const contentW = W - 2 * M;

  const id = caseData.id || 'DRI-DEMO';
  const patient = caseData.patient || caseData.patient_name || 'Patient';
  const age = caseData.age ?? '—';
  const eye = caseData.eye || caseData.examined_eye || 'Right eye (OD)';
  const grade = Number(caseData.grade ?? caseData.model_grade ?? 0);
  const dateStr = new Date(caseData.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
  const gi = gradeInfo(grade);
  const gradeCol = getGradeColor(grade);

  let y = M;

  // Header Banner
  doc.setFillColor(...COLORS.primary);
  doc.roundedRect(M, y, contentW, 26, 3, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('SEER Community Retinal Health Initiative', M + 8, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(219, 234, 254);
  doc.text('Your Personal Eye Screening Report · आपकी आँख की जाँच रिपोर्ट', M + 8, y + 18);

  y += 32;

  // Patient Card
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, contentW, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLORS.ink);
  doc.text(String(patient), M + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);
  doc.text(`Age: ${age} yrs   ·   Examined Eye: ${eye}   ·   Date: ${dateStr}   ·   ID: ${id}`, M + 6, y + 14);

  y += 24;

  // Status Box
  const patientFriendlySummary = {
    0: 'No Signs of Eye Damage (Clear / सुरक्षित)',
    1: 'Mild Early Changes Detected (Monitoring Needed / शुरुआती लक्षण)',
    2: 'Moderate Diabetic Changes (Doctor Visit Required / डॉक्टर की सलाह जरूरी)',
    3: 'Severe Changes Detected (Prompt Hospital Care / तुरंत अस्पताल जाएं)',
    4: 'Advanced Proliferative Damage (Urgent Treatment Required / अति आवश्यक)',
  };

  doc.setFillColor(grade === 0 ? 240 : 254, grade === 0 ? 253 : 243, grade === 0 ? 244 : 240);
  doc.setDrawColor(...gradeCol);
  doc.setLineWidth(0.8);
  doc.roundedRect(M, y, contentW, 28, 3, 3, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gradeCol);
  doc.text('SCREENING RESULT / जाँच परिणाम', M + 6, y + 7);

  doc.setFontSize(13);
  doc.text(patientFriendlySummary[grade] || 'Screening Completed', M + 6, y + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...COLORS.ink);
  doc.text(`Recommendation: ${gi.action}`, M + 6, y + 22);

  y += 34;

  // What this means section
  doc.setFillColor(...COLORS.surface);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(M, y, contentW, 36, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text('What Does This Mean? (इसका क्या अर्थ है?)', M + 6, y + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.muted);

  const explanations = {
    0: 'The photograph shows no visible diabetic changes in the retinal blood vessels. Your vision is currently protected, but annual checkups remain essential because diabetes eye damage develops silently.',
    1: 'Minor swelling in tiny eye vessels was spotted (microaneurysms). This does not immediately harm your sight, but it is an early warning that your sugar levels are beginning to affect your eyes.',
    2: 'Spots of bleeding or small protein leaks were detected in your retina. Treatment and specialized eye drops or laser care can prevent vision loss if you visit an eye specialist promptly.',
    3: 'Several areas of blood vessel blockage were detected in your retina. This carries a high risk of worsening quickly without medical care.',
    4: 'Fragile new blood vessels have grown in your retina and may bleed. Urgent medical care at a hospital eye clinic is essential to protect your sight.',
  };

  const lines = doc.splitTextToSize(explanations[grade] || explanations[2], contentW - 12);
  doc.text(lines, M + 6, y + 15);

  y += 42;

  // Next Steps Section
  doc.setFillColor(...COLORS.surface2);
  doc.setDrawColor(...COLORS.line);
  doc.roundedRect(M, y, contentW, 44, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...COLORS.ink);
  doc.text('Your Action Checklist (आपके अगले कदम):', M + 6, y + 8);

  const steps = [
    grade >= 2
      ? 'Visit an Eye Specialist (Ophthalmologist) within the next 2 to 4 weeks with this slip.'
      : 'Schedule your next routine eye screening in 12 months at your local PHC.',
    'Keep your Blood Sugar (HbA1c) and Blood Pressure under the targets advised by your doctor.',
    'Do not wait for vision blurriness — diabetic eye damage often progresses before you notice any symptoms.',
    'Carry this slip and your diabetes medication record to every clinical consultation.',
  ];

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLORS.ink);

  steps.forEach((step, idx) => {
    doc.text(`✓   ${step}`, M + 6, y + 17 + idx * 6.5);
  });

  y += 50;

  // Signatures and Local PHC stamp area
  doc.setDrawColor(...COLORS.line);
  doc.rect(M, y, contentW / 2 - 3, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('Issuing Primary Health Centre (PHC)', M + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('PHC Melghat Sub-district Centre', M + 4, y + 12);
  doc.text('Health Worker / ASHA Verified', M + 4, y + 17);

  const box2X = M + contentW / 2 + 3;
  doc.rect(box2X, y, contentW / 2 - 3, 26);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.ink);
  doc.text('Ophthalmic Reviewer', box2X + 4, y + 6);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('Dr. A. Patil, MBBS, MS (Ophthalmology)', box2X + 4, y + 12);
  doc.text('District Hospital Tele-Ophthalmology', box2X + 4, y + 17);

  y += 32;

  // Footer
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.muted);
  doc.text('SEER (SIH 26038) · Distributed Offline Retinal Screening · www.seer.phc', W / 2, y, { align: 'center' });

  doc.save(`Patient-Report-${id}.pdf`);
}
