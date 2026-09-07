import {validDate, monday, addDays, textValue, minutesValue} from './model.mjs';
import {LEGACY_CADENCE} from './cadence-catalog.mjs';

export const WEEKDAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const fail=m=>{throw Error(m);};
const stamp=v=>v===null?null:typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():fail('A routine timestamp is invalid.');
export function routine(raw){
  if(!raw||typeof raw!=='object')fail('Choose a routine.');
  const id=textValue(raw.id,80,true),source_id=raw.source_id===null?null:textValue(raw.source_id,200,true);
  if(!/^(routine|legacy)-[a-zA-Z0-9-]+$/.test(id)||id.startsWith('legacy-')!==!!source_id)fail('A routine ID is invalid.');
  if(!['weekly','monthly'].includes(raw.frequency))fail('Choose a weekly or monthly routine.');
  if(!Number.isInteger(raw.day)||raw.day<(raw.frequency==='weekly'?0:1)||raw.day>(raw.frequency==='weekly'?6:31))fail('Choose a valid day for this routine.');
  if(!validDate(raw.start_date)||typeof raw.paused!=='boolean')fail('Choose a valid start date and pause setting.');
  return {id,source_id,title:textValue(raw.title,300,true),frequency:raw.frequency,day:raw.day,start_date:raw.start_date,minutes:minutesValue(raw.minutes),paused:raw.paused};
}
export function cadenceContent(raw){
  if(!raw||!Array.isArray(raw.routines)||raw.routines.length>200)fail('Keep up to 200 routines.');
  const routines=raw.routines.map(routine);if(new Set(routines.map(r=>r.id)).size!==routines.length)fail('Routine IDs must be unique.');
  const sources=routines.map(r=>r.source_id).filter(Boolean);if(new Set(sources).size!==sources.length)fail('Source routines must be unique.');
  return {routines};
}
export function cadenceRecord(raw){
  if(!Number.isSafeInteger(raw?.revision)||raw.revision<1)fail('The routine revision is invalid.');
  if(raw.updated_at===null)fail('A routine update timestamp is missing.');
  return {...cadenceContent(raw),revision:raw.revision,updated_at:stamp(raw.updated_at),imported_at:stamp(raw.imported_at??null),source_exported_at:stamp(raw.source_exported_at??null)};
}
export function routineDates(r,week){
  if(!validDate(week)||monday(week)!==week)fail('Choose a week starting Monday.');
  if(r.paused)return [];
  return Array.from({length:7},(_,i)=>addDays(week,i)).filter(date=>{
    if(date<r.start_date)return false;
    const d=new Date(date+'T12:00:00Z');
    return r.frequency==='weekly'?d.getUTCDay()===r.day:d.getUTCDate()===Math.min(r.day,new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate());
  });
}
export function missingOccurrences(cadence,tasks,week){
  const existing=new Set((tasks||[]).filter(t=>t.routine_id).map(t=>t.routine_id+':'+t.occurrence_date));
  return (cadence?.routines||[]).flatMap(r=>routineDates(r,week).filter(date=>!existing.has(r.id+':'+date)).map(date=>({routine:r,date})));
}
export const routineLabel=r=>r.frequency==='weekly'?'Every '+WEEKDAYS[r.day]:'Monthly on day '+r.day+(r.day>28?' · Last day in shorter months':'');
export function routineWeek(data,week){return (data.tasks||[]).filter(t=>t.routine_id&&t.occurrence_date>=week&&t.occurrence_date<=addDays(week,6)).sort((a,b)=>a.occurrence_date.localeCompare(b.occurrence_date)||a.title.localeCompare(b.title));}
async function sourceID(value){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return 'legacy-'+[...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('').slice(0,40);}
// Only routine names and schedules are projected. Notes, contacts, logs and
// completion ticks remain in the original app and never enter the import API.
export async function parseCadenceTransfer(raw,start){
  if(!validDate(start))fail('Choose a valid import start date.');
  let b=typeof raw==='string'?JSON.parse(raw):raw;
  const hasSource=b?.data&&Object.hasOwn(b.data,'operationsCadence.v1')||b&&Object.hasOwn(b,'operationsCadence.v1');
  b=b?.data?.['operationsCadence.v1']??b?.['operationsCadence.v1']??b;
  if(typeof b==='string')b=JSON.parse(b);
  if(!b||typeof b!=='object'||Array.isArray(b)||!hasSource&&!['custom','recur','events','overrides','weekly:0','monthly:0'].some(k=>Object.hasOwn(b,k))&&!Object.keys(b).some(k=>/^(daily|weekly|monthly|quarterly|annually):/.test(k)))fail('Choose an Atlas Vault export containing Operations Cadence records.');
  const rows=LEGACY_CADENCE.map(r=>({...r}));
  for(const frequency of ['weekly','monthly']){
    const custom=b.custom?.[frequency]??[];if(!Array.isArray(custom)||custom.length>200)fail('The custom routine list is invalid.');
    for(const r of custom)rows.push({source_id:frequency+':'+textValue(r.cid,100,true),title:textValue(r.t,300,true),frequency});
  }
  const routines=[];let unsupported=0;
  for(const row of rows){
    if(b.overrides?.[row.source_id])row.title=textValue(b.overrides[row.source_id],300,true);
    const rule=b.recur?.[row.source_id];
    if(rule&&!['weekday','monthday'].includes(rule.kind)){unsupported++;continue;}
    const frequency=rule?.kind==='weekday'?'weekly':rule?.kind==='monthday'?'monthly':row.frequency;
    const day=rule?Number(rule.kind==='weekday'?rule.wd:rule.day):1;
    routines.push(routine({...row,id:await sourceID(row.source_id),frequency,day,minutes:30,start_date:start,paused:true}));
  }
  return {app:'atlas-cadence-transfer',version:1,...cadenceContent({routines}),unsupported};
}
export function cadenceImportPlan(pack,current){
  if(pack?.app!=='atlas-cadence-transfer'||pack.version!==1)fail('Choose a supported routine transfer.');
  const content=cadenceContent(pack),next=cadenceContent(current||{routines:[]}),ids=new Set(next.routines.map(r=>r.id)),rows=[];
  for(const r of content.routines){if(!r.source_id)fail('Only source routines belong in an import.');const exists=ids.has(r.id)||next.routines.some(x=>x.source_id===r.source_id);rows.push({id:r.id,title:r.title,action:exists?'Keep':'Add',schedule:routineLabel(r)});if(!exists){next.routines.push({...r,paused:true});ids.add(r.id);}}
  return {pack:{app:'atlas-cadence-transfer',version:1,...content},next:cadenceContent(next),rows,added:rows.filter(r=>r.action==='Add').length,kept:rows.filter(r=>r.action==='Keep').length};
}
