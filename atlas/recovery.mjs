import { validDate, monday, appValue, minutesValue, practiceItems } from './model.mjs';

export const TABLES={tasks:'atlas_tasks',projects:'atlas_projects',weeks:'atlas_weeks',practice:'atlas_practice_snapshots'};
const fail=message=>{throw new Error(message);};
const str=(v,max,required=false)=>typeof v==='string'&&v.length<=max&&(!required||v.trim())?v:fail('A backup text field is invalid.');
const stamp=(v,nullable=false)=>v===null&&nullable?null:typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?v:fail('A backup timestamp is invalid.');
const day=v=>v===null?null:validDate(v)?v:fail('A backup date is invalid.');
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max?v:fail('A backup number is invalid.');
const oneOf=(v,choices)=>choices.includes(v)?v:fail('A backup status is invalid.');
const week=v=>v===null?null:validDate(v)&&monday(v)===v?v:fail('A backup week must start on Monday.');
const revision=v=>integer(v,1,Number.MAX_SAFE_INTEGER-100000);

export function parseWorkspace(raw,currentPractice=[]) {
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  if(!b||b.app!=='atlas-os'||![1,2].includes(b.version))fail('Choose an Atlas OS workspace export (version 1 or 2). Atlas Vault files belong in the original Home app.');
  const lists={tasks:10000,projects:1000,weeks:1000,practice:1};
  const input={...b,practice:b.version===1?currentPractice:b.practice};
  for(const [key,max] of Object.entries(lists))if(!Array.isArray(input[key])||input[key].length>max)fail(`The backup has an invalid ${key} list.`);
  const out={app:'atlas-os',version:2,exportedAt:stamp(b.exportedAt),projects:[],tasks:[],weeks:[],practice:[]};
  out.projects=input.projects.map(p=>({id:str(p.id,80,true),source_id:str(p.source_id,200,true),title:str(p.title,300,true),area:str(p.area,120),status:oneOf(p.status,['open','done']),due_date:day(p.due_date),imported_at:stamp(p.imported_at),mode:oneOf(p.mode??'snapshot',['managed','snapshot']),revision:revision(p.revision??1),updated_at:stamp(p.updated_at??null,true),completed_at:stamp(p.completed_at??null,true),archived_at:stamp(p.archived_at??null,true)}));
  out.tasks=input.tasks.map(t=>({id:str(t.id,80,true),title:str(t.title,300,true),app_id:appValue(t.app_id),project_id:t.project_id===null?null:str(t.project_id,80,true),week_start:week(t.week_start),due_date:day(t.due_date),minutes:minutesValue(t.minutes),focus_date:day(t.focus_date),focus_slot:t.focus_slot===null?null:integer(t.focus_slot,1,3),status:oneOf(t.status,['open','done','archived']),completed_at:stamp(t.completed_at,true),revision:revision(t.revision),created_at:stamp(t.created_at),updated_at:stamp(t.updated_at)}));
  out.weeks=input.weeks.map(w=>({id:str(w.id,80,true),week_start:week(w.week_start)||fail('A review week is missing.'),capacity:integer(w.capacity,0,10080),worked:str(w.worked,4000),change:str(w.change,4000),revision:revision(w.revision),updated_at:stamp(w.updated_at)}));
  out.practice=input.practice.map(p=>({items:practiceItems(p.items),revision:revision(p.revision),imported_at:stamp(p.imported_at),source_exported_at:stamp(p.source_exported_at,true)}));
  if(new TextEncoder().encode(JSON.stringify(out.practice)).length>1500000)fail('The practice snapshot is too large. Use a snapshot smaller than 1.5 MB.');
  const unique=(rows,key)=>{const ids=rows.map(r=>r[key]);if(new Set(ids).size!==ids.length)fail('The backup contains duplicate record IDs.');};
  for(const key of ['tasks','projects','weeks'])unique(out[key],'id');
  unique(out.projects,'source_id');unique(out.weeks,'week_start');
  const projects=new Set(out.projects.map(p=>p.id)),slots=new Set();
  for(const t of out.tasks){
    if(t.project_id&&!projects.has(t.project_id))fail('A commitment refers to a project missing from this backup.');
    if(Boolean(t.focus_date)!==Boolean(t.focus_slot)||t.focus_date&&t.status!=='open')fail('A priority in the backup is invalid.');
    if(t.focus_date){const slot=t.focus_date+':'+t.focus_slot;if(slots.has(slot))fail('Two commitments occupy the same priority slot.');slots.add(slot);}
    if(t.status==='done'&&!t.completed_at)fail('A completed commitment is missing its completion date.');
  }
  return out;
}
export async function workspace(db,owner) {
  const result=await db.batch([...Object.values(TABLES).map(t=>db.prepare(`SELECT * FROM ${t} WHERE owner=?`).bind(owner)),db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM atlas_history WHERE owner=?').bind(owner)]);
  const data={app:'atlas-os',version:2,exportedAt:new Date().toISOString()};
  Object.keys(TABLES).forEach((key,i)=>data[key]=result[i].results.map(({owner,...r})=>key==='practice'?{...r,items:JSON.parse(r.items)}:r));
  return {data,seq:result[4].results[0].seq};
}
function canonical(value){return JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
export async function digest(value){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');}
const comparable=r=>Object.fromEntries(Object.entries(r).filter(([key])=>!['revision','updated_at','imported_at'].includes(key)));
export function changes(before,after){
  return Object.keys(TABLES).map(key=>{
    const id=r=>key==='practice'?'practice':key==='weeks'?r.week_start:r.id;
    const old=new Map(before[key].map(r=>[id(r),r])),next=new Map(after[key].map(r=>[id(r),r]));
    const rows=[];
    for(const [k,r] of next){const previous=old.get(k),action=!previous?'Add':canonical(comparable(previous))!==canonical(comparable(r))?'Replace':'Keep';rows.push({action,title:r.title||r.week_start||'Courier practice',id:k});}
    for(const [k,r] of old)if(!next.has(k))rows.push({action:'Remove',title:r.title||r.week_start||'Courier practice',id:k});
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
