import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBackup, parseBackup, previewRestore, applyRestore, recover, readRecovery, recoveryBackup, RECOVERY_KEY, inventory } from '../../shared/atlas-vault-core.mjs';

class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; this.reads = []; this.failSet = () => false; this.failRemove = () => false; }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(key) { this.reads.push(key); return this.values.get(key) ?? null; }
  setItem(key, value) { if (this.failSet(key, value)) throw Error('QuotaExceededError'); this.writes.push(key); this.values.set(key, String(value)); }
  removeItem(key) { if (this.failRemove(key)) throw Error('Write blocked'); this.writes.push(key); this.values.delete(key); }
}
const map = title => JSON.stringify({ projects: [{ id: 'p1', task: title }], chores: [] });
const incoming = data => JSON.stringify({ app: 'atlas', version: 2, keys: Object.keys(data).length, data });
const preview = (data, storage) => previewRestore(parseBackup(incoming(data)), storage);

test('backup covers current Atlas stores while excluding credentials and unrelated dashboards', () => {
  const store = new Storage({ hq_v1: '{"log":[]}', 'courier:state': '{"rate":1}', 'babybrain.v1': '{}', 'hourglass:v1': '{}', lifemap_v1: map('Draft'), 'atlas.appearance.v1': 'dark', 'babybrain.tts': '{"apiKey":"private"}', 'gang-ops:data': 'private dashboard', 'test-booking:data': 'booking', arbitrary: 'other app', 'herald:v1': '{"nested":{"access_token":"private"}}' });
  const result = createBackup(store);
  assert.equal(result.payload.version, 2);
  assert.equal(result.payload.keys, 6);
  assert.equal(result.excluded.length, 5);
  assert.equal(result.text.includes('private'), false);
  assert.equal(store.reads.includes('babybrain.tts'), false);
  assert.equal(store.reads.includes('gang-ops:data'), false);
  assert.equal(parseBackup(result.text).entries.length, 6);
  assert.equal(inventory(store).find(tool => tool.id === 'prospecting').count, 1);
});

test('file v1, clipboard v1, bare maps, and v2 remain readable; invalid envelopes fail closed', () => {
  const data = { lifemap_v1: map('Draft') };
  for (const value of [{ app: 'atlas', version: 1, data }, { app: 'atlas', v: 1, data }, data, { app: 'atlas', version: 2, keys: 1, data }]) assert.equal(parseBackup(JSON.stringify(value)).entries.length, 1);
  for (const value of [[], { app: 'elsewhere', version: 1, data }, { app: 'atlas', version: 3, data }, { app: 'atlas', version: 2, keys: 9, data }, { lifemap_v1: {} }, { lifemap_v1: '{"projects":"broken"}' }, { lifemap_v1: 'not-json' }, { 'atlas.appearance.v1': 'unexpected' }]) assert.throws(() => parseBackup(JSON.stringify(value)));
  assert.throws(() => parseBackup('{"__proto__":"{}"}'));
  assert.throws(() => parseBackup(incoming({ lifemap_v1: '{"projects":[],"nested":{"constructor":{}}}' })));
  assert.throws(() => parseBackup(JSON.stringify(Object.fromEntries(Array.from({ length: 257 }, (_, i) => ['other' + i, '{}'])))));
});

test('preview identifies adds, replacements, and unchanged values; selected restore preserves absent records', async () => {
  const store = new Storage({ lifemap_v1: map('Old'), 'courier:state': '{}', 'hourglass:v1': '{"keep":true}', 'gang-ops:data': 'untouched' }), session = new Storage();
  const plan = preview({ lifemap_v1: map('New'), 'courier:state': '{}', 'babybrain.v1': '{}' }, store);
  assert.deepEqual(plan.entries.map(row => row.action), ['replace', 'unchanged', 'add']);
  const result = await applyRestore(plan, ['map'], store, session);
  assert.equal(result.restored, 1);
  assert.equal(store.getItem('lifemap_v1'), map('New'));
  assert.equal(store.getItem('babybrain.v1'), null);
  assert.equal(store.getItem('hourglass:v1'), '{"keep":true}');
  assert.equal(store.getItem('gang-ops:data'), 'untouched');
  assert.equal(readRecovery(session).entries[0].before, map('Old'));
});

test('stale preview and failed recovery checkpoint perform no application writes', async () => {
  const store = new Storage({ lifemap_v1: map('Old') }), session = new Storage();
  const plan = preview({ lifemap_v1: map('New') }, store);
  store.values.set('lifemap_v1', map('Work after preview'));
  await assert.rejects(applyRestore(plan, ['map'], store, session), { code: 'STALE_PREVIEW' });
  assert.equal(store.writes.length, 0); assert.equal(session.writes.length, 0);
  const fresh = preview({ lifemap_v1: map('New') }, store);
  session.failSet = () => true;
  await assert.rejects(applyRestore(fresh, ['map'], store, session), { code: 'RECOVERY_UNAVAILABLE' });
  assert.equal(store.writes.length, 0);
});

