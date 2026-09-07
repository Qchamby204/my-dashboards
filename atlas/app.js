import { APPS, LEGACY_ORIGIN, localDay, monday, addDays, parseLifeMap, parsePracticeSnapshot, weeklySummary } from './model.mjs';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const appById=id=>APPS.find(a=>a.id===id)||APPS[0];
const appURL=id=>id==='life-map'?'#projects':LEGACY_ORIGIN+appById(id).file;
const formatDay=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'});
const duration=m=>m<60?`${m} min`:`${Number((m/60).toFixed(1))}h`;
let today=localDay(), week=monday(today), data={tasks:[],projects:[],week:null};
let loaded=false,view='today',editing=null,draftId=null,imports=[],undoAction=null,busy=false,reviewDirty=false,loadNumber=0;
let editingProject=null,projectDraftId=null,projectConfirmation=null,practiceImport=null,practiceRevision=0;
const project=id=>data.projects.find(p=>p.id===id);
const open=()=>data.tasks.filter(t=>t.status==='open');
const weekTasks=()=>data.tasks.filter(t=>t.status!=='archived' && t.week_start===week);
const completedThisWeek=()=>data.tasks.filter(t=>t.status==='done' && t.completed_at && localDay(new Date(t.completed_at))>=week && localDay(new Date(t.completed_at))<=addDays(week,6));

