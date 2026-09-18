// Postgres store (Neon) — analyses, corrections, eval summaries.
// DATABASE_URL comes from server/.env (gitignored). If unset or unreachable,
// the memory layer falls back to the local JSON file — demo never breaks.

import pg from 'pg';

const { Pool } = pg;
let pool = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  duty_id TEXT NOT NULL,
  facility TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INT NOT NULL,
  diabetes_years INT,
  gender TEXT,
  phone TEXT,
  phc_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS screenings (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  examined_eye TEXT NOT NULL,
  camera_device TEXT,
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS retinal_images (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  quality_score INT,
  sharpness_label TEXT,
  source TEXT DEFAULT 'upload',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS model_predictions (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  image_id TEXT,
  grade INT NOT NULL,
  referable_dr INT NOT NULL,
  confidence REAL NOT NULL,
  quality INT NOT NULL,
  urgency TEXT NOT NULL,
  gradcam_path TEXT,
  lesion_summary JSONB,
  icdr_mapping JSONB,
  model_version TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lesion_findings (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  screening_id TEXT NOT NULL,
  lesion_type TEXT NOT NULL,
  count INT NOT NULL,
  quadrant TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS clinical_decisions (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  decision TEXT NOT NULL,
  original_grade INT NOT NULL,
  final_grade INT NOT NULL,
  override_reason TEXT,
  clinical_notes TEXT,
  referral_priority TEXT,
  decided_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  target_facility TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  content_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sync_records (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'SYNCED',
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  user_id TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS analyses (
  aid TEXT PRIMARY KEY,
  grade INT NOT NULL,
  confidence INT NOT NULL,
  quality INT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'mock',
  rules JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS corrections (
  id SERIAL PRIMARY KEY,
  aid TEXT,
  case_id TEXT,
  corrected_grade INT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  doctor TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS eval_runs (
  id SERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provider TEXT,
  synthetic BOOLEAN DEFAULT false,
  rows JSONB
);
CREATE SEQUENCE IF NOT EXISTS aid_seq;
`;

export function dbConfigured() {
  return !!((process.env.DATABASE_URL || '').trim());
}

export async function initDb() {
  if (!dbConfigured()) return { mode: 'file', reason: 'no DATABASE_URL' };
  try {
    // Strip query params (sslmode/channel_binding) — TLS set explicitly below.
    const cs = process.env.DATABASE_URL.split('?')[0];
    pool = new Pool({ connectionString: cs, ssl: { rejectUnauthorized: false }, max: 5 });
    await pool.query(SCHEMA);
    return { mode: 'pg' };
  } catch (e) {
    pool = null;
    return { mode: 'file', reason: String(e?.message || e).slice(0, 160) };
  }
}

export function pgMode() { return !!pool; }
export function getPool() { return pool; }

export async function pgNextAid() {
  const { rows } = await pool.query(`SELECT 'A-' || LPAD(nextval('aid_seq')::text, 4, '0') AS aid`);
  return rows[0].aid;
}

export async function pgInsertAnalysis({ aid, grade, confidence, quality, source, provider, rules }) {
  await pool.query(
    `INSERT INTO analyses (aid, grade, confidence, quality, source, provider, rules) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
    [aid, grade, confidence, quality, source, provider, JSON.stringify(rules || [])]
  );
}

export async function pgInsertCorrection({ aid, caseId, correctedGrade, reason, doctor }) {
  await pool.query(
    `INSERT INTO corrections (aid, case_id, corrected_grade, reason, doctor) VALUES ($1,$2,$3,$4,$5)`,
    [aid, caseId, correctedGrade, reason || '', doctor || '']
  );
  const { rows } = await pool.query(`SELECT count(*)::int AS n FROM corrections`);
  return rows[0].n;
}

export async function pgStats() {
  const byGrade = [0, 0, 0, 0, 0];
  const providers = { mock: 0, api: 0 };
  let analyses = 0, overrides = 0;
  const g = await pool.query(`SELECT grade, count(*)::int AS n FROM analyses GROUP BY grade`);
  for (const r of g.rows) { if (r.grade >= 0 && r.grade <= 4) byGrade[r.grade] = r.n; analyses += r.n; }
  const p = await pool.query(`SELECT provider, count(*)::int AS n FROM analyses GROUP BY provider`);
  for (const r of p.rows) { if (r.provider === 'api') providers.api = r.n; else providers.mock += r.n; }
  const o = await pool.query(`SELECT count(*)::int AS n FROM analyses WHERE rules::text LIKE '%retake%' OR rules::text LIKE '%escalate%' OR rules::text LIKE '%override%'`);
  overrides = o.rows[0].n;
  const c = await pool.query(`SELECT count(*)::int AS n FROM corrections`);
  return { analyses, corrections: c.rows[0].n, byGrade, providers, overrides };
}

export async function pgRecentAudit(limit = 20) {
  const n = Math.max(1, Math.min(100, Number(limit) || 20));
  const { rows } = await pool.query(
    `SELECT aid, grade, confidence, quality, source, provider, rules, extract(epoch from created_at)*1000 AS at FROM analyses ORDER BY created_at DESC LIMIT $1`,
    [n]
  );
  return rows.map((r) => ({ ...r, at: Number(r.at) }));
}

export async function pgRecentCorrections(limit = 20) {
  const n = Math.max(1, Math.min(100, Number(limit) || 20));
  const { rows } = await pool.query(
    `SELECT aid, case_id AS "caseId", corrected_grade AS "correctedGrade", reason, doctor, extract(epoch from created_at)*1000 AS at FROM corrections ORDER BY created_at DESC LIMIT $1`,
    [n]
  );
  return rows.map((r) => ({ ...r, at: Number(r.at) }));
}

export async function pgInsertEval({ provider, synthetic, rows: evalRows }) {
  await pool.query(`INSERT INTO eval_runs (provider, synthetic, rows) VALUES ($1,$2,$3::jsonb)`, [provider, !!synthetic, JSON.stringify(evalRows || [])]);
}
