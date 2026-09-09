import { Link } from 'react-router-dom';
import { LEVELS } from './Landing.jsx';

const GLOSS = [
  ['Retina', 'The screen at the back of the eye. Diabetes damages its tiny vessels first.'],
  ['Microaneurysm → “tiny bulge”', 'Pin-head weak spot on a vessel. Earliest sign; means sugar control needs work.'],
  ['Hard exudate → “yellow deposit”', 'Leaked fat/protein. Near the centre it threatens reading vision.'],
  ['Hemorrhage → “bleed”', 'Burst tiny vessel. Few = watch; many zones = urgent.'],
  ['Neovascularization → “new fragile vessels”', 'Thin regrowth that bleeds easily. Level 4 — hospital now.'],
  ['Macula', 'Reading-vision centre. Any deposit/bleed here upgrades urgency.'],
  ['Grad-CAM heatmap', 'The glow = where the AI looked. Must overlap the rings, or overrule it.'],
];

export default function Guide() {
  return (
    <div className="page">
      <div className="page-head"><div><span className="kicker">Field guide</span><h1>SOP + levels, one page</h1><p className="muted">Pin this on the PHC wall. Medical terms kept, jargon removed.</p></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link></div>
      <section className="card"><div className="card-h"><b>Levels 0–4 · what to do</b><span className="mono">INTL. CLINICAL SCALE</span></div>
        <div className="rows">
          {LEVELS.map((l) => (
            <div className="row" key={l.n}>
              <span className={`pill l${l.n}`}>L{l.n}</span>
              <span className="row-main"><b>{l.t}</b><small>{l.d}</small></span>
              <span className="act">→ {l.a}</span>
            </div>
          ))}
        </div>
      </section>
      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card"><div className="card-h"><b>Retake SOP (2 min)</b><span className="mono">QUALITY GATE</span></div>
          <div className="card-b"><ol className="sop">
            <li><b>Dim the room</b><span>Tube-light off, curtain drawn. Pupil opens, photo clears.</span></li>
            <li><b>Wipe the lens</b><span>Soft cloth, one swipe. Haze causes half the rejects.</span></li>
            <li><b>Chin still, stare at dot</b><span>Green target. Lids wide, no blinking till the click.</span></li>
            <li><b>Check both eyes</b><span>Right then left. Retake if quality &lt; 65/100.</span></li>
          </ol></div>
        </section>
        <section className="card"><div className="card-h"><b>Plain-words glossary</b><span className="mono">SAY THIS</span></div>
          <div className="rows">{GLOSS.map(([t, d]) => <div className="row" key={t}><span className="row-main"><b>{t}</b><small>{d}</small></span></div>)}</div>
        </section>
      </div>
    </div>
  );
}
