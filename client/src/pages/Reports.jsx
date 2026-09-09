import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCases, STATUS_LABEL } from '../lib/store.js';
import { downloadReport } from '../lib/api.js';

export default function Reports() {
  const cases = getCases();
  const ref = cases.filter((c) => c.grade >= 2);
  const [done, setDone] = useState('');
  const day = useMemo(() => {
    const d = {};
    cases.forEach((c) => { const k = new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); d[k] = (d[k] || 0) + 1; });
    return Object.entries(d).slice(0, 7);
  }, [cases]);
  const max = Math.max(1, ...day.map(([, n]) => n));
  const slip = (c) => { downloadReport({ grade: c.grade, age: c.age, years: c.years, eye: c.eye, confidence: c.confidence, quality: c.quality }); setDone(`Slip for ${c.id} downloaded.`); clearTimeout(slip._h); slip._h = setTimeout(() => setDone(''), 2600); };
  return (
    <div className="page">
      <div className="page-head"><div><span className="kicker">Reports</span><h1>Camp register</h1><p className="muted">Every screening, referral-ready. Print slips one by one or take the day summary.</p></div>
        <button className="btn btn-primary" onClick={() => slip({ grade: 2, age: '—', years: '—', eye: 'camp', confidence: '—', quality: '—', id: 'day' })}>⬇ Day summary</button>
      </div>
      <div className="kpi-grid three">
        <div className="kpi"><span className="tag">SCREENED</span><b>{cases.length}</b><small>this register</small></div>
        <div className="kpi warn"><span className="tag">REFERABLE L2+</span><b>{ref.length}</b><small>slips to print</small></div>
        <div className="kpi ok"><span className="tag">CLEARED L0</span><b>{cases.filter((c) => c.grade === 0).length}</b><small>yearly recall</small></div>
      </div>
      <div className="two-col">
        <section className="card"><div className="card-h"><b>Volume by day</b><span className="mono">LAST CAMP DAYS</span></div>
          <div className="card-b bars">
            {day.map(([k, n]) => (
              <div className="bar-row" key={k}><span>{k}</span><div className="bar-track"><i style={{ width: `${(n / max) * 100}%` }} /></div><b>{n}</b></div>
            ))}
            {!day.length && <p className="muted">No data yet.</p>}
          </div>
        </section>
        <section className="card"><div className="card-h"><b>Referral slips</b><span className="mono">EN + हिन्दी LINE</span></div>
          <div className="rows">
            {ref.map((c) => (
              <div className="row" key={c.id}>
                <span className={`pill l${c.grade}`}>L{c.grade}</span>
                <span className="row-main"><b>{c.patient}</b><small>{c.id} · {STATUS_LABEL[c.status]}</small></span>
                <button className="btn btn-outline btn-sm" onClick={() => slip(c)}>⬇ Slip</button>
              </div>
            ))}
            {!ref.length && <p className="muted" style={{ padding: 12 }}>No referrals pending. <Link to="/app/screen">Screen someone →</Link></p>}
          </div>
        </section>
      </div>
      {done && <div className="toast show" role="status">{done}</div>}
    </div>
  );
}
