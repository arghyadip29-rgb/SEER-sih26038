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
  return db.prepare('SELECT * FROM auth_users WHERE email = ? AND is_active = 1').get(email.toLowerCase().trim());
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
      role TEXT NOT NULL CHECK(role IN ('doctor', 'phc_worker')),
      facility TEXT DEFAULT '',
      duty_id TEXT DEFAULT '',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `);
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
