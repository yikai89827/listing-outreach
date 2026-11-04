import { get, set, KEYS } from './lib/storage.js';
import { BUILTIN, getAllTemplates, fillTemplate, buildVars } from './lib/templates.js';
import {
  canGenerate,
  recordGenerate,
  canExport,
  consumeTrial,
  getUsage,
  trialRemaining,
  FREE_LIMITS,
} from './lib/freemium.js';
import { isPro, activateLicense, clearLicense } from './lib/license.js';
import { buildXlsx } from './lib/xlsx.js';
import { openCheckout, PRICING, isCheckoutConfigured } from './lib/commerce.js';

const $ = (id) => document.getElementById(id);

let listing = null;
let templates = [];
/** 'collapsed' | 'view' | 'edit' */
let profileMode = 'edit';

function setStatus(el, text, ok) {
  el.textContent = text || '';
  el.className = 'status' + (text ? (ok ? ' ok' : ' err') : '');
}

function profileHasData(p) {
  return !!(p && (p.name || p.broker || p.phone || p.email));
}

function readProfileForm() {
  return {
    name: $('pName').value.trim(),
    broker: $('pBroker').value.trim(),
    phone: $('pPhone').value.trim(),
    email: $('pEmail').value.trim(),
  };
}

function fillProfileForm(p) {
  $('pName').value = (p && p.name) || '';
  $('pBroker').value = (p && p.broker) || '';
  $('pPhone').value = (p && p.phone) || '';
  $('pEmail').value = (p && p.email) || '';
}

function renderProfileSummary(p) {
  const parts = [];
  if (p.name) parts.push(p.name);
  if (p.broker) parts.push(p.broker);
  if (p.phone) parts.push(p.phone);
  if (p.email) parts.push(p.email);
  const el = $('profileSummary');
  if (parts.length) {
    el.textContent = parts.join(' · ');
    el.classList.remove('hidden');
  } else {
    el.textContent = '';
    el.classList.add('hidden');
  }
}

function setProfileMode(mode) {
  profileMode = mode;
  const form = $('profileForm');
  const summary = $('profileSummary');
  const saveBtn = $('btnSaveProfile');
  const inputs = form.querySelectorAll('input');

  if (mode === 'collapsed') {
    form.classList.add('hidden');
    form.classList.remove('readonly');
    summary.classList.toggle('hidden', !summary.textContent);
    inputs.forEach((el) => {
      el.disabled = false;
      el.readOnly = false;
    });
    saveBtn.classList.add('hidden');
    return;
  }

  form.classList.remove('hidden');
  summary.classList.add('hidden');
  const readonly = mode === 'view';
  form.classList.toggle('readonly', readonly);
  inputs.forEach((el) => {
    el.disabled = false;
    el.readOnly = readonly;
  });
  saveBtn.classList.toggle('hidden', readonly);
}

async function loadProfile() {
  const p = await get(KEYS.settings, {});
  fillProfileForm(p);
  renderProfileSummary(p);
  setProfileMode(profileHasData(p) ? 'collapsed' : 'edit');
}

async function saveProfile() {
  const p = readProfileForm();
  await set(KEYS.settings, p);
  renderProfileSummary(p);
  setProfileMode('collapsed');
  setStatus($('genStatus'), 'Profile saved.', true);
}

async function openProfileView() {
  const p = await get(KEYS.settings, {});
  fillProfileForm(p);
  setProfileMode('view');
}

