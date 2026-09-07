export function createEditionRefreshUI({api,getPractice,esc,formatDay,dateTime,load,toast,blocked}){
  const $=selector=>document.querySelector(selector);
  let plan=null,request=0,saving=false,lastError='';
  function panel(){const r=getPractice()?.edition_refresh;
    return `<section class="panel edition-refresh" id="edition-refresh-panel"><div class="section-heading"><h2>Published Courier editions</h2><button class="secondary" data-edition-check>Check for editions</button></div><p>Bring available lessons straight into Practice. Review additions before saving.</p>${r?`<dl class="edition-facts"><div><dt>Last saved refresh</dt><dd>${esc(dateTime(r.checked_at))}</dd></div><div><dt>Latest published edition</dt><dd>${r.latest_edition?esc(formatDay(r.latest_edition)):'No editions available'}</dd></div><div><dt>Latest lesson edition</dt><dd>${r.latest_lesson_edition?esc(formatDay(r.latest_lesson_edition)):'No lessons in that feed'}</dd></div></dl>`:'<p class="small">No direct refresh saved yet. Checking shows what Courier currently publishes.</p>'}${lastError?`<p class="form-error" role="alert">${esc(lastError)}</p>`:''}<p class="small">A successful refresh keeps every saved lesson and completion. Original browser completions need a practice pack to transfer.</p></section>`;
  }
  function updatePanel(){const old=$('#edition-refresh-panel');if(old)old.outerHTML=panel();}
  async function check(){
    if(saving||blocked())return;
    const ticket=++request;plan=null;lastError='';$('#edition-refresh-consent').checked=false;$('#edition-refresh-consent').disabled=true;$('#edition-refresh-confirm').disabled=true;$('#edition-refresh-error').textContent='';$('#edition-refresh-preview').innerHTML='<p role="status">Checking published Courier editions…</p>';
    if(!$('#edition-refresh-dialog').open)$('#edition-refresh-dialog').showModal();
    try{
      const next=await api('/api/practice/editions/preview','POST',{});if(ticket!==request)return;plan=next;
      const r=next.published.refresh;
      $('#edition-refresh-preview').innerHTML=`<h3>${next.added} new lessons · ${next.kept} already saved</h3><p>${next.retained} earlier saved lessons are outside this feed and will be kept.</p><p class="small">Checked ${esc(dateTime(r.checked_at))}. ${r.latest_edition?'Latest publication: '+esc(formatDay(r.latest_edition))+'.':'No editions are currently published.'} ${r.latest_lesson_edition?'Latest lesson edition: '+esc(formatDay(r.latest_lesson_edition))+'.':'No lessons are available in this feed.'}</p><p class="small">${next.mode==='managed'?'Practice will save across devices.':'Your existing practice remains a reviewed snapshot. Choose Use synced practice afterward to record completions here.'} All saved lesson details, completions, and reopened choices are preserved.</p>
        <details class="edition-list"><summary>${r.edition_count} published editions · ${r.lesson_count} lessons</summary>${next.published.editions.map(d=>`<p>${esc(formatDay(d.day))} · ${d.lessons} lessons${d.lessons===0?' · No lessons in this edition':''}</p>`).join('')}</details>
        <div class="import-list">${next.rows.map(l=>`<details class="edition-lesson"><summary><strong>${l.action}</strong> · ${esc(l.title)}<span class="small">${esc(l.track)} · ${esc(formatDay(l.day))}</span></summary>${l.task?`<p class="lesson-instructions">${esc(l.task)}</p>`:'<p class="small">Published with a title only. Open the original Courier edition for its lesson.</p>'}${l.drill?`<p class="small">Drill</p><p class="lesson-instructions">${esc(l.drill)}</p>`:''}${l.action==='Keep saved'?'<p class="small">These are the published details. Your saved version stays as it is.</p>':''}</details>`).join('')}</div>`;
      $('#edition-refresh-confirm').textContent=next.added?'Save '+next.added+' new lessons':'Save refresh details';
    }catch(error){if(ticket!==request)return;lastError=error.message;$('#edition-refresh-preview').innerHTML='';$('#edition-refresh-error').textContent=lastError;}
    finally{if(ticket===request)$('#edition-refresh-consent').disabled=false;}
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-edition-check]'))check();});
  $('#edition-refresh-retry').addEventListener('click',check);
  $('#edition-refresh-consent').addEventListener('change',()=>{$('#edition-refresh-confirm').disabled=saving||!plan||!$('#edition-refresh-consent').checked;});
  $('#edition-refresh-confirm').addEventListener('click',async()=>{
    const button=$('#edition-refresh-confirm');if(saving||button.disabled||!plan||!$('#edition-refresh-consent').checked)return;
    saving=true;button.disabled=true;$('#edition-refresh-retry').disabled=true;$('#edition-refresh-consent').disabled=true;$('#edition-refresh-error').textContent='';
    try{
      const result=await api('/api/practice/editions','POST',{digest:plan.digest,revision:plan.revision});
      lastError='';plan=null;$('#edition-refresh-dialog').close();await load();toast(result.added?result.added+' new Courier lessons saved. Your completions are unchanged.':'Courier refresh saved. All existing practice is kept.');
    }catch(error){plan=null;lastError=error.message;$('#edition-refresh-error').textContent=lastError+' Check again to review before saving.';}
    finally{saving=false;button.disabled=true;$('#edition-refresh-retry').disabled=false;$('#edition-refresh-consent').disabled=false;updatePanel();}
  });
  $('#edition-refresh-dialog').addEventListener('cancel',e=>{if(saving)e.preventDefault();});
  $('#edition-refresh-dialog').addEventListener('close',()=>{request++;plan=null;updatePanel();});
  return {panel,check,get saving(){return saving;}};
}
