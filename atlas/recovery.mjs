import {appStateRecord} from './connected-model.mjs';
import { cadenceRecord } from './cadence.mjs';
import { heraldRecord } from './herald.mjs';
import { communicationRecord } from './communication.mjs';
import { ledgerRecord } from './ledger.mjs';
import { validDate, monday, appValue, minutesValue, practiceItems, practiceCatalog, practiceEditionRefresh } from './model.mjs';

export const TABLES={tasks:'atlas_tasks',projects:'atlas_projects',weeks:'atlas_weeks',practice:'atlas_practice_snapshots',ledger:'atlas_ledger',communication:'atlas_communication',herald:'atlas_herald',cadence:'atlas_cadence',priorities:'atlas_priorities',app_states:'atlas_app_states'};
const fail=message=>{throw new Error(message);};
const str=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim())?v:fail('A backup text field is invalid.');
const stamp=(v,nullable=false)=>v===null&&nullable?null:typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?v:fail('A backup timestamp is invalid.');
const day=v=>v===null?null:validDate(v)?v:fail('A backup date is invalid.');
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail('A backup number is invalid.');
const oneOf=(v,choices)=>choices.includes(v)?v:fail('A backup status is invalid.');
const week=v=>v===null?null:validDate(v)&&monday(v)===v?v:fail('A backup week must start on Monday.');
const revision=v=>integer(v,1,Number.MAX_SAFE_INTEGER-100000);

