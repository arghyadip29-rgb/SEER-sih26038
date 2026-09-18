import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setSession } from '../lib/store.js';

export default function Login() {
  const nav = useNavigate();
  const [role, setRole] = useState('doctor'); // 'doctor' | 'phc_worker'
  const [form, setForm] = useState({
    name: 'Dr. A. Patil',
    phc: 'PHC Melghat',
    id: 'MH-PHC-042',
  });

  const selectRole = (r) => {
    setRole(r);
    if (r === 'doctor') {
      setForm({ name: 'Dr. A. Patil', phc: 'PHC Melghat', id: 'MH-DOC-042' });
    } else {
      setForm({ name: 'Sunita Sharma (ASHA/PHC)', phc: 'PHC Melghat', id: 'MH-ASHA-108' });
    }
  };

  const go = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phc.trim()) return;

    let token = `token-${Date.now()}`;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: form.name.trim(), role, facility: form.phc.trim(), dutyId: form.id.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) token = data.token;
      }
    } catch { /* offline fallback */ }

    setSession({
      doctor: form.name.trim(),
      name: form.name.trim(),
      role,
      phc: form.phc.trim(),
      id: form.id.trim(),
      token,
      at: Date.now(),
    });
    nav('/app');
  };

  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        <div className="auth-side">
          <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
          <h1>Screen a village<br />before lunch.</h1>
          <p>Sign in to the clinical workspace — queue, screening, referrals and reports in one calm place. Built for field PHCs and hospital ophthalmologists.</p>
          <ul>
            <li>✓ 30-second verdict with MATLAB Deep Learning</li>
            <li>✓ Grad-CAM saliency map & 4-quadrant lesion analysis</li>
            <li>✓ Offline-first local storage, auto-sync when online</li>
            <li>✓ Doctor Approval, Override & Referral triage</li>
          </ul>
        </div>
        <form className="card auth-card" onSubmit={go}>
          <div className="card-b">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              <button
                type="button"
                className={`btn btn-sm ${role === 'doctor' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => selectRole('doctor')}
                style={{ fontWeight: 600 }}
              >
                Login as Doctor
              </button>
              <button
                type="button"
                className={`btn btn-sm ${role === 'phc_worker' ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => selectRole('phc_worker')}
                style={{ fontWeight: 600 }}
              >
                Login as PHC Worker
              </button>
            </div>

            <span className="kicker">{role === 'doctor' ? 'Doctor Sign In' : 'PHC Worker Sign In'}</span>
            <h2>{role === 'doctor' ? 'Clinician Workspace' : 'Field PHC Workspace'}</h2>
            <p className="muted">Logged in role will be registered as <strong>{role === 'doctor' ? 'Medical Doctor / Ophthalmologist' : 'PHC Health Worker'}</strong>.</p>
            
            <div className="field">
              <label htmlFor="d">{role === 'doctor' ? 'Doctor Name' : 'Worker / ASHA Name'}</label>
              <input id="d" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="p">PHC / Health Centre</label>
              <input id="p" value={form.phc} onChange={(e) => setForm({ ...form, phc: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="i">Duty ID</label>
              <input id="i" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="mono" required />
            </div>
            <button className="btn btn-primary btn-block" type="submit">
              {role === 'doctor' ? 'Enter Doctor Workspace →' : 'Enter PHC Workspace →'}
            </button>
            <Link className="btn btn-outline btn-block" to="/" style={{ marginTop: 8 }}>← Back to landing</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
