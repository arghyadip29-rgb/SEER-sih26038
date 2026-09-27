import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setSession, setToken } from '../lib/store.js';
import seerLogo from '../assets/seer-logo-new.jpg';

// Mirror of backend rules (backend re-validates everything authoritatively).
const stripTags = (v) => String(v ?? '').replace(/<[^>]*>/g, '');
const clean = (v, max = 200) => stripTags(v).replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, max);
const NAME_RE = /^[A-Za-z][A-Za-z .'-]{0,58}[A-Za-z.'-]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function storeAuth(data) {
  setToken(data.access_token);
  setSession({
    id: data.user.id,
    name: data.user.name,
    doctor: data.user.name,
    email: data.user.email,
    role: data.user.role,
    facility: data.user.facility,
    phc: data.user.facility,
    at: Date.now(),
  });
}

function homeFor(role) {
  if (role === 'doctor') return '/app';
  return '/phc';
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export default function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState(null); // null | 'doctor' | 'patient'
  const [doc, setDoc] = useState({ name: '', email: '', password: '', accessCode: '' });
  const [pat, setPat] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const pickRole = (r) => { setRole(r); setError(''); setNotice(''); };

  // One "Continue" handles both returning users (login) and first-timers (signup).
  const handleDoctor = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    const email = clean(doc.email, 254).toLowerCase();
    const password = doc.password.trim();
    if (!EMAIL_RE.test(email)) { setError('Enter a valid work email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      const login = await postJson('/api/auth/login', { email, password });
      if (login.ok) {
        storeAuth(login.data);
        setNotice(`Welcome back, ${login.data.user.name}.`);
        nav(homeFor(login.data.user.role));
        return;
      }
      if (login.data.code !== 'NO_ACCOUNT') {
        setError(login.data.error || 'Sign-in failed. Check your password and try again.');
        return;
      }
      // First visit — create the doctor account (access code verified on the server).
      const name = clean(doc.name, 60);
      const accessCode = clean(doc.accessCode, 10);
      if (!name || !NAME_RE.test(name)) { setError('First visit? Add your full name to create your doctor account.'); return; }
      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
        setError('New doctor passwords need 8+ characters with a letter and a number.');
        return;
      }
      if (!accessCode) { setError('First visit? Add the access code issued by your facility.'); return; }
      const signup = await postJson('/api/auth/signup', { role: 'doctor', name, email, password, accessCode });
      if (!signup.ok) { setError(signup.data.error || 'Could not create your account.'); return; }
      storeAuth(signup.data);
      setNotice(`Account created — welcome, ${signup.data.user.name}.`);
      nav('/app');
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatient = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');
    const name = clean(pat.name, 60);
    const password = pat.password.trim();
    if (!name || !NAME_RE.test(name)) { setError('Enter your name (2–60 letters).'); return; }
    if (!password) { setError('Enter your password.'); return; }
    setLoading(true);
    try {
      const login = await postJson('/api/auth/login', { email: name, password });
      if (login.ok) {
        storeAuth(login.data);
        setNotice(`Welcome back, ${login.data.user.name}.`);
        nav(homeFor(login.data.user.role));
        return;
      }
      if (login.data.code !== 'NO_ACCOUNT') {
        setError(login.data.error || 'Sign-in failed. Check your password and try again.');
        return;
      }
      // First visit — create the patient account (no verification needed).
      if (password.length < 6) { setError('New patient passwords need 6+ characters.'); return; }
      const signup = await postJson('/api/auth/signup', { role: 'patient', name, password });
      if (!signup.ok) { setError(signup.data.error || 'Could not create your account.'); return; }
      storeAuth(signup.data);
      setNotice(`Account created — welcome, ${signup.data.user.name}.`);
      nav('/phc');
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const passField = (id, value, onChange, placeholder, autoComplete) => (
    <div className="field">
      <label htmlFor={id}>{id === 'doc-pass' ? 'Password' : 'Password'}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={showPass ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, 128))}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required
          disabled={loading}
          style={{ paddingRight: 44 }}
          maxLength={128}
        />
        <button
          type="button"
          onClick={() => setShowPass((v) => !v)}
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 16 }}
          tabIndex={-1}
          aria-label={showPass ? 'Hide password' : 'Show password'}
        >
          {showPass ? '🙈' : '👁'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        {/* Left side */}
        <div className="auth-side">
          <div className="auth-logo-wrap">
            <img src={seerLogo} alt="SEER Logo" className="auth-brand-logo" />
          </div>
          <h1>Screen a village<br />before lunch.</h1>
          <p>Sign in with your registered credentials to access your clinical workspace — built for field PHCs and hospital ophthalmologists.</p>
          <ul>
            <li>✓ 30-second verdict with MATLAB Deep Learning</li>
            <li>✓ Grad-CAM saliency map &amp; 4-quadrant lesion analysis</li>
            <li>✓ Offline-first local storage, auto-sync when online</li>
            <li>✓ Doctor Approval, Override &amp; Referral triage</li>
          </ul>

          <div className="auth-demo-creds">
            <span className="kicker" style={{ color: '#9ec1ff' }}>Prototype test accounts</span>
            <div className="demo-row">
              <span>🩺 Doctor</span>
              <code>doctor@seer.phc / Doctor@123</code>
            </div>
            <div className="demo-row">
              <span>🏥 PHC Worker</span>
              <code>phcworker@seer.phc / PHC@Worker123</code>
            </div>
          </div>
        </div>

        {/* Right card: unified role-based auth */}
        <div className="card auth-card">
          <div className="card-b">
            <div className="auth-brand-row">
              <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
            </div>
            <span className="kicker">Clinical Workspace</span>
            <h2>Welcome to SEER</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              {role === null
                ? 'Choose your account type — first visit creates your account, next visits sign you straight in.'
                : role === 'doctor'
                  ? 'Doctors sign in with email. First visit also needs your name and facility access code.'
                  : 'Patients sign in with name. First visit creates your account — no verification needed.'}
            </p>

            {error && (
              <div className="auth-error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}
            {notice && !error && (
              <div className="auth-error" role="status" style={{ background: 'var(--teal-soft)', borderColor: 'rgba(14,159,138,0.4)', color: 'var(--teal)' }}>
                <span>✓</span> {notice}
              </div>
            )}

            {role === null && (
              <div style={{ display: 'grid', gap: 10 }}>
                <button type="button" className="btn btn-outline btn-block" onClick={() => pickRole('doctor')} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}>
                  <span aria-hidden="true">🩺</span>
                  <span style={{ textAlign: 'left' }}><strong>I am a Doctor</strong><br /><small className="muted">Work email + password (+ access code on first visit)</small></span>
                </button>
                <button type="button" className="btn btn-outline btn-block" onClick={() => pickRole('patient')} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}>
                  <span aria-hidden="true">🧑</span>
                  <span style={{ textAlign: 'left' }}><strong>I am a Patient</strong><br /><small className="muted">Just your name + password</small></span>
                </button>
                <Link className="btn btn-outline btn-block" to="/" style={{ marginTop: 4 }}>← Back to landing</Link>
              </div>
            )}

            {role === 'doctor' && (
              <form onSubmit={handleDoctor} noValidate>
                <button type="button" className="backlink btn btn-outline btn-sm" onClick={() => pickRole(null)} style={{ marginBottom: 12 }}>← Account type</button>
                <div className="field">
                  <label htmlFor="doc-email">Work email</label>
                  <input id="doc-email" type="email" value={doc.email} onChange={(e) => setDoc({ ...doc, email: stripTags(e.target.value).slice(0, 254) })} placeholder="you@clinic.org" autoComplete="email" required disabled={loading} maxLength={254} />
                </div>
                {passField('doc-pass', doc.password, (v) => setDoc({ ...doc, password: v }), '••••••••', 'current-password')}
                <div className="field">
                  <label htmlFor="doc-name">Full name <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>(first visit only)</span></label>
                  <input id="doc-name" type="text" value={doc.name} onChange={(e) => setDoc({ ...doc, name: stripTags(e.target.value).slice(0, 60) })} placeholder="Dr. A. Patil" autoComplete="name" disabled={loading} maxLength={60} />
                </div>
                <div className="field">
                  <label htmlFor="doc-code">Access code <span className="muted" style={{ textTransform: 'none', letterSpacing: 0 }}>(first visit only)</span></label>
                  <input id="doc-code" type="text" inputMode="numeric" value={doc.accessCode} onChange={(e) => setDoc({ ...doc, accessCode: stripTags(e.target.value).replace(/[^0-9]/g, '').slice(0, 10) })} placeholder="Issued by your facility" disabled={loading} maxLength={10} />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><span className="spinner" />Checking…</> : 'Continue →'}
                </button>
              </form>
            )}

            {role === 'patient' && (
              <form onSubmit={handlePatient} noValidate>
                <button type="button" className="backlink btn btn-outline btn-sm" onClick={() => pickRole(null)} style={{ marginBottom: 12 }}>← Account type</button>
                <div className="field">
                  <label htmlFor="pat-name">Patient name</label>
                  <input id="pat-name" type="text" value={pat.name} onChange={(e) => setPat({ ...pat, name: stripTags(e.target.value).slice(0, 60) })} placeholder="Your full name" autoComplete="nickname" required disabled={loading} maxLength={60} />
                </div>
                {passField('pat-pass', pat.password, (v) => setPat({ ...pat, password: v }), '••••••••', 'current-password')}
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><span className="spinner" />Checking…</> : 'Continue →'}
                </button>
              </form>
            )}

            <div className="auth-role-hint">
              <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                Doctor → Doctor Dashboard · Patient → Patient Dashboard
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
