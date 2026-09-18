// Synchronization Engine: SQLite (Local/Offline) <-> PostgreSQL (Central Cloud/Server)
import {
  sqliteGetPendingSync,
  sqliteUpdateSyncStatus,
  sqliteGetSyncSummary
} from '../../db/sqlite.js';
import { pgMode, getPool } from '../../db/store.js';

export class SyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  getSummary() {
    return {
      pgConnected: pgMode(),
      lastSyncTime: this.lastSyncTime,
      isSyncing: this.isSyncing,
      queue: sqliteGetSyncSummary(),
    };
  }

  async runSync() {
    if (this.isSyncing) {
      return { ok: false, message: 'Sync already in progress', summary: this.getSummary() };
    }
    if (!pgMode()) {
      return { ok: false, message: 'PostgreSQL not reachable or not configured. Records preserved in local SQLite queue.', summary: this.getSummary() };
    }

    this.isSyncing = true;
    const pool = getPool();
    const pending = sqliteGetPendingSync(50);
    let syncedCount = 0;
    let failedCount = 0;

    try {
      for (const item of pending) {
        sqliteUpdateSyncStatus(item.id, 'SYNCING');
        try {
          const payload = JSON.parse(item.payload);
          await this._syncEntityToPg(pool, item.entity_type, payload);
          sqliteUpdateSyncStatus(item.id, 'SYNCED');
          syncedCount++;
        } catch (err) {
          console.error(`[Sync] Failed to sync ${item.entity_type} (${item.entity_id}):`, err.message);
          sqliteUpdateSyncStatus(item.id, 'FAILED', err.message);
          failedCount++;
        }
      }
      this.lastSyncTime = Date.now();
      return {
        ok: true,
        synced: syncedCount,
        failed: failedCount,
        remaining: pending.length - (syncedCount + failedCount),
        summary: this.getSummary(),
      };
    } finally {
      this.isSyncing = false;
    }
  }

  async _syncEntityToPg(pool, entityType, p) {
    if (entityType === 'patient') {
      await pool.query(`
        INSERT INTO patients (id, name, age, diabetes_years, gender, phone, phc_id, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8/1000.0), to_timestamp($9/1000.0))
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          age = EXCLUDED.age,
          diabetes_years = EXCLUDED.diabetes_years,
          updated_at = EXCLUDED.updated_at
      `, [p.id, p.name, p.age, p.diabetes_years || null, p.gender || null, p.phone || null, p.phc_id || null, p.created_at || Date.now(), Date.now()]);
    } else if (entityType === 'screening') {
      await pool.query(`
        INSERT INTO screenings (id, patient_id, examined_eye, camera_device, status, created_by, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, to_timestamp($7/1000.0), to_timestamp($8/1000.0))
        ON CONFLICT (id) DO UPDATE SET
          status = EXCLUDED.status,
          updated_at = EXCLUDED.updated_at
      `, [p.id, p.patient_id, p.examined_eye, p.camera_device || 'Standard', p.status || 'queued', p.created_by || null, p.created_at || Date.now(), Date.now()]);
    } else if (entityType === 'retinal_image') {
      await pool.query(`
        INSERT INTO retinal_images (id, screening_id, patient_id, file_path, file_hash, quality_score, sharpness_label, source, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9/1000.0))
        ON CONFLICT (id) DO NOTHING
      `, [p.id, p.screening_id, p.patient_id, p.file_path, p.file_hash, p.quality_score || 0, p.sharpness_label || '', p.source || 'upload', p.created_at || Date.now()]);
    } else if (entityType === 'model_prediction') {
      await pool.query(`
        INSERT INTO model_predictions (id, screening_id, image_id, grade, referable_dr, confidence, quality, urgency, gradcam_path, lesion_summary, icdr_mapping, model_version, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, to_timestamp($13/1000.0))
        ON CONFLICT (id) DO NOTHING
      `, [
        p.id, p.screening_id, p.image_id || null, p.grade,
        p.referable_dr ? 1 : 0, p.confidence, p.quality,
        p.urgency, p.gradcam_path || '',
        JSON.stringify(p.lesion_analysis || {}),
        JSON.stringify(p.icdr_mapping || {}),
        p.model_version || 'seer-matlab-v1.2',
        p.created_at || Date.now(),
      ]);
    } else if (entityType === 'clinical_decision') {
      await pool.query(`
        INSERT INTO clinical_decisions (id, screening_id, doctor_id, doctor_name, decision, original_grade, final_grade, override_reason, clinical_notes, referral_priority, decided_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, to_timestamp($11/1000.0))
        ON CONFLICT (id) DO UPDATE SET
          decision = EXCLUDED.decision,
          final_grade = EXCLUDED.final_grade,
          override_reason = EXCLUDED.override_reason,
          clinical_notes = EXCLUDED.clinical_notes
      `, [
        p.id, p.screening_id, p.doctor_id || 'DOC-01', p.doctor_name,
        p.decision, p.original_grade, p.final_grade,
        p.override_reason || '', p.clinical_notes || '',
        p.referral_priority || '', p.decided_at || Date.now(),
      ]);
      // Also update screening status in PG
      const newStatus = p.decision === 'approve' ? 'approved' : p.decision === 'override' ? 'overridden' : 'referred';
      await pool.query(`UPDATE screenings SET status = $1, updated_at = now() WHERE id = $2`, [newStatus, p.screening_id]);
    }
  }
}

export const syncService = new SyncService();
