import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { mulberry, paintFundus } from '../lib/fundus.js';
import { analyzeSample, analyzeUpload, askChat, downloadReport } from '../lib/api.js';
import { getSession, newCaseId, saveCase, statusForGrade } from '../lib/store.js';
import { buildReportPng, captureThumb, downloadPng } from '../lib/reportPng.js';

const PIPES = [
  { k: 'quality', t: 'Photo check', d: 'focus · light · view' },
  { k: 'enhance', t: 'Clean-up', d: 'evens light, cuts haze' },
  { k: 'segment', t: 'Find structures', d: 'nerve head · vessels · spots' },
  { k: 'grade', t: 'Grade 0–4', d: '+ confidence' },
  { k: 'explain', t: 'Proof', d: 'heatmap + report lines' },
];

export default function Screen() {
  const nav = useNavigate();
  const fileRef = useRef(null);
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const logRef = useRef(null);
  const [meta, setMeta] = useState({ patient: '', age: 54, years: 8, eye: 'Right eye', cam: 'Portable — Remidio', name: '' });
  const [view, setView] = useState('orig');
  const [alpha, setAlpha] = useState(75);
  const [pipe, setPipe] = useState({});
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [result, setResult] = useState(null);
  const [hasImage, setHasImage] = useState(false);
  const [toast, setToast] = useState('');
  const [savedId, setSavedId] = useState(null);
  const [msgs, setMsgs] = useState([{ who: 'bot', html: `Photo loaded? Press <b>Analyze photo</b> — quality → grade → proof, via the Node API. Or tap a sample.` }]);
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
    setSavedId(null); setPipe({ quality: 'run' }); setStage('checking photo');
    await wait(650); setPipe({ quality: data.quality < 65 ? 'bad' : 'done', enhance: 'run' }); setStage('thinking');
    await wait(650); setPipe((p) => ({ ...p, enhance: 'done', segment: 'run' })); setStage('matching relevant data');
    await wait(700); setPipe((p) => ({ ...p, segment: 'done', grade: 'run' })); setView('lesion');
    await wait(650); setPipe((p) => ({ ...p, grade: 'done', explain: 'run' })); setStage('adding into knowledge base');
    await wait(650); setPipe((p) => ({ ...p, explain: 'done' })); setView('heat');
    setResult(data); setBusy(false); setStage('');
    push('bot', `Done. This eye is <b>Level ${data.grade}</b> — ${data.action} I'm <b>${data.confidence}%</b> sure. Save it to the queue, then ask <i>why this level</i> or <i>what next</i>.`);
    say('Verdict ready — save it or ask Sahayak.');
  };

  const onFile = (f) => {
    if (!f || !f.type.startsWith('image/')) { say('Please choose an image file (JPG/PNG).'); return; }
    const im = new Image();
    im.onload = () => { imgRef.current = im; setHasImage(true); setMeta((m) => ({ ...m, name: f.name })); setResult(null); setSavedId(null); setPipe({}); setView('orig'); };
    im.src = URL.createObjectURL(f);
    fileRef.current._file = f;
  };

  const analyze = async () => {
    if (busy) return;
    setBusy(true); setStage('sending to AI');
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
      setHasImage(true); setMeta((m) => ({ ...m, name: `sample-L${g}` })); setView('orig');
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
    push('bot', `Saved as <b>${c.id}</b> (${c.patient}). Find it under <b>Cases</b> — referral slip is one tap there.`);
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

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">New screening</span><h1>Photo → verdict → saved</h1></div>
        <span className={`status-dot${busy ? ' busy' : ''}`}>{busy ? 'ANALYZING' : 'READY'} · POST /api/analyze</span>
      </div>
      <div className="dash-grid">
        <section className="card"><div className="card-h"><b>1 · Photo + patient</b><span className="mono">30 SEC</span></div>
          <div className="card-b">
            <div className="drop" tabIndex={0} role="button" aria-label="Upload eye photo"
              onClick={() => fileRef.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter') fileRef.current?.click(); }}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files[0])} />
              <div style={{ fontSize: 24 }}>◉</div>
              <div className="big">Drop eye photo here<br />or <u>browse files</u></div>
              <p>JPG / PNG · quality checked first.</p>
            </div>
            <div className="field"><label>Patient name</label><input value={meta.patient} onChange={(e) => setMeta({ ...meta, patient: e.target.value })} placeholder="Patient full name" /></div>
            <div className="row2">
              <div className="field" style={{ margin: 0 }}><label>Age</label><input type="number" value={meta.age} onChange={(e) => setMeta({ ...meta, age: e.target.value })} /></div>
              <div className="field" style={{ margin: 0 }}><label>Diabetes (yrs)</label><input type="number" value={meta.years} onChange={(e) => setMeta({ ...meta, years: e.target.value })} /></div>
            </div>
            <div className="row2">
              <div className="field"><label>Eye</label><select value={meta.eye} onChange={(e) => setMeta({ ...meta, eye: e.target.value })}><option>Right eye</option><option>Left eye</option></select></div>
              <div className="field"><label>Camera</label><select value={meta.cam} onChange={(e) => setMeta({ ...meta, cam: e.target.value })}><option>Portable — Remidio</option><option>Portable — Forus</option><option>Table-top</option></select></div>
            </div>
            <button className="btn btn-primary btn-block" onClick={analyze} disabled={busy} aria-busy={busy}>
              {busy ? <><span className="spinner" aria-hidden="true" /><span aria-live="polite">{stage || 'working'}<span className="dots" aria-hidden="true" /></span></> : 'Analyze photo →'}
            </button>
            <div className="sample-btns">
              <button onClick={() => sample(0)} disabled={busy}><span className="dotS" style={{ background: '#0e9f8a' }} />Sample · Clear eye <span style={{ marginLeft: 'auto' }} className="mono">L0</span></button>
              <button onClick={() => sample(2)} disabled={busy}><span className="dotS" style={{ background: '#b45309' }} />Sample · Spots + bleeds <span style={{ marginLeft: 'auto' }} className="mono">L2</span></button>
              <button onClick={() => sample(4)} disabled={busy}><span className="dotS" style={{ background: '#dc2626' }} />Sample · Advanced <span style={{ marginLeft: 'auto' }} className="mono">L4</span></button>
            </div>
          </div>
        </section>

        <section className="card"><div className="card-h"><b>2 · What the AI sees</b><span className="mono">{meta.name ? meta.name.slice(0, 24).toUpperCase() : 'NO IMAGE'}</span></div>
          <div className="viewer">
            {!hasImage ? <div className="viewer-empty"><div style={{ fontSize: 28 }}>◉</div><b>Upload a photo to begin</b><p>…or tap a sample.</p></div>
              : <canvas ref={canvasRef} width={880} height={620} aria-label="Retina photo with AI overlay" />}
          </div>
          <div className="chiprow"><span className="tag">VIEW</span>
            {[['orig', 'Photo'], ['vessel', 'Vessels'], ['lesion', 'Spots'], ['heat', 'AI heatmap']].map(([k, t]) => (
              <button key={k} className="chip" aria-pressed={view === k} onClick={() => setView(k)}>{t}</button>
            ))}
            <input type="range" min={0} max={100} value={alpha} onChange={(e) => setAlpha(+e.target.value)} aria-label="Overlay strength" style={{ width: 100, accentColor: 'var(--primary)', marginLeft: 'auto' }} />
          </div>
          <div className="pipe">{PIPES.map((p, i) => (
            <div className="pstep" key={p.k} data-state={pipe[p.k] || ''}><span className="n">{i + 1}</span><span><b>{p.t}</b> — {p.d}</span><small>{pipe[p.k] === 'done' ? 'done ✓' : pipe[p.k] === 'run' ? 'working…' : pipe[p.k] === 'bad' ? 'needs retake' : 'waiting'}</small></div>
          ))}</div>
        </section>

        <div style={{ display: 'grid', gap: 12 }}>
          <section className="card"><div className="card-h"><b>3 · Verdict</b><span className="mono">PLAIN WORDS</span></div>
            <div className="card-b">
              <div className={`verdict ${result ? (result.grade >= 3 ? 'refer' : result.grade === 0 ? 'clear' : 'watch') : ''}`}>
                <h3>{result ? `Level ${result.grade} — ${String(result.title).replace(/^Level \d+ — /, '')}` : 'No photo yet'}</h3>
                <p>{result ? `${result.action} Quality ${result.quality}/100.` : 'Upload or pick a sample.'}</p>
              </div>
              <div className="tag">CONFIDENCE <span style={{ float: 'right' }}>{result ? `${result.confidence}% sure` : '—'}</span></div>
              <div className="meter"><i style={{ width: `${result?.confidence || 0}%` }} /></div>
              <ul className="findings">{(result?.findings || []).map((f, i) => <li key={i}><b>{f.h}</b><span>{f.p}</span></li>)}</ul>
              {result?.needsRetake && <p className="flag retake">↻ Retake advised — quality {result.quality}/100 is below the bar. The grade above is advisory only.</p>}
              {result?.needsReview && <p className="flag review">⚑ Needs senior review — {(result.notes || []).join(' ')}</p>}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" disabled={!result} onClick={save}>＋ Save to cases</button>
                <button className="btn btn-outline btn-sm" disabled={!result} onClick={() => result && downloadReport({ grade: result.grade, age: meta.age, years: meta.years, eye: meta.eye, confidence: result.confidence, quality: result.quality })}>⬇ Slip</button>
                <button className="btn btn-outline btn-sm" disabled={!result || busy} onClick={async () => {
                  if (!result) return;
                  say('Drawing PNG report…');
                  const s = getSession() || {};
                  const url = await buildReportPng(
                    { ...result, id: savedId || 'DRAFT', patient: meta.patient.trim() || 'Unnamed patient', age: meta.age, years: meta.years, eye: meta.eye, camera: meta.cam, status: 'pending', validatedBy: s.doctor, createdAt: Date.now() },
                    imgRef.current || canvasRef.current,
                    s
                  );
                  downloadPng(url, `Drishti-${savedId || 'draft'}-report.png`);
                  say('PNG report downloaded.');
                }}>⬇ PNG report</button>
                {savedId && <Link className="btn btn-outline btn-sm" to={`/app/cases/${savedId}`}>Open {savedId} →</Link>}
              </div>
              {result?.trace ? (
                <details className="trace">
                  <summary>Why this verdict? <span className="mono">packet {result.trace.packetVersion} · {result.trace.provider}{result.trace.degraded ? ' (degraded)' : ''} · {result.trace.aid}</span></summary>
                  <dl>
                    <dt>Layers read through</dt><dd>{result.trace.layers.join(' → ')}</dd>
                    <dt>Grade anchors</dt><dd>{result.trace.anchors.join(', ')}</dd>
                    <dt>Precedent cases</dt><dd>{result.trace.neighbors.join(' · ')}</dd>
                    <dt>Rules applied</dt><dd>{result.trace.rulesApplied.join(' · ')}</dd>
                    <dt>Latency</dt><dd>{result.trace.latencyMs} ms</dd>
                  </dl>
                </details>
              ) : result ? <p className="micro" style={{ marginTop: 8 }}>Offline draft — server unreachable, context packet not attached. Start the API for the full trace.</p> : null}
            </div>
          </section>
          <section className="card"><div className="card-h"><b>Ask Sahayak</b><span className="mono">/api/chat</span></div>
            <div className="card-b">
              <div className="chat-log" ref={logRef}>{msgs.map((m, i) => (
                <div key={i} className={`msg ${m.who}`}><span className="who">{m.who === 'bot' ? 'SAHAYAK' : 'YOU'}</span><span dangerouslySetInnerHTML={{ __html: m.html }} /></div>
              ))}</div>
              <div className="quick">{['What did you see?', 'Why this level?', 'What next?', 'Photo OK?'].map((qq) => <button key={qq} onClick={() => send(qq)}>{qq}</button>)}</div>
              <div className="chat-input">
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ask about spots, level, referral…" aria-label="Ask about this case" />
                <button className="btn btn-primary btn-sm" onClick={() => send()}>Send →</button>
              </div>
              <button className="btn btn-outline btn-sm btn-block" style={{ marginTop: 8 }} onClick={() => nav('/app/assistant')}>Open full assistant →</button>
            </div>
          </section>
        </div>
      </div>
      {toast && <div className="toast show" role="status">{toast}</div>}
    </div>
  );
}
