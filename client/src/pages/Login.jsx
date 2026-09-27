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

export default function Login() {
  const nav = useNavigate();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [signupRole, setSignupRole] = useState(null); // null | 'doctor' | 'patient'
  const [form, setForm] = useState({ email: '', password: '' });
  const [doc, setDoc] = useState({ name: '', email: '', password: '', accessCode: '' });
  const [pat, setPat] = useState({ name: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const switchMode = (m) => { setMode(m); setSignupRole(null); setError(''); };

  const handleSignin = async (e) => {
    e.preventDefault();
    setError('');
    const identifier = clean(form.email, 254);
    if (!identifier || !form.password.trim()) {
      setError('Email (or patient name) and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: identifier, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
        return;
      }
      storeAuth(data);
      nav(homeFor(data.user.role));
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleDoctorSignup = async (e) => {
    e.preventDefault();
    setError('');
    const name = clean(doc.name, 60);
    const email = clean(doc.email, 254).toLowerCase();
    const password = doc.password.trim();
    const accessCode = clean(doc.accessCode, 10);
    if (!name || NAME_RE.test(name) === false) {
      setError('Enter your full name (2–60 letters).');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid work email address.');
      return;
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password needs 8+ characters with a letter and a number.');
      return;
    }
    if (!accessCode) {
      setError('Access code is required for doctor registration.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'doctor', name, email, password, accessCode }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed. Try again.');
        return;
      }
      storeAuth(data);
      nav('/app');
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const handlePatientSignup = async (e) => {
    e.preventDefault();
    setError('');
    const name = clean(pat.name, 60);
    const password = pat.password.trim();
    if (!name || NAME_RE.test(name) === false) {
      setError('Enter your name (2–60 letters).');
      return;
    }
    if (password.length < 6) {
      setError('Password needs 6+ characters.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'patient', name, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Signup failed. Try again.');
        return;
      }
      storeAuth(data);
      nav('/phc');
    } catch {
      setError('Cannot reach server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

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

        {/* Right card: sign in / sign up */}
        <div className="card auth-card">
          <div className="card-b">
            <div className="auth-brand-row">
              <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
            </div>

            <div className="seg" role="tablist" aria-label="Sign in or create account" style={{ marginBottom: 16 }}>
              <button type="button" role="tab" aria-selected={mode === 'signin'} aria-pressed={mode === 'signin'} onClick={() => switchMode('signin')}>Sign in</button>
              <button type="button" role="tab" aria-selected={mode === 'signup'} aria-pressed={mode === 'signup'} onClick={() => switchMode('signup')}>New signup</button>
            </div>

            {error && (
              <div className="auth-error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            {mode === 'signin' && (
              <form onSubmit={handleSignin} noValidate>
                <span className="kicker">Clinical Workspace</span>
                <h2>Sign in to SEER</h2>
                <p className="muted" style={{ marginBottom: 20 }}>Doctors use email · patients can use their name.</p>
                <div className="field">
                  <label htmlFor="email">Email address or patient name</label>
                  <input
                    id="email"
                    type="text"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: stripTags(e.target.value).slice(0, 254) })}
                    placeholder="you@clinic.org or your name"
                    autoComplete="username"
                    required
                    disabled={loading}
                    maxLength={254}
                  />
                </div>
                <div className="field">
                  <label htmlFor="password">Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      id="password"
                      type={showPass ? 'text' : 'password'}
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value.slice(0, 128) })}
                      placeholder="••••••••"
                      autoComplete="current-password"
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
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><span className="spinner" />Signing in…</> : 'Sign In →'}
                </button>
                <Link className="btn btn-outline btn-block" to="/" style={{ marginTop: 8 }}>← Back to landing</Link>
                <div className="auth-role-hint">
                  <span className="mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                    Doctor → Doctor Dashboard · Patient → Patient Dashboard
                  </span>
                </div>
              </form>
            )}

            {mode === 'signup' && signupRole === null && (
              <div>
                <span className="kicker">New signup</span>
                <h2>I am a…</h2>
                <p className="muted" style={{ marginBottom: 16 }}>Choose your account type to continue.</p>
                <div style={{ display: 'grid', gap: 10 }}>
                  <button type="button" className="btn btn-outline btn-block" onClick={() => { setSignupRole('doctor'); setError(''); }} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}>
                    <span aria-hidden="true">🩺</span>
                    <span style={{ textAlign: 'left' }}><strong>Doctor</strong><br /><small className="muted">Name, work email, password + access code</small></span>
                  </button>
                  <button type="button" className="btn btn-outline btn-block" onClick={() => { setSignupRole('patient'); setError(''); }} style={{ justifyContent: 'flex-start', padding: '14px 16px' }}>
                    <span aria-hidden="true">🧑</span>
                    <span style={{ textAlign: 'left' }}><strong>Patient</strong><br /><small className="muted">Just your name + password — no verification</small></span>
                  </button>
                </div>
                <Link className="btn btn-outline btn-block" to="/" style={{ marginTop: 12 }}>← Back to landing</Link>
              </div>
            )}

            {mode === 'signup' && signupRole === 'doctor' && (
              <form onSubmit={handleDoctorSignup} noValidate>
                <button type="button" className="backlink btn btn-outline btn-sm" onClick={() => { setSignupRole(null); setError(''); }} style={{ marginBottom: 12 }}>← Account type</button>
                <span className="kicker">Doctor signup</span>
                <h2>Create doctor account</h2>
                <p className="muted" style={{ marginBottom: 16 }}>Your access code is verified on the server.</p>
                <div className="field">
                  <label htmlFor="doc-name">Full name</label>
                  <input id="doc-name" type="text" value={doc.name} onChange={(e) => setDoc({ ...doc, name: stripTags(e.target.value).slice(0, 60) })} placeholder="Dr. A. Patil" autoComplete="name" required disabled={loading} maxLength={60} />
                </div>
                <div className="field">
                  <label htmlFor="doc-email">Work email</label>
                  <input id="doc-email" type="email" value={doc.email} onChange={(e) => setDoc({ ...doc, email: stripTags(e.target.value).slice(0, 254) })} placeholder="you@clinic.org" autoComplete="email" required disabled={loading} maxLength={254} />
                </div>
                <div className="field">
                  <label htmlFor="doc-pass">Password (8+ chars, letter + number)</label>
                  <input id="doc-pass" type={showPass ? 'text' : 'password'} value={doc.password} onChange={(e) => setDoc({ ...doc, password: e.target.value.slice(0, 128) })} placeholder="••••••••" autoComplete="new-password" required disabled={loading} maxLength={128} />
                </div>
                <div className="field">
                  <label htmlFor="doc-code">Access code</label>
                  <input id="doc-code" type="text" inputMode="numeric" value={doc.accessCode} onChange={(e) => setDoc({ ...doc, accessCode: stripTags(e.target.value).replace(/[^0-9]/g, '').slice(0, 10) })} placeholder="Issued by your facility" required disabled={loading} maxLength={10} />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><span className="spinner" />Creating…</> : 'Create doctor account →'}
                </button>
              </form>
            )}

            {mode === 'signup' && signupRole === 'patient' && (
              <form onSubmit={handlePatientSignup} noValidate>
                <button type="button" className="backlink btn btn-outline btn-sm" onClick={() => { setSignupRole(null); setError(''); }} style={{ marginBottom: 12 }}>← Account type</button>
                <span className="kicker">Patient signup</span>
                <h2>Create patient account</h2>
                <p className="muted" style={{ marginBottom: 16 }}>Just a name and password — no verification needed.</p>
                <div className="field">
                  <label htmlFor="pat-name">Patient name</label>
                  <input id="pat-name" type="text" value={pat.name} onChange={(e) => setPat({ ...pat, name: stripTags(e.target.value).slice(0, 60) })} placeholder="Your full name" autoComplete="nickname" required disabled={loading} maxLength={60} />
                </div>
                <div className="field">
                  <label htmlFor="pat-pass">Password (6+ characters)</label>
                  <input id="pat-pass" type={showPass ? 'text' : 'password'} value={pat.password} onChange={(e) => setPat({ ...pat, password: e.target.value.slice(0, 128) })} placeholder="••••••••" autoComplete="new-password" required disabled={loading} maxLength={128} />
                </div>
                <button className="btn btn-primary btn-block" type="submit" disabled={loading} style={{ marginTop: 8 }}>
                  {loading ? <><span className="spinner" />Creating…</> : 'Create patient account →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
