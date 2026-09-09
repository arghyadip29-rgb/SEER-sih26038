import { useState } from 'react';
import { getSession, setSession } from '../lib/store.js';

export default function Settings() {
  const s = getSession() || {};
  const [form, setForm] = useState({ doctor: s.doctor || '', phc: s.phc || '', id: s.id || '', lang: 'EN + हिन्दी', quality: 65 });
  const [msg, setMsg] = useState('');
  const save = (e) => {
    e.preventDefault();
    setSession({ ...s, doctor: form.doctor, phc: form.phc, id: form.id });
    setMsg('Workspace saved.'); setTimeout(() => setMsg(''), 2400);
  };
  const reset = () => { if (confirm('Clear demo cases and sign out?')) { localStorage.clear(); location.href = '/'; } };
  return (
    <div className="page narrow">
      <div className="page-head"><div><span className="kicker">Settings</span><h1>PHC workspace</h1></div></div>
      <form className="card" onSubmit={save}><div className="card-b">
        <div className="field"><label>Doctor</label><input value={form.doctor} onChange={(e) => setForm({ ...form, doctor: e.target.value })} /></div>
        <div className="field"><label>PHC / centre</label><input value={form.phc} onChange={(e) => setForm({ ...form, phc: e.target.value })} /></div>
        <div className="row2">
          <div className="field"><label>Duty ID</label><input value={form.id} onChange={(e) => setForm({ ...form, id: e.target.value })} className="mono" /></div>
          <div className="field"><label>Report language</label><select value={form.lang} onChange={(e) => setForm({ ...form, lang: e.target.value })}><option>EN + हिन्दी</option><option>English only</option><option>हिन्दी only</option></select></div>
        </div>
        <div className="field"><label>Retake threshold — {form.quality}/100</label><input type="range" min={40} max={85} value={form.quality} onChange={(e) => setForm({ ...form, quality: +e.target.value })} style={{ accentColor: 'var(--primary)' }} /><small className="muted">Photos below this score ask for a retake instead of a grade.</small></div>
        <button className="btn btn-primary" type="submit">Save workspace</button>
        {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}
      </div></form>
      <section className="card danger-zone"><div className="card-b">
        <b>Demo data</b><p className="muted">Cases live in this browser (localStorage). The Node API at :4000 stays stateless.</p>
        <button className="btn btn-outline btn-sm" onClick={reset}>Clear demo data + sign out</button>
      </div></section>
    </div>
  );
}
