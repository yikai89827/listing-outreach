import { get, set, KEYS } from './storage.js';

/** Local demo / early-bird keys. Replace with Lemon Squeezy signed keys later. */
const VALID_KEYS = new Set([
  'LO-PRO-DEMO-2026',
]);

export async function isPro() {
  const lic = await get(KEYS.license, null);
  if (!lic || !lic.key) return false;
  if (lic.expiresAt && Date.now() > lic.expiresAt) return false;
  return VALID_KEYS.has(String(lic.key).trim().toUpperCase()) || !!lic.verified;
}

export async function activateLicense(raw) {
  const key = String(raw || '').trim().toUpperCase();
  if (!key) return { ok: false, error: 'Enter a license key' };
  if (!VALID_KEYS.has(key)) {
    // Soft accept LO-XXXX pattern for future LSY webhook-signed keys stored as verified
    return { ok: false, error: 'Invalid key. Use LO-PRO-DEMO-2026 for local testing.' };
  }
  await set(KEYS.license, {
    key,
    verified: true,
    activatedAt: Date.now(),
    expiresAt: null,
  });
  return { ok: true };
}

export async function clearLicense() {
  await set(KEYS.license, null);
}
