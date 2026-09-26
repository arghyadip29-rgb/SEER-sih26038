// SEER — Seed Script: creates prototype test users
// Run manually: node server/auth/seed.js
// Or auto-runs on first server start if no users exist.

import { hashPassword, dbCreateUser, dbInitAuthSchema } from './auth.js';
import { initSqlite } from '../db/sqlite.js';

const SEED_USERS = [
  {
    id: 'DOC-001',
    name: 'Dr. A. Patil',
    email: 'doctor@seer.demo',
    password: 'Doctor@123',
    role: 'doctor',
    facility: 'District Eye Hospital',
    duty_id: 'MH-DOC-042',
  },
  {
    id: 'PHC-001',
    name: 'Sunita Sharma',
    email: 'phc@seer.demo',
    password: 'PHC@123',
    role: 'phc_worker',
    facility: 'PHC Melghat Primary Health Centre',
    duty_id: 'MH-ASHA-108',
  },
  {
    id: 'DOC-002',
    name: 'Dr. A. Patil (Alt)',
    email: 'doctor@seer.phc',
    password: 'Doctor@123',
    role: 'doctor',
    facility: 'PHC Melghat District Hospital',
    duty_id: 'MH-DOC-042',
  },
  {
    id: 'PHC-002',
    name: 'Sunita Sharma (Alt)',
    email: 'phcworker@seer.phc',
    password: 'PHC@Worker123',
    role: 'phc_worker',
    facility: 'PHC Melghat',
    duty_id: 'MH-ASHA-108',
  },
];

export async function seedUsers() {
  try {
    initSqlite();
    dbInitAuthSchema();

    const { getSqliteDb } = await import('../db/sqlite.js');
    const db = getSqliteDb();

    for (const u of SEED_USERS) {
      const existing = db.prepare('SELECT id FROM auth_users WHERE email = ?').get(u.email);
      if (!existing) {
        const password_hash = await hashPassword(u.password);
        dbCreateUser({ ...u, password_hash });
        console.log(`[Auth] Seeded user: ${u.email} (${u.role})`);
      }
    }
    console.log('[Auth] Seed check complete.');
  } catch (err) {
    console.error('[Auth] Seed failed:', err);
  }
}

// Allow running directly
if (process.argv[1]?.endsWith('seed.js')) {
  seedUsers().then(() => process.exit(0));
}
