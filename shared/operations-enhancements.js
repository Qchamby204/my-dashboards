/* Simpler Today and reliable scheduling for the original Operations Cadence. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='operations-cadence')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('operations-enhancements.css',source).href;document.head.appendChild(css);
  function ready(){
    if(window.OperationsImprovements||typeof state==='undefined')return;
    const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o),own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
    const day=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
    const dayNumber=s=>{const [y,m,d]=s.split('-').map(Number);return Date.UTC(y,m-1,d)/86400000;};
    const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
    function validRule(rule){
      if(!plain(rule)||rule.start!==undefined&&!day(rule.start))return false;
      if(rule.kind==='weekday')return integer(rule.wd,0,6);
      if(rule.kind==='monthday')return integer(rule.day,1,31);
      if(rule.kind==='yearly')return integer(rule.month,0,11)&&integer(rule.day,1,31);
      return rule.kind==='everyn'&&integer(rule.n,1,36500)&&day(rule.anchor);
    }
    function validateState(value){
      if(!plain(value))throw Error('Choose a valid Operations Cadence backup.');
      const checkKeys=o=>{if(o&&typeof o==='object')for(const [k,v]of Object.entries(o)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Invalid record key.');checkKeys(v);}};checkKeys(value);
      for(const k of ['custom','sched','recur','overrides'])if(value[k]!==undefined&&!plain(value[k]))throw Error('Invalid '+k+' records.');
      for(const rows of Object.values(value.custom||{})){
        if(!Array.isArray(rows)||rows.some(x=>!plain(x)||typeof x.cid!=='string'||!/^c[\w-]+$/.test(x.cid)||typeof x.t!=='string'||x.sys!==undefined&&typeof x.sys!=='string'))throw Error('Invalid custom checklist.');
        if(new Set(rows.map(x=>x.cid)).size!==rows.length)throw Error('Duplicate task IDs.');
      }
      for(const d of Object.values(value.sched||{}))if(d!==''&&!day(d))throw Error('Invalid scheduled date.');
      for(const r of Object.values(value.recur||{}))if(!validRule(r))throw Error('Invalid repeat schedule.');
      for(const v of Object.values(value.overrides||{}))if(typeof v!=='string')throw Error('Invalid task title.');
      for(const [k,v]of Object.entries(value))if(k.includes(':')){
        if(!plain(v)||v.done!==undefined&&typeof v.done!=='boolean'||v.note!==undefined&&typeof v.note!=='string'||v.p!==undefined&&typeof v.p!=='string'||v.lastDone!==undefined&&!day(v.lastDone))throw Error('Invalid task progress.');
      }
      for(const k of ['log','events'])if(value[k]!==undefined&&!Array.isArray(value[k]))throw Error('Invalid '+k+'.');
      for(const t of value.log||[])if(!plain(t)||typeof t.id!=='string'||typeof t.text!=='string'||typeof t.done!=='boolean'||t.due&&!day(t.due)||t.category!=null&&typeof t.category!=='string'||!Number.isFinite(t.created))throw Error('Invalid captured task.');
      if(new Set((value.log||[]).map(t=>t.id)).size!==(value.log||[]).length)throw Error('Duplicate captured task IDs.');
      for(const e of value.events||[]){
        if(!plain(e)||typeof e.id!=='string'||!Number.isFinite(e.ts)||!['cadence','log'].includes(e.kind)||typeof e.label!=='string'||e.category!=null&&typeof e.category!=='string')throw Error('Invalid completion history.');
        if(e.kind==='cadence'&&(!DATA.some(s=>s.id===e.cadence)||typeof e.key!=='string'||!e.key.startsWith(e.cadence+':')))throw Error('Invalid checklist history.');
      }
      return JSON.parse(JSON.stringify(value));
    }
    const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const button=(text,fn)=>{const n=make('button',text,'operations-button');n.type='button';n.addEventListener('click',fn);return n;};
    const boot=window.AtlasOperationsBoot;let blocked=!!boot?.readError,rawRecovery=null,unsaved=false;
    const notice=make('div',null,'operations-notice');notice.id='operations-save-notice';notice.setAttribute('role','status');document.querySelector('.layout').before(notice);
    function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=make('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function backup(){try{download(blocked&&rawRecovery!==null?rawRecovery:JSON.stringify({app:'operations-cadence',version:1,state}),'operations-cadence-'+isoDay()+'.json');toast('Backup download started.');}catch{toast('Download failed. Please retry.');}}
    function paintNotice(){
      notice.hidden=!blocked&&!unsaved;notice.replaceChildren();document.querySelector('main').inert=blocked;rail.inert=blocked;
      if(notice.hidden)return;
      notice.appendChild(make('p',blocked?'Saved progress could not be loaded. Editing is paused to protect it. Retry loading or restore a valid backup.':'Changes have not saved on this device. Retry saving or download a backup before closing.'));
      notice.appendChild(button(blocked?'Retry loading':'Retry saving',()=>{
        if(!blocked){save();return;}
        try{const raw=localStorage.getItem(STORE_KEY);state=validateState(raw?JSON.parse(raw):{});blocked=false;rawRecovery=null;migratePeriods();paintNotice();render();}catch{toast('Saved progress still cannot be loaded.');}
      }));
      if(!blocked||rawRecovery!==null)notice.appendChild(button(blocked?'Download saved data':'Download backup',backup));
    }
    save=function(){if(blocked){paintNotice();return false;}try{const raw=JSON.stringify(state);localStorage.setItem(STORE_KEY,raw);if(localStorage.getItem(STORE_KEY)!==raw)throw Error('Not saved');unsaved=false;}catch{unsaved=true;}paintNotice();return !unsaved;};
    const file=make('input');file.type='file';file.accept='.json,application/json';file.hidden=true;
    const toolsBar=make('div',null,'operations-backup-tools');toolsBar.append(button('Backup',()=>{if(blocked&&rawRecovery===null){toast('Load progress before backing it up.');return;}backup();}),button('Restore',()=>file.click()),file);document.querySelector('.appbar').appendChild(toolsBar);
    let importToken=0;
    async function restore(input){
      const f=input.files?.[0];input.value='';if(!f)return;const token=++importToken;
      try{
        if(f.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const pack=JSON.parse(await f.text());
        if(pack?.app!=='operations-cadence'||pack.version!==1)throw Error('Choose an Operations Cadence version 1 backup.');const next=validateState(pack.state);if(token!==importToken)return;
        uiConfirm('Restore this backup?','This replaces the checkmarks, notes, schedules, captured tasks and history on this device. Use Backup first to keep a copy of current progress.','Restore',()=>{if(token!==importToken)return;importToken++;state=next;blocked=false;rawRecovery=null;migratePeriods();save();render();toast(unsaved?'Backup loaded. Saving needs a retry.':'Backup restored.');},true);
      }catch(e){toast(e instanceof SyntaxError?'This file is not valid JSON.':e.message||'Could not read this backup.');}
    }
    file.addEventListener('change',()=>restore(file));
    try{const raw=boot?boot.raw:localStorage.getItem(STORE_KEY);if(raw!==null)validateState(JSON.parse(raw));state=validateState(state);}catch{blocked=true;rawRecovery=boot?.raw??null;try{if(rawRecovery!==null)localStorage.setItem(STORE_KEY,rawRecovery);}catch{/* Keep recovery bytes in memory. */}state={};}
    // Calendar-day arithmetic keeps every-N-day schedules stable across clock changes.
    const legacyOccurrence=lastOccurrence,legacyGet=get,legacySet=set;
    lastOccurrence=function(rule,from){
      if(!validRule(rule))return null;const today=isoDay(from?new Date(from):new Date());let result;
      if(rule.kind==='everyn'){
        const elapsed=dayNumber(today)-dayNumber(rule.anchor);if(elapsed<0)return null;
        const date=parseDate(rule.anchor);date.setDate(date.getDate()+Math.floor(elapsed/rule.n)*rule.n);result=isoDay(date);
      }else result=legacyOccurrence(rule,from);
      return result&&(!rule.start||result>=rule.start)?result:null;
    };
    nextOccurrence=function(rule){
      if(!validRule(rule))return null;const today=isoDay(),floor=rule.start&&rule.start>today?rule.start:today;
      if(rule.kind==='everyn'){
        const elapsed=dayNumber(today)-dayNumber(rule.anchor),steps=Math.max(0,Math.floor(elapsed/rule.n)+1);const d=parseDate(rule.anchor);d.setDate(d.getDate()+steps*rule.n);
        if(rule.start&&isoDay(d)<rule.start)d.setDate(d.getDate()+Math.ceil((dayNumber(rule.start)-dayNumber(isoDay(d)))/rule.n)*rule.n);return isoDay(d);
      }
      // At most one leap-year cycle is needed for the supported calendar rules.
      const start=parseDate(floor);if(floor===today)start.setDate(start.getDate()+1);
      for(let offset=0;offset<=366;offset++){const d=new Date(start);d.setDate(d.getDate()+offset);const iso=isoDay(d);if(lastOccurrence(rule,d)===iso)return iso;}return null;
    };
    get=function(sid,i){
      const raw=state[keyFor(sid,i)]||{},rule=recurFor(sid,i),pin=schedFor(sid,i);
      if(day(pin))return {done:!!raw.done&&!!raw.lastDone&&raw.lastDone>=pin,note:raw.note||''};
      if(rule){const occ=lastOccurrence(rule);return {done:!!raw.done&&!!occ&&!!raw.lastDone&&raw.lastDone>=occ,note:raw.note||''};}
      return legacyGet(sid,i);
    };
    set=function(sid,i,obj){
      if(blocked)return;const pin=schedFor(sid,i);legacySet(sid,i,obj);
      if(obj?.done===true&&pin){delete getSched()[keyFor(sid,i)];save();}
    };
    setSched=function(sid,i,iso){if(iso&&!day(iso)){toast('Choose a valid date.');return false;}const k=keyFor(sid,i);if(iso){if(iso!==schedFor(sid,i)&&state[k])state[k].done=false;getSched()[k]=iso;}else delete getSched()[k];save();return true;};
    setRecur=function(sid,i,rule){if(rule&&!validRule(rule)){toast('Choose a valid repeat schedule.');return false;}if(rule)getRecur()[keyFor(sid,i)]=rule;else delete getRecur()[keyFor(sid,i)];save();return true;};
    scheduleSheet=function(sid,i,label){
      const old=recurFor(sid,i),pin=schedFor(sid,i),kind=pin?'once':old?.kind||'none';
      uiShell('<h3>Schedule this task</h3><p>'+escapeHtml(label)+'</p><label class="operations-field">When<select id="op-kind">'+[['none','Routine checklist only'],['once','Once, on a date'],['weekday','Every week'],['monthday','Every month'],['yearly','Every year'],['everyn','Every N days']].map(([v,t])=>'<option value="'+v+'"'+(kind===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label><label class="operations-field" id="op-date-wrap">Date<input type="date" id="op-date" value="'+(pin||isoDay())+'"></label><label class="operations-field" id="op-week-wrap">Weekday<select id="op-week">'+WEEKDAYS.map((v,n)=>'<option value="'+n+'"'+((old?.wd??new Date().getDay())===n?' selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="operations-field" id="op-month-wrap">Month<select id="op-month">'+MONTHS.map((v,n)=>'<option value="'+n+'"'+((old?.month??new Date().getMonth())===n?' selected':'')+'>'+v+'</option>').join('')+'</select></label><label class="operations-field" id="op-day-wrap">Day of month<input type="number" min="1" max="31" id="op-day" value="'+(old?.day||new Date().getDate())+'"></label><label class="operations-field" id="op-n-wrap">Repeat every (days)<input type="number" min="1" max="36500" id="op-n" value="'+(old?.n||7)+'"></label><label class="operations-field" id="op-start-wrap">Starting on<input type="date" id="op-start" value="'+(old?.anchor||old?.start||isoDay())+'"></label><p id="op-preview" role="status"></p><div class="operations-actions"><button id="op-cancel" class="operations-button">Cancel</button><button id="op-save" class="operations-button">Save schedule</button></div>');
      const by=id=>document.getElementById(id),kindInput=by('op-kind');
      function read(){
        const k=kindInput.value,start=by('op-start').value;if(k==='none'||k==='once')return null;
        const rule=k==='weekday'?{kind:k,wd:Number(by('op-week').value)}:k==='monthday'?{kind:k,day:Number(by('op-day').value)}:k==='yearly'?{kind:k,month:Number(by('op-month').value),day:Number(by('op-day').value)}:{kind:k,n:Number(by('op-n').value),anchor:start};
        rule.start=start;if(!validRule(rule))throw Error('Choose valid dates and whole numbers for this schedule.');return rule;
      }
      function sync(){
        const k=kindInput.value;for(const [id,show]of [['date',k==='once'],['week',k==='weekday'],['month',k==='yearly'],['day',['monthday','yearly'].includes(k)],['n',k==='everyn'],['start',!['once','none'].includes(k)]])by('op-'+id+'-wrap').hidden=!show;
        try{const rule=read();by('op-preview').textContent=k==='none'?'Stays in its routine checklist. It will not appear as overdue.':k==='once'?'Appears in Today on the chosen date.':lastOccurrence(rule)===isoDay()?'Due today, then '+recurLabel(rule).toLowerCase()+'.':'Next: '+fmtDate(parseDate(nextOccurrence(rule)))+'. Dates before the starting date are excluded.';}catch(e){by('op-preview').textContent=e.message;}
      }
      for(const id of ['kind','date','week','month','day','n','start'])by('op-'+id).addEventListener('input',sync);kindInput.addEventListener('change',sync);sync();
      by('op-cancel').onclick=uiClose;by('op-save').onclick=()=>{try{const rule=read(),date=kindInput.value==='once'?by('op-date').value:'';if(kindInput.value==='once'&&!day(date))throw Error('Choose a valid date.');setSched(sid,i,date);setRecur(sid,i,rule);uiClose();render();toast(unsaved?'Schedule updated. Saving needs a retry.':'Schedule updated.');}catch(e){by('op-preview').textContent=e.message;}};
    };
    function dueRows(){
      const rows=[],today=isoDay();
      DATA.forEach(sec=>tasksFor(sec.id).forEach(({task,i,custom})=>{
        const pin=schedFor(sec.id,i),rs=recurStatus(sec.id,i),raw=state[keyFor(sec.id,i)]||{};
        const dates=[day(pin)&&pin<=today&&(!raw.done||!raw.lastDone||raw.lastDone<pin)?{date:pin,source:'Date you set',pin:true}:null,rs?.due?{date:rs.occ,source:recurLabel(rs.rule),repeat:true}:null].filter(Boolean).sort((a,b)=>a.date.localeCompare(b.date));
        if(dates.length)rows.push({sid:sec.id,i,task,custom,label:labelFor(sec.id,i,task),date:dates[0].date,source:dates[0].source,type:'cadence'});
      }));
      getLog().filter(t=>!t.done&&day(t.due)&&t.due<=today).forEach(t=>rows.push({type:'log',item:t,label:t.text,date:t.due,source:'Date you set in Captured tasks'}));
      return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.label.localeCompare(b.label));
    }
    todayCounts=()=>({left:dueRows().length,total:dueRows().length,done:0});
    function completeRow(row){
      if(row.type==='log'){toggleLog(row.item.id);return;}const k=keyFor(row.sid,row.i),before={...state[k]},pin=schedFor(row.sid,row.i);
      if(pin&&pin>isoDay())legacySet(row.sid,row.i,{done:true});else set(row.sid,row.i,{done:true});addEvent({kind:'cadence',cadence:row.sid,key:k,label:row.label});const event=getEvents().at(-1),after={...state[k]};render();
      toast(unsaved?'Checked off. Saving needs a retry.':'Checked off here.','Undo',()=>{
        const current=state[k];if(!current||current.done!==after.done||current.lastDone!==after.lastDone||current.p!==after.p)return;
        for(const field of ['done','lastDone','p'])if(before[field]===undefined)delete current[field];else current[field]=before[field];
        if(pin&&!schedFor(row.sid,row.i))getSched()[k]=pin;state.events=getEvents().filter(e=>e.id!==event.id);save();render();
      });
    }
    function taskRow(row){
      const li=make('li',null,'task operations-due-row'),check=button('Done',()=>completeRow(row));check.setAttribute('aria-label','Mark '+row.label+' complete');
      const text=make('div');text.append(make('p',row.label,'task-text'),make('p',(row.date<isoDay()?'Overdue · ':'Due · ')+fmtDate(parseDate(row.date))+' · '+row.source,'operations-source'));li.append(check,text);
      if(row.type==='cadence')li.appendChild(button('Schedule',()=>scheduleSheet(row.sid,row.i,row.label)));return li;
    }
    const navigate=id=>{active=id;searchQ='';render();};
    renderToday=function(){
      const body=document.getElementById('todayBody');body.replaceChildren();const rows=dueRows();
      document.getElementById('tEyebrow').textContent=new Date().toLocaleDateString('en-CA',{weekday:'long',month:'long',day:'numeric'});document.getElementById('tBig').textContent=String(rows.length);
      const search=document.getElementById('todaySearch');if(search&&document.activeElement!==search)search.value=searchQ;
      if(searchQ.trim().length>=2){renderSearch(body);return;}
      const scheduled=make('section',null,'operations-group');scheduled.append(make('h3','Scheduled work'),make('p','Only tasks with a date or repeat schedule you set.','operations-source'));
      if(rows.length){const list=make('ul',null,'tasks');rows.forEach(row=>list.appendChild(taskRow(row)));scheduled.appendChild(list);}else scheduled.appendChild(make('p','No scheduled tasks are due. Open a routine checklist when you need it.','operations-empty'));body.appendChild(scheduled);
      const undated=getLog().filter(t=>!t.done&&!t.due).sort((a,b)=>b.created-a.created),capture=make('section',null,'operations-group');
      capture.append(make('h3','Captured tasks'+(undated.length?' · '+undated.length:'')),make('p','Your undated captures stay here until you complete them or choose a date.','operations-source'));
      if(undated.length){const list=make('ul',null,'tasks');undated.slice(0,5).forEach(t=>{const li=make('li',null,'task operations-due-row');li.append(button('Done',()=>toggleLog(t.id)),make('p',t.text,'task-text'),button('Set date',()=>editDue(t.id)));list.appendChild(li);});capture.appendChild(list);}else capture.appendChild(make('p','Use the capture field above to add a one-off task.','operations-empty'));
      capture.appendChild(button('View all captured tasks',()=>navigate('log')));body.appendChild(capture);
      const routines=make('section',null,'operations-group');routines.append(make('h3','Routine checklists'),make('p','Built-in reference lists plus tasks you add. Unscheduled routines are not overdue.','operations-source'));
      const links=make('div',null,'operations-routines');DATA.forEach(sec=>{const stats=sectionStats(sec);links.appendChild(button(sec.label+' · '+stats.done+'/'+stats.total,()=>navigate(sec.id)));});routines.appendChild(links);body.appendChild(routines);
    };
    function editDue(id){const t=getLog().find(x=>x.id===id);if(!t)return;uiAsk('Task date',[{k:'d',label:'Due date (blank keeps it undated)',type:'date',value:t.due||''}],v=>{if(v.d&&!day(v.d)){uiErr('Choose a valid date.');return false;}t.due=v.d||'';save();render();},'Save date');}
    const originalLogRow=logRow;
    logRow=function(t){const row=originalLogRow(t);row.dataset.operationsLog=t.id;row.appendChild(button(t.due?'Change date':'Set date',()=>editDue(t.id)));return row;};
    toggleLog=function(id){
      const t=getLog().find(x=>x.id===id);if(!t||blocked)return;t.done=!t.done;t.doneAt=t.done?Date.now():0;delete t.completed;
      if(t.done)addEvent({kind:'log',category:t.category||null,label:t.text,logId:t.id});else removeLastEvent(e=>e.kind==='log'&&(e.logId===t.id||e.key==='log:'+t.id));save();render();
    };
    deleteLog=function(id){const item=getLog().find(t=>t.id===id);if(!item)return;state.log=getLog().filter(t=>t.id!==id);save();render();toast('Captured task deleted.','Undo',()=>{if(!getLog().some(t=>t.id===id)){getLog().push(item);save();render();}});};
    const originalCustomDelete=deleteCustomTask,originalCustomRestore=restoreCustomTask;
    deleteCustomTask=function(sid,cid){const name=getOverrides()[keyFor(sid,cid)],bundle=originalCustomDelete(sid,cid);if(bundle){bundle.override=name;delete getOverrides()[keyFor(sid,cid)];save();}return bundle;};
    restoreCustomTask=function(sid,bundle){if(!bundle||customFor(sid).some(t=>t.cid===bundle.snap.cid))return;originalCustomRestore(sid,bundle);if(bundle.override)getOverrides()[keyFor(sid,bundle.snap.cid)]=bundle.override;save();};
    const originalSearch=searchAll;
    searchAll=function(query){
      const hits=originalSearch(query),normalized=query.trim().toLowerCase();let index=0;
      DATA.forEach(sec=>tasksFor(sec.id).forEach(({task,i})=>{const label=labelFor(sec.id,i,task),st=get(sec.id,i);if((label+' '+(st.note||'')+' '+(task.sys||'')).toLowerCase().includes(normalized)&&normalized.length>=2){const h=hits[index++];h.go=()=>{navigate(sec.id);focusRow('operationsKey',keyFor(sec.id,i));};}}));
      getLog().forEach(t=>{if(((t.text||'')+' '+(t.category||'')).toLowerCase().includes(normalized)&&normalized.length>=2){const h=hits[index++];h.go=()=>{navigate('log');focusRow('operationsLog',t.id);};}});return hits;
    };
    function focusRow(key,value){const row=[...document.querySelectorAll('[data-operations-key],[data-operations-log]')].find(n=>n.dataset[key]===value);if(row){row.tabIndex=-1;row.focus({preventScroll:true});row.scrollIntoView({block:'center',behavior:'instant'});}}
    renderSearch=function(body){const hits=searchAll(searchQ);body.appendChild(make('p',hits.length+' matches','operations-source'));hits.slice(0,40).forEach(h=>{const b=button(h.where+' · '+h.label,h.go);b.classList.add('operations-search-hit');body.appendChild(b);});if(hits.length>40)body.appendChild(make('p','Showing the first 40 matches. Add more words to narrow your search.','operations-source'));};
    updateOverall=function(){const n=dueRows().length;document.getElementById('ovNums').textContent=String(n);document.getElementById('barPill').textContent=n+' due';document.getElementById('ovBar').style.width='0%';};
    const originalRender=render;
    render=function(){
      // Legacy section markup embeds notes inside a textarea and system labels in chips.
      const actualGet=get,actualTasks=tasksFor;
      get=(sid,i)=>{const st=actualGet(sid,i);return {...st,note:escapeHtml(st.note)};};
      tasksFor=sid=>actualTasks(sid).map(x=>({...x,task:{...x.task,sys:escapeHtml(x.task.sys||''),due:x.task.due?escapeHtml(x.task.due):x.task.due}}));
      try{if(active==='today'||active==='log'||active==='insights'){get=actualGet;tasksFor=actualTasks;}originalRender();}finally{get=actualGet;tasksFor=actualTasks;}
      const items=DATA.find(s=>s.id===active)?tasksFor(active):[];[...taskList.children].forEach((li,n)=>{if(items[n])li.dataset.operationsKey=keyFor(active,items[n].i);});
      for(const row of document.querySelectorAll('.task,.log-item')){const title=row.querySelector('.task-text,.log-text')?.textContent||'task';row.querySelectorAll('.check').forEach(n=>n.setAttribute('aria-label',(n.getAttribute('aria-checked')==='true'?'Mark incomplete: ':'Mark complete: ')+title));row.querySelectorAll('textarea').forEach(n=>n.setAttribute('aria-label','Notes for '+title));}paintNotice();
    };
    document.querySelector('header .sub').textContent='A checklist for work you complete in your other systems. Salesforce, SharePoint and email records are not connected here.';
    document.querySelector('.overall-label').textContent='Scheduled items due';document.querySelector('.overall-bar').hidden=true;
    document.querySelector('#todayView .panel-prog .lbl').textContent='Due now';document.getElementById('capText').placeholder='Add a one-off task';document.getElementById('capAdd').textContent='Add task';
    document.querySelector('#logView h2').textContent='Captured tasks';document.querySelector('#logView .log-sub').textContent='Tasks you add here, with an optional due date. Change a date, check a task off, or keep it undated.';
    const sourceNote=make('p','Checkmarks record completion here. Routine checkmarks reset with their cadence; dated repeats follow their own schedule.','operations-source operations-explainer');document.getElementById('taskList').before(sourceNote);
    document.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key)&&e.target.closest('select,button,input,textarea,dialog,#uiDlg'))e.stopImmediatePropagation();},true);
    let currentDay=isoDay(),dayTimer=null;
    const editing=()=>document.activeElement?.closest('input,textarea,select,[contenteditable="true"]')||document.getElementById('uiDlg');
    function refreshDay(){if(isoDay()!==currentDay&&!editing()){currentDay=isoDay();render();}}
    function watchDay(){clearTimeout(dayTimer);if(document.hidden)return;refreshDay();const next=new Date();next.setHours(24,0,0,50);dayTimer=setTimeout(watchDay,Math.max(1000,next-Date.now()));}
    document.addEventListener('visibilitychange',watchDay);document.addEventListener('focusout',()=>setTimeout(refreshDay,0));window.addEventListener('pageshow',watchDay);window.addEventListener('pagehide',()=>clearTimeout(dayTimer));
    window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
    window.OperationsImprovements=Object.freeze({dueRows,completeRow,validRule,validateState,restore,backup,refreshDay,get blocked(){return blocked;},get unsaved(){return unsaved;}});
    if(!rail.querySelector('.rail-btn[data-id="today"]')){populateCategories();buildRail();}
    render();watchDay();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
