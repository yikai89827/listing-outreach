import { get, set, KEYS } from './storage.js';
import { isPro } from './license.js';

export const FREE_LIMITS = {
  generatesPerDay: 20,
};

/** Lifetime one-shot trials for Pro-only gates. */
export const FREE_TRIALS = {
  export: 1,
};

function dayKey(d = new Date()) {
  return (
    d.getUTCFullYear() +
    '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getUTCDate()).padStart(2, '0')
  );
}

export async function getUsage() {
  const usage = await get(KEYS.usage, { day: dayKey(), generates: 0 });
  // Migrate old monthly shape → daily
  if (!usage.day || usage.day !== dayKey()) {
    const fresh = { day: dayKey(), generates: 0 };
    await set(KEYS.usage, fresh);
    return fresh;
  }
  return usage;
}

export async function getTrials() {
  return await get(KEYS.trials, {});
}

export async function trialRemaining(feature) {
  if (await isPro()) return Infinity;
  const used = (await getTrials())[feature] || 0;
  const limit = FREE_TRIALS[feature] || 0;
  return Math.max(0, limit - used);
}

export async function consumeTrial(feature) {
  if (await isPro()) return;
  const trials = await getTrials();
  trials[feature] = (trials[feature] || 0) + 1;
  await set(KEYS.trials, trials);
}

export async function canGenerate() {
  if (await isPro()) return { ok: true, remaining: Infinity };
  const usage = await getUsage();
  const remaining = FREE_LIMITS.generatesPerDay - usage.generates;
  return { ok: remaining > 0, remaining: Math.max(0, remaining) };
}

export async function recordGenerate() {
  if (await isPro()) return;
  const usage = await getUsage();
  usage.generates += 1;
  await set(KEYS.usage, usage);
}

export async function canExport() {
  if (await isPro()) return { ok: true, trial: false };
  const left = await trialRemaining('export');
  if (left > 0) return { ok: true, trial: true, remaining: left };
  return { ok: false, trial: false, remaining: 0 };
}
