import { Link } from 'react-router-dom';
import { getCases, getSession, STATUS_LABEL } from '../lib/store.js';

export default function Overview() {
  const s = getSession() || {};
  const cases = getCases();
  const ref = cases.filter((c) => c.grade >= 2).length;
  const urg = cases.filter((c) => c.grade >= 4).length;
  const q = cases.filter((c) => c.status === 'queued').length;
  const today = cases.length;
  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">Overview · {s.phc || 'PHC'}</span><h1>Namaste, {s.doctor || 'Doctor'}</h1><p className="muted">Tuesday camp queue at a glance. Anything urgent sits on top.</p></div>
        <Link className="btn btn-primary" to="/app/screen">＋ New screening</Link>
      </div>
      <div className="kpi-grid">
        <div className="kpi"><span className="tag">SCREENED TODAY</span><b>{today}</b><small>across both eyes camps</small></div>
        <div className="kpi warn"><span className="tag">NEEDS EYE DOCTOR (L2+)</span><b>{ref}</b><small>referral slips pending</small></div>
        <div className="kpi bad"><span className="tag">URGENT (L4)</span><b>{urg}</b><small>hospital today, not next week</small></div>
        <div className="kpi ok"><span className="tag">WAITING REVIEW</span><b>{q}</b><small>mild cases to confirm</small></div>
      </div>
      <div className="two-col">
        <section className="card"><div className="card-h"><b>Needs action</b><Link className="btn btn-outline btn-sm" to="/app/cases">All cases →</Link></div>
          <div className="rows">
            {cases.filter((c) => c.grade >= 2).slice(0, 4).map((c) => (
              <Link key={c.id} className="row" to={`/app/cases/${c.id}`}>
                <span className={`pill l${c.grade}`}>L{c.grade}</span>
                <span className="row-main"><b>{c.patient}</b><small>{c.id} · {c.eye} · {c.confidence}% sure</small></span>
                <span className={`status ${c.status}`}>{STATUS_LABEL[c.status]}</span>
              </Link>
            ))}
            {!cases.some((c) => c.grade >= 2) && <p className="muted" style={{ padding: 12 }}>Nothing referable. The village is having a good day.</p>}
          </div>
        </section>
        <section className="card"><div className="card-h"><b>Today’s flow</b><span className="mono">SOP</span></div>
          <div className="card-b">
            <ol className="sop">
              <li><b>Register + photo</b><span>Health worker captures both eyes, ~150 KB each.</span></li>
              <li><b>AI grades in 30 sec</b><span>Quality gate first — blurry photos get retake help, not guesses.</span></li>
              <li><b>You confirm + refer</b><span>One tap prints the EN/हिन्दी slip. Urgent cases jump the queue.</span></li>
            </ol>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
              <Link className="btn btn-outline btn-sm" to="/app/guide">Field guide →</Link>
              <Link className="btn btn-outline btn-sm" to="/app/assistant">Ask assistant →</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
