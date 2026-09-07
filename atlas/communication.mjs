import { validDate, textValue, localDay, addDays } from './model.mjs';

const fail=message=>{throw Error(message);};
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const stamp=v=>v===null?null:typeof v==='string'&&validDate(v.slice(0,10))&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():fail('A speaking practice timestamp is invalid.');
export function communicationRep(raw){
  if(!object(raw))fail('Choose a speaking practice record.');
  const id=textValue(raw.id,100,true);
  if(!/^(atlas|legacy):[a-zA-Z0-9-]+$/.test(id))fail('A speaking practice ID is invalid.');
  if(!validDate(raw.day))fail('Choose a valid practice date.');
  if(typeof raw.archived!=='boolean')fail('A practice archive choice is invalid.');
  return {id,day:raw.day,topic:textValue(raw.topic,300,true),drill:textValue(raw.drill,160,true),skill:textValue(raw.skill,80),note:textValue(raw.note,2000),archived:raw.archived,source_timestamp:stamp(raw.source_timestamp??null)};
}
export function communicationContent(raw){
  if(!object(raw)||!Array.isArray(raw.reps)||raw.reps.length>3000)fail('Use up to 3,000 speaking practice records.');
  const reps=raw.reps.map(communicationRep).sort((a,b)=>a.day.localeCompare(b.day)||a.id.localeCompare(b.id));
  if(new Set(reps.map(r=>r.id)).size!==reps.length)fail('The file has duplicate speaking practice IDs.');
  if(new TextEncoder().encode(JSON.stringify(reps)).length>1500000)fail('Speaking practice holds up to 1.5 MB. Keep a backup before reducing older notes.');
  return {reps};
}
export function communicationRecord(raw){
  if(!Number.isSafeInteger(raw?.revision)||raw.revision<1||raw.revision>Number.MAX_SAFE_INTEGER-100000)fail('A speaking practice revision is invalid.');
  return {...communicationContent(raw),revision:raw.revision,updated_at:stamp(raw.updated_at)||fail('The practice save date is missing.'),imported_at:stamp(raw.imported_at),source_exported_at:stamp(raw.source_exported_at)};
}
export async function parseCommunicationTransfer(raw){
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  if(b?.app==='atlas-communication-transfer'&&b.version===1)return {app:b.app,version:1,exportedAt:stamp(b.exportedAt),...communicationContent(b)};
  if(!object(b)||b.app||!Array.isArray(b.reps)||!Array.isArray(b.assessments)||!object(b.lessonsDone)||b.reps.length>3000)fail('Choose Export progress from the original Master Communicator, or an Atlas speaking practice transfer.');
  const occurrences=new Map(),reps=[];
  for(const r of b.reps){
    const source_timestamp=stamp(r?.date)||fail('A completed practice date is missing.'),topic=textValue(r.topic,300,true),drill=textValue(r.drill,160,true),skill=textValue(r.skill,80);
    const key=JSON.stringify([source_timestamp,topic,drill,skill]),occurrence=occurrences.get(key)||0;occurrences.set(key,occurrence+1);
    const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([key,occurrence])));
    const id='legacy:'+Array.from(new Uint8Array(hash),x=>x.toString(16).padStart(2,'0')).join('');
    // The browser resolves the imported day once. The reviewed transfer retains
    // that explicit date; the Worker must not reinterpret it in its UTC timezone.
    reps.push({id,day:localDay(new Date(source_timestamp)),topic,drill,skill,note:'',archived:false,source_timestamp});
  }
  return {app:'atlas-communication-transfer',version:1,exportedAt:null,...communicationContent({reps})};
}
export function communicationImportPlan(current,pack){
  const reps=new Map((current?.reps||[]).map(r=>[r.id,r])),rows=[];
  for(const r of pack.reps){const previous=reps.get(r.id),keep=!!previous;rows.push({id:r.id,title:(previous||r).topic,day:(previous||r).day,action:keep?'Keep':'Add'});if(!keep)reps.set(r.id,r);}
  return {next:communicationContent({reps:[...reps.values()]}),rows,added:rows.filter(r=>r.action==='Add').length,kept:rows.filter(r=>r.action==='Keep').length};
}
export function communicationWeek(current,week){return (current?.reps||[]).filter(r=>!r.archived&&r.day>=week&&r.day<=addDays(week,6));}
