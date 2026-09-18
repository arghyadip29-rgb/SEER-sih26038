// Local SQLite storage using Node 25 built-in node:sqlite
import { DatabaseSync } from 'node:sqlite';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_DIR = join(__dirname, '..', 'data');
if (!existsSync(DB_DIR)) mkdirSync(DB_DIR, { recursive: true });

const SQLITE_FILE = process.env.SQLITE_PATH || join(DB_DIR, 'seer_offline.sqlite');

let db = null;

const SQLITE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor', 'phc_worker')),
  duty_id TEXT NOT NULL,
  facility TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  age INTEGER NOT NULL,
  diabetes_years INTEGER,
  gender TEXT,
  phone TEXT,
  phc_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS screenings (
  id TEXT PRIMARY KEY,
  patient_id TEXT NOT NULL,
  examined_eye TEXT NOT NULL,
  camera_device TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued', 'in_review', 'approved', 'overridden', 'referred', 'cleared', 'urgent')),
  created_by TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS retinal_images (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  quality_score INTEGER,
  sharpness_label TEXT,
  source TEXT DEFAULT 'upload',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS model_predictions (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  image_id TEXT,
  grade INTEGER NOT NULL,
  referable_dr INTEGER NOT NULL,
  confidence REAL NOT NULL,
  quality INTEGER NOT NULL,
  urgency TEXT NOT NULL,
  gradcam_path TEXT,
  lesion_summary TEXT,
  icdr_mapping TEXT,
  model_version TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS lesion_findings (
  id TEXT PRIMARY KEY,
  prediction_id TEXT NOT NULL,
  screening_id TEXT NOT NULL,
  lesion_type TEXT NOT NULL,
  count INTEGER NOT NULL,
  quadrant TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS clinical_decisions (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  doctor_name TEXT NOT NULL,
  decision TEXT NOT NULL CHECK(decision IN ('approve', 'override', 'refer')),
  original_grade INTEGER NOT NULL,
  final_grade INTEGER NOT NULL,
  override_reason TEXT,
  clinical_notes TEXT,
  referral_priority TEXT,
  decided_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  priority TEXT NOT NULL,
  target_facility TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  screening_id TEXT NOT NULL,
  report_type TEXT NOT NULL CHECK(report_type IN ('doctor', 'patient')),
  content_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'SYNCING', 'SYNCED', 'FAILED', 'CONFLICT')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

export function initSqlite() {
  try {
    db = new DatabaseSync(SQLITE_FILE);
    db.exec(SQLITE_SCHEMA);
    console.log(`[SQLite] Local offline database ready at: ${SQLITE_FILE}`);
    return { ok: true, file: SQLITE_FILE };
  } catch (err) {
    console.error('[SQLite] Failed to initialize SQLite database:', err);
    throw err;
  }
}

export function getSqliteDb() {
  if (!db) initSqlite();
  return db;
}

// ----------------- SQLite Entity Helpers -----------------

export function sqliteInsertPatient(p) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO patients (id, name, age, diabetes_years, gender, phone, phc_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(p.id, p.name, p.age, p.diabetes_years || null, p.gender || null, p.phone || null, p.phc_id || null, p.created_at || Date.now(), Date.now());
  sqliteQueueSync('patient', p.id, p);
  return p;
}

export function sqliteInsertScreening(s) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO screenings (id, patient_id, examined_eye, camera_device, status, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(s.id, s.patient_id, s.examined_eye, s.camera_device || 'Standard', s.status || 'queued', s.created_by || null, s.created_at || Date.now(), Date.now());
  sqliteQueueSync('screening', s.id, s);
  return s;
}

export function sqliteInsertImage(img) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO retinal_images (id, screening_id, patient_id, file_path, file_hash, quality_score, sharpness_label, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(img.id, img.screening_id, img.patient_id, img.file_path, img.file_hash, img.quality_score || 0, img.sharpness_label || '', img.source || 'upload', img.created_at || Date.now());
  sqliteQueueSync('retinal_image', img.id, img);
  return img;
}

export function sqliteInsertPrediction(pred) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO model_predictions (id, screening_id, image_id, grade, referable_dr, confidence, quality, urgency, gradcam_path, lesion_summary, icdr_mapping, model_version, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    pred.id, pred.screening_id, pred.image_id || null, pred.grade,
    pred.referable_dr ? 1 : 0, pred.confidence, pred.quality,
    pred.urgency, pred.gradcam_path || '',
    JSON.stringify(pred.lesion_analysis || {}),
    JSON.stringify(pred.icdr_mapping || {}),
    pred.model_version || 'seer-matlab-v1.2',
    pred.created_at || Date.now()
  );
  sqliteQueueSync('model_prediction', pred.id, pred);
  return pred;
}

export function sqliteInsertDecision(dec) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    INSERT OR REPLACE INTO clinical_decisions (id, screening_id, doctor_id, doctor_name, decision, original_grade, final_grade, override_reason, clinical_notes, referral_priority, decided_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    dec.id, dec.screening_id, dec.doctor_id || 'DOC-01', dec.doctor_name,
    dec.decision, dec.original_grade, dec.final_grade,
    dec.override_reason || '', dec.clinical_notes || '',
    dec.referral_priority || '', dec.decided_at || Date.now()
  );
  
  // Update screening status
  const newStatus = dec.decision === 'approve' ? 'approved' : dec.decision === 'override' ? 'overridden' : 'referred';
  d.prepare(`UPDATE screenings SET status = ?, updated_at = ? WHERE id = ?`).run(newStatus, Date.now(), dec.screening_id);

  sqliteQueueSync('clinical_decision', dec.id, dec);
  return dec;
}

export function sqliteGetScreeningDetail(id) {
  const d = getSqliteDb();
  const sc = d.prepare(`SELECT * FROM screenings WHERE id = ?`).get(id);
  if (!sc) return null;
  const patient = d.prepare(`SELECT * FROM patients WHERE id = ?`).get(sc.patient_id);
  const image = d.prepare(`SELECT * FROM retinal_images WHERE screening_id = ? ORDER BY created_at DESC LIMIT 1`).get(id);
  const prediction = d.prepare(`SELECT * FROM model_predictions WHERE screening_id = ? ORDER BY created_at DESC LIMIT 1`).get(id);
  const decision = d.prepare(`SELECT * FROM clinical_decisions WHERE screening_id = ? ORDER BY decided_at DESC LIMIT 1`).get(id);
  return {
    ...sc,
    patient,
    image,
    prediction: prediction ? {
      ...prediction,
      lesion_analysis: JSON.parse(prediction.lesion_summary || '{}'),
      icdr_mapping: JSON.parse(prediction.icdr_mapping || '{}'),
      referable_dr: !!prediction.referable_dr,
    } : null,
    decision,
  };
}

export function sqliteGetAllScreenings() {
  const d = getSqliteDb();
  const rows = d.prepare(`
    SELECT s.*, p.name as patient_name, p.age as patient_age,
           mp.grade as model_grade, mp.confidence as model_confidence, mp.quality as model_quality,
           img.file_path as image_path
    FROM screenings s
    LEFT JOIN patients p ON s.patient_id = p.id
    LEFT JOIN model_predictions mp ON mp.screening_id = s.id
    LEFT JOIN retinal_images img ON img.screening_id = s.id
    ORDER BY s.created_at DESC
  `).all();
  return rows;
}

// ----------------- Offline Sync Queue Helpers -----------------

export function sqliteQueueSync(entityType, entityId, payload) {
  const d = getSqliteDb();
  const queueId = `SYNC-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const stmt = d.prepare(`
    INSERT INTO sync_queue (id, entity_type, entity_id, payload, status, attempts, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'PENDING', 0, ?, ?)
  `);
  stmt.run(queueId, entityType, entityId, JSON.stringify(payload), Date.now(), Date.now());
  return queueId;
}

export function sqliteGetPendingSync(limit = 50) {
  const d = getSqliteDb();
  return d.prepare(`SELECT * FROM sync_queue WHERE status IN ('PENDING', 'FAILED') ORDER BY created_at ASC LIMIT ?`).all(limit);
}

export function sqliteUpdateSyncStatus(id, status, error = null) {
  const d = getSqliteDb();
  const stmt = d.prepare(`
    UPDATE sync_queue
    SET status = ?, attempts = attempts + 1, last_error = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, error ? String(error).slice(0, 255) : null, Date.now(), id);
}

export function sqliteGetSyncSummary() {
  const d = getSqliteDb();
  const counts = d.prepare(`
    SELECT status, count(*) as count FROM sync_queue GROUP BY status
  `).all();
  const summary = { PENDING: 0, SYNCING: 0, SYNCED: 0, FAILED: 0, CONFLICT: 0 };
  for (const r of counts) {
    if (r.status in summary) summary[r.status] = r.count;
  }
  return summary;
}
