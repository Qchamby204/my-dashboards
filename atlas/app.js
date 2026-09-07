import { createBudgetUI } from './budget-ui.mjs';
import { createCommitmentsUI } from './commitments-ui.mjs';
import { createAgendaUI } from './agenda-ui.mjs';
import { createSearchUI } from './search-ui.mjs';
import { createHeraldUI } from './herald-ui.mjs';
import { createCommunicationUI } from './communication-ui.mjs';
import { createReflectionUI } from './reflection-ui.mjs';
import { createEditionRefreshUI } from './edition-refresh-ui.mjs';
import { createLedgerUI } from './ledger-ui.mjs';
import { APPS, LEGACY_ORIGIN, localDay, monday, addDays, parseLifeMap, parsePracticeSnapshot, parsePracticeTransfer, weeklySummary, dailyBriefing, newId } from './model.mjs';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const appById=id=>APPS.find(a=>a.id===id)||APPS[0];
const appURL=id=>id==='life-map'?'#projects':id==='life-ledger'?'#ledger':id==='communication-trainer'?'#communication':id==='the-herald'?'#herald':LEGACY_ORIGIN+appById(id).file;
const formatDay=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
const duration=m=>m<60?`${m} min`:`${Number((m/60).toFixed(1))}h`;
let today=localDay(), week=monday(today), data={tasks:[],projects:[],week:null};
let loadedAt=null,loadedWeek=null;
let loaded=false,view='today',editing=null,draftId=null,imports=[],undoAction=null,busy=false,reviewDirty=false,loadNumber=0;
let historyData=null,historyRequest=0,restorePlan=null,restoreRequest=0,recoveryAction=null;
let practiceFileRequest=0,practiceFilter='pending',practiceSearch='',practiceLimit=60,practiceSelected=null;
let editingProject=null,projectDraftId=null,projectConfirmation=null,practiceImport=null,practiceRevision=0;
const ledgerUI=createLedgerUI({api,getData:()=>data,load,render,error,toast,esc,downloadJSON,blocked:()=>hasDraft()||busy});
const editionUI=createEditionRefreshUI({api,getPractice:()=>data.practice,esc,formatDay,dateTime:value=>new Date(value).toLocaleString(),load,toast,blocked:()=>hasDraft()||busy});
const communicationUI=createCommunicationUI({api,getData:()=>data,getWeek:()=>week,load,render,error,toast,esc,downloadJSON,blocked:()=>hasDraft()||busy});
const heraldUI=createHeraldUI({api,getData:()=>data,getWeek:()=>week,load,error,toast,esc,downloadJSON,blocked:()=>hasDraft()||busy});
const reflectionUI=createReflectionUI({api,getData:()=>data,getWeek:()=>week,load,render,error,toast,esc,downloadJSON,capture:seed=>openCapture(null,null,seed),blocked:()=>busy||budgetUI.dirty||budgetUI.saving||reviewDirty||ledgerUI.dirty||ledgerUI.saving||editionUI.saving||communicationUI.dirty||communicationUI.saving||heraldUI.dirty||heraldUI.saving});
const budgetUI=createBudgetUI({api,getData:()=>data,getWeek:()=>week,load,error,toast,esc,duration,blocked:()=>!loaded||loadedWeek!==week||busy||reviewDirty||reflectionUI.dirty||reflectionUI.saving||ledgerUI.dirty||ledgerUI.saving||editionUI.saving||communicationUI.dirty||communicationUI.saving||heraldUI.dirty||heraldUI.saving||!!document.querySelector('dialog[open]')});
const hasDraft=()=>budgetUI.dirty||budgetUI.saving||reviewDirty||reflectionUI.dirty||reflectionUI.saving||ledgerUI.dirty||ledgerUI.saving||editionUI.saving||communicationUI.dirty||communicationUI.saving||heraldUI.dirty||heraldUI.saving;
const searchUI=createSearchUI({api,resolveResult:resolveSavedRecord,blocked:()=>!loaded||loadedWeek!==week||busy||hasDraft(),error,esc});
const agendaUI=createAgendaUI({getData:()=>data,getWeek:()=>week,resolveResult:resolveSavedRecord,blocked:()=>!loaded||loadedWeek!==week||busy||hasDraft()||!!document.querySelector('dialog[open]'),error,esc});
const commitmentsUI=createCommitmentsUI({getData:()=>data,getWeek:()=>week,resolveResult:resolveSavedRecord,mutate,blocked:()=>!loaded||loadedWeek!==week||busy||hasDraft()||!!document.querySelector('dialog[open]'),error,esc});
const project=id=>data.projects.find(p=>p.id===id);
const open=()=>data.tasks.filter(t=>t.status==='open');
const weekTasks=()=>data.tasks.filter(t=>t.status!=='archived' && t.week_start===week);
const completedThisWeek=()=>data.tasks.filter(t=>t.status==='done' && t.completed_at && localDay(new Date(t.completed_at))>=week && localDay(new Date(t.completed_at))<=addDays(week,6));

