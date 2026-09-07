import { PRACTICE_KEY, WORKFLOW_KEYS, localDay, validDay, lessonItems, readPractice, setPracticeCompletion, dailySummary, localBriefing } from './atlas-workflow-core.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prettyDay = day => validDay(day) ? new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
let manifest = null, manifestState = 'loading', context = null, practiceRaw = null, signature = '', busy = false, feedback = '', problem = false;
const expanded = new Set();
function focusFeedback() { const el = document.getElementById('practice-feedback'); if (el) { el.tabIndex = -1; el.focus(); } }

function mountPractice(nextContext = context) {
  context = nextContext;
  const host = document.getElementById('courier-practice'); if (!host || !context?.day) return;
  const items = lessonItems({ days: [context.day] });
  let saved, issue = '';
  try { saved = readPractice(localStorage); } catch (error) { issue = error.message; saved = { raw: null, value: { completions: {} } }; }
  practiceRaw = saved.raw;
  const nextSignature = JSON.stringify([context.day.date, items, saved.raw, issue, busy, feedback]);
  if (signature === nextSignature && host.firstChild) return;
  signature = nextSignature;
  const completed = items.filter(item => saved.value.completions[item.id]).length;
  host.className = 'workflow practice';
  host.innerHTML = '<div class="workflow-heading"><div><span class="eyebrow">Put it into practice</span><h2>Learning you have used.</h2></div><span class="workflow-meta">' + completed + ' / ' + items.length + '</span></div>' +
    '<p>Mark a lesson after completing its task. Listening alone does not count as practice.</p>' +
    (items.length ? '<div class="practice-list">' + items.map((item, i) => {
      const done = saved.value.completions[item.id], hasTask = item.task && item.task.trim().toLowerCase() !== 'none';
      const hasDrill = item.drill && item.drill.trim().toLowerCase() !== 'none';
      return '<details data-practice-detail="' + i + '" ' + (expanded.has(item.id) ? 'open' : '') + '><summary><span><span class="workflow-meta">' + esc(item.track) + '</span><strong>' + esc(item.title) + '</strong></span><span class="practice-state">' + (done ? 'Completed' : 'To practise') + '</span></summary><div class="practice-content">' +
        (hasTask ? '<h3>Practice task</h3><p>' + esc(item.task) + '</p>' : '<p>This edition has no separate task. Explain the lesson in your own words and apply it to one example before marking it complete.</p>') +
        (hasDrill ? '<h3>Drill</h3><p>' + esc(item.drill) + '</p>' : '') +
        (done ? '<p class="workflow-meta">Completed ' + esc(prettyDay(done.completedDay)) + '</p>' : '') +
        '<button type="button" class="btn ' + (done ? 'line' : 'primary') + '" data-practice-item="' + i + '" ' + (busy || issue ? 'disabled' : '') + '>' + (done ? 'Undo completion' : 'Mark practice complete') + '</button></div></details>';
    }).join('') + '</div>' : '<p class="workflow-empty">No lessons were published in this edition.</p><div class="practice-archive">' + lessonItems(context.manifest).filter((item, i, all) => all.findIndex(x => x.day === item.day) === i).slice(0, 3).map(item => '<a href="courier.html?day=' + encodeURIComponent(item.day) + '">Practise the ' + esc(prettyDay(item.day)) + ' lessons</a>').join('') + '</div>') +
    '<p id="practice-feedback" role="' + (problem || issue ? 'alert' : 'status') + '" class="workflow-feedback ' + (problem || issue ? 'workflow-error' : '') + '">' + esc(issue || feedback) + '</p>' +
    '<p class="workflow-meta">Saved in this browser and included in <a href="index.html#atlas-vault-root">Atlas Vault backups</a>. New editions do not mark lessons complete.</p>';
  for (const details of host.querySelectorAll('[data-practice-detail]')) details.addEventListener('toggle', () => { const item = items[Number(details.dataset.practiceDetail)]; if (details.open) expanded.add(item.id); else expanded.delete(item.id); });
  for (const button of host.querySelectorAll('[data-practice-item]')) button.onclick = async () => {
    if (busy) return;
    const item = items[Number(button.dataset.practiceItem)], expected = practiceRaw, done = !saved.value.completions[item.id];
    busy = true; feedback = 'Saving…'; problem = false; mountPractice();
    try {
      const write = () => setPracticeCompletion(localStorage, expected, item, done);
      if (navigator.locks?.request) await navigator.locks.request('atlas-courier-practice', write); else write();
      feedback = done ? 'Practice saved. It now appears in your Atlas activity.' : 'Completion undone. This lesson is available to practise again.';
    } catch (error) { feedback = error.message || 'Practice could not be saved.'; problem = true; }
    finally { busy = false; signature = ''; mountPractice(); focusFeedback(); }
  };
}

