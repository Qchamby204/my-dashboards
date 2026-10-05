// Use Operations Cadence's own records. Opening Life Map never creates tasks.
export function createLifeMapOperations(catalog,storage,now=()=>Date.now()){
  const key='operationsCadence.v1',groups=['daily','weekly','monthly','quarterly','annually','adhoc'];
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const validDay=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  const dayOf=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const today=()=>dayOf(new Date(now())),utc=d=>new Date(d+'T12:00:00Z'),iso=d=>d.toISOString().slice(0,10);
  function period(group,day){const d=utc(day),y=d.getUTCFullYear(),m=d.getUTCMonth();if(group==='daily')return day;if(group==='weekly'){d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return 'W'+iso(d);}if(group==='monthly')return 'M'+y+'-'+m;if(group==='quarterly')return 'Q'+y+'-'+Math.floor(m/3);if(group==='annually')return 'Y'+y;return 'perm';}
  function calendarOccurrence(rule,day){
    if(!rule)return null;const d=utc(day),y=d.getUTCFullYear(),m=d.getUTCMonth(),clamp=(year,month,n)=>new Date(Date.UTC(year,month,Math.min(n,new Date(Date.UTC(year,month+1,0)).getUTCDate()),12));
    if(rule.kind==='weekday'){const wd=Number(rule.wd);if(!Number.isInteger(wd)||wd<0||wd>6)return null;d.setUTCDate(d.getUTCDate()-((d.getUTCDay()-wd+7)%7));return iso(d);}
    if(rule.kind==='monthday'){const n=Number(rule.day);if(!Number.isInteger(n)||n<1||n>31)return null;let c=clamp(y,m,n);if(c>d)c=clamp(y,m-1,n);return iso(c);}
    if(rule.kind==='yearly'){const n=Number(rule.day),month=Number(rule.month);if(!Number.isInteger(n)||n<1||n>31||!Number.isInteger(month)||month<0||month>11)return null;let c=clamp(y,month,n);if(c>d)c=clamp(y-1,month,n);return iso(c);}
    if(rule.kind==='everyn'){const n=Number(rule.n),a=validDay(rule.anchor)?utc(rule.anchor):d;if(!Number.isInteger(n)||n<1||n>36500||a>d)return null;a.setUTCDate(a.getUTCDate()+Math.floor((d-a)/86400000/n)*n);return iso(a);}
    return null;
  }
  function occurrence(rule,day){const value=calendarOccurrence(rule,day);return value&&(!rule.start||validDay(rule.start)&&value>=rule.start)?value:null;}
  function read(){
    if(!storage)throw Error('Ops Cadence storage is unavailable in this browser.');
    let raw;try{raw=storage.getItem(key);}catch{throw Error('Ops Cadence could not be read. Your records are unchanged.');}
    if(raw===null)return {raw,state:{}};
    let state;try{if(raw.length>5000000)throw Error();state=JSON.parse(raw);if(!object(state)||state.custom!==undefined&&!object(state.custom)||state.sched!==undefined&&!object(state.sched)||state.overrides!==undefined&&!object(state.overrides)||state.recur!==undefined&&!object(state.recur)||state.log!==undefined&&!Array.isArray(state.log)||state.events!==undefined&&!Array.isArray(state.events))throw Error();}catch{throw Error('Ops Cadence records could not be read. Open Ops Cadence to recover them; nothing has been replaced.');}
    return {raw,state};
  }
  function rowsFrom(state,day){
    if(!validDay(day))throw Error('Choose a valid day.');const out=[],events=state.events||[],current=today();
    const add=(group,index,title,system='',season='',log=null)=>{
      if(typeof title!=='string'||!title.trim())return;
      const sourceKey=group==='log'?'log:'+index:group+':'+index,id='ops:'+sourceKey,raw=state[sourceKey]||{},rule=state.recur?.[sourceKey],occ=occurrence(rule,day),stamp=period(group,day);
      const recordDone=log?!!log.done:rule?!!occ&&!!raw.lastDone&&raw.lastDone>=occ:!!raw.done&&(raw.p===stamp||raw.p===undefined&&stamp===period(group,current));
      const completed=events.some(e=>e.planDate===day&&(log?e.kind==='log'&&e.logId===index:e.kind==='cadence'&&e.key===sourceKey));
      const planned=validDay(state.sched?.[sourceKey])?state.sched[sourceKey]:'';
      const schedule=rule?.kind==='weekday'?'Every '+['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][Number(rule.wd)]:rule?.kind==='monthday'?'Day '+rule.day+' each month':rule?.kind==='yearly'?['January','February','March','April','May','June','July','August','September','October','November','December'][Number(rule.month)]+' '+rule.day+' each year':rule?.kind==='everyn'?'Every '+rule.n+' days':'';
      out.push({id,sourceKey,group:log?'adhoc':group,index,title,task:title.slice(0,300),system,season,schedule,notes:typeof raw.note==='string'?raw.note:'',due:log&&validDay(log.due)?log.due:'',plan:planned,selected:planned===day||completed,status:recordDone||completed?'Done':'Not started',ops:true,occurrence:occ,canComplete:day<=current&&(log?true:rule?!!occ&&occ===occurrence(rule,current):stamp===period(group,current))});
    };
    for(const section of catalog){section.tasks.forEach((task,i)=>add(section.id,String(i),state.overrides?.[section.id+':'+i]||task.t,task.sys||'',task.due||''));const custom=state.custom?.[section.id]||[];if(!Array.isArray(custom)||custom.length>1000)throw Error('The custom Ops task list is invalid.');for(const task of custom){if(!object(task)||typeof task.cid!=='string'||!/^c[a-zA-Z0-9_-]{1,100}$/.test(task.cid))throw Error('A custom Ops task has an invalid ID.');add(section.id,task.cid,state.overrides?.[section.id+':'+task.cid]||task.t,task.sys||'');}}
    for(const task of state.log||[]){if(!object(task)||typeof task.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(task.id))throw Error('An ad hoc Ops task has an invalid ID.');add('log',task.id,task.text,task.category||'', '',task);}
    if(new Set(out.map(r=>r.id)).size!==out.length)throw Error('Ops Cadence contains duplicate task IDs. Open Ops to recover the list.');return out;
  }
  const rows=day=>rowsFrom(read().state,day),find=(id,day=today())=>rows(day).find(r=>r.id===id),planned=day=>rows(day).filter(r=>r.selected);
  function write(fn){const before=read();fn(before.state);const after=JSON.stringify(before.state);try{if(storage.getItem(key)!==before.raw)throw Error('changed');storage.setItem(key,after);}catch(e){throw Error(e.message==='changed'?'Ops Cadence changed in another tab. Try again.':'Ops Cadence could not be saved. Your saved records are unchanged.');}return {before:before.raw,after};}
  function scheduleMany(ids,day){if(!validDay(day))throw Error('Choose a valid day.');if(!Array.isArray(ids)||!ids.length||ids.length>500||new Set(ids).size!==ids.length)throw Error('Select 1–500 Ops tasks.');return write(state=>{const all=rowsFrom(state,day),chosen=ids.map(id=>{const r=all.find(r=>r.id===id);if(!r)throw Error('An Ops task is no longer available. Refresh your choices.');if(r.status==='Done')throw Error('An Ops task is already completed for this period. Choose its next period.');return r;});state.sched??={};for(const r of chosen)state.sched[r.sourceKey]=day;});}
  const schedule=(id,day)=>scheduleMany([id],day);
  function remove(id,day){return write(state=>{const r=rowsFrom(state,day).find(r=>r.id===id);if(r?.plan===day)delete state.sched[r.sourceKey];});}
  function complete(id,day){return write(state=>{
    const r=rowsFrom(state,day).find(r=>r.id===id);if(!r)throw Error('This Ops task is no longer available.');if(r.status==='Done')throw Error('This Ops task is already completed.');if(!r.canComplete)throw Error('Move this task to today before completing it.');
    const ts=now(),event={id:'e'+ts.toString(36)+Math.random().toString(36).slice(2,7),ts,label:r.title,planDate:day,source:'life-map'};
    if(r.sourceKey.startsWith('log:')){const t=state.log.find(t=>t.id===r.index);t.done=true;t.doneAt=ts;Object.assign(event,{kind:'log',category:t.category||null,logId:t.id});}
    else{state[r.sourceKey]={...state[r.sourceKey],done:true,p:period(r.group,today()),lastDone:today()};Object.assign(event,{kind:'cadence',cadence:r.group,key:r.sourceKey});}
    state.events??=[];state.events.push(event);if(state.sched?.[r.sourceKey]===day)delete state.sched[r.sourceKey];
  });}
  function undo(ticket){try{if(storage.getItem(key)!==ticket.after)throw Error('changed');if(ticket.before===null)storage.removeItem(key);else storage.setItem(key,ticket.before);}catch(e){throw Error(e.message==='changed'?'Ops Cadence changed after this action. Open Ops to adjust it without overwriting newer work.':'The Ops change could not be undone.');}}
  return Object.freeze({key,groups,period,occurrence,rows,find,planned,schedule,scheduleMany,remove,complete,undo});
}
