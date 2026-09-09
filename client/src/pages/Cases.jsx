import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCases, getSession, saveCase, STATUS_LABEL } from '../lib/store.js';
import { downloadReport, submitCorrection } from '../lib/api.js';
import { buildReportPng, downloadPng } from '../lib/reportPng.js';

const TABS = ['all', 'queued', 'referred', 'urgent', 'cleared'];

export function Cases() {
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const cases = getCases();
  const list = useMemo(() => cases.filter((c) =>
    (tab === 'all' || c.status === tab) &&
    (!query || (c.patient + c.id).toLowerCase().includes(query.toLowerCase()))), [cases, tab, query]);
  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">Cases · {cases.length} total</span><h1>Queue</h1></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link>
      </div>
      <div className="toolbar">
        <div className="seg">{TABS.map((t) => <button key={t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t === 'all' ? `All (${cases.length})` : `${STATUS_LABEL[t]} (${cases.filter((c) => c.status === t).length})`}</button>)}</div>
        <input className="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or ID…" aria-label="Search cases" />
      </div>
      <section className="card"><div className="rows">
        {list.map((c) => (
          <Link key={c.id} className="row" to={`/app/cases/${c.id}`}>
            <span className={`pill l${c.grade}`}>L{c.grade}</span>
            <span className="row-main"><b>{c.patient}</b><small>{c.id} · {c.age}y · {c.eye} · {new Date(c.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</small></span>
            <span className="mono muted">{c.confidence}%</span>
            <span className={`status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
          </Link>
        ))}
        {!list.length && <p className="muted" style={{ padding: 16 }}>No cases here. Try another tab — or screen someone new.</p>}
      </div></section>
    </div>
  );
}

export function CaseDetail() {
  const { id } = useParams();
  const c = getCases().find((x) => x.id === id);
  const [note, setNote] = useState(c?.note || '');
  const [corr, setCorr] = useState({ grade: c?.grade ?? 2, reason: '' });
  const [corrMsg, setCorrMsg] = useState('');
  if (!c) return <div className="page"><p>Case not found. <Link to="/app/cases">Back to queue →</Link></p></div>;
  const setStatus = (status) => { saveCase({ ...c, status, validatedBy: getSession()?.doctor || c.validatedBy, validatedAt: Date.now() }); location.reload(); };
  const [pngBusy, setPngBusy] = useState(false);
  const pngReport = async () => {
    setPngBusy(true);
    try {
      const s = getSession() || {};
      const url = await buildReportPng(c, c.thumbnail, s);
      downloadPng(url, `Drishti-${c.id}-report.png`);
    } finally { setPngBusy(false); }
  };
  const sendCorrection = async () => {
    try {
      await submitCorrection({ aid: c.aid || null, caseId: c.id, correctedGrade: Number(corr.grade), reason: corr.reason, doctor: getSession()?.doctor || '' });
      saveCase({ ...c, correctedGrade: Number(corr.grade), status: 'queued' });
      setCorrMsg(`Correction logged: L${corr.grade}. It now trains the memory layer.`);
    } catch { setCorrMsg('Server unreachable — correction kept locally only.'); saveCase({ ...c, correctedGrade: Number(corr.grade) }); }
    setTimeout(() => setCorrMsg(''), 3200);
  };
  return (
    <div className="page">
      <Link to="/app/cases" className="backlink">← Queue</Link>
      <div className="page-head">
        <div><span className="kicker">{c.id} · {c.eye}</span><h1>{c.patient}, {c.age}</h1><p className="muted">Diabetes {c.years}y · {c.source} · {c.confidence}% sure · quality {c.quality}/100</p></div>
        <span className={`status ${c.status} big`}>{STATUS_LABEL[c.status]}</span>
      </div>
      <div className="two-col">
        <section className="card"><div className="card-h"><b>Verdict · Level {c.grade}</b><span className="mono">{c.sharpness}</span></div>
          <div className="card-b">
            <div className={`verdict ${c.grade >= 3 ? 'refer' : c.grade === 0 ? 'clear' : 'watch'}`}>
              <h3>{c.grade === 0 ? 'No signs — no referral' : c.grade === 1 ? 'Mild — watch, no referral yet' : c.grade <= 3 ? `Level ${c.grade} — refer to eye doctor` : 'Advanced — hospital now'}</h3>
              <p>{c.grade >= 4 ? 'Emergency: hospital eye unit today. New fragile vessels risk sudden bleed.' : c.grade >= 2 ? 'Referable: eye doctor within 4 weeks (days if vision drops).' : c.grade === 1 ? 'Early sugar effect. Control sugar, recheck 6–12 months.' : 'Healthy today. Yearly photo check.'}</p>
            </div>
            <div className="field"><label>Doctor note (saved with case)</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Counselled, slip given, review 4 wks" /></div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => { saveCase({ ...c, note }); alert('Note saved.'); }}>Save note</button>
              <button className="btn btn-primary btn-sm" onClick={() => downloadReport({ grade: c.grade, age: c.age, years: c.years, eye: c.eye, confidence: c.confidence, quality: c.quality })}>⬇ Referral slip</button>
              <button className="btn btn-primary btn-sm" disabled={pngBusy} onClick={pngReport}>{pngBusy ? 'Drawing…' : '⬇ PNG report'}</button>
            </div>
          </div>
        </section>
        <section className="card"><div className="card-h"><b>Next step</b><span className="mono">ONE TAP</span></div>
          <div className="card-b">
            <p className="muted">Move this case along. Status drives the queue counts.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={() => setStatus('queued')}>In review</button>
              <button className="btn btn-outline btn-sm" onClick={() => setStatus('referred')}>Mark referred</button>
              <button className="btn btn-outline btn-sm" onClick={() => setStatus('urgent')}>Mark urgent</button>
              <button className="btn btn-outline btn-sm" onClick={() => setStatus('cleared')}>Mark cleared</button>
            </div>
            <hr className="hair" />
            <b style={{ fontSize: 14 }}>AI got it wrong?</b>
            <p className="muted" style={{ margin: '4px 0 8px' }}>Overrule the grade — the correction is logged to the memory layer{c.aid ? ` (analysis ${c.aid})` : ''} and improves future reads.</p>
            <div className="row2">
              <div className="field" style={{ margin: 0 }}><label>Correct grade</label>
                <select value={corr.grade} onChange={(e) => setCorr({ ...corr, grade: e.target.value })}>
                  {[0, 1, 2, 3, 4].map((g) => <option key={g} value={g}>Level {g}</option>)}
                </select>
              </div>
              <div className="field" style={{ margin: 0 }}><label>Reason</label><input value={corr.reason} onChange={(e) => setCorr({ ...corr, reason: e.target.value })} placeholder="e.g. artefact, not bleed" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm" onClick={sendCorrection}>Log correction</button>
              {corrMsg && <span className="muted">{corrMsg}</span>}
            </div>
            <hr className="hair" />
            <Link className="btn btn-outline btn-sm btn-block" to={`/app/assistant?case=${c.id}`}>Ask assistant about {c.id} →</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
