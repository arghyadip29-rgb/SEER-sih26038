import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { paintFundus } from '../lib/fundus.js';
import seerLogo from '../assets/seer-logo.png';
import ThemeToggle from '../components/ThemeToggle.jsx';

export const LEVELS = [
  { n: 0, c: '#0e9f8a', t: 'Grade 0 — No Apparent DR', d: 'Retina appears healthy. No microaneurysms, retinal hemorrhages, or exudates identified.', a: 'Routine annual review' },
  { n: 1, c: '#65a30d', t: 'Grade 1 — Mild NPDR', d: 'Microaneurysms only. Small vessel wall outpouchings; vision is typically unaffected.', a: 'Recheck in 6–12 months' },
  { n: 2, c: '#b45309', t: 'Grade 2 — Moderate NPDR', d: 'Retinal hemorrhages and/or hard exudates detected. Clinical referral threshold.', a: 'Eye-care review within 4 weeks' },
  { n: 3, c: '#ea580c', t: 'Grade 3 — Severe NPDR', d: 'Multi-quadrant retinal hemorrhages or venous beading. High risk of progression.', a: 'Urgent referral within days' },
  { n: 4, c: '#dc2626', t: 'Grade 4 — Proliferative DR (PDR)', d: 'Neovascularization (abnormal new vessels). Immediate risk of vision loss.', a: 'Emergency — hospital eye unit' },
];

export function AppBar() {
  return (
    <div className="appbar">
      <div className="wrap appbar-in">
        <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
        <nav className="nav-links" aria-label="Main">
          <a href="#how">How it checks</a>
          <a href="#grades">ICDR Grades 0–4</a>
          <a href="#rural">For rural PHCs</a>
        </nav>
        <ThemeToggle />
        <span className="ps-chip">SIH26038 · MathWorks</span>
        <Link className="btn btn-primary btn-sm" to="/login">Doctor sign in →</Link>
      </div>
    </div>
  );
}

function EyeCompare() {
  const origRef = useRef(null), aiRef = useRef(null), boxRef = useRef(null);
  const [split, setSplit] = useState(52);
  const [showAi, setShowAi] = useState(true);
  useEffect(() => {
    paintFundus(origRef.current.getContext('2d'), 800, 560, { seed: 21, grade: 2, lesions: true });
    paintFundus(aiRef.current.getContext('2d'), 800, 560, { seed: 21, grade: 2, lesions: true, heat: true, alpha: 0.85 });
  }, []);
  const move = (clientX) => {
    const r = boxRef.current.getBoundingClientRect();
    setSplit(Math.max(4, Math.min(96, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div className="card" aria-label="Interactive demo: drag to compare photo and AI proof">
      <div className="card-h">
        <span className="mono">LIVE DEMO — DRAG THE HANDLE</span>
        <div className="seg" role="group" aria-label="Demo view">
          <button aria-pressed={!showAi} onClick={() => setShowAi(false)}>Photo</button>
          <button aria-pressed={showAi} onClick={() => setShowAi(true)}>AI proof</button>
        </div>
      </div>
      <div
        className="eye-compare" ref={boxRef}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); e.currentTarget.onpointermove = (ev) => move(ev.clientX); e.currentTarget.onpointerup = () => { e.currentTarget.onpointermove = null; }; }}
        tabIndex={0} onKeyDown={(e) => { if (e.key === 'ArrowLeft') setSplit((s) => Math.max(4, s - 4)); if (e.key === 'ArrowRight') setSplit((s) => Math.min(96, s + 4)); }}
      >
        <canvas ref={origRef} width={800} height={560} aria-label="Simulated eye photo" />
        <div className="eye-layer" style={{ clipPath: `inset(0 0 0 ${split}%)`, opacity: showAi ? 1 : 0 }}>
          <canvas ref={aiRef} width={800} height={560} aria-label="Simulated AI heatmap" />
        </div>
        <span className="eye-badge left">PHOTO</span>
        <span className="eye-badge right">AI HEATMAP</span>
        {showAi && <div className="eye-divider" style={{ left: `${split}%` }}><div className="eye-handle">↔</div></div>}
      </div>
      <div className="card-b" style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="legend">
          <span><i style={{ background: '#dc2626' }} />Retinal Hemorrhages</span>
          <span><i style={{ background: '#b45309' }} />Hard Exudates</span>
          <span><i style={{ background: '#0b5bd3' }} />AI Attention</span>
          <span><i style={{ background: '#0e9f8a' }} />Retinal Vasculature</span>
        </div>
        <Link className="btn btn-outline btn-sm" to="/login">Try on your photo →</Link>
      </div>
    </div>
  );
}

