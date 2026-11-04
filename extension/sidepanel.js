import { get, set, KEYS } from './lib/storage.js';
import { BUILTIN, getAllTemplates, fillTemplate, buildVars } from './lib/templates.js';
import { canGenerate, recordGenerate, canSaveFollowUp, canUseTemplate, getUsage, FREE_LIMITS } from './lib/freemium.js';
import { isPro, activateLicense, clearLicense } from './lib/license.js';

const $ = (id) => document.getElementById(id);

let listing = null;
let templates = [];

function setStatus(el, text, ok) {
  el.textContent = text || '';
  el.className = 'status' + (text ? (ok ? ' ok' : ' err') : '');
}

async function loadProfile() {
  const p = await get(KEYS.settings, {});
  $('pName').value = p.name || '';
  $('pBroker').value = p.broker || '';
  $('pPhone').value = p.phone || '';
  $('pEmail').value = p.email || '';
}

async function saveProfile() {
  await set(KEYS.settings, {
    name: $('pName').value.trim(),
    broker: $('pBroker').value.trim(),
    phone: $('pPhone').value.trim(),
    email: $('pEmail').value.trim(),
  });
  setStatus($('genStatus'), 'Profile saved.', true);
}

function renderListing() {
  const empty = $('listingEmpty');
  const body = $('listingBody');
  if (!listing || (!listing.address && !listing.price)) {
    empty.classList.remove('hidden');
    body.classList.add('hidden');
    return;
  }
  empty.classList.add('hidden');
  body.classList.remove('hidden');
  $('fAddress').textContent = listing.address || '—';
  $('fPrice').textContent = listing.price || '—';
  $('fSource').textContent = listing.source || '—';
  $('fAgent').textContent = listing.agentName || 'Unknown';
  $('fPhone').textContent = listing.agentPhone || 'no phone';
}

async function refreshListing() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id && /zillow\.com|redfin\.com/i.test(tab.url || '')) {
    const res = await chrome.runtime.sendMessage({ type: 'REQUEST_EXTRACT', tabId: tab.id });
    if (res && res.ok && res.listing) {
      listing = res.listing;
      renderListing();
      return;
    }
  }
  const cached = await chrome.runtime.sendMessage({ type: 'GET_LATEST_LISTING' });
  listing = (cached && cached.listing) || null;
  renderListing();
}

async function refreshPlanUi() {
  const pro = await isPro();
  const badge = $('planBadge');
  badge.textContent = pro ? 'Pro' : 'Free';
  badge.classList.toggle('pro', pro);
  const usage = await getUsage();
  if (pro) {
    $('usageHint').textContent = 'Unlimited';
  } else {
    const left = FREE_LIMITS.generatesPerMonth - usage.generates;
    $('usageHint').textContent = left + ' generates left this month';
  }
}

async function loadTemplates() {
  templates = await getAllTemplates();
  const sel = $('templateSelect');
  sel.innerHTML = '';
  const pro = await isPro();
  templates.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    const locked = !pro && (t.custom || !FREE_LIMITS.freeTemplateIds.includes(t.id));
    opt.textContent = (locked ? '🔒 ' : '') + t.name + (t.channel === 'email' ? ' (email)' : '');
    opt.disabled = locked;
    sel.appendChild(opt);
  });
}

async function generate() {
  const id = $('templateSelect').value;
  const tpl = templates.find((t) => t.id === id) || BUILTIN[0];
  if (!(await canUseTemplate(tpl.id, !!tpl.custom))) {
    setStatus($('genStatus'), 'Pro required for this template.', false);
    return;
  }
  const gate = await canGenerate();
  if (!gate.ok) {
    setStatus($('genStatus'), 'Free limit reached (20/mo). Activate Pro.', false);
    return;
  }
  const profile = await get(KEYS.settings, {});
  const vars = buildVars(listing || {}, profile);
  $('output').value = fillTemplate(tpl.body, vars);
  await recordGenerate();
  await refreshPlanUi();
  setStatus($('genStatus'), 'Generated. Review before sending.', true);
}

async function copyOut() {
  const text = $('output').value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus($('genStatus'), 'Copied.', true);
  } catch (e) {
    setStatus($('genStatus'), 'Copy failed — select and copy manually.', false);
  }
}

async function saveFollow() {
  const text = $('output').value.trim();
  if (!text) {
    setStatus($('genStatus'), 'Generate a message first.', false);
    return;
  }
  const list = await get(KEYS.followUps, []);
  const gate = await canSaveFollowUp(list.length);
  if (!gate.ok) {
    setStatus($('genStatus'), 'Free follow-up limit (' + gate.limit + '). Activate Pro.', false);
    return;
  }
  list.unshift({
    id: 'fu_' + Date.now(),
    at: Date.now(),
    address: (listing && listing.address) || '',
    agentName: (listing && listing.agentName) || '',
    agentPhone: (listing && listing.agentPhone) || '',
    url: (listing && listing.url) || '',
    source: (listing && listing.source) || '',
    text: text.slice(0, 2000),
  });
  await set(KEYS.followUps, list.slice(0, 500));
  await renderFollowUps();
  setStatus($('genStatus'), 'Follow-up saved locally.', true);
}

async function renderFollowUps() {
  const list = await get(KEYS.followUps, []);
  const ul = $('followList');
  ul.innerHTML = '';
  $('followEmpty').classList.toggle('hidden', list.length > 0);
  list.slice(0, 50).forEach((item) => {
    const li = document.createElement('li');
    const when = new Date(item.at).toLocaleString();
    li.innerHTML =
      '<div class="title">' +
      escapeHtml(item.address || 'Listing') +
      '</div><div class="when">' +
      escapeHtml(when) +
      (item.agentName ? ' · ' + escapeHtml(item.agentName) : '') +
      '</div>';
    ul.appendChild(li);
  });
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function exportCsv() {
  if (!(await isPro())) {
    setStatus($('genStatus'), 'CSV export is Pro.', false);
    return;
  }
  const list = await get(KEYS.followUps, []);
  const rows = [['date', 'address', 'agent', 'phone', 'source', 'url', 'message']];
  list.forEach((i) => {
    rows.push([
      new Date(i.at).toISOString(),
      i.address,
      i.agentName,
      i.agentPhone,
      i.source,
      i.url,
      String(i.text || '').replace(/\r?\n/g, ' '),
    ]);
  });
  const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'listing-outreach-followups.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function onActivate() {
  const res = await activateLicense($('licenseKey').value);
  setStatus($('licStatus'), res.ok ? 'Pro activated.' : res.error, res.ok);
  await refreshPlanUi();
  await loadTemplates();
}

async function onDeactivate() {
  await clearLicense();
  $('licenseKey').value = '';
  setStatus($('licStatus'), 'License cleared.', true);
  await refreshPlanUi();
  await loadTemplates();
}

async function init() {
  await loadProfile();
  await loadTemplates();
  await refreshPlanUi();
  await refreshListing();
  await renderFollowUps();

  $('btnSaveProfile').addEventListener('click', saveProfile);
  $('btnRefresh').addEventListener('click', refreshListing);
  $('btnGenerate').addEventListener('click', generate);
  $('btnCopy').addEventListener('click', copyOut);
  $('btnSaveFollow').addEventListener('click', saveFollow);
  $('btnExport').addEventListener('click', exportCsv);
  $('btnActivate').addEventListener('click', onActivate);
  $('btnDeactivate').addEventListener('click', onDeactivate);

  setInterval(refreshListing, 2500);
}

init().catch((e) => console.error(e));
