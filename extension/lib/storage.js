const KEYS = {
  settings: 'lo_settings',
  followUps: 'lo_followups',
  customTemplates: 'lo_custom_templates',
  usage: 'lo_usage',
  license: 'lo_license',
};

export async function get(key, fallback) {
  const data = await chrome.storage.local.get([key]);
  return data[key] === undefined ? fallback : data[key];
}

export async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export { KEYS };
