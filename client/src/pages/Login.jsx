import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setSession, setToken } from '../lib/store.js';
import seerLogo from '../assets/seer-logo-new.jpg';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim() || !form.password.trim()) {
      setError('Email and password are required.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim(), password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Login failed. Please check your credentials.');
        return;
      }
      // Store JWT
      setToken(data.access_token);
      // Store session info
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
      // Route by role
      if (data.user.role === 'doctor') {
        nav('/app');
      } else {
        nav('/phc');
      }
    } catch (err) {
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

        {/* Login form */}
        <form className="card auth-card" onSubmit={handleSubmit} noValidate>
          <div className="card-b">
            <div className="auth-brand-row">
              <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
            </div>
            <span className="kicker">Clinical Workspace</span>
            <h2>Sign in to SEER</h2>
            <p className="muted" style={{ marginBottom: 20 }}>Use your assigned credentials.</p>

            {error && (
              <div className="auth-error" role="alert">
                <span>⚠</span> {error}
              </div>
            )}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@seer.phc"
                autoComplete="email"
                required
                disabled={loading}
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                  style={{ paddingRight: 44 }}
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
                Doctor → Doctor Dashboard · PHC Worker → PHC Dashboard
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
