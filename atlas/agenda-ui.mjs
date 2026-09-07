import {weeklyAgenda,AGENDA_SOURCES,AGENDA_TYPES} from './agenda.mjs';
import {localDay} from './model.mjs';

export function createAgendaUI({getData,getWeek,resolveResult,blocked,error,esc}){
  const $=s=>document.querySelector(s);
  let source='all',type='all',limits=new Map(),shownWeek=null,rows=new Map(),ticket=0,controller=null;
  const pretty=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  function cancel(){ticket++;controller?.abort();controller=null;}
  function contents(){
    const week=getWeek();if(shownWeek!==week){shownWeek=week;limits.clear();}
    const a=weeklyAgenda(getData(),week,{source,type});rows=new Map(a.days.flatMap(d=>d.entries).map(e=>[e.key,e]));
    const taskNote=(source==='all'||source==='tasks')&&type!=='activity'&&(a.undatedCommitments||a.otherDateCommitments);
    return `<div class="agenda-toolbar"><label>Show<select id="agenda-type">${Object.entries(AGENDA_TYPES).map(([key,label])=>`<option value="${key}"${key===type?' selected':''}>${label}</option>`).join('')}</select></label><label>Source<select id="agenda-source">${Object.entries(AGENDA_SOURCES).map(([key,label])=>`<option value="${key}"${key===source?' selected':''}>${label}</option>`).join('')}</select></label><p class="small" role="status">${a.planned} planned ${a.planned===1?'entry':'entries'} · ${a.recorded} recorded ${a.recorded===1?'entry':'entries'}</p></div>
      <div class="agenda-days">${a.days.map(d=>`<section class="agenda-day${d.date===localDay()?' agenda-today':''}" aria-labelledby="agenda-day-${d.date}"><h3 id="agenda-day-${d.date}"><time datetime="${d.date}">${esc(pretty(d.date))}</time>${d.date===localDay()?'<span class="badge">Today</span>':''}</h3><div>${d.entries.length?`<ul class="agenda-entries">${d.entries.slice(0,limits.get(d.date)||20).map(e=>`<li><button type="button" class="agenda-entry" data-agenda-open="${esc(e.key)}"><span class="agenda-label">${esc(e.label)}<span class="agenda-source">${AGENDA_SOURCES[e.source]}</span></span><strong>${esc(e.title)}</strong>${e.detail?`<span class="small">${esc(e.detail)}</span>`:''}<span class="agenda-open">Open record →</span></button></li>`).join('')}</ul>${d.entries.length>(limits.get(d.date)||20)?`<button class="text-button" data-agenda-more="${d.date}">Show more · ${d.entries.length} entries on this day</button>`:''}`:'<p class="agenda-empty">No matching dated entries.</p>'}</div></section>`).join('')}</div>
      ${taskNote?`<p class="small agenda-footnote">${a.undatedCommitments?`${a.undatedCommitments} open ${a.undatedCommitments===1?'commitment has':'commitments have'} no due date. `:''}${a.otherDateCommitments?`${a.otherDateCommitments} open ${a.otherDateCommitments===1?'commitment has a due date':'commitments have due dates'} outside this week. `:''}These are still planned for this week and appear in the commitment list below. A planning week does not assign a day.</p>`:''}`;
  }
  function panel(){cancel();return `<section class="panel weekly-agenda" id="agenda-panel" aria-labelledby="agenda-title"><div class="section-heading"><div><span class="eyebrow">The week, together</span><h2 id="agenda-title">Your weekly agenda</h2></div><a class="inline-link" href="#review">Open weekly review</a></div><p class="small">Due dates, content plans, and recorded activity from your saved workspace. Entries have dates, not reserved time slots. Publication dates are your records, not live platform verification.</p><div id="agenda-body">${contents()}</div><p id="agenda-opening-status" class="small" role="status"></p><button type="button" class="text-button" id="agenda-cancel-open" hidden>Cancel opening</button></section>`;}
  function redraw(){cancel();const body=$('#agenda-body');if(body)body.innerHTML=contents();const status=$('#agenda-opening-status');if(status)status.textContent='';const button=$('#agenda-cancel-open');if(button)button.hidden=true;}
  document.addEventListener('change',e=>{
    if(!['agenda-type','agenda-source'].includes(e.target.id))return;
    if(blocked()){e.target.value=e.target.id==='agenda-type'?type:source;error('Save or discard your draft before changing the agenda.');return;}
    if(e.target.id==='agenda-type')type=e.target.value;else source=e.target.value;limits.clear();redraw();
  });
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-agenda-open],[data-agenda-more],#agenda-cancel-open');if(!target)return;
    if(target.id==='agenda-cancel-open'){redraw();$('#agenda-opening-status').textContent='Opening cancelled.';$('#agenda-type')?.focus();return;}
    if(blocked()){error('Save or discard your draft before opening another record.');return;}
    if(target.hasAttribute('data-agenda-more')){const date=target.dataset.agendaMore;limits.set(date,(limits.get(date)||20)+20);redraw();const row=$('#agenda-day-'+date);row?.scrollIntoView({block:'nearest'});return;}
    const row=rows.get(target.dataset.agendaOpen);if(!row)return;
    cancel();const current=ticket,panel=$('#agenda-panel'),week=getWeek();controller=new AbortController();
    panel.querySelectorAll('[data-agenda-open]').forEach(b=>b.disabled=true);$('#agenda-cancel-open').hidden=false;$('#agenda-opening-status').textContent='Opening the latest saved record…';
    const currentRequest=()=>current===ticket&&$('#agenda-panel')===panel&&getWeek()===week;
    try{
      const activate=await resolveResult(row,controller.signal,{taskView:'week',taskWeek:week});
      if(!currentRequest())return;
      if(blocked())throw Error('Your draft is still here. Close it before opening the record.');
      activate();
    }catch(err){if(currentRequest()){$('#agenda-opening-status').textContent=err.message+' Choose the record again to retry.';}}
    finally{if(currentRequest()){panel.querySelectorAll('[data-agenda-open]').forEach(b=>b.disabled=false);$('#agenda-cancel-open').hidden=true;controller=null;}}
  });
  window.addEventListener('hashchange',cancel);
  return {panel};
}
