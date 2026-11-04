#!/usr/bin/env node
/**
 * Generate opaque Pro license keys (must match extension/lib/license.js).
 *
 * Output looks like: LO-AEAAA-AAAAA-BCDEF-GHIJK-LMNO
 * (date / plan are inside the blob, not readable)
 *
 * Usage:
 *   node scripts/gen-license.mjs
 *   node scripts/gen-license.mjs --exp 2027-12-31
 *   node scripts/gen-license.mjs --count 5
 *   node scripts/gen-license.mjs --decode LO-...
 */

import { createHmac, randomBytes, createHash } from 'node:crypto';

const SECRET = Buffer.from(
  [
    54, 51, 41, 46, 51, 52, 61, 119, 53, 47, 46, 40, 63, 59, 57, 50, 119, 44,
    107, 119, 54, 53, 57, 59, 54,
  ].map((b) => b ^ 0x5a)
);

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PLAN = { PRO: 1 };
const PLAN_NAME = { 1: 'PRO' };

function parseArgs(argv) {
  const out = { exp: 0, count: 1, seed: null, decode: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--exp' && argv[i + 1]) {
      const d = String(argv[++i]).replace(/-/g, '');
      if (!/^\d{8}$/.test(d)) throw new Error('--exp must be YYYY-MM-DD or YYYYMMDD');
      out.exp = Number(d);
    } else if (a === '--count' && argv[i + 1]) {
      out.count = Math.max(1, Number(argv[++i]) || 1);
    } else if ((a === '--seed' || a === '--nonce') && argv[i + 1]) {
      out.seed = String(argv[++i]);
    } else if (a === '--decode' && argv[i + 1]) {
      out.decode = String(argv[++i]);
    } else if (a === '--help' || a === '-h') {
      out.help = true;
    }
  }
  return out;
}

function b32encode(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
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
  const clean = String(str || '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '');
  const out = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error('bad base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function groupKey(b32) {
  return 'LO-' + (b32.match(/.{1,5}/g) || []).join('-');
}

function mint(planName, expNum, seed) {
  const planId = PLAN[planName];
  if (!planId) throw new Error('unknown plan');
  const payload = Buffer.alloc(10);
  payload[0] = 1;
  payload[1] = planId;
  payload.writeUInt32BE(expNum >>> 0, 2);
  const nonce = seed
    ? createHash('sha256').update(String(seed)).digest().subarray(0, 4)
    : randomBytes(4);
  nonce.copy(payload, 6);
  const sig = createHmac('sha256', SECRET).update(payload).digest().subarray(0, 4);
  const full = Buffer.concat([payload, sig]);
  return groupKey(b32encode(full));
}

function decodeKey(raw) {
  const key = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (!key.startsWith('LO-')) throw new Error('missing LO- prefix');
  const bytes = b32decode(key.slice(3));
  if (bytes.length < 14) throw new Error('too short');
  const ver = bytes[0];
  const plan = PLAN_NAME[bytes[1]] || '?';
  const exp = bytes.readUInt32BE(2);
  const nonce = bytes.subarray(6, 10).toString('hex');
  const sig = bytes.subarray(10, 14);
  const expect = createHmac('sha256', SECRET).update(bytes.subarray(0, 10)).digest().subarray(0, 4);
  const ok = Buffer.compare(sig, expect) === 0;
  return {
    ver,
    plan,
    exp: exp === 0 ? 'never' : String(exp),
    nonce,
    validSig: ok,
  };
}

const args = parseArgs(process.argv);
if (args.help) {
  console.log(`Generate opaque Listing Outreach Pro keys.

  node scripts/gen-license.mjs
  node scripts/gen-license.mjs --exp 2027-12-31
  node scripts/gen-license.mjs --count 5
  node scripts/gen-license.mjs --seed customer@email.com
  node scripts/gen-license.mjs --decode LO-...
`);
  process.exit(0);
}

if (args.decode) {
  console.log(JSON.stringify(decodeKey(args.decode), null, 2));
  process.exit(0);
}

for (let i = 0; i < args.count; i++) {
  const seed =
    args.seed && args.count === 1 ? args.seed : args.seed ? `${args.seed}-${i}` : null;
  console.log(mint('PRO', args.exp, seed));
}
