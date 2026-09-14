import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { setSession } from '../lib/store.js';

export default function Login() {
  const nav = useNavigate();
  const [form, setForm] = useState({ doctor: 'Dr. A. Patil', phc: 'PHC Melghat', id: 'MH-PHC-042' });
  const go = (e) => {
    e.preventDefault();
    if (!form.doctor.trim() || !form.phc.trim()) return;
    setSession({ doctor: form.doctor.trim(), phc: form.phc.trim(), id: form.id.trim(), at: Date.now() });
    nav('/app');
  };
  return (
    <div className="auth-wrap">
      <div className="auth-grid">
        <div className="auth-side">
          <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
          <h1>Screen a village<br />before lunch.</h1>
          <p>Sign in to the PHC workspace — queue, screening, referrals and reports in one calm place. Demo build: any name works, nothing leaves this browser except /api calls.</p>
          <ul>
            <li>✓ 30-second verdict with proof</li>
            <li>✓ Plain-word referral slips (EN + हिन्दी)</li>
            <li>✓ Works on slow net, syncs later</li>
          </ul>
        </div>
        <form className="card auth-card" onSubmit={go}>
          <div className="card-b">
            <span className="kicker">Doctor sign in</span>
            <h2>Welcome back</h2>
            <p className="muted">Use your PHC duty ID. This demo skips OTP.</p>
            <div className="field"><label htmlFor="d">Doctor name</label><input id="d" value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} autoComplete="name" /></div>
            <div className="field"><label htmlFor="p">PHC / centre</label><input id="p" value={form.phc} onChange={(e) => setForm({ ...form, phc: e.target.value })} /></div>
            <div className="field"><label htmlFor="i">Duty ID</label><input id="i" value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="mono" /></div>
            <button className="btn btn-primary btn-block" type="submit">Enter workspace →</button>
            <Link className="btn btn-outline btn-block" to="/" style={{ marginTop: 8 }}>← Back to landing</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
