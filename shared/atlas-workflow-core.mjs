/* Read-only app projections and explicit, browser-local Courier practice records. */
export const PRACTICE_KEY = 'courier:practice:v1';
export const WORKFLOW_KEYS = ['lifemap_v1', 'mc_reps', 'hq_v1', 'qc3_log', 'operationsCadence.v1', PRACTICE_KEY];
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v, limit = 500) => typeof v === 'string' ? v.slice(0, limit) : '';
const list = v => Array.isArray(v) ? v : [];
export function localDay(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return validDay(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') : null;
}
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number), date = new Date(Date.UTC(y, m - 1, d));
  return y >= 1900 && date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}
function plusDays(day, amount) { const d = new Date(day + 'T12:00:00'); d.setDate(d.getDate() + amount); return localDay(d); }
export function parsePractice(raw) {
  if (raw === null) return { version: 1, revision: 0, completions: {} };
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > 4 * 1024 * 1024) throw Error('Practice records exceed the supported size. Export a backup before changing them.');
  let value; try { value = JSON.parse(raw); } catch { throw Error('Practice records could not be read. Restore a valid Atlas backup before continuing.'); }
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 0 || !object(value.completions) || Object.keys(value.completions).length > 10000) throw Error('Practice records have an unsupported format.');
  const completions = Object.create(null);
  for (const [id, item] of Object.entries(value.completions)) {
    if (!id.startsWith('lesson/') || id.length > 1000 || !object(item) || item.id !== id || !validDay(item.day) || !validDay(item.completedDay) || typeof item.completedAt !== 'string' || !Number.isFinite(Date.parse(item.completedAt)) || typeof item.title !== 'string' || item.title.length > 500 || typeof item.track !== 'string' || item.track.length > 120) throw Error('A practice record is invalid.');
    completions[id] = { id, day: item.day, title: item.title, track: item.track, completedAt: item.completedAt, completedDay: item.completedDay };
  }
  return { version: 1, revision: value.revision, completions };
}
export function readPractice(storage) {
  let raw; try { raw = storage.getItem(PRACTICE_KEY); } catch { throw Error('This browser cannot read practice records.'); }
  return { raw, value: parsePractice(raw) };
}
export function lessonItems(manifest) {
  const out = [], seen = new Set();
  for (const day of list(manifest?.days)) {
    if (!object(day) || !validDay(day.date)) continue;
    for (const block of list(day.blocks)) for (const [position, lesson] of list(block?.lessons).entries()) {
      if (!object(lesson) || !text(lesson.title) || !text(lesson.track)) continue;
      const id = 'lesson/' + JSON.stringify([day.date, text(block.id, 80), text(lesson.track, 80), text(lesson.sequence, 120), Number.isSafeInteger(lesson.index) ? lesson.index : position]);
      if (seen.has(id)) continue; seen.add(id);
      out.push({ id, day: day.date, title: text(lesson.title), track: text(lesson.label || lesson.track, 120), task: text(lesson.task, 3000), drill: text(lesson.drill, 3000) });
    }
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}
export function setPracticeCompletion(storage, expectedRaw, lesson, done, now = new Date()) {
  const current = readPractice(storage);
  if (current.raw !== expectedRaw) throw Error('Practice changed in another tab. Review the updated records and try again.');
  if (!object(lesson) || typeof lesson.id !== 'string' || !lesson.id.startsWith('lesson/') || !validDay(lesson.day)) throw Error('This lesson cannot be recorded.');
  const existing = current.value.completions[lesson.id];
  if (done && existing || !done && !existing) return current;
  const completions = { ...current.value.completions };
  if (done) completions[lesson.id] = { id: lesson.id, day: lesson.day, title: text(lesson.title), track: text(lesson.track, 120), completedAt: now.toISOString(), completedDay: localDay(now) };
  else delete completions[lesson.id];
  const next = { version: 1, revision: current.value.revision + 1, completions }, raw = JSON.stringify(next);
  parsePractice(raw);
  if (storage.getItem(PRACTICE_KEY) !== expectedRaw) throw Error('Practice changed in another tab. Try again.');
  try { storage.setItem(PRACTICE_KEY, raw); } catch { throw Error('Practice could not be saved. Your completion has not been confirmed.'); }
  if (storage.getItem(PRACTICE_KEY) !== raw) throw Error('Practice could not be verified. Reload to check the saved record.');
  return { raw, value: next };
}
export function prospectingSummary(current, legacy, now = new Date()) {
  const log = current === null ? list(legacy) : list(current?.log), today = localDay(now);
  const sends = log.filter(row => object(row) && ['messaged', 'followup'].includes(row.to) && localDay(row.ts) === today).length;
  const configured = Number(current?.set?.target);
  return { sends, target: Number.isFinite(configured) && configured > 0 ? Math.round(configured) : 20 };
}
export function dailySummary(storage, manifest, now = new Date()) {
  const today = localDay(now), weekStart = plusDays(today, -6), soon = plusDays(today, 7), issues = [];
  function read(key, name, fallback, rootIsArray = false) {
    try {
      const raw = storage.getItem(key); if (raw === null) return fallback;
      const value = JSON.parse(raw);
      if (!(rootIsArray ? Array.isArray(value) : object(value))) throw Error();
      return value;
    } catch { issues.push(name); return fallback; }
  }
  const map = read('lifemap_v1', 'Life Map', null), reps = read('mc_reps', 'Master Communicator', [], true);
  const current = read('hq_v1', 'Prospecting', null);
  // An existing HQ record is authoritative; never add its migrated legacy log twice.
  let hqPresent = false; try { hqPresent = storage.getItem('hq_v1') !== null; } catch { hqPresent = true; }
  const legacy = !hqPresent ? read('qc3_log', 'Legacy Prospecting', [], true) : [];
  let practice; try { practice = readPractice(storage).value; } catch { issues.push('Courier practice'); practice = parsePractice(null); }
  const projects = list(map?.projects).filter(object);
  if (map && !Array.isArray(map.projects)) issues.push('Life Map');
  const due = projects.filter(p => p.status !== 'Done' && validDay(p.due) && p.due <= soon).map(p => ({ id: text(p.id, 120), title: text(p.task) || 'Untitled project', area: text(p.area, 100), due: p.due, reason: p.due < today ? 'Overdue' : p.due === today ? 'Due today' : 'Due ' + p.due }));
  due.sort((a, b) => a.due.localeCompare(b.due) || a.title.localeCompare(b.title));
  const items = lessonItems(manifest).filter(item => item.day <= today), completed = Object.values(practice.completions);
  const pending = items.filter(item => !practice.completions[item.id]);
  // This is a projection of current source records, not an immutable audit trail.
  const groups = new Map(), inWeek = d => d && d >= weekStart && d <= today;
  function add(day, app, label, href) { if (!inWeek(day)) return; const key = day + app; const row = groups.get(key) || { day, app, label, href, count: 0 }; row.count++; groups.set(key, row); }
  const projectIds = new Set();
  for (const p of projects) {
    const d = localDay(p.doneAt) || localDay(list(map?.log).find(e => e?.t === 'proj' && e.id === p.id)?.d);
    if (p.status === 'Done' && !projectIds.has(p.id)) { projectIds.add(p.id); add(d, 'Life Map', 'projects completed', 'life-map.html'); }
  }
  for (const r of reps) if (object(r)) add(localDay(r.date), 'Master Communicator', 'practice reps', 'communication-trainer.html');
  for (const c of completed) add(c.completedDay, 'Courier', 'lessons practised', 'courier.html?day=' + encodeURIComponent(c.day));
  const activity = [...groups.values()].sort((a, b) => b.day.localeCompare(a.day) || a.app.localeCompare(b.app));
  return { today, soon, due, pending, practiceCount: completed.filter(c => inWeek(c.completedDay)).length, activity, issues: [...new Set(issues)], mapPresent: map !== null, prospecting: prospectingSummary(hqPresent ? current || {} : null, legacy, now) };
}

export function localBriefing(summary,lessonsReady=true) {
  const mapReadable=summary.mapPresent&&!summary.issues.includes('Life Map');
  const overdue=mapReadable?summary.due.filter(p=>p.due<summary.today).length:null;
  const dueToday=mapReadable?summary.due.filter(p=>p.due===summary.today).length:null;
  const deadline=mapReadable?summary.due[0]:null;
  const lesson=lessonsReady&&!summary.issues.includes('Courier practice')?summary.pending[0]:null;
  return {overdue,dueToday,next:deadline?{title:deadline.title,source:'Life Map',reason:deadline.reason,href:'life-map.html'}:
    lesson?{title:lesson.title,source:'Courier',reason:'Uncompleted practice · Edition '+lesson.day,href:'courier.html?day='+encodeURIComponent(lesson.day)+'#courier-practice'}:null};
}
