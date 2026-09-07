import {APPS,localDay} from './model.mjs';
import {commitmentList,commitmentActions,COMMITMENT_STATUSES,COMMITMENT_PLANS,COMMITMENT_SORTS} from './commitments.mjs';

export function createCommitmentsUI({getData,getWeek,resolveResult,mutate,blocked,error,esc}){
  const $=s=>document.querySelector(s);
  let options={status:'open',app:'all',plan:'all',query:'',sort:'due'},limit=50,rows=new Map(),ticket=0,controller=null,saving=false;
  const pretty=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'});
  function cancel(){ticket++;controller?.abort();controller=null;}
  const select=(id,label,choices,value)=>`<label>${label}<select id="${id}">${Object.entries(choices).map(([key,text])=>`<option value="${esc(key)}"${key===value?' selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  function list(){
    const data=getData(),result=commitmentList(data,getWeek(),options),projects=new Map((data.projects||[]).map(p=>[p.id,p.title]));rows=new Map(result.rows.map(t=>[t.id,t]));
    return `<p class="small" role="status">${result.total} matching ${result.total===1?'commitment':'commitments'} · ${result.counts.open} open, ${result.counts.done} completed, ${result.counts.archived} archived in your workspace.</p>${result.rows.length?`<div class="commitment-rows">${result.rows.slice(0,limit).map(t=>`<article class="commitment-record"><div><div class="commitment-heading"><h2>${esc(t.title)}</h2><span class="badge">${COMMITMENT_STATUSES[t.status]}</span></div><p class="small">${esc(APPS.find(a=>a.id===t.app_id)?.name||'Atlas')}${t.project_id?' · '+esc(projects.get(t.project_id)||'Project unavailable'):''}</p><p class="commitment-dates">${t.due_date?`<span${t.status==='open'&&t.due_date<localDay()?' class="due"':''}>${t.status==='open'&&t.due_date<localDay()?'Overdue · ':''}Due ${esc(pretty(t.due_date))}</span>`:'<span>No due date</span>'}<span>${t.week_start?'Planned for the week of '+esc(pretty(t.week_start)):'Unscheduled'}</span></p>${t.completed_at?`<p class="small">Completed ${esc(pretty(localDay(new Date(t.completed_at))))}${t.status==='archived'?' · Completion kept while archived':''}</p>`:''}</div><div class="commitment-actions"><button class="secondary" data-commitment-open="${esc(t.id)}">Edit details</button>${commitmentActions(t).map(a=>`<button class="text-button" data-commitment-action="${a.action}" data-commitment-id="${esc(t.id)}">${a.label}</button>`).join('')}</div></article>`).join('')}</div>${result.total>limit?`<button class="secondary" id="commitments-more">Show more · ${Math.min(limit,result.total)} of ${result.total}</button>`:''}`:'<div class="empty"><h2>No commitments match these filters.</h2><p>Choose another status, broaden the search, or capture a new commitment.</p><button class="secondary" id="commitments-reset">Clear filters</button></div>'}`;
  }
  function page(){cancel();return `<div class="page-heading"><div><span class="eyebrow">Work you can return to</span><h1>Your commitments.</h1><p>Find open work, revisit completed work, and restore what you archived.</p></div><button class="primary" data-capture>＋ Capture</button></div><section class="panel" id="commitments-panel" aria-label="Saved commitments"><form id="commitments-search-form" class="commitments-search"><label>Find a commitment<input name="query" maxlength="200" value="${esc(options.query)}" placeholder="Title, project, or app" autocomplete="off"></label><button class="secondary" type="submit">Search</button></form><div class="commitments-filters">${select('commitments-status','Status',COMMITMENT_STATUSES,options.status)}${select('commitments-app','Connected app',{all:'All apps',...Object.fromEntries(APPS.map(a=>[a.id,a.name]))},options.app)}${select('commitments-plan','Planning',COMMITMENT_PLANS,options.plan)}${select('commitments-sort','Sort by',COMMITMENT_SORTS,options.sort)}</div><p class="small">Selected week: ${esc(pretty(getWeek()))}. Change weeks in This week. Restoring an archived commitment keeps its earlier completion date, planning week, and project; it does not select a daily priority.</p><div id="commitments-list">${list()}</div><p id="commitments-status-message" class="small" role="status"></p><button class="text-button" id="commitments-cancel-open" hidden>Cancel opening</button></section>`;}
  function redraw(){cancel();if($('#commitments-list'))$('#commitments-list').innerHTML=list();if($('#commitments-status-message'))$('#commitments-status-message').textContent='';if($('#commitments-cancel-open'))$('#commitments-cancel-open').hidden=true;}
  const guard=()=>{if(saving||blocked()){error('Save or discard your draft before changing commitments.');return true;}return false;};
  document.addEventListener('change',e=>{
    const field={'commitments-status':'status','commitments-app':'app','commitments-plan':'plan','commitments-sort':'sort'}[e.target.id];if(!field)return;
    if(guard()){e.target.value=options[field];return;}options={...options,[field]:e.target.value};limit=50;redraw();
  });
  document.addEventListener('submit',e=>{if(e.target.id!=='commitments-search-form')return;e.preventDefault();if(guard())return;options.query=e.target.elements.query.value.trim();limit=50;redraw();});
  document.addEventListener('input',e=>{if(e.target.closest('#commitments-search-form')&&controller)redraw();});
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-commitment-open],[data-commitment-action],#commitments-more,#commitments-reset,#commitments-cancel-open');if(!target)return;
    if(target.id==='commitments-cancel-open'){redraw();$('#commitments-status-message').textContent='Opening cancelled.';return;}
    if(guard())return;
    if(target.id==='commitments-more'){limit+=50;redraw();return;}
    if(target.id==='commitments-reset'){options={status:'all',app:'all',plan:'all',query:'',sort:'due'};limit=50;for(const field of ['status','app','plan','sort'])$('#commitments-'+field).value=options[field];$('#commitments-search-form').elements.query.value='';redraw();return;}
    const task=rows.get(target.dataset.commitmentOpen||target.dataset.commitmentId);if(!task)return;
    cancel();const panel=$('#commitments-panel');
    if(target.hasAttribute('data-commitment-action')){
      const action=target.dataset.commitmentAction;if(!commitmentActions(task).some(a=>a.action===action))return;
      saving=true;panel.querySelectorAll('input,select,button').forEach(b=>b.disabled=true);$('#commitments-status-message').textContent='Saving commitment…';
      try{await mutate(task,action);}catch(err){error(err.message);}finally{saving=false;if($('#commitments-panel')===panel){panel.querySelectorAll('input,select,button').forEach(b=>b.disabled=false);$('#commitments-status-message').textContent='';}}return;
    }
    const current=ticket,week=getWeek();controller=new AbortController();panel.querySelectorAll('[data-commitment-open],[data-commitment-action]').forEach(b=>b.disabled=true);$('#commitments-cancel-open').hidden=false;$('#commitments-status-message').textContent='Opening the latest saved commitment…';
    const active=()=>current===ticket&&$('#commitments-panel')===panel&&getWeek()===week;
    try{const activate=await resolveResult({kind:'task',id:task.id},controller.signal,{taskView:'commitments',taskWeek:week});if(!active())return;if(guard())return;activate();}
    catch(err){if(active())$('#commitments-status-message').textContent=err.message+' Choose Edit details again to retry.';}
    finally{if(active()){panel.querySelectorAll('[data-commitment-open],[data-commitment-action]').forEach(b=>b.disabled=false);$('#commitments-cancel-open').hidden=true;controller=null;}}
  });
  window.addEventListener('hashchange',cancel);
  return {page};
}
