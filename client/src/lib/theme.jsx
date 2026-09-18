// Theme context — dark / light mode with localStorage persistence.
import { createContext, useContext, useEffect, useState } from 'react';

const THEME_KEY = 'seer-theme-v1';

const ThemeContext = createContext({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(THEME_KEY) || 'light'; } catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