function mountHome() {
  const host = document.getElementById('atlas-daily-root'); if (!host) return;
  let summary;
  try { summary = dailySummary(localStorage, manifest); } catch { host.innerHTML = '<p role="alert">This browser cannot read your daily records. Open each app to check its saved work.</p>'; return; }
  const brief=localBriefing(summary,manifestState==='ready');
  const upcoming = summary.due.slice(0, 4), recent = summary.activity.slice(0, 5), next = summary.pending[0];
  host.className = 'workflow daily-view';
  host.innerHTML = '<div class="workflow-heading"><div><span class="eyebrow">Daily preparation</span><h2>' + esc(new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })) + '</h2></div><button type="button" class="btn line" id="daily-refresh" aria-label="Refresh daily preparation">Refresh</button></div>' +
    '<div class="home-briefing"><span class="eyebrow">Today’s briefing</span><p>' + (brief.overdue===null ? 'Life Map deadlines are unavailable in this browser.' : brief.overdue ? brief.overdue + ' overdue project ' + (brief.overdue===1?'deadline needs':'deadlines need') + ' a review.' : brief.dueToday ? brief.dueToday + ' project ' + (brief.dueToday===1?'deadline is':'deadlines are') + ' due today.' : 'No open project deadlines due today or earlier.') + '</p>' +
    (brief.next?'<p><strong>'+esc(brief.next.title)+'</strong><span class="workflow-meta">'+esc(brief.next.source)+' · '+esc(brief.next.reason)+'</span></p><a class="btn line workflow-link" href="'+brief.next.href+'">Review in '+esc(brief.next.source)+'</a>':'<p class="workflow-meta">Choose a project in Life Map or open Courier for available practice.</p>') + '</div>' +
    '<div class="daily-grid"><section><div class="workflow-section-heading"><h3>Life Map deadlines</h3><a href="life-map.html">Open Life Map</a></div>' +
    (upcoming.length ? '<ul class="workflow-list">' + upcoming.map(item => '<li><span><strong>' + esc(item.title) + '</strong><span class="workflow-meta">' + esc(item.area) + '</span></span><span class="workflow-due ' + (item.due <= summary.today ? 'workflow-attention' : '') + '">' + esc(item.reason) + '</span></li>').join('') + '</ul>' + (summary.due.length > 4 ? '<p class="workflow-meta">' + (summary.due.length - 4) + ' more deadlines in Life Map.</p>' : '') : '<p class="workflow-empty">' + (summary.issues.includes('Life Map') ? 'Life Map records could not be read.' : summary.mapPresent ? 'No open deadlines through ' + esc(prettyDay(summary.soon)) + '.' : 'Open Life Map to create or restore projects in this browser.') + '</p>') +
    '</section><section><div class="workflow-section-heading"><h3>Next practice</h3><a href="courier.html">Open Courier</a></div>' +
    (manifestState === 'loading' ? '<p class="workflow-empty">Loading published lessons…</p>' : manifestState === 'failed' ? '<p class="workflow-empty">Published lessons could not be loaded. Refresh to try again.</p>' : summary.issues.includes('Courier practice') ? '<p class="workflow-empty">Practice records could not be read. Open Courier to review them.</p>' : next ? '<p class="workflow-meta">' + esc(next.track) + ' · Edition ' + esc(prettyDay(next.day)) + '</p><p><strong>' + esc(next.title) + '</strong></p><a class="btn primary workflow-link" href="courier.html?day=' + encodeURIComponent(next.day) + '#courier-practice">Review practice task</a><p class="workflow-meta">' + summary.pending.length + ' uncompleted lessons in the available editions.</p>' : '<p class="workflow-empty">' + (lessonItems(manifest).length ? 'All available lessons have a recorded practice completion.' : 'No lessons are available in the published editions yet.') + '</p>') +
    '<p class="workflow-meta">' + summary.practiceCount + ' lessons practised in the last 7 days.</p></section></div>' +
    '<details class="daily-activity"><summary>Recent activity <span class="workflow-meta">Last 7 days</span></summary>' +
    (recent.length ? '<ul class="workflow-list">' + recent.map(row => '<li><span><a href="' + row.href + '">' + esc(row.app) + '</a><span class="workflow-meta">' + row.count + ' ' + esc(row.label) + '</span></span><time datetime="' + row.day + '">' + esc(prettyDay(row.day)) + '</time></li>').join('') + '</ul>' : '<p class="workflow-empty">Completed Life Map projects, communication reps, and Courier practice will appear here.</p>') + '</details>' +
    (summary.issues.length ? '<p class="workflow-error" role="status">Some records could not be read: ' + esc(summary.issues.join(', ')) + '. Other apps remain available.</p>' : '') +
    '<p class="workflow-meta">From records saved in this browser. Changes stay in their source apps; Atlas OS commitments are in your private workspace.</p>';
  host.querySelector('#daily-refresh').disabled = manifestState === 'loading';
  host.querySelector('#daily-refresh').onclick = () => { loadManifest(true); };
}

async function loadManifest(force = false) {
  if (!document.getElementById('atlas-daily-root')) return;
  if (force) { manifestState = 'loading'; mountHome(); }
  try { const r = await fetch('courier/manifest.json', { cache: 'no-store' }); if (!r.ok) throw Error(); const data = await r.json(); if (!Array.isArray(data?.days)) throw Error(); manifest = data; manifestState = 'ready'; }
  catch { manifestState = 'failed'; }
  mountHome();
}
window.AtlasDaily = { mount: mountHome };
window.AtlasPractice = { mount: mountPractice };
mountHome(); loadManifest();
if (window.getCourierContext) mountPractice(window.getCourierContext());
window.addEventListener('storage', event => {
  if (event.key === null || WORKFLOW_KEYS.includes(event.key)) { mountHome(); signature = ''; mountPractice(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { mountHome(); signature = ''; mountPractice(); } });
let lastDay = localDay();
setInterval(() => { const today = localDay(); if (today !== lastDay) { lastDay = today; mountHome(); } }, 30000);
