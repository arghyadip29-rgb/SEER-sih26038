import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ThemeProvider } from './lib/theme.jsx'

// Apply saved theme before first paint to avoid flash
try {
  const t = localStorage.getItem('seer-theme-v1') || 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch { /* ignore */ }

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)

