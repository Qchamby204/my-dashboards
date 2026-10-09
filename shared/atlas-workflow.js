import { PRACTICE_KEY, WORKFLOW_KEYS, localDay, validDay, lessonItems, readPractice, setPracticeCompletion, dailySummary, dailyPhase, createPracticeTransfer } from './atlas-workflow-core.mjs';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const prettyDay = day => validDay(day) ? new Date(day + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
let manifest = null, manifestState = 'loading', context = null, practiceRaw = null, signature = '', busy = false, feedback = '', problem = false;
const expanded = new Set();
let practiceExpanded = window.location?.hash === '#courier-practice';
function focusFeedback() { const el = document.getElementById('practice-feedback'); if (el) { const panel = el.closest('.practice-panel'); if (panel) panel.open = true; el.tabIndex = -1; el.focus(); } }

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
  const previousPanel = host.querySelector('.practice-panel');
  if (previousPanel) practiceExpanded = previousPanel.open;
  host.className = 'workflow practice';
  host.innerHTML = '<details class="practice-panel"' + (practiceExpanded ? ' open' : '') + '><summary class="workflow-heading"><span>Put it into practice</span><span class="workflow-meta">' + completed + ' / ' + items.length + '</span></summary><div class="practice-panel-content"><h2>Learning you have used.</h2>' +
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
    '<div class="practice-transfer"><h3>Use practice across devices</h3><p>Download the available lessons and your saved completions. In the private Atlas workspace, open Practice, import this pack, then choose Use synced practice.</p><button type="button" class="btn line" id="practice-pack-export" '+(issue?'disabled':'')+'>Download practice pack</button> <a href="https://atlas-os-quinton.qchambers123018.chatgpt.site/#practice" target="_blank" rel="noopener">Open private Practice</a><p class="workflow-meta">Use the private workspace for future completions after switching. This Courier page keeps a separate browser copy.</p></div>' +
    '<p id="practice-feedback" role="' + (problem || issue ? 'alert' : 'status') + '" class="workflow-feedback ' + (problem || issue ? 'workflow-error' : '') + '">' + esc(issue || feedback) + '</p>' +
    '<p class="workflow-meta">Saved in this browser and included in <a href="index.html#atlas-vault-root">Atlas Vault backups</a>. New editions do not mark lessons complete.</p></div></details>';
  host.querySelector('#practice-pack-export').onclick=()=>{
    try{const pack=createPracticeTransfer(localStorage,context.manifest),url=URL.createObjectURL(new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='atlas-practice-pack-'+localDay()+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);feedback='Practice pack downloaded. Review it in private Atlas Practice.';problem=false;}
    catch(error){feedback=error.message;problem=true;}
    signature='';mountPractice();focusFeedback();
  };
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
    finally { busy = false; signature = ''; mountPractice(); if(done&&!problem)window.AtlasExperience?.complete(host.querySelector('[data-practice-item="'+button.dataset.practiceItem+'"]')); focusFeedback(); }
  };
}