function Spectrum() {
  const [sel, setSel] = useState(2);
  const l = LEVELS[sel];
  return (
    <div>
      <div className="spectrum" role="group" aria-label="Severity grades 0 to 4 based on ICDR scale">
        {LEVELS.map((x) => (
          <button key={x.n} className={`spec-seg${sel === x.n ? ' sel' : ''}`} style={{ '--sc': x.c }}
            aria-pressed={sel === x.n} onClick={() => setSel(x.n)} onMouseEnter={() => setSel(x.n)}>
            <span>Grade {x.n}</span>
          </button>
        ))}
        <span className="spec-threshold" aria-hidden="true">refer →</span>
      </div>
      <div className="spec-detail" aria-live="polite">
        <span className="pill" style={{ background: l.c }}>Grade {l.n}</span>
        <div><b>{l.t}</b><p>{l.d}</p><span className="act">→ {l.a}</span></div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <>
      <AppBar />
      <header className="wrap hero">
        <div className="hero-grid">
          <div>
            <span className="eyebrow">For PHCs · Portable-camera ready · English + हिन्दी</span>
            <h1 className="hero-title">Diabetes can steal sight before you feel it. We catch it early.</h1>
            <p className="lead"><strong>SEER</strong> checks a photo of the back of the eye and <strong>shows its work</strong> — what it saw, where, and how sure it is. <strong>ICDR-aligned grading. 30-second verdict.</strong></p>
            <div className="hero-cta">
              <Link className="btn btn-primary" to="/login">Open Doctor Dashboard →</Link>
              <a className="btn btn-outline" href="#how">See how it checks</a>
            </div>
          </div>
          <div className="hero-logo-wrap">
            <img src={seerLogo} alt="SEER — AI-Powered Retinal Screening" className="hero-logo" />
          </div>
        </div>
        <dl className="statstrip">
          <div><dt>77M+</dt><dd>adults with diabetes in India</dd></div>
          <div><dt>~18%</dt><dd>develop eye changes, silently</dd></div>
          <div><dt>90%</dt><dd>of vision loss is preventable</dd></div>
          <div><dt>1 : 100k</dt><dd>eye doctors per rural population</dd></div>
        </dl>
      </header>

      <main className="wrap">
        <section className="section" id="how">
          <div className="sec-head"><span className="kicker">How SEER checks</span>
            <h2>Not a black box. A careful clinical screening aid.</h2></div>
          <ol className="flow3">
            <li><span className="fnum">01</span><div><b>Is this photo gradable?</b><p>Focus, light, view — scored first. Blurry or dim photos receive retake guidance, never an unreliable grade.</p></div></li>
            <li><span className="fnum">02</span><div><b>Detect clinical lesions</b><p>Microaneurysms, retinal hemorrhages, hard exudates, neovascularization — localized on the fundus photograph.</p></div></li>
            <li><span className="fnum">03</span><div><b>ICDR grade + evidence</b><p>Grade 0–4 (ICDR severity scale), confidence, attention heatmap, and referral urgency. Confirmed in 30 seconds.</p></div></li>
          </ol>
        </section>

        <section className="section" id="grades">
          <div className="sec-head"><span className="kicker">Grades 0–4 · ICDR Framework</span>
            <h2>One spectrum, one referral line.</h2>
            <p>DR severity terminology based on the International Clinical Diabetic Retinopathy framework. Grade 2 is where referable care starts.</p></div>
          <Spectrum />
        </section>

        <section className="section" id="rural">
          <div className="sec-head"><span className="kicker">Built for the field</span>
            <h2>Made for dusty rooms, shaky power, slow net.</h2></div>
          <div className="rural">
            <ul className="plainlist">
              <li><b>Forgiving with field photos.</b><span>Auto-evens light and haze; rejects the unusable with retake help.</span></li>
              <li><b>Light to send.</b><span>~150 KB a case. Offline-first, syncs later.</span></li>
              <li><b>30-second doctor check.</b><span>Annotated report + heatmap. Approve, edit, or overrule.</span></li>
              <li><b>District scale.</b><span>Sized for 1,00,000+ patients a year, over 90% catch rate.</span></li>
            </ul>
            <div className="rural-card dark">
              <span className="kicker" style={{ color: '#9ec1ff' }}>Accuracy target · SIH26038</span>
              <h3>&gt;90% catch rate<br />&gt;85% correct rejections</h3>
              <p>For <i>referable</i> disease (Grade 2+). Node API mirrors the MATLAB pipeline: quality → enhance → segment → grade → explain.</p>
              <div style={{ marginTop: 14 }}><Link className="btn btn-white" to="/login">Open Doctor Dashboard →</Link></div>
            </div>
          </div>
        </section>

        <div className="banner">
          <h2>One photo can save a farmer’s sight.</h2>
          <p>Upload a retina photo. Get an ICDR clinical grade, localization evidence, and patient next steps — then ask the assistant anything, in simple words.</p>
          <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-white" to="/login">Launch Doctor Dashboard →</Link>
          </div>
        </div>
      </main>
      <footer className="wrap foot"><div className="foot-in"><span>SEER · SIH26038 · Explainable AI for Diabetic Retinopathy Screening</span><span>Prototype screening aid — not a medical device. Clinical findings require ophthalmologist confirmation.</span></div></footer>
    </>
  );
}