test('a quota failure after one write rolls back every selected key and verifies original values', async () => {
  const store = new Storage({ lifemap_v1: map('Old'), 'hourglass:v1': '{"old":true}' }), session = new Storage();
  const plan = preview({ lifemap_v1: map('New'), 'hourglass:v1': '{"new":true}' }, store);
  store.failSet = (key, value) => key === 'hourglass:v1' && value.includes('new');
  await assert.rejects(applyRestore(plan, ['map', 'hourglass'], store, session), { code: 'RESTORE_ROLLED_BACK' });
  assert.equal(store.getItem('lifemap_v1'), map('Old'));
  assert.equal(store.getItem('hourglass:v1'), '{"old":true}');
  assert.equal(readRecovery(session), null);
});

test('silent failed writes are detected instead of being reported as success', async () => {
  const store = new Storage({ lifemap_v1: map('Old') }), session = new Storage();
  store.setItem = () => {};
  await assert.rejects(applyRestore(preview({ lifemap_v1: map('New') }, store), ['map'], store, session), { code: 'RESTORE_ROLLED_BACK' });
  assert.equal(store.getItem('lifemap_v1'), map('Old'));
});

test('failed rollback retains a verified recovery point that can be retried after reload', async () => {
  const store = new Storage({ lifemap_v1: map('Old'), 'hourglass:v1': '{}' }), session = new Storage();
  const plan = preview({ lifemap_v1: map('New'), 'hourglass:v1': '{"new":true}' }, store);
  store.failSet = (key, value) => key === 'hourglass:v1' || value === map('Old');
  await assert.rejects(applyRestore(plan, ['map', 'hourglass'], store, session), { code: 'RESTORE_INCOMPLETE' });
  assert.ok(readRecovery(session));
  const reloadedSession = new Storage(Object.fromEntries(session.values));
  store.failSet = () => false;
  await recover(store, reloadedSession);
  assert.equal(store.getItem('lifemap_v1'), map('Old'));
  assert.equal(store.getItem('hourglass:v1'), '{}');
  assert.equal(readRecovery(reloadedSession), null);
});

test('undo removes newly added entries and restores exact previous text, including across reload', async () => {
  const old = '{ "projects": [], "chores": [] }';
  const store = new Storage({ lifemap_v1: old }), session = new Storage();
  await applyRestore(preview({ lifemap_v1: map('New'), 'babybrain.v1': '{}' }, store), ['map', 'baby'], store, session);
  const saved = readRecovery(session), backup = recoveryBackup(saved);
  assert.equal(backup.data.lifemap_v1, old);
  assert.equal(Object.hasOwn(backup.data, 'babybrain.v1'), false);
  await recover(store, new Storage(Object.fromEntries(session.values)));
  assert.equal(store.getItem('lifemap_v1'), old);
  assert.equal(store.getItem('babybrain.v1'), null);
});

test('undo protects newer edits and keeps the recovery checkpoint until all values match', async () => {
  const store = new Storage({ lifemap_v1: map('Old') }), session = new Storage();
  await applyRestore(preview({ lifemap_v1: map('New'), 'babybrain.v1': '{}' }, store), ['map', 'baby'], store, session);
  store.values.set('lifemap_v1', map('Newer work'));
  await assert.rejects(recover(store, session), error => error.code === 'RECOVERY_INCOMPLETE' && error.conflicts.includes('lifemap_v1'));
  assert.equal(store.getItem('lifemap_v1'), map('Newer work'));
  assert.equal(store.getItem('babybrain.v1'), null);
  assert.ok(readRecovery(session));
});

test('credential-bearing current entries and forged recovery keys cannot be overwritten', async () => {
  const store = new Storage({ lifemap_v1: '{"projects":[],"apiKey":"local-only"}' }), session = new Storage();
  const plan = preview({ lifemap_v1: map('New') }, store);
  assert.equal(plan.entries.length, 0); assert.equal(plan.excluded.length, 1);
  await assert.rejects(applyRestore(plan, ['map'], store, session), { code: 'NOTHING_SELECTED' });
  session.values.set(RECOVERY_KEY, JSON.stringify({ version: 2, entries: [{ key: 'test-booking:data', before: '{}', afterHash: 'a'.repeat(64) }] }));
  assert.throws(() => readRecovery(session), { code: 'RECOVERY_INVALID' });
  assert.equal(store.writes.length, 0);
});

test('backup creation refuses a mixture of snapshots if another tab changes a record', () => {
  const store = new Storage({ lifemap_v1: map('Old') }); let reads = 0;
  store.getItem = () => ++reads === 1 ? map('Old') : map('New');
  assert.throws(() => createBackup(store), { code: 'STALE_BACKUP' });
});