async function api(path,method='GET',body,signal) {
  let response;
  try {response=await fetch(path,{method,signal,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
  catch(e) {if(signal?.aborted)throw e;throw new Error('You appear to be offline. Your draft is still here. Reconnect and try again.');}
  let value;try{value=await response.json();}catch{throw new Error('Your workspace is unavailable. Please try again.');}
  if(!response.ok) throw new Error(value.error||'That could not be saved. Please try again.');
  return value;
}
function error(message){$('#error').textContent=message;$('#error').hidden=!message;}
function toast(message,undo=null){$('#toast span').textContent=message+($('#save-state').textContent==='Connection needs attention'?' Refresh to load the latest saved view.':'');$('#toast').hidden=false;$('#undo').hidden=!undo;undoAction=undo;}
async function load({renderPage=true}={}) {
  const requestNumber=++loadNumber, requestedWeek=week;
  $('#save-state').textContent='Loading…';
  if(loaded && loadedWeek!==week)render();
  try {
    const next=await api('/api/state?week='+requestedWeek);
    if(requestNumber!==loadNumber || requestedWeek!==week) return;
    if(budgetUI.dirty||ledgerUI.dirty||reviewDirty||reflectionUI.dirty||communicationUI.dirty||heraldUI.dirty){$('#save-state').textContent='Unsaved draft';return;}
    data=next;loaded=true;loadedWeek=requestedWeek;loadedAt=new Date();error('');$('#save-state').textContent='Saved across devices';
    if(renderPage) render();
    return true;
  } catch(e){if(requestNumber!==loadNumber||requestedWeek!==week)return;error(e.message);$('#save-state').textContent='Connection needs attention';if($('#briefing-freshness'))$('#briefing-freshness').textContent='Refresh failed. Showing the last loaded records.';if(!loaded)$('#content').innerHTML='<div class="empty"><h1>Your workspace could not load.</h1><p>Reconnect, then choose Refresh. Capture will be available when your saved records are ready.</p></div>';}
}
async function resolveSavedRecord(result,signal,{taskView='today',taskWeek=monday(today)}={}){
  const destinations={task:taskView,project:'projects',lesson:'practice',habit:'ledger',day:'ledger',speaking:'communication',content:'herald',review:'review'};
  if(!Object.hasOwn(destinations,result.kind)||typeof result.id!=='string')throw Error('This record is unavailable.');
  const blocked=()=>busy||hasDraft()||!!document.querySelector('dialog[open]:not(#workspace-search-dialog)');
  if(blocked())throw Error('Save or discard your current draft before opening a record.');
  const targetWeek=result.kind==='review'?result.id:result.kind==='task'?taskWeek:week;
  const next=await api('/api/state?week='+encodeURIComponent(targetWeek),'GET',undefined,signal);
  if(signal?.aborted)throw Error('Opening cancelled.');
  if(blocked())throw Error('Your draft is still here. Close it before opening a record.');
  const candidates={task:next.tasks,project:next.projects,lesson:next.practice?.catalog,habit:next.ledger?.habits,day:next.ledger?.days,speaking:next.communication?.reps,content:next.herald?.items,review:next.week?[next.week]:[]};
  const key=result.kind==='day'?'date':result.kind==='review'?'week_start':'id';
  const record=candidates[result.kind]?.find(r=>r[key]===result.id);
  if(!record)throw Error('This record is no longer in your saved workspace.');
  // Each caller invokes this synchronously only while its navigation request
  // remains current. No workspace state changes during the fetch.
  return ()=>{
    if(blocked())throw Error('Your draft is still here. Close it before opening a record.');
    ++loadNumber;data=next;loaded=true;week=targetWeek;loadedWeek=targetWeek;loadedAt=new Date();
    error('');$('#save-state').textContent='Saved across devices';view=destinations[result.kind];
    history.pushState(null,'','#'+view);
    if(result.kind==='day')ledgerUI.selectDay(record.date);
    if(result.kind==='lesson'){practiceSelected=record.id;practiceFilter='all';practiceSearch='';practiceLimit=60;}
    render();
    const reveal=(selector,field)=>{const el=[...document.querySelectorAll(selector)].find(e=>e.dataset[field]===record.id);if(el){el.open=true;el.scrollIntoView({block:'center'});el.querySelector('summary')?.focus();}};
    if(result.kind==='task')openCapture(null,record);
    if(result.kind==='project'){$('#project-filter').value=record.archived_at?'archived':record.status==='done'?'done':'open';$('#project-search').value=record.title;$('#project-list').innerHTML=projectList(record.title,$('#project-filter').value);reveal('[data-project-id]','projectId');}
    if(result.kind==='lesson')reveal('[data-lesson-id]','lessonId');
    if(result.kind==='habit')ledgerUI.openHabit(record.id);
    if(result.kind==='speaking')communicationUI.openRecord(record.id);
    if(result.kind==='content')heraldUI.openRecord(record.id);
    if(result.kind==='day')$('#ledger-day-form').elements.note.focus();
    if(result.kind==='review')$('#review-form').elements.worked.focus();
  };
}
function pageHeading(label,title,description,extra=''){return `<div class="page-heading"><div><span class="eyebrow">${label}</span><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;}
function empty(title,description,button=''){return `<div class="empty"><h3>${title}</h3><p>${description}</p>${button}</div>`;}
function meta(task){
  const p=project(task.project_id),a=appById(task.app_id);
  return `<div class="task-meta"><a href="${appURL(a.id)}"${appURL(a.id).startsWith('#')?'':' target="_blank" rel="noopener"'}>${esc(a.name)}</a>${p?`<span>${esc(p.title)}</span>`:''}<span>${duration(task.minutes)}</span>${task.due_date?`<span class="${task.status==='open'&&task.due_date<today?'due':''}">${task.due_date<today&&task.status==='open'?'Overdue · ':''}${formatDay(task.due_date)}</span>`:''}</div>`;
}
function taskRow(t,focus=false,number=1){
  const selected=t.focus_date===today,done=t.status==='done';
  return `<article class="${focus?'focus-item':'task'}${done?' done':''}">${focus?`<span class="focus-number">0${number}</span>`:''}<button class="check" data-action="${done?'reopen':'complete'}" data-id="${esc(t.id)}" aria-label="${done?'Reopen':'Complete'} ${esc(t.title)}">${done?'✓':''}</button><div class="task-body"><div class="task-title">${esc(t.title)}</div>${meta(t)}<div class="task-actions">${!done?`<button class="text-button" data-action="focus" data-id="${esc(t.id)}">${selected?'Release priority':'Choose for today'}</button><button class="text-button" data-action="edit" data-id="${esc(t.id)}">Edit</button>${t.week_start!==week?`<button class="text-button" data-action="plan" data-id="${esc(t.id)}">Plan this week</button>`:''}<button class="text-button" data-action="archive" data-id="${esc(t.id)}">Archive</button>`:''}</div></div></article>`;
}
function briefingView(){
  const b=dailyBriefing(data,today),stamp=loadedAt?.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})||'';
  const link=item=>item.kind==='task'?`<button class="text-button" data-action="edit" data-id="${esc(item.id)}">Review commitment</button>`:'<a class="inline-link" href="#projects">Review project</a>';
  const source=item=>`${appById(item.app_id).name} · ${item.kind==='project'?'Project':'Commitment'}`;
  const due=item=>item.due<today?'Overdue · '+formatDay(item.due):item.due===today?'Due today':'Due '+formatDay(item.due);
  return `<section class="panel daily-briefing" aria-labelledby="briefing-title"><div class="section-heading"><h2 id="briefing-title">Your daily briefing</h2><span>${formatDay(today)}</span></div>
    <p class="briefing-lead">${b.priorities.length?`${b.priorities.length} ${b.priorities.length===1?'priority':'priorities'} chosen for today.`:'No priorities chosen yet.'} ${b.overdue.length?`${b.overdue.length} overdue ${b.overdue.length===1?'deadline needs':'deadlines need'} a review.`:b.dueToday.length?`${b.dueToday.length} ${b.dueToday.length===1?'deadline is':'deadlines are'} due today.`:'No open deadlines due today or earlier.'}</p>
    <div class="briefing-grid"><div class="briefing-next"><span class="eyebrow">${b.next?'A place to begin':'Make space'}</span>${b.next?`<h3>${esc(b.next.title)}</h3><p>${esc(b.reason)}${b.next.due?' · '+esc(due(b.next)):''}</p><p class="small">${esc(source(b.next))}</p>${link(b.next)}`:'<h3>Choose one concrete action.</h3><p>Capture a commitment, then decide whether it belongs among today’s three priorities.</p><button class="secondary" data-capture>Capture a commitment</button>'}</div>
    <div><h3>The week in view</h3><p>${b.carryover.length} unfinished ${b.carryover.length===1?'commitment':'commitments'} from earlier weeks. ${b.unplanned.length} unscheduled. ${b.completed} completed today.</p><p>${b.capacity===null?`${duration(b.plannedMinutes)} planned this week. Choose your capacity in This week.`:`${duration(b.plannedMinutes)} planned against ${duration(b.capacity)} of chosen capacity.${b.overCapacity?' That is '+duration(b.overCapacity)+' over capacity.':''}`}</p><a class="inline-link" href="#week" data-current-week>Review this week</a></div></div>
    ${b.deadlines.length?`<details class="briefing-deadlines"><summary>${b.deadlines.length} ${b.deadlines.length===1?'deadline':'deadlines'} to review through ${formatDay(b.through)}</summary><ul>${b.deadlines.slice(0,6).map(item=>`<li><div><strong>${esc(item.title)}</strong><p>${esc(source(item))} · ${esc(due(item))}</p></div>${link(item)}</li>`).join('')}</ul>${b.deadlines.length>6?'<p class="small">Showing the first six by due date. Open projects and commitments to review the rest.</p>':''}</details>`:''}
    <p class="small briefing-freshness" id="briefing-freshness">${$('#save-state').textContent==='Connection needs attention'?'Refresh failed. Showing the last loaded records.':`Updated ${stamp} from your saved workspace.`} Imported project dates reflect their last reviewed snapshot.</p></section>`;
}
function todayView(){
  const focus=open().filter(t=>t.focus_date===today).sort((a,b)=>a.focus_slot-b.focus_slot);
  const waiting=open().filter(t=>t.focus_date!==today).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const finished=data.tasks.filter(t=>t.status==='done'&&t.completed_at&&localDay(new Date(t.completed_at))===today);
  const overdue=open().filter(t=>t.due_date&&t.due_date<today).length;
  return pageHeading('A deliberate day','Today, in focus.','Choose the few commitments that deserve your attention.')+briefingView()+
  `<div class="columns"><div><section class="panel focus-panel"><div class="section-heading"><h2>Your three priorities</h2><span>${focus.length} of 3 chosen</span></div><div class="focus-list">${focus.map((t,i)=>taskRow(t,true,i+1)).join('')}${Array.from({length:3-focus.length},(_,i)=>`<div class="empty-slot"><b>0${focus.length+i+1}</b><span>${i===0?'Choose a commitment from the list below.':'Leave room until you know what matters.'}</span></div>`).join('')}</div><div class="statline"><div><strong>${duration(focus.reduce((s,t)=>s+t.minutes,0))}</strong><span>Priority time</span></div><div><strong>${finished.length}</strong><span>Completed today</span></div><div><strong>${overdue}</strong><span>Past due</span></div></div></section>
  <section class="panel"><div class="section-heading"><div><h2>Ready to choose</h2><p>Due commitments appear first.</p></div><button class="text-button" data-capture>＋ Add</button></div>${waiting.length?waiting.map(t=>taskRow(t)).join(''):empty('Start with one concrete action.','Capture something you want to follow through on. You can connect it to a project and an app.', '<button class="secondary" data-capture>Capture a commitment</button>')}</section>${finished.length?`<section class="panel"><div class="section-heading"><h2>Completed today</h2></div>${finished.map(t=>taskRow(t)).join('')}</section>`:''}</div>
  <aside><section class="panel"><div class="section-heading"><h2>Prepare & reflect</h2></div><a class="mini-card" href="#ledger"><span class="mini-icon" aria-hidden="true">▤</span><div><h3>Check in with your day</h3><p>Habits and a little reflection, saved across devices.</p></div></a><a class="inline-link" href="#practice">Open synced practice</a><a class="mini-card" href="${appURL('courier')}" target="_blank" rel="noopener"><span class="mini-icon" aria-hidden="true">▱</span><div><h3>Open your Courier briefing</h3><p>Bring one useful idea into your day.</p></div></a><a class="mini-card" href="${appURL('communication-trainer')}"><span class="mini-icon" aria-hidden="true">◇</span><div><h3>Log speaking practice</h3><p>Carry a completed session into your weekly review.</p></div></a><div class="review-prompt"><p>What would make today feel well spent?</p></div><a class="inline-link" href="#week">Shape the rest of your week</a></section>
  <section class="panel"><span class="eyebrow">${data.projects.length?'Your connected work':'Begin with your own work'}</span><h2 class="wide-section">${data.projects.length?`${data.projects.length} Life Map projects`:'Bring your projects together.'}</h2><p class="quiet-message">${data.projects.length?'Manage a synced project and the commitments that move it forward.':'Import your Life Map projects, then choose the next commitment that moves one forward.'}</p><div class="wide-section">${data.projects.length?'<a class="inline-link" href="#projects">Open projects</a>':'<button class="secondary" data-import>Bring in Life Map</button>'}</div><p class="small">Synced Life Map projects share this workspace. Other apps retain their local records.</p></section></aside></div>`;
}
function weekControls(){return `<div class="week-switch"><button class="icon-button" data-week="-7" aria-label="Previous week">‹</button><span>${formatDay(week)} – ${formatDay(addDays(week,6))}</span><button class="icon-button" data-week="7" aria-label="Next week">›</button></div>`;}
function weekView(){
  const tasks=weekTasks(), minutes=tasks.reduce((s,t)=>s+t.minutes,0);
  const carried=open().filter(t=>t.week_start&&t.week_start<week),unplanned=open().filter(t=>!t.week_start);
  return pageHeading('Make a realistic plan','A week with room.','See your dated work and shape a realistic commitment plan.',weekControls())+agendaUI.panel()+
  `<div class="columns"><div><section class="panel">${budgetUI.panel(minutes)}<div class="section-heading"><h2>Planned commitments</h2><button class="text-button" data-capture>＋ Add</button></div>${tasks.length?tasks.map(t=>taskRow(t)).join(''):empty('Decide what this week can hold.','Add a commitment, or bring one forward from an earlier week.','<button class="secondary" data-capture>Plan a commitment</button>')}</section></div>
  <aside><section class="panel"><div class="section-heading"><h2>Needs a decision</h2></div>${carried.length?carried.map(t=>taskRow(t)).join(''):empty('No earlier commitments waiting.','Unfinished work from earlier weeks will appear here so you can deliberately replan it.')}</section><section class="panel"><div class="section-heading"><h2>Unscheduled</h2><span>${unplanned.length}</span></div>${unplanned.length?unplanned.map(t=>taskRow(t)).join(''):empty('A place to hold an idea.','Choose “Unscheduled” when capturing something that does not need a place in the week yet.')}</section></aside></div>`;
}
function projectsView(){
  return pageHeading('Direction into action','Life Map, connected.','Projects and commitments, saved together across your devices.','<button class="primary" data-new-project>＋ New project</button>')+
  `<div class="project-toolbar"><button class="secondary" data-import>Import local projects</button><button class="secondary" data-project-export>Download project updates</button><a class="inline-link" href="${LEGACY_ORIGIN}life-map.html" target="_blank" rel="noopener">Open original local Life Map</a></div><p class="import-note">Imported projects begin as snapshots. Choose “Use synced project” to manage one here. Its original browser copy stays separate; future imports cannot overwrite a synced project. Chores and project notes remain in local Life Map.</p><div class="panel"><div class="filters"><input id="project-search" aria-label="Search projects" placeholder="Find a project…"><select id="project-filter" aria-label="Filter project status"><option value="open">Open projects</option><option value="all">All active projects</option><option value="done">Completed projects</option><option value="archived">Archived projects</option></select></div><div id="project-list">${projectList()}</div></div>`;
}
function projectList(query='',status='open'){
  const rows=data.projects.filter(p=>(status==='archived'?p.archived_at:!p.archived_at&&(status==='all'||p.status===status))&&`${p.title} ${p.area}`.toLowerCase().includes(query.toLowerCase()));
  return rows.length?rows.map(p=>{
    const tasks=data.tasks.filter(t=>t.project_id===p.id&&t.status!=='archived'),done=tasks.filter(t=>t.status==='done').length;
    const action=(label,act)=>`<button class="text-button" data-project-action="${act}" data-id="${esc(p.id)}">${label}</button>`;
    return `<details class="connected-project" data-project-id="${esc(p.id)}"><summary><span><strong>${esc(p.title)}</strong><span class="small">${esc(p.area)}${p.due_date?' · Due '+formatDay(p.due_date):''} · ${p.status==='done'?'Completed':'Open'}</span></span><span class="badge">${p.mode==='managed'?'Synced':'Snapshot'}</span></summary><div class="project-body"><p class="small">${done} of ${tasks.length} linked commitments completed. Project status is a separate decision.</p><div class="project-toolbar">${!p.archived_at?`<button class="secondary" data-project="${esc(p.id)}">Add next action</button>`:''}${p.mode==='managed'?p.archived_at?action('Restore project','restore'):action('Edit project','edit')+action(p.status==='done'?'Reopen project':'Complete project',p.status==='done'?'reopen':'complete')+action('Archive','archive')+action('Return to import mode','disconnect'):action('Use synced project','connect')}</div>${tasks.map(t=>taskRow(t)).join('')}</div></details>`;
  }).join(''):empty('No matching projects.','Create a synced project or import your existing Life Map project list.','<button class="secondary" data-new-project>New project</button>');
}
function reviewView(){
  const summary=weeklySummary(data,week),done=summary.done,remaining=summary.unfinished;
  return pageHeading('Notice. Adjust. Continue.','Close the loop.','A short review of what moved forward and what needs to change.',weekControls())+
  `<div class="columns review-layout"><section class="panel"><div class="statline review-stats"><div><strong>${done.length}</strong><span>Completed this week</span></div><div><strong>${remaining.length}</strong><span>Unfinished through this week</span></div><div><strong>${duration(done.reduce((s,t)=>s+t.minutes,0))}</strong><span>Completed estimates</span></div></div>${reflectionUI.form()}</section><aside>${reflectionUI.notes()}<section class="panel"><div class="section-heading"><h2>What moved forward</h2></div>${done.length?done.map(t=>taskRow(t)).join(''):empty('Your completed work will appear here.','Mark a commitment complete as you finish it. Each one keeps its project and app connection.')}</section><section class="panel"><h2>Projects completed</h2>${summary.projects.length?summary.projects.map(p=>`<p>${esc(p.title)}</p>`).join(''):'<p class="quiet-message">No project completion recorded this week.</p>'}<h2 class="wide-section">Next week’s deadlines</h2>${summary.deadlines.length?summary.deadlines.map(p=>`<p>${esc(p.title)} <span class="small">${formatDay(p.due_date)}</span></p>`).join(''):'<p class="quiet-message">No project deadlines recorded for next week.</p>'}</section><section class="panel"><div class="section-heading"><h2>Applied practice</h2><span>${summary.practice.length}</span></div>${data.practice?`<p class="small">${data.practice.mode==='managed'?'Synced practice. Workspace completions update this review.':'Reviewed Courier snapshot. Import again to refresh it.'} Connected or imported ${formatDay(data.practice.imported_at.slice(0,10))}.</p>`:'<p class="quiet-message">Bring in recorded Courier practice to include it in this review.</p>'}${summary.practice.slice(0,20).map(p=>`<p>${esc(p.title)}<br><span class="small">${esc(p.track)} · ${formatDay(p.completedDay)}</span></p>`).join('')}<a class="inline-link" href="#practice">Open Practice</a></section>${communicationUI.weekly()}${heraldUI.weekly()}<section class="panel"><h2>Unfinished commitments</h2>${remaining.length?remaining.map(t=>taskRow(t)).join(''):'<p class="quiet-message">Nothing waiting from this or an earlier planned week.</p>'}<a class="inline-link" href="#week" data-next-week>Plan the next week</a></section></aside></div>`;
}
function practiceView(){
  const p=data.practice,managed=p?.mode==='managed',completed=new Map((p?.items||[]).map(x=>[x.id,x]));
  const all=p?.catalog||[],query=practiceSearch.toLowerCase();
  const lessons=all.filter(x=>(!practiceSelected||x.id===practiceSelected)&&(practiceFilter==='all'||(practiceFilter==='completed')===completed.has(x.id))&&(!query||(x.title+' '+x.track).toLowerCase().includes(query)));
  return pageHeading('Learning you have used','Practice, carried forward.','Work through a lesson, then record the practice you completed.','<button class="secondary" data-practice-import>Import lessons</button>')+
    `<section class="panel practice-status"><div><h2>${managed?'Synced practice':p?'Reviewed snapshot':'Begin your practice'}</h2><p>${managed?'Completions and reopened lessons save privately across devices. Later imports protect your existing choices.':p?'Choose synced practice to record your work here. Check for editions to add published lessons.':'Check published Courier editions to begin, or import a practice pack.'}</p><p class="small">${p?`Connected or imported ${esc(dateTime(p.imported_at))}.${p.source_exported_at?' Source export '+esc(dateTime(p.source_exported_at))+'.':''}${p.updated_at?' Last workspace change '+esc(dateTime(p.updated_at))+'.':''}`:'No practice has been imported yet.'}</p></div>${!managed&&all.length?'<button class="primary" data-practice-manage>Use synced practice</button>':''}</section>${editionUI.panel()}
    <p class="small">${all.length} lessons · ${completed.size} completed. Use Check for editions to add published lessons. The original Courier page keeps its own browser copy.</p>
    <div class="practice-controls"><form id="practice-search-form"><label>Search lessons<input name="query" value="${esc(practiceSearch)}" maxlength="200" placeholder="Title or track"></label><button class="secondary" type="submit">Search</button></form><label>Show<select id="practice-filter"><option value="pending" ${practiceFilter==='pending'?'selected':''}>To practise</option><option value="completed" ${practiceFilter==='completed'?'selected':''}>Completed</option><option value="all" ${practiceFilter==='all'?'selected':''}>All lessons</option></select></label></div>
    ${practiceSelected?'<p class="small">Showing the lesson opened from workspace search. <button class="text-button" data-practice-clear>Show all lessons</button></p>':''}<div class="practice-lessons">${lessons.length?lessons.slice(0,practiceLimit).map(x=>{const done=completed.get(x.id);return `<details class="panel practice-lesson" data-lesson-id="${esc(x.id)}"><summary><span><span class="small">${esc(x.track)} · Edition ${formatDay(x.day)}</span><strong>${esc(x.title)}</strong></span><span class="badge">${done?'Completed':'To practise'}</span></summary><div class="practice-lesson-body">${x.task&&x.task.toLowerCase()!=='none'?`<h3>Practice task</h3><p class="lesson-instructions">${esc(x.task)}</p>`:'<p>This import contains the lesson title only. Open the Courier edition to review its practice task.</p>'}${x.drill&&x.drill.toLowerCase()!=='none'?`<h3>Drill</h3><p class="lesson-instructions">${esc(x.drill)}</p>`:''}<p class="small">${done?'Completed '+formatDay(done.completedDay)+'.':'Listening alone does not mark this lesson complete.'}</p><div class="project-toolbar">${managed?`<button class="${done?'secondary':'primary'}" data-lesson-action="${done?'reopen':'complete'}" data-id="${esc(x.id)}">${done?'Reopen lesson':'Mark practice complete'}</button>`:''}<a class="inline-link" href="${LEGACY_ORIGIN}courier.html?day=${encodeURIComponent(x.day)}#courier-practice" target="_blank" rel="noopener">Open Courier edition</a></div></div></details>`;}).join(''):empty(all.length?'No lessons match this view.':'Bring your learning into Atlas.',all.length?'Try another filter or search.':'Choose Check for editions above, or bring a practice pack from the original Courier app.','<a class="inline-link" href="'+LEGACY_ORIGIN+'courier.html#courier-practice" target="_blank" rel="noopener">Open Courier practice</a>')}</div>${lessons.length>practiceLimit?'<button class="secondary" data-practice-more>Show more lessons</button>':''}`;
}
function connectionsView(){
  const managed=data.projects.filter(p=>p.mode==='managed'&&!p.archived_at).length,snapshots=data.projects.filter(p=>p.mode==='snapshot'&&!p.archived_at).length;
  return `<section class="panel connection-status"><h2>Where your work is saved</h2><dl><div><dt>Planning and weekly reviews</dt><dd>Private workspace · saved across devices</dd></div><div><dt>Life Map</dt><dd>${managed} synced projects · ${snapshots} imported snapshots. Original Life Map records stay in their browser copy.</dd></div><div><dt>Courier practice</dt><dd>${data.practice?.mode==='managed'?'Synced in this workspace. Imports add new lessons and preserve existing choices.':data.practice?'Reviewed snapshot. Import again to refresh it, or choose synced practice.':'No practice imported yet.'} <a class="inline-link" href="#practice">Open Practice</a></dd></div><div><dt>Life Ledger</dt><dd>Private habits and daily reflection. Imports preserve existing saved dates. <a class="inline-link" href="#ledger">Open Life Ledger</a></dd></div><div><dt>Master Communicator</dt><dd>Private speaking practice log. Imports preserve saved details and archive choices. <a class="inline-link" href="#communication">Open speaking practice</a></dd></div><div><dt>The Herald</dt><dd>Private content stages and dates, saved across devices. Original scripts and analytics remain in the vault. <a class="inline-link" href="#herald">Open content plan</a></dd></div><div><dt>Other specialist apps</dt><dd>Browser-local records. A connected commitment here does not sync an app’s underlying data.</dd></div></dl></section>`;
}
function appsView(){
  const groups=[...new Set(APPS.map(a=>a.group))];
  return connectionsView()+pageHeading('One suite. Many perspectives.','Your Atlas ecosystem.','Open an existing app, or connect it to a commitment from Capture.')+
    groups.map(g=>`<h2 class="app-group">${g}</h2><div class="app-grid">${APPS.filter(a=>a.group===g).map(a=>`<a class="app-card" href="${appURL(a.id)}"${appURL(a.id).startsWith('#')?'':' target="_blank" rel="noopener"'}><span class="app-icon" aria-hidden="true">${a.icon}</span><div><h3>${esc(a.name)}</h3><p>${esc(a.detail)}</p></div></a>`).join('')}</div>`).join('')+
    '<p class="footer-note">Atlas Home is the shared workspace. Life Map projects, Life Ledger, speaking practice, and the Herald content plan open here; the other specialist apps retain their existing addresses and browser records.</p><button class="secondary" data-export>Export my Atlas data</button>';
}
const historyLabels={tasks:'Commitments',projects:'Projects',weeks:'Weekly reviews',practice_snapshots:'Courier practice',practice:'Courier practice',workspace:'Workspace',ledger:'Life Ledger',communication:'Speaking practice',herald:'Herald content plan'};
const fieldLabels={item_count:'Content items',active_items:'Active content',rep_count:'Saved sessions',active_reps:'Active sessions',feed_checked_at:'Courier last refreshed',habit_count:'Habits',day_count:'Saved days',title:'Title',area:'Life area',status:'Status',mode:'Management mode',lessons:'Practice lessons',due_date:'Due date',week_start:'Planned week',minutes:'Minutes',focus_date:'Priority day',focus_slot:'Priority slot',completed_at:'Completed',archived_at:'Archived',app_id:'Connected app',project_id:'Project',capacity:'Weekly minutes',worked:'What worked',change:'What to change',count:'Practice completions',source_exported_at:'Source backup date'};
const dateTime=value=>new Date(value).toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
function historyDiff(h){
  const keys=Object.keys(fieldLabels).filter(k=>JSON.stringify(h.before?.[k])!==JSON.stringify(h.after?.[k]));
  const display=(k,v)=>v===null||v===undefined||v===''?'—':k==='project_id'?(project(v)?.title||v):k==='app_id'?appById(v).name:String(v);
  return keys.length?`<div class="recovery-table"><table><thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead><tbody>${keys.map(k=>`<tr><th>${fieldLabels[k]}</th><td>${esc(display(k,h.before?.[k]))}</td><td>${esc(display(k,h.after?.[k]))}</td></tr>`).join('')}</tbody></table></div>`:'<p class="small">Saved record metadata changed.</p>';
}
function historyView(){
  const events=historyData?.events||[];
  return pageHeading('Your work, recoverable','History & recovery.','Review saved changes and recover from a mistake.','<button class="primary" data-restore>Restore workspace</button>')+
  `<section class="panel"><div class="section-heading"><h2>Keep a copy</h2><button class="secondary" data-export>Download workspace backup</button></div><p>A workspace restore replaces projects, commitments, weekly reviews, Courier practice, Life Ledger, speaking practice, and the Herald content plan. Review the changes first. Atlas saves a recovery copy before applying them.</p><p class="small">History begins with this upgrade. Original browser apps keep their own data. Downloads contain your personal records; store them somewhere private.</p></section>`+
  `<section class="panel"><div class="section-heading"><h2>Recovery copies</h2><span>Latest 20</span></div>${historyData?.checkpoints.length?historyData.checkpoints.map(c=>`<div class="recovery-copy"><div><h3>${esc(c.label)}</h3><p>${esc(dateTime(c.created_at))}</p></div><div><button class="text-button" data-checkpoint-export="${esc(c.id)}">Download copy</button>${c.after_seq===historyData.seq?`<button class="secondary" data-checkpoint-undo="${esc(c.id)}">Review reversal</button>`:'<span class="small">Download to review a restore.</span>'}</div></div>`).join(''):'<p class="quiet-message">Your first workspace restore will create a recovery copy here.</p>'}</section>`+
  `<section class="panel"><div class="section-heading"><h2>Saved changes</h2><button class="text-button" data-history-refresh>Refresh history</button></div><p class="small">Each save includes its history entry. Earlier updates can be reversed while that record remains unchanged. Courier practice, Life Ledger, speaking practice, and Herald entries record counts and dates; use the app controls to edit records or restore a workspace backup to recover its contents. History and recovery copies remain here across workspace restores.</p>${historyData?events.length?events.map(h=>`<details class="history-entry"><summary><span><strong>${esc(h.after?.title||h.before?.title||h.after?.week_start||h.before?.week_start||historyLabels[h.entity])}</strong><span class="small">${esc(historyLabels[h.entity])} · ${esc(h.action)} · ${esc(dateTime(h.created_at))}</span></span></summary>${historyDiff(h)}${h.action==='updated'&&['tasks','projects','weeks'].includes(h.entity)?`<button class="secondary" data-history-undo="${h.seq}">Review previous values</button>`:h.entity==='workspace'?`<button class="secondary" data-checkpoint-export="${esc(h.record_id)}">Download the recovery copy</button>`:'<p class="small">'+(h.action==='created'?'Use the app controls to edit or archive this record.':h.entity==='practice_snapshots'?'Open Practice to review completions, or use a workspace recovery copy.':h.entity==='ledger'?'Open Life Ledger to edit a day, or restore a reviewed workspace backup.':h.entity==='communication'?'Open Master Communicator to edit or archive a session, or restore a reviewed workspace backup.':h.entity==='herald'?'Open the content plan to edit an item, or restore a reviewed workspace backup.':'Use the recovery copy for this workspace restore.')+'</p>'}</details>`).join(''):'<p class="quiet-message">Your next saved change will appear here.</p>':'<p>Loading saved history…</p>'}${historyData?.next?'<button class="secondary" data-history-more>Load earlier changes</button>':''}</section>`;
}
async function refreshHistory(append=false){
  const ticket=++historyRequest;
  try{const next=await api('/api/history'+(append&&historyData?.next?'?before='+historyData.next:''));if(ticket!==historyRequest)return;historyData={...next,events:append?[...historyData.events,...next.events]:next.events};if(view==='history')$('#content').innerHTML=historyView();}
  catch(e){error(e.message);}
}
function openRestore(){
  if(hasDraft()){error('Save or discard your draft before restoring the workspace.');return;}
  restorePlan=null;restoreRequest++;$('#restore-file').value='';$('#restore-json').value='';$('#restore-preview').innerHTML='';$('#restore-error').textContent='';$('#restore-confirm').disabled=true;$('#restore-dialog').showModal();
}
async function reviewRestore(raw){
  const ticket=++restoreRequest;restorePlan=null;$('#restore-confirm').disabled=true;$('#restore-preview').innerHTML='<p>Checking your backup against the saved workspace…</p>';$('#restore-error').textContent='';
  try{
    if(new TextEncoder().encode(raw).length>8000000)throw new Error('Choose an export smaller than 8 MB.');
    const next=await api('/api/restore/preview','POST',{backup:JSON.parse(raw)});if(ticket!==restoreRequest)return;restorePlan=next;
    $('#restore-preview').innerHTML=`<h3>Review the replacement</h3><p>Backup from ${esc(dateTime(next.backup.exportedAt))}. ${next.legacy?'This older export retains your current practice records.':''} ${next.legacyLedger?'This older export retains your current Life Ledger.':''} ${next.legacyCommunication?'This older export retains your current speaking practice.':''} ${next.legacyHerald?'This older export retains your current content plan.':''}</p><p class="small">Practice in this backup: ${next.backup.practice[0]?.mode==='managed'?'synced':'snapshot or empty'} · ${next.backup.practice[0]?.catalog?.length||0} lessons. Restoring replaces the current practice mode, lesson list, and completions.</p><p class="small">Life Ledger: ${next.backup.ledger[0]?.habits.length||0} habits · ${next.backup.ledger[0]?.days.length||0} saved days. ${next.legacyLedger?'Current records are retained.':'Restoring replaces the entire Ledger, including daily reflection.'}</p><p class="small">Speaking practice: ${next.backup.communication[0]?.reps.length||0} sessions, including archived records. ${next.legacyCommunication?'Current sessions are retained.':'Restoring replaces the entire practice log, including notes and archive choices.'}</p><p class="small">Herald content plan: ${next.backup.herald[0]?.items.length||0} items, including archived records. ${next.legacyHerald?'Current content records are retained.':'Restoring replaces the entire content plan, including dates, notes, and stages.'}</p><div class="recovery-table"><table><thead><tr><th>Records</th><th>Add</th><th>Replace</th><th>Remove</th><th>Keep</th></tr></thead><tbody>${next.changes.map(c=>`<tr><th>${historyLabels[c.key]}</th><td>${c.add}</td><td>${c.replace}</td><td>${c.remove}</td><td>${c.keep}</td></tr>`).join('')}</tbody></table></div>${next.changes.filter(c=>c.rows.some(r=>r.action!=='Keep')).map(c=>`<details class="restore-details"><summary>${historyLabels[c.key]} · review changed records</summary><div class="import-list">${c.rows.filter(r=>r.action!=='Keep').map(r=>`<div class="import-row"><strong>${esc(r.action)}</strong><span>${esc(r.title)}</span></div>`).join('')}</div></details>`).join('')}<p class="restore-warning">Records marked Remove will leave the workspace. Atlas will keep a recovery copy of the current workspace. Newer changes from another device will stop this restore.</p><label class="restore-consent"><input type="checkbox" id="restore-understood">I reviewed the replacements and removals.</label>`;
  }catch(e){if(ticket!==restoreRequest)return;$('#restore-preview').innerHTML='';$('#restore-error').textContent=e.message;}
}
$('#restore-file').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;const ticket=++restoreRequest;restorePlan=null;$('#restore-confirm').disabled=true;$('#restore-preview').innerHTML='';$('#restore-error').textContent='';if(file.size>8000000){$('#restore-error').textContent='Choose an export smaller than 8 MB.';return;}try{const raw=await file.text();if(ticket===restoreRequest)await reviewRestore(raw);}catch(e){if(ticket===restoreRequest)$('#restore-error').textContent='This file could not be read. Choose it again.';}});
$('#restore-paste').addEventListener('click',()=>reviewRestore($('#restore-json').value));
$('#restore-json').addEventListener('input',()=>{restoreRequest++;restorePlan=null;$('#restore-confirm').disabled=true;$('#restore-preview').innerHTML='';});
document.addEventListener('change',e=>{if(e.target.id==='restore-understood')$('#restore-confirm').disabled=!restorePlan||!e.target.checked;});
$('#restore-confirm').addEventListener('click',async()=>{
  if(!restorePlan||!$('#restore-understood')?.checked)return;const button=$('#restore-confirm');button.disabled=true;
  try{await api('/api/restore','POST',{backup:restorePlan.backup,seq:restorePlan.seq,digest:restorePlan.digest});restorePlan=null;$('#restore-dialog').close();undoAction=null;historyData=null;await load();toast('Workspace restored. Your recovery copy is in History & recovery.');}
  catch(e){restorePlan=null;$('#restore-error').textContent=e.message+' Review the backup again before applying it.';}
});
document.addEventListener('click',async e=>{
  if(e.target.closest('[data-history-refresh]')){await refreshHistory();return;}
  if(e.target.closest('[data-history-more]')){const button=e.target.closest('button');button.disabled=true;await refreshHistory(true);button.disabled=false;return;}
  const download=e.target.closest('[data-checkpoint-export]');if(download){try{downloadJSON(await api('/api/checkpoints/'+encodeURIComponent(download.dataset.checkpointExport)+'/export'),'atlas-recovery-'+today+'.json');toast('Recovery copy download started.');}catch(errorValue){error(errorValue.message);}return;}
  const previous=e.target.closest('[data-history-undo]'),checkpoint=e.target.closest('[data-checkpoint-undo]');if(!previous&&!checkpoint)return;
  $('#history-error').textContent='';
  if(previous){const h=historyData.events.find(h=>h.seq===Number(previous.dataset.historyUndo));recoveryAction={path:'/api/history/'+h.seq+'/undo',seq:historyData.seq};$('#history-preview').innerHTML='<p>Restore this record to the values in the Before column. Atlas will protect newer changes and record the recovery as another save.</p>'+historyDiff(h);}
  else{recoveryAction={path:'/api/checkpoints/'+encodeURIComponent(checkpoint.dataset.checkpointUndo)+'/undo',seq:historyData.seq};$('#history-preview').innerHTML='<p>Reverse the latest workspace restore and return to the recovery copy made immediately before it. This is available only while the workspace has no later changes. Atlas will also keep a copy of the current workspace.</p>';}
  $('#history-confirm').textContent=previous?'Restore previous values':'Reverse workspace restore';$('#history-dialog').showModal();
});
$('#history-confirm').addEventListener('click',async()=>{
  const button=$('#history-confirm');if(!recoveryAction||button.disabled)return;button.disabled=true;
  try{await api(recoveryAction.path,'POST',{seq:recoveryAction.seq});$('#history-dialog').close();recoveryAction=null;undoAction=null;historyData=null;await load();toast('Previous values restored. This recovery is recorded in history.');}
  catch(e){$('#history-error').textContent=e.message;}finally{button.disabled=false;}
});
function render(){
  if(view!=='practice')practiceSelected=null;
  document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  if(!loaded)return;
  if(loadedWeek!==week){$('#capture').disabled=true;$('#content').innerHTML='<div class="empty"><h2>Loading the selected week.</h2><p>If this takes a moment, use Refresh to try again.</p></div>';return;}
  $('#content').innerHTML=({today:todayView,week:weekView,commitments:commitmentsUI.page,projects:projectsView,review:reviewView,practice:practiceView,ledger:ledgerUI.daily,communication:communicationUI.page,herald:heraldUI.page,apps:appsView,history:historyView}[view]||todayView)();
  $('#capture').disabled=false;
  if(view==='history')refreshHistory();
}
function openCapture(projectId=null,task=null,seed=null){
  if(!loaded||loadedWeek!==week||busy){error('Wait for your workspace to finish loading or saving before capturing a commitment.');return;}
  editing=task;draftId=task?.id||newId();
  const form=$('#task-form');form.reset();$('#task-error').textContent='';
  $('#task-dialog-title').textContent=task?'Edit commitment':'Capture a commitment';
  $('#task-record-status').hidden=!task||task.status==='open';$('#task-record-status').textContent=task&&task.status!=='open'?`${task.status==='done'?'Completed':'Archived'} commitment. Saving details keeps this status.`:'';
  $('#app-select').innerHTML=APPS.filter(a=>a.group!=='Archive').map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(task?.app_id==='chambers-wealth-hq')$('#app-select').insertAdjacentHTML('beforeend','<option value="chambers-wealth-hq">Chambers Wealth HQ (legacy)</option>');
  $('#project-select').innerHTML='<option value="">No project</option>'+data.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
  const choices=[...new Set([week,addDays(week,7),monday(today),addDays(monday(today),7),task?.week_start,seed?.week_start].filter(Boolean))].sort();
  $('#week-select').innerHTML='<option value="">Unscheduled</option>'+choices.map(w=>`<option value="${w}">Week of ${formatDay(w)}</option>`).join('');
  form.elements.title.value=task?.title||seed?.title||'';form.elements.app_id.value=task?.app_id||seed?.app_id||'life-map';form.elements.project_id.value=task?.project_id||projectId||'';
  form.elements.week_start.value=task?task.week_start||'':seed?.week_start||week;form.elements.due_date.value=task?.due_date||'';
  $('#task-source').hidden=!seed?.source;$('#task-source-label').textContent=seed?.source?.label||'';$('#task-source-text').textContent=seed?.source?.text||'';
  $('#task-source').open=false;
  if(task && ![15,30,60,90,120,180].includes(task.minutes))form.elements.minutes.insertAdjacentHTML('beforeend',`<option value="${task.minutes}">${duration(task.minutes)}</option>`);
  form.elements.minutes.value=String(task?.minutes||30);
  $('#task-dialog').showModal();form.elements.title.focus();
}
async function mutate(task,action){
  if(hasDraft()){error('Save or discard your draft before changing other records.');return;}
  if(busy)return;busy=true;error('');$('#save-state').textContent='Saving…';
  try {
    await api('/api/tasks/'+encodeURIComponent(task.id),'PATCH',{revision:task.revision,action,day:today,week_start:week});
    await load();
    const current=data.tasks.find(t=>t.id===task.id);
    toast(({complete:'Commitment completed.',reopen:'Commitment reopened.',archive:'Commitment archived.',restore:'Commitment restored with its earlier status.',focus:'Your priorities are updated.',plan:'Added to the selected week.'})[action]||'Saved.',
      ['complete','archive'].includes(action)&&current&&current.revision===task.revision+1&&current.status===(action==='archive'?'archived':'done')?()=>mutate(current,action==='archive'?'restore':'reopen'):null);
  }catch(e){error(e.message);$('#save-state').textContent='Change not saved';}
  finally{busy=false;}
}

function openProjectEditor(p=null){
  editingProject=p;projectDraftId=p?.id||newId();
  const form=$('#project-form');form.reset();form.elements.title.value=p?.title||'';form.elements.area.value=p?.area||'';form.elements.due_date.value=p?.due_date||'';
  $('#project-dialog-title').textContent=p?'Edit synced project':'New synced project';$('#project-error').textContent='';$('#project-dialog').showModal();form.elements.title.focus();
}
async function mutateProject(p,action){
  if(hasDraft()){error('Save or discard your draft before changing other records.');return false;}
  if(busy)return false;busy=true;error('');
  try{
    await api('/api/projects/'+encodeURIComponent(p.id),'PATCH',{revision:p.revision,action});
    await load();const current=project(p.id);
    const reverse={complete:'reopen',archive:'restore',connect:'disconnect'}[action];
    toast(({complete:'Project completed. Commitments retain their own status.',reopen:'Project reopened.',archive:'Project archived; linked commitments retained.',restore:'Project restored.',connect:'This project is now managed privately across your devices.',disconnect:'Project returned to import mode. Its saved values are retained.'})[action],reverse&&current&&current.revision>p.revision?()=>mutateProject(current,reverse):null);
    return true;
  }catch(e){error(e.message);$('#project-confirm-error').textContent=e.message;return false;}
  finally{busy=false;}
}
function confirmProject(p,action){
  projectConfirmation={project:p,action};$('#project-confirm-error').textContent='';
  const copy={
    connect:['Use synced project?','Manage this project in private Atlas OS from now on. Its existing commitments keep their links. Future imports cannot overwrite it. The original local Life Map copy remains separate.'],
    disconnect:['Return to import mode?','This keeps your saved project values and commitment links, but allows future reviewed Life Map imports to update this project. Download project updates first if you want to carry these changes back to the local app.'],
    archive:['Archive this project?','The project leaves the active list. Linked commitments are retained and remain actionable. You can restore the project from the Archived filter.']
  }[action];
  $('#project-confirm-title').textContent=copy[0];$('#project-confirm-copy').textContent=copy[1];$('#project-confirm-dialog').showModal();
}
function downloadJSON(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function exportProjectUpdates(){
  try{const saved=await api('/api/export'),rows=saved.projects.filter(p=>p.mode==='managed'&&!p.archived_at).map(p=>({id:p.source_id,title:p.title,area:p.area,status:p.status,due_date:p.due_date}));if(!rows.length){toast('No active synced projects to export.');return;}downloadJSON({app:'atlas-project-updates',version:1,exportedAt:saved.exportedAt,projects:rows},'atlas-project-updates-'+today+'.json');toast('Download started. Review this file in the original Life Map to apply project updates.');}catch(e){error(e.message);}
}
document.addEventListener('click',async event=>{
  if(event.target.closest('[data-export]')){await exportData();return;}
  const close=event.target.closest('[data-close]');if(close){if(busy||ledgerUI.saving||editionUI.saving||communicationUI.saving||heraldUI.saving||reflectionUI.saving)return;document.getElementById(close.dataset.close).close();return;}
  if(hasDraft()&&event.target.closest('[data-capture],#capture,[data-import],[data-project],[data-action],[data-project-action],[data-new-project],[data-practice-import],[data-practice-manage],[data-lesson-action],[data-edition-check],[data-restore]')){error('Save or discard your draft before changing other records.');return;}
  if(event.target.closest('[data-restore]')){openRestore();return;}
  if(event.target.closest('[data-new-project]')){openProjectEditor();return;}
  if(event.target.closest('[data-project-export]')){await exportProjectUpdates();return;}
  if(event.target.closest('[data-practice-import]')){practiceFileRequest++;practiceImport=null;practiceRevision=data.practice?.revision||0;$('#practice-file').value='';$('#practice-preview').innerHTML='';$('#practice-error').textContent='';$('#practice-consent').checked=false;$('#practice-confirm').disabled=true;$('#practice-dialog').showModal();return;}
  if(event.target.closest('[data-practice-manage]')){practiceRevision=data.practice?.revision||0;$('#practice-connect-error').textContent='';$('#practice-connect-dialog').showModal();return;}
  if(event.target.closest('[data-practice-more]')){practiceLimit+=60;render();return;}
  const lessonAction=event.target.closest('[data-lesson-action]');if(lessonAction){if(busy)return;busy=true;lessonAction.disabled=true;try{await api('/api/practice/lesson','PATCH',{id:lessonAction.dataset.id,action:lessonAction.dataset.lessonAction,day:today,revision:data.practice?.revision||0});await load();toast(lessonAction.dataset.lessonAction==='complete'?'Practice saved across devices.':'Lesson reopened. Future imports will preserve this choice.');}catch(e){error(e.message);}finally{busy=false;lessonAction.disabled=false;}return;}
  const projectAction=event.target.closest('[data-project-action]');if(projectAction){const p=project(projectAction.dataset.id),act=projectAction.dataset.projectAction;if(!p)return;if(act==='edit')openProjectEditor(p);else if(['connect','disconnect','archive'].includes(act))confirmProject(p,act);else await mutateProject(p,act);return;}
  if(event.target.closest('[data-capture]') || event.target.closest('#capture')){openCapture();return;}
  if(event.target.closest('[data-import]')){$('#import-dialog').showModal();return;}
  const next=event.target.closest('[data-project]');if(next){openCapture(next.dataset.project);return;}
  if(event.target.closest('[data-current-week]')){event.preventDefault();if(hasDraft())return;week=monday(today);view='week';location.hash='week';await load();return;}
  if(event.target.closest('[data-next-week]')){event.preventDefault();if(hasDraft()){error('Save or discard your draft before planning next week.');return;}week=addDays(week,7);view='week';location.hash='week';await load();return;}
  const action=event.target.closest('[data-action]');if(action){const task=data.tasks.find(t=>t.id===action.dataset.id);if(!task)return;if(action.dataset.action==='edit')openCapture(null,task);else await mutate(task,action.dataset.action);return;}
  const shift=event.target.closest('[data-week]');if(shift){if(hasDraft()){error('Save or discard your draft before changing weeks.');return;}week=addDays(week,Number(shift.dataset.week));await load();return;}

});
$('#project-confirm').addEventListener('click',async()=>{const button=$('#project-confirm');button.disabled=true;try{if(projectConfirmation&&await mutateProject(projectConfirmation.project,projectConfirmation.action))$('#project-confirm-dialog').close();}finally{button.disabled=false;}});
$('#project-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;$('#project-error').textContent='';
  const values=Object.fromEntries(new FormData(form));values.due_date=values.due_date||null;
  try{if(editingProject)await api('/api/projects/'+encodeURIComponent(editingProject.id),'PATCH',{...values,revision:editingProject.revision,action:'edit'});else await api('/api/projects','POST',{...values,id:projectDraftId});$('#project-dialog').close();await load();toast('Project saved privately across devices.');}
  catch(e){$('#project-error').textContent=e.message;}finally{button.disabled=false;}
});
document.addEventListener('click',event=>{if(event.target.closest('[data-practice-clear]')){practiceSelected=null;practiceFilter='all';practiceSearch='';practiceLimit=60;render();}});
document.addEventListener('change',event=>{if(event.target.id==='practice-filter'){practiceSelected=null;practiceFilter=event.target.value;practiceLimit=60;render();}});
document.addEventListener('submit',event=>{if(event.target.id==='practice-search-form'){event.preventDefault();practiceSelected=null;practiceSearch=new FormData(event.target).get('query').trim();practiceLimit=60;render();}});
$('#practice-file').addEventListener('change',async event=>{
  const ticket=++practiceFileRequest;practiceImport=null;$('#practice-confirm').disabled=true;$('#practice-consent').checked=false;$('#practice-preview').innerHTML='';$('#practice-error').textContent='';const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>25000000)throw Error('Choose a backup smaller than 25 MB.');
    const pack=parsePracticeTransfer(await file.text());if(ticket!==practiceFileRequest)return;
    const plan=await api('/api/practice/import/preview','POST',{pack});if(ticket!==practiceFileRequest)return;
    practiceImport=plan;
    $('#practice-preview').innerHTML=`<h3>Review practice changes</h3><p>${plan.added} added · ${plan.kept} kept as synced · ${plan.replaced} snapshot replacements · ${plan.removed} snapshot removals.</p><p class="small">Source export: ${plan.pack.exportedAt?esc(dateTime(plan.pack.exportedAt)):'date unavailable'}. ${plan.mode==='managed'?'Existing lessons and completion choices will be kept.':'This replaces the current imported snapshot.'}</p><div class="import-list">${plan.rows.slice(0,100).map(p=>`<div class="import-row"><strong>${esc(p.action)}</strong><span>${esc(p.title)}</span></div>`).join('')}</div>${plan.rows.length>100?'<p class="small">Showing the first 100 changes. Counts include all records.</p>':''}`;$('#practice-confirm').disabled=!$('#practice-consent').checked;
  }catch(e){if(ticket===practiceFileRequest)$('#practice-error').textContent=e.message;}
});
$('#practice-consent').addEventListener('change',()=>{$('#practice-confirm').disabled=!practiceImport||!$('#practice-consent').checked;});
$('#practice-confirm').addEventListener('click',async()=>{
  const button=$('#practice-confirm');if(!practiceImport||button.disabled||!$('#practice-consent').checked)return;button.disabled=true;
  try{await api('/api/practice/import','POST',{pack:practiceImport.pack,digest:practiceImport.digest,revision:practiceImport.revision});$('#practice-dialog').close();practiceImport=null;await load();toast('Reviewed practice import saved.');}
  catch(e){$('#practice-error').textContent=e.message;}finally{button.disabled=!practiceImport||!$('#practice-consent').checked;}
});
$('#practice-connect').addEventListener('click',async()=>{
  const button=$('#practice-connect');if(button.disabled)return;button.disabled=true;
  try{await api('/api/practice/manage','POST',{revision:practiceRevision});$('#practice-connect-dialog').close();await load();toast('Practice now saves privately across devices.');}
  catch(e){$('#practice-connect-error').textContent=e.message;}finally{button.disabled=false;}
});
$('#task-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;$('#task-error').textContent='';
  const values=Object.fromEntries(new FormData(form));values.minutes=Number(values.minutes);values.project_id=values.project_id||null;values.week_start=values.week_start||null;values.due_date=values.due_date||null;
  busy=true;const controls=[...form.querySelectorAll('input,select,button')];controls.forEach(x=>x.disabled=true);
  try {
    if(editing)await api('/api/tasks/'+encodeURIComponent(editing.id),'PATCH',{...values,action:'edit',revision:editing.revision});
    else await api('/api/tasks','POST',{...values,id:draftId});
    $('#task-dialog').close();await load();toast(editing?'Commitment updated.':'Commitment captured. Choose it for today when you are ready.');
  }catch(e){$('#task-error').textContent=e.message;}finally{busy=false;controls.forEach(x=>x.disabled=false);}
});
$('#task-dialog').addEventListener('cancel',event=>{if(busy)event.preventDefault();});
document.addEventListener('input',event=>{
  if(['project-search','project-filter'].includes(event.target.id))$('#project-list').innerHTML=projectList($('#project-search').value,$('#project-filter').value);
});
$('#import-file').addEventListener('change',async event=>{
  imports=[];$('#import-confirm').disabled=true;$('#import-preview').innerHTML='';$('#import-error').textContent='';
  const file=event.target.files[0];if(!file)return;
  try{
    if(file.size>25000000)throw new Error('Choose a file smaller than 25 MB.');
    imports=parseLifeMap(await file.text());
    $('#import-preview').innerHTML=`<p>${imports.length} projects ready. Snapshot projects will be updated. Synced projects are protected.</p><div class="import-list">${imports.slice(0,50).map(p=>`<div class="import-row">${esc(p.title)}<span>${esc(p.area)} · ${p.status==='done'?'Completed':'Open'}</span></div>`).join('')}${imports.length>50?`<p class="small">And ${imports.length-50} more projects.</p>`:''}</div>`;
    $('#import-confirm').disabled=!imports.length;
  }catch(e){$('#import-error').textContent=e.message;}
});
$('#import-confirm').addEventListener('click',async()=>{
  const button=$('#import-confirm');button.disabled=true;
  try{const result=await api('/api/import','POST',{projects:imports});$('#import-dialog').close();imports=[];$('#import-file').value='';$('#import-preview').innerHTML='';await load();location.hash='projects';toast(`${result.count} projects imported. ${result.protected||0} synced or archived projects protected.`);}
  catch(e){$('#import-error').textContent=e.message;button.disabled=false;}
});
$('#refresh').addEventListener('click',async()=>{if(hasDraft()){error('Save or discard your draft before refreshing.');return;}await load();});
$('#undo').addEventListener('click',()=>{const action=undoAction;undoAction=null;$('#toast').hidden=true;if(action)action();});
$('#dismiss-toast').addEventListener('click',()=>{$('#toast').hidden=true;undoAction=null;});
async function exportData(){
  try{const snapshot=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`atlas-os-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your Atlas data was exported.');}catch(e){error(e.message);}
}
$('#export').addEventListener('click',exportData);
window.addEventListener('hashchange',()=>{
  const next=location.hash.slice(1)||'today';
  if(hasDraft()){if(next!==view){location.hash=view;error('Save or discard your draft before leaving this page.');}return;}
  view=['today','week','commitments','projects','review','practice','ledger','communication','herald','apps','history'].includes(next)?next:'today';if(view==='today'&&week!==monday(today)){week=monday(today);load();}else render();
});
window.addEventListener('beforeunload',event=>{if(hasDraft() || ledgerUI.editorDirty || ($('#task-dialog').open && $('#task-form').elements.title.value.trim()) || ($('#project-dialog').open && $('#project-form').elements.title.value.trim())){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!hasDraft()&&!document.querySelector('dialog[open]')){const next=localDay();if(next!==today){today=next;week=monday(today);}load();}});
$('#capture').disabled=true;view=['today','week','commitments','projects','review','practice','ledger','communication','herald','apps','history'].includes(location.hash.slice(1))?location.hash.slice(1):'today';render();load();

setInterval(()=>{if(document.visibilityState==='visible'&&localDay()!==today&&!hasDraft()&&!document.querySelector('dialog[open]')){today=localDay();week=monday(today);load();}},30000);
