/* Life Map workflow, in the original composition. Records stay in their existing store. */
(()=>{
  'use strict';
  const M=createLifeMapWorkflow(),clone=M.clone,own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const DRAFT_KEY='lifemap:entry-drafts:v2',VIEW_KEY='lifemap:view:v2';
  const project=id=>(S.projects||[]).find(p=>p.id===id),chore=id=>(S.chores||[]).find(c=>c.id===id),group=id=>(S.groups||[]).find(g=>g.id===id);
  const button=(text,action,attrs='',cls='')=>'<button type="button" class="btn tap lm-button '+cls+'" data-lm="'+action+'" '+attrs+'>'+text+'</button>';
  const info=(label,text)=>'<details class="atlas-info"><summary aria-label="'+esc(label)+'">i</summary><div class="atlas-info-body">'+esc(text)+'</div></details>';
  const select=(key,value,options,extra='')=>'<select data-lm="field" data-field="'+key+'" '+extra+'>'+options.map(([v,t])=>'<option value="'+esc(v)+'"'+(String(value||'')===String(v)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
  const input=(key,value='',type='text',extra='')=>'<input type="'+type+'" data-lm="field" data-field="'+key+'" value="'+esc(value||'')+'" '+extra+'>';
  const field=(label,content)=>'<label class="lm-field"><span>'+esc(label)+'</span>'+content+'</label>';
  const help=text=>'<p class="lm-help">'+esc(text)+'</p>';
  const chip=text=>'<span class="lm-chip">'+esc(text)+'</span>';
  const safeLink=x=>{try{return ['https:','http:'].includes(new URL(x).protocol);}catch{return false;}};
  let busy=false,pendingAction=null,lastError='',draftError='',recoveredEditor=null,recoveredBase=null,editorBase=null,importTicket=0;
  let draftLoaded=false,restorePrompt=false,selection=new Set(),selectMode=false,groupFilter='',contextFilter='',searchArchive=false;
  let savedView={};try{savedView=JSON.parse(localStorage.getItem(VIEW_KEY)||'{}');}catch{}
  if(savedView&&typeof savedView==='object'&&!Array.isArray(savedView)){
    if(savedView.open&&typeof savedView.open==='object')for(const k of ['horizon','map','proj','chores','mom'])if(typeof savedView.open[k]==='boolean')view.open[k]=savedView.open[k];
  }
  view.qa={...view.qa,parse:true,parentId:''};
  const statusNode=()=>document.getElementById('lm-save-state');
  function feedback(){
    const node=statusNode();if(node){node.textContent=busy?'Saving…':lastError||draftError||(view.editor||view.qa.txt?'Draft kept on this device; not yet added.':'');node.setAttribute('role',lastError||draftError?'alert':'status');}
    const editorStatus=document.getElementById('lm-editor-status');if(editorStatus)editorStatus.textContent=busy?'Saving…':lastError||draftError;
    for(const el of app.querySelectorAll('button,input,select,textarea')){if(busy&&!el.disabled){el.dataset.lmBusy='1';el.disabled=true;}else if(!busy&&el.dataset.lmBusy==='1'){el.disabled=false;delete el.dataset.lmBusy;}}
  }
  function storeDraft(){
    if(!draftLoaded)return;
    const editable=view.editor&&['proj','chore','group'].includes(view.editor.kind)?view.editor:recoveredEditor;
    if(view.editor&&['proj','chore','group'].includes(view.editor.kind)){recoveredEditor=clone(view.editor);recoveredBase=editorBase;}
    const data={version:2,qa:view.qa,editor:editable,base:editable===recoveredEditor?recoveredBase:editorBase,at:Date.now()};
    try{localStorage.setItem(DRAFT_KEY,JSON.stringify(data));draftError='';}catch{draftError='This draft could not be saved on this device. Keep this page open or copy your text.';}
    feedback();
  }
  function loadDraft(){
    if(draftLoaded)return;draftLoaded=true;
    try{const raw=localStorage.getItem(DRAFT_KEY);if(raw){if(raw.length>1000000)throw Error();const d=JSON.parse(raw);
      if(d?.version!==2||typeof d.qa?.txt!=='string'||d.qa.txt.length>20000)throw Error();
      if(!view.qa.txt)view.qa={...view.qa,txt:d.qa.txt,area:typeof d.qa.area==='string'?d.qa.area:'',when:typeof d.qa.when==='string'?d.qa.when:'',parentId:typeof d.qa.parentId==='string'?d.qa.parentId:'',parse:d.qa.parse!==false,links:Array.isArray(d.qa.links)?d.qa.links.filter(safeLink):[]};
      if(d.editor&&['proj','chore','group'].includes(d.editor.kind)){if(d.editor.checklist!==undefined&&(!Array.isArray(d.editor.checklist)||d.editor.checklist.some(x=>!x||typeof x.text!=='string'))||d.editor.links!==undefined&&!Array.isArray(d.editor.links)||d.editor.tags!==undefined&&!Array.isArray(d.editor.tags))throw Error();recoveredEditor=d.editor;recoveredBase=d.base??null;restorePrompt=true;}
    }}catch{draftError='An unfinished draft could not be read. Your saved board is unchanged.';}
    // A Shortcut handoff is a fragment, not a query: captured text is not sent to the host.
    try{const u=new URL(location.href),params=new URLSearchParams(u.hash.slice(1));if(params.has('capture')){
      const text=params.get('capture').slice(0,20000);if(text){if(view.qa.txt&&view.qa.txt!==text)view.qa.txt+='\n'+text;else view.qa.txt=text;view.editor={kind:'capture'};}
      if(params.get('url')&&safeLink(params.get('url')))view.qa.links=[params.get('url')];
      history.replaceState(history.state,'',u.pathname+u.search);storeDraft();
    }}catch{}
  }
  function persist(next,restore=false){
    if(window.AtlasConnected){
      if(typeof window.AtlasConnected.commit==='function')return window.AtlasConnected.commit(next);
      // Compatibility for an already-open older private bootstrap; verify its queue.
      window.AtlasConnected.save(next);return typeof window.AtlasConnected.flush==='function'?window.AtlasConnected.flush():false;
    }
    if(window.LifeMapLocal)return window.LifeMapLocal.save(next,restore);
    return false;
  }
  // Undo only changed record fields, not unrelated edits made after the action.
  function undoPatch(before,after,current){
    const out=clone(current),collections=['projects','chores','groups','templates','log','choreHistory'];
    const idOf=(field,r)=>field==='log'?[r.t,r.id,r.d].join('|'):r.id;
    for(const key of collections){const old=new Map((before[key]||[]).map(x=>[idOf(key,x),x])),next=new Map((after[key]||[]).map(x=>[idOf(key,x),x]));
      if(JSON.stringify(before[key]||[])===JSON.stringify(after[key]||[]))continue;
      out[key]=out[key]||[];
      for(const id of new Set([...old.keys(),...next.keys()])){const a=old.get(id),b=next.get(id),idx=out[key].findIndex(x=>idOf(key,x)===id),c=out[key][idx];
        if(!a&&b){if(!c)continue;if(JSON.stringify(c)!==JSON.stringify(b))throw Error('That item has newer changes. Edit it rather than undoing.');out[key].splice(idx,1);}
        else if(a&&!b){if(c)throw Error('That item was restored already.');out[key].push(clone(a));}
        else if(JSON.stringify(a)!==JSON.stringify(b)){if(!c)throw Error('That item was removed.');for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(JSON.stringify(a[k])===JSON.stringify(b[k]))continue;if(JSON.stringify(c[k])!==JSON.stringify(b[k]))throw Error('That field has newer changes. Edit it rather than undoing.');if(own(a,k))c[k]=clone(a[k]);else delete c[k];}}
      }
    }
    for(const key of ['checks','planned','preferences']){const a=before[key]||{},b=after[key]||{};if(JSON.stringify(a)===JSON.stringify(b))continue;out[key]=out[key]||{};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){if(JSON.stringify(a[k])===JSON.stringify(b[k]))continue;if(JSON.stringify(out[key][k])!==JSON.stringify(b[k]))throw Error('There are newer changes to these settings.');if(own(a,k))out[key][k]=clone(a[k]);else delete out[key][k];}}
    return out;
  }
  async function transaction(change,label,type='task_updated',onSuccess,options={}){
    if(busy)return false;
    if(pendingAction&&!options.retry){lastError='An earlier change is not saved. Retry or discard that change first.';feedback();return false;}
    const before=clone(S);let next;try{next=clone(S);change(next);window.LifeMapRecords.validate(next);}catch(e){lastError=e.message||'Check the task details.';feedback();return false;}
    busy=true;lastError='';feedback();
    let ok=false;try{const result=persist(next,!!options.restore);ok=(result&&typeof result.then==='function')?await result:result;}catch(e){lastError=e.message;}
    busy=false;
    if(ok!==true){pendingAction={change,label,type,onSuccess,before,restore:!!options.restore};lastError=window.LifeMapLocal?.error||lastError||'This change was not saved. Your entry is still here. Retry saving.';feedback();render();return false;}
    S=next;pendingAction=null;lastError='';if(onSuccess)onSuccess();storeDraft();render();
    if(type==='view_changed')window.AtlasActivity?.log(type,label);else window.AtlasActivity?.meaningful(type,label);toast(label);
    const undoAfter=clone(next);
    if(options.undo!==false)undoToast(label,()=>transaction(state=>{const restored=undoPatch(before,undoAfter,state);Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,restored);},'Change undone','action_undone',null,{undo:false}));
    return true;
  }
  function closeEditor(){if(busy)return;storeDraft();view.editor=null;restorePrompt=!!recoveredEditor;window.AtlasConnected?.clearInputDraft?.();render();}
  function openEditor(kind,item={}){
    if(busy)return;storeDraft();view.editor={kind,...clone(item)};editorBase=item.id?JSON.stringify(item):null;lastError='';render();
  }
  function newTask(parentId=''){
    const g=group(parentId);openEditor('proj',{area:g?.area||view.fArea||'',parentId:parentId||'',task:'',status:'Not started',pri:'Med',inbox:!parentId&&!view.fArea,checklist:[],links:[],tags:[]});
  }
  function taskRow(p,{small=false}={}){
    const done=p.status==='Done',selected=selection.has(p.id),title=esc(p.task),g=group(p.parentId);
    let meta=[];if(g)meta.push(g.title);if(p.status==='Waiting')meta.push('Waiting'+(p.waitingFor?' · '+p.waitingFor:''));
    if(p.due)meta.push((p.due<todayISO()&&!done?'Overdue · ':'Due ')+fmtDay(p.due));
    if(p.plan)meta.push('Planned '+(p.plan===todayISO()?'today':fmtDay(p.plan)));
    else if(p.planWeek)meta.push('Week of '+fmtDay(p.planWeek));
    if(p.followUp&&p.status==='Waiting')meta.push('Follow up '+fmtDay(p.followUp));
    if(p.showAfter)meta.push('Show '+fmtDay(p.showAfter));else if(p.park)meta.push('Parked '+fmtMonth(p.park));if(p.someday)meta.push('Someday');
    if(p.effortMinutes)meta.push(p.effortMinutes+' min');if(p.tags?.length)meta.push(p.tags.join(', '));if(p.pri==='High')meta.push('High');if(p.checklist?.length)meta.push(p.checklist.filter(x=>x.done).length+'/'+p.checklist.length+' steps');
    return '<div class="lm-task-row'+(done?' lm-done':'')+'">'+
      button(selectMode?(selected?'✓':''):(done?'✓':''),selectMode?'select':'complete','data-id="'+esc(p.id)+'" aria-label="'+esc((selectMode?'Select ':done?'Reopen ':'Complete ')+p.task)+'" aria-pressed="'+(selectMode?selected:done)+'"','lm-check')+
      '<button type="button" class="btn lm-task-main" data-lm="edit-task" data-id="'+esc(p.id)+'"><span class="lm-task-title">'+title+'</span>'+(meta.length?'<span class="lm-row-meta">'+meta.map(esc).join(' · ')+'</span>':'')+'</button>'+
      (!selectMode?button('⋯','task-menu','data-id="'+esc(p.id)+'" aria-label="Actions for '+title+'"','lm-icon'):'')+'</div>';
  }
  function choreRow(c){
    const advanced=!!c.repeat,on=isChecked(c),skipped=on&&handledStatus(c)==='skipped',next=advanced?M.choreDue(c,todayISO()):'',future=advanced&&next>todayISO();
    const history=(S.choreHistory||[]).filter(h=>h.choreId===c.id&&h.status==='done').sort((a,b)=>b.date.localeCompare(a.date)),last=history[0];
    return '<div class="lm-task-row">'+button(future?'↗':skipped?'—':on?'✓':'',future?'edit-chore':'chore-complete','data-id="'+esc(c.id)+'" aria-label="'+esc((future?'View next occurrence: ':on?'Mark incomplete: ':'Complete ')+c.chore)+'" aria-pressed="'+on+'"','lm-check')+
      '<button type="button" class="btn lm-task-main" data-lm="edit-chore" data-id="'+esc(c.id)+'"><span class="lm-task-title">'+esc(c.chore)+'</span><span class="lm-row-meta">'+esc([advanced?((future?'Next ':'Due ')+fmtDay(next)):c.cad,skipped?'Skipped this occurrence':'',c.zone,c.who,last?'Last done '+fmtDay(last.date):''].filter(Boolean).join(' · '))+'</span></button>'+button('⋯','chore-menu','data-id="'+esc(c.id)+'" aria-label="Actions for '+esc(c.chore)+'"','lm-icon')+'</div>';
  }
  function areaOptions(){return [['','Inbox / unfiled'],...orderedAreas().map(a=>[a.name,a.name])];}
  function groupOptions(){return [['','Standalone task'],...(S.groups||[]).filter(g=>!g.archived).map(g=>[g.id,g.title])];}
  function orderedAreas(){const extra=[...new Set([...(S.projects||[]).map(p=>p.area),...(S.groups||[]).map(g=>g.area)])].filter(a=>a&&!AREAS.some(x=>x.name===a));const areas=[...AREAS,...extra.map(name=>({name,icon:'◇',desc:''}))],order=S.preferences?.areaOrder||[];return areas.sort((a,b)=>{const ai=order.indexOf(a.name),bi=order.indexOf(b.name);return (ai<0?999:ai)-(bi<0?999:bi);});}
  const baseSection=section;
  section=function(key,title,accent,teaser,content){return baseSection(key,title,accent,teaser,content).replace('data-act="section"','aria-expanded="'+!!view.open[key]+'" data-act="section"');};
  hero=function(){return '<div class="appbar"><a href="'+(window.AtlasConnected?'/':'index.html')+'" class="homebtn" aria-label="Atlas">⌂</a><div style="flex:1;min-width:0"><div class="appbar-title">Life Map</div><div class="appbar-sub">Every area, one board</div></div>'+button('⌕','search','aria-label="Search all Life Map"','lm-icon')+'</div>';};
  function quickHints(){if(!view.qa.txt)return '';const p=view.qa.parse===false?{}:M.parseCapture(view.qa.txt,todayISO());return [view.qa.when?chip('Plan: '+view.qa.when):'',view.qa.area?chip(view.qa.area):'',p.plan?chip('Planned '+fmtDay(p.plan)):'',p.planWeek?chip('Week of '+fmtDay(p.planWeek)):'',p.due?chip('Deadline '+fmtDay(p.due)):''].join('')+((p.plan||p.planWeek||p.due)?button('Keep wording instead','keep-wording'):'');}
  quickCapture=function(){
    const qa=view.qa,n=(S.projects||[]).filter(p=>M.open(p)&&p.inbox).length;
    return '<section class="panel lm-capture"><div class="lm-inline"><input id="qaTxt" data-act="qatxt" value="'+esc(qa.txt||'')+'" maxlength="20000" placeholder="Capture a task…" autocomplete="off" aria-label="Add a task">'+button('Add','quick-add','data-lm-save','lm-primary')+'</div>'+
      '<div id="lm-quick-hints" class="lm-inline">'+quickHints()+'</div><div class="lm-capture-meta">'+button('Inbox'+(n?' · '+n:''),'inbox')+button('More options','capture')+(restorePrompt?button('Resume unfinished edit','resume-edit'):'')+'</div>'+
      '<p id="lm-save-state" class="lm-help" aria-live="polite"></p>'+(pendingAction?'<div class="lm-inline">'+button('Retry saving','retry')+button('Discard unsaved change','discard-failed')+'</div>':'')+'</section>';
  };
  function handledStatus(c){const hs=(S.choreHistory||[]).filter(h=>h.choreId===c.id&&(c.repeat||h.occurrence===periodKey(c.cad)));return hs.at(-1)?.status||(!c.repeat&&oldChecked(c)?'done':'');}
  const oldChecked=isChecked;
  isChecked=function(c){return c.repeat?M.choreDue(c,todayISO())>todayISO():oldChecked(c);};
  isParked=p=>M.parked(p,todayISO());
  openProjects=()=>S.projects.filter(M.open);
  isOverdue=p=>M.open(p)&&!!p.due&&p.due<todayISO();
  isDueSoon=p=>M.open(p)&&p.due&&p.due>=todayISO()&&p.due<=M.plus(todayISO(),14);
  todayItems=function(){const t=M.todayTasks(S.projects,todayISO());const daily=S.chores.filter(c=>!c.archived&&(c.repeat?M.choreDue(c,todayISO())<=todayISO():c.cad==='Daily'));
    const planned=S.chores.filter(c=>!c.archived&&!daily.includes(c)&&plannedToday(c));return {...t,daily,planned,dueNow:t.due,otherDue:S.chores.filter(c=>!c.archived&&!isChecked(c)&&!daily.includes(c)&&!planned.includes(c))};};
  todayPanel=function(){
    const t=todayItems();let h='<section class="panel lm-today"><div class="lm-section-head"><div><div class="eyebrow">Today</div>'+help(niceToday())+'</div>'+button('+','capture-today','aria-label="Add a task for today"','lm-icon')+'</div>';
    if(!t.chosen.length&&!t.due.length&&!t.waiting.length)h+=help('Nothing scheduled for today. Choose a task from Next, or leave the day clear.');
    for(const [label,rows]of [['Chosen for today',t.chosen],['Deadlines',t.due],['Follow-ups',t.waiting]])if(rows.length)h+='<h3 class="lm-mini-heading">'+label+'</h3>'+rows.map(p=>taskRow(p)).join('');
    if(t.rollover.length)h+='<details class="lm-rollover"><summary>'+t.rollover.length+' unfinished from a previous plan</summary>'+help('These are plans, not new overdue deadlines.')+t.rollover.map(p=>'<div>'+taskRow(p)+'<div class="lm-inline lm-row-actions">'+button('Keep today','plan','data-id="'+esc(p.id)+'" data-when="today"')+button('Tomorrow','plan','data-id="'+esc(p.id)+'" data-when="tomorrow"')+button('Back to Next','plan','data-id="'+esc(p.id)+'" data-when="next"')+'</div></div>').join('')+'</details>';
    if(t.daily.length||t.planned.length)h+='<details class="lm-routines"'+(t.chosen.length||t.due.length?'':' open')+'><summary>Today’s routines · '+t.daily.concat(t.planned).filter(c=>!isChecked(c)).length+' open</summary>'+t.daily.concat(t.planned).map(choreRow).join('')+'</details>';
    return h+'</section>';
  };
  stats=function(){const ps=S.projects.filter(p=>!p.archived),done=ps.filter(p=>p.status==='Done').length,cs=S.chores.filter(c=>!c.archived),ck=cs.filter(c=>isChecked(c)&&handledStatus(c)==='done').length;return {total:ps.length,done,open:ps.length-done,prog:ps.filter(p=>p.status==='In progress').length,hi:ps.filter(p=>M.open(p)&&p.pri==='High'&&!isParked(p)).length,over:ps.filter(isOverdue).length,soon:ps.filter(isDueSoon).length,parked:ps.filter(isParked).length,pct:ps.length?Math.round(done/ps.length*100):0,choreDone:ck,choreTotal:cs.length,chorePct:cs.length?Math.round(ck/cs.length*100):0};};
  const originalBoard=boardPanel;
  boardPanel=st=>'<details class="lm-board-progress"><summary>Board overview · '+st.open+' open tasks<span class="lm-overview-score">'+st.pct+'<small>% complete</small></span><span class="lm-summary-track" aria-hidden="true"><span style="width:'+st.pct+'%"></span></span></summary>'+help('This is an inventory, not a score for your life. Project progress lives with each project.')+originalBoard(st)+'</details>';
  focusItems=function(){const t=todayISO();return M.sortTasks(S.projects.filter(p=>M.actionable(p,t)&&p.plan!==t&&(!p.due||p.due>t)),t).map(p=>({p,why:p.planWeek===M.week(t)?'This week':p.due?'Due '+fmtDay(p.due):'Ready when you are',score:0}));};
  focusPanel=function(){const items=focusItems();return '<section class="panel lm-next"><div class="lm-section-head"><div class="eyebrow">Next · ready when you are</div>'+chip(items.length+' tasks')+'</div>'+(items.length?items.slice(0,view.focusAll?items.length:5).map(x=>taskRow(x.p)).join(''):help('No next actions yet. Capture something or organize your Inbox.'))+(items.length>5?button(view.focusAll?'Show top five':'Show all '+items.length,'next-all'):'')+'</section>';};
  function filteredTasks(){const today=todayISO();return S.projects.filter(p=>{
    if(view.fStatus==='_archive') {if(!p.archived)return false;}else if(p.archived)return false;
    if(view.fStatus==='_inbox'&&(!p.inbox||!M.open(p)))return false;
    if(view.fStatus==='_next'&&!M.actionable(p,today))return false;
    if(view.fStatus==='_week'&&(!M.open(p)||p.planWeek!==M.week(today)&&(!p.plan||M.week(p.plan)!==M.week(today))))return false;
    if(view.fStatus==='_open'&&(p.status==='Done'||isParked(p)))return false;
    if(view.fStatus==='_parked'&&!isParked(p))return false;
    if(['Done','Waiting','In progress','Not started'].includes(view.fStatus)&&p.status!==view.fStatus)return false;
    if(view.fArea&&p.area!==view.fArea)return false;if(groupFilter&&p.parentId!==groupFilter)return false;
    if(view.fPri&&p.pri!==view.fPri)return false;if(contextFilter&&!(p.tags||[]).includes(contextFilter))return false;
    if(view.q&&!M.search({projects:[p]},view.q,{archive:true}).length)return false;return true;
  });}
  projectsView=function(){
    const list=filteredTasks(),groups=(S.groups||[]).filter(g=>!g.archived&&(!view.fArea||view.fArea===g.area));
    let h='<div class="lm-section-head">'+button('+ Task','new-task','data-lm-save','lm-primary')+button('+ Project','new-group')+button('Templates','templates')+button(selectMode?'Cancel selection':'Select','selection-mode')+'</div>';
    if(groups.length&&!view.q&&!['_archive','Done','_inbox'].includes(view.fStatus))h+='<div class="lm-project-cards">'+groups.map(g=>{const p=M.projectProgress(S,g,todayISO());return '<article class="lm-project-card"'+(p.total&&p.done===p.total?' data-complete="true"':'')+'><div class="lm-section-head"><button type="button" class="btn lm-project-name" data-lm="group-filter" data-id="'+esc(g.id)+'">'+esc(g.title)+'</button>'+button('⋯','edit-group','data-id="'+esc(g.id)+'" aria-label="Edit '+esc(g.title)+'"','lm-icon')+'</div>'+'<div class="lm-progress-heading"><span>'+p.done+' of '+p.total+' tasks complete</span><strong>'+p.percent+'<small>%</small></strong></div><div class="bartrack" role="progressbar" aria-label="'+esc(g.title)+' task completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+p.percent+'"><div class="fill" style="height:4px;width:'+p.percent+'%;background:var(--blue)"></div></div>'+help(p.next?'Next: '+p.next.task:p.total===p.done&&p.total?'All tasks complete':'No available next action')+button('+ Next action','new-task','data-group="'+esc(g.id)+'"')+'</article>';}).join('')+'</div>';
    h+='<div class="lm-filters"><input data-act="q" data-ui-only value="'+esc(view.q)+'" placeholder="Search tasks…" aria-label="Search tasks"><select data-act="fStatus" data-ui-only aria-label="Task view">'+[['_open','All open'],['_inbox','Inbox'],['_next','Next'],['_week','This week'],['Waiting','Waiting'],['_parked','Deferred / Someday'],['Done','Done'],['_archive','Archived'],['','All tasks']].map(([v,t])=>'<option value="'+v+'"'+(view.fStatus===v?' selected':'')+'>'+t+'</option>').join('')+'</select><select data-act="fArea" data-ui-only aria-label="Filter by area"><option value="">All areas</option>'+orderedAreas().map(a=>'<option'+(view.fArea===a.name?' selected':'')+'>'+esc(a.name)+'</option>').join('')+'</select><select data-act="fPri" data-ui-only aria-label="Filter by priority"><option value="">Any priority</option>'+PRIS.map(x=>'<option'+(view.fPri===x?' selected':'')+'>'+x+'</option>').join('')+'</select><select data-lm="context-filter" data-ui-only aria-label="Context filter"><option value="">Any context</option>'+[...new Set(['Calls','Errands','Quick task',...S.projects.flatMap(p=>p.tags||[])])].map(t=>'<option'+(t===contextFilter?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select></div>';
    if(groupFilter)h+='<div class="lm-inline">'+chip(group(groupFilter)?.title||'Project')+button('Show all projects','clear-group')+'</div>';
    if(selectMode)h+='<div class="lm-bulk-bar">'+chip(selection.size+' selected')+button('Select shown','select-shown')+button('Actions','bulk-menu',selection.size?'':'disabled')+'</div>';
    h+=help(list.length+' tasks shown');
    if(!list.length)h+=help('Nothing in this view. Capture a task or change the filters.');
    for(const [area,tasks]of M.groupTasks(list,todayISO()))h+='<h3 class="lm-mini-heading">'+esc(area)+'</h3>'+tasks.map(p=>taskRow(p)).join('');
    return h;
  };
  mapView=function(){const hide=S.preferences?.hideEmpty!==false;const areas=orderedAreas().filter(a=>!hide||S.projects.some(p=>p.area===a.name&&M.open(p))||(S.groups||[]).some(g=>g.area===a.name&&!g.archived));return '<div class="lm-section-head">'+button('Arrange areas','areas')+button(hide?'Show empty areas':'Hide empty areas','empty-areas')+'</div><div class="lm-area-grid">'+areas.map(a=>{const ps=S.projects.filter(p=>p.area===a.name&&M.open(p));return '<button type="button" class="btn lm-area" data-act="area" data-area="'+esc(a.name)+'"><span>'+a.icon+'</span><strong>'+esc(a.name)+'</strong><small>'+ps.length+' open</small></button>';}).join('')+'</div>'+(areas.length?'':help('Your areas appear as you file tasks. Empty areas are hidden.'));};
  horizonView=function(){const events=[];for(const p of S.projects.filter(M.open))for(const [key,label]of [['plan','Planned'],['due','Deadline'],['showAfter','Returns'],['followUp','Follow up']])if(p[key])events.push({date:p[key],label,p});
    for(const p of S.projects.filter(p=>M.open(p)&&p.park&&!p.showAfter))events.push({date:p.park+'-01',label:'Parked month',p});
    for(const p of S.projects.filter(p=>M.open(p)&&p.planWeek&&!p.plan))events.push({date:p.planWeek,label:'Planned week',p});
    const months=[...new Set(events.map(e=>e.date.slice(0,7)))].sort();let h='<div class="lm-months">'+months.map(m=>button(esc(fmtMonth(m)),'month','data-month="'+m+'" aria-pressed="'+(view.hSel===m)+'"')).join('')+'</div>';
    const shown=events.filter(e=>!view.hSel||e.date.startsWith(view.hSel)).sort((a,b)=>a.date.localeCompare(b.date));if(!shown.length)return h+help('Plan dates and deadlines appear here without turning plans into deadlines.');
    return h+shown.map(e=>'<button type="button" class="btn lm-timeline-row" data-lm="edit-task" data-id="'+esc(e.p.id)+'"><span>'+esc(fmtDay(e.date))+' · '+e.label+'</span><strong>'+esc(e.p.task)+'</strong></button>').join('');};
  choresView=function(){let h='<div class="lm-section-head">'+button('+ Chore','new-chore','data-lm-save','lm-primary')+info('How repeating chores work','Keep calendar cycles, choose a fixed schedule, or repeat after completion. Skipping an occurrence is not counted as completing it.')+'</div>';
    const cs=S.chores.filter(c=>!c.archived);for(const cad of CADS){const rows=cs.filter(c=>c.cad===cad);if(rows.length)h+='<h3 class="lm-mini-heading">'+cad+'</h3>'+rows.map(choreRow).join('');}
    const archived=S.chores.filter(c=>c.archived);if(archived.length)h+='<details><summary>Archived chores · '+archived.length+'</summary>'+archived.map(c=>'<div class="lm-section-head">'+esc(c.chore)+button('Restore','restore-chore','data-id="'+esc(c.id)+'"')+'</div>').join('')+'</details>';
    const history=(S.choreHistory||[]).slice().reverse();if(history.length)h+='<details class="lm-history"><summary>Chore history · '+history.length+'</summary>'+history.slice(0,50).map(e=>'<div class="lm-history-row">'+esc(fmtDay(e.date)+' · '+(chore(e.choreId)?.chore||'Removed chore')+' · '+(e.status==='done'?'Completed':'Skipped'))+'</div>').join('')+help('Recent 50 shown. Your backup retains the full history.')+'</details>';
    return h;
  };
  function capturePreview(){
    try{const rows=M.capture(view.qa.txt,{...view.qa},todayISO(),()=>'-');return rows.map(p=>'<li><strong>'+esc(p.task)+'</strong><span>'+[p.inbox?'Inbox':p.area,p.plan?'Planned '+fmtDay(p.plan):'',p.planWeek?'Week of '+fmtDay(p.planWeek):'',p.due?'Deadline '+fmtDay(p.due):'',p.showAfter?'Returns '+fmtDay(p.showAfter):''].filter(Boolean).map(chip).join('')+'</span></li>').join('');}
    catch(e){return '<li class="lm-help">'+esc(view.qa.txt?e.message:'One task per line. Only a title is required.')+'</li>';}
  }
  function captureEditor(){
    const q=view.qa,suggest=q.txt?guessArea(q.txt):'',count=q.txt.split(/\n/).filter(x=>x.trim()).length;
    return field('Task or tasks','<textarea id="lm-capture-text" data-lm="capture-text" rows="3" maxlength="20000" placeholder="Email contractor tomorrow\nRenew document — due October 30">'+esc(q.txt)+'</textarea>')+
      '<div class="lm-inline lm-plan-chips">'+[['inbox','Inbox'],['today','Today'],['tomorrow','Tomorrow'],['wk','This week'],['next','Next'],['someday','Someday']].map(([v,t])=>button(t,'capture-when','data-when="'+v+'" aria-pressed="'+(q.when===v)+'"')).join('')+'</div>'+
      field('File under (optional)',select('captureArea',q.area,areaOptions()))+(suggest&&suggest!==CATCHALL&&suggest!==q.area?button('Suggestion: '+esc(suggest),'accept-area','data-area="'+esc(suggest)+'"'):'')+
      field('Project (optional)',select('captureParent',q.parentId,groupOptions()))+
      '<label class="lm-checkbox"><input type="checkbox" data-lm="parse-capture"'+(q.parse!==false?' checked':'')+'> Recognize dates at the end of each line</label>'+help('“Tomorrow” is a plan. “Due October 30” is a deadline. Turn this off to keep the wording exactly as typed.')+
      '<ul id="lm-capture-preview" class="lm-capture-preview">'+capturePreview()+'</ul><div class="lm-sheet-actions">'+button(count>1?'Add '+count+' tasks':'Add task','save-capture','data-lm-save','lm-primary')+button('Add & keep capturing','add-another','data-lm-save')+'</div>';
  }
  function taskEditor(e){
    const checklist=e.checklist||[];
    return field('Task','<textarea data-lm="field" data-field="task" maxlength="300" rows="2" placeholder="What needs doing?">'+esc(e.task||'')+'</textarea>')+
      '<div class="lm-two-col">'+field('Area',select('area',e.area,areaOptions()))+field('Project',select('parentId',e.parentId,groupOptions()))+'</div>'+
      '<div class="lm-inline lm-plan-chips">'+[['today','Today'],['tomorrow','Tomorrow'],['wk','This week'],['next','Next'],['inbox','Inbox']].map(([v,t])=>button(t,'editor-plan','data-when="'+v+'"')).join('')+'</div>'+
      '<div class="lm-two-col">'+field('Plan to work on',input('plan',e.plan,'date'))+field('Actual deadline',input('due',e.due,'date'))+'</div>'+(e.planWeek?help('Planned for the week of '+fmtDay(e.planWeek))+button('Clear planned week','clear-week'):'')+
      '<div class="lm-two-col">'+field('Status',select('status',e.status||'Not started',[['Not started','Not started'],['In progress','In progress'],['Waiting','Waiting'],['Done','Done']]))+field('Priority',select('pri',e.pri||'Med',PRIS.map(x=>[x,x])))+'</div>'+
      (e.status==='Waiting'?'<div class="lm-two-col">'+field('Waiting for / who',input('waitingFor',e.waitingFor,'text','maxlength="300"'))+field('Follow up on',input('followUp',e.followUp,'date'))+'</div>':'')+
      '<details class="lm-details"'+(e.notes||checklist.length?' open':'')+'><summary>Notes, checklist & links</summary>'+field('Notes','<textarea data-lm="field" data-field="notes" rows="3" maxlength="20000">'+esc(e.notes||'')+'</textarea>')+
      '<div class="lm-checklist">'+checklist.map((c,i)=>'<div class="lm-inline"><input type="checkbox" data-lm="check-item" data-index="'+i+'" aria-label="Complete checklist item"'+(c.done?' checked':'')+'><input data-lm="check-text" data-index="'+i+'" value="'+esc(c.text)+'" maxlength="500" aria-label="Checklist item '+(i+1)+'">'+button('×','remove-check','data-index="'+i+'" aria-label="Remove checklist item"','lm-icon')+'</div>').join('')+button('+ Checklist item','add-check')+'</div>'+
      field('Source links (one per line)','<textarea data-lm="field" data-field="linksText" rows="2" placeholder="https://…">'+esc(e.linksText??(e.links||[]).join('\n'))+'</textarea>')+'</details>'+
      '<details class="lm-details"><summary>Context & deferral</summary>'+field('Context tags (comma separated)',input('tagsText',e.tagsText??(e.tags||[]).join(', '),'text','placeholder="Calls, Errands, Quick task"'))+field('Estimated effort (minutes)',input('effortMinutes',e.effortMinutes,'number','min="1" max="10080" step="1"'))+field('Sub-area',input('sub',e.sub,'text','maxlength="500"'))+field('Show again on',input('showAfter',e.showAfter,'date'))+
      '<label class="lm-checkbox"><input type="checkbox" data-lm="field-check" data-field="someday"'+(e.someday?' checked':'')+'> Someday — keep out of Next</label><label class="lm-checkbox"><input type="checkbox" data-lm="field-check" data-field="inbox"'+(e.inbox?' checked':'')+'> Still needs organizing (Inbox)</label>'+help('Deferral does not change a real deadline. Nearby deadlines remain visible.')+'</details>'+
      '<div class="lm-sheet-actions">'+button('Save task','save-editor','data-lm-save','lm-primary')+(e.id?button('Calendar reminder','reminder','data-id="'+esc(e.id)+'"'):'')+'</div>'+(e.id?button('Delete task','delete-editor','','lm-danger'):'');
  }
  function choreEditor(e){
    const r=e.repeat||{},mode=e.repeatMode??r.mode??'cycle',unit=e.repeatUnit??r.unit??(e.cad==='Daily'?'day':e.cad==='Monthly'||e.cad==='Quarterly'?'month':e.cad==='Annual'?'year':'week');
    return field('Chore',input('chore',e.chore,'text','maxlength="300"'))+field('Repeat style',select('repeatMode',mode,[['cycle','Calendar cycle (existing behaviour)'],['fixed','Fixed schedule'],['after','After completion']]))+
      (mode==='cycle'?field('Cycle',select('cad',e.cad||'Weekly',CADS.map(x=>[x,x]))):'<div class="lm-two-col">'+field('Every',input('repeatEvery',e.repeatEvery??r.every??1,'number','min="1" max="365"'))+field('Unit',select('repeatUnit',unit,[['day','Days'],['week','Weeks'],['month','Months'],['year','Years']]))+'</div>'+field(mode==='fixed'?'First scheduled date':'First due date',input('repeatAnchor',e.repeatAnchor??r.anchor??todayISO(),'date'))+(mode==='fixed'?help('The start date sets the weekday or day of the month. Finishing late does not shift this schedule.'):help('The next due date is calculated from the day you actually complete it.')))+
      '<div class="lm-two-col">'+field('Zone',input('zone',e.zone,'text','maxlength="300"'))+field('Who',input('who',e.who,'text','maxlength="300"'))+'</div>'+field('Notes','<textarea data-lm="field" data-field="notes" rows="3" maxlength="20000">'+esc(e.notes||'')+'</textarea>')+
      '<div class="lm-sheet-actions">'+button('Save chore','save-editor','data-lm-save','lm-primary')+'</div>'+(e.id?button('Archive chore','archive-chore','data-id="'+esc(e.id)+'"')+button('Delete chore','delete-editor','','lm-danger'):'');
  }
  function groupEditor(e){return field('Project name',input('title',e.title,'text','maxlength="300"'))+field('Area',select('area',e.area,areaOptions()))+field('Notes','<textarea data-lm="field" data-field="notes" rows="3" maxlength="20000">'+esc(e.notes||'')+'</textarea>')+'<div class="lm-sheet-actions">'+button('Save project','save-editor','data-lm-save','lm-primary')+'</div>'+(e.id?'<div class="lm-inline">'+button('+ Next action','new-task','data-group="'+esc(e.id)+'"')+button('Save as template','save-template','data-id="'+esc(e.id)+'"')+button(e.archived?'Restore project':'Archive completed project',e.archived?'restore-group':'archive-group','data-id="'+esc(e.id)+'"')+'</div>':'');}
  function searchEditor(){const results=M.search(S,view.search||'',{archive:searchArchive});return '<input id="lm-search" data-lm="search-input" data-ui-only value="'+esc(view.search||'')+'" placeholder="Tasks, projects, chores, notes…" aria-label="Search all Life Map"><label class="lm-checkbox"><input type="checkbox" data-lm="search-archive" data-ui-only'+(searchArchive?' checked':'')+'> Include completed and archived</label><div id="lm-search-results">'+results.map(r=>'<button type="button" class="btn lm-search-result" data-lm="'+(r.kind==='task'?'edit-task':r.kind==='chore'?'edit-chore':'edit-group')+'" data-id="'+esc(r.item.id)+'"><strong>'+esc(r.item.task||r.item.title||r.item.chore)+'</strong><small>'+esc(r.kind+' · '+(r.kind==='task'?M.classify(r.item,todayISO()):r.item.area||r.item.cad||'')+(r.item.parentId?' · '+(group(r.item.parentId)?.title||''):''))+'</small></button>').join('')+(view.search&&!results.length?help('No matches. Include completed and archived to search the full history.'):'')+'</div>';}
  function taskMenu(p){return '<div class="lm-menu">'+[['today','Today'],['tomorrow','Tomorrow'],['wk','This week'],['next','Back to Next'],['inbox','Inbox'],['someday','Someday']].map(([v,t])=>button(t,'plan','data-id="'+esc(p.id)+'" data-when="'+v+'"')).join('')+button(p.status==='Waiting'?'Resume task':'Waiting / follow-up','wait-task','data-id="'+esc(p.id)+'"')+button('Edit / move / defer','edit-task','data-id="'+esc(p.id)+'"')+button('Calendar reminder','reminder','data-id="'+esc(p.id)+'"')+(p.archived?button('Restore task','restore-task','data-id="'+esc(p.id)+'"'):p.status==='Done'?button('Archive completed task','archive-task','data-id="'+esc(p.id)+'"'):'')+'</div>'+(p.links||[]).filter(safeLink).map(x=>'<a class="lm-source-link" target="_blank" rel="noopener noreferrer" href="'+esc(x)+'">'+esc(x)+'</a>').join('');}
  function bulkEditor(e){const action=e.action||'plan';return help(selection.size+' selected tasks. Real deadlines remain unchanged by planning actions.')+field('Action',select('action',action,[['plan','Schedule / return to Next'],['area','Move to an area'],['group','Move into a project'],['defer','Show again on a date'],['archive','Archive completed tasks'],['restore','Restore archived tasks']]))+
    (action==='plan'?field('When',select('when',e.when||'today',[['today','Today'],['tomorrow','Tomorrow'],['wk','This week'],['next','Next'],['inbox','Inbox'],['someday','Someday']])):action==='area'?field('Area',select('area',e.area,areaOptions())):action==='group'?field('Project',select('parentId',e.parentId,groupOptions())):action==='defer'?field('Show again on',input('showAfter',e.showAfter,'date')):'')+button('Apply to selected','apply-bulk','data-lm-save','lm-primary');}
  function connectionsEditor(){const base=typeof location!=='undefined'?location.origin+location.pathname:'';
    return '<h3>One trusted place</h3>'+help(window.AtlasConnected?'This private Life Map saves across signed-in devices. Browser drafts remain local until you save.':'This board is saved in this browser only. Another browser, device, or Home Screen storage context can have a separate board.')+help(window.AtlasConnected?'Opening a different Life Map copy does not move records. Use confirmed backup/import only when you deliberately change copies.':'Keep using this browser as your working copy. The private site is separate and needs its updated build deployed before importing these new workflow fields. Opening it does not synchronize this board.')+
      '<a class="lm-source-link" href="https://atlas-os-quinton.qchambers123018.chatgpt.site/apps/life-map" target="_blank" rel="noopener noreferrer">Open private Life Map</a>'+
      '<h3>Add to Life Map from iPhone</h3>'+help('In Shortcuts, create a shortcut shown in the Share Sheet that accepts text and URLs. Use Get Text from Input, URL Encode, then Open URLs with the address below and the encoded input after #capture=. A preview opens; nothing is silently added.')+
      '<input readonly aria-label="Shortcut capture address" value="'+esc(base+'#capture=')+'">'+button('Copy capture address','copy-capture-address')+help('Shortcut installation is a device step. Choose the same Life Map copy every time. Signing in to the private copy is required for cross-device capture.')+
      '<h3>Reminders</h3>'+help('Use Calendar reminder on a saved task to export a calendar event with an alert. Import it into your calendar and confirm the alert there. Exporting a file alone does not schedule a notification. Life Map does not claim background push is enabled.')+
      '<h3>The Review</h3>'+help('Saved task, project, and chore actions report generic event counts. Task titles, notes, links, and waiting details are not copied into Review. No Life Ledger credit is awarded automatically.');}
  editorView=function(){
    const e=view.editor;if(!e)return '';let title='Task details',body='';
    if(e.kind==='capture'){title='Quick capture';body=captureEditor();}
    else if(e.kind==='proj'){title=e.id?'Task details':'New task';body=taskEditor(e);}
    else if(e.kind==='chore'){title=e.id?'Chore details':'New chore';body=choreEditor(e);}
    else if(e.kind==='group'){title=e.id?'Project details':'New project';body=groupEditor(e);}
    else if(e.kind==='search'){title='Search Life Map';body=searchEditor();}
    else if(e.kind==='menu'){const p=project(e.id);title=p?.task||'Task actions';body=p?taskMenu(p):help('This task is no longer available.');}
    else if(e.kind==='chore-menu'){const c=chore(e.id);title=c?.chore||'Chore actions';body=c?'<div class="lm-menu">'+button(plannedToday(c)?'Remove from Today':'Add to Today','plan-chore','data-id="'+esc(c.id)+'"')+(!isChecked(c)?button('Complete occurrence','chore-complete','data-id="'+esc(c.id)+'"')+button('Skip this occurrence','skip-chore','data-id="'+esc(c.id)+'"'):'')+button('Reschedule occurrence','reschedule-chore','data-id="'+esc(c.id)+'"')+button('Edit details','edit-chore','data-id="'+esc(c.id)+'"')+'</div>':'';}
    else if(e.kind==='reschedule'){title='Reschedule occurrence';body=field('Next due date',input('nextDue',e.nextDue,'date'))+help('This changes the next occurrence, not its completion history.')+button('Reschedule','save-reschedule','data-lm-save','lm-primary');}
    else if(e.kind==='bulk'){title='Organize selected tasks';body=bulkEditor(e);}
    else if(e.kind==='areas'){title='Arrange areas';body=help('Move areas up or down. Only the display order changes.')+orderedAreas().map((a,i)=>'<div class="lm-section-head"><span>'+a.icon+' '+esc(a.name)+'</span><div>'+button('↑','area-order','data-area="'+esc(a.name)+'" data-direction="-1" aria-label="Move '+esc(a.name)+' up"'+(!i?' disabled':''),'lm-icon')+button('↓','area-order','data-area="'+esc(a.name)+'" data-direction="1" aria-label="Move '+esc(a.name)+' down"'+(i===orderedAreas().length-1?' disabled':''),'lm-icon')+'</div></div>').join('');}
    else if(e.kind==='templates'){title='Project templates';body=help('Save an existing project as a template from its project details. Using one creates a fresh project with unchecked tasks and no old deadlines.')+(S.templates||[]).map(t=>'<div class="lm-section-head"><span>'+esc(t.title)+'<small class="lm-help">'+t.tasks.length+' tasks</small></span>'+button('Preview','template-preview','data-id="'+esc(t.id)+'"')+button('Delete','delete-template','data-id="'+esc(t.id)+'"','lm-danger')+'</div>').join('');}
    else if(e.kind==='template-preview'){const t=(S.templates||[]).find(t=>t.id===e.id);title='Use template';body=t?field('New project name',input('title',e.title||t.title,'text','maxlength="300"'))+'<ul class="lm-capture-preview">'+t.tasks.map(p=>'<li>'+esc(p.task)+'</li>').join('')+'</ul>'+button('Create project','use-template','data-id="'+esc(t.id)+'" data-lm-save','lm-primary'):help('This template is no longer available.');}
    else if(e.kind==='reminder'){title='Calendar reminder';body=field('Reminder date',input('date',e.date,'date'))+field('Time (your calendar’s local time)',input('time',e.time||'09:00','time'))+help('Download, import into your calendar, then confirm the event and alert. This is not a background web-push notification.')+button('Export reminder','export-reminder','data-lm-save','lm-primary');}
    else if(e.kind==='archived-groups'){title='Archived projects';body=(S.groups||[]).filter(g=>g.archived).map(g=>'<div class="lm-section-head">'+esc(g.title)+button('Restore','restore-group','data-id="'+esc(g.id)+'"')+'</div>').join('')||help('No archived projects.');}
    else if(e.kind==='connections'){title='Capture, saving & reminders';body=connectionsEditor();}
    return '<dialog class="overlay lm-sheet-overlay" role="dialog" aria-modal="true" aria-labelledby="lm-sheet-title"><div class="panel lm-sheet"><div class="lm-sheet-header"><h2 id="lm-sheet-title">'+esc(title)+'</h2>'+button('×','close','aria-label="Close"','lm-icon')+'</div><div class="lm-sheet-body">'+body+'<p id="lm-editor-status" class="lm-error" role="alert">'+esc(lastError||draftError)+'</p>'+(pendingAction?'<div class="lm-inline">'+button('Retry saving','retry')+button('Discard unsaved change','discard-failed')+'</div>':'')+'</div></div></dialog>';
  };
  function clearEdit(){view.editor=null;recoveredEditor=null;recoveredBase=null;restorePrompt=false;editorBase=null;window.AtlasConnected?.clearInputDraft?.();}
  function rememberStatus(next,p,status){
    const was=p.status;p.status=status;p.updatedAt=todayISO();next.log=(next.log||[]).filter(e=>!(e.t==='proj'&&e.id===p.id));
    if(status==='Done'){p.doneAt=was==='Done'&&p.doneAt?p.doneAt:todayISO();next.log.push({t:'proj',id:p.id,d:p.doneAt});}else delete p.doneAt;
  }
  function setStatus(id,status){if(!['Not started','In progress','Waiting','Done'].includes(status))return false;return transaction(next=>{const p=next.projects.find(p=>p.id===id);if(!p)throw Error('This task was removed.');rememberStatus(next,p,status);},status==='Done'?'Task completed':'Task status updated',status==='Done'?'task_completed':'task_updated');}
  advance=id=>{const p=project(id);return p?setStatus(id,p.status==='Done'?'Not started':'Done'):false;};
  saveEditor=function(){
    const e=view.editor;if(!e||!['proj','chore','group'].includes(e.kind))return false;
    const collection=e.kind==='chore'?'chores':e.kind==='group'?'groups':'projects';
    const current=(S[collection]||[]).find(p=>p.id===e.id);
    if(e.id&&editorBase&&JSON.stringify(current)!==editorBase){lastError='This record changed since the draft was opened. Copy your draft before reopening the latest record.';feedback();render();return false;}
    const row={...clone(current||{}),id:e.id||uid()},date=todayISO();
    try{
      if(e.kind==='proj'){
        for(const k of ['task','area','sub','pri','due','park','notes','plan','planWeek','showAfter','parentId','waitingFor','followUp'])row[k]=String(e[k]??row[k]??'');
        if(e.effortMinutes!==undefined){const n=Number(e.effortMinutes);if(e.effortMinutes!==''&&(!Number.isInteger(n)||n<1||n>10080))throw Error('Use a whole number of minutes between 1 and 10080.');if(e.effortMinutes==='')delete row.effortMinutes;else row.effortMinutes=n;}row.task=row.task.trim();row.pri=row.pri||'Med';for(const k of ['inbox','someday','archived'])if(e[k]!==undefined)row[k]=!!e[k];
        row.status=e.status||row.status||'Not started';row.tags=e.tagsText!==undefined?e.tagsText.split(',').map(x=>x.trim()).filter(Boolean):e.tags||row.tags||[];
        row.links=e.linksText!==undefined?e.linksText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean):e.links||row.links||[];
        row.checklist=(e.checklist||row.checklist||[]).filter(c=>c.text?.trim()).map(c=>({id:c.id||uid(),text:c.text.trim(),done:!!c.done}));
        if(row.parentId){const g=group(row.parentId);if(!g)throw Error('Choose an existing project.');row.area=g.area||row.area;row.inbox=false;}
        if(!row.task)throw Error('Describe the task first.');if(row.showAfter)row.park='';
      }else if(e.kind==='chore'){
        for(const k of ['chore','cad','zone','who','notes'])row[k]=String(e[k]??row[k]??'');row.chore=row.chore.trim();row.cad=row.cad||'Weekly';if(!row.chore)throw Error('Name the chore first.');
        const mode=e.repeatMode??e.repeat?.mode??'cycle';
        if(mode==='cycle'){delete row.repeat;delete row.nextDue;}
        else {row.repeat={mode,unit:e.repeatUnit??e.repeat?.unit??'week',every:Number(e.repeatEvery??e.repeat?.every??1),anchor:e.repeatAnchor??e.repeat?.anchor??date};
          if(JSON.stringify(row.repeat)!==JSON.stringify(current?.repeat))row.nextDue=row.repeat.anchor;
          row.cad=row.repeat.unit==='day'?'Daily':row.repeat.unit==='week'?'Weekly':row.repeat.unit==='year'?'Annual':row.repeat.every===3?'Quarterly':'Monthly';}
      }else {row.title=String(e.title||'').trim();row.area=String(e.area||'');row.notes=String(e.notes||'');if(!row.title)throw Error('Name the project first.');}
      row.createdAt=row.createdAt||date;row.updatedAt=date;
    }catch(error){lastError=error.message;feedback();render();return false;}
    return transaction(next=>{
      next[collection]=next[collection]||[];const i=next[collection].findIndex(p=>p.id===row.id);if(i>=0)next[collection][i]=row;else next[collection].push(row);
      if(e.kind==='proj')rememberStatus(next,row,row.status);
      if(e.kind==='chore'&&JSON.stringify(current?.repeat)!==JSON.stringify(row.repeat)){delete next.checks[row.id];}
      if(e.kind==='group'&&current?.area!==row.area)for(const p of next.projects)if(p.parentId===row.id)p.area=row.area;
    },e.kind==='group'?'Project saved':e.kind==='chore'?'Chore saved':'Task saved',e.kind==='group'?'project_updated':e.kind==='chore'?'chore_updated':!current?'task_captured':'task_updated',clearEdit);
  };
  quickAdd=function(keep=false){
    const top=document.getElementById('qaTxt');if(view.editor?.kind!=='capture'&&top)view.qa.txt=top.value;
    let rows;try{rows=M.capture(view.qa.txt,view.qa,todayISO(),uid);if(view.qa.links?.length)rows[0].links=view.qa.links.filter(safeLink);}catch(e){lastError=e.message;feedback();return false;}
    return transaction(next=>{next.projects.push(...rows);},rows.length===1?'Task captured':rows.length+' tasks captured','task_captured',()=>{const keepContext=keep?{area:view.qa.area,parentId:view.qa.parentId,when:view.qa.when}:{};view.qa={txt:'',area:'',when:'',pick:false,parse:true,parentId:'',...keepContext};if(keep)view.editor={kind:'capture'};else clearEdit();});
  };
  function planTask(id,when){return transaction(next=>{const p=next.projects.find(p=>p.id===id);if(!p)throw Error('Task not found.');M.setPlan(p,when,todayISO());p.updatedAt=todayISO();},'Task plan updated','task_planned',()=>{if(view.editor?.kind==='menu')clearEdit();});}
  function choreAction(id,action){const c=chore(id);if(!c)return false;return transaction(next=>{
    const item=next.chores.find(c=>c.id===id),occurrence=item.repeat?M.choreDue(item,todayISO()):periodKey(item.cad);next.choreHistory=next.choreHistory||[];
    if(action==='done'&&!item.repeat&&next.checks[id]===occurrence){delete next.checks[id];next.choreHistory=next.choreHistory.filter(h=>!(h.choreId===id&&h.occurrence===occurrence));return;}
    next.choreHistory=next.choreHistory.filter(h=>!(h.choreId===id&&h.occurrence===occurrence));
    next.choreHistory.push({id:uid(),choreId:id,date:todayISO(),occurrence,status:action});
    if(item.repeat)item.nextDue=item.repeat.mode==='fixed'?M.nextFixed(item.repeat,occurrence>todayISO()?occurrence:todayISO()):M.advanceChore(item,todayISO());else next.checks[id]=occurrence;
    delete next.planned[id];
  },action==='skipped'?'Chore occurrence skipped':'Chore check-in saved',action==='skipped'?'chore_skipped':!c.repeat&&isChecked(c)?'chore_reopened':'chore_completed',()=>{if(view.editor?.kind==='chore-menu')clearEdit();});}
  tick=id=>choreAction(id,'done');
  planToggle=id=>transaction(next=>{if(!next.chores.some(c=>c.id===id))throw Error('Chore not found.');next.planned=next.planned||{};if(next.planned[id]===todayISO())delete next.planned[id];else next.planned[id]=todayISO();},'Chore plan updated','chore_planned',()=>{if(view.editor?.kind==='chore-menu')clearEdit();});
  // Native confirmation remains above the task editor's top layer.
  uiConfirm=function(title,body,label,callback,danger){
    const dialog=document.createElement('dialog');dialog.id='uiDlg';dialog.className='lm-confirm';dialog.setAttribute('aria-labelledby','lm-confirm-title');
    const heading=document.createElement('h2');heading.id='lm-confirm-title';heading.textContent=title;
    const text=document.createElement('p');text.textContent=body;const actions=document.createElement('div');actions.className='lm-inline';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.className='btn lm-button';cancel.onclick=()=>dialog.close();
    const accept=document.createElement('button');accept.type='button';accept.textContent=label;accept.className='btn lm-button'+(danger?' lm-danger':' lm-primary');accept.onclick=()=>{dialog.close();callback();};
    actions.append(cancel,accept);dialog.append(heading,text,actions);dialog.addEventListener('close',()=>dialog.remove());document.body.appendChild(dialog);dialog.showModal();cancel.focus();
  };
  delEditor=function(){const e=view.editor;if(!e?.id)return;const key=e.kind==='chore'?'chores':'projects',id=e.id;uiConfirm('Delete '+(e.kind==='chore'?'chore':'task')+'?',e.chore||e.task||'This record','Delete',()=>transaction(next=>{next[key]=next[key].filter(x=>x.id!==id);if(key==='projects')next.log=(next.log||[]).filter(x=>x.id!==id);else {delete next.checks[id];delete next.planned[id];next.choreHistory=(next.choreHistory||[]).filter(x=>x.choreId!==id);}},'Record deleted','record_deleted',clearEdit),true);};
  exportData=function(){
    try{storeDraft();if(window.LifeMapLocal?.blocked){download(window.LifeMapLocal.raw??'No readable record.','life-map-recovery.txt','text/plain');return;}
      const record={app:'life-map',version:3,exportedAt:new Date().toISOString(),...clone(pendingAction?pendingCandidate():S),entryDraft:{version:2,qa:view.qa,editor:view.editor&&['proj','chore','group'].includes(view.editor.kind)?view.editor:recoveredEditor,base:view.editor&&['proj','chore','group'].includes(view.editor.kind)?editorBase:recoveredBase}};
      download(JSON.stringify(record,null,2),'life-map-'+todayISO()+'.json','application/json');toast('Backup prepared. Save the file on your device.');
    }catch{toast('Could not prepare the backup. Your records are unchanged.');}
  };
  function pendingCandidate(){const next=clone(S);pendingAction?.change(next);return next;}
  function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  importData=async function(file){const ticket=++importTicket;try{if(file.size>1500000)throw Error('Choose a backup smaller than 1.5 MB.');const pack=JSON.parse(await file.text()),next=window.LifeMapRecords.validate(pack),draft=pack.entryDraft;if(draft!==undefined&&(draft?.version!==2||typeof draft.qa?.txt!=='string'||draft.qa.txt.length>20000||draft.editor&&!['proj','chore','group'].includes(draft.editor.kind)))throw Error('The backup contains an invalid unfinished entry.');if(ticket!==importTicket)return;
    delete next.entryDraft;delete next.exportedAt;delete next.app;delete next.version;
    uiConfirm('Restore this Life Map?',next.projects.length+' tasks and '+next.chores.length+' chores will replace this board. Export a backup first. The other Life Map copy is not changed.','Restore',()=>{if(ticket!==importTicket)return;return transaction(state=>{Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,next);},'Life Map restored','backup_restored',()=>{clearEdit();selection.clear();if(draft){view.qa={txt:'',area:'',when:'',parse:true,parentId:'',...clone(draft.qa)};recoveredEditor=clone(draft.editor||null);recoveredBase=draft.base??null;restorePrompt=!!recoveredEditor;}},{restore:true});},true);
  }catch(e){lastError=e.message||'The backup could not be read.';feedback();toast(lastError);}};
  function archiveTask(id,value){return transaction(next=>{const p=next.projects.find(p=>p.id===id);if(!p)throw Error('Task not found.');if(value&&p.status!=='Done')throw Error('Complete the task before archiving it. Use Someday to defer open work.');p.archived=value;},value?'Completed task archived':'Task restored','task_organized',clearEdit);}
  function applyBulk(){const e=view.editor,ids=new Set(selection);if(!ids.size)return;
    return transaction(next=>{for(const p of next.projects.filter(p=>ids.has(p.id))){
      if(e.action==='area'){p.area=e.area||'';p.inbox=!e.area;p.parentId='';}
      else if(e.action==='group'){p.parentId=e.parentId||'';if(p.parentId){const g=next.groups?.find(g=>g.id===p.parentId);if(!g)throw Error('Project not found.');p.area=g.area;p.inbox=false;}}
      else if(e.action==='defer'){if(!M.validDate(e.showAfter))throw Error('Choose a return date.');p.showAfter=e.showAfter;p.park='';p.plan='';p.planWeek='';p.someday=false;p.inbox=false;}
      else if(e.action==='archive'){if(p.status!=='Done')throw Error('Only completed tasks can be archived. Select completed tasks or choose Someday.');p.archived=true;}
      else if(e.action==='restore')p.archived=false;
      else M.setPlan(p,e.when||'today',todayISO());p.updatedAt=todayISO();
    }},ids.size+' tasks organized','tasks_organized',()=>{selection.clear();selectMode=false;clearEdit();});
  }
  function captureSheet(when,parentId){
    storeDraft();if(when)view.qa.when=when;if(parentId){view.qa.parentId=parentId;view.qa.area=group(parentId)?.area||'';}
    view.editor={kind:'capture'};lastError='';render();document.getElementById('lm-capture-text')?.focus({preventScroll:true});
  }
  function handle(action,el){
    const id=el.dataset.id;
    if(action==='close'){closeEditor();return;}
    if(action==='quick-add'){const text=document.getElementById('qaTxt')?.value||view.qa.txt;if(text.includes('\n')){view.qa.txt=text;captureSheet();}else quickAdd();return;}
    if(action==='save-capture')return quickAdd();if(action==='add-another')return quickAdd(true);
    if(action==='capture')return captureSheet();if(action==='capture-today')return captureSheet('today');
    if(action==='capture-when'){view.qa.when=el.dataset.when;storeDraft();render();return;}
    if(action==='keep-wording'){view.qa.parse=false;storeDraft();render();return;}
    if(action==='accept-area'){view.qa.area=el.dataset.area;storeDraft();render();return;}
    if(action==='complete')return advance(id);
    if(action==='edit-task'){const p=project(id);if(p)openEditor('proj',p);return;}
    if(action==='edit-chore'){const c=chore(id);if(c)openEditor('chore',c);return;}
    if(action==='edit-group'){const g=group(id);if(g)openEditor('group',g);return;}
    if(action==='new-task')return newTask(el.dataset.group||groupFilter);
    if(action==='new-group')return openEditor('group',{title:'',area:view.fArea||''});
    if(action==='new-chore')return openEditor('chore',{chore:'',cad:'Weekly'});
    if(action==='task-menu')return openEditor('menu',{id});
    if(action==='chore-menu')return openEditor('chore-menu',{id});
    if(action==='save-editor')return saveEditor();if(action==='delete-editor')return delEditor();
    if(action==='plan')return planTask(id,el.dataset.when);
    if(action==='editor-plan'){M.setPlan(view.editor,el.dataset.when,todayISO());storeDraft();render();return;}
    if(action==='clear-week'){view.editor.planWeek='';storeDraft();render();return;}
    if(action==='wait-task'){const p=project(id);if(p)openEditor('proj',{...p,status:p.status==='Waiting'?'Not started':'Waiting'});if(p)editorBase=JSON.stringify(p);return;}
    if(action==='chore-complete')return choreAction(id,'done');if(action==='skip-chore')return choreAction(id,'skipped');
    if(action==='plan-chore')return planToggle(id);
    if(action==='reschedule-chore'){const c=chore(id);if(c)openEditor('reschedule',{id,nextDue:c.nextDue||M.plus(todayISO(),1)});return;}
    if(action==='save-reschedule'){const e=view.editor;return transaction(next=>{if(!M.validDate(e.nextDue))throw Error('Choose a due date.');const c=next.chores.find(c=>c.id===e.id);if(!c)throw Error('Chore not found.');if(!c.repeat){const unit=c.cad==='Daily'?'day':c.cad==='Weekly'?'week':c.cad==='Annual'?'year':'month';c.repeat={mode:'fixed',unit,every:c.cad==='Quarterly'?3:1,anchor:e.nextDue};}c.nextDue=e.nextDue;},'Chore occurrence rescheduled','chore_rescheduled',clearEdit);}
    if(action==='archive-chore'||action==='restore-chore')return transaction(next=>{const c=next.chores.find(c=>c.id===id);if(c)c.archived=action==='archive-chore';},action==='archive-chore'?'Chore archived':'Chore restored','chore_organized',clearEdit);
    if(action==='archive-task'||action==='restore-task')return archiveTask(id,action==='archive-task');
    if(action==='archive-group'||action==='restore-group')return transaction(next=>{const g=next.groups?.find(g=>g.id===id);if(!g)throw Error('Project not found.');const tasks=next.projects.filter(p=>p.parentId===id);if(action==='archive-group'&&tasks.some(p=>M.open(p)))throw Error('Complete or move the remaining tasks before archiving this project.');g.archived=action==='archive-group';tasks.forEach(p=>p.archived=g.archived);},action==='archive-group'?'Completed project archived':'Project restored','project_organized',clearEdit);
    if(action==='next-all'){view.focusAll=!view.focusAll;render();return;}
    if(action==='inbox'){view.fStatus='_inbox';view.fArea='';view.q='';groupFilter='';contextFilter='';view.open.proj=true;render();jumpProjects();return;}
    if(action==='group-filter'){groupFilter=id;view.fStatus='_open';view.q='';render();return;}
    if(action==='clear-group'){groupFilter='';render();return;}
    if(action==='selection-mode'){selectMode=!selectMode;selection.clear();render();return;}
    if(action==='select'){if(selection.has(id))selection.delete(id);else selection.add(id);render();return;}
    if(action==='select-shown'){filteredTasks().forEach(p=>selection.add(p.id));render();return;}
    if(action==='bulk-menu')return openEditor('bulk',{action:'plan',when:'today'});
    if(action==='apply-bulk')return applyBulk();
    if(action==='month'){view.hSel=view.hSel===el.dataset.month?null:el.dataset.month;render();return;}
    if(action==='areas')return openEditor('areas');
    if(action==='empty-areas')return transaction(next=>{next.preferences=next.preferences||{};next.preferences.hideEmpty=next.preferences.hideEmpty===false;},'Area display updated','view_changed');
    if(action==='area-order'){const order=orderedAreas().map(a=>a.name),i=order.indexOf(el.dataset.area),j=i+Number(el.dataset.direction);if(i<0||j<0||j>=order.length)return;[order[i],order[j]]=[order[j],order[i]];return transaction(next=>{next.preferences=next.preferences||{};next.preferences.areaOrder=order;},'Area order updated','view_changed');}
    if(action==='search'){view.search=view.search||'';openEditor('search');document.getElementById('lm-search')?.focus({preventScroll:true});return;}
    if(action==='templates')return openEditor('templates');
    if(action==='save-template'){const g=group(id);if(!g)return;const t={id:uid(),...M.taskTemplate(S,g)};return transaction(next=>{next.templates=next.templates||[];next.templates.push(t);},'Project template saved','template_created',clearEdit);}
    if(action==='template-preview'){const t=S.templates?.find(t=>t.id===id);if(t)openEditor('template-preview',{id,title:t.title});return;}
    if(action==='use-template'){const t=S.templates?.find(t=>t.id===id);if(!t)return;const result=M.fromTemplate({...t,title:view.editor.title||t.title},todayISO(),uid);return transaction(next=>{next.groups=next.groups||[];next.groups.push(result.group);next.projects.push(...result.tasks);},'Project created from template','project_created',()=>{clearEdit();view.open.proj=true;groupFilter=result.group.id;});}
    if(action==='delete-template'){uiConfirm('Delete template?','Existing projects are not changed.','Delete',()=>transaction(next=>{next.templates=next.templates.filter(t=>t.id!==id);},'Template deleted','template_deleted'),true);return;}
    if(action==='add-check'){view.editor.checklist=view.editor.checklist||[];view.editor.checklist.push({id:uid(),text:'',done:false});storeDraft();render();return;}
    if(action==='remove-check'){view.editor.checklist.splice(+el.dataset.index,1);storeDraft();render();return;}
    if(action==='reminder'){const p=project(id);if(p)openEditor('reminder',{id,date:p.followUp||p.due||p.plan||todayISO(),time:'09:00'});return;}
    if(action==='export-reminder'){const e=view.editor,p=project(e.id);if(!p)return;try{const text=M.calendarReminder({id:p.id,title:p.task,date:e.date,time:e.time,note:'Life Map reminder. Check the task in your chosen Life Map copy.'});download(text,'life-map-reminder.ics','text/calendar;charset=utf-8');toast('Calendar file prepared. Import it to schedule the alert.');clearEdit();render();}catch(err){lastError=err.message;feedback();render();}return;}
    if(action==='connections')return openEditor('connections');if(action==='archived-groups')return openEditor('archived-groups');
    if(action==='copy-capture-address'){const text=location.origin+location.pathname+'#capture=';if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>toast('Capture address copied.'),()=>toast('Select and copy the address above.'));else toast('Select and copy the address above.');return;}
    if(action==='resume-edit'){if(recoveredEditor){view.editor=clone(recoveredEditor);editorBase=recoveredBase;recoveredEditor=null;restorePrompt=false;render();}return;}
    if(action==='retry'){const p=pendingAction;if(!p)return;if(JSON.stringify(S)!==JSON.stringify(p.before)){lastError='The board has changed. Export your unsaved work before retrying.';feedback();return;}pendingAction=null;return transaction(p.change,p.label,p.type,p.onSuccess,{retry:true,restore:p.restore});}
    if(action==='discard-failed'){uiConfirm('Discard unsaved change?','Only the failed change is discarded. Saved records and typed draft text remain.','Discard',()=>{pendingAction=null;lastError='';render();},true);return;}
  }
  function jumpProjects(){app.querySelector('[data-act="section"][data-key="proj"]')?.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
  const legacyActions=new Set(['qaAdd','advance','tick','plan','add','edit','editc','saveEditor','delEditor','closeEditor','export','import','reset']);
  app.addEventListener('click',ev=>{
    const el=ev.target.closest?.('[data-lm]');if(el){if(['field','field-check','check-text','check-item','capture-text','search-input','parse-capture','search-archive','context-filter'].includes(el.dataset.lm))return;ev.stopImmediatePropagation();if(busy&&el.dataset.lm!=='search')return;handle(el.dataset.lm,el);return;}
    const old=ev.target.closest?.('[data-act]');if(!old)return;
    if(old.dataset.act==='area'){groupFilter='';contextFilter='';view.q='';}
    if(!legacyActions.has(old.dataset.act))return;ev.stopImmediatePropagation();if(busy)return;
    const a=old.dataset.act,id=old.dataset.id;
    if(a==='qaAdd')quickAdd();else if(a==='advance')advance(id);else if(a==='tick')tick(id);else if(a==='plan')planToggle(id);
    else if(a==='add')old.dataset.kind==='chore'?openEditor('chore',{cad:'Weekly'}):newTask();
    else if(a==='edit'){const p=project(id);if(p)openEditor('proj',p);}else if(a==='editc'){const c=chore(id);if(c)openEditor('chore',c);}
    else if(a==='saveEditor')saveEditor();else if(a==='delEditor')delEditor();else if(a==='closeEditor')closeEditor();else if(a==='export')exportData();
    else if(a==='import')document.getElementById('importFile')?.click();
    else if(a==='reset')uiConfirm('Reset the board?','Export a backup first. This clears your saved board; it does not insert sample obligations.','Reset',()=>transaction(next=>{next.projects=[];next.chores=[];next.groups=[];next.checks={};next.planned={};next.log=[];next.choreHistory=[];},'Board reset','board_reset',clearEdit),true);
  },true);
  function fieldChange(el,redraw){
    const e=view.editor,key=el.dataset.field,value=el.value;
    if(key==='captureArea'){view.qa.area=value;view.qa.parentId='';}
    else if(key==='captureParent'){view.qa.parentId=value;if(value)view.qa.area=group(value)?.area||'';}
    else if(e){e[key]=value;if(key==='area'&&value)e.inbox=false;if(key==='parentId'&&value){e.area=group(value)?.area||e.area;e.inbox=false;}
      if(key==='plan'){e.planWeek='';if(value)e.inbox=false;}if(key==='showAfter'&&value){e.park='';e.someday=false;}if(key==='status'&&value!=='Waiting'){e.waitingFor='';e.followUp='';}}
    storeDraft();if(redraw)render();
  }
  app.addEventListener('input',ev=>{
    const el=ev.target;if(busy)return;const a=el.dataset?.lm;
    if(el.id==='qaTxt'){view.qa.txt=el.value;storeDraft();const hints=document.getElementById('lm-quick-hints');if(hints)hints.innerHTML=quickHints();return;}
    if(a==='capture-text'){ev.stopImmediatePropagation();view.qa.txt=el.value;storeDraft();const preview=document.getElementById('lm-capture-preview');if(preview)preview.innerHTML=capturePreview();return;}
    if(a==='field'){ev.stopImmediatePropagation();fieldChange(el,false);return;}
    if(a==='check-text'){ev.stopImmediatePropagation();const c=view.editor?.checklist?.[+el.dataset.index];if(c)c.text=el.value;storeDraft();return;}
    if(a==='search-input'){ev.stopImmediatePropagation();view.search=el.value;const start=el.selectionStart;render();const next=document.getElementById('lm-search');next?.focus({preventScroll:true});next?.setSelectionRange(start,start);}
  },true);
  app.addEventListener('change',ev=>{const el=ev.target,a=el.dataset?.lm;if(!a||busy)return;
    if(a==='field'){ev.stopImmediatePropagation();fieldChange(el,el.tagName==='SELECT');}
    else if(a==='field-check'){view.editor[el.dataset.field]=el.checked;storeDraft();}
    else if(a==='check-item'){const c=view.editor?.checklist?.[+el.dataset.index];if(c)c.done=el.checked;storeDraft();}
    else if(a==='parse-capture'){view.qa.parse=el.checked;storeDraft();render();}
    else if(a==='search-archive'){searchArchive=el.checked;render();}
    else if(a==='context-filter'){contextFilter=el.value;render();}
  },true);
  app.addEventListener('paste',ev=>{if(ev.target.id==='qaTxt'){const text=ev.clipboardData?.getData('text/plain')||'';if(text.includes('\n')){ev.preventDefault();view.qa.txt=text;captureSheet();}}});
  app.addEventListener('keydown',ev=>{if(ev.key==='Enter'&&ev.target.id==='qaTxt'){ev.preventDefault();ev.stopImmediatePropagation();quickAdd();}},true);
  document.addEventListener('change',ev=>{if(ev.target.id==='importFile'&&ev.target.files?.[0])importData(ev.target.files[0]);});
  document.addEventListener('keydown',ev=>{if(ev.ctrlKey||ev.metaKey||ev.altKey||ev.target?.matches?.('input,textarea,select,[contenteditable]'))return;if(ev.key==='n'&&!view.editor){ev.preventDefault();captureSheet();}if(ev.key==='/'&&!view.editor){ev.preventDefault();handle('search',{dataset:{}});}});
  function weeklyPanel(){
    const now=new Date(todayISO()+'T12:00:00'),offset=(now.getDay()+6)%7;now.setDate(now.getDate()-offset);const week=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
    const chosen=S.projects.filter(p=>!p.archived&&p.planWeek===week),open=chosen.filter(p=>p.status!=='Done'),minutes=open.reduce((n,p)=>n+(p.effortMinutes||0),0);
    const panel=document.createElement('section');panel.className='panel lm-weekly';panel.setAttribute('aria-label','Weekly shortlist');
    panel.innerHTML='<h2>This week</h2><p>'+chosen.filter(p=>p.status==='Done').length+' of '+chosen.length+' chosen tasks complete'+(minutes?' · '+minutes+' estimated minutes remaining':'')+'</p>'+info('About the weekly shortlist','Choose a small set of commitments for this Monday-to-Sunday week. Your backlog stays intact. Unfinished tasks remain in Projects when a new week starts; they are not automatically recommitted.')+open.map(p=>taskRow(p)).join('');
    const label=document.createElement('label');label.textContent='Choose a task for this week';const select=document.createElement('select');select.innerHTML='<option value="">Choose from your backlog…</option>'+S.projects.filter(p=>!p.archived&&p.status!=='Done'&&p.planWeek!==week).map(p=>'<option value="'+esc(p.id)+'">'+esc(p.task)+'</option>').join('');label.append(select);panel.append(label);
    const add=document.createElement('button');add.type='button';add.className='btn';add.textContent='Add to this week';add.onclick=()=>{if(!select.value)return;const id=select.value;transaction(next=>{const p=next.projects.find(p=>p.id===id);if(p)p.planWeek=week;},'Added to this week');};panel.append(add);
    if(open.length>5){const note=document.createElement('p');note.textContent='More than five commitments. Consider keeping only what realistically fits.';panel.append(note);}
    if(chosen.length){const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Adjust shortlist';details.append(summary);chosen.forEach(p=>{const b=document.createElement('button');b.type='button';b.className='btn';b.textContent='Remove: '+p.task;b.onclick=()=>transaction(next=>{const row=next.projects.find(x=>x.id===p.id);if(row?.planWeek===week)delete row.planWeek;},'Removed from this week');details.append(b);});panel.append(details);}
    return panel;
  }
  const baseRender=render;
  render=function(){
    loadDraft();const y=window.scrollY||0;baseRender();const todayPanel=app.querySelector('[data-lm="capture-today"]')?.closest('.panel');if(todayPanel)todayPanel.after(weeklyPanel());else app.querySelector('.appbar')?.after(weeklyPanel());
    const dialog=app.querySelector('dialog.lm-sheet-overlay');if(dialog){if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();dialog.addEventListener('cancel',ev=>{ev.preventDefault();closeEditor();});}
    const launch=document.createElement('button');launch.type='button';launch.id='lm-capture-launch';launch.className='btn lm-fab';launch.dataset.lm='capture';launch.setAttribute('aria-label','Capture a task');launch.textContent='+';launch.hidden=!!view.editor;app.appendChild(launch);
    const footer=document.createElement('div');footer.className='lm-tools';footer.innerHTML=button('Capture, saving & reminders','connections')+((S.groups||[]).some(g=>g.archived)?button('Archived projects','archived-groups'):'');app.appendChild(footer);
    const mono=[...app.querySelectorAll('.mono')].find(x=>x.textContent==='saved in this browser');if(mono)mono.textContent=window.AtlasConnected?'Private Life Map · saved across signed-in devices':'Browser-local Life Map · this browser only';
    try{localStorage.setItem(VIEW_KEY,JSON.stringify({open:view.open}));}catch{}
    feedback();if(window.scrollTo&&Math.abs((window.scrollY||0)-y)>2)window.scrollTo({top:y,behavior:'instant'});
  };
  // Exposed for the two existing storage adapters and deterministic tests, not a new store.
  window.LifeMapDashboard={setStatus};
  window.LifeMapWorkflow=Object.freeze({semanticEvents:true,transaction,storeDraft,closeEditor,openEditor,captureSheet,undoPatch,get busy(){return busy;},get hasDraft(){return !!view.qa.txt||!!recoveredEditor||!!view.editor;},snapshot:()=>({...clone(pendingAction?pendingCandidate():S),entryDraft:{version:2,qa:clone(view.qa),editor:clone(recoveredEditor),base:recoveredBase}}),discardDraft:()=>{clearEdit();view.qa={txt:'',area:'',when:'',parse:true,parentId:''};pendingAction=null;lastError='';storeDraft();},get pending(){return !!pendingAction;}});
  let lastDay=todayISO();setInterval(()=>{const day=todayISO();if(day!==lastDay&&!busy&&!view.editor){lastDay=day;render();}},60000);
  window.addEventListener('pagehide',storeDraft);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)storeDraft();else if(!busy)render();});
})();