function mountHome() {
  const host = document.getElementById('atlas-daily-root'); if (!host) return;
  let summary;
  try { summary = dailySummary(localStorage, manifest); } catch { host.innerHTML = '<p role="alert">Daily records are unavailable. Open the source apps to check your saved work.</p>'; return; }
  const evening=summary.phase==='evening', day=summary.today;
  const empty = message => '<p class="workflow-empty">'+esc(message)+'</p>';
  const list = rows => '<ul class="workflow-list">'+rows.map(r=>'<li>'+r+'</li>').join('')+'</ul>';
  const edition = manifest?.days?.filter(d=>validDay(d.date)&&d.date<=day).sort((a,b)=>b.date.localeCompare(a.date))[0];
  const courier = manifestState==='loading'?empty('Loading available editions…'):manifestState==='failed'?empty('Editions are unavailable. Open Courier to check.'):edition?'<p><strong>Edition '+esc(prettyDay(edition.date))+'</strong></p><p class="workflow-meta">'+(edition.date===day?'Today’s published edition.':'Latest available edition. New editions do not mark practice complete.')+'</p><a class="btn primary" href="courier.html?day='+encodeURIComponent(edition.date)+'#listen">Listen to the edition</a>':empty('No published edition is available yet.');
  const priorities = summary.issues.includes('Life Map')?empty('Life Map priorities could not be read.'):summary.priorities.length?list(summary.priorities.map(p=>'<strong>'+esc(p.title)+'</strong>')):empty('Choose a task in Life Map and schedule it onto today.');
  const deadlines = summary.issues.includes('Life Map')?empty('Life Map deadlines could not be read.'):summary.due.length?list(summary.due.slice(0,3).map(p=>'<span><strong>'+esc(p.title)+'</strong><small>'+esc(p.reason)+'</small></span>')):empty('No open deadlines in the next seven days.');
  const completions=summary.activity.filter(a=>a.day===day), deadline=summary.due.find(p=>p.due>=summary.tomorrow);
  const completed = completions.length?list(completions.map(a=>'<span><strong>'+a.count+' '+esc(a.label)+'</strong><small>'+esc(a.app)+'</small></span>')):empty('No saved completions today. Opening an app does not count.');
  const ledger = summary.issues.includes('Life Ledger')?empty('Ledger records could not be read. Check Life Ledger.'):summary.ledgerSaved?'<p><strong>Today’s Ledger is saved.</strong></p><a class="btn line" href="life-ledger.html#today">Review your day</a>':'<p>Your day is ready for a check-in or reflection.</p><a class="btn primary" href="life-ledger.html#today">Save today’s Ledger</a>';
  const next = summary.issues.includes('Life Map')?empty('Tomorrow’s deadlines could not be read.'):deadline?'<p><strong>'+esc(deadline.title)+'</strong></p><p class="workflow-meta">'+(deadline.due===summary.tomorrow?'Due tomorrow':'Next deadline · '+esc(prettyDay(deadline.due)))+'</p>':empty('No open deadline tomorrow or in the next seven days.');
  const cards=evening?[['Completed today',completed],['Life Ledger',ledger],['Tomorrow’s first deadline',next]]:[['The Courier',courier],['Today’s priorities',priorities],['Deadlines · next seven days',deadlines]];
  host.className='workflow daily-view';
  host.innerHTML='<div class="workflow-heading"><div><span class="eyebrow">'+(evening?'Close the day':'Prepare the day')+'</span><h2>'+esc(new Date().toLocaleDateString(undefined,{weekday:'long',month:'short',day:'numeric'}))+'</h2></div><button class="btn line" id="daily-refresh" type="button">Refresh</button></div><p class="workflow-meta">'+(evening?'The evening view begins at 18:00 in this device’s local time. It shows saved completions, today’s Ledger and the next deadline.':'The morning view shows the available edition, tasks scheduled onto today and open deadlines through the next seven days.')+' These cards read the source apps; edits stay in those apps.</p><div class="daily-grid">'+cards.map(([title,body])=>'<section><h3>'+title+'</h3>'+body+'</section>').join('')+'</div><nav class="daily-chips" aria-label="Next actions">'+(evening?'<a class="btn line" href="life-ledger.html#today">Evening check-in</a><a class="btn line" href="life-map.html#plan">Plan tomorrow</a>':'<a class="btn line" href="courier.html#listen">Morning briefing</a><a class="btn line" href="life-map.html#plan">Plan your day</a>'+ (new Date().getDay()===0?'<a class="btn line" href="the-chef.html#planner">Plan the week’s meals</a>':''))+'</nav>'+(summary.issues.length?'<p role="status" class="workflow-meta">Unavailable: '+esc(summary.issues.join(', '))+'. Open the source app to review.</p>':'');
  host.querySelector('#daily-refresh').onclick=()=>loadManifest(true);
}

async function loadManifest(force = false) {
  if (!document.getElementById('atlas-daily-root')) return;
  if (force) { manifestState = 'loading'; mountHome(); }
  try { const r = await fetch('courier/manifest.json', { cache: 'no-store' }); if (!r.ok) throw Error(); const data = await r.json(); if (!Array.isArray(data?.days)) throw Error(); manifest = data; manifestState = 'ready'; }
  catch { manifestState = 'failed'; }
  mountHome();
}
window.AtlasDaily = { mount() { mountHome(); if(manifestState==='loading') loadManifest(); } };
window.AtlasPractice = { mount: mountPractice };
window.addEventListener('hashchange', () => { if (window.location?.hash === '#courier-practice') { practiceExpanded = true; const panel = document.querySelector('#courier-practice .practice-panel'); if (panel) panel.open = true; } });
mountHome(); loadManifest();
if (window.getCourierContext) mountPractice(window.getCourierContext());
window.addEventListener('storage', event => {
  if (event.key === null || WORKFLOW_KEYS.includes(event.key)) { mountHome(); signature = ''; mountPractice(); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) { mountHome(); signature = ''; mountPractice(); } });
window.addEventListener('focus',()=>{mountHome();signature='';mountPractice();});
let lastDay = localDay(), lastPhase=dailyPhase();
setInterval(() => { const today = localDay(),phase=dailyPhase(); if (today !== lastDay || phase!==lastPhase) { lastDay = today;lastPhase=phase; mountHome(); } }, 30000);
