import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './lib/theme.jsx'

// Shows a readable error instead of a blank page if any route crashes.
class RootErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 560, margin: '70px auto', padding: '0 20px', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: 12, letterSpacing: '0.1em', color: '#0b5bd3', fontWeight: 700 }}>SOMETHING WENT WRONG</p>
          <h1 style={{ letterSpacing: '-0.02em' }}>This screen hit an error.</h1>
          <p style={{ color: '#5b6b84' }}>Reloading usually fixes it. If it persists, sign out and back in.</p>
          <pre style={{ background: '#0f1e33', color: '#dbe7fa', borderRadius: 8, padding: 12, fontSize: 11.5, overflow: 'auto' }}>
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn btn-primary" onClick={() => location.reload()}>Reload →</button>
            <a className="btn btn-outline" href="/">Landing →</a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Apply saved theme before first paint to avoid flash
try {
  const t = localStorage.getItem('seer-theme-v1') || 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch { /* ignore */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <RootErrorBoundary>
        <App />
      </RootErrorBoundary>
    </ThemeProvider>
  </StrictMode>,
)

