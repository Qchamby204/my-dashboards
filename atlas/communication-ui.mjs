import { localDay, newId, LEGACY_ORIGIN } from './model.mjs';
import { parseCommunicationTransfer, communicationWeek } from './communication.mjs';

export function createCommunicationUI({api,getData,getWeek,load,render,error,toast,esc,downloadJSON,blocked}){
  const $=s=>document.querySelector(s),pretty=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const saved=()=>getData().communication;
  let editing=null,saving=false,plan=null,ticket=0,query='',filter='active',limit=40;
  function rows(){
    const all=(saved()?.reps||[]).filter(r=>r.archived===(filter==='archived')&&`${r.topic} ${r.drill} ${r.skill}`.toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>b.day.localeCompare(a.day)||a.id.localeCompare(b.id));
    return `${all.slice(0,limit).map(r=>`<article class="communication-rep"><div><h3>${esc(r.topic)}</h3><p class="small">${esc(pretty(r.day))} · ${esc(r.drill)}${r.skill?' · '+esc(r.skill):''}${r.id.startsWith('legacy:')?' · Imported session':''}</p>${r.note?`<p class="lesson-instructions">${esc(r.note)}</p>`:''}</div><div class="review-actions"><button class="text-button" data-communication-edit="${r.id}">Edit</button><button class="text-button" data-communication-action="${r.archived?'restore':'archive'}" data-id="${r.id}">${r.archived?'Restore':'Archive'}</button></div></article>`).join('')||'<p class="quiet-message">No sessions here yet. Log a completed practice session or import earlier ones.</p>'}${all.length>limit?`<button class="secondary" data-communication-more>Show more sessions</button><p class="small">Showing ${Math.min(all.length,limit)} of ${all.length}.</p>`:''}`;
  }
  function page(){
    const active=(saved()?.reps||[]).filter(r=>!r.archived),thisWeek=communicationWeek(saved(),getWeek());
    return `<div class="page-heading"><div><span class="eyebrow">Practice that carries forward</span><h1>Master Communicator.</h1><p>Keep a record of the conversations and speaking skills you practise.</p></div><button class="primary" data-communication-new>Log completed practice</button></div>
      <div class="project-toolbar"><button class="secondary" data-communication-import>Import earlier sessions</button><a class="inline-link" href="${LEGACY_ORIGIN}communication-trainer.html" target="_blank" rel="noopener">Open original drills</a><a class="inline-link" href="#review">Open weekly review</a></div>
      <section class="panel"><div class="section-heading"><h2>Your practice log</h2><span>${active.length} saved · ${thisWeek.length} in the week of ${esc(pretty(getWeek()))}</span></div><p class="small">Sessions save privately across devices. Logging a session records practice you have completed. Original drills keep their own browser records.</p><div class="filters"><input id="communication-search" aria-label="Search speaking sessions" placeholder="Find a topic, drill, or skill…" value="${esc(query)}"><select id="communication-filter" aria-label="Filter speaking sessions"><option value="active"${filter==='active'?' selected':''}>Active sessions</option><option value="archived"${filter==='archived'?' selected':''}>Archived sessions</option></select></div><div id="communication-list">${rows()}</div></section>`;
  }
  function weekly(){const reps=communicationWeek(saved(),getWeek());return `<section class="panel"><div class="section-heading"><h2>Speaking practice</h2><span>${reps.length} ${reps.length===1?'session':'sessions'}</span></div>${reps.slice(-12).reverse().map(r=>`<p>${esc(r.topic)}<br><span class="small">${esc(pretty(r.day))} · ${esc(r.drill)}</span></p>`).join('')||'<p class="quiet-message">Completed speaking sessions from this week will appear here.</p>'}${reps.length>12?'<p class="small">Showing the latest 12 sessions.</p>':''}<a class="inline-link" href="#communication">Open Master Communicator</a></section>`;}
  function openEditor(rep=null){
    editing={rep:rep?structuredClone(rep):{id:'atlas:'+newId(),day:localDay(),topic:'',drill:'Free practice',skill:'',note:'',archived:false,source_timestamp:null},revision:saved()?.revision||0,existing:!!rep};
    const form=$('#communication-form');for(const name of ['day','topic','drill','skill','note'])form.elements[name].value=editing.rep[name];
    $('#communication-edit-title').textContent=rep?'Edit speaking practice':'Log completed practice';$('#communication-error').textContent='';$('#communication-dialog').showModal();form.elements.topic.focus();
  }
  function values(){const form=$('#communication-form'),rep={...editing.rep};for(const name of ['day','topic','drill','skill','note'])rep[name]=form.elements[name].value;return rep;}
  document.addEventListener('input',e=>{if(e.target.id==='communication-search'){query=e.target.value;limit=40;$('#communication-list').innerHTML=rows();}});
  document.addEventListener('change',e=>{if(e.target.id==='communication-filter'){filter=e.target.value;limit=40;$('#communication-list').innerHTML=rows();}});
  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-communication-new],[data-communication-edit],[data-communication-action],[data-communication-import],[data-communication-more],[data-communication-download],[data-communication-reload]');if(!t||saving)return;
    if(t.hasAttribute('data-communication-download')){if(editing)downloadJSON({app:'atlas-communication-draft',version:1,exportedAt:new Date().toISOString(),rep:values(),revision:editing.revision},'atlas-speaking-draft.json');return;}
    if(t.hasAttribute('data-communication-reload')){editing=null;$('#communication-dialog').close();await load();return;}
    if(blocked()){error('Save or discard your current draft before changing other records.');return;}
    if(t.hasAttribute('data-communication-more')){limit+=40;$('#communication-list').innerHTML=rows();return;}
    if(t.hasAttribute('data-communication-new')){openEditor();return;}
    if(t.hasAttribute('data-communication-edit')){const rep=saved()?.reps.find(r=>r.id===t.dataset.communicationEdit);if(rep)openEditor(rep);return;}
    if(t.hasAttribute('data-communication-action')){
      saving=true;t.disabled=true;
      try{await api('/api/communication/rep','PATCH',{id:t.dataset.id,action:t.dataset.communicationAction,revision:saved()?.revision||0});await load();toast(t.dataset.communicationAction==='archive'?'Session archived. Future imports will keep that choice.':'Session restored to your practice log.');}catch(err){error(err.message);}finally{saving=false;t.disabled=false;}return;
    }
    ticket++;plan=null;$('#communication-file').value='';$('#communication-import-preview').innerHTML='';$('#communication-import-error').textContent='';$('#communication-consent').checked=false;$('#communication-import-confirm').disabled=true;$('#communication-import-dialog').showModal();
  });
  $('#communication-form').addEventListener('submit',async e=>{
    e.preventDefault();if(saving||!editing)return;saving=true;const form=e.currentTarget,rep=values(),controls=[...form.querySelectorAll('input,textarea,button')];controls.forEach(x=>x.disabled=true);$('#communication-error').textContent='';
    try{await api('/api/communication/rep',editing.existing?'PATCH':'POST',{rep,revision:editing.revision,id:editing.rep.id,action:'edit'});editing=null;$('#communication-dialog').close();await load();toast('Speaking practice saved across devices.');}
    catch(err){$('#communication-error').textContent=err.message+' Your draft is still here.';}
    finally{saving=false;controls.forEach(x=>x.disabled=false);}
  });
  $('#communication-file').addEventListener('change',async e=>{
    const request=++ticket;plan=null;$('#communication-import-confirm').disabled=true;$('#communication-consent').checked=false;$('#communication-import-preview').innerHTML='';$('#communication-import-error').textContent='';const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>8000000)throw Error('Choose an export smaller than 8 MB.');
      const pack=await parseCommunicationTransfer(await file.text());if(request!==ticket)return;
      const next=await api('/api/communication/import/preview','POST',{pack});if(request!==ticket)return;plan=next;
      $('#communication-import-preview').innerHTML=`<h3>${next.added} sessions to add · ${next.kept} kept as saved</h3><p>Existing sessions keep their saved details and archive choices. No session is removed.</p><div class="import-list">${next.rows.slice(0,100).map(r=>`<div class="import-row"><strong>${r.action} · ${esc(pretty(r.day))}</strong><span>${esc(r.title)}</span></div>`).join('')}</div>${next.rows.length>100?`<p class="small">Showing 100 of ${next.rows.length} records. Counts include every session.</p>`:''}`;
      $('#communication-import-confirm').disabled=!$('#communication-consent').checked;
    }catch(err){if(request===ticket)$('#communication-import-error').textContent=err.message;}
  });
  $('#communication-consent').addEventListener('change',()=>{$('#communication-import-confirm').disabled=!plan||!$('#communication-consent').checked;});
  $('#communication-import-confirm').addEventListener('click',async()=>{
    const button=$('#communication-import-confirm');if(saving||button.disabled||!plan||!$('#communication-consent').checked)return;saving=true;button.disabled=true;$('#communication-file').disabled=true;
    try{await api('/api/communication/import','POST',{pack:plan.pack,digest:plan.digest,revision:plan.revision});plan=null;$('#communication-import-dialog').close();await load();toast('Reviewed sessions imported. Your saved choices are kept.');}
    catch(err){plan=null;$('#communication-import-error').textContent=err.message+' Choose the file again to review a fresh import.';}
    finally{saving=false;$('#communication-file').disabled=false;button.disabled=true;}
  });
  for(const id of ['#communication-dialog','#communication-import-dialog'])$(id).addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('#communication-dialog').addEventListener('close',()=>{editing=null;});
  $('#communication-import-dialog').addEventListener('close',()=>{ticket++;plan=null;});
  return {page,weekly,openRecord(id){if(saving||blocked())return false;const rep=saved()?.reps.find(r=>r.id===id);if(!rep)return false;openEditor(rep);return true;},get dirty(){return !!editing||$('#communication-import-dialog').open;},get saving(){return saving;}};
}
