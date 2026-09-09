// Memory layer — Postgres (Neon) when DATABASE_URL is set, local JSON file
// otherwise. Same interface either way; callers are async. The file fallback
// keeps the rural/offline demo story intact.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { pgMode, pgNextAid, pgInsertAnalysis, pgInsertCorrection, pgStats, pgRecentAudit, pgRecentCorrections } from '../db/store.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(here, '..', 'data');
const MEM_FILE = join(DATA_DIR, 'memory.json');
const MAX = 500;

function blank() { return { analyses: [], corrections: [], seq: 0 }; }

function load() {
  try {
    if (!existsSync(MEM_FILE)) return blank();
    const m = JSON.parse(readFileSync(MEM_FILE, 'utf8'));
    return { analyses: m.analyses || [], corrections: m.corrections || [], seq: m.seq || 0 };
  } catch { return blank(); }
}

function persist(m) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(MEM_FILE, JSON.stringify(m, null, 1));
}

export async function recordAnalysis({ grade, confidence, quality, source, provider, rules }) {
  if (pgMode()) {
    try {
      const aid = await pgNextAid();
      await pgInsertAnalysis({ aid, grade, confidence, quality, source, provider, rules });
      return aid;
    } catch { /* fall through to file */ }
  }
  const m = load();
  m.seq += 1;
  const aid = `A-${String(m.seq).padStart(4, '0')}`;
  m.analyses.unshift({ aid, grade, confidence, quality, source, provider, rules: rules || [], at: Date.now() });
  m.analyses = m.analyses.slice(0, MAX);
  persist(m);
  return aid;
}

export async function recordCorrection({ aid = null, caseId = null, correctedGrade, reason = '', doctor = '' }) {
  const g = Number(correctedGrade);
  if (!Number.isInteger(g) || g < 0 || g > 4) throw new Error('correctedGrade must be 0–4');
  if (pgMode()) {
    try {
      const n = await pgInsertCorrection({ aid, caseId, correctedGrade: g, reason, doctor });
      return { ok: true, corrections: n };
    } catch { /* fall through to file */ }
  }
  const m = load();
  m.corrections.unshift({ aid, caseId, correctedGrade: g, reason: String(reason).slice(0, 500), doctor: String(doctor).slice(0, 80), at: Date.now() });
  m.corrections = m.corrections.slice(0, MAX);
  persist(m);
  return { ok: true, corrections: m.corrections.length };
}

export async function stats() {
  if (pgMode()) {
    try { return await pgStats(); } catch { /* fall through */ }
  }
  const m = load();
  const byGrade = [0, 0, 0, 0, 0];
  const providers = { mock: 0, api: 0 };
  let overrides = 0;
  for (const a of m.analyses) {
    if (a.grade >= 0 && a.grade <= 4) byGrade[a.grade] += 1;
    if (a.provider === 'api') providers.api += 1; else providers.mock += 1;
    if ((a.rules || []).some((r) => r.includes('override') || r.includes('retake') || r.includes('escalate'))) overrides += 1;
  }
  return { analyses: m.analyses.length, corrections: m.corrections.length, byGrade, providers, overrides };
}

export async function recentAudit(limit = 20) {
  if (pgMode()) {
    try { return await pgRecentAudit(limit); } catch { /* fall through */ }
  }
  return load().analyses.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
}

export async function recentCorrections(limit = 20) {
  if (pgMode()) {
    try { return await pgRecentCorrections(limit); } catch { /* fall through */ }
  }
  return load().corrections.slice(0, Math.max(1, Math.min(100, Number(limit) || 20)));
}