async function api(path,method='GET',body) {
  let response;
  try {response=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}
  catch {throw new Error('You appear to be offline. Your draft is still here. Reconnect and try again.');}
  let value;try{value=await response.json();}catch{throw new Error('Your workspace is unavailable. Please try again.');}
  if(!response.ok) throw new Error(value.error||'That could not be saved. Please try again.');
  return value;
}
function error(message){$('#error').textContent=message;$('#error').hidden=!message;}
function toast(message,undo=null){$('#toast span').textContent=message;$('#toast').hidden=false;$('#undo').hidden=!undo;undoAction=undo;}
async function load({renderPage=true}={}) {
  const requestNumber=++loadNumber, requestedWeek=week;
  $('#save-state').textContent='Loading…';
  try {
    const next=await api('/api/state?week='+requestedWeek);
    if(requestNumber!==loadNumber || requestedWeek!==week) return;
    data=next;loaded=true;error('');$('#save-state').textContent='Saved across devices';
    if(renderPage) render();
  } catch(e){error(e.message);$('#save-state').textContent='Connection needs attention';if(!loaded)$('#content').innerHTML='<div class="empty"><h1>Your workspace could not load.</h1><p>Reconnect, then choose Refresh. Capture will be available when your saved records are ready.</p></div>';}
}
function pageHeading(label,title,description,extra=''){return `<div class="page-heading"><div><span class="eyebrow">${label}</span><h1>${title}</h1><p>${description}</p></div>${extra}</div>`;}
function empty(title,description,button=''){return `<div class="empty"><h3>${title}</h3><p>${description}</p>${button}</div>`;}
function meta(task){
  const p=project(task.project_id),a=appById(task.app_id);
  return `<div class="task-meta"><a href="${appURL(a.id)}" target="_blank" rel="noopener">${esc(a.name)}</a>${p?`<span>${esc(p.title)}</span>`:''}<span>${duration(task.minutes)}</span>${task.due_date?`<span class="${task.status==='open'&&task.due_date<today?'due':''}">${task.due_date<today&&task.status==='open'?'Overdue · ':''}${formatDay(task.due_date)}</span>`:''}</div>`;
}
function taskRow(t,focus=false,number=1){
  const selected=t.focus_date===today,done=t.status==='done';
  return `<article class="${focus?'focus-item':'task'}${done?' done':''}">${focus?`<span class="focus-number">0${number}</span>`:''}<button class="check" data-action="${done?'reopen':'complete'}" data-id="${esc(t.id)}" aria-label="${done?'Reopen':'Complete'} ${esc(t.title)}">${done?'✓':''}</button><div class="task-body"><div class="task-title">${esc(t.title)}</div>${meta(t)}<div class="task-actions">${!done?`<button class="text-button" data-action="focus" data-id="${esc(t.id)}">${selected?'Release priority':'Choose for today'}</button><button class="text-button" data-action="edit" data-id="${esc(t.id)}">Edit</button>${t.week_start!==week?`<button class="text-button" data-action="plan" data-id="${esc(t.id)}">Plan this week</button>`:''}<button class="text-button" data-action="archive" data-id="${esc(t.id)}">Archive</button>`:''}</div></div></article>`;
}
function todayView(){
  const focus=open().filter(t=>t.focus_date===today).sort((a,b)=>a.focus_slot-b.focus_slot);
  const waiting=open().filter(t=>t.focus_date!==today).sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  const finished=data.tasks.filter(t=>t.status==='done'&&t.completed_at&&localDay(new Date(t.completed_at))===today);
  const overdue=open().filter(t=>t.due_date&&t.due_date<today).length;
  return pageHeading('A deliberate day','Today, in focus.','Choose the few commitments that deserve your attention.')+
  `<div class="columns"><div><section class="panel focus-panel"><div class="section-heading"><h2>Your three priorities</h2><span>${focus.length} of 3 chosen</span></div><div class="focus-list">${focus.map((t,i)=>taskRow(t,true,i+1)).join('')}${Array.from({length:3-focus.length},(_,i)=>`<div class="empty-slot"><b>0${focus.length+i+1}</b><span>${i===0?'Choose a commitment from the list below.':'Leave room until you know what matters.'}</span></div>`).join('')}</div><div class="statline"><div><strong>${duration(focus.reduce((s,t)=>s+t.minutes,0))}</strong><span>Priority time</span></div><div><strong>${finished.length}</strong><span>Completed today</span></div><div><strong>${overdue}</strong><span>Past due</span></div></div></section>
  <section class="panel"><div class="section-heading"><div><h2>Ready to choose</h2><p>Due commitments appear first.</p></div><button class="text-button" data-capture>＋ Add</button></div>${waiting.length?waiting.map(t=>taskRow(t)).join(''):empty('Start with one concrete action.','Capture something you want to follow through on. You can connect it to a project and an app.', '<button class="secondary" data-capture>Capture a commitment</button>')}</section>${finished.length?`<section class="panel"><div class="section-heading"><h2>Completed today</h2></div>${finished.map(t=>taskRow(t)).join('')}</section>`:''}</div>
  <aside><section class="panel"><div class="section-heading"><h2>Prepare & reflect</h2></div><a class="mini-card" href="${appURL('courier')}" target="_blank" rel="noopener"><span class="mini-icon" aria-hidden="true">▱</span><div><h3>Open your Courier briefing</h3><p>Bring one useful idea into your day.</p></div></a><a class="mini-card" href="${appURL('communication-trainer')}" target="_blank" rel="noopener"><span class="mini-icon" aria-hidden="true">◇</span><div><h3>Rehearse a conversation</h3><p>Make room for a focused practice session.</p></div></a><div class="review-prompt"><p>What would make today feel well spent?</p></div><a class="inline-link" href="#week">Shape the rest of your week</a></section>
  <section class="panel"><span class="eyebrow">${data.projects.length?'Your connected work':'Begin with your own work'}</span><h2 class="wide-section">${data.projects.length?`${data.projects.length} Life Map projects`:'Bring your projects together.'}</h2><p class="quiet-message">${data.projects.length?'Manage a synced project and the commitments that move it forward.':'Import your Life Map projects, then choose the next commitment that moves one forward.'}</p><div class="wide-section">${data.projects.length?'<a class="inline-link" href="#projects">Open projects</a>':'<button class="secondary" data-import>Bring in Life Map</button>'}</div><p class="small">Synced Life Map projects share this workspace. Other apps retain their local records.</p></section></aside></div>`;
}
function weekControls(){return `<div class="week-switch"><button class="icon-button" data-week="-7" aria-label="Previous week">‹</button><span>${formatDay(week)} – ${formatDay(addDays(week,6))}</span><button class="icon-button" data-week="7" aria-label="Next week">›</button></div>`;}
function weekView(){
  const tasks=weekTasks(), minutes=tasks.reduce((s,t)=>s+t.minutes,0),capacity=data.week?.capacity??600;
  const carried=open().filter(t=>t.week_start&&t.week_start<week),unplanned=open().filter(t=>!t.week_start);
  return pageHeading('Make a realistic plan','A week with room.','Set a time budget for the commitments you track here.',weekControls())+
  `<div class="columns"><div><section class="panel"><div class="budget"><div><strong>${duration(minutes)} planned <span class="muted">/ ${duration(capacity)} available</span></strong><p>${minutes>capacity?`${duration(minutes-capacity)} over your budget. Move or resize a commitment.`:'Keep space for the parts of your week that are not on this list.'}</p><progress value="${Math.min(minutes,Math.max(capacity,1))}" max="${Math.max(capacity,1)}" aria-label="Planned time against weekly budget"></progress></div><label>Hours available<input id="capacity" type="number" min="0" max="168" step="0.5" value="${capacity/60}"></label><button class="secondary" id="save-capacity">Save</button></div><div class="section-heading"><h2>Planned commitments</h2><button class="text-button" data-capture>＋ Add</button></div>${tasks.length?tasks.map(t=>taskRow(t)).join(''):empty('Decide what this week can hold.','Add a commitment, or bring one forward from an earlier week.','<button class="secondary" data-capture>Plan a commitment</button>')}</section></div>
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
    return `<details class="connected-project"><summary><span><strong>${esc(p.title)}</strong><span class="small">${esc(p.area)}${p.due_date?' · Due '+formatDay(p.due_date):''} · ${p.status==='done'?'Completed':'Open'}</span></span><span class="badge">${p.mode==='managed'?'Synced':'Snapshot'}</span></summary><div class="project-body"><p class="small">${done} of ${tasks.length} linked commitments completed. Project status is a separate decision.</p><div class="project-toolbar">${!p.archived_at?`<button class="secondary" data-project="${esc(p.id)}">Add next action</button>`:''}${p.mode==='managed'?p.archived_at?action('Restore project','restore'):action('Edit project','edit')+action(p.status==='done'?'Reopen project':'Complete project',p.status==='done'?'reopen':'complete')+action('Archive','archive')+action('Return to import mode','disconnect'):action('Use synced project','connect')}</div>${tasks.map(t=>taskRow(t)).join('')}</div></details>`;
  }).join(''):empty('No matching projects.','Create a synced project or import your existing Life Map project list.','<button class="secondary" data-new-project>New project</button>');
}
function reviewView(){
  const summary=weeklySummary(data,week),done=summary.done,remaining=summary.unfinished;
  return pageHeading('Notice. Adjust. Continue.','Close the loop.','A short review of what moved forward and what needs to change.',weekControls())+
  `<div class="columns"><section class="panel"><div class="statline review-stats"><div><strong>${done.length}</strong><span>Completed this week</span></div><div><strong>${remaining.length}</strong><span>Unfinished through this week</span></div><div><strong>${duration(done.reduce((s,t)=>s+t.minutes,0))}</strong><span>Completed estimates</span></div></div><form id="review-form" class="review-form"><label>What worked?<textarea name="worked" maxlength="4000" placeholder="Notice the conditions that helped you follow through.">${esc(data.week?.worked||'')}</textarea></label><label>What will you change?<textarea name="change" maxlength="4000" placeholder="One adjustment worth carrying into next week.">${esc(data.week?.change||'')}</textarea></label><p class="small">Time totals use your estimates. Atlas is not measuring hours worked.</p><p id="review-error" class="form-error" role="alert"></p><button type="submit" class="primary">Save review</button></form></section><aside><section class="panel"><div class="section-heading"><h2>What moved forward</h2></div>${done.length?done.map(t=>taskRow(t)).join(''):empty('Your completed work will appear here.','Mark a commitment complete as you finish it. Each one keeps its project and app connection.')}</section><section class="panel"><h2>Projects completed</h2>${summary.projects.length?summary.projects.map(p=>`<p>${esc(p.title)}</p>`).join(''):'<p class="quiet-message">No project completion recorded this week.</p>'}<h2 class="wide-section">Next week’s deadlines</h2>${summary.deadlines.length?summary.deadlines.map(p=>`<p>${esc(p.title)} <span class="small">${formatDay(p.due_date)}</span></p>`).join(''):'<p class="quiet-message">No project deadlines recorded for next week.</p>'}</section><section class="panel"><div class="section-heading"><h2>Applied practice</h2><span>${summary.practice.length}</span></div>${data.practice?`<p class="small">Courier snapshot refreshed ${formatDay(data.practice.imported_at.slice(0,10))}. Changes in Courier need a new snapshot.</p>`:'<p class="quiet-message">Bring in recorded Courier practice to include it in this review.</p>'}${summary.practice.slice(0,20).map(p=>`<p>${esc(p.title)}<br><span class="small">${esc(p.track)} · ${formatDay(p.completedDay)}</span></p>`).join('')}<button class="secondary" data-practice-import>Refresh practice snapshot</button></section><section class="panel"><h2>Unfinished commitments</h2>${remaining.length?remaining.map(t=>taskRow(t)).join(''):'<p class="quiet-message">Nothing waiting from this or an earlier planned week.</p>'}<a class="inline-link" href="#week">Plan the next week</a></section></aside></div>`;
}
function appsView(){
  const groups=[...new Set(APPS.map(a=>a.group))];
  return pageHeading('One suite. Many perspectives.','Your Atlas ecosystem.','Open an existing app, or connect it to a commitment from Capture.')+
    groups.map(g=>`<h2 class="app-group">${g}</h2><div class="app-grid">${APPS.filter(a=>a.group===g).map(a=>`<a class="app-card" href="${appURL(a.id)}" target="_blank" rel="noopener"><span class="app-icon" aria-hidden="true">${a.icon}</span><div><h3>${esc(a.name)}</h3><p>${esc(a.detail)}</p></div></a>`).join('')}</div>`).join('')+
    '<p class="footer-note">Atlas Home is the shared workspace. Life Map projects open here; the other specialist apps retain their existing addresses and browser records.</p><button class="secondary" data-export>Export my Atlas data</button>';
}
function render(){
  document.querySelectorAll('[data-view]').forEach(a=>{if(a.dataset.view===view)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  $('#date-label').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  if(!loaded)return;
  $('#content').innerHTML=({today:todayView,week:weekView,projects:projectsView,review:reviewView,apps:appsView}[view]||todayView)();
  $('#capture').disabled=false;
}
function openCapture(projectId=null,task=null){
  if(!loaded){error('Wait for your workspace to load before capturing a commitment.');return;}
  editing=task;draftId=task?.id||crypto.randomUUID();
  const form=$('#task-form');form.reset();$('#task-error').textContent='';
  $('#task-dialog-title').textContent=task?'Edit commitment':'Capture a commitment';
  $('#app-select').innerHTML=APPS.filter(a=>a.group!=='Archive').map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join('');
  if(task?.app_id==='chambers-wealth-hq')$('#app-select').insertAdjacentHTML('beforeend','<option value="chambers-wealth-hq">Chambers Wealth HQ (legacy)</option>');
  $('#project-select').innerHTML='<option value="">No project</option>'+data.projects.map(p=>`<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('');
  const choices=[...new Set([week,monday(today),addDays(monday(today),7),task?.week_start].filter(Boolean))].sort();
  $('#week-select').innerHTML='<option value="">Unscheduled</option>'+choices.map(w=>`<option value="${w}">Week of ${formatDay(w)}</option>`).join('');
  form.elements.title.value=task?.title||'';form.elements.app_id.value=task?.app_id||'life-map';form.elements.project_id.value=task?.project_id||projectId||'';
  form.elements.week_start.value=task?task.week_start||'':week;form.elements.due_date.value=task?.due_date||'';
  if(task && ![15,30,60,90,120,180].includes(task.minutes))form.elements.minutes.insertAdjacentHTML('beforeend',`<option value="${task.minutes}">${duration(task.minutes)}</option>`);
  form.elements.minutes.value=String(task?.minutes||30);
  $('#task-dialog').showModal();form.elements.title.focus();
}
async function mutate(task,action){
  if(reviewDirty){error('Save your review before changing other records.');return;}
  if(busy)return;busy=true;error('');$('#save-state').textContent='Saving…';
  try {
    await api('/api/tasks/'+encodeURIComponent(task.id),'PATCH',{revision:task.revision,action,day:today,week_start:week});
    await load();
    const current=data.tasks.find(t=>t.id===task.id);
    toast(({complete:'Commitment completed.',reopen:'Commitment reopened.',archive:'Commitment archived.',focus:'Your priorities are updated.',plan:'Added to the selected week.'})[action]||'Saved.',
      ['complete','archive'].includes(action)&&current&&current.revision>task.revision?()=>mutate(current,'reopen'):null);
  }catch(e){error(e.message);$('#save-state').textContent='Change not saved';}
  finally{busy=false;}
}
async function saveWeek(values){
  await api('/api/week','PUT',{week_start:week,capacity:data.week?.capacity??600,worked:data.week?.worked||'',change:data.week?.change||'',revision:data.week?.revision??0,...values});
}
function openProjectEditor(p=null){
  editingProject=p;projectDraftId=p?.id||crypto.randomUUID();
  const form=$('#project-form');form.reset();form.elements.title.value=p?.title||'';form.elements.area.value=p?.area||'';form.elements.due_date.value=p?.due_date||'';
  $('#project-dialog-title').textContent=p?'Edit synced project':'New synced project';$('#project-error').textContent='';$('#project-dialog').showModal();form.elements.title.focus();
}
async function mutateProject(p,action){
  if(reviewDirty){error('Save your review before changing other records.');return false;}
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
  const close=event.target.closest('[data-close]');if(close){document.getElementById(close.dataset.close).close();return;}
  if(reviewDirty&&event.target.closest('[data-capture],#capture,[data-import],[data-project],[data-action],[data-project-action],[data-new-project],[data-practice-import]')){error('Save your review before changing other records.');return;}
  if(event.target.closest('[data-new-project]')){openProjectEditor();return;}
  if(event.target.closest('[data-project-export]')){await exportProjectUpdates();return;}
  if(event.target.closest('[data-practice-import]')){practiceImport=null;practiceRevision=data.practice?.revision||0;$('#practice-file').value='';$('#practice-preview').innerHTML='';$('#practice-error').textContent='';$('#practice-confirm').disabled=true;$('#practice-dialog').showModal();return;}
  const projectAction=event.target.closest('[data-project-action]');if(projectAction){const p=project(projectAction.dataset.id),act=projectAction.dataset.projectAction;if(!p)return;if(act==='edit')openProjectEditor(p);else if(['connect','disconnect','archive'].includes(act))confirmProject(p,act);else await mutateProject(p,act);return;}
  if(event.target.closest('[data-capture]') || event.target.closest('#capture')){openCapture();return;}
  if(event.target.closest('[data-import]')){$('#import-dialog').showModal();return;}
  const next=event.target.closest('[data-project]');if(next){openCapture(next.dataset.project);return;}
  const action=event.target.closest('[data-action]');if(action){const task=data.tasks.find(t=>t.id===action.dataset.id);if(!task)return;if(action.dataset.action==='edit')openCapture(null,task);else await mutate(task,action.dataset.action);return;}
  const shift=event.target.closest('[data-week]');if(shift){if(reviewDirty){error('Save your review before changing weeks.');return;}week=addDays(week,Number(shift.dataset.week));await load();return;}
  if(event.target.closest('#save-capacity')){
    const hours=Number($('#capacity').value),button=$('#save-capacity');button.disabled=true;
    try{await saveWeek({capacity:Math.round(hours*60)});await load();toast('Weekly time budget saved.');}catch(e){error(e.message);}finally{button.disabled=false;}
  }
});
$('#project-confirm').addEventListener('click',async()=>{const button=$('#project-confirm');button.disabled=true;try{if(projectConfirmation&&await mutateProject(projectConfirmation.project,projectConfirmation.action))$('#project-confirm-dialog').close();}finally{button.disabled=false;}});
$('#project-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;$('#project-error').textContent='';
  const values=Object.fromEntries(new FormData(form));values.due_date=values.due_date||null;
  try{if(editingProject)await api('/api/projects/'+encodeURIComponent(editingProject.id),'PATCH',{...values,revision:editingProject.revision,action:'edit'});else await api('/api/projects','POST',{...values,id:projectDraftId});$('#project-dialog').close();await load();toast('Project saved privately across devices.');}
  catch(e){$('#project-error').textContent=e.message;}finally{button.disabled=false;}
});
$('#practice-file').addEventListener('change',async event=>{
  practiceImport=null;$('#practice-confirm').disabled=true;$('#practice-preview').innerHTML='';$('#practice-error').textContent='';const file=event.target.files[0];if(!file)return;
  try{if(file.size>25000000)throw Error('Choose a backup smaller than 25 MB.');practiceImport=parsePracticeSnapshot(await file.text());$('#practice-preview').innerHTML=`<p>${practiceImport.items.length} completions will replace ${data.practice?.items.length||0} previously saved completions.</p><p class="small">Backup date: ${practiceImport.source_exported_at?esc(practiceImport.source_exported_at.slice(0,10)):'unavailable'}. Only this reviewed snapshot will be saved.</p><div class="import-list">${practiceImport.items.slice(0,30).map(p=>`<div class="import-row">${esc(p.title)}<span>${esc(p.track)} · ${esc(p.completedDay)}</span></div>`).join('')}</div>`;$('#practice-confirm').disabled=false;}
  catch(e){$('#practice-error').textContent=e.message;}
});
$('#practice-confirm').addEventListener('click',async()=>{
  if(!practiceImport)return;const button=$('#practice-confirm');button.disabled=true;
  try{await api('/api/practice','PUT',{...practiceImport,revision:practiceRevision});$('#practice-dialog').close();await load();toast('Reviewed practice snapshot saved.');}
  catch(e){$('#practice-error').textContent=e.message;}finally{button.disabled=false;}
});
$('#task-form').addEventListener('submit',async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type="submit"]');if(button.disabled)return;button.disabled=true;$('#task-error').textContent='';
  const values=Object.fromEntries(new FormData(form));values.minutes=Number(values.minutes);values.project_id=values.project_id||null;values.week_start=values.week_start||null;values.due_date=values.due_date||null;
  try {
    if(editing)await api('/api/tasks/'+encodeURIComponent(editing.id),'PATCH',{...values,action:'edit',revision:editing.revision});
    else await api('/api/tasks','POST',{...values,id:draftId});
    $('#task-dialog').close();await load();toast(editing?'Commitment updated.':'Commitment captured. Choose it for today when you are ready.');
  }catch(e){$('#task-error').textContent=e.message;}finally{button.disabled=false;}
});
document.addEventListener('submit',async event=>{
  if(event.target.id!=='review-form')return;event.preventDefault();const form=event.target,button=form.querySelector('button');button.disabled=true;
  try{await saveWeek(Object.fromEntries(new FormData(form)));reviewDirty=false;await load();toast('Your weekly review is saved.');}catch(e){$('#review-error').textContent=e.message;}finally{button.disabled=false;}
});
document.addEventListener('input',event=>{
  if(event.target.closest('#review-form'))reviewDirty=true;
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
$('#refresh').addEventListener('click',async()=>{if(reviewDirty){error('Save your review before refreshing.');return;}await load();});
$('#undo').addEventListener('click',()=>{const action=undoAction;undoAction=null;$('#toast').hidden=true;if(action)action();});
$('#dismiss-toast').addEventListener('click',()=>{$('#toast').hidden=true;undoAction=null;});
async function exportData(){
  try{const snapshot=await api('/api/export');const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`atlas-os-${today}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Your Atlas data was exported.');}catch(e){error(e.message);}
}
$('#export').addEventListener('click',exportData);
window.addEventListener('hashchange',()=>{
  const next=location.hash.slice(1)||'today';
  if(reviewDirty){if(next!==view){location.hash=view;error('Save your review before leaving this page.');}return;}
  view=['today','week','projects','review','apps'].includes(next)?next:'today';render();
});
window.addEventListener('beforeunload',event=>{if(reviewDirty || ($('#task-dialog').open && $('#task-form').elements.title.value.trim()) || ($('#project-dialog').open && $('#project-form').elements.title.value.trim())){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!reviewDirty&&!document.querySelector('dialog[open]')){const next=localDay();if(next!==today){today=next;week=monday(today);}load();}});
$('#capture').disabled=true;view=['today','week','projects','review','apps'].includes(location.hash.slice(1))?location.hash.slice(1):'today';render();load();
