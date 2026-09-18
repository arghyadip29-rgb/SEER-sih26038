// L1 — Clinical rubric. Countable grade criteria distilled from the
// International Clinical DR scale + IDRiD lesion priors. This is what pins
// the API's grade boundaries so it can't drift between requests.

export const PACKET_VERSION = 'p0.1';

export const RUBRIC = [
  { grade: 0, name: 'Grade 0 · No Apparent Retinopathy', rule: 'Zero microaneurysms, zero retinal hemorrhages, zero hard exudates. Clear vessels, sharp optic disc.', action: 'No referral indicated for DR. Annual dilated screening recommended.' },
  { grade: 1, name: 'Grade 1 · Mild Non-Proliferative DR (Mild NPDR)', rule: 'Microaneurysms only. No retinal hemorrhages, hard exudates, or venous beading.', action: 'Routine review in 6–12 months. Glycemic and blood pressure optimization.' },
  { grade: 2, name: 'Grade 2 · Moderate Non-Proliferative DR (Moderate NPDR)', rule: 'Microaneurysms, retinal hemorrhages, and/or hard exudates present, but less than Severe NPDR criteria.', action: 'Priority ophthalmology referral within 4–6 weeks.' },
  { grade: 3, name: 'Grade 3 · Severe Non-Proliferative DR (Severe NPDR)', rule: 'Extensive intraretinal hemorrhages (≥20 in each of 4 quadrants), venous beading in ≥2 quadrants, or prominent IRMA in ≥1 quadrant (ICDR 4-2-1 rule).', action: 'Urgent ophthalmologist consultation within 1–2 weeks.' },
  { grade: 4, name: 'Grade 4 · Proliferative Diabetic Retinopathy (PDR)', rule: 'Neovascularization of the disc (NVD) or elsewhere (NVE), and/or preretinal or vitreous hemorrhage.', action: 'Urgent same-day / immediate ophthalmology evaluation for specialized management.' },
];

// IDRiD-derived priors: lesion pixels are rare, so small counts are meaningful.
export const PRIORS =
  'Scale priors from IDRiD: microaneurysm pixels ≈0.1% of image area, hemorrhages ≈1%, exudates ≈0.9%. ' +
  'Microaneurysms represent genuine focal capillary pathology. Cotton-wool spots indicate focal nerve fiber layer ischemia.';

export const LESION_GLOSSARY = {
  microaneurysm: { label: 'Microaneurysms', plain: 'Focal capillary wall outpouchings appearing as small red dots; earliest clinical hallmark of diabetic retinopathy.' },
  hemorrhage: { label: 'Retinal Hemorrhages', plain: 'Dot, blot, or flame-shaped intraretinal hemorrhages caused by capillary compromise and vascular hyperpermeability.' },
  hard_exudate: { label: 'Hard Exudates', plain: 'Discrete yellow lipid and protein precipitates resulting from vascular leakage; warrants evaluation for macular edema.' },
  soft_exudate: { label: 'Cotton-Wool Spots', plain: 'Superficial fluffy white retinal lesions caused by localized axoplasmic stasis in nerve fiber layer infarcts.' },
  venous_beading: { label: 'Venous Beading', plain: 'Focal caliber irregularity and localized dilation of retinal veins; a hallmark of severe retinal ischemia.' },
  neovascularization: { label: 'Neovascularization', plain: 'Pathologic preretinal new vessel proliferation (NVD/NVE) driven by ischemia; hallmark of Proliferative DR.' },
};

export const KNOWN_LESION_TYPES = Object.keys(LESION_GLOSSARY);

// Canonical lesion sets per grade — used by the local mock provider and as
// the "expected evidence" cross-check for real API proposals.
export function canonicalLesions(grade) {
  switch (grade) {
    case 0: return [];
    case 1: return [{ type: 'microaneurysm', count: 4, location: 'near the centre' }];
    case 2: return [
      { type: 'hemorrhage', count: 5, location: 'scattered mid-periphery' },
      { type: 'hard_exudate', count: 4, location: 'near the centre' },
      { type: 'microaneurysm', count: 9, location: 'along vessel branches' },
    ];
    case 3: return [
      { type: 'hemorrhage', count: 18, location: 'in 3–4 zones' },
      { type: 'venous_beading', count: 3, location: 'major arcades' },
      { type: 'hard_exudate', count: 12, location: 'near the centre' },
    ];
    default: return [
      { type: 'neovascularization', count: 2, location: 'disc and arcades' },
      { type: 'hemorrhage', count: 24, location: 'widespread' },
      { type: 'hard_exudate', count: 9, location: 'across the photo' },
    ];
  }
}

// Turn a lesion list into plain-word findings for the verdict card.
export function lesionsToFindings(lesions = []) {
  return lesions.map((l) => {
    const g = LESION_GLOSSARY[l.type] || { label: l.type, plain: 'Flagged by the model — confirm on the photo.' };
    const n = l.count > 1 ? ` — ${l.count} found` : '';
    const where = l.location ? ` ${l.location.charAt(0).toUpperCase() + l.location.slice(1)}.` : '';
    return { h: `${g.label}${n}`, p: `${g.plain}${where}` };
  });
}
