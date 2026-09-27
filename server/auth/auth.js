// SEER — Authentication & Authorization Module
// JWT-based RBAC for Doctor and PHC Worker roles

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getSqliteDb } from '../db/sqlite.js';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SECRET_KEY || 'seer-jwt-secret-change-in-production';
const JWT_EXPIRES_IN = '12h';
const SALT_ROUNDS = 10;

// ──────────────────────────────────────────────
// Password utilities
// ──────────────────────────────────────────────

export async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, SALT_ROUNDS);
}

export async function verifyPassword(plaintext, hash) {
  return bcrypt.compare(plaintext, hash);
}

// ──────────────────────────────────────────────
// JWT utilities
// ──────────────────────────────────────────────

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// User DB helpers (uses existing SQLite)
// ──────────────────────────────────────────────

export function dbGetUserByEmail(email) {
  const db = getSqliteDb();
  return db.prepare('SELECT * FROM auth_users WHERE email = ? AND is_active = 1').get(String(email || '').toLowerCase().trim());
}

// Patient login uses display name (no email). Case-insensitive lookup.
export function dbGetUserByName(name) {
  const db = getSqliteDb();
  return db.prepare('SELECT * FROM auth_users WHERE lower(name) = lower(?) AND is_active = 1').get(String(name || '').trim());
}

export function dbGetUserById(id) {
  const db = getSqliteDb();
  return db.prepare('SELECT * FROM auth_users WHERE id = ?').get(id);
}

export function dbCreateUser({ id, name, email, password_hash, role, facility = '', duty_id = '' }) {
  const db = getSqliteDb();
  db.prepare(`
    INSERT OR REPLACE INTO auth_users (id, name, email, password_hash, role, facility, duty_id, is_active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `).run(id, name, email.toLowerCase().trim(), password_hash, role, facility, duty_id, Date.now());
}

export function dbInitAuthSchema() {
  const db = getSqliteDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('doctor', 'phc_worker', 'patient')),
      facility TEXT DEFAULT '',
      duty_id TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);
  // Migrate DBs created before the 'patient' role existed (old CHECK rejects it).
  try {
    const sql = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'auth_users'`).get()?.sql || '';
    if (sql && !sql.includes(`'patient'`)) {
      db.exec('PRAGMA foreign_keys=OFF');
      db.exec(`
        CREATE TABLE IF NOT EXISTS auth_users_new (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK(role IN ('doctor', 'phc_worker', 'patient')),
          facility TEXT DEFAULT '',
          duty_id TEXT DEFAULT '',
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at INTEGER NOT NULL
        );
        INSERT OR IGNORE INTO auth_users_new (id, name, email, password_hash, role, facility, duty_id, is_active, created_at)
          SELECT id, name, email, password_hash, role, facility, duty_id, is_active, created_at FROM auth_users;
        DROP TABLE auth_users;
        ALTER TABLE auth_users_new RENAME TO auth_users;
      `);
      db.exec('PRAGMA foreign_keys=ON');
      console.log('[Auth] Migrated auth_users role CHECK to include patient.');
    }
  } catch (err) {
    console.error('[Auth] Role migration failed:', err?.message || err);
  }
}

// ──────────────────────────────────────────────
// Input sanitization (backend is authoritative —
// frontend mirrors these rules for fast feedback)
// ──────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[A-Za-z][A-Za-z .'\-]{0,58}[A-Za-z.'\-]$/;
// Doctor access codes live ONLY on the backend. Never send this list to the client.
const DOCTOR_ACCESS_CODES = new Set(['100', '101', '102', '103']);

// Strip HTML tags, trim, collapse whitespace, enforce max length.
export function sanitizeText(value, max = 200) {
  let s = String(value ?? '');
  s = s.replace(/<[^>]*>/g, '');
  s = s.replace(/[\u0000-\u001f\u007f]/g, '');
  s = s.trim().replace(/\s+/g, ' ');
  return s.slice(0, max);
}

export function sanitizeName(value) {
  return sanitizeText(value, 60);
}

export function sanitizeEmail(value) {
  return String(value ?? '').trim().toLowerCase().slice(0, 254);
}

export function isValidName(name) {
  return typeof name === 'string' && name.length >= 2 && name.length <= 60 && NAME_RE.test(name);
}

export function isValidEmail(email) {
  return typeof email === 'string' && email.length >= 5 && email.length <= 254 && EMAIL_RE.test(email);
}

export function isValidPassword(password, min = 8) {
  if (typeof password !== 'string') return false;
  const p = password.trim();
  return p.length >= min && p.length <= 128;
}

export function isValidDoctorPassword(password) {
  if (!isValidPassword(password, 8)) return false;
  const p = password.trim();
  return /[A-Za-z]/.test(p) && /[0-9]/.test(p);
}

export function verifyDoctorAccessCode(code) {
  return DOCTOR_ACCESS_CODES.has(String(code ?? '').trim());
}

// ──────────────────────────────────────────────
// Express middleware: authenticate
// Extracts and validates Bearer JWT from Authorization header.
// Sets req.user = { id, name, email, role } on success.
// Returns 401 if token is missing or invalid.
// ──────────────────────────────────────────────

export function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.', code: 'NO_TOKEN' });
  }
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token is invalid or expired. Please sign in again.', code: 'INVALID_TOKEN' });
  }
  const user = dbGetUserById(payload.sub);
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Account not found or inactive.', code: 'INACTIVE_ACCOUNT' });
  }
  req.user = { id: user.id, name: user.name, email: user.email, role: user.role, facility: user.facility };
  next();
}

// ──────────────────────────────────────────────
// RBAC: require specific role(s)
// Usage: requireRole('doctor') or requireRole(['doctor', 'phc_worker'])
// Must be used AFTER authenticate middleware.
// Returns 403 if role does not match.
// ──────────────────────────────────────────────

export function requireRole(...roles) {
  const allowed = roles.flat();
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.', code: 'NO_TOKEN' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({
        error: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
        required_role: allowed.join(' or '),
        your_role: req.user.role,
      });
    }
    next();
  };
}

// Convenience wrappers
export const requireDoctor = requireRole('doctor');
export const requirePhcWorker = requireRole('phc_worker');
export const requireAnyRole = requireRole('doctor', 'phc_worker');
