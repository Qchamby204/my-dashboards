import {WEEKDAYS,routine,routineLabel,routineWeek,parseCadenceTransfer} from './cadence.mjs';
import {newId,addDays,LEGACY_ORIGIN} from './model.mjs';

export function createCadenceUI({api,getData,getWeek,getToday,load,blocked,error,toast,esc,formatDay}){
  const $=s=>document.querySelector(s);let editing=null,saving=false,plan=null,ticket=0;
  const saved=()=>getData().cadence;
  const tasks=()=>getData().tasks||[];
  const used=id=>tasks().some(t=>t.routine_id===id);
  const status=t=>t.status==='archived'?'Skipped / archived':t.status==='done'?'Completed':'Open';
  function occurrences(week,compact=false){
    const rows=routineWeek(getData(),week),open=rows.filter(t=>t.status==='open'),shown=compact?open.slice(0,5):rows;
    return `<section class="panel"><div class="section-heading"><div><span class="eyebrow">Operations Cadence</span><h2>${compact?'Routines due this week':'Dated routine commitments'}</h2></div><span>${open.length} open</span></div><p class="small">${esc(formatDay(week))} – ${esc(formatDay(addDays(week,6)))} · ${rows.filter(t=>t.status==='done').length} completed · ${rows.filter(t=>t.status==='archived').length} skipped / archived</p>${shown.map(t=>`<div class="routine-occurrence"><div><strong>${esc(t.title)}</strong><p class="small">${esc(formatDay(t.occurrence_date))} · ${status(t)}${t.due_date!==t.occurrence_date?' · Due date changed':''}</p></div><div class="task-actions">${t.status==='open'?`<button class="text-button" data-action="complete" data-id="${esc(t.id)}">Complete</button><button class="text-button" data-action="archive" data-id="${esc(t.id)}">Skip occurrence</button><button class="text-button" data-action="edit" data-id="${esc(t.id)}">Details</button>`:`<button class="text-button" data-action="${t.status==='archived'?'restore':'reopen'}" data-id="${esc(t.id)}">${t.status==='archived'?'Restore':'Reopen'}</button>`}</div></div>`).join('')||'<p class="quiet-message">No open routine commitments in this view.</p>'}${compact?`<a class="inline-link" href="#cadence">${open.length>5?'View all '+open.length+' open routines':'Open Operations Cadence'}</a>`:'<p class="small">Skipping archives only this occurrence. It does not pause the routine. Changing a commitment’s details leaves the routine schedule unchanged.</p>'}</section>`;
  }
  function page(){
    const routines=saved()?.routines||[];
    return `<div class="page-heading"><div><span class="eyebrow">A rhythm you can rely on</span><h1>Operations Cadence.</h1><p>Weekly and monthly routines, with a separate commitment for each occurrence.</p></div><button class="primary" data-cadence-new>＋ New routine</button></div><div class="project-toolbar"><button class="secondary" data-cadence-import>Import original routines</button><a class="inline-link" href="${LEGACY_ORIGIN}operations-cadence.html" target="_blank" rel="noopener">Open original Operations</a></div><p class="import-note">Opening Today, This week, or Operations adds missing occurrences for the selected week. Nothing is added while Atlas is closed. Pausing stops new occurrences; existing commitments stay in your plan. Earlier unvisited weeks are not filled automatically.</p><div class="week-switch"><button class="icon-button" data-week="-7" aria-label="Previous routine week">‹</button><span>${esc(formatDay(getWeek()))} – ${esc(formatDay(addDays(getWeek(),6)))}</span><button class="icon-button" data-week="7" aria-label="Next routine week">›</button></div><div class="columns"><div>${occurrences(getWeek())}</div><aside><section class="panel"><div class="section-heading"><h2>Your routines</h2><span>${routines.filter(r=>!r.paused).length} active</span></div>${routines.map(r=>{
      const history=tasks().filter(t=>t.routine_id===r.id).sort((a,b)=>b.occurrence_date.localeCompare(a.occurrence_date));
      return `<article class="routine-definition"><div class="section-heading"><h3>${esc(r.title)}</h3><span class="badge">${r.paused?'Paused':'Active'}</span></div><p class="small">${esc(routineLabel(r))} · ${r.minutes} min<br>From ${esc(formatDay(r.start_date))}</p><div class="task-actions"><button class="text-button" data-cadence-edit="${esc(r.id)}">Edit routine</button><button class="text-button" data-cadence-action="${r.paused?'resume':'pause'}" data-id="${esc(r.id)}">${r.paused?'Resume from today':'Pause routine'}</button></div><details><summary>Occurrence history · ${history.length}</summary>${history.slice(0,20).map(t=>`<p class="small">${esc(formatDay(t.occurrence_date))} · ${status(t)}${t.completed_at?' · Completed '+esc(formatDay(t.completed_at.slice(0,10))):''}<br>${esc(t.title)}</p>`).join('')||'<p class="small">No dated commitments yet.</p>'}${history.length>20?'<p class="small">Showing the latest 20. All occurrences remain in Commitments and your workspace export.</p>':''}</details></article>`;
    }).join('')||'<p class="quiet-message">Start with one weekly or monthly routine, such as reviewing your week.</p>'}</section></aside></div>`;
  }
  function dayOptions(frequency,value=1){$('#cadence-form').elements.day.innerHTML=(frequency==='weekly'?WEEKDAYS.map((label,i)=>[i,label]):Array.from({length:31},(_,i)=>[i+1,String(i+1)])).map(([v,label])=>`<option value="${v}"${v===Number(value)?' selected':''}>${label}</option>`).join('');}
  function freeze(){
    const form=$('#cadence-form');form.querySelectorAll('input,select,button').forEach(c=>c.disabled=saving);
    const locked=editing?.existing&&(!editing.routine.paused||used(editing.routine.id));
    for(const name of ['frequency','day','start_date'])form.elements[name].disabled=saving||!!locked;
    form.setAttribute('aria-busy',String(saving));
  }
  function openEditor(r=null){
    editing={routine:r?structuredClone(r):{id:'routine-'+newId(),source_id:null,title:'',frequency:'weekly',day:1,start_date:getToday(),minutes:30,paused:false},revision:saved()?.revision||0,existing:!!r};
    const form=$('#cadence-form');for(const name of ['title','frequency','start_date','minutes'])form.elements[name].value=String(editing.routine[name]);dayOptions(editing.routine.frequency,editing.routine.day);
    $('#cadence-title').textContent=r?'Edit routine':'New routine';$('#cadence-error').textContent='';$('#cadence-schedule-note').textContent=r&&(!r.paused||used(r.id))?'This schedule is fixed. To change it, pause this routine and create a new one. Title and estimate changes apply to newly generated occurrences.':'Monthly dates use the last day of shorter months. Your start date limits the first occurrence.';
    freeze();$('#cadence-dialog').showModal();form.elements.title.focus();
  }
  function values(){const f=$('#cadence-form').elements;return {...editing.routine,title:f.title.value,frequency:f.frequency.value,day:Number(f.day.value),start_date:f.start_date.value,minutes:Number(f.minutes.value)};}
  $('#cadence-form').elements.frequency.addEventListener('change',e=>dayOptions(e.target.value));
  $('#cadence-form').addEventListener('submit',async e=>{
    e.preventDefault();if(saving||!editing)return;let r;try{r=routine(values());}catch(err){$('#cadence-error').textContent=err.message;return;}
    saving=true;freeze();$('#cadence-error').textContent='';
    try{await api('/api/cadence/routine',editing.existing?'PATCH':'POST',{routine:r,id:r.id,revision:editing.revision,action:'edit'});editing=null;$('#cadence-dialog').close();await load();toast('Routine saved. Each occurrence keeps its own completion.');}
    catch(err){$('#cadence-error').textContent=err.message+' Your draft is still here.';}
    finally{saving=false;freeze();}
  });
  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-cadence-new],[data-cadence-edit],[data-cadence-action],[data-cadence-import],[data-cadence-discard],[data-cadence-close],[data-cadence-import-close]');if(!t||saving)return;
    if(t.hasAttribute('data-cadence-close')){$('#cadence-error').textContent='Save your draft or choose Discard & reload.';return;}
    if(t.hasAttribute('data-cadence-discard')){editing=null;$('#cadence-dialog').close();saving=true;freeze();try{await load();}finally{saving=false;freeze();}return;}
    if(t.hasAttribute('data-cadence-import-close')){ticket++;plan=null;$('#cadence-import-dialog').close();return;}
    if(blocked()||document.querySelector('dialog[open]')){error('Save or discard your current draft before changing routines.');return;}
    if(t.hasAttribute('data-cadence-new')){openEditor();return;}
    if(t.hasAttribute('data-cadence-edit')){const r=saved()?.routines.find(r=>r.id===t.dataset.cadenceEdit);if(r)openEditor(r);return;}
    if(t.hasAttribute('data-cadence-action')){saving=true;t.disabled=true;try{await api('/api/cadence/routine','PATCH',{id:t.dataset.id,action:t.dataset.cadenceAction,day:getToday(),revision:saved()?.revision||0});await load();toast(t.dataset.cadenceAction==='pause'?'Routine paused. Existing commitments are kept.':'Routine resumed from today.');}catch(err){error(err.message);}finally{saving=false;t.disabled=false;}return;}
    ticket++;plan=null;$('#cadence-file').value='';$('#cadence-import-preview').innerHTML='';$('#cadence-import-error').textContent='';$('#cadence-consent').checked=false;$('#cadence-import-confirm').disabled=true;$('#cadence-import-dialog').showModal();
  });
  $('#cadence-file').addEventListener('change',async e=>{
    const request=++ticket;plan=null;$('#cadence-import-confirm').disabled=true;$('#cadence-consent').checked=false;$('#cadence-import-preview').innerHTML='';$('#cadence-import-error').textContent='';const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>20000000)throw Error('Choose a Vault export smaller than 20 MB.');
      const pack=await parseCadenceTransfer(await file.text(),getToday());if(request!==ticket)return;
      const next=await api('/api/cadence/import/preview','POST',{pack});if(request!==ticket)return;plan=next;
      $('#cadence-import-preview').innerHTML=`<h3>${next.added} routines to add · ${next.kept} kept</h3><p>New routines start paused with a 30-minute estimate. Review each schedule before resuming. Unspecified weekly days use Monday; monthly days use day 1. Reimport keeps your saved choices.</p>${pack.unsupported?`<p>${pack.unsupported} unsupported repeat rules were left in the original app.</p>`:''}<div class="import-list">${next.rows.map(r=>`<div class="import-row"><strong>${r.action} · ${esc(r.schedule)}</strong><span>${esc(r.title)}</span></div>`).join('')}</div>`;
      $('#cadence-import-confirm').disabled=!$('#cadence-consent').checked;
    }catch(err){if(request===ticket)$('#cadence-import-error').textContent=err.message;}
  });
  $('#cadence-consent').addEventListener('change',()=>{$('#cadence-import-confirm').disabled=!plan||!$('#cadence-consent').checked;});
  $('#cadence-import-confirm').addEventListener('click',async()=>{
    if(saving||!plan||!$('#cadence-consent').checked)return;saving=true;$('#cadence-import-dialog').querySelectorAll('input,button').forEach(c=>c.disabled=true);
    try{await api('/api/cadence/import','POST',{pack:plan.pack,revision:plan.revision,digest:plan.digest});plan=null;$('#cadence-import-dialog').close();await load();toast('Routines imported paused. Review their schedules, then resume the ones you want.');}
    catch(err){plan=null;$('#cadence-import-error').textContent=err.message+' Choose the file again to review a fresh import.';}
    finally{saving=false;$('#cadence-import-dialog').querySelectorAll('input,button').forEach(c=>c.disabled=false);$('#cadence-import-confirm').disabled=true;}
  });
  $('#cadence-dialog').addEventListener('cancel',e=>{e.preventDefault();if(!saving)$('#cadence-error').textContent='Save your draft or choose Discard & reload.';});
  $('#cadence-import-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();else{ticket++;plan=null;}});
  return {page,home:()=>occurrences(getWeek(),true),openRecord(id){if(saving||blocked())return false;const r=saved()?.routines.find(r=>r.id===id);if(!r)return false;openEditor(r);return true;},get dirty(){return !!editing||$('#cadence-import-dialog').open;},get saving(){return saving;}};
}
