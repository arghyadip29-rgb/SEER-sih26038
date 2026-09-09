import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { paintFundus } from '../lib/fundus.js';

export const LEVELS = [
  { n: 0, c: '#0e9f8a', t: 'No signs', d: 'Retina looks healthy. No spots or bleeds.', a: 'Yearly photo check' },
  { n: 1, c: '#65a30d', t: 'Mild — tiny bulges only', d: 'A few tiny vessel bulges (microaneurysms).', a: 'Recheck 6–12 mo' },
  { n: 2, c: '#b45309', t: 'Moderate — needs eye doctor', d: 'Bleeds and/or yellow deposits present.', a: 'Eye doctor · 4 wks' },
  { n: 3, c: '#ea580c', t: 'Severe — many bleeds', d: 'Bleeds across zones, twisted vessels.', a: 'Urgent · days' },
  { n: 4, c: '#dc2626', t: 'Advanced — new vessels', d: 'Fragile new vessels. Sight at risk.', a: 'Emergency · now' },
];

export function AppBar() {
  return (
    <div className="appbar">
      <div className="wrap appbar-in">
        <Link className="brand" to="/"><span className="brand-mark">◉</span>Drishti</Link>
        <nav className="nav-links" aria-label="Main">
          <a href="#how">How it checks</a>
          <a href="#levels">Levels 0–4</a>
          <a href="#rural">For rural PHCs</a>
        </nav>
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
          <span><i style={{ background: '#dc2626' }} />Bleed</span>
          <span><i style={{ background: '#b45309' }} />Yellow deposit</span>
          <span><i style={{ background: '#0b5bd3' }} />AI attention</span>
          <span><i style={{ background: '#0e9f8a' }} />Vessel</span>
        </div>
        <Link className="btn btn-outline btn-sm" to="/login">Try on your photo →</Link>
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
            <p className="lead"><strong>Drishti</strong> checks a photo of the back of the eye (the <em>retina</em>) and <strong>shows its work</strong> — what it saw, where, and how sure it is. One health worker + one portable camera can screen a whole village. <strong>No jargon. 30-second verdict.</strong></p>
            <div className="hero-cta">
              <Link className="btn btn-primary" to="/login">Open Doctor Dashboard →</Link>
              <a className="btn btn-outline" href="#how">See how it checks</a>
            </div>
            <p className="micro">✓ Quality check first · ✓ Heatmap proof · ✓ Refer / no-refer in plain words · ✓ Low-internet friendly</p>
          </div>
          <EyeCompare />
        </div>
        <div className="stats">
          <div className="stat"><b>77M+</b><small>adults live with diabetes in India — 2nd highest in the world</small></div>
          <div className="stat" style={{ borderTopColor: 'var(--teal)' }}><b>~18%</b><small>develop eye changes (retinopathy). Most feel nothing at first.</small></div>
          <div className="stat" style={{ borderTopColor: 'var(--amber)' }}><b>90%</b><small>of vision loss can be prevented with an early eye check</small></div>
          <div className="stat" style={{ borderTopColor: 'var(--danger)' }}><b>1 : 100k</b><small>eye doctors per rural population. Villages can’t wait in line.</small></div>
        </div>
      </header>
      <main className="wrap">
        <section className="section" id="how">
          <div className="sec-head">
            <span className="kicker">How Drishti checks</span>
            <h2>Not a black box. A careful assistant.</h2>
            <p>Old AI says “refer” and walks away. Drishti checks the photo, finds early signs, then <b>points at them</b> so a doctor can confirm in under 30 seconds.</p>
          </div>
          <div className="cards3">
            <article className="step"><span className="tag">STEP 1 · QUALITY GATE</span><h3>Is this photo even checkable?</h3><p>Scores focus, light and view. Blurry or dark? No guessing — retake guidance instead.</p><div className="plain"><b>In plain words →</b>“Too dark on the left. Wipe lens, dim room lights, retake.”</div></article>
            <article className="step"><span className="tag">STEP 2 · FIND EARLY SIGNS</span><h3>Spots the 5 troublemakers</h3><p>Tiny vessel bulges, yellow deposits, bleeds, nerve-head changes, fragile new vessels — outlined on the photo.</p><div className="plain"><b>In plain words →</b>“3 tiny bulges + 2 yellow spots near the centre.”</div></article>
            <article className="step"><span className="tag">STEP 3 · GRADE + PROOF</span><h3>Level 0–4 + heatmap + next step</h3><p>International 5-level scale, confidence score, attention map, one-line referral note.</p><div className="plain"><b>In plain words →</b>“Level 2 — needs an eye doctor within 4 weeks.”</div></article>
          </div>
        </section>
        <section className="section" id="levels">
          <div className="sec-head"><span className="kicker">Levels 0–4 · No jargon</span><h2>What each level means for the patient</h2><p>Same scale eye doctors use worldwide — translated into what to <b>do next</b>.</p></div>
          <div className="levels">
            {LEVELS.map((l) => (
              <div className="level" key={l.n}>
                <div className="bar" style={{ background: l.c }} />
                <div className="body"><span className="tag">LEVEL {l.n}</span><b>{l.t}</b><p>{l.d}</p><span className="act">→ {l.a}</span></div>
              </div>
            ))}
          </div>
        </section>
        <section className="section" id="rural">
          <div className="sec-head"><span className="kicker">Built for the field</span><h2>Made for dusty rooms, shaky power, slow net</h2></div>
          <div className="rural">
            <div className="rural-card">
              <h3 style={{ fontFamily: 'var(--font-display)', margin: 0, fontSize: 20 }}>A PHC kit that just works</h3>
              <p style={{ color: 'var(--muted)', fontSize: 14 }}>One health worker, one portable camera, one laptop.</p>
              <ul className="checks">
                <li><span className="tick">✓</span><span><b>Forgiving with field photos.</b> Auto-evens light and haze. Rejects unusable ones with retake help.</span></li>
                <li><span className="tick">✓</span><span><b>Light to send.</b> ~150 KB per case. Works offline, syncs later.</span></li>
                <li><span className="tick">✓</span><span><b>30-second doctor check.</b> Annotated report + heatmap. Approve, edit, or overrule.</span></li>
                <li><span className="tick">✓</span><span><b>Plans at district scale.</b> Backend sizes load for 1,00,000+ patients/year.</span></li>
              </ul>
            </div>
            <div className="rural-card dark">
              <span className="kicker" style={{ color: '#9ec1ff' }}>Accuracy target · SIH26038</span>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 30, margin: '8px 0 4px', lineHeight: 1.1 }}>&gt;90% catch rate<br />&gt;85% correct rejections</h3>
              <p>For <i>referable</i> disease (Level 2+). Node API mirrors the MATLAB pipeline: quality → enhance → segment → grade → explain.</p>
              <div style={{ marginTop: 14 }}><Link className="btn btn-white" to="/login">Open Doctor Dashboard →</Link></div>
            </div>
          </div>
          <div className="banner">
            <h2>One photo can save a farmer’s sight.</h2>
            <p>Upload a retina photo. Get a level, a heatmap, and a next step — then ask the assistant anything, in simple words.</p>
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-white" to="/login">Launch Doctor Dashboard →</Link>
              <span className="micro" style={{ color: '#d3e2fb', alignSelf: 'center' }}>React + Vite · Node API · SIH26038 demo</span>
            </div>
          </div>
        </section>
      </main>
      <footer className="wrap foot"><div className="foot-in"><span>DRISHTI · SIH26038 · Explainable AI for Diabetic Retinopathy Screening</span><span>Prototype demo — not a medical device. Doctor must confirm.</span></div></footer>
    </>
  );
}