export function parseWorkspace(raw,currentPractice=[],currentLedger=[],currentCommunication=[],currentHerald=[],currentCadence=[],currentTasks=[],currentProjects=[],currentPriorities=[],currentAppStates=[]) {
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  if(!b||b.app!=='atlas-os'||![1,2,3,4,5,6,7,8].includes(b.version))fail('Choose an Atlas OS workspace export (versions 1–8). Atlas Vault files belong in the original Home app.');
  const lists={tasks:10000,projects:1000,weeks:1000,practice:1,ledger:1,communication:1,herald:1,cadence:1,priorities:2000,app_states:2};
  const input={...b,practice:b.version===1?currentPractice:b.practice,ledger:b.version<4?currentLedger:b.ledger,communication:b.version<5?currentCommunication:b.communication,herald:b.version<6?currentHerald:b.herald,cadence:b.version<7?currentCadence:b.cadence,priorities:b.version<8?currentPriorities:b.priorities,app_states:b.version<8?currentAppStates:b.app_states};
  // Earlier formats cannot represent recurring origins. Preserve those records
  // and any otherwise absent linked project; never silently recreate occurrences.
  if(b.version<7){
    if(!Array.isArray(input.tasks)||!Array.isArray(input.projects))fail('The backup has invalid commitments or projects.');
    const recurring=currentTasks.filter(t=>t.routine_id),ids=new Set(recurring.map(t=>t.id));
    input.tasks=[...(Array.isArray(input.tasks)?input.tasks:[]).filter(t=>!ids.has(t.id)),...recurring];
    const projectIds=new Set((input.projects||[]).map(p=>p.id)),links=new Set(recurring.map(t=>t.project_id).filter(Boolean));
    input.projects=[...(input.projects||[]),...currentProjects.filter(p=>links.has(p.id)&&!projectIds.has(p.id))];
  }
  for(const [key,max] of Object.entries(lists))if(!Array.isArray(input[key])||input[key].length>max)fail(`The backup has an invalid ${key} list.`);
  if(b.version>=7&&input.tasks.some(t=>!Object.hasOwn(t,'routine_id')||!Object.hasOwn(t,'occurrence_date')))fail('This backup is missing commitment recurrence fields.');
  const out={app:'atlas-os',version:8,exportedAt:stamp(b.exportedAt),projects:[],tasks:[],weeks:[],practice:[],ledger:[],communication:[],herald:[],cadence:[],priorities:[],app_states:[]};
  out.projects=input.projects.map(p=>({id:str(p.id,80,true),source_id:str(p.source_id,200,true),title:str(p.title,300,true),area:str(p.area,120),status:oneOf(p.status,['open','done']),due_date:day(p.due_date),imported_at:stamp(p.imported_at),mode:oneOf(p.mode??'snapshot',['managed','snapshot']),revision:revision(p.revision??1),updated_at:stamp(p.updated_at??null,true),completed_at:stamp(p.completed_at??null,true),archived_at:stamp(p.archived_at??null,true)}));
  out.tasks=input.tasks.map(t=>({id:str(t.id,80,true),title:str(t.title,300,true),app_id:appValue(t.app_id),project_id:t.project_id===null?null:str(t.project_id,80,true),week_start:week(t.week_start),due_date:day(t.due_date),minutes:minutesValue(t.minutes),focus_date:day(t.focus_date),focus_slot:t.focus_slot===null?null:integer(t.focus_slot,1,3),status:oneOf(t.status,['open','done','archived']),completed_at:stamp(t.completed_at,true),revision:revision(t.revision),created_at:stamp(t.created_at),updated_at:stamp(t.updated_at),routine_id:t.routine_id==null?null:str(t.routine_id,80,true),occurrence_date:day(t.occurrence_date??null)}));
  out.weeks=input.weeks.map(w=>({id:str(w.id,80,true),week_start:week(w.week_start)||fail('A review week is missing.'),capacity:integer(w.capacity,0,10080),worked:str(w.worked,4000),change:str(w.change,4000),revision:revision(w.revision),updated_at:stamp(w.updated_at)}));
  out.practice=input.practice.map(p=>{if(b.version>=3&&(!Array.isArray(p.catalog)||!['snapshot','managed'].includes(p.mode)))fail('A current practice backup needs its lesson catalog and management mode.');const items=practiceItems(p.items);return {items,edition_refresh:practiceEditionRefresh(p.edition_refresh),catalog:practiceCatalog(p.catalog??[],items),mode:oneOf(p.mode??'snapshot',['snapshot','managed']),updated_at:stamp(p.updated_at??null,true),revision:revision(p.revision),imported_at:stamp(p.imported_at),source_exported_at:stamp(p.source_exported_at,true)};});
  out.ledger=input.ledger.map(ledgerRecord);
  out.communication=input.communication.map(communicationRecord);
  out.herald=input.herald.map(heraldRecord);
  out.cadence=input.cadence.map(cadenceRecord);
  out.app_states=input.app_states.map(appStateRecord);
  out.priorities=input.priorities.map(p=>({id:str(p.id,80,true),kind:oneOf(p.kind,['project','content']),record_id:str(p.record_id,200,true),day:day(p.day)||fail('A priority day is missing.'),slot:integer(p.slot,1,3),revision:revision(p.revision),updated_at:stamp(p.updated_at)}));
  if(new TextEncoder().encode(JSON.stringify(out.practice)).length>1500000)fail('The practice snapshot is too large. Use a snapshot smaller than 1.5 MB.');
  const unique=(rows,key)=>{const ids=rows.map(r=>r[key]);if(new Set(ids).size!==ids.length)fail('The backup contains duplicate record IDs.');};
  for(const key of ['tasks','projects','weeks','priorities','app_states'])unique(out[key],'id');
  unique(out.app_states,'kind');unique(out.projects,'source_id');unique(out.weeks,'week_start');
  const projects=new Set(out.projects.map(p=>p.id)),slots=new Set(),routines=new Set(out.cadence.flatMap(c=>c.routines.map(r=>r.id))),occurrences=new Set();
  for(const t of out.tasks){
    if(Boolean(t.routine_id)!==Boolean(t.occurrence_date)||t.routine_id&&!routines.has(t.routine_id))fail('A recurring commitment is missing its routine or occurrence date.');
    if(t.routine_id){const key=t.routine_id+':'+t.occurrence_date;if(occurrences.has(key))fail('A routine occurrence is repeated.');occurrences.add(key);}
    if(t.project_id&&!projects.has(t.project_id))fail('A commitment refers to a project missing from this backup.');
    if(Boolean(t.focus_date)!==Boolean(t.focus_slot)||t.focus_date&&t.status!=='open')fail('A priority in the backup is invalid.');
    if(t.focus_date){const slot=t.focus_date+':'+t.focus_slot;if(slots.has(slot))fail('Two commitments occupy the same priority slot.');slots.add(slot);}
    if(t.status==='done'&&!t.completed_at)fail('A completed commitment is missing its completion date.');
  }
  const available=p=>p.kind==='project'?out.projects.some(r=>r.id===p.record_id&&r.status==='open'&&!r.archived_at):out.herald.some(h=>h.items.some(r=>r.id===p.record_id&&r.stage!=='published'&&!r.archived));
  if(b.version<8)out.priorities=out.priorities.filter(p=>available(p)&&!slots.has(p.day+':'+p.slot));
  const selected=new Set();
  for(const p of out.priorities){
    if(!available(p))fail('A priority points to missing or completed work.');
    const slot=p.day+':'+p.slot,key=p.kind+':'+p.record_id;
    if(slots.has(slot)||selected.has(key))fail('Priority selections conflict in this backup.');
    slots.add(slot);selected.add(key);
  }
  return out;
}
export async function workspace(db,owner) {
  const result=await db.batch([...Object.values(TABLES).map(t=>db.prepare(`SELECT * FROM ${t} WHERE owner=?`).bind(owner)),db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM atlas_history WHERE owner=?').bind(owner)]);
  const data={app:'atlas-os',version:8,exportedAt:new Date().toISOString()};
  Object.keys(TABLES).forEach((key,i)=>data[key]=result[i].results.map(({owner,...r})=>key==='practice'?{...r,edition_refresh:practiceEditionRefresh(r.edition_refresh?JSON.parse(r.edition_refresh):null),items:JSON.parse(r.items),catalog:practiceCatalog(JSON.parse(r.catalog||'[]'),JSON.parse(r.items))}:key==='ledger'?{...r,habits:JSON.parse(r.habits),days:JSON.parse(r.days)}:key==='communication'?{...r,reps:JSON.parse(r.reps)}:key==='herald'?{...r,items:JSON.parse(r.items)}:key==='cadence'?{...r,routines:JSON.parse(r.routines)}:r));
  return {data,seq:result[Object.keys(TABLES).length].results[0].seq};
}
function canonical(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
export async function digest(value){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const comparable=r=>Object.fromEntries(Object.entries(r).filter(([key])=>!['revision','updated_at','imported_at'].includes(key)));
export function changes(before,after){
  return Object.keys(TABLES).map(key=>{
    const id=r=>key==='practice'?'practice':key==='ledger'?'ledger':key==='communication'?'communication':key==='herald'?'herald':key==='cadence'?'cadence':key==='weeks'?r.week_start:r.id;
    const old=new Map(before[key].map(r=>[id(r),r])),next=new Map(after[key].map(r=>[id(r),r]));
    const title=r=>r.title||r.week_start||(key==='app_states'?(r.kind==='herald'?'Herald scripts and details':'Life Map notes and chores'):key==='priorities'?((r.kind==='project'?after.projects:after.herald.flatMap(h=>h.items)).find(x=>x.id===r.record_id)?.title||'Chosen '+r.kind):key==='ledger'?'Life Ledger':key==='communication'?'Speaking practice':key==='herald'?'Herald content plan':key==='cadence'?'Operations Cadence':'Courier practice');
    const rows=[];
    for(const [k,r] of next){const previous=old.get(k),action=!previous?'Add':canonical(comparable(previous))!==canonical(comparable(r))?'Replace':'Keep';rows.push({action,title:title(r),id:k});}
    for(const [k,r] of old)if(!next.has(k))rows.push({action:'Remove',title:title(r),id:k});
    return {key,rows,add:rows.filter(r=>r.action==='Add').length,replace:rows.filter(r=>r.action==='Replace').length,remove:rows.filter(r=>r.action==='Remove').length,keep:rows.filter(r=>r.action==='Keep').length};
  });
}
export function guard(db,owner,seq,id){return db.prepare('INSERT INTO atlas_restore_guards (id,valid) VALUES (?, (SELECT CASE WHEN COALESCE(MAX(seq),0)=? THEN 1 ELSE 0 END FROM atlas_history WHERE owner=?))').bind(id,seq,owner);}
export async function replaceWorkspace(db,owner,backup,current,seq,label) {
  const id=crypto.randomUUID(),now=new Date().toISOString(),before=JSON.stringify(current);
  const statements=[guard(db,owner,seq,id)];
  // Multiple bounded rows keep recovery copies below D1's per-row size limit.
  for(let i=0;i<before.length;i+=200000)statements.push(db.prepare('INSERT INTO atlas_checkpoint_chunks (id,checkpoint_id,position,content) VALUES (?,?,?,?)').bind(id+':'+i,id,i,before.slice(i,i+200000)));
  for(const table of Object.values(TABLES))statements.push(db.prepare(`DELETE FROM ${table} WHERE owner=?`).bind(owner));
  for(const [key,table] of Object.entries(TABLES)){
    const records=backup[key].map(r=>({...r,revision:Math.max(Date.now(),r.revision+1),...(key!=='practice'?{updated_at:now}:{})}));
    if(!records.length)continue;
    const columns=Object.keys(records[0]);
    const select=columns.map(c=>c==='items'?"json_extract(value,'$.items')":`json_extract(value,'$.${c}')`).join(',');
    statements.push(db.prepare(`INSERT INTO ${table} (owner,${columns.join(',')}) SELECT ?,${select} FROM json_each(?)`).bind(owner,JSON.stringify(records)));
  }
  // A marker also advances the workspace generation when both snapshots are empty.
  statements.push(db.prepare("INSERT INTO atlas_history (owner,entity,record_id,action,created_at) VALUES (?,'workspace',?,'restored',?)").bind(owner,id,now));
  statements.push(db.prepare('INSERT INTO atlas_checkpoints (id,owner,created_at,after_seq,label) VALUES (?,?,?,(SELECT MAX(seq) FROM atlas_history WHERE owner=?),?)').bind(id,owner,now,owner,label));
  statements.push(db.prepare('DELETE FROM atlas_restore_guards WHERE id=?').bind(id));
  await db.batch(statements);
  return id;
}
export async function checkpointData(db,owner,id){
  const checkpoint=await db.prepare('SELECT * FROM atlas_checkpoints WHERE id=? AND owner=?').bind(id,owner).first();
  if(!checkpoint)return null;
  const rows=await db.prepare('SELECT content FROM atlas_checkpoint_chunks WHERE checkpoint_id=? ORDER BY position').bind(id).all();
  return {...checkpoint,data:JSON.parse(rows.results.map(r=>r.content).join(''))};
}
