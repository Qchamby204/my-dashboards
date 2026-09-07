/* Browser-local Atlas backups. No network requests and no whole-origin writes. */
export const MAX_BYTES = 20 * 1024 * 1024;
export const RECOVERY_KEY = 'atlas.vault.recovery.v2';
export const LAST_BACKUP_KEY = 'atlas:lastBackup';
export const TOOLS = [
  { id: 'ledger', name: 'Life Ledger', keys: ['lifeledger:v2', 'lifeledger:goals:v2', 'lifeledger:model:v1', 'lifeledger:metrics:v1'] },
  { id: 'forge', name: 'The Forge', keys: ['forge:sessions:v2', 'forge:live:v1', 'forge:order:v1'] },
  { id: 'prospecting', name: 'Prospecting', keys: ['hq_v1', 'qc3_stages', 'qc3_notes', 'qc3_aum', 'qc3_followups', 'qc3_cancel', 'qc3_excluded_companies', 'qc3_log', 'qc_reengage_v1', 'qc_reengage_log_v1'] },
  { id: 'operations', name: 'Operations Cadence', keys: ['operationsCadence.v1'] },
  { id: 'herald', name: 'The Herald', keys: ['herald:v1'] },
  { id: 'communicator', name: 'Master Communicator', keys: ['assessments', 'reps', 'lessonsDone', 'customTopics', 'retiredTopics', 'catsEnabled', 'city', 'prepNotes', 'refreshed', 'bankUpdated', 'grades', 'pendingGrades', 'proCatsAdded'].map(key => 'mc_' + key) },
  { id: 'map', name: 'Life Map', keys: ['lifemap_v1'] },
  { id: 'aqueduct', name: 'The Aqueduct', keys: ['aqueduct:v2'] },
  { id: 'wealth', name: 'Wealth HQ (legacy)', keys: ['climb_a', 'climb_h'] },
  { id: 'baby', name: 'Baby Brain', keys: ['babybrain.v1'] },
  { id: 'hourglass', name: 'The Hourglass', keys: ['hourglass:v1'] },
  { id: 'courier', name: 'Courier', keys: ['courier:state', 'courier:schema-version'] },
  { id: 'appearance', name: 'Appearance', keys: ['atlas.appearance.v1'] }
];
const byKey = new Map(TOOLS.flatMap(tool => tool.keys.map(key => [key, tool])));
const forbidden = new Set(['__proto__', 'constructor', 'prototype']);
const secrets = new Set(['apikey', 'apisecret', 'accesstoken', 'refreshtoken', 'authtoken', 'idtoken', 'bearertoken', 'password', 'passwd', 'secret', 'clientsecret', 'privatekey', 'authorization', 'credentials', 'credential', 'token']);
const encoder = new TextEncoder();
export const sizeOf = value => encoder.encode(value).byteLength;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export class VaultError extends Error {
  constructor(message, code = 'INVALID_BACKUP', details = {}) { super(message); this.name = 'VaultError'; this.code = code; Object.assign(this, details); }
}
function inspect(value, depth = 0, budget = { left: 200000 }) {
  if (--budget.left < 0 || depth > 64) throw new VaultError('The backup is too complex to restore.');
  if (!value || typeof value !== 'object') return false;
  let sensitive = false;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) throw new VaultError('The backup contains an unsafe property name.');
    if (secrets.has(key.toLowerCase().replace(/[^a-z0-9]/g, ''))) sensitive = true;
    if (inspect(child, depth + 1, budget)) sensitive = true;
  }
  return sensitive;
}
function checkValue(key, raw) {
  if (typeof raw !== 'string') throw new VaultError('Every stored entry must be text. Invalid entry: ' + key);
  if (sizeOf(raw) > MAX_BYTES) throw new VaultError('An entry exceeds the 20 MB limit.');
  if (key === 'atlas.appearance.v1') {
    if (!['light', 'dark', 'system'].includes(raw)) throw new VaultError('The appearance preference is invalid.');
    return false;
  }
  let value;
  try { value = JSON.parse(raw); } catch { throw new VaultError('Stored data is not valid JSON: ' + key); }
  const scalar = {
    mc_city: v => typeof v === 'string', mc_bankUpdated: v => v === null || typeof v === 'string',
    mc_proCatsAdded: v => typeof v === 'boolean', 'courier:schema-version': v => Number.isInteger(v) && v >= 0
  };
  if (scalar[key]) {
    if (!scalar[key](value)) throw new VaultError('The stored value has the wrong format: ' + key);
  } else if (value === null && key === 'forge:live:v1') {
    return false;
  } else if (!value || typeof value !== 'object') throw new VaultError('The stored value has the wrong format: ' + key);
  // Preserve existing schemas, but reject broken list fields that their apps iterate.
  const lists = { lifemap_v1: ['projects', 'chores'], 'courier:state': [], 'herald:v1': ['videos', 'leads'], hq_v1: ['log'] };
  if (lists[key]) {
    if (!record(value)) throw new VaultError('An app record must be an object: ' + key);
    for (const field of lists[key]) if (field in value && !Array.isArray(value[field])) throw new VaultError('Invalid ' + field + ' list in ' + key);
  }
  return inspect(value);
}
function get(storage, key) {
  try { return storage.getItem(key); } catch { throw new VaultError('This browser cannot read its saved data.', 'STORAGE_UNAVAILABLE'); }
}
function enumerate(storage) {
  try { return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean); }
  catch { throw new VaultError('This browser cannot list its saved data.', 'STORAGE_UNAVAILABLE'); }
}
export function inventory(storage) {
  return TOOLS.map(tool => {
    const present = tool.keys.map(key => get(storage, key)).filter(value => value !== null);
    return { ...tool, count: present.length, bytes: present.reduce((sum, raw) => sum + sizeOf(raw), 0) };
  });
}
export function createBackup(storage, now = new Date().toISOString()) {
  const data = Object.create(null), excluded = [], captured = new Map();
  for (const key of enumerate(storage).sort()) {
    if (!byKey.has(key)) { if (key !== LAST_BACKUP_KEY && key !== '__t') excluded.push({ key, reason: 'Outside the Atlas backup scope' }); continue; }
    const raw = get(storage, key);
    if (raw === null) continue;
    captured.set(key, raw);
    if (checkValue(key, raw)) { excluded.push({ key, reason: 'Contains credential fields' }); continue; }
    data[key] = raw;
  }
  const latest = enumerate(storage).filter(key => byKey.has(key));
  if (latest.length !== captured.size || latest.some(key => get(storage, key) !== captured.get(key))) throw new VaultError('App data changed while preparing the backup. Close other Atlas tabs and try again.', 'STALE_BACKUP');
  const payload = { app: 'atlas', version: 2, exportedAt: now, keys: Object.keys(data).length, data };
  const text = JSON.stringify(payload);
  if (sizeOf(text) > MAX_BYTES) throw new VaultError('The backup exceeds the 20 MB limit.');
  return { payload, text, excluded };
}
export function parseBackup(raw) {
  if (typeof raw !== 'string' || sizeOf(raw) > MAX_BYTES) throw new VaultError('Choose a text backup smaller than 20 MB.');
  let input;
  try { input = JSON.parse(raw); } catch { throw new VaultError('That file is not valid JSON.'); }
  if (!record(input)) throw new VaultError('That file is not an Atlas backup.');
  let data, version = 0, exportedAt = null;
  if (Object.hasOwn(input, 'data')) {
    if (input.app !== 'atlas') throw new VaultError('This backup belongs to another application.');
    version = input.version ?? input.v;
    if (![1, 2].includes(version)) throw new VaultError('This Atlas backup version is not supported.');
    data = input.data; exportedAt = input.exportedAt ?? input.at ?? null;
  } else data = input; // Original bare key/value backups remain importable.
  if (!record(data)) throw new VaultError('The backup data must be a key/value object.');
  const keys = Object.keys(data);
  if (!keys.length || keys.length > 256) throw new VaultError('The backup must contain between 1 and 256 entries.');
  if (version === 2 && input.keys !== keys.length) throw new VaultError('The backup entry count does not match its contents.');
  const entries = [], excluded = [];
  for (const key of keys) {
    if (key.length > 200 || forbidden.has(key)) throw new VaultError('The backup contains an invalid storage key.');
    const tool = byKey.get(key);
    if (!tool) { excluded.push({ key, reason: 'Outside the Atlas backup scope' }); continue; }
    if (checkValue(key, data[key])) { excluded.push({ key, reason: 'Contains credential fields' }); continue; }
    entries.push({ key, value: data[key], toolId: tool.id, name: tool.name });
  }
  if (!entries.length) throw new VaultError('No supported Atlas records were found. Credentials and non-Atlas data are excluded.');
  return { entries, excluded, version, exportedAt: typeof exportedAt === 'string' ? exportedAt : null };
}
export function previewRestore(parsed, storage) {
  const excluded = [...parsed.excluded], entries = [];
  for (const entry of parsed.entries) {
    const before = get(storage, entry.key);
    if (before !== null && checkValue(entry.key, before)) { excluded.push({ key: entry.key, reason: 'Current entry contains credential fields' }); continue; }
    entries.push({ ...entry, before, action: before === entry.value ? 'unchanged' : before === null ? 'add' : 'replace' });
  }
  return { entries, excluded, exportedAt: parsed.exportedAt, version: parsed.version };
}
async function digest(value) {
  const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
function saveJournal(session, journal) {
  const raw = JSON.stringify(journal);
  try { session.setItem(RECOVERY_KEY, raw); if (session.getItem(RECOVERY_KEY) !== raw) throw Error(); }
  catch { throw new VaultError('Recovery space is unavailable. No app data was changed. Download a backup before freeing browser storage, or restore in another browser.', 'RECOVERY_UNAVAILABLE'); }
}
export function readRecovery(session) {
  let raw;
  try { raw = session.getItem(RECOVERY_KEY); } catch { return null; }
  if (!raw) return null;
  if (sizeOf(raw) > MAX_BYTES) throw new VaultError('The recovery record exceeds the supported size.', 'RECOVERY_INVALID');
  let journal;
  try { journal = JSON.parse(raw); } catch { throw new VaultError('The recovery record could not be read.', 'RECOVERY_INVALID'); }
  if (!record(journal) || journal.version !== 2 || !Array.isArray(journal.entries) || !journal.entries.length || journal.entries.length > 256) throw new VaultError('The recovery record is invalid.', 'RECOVERY_INVALID');
  const seen = new Set();
  for (const entry of journal.entries) {
    if (!record(entry) || !byKey.has(entry.key) || seen.has(entry.key) || !/^[a-f0-9]{64}$/.test(entry.afterHash)) throw new VaultError('The recovery record is invalid.', 'RECOVERY_INVALID');
    seen.add(entry.key);
    if (entry.before !== null && (typeof entry.before !== 'string' || checkValue(entry.key, entry.before))) throw new VaultError('The recovery record contains unsupported data.', 'RECOVERY_INVALID');
  }
  return journal;
}
export function recoveryBackup(journal) {
  const data = Object.create(null);
  for (const entry of journal.entries) if (entry.before !== null) data[entry.key] = entry.before;
  return { app: 'atlas', version: 2, exportedAt: journal.createdAt, keys: Object.keys(data).length, data };
}
function writeValue(storage, key, value) { if (value === null) storage.removeItem(key); else storage.setItem(key, value); }
export async function recover(storage, session, journal = readRecovery(session)) {
  if (!journal) throw new VaultError('There is no restore to undo in this tab.', 'NO_RECOVERY');
  const conflicts = [], failures = [];
  for (const entry of [...journal.entries].reverse()) {
    const current = get(storage, entry.key);
    if (current === entry.before) continue;
    if (current === null || await digest(current) !== entry.afterHash || get(storage, entry.key) !== current) { conflicts.push(entry.key); continue; }
    try { writeValue(storage, entry.key, entry.before); } catch { failures.push(entry.key); }
  }
  const remaining = journal.entries.filter(entry => get(storage, entry.key) !== entry.before).map(entry => entry.key);
  if (remaining.length) throw new VaultError('Recovery is incomplete. Changed records were protected. Keep this tab open and download the recovery file.', 'RECOVERY_INCOMPLETE', { conflicts, failures, remaining });
  try { session.removeItem(RECOVERY_KEY); } catch { /* An already-recovered journal is safe to retry. */ }
  return { restored: journal.entries.length };
}
export async function applyRestore(preview, selectedToolIds, storage, session) {
  const selected = new Set(selectedToolIds);
  const entries = preview.entries.filter(entry => selected.has(entry.toolId) && entry.action !== 'unchanged');
  if (!entries.length) throw new VaultError('Select at least one app with changes.', 'NOTHING_SELECTED');
  // Validate again at the write boundary; preview objects are not a source of authority.
  for (const entry of entries) {
    if (!byKey.has(entry.key) || byKey.get(entry.key).id !== entry.toolId || checkValue(entry.key, entry.value)) throw new VaultError('The restore selection is invalid.');
    if (entry.before !== null && checkValue(entry.key, entry.before)) throw new VaultError('Current credential-bearing settings cannot be replaced.');
    if (get(storage, entry.key) !== entry.before) throw new VaultError('App data changed after the preview. Review the backup again before restoring.', 'STALE_PREVIEW');
  }
  const journal = { version: 2, createdAt: new Date().toISOString(), entries: await Promise.all(entries.map(async entry => ({ key: entry.key, before: entry.before, afterHash: await digest(entry.value) }))) };
  for (const entry of entries) if (get(storage, entry.key) !== entry.before) throw new VaultError('App data changed after the preview. Review the backup again before restoring.', 'STALE_PREVIEW');
  saveJournal(session, journal); // A verified recovery point must exist before the first app write.
  try {
    for (const entry of entries) {
      if (get(storage, entry.key) !== entry.before) throw Error('Concurrent edit');
      writeValue(storage, entry.key, entry.value);
      if (get(storage, entry.key) !== entry.value) throw Error('Write did not persist');
    }
    for (const entry of entries) if (get(storage, entry.key) !== entry.value) throw Error('Verification failed');
  } catch {
    try { await recover(storage, session, journal); }
    catch (error) { throw new VaultError('Restore failed and recovery needs attention. Keep this tab open; your recovery record is retained.', 'RESTORE_INCOMPLETE', { remaining: error.remaining || [] }); }
    throw new VaultError('Restore failed. The original data was restored and verified.', 'RESTORE_ROLLED_BACK');
  }
  return { restored: entries.length, apps: new Set(entries.map(entry => entry.toolId)).size };
}
