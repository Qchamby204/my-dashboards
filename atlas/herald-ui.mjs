import { localDay, addDays, newId, LEGACY_ORIGIN } from './model.mjs';
import { parseHeraldTransfer, heraldWeek, HERALD_STAGES, HERALD_FORMATS } from './herald.mjs';

export function createHeraldUI({api,getData,getWeek,load,error,toast,esc,downloadJSON,blocked}){
  const $=s=>document.querySelector(s),pretty=day=>new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const saved=()=>getData().herald;
  let editing=null,saving=false,plan=null,ticket=0,query='',filter='open',limit=40;
  const filters={open:'In production',week:'Planned this week',published:'Published',all:'All active items',archived:'Archived',draft:'Draft',approved:'Approved',produced:'Filmed / edited',scheduled:'Scheduled'};
  function rows(){
    const week=getWeek(),through=addDays(week,6),today=localDay();
    const all=(saved()?.items||[]).filter(r=>r.archived===(filter==='archived')&&(filter==='archived'||filter==='all'||filter==='open'&&r.stage!=='published'||filter==='week'&&r.stage!=='published'&&r.scheduled_day>=week&&r.scheduled_day<=through||r.stage===filter)&&`${r.title} ${r.audience}`.toLowerCase().includes(query.toLowerCase())).slice().sort((a,b)=>(a.scheduled_day||'9999').localeCompare(b.scheduled_day||'9999')||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
    return `${all.slice(0,limit).map(r=>`<article class="herald-item"><div><h3>${esc(r.title)}</h3><p class="small">${HERALD_FORMATS[r.format]} · ${HERALD_STAGES[r.stage]}${r.audience?' · '+esc(r.audience):''}${r.source_id?' · Imported item':''}</p><p class="small">${r.stage==='published'?r.published_day?'Recorded published '+esc(pretty(r.published_day)):'Publication date not recorded':r.scheduled_day?`Planned ${esc(pretty(r.scheduled_day))}${r.scheduled_day<today?' · Date passed; review the plan':''}`:'No planned date'}</p>${r.note?`<p class="lesson-instructions">${esc(r.note)}</p>`:''}</div><div class="review-actions"><button class="text-button" data-herald-edit="${r.id}">Edit</button><button class="text-button" data-herald-action="${r.archived?'restore':'archive'}" data-id="${r.id}">${r.archived?'Restore':'Archive'}</button></div></article>`).join('')||'<p class="quiet-message">No matching content. Add an idea, import your Herald backup, or choose another filter.</p>'}${all.length>limit?`<button class="secondary" data-herald-more>Show more items</button><p class="small">Showing ${Math.min(all.length,limit)} of ${all.length}.</p>`:''}`;
  }
  function page(){
    const active=(saved()?.items||[]).filter(r=>!r.archived),week=heraldWeek(saved(),getWeek()),undated=active.filter(r=>r.stage==='published'&&!r.published_day).length;
    return `<div class="page-heading"><div><span class="eyebrow">An idea with a place to go</span><h1>The Herald, connected.</h1><p>Plan your content and keep its progress in view across devices.</p></div><button class="primary" data-herald-new>＋ New content</button></div>
      <div class="project-toolbar"><button class="secondary" data-herald-import>Import Herald backup</button><a class="inline-link" href="${LEGACY_ORIGIN}the-herald.html" target="_blank" rel="noopener">Open original script vault</a><a class="inline-link" href="#review">Open weekly review</a></div>
      <section class="panel"><div class="section-heading"><h2>Your content plan</h2><span>${active.filter(r=>r.stage!=='published').length} in production</span></div><div class="week-switch herald-week"><button class="icon-button" data-week="-7" aria-label="Previous content week">‹</button><span>${esc(pretty(getWeek()))} – ${esc(pretty(addDays(getWeek(),6)))}</span><button class="icon-button" data-week="7" aria-label="Next content week">›</button></div><p>${week.planned.length} planned this week · ${week.published.length} recorded published this week.</p><p class="small">Stages and dates are your records. Saving here does not upload content, schedule a platform post, or obtain approval. Scripts and analytics remain in the original vault.</p>${undated?`<p class="small">${undated} published ${undated===1?'item has':'items have'} no recorded publication date. Add the actual date in Edit to include it in weekly review.</p>`:''}<div class="filters"><input id="herald-search" aria-label="Search content" placeholder="Find a title or audience…" value="${esc(query)}"><select id="herald-filter" aria-label="Filter content">${Object.entries(filters).map(([id,label])=>`<option value="${id}"${filter===id?' selected':''}>${label}</option>`).join('')}</select></div><div id="herald-list">${rows()}</div></section>`;
  }
  function weekly(){
    const {planned,published}=heraldWeek(saved(),getWeek()),list=(items,key)=>items.slice(0,8).map(r=>`<p>${esc(r.title)}<br><span class="small">${esc(pretty(r[key]))} · ${HERALD_FORMATS[r.format]}</span></p>`).join('');
    return `<section class="panel"><div class="section-heading"><h2>Content, in motion</h2><span>The Herald</span></div><h3>${published.length} recorded published</h3>${list(published,'published_day')||'<p class="quiet-message">No publication date recorded for this week.</p>'}<h3 class="wide-section">${planned.length} still planned</h3>${list(planned,'scheduled_day')||'<p class="quiet-message">No remaining content dates planned for this week.</p>'}${planned.length>8||published.length>8?'<p class="small">Showing up to eight items in each group.</p>':''}<p class="small">Publication counts use the actual date you record. A planned date alone never counts as published.</p><a class="inline-link" href="#herald">Open content plan</a></section>`;
  }
  function publicationField(){const form=$('#herald-form');form.elements.published_day.disabled=saving||form.elements.stage.value!=='published';}
  function openEditor(item=null){
    editing={item:item?structuredClone(item):{id:'atlas:'+newId(),source_id:null,title:'',format:'long',audience:'',stage:'draft',scheduled_day:null,published_day:null,note:'',archived:false},revision:saved()?.revision||0,existing:!!item};
    const form=$('#herald-form');for(const name of ['title','format','audience','stage','scheduled_day','published_day','note'])form.elements[name].value=editing.item[name]??'';
    publicationField();$('#herald-edit-title').textContent=item?'Edit content plan':'New content';$('#herald-error').textContent='';$('#herald-dialog').showModal();form.elements.title.focus();
  }
  function values(){const form=$('#herald-form'),item={...editing.item};for(const name of ['title','format','audience','stage','scheduled_day','published_day','note'])item[name]=form.elements[name].value;item.scheduled_day=item.scheduled_day||null;item.published_day=item.stage==='published'?item.published_day||null:null;return item;}
  $('#herald-form').elements.stage.addEventListener('change',publicationField);
  document.addEventListener('input',e=>{if(e.target.id==='herald-search'){query=e.target.value;limit=40;$('#herald-list').innerHTML=rows();}});
  document.addEventListener('change',e=>{if(e.target.id==='herald-filter'){filter=e.target.value;limit=40;$('#herald-list').innerHTML=rows();}});
  document.addEventListener('click',async e=>{
    const t=e.target.closest('[data-herald-new],[data-herald-edit],[data-herald-action],[data-herald-import],[data-herald-more],[data-herald-download],[data-herald-reload]');if(!t||saving)return;
    if(t.hasAttribute('data-herald-download')){if(editing)downloadJSON({app:'atlas-herald-draft',version:1,exportedAt:new Date().toISOString(),item:values(),revision:editing.revision},'atlas-content-draft.json');return;}
    if(t.hasAttribute('data-herald-reload')){editing=null;$('#herald-dialog').close();await load();return;}
    if(blocked()){error('Save or discard your current draft before changing other records.');return;}
    if(t.hasAttribute('data-herald-more')){limit+=40;$('#herald-list').innerHTML=rows();return;}
    if(t.hasAttribute('data-herald-new')){openEditor();return;}
    if(t.hasAttribute('data-herald-edit')){const item=saved()?.items.find(r=>r.id===t.dataset.heraldEdit);if(item)openEditor(item);return;}
    if(t.hasAttribute('data-herald-action')){
      saving=true;t.disabled=true;
      try{await api('/api/herald/item','PATCH',{id:t.dataset.id,action:t.dataset.heraldAction,revision:saved()?.revision||0});await load();toast(t.dataset.heraldAction==='archive'?'Item archived. Future imports will keep that choice.':'Item restored to your content plan.');}catch(err){error(err.message);}finally{saving=false;t.disabled=false;}return;
    }
    ticket++;plan=null;$('#herald-file').value='';$('#herald-import-preview').innerHTML='';$('#herald-import-error').textContent='';$('#herald-consent').checked=false;$('#herald-import-confirm').disabled=true;$('#herald-import-dialog').showModal();
  });
  $('#herald-form').addEventListener('submit',async e=>{
    e.preventDefault();if(saving||!editing)return;saving=true;const form=e.currentTarget,item=values(),controls=[...form.querySelectorAll('input,select,textarea,button')];controls.forEach(x=>x.disabled=true);$('#herald-error').textContent='';
    try{await api('/api/herald/item',editing.existing?'PATCH':'POST',{item,revision:editing.revision,id:editing.item.id,action:'edit'});editing=null;$('#herald-dialog').close();await load();toast('Content plan saved across devices.');}
    catch(err){$('#herald-error').textContent=err.message+' Your draft is still here.';}
    finally{saving=false;controls.forEach(x=>x.disabled=false);publicationField();}
  });
  $('#herald-file').addEventListener('change',async e=>{
    const request=++ticket;plan=null;$('#herald-import-confirm').disabled=true;$('#herald-consent').checked=false;$('#herald-import-preview').innerHTML='';$('#herald-import-error').textContent='';const file=e.target.files[0];if(!file)return;
    try{
      if(file.size>8000000)throw Error('Choose an export smaller than 8 MB.');
      const pack=await parseHeraldTransfer(await file.text());if(request!==ticket)return;
      const next=await api('/api/herald/import/preview','POST',{pack});if(request!==ticket)return;plan=next;
      $('#herald-import-preview').innerHTML=`<h3>${next.added} items to add · ${next.kept} kept as saved</h3><p>Existing items keep their saved details and archive choices. No item is removed.</p><div class="import-list">${next.rows.slice(0,100).map(r=>`<div class="import-row"><strong>${r.action} · ${HERALD_STAGES[r.stage]}${r.scheduled_day?' · Planned '+esc(pretty(r.scheduled_day)):''}</strong><span>${esc(r.title)}</span></div>`).join('')}</div>${next.rows.length>100?`<p class="small">Showing 100 of ${next.rows.length} records. Counts include every item.</p>`:''}`;
      $('#herald-import-confirm').disabled=!$('#herald-consent').checked;
    }catch(err){if(request===ticket)$('#herald-import-error').textContent=err.message;}
  });
  $('#herald-consent').addEventListener('change',()=>{$('#herald-import-confirm').disabled=!plan||!$('#herald-consent').checked;});
  $('#herald-import-confirm').addEventListener('click',async()=>{
    const button=$('#herald-import-confirm');if(saving||button.disabled||!plan||!$('#herald-consent').checked)return;saving=true;button.disabled=true;$('#herald-file').disabled=true;
    try{await api('/api/herald/import','POST',{pack:plan.pack,digest:plan.digest,revision:plan.revision});plan=null;$('#herald-import-dialog').close();await load();toast('Reviewed items imported. Your saved choices are kept.');}
    catch(err){plan=null;$('#herald-import-error').textContent=err.message+' Choose the file again to review a fresh import.';}
    finally{saving=false;$('#herald-file').disabled=false;button.disabled=true;}
  });
  for(const id of ['#herald-dialog','#herald-import-dialog'])$(id).addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('#herald-dialog').addEventListener('close',()=>{editing=null;});
  $('#herald-import-dialog').addEventListener('close',()=>{ticket++;plan=null;});
  return {page,weekly,get dirty(){return !!editing||$('#herald-import-dialog').open;},get saving(){return saving;}};
}
