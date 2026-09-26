import { useState, useEffect } from 'react';
import { Link, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { getSession, setSession, setToken, authFetch, STATUS_LABEL } from '../lib/store.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

// ─── PHC Shell (sidebar layout) ────────────────────────────────────────────────
const PHC_NAV = [
  { to: '/phc', label: 'Dashboard', icon: '▦', end: true },
  { to: '/phc/register', label: 'Register Patient', icon: '＋' },
  { to: '/phc/upload', label: 'Upload Image', icon: '◉' },
  { to: '/phc/status', label: 'Screening Status', icon: '▤' },
  { to: '/phc/referrals', label: 'Referrals', icon: '↗' },
];

export function PhcShell() {
  const nav = useNavigate();
  const session = getSession();

  if (!session || session.role !== 'phc_worker') {
    return (
      <div className="wrap" style={{ padding: '60px 20px', maxWidth: 520 }}>
        <div className="card"><div className="card-b" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ justifyContent: 'center' }}><span className="brand-mark">◉</span>SEER</div>
          <p className="muted" style={{ margin: '12px 0 4px' }}>PHC Worker sign-in required.</p>
          {session && session.role === 'doctor' && (
            <p className="muted" style={{ margin: '0 0 16px', fontSize: 13 }}>You are signed in as a Doctor. <Link to="/app">Go to Doctor Workspace →</Link></p>
          )}
          <Link className="btn btn-primary" to="/login">Go to sign in →</Link>
        </div></div>
      </div>
    );
  }

  const logout = () => { setSession(null); setToken(null); nav('/'); };

  return (
    <div className="shell">
      <aside className="side" aria-label="PHC Workspace">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
          <ThemeToggle />
        </div>
        <div className="side-phc">
          {session.phc || session.facility}
          <span>{session.name} · <strong style={{ color: 'var(--teal)' }}>PHC Worker</strong></span>
        </div>
        <nav className="side-nav">
          {PHC_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
              <span className="side-ic" aria-hidden="true">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className="ps-chip">SIH26038 · PHC Workspace</span>
          <button className="btn btn-outline btn-sm btn-block" onClick={logout}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}

// ─── PHC Dashboard Overview ─────────────────────────────────────────────────────
export function PhcOverview() {
  const s = getSession() || {};
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, referred: 0 });
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/screenings')
      .then((r) => r.json())
      .then((data) => {
        const list = data.screenings || [];
        setScreenings(list.slice(0, 6));
        setStats({
          total: list.length,
          pending: list.filter((s) => s.status === 'queued' || s.status === 'in_review').length,
          completed: list.filter((s) => ['approved', 'overridden', 'cleared'].includes(s.status)).length,
          referred: list.filter((s) => s.status === 'referred' || s.status === 'urgent').length,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = {
    queued: 'Pending', in_review: 'In Review', approved: 'Completed',
    overridden: 'Reviewed', referred: 'Referred', urgent: 'Urgent', cleared: 'Cleared',
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <span className="kicker">PHC Worker Dashboard · {s.phc || s.facility || 'PHC'}</span>
          <h1>Welcome, {s.name}</h1>
          <p className="muted">Field screening queue at a glance.</p>
        </div>
        <Link className="btn btn-primary" to="/phc/register">＋ Register Patient</Link>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><span className="tag">TOTAL PATIENTS</span><b>{loading ? '…' : stats.total}</b><small>registered screenings</small></div>
        <div className="kpi warn"><span className="tag">PENDING</span><b>{loading ? '…' : stats.pending}</b><small>awaiting AI or doctor review</small></div>
        <div className="kpi ok"><span className="tag">COMPLETED</span><b>{loading ? '…' : stats.completed}</b><small>doctor-reviewed cases</small></div>
        <div className="kpi bad"><span className="tag">REFERRED</span><b>{loading ? '…' : stats.referred}</b><small>need follow-up</small></div>
      </div>

      <div className="two-col" style={{ marginTop: 12 }}>
        <section className="card">
          <div className="card-h"><b>Recent screenings</b><Link className="btn btn-outline btn-sm" to="/phc/status">All →</Link></div>
          <div className="rows">
            {screenings.length === 0 && !loading && (
              <p className="muted" style={{ padding: 14 }}>No screenings yet. Register your first patient.</p>
            )}
            {screenings.map((sc) => (
              <div key={sc.id} className="row">
                <span className={`pill l${sc.model_grade ?? 0}`}>G{sc.model_grade ?? '?'}</span>
                <span className="row-main">
                  <b>{sc.patient_name || 'Patient'}</b>
                  <small>{sc.id} · {sc.examined_eye}</small>
                </span>
                <span className={`status ${sc.status}`}>{statusLabel[sc.status] || sc.status}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-h"><b>Quick actions</b></div>
          <div className="card-b" style={{ display: 'grid', gap: 10 }}>
            <Link className="btn btn-primary btn-block" to="/phc/register">＋ Register new patient</Link>
            <Link className="btn btn-outline btn-block" to="/phc/upload">📷 Upload fundus image</Link>
            <Link className="btn btn-outline btn-block" to="/phc/status">📋 View screening status</Link>
            <Link className="btn btn-outline btn-block" to="/phc/referrals">↗ View referrals</Link>
          </div>
        </section>
      </div>

      <div className="phc-notice card" style={{ marginTop: 12 }}>
        <div className="card-b">
          <span className="kicker">PHC Workflow</span>
          <ol className="sop" style={{ marginTop: 8 }}>
            <li><b>Register patient</b><span>Enter patient name, age, diabetes details.</span></li>
            <li><b>Upload fundus image</b><span>Capture both eyes using portable camera.</span></li>
            <li><b>AI screens in 30 sec</b><span>SEER grades the image and flags referrals.</span></li>
            <li><b>Doctor reviews</b><span>Assigned doctor approves, overrides or refers.</span></li>
            <li><b>Follow-up</b><span>Track referral status in the Referrals tab.</span></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Register Patient ───────────────────────────────────────────────────────────
export function PhcRegister() {
  const nav = useNavigate();
  const s = getSession() || {};
  const [form, setForm] = useState({
    patient_name: '', age: '', diabetes_years: '', gender: 'unspecified',
    examined_eye: 'Right eye (OD)', camera_device: 'Portable Fundus Camera',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.patient_name.trim() || !form.age) { setError('Patient name and age are required.'); return; }
    setLoading(true);
    try {
      const res = await authFetch('/api/screenings', {
        method: 'POST',
        body: JSON.stringify({ ...form, age: Number(form.age), diabetes_years: Number(form.diabetes_years) || 0, created_by: s.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (result) return (
    <div className="page">
      <div className="page-head"><div><span className="kicker">Patient Registered</span><h1>Success</h1></div></div>
      <div className="card"><div className="card-b" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
        <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 6px' }}>{result.patient?.name}</h2>
        <p className="muted">Screening ID: <span className="mono">{result.screening?.id}</span></p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/phc/upload">📷 Upload fundus image</Link>
          <button className="btn btn-outline" onClick={() => setResult(null)}>Register another</button>
        </div>
      </div></div>
    </div>
  );

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">PHC Worker · Patient Registration</span><h1>Register Patient</h1><p className="muted">Enter patient details to create a new screening record.</p></div>
      </div>
      <div style={{ maxWidth: 560 }}>
        <form className="card" onSubmit={handleSubmit}>
          <div className="card-b" style={{ display: 'grid', gap: 0 }}>
            {error && <div className="auth-error" role="alert"><span>⚠</span> {error}</div>}
            <div className="field">
              <label htmlFor="pname">Patient Full Name *</label>
              <input id="pname" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} placeholder="e.g. Ramesh Kumar" required disabled={loading} />
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="page">Age (years) *</label>
                <input id="page" type="number" min="1" max="120" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} placeholder="e.g. 52" required disabled={loading} />
              </div>
              <div className="field">
                <label htmlFor="pdiab">Diabetes Duration (yrs)</label>
                <input id="pdiab" type="number" min="0" max="80" value={form.diabetes_years} onChange={(e) => setForm({ ...form, diabetes_years: e.target.value })} placeholder="e.g. 5" disabled={loading} />
              </div>
            </div>
            <div className="field">
              <label htmlFor="pgender">Gender</label>
              <select id="pgender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} disabled={loading}>
                <option value="unspecified">Prefer not to say</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="row2">
              <div className="field">
                <label htmlFor="peye">Examined Eye</label>
                <select id="peye" value={form.examined_eye} onChange={(e) => setForm({ ...form, examined_eye: e.target.value })} disabled={loading}>
                  <option>Right eye (OD)</option>
                  <option>Left eye (OS)</option>
                  <option>Both eyes (OU)</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="pcam">Camera Device</label>
                <select id="pcam" value={form.camera_device} onChange={(e) => setForm({ ...form, camera_device: e.target.value })} disabled={loading}>
                  <option>Portable Fundus Camera</option>
                  <option>Smartphone Ophthalmoscope</option>
                  <option>Desktop Fundus Camera</option>
                  <option>Other</option>
                </select>
              </div>
            </div>
            <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
              {loading ? <><span className="spinner" />Registering…</> : 'Register Patient →'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Upload Fundus Image (redirects to existing Screen page via link) ────────────
export function PhcUpload() {
  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">PHC Worker · Image Upload</span><h1>Upload Fundus Image</h1><p className="muted">Capture and submit a retinal image for AI screening.</p></div>
      </div>
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="card-b">
          <p>Use the main <strong>SEER screening tool</strong> to upload a fundus image and run the AI analysis pipeline.</p>
          <div className="phc-steps" style={{ margin: '14px 0', display: 'grid', gap: 10 }}>
            <div className="pstep" data-state="run">
              <span className="n">1</span>
              <span>First, <Link to="/phc/register">register the patient</Link> to get a Screening ID.</span>
            </div>
            <div className="pstep">
              <span className="n">2</span>
              <span>Then use the screening tool below to upload the fundus image.</span>
            </div>
            <div className="pstep">
              <span className="n">3</span>
              <span>AI will analyse image quality and DR grade in ~30 seconds.</span>
            </div>
            <div className="pstep">
              <span className="n">4</span>
              <span>Check <Link to="/phc/status">Screening Status</Link> to track progress.</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to="/app/screen">Open Screening Tool →</Link>
            <Link className="btn btn-outline" to="/phc/status">View Screening Status</Link>
          </div>
          <p className="muted" style={{ marginTop: 12, fontSize: 12.5 }}>
            ℹ️ The full screening tool is shared. PHC workers can upload images and view results. Doctor-only actions (approve, override, refer) are restricted on the doctor side.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Screening Status ────────────────────────────────────────────────────────────
export function PhcStatus() {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    authFetch('/api/screenings')
      .then((r) => r.json())
      .then((data) => setScreenings(data.screenings || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const statusLabel = {
    queued: 'Pending', in_review: 'In Review', approved: 'Completed ✓',
    overridden: 'Reviewed ✓', referred: 'Referred ↗', urgent: 'Urgent ⚠', cleared: 'Cleared ✓',
  };

  const filtered = screenings.filter((s) =>
    !search || s.patient_name?.toLowerCase().includes(search.toLowerCase()) || s.id?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">PHC Worker · Screening Status</span><h1>Screening Queue</h1><p className="muted">Track status of all submitted screenings.</p></div>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="Search by patient name or ID…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div className="card">
        <div className="rows">
          {loading && <p className="muted" style={{ padding: 16 }}>Loading…</p>}
          {!loading && filtered.length === 0 && <p className="muted" style={{ padding: 16 }}>No screenings found.</p>}
          {filtered.map((sc) => (
            <div key={sc.id} className="row">
              <span className={`pill l${sc.model_grade ?? 0}`}>{sc.model_grade != null ? `G${sc.model_grade}` : '?'}</span>
              <span className="row-main">
                <b>{sc.patient_name || 'Patient'}</b>
                <small>{sc.id} · {sc.examined_eye} · {sc.model_confidence ? `${Math.round(sc.model_confidence)}% confidence` : 'Pending analysis'}</small>
              </span>
              <span className={`status ${sc.status}`}>{statusLabel[sc.status] || sc.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Referrals ───────────────────────────────────────────────────────────────────
export function PhcReferrals() {
  const [screenings, setScreenings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch('/api/screenings')
      .then((r) => r.json())
      .then((data) => {
        const all = data.screenings || [];
        setScreenings(all.filter((s) => s.status === 'referred' || s.status === 'urgent'));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-head">
        <div><span className="kicker">PHC Worker · Referrals</span><h1>Referral &amp; Follow-up</h1><p className="muted">Patients referred by the doctor for further eye care.</p></div>
      </div>
      <div className="card">
        <div className="rows">
          {loading && <p className="muted" style={{ padding: 16 }}>Loading…</p>}
          {!loading && screenings.length === 0 && <p className="muted" style={{ padding: 16 }}>No referrals at this time.</p>}
          {screenings.map((sc) => (
            <div key={sc.id} className="row">
              <span className={`pill l${sc.model_grade ?? 0}`}>G{sc.model_grade ?? '?'}</span>
              <span className="row-main">
                <b>{sc.patient_name || 'Patient'}</b>
                <small>{sc.id} · {sc.examined_eye}</small>
              </span>
              <span className={`status ${sc.status}`}>{sc.status === 'urgent' ? 'Urgent ⚠' : 'Referred ↗'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-b">
          <span className="kicker">Follow-up guidance</span>
          <ul className="plainlist" style={{ marginTop: 8 }}>
            <li><b>Referred (Grade 2–3)</b><span>Patient must visit district eye care within 4–6 weeks.</span></li>
            <li><b>Urgent (Grade 4)</b><span>Patient must be taken to hospital eye unit immediately.</span></li>
            <li><b>Your role</b><span>Inform patient family, assist with transport if needed, record visit outcome.</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
