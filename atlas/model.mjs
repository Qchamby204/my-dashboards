export const LEGACY_ORIGIN = 'https://qchamby204.github.io/my-dashboards/';
export const APPS = [
  { id:'life-map', name:'Life Map', detail:'Projects and life administration', group:'Direction', icon:'◈', file:'life-map.html' },
  { id:'the-hourglass', name:'The Hourglass', detail:'Time, perspective, and intention', group:'Direction', icon:'◷', file:'the-hourglass.html' },
  { id:'life-ledger', name:'Life Ledger', detail:'Habits and daily reflection', group:'Daily life', icon:'▤', file:'life-ledger.html' },
  { id:'workout-forge', name:'The Forge', detail:'Training and session history', group:'Daily life', icon:'⌁', file:'workout-forge.html' },
  { id:'the-chef', name:'The Chef', detail:'Recipes, weekly meals, and grocery lists', group:'Daily life', icon:'♨', file:'the-chef.html' },
  { id:'baby-brain', name:'Baby Brain', detail:'Parenting knowledge and preparation', group:'Daily life', icon:'✳', file:'baby-brain.html' },
  { id:'the-aqueduct', name:'The Aqueduct', detail:'Book, cash flow, goals, and wealth', group:'Money', icon:'≋', file:'the-aqueduct.html' },
  { id:'prospecting-command-center', name:'Prospecting Command Center', detail:'Relationships and follow-through', group:'The practice', icon:'◎', file:'prospecting-command-center.html' },
  { id:'operations-cadence', name:'Operations Cadence', detail:'Recurring practice commitments', group:'The practice', icon:'↻', file:'operations-cadence.html' },
  { id:'the-herald', name:'The Herald', detail:'Content and publishing', group:'The practice', icon:'⚑', file:'the-herald.html' },
  { id:'communication-trainer', name:'Master Communicator', detail:'Speaking, rehearsal, and practice', group:'Learning', icon:'◇', file:'communication-trainer.html' },
  { id:'courier', name:'The Courier', detail:'Your briefing and daily lessons', group:'Learning', icon:'▱', file:'courier.html' },
  { id:'crucible', name:'The Crucible', detail:'Analyst training and statement mastery', group:'Learning', icon:'◈', file:'crucible.html' },
  { id:'neural-map', name:'Neural Map', detail:'Your tools and reference library', group:'Learning', icon:'⌘', file:'neural-map.html' },
  { id:'chambers-wealth-hq', name:'Chambers Wealth HQ', detail:'Legacy workspace; current planning lives in The Aqueduct', group:'Archive', icon:'▥', file:'chambers-wealth-hq.html' },
];
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function newId(){
  if(typeof crypto.randomUUID==='function')return crypto.randomUUID();
  // getRandomValues is also available in the supervised HTTP preview.
  const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(v=>v.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day, count) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+count);
  return date.toISOString().slice(0,10);
}
export function monday(day) {
  const date = new Date(day + 'T12:00:00Z');
  return addDays(day, -(date.getUTCDay()+6)%7);
}
export function textValue(value, max, required=false) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Use text of at most ${max} characters.`);
  const clean=value.trim(); if(required && !clean) throw new Error('Add a title first.'); return clean;
}
export function dateValue(value) {
  if(value===null || value==='') return null;
  if(!validDate(value)) throw new Error('Choose a valid date.');
  return value;
}
export function appValue(value) {
  if(!APPS.some(a=>a.id===value)) throw new Error('Choose an Atlas app.'); return value;
}
export function minutesValue(value) {
  if(!Number.isInteger(value) || value<5 || value>1440) throw new Error('Use 5 to 1,440 minutes.'); return value;
}
export function parseLifeMap(raw) {
  let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  // Read only Life Map from a whole-suite backup. Other fields never leave the browser.
  if(data?.data?.lifemap_v1 !== undefined) data = typeof data.data.lifemap_v1==='string' ? JSON.parse(data.data.lifemap_v1) : data.data.lifemap_v1;
  else if(data?.lifemap_v1 !== undefined) data = typeof data.lifemap_v1==='string' ? JSON.parse(data.lifemap_v1) : data.lifemap_v1;
  if(!Array.isArray(data?.projects)) throw new Error('Choose a Life Map export or an Atlas backup containing Life Map.');
  if(data.projects.length>1000) throw new Error('Import up to 1,000 projects at a time.');
  const seen=new Set();
  return data.projects.map((p,i)=>{
    if(!p || typeof p!=='object') throw new Error(`Project ${i+1} is not valid.`);
    const sourceId=textValue(String(p.id ?? ''),200,true);
    if(seen.has(sourceId)) throw new Error('The file contains duplicate project IDs.'); seen.add(sourceId);
    return { source_id:sourceId, title:textValue(p.task,300,true), area:textValue(p.area||'General',120),
      status:p.status==='Done'?'done':'open', due_date:validDate(p.due)?p.due:null };
  });
}

export function practiceItems(items) {
  if(!Array.isArray(items)||items.length>10000)throw new Error('Choose up to 10,000 practice records.');
  const seen=new Set();
  return items.map(item=>{
    if(!item||typeof item!=='object')throw new Error('A practice record is invalid.');
    const id=textValue(item.id,1000,true);if(!id.startsWith('lesson/')||seen.has(id))throw new Error('Practice IDs are invalid or repeated.');seen.add(id);
    const day=dateValue(item.day),completedDay=dateValue(item.completedDay);
    if(!day||!completedDay||typeof item.completedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(item.completedAt)||!Number.isFinite(Date.parse(item.completedAt)))throw new Error('A practice date is invalid.');
    return {id,day,title:textValue(item.title,500,true),track:textValue(item.track,120),completedDay,completedAt:new Date(item.completedAt).toISOString()};
  }).sort((a,b)=>a.id.localeCompare(b.id));
}
export function parsePracticeSnapshot(raw) {
  const envelope=typeof raw==='string'?JSON.parse(raw):raw;
  const entry=envelope?.data?.['courier:practice:v1']??envelope?.['courier:practice:v1'];
  if(entry===undefined)throw new Error('Choose an Atlas Vault backup containing Courier practice.');
  const value=typeof entry==='string'?JSON.parse(entry):entry;
  if(value?.version!==1||!value.completions||typeof value.completions!=='object'||Array.isArray(value.completions))throw new Error('The practice backup has an unsupported format.');
  const rows=Object.entries(value.completions).map(([id,item])=>{if(item?.id!==id)throw new Error('A practice ID does not match its record.');return item;});
  return {items:practiceItems(rows),source_exported_at:typeof envelope.exportedAt==='string'&&Number.isFinite(Date.parse(envelope.exportedAt))?new Date(envelope.exportedAt).toISOString():null};
}

export function practiceCatalog(catalog,items=[]) {
  if(!Array.isArray(catalog)||catalog.length>10000)throw Error('Choose up to 10,000 practice lessons.');
  const rows=new Map();
  for(const r of catalog){
    if(!r||typeof r!=='object')throw Error('A practice lesson is invalid.');
    const id=textValue(r.id,1000,true),day=dateValue(r.day);
    if(!id.startsWith('lesson/')||rows.has(id)||!day)throw Error('Practice lesson IDs or dates are invalid.');
    rows.set(id,{id,day,title:textValue(r.title,500,true),track:textValue(r.track,120),task:textValue(r.task??'',3000),drill:textValue(r.drill??'',3000)});
  }
  for(const item of items){
    const lesson=rows.get(item.id);
    if(lesson&&lesson.day!==item.day)throw Error('A completion does not match its lesson date.');
    if(!lesson)rows.set(item.id,{id:item.id,day:item.day,title:item.title,track:item.track,task:'',drill:''});
  }
  if(rows.size>10000)throw Error('Choose up to 10,000 practice lessons.');
  return [...rows.values()].sort((a,b)=>b.day.localeCompare(a.day)||a.id.localeCompare(b.id));
}
export function practicePayloadSize(value) {
  if(new TextEncoder().encode(JSON.stringify(value)).length>1500000)throw Error('Practice records exceed 1.5 MB. Use a smaller lesson selection.');
  return value;
}
export function practiceEditionRefresh(value){
  if(value===null||value===undefined)return null;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Courier refresh details are invalid.');
  const {checked_at,latest_edition,first_edition,latest_lesson_edition,edition_count,lesson_count}=value;
  if(typeof checked_at!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(checked_at)||!Number.isFinite(Date.parse(checked_at)))throw Error('The Courier refresh date is invalid.');
  if(!Number.isInteger(edition_count)||edition_count<0||edition_count>90||!Number.isInteger(lesson_count)||lesson_count<0||lesson_count>10000)throw Error('Courier refresh counts are invalid.');
  if(edition_count===0?(latest_edition!==null||first_edition!==null||lesson_count!==0):(!validDate(latest_edition)||!validDate(first_edition)||first_edition>latest_edition))throw Error('Courier edition dates are invalid.');
  if(lesson_count===0?latest_lesson_edition!==null:(!validDate(latest_lesson_edition)||latest_lesson_edition<first_edition||latest_lesson_edition>latest_edition))throw Error('The latest Courier lesson date is invalid.');
  return {checked_at:new Date(checked_at).toISOString(),latest_edition,first_edition,latest_lesson_edition,edition_count,lesson_count};
}
export function parsePracticeTransfer(raw) {
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  const pack=b?.app==='atlas-practice-transfer';
  if(pack&&b.version!==1)throw Error('This practice pack version is unsupported.');
  const snapshot=pack?{items:practiceItems(b.items),source_exported_at:b.exportedAt}:parsePracticeSnapshot(b);
  const exported=snapshot.source_exported_at;
  if(exported!==null&&(typeof exported!=='string'||!Number.isFinite(Date.parse(exported))))throw Error('The practice export date is invalid.');
  return practicePayloadSize({app:'atlas-practice-transfer',version:1,exportedAt:exported,
    catalog:practiceCatalog(pack?b.catalog:[],snapshot.items),items:snapshot.items});
}
export function practiceImportPlan(current,pack) {
  const managed=current?.mode==='managed',oldCatalog=practiceCatalog(current?.catalog||[],current?.items||[]);
  const known=new Set(oldCatalog.map(x=>x.id)),incoming=new Set(pack.catalog.map(x=>x.id));
  const rows=pack.catalog.map(x=>({id:x.id,title:x.title,action:managed&&known.has(x.id)?'Keep synced':known.has(x.id)?'Replace snapshot':'Add'}));
  if(!managed)for(const x of oldCatalog)if(!incoming.has(x.id))rows.push({id:x.id,title:x.title,action:'Remove snapshot'});
  const catalog=managed?[...oldCatalog,...pack.catalog.filter(x=>!known.has(x.id))]:pack.catalog;
  const items=managed?[...(current?.items||[]),...pack.items.filter(x=>!known.has(x.id))]:pack.items;
  const next=practicePayloadSize({catalog:practiceCatalog(catalog,items),items:practiceItems(items),mode:managed?'managed':'snapshot'});
  return {rows,next,added:rows.filter(x=>x.action==='Add').length,kept:rows.filter(x=>x.action==='Keep synced').length,
    removed:rows.filter(x=>x.action==='Remove snapshot').length,replaced:rows.filter(x=>x.action==='Replace snapshot').length};
}
export function weeklySummary(data,week) {
  const end=addDays(week,6),inWeek=d=>validDate(d)&&d>=week&&d<=end;
  const done=data.tasks.filter(t=>t.status==='done'&&t.completed_at&&inWeek(localDay(new Date(t.completed_at))));
  const unfinished=data.tasks.filter(t=>t.status==='open'&&t.week_start&&t.week_start<=week);
  const deadlines=data.projects.filter(p=>!p.archived_at&&p.status!=='done'&&p.due_date&&p.due_date>=addDays(week,7)&&p.due_date<=addDays(week,13));
  const projects=data.projects.filter(p=>!p.archived_at&&p.status==='done'&&p.completed_at&&inWeek(localDay(new Date(p.completed_at))));
  const practice=(data.practice?.items||[]).filter(p=>inWeek(p.completedDay));
  return {done,unfinished,deadlines,projects,practice};
}

// Read-only briefing: priorities are explicit choices; dates never imply completion.
export function dailyBriefing(data,today=localDay()) {
  if(!validDate(today))throw new Error('Choose a valid briefing date.');
  const start=monday(today),through=addDays(today,7),tasks=data.tasks||[],projects=data.projects||[];
  const active=tasks.filter(t=>t.status==='open');
  const sortDue=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||String(a.id).localeCompare(String(b.id));
  const taskItem=t=>({kind:'task',id:t.id,title:t.title,app_id:t.app_id,due:t.due_date,minutes:t.minutes,project_id:t.project_id});
  const priorities=active.filter(t=>t.focus_date===today).sort((a,b)=>a.focus_slot-b.focus_slot).map(taskItem);
  const deadlines=[...active.filter(t=>validDate(t.due_date)).map(taskItem),
    ...projects.filter(p=>!p.archived_at&&p.status==='open'&&validDate(p.due_date)).map(p=>({kind:'project',id:p.id,title:p.title,app_id:'life-map',due:p.due_date,mode:p.mode}))]
    .filter(item=>item.due<=through).sort(sortDue);
  const overdue=deadlines.filter(x=>x.due<today),dueToday=deadlines.filter(x=>x.due===today),upcoming=deadlines.filter(x=>x.due>today);
  const carryover=active.filter(t=>validDate(t.week_start)&&t.week_start<start).map(taskItem).sort(sortDue);
  const thisWeek=active.filter(t=>t.week_start===start).map(taskItem).sort(sortDue);
  const unplanned=active.filter(t=>!t.week_start).map(taskItem).sort(sortDue);
  const next=priorities[0]||overdue[0]||dueToday[0]||carryover[0]||thisWeek[0]||upcoming[0]||unplanned[0]||null;
  const reason=priorities.length?'Your first chosen priority':overdue.length?'An overdue deadline':dueToday.length?'Due today':carryover.length?'Unfinished from an earlier week':thisWeek.length?'Planned for this week':upcoming.length?'An upcoming deadline':unplanned.length?'An unscheduled commitment':null;
  const plannedMinutes=tasks.filter(t=>t.status!=='archived'&&t.week_start===start).reduce((sum,t)=>sum+t.minutes,0);
  const capacity=data.week?.week_start===start?data.week.capacity:null;
  const completed=tasks.filter(t=>t.status==='done'&&t.completed_at&&localDay(new Date(t.completed_at))===today).length;
  return {today,start,through,priorities,deadlines,overdue,dueToday,upcoming,carryover,unplanned,next,reason,plannedMinutes,capacity,
    overCapacity:capacity===null?null:Math.max(0,plannedMinutes-capacity),completed};
}
