// Session + cases store (localStorage). Demo-ready, no backend dependency.

const CASES_KEY = 'seer-cases-v1';
const CASES_KEY_LEGACY = 'drishti-cases-v2';
const SESSION_KEY = 'seer-session-v1';
const SESSION_KEY_LEGACY = 'drishti-session-v1';
const TOKEN_KEY = 'seer-jwt-v1';

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY_LEGACY)) || null;
  } catch { return null; }
}
export function setSession(s) {
  if (!s) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY_LEGACY);
    localStorage.removeItem(TOKEN_KEY);
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || null;
}
export function setToken(t) {
  if (!t) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, t);
}

// Authenticated fetch: automatically attaches Bearer JWT from storage.
export async function authFetch(url, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

// No seed data — the queue starts empty and fills only with real screenings.
export function getCases() {
  try {
    const raw = localStorage.getItem(CASES_KEY) || localStorage.getItem(CASES_KEY_LEGACY);
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
