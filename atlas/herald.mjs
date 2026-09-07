import { validDate, textValue, addDays } from './model.mjs';

export const HERALD_STAGES={draft:'Draft',approved:'Approved',produced:'Filmed / edited',scheduled:'Scheduled',published:'Published'};
export const HERALD_FORMATS={long:'Long form',short:'Short'};
const fail=message=>{throw Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const stamp=v=>v===null?null:typeof v==='string'&&validDate(v.slice(0,10))&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():fail('A content plan timestamp is invalid.');
const day=v=>v===null||v===''?null:validDate(v)?v:fail('Choose a valid content date.');
export function heraldItem(raw){
  if(!object(raw))fail('Choose a content record.');
  const id=textValue(raw.id,100,true),source_id=raw.source_id===null?null:textValue(raw.source_id,200,true);
  if(!/^(atlas|legacy):[a-zA-Z0-9-]+$/.test(id)||id.startsWith('legacy:')!==!!source_id)fail('A content record ID is invalid.');
  if(!Object.hasOwn(HERALD_STAGES,raw.stage)||!Object.hasOwn(HERALD_FORMATS,raw.format))fail('Choose a supported content stage and format.');
  if(typeof raw.archived!=='boolean')fail('A content archive choice is invalid.');
  const published_day=day(raw.published_day);
  if(published_day&&raw.stage!=='published')fail('Only a published item can have a recorded publication date.');
  return {id,source_id,title:textValue(raw.title,500,true),format:raw.format,audience:textValue(raw.audience,120),stage:raw.stage,scheduled_day:day(raw.scheduled_day),published_day,note:textValue(raw.note,3000),archived:raw.archived};
}
export function heraldContent(raw){
  if(!object(raw)||!Array.isArray(raw.items)||raw.items.length>1000)fail('Use up to 1,000 content records.');
  const items=raw.items.map(heraldItem).sort((a,b)=>a.id.localeCompare(b.id));
  if(new Set(items.map(r=>r.id)).size!==items.length||new Set(items.filter(r=>r.source_id).map(r=>r.source_id)).size!==items.filter(r=>r.source_id).length)fail('The file has duplicate content IDs.');
  if(new TextEncoder().encode(JSON.stringify(items)).length>1500000)fail('The content plan holds up to 1.5 MB. Keep a backup before reducing older notes.');
  return {items};
}
export function heraldRecord(raw){
  if(!Number.isSafeInteger(raw?.revision)||raw.revision<1||raw.revision>Number.MAX_SAFE_INTEGER-100000)fail('A content plan revision is invalid.');
  return {...heraldContent(raw),revision:raw.revision,updated_at:stamp(raw.updated_at)||fail('The content save date is missing.'),imported_at:stamp(raw.imported_at),source_exported_at:stamp(raw.source_exported_at)};
}
export async function parseHeraldTransfer(raw){
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  if(b?.app==='atlas-herald-transfer'&&b.version===1)return {app:b.app,version:1,exportedAt:stamp(b.exportedAt),...heraldContent(b)};
  const wrapped=b?.app==='herald'&&b.v===1,s=wrapped?b.state:b;
  if(!object(s)||(!wrapped&&b.app)||!Array.isArray(s.videos)||!object(s.cadence)||!Array.isArray(s.leads)||s.videos.length>1000)fail('Choose a Herald backup or a supported Herald transfer.');
  const items=[];
  for(const v of s.videos){
    const source_id=textValue(v?.id,200,true),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source_id));
    items.push({id:'legacy:'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join(''),source_id,title:v.title,format:v.fmt,audience:v.vert??'',stage:v.status==='optimized'?'approved':v.status,scheduled_day:v.sched??null,published_day:null,note:'',archived:false});
  }
  // The original app tracks a planned date and a status, but no actual
  // publication date. Never convert a planned slot into evidence of publication.
  return {app:'atlas-herald-transfer',version:1,exportedAt:wrapped?stamp(b.at):null,...heraldContent({items})};
}
export function heraldImportPlan(current,pack){
  const items=new Map((current?.items||[]).map(r=>[r.id,r])),rows=[];
  for(const r of pack.items){const previous=items.get(r.id),kept=!!previous,shown=previous||r;rows.push({id:r.id,title:shown.title,stage:shown.stage,scheduled_day:shown.scheduled_day,action:kept?'Keep':'Add'});if(!kept)items.set(r.id,r);}
  return {next:heraldContent({items:[...items.values()]}),rows,added:rows.filter(r=>r.action==='Add').length,kept:rows.filter(r=>r.action==='Keep').length};
}
export function heraldWeek(current,week){
  const items=(current?.items||[]).filter(r=>!r.archived),through=addDays(week,6),inWeek=d=>d&&d>=week&&d<=through;
  return {planned:items.filter(r=>r.stage!=='published'&&inWeek(r.scheduled_day)).sort((a,b)=>a.scheduled_day.localeCompare(b.scheduled_day)||a.id.localeCompare(b.id)),published:items.filter(r=>r.stage==='published'&&inWeek(r.published_day)).sort((a,b)=>b.published_day.localeCompare(a.published_day)||a.id.localeCompare(b.id))};
}
