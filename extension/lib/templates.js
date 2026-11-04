import { get, set, KEYS } from './storage.js';

export const BUILTIN = [
  {
    id: 'showing',
    name: 'Request showing',
    channel: 'sms',
    body:
      'Hi {{agentGreeting}}, this is {{myName}} with {{myBroker}}. ' +
      'I\'d like to schedule a showing for {{address}} for my client. ' +
      'What times work this week? Thanks!',
  },
  {
    id: 'disclosures',
    name: 'Request disclosures',
    channel: 'sms',
    body:
      'Hi {{agentGreeting}}, {{myName}} here ({{myBroker}}). ' +
      'Could you please send the seller disclosures / TDS package for {{address}}? ' +
      'Appreciate it — {{myPhone}}',
  },
  {
    id: 'offer',
    name: 'Offer intent',
    channel: 'sms',
    body:
      'Hi {{agentGreeting}}, {{myName}} ({{myBroker}}). ' +
      'My clients are preparing an offer on {{address}}. ' +
      'Please confirm highest and best timing / any competing offers. Thanks!',
  },
  {
    id: 'email_intro',
    name: 'Email intro',
    channel: 'email',
    body:
      'Subject: Showing request — {{address}}\n\n' +
      'Hi {{agentGreeting}},\n\n' +
      'I represent buyers interested in {{address}} (listed at {{price}}). ' +
      'Please let me know the best times for a tour this week.\n\n' +
      'Best regards,\n{{myName}}\n{{myBroker}}\n{{myPhone}}\n{{myEmail}}',
  },
];

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

export function fillTemplate(body, vars) {
  return String(body || '').replace(TOKEN_RE, (_, key) => {
    const v = vars[key];
    return v == null || v === '' ? '—' : String(v);
  });
}

export async function getAllTemplates() {
  const custom = await get(KEYS.customTemplates, []);
  return [...BUILTIN, ...custom.map((t) => ({ ...t, custom: true }))];
}

export async function saveCustomTemplate(tpl) {
  const list = await get(KEYS.customTemplates, []);
  const id = tpl.id || ('custom_' + Date.now());
  const next = {
    id,
    name: tpl.name || 'Custom',
    channel: tpl.channel || 'sms',
    body: tpl.body || '',
    custom: true,
  };
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  await set(KEYS.customTemplates, list);
  return next;
}

export async function deleteCustomTemplate(id) {
  const list = await get(KEYS.customTemplates, []);
  await set(KEYS.customTemplates, list.filter((x) => x.id !== id));
}

export function buildVars(listing, profile) {
  const agentName = (listing && listing.agentName) || '';
  const first = agentName.trim().split(/\s+/)[0] || 'there';
  return {
    address: (listing && listing.address) || '',
    price: (listing && listing.price) || '',
    agentName,
    agentGreeting: first,
    agentPhone: (listing && listing.agentPhone) || '',
    agentEmail: (listing && listing.agentEmail) || '',
    url: (listing && listing.url) || '',
    source: (listing && listing.source) || '',
    myName: (profile && profile.name) || '',
    myBroker: (profile && profile.broker) || '',
    myPhone: (profile && profile.phone) || '',
    myEmail: (profile && profile.email) || '',
    mySignature: (profile && profile.signature) || '',
  };
}
