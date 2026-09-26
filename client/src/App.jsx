import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import Shell from './components/Shell.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Overview from './pages/Overview.jsx';
import Screen from './pages/Screen.jsx';
import { CaseDetail, Cases } from './pages/Cases.jsx';
import Reports from './pages/Reports.jsx';
import Assistant from './pages/Assistant.jsx';
import Memory from './pages/Memory.jsx';
import Knowledge from './pages/Knowledge.jsx';
import Guide from './pages/Guide.jsx';
import Settings from './pages/Settings.jsx';
import {
  PhcShell,
  PhcOverview,
  PhcRegister,
  PhcUpload,
  PhcStatus,
  PhcReferrals,
} from './pages/PhcDashboard.jsx';
import { getSession } from './lib/store.js';

// ─── Route guard: redirect to /login if not authenticated ────────────────────────
function RequireAuth({ children, role }) {
  const session = getSession();
  if (!session) return <Navigate to="/login" replace />;
  if (role && session.role !== role) {
    // Wrong role: redirect to their dashboard
    if (session.role === 'doctor') return <Navigate to="/app" replace />;
    if (session.role === 'phc_worker') return <Navigate to="/phc" replace />;
    return <Navigate to="/login" replace />;
  }
  return children;
}

// ─── Redirect logged-in users away from /login ────────────────────────────────
function PublicOnly({ children }) {
  const session = getSession();
  if (session?.role === 'doctor') return <Navigate to="/app" replace />;
  if (session?.role === 'phc_worker') return <Navigate to="/phc" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="wrap" style={{ padding: '70px 20px', maxWidth: 560, textAlign: 'center' }}>
      <span className="kicker">404</span>
      <h1 style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>This page wandered off.</h1>
      <p className="muted">The eye chart ends here. Head back somewhere useful.</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        <Link className="btn btn-primary" to="/">Landing →</Link>
        <Link className="btn btn-outline" to="/login">Sign In →</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/doctor" element={<Navigate to="/login" replace />} />

        {/* Doctor-only workspace (/app/*) */}
        <Route
          path="/app"
          element={<RequireAuth role="doctor"><Shell /></RequireAuth>}
        >
          <Route index element={<Overview />} />
          <Route path="screen" element={<Screen />} />
          <Route path="cases" element={<Cases />} />
          <Route path="cases/:id" element={<CaseDetail />} />
          <Route path="reports" element={<Reports />} />
          <Route path="assistant" element={<Assistant />} />
          <Route path="memory" element={<Memory />} />
          <Route path="knowledge" element={<Knowledge />} />
          <Route path="guide" element={<Guide />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* PHC Worker workspace (/phc/*) */}
        <Route
          path="/phc"
          element={<RequireAuth role="phc_worker"><PhcShell /></RequireAuth>}
        >
          <Route index element={<PhcOverview />} />
          <Route path="register" element={<PhcRegister />} />
          <Route path="upload" element={<Screen isPhc={true} />} />
          <Route path="status" element={<PhcStatus />} />
          <Route path="referrals" element={<PhcReferrals />} />
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
