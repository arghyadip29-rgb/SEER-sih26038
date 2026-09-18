// ICDR-aligned DR severity terminology used throughout the SEER application.
// DR severity terminology based on the International Clinical Diabetic Retinopathy framework.
// NOT a claim of ICDR certification or clinical validation.

export const DR_GRADES = [
  {
    n: 0,
    c: '#0e9f8a',
    label: 'Grade 0',
    title: 'No Apparent Diabetic Retinopathy',
    short: 'No Apparent DR',
    abbr: 'No DR',
    action: 'Routine annual review. Optimise glycaemic and blood-pressure control.',
    urgency: 'ROUTINE REVIEW',
    urgencyMsg: 'Arrange a routine annual eye examination.',
    patientTitle: 'No signs of diabetic eye changes detected.',
    patientDesc: 'The retinal photograph did not show detectable signs of diabetic retinopathy. Continue regular check-ups as advised.',
  },
  {
    n: 1,
    c: '#65a30d',
    label: 'Grade 1',
    title: 'Mild Non-Proliferative Diabetic Retinopathy',
    short: 'Mild NPDR',
    abbr: 'Mild NPDR',
    action: 'No referral at this time. Optimise blood sugar and blood pressure. Repeat screening in 6–12 months.',
    urgency: 'ROUTINE REVIEW',
    urgencyMsg: 'Arrange a routine eye examination. Recheck in 6–12 months.',
    patientTitle: 'Mild diabetic changes detected.',
    patientDesc: 'Small changes were found in the blood vessels of the retina. These are an early sign of diabetic eye disease. Vision is usually not affected at this stage. Regular check-ups are important.',
  },
  {
    n: 2,
    c: '#b45309',
    label: 'Grade 2',
    title: 'Moderate Non-Proliferative Diabetic Retinopathy',
    short: 'Moderate NPDR',
    abbr: 'Moderate NPDR',
    action: 'Referable. Eye-care review within 4 weeks. Optimise systemic risk factors.',
    urgency: 'PRIORITY REVIEW',
    urgencyMsg: 'Please arrange an eye-care review soon — within 4 weeks.',
    patientTitle: 'Moderate diabetic retinal changes detected.',
    patientDesc: 'Signs of diabetic blood-vessel damage were detected in the retina. The changes are more than mild and should be reviewed by an eye-care professional.',
  },
  {
    n: 3,
    c: '#ea580c',
    label: 'Grade 3',
    title: 'Severe Non-Proliferative Diabetic Retinopathy',
    short: 'Severe NPDR',
    abbr: 'Severe NPDR',
    action: 'Urgent referral. Eye-care specialist within days. High risk of progression to PDR.',
    urgency: 'URGENT REVIEW',
    urgencyMsg: 'Please seek prompt evaluation by an eye-care professional — within days.',
    patientTitle: 'Significant diabetic retinal changes — prompt review needed.',
    patientDesc: 'More extensive changes were found in the retinal blood vessels. An urgent review by an eye specialist is recommended to prevent further deterioration.',
  },
  {
    n: 4,
    c: '#dc2626',
    label: 'Grade 4',
    title: 'Proliferative Diabetic Retinopathy',
    short: 'PDR',
    abbr: 'PDR',
    action: 'Emergency referral to a hospital eye unit. Risk of sudden vision loss.',
    urgency: 'URGENT — SAME-DAY REVIEW',
    urgencyMsg: 'Please seek same-day evaluation at a hospital eye unit.',
    patientTitle: 'Advanced diabetic eye disease — urgent hospital review needed.',
    patientDesc: 'Advanced signs of diabetic eye disease were detected. New abnormal blood vessels have been identified. An urgent assessment at a hospital eye unit is strongly recommended.',
  },
];

// Map grade number → DR_GRADES entry
export const gradeInfo = (g) => DR_GRADES[g] ?? DR_GRADES[0];