async function openProfileEdit() {
  const p = await get(KEYS.settings, {});
  fillProfileForm(p);
  setProfileMode('edit');
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

function closePlanMenu() {
  $('planMenu').classList.add('hidden');
  $('planBadge').setAttribute('aria-expanded', 'false');
}

function closeExportMenu() {
  $('exportMenu').classList.add('hidden');
}

async function refreshPlanUi() {
  const pro = await isPro();
  const badge = $('planBadge');
  badge.textContent = pro ? 'Pro' : 'Free';
  badge.classList.toggle('pro', pro);
  badge.setAttribute('aria-haspopup', pro ? 'menu' : 'false');
  $('licenseCard').classList.toggle('hidden', pro);
  if (!pro) closePlanMenu();

  const usage = await getUsage();
  if (pro) {
    $('usageHint').textContent = 'Unlimited';
  } else {
    const left = FREE_LIMITS.generatesPerDay - usage.generates;
    const exportLeft = await trialRemaining('export');
    const bits = [left + '/' + FREE_LIMITS.generatesPerDay + ' generates today'];
    if (exportLeft > 0) bits.push('1 export trial left');
    else bits.push('export locked');
    $('usageHint').textContent = bits.join(' · ');
  }
}

async function loadTemplates() {
  templates = await getAllTemplates();
  const sel = $('templateSelect');
  const prev = sel.value;
  sel.innerHTML = '';
  templates.forEach((t) => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name + (t.channel === 'email' ? ' (email)' : '');
    sel.appendChild(opt);
  });
  if (prev && [...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

async function generate() {
  const id = $('templateSelect').value;
  const tpl = templates.find((t) => t.id === id) || BUILTIN[0];
  const gate = await canGenerate();
  if (!gate.ok) {
    setStatus(
      $('genStatus'),
      'Daily free limit reached (' + FREE_LIMITS.generatesPerDay + '/day). Activate Pro.',
      false
    );
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

async function deleteFollowUp(id) {
  const list = await get(KEYS.followUps, []);
  await set(
    KEYS.followUps,
    list.filter((item) => item.id !== id)
  );
  await renderFollowUps();
  setStatus($('genStatus'), 'Follow-up deleted.', true);
}

async function renderFollowUps() {
  const list = await get(KEYS.followUps, []);
  const ul = $('followList');
  ul.innerHTML = '';
  $('followEmpty').classList.toggle('hidden', list.length > 0);
  list.slice(0, 50).forEach((item) => {
    const li = document.createElement('li');
    const when = new Date(item.at).toLocaleString();
    const meta = [when];
    if (item.agentName) meta.push(item.agentName);
    if (item.agentPhone) meta.push(item.agentPhone);
    li.innerHTML =
      '<div class="fu-main">' +
      '<div class="title">' +
      escapeHtml(item.address || 'Listing') +
      '</div><div class="when">' +
      escapeHtml(meta.join(' · ')) +
      '</div></div>' +
      '<button type="button" class="fu-del" title="Delete" aria-label="Delete follow-up">×</button>';
    const btn = li.querySelector('.fu-del');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!item.id) return;
      deleteFollowUp(item.id);
    });
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

function followUpRows(list) {
  const rows = [['date', 'address', 'agent', 'phone', 'source', 'url', 'message']];
  list.forEach((i) => {
    rows.push([
      new Date(i.at).toISOString(),
      i.address || '',
      i.agentName || '',
      i.agentPhone || '',
      i.source || '',
      i.url || '',
      String(i.text || '').replace(/\r?\n/g, ' '),
    ]);
  });
  return rows;
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportFollowUps(format) {
  closeExportMenu();
  const gate = await canExport();
  if (!gate.ok) {
    setStatus($('genStatus'), 'Export trial used. Activate Pro to export again.', false);
    return;
  }
  const list = await get(KEYS.followUps, []);
  const rows = followUpRows(list);
  if (format === 'xlsx') {
    downloadBlob(buildXlsx(rows), 'listing-outreach-followups.xlsx');
  } else {
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'listing-outreach-followups.csv');
  }
  if (gate.trial) {
    await consumeTrial('export');
    setStatus($('genStatus'), 'Exported (free trial used). Activate Pro for more exports.', true);
    await refreshPlanUi();
  } else {
    setStatus($('genStatus'), format === 'xlsx' ? 'Excel exported.' : 'CSV exported.', true);
  }
}

async function onActivate() {
  const res = await activateLicense($('licenseKey').value);
  setStatus($('licStatus'), res.ok ? 'Pro activated.' : res.error, res.ok);
  if (res.ok) $('licenseKey').value = '';
  await refreshPlanUi();
  await loadTemplates();
}

async function onBuyPro() {
  const res = await openCheckout();
  if (!res.ok) {
    setStatus($('licStatus'), res.error, false);
    return;
  }
  setStatus($('licStatus'), 'Checkout opened. After payment, paste your key here.', true);
}

function refreshLicenseCopy() {
  const price = PRICING.priceLabel || 'Pro';
  const bill = PRICING.billingLabel || '';
  $('licenseBlurb').textContent =
    'Free: 20 generates/day · 1 export trial. Pro (' +
    price +
    (bill ? ' ' + bill : '') +
    '): unlimited generates & exports.';
  $('btnBuyPro').textContent = isCheckoutConfigured()
    ? 'Buy Pro — ' + price
    : 'Buy Pro';
}

async function onClearLicense() {
  await clearLicense();
  closePlanMenu();
  setStatus($('licStatus'), 'License cleared.', true);
  await refreshPlanUi();
  await loadTemplates();
}

function onBadgeClick(e) {
  e.stopPropagation();
  if (!$('planBadge').classList.contains('pro')) return;
  closeExportMenu();
  const menu = $('planMenu');
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
  $('planBadge').setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function onExportClick(e) {
  e.stopPropagation();
  closePlanMenu();
  const menu = $('exportMenu');
  const willOpen = menu.classList.contains('hidden');
  menu.classList.toggle('hidden', !willOpen);
}

async function init() {
  await loadProfile();
  await loadTemplates();
  await refreshPlanUi();
  await refreshListing();
  await renderFollowUps();

  $('btnSaveProfile').addEventListener('click', saveProfile);
  $('btnViewProfile').addEventListener('click', openProfileView);
  $('btnEditProfile').addEventListener('click', openProfileEdit);
  $('btnRefresh').addEventListener('click', refreshListing);
  $('btnGenerate').addEventListener('click', generate);
  $('btnCopy').addEventListener('click', copyOut);
  $('btnSaveFollow').addEventListener('click', saveFollow);
  $('btnExport').addEventListener('click', onExportClick);
  $('btnExportCsv').addEventListener('click', () => exportFollowUps('csv'));
  $('btnExportXlsx').addEventListener('click', () => exportFollowUps('xlsx'));
  $('btnActivate').addEventListener('click', onActivate);
  $('btnBuyPro').addEventListener('click', onBuyPro);
  $('btnClearLicense').addEventListener('click', onClearLicense);
  refreshLicenseCopy();
  $('planBadge').addEventListener('click', onBadgeClick);
  document.addEventListener('click', (e) => {
    if (!$('planWrap').contains(e.target)) closePlanMenu();
    if (!$('exportWrap').contains(e.target)) closeExportMenu();
  });

  setInterval(refreshListing, 2500);
}

init().catch((e) => console.error(e));
