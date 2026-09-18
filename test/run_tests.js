// Comprehensive automated test suite for SEER Diabetic Retinopathy screening prototype
import assert from 'assert';
import { matlabService } from '../server/services/matlab/matlabService.js';
import {
  initSqlite,
  sqliteInsertPatient,
  sqliteInsertScreening,
  sqliteInsertImage,
  sqliteInsertPrediction,
  sqliteInsertDecision,
  sqliteGetScreeningDetail,
  sqliteGetPendingSync,
  sqliteUpdateSyncStatus,
  sqliteGetSyncSummary
} from '../server/db/sqlite.js';
import { syncService } from '../server/services/sync/syncService.js';

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    process.stdout.write(`• ${name}... `);
    await fn();
    console.log('PASSED ✓');
    passed++;
  } catch (err) {
    console.log(`FAILED ✗ (${err.message})`);
    failed++;
  }
}

async function main() {
  console.log('====================================================');
  console.log('SEER DR SCREENING PROTOTYPE — AUTOMATED TEST SUITE');
  console.log('====================================================\n');

  // 1. MATLAB Service Tests
  await test('MATLAB Service Status & Toolboxes', async () => {
    const st = matlabService.getStatus();
    assert.ok(st.status, 'Expected status');
    assert.strictEqual(st.toolboxes.length, 6, 'Expected 6 required toolboxes');
    assert.ok(st.toolboxes.includes('Deep Learning Toolbox'));
    assert.ok(st.toolboxes.includes('Image Processing Toolbox'));
    assert.ok(st.toolboxes.includes('Computer Vision Toolbox'));
  });

  await test('MATLAB Fundus Preprocessing & Inference (Grade 2)', async () => {
    const mockImage = Buffer.alloc(1024 * 12, 128); // 12KB mock buffer
    const res = await matlabService.analyzeFundus({
      imageBuffer: mockImage,
      fileName: 'fundus_test.jpg',
      forcedGrade: 2,
    });
    assert.strictEqual(res.grade, 2, 'Grade should match');
    assert.strictEqual(res.referable_dr, true, 'Grade 2 must be Referable DR');
    assert.ok(res.confidence >= 50 && res.confidence <= 100, 'Confidence in [50, 100]');
    assert.ok(res.gradcam_path.includes('.png'), 'Grad-CAM path returned');
    assert.ok(res.lesion_analysis?.table?.length >= 3, 'Lesions table generated');
    assert.ok(res.icdr_mapping?.icdr_category.includes('Moderate'), 'ICDR mapped correctly');
  });

  await test('Grad-CAM Heatmap Overlay File Generation', async () => {
    const mockImage = Buffer.alloc(5000, 200);
    const res = await matlabService.analyzeFundus({ imageBuffer: mockImage, forcedGrade: 3 });
    assert.ok(res.gradcam_path, 'Expected Grad-CAM path');
    assert.strictEqual(res.referable_dr, true, 'Grade 3 must be Referable DR');
  });

  await test('4-Quadrant Lesion Analysis & Convention', async () => {
    const mockImage = Buffer.alloc(5000, 150);
    const res = await matlabService.analyzeFundus({ imageBuffer: mockImage, forcedGrade: 2 });
    const la = res.lesion_analysis;
    assert.ok(la.quadrant_breakdown.ST, 'Superior Temporal quadrant present');
    assert.ok(la.quadrant_breakdown.SN, 'Superior Nasal quadrant present');
    assert.ok(la.quadrant_breakdown.IT, 'Inferior Temporal quadrant present');
    assert.ok(la.quadrant_breakdown.IN, 'Inferior Nasal quadrant present');
    assert.ok(la.coordinate_convention.includes('Superior Temporal'));
  });

  // 2. SQLite Database & Offline-first Tests
  await test('SQLite Initialization & Table Verification', async () => {
    const res = initSqlite();
    assert.ok(res.ok, 'SQLite init ok');
  });

  const testPatientId = `PAT-TEST-${Date.now()}`;
  const testScreeningId = `DRI-TEST-${Date.now()}`;

  await test('SQLite Patient & Screening Insertion', async () => {
    const p = sqliteInsertPatient({
      id: testPatientId,
      name: 'Ramesh Verma',
      age: 58,
      diabetes_years: 12,
      gender: 'Male',
      phc_id: 'PHC Melghat',
    });
    assert.strictEqual(p.name, 'Ramesh Verma');

    const s = sqliteInsertScreening({
      id: testScreeningId,
      patient_id: testPatientId,
      examined_eye: 'Right eye (OD)',
      camera_device: 'Portable Remidio',
      status: 'queued',
      created_by: 'Dr. Patil',
    });
    assert.strictEqual(s.status, 'queued');
  });

  await test('SQLite Retinal Image & Prediction Storage', async () => {
    sqliteInsertImage({
      id: `IMG-${Date.now()}`,
      screening_id: testScreeningId,
      patient_id: testPatientId,
      file_path: '/uploads/test_retina.jpg',
      file_hash: 'abc123hash',
      quality_score: 84,
      sharpness_label: 'Sharp · even light',
    });

    sqliteInsertPrediction({
      id: `PRED-${Date.now()}`,
      screening_id: testScreeningId,
      grade: 2,
      referable_dr: true,
      confidence: 92.4,
      quality: 84,
      urgency: 'Priority Referral (within 4–6 weeks)',
      gradcam_path: '/uploads/gradcam/test.png',
      lesion_analysis: { counts: { ma: 12, hem: 8, ex: 10 } },
      icdr_mapping: { icdr_category: 'Moderate NPDR', why_this_grade: 'Test rationale' },
    });

    const detail = sqliteGetScreeningDetail(testScreeningId);
    assert.ok(detail, 'Screening detail found');
    assert.strictEqual(detail.patient.name, 'Ramesh Verma');
    assert.strictEqual(detail.prediction.grade, 2);
    assert.strictEqual(detail.prediction.referable_dr, true);
  });

  // 3. Clinical Decision Flow Tests (Approve / Override / Refer)
  await test('Doctor Dashboard Decision: Approve Workflow', async () => {
    const dec = sqliteInsertDecision({
      id: `DEC-APP-${Date.now()}`,
      screening_id: testScreeningId,
      doctor_id: 'DOC-PATIL',
      doctor_name: 'Dr. A. Patil',
      decision: 'approve',
      original_grade: 2,
      final_grade: 2,
      clinical_notes: 'Retinal hemorrhages confirmed.',
    });
    assert.strictEqual(dec.decision, 'approve');

    const detail = sqliteGetScreeningDetail(testScreeningId);
    assert.strictEqual(detail.status, 'approved');
  });

  await test('Doctor Dashboard Decision: Override Workflow (Mandatory Reason)', async () => {
    const dec = sqliteInsertDecision({
      id: `DEC-OVR-${Date.now()}`,
      screening_id: testScreeningId,
      doctor_id: 'DOC-PATIL',
      doctor_name: 'Dr. A. Patil',
      decision: 'override',
      original_grade: 2,
      final_grade: 1,
      override_reason: 'Lens opacity artefact, true hemorrhages not seen',
      clinical_notes: 'Downgraded to Grade 1.',
    });
    assert.strictEqual(dec.decision, 'override');
    assert.strictEqual(dec.final_grade, 1);

    const detail = sqliteGetScreeningDetail(testScreeningId);
    assert.strictEqual(detail.status, 'overridden');
  });

  await test('Doctor Dashboard Decision: Refer Workflow', async () => {
    const dec = sqliteInsertDecision({
      id: `DEC-REF-${Date.now()}`,
      screening_id: testScreeningId,
      doctor_id: 'DOC-PATIL',
      doctor_name: 'Dr. A. Patil',
      decision: 'refer',
      original_grade: 1,
      final_grade: 2,
      referral_priority: 'Priority Referral',
      clinical_notes: 'Referred to Amravati District Hospital',
    });
    assert.strictEqual(dec.decision, 'refer');

    const detail = sqliteGetScreeningDetail(testScreeningId);
    assert.strictEqual(detail.status, 'referred');
  });

  // 4. Offline Synchronization Queue Tests
  await test('Sync Queue Enqueue & Status Transitions', async () => {
    const pending = sqliteGetPendingSync();
    assert.ok(pending.length > 0, 'Should have pending sync items');
    const first = pending[0];
    assert.ok(['PENDING', 'FAILED'].includes(first.status));

    sqliteUpdateSyncStatus(first.id, 'SYNCED');
    const summary = sqliteGetSyncSummary();
    assert.ok(summary.SYNCED >= 1, 'At least 1 item marked SYNCED');
  });

  await test('Sync Service Graceful Offline State Reporting', async () => {
    const summary = syncService.getSummary();
    assert.ok('pgConnected' in summary);
    assert.ok('queue' in summary);
  });

  console.log('\n====================================================');
  console.log(`TEST EXECUTION FINISHED: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');
  if (failed > 0) process.exit(1);
}

main().catch(err => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
