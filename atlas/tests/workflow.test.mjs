import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { PRACTICE_KEY, parsePractice, readPractice, lessonItems, setPracticeCompletion, dailySummary, localDay, validDay, prospectingSummary } from '../../shared/atlas-workflow-core.mjs';
import { createBackup, parseBackup, previewRestore, applyRestore, recover } from '../../shared/atlas-vault-core.mjs';

class Storage {
  constructor(values = {}) { this.values = new Map(Object.entries(values)); this.writes = []; }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.writes.push(k); this.values.set(k, String(v)); }
  removeItem(k) { this.writes.push(k); this.values.delete(k); }
}
const now = new Date(2026, 8, 7, 10, 30), today = '2026-09-07';
const manifest = { days: [{ date: today, blocks: [{ id: 'lessons', lessons: [{ track: 'communication', label: 'Communication', sequence: null, index: 4, title: 'A clear opening', task: 'Explain a familiar idea in one sentence.', drill: '' }] }] }] };
const lesson = lessonItems(manifest)[0];

test('publication and listening never imply practice; completing and undoing use explicit records', () => {
  const storage = new Storage({ 'courier:state': JSON.stringify({ listened: { [today]: ['lessons'] }, positions: {} }) });
  assert.equal(dailySummary(storage, manifest, now).pending.length, 1);
  const result = setPracticeCompletion(storage, null, lesson, true, now);
  assert.equal(result.value.completions[lesson.id].completedDay, today);
  assert.equal(dailySummary(storage, manifest, now).practiceCount, 1);
  assert.equal(dailySummary(storage, manifest, now).pending.length, 0);
  const duplicate = setPracticeCompletion(storage, result.raw, lesson, true, now);
  assert.equal(duplicate.raw, result.raw); assert.equal(storage.writes.length, 1);
  setPracticeCompletion(storage, result.raw, lesson, false, now);
  assert.equal(dailySummary(storage, manifest, now).pending.length, 1);
  assert.equal(dailySummary(storage, manifest, now).activity.length, 0);
  assert.deepEqual(storage.writes, [PRACTICE_KEY, PRACTICE_KEY]);
});

test('lesson identity survives manifest order and title corrections while distinguishing editions and sequences', () => {
  const copy = structuredClone(manifest);
  copy.days[0].blocks[0].lessons[0].title = 'Corrected title';
  assert.equal(lessonItems(copy)[0].id, lesson.id);
  copy.days[0].blocks[0].lessons.push({ ...copy.days[0].blocks[0].lessons[0], sequence: 'Different sequence' });
  assert.equal(new Set(lessonItems(copy).map(x => x.id)).size, 2);
  copy.days.push({ ...copy.days[0], date: '2026-09-08' });
  assert.equal(new Set(lessonItems(copy).map(x => x.id)).size, 4);
  assert.equal(lessonItems({ days: [null, { date: '2026-02-31', blocks: [] }] }).length, 0);
});

test('practice rejects stale writes, malformed records and unsupported versions without changing saved values', () => {
  const storage = new Storage();
  const first = setPracticeCompletion(storage, null, lesson, true, now);
  assert.throws(() => setPracticeCompletion(storage, null, lesson, false, now), /another tab/);
  assert.equal(storage.getItem(PRACTICE_KEY), first.raw);
  assert.throws(() => parsePractice('{"version":2,"revision":0,"completions":{}}'), /unsupported/);
  assert.throws(() => parsePractice('{"version":1,"revision":0,"completions":{"constructor":{}}}'), /invalid/);
  storage.values.set(PRACTICE_KEY, 'broken');
  assert.throws(() => setPracticeCompletion(storage, 'broken', lesson, true, now), /could not be read/);
  assert.equal(storage.getItem(PRACTICE_KEY), 'broken');
});

test('quota and silently ignored practice writes never report success', () => {
  const storage = new Storage();
  storage.setItem = () => { throw Error('Quota exceeded'); };
  assert.throws(() => setPracticeCompletion(storage, null, lesson, true, now), /could not be saved/);
  assert.equal(storage.getItem(PRACTICE_KEY), null);
  storage.setItem = () => {};
  assert.throws(() => setPracticeCompletion(storage, null, lesson, true, now), /could not be verified/);
});

