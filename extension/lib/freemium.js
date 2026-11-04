import { get, set, KEYS } from './storage.js';
import { isPro } from './license.js';

export const FREE_LIMITS = {
  generatesPerMonth: 20,
  followUps: 30,
  freeTemplateIds: ['showing', 'disclosures'],
};

function monthKey(d = new Date()) {
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0');
}

export async function getUsage() {
  const usage = await get(KEYS.usage, { month: monthKey(), generates: 0 });
  if (usage.month !== monthKey()) {
    const fresh = { month: monthKey(), generates: 0 };
    await set(KEYS.usage, fresh);
    return fresh;
  }
  return usage;
}

export async function canGenerate() {
  if (await isPro()) return { ok: true, remaining: Infinity };
  const usage = await getUsage();
  const remaining = FREE_LIMITS.generatesPerMonth - usage.generates;
  return { ok: remaining > 0, remaining: Math.max(0, remaining) };
}

export async function recordGenerate() {
  if (await isPro()) return;
  const usage = await getUsage();
  usage.generates += 1;
  await set(KEYS.usage, usage);
}

export async function canSaveFollowUp(currentCount) {
  if (await isPro()) return { ok: true };
  return {
    ok: currentCount < FREE_LIMITS.followUps,
    limit: FREE_LIMITS.followUps,
  };
}

export async function canUseTemplate(templateId, isCustom) {
  if (await isPro()) return true;
  if (isCustom) return false;
  return FREE_LIMITS.freeTemplateIds.includes(templateId);
}
