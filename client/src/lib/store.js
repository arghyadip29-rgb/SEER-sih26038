// Session + cases store (localStorage). Demo-ready, no backend dependency.

const CASES_KEY = 'drishti-cases-v2';
const SESSION_KEY = 'drishti-session-v1';

export function getSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
}
export function setSession(s) {
  if (!s) localStorage.removeItem(SESSION_KEY);
  else localStorage.setItem(SESSION_KEY, JSON.stringify(s));
}

// No seed data — the queue starts empty and fills only with real screenings.
export function getCases() {
  try {
    const raw = localStorage.getItem(CASES_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch { return []; }
}

export function saveCase(c) {
  const all = getCases();
  const i = all.findIndex((x) => x.id === c.id);
  if (i >= 0) all[i] = c; else all.unshift(c);
  localStorage.setItem(CASES_KEY, JSON.stringify(all));
  return c;
}

export function newCaseId() {
  const all = getCases();
  const max = all.reduce((m, c) => {
    const n = parseInt(String(c.id).split('-')[1] || '0', 10);
    return Math.max(m, Number.isFinite(n) ? n : 0);
  }, 1040);
  return `DRI-${max + 1}`;
}

export function statusForGrade(g) {
  if (g >= 4) return 'urgent';
  if (g >= 2) return 'referred';
  if (g === 1) return 'queued';
  return 'cleared';
}

export const STATUS_LABEL = { queued: 'In review', referred: 'Referred', cleared: 'Cleared', urgent: 'Urgent' };