test('daily preparation filters dates, keeps due parked projects visible, and projects current activity without writes', () => {
  const map = { projects: [
    { id: 'over', task: 'Overdue', due: '2026-09-06', status: 'Not started' },
    { id: 'today', task: 'Today', due: today, status: 'In progress', park: '2026-12' },
    { id: 'soon', task: 'Soon', due: '2026-09-14', status: 'Not started' },
    { id: 'later', task: 'Later', due: '2026-09-15', status: 'Not started' },
    { id: 'done', task: 'Done', due: '2026-09-02', status: 'Done', doneAt: today },
    { id: 'bad', task: 'Bad date', due: '2026-02-31', status: 'Not started' }, null
  ], log: [{ t: 'proj', id: 'done', d: today }, { t: 'proj', id: 'missing', d: today }] };
  const storage = new Storage({ lifemap_v1: JSON.stringify(map), mc_reps: JSON.stringify([{ date: today }, { date: '2026-09-08' }, { date: '2026-08-31' }, null]), 'gang-ops:data': 'private', 'babybrain.tts': 'secret' });
  const result = dailySummary(storage, manifest, now);
  assert.deepEqual(result.due.map(x => x.id), ['over', 'today', 'soon']);
  assert.equal(result.activity.find(x => x.app === 'Life Map').count, 1);
  assert.equal(result.activity.find(x => x.app === 'Master Communicator').count, 1);
  assert.equal(storage.writes.length, 0);
  assert.equal(JSON.stringify(result).includes('private'), false);
  map.projects.find(x => x?.id === 'done').status = 'In progress';
  storage.values.set('lifemap_v1', JSON.stringify(map));
  assert.equal(dailySummary(storage, manifest, now).activity.some(x => x.app === 'Life Map'), false);
});

test('unreadable sources remain visible as issues and do not suppress other apps', () => {
  const storage = new Storage({ lifemap_v1: 'broken', mc_reps: JSON.stringify([{ date: today }]), hq_v1: 'broken', qc3_log: JSON.stringify([{ to: 'messaged', ts: now.getTime() }]), [PRACTICE_KEY]: 'broken' });
  const result = dailySummary(storage, manifest, now);
  assert.deepEqual(result.issues.sort(), ['Courier practice', 'Life Map', 'Prospecting']);
  assert.equal(result.activity[0].app, 'Master Communicator');
  assert.equal(result.prospecting.sends, 0);
  assert.equal(storage.writes.length, 0);
});

test('local dates handle numeric and ISO timestamps; current Prospecting avoids duplicate migrated history', () => {
  const log = [{ to: 'messaged', ts: now.getTime() }, { to: 'followup', ts: now.toISOString() }, { to: 'replied', ts: now.getTime() }, { to: 'messaged', ts: 'bad' }];
  assert.equal(prospectingSummary({ log, set: { target: 12 } }, log, now).sends, 2);
  assert.equal(prospectingSummary(null, log, now).sends, 2);
  assert.equal(prospectingSummary({ log, set: { target: 12 } }, log, now).target, 12);
  assert.equal(localDay(today), today); assert.equal(localDay(null), null);
  assert.equal(validDay('2026-02-29'), false); assert.equal(validDay('2028-02-29'), true);
  const previous = process.env.TZ;
  try { process.env.TZ = 'America/Winnipeg'; assert.equal(localDay('2026-09-07T01:00:00Z'), '2026-09-06'); }
  finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous; }
});

test('Home uses current numeric Prospecting timestamps and Operations completion dates', () => {
  const source = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  const storage = { hq_v1: { log: [{ to: 'messaged', ts: now.getTime() }], set: { target: 9 } }, qc3_log: [{ to: 'messaged', ts: now.toISOString() }], 'operationsCadence.v1': { 'daily:0': { done: true, lastDone: today }, 'weekly:1': { done: true, lastDone: '2026-09-06' }, checks: { bad: true } } };
  const context = { J: (k,d) => storage[k] ?? d, todayISO: () => today, localStorage: { getItem: k => storage[k] === undefined ? null : JSON.stringify(storage[k]) } };
  for (const name of ['readProspect', 'readCadence']) {
    const start = source.indexOf('function ' + name + '(){'), end = source.indexOf('\n}', start) + 2;
    vm.runInNewContext(source.slice(start, end), context);
  }
  assert.equal(context.readProspect().v, '1/9');
  assert.equal(context.readCadence().v, '1');
  storage.hq_v1 = null;
  assert.equal(context.readProspect().s, 'Open to review records');
});

test('Atlas Vault includes practice, validates it, and can undo a restore of its exact prior records', async () => {
  const from = new Storage(); setPracticeCompletion(from, null, lesson, true, now);
  const backup = createBackup(from), parsed = parseBackup(backup.text), target = new Storage(), session = new Storage();
  assert.equal(backup.payload.keys, 1); assert.equal(parsed.entries[0].toolId, 'courier');
  await applyRestore(previewRestore(parsed, target), ['courier'], target, session);
  assert.equal(readPractice(target).value.completions[lesson.id].title, lesson.title);
  await recover(target, session); assert.equal(target.getItem(PRACTICE_KEY), null);
  assert.throws(() => parseBackup(JSON.stringify({ [PRACTICE_KEY]: '{"version":1,"revision":0,"completions":[]}' })), /unsupported/);
});
