// L1 — Clinical rubric. Countable grade criteria distilled from the
// International Clinical DR scale + IDRiD lesion priors. This is what pins
// the API's grade boundaries so it can't drift between requests.

export const PACKET_VERSION = 'p0.1';

export const RUBRIC = [
  { grade: 0, name: 'No signs', rule: 'Zero microaneurysms, zero bleeds, zero exudates. Clean vessels, sharp disc.', action: 'No referral. Yearly photo check.' },
  { grade: 1, name: 'Mild', rule: 'Microaneurysms ONLY (a few pin-head red dots). No bleeds, no exudates, no beading.', action: 'No referral yet. Sugar control, recheck 6–12 months.' },
  { grade: 2, name: 'Moderate — REFERABLE', rule: 'Any bleed OR any hard exudate, or crowded microaneurysms. This is the referral threshold.', action: 'Refer to eye doctor within 4 weeks.' },
  { grade: 3, name: 'Severe — URGENT', rule: 'Many bleeds across zones, venous beading, or large blot areas. Reading vision threatened.', action: 'Urgent — eye doctor within days.' },
  { grade: 4, name: 'Advanced (proliferative) — EMERGENCY', rule: 'ANY new fragile vessels (neovascularization), however small. Overrides everything below.', action: 'Emergency — hospital eye unit now.' },
];

// IDRiD-derived priors: lesion pixels are rare, so small counts are meaningful.
export const PRIORS =
  'Scale priors from IDRiD: microaneurysm pixels ≈0.1% of image area, hemorrhages ≈1%, exudates ≈0.9%. ' +
  'A handful of pin-head red dots is a real finding, not noise. Soft exudates are uncommon — do not expect them in every case.';

export const LESION_GLOSSARY = {
  microaneurysm: { label: 'Tiny bulges (microaneurysms)', plain: 'Pin-head weak spots on vessel walls from high sugar. Earliest sign.' },
  hemorrhage: { label: 'Bleeds (hemorrhages)', plain: 'Small red patches where tiny vessels leaked.' },
  hard_exudate: { label: 'Yellow deposits (hard exudates)', plain: 'Leaked fat and protein near the centre. Threatens reading vision.' },
  soft_exudate: { label: 'Soft yellow patches (soft exudates)', plain: 'Pale fluffy patches where nerve fibres are starved of blood.' },
  venous_beading: { label: 'Bead-like, twisted vessels', plain: 'Vessels swell unevenly — a severe-stage clue.' },
  neovascularization: { label: 'New fragile vessels', plain: 'Thin, lacy regrowth that bleeds easily and can steal sight suddenly.' },
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
