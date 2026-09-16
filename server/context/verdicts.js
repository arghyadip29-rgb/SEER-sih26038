// Shared verdict copy (titles, referral actions, fallback findings).
// Used by the API pipeline and the rules layer. Single source of truth.

export const VERDICTS = {
  0: { title: 'Grade 0 — No Apparent Diabetic Retinopathy', action: 'Routine annual review. Optimise glycaemic and blood-pressure control.', conf: 96,
    findings: [
      { h: 'No Retinal Lesions Detected', p: 'No microaneurysms, hemorrhages, hard exudates, or neovascularization identified.' },
      { h: 'Retinal Vasculature — Within Normal Limits', p: 'Disc margins sharp, vessel calibre regular, macula clear.' }] },
  1: { title: 'Grade 1 — Mild Non-Proliferative Diabetic Retinopathy', action: 'No referral at this time. Optimise blood sugar and blood pressure. Repeat screening in 6–12 months.', conf: 88,
    findings: [
      { h: 'Microaneurysms — Detected', p: 'Small outpouchings of retinal capillary walls. Earliest clinically visible sign.' },
      { h: 'Retinal Hemorrhages — Not detected', p: 'No hemorrhages or hard exudates detected at this time.' }] },
  2: { title: 'Grade 2 — Moderate Non-Proliferative Diabetic Retinopathy', action: 'Referable. Eye-care review within 4 weeks. Optimise systemic risk factors.', conf: 91,
    findings: [
      { h: 'Retinal Hemorrhages — Detected', p: 'Intraretinal hemorrhages identified in the mid-periphery.' },
      { h: 'Hard Exudates — Detected', p: 'Lipid deposits identified in the retinal layers.' },
      { h: 'Microaneurysms — Detected', p: 'Multiple microaneurysms present.' }] },
  3: { title: 'Grade 3 — Severe Non-Proliferative Diabetic Retinopathy', action: 'Urgent referral. Eye-care specialist review within days. High risk of progression to PDR.', conf: 93,
    findings: [
      { h: 'Extensive Retinal Hemorrhages — Detected', p: 'Multi-quadrant blot hemorrhages present.' },
      { h: 'Venous Beading — Suspected', p: 'Irregular venous calibre changes consistent with Severe NPDR (4-2-1 criteria).' },
      { h: 'Intraretinal Microvascular Abnormalities (IRMA) — Suspected', p: 'Abnormal intraretinal vessel patterns noted.' }] },
  4: { title: 'Grade 4 — Proliferative Diabetic Retinopathy', action: 'Emergency referral to hospital eye unit. Risk of vitreous hemorrhage and sudden vision loss.', conf: 94,
    findings: [
      { h: 'Neovascularization — Detected', p: 'Abnormal new vessel formation identified on disc or elsewhere.' },
      { h: 'Extensive Retinal Hemorrhages — Detected', p: 'Widespread intraretinal hemorrhages present.' },
      { h: 'Urgent Hospital Eye-Unit Review Required', p: 'Prompt ophthalmic intervention required.' }] },
};
