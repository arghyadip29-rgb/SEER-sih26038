import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
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

function NotFound() {
  return (
    <div className="wrap" style={{ padding: '70px 20px', maxWidth: 560, textAlign: 'center' }}>
      <span className="kicker">404</span>
      <h1 style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.03em' }}>This page wandered off.</h1>
      <p className="muted">The eye chart ends here. Head back somewhere useful.</p>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14 }}>
        <Link className="btn btn-primary" to="/">Landing →</Link>
        <Link className="btn btn-outline" to="/app">Workspace →</Link>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/doctor" element={<Login />} />
        <Route path="/app" element={<Shell />}>
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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
