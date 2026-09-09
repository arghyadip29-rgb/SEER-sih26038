import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAudit, getEvalLast, getMemoryStats, getPacket } from '../lib/api.js';

export default function Memory() {
  const [packet, setPacket] = useState(null);
  const [stats, setStats] = useState(null);
  const [audit, setAudit] = useState(null);
  const [evalLast, setEvalLast] = useState(null);
  useEffect(() => {
    getPacket().then(setPacket);
    getMemoryStats().then(setStats);
    getAudit(15).then(setAudit);
    getEvalLast().then(setEvalLast);
  }, []);
  const offline = stats === null && audit === null && packet === null;

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">Memory · context layer</span><h1>What the API reads through</h1>
          <p className="muted">No naked images. Every analysis passes L0–L5 before a grade reaches the doctor.</p></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link>
      </div>

      <div className="flow">
        {['L0 Instructions — role, read order, JSON contract', 'L1 Rubric — countable L0–4 criteria + IDRiD priors', 'L2 Anchors — 5 grade pins + 4 lesion crops', 'L3 Precedent — similar confirmed cases (vector in P1)', 'L4 Case — age, years, eye, camera, quality', 'L5 Rules — retake gate, NV override, consistency'].map((s, i) => (
          <span key={s} className="flow-step"><b>{s.split(' ')[0]}</b> {s.slice(s.indexOf(' ') + 1)}{i < 5 && <i>→</i>}</span>
        ))}
      </div>

      <div className="kpi-grid three" style={{ marginTop: 12 }}>
        <div className="kpi"><span className="tag">ANALYSES LOGGED</span><b>{stats?.analyses ?? '—'}</b><small>server memory</small></div>
        <div className="kpi warn"><span className="tag">DOCTOR CORRECTIONS</span><b>{stats?.corrections ?? '—'}</b><small>the P1 training signal</small></div>
        <div className="kpi ok"><span className="tag">RULE OVERRIDES</span><b>{stats?.overrides ?? '—'}</b><small>retake / escalate / NV</small></div>
      </div>

      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card"><div className="card-h"><b>Rubric + anchors</b><span className="mono">PACKET {packet?.version || '…'}</span></div>
          <div className="card-b">
            {!packet && <p className="muted">Start the API (:4000) to inspect the live packet.</p>}
            {packet && <>
              <div className="tag">GRADE ANCHORS</div>
              <ul className="anchor-list">{packet.anchors.map((a) => <li key={a.id}><b className="mono">{a.id}</b> · L{a.grade} · {a.dataset}<br /><span className="muted">{a.note}</span></li>)}</ul>
              <div className="tag">LESION ATLAS</div>
              <ul className="anchor-list">{packet.atlas.map((a) => <li key={a.id}><b className="mono">{a.id}</b> · {a.type}<br /><span className="muted">{a.note}</span></li>)}</ul>
              <details className="trace"><summary>Full packet text (what the API actually receives)</summary><pre>{packet.userText}</pre></details>
            </>}
          </div>
        </section>
        <section className="card"><div className="card-h"><b>Recent analyses</b><span className="mono">AUDIT TRAIL</span></div>
          <div className="rows">
            {(audit?.audits || []).map((a) => (
              <div className="row" key={a.aid}>
                <span className={`pill l${a.grade}`}>L{a.grade}</span>
                <span className="row-main"><b>{a.aid} · {a.source} · {a.provider}</b><small>{new Date(a.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · q{a.quality} · {(a.rules || []).length} rules</small></span>
              </div>
            ))}
            {!(audit?.audits || []).length && <p className="muted" style={{ padding: 12 }}>{offline ? 'API offline — audit appears once :4000 runs.' : 'No analyses yet. Screen someone first.'}</p>}
          </div>
        </section>
      </div>

      <section className="card" style={{ marginTop: 12 }}><div className="card-h"><b>Ablation — what each layer adds</b><span className="mono">{evalLast ? `${new Date(evalLast.at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })} · ${evalLast.provider}` : 'NOT RUN YET'}</span></div>
        <div className="card-b" style={{ overflowX: 'auto' }}>
          {evalLast?.rows ? <>
            <table className="eval-table"><thead><tr><th>Variant</th><th>n</th><th>Acc</th><th>QWK</th><th>Sens L2+</th><th>Spec L2+</th><th>ms</th><th>~tok</th></tr></thead>
              <tbody>{evalLast.rows.map((r) => <tr key={r.variant} className={r.variant === 'full' ? 'hl' : ''}><td className="mono">{r.variant}</td><td>{r.n}</td><td>{r.accuracy}</td><td>{r.qwk}</td><td>{r.sensL2}</td><td>{r.specL2}</td><td>{r.avgLatencyMs}</td><td>{r.estTokensPerCase}</td></tr>)}</tbody>
            </table>
            <p className="micro" style={{ marginTop: 8 }}>{evalLast.synthetic ? 'Synthetic run — validates harness plumbing, not model skill. Point it at labeled images for real gains.' : 'Labeled-image run — the gap between raw and full is the context layer paying off.'} Re-run: <span className="mono">npm run eval -- --images ./data/eval-imgs --labels ./data/eval-labels.csv</span></p>
          </> : <p className="muted">No ablation run yet. From <span className="mono">server/</span>: <span className="mono">npm run eval -- --synthetic 60</span> (plumbing) or with <span className="mono">--images/--labels</span> (real gains, needs API key for layer separation).</p>}
        </div>
      </section>

      <section className="card" style={{ marginTop: 12 }}><div className="card-h"><b>Bring your dataset</b><span className="mono">ONBOARDING</span></div>
        <div className="card-b">
          <ol className="sop">
            <li><b>Drop anchor images</b><span><span className="mono">server/context/anchors/</span> — name them anchor-L0.jpg … anchor-L4.jpg plus atlas-ma/he/ex/nv.jpg. They attach to every API call automatically.</span></li>
            <li><b>Set the API key</b><span>Copy <span className="mono">server/.env.example</span> to <span className="mono">.env</span>, fill VISION_API_URL + KEY. No key = deterministic mock, same packet, same rules.</span></li>
            <li><b>Correct in Cases</b><span>Every overrule lands in the correction log — that log is what P1 retrieval learns from.</span></li>
          </ol>
        </div>
      </section>
    </div>
  );
}
