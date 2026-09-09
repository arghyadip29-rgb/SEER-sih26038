// P0 key check — validates VISION_API_URL + VISION_API_KEY without spending much.
// Reads server/.env (never commit it). Prints health only — the key itself is
// NEVER printed, logged, or sent anywhere except the provider.
//
//   npm run ping            # GET <base>/models — free, no credits spent
//   npm run ping -- --grade # + one full-packet grade on a synthetic image (~1 call)

import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';

const here = dirname(fileURLToPath(import.meta.url));
const SERVER_DIR = join(here, '..');

// Minimal .env loader (no dependency). process.env wins over file.
function loadEnv() {
  const f = join(SERVER_DIR, '.env');
  if (existsSync(f)) {
    for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        process.env[m[1]] = v;
      }
    }
  }
}
loadEnv();

const URL = process.env.VISION_API_URL || '';
const KEY = process.env.VISION_API_KEY || '';
const MODEL = process.env.VISION_MODEL || '(unset)';
const keyInfo = KEY ? `present (${KEY.length} chars, starts ${KEY.slice(0, 4)}…)` : 'MISSING';

if (!URL || !KEY) {
  console.log(JSON.stringify({ ok: false, key: keyInfo, model: MODEL, error: 'Set VISION_API_URL + VISION_API_KEY in server/.env (see .env.example).' }, null, 1));
  process.exit(1);
}

const base = URL.replace(/\/chat\/completions\/?$/, '');
const t0 = Date.now();
try {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  const r = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${KEY}` }, signal: ctl.signal });
  clearTimeout(t);
  const ms = Date.now() - t0;
  if (r.status === 401 || r.status === 403) {
    console.log(JSON.stringify({ ok: false, key: keyInfo, model: MODEL, latencyMs: ms, error: `rejected (${r.status}) — key invalid, expired, or wrong base URL.` }, null, 1));
    process.exit(1);
  }
  if (!r.ok) {
    console.log(JSON.stringify({ ok: false, key: keyInfo, model: MODEL, latencyMs: ms, error: `provider returned ${r.status}. Check VISION_API_URL.` }, null, 1));
    process.exit(1);
  }
  const j = await r.json();
  const ids = (j?.data || []).map((m) => m.id).filter(Boolean);
  console.log(JSON.stringify({ ok: true, key: keyInfo, model: MODEL, latencyMs: ms, modelsVisible: ids.length, sample: ids.slice(0, 8) }, null, 1));
} catch (e) {
  console.log(JSON.stringify({ ok: false, key: keyInfo, model: MODEL, error: `unreachable: ${e?.message}` }, null, 1));
  process.exit(1);
}

// Optional: one real graded call through the full packet.
if (process.argv.includes('--grade')) {
  const { buildPacket } = await import('../context/packet.js');
  const { gradeWithVision } = await import('../context/provider.js');
  // Minimal valid PNG (garbage bytes get rejected by vision decoders).
  const tiny = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const packet = buildPacket({ age: 54, years: 8, eye: 'Right eye', camera: 'Ping check', quality: 84, sharpness: 'Sharp', source: 'ping' });
  const out = await gradeWithVision({ imageBuffer: tiny, mime: 'image/png', packet });
  console.log(JSON.stringify({ gradeCall: true, provider: out.provider, degraded: out.degraded, apiError: out.apiError || null, latencyMs: out.latencyMs, grade: out.proposal.grade, confidence: out.proposal.confidence, lesions: out.proposal.lesions?.length ?? 0 }, null, 1));
  if (out.provider !== 'api') { console.log('NOTE: fell back to mock — the /models check passed but chat/completions failed. Verify VISION_MODEL + endpoint path.'); process.exit(1); }
}