// Clinical findings terminology (ICDR-aligned)
export const CLINICAL_FINDINGS = {
  microaneurysms: { label: 'Microaneurysms', abbr: 'MA' },
  retinalHemorrhages: { label: 'Retinal Hemorrhages', abbr: 'RH' },
  hardExudates: { label: 'Hard Exudates', abbr: 'HE' },
  cottonWoolSpots: { label: 'Cotton-Wool Spots', abbr: 'CWS' },
  venousBeading: { label: 'Venous Beading', abbr: 'VB' },
  irma: { label: 'Intraretinal Microvascular Abnormalities (IRMA)', abbr: 'IRMA' },
  neovascularization: { label: 'Neovascularization', abbr: 'NV' },
  macularEdema: { label: 'Macular Edema', abbr: 'ME' },
};

// Grade-to-macular-edema status mapping for offline/fallback results.
// "Not reliably determined" is used when the model has insufficient evidence.
export const MACULAR_STATUS = [
  'Not apparent',
  'Not reliably determined',
  'Suspected',
  'Suspected',
  'Not reliably determined',
];

// Image quality labels
export const IMAGE_QUALITY_LABEL = (q) => {
  if (q == null) return 'Not assessed';
  if (q >= 75) return 'Gradable';
  if (q >= 50) return 'Limited Quality';
  return 'Ungradable';
};

// ICDR-aligned fallback findings per grade.
// Used when the server is unavailable; labels use proper medical terminology.
export const FALLBACK_FINDINGS = {
  0: [
    { h: 'No Retinal Lesions Detected', p: 'No microaneurysms, hemorrhages, hard exudates, or neovascularization identified.' },
    { h: 'Retinal Vasculature — Within Normal Limits', p: 'Disc margins sharp, vessel calibre regular.' },
  ],
  1: [
    { h: 'Microaneurysms — Detected', p: 'Small outpouchings of capillary walls. Consistent with Mild NPDR.' },
    { h: 'Retinal Hemorrhages — Not detected', p: 'No hemorrhages or hard exudates identified at this time.' },
  ],
  2: [
    { h: 'Retinal Hemorrhages — Detected', p: 'Small intraretinal hemorrhages present.' },
    { h: 'Hard Exudates — Detected', p: 'Lipid deposits identified in the retina.' },
    { h: 'Microaneurysms — Detected', p: 'Multiple microaneurysms noted.' },
  ],
  3: [
    { h: 'Extensive Retinal Hemorrhages — Detected', p: 'Hemorrhages present across multiple quadrants.' },
    { h: 'Venous Beading — Suspected', p: 'Irregular venous calibre changes consistent with Severe NPDR criteria.' },
    { h: 'Intraretinal Microvascular Abnormalities (IRMA) — Suspected', p: 'Abnormal intraretinal vessel patterns noted.' },
  ],
  4: [
    { h: 'Neovascularization — Detected', p: 'Abnormal new vessel formation identified. Consistent with Proliferative Diabetic Retinopathy.' },
    { h: 'Retinal Hemorrhages — Detected', p: 'Extensive intraretinal hemorrhages present.' },
    { h: 'Urgent Ophthalmic Review Required', p: 'Hospital eye-unit assessment recommended.' },
  ],
};

// Chat offline response helper using ICDR terminology
export const offlineChatResponse = (grade, question, confidence) => {
  const gi = gradeInfo(grade);
  const q = (question || '').toLowerCase();
  if (q.includes('next') || q.includes('refer') || q.includes('action')) {
    return `${gi.action} (Confidence ${confidence}%.)`;
  }
  if (q.includes('why') || q.includes('grade') || q.includes('level')) {
    const f = FALLBACK_FINDINGS[grade] || [];
    return `${gi.label} — ${gi.title}. Key findings: ${f.map((x) => x.h).join('; ')}. Confidence ${confidence}%.`;
  }
  if (q.includes('macular') || q.includes('edema')) {
    return `Macular edema status: ${MACULAR_STATUS[grade]}. This is an AI screening aid — confirm with a clinical examination.`;
  }
  return `${gi.label} — ${gi.short}. ${gi.action} (Offline mode — start the server for full clinical context.)`;
};
