import { Link } from 'react-router-dom';
import { LEVELS } from './Landing.jsx';

const GLOSS = [
  ['Retina', 'The sensory tissue lining the back of the eye. Sustained hyperglycaemia damages its microvasculature first.'],
  ['Microaneurysms', 'Focal outpouchings of retinal capillary walls. Earliest clinically visible sign of NPDR.'],
  ['Retinal Hemorrhages', 'Intraretinal bleeding from disrupted capillaries. Extent across quadrants guides the ICDR 4-2-1 rule.'],
  ['Hard Exudates', 'Lipid and lipoprotein precipitates within the retina. Proximity to the fovea threatens central visual acuity.'],
  ['Cotton-Wool Spots', 'Superficial nerve fibre layer infarcts resulting from local arteriolar occlusion.'],
  ['Venous Beading', 'Focal calibre variation in retinal veins indicating severe retinal ischaemia (ICDR Severe NPDR criteria).'],
  ['Intraretinal Microvascular Abnormalities (IRMA)', 'Abnormal dilated capillary shunts within the retina in response to ischaemia.'],
  ['Neovascularization', 'Fragile new blood vessel proliferation on the optic disc (NVD) or elsewhere (NVE), hallmark of PDR.'],
  ['Macular Edema', 'Retinal thickening at the macula. Evaluated independently from the overall DR grade.'],
  ['Grad-CAM Attention Heatmap', 'Identifies retinal regions providing highest gradient evidence for the model classification.'],
];

export default function Guide() {
  return (
    <div className="page">
      <div className="page-head"><div><span className="kicker">Field guide</span><h1>SOP + ICDR Grades, one page</h1><p className="muted">Guidance for health centres. Standardized ICDR terminology and SOP.</p></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link></div>
      <section className="card"><div className="card-h"><b>ICDR Grades 0–4 · Clinical Pathway</b><span className="mono">INTL. CLINICAL DR FRAMEWORK</span></div>
        <div className="rows">
          {LEVELS.map((l) => (
            <div className="row" key={l.n}>
              <span className={`pill l${l.n}`}>G{l.n}</span>
              <span className="row-main"><b>{l.t}</b><small>{l.d}</small></span>
              <span className="act">→ {l.a}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card"><div className="card-h"><b>Retake SOP (2 min)</b><span className="mono">QUALITY GATE</span></div>
          <div className="card-b"><ol className="sop">
            <li><b>Dim the room</b><span>Tube-light off, curtain drawn. Pupil opens naturally, photograph clears.</span></li>
            <li><b>Wipe the camera lens</b><span>Soft optical cloth, one swipe. Lens haze causes over 50% of ungradable rejects.</span></li>
            <li><b>Chin still, fixate on target</b><span>Green internal fixation target. Lids wide, hold blink until capture click.</span></li>
            <li><b>Assess both eyes (OD & OS)</b><span>Right then left. Retake if image quality &lt; 65/100 (ungradable).</span></li>
          </ol></div>
        </section>
        <section className="card"><div className="card-h"><b>Ophthalmic Terminology Glossary</b><span className="mono">CLINICAL REFERENCE</span></div>
          <div className="rows">{GLOSS.map(([t, d]) => <div className="row" key={t}><span className="row-main"><b>{t}</b><small>{d}</small></span></div>)}</div>
        </section>
      </div>
    </div>
  );
}
