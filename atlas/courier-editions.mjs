import {validDate,textValue,practiceCatalog,practiceItems,practicePayloadSize,practiceEditionRefresh} from './model.mjs';
import {courierLessonId} from '../shared/courier-lessons.mjs';

export const COURIER_FEED='https://qchamby204.github.io/my-dashboards/courier/manifest.json';
const MAX_BYTES=2000000;
const fail=message=>{throw Error(message);};
const list=(v,max,label)=>Array.isArray(v)&&v.length<=max?v:fail(`Courier has an invalid ${label} list.`);
const stamp=v=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&/^\d{4}-\d{2}-\d{2}T/.test(v)?new Date(v).toISOString():fail('Courier has an invalid publication timestamp.');

export function publishedEditions(raw,checkedAt=new Date().toISOString()){
  if(raw?.schemaVersion!==1)fail('This Courier feed format is not supported. Your saved practice is unchanged.');
  const seen=new Set(),catalog=[],editions=[];
  for(const day of list(raw.days,90,'edition')){
    if(!validDate(day?.date)||day.date<'1900-01-01'||seen.has(day.date))fail('Courier has an invalid or repeated edition date.');
    seen.add(day.date);const generatedAt=stamp(day.generatedAt);let lessons=0;const blocks=new Set();
    for(const block of list(day.blocks,50,'section')){
      if(block?.lessons===undefined)continue;
      const blockId=textValue(block.id,80,true);if(blocks.has(blockId))fail('Courier has repeated lesson sections.');blocks.add(blockId);
      for(const [position,l]of list(block.lessons,100,'lesson').entries()){
        textValue(l?.track,80,true);if(l.sequence!==null&&l.sequence!==undefined)textValue(l.sequence,120);
        if(l.index!==undefined&&(!Number.isSafeInteger(l.index)||l.index<0))fail('Courier has an invalid lesson index.');
        catalog.push({id:courierLessonId(day.date,blockId,l,position),day:day.date,title:textValue(l.title,500,true),track:textValue(l.label||l.track,120,true),task:textValue(l.task??'',3000),drill:textValue(l.drill??'',3000)});lessons++;
      }
    }
    editions.push({day:day.date,generatedAt,lessons});
  }
  editions.sort((a,b)=>b.day.localeCompare(a.day));
  const lessons=practiceCatalog(catalog),refresh=practiceEditionRefresh({checked_at:stamp(checkedAt),latest_edition:editions[0]?.day||null,first_edition:editions.at(-1)?.day||null,latest_lesson_edition:lessons[0]?.day||null,edition_count:editions.length,lesson_count:lessons.length});
  return practicePayloadSize({app:'atlas-courier-editions',version:1,refresh,editions,catalog:lessons});
}

// Only this fixed public feed is requested. No private workspace fields, cookies,
// identity headers, arbitrary URLs, or redirected destinations leave the Worker.
export async function fetchEditions(fetcher=fetch){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);
  let reader;
  try{
    const r=await fetcher(COURIER_FEED,{headers:{Accept:'application/json'},redirect:'error',signal:controller.signal,cache:'no-store'});
    if(!r.ok)fail('Courier could not be reached. Try again later; your saved practice is unchanged.');
    if(!r.headers.get('content-type')?.toLowerCase().includes('application/json'))fail('Courier returned an unexpected response. Your saved practice is unchanged.');
    if(Number(r.headers.get('content-length'))>MAX_BYTES)fail('Courier’s feed is too large to refresh safely. Your saved practice is unchanged.');
    if(!r.body)fail('Courier returned an empty response.');
    reader=r.body.getReader();let size=0;const chunks=[];
    while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BYTES)fail('Courier’s feed is too large to refresh safely. Your saved practice is unchanged.');chunks.push(value);}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let parsed;try{parsed=JSON.parse(new TextDecoder().decode(bytes));}catch{fail('Courier’s feed could not be read. Your saved practice is unchanged.');}
    return publishedEditions(parsed);
  }catch(error){
    if(controller.signal.aborted)throw Error('Courier took too long to respond. Try again; your saved practice is unchanged.');
    if(error instanceof TypeError)throw Error('Courier is unavailable. Try again later; your saved practice is unchanged.');
    throw error;
  }finally{clearTimeout(timer);if(reader)await reader.cancel().catch(()=>{});}
}

export function editionRefreshPlan(current,published){
  const old=practiceCatalog(current?.catalog||[],current?.items||[]),known=new Set(old.map(l=>l.id)),incoming=new Set(published.catalog.map(l=>l.id));
  const rows=published.catalog.map(l=>({...l,action:known.has(l.id)?'Keep saved':'Add'}));
  const next=practicePayloadSize({catalog:practiceCatalog([...old,...published.catalog.filter(l=>!known.has(l.id))]),items:practiceItems(current?.items||[]),mode:current?.mode||'managed'});
  return {rows,next,added:rows.filter(l=>l.action==='Add').length,kept:rows.filter(l=>l.action==='Keep saved').length,retained:old.filter(l=>!incoming.has(l.id)).length};
}

export function editionSignature(published){
  const {checked_at,...refresh}=published.refresh;
  return {...published,refresh};
}
