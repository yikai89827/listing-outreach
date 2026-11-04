import { get, set, KEYS } from './storage.js';

/**
 * Local signed keys (no server). Opaque base32 blob — no visible date/plan.
 *
 * Format: LO-XXXXX-XXXXX-XXXXX-XXXXX-XXX
 * Payload (14 bytes): ver(1) | plan(1) | expYYYYMMDD u32 BE(4) | nonce(4) | hmac[:4](4)
 */

const PLAN = { PRO: 1 };
const PLAN_NAME = { 1: 'PRO' };
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function secretBytes() {
  const enc = [
    54, 51, 41, 46, 51, 52, 61, 119, 53, 47, 46, 40, 63, 59, 57, 50, 119,
    44, 107, 119, 54, 53, 57, 59, 54,
  ];
  return new Uint8Array(enc.map((b) => b ^ 0x5a));
}

function normalize(raw) {
  return String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function b32encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

function b32decode(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  if (!clean) return null;
  const out = [];
  let bits = 0;
  let value = 0;
  for (let i = 0; i < clean.length; i++) {
    const idx = B32.indexOf(clean[i]);
    if (idx < 0) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

function groupKey(b32) {
  const parts = b32.match(/.{1,5}/g) || [];
  return 'LO-' + parts.join('-');
}

function writeU32BE(view, offset, n) {
  view[offset] = (n >>> 24) & 255;
  view[offset + 1] = (n >>> 16) & 255;
  view[offset + 2] = (n >>> 8) & 255;
  view[offset + 3] = n & 255;
}

function readU32BE(view, offset) {
  return (
    ((view[offset] << 24) >>> 0) +
    ((view[offset + 1] << 16) >>> 0) +
    ((view[offset + 2] << 8) >>> 0) +
    (view[offset + 3] >>> 0)
  );
}

async function hmacBytes(data) {
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes(),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, data);
  return new Uint8Array(sig);
}

function expToMs(expNum) {
  if (!expNum) return null;
  const s = String(expNum).padStart(8, '0');
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(4, 6));
  const d = Number(s.slice(6, 8));
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d, 23, 59, 59, 999);
}

function parseOpaque(key) {
  if (!key.startsWith('LO-')) return null;
  const body = key.slice(3);
  // Reject legacy plaintext format LO-1-PRO-...
  if (/^1-/.test(body)) return null;
  const bytes = b32decode(body);
  if (!bytes || bytes.length < 14) return null;
  return bytes.slice(0, 14);
}

export async function verifyKeyFormat(raw) {
  const key = normalize(raw);
  const bytes = parseOpaque(key);
  if (!bytes) return { ok: false, error: 'Invalid key format' };

  const ver = bytes[0];
  const planId = bytes[1];
  const expNum = readU32BE(bytes, 2);
  const payload = bytes.slice(0, 10);
  const sig = bytes.slice(10, 14);

  if (ver !== 1) return { ok: false, error: 'Unsupported key version' };
  const plan = PLAN_NAME[planId];
  if (!plan) return { ok: false, error: 'Unknown plan' };

  const full = await hmacBytes(payload);
  let okSig = true;
  for (let i = 0; i < 4; i++) {
    if (full[i] !== sig[i]) okSig = false;
  }
  if (!okSig) return { ok: false, error: 'Invalid key signature' };

  const expiresAt = expToMs(expNum);
  if (expiresAt != null && Date.now() > expiresAt) {
    return { ok: false, error: 'License expired' };
  }

  // Canonical display form
  const canonical = groupKey(b32encode(bytes));
  return { ok: true, key: canonical, plan, expiresAt, demo: false };
}

export async function isPro() {
  const lic = await get(KEYS.license, null);
  if (!lic || !lic.key) return false;
  if (lic.expiresAt && Date.now() > lic.expiresAt) return false;
  const v = await verifyKeyFormat(lic.key);
  return v.ok;
}

export async function activateLicense(raw) {
  const v = await verifyKeyFormat(raw);
  if (!v.ok) return { ok: false, error: v.error || 'Invalid key' };
  await set(KEYS.license, {
    key: v.key,
    verified: true,
    plan: v.plan,
    activatedAt: Date.now(),
    expiresAt: v.expiresAt,
  });
  return { ok: true, expiresAt: v.expiresAt };
}

export async function clearLicense() {
  await set(KEYS.license, null);
}

/** Used only by tests / tooling in-browser; prefer scripts/gen-license.mjs */
export async function mintKeyForTest({ plan = 'PRO', exp = 0, nonce } = {}) {
  const planId = PLAN[plan];
  if (!planId) throw new Error('bad plan');
  const bytes = new Uint8Array(14);
  bytes[0] = 1;
  bytes[1] = planId;
  writeU32BE(bytes, 2, exp >>> 0);
  const n = nonce || crypto.getRandomValues(new Uint8Array(4));
  bytes.set(n.slice(0, 4), 6);
  const full = await hmacBytes(bytes.slice(0, 10));
  bytes.set(full.slice(0, 4), 10);
  return groupKey(b32encode(bytes));
}
