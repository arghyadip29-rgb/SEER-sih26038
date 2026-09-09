// L5 — Rules engine. The API proposes; rules dispose.
// Hard clinical overrides + consistency checks, applied AFTER every proposal
// (mock or real API alike), so hallucinations can't reach the doctor.

export const RETAKE_THRESHOLD = Number(process.env.RETAKE_THRESHOLD || 65);
export const CONFIDENCE_FLOOR = Number(process.env.CONFIDENCE_FLOOR || 70);

export function applyRules({ proposal, quality, sharpness }) {
  const notes = [];
  const rulesApplied = ['L5-pregate:quality-scored-locally'];
  let { grade, confidence, lesions = [] } = proposal;
  grade = Math.max(0, Math.min(4, Math.round(Number(grade) || 0)));
  confidence = Math.max(0, Math.min(100, Math.round(Number(confidence) || 0)));

  // 1. Quality gate — never grade a bad photo, advise retake instead.
  let needsRetake = false;
  let action = null;
  if (quality < RETAKE_THRESHOLD) {
    needsRetake = true;
    confidence = Math.max(0, confidence - 10);
    action = `Photo quality ${quality}/100 is below the ${RETAKE_THRESHOLD} bar — retake first (dim room, wipe lens, steady hold). Advisory read below is not safe to act on.`;
    notes.push('Quality gate tripped: grade is advisory only.');
    rulesApplied.push('L5-quality-gate:retake');
  }

  // 2. NV override — any neovascularization forces L4, however small.
  const hasNV = lesions.some((l) => l.type === 'neovascularization');
  if (hasNV && grade < 4) {
    grade = 4;
    notes.push('NV override: new vessels found, grade raised to L4.');
    rulesApplied.push('L5-nv-override:L4');
  }

  // 3. Grade–lesion consistency — mismatch means human review, not a guess.
  let needsReview = false;
  const types = new Set(lesions.map((l) => l.type));
  const serious = ['hemorrhage', 'hard_exudate', 'soft_exudate', 'venous_beading', 'neovascularization'].some((t) => types.has(t));
  if (grade === 0 && lesions.length > 0) {
    needsReview = true;
    notes.push('Consistency: L0 claimed but lesions listed — needs doctor review.');
    rulesApplied.push('L5-consistency:L0-with-lesions');
  }
  if (grade >= 2 && !serious) {
    needsReview = true;
    notes.push('Consistency: referable grade without referable lesions — needs doctor review.');
    rulesApplied.push('L5-consistency:referable-without-lesions');
  }

  // 4. Confidence floor — uncertain reads escalate instead of sounding sure.
  if (confidence < CONFIDENCE_FLOOR) {
    needsReview = true;
    notes.push(`Low confidence (${confidence}% < ${CONFIDENCE_FLOOR}% floor) — escalate to senior review.`);
    rulesApplied.push('L5-confidence-floor:escalate');
  }

  rulesApplied.push('L5-postgate:referral-mapping');
  return { grade, confidence, lesions, needsRetake, needsReview, notes, rulesApplied, action };
}
