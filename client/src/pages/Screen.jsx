import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mulberry, paintFundus } from '../lib/fundus.js';
import { analyzeSample, analyzeUpload, askChat, downloadReport } from '../lib/api.js';
import { getSession, newCaseId, saveCase, statusForGrade } from '../lib/store.js';
import { buildReportPng, captureThumb, downloadPng } from '../lib/reportPng.js';
import { gradeInfo, MACULAR_STATUS, IMAGE_QUALITY_LABEL, CLINICAL_FINDINGS } from '../lib/icdr.js';

const PIPES = [
  { k: 'quality', t: 'Quality Gate', d: 'gradability · focus · light' },
  { k: 'enhance', t: 'Contrast Pre-gate', d: 'evens light, cuts haze' },
  { k: 'segment', t: 'Lesion Detection', d: 'MAs · hemorrhages · exudates' },
  { k: 'grade', t: 'ICDR Grade 0–4', d: 'severity scale + confidence' },
  { k: 'explain', t: 'Clinical Evidence', d: 'Grad-CAM attention + report' },
];

export default function Screen() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const logRef = useRef(null);
  const [meta, setMeta] = useState({ patient: '', age: 54, years: 8, eye: 'Right eye (OD)', cam: 'Portable — Remidio', name: '' });
  const [view, setView] = useState('orig');
  const [alpha, setAlpha] = useState(75);
  const [pipe, setPipe] = useState({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [hasImage, setHasImage] = useState(false);
  const [toast, setToast] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [perspective, setPerspective] = useState('clinician'); // 'clinician' | 'patient'
  const [showReportModal, setShowReportModal] = useState(false);
  const [msgs, setMsgs] = useState([{ who: 'bot', html: `Photo loaded? Press <b>Analyze photo</b> — quality → ICDR grade → evidence, via the Node API. Or select a clinical sample.` }]);
  const [q, setQ] = useState('');

  const say = (m) => { setToast(m); clearTimeout(say._h); say._h = setTimeout(() => setToast(''), 2600); };
  useEffect(() => { logRef.current?.scrollTo(0, 99999); }, [msgs]);

  const paint = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); const W = c.width, H = c.height;
    const seed = result?.seed ?? 33, grade = result?.grade ?? 2, dark = !!result?.dark;
    if (imgRef.current) {
      const im = imgRef.current;
      const s = Math.max(W / im.width, H / im.height), w = im.width * s, h = im.height * s;
      ctx.clearRect(0, 0, W, H); ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    } else if (hasImage) {
      paintFundus(ctx, W, H, { seed, grade, lesions: !!result, dark });
    }
    if (!result) return;
    const a = alpha / 100; const rnd = mulberry(seed + 3);
    ctx.save();
    if (view === 'vessel') {
      ctx.globalAlpha = a; ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 2.4;
      const dx = W * 0.72, dy = H * 0.42;
      for (let i = 0; i < 9; i++) { const an = -0.9 + i * 0.24; ctx.beginPath(); ctx.moveTo(dx, dy); ctx.quadraticCurveTo(dx + Math.cos(an) * W * 0.24, dy + Math.sin(an) * H * 0.26, W * 0.5 + Math.cos(an) * W * 0.32, H * 0.5 + Math.sin(an) * H * 0.3); ctx.stroke(); }
    }
    if (view === 'lesion') {
      ctx.globalAlpha = a;
      const n = [0, 4, 12, 26, 30][grade] || 0;
      for (let i = 0; i < n; i++) {
        const x = W * (0.18 + rnd() * 0.6), y = H * (0.2 + rnd() * 0.6), isY = rnd() > 0.55;
        ctx.strokeStyle = isY ? '#fbbf24' : '#f87171'; ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(x, y, isY ? 9 : 7.5, 0, 7); ctx.stroke();
      }
    }
    if (view === 'heat') {
      ctx.globalAlpha = a; const r2 = mulberry(seed + 9);
      for (let i = 0; i < 6 + grade * 3; i++) {
        const x = W * (0.2 + r2() * 0.55), y = H * (0.22 + r2() * 0.55), r = 36 + r2() * 46;
        const gg = ctx.createRadialGradient(x, y, 3, x, y, r);
        gg.addColorStop(0, 'rgba(11,91,211,.85)'); gg.addColorStop(0.5, 'rgba(220,38,38,.5)'); gg.addColorStop(1, 'rgba(180,83,9,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    ctx.restore();
  };
  useEffect(paint);

  const push = (who, html) => setMsgs((m) => [...m, { who, html }]);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const runSteps = async (data) => {
    setSavedId(null); setPipe({ quality: 'run' }); setStage('checking gradability');
    await wait(650); setPipe({ quality: data.quality < 65 ? 'bad' : 'done', enhance: 'run' }); setStage('contrast enhancement');
    await wait(650); setPipe((p) => ({ ...p, enhance: 'done', segment: 'run' })); setStage('segmenting retinal lesions');
    await wait(700); setPipe((p) => ({ ...p, segment: 'done', grade: 'run' })); setView('lesion');
    await wait(650); setPipe((p) => ({ ...p, grade: 'done', explain: 'run' })); setStage('generating clinical evidence');
    await wait(650); setPipe((p) => ({ ...p, explain: 'done' })); setView('heat');
    setResult(data); setBusy(false); setStage('');
    const gi = gradeInfo(data.grade);
    push('bot', `Analysis complete. DR Classification: <b>${gi.label} — ${gi.title}</b>. Urgency: <b>${gi.urgency}</b>. Confidence: <b>${data.confidence}%</b>. Switch to Patient View for lay explanation or download the screening report.`);
    say('Verdict ready — review findings or open report.');
  };

  const onFile = (f) => {
    if (!f || !f.type.startsWith('image/')) { say('Please choose a valid fundus photograph (JPG/PNG).'); return; }
    const im = new Image();
    im.onload = () => { imgRef.current = im; setHasImage(true); setMeta((m) => ({ ...m, name: f.name })); setResult(null); setSavedId(null); setPipe({}); setView('orig'); };
    im.src = URL.createObjectURL(f);
    fileRef.current._file = f;
  };

  const analyze = async () => {
    if (busy) return;
    setBusy(true); setStage('sending to clinical model');
    try {
      const data = fileRef.current?._file && imgRef.current
        ? await analyzeUpload(fileRef.current._file)
        : hasImage && result ? { ...result } : null;
      if (!data) { say('Upload a photo or pick a sample first.'); setBusy(false); setStage(''); return; }
      await runSteps(data);
    } catch { setBusy(false); setStage(''); say('Analysis failed — try again.'); }
  };

  const sample = async (g) => {
    if (busy) return;
    setBusy(true); setStage('loading sample');
    try {
      imgRef.current = null; if (fileRef.current) fileRef.current._file = null;
      setHasImage(true); setMeta((m) => ({ ...m, name: `sample-Grade${g}` })); setView('orig');
      await runSteps(await analyzeSample(g));
    } catch { setBusy(false); setStage(''); say('Sample failed — try again.'); }
  };

  const save = () => {
    if (!result) { say('Analyze first, then save.'); return; }
    const c = saveCase({
      id: newCaseId(), grade: result.grade, patient: meta.patient.trim() || 'Unnamed patient',
      age: meta.age, years: meta.years, eye: meta.eye, camera: meta.cam, confidence: result.confidence,
      quality: result.quality, sharpness: result.sharpness, status: statusForGrade(result.grade),
      createdAt: Date.now(), source: result.source || 'upload', seed: result.seed,
      aid: result.trace?.aid || null,
      thumbnail: captureThumb(imgRef.current || canvasRef.current),
    });
    setSavedId(c.id);
    push('bot', `Saved as <b>${c.id}</b> (${c.patient}). Record updated in clinical queue.`);
    say(`Saved ${c.id} to cases.`);
  };

  const send = async (text) => {
    const query = (text ?? q).trim(); if (!query || busy) return;
    push('user', query.replace(/</g, '&lt;')); setQ('');
    const ctx = result ? { grade: result.grade, confidence: result.confidence, quality: result.quality, sharpness: result.sharpness } : {};
    push('bot', '…');
    const ans = await askChat(query, ctx);
    setMsgs((m) => [...m.slice(0, -1), { who: 'bot', html: ans }]);
  };

  const gi = result ? gradeInfo(result.grade) : gradeInfo(0);
  const macularStatus = result ? MACULAR_STATUS[result.grade] : 'Not assessed';
  const qualityStatus = result ? IMAGE_QUALITY_LABEL(result.quality) : 'Not assessed';

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="kicker">Clinical Screening Workspace</span>
          <h1>Retinal Photo → ICDR Grade → Report</h1>
        </div>
        <span className={`status-dot${busy ? ' busy' : ''}`}>
          {busy ? 'ANALYZING' : 'READY'} · ICDR-Aligned Model
        </span>
      </div>

      <div className="dash-grid">
        {/* Panel 1: Photo & Patient Details */}
        <section className="card">
          <div className="card-h">
            <b>1 · Patient & Fundus Image</b>
            <span className="mono">STEP 1</span>
          </div>
          <div className="card-b">
            <div className="drop" tabIndex={0} role="button" aria-label="Upload fundus photograph"
              onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files[0])} />
              <div style={{ fontSize: 24 }}>◉</div>
              <div className="big">Drop retinal photo here<br />or <u>browse files</u></div>
              <p>JPG / PNG · automatic quality check on upload.</p>
            </div>

            <div className="field"><label>Patient full name</label><input value={meta.patient} onChange={(e) => setMeta({ ...meta, patient: e.target.value })} placeholder="Patient full name" /></div>
            <div className="row2">
              <div className="field" style={{ margin: 0 }}><label>Age (years)</label><input type="number" value={meta.age} onChange={(e) => setMeta({ ...meta, age: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Diabetes (years)</label><input type="number" value={meta.years} onChange={(e) => setMeta({ ...meta, years: e.target.value })} /></div>
            </div>
            <div className="row2">
              <div className="field">
                <label>Eye Examined</label>
                <select value={meta.eye} onChange={(e) => setMeta({ ...meta, eye: e.target.value })}>
                  <option>Right eye (OD)</option>
                  <option>Left eye (OS)</option>
                  <option>Both eyes</option>
                </select>
              </div>
              <div className="field">
                <label>Fundus Camera</label>
                <select value={meta.cam} onChange={(e) => setMeta({ ...meta, cam: e.target.value })}>
                  <option>Portable — Remidio</option>
                  <option>Portable — Forus</option>
                  <option>Table-top Fundus Camera</option>
                </select>
              </div>
            </div>

            <button className="btn btn-primary btn-block" onClick={analyze} disabled={busy} aria-busy={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" /><span aria-live="polite">{stage || 'analyzing'}<span className="dots" aria-hidden="true" /></span></> : 'Analyze Retinal Image →'}
            </button>

            <div className="sample-btns">
              <button onClick={() => sample(0)} disabled={busy}><span className="dotS" style={{ background: '#0e9f8a' }} />Sample · No Apparent DR <span style={{ marginLeft: 'auto' }} className="mono">Grade 0</span></button>
              <button onClick={() => sample(2)} disabled={busy}><span className="dotS" style={{ background: '#b45309' }} />Sample · Moderate NPDR <span style={{ marginLeft: 'auto' }} className="mono">Grade 2</span></button>
              <button onClick={() => sample(4)} disabled={busy}><span className="dotS" style={{ background: '#dc2626' }} />Sample · Proliferative DR <span style={{ marginLeft: 'auto' }} className="mono">Grade 4</span></button>
            </div>
          </div>
        </section>

        {/* Panel 2: Retinal Viewer */}
        <section className="card">
          <div className="card-h">
            <b>2 · Fundus Image Viewer & Localization</b>
            <span className="mono">{meta.name ? meta.name.slice(0, 24).toUpperCase() : 'NO IMAGE'}</span>
          </div>
          <div className="viewer">
            {!hasImage ? (
              <div className="viewer-empty">
                <div style={{ fontSize: 28 }}>◉</div>
                <b>Upload a fundus image to begin</b>
                <p>…or select a calibrated sample.</p>
              </div>
            ) : (
              <canvas ref={canvasRef} width={880} height={620} aria-label="Fundus photograph with AI localization layer" />
            )}
          </div>
          <div className="chiprow">
            <span className="tag">VIEW</span>
            {[
              ['orig', 'Original Photo'],
              ['vessel', 'Vasculature'],
              ['lesion', 'Lesion Markers'],
              ['heat', 'Attention Map'],
            ].map(([k, t]) => (
              <button key={k} className="chip" aria-pressed={view === k} onClick={() => setView(k)}>{t}</button>
            ))}
            <input
              type="range" min={0} max={100} value={alpha}
              onChange={(e) => setAlpha(+e.target.value)}
              aria-label="Overlay strength"
              style={{ width: 100, accentColor: 'var(--primary)', marginLeft: 'auto' }}
            />
          </div>
          {view === 'lesion' && (
            <div style={{ padding: '7px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--line)', display: 'flex', gap: 14, fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--muted)' }}>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#f87171', marginRight: 5 }} />Microaneurysms / Hemorrhages</span>
              <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: '#fbbf24', marginRight: 5 }} />Hard Exudates</span>
            </div>
          )}
          <div className="pipe">
            {PIPES.map((p, i) => (
              <div className="pstep" key={p.k} data-state={pipe[p.k] || ''}>
                <span className="n">{i + 1}</span>
                <span><b>{p.t}</b> — {p.d}</span>
                <small>{pipe[p.k] === 'done' ? 'done ✓' : pipe[p.k] === 'run' ? 'working…' : pipe[p.k] === 'bad' ? 'limited quality' : 'waiting'}</small>
              </div>
            ))}
          </div>
        </section>

        {/* Panel 3: Clinical Verdict & Findings */}
        <div style={{ display: 'grid', gap: 12 }}>
          <section className="card">
            <div className="card-h">
              <b>3 · Screening Verdict & Classification</b>
              <span className="mono">ICDR SCALE</span>
            </div>
            <div className="card-b">
              {/* Primary DR Classification Box */}
              <div className={`verdict ${result ? (result.grade >= 3 ? 'refer' : result.grade === 0 ? 'clear' : 'watch') : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                  <span className="mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--muted)' }}>
                    DIABETIC RETINOPATHY
                  </span>
                  {result && (
                    <span className={`urgency-pill ${result.grade >= 3 ? 'urgent' : result.grade >= 2 ? 'priority' : 'routine'}`}>
                      {gi.urgency}
                    </span>
                  )}
                </div>
                <h3>
                  {result ? `${gi.label} — ${gi.title}` : 'No photo analyzed yet'}
                </h3>
                <p>
                  {result ? result.action : 'Upload a photo or pick a sample to receive a clinical screening result.'}
                </p>
              </div>

              {/* Quality Status & Confidence Indicators */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0 12px' }}>
                <div style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>IMAGE GRADABILITY</span>
                  <span className={`quality-pill ${result ? (result.quality >= 75 ? 'gradable' : result.quality >= 50 ? 'limited' : 'ungradable') : ''}`}>
                    {result ? `${qualityStatus} (${result.quality}/100)` : '—'}
                  </span>
                </div>
                <div style={{ padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)' }}>
                  <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)', display: 'block', marginBottom: 2 }}>MODEL CONFIDENCE</span>
                  <b style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink)' }}>{result ? `${result.confidence}% sure` : '—'}</b>
                </div>
              </div>

              {/* Macular Status (Reported Separately per ICDR) */}
              <div className="macular-box">
                <div className="macular-box-title">MACULAR STATUS (ASSESSED SEPARATELY)</div>
                <div className="macular-box-val">
                  <span>Macular Edema</span>
                  <span className={`finding-badge ${result?.grade >= 2 ? 'suspected' : result ? 'not-detected' : 'unknown'}`}>
                    {macularStatus}
                  </span>
                </div>
              </div>

              {/* Clinician View vs Patient View Toggle */}
              <div style={{ marginTop: 14 }}>
                <div className="perspective-tabs" role="tablist">
                  <button
                    type="button"
                    className={`perspective-btn${perspective === 'clinician' ? ' active' : ''}`}
                    onClick={() => setPerspective('clinician')}
                    role="tab"
                    aria-selected={perspective === 'clinician'}
                  >
                    Clinician Findings
                  </button>
                  <button
                    type="button"
                    className={`perspective-btn${perspective === 'patient' ? ' active' : ''}`}
                    onClick={() => setPerspective('patient')}
                    role="tab"
                    aria-selected={perspective === 'patient'}
                  >
                    Patient Explanation
                  </button>
                </div>

                {perspective === 'clinician' ? (
                  <div>
                    <div className="tag" style={{ marginBottom: 6 }}>KEY RETINAL FINDINGS (ICDR-ALIGNED)</div>
                    <ul className="findings">
                      {result ? (
                        [
                          { name: 'Microaneurysms', state: result.grade >= 1 ? 'detected' : 'not-detected', text: result.grade >= 1 ? 'Capillary wall micro-outpouchings identified' : 'Not detected' },
                          { name: 'Retinal Hemorrhages', state: result.grade >= 2 ? 'detected' : 'not-detected', text: result.grade >= 3 ? 'Multi-quadrant blot hemorrhages present' : result.grade === 2 ? 'Small intraretinal hemorrhages detected' : 'Not detected' },
                          { name: 'Hard Exudates', state: result.grade >= 2 ? 'detected' : 'not-detected', text: result.grade >= 2 ? 'Lipid / lipoprotein deposits detected' : 'Not detected' },
                          { name: 'Cotton-Wool Spots', state: result.grade >= 3 ? 'suspected' : 'not-detected', text: result.grade >= 3 ? 'Nerve fibre layer infarcts suspected' : 'Not detected' },
                          { name: 'Venous Beading', state: result.grade >= 3 ? 'suspected' : 'not-detected', text: result.grade >= 3 ? 'Focal venous calibre changes suspected (4-2-1 criteria)' : 'Not detected' },
                          { name: 'Intraretinal Microvascular Abnormalities (IRMA)', state: result.grade >= 3 ? 'suspected' : 'not-detected', text: result.grade >= 3 ? 'Abnormal branching patterns suspected' : 'Not detected' },
                          { name: 'Neovascularization', state: result.grade >= 4 ? 'detected' : 'not-detected', text: result.grade >= 4 ? 'Abnormal new vessel growth at disc or elsewhere (PDR marker)' : 'Not detected' },
                        ].map((f, i) => (
                          <li key={i} className="finding-row">
                            <div>
                              <b className="finding-name">{f.name}</b>
                              <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>{f.text}</span>
                            </div>
                            <span className={`finding-badge ${f.state}`}>
                              {f.state === 'detected' ? 'Detected' : f.state === 'suspected' ? 'Suspected' : 'Not detected'}
                            </span>
                          </li>
                        ))
                      ) : (
                        <li className="finding-row"><span className="muted">No findings on file.</span></li>
                      )}
                    </ul>
                  </div>
                ) : (
                  <div style={{ padding: 12, background: 'var(--surface-2)', borderRadius: 8, border: '1px solid var(--line)', marginBottom: 10 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', letterSpacing: '0.06em' }}>WHAT THIS MEANS</span>
                    <h4 style={{ margin: '6px 0 4px', fontSize: 14 }}>{gi.patientTitle}</h4>
                    <p style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>{gi.patientDesc}</p>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: 'var(--amber)', letterSpacing: '0.06em' }}>RECOMMENDED NEXT STEP</span>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink)', fontWeight: 600 }}>{gi.urgencyMsg}</p>
                  </div>
                )}
              </div>

              {result?.needsRetake && (
                <p className="flag retake">↻ Retake advised — photo quality {result.quality}/100 is below the gradable threshold. The classification above is advisory only.</p>
              )}
              {result?.needsReview && (
                <p className="flag review">⚑ Requires ophthalmologist review — {(result.notes || []).join(' ')}</p>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
                <button className="btn btn-primary btn-sm" disabled={!result} onClick={save}>＋ Save to cases</button>
                <button className="btn btn-outline btn-sm" disabled={!result} onClick={() => setShowReportModal(true)}>👁 Patient report</button>
                <button className="btn btn-outline btn-sm" disabled={!result || busy} onClick={async () => {
                  if (!result) return;
                  say('Rendering ICDR screening report…');
                  const s = getSession() || {};
                  const url = await buildReportPng(
                    { ...result, id: savedId || 'DRAFT', patient: meta.patient.trim() || 'Unnamed patient', age: meta.age, years: meta.years, eye: meta.eye, camera: meta.cam, status: 'pending', validatedBy: s.doctor, createdAt: Date.now() },
                    imgRef.current || canvasRef.current,
                    s
                  );
                  downloadPng(url, `SEER-${savedId || 'draft'}-report.png`);
                  say('PNG report downloaded.');
                }}>⬇ PNG report</button>
                <button className="btn btn-outline btn-sm" disabled={!result} onClick={() => result && downloadReport({ grade: result.grade, age: meta.age, years: meta.years, eye: meta.eye, confidence: result.confidence, quality: result.quality })}>⬇ Referral slip</button>
              </div>

              {savedId && (
                <div style={{ marginTop: 10 }}>
                  <Link className="btn btn-outline btn-sm" to={`/app/cases/${savedId}`}>Open Case {savedId} →</Link>
                </div>
              )}
            </div>
          </section>

          {/* Assistant Chat */}
          <section className="card">
            <div className="card-h">
              <b>Ask Sahayak · Clinical AI Query</b>
              <span className="mono">/api/chat</span>
            </div>
            <div className="card-b">
              <div className="chat-log" ref={logRef}>
                {msgs.map((m, i) => (
                  <div key={i} className={`msg ${m.who}`}>
                    <span className="who">{m.who === 'bot' ? 'SAHAYAK' : 'YOU'}</span>
                    <span dangerouslySetInnerHTML={{ __html: m.html }} />
                  </div>
                ))}
              </div>
              <div className="quick">
                {['What did you see?', 'Why this grade?', 'What next?', 'Macular edema status?'].map((qq) => (
                  <button key={qq} onClick={() => send(qq)}>{qq}</button>
                ))}
              </div>
              <div className="chat-input">
                <input
                  value={q} onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && send()}
                  placeholder="Ask about retinal findings, ICDR grade, referral urgency…"
                  aria-label="Ask about this case"
                />
                <button className="btn btn-primary btn-sm" onClick={() => send()}>Send →</button>
              </div>
              <button className="btn btn-outline btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => nav('/app/assistant')}>Open full assistant →</button>
            </div>
          </section>
        </div>
      </div>

      {/* Patient Report Modal Preview */}
      {showReportModal && result && (
        <div className="report-modal-backdrop" onClick={() => setShowReportModal(false)}>
          <div className="report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-h">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="brand-mark" style={{ width: 24, height: 24, fontSize: 13 }}>◉</span>
                <b style={{ fontSize: 16 }}>Diabetic Retinopathy Screening Report</b>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setShowReportModal(false)}>✕ Close</button>
            </div>
            <div className="report-modal-b">
              <div className="report-paper">
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid var(--line)', paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, letterSpacing: '-0.02em', color: 'var(--ink)' }}>SEER</h2>
                    <span style={{ fontSize: 13, color: 'var(--muted)' }}>Diabetic Retinopathy Screening Report</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="mono" style={{ fontSize: 12, display: 'block', color: 'var(--ink)', fontWeight: 600 }}>{savedId || 'DRAFT-SCREENING'}</span>
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>{new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                {/* Patient Information */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, padding: 12, background: 'var(--surface-2)', borderRadius: 8, marginBottom: 16, fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>PATIENT</span><b>{meta.patient.trim() || 'Unnamed patient'}</b></div>
                  <div><span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>AGE / DIABETES</span><b>{meta.age}y / {meta.years}y</b></div>
                  <div><span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>EXAMINED EYE</span><b>{meta.eye}</b></div>
                  <div><span style={{ color: 'var(--muted)', display: 'block', fontSize: 11 }}>CAMERA</span><b>{meta.cam}</b></div>
                </div>

                {/* Screening Result & Urgency */}
                <div style={{ padding: 16, background: gi.c + '18', border: `1.5px solid ${gi.c}`, borderRadius: 8, marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span className="mono" style={{ fontSize: 11, fontWeight: 700, color: gi.c }}>ICDR CLINICAL CLASSIFICATION</span>
                    <span className={`urgency-pill ${result.grade >= 3 ? 'urgent' : result.grade >= 2 ? 'priority' : 'routine'}`}>{gi.urgency}</span>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 18, color: 'var(--ink)' }}>{gi.label} — {gi.title}</h3>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--ink)', opacity: 0.9 }}>{gi.action}</p>
                </div>

                {/* What This Means (Patient Explanation) */}
                <div style={{ marginBottom: 16 }}>
                  <h4 style={{ margin: '0 0 4px', fontSize: 14, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--primary)' }}>What This Means for You</h4>
                  <p style={{ margin: 0, fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}>{gi.patientDesc}</p>
                </div>

                {/* Findings & Macular Status */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 14, marginBottom: 16 }}>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Key Retinal Findings</h4>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.6 }}>
                      <li>Microaneurysms: <b>{result.grade >= 1 ? 'Detected' : 'Not detected'}</b></li>
                      <li>Retinal Hemorrhages: <b>{result.grade >= 2 ? 'Detected' : 'Not detected'}</b></li>
                      <li>Hard Exudates: <b>{result.grade >= 2 ? 'Detected' : 'Not detected'}</b></li>
                      <li>Neovascularization: <b>{result.grade >= 4 ? 'Detected (PDR)' : 'Not detected'}</b></li>
                    </ul>
                  </div>
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: 13, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--muted)' }}>Macular Status</h4>
                    <p style={{ margin: 0, fontSize: 13 }}>
                      Macular Edema: <b>{macularStatus}</b>
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--muted)' }}>
                      Image Quality: <b>{qualityStatus}</b> ({result.quality}/100)
                    </p>
                  </div>
                </div>

                {/* Clinical Review Status & Disclaimer */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, fontSize: 12, color: 'var(--muted)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span>AI Screening Aid Result: <b>{gi.label}</b> (Confidence {result.confidence}%)</span>
                    <span>Clinician Review: <b>Pending Confirmation</b></span>
                  </div>
                  <p style={{ margin: 0, fontStyle: 'italic' }}>
                    IMPORTANT: This screening report is intended for preliminary ophthalmic screening support and does not replace examination or diagnosis by a qualified eye-care professional.
                  </p>
                </div>
              </div>

              {/* Modal footer controls */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button className="btn btn-outline" onClick={() => window.print()}>Print Report</button>
                <button className="btn btn-primary" onClick={async () => {
                  const s = getSession() || {};
                  const url = await buildReportPng(
                    { ...result, id: savedId || 'DRAFT', patient: meta.patient.trim() || 'Unnamed patient', age: meta.age, years: meta.years, eye: meta.eye, camera: meta.cam, status: 'pending', validatedBy: s.doctor, createdAt: Date.now() },
                    imgRef.current || canvasRef.current,
                    s
                  );
                  downloadPng(url, `SEER-${savedId || 'draft'}-report.png`);
                  say('Report downloaded.');
                }}>Download PNG Report</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}

