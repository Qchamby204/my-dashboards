import { localDay, validDate, newId } from './model.mjs';
import { parseLedgerTransfer, ledgerWeek } from './ledger.mjs';

export function createLedgerUI({api,getData,load,render,error,toast,esc,downloadJSON,blocked}){
  const $=s=>document.querySelector(s),pretty=d=>new Date(d+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric'});
  let selected=null,draft=null,dirty=false,saving=false,plan=null,ticket=0,editing=null;
  const saved=()=>getData().ledger;
  function reset(){const p=saved(),date=selected||localDay();draft={date,checked:[],note:'',tomorrow:'',...structuredClone(p?.days.find(d=>d.date===date)||{}),revision:p?.revision||0};dirty=false;}
  function daily(){
    if(!dirty)reset();const p=saved(),shown=(p?.habits||[]).filter(h=>!h.archived||draft.checked.includes(h.id));
    return `<div class="page-heading"><div><span class="eyebrow">A little attention, every day</span><h1>Life Ledger.</h1><p>Notice what mattered. Leave a little room for tomorrow.</p></div><button class="secondary" data-ledger-import>Import earlier days</button></div>
      <div class="ledger-date"><label>Day<input type="date" id="ledger-date" value="${draft.date}" required></label><button class="secondary" data-ledger-date="${localDay()}">Today</button><span class="small">${p?'Saved privately across devices':'Your first save starts your private Ledger'}</span></div>
      <div class="columns"><section class="panel"><form id="ledger-day-form"><h2>${esc(pretty(draft.date))}</h2><p class="small">Check in with the habits you choose. An unchecked box carries no penalty.</p><fieldset class="ledger-checks"><legend>Daily check-ins</legend>${shown.length?shown.map(h=>`<label><input type="checkbox" name="habit" value="${esc(h.id)}"${draft.checked.includes(h.id)?' checked':''}><span>${esc(h.title)}${h.archived?' <small>Archived habit</small>':''}</span></label>`).join(''):'<p class="quiet-message">Add a habit when you’re ready. You can save a reflection on its own.</p>'}</fieldset>
      <label>What mattered today? <span class="optional">optional</span><textarea name="note" maxlength="4000" placeholder="A moment, a small win, or something you noticed.">${esc(draft.note)}</textarea></label><label>What would help tomorrow? <span class="optional">optional</span><textarea name="tomorrow" maxlength="4000" placeholder="One thought to carry forward.">${esc(draft.tomorrow)}</textarea></label>
      <p id="ledger-save-error" class="form-error" role="alert"></p><div class="ledger-actions"><button type="submit" class="primary">Save day</button><span id="ledger-draft-state" class="small" role="status">${dirty?'Unsaved draft':p?.days.some(d=>d.date===draft.date)?'Saved day':'New day'}</span></div><div class="ledger-actions"><button type="button" class="text-button" data-ledger-download>Download draft</button><button type="button" class="text-button" data-ledger-reload>Discard draft & reload day</button></div></form></section>
      <aside><section class="panel"><div class="section-heading"><h2>Your habits</h2><button class="text-button" data-ledger-new>Add habit</button></div><p class="small">Keep a short list that fits your life. Archiving keeps earlier check-ins.</p>${(p?.habits||[]).filter(h=>!h.archived).map(h=>habitRow(h)).join('')||'<p class="quiet-message">Try reading, making something, or helping at home.</p>'}${p?.habits.some(h=>h.archived)?`<details class="wide-section"><summary>Archived habits</summary>${p.habits.filter(h=>h.archived).map(h=>habitRow(h)).join('')}</details>`:''}</section>
      <section class="panel"><h2>Recent saved days</h2>${p?.days.length?p.days.slice(-7).reverse().map(d=>`<button class="ledger-recent" data-ledger-date="${d.date}"><strong>${esc(pretty(d.date))}</strong><span class="small">${d.checked.length} check-ins${d.note||d.tomorrow?' · Reflection saved':''}</span></button>`).join(''):'<p class="quiet-message">Your saved days will appear here. Use the date picker to revisit any day.</p>'}<p class="small">${p?.days.length||0} saved days. Use the date picker for earlier entries.</p><a class="inline-link" href="#review">Open weekly review</a></section></aside></div>
      <p class="footer-note">Original Life Ledger keeps a separate browser copy. Export a workspace backup from History & recovery to keep your synced check-ins and reflection.</p>`;
  }
  function habitRow(h){return `<div class="ledger-habit"><span>${esc(h.title)}</span><div><button class="text-button" data-ledger-edit="${esc(h.id)}">Rename</button><button class="text-button" data-ledger-habit="${esc(h.id)}" data-ledger-action="${h.archived?'restore':'archive'}">${h.archived?'Restore':'Archive'}</button></div></div>`;}
  function weekly(week){const days=ledgerWeek(saved(),week);return `<section class="panel"><h2>Daily reflection</h2><p class="small">${days.length} saved days this week. From your private Life Ledger.</p>${days.filter(d=>d.note||d.tomorrow).map(d=>`<details class="ledger-reflection"><summary>${esc(pretty(d.date))}</summary>${d.note?`<p class="lesson-instructions">${esc(d.note)}</p>`:''}${d.tomorrow?`<p class="small">For tomorrow</p><p class="lesson-instructions">${esc(d.tomorrow)}</p>`:''}</details>`).join('')||'<p class="quiet-message">Your daily notes will appear here to help with the weekly review.</p>'}<a class="inline-link" href="#ledger">Open Life Ledger</a></section>`;}
  function forbid(){if(saving||blocked()){error('Save or discard your current draft before changing other records.');return true;}return false;}
  document.addEventListener('input',e=>{
    if(e.target.closest('#ledger-day-form')){
      if(!draft)reset();const form=$('#ledger-day-form');draft={...draft,checked:[...form.querySelectorAll('[name="habit"]:checked')].map(x=>x.value),note:form.elements.note.value,tomorrow:form.elements.tomorrow.value};
      dirty=true;$('#ledger-draft-state').textContent='Unsaved draft';
    }
  });
  document.addEventListener('change',e=>{if(e.target.id==='ledger-date'){const date=e.target.value;if(forbid()||!validDate(date)){e.target.value=draft.date;return;}selected=date;reset();render();}});
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-ledger-date],[data-ledger-new],[data-ledger-edit],[data-ledger-habit],[data-ledger-import],[data-ledger-download],[data-ledger-reload]');if(!target)return;
    if(target.hasAttribute('data-ledger-download')){if(draft)downloadJSON({app:'atlas-ledger-draft',version:1,exportedAt:new Date().toISOString(),day:draft,habits:saved()?.habits||[]},'atlas-ledger-draft-'+draft.date+'.json');return;}
    if(target.hasAttribute('data-ledger-reload')){if(saving)return;dirty=false;reset();render();await load();return;}
    if(forbid())return;
    if(target.hasAttribute('data-ledger-date')){selected=target.dataset.ledgerDate;reset();if(location.hash!=='#ledger')location.hash='ledger';else render();return;}
    if(target.hasAttribute('data-ledger-new')||target.hasAttribute('data-ledger-edit')){
      const h=saved()?.habits.find(h=>h.id===target.dataset.ledgerEdit);editing={id:h?.id||'atlas:'+newId(),revision:saved()?.revision||0,existing:!!h};
      $('#ledger-habit-title').textContent=h?'Rename habit':'A habit of your own';$('#ledger-habit-form').elements.title.value=h?.title||'';$('#ledger-habit-error').textContent='';$('#ledger-habit-dialog').showModal();return;
    }
    if(target.hasAttribute('data-ledger-habit')){
      saving=true;target.disabled=true;
      try{await api('/api/ledger/habit','PATCH',{id:target.dataset.ledgerHabit,action:target.dataset.ledgerAction,revision:saved()?.revision||0});await load();toast('Habit updated. Earlier check-ins are kept.');}catch(err){error(err.message);}finally{saving=false;target.disabled=false;}return;
    }
    ticket++;plan=null;$('#ledger-import-file').value='';$('#ledger-import-preview').innerHTML='';$('#ledger-import-error').textContent='';$('#ledger-import-consent').checked=false;$('#ledger-import-confirm').disabled=true;$('#ledger-import-dialog').showModal();
  });
  document.addEventListener('submit',async e=>{
    if(e.target.id!=='ledger-day-form'&&e.target.id!=='ledger-habit-form')return;e.preventDefault();if(saving)return;
    const isDay=e.target.id==='ledger-day-form',form=e.target,button=form.querySelector('[type="submit"]'),errorId=isDay?'#ledger-save-error':'#ledger-habit-error';saving=true;button.disabled=true;$(errorId).textContent='';
    // Freeze the reviewed draft while a save is in flight.
    const inputs=[...form.querySelectorAll('input,textarea,button')];inputs.forEach(x=>x.disabled=true);
    try{
      if(isDay){if(!draft)reset();const {revision,...day}=draft;await api('/api/ledger/day','PUT',{revision,day});dirty=false;draft=null;}
      else {await api('/api/ledger/habit',editing.existing?'PATCH':'POST',{...editing,title:form.elements.title.value,action:'rename'});$('#ledger-habit-dialog').close();}
      await load();toast(isDay?'Your day is saved.':'Habit saved.');
    }catch(err){$(errorId).textContent=err.message;}
    finally{saving=false;inputs.forEach(x=>x.disabled=false);}
  });
  $('#ledger-import-file').addEventListener('change',async e=>{
    const request=++ticket;plan=null;$('#ledger-import-confirm').disabled=true;$('#ledger-import-consent').checked=false;$('#ledger-import-preview').innerHTML='';$('#ledger-import-error').textContent='';const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>8000000)throw Error('Choose a file smaller than 8 MB.');
      const pack=parseLedgerTransfer(await file.text());if(request!==ticket)return;
      const next=await api('/api/ledger/import/preview','POST',{pack});if(request!==ticket)return;plan=next;
      $('#ledger-import-preview').innerHTML=`<h3>${next.added} additions · ${next.kept} kept as saved</h3><p>Existing habits and saved dates are kept in full, including cleared check-ins and blank notes.</p><p class="small">${next.pack.habits.length} habits · ${next.pack.days.length} days.${next.pack.exportedAt?' Source exported '+esc(new Date(next.pack.exportedAt).toLocaleString())+'.':''}</p>${next.pack.omitted.length?`<p class="small">Outside this import: ${next.pack.omitted.map(esc).join(', ')}.</p>`:''}<div class="import-list">${next.rows.map(r=>`<div class="import-row"><strong>${r.action} · ${r.kind}</strong><span>${esc(r.title)}</span></div>`).join('')}</div>`;
    }catch(err){if(request===ticket)$('#ledger-import-error').textContent=err.message;}
  });
  $('#ledger-import-consent').addEventListener('change',()=>{$('#ledger-import-confirm').disabled=!plan||!$('#ledger-import-consent').checked;});
  $('#ledger-import-confirm').addEventListener('click',async()=>{
    const button=$('#ledger-import-confirm');if(saving||button.disabled||!plan||!$('#ledger-import-consent').checked)return;saving=true;button.disabled=true;$('#ledger-import-file').disabled=true;
    try{await api('/api/ledger/import','POST',{pack:plan.pack,digest:plan.digest,revision:plan.revision});plan=null;$('#ledger-import-dialog').close();await load();toast('Earlier days imported. Your saved choices are protected.');}
    catch(err){plan=null;$('#ledger-import-error').textContent=err.message+' Choose the file again to review a fresh import.';}
    finally{saving=false;$('#ledger-import-file').disabled=false;button.disabled=true;}
  });
  for(const id of ['#ledger-import-dialog','#ledger-habit-dialog'])$(id).addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('#ledger-import-dialog').addEventListener('close',()=>{ticket++;plan=null;});
  return {daily,weekly,get dirty(){return dirty;},get saving(){return saving;},get editorDirty(){return $('#ledger-habit-dialog').open&&!!$('#ledger-habit-form').elements.title.value.trim();}};
}
