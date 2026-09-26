// SEER — Automated Auth & RBAC Verification Test Suite
import { authenticate, requireDoctor, requirePhcWorker, signToken, verifyPassword, dbGetUserByEmail, dbInitAuthSchema } from './auth/auth.js';
import { initSqlite, sqliteInsertPatient, sqliteInsertScreening, sqliteInsertPrediction } from './db/sqlite.js';
import { seedUsers } from './auth/seed.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('====================================================');
  console.log('  SEER AUTHENTICATION & RBAC TEST SUITE');
  console.log('====================================================\n');

  initSqlite();
  dbInitAuthSchema();
  await seedUsers();

  // Test 1: Seed Users Exist
  const docUser = dbGetUserByEmail('doctor@seer.phc');
  const phcUser = dbGetUserByEmail('phcworker@seer.phc');
  assert(docUser && docUser.role === 'doctor', 'Doctor seed user exists with role=doctor');
  assert(phcUser && phcUser.role === 'phc_worker', 'PHC Worker seed user exists with role=phc_worker');

  // Test 2: Password Verification
  const docPassValid = await verifyPassword('Doctor@123', docUser.password_hash);
  const docPassInvalid = await verifyPassword('WrongPassword', docUser.password_hash);
  assert(docPassValid === true, 'Correct doctor password validates');
  assert(docPassInvalid === false, 'Incorrect doctor password rejected');

  const phcPassValid = await verifyPassword('PHC@Worker123', phcUser.password_hash);
  const phcPassInvalid = await verifyPassword('WrongPassword', phcUser.password_hash);
  assert(phcPassValid === true, 'Correct PHC worker password validates');
  assert(phcPassInvalid === false, 'Incorrect PHC worker password rejected');

  // Test 3: JWT Generation & Verification
  const docToken = signToken({ sub: docUser.id, role: docUser.role });
  const phcToken = signToken({ sub: phcUser.id, role: phcUser.role });
  assert(typeof docToken === 'string' && docToken.length > 20, 'Doctor JWT generated');
  assert(typeof phcToken === 'string' && phcToken.length > 20, 'PHC Worker JWT generated');

  // Test 4: Middleware Simulation helper
  function mockReqRes(token) {
    const req = {
      headers: token ? { authorization: `Bearer ${token}` } : {},
      params: {},
      body: {},
    };
    let statusCode = 200;
    let jsonBody = null;
    const res = {
      status(code) { statusCode = code; return this; },
      json(data) { jsonBody = data; return this; },
      send(data) { jsonBody = data; return this; },
    };
    return { req, res, getStatus: () => statusCode, getBody: () => jsonBody };
  }

  function runMiddleware(mw, req, res) {
    return new Promise((resolve) => {
      mw(req, res, () => resolve('next'));
      // if next wasn't called synchronously and status was set
      resolve('stopped');
    });
  }

  // Test 5: Authentication Middleware
  {
    const { req, res, getStatus } = mockReqRes(docToken);
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert(nextCalled && req.user && req.user.role === 'doctor', 'authenticate allows valid doctor token');
  }

  {
    const { req, res, getStatus, getBody } = mockReqRes(null);
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert(!nextCalled && getStatus() === 401 && getBody().code === 'NO_TOKEN', 'authenticate rejects missing token with 401 NO_TOKEN');
  }

  {
    const { req, res, getStatus, getBody } = mockReqRes('invalid.token.here');
    let nextCalled = false;
    authenticate(req, res, () => { nextCalled = true; });
    assert(!nextCalled && getStatus() === 401 && getBody().code === 'INVALID_TOKEN', 'authenticate rejects invalid token with 401 INVALID_TOKEN');
  }

  // Test 6: Role-Based Access Control (requireDoctor)
  {
    // Doctor user passes requireDoctor
    const { req, res } = mockReqRes(docToken);
    authenticate(req, res, () => {});
    let docAllowed = false;
    requireDoctor(req, res, () => { docAllowed = true; });
    assert(docAllowed === true, 'requireDoctor permits user with role=doctor');
  }

  {
    // PHC Worker blocked by requireDoctor with 403 Forbidden
    const { req, res, getStatus, getBody } = mockReqRes(phcToken);
    authenticate(req, res, () => {});
    let phcAllowed = false;
    requireDoctor(req, res, () => { phcAllowed = true; });
    assert(!phcAllowed && getStatus() === 403 && getBody().code === 'FORBIDDEN', 'requireDoctor blocks PHC worker with 403 FORBIDDEN');
  }

  {
    // PHC Worker passes requirePhcWorker
    const { req, res } = mockReqRes(phcToken);
    authenticate(req, res, () => {});
    let phcAllowed = false;
    requirePhcWorker(req, res, () => { phcAllowed = true; });
    assert(phcAllowed === true, 'requirePhcWorker permits user with role=phc_worker');
  }

  {
    // Doctor blocked by requirePhcWorker with 403 Forbidden
    const { req, res, getStatus, getBody } = mockReqRes(docToken);
    authenticate(req, res, () => {});
    let docAllowed = false;
    requirePhcWorker(req, res, () => { docAllowed = true; });
    assert(!docAllowed && getStatus() === 403 && getBody().code === 'FORBIDDEN', 'requirePhcWorker blocks Doctor with 403 FORBIDDEN');
  }

  // Setup sample test screening
  const testPatId = `PAT-TEST-${Date.now()}`;
  const testScId = `DRI-TEST-${Date.now()}`;
  const testPredId = `PRED-TEST-${Date.now()}`;
  sqliteInsertPatient({ id: testPatId, name: 'Test Patient', age: 50, diabetes_years: 5, gender: 'male' });
  sqliteInsertScreening({ id: testScId, patient_id: testPatId, examined_eye: 'Right eye (OD)', camera_device: 'Portable', status: 'queued', created_by: 'ASHA' });
  sqliteInsertPrediction({ id: testPredId, screening_id: testScId, grade: 2, confidence: 91.5, quality: 85, sharpness: 'Sharp', referable_dr: 1, urgency: 'Priority' });

  // Test 7: Clinical Decision Recording (Approve, Override, Refer)
  const { sqliteInsertDecision, sqliteGetScreeningDetail } = await import('./db/sqlite.js');
  
  // Doctor Approve
  const approveDec = sqliteInsertDecision({
    id: `DEC-APP-${Date.now()}`,
    screening_id: testScId,
    doctor_id: docUser.id,
    doctor_name: docUser.name,
    decision: 'approve',
    original_grade: 2,
    final_grade: 2,
    clinical_notes: 'Confirmed by doctor',
  });
  assert(approveDec && approveDec.decision === 'approve', 'Doctor can record approve decision');

  // Doctor Override (distinct AI prediction vs Doctor decision)
  const overrideDec = sqliteInsertDecision({
    id: `DEC-OVR-${Date.now()}`,
    screening_id: testScId,
    doctor_id: docUser.id,
    doctor_name: docUser.name,
    decision: 'override',
    original_grade: 2,
    final_grade: 3,
    override_reason: 'Venous beading visible in superior quadrant',
    clinical_notes: 'Upgraded to severe NPDR',
  });
  assert(overrideDec && overrideDec.final_grade === 3 && overrideDec.original_grade === 2, 'Doctor can record clinical override preserving original AI grade');

  const detail = sqliteGetScreeningDetail(testScId);
  assert(detail.prediction.grade === 2, 'AI prediction grade preserved unchanged in database');
  assert(detail.decision.final_grade === 3, 'Doctor final grade recorded with override reason');

  console.log('\n----------------------------------------------------');
  console.log(`Results: ${passed} Passed, ${failed} Failed`);
  console.log('----------------------------------------------------\n');

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Test runner failure:', err);
  process.exit(1);
});
