import {workHome,workItems} from './work.mjs';
export function createWorkUI({getData,getToday,api,load,blocked,error,toast,esc,formatDay,editTask,mutateTask}){
  let source='all',query='',limit=40,saving=false;
  const $=s=>document.querySelector(s);
  const info=()=>workHome(getData(),getToday(),{source,query});
  function row(x){
    const date=x.due?`${x.due<getToday()&&!x.done?'Overdue · ':x.due===getToday()?'Today · ':''}${formatDay(x.due)}`:'';
    const attrs=`data-kind="${x.kind}" data-id="${esc(x.id)}"`;
    const title=x.href?`<a href="${esc(x.href)}">${esc(x.title)}</a>`:`<button class="work-title-button" data-work-action="edit" ${attrs}>${esc(x.title)}</button>`;
    const complete=x.done?'<span class="work-finished" aria-label="Completed">✓</span>':x.kind==='content'?`<button class="text-button work-publish" data-work-action="complete" ${attrs}>Mark published</button>`:`<button class="check" data-work-action="complete" ${attrs} aria-label="Complete ${esc(x.title)}"><span aria-hidden="true">✓</span></button>`;
    return `<article class="task simple-work${x.done?' done':''}">${x.kind==='content'?'':complete}<div class="task-body"><h3 class="task-title">${title}</h3><p class="task-meta"><span>${esc(x.kind==='task'?'Task':x.source)}</span>${date?`<span class="${!x.done&&x.due<getToday()?'due':''}">${esc(date)}</span>`:''}${x.focus&&!x.done?'<span>Pinned for today</span>':''}</p></div>${x.kind==='content'?complete:''}${!x.done?`<details class="work-options"><summary aria-label="Options for ${esc(x.title)}">•••</summary><button class="text-button" data-work-action="${x.focus?'release':'choose'}" ${attrs}${!x.focus&&info().priorities.length>=3?' disabled title="Up to three items can be pinned. Due work appears automatically."':''}>${x.focus?'Unpin':'Pin to Today'}</button></details>`:''}</article>`;
  }
  function allOpen(){
    return workItems(getData(),getToday()).filter(x=>!x.done&&(source==='all'||x.kind===source)&&(!query||[x.title,x.source,x.detail].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()))).sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title));
  }
  function waiting(){
    const items=allOpen();
    return items.length?items.slice(0,limit).map(row).join('')+(items.length>limit?'<button class="secondary" data-work-more>Show more</button>':''):'<p class="quiet-message">'+(query||source!=='all'?'Nothing matches. Try another search.':'No open work. Add a task or open an app to get started.')+'</p>';
  }
  function allPage(){
    return `<div class="simple-page"><a class="inline-link" href="#today">← Today</a><div class="page-heading"><div><h1>All work</h1><p>Your tasks, Life Map projects, and Herald content.</p></div></div><section class="panel"><div class="filters"><input id="work-search" aria-label="Find work" placeholder="Search your work…" value="${esc(query)}"><select id="work-source" aria-label="Work source">${Object.entries({all:'Everything',task:'Tasks',project:'Life Map',content:'The Herald'}).map(([k,v])=>`<option value="${k}"${source===k?' selected':''}>${v}</option>`).join('')}</select></div><div id="work-list">${waiting()}</div></section></div>`;
  }
  function page(){
    const b=workHome(getData(),getToday()),seen=new Set();
    const relevant=[...b.priorities,...b.overdue,...b.dueToday].filter(x=>{if(seen.has(x.key))return false;seen.add(x.key);return true;});
    const upcoming=relevant.length?[]:b.waiting.slice(0,3);
    const items=relevant.length?relevant.slice(0,6):upcoming;
    return `<div class="simple-page"><div class="page-heading"><div><h1>Today</h1><p>${relevant.length?'Here’s what needs your attention.':b.total?'Nothing due today. Here’s what’s next.':'A clear place to start.'}</p></div></div>
      <section class="panel today-work"><div class="section-heading"><h2>${relevant.length?'For today':upcoming.length?'Up next':'Your tasks'}</h2>${b.total?`<a class="inline-link" href="#work">All work (${b.total})</a>`:''}</div>${items.length?items.map(row).join(''):'<p class="quiet-message">Use <strong>Add task</strong> above, or open an app below. Saved projects and content appear here when they’re due.</p>'}${relevant.length>6?`<a class="inline-link show-remaining" href="#work">See ${relevant.length-6} more for today</a>`:''}</section>
      ${b.completed.length?`<details class="completed-today"><summary>Completed today · ${b.completed.length}</summary>${b.completed.map(row).join('')}</details>`:''}
      <section class="quick-apps" aria-label="Open an app"><a href="https://qchamby204.github.io/my-dashboards/courier.html" target="_blank" rel="noopener"><span aria-hidden="true">▶</span><strong>The Courier</strong><small>Listen to your briefing</small></a><a href="/apps/life-map"><span aria-hidden="true">◈</span><strong>Life Map</strong><small>Projects and notes</small></a><a href="/apps/herald"><span aria-hidden="true">⚑</span><strong>The Herald</strong><small>Ideas and scripts</small></a></section><a class="inline-link" href="#apps">All apps</a>
      ${!b.total&&!(getData().connections||[]).length?'<p class="small">Missing your earlier work? <a class="inline-link" href="#connect">Bring it over once.</a></p>':''}</div>`;
  }
  document.addEventListener('input',e=>{if(e.target.id==='work-search'){query=e.target.value;limit=40;$('#work-list').innerHTML=waiting();}});
  document.addEventListener('change',e=>{if(e.target.id==='work-source'){source=e.target.value;limit=40;$('#work-list').innerHTML=waiting();}});
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-work-more]')){limit+=40;$('#work-list').innerHTML=waiting();return;}
    const button=e.target.closest('[data-work-action]');if(!button||saving)return;
    if(blocked()){error('Save or discard your draft before changing work.');return;}
    const {kind,id,workAction:action}=button.dataset,x=workItems(getData(),getToday()).find(x=>x.kind===kind&&x.id===id);
    if(!x){error('This item changed. Refresh Home.');return;}
    if(kind==='task'){
      if(action==='edit'){editTask(x.record);return;}
      await mutateTask(x.record,['choose','release'].includes(action)?'focus':'complete');return;
    }
    saving=true;button.disabled=true;
    try{
      if(['choose','release'].includes(action))await api('/api/priorities','POST',{kind,id,day:getToday(),action,revision:kind==='project'?x.record.revision:getData().herald.revision});
      else if(action==='complete')await api(kind==='project'?'/api/projects/'+encodeURIComponent(id):'/api/herald/item','PATCH',{id,action:kind==='project'?'complete':'publish',day:getToday(),revision:kind==='project'?x.record.revision:getData().herald.revision});
      await load();toast(action==='choose'?'Pinned to Today.':action==='release'?'Unpinned. Due work still appears on Today.':kind==='content'?'Publication recorded in The Herald.':'Completed in Life Map.');
    }catch(err){error(err.message);}finally{saving=false;button.disabled=false;}
  });
  return {page,allPage,get saving(){return saving;}};
}
