// Shared verdict copy (titles, referral actions, fallback findings).
// Used by the API pipeline and the rules layer. Single source of truth.

export const VERDICTS = {
  0: { title: 'Level 0 — No signs of disease', action: 'No referral. Repeat photo in 12 months.', conf: 96,
    findings: [
      { h: 'Clean retina', p: 'No bulges, bleeds or yellow deposits seen in this photo.' },
      { h: 'Nerve head and vessels look normal', p: 'Disc edges sharp, vessels branch evenly, centre (macula) clear.' }] },
  1: { title: 'Level 1 — Mild, watch closely', action: 'No referral yet. Tighten sugar control, recheck in 6–12 months.', conf: 88,
    findings: [
      { h: '3–4 tiny bulges (microaneurysms)', p: 'Pin-head red dots near the centre. Earliest sign — easy to miss without zoom.' },
      { h: 'No bleeds or yellow deposits', p: 'Centre of vision (macula) still clear.' }] },
  2: { title: 'Level 2 — Needs an eye doctor', action: 'Referable. Send to eye doctor within 4 weeks.', conf: 91,
    findings: [
      { h: 'Bleeds (hemorrhages) — 5 found', p: 'Small red patches where tiny vessels leaked.' },
      { h: 'Yellow deposits (hard exudates) — 4 found', p: 'Fat-protein leaks near the centre.' },
      { h: 'Tiny bulges — 9 found', p: 'Clustered around the vessel branches the heatmap highlights.' }] },
  3: { title: 'Level 3 — Severe, urgent referral', action: 'Urgent — eye doctor within days, not months.', conf: 93,
    findings: [
      { h: 'Many bleeds in 3–4 zones', p: 'Large and small red patches. Heatmap glows wide.' },
      { h: 'Bead-like, twisted vessels', p: 'Vessels swell unevenly — a severe-stage clue.' },
      { h: 'Yellow deposits near centre', p: 'Threatens reading vision if it reaches the macula.' }] },
  4: { title: 'Level 4 — Advanced, hospital now', action: 'Emergency referral to hospital eye unit.', conf: 94,
    findings: [
      { h: 'New fragile vessels (neovascularization)', p: 'Thin, lacy vessels that bleed easily.' },
      { h: 'Bleeds and deposits, widespread', p: 'Old and fresh leaks across the photo.' },
      { h: 'Needs hospital eye unit', p: 'Laser / injection assessment. Do not wait.' }] },
};
