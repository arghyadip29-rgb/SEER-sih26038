import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { getSession, setSession } from '../lib/store.js';
import ThemeToggle from './ThemeToggle.jsx';

const NAV = [
  { to: '/app', label: 'Overview', icon: '▦', end: true },
  { to: '/app/screen', label: 'New screening', icon: '◉' },
  { to: '/app/cases', label: 'Cases', icon: '▤' },
  { to: '/app/reports', label: 'Reports', icon: '⬇' },
  { to: '/app/assistant', label: 'Assistant', icon: '✦' },
  { to: '/app/memory', label: 'Memory', icon: '▣' },
  { to: '/app/knowledge', label: 'Knowledge', icon: '⋈' },
  { to: '/app/guide', label: 'Field guide', icon: '✚' },
  { to: '/app/settings', label: 'Settings', icon: '⚙' },
];

export default function Shell() {
  const nav = useNavigate();
  const session = getSession();
  if (!session) {
    return (
      <div className="wrap" style={{ padding: '60px 20px', maxWidth: 520 }}>
        <div className="card"><div className="card-b" style={{ textAlign: 'center' }}>
          <div className="brand" style={{ justifyContent: 'center' }}><span className="brand-mark">◉</span>SEER</div>
          <p className="muted" style={{ margin: '12px 0 16px' }}>Doctor sign-in required for the screening workspace.</p>
          <Link className="btn btn-primary" to="/login">Go to sign in →</Link>
        </div></div>
      </div>
    );
  }
  return (
    <div className="shell">
      <aside className="side" aria-label="Workspace">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link className="brand" to="/"><span className="brand-mark">◉</span>SEER</Link>
          <ThemeToggle />
        </div>
        <div className="side-phc">{session.phc}<span>{session.doctor || session.name} · <strong style={{ color: 'var(--primary)' }}>{session.role === 'phc_worker' ? 'PHC Worker' : 'Doctor'}</strong></span></div>
        <nav className="side-nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `side-link${isActive ? ' active' : ''}`}>
              <span className="side-ic" aria-hidden="true">{n.icon}</span>{n.label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <span className="ps-chip">SIH26038 · :4000 API</span>
          <button className="btn btn-outline btn-sm btn-block" onClick={() => { setSession(null); nav('/'); }}>Sign out</button>
        </div>
      </aside>
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
}
