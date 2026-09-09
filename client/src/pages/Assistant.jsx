import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { askChat } from '../lib/api.js';
import { getCases } from '../lib/store.js';

const SUGGEST = ['What did you see in this eye?', 'Why this level?', 'What should I tell the patient?', 'Is the photo good enough?', 'Explain the heatmap.'];

export default function Assistant() {
  const [sp] = useSearchParams();
  const cases = getCases();
  const [caseId, setCaseId] = useState(sp.get('case') || (cases[0]?.id ?? ''));
  const active = cases.find((c) => c.id === caseId) || null;
  const [msgs, setMsgs] = useState([{ who: 'bot', html: active ? `Context set to <b>${active.id}</b> (${active.patient}, Level ${active.grade}). Ask anything — I answer in plain words.` : 'Pick a case for context, then ask. Without context I answer generally.' }]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const logRef = useRef(null);
  useEffect(() => { logRef.current?.scrollTo(0, 99999); }, [msgs]);
  const send = async (text) => {
    const query = (text ?? q).trim(); if (!query || busy) return;
    setBusy(true);
    setMsgs((m) => [...m, { who: 'user', html: query.replace(/</g, '&lt;') }, { who: 'bot', html: '…' }]);
    setQ('');
    const ans = await askChat(query, active ? { grade: active.grade, confidence: active.confidence, quality: active.quality, sharpness: active.sharpness } : {});
    setMsgs((m) => [...m.slice(0, -1), { who: 'bot', html: ans }]);
    setBusy(false);
  };
  return (
    <div className="page">
      <div className="page-head"><div><span className="kicker">Assistant · Sahayak</span><h1>Ask about any case</h1><p className="muted">Plain words, no jargon. Context-aware — answers change with the eye you pick.</p></div></div>
      <div className="two-col assist">
        <section className="card"><div className="card-h"><b>Context</b><span className="mono">{cases.length} CASES</span></div>
          <div className="rows">
            <button className={`row${!active ? ' sel' : ''}`} onClick={() => setCaseId('')}><span className="row-main"><b>No case — general</b><small>levels, SOP, counselling lines</small></span></button>
            {cases.map((c) => (
              <button key={c.id} className={`row${c.id === caseId ? ' sel' : ''}`} onClick={() => { setCaseId(c.id); setMsgs((m) => [...m, { who: 'bot', html: `Switched to <b>${c.id}</b> — ${c.patient}, Level ${c.grade}, ${c.confidence}% sure.` }]); }}>
                <span className={`pill l${c.grade}`}>L{c.grade}</span>
                <span className="row-main"><b>{c.patient}</b><small>{c.id} · {c.eye}</small></span>
              </button>
            ))}
          </div>
        </section>
        <section className="card"><div className="card-h"><b>{active ? `${active.id} · Level ${active.grade}` : 'General chat'}</b><span className="mono">POST /api/chat</span></div>
          <div className="card-b">
            <div className="chat-log tall" ref={logRef}>{msgs.map((m, i) => (
              <div key={i} className={`msg ${m.who}`}><span className="who">{m.who === 'bot' ? 'SAHAYAK' : 'YOU'}</span><span dangerouslySetInnerHTML={{ __html: m.html }} /></div>
            ))}</div>
            <div className="quick">{SUGGEST.map((s) => <button key={s} onClick={() => send(s)} disabled={busy}>{s}</button>)}</div>
            <div className="chat-input">
              <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder={active ? `Ask about ${active.patient}…` : 'Ask about DR screening…'} aria-label="Ask the assistant" />
              <button className="btn btn-primary btn-sm" onClick={() => send()} disabled={busy}>{busy ? '…' : 'Send →'}</button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
