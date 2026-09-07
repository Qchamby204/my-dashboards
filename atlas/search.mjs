import { APPS } from './model.mjs';
import { HERALD_STAGES, HERALD_FORMATS } from './herald.mjs';

export const SEARCH_SOURCES={all:'Everything',tasks:'Commitments',projects:'Life Map',practice:'Courier lessons',ledger:'Life Ledger',communication:'Speaking practice',herald:'Content plan',cadence:'Operations routines',weeks:'Weekly reviews'};
const fold=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function searchOptions(raw){
  if(!raw||typeof raw.query!=='string'||raw.query.length>160)throw Error('Search with up to 160 characters.');
  const query=raw.query.trim(),scope=raw.scope??'all',include_archived=raw.include_archived??false;
  if(query.length<2)throw Error('Enter at least two characters to search.');
  if(typeof scope!=='string'||!Object.hasOwn(SEARCH_SOURCES,scope)||typeof include_archived!=='boolean')throw Error('Choose a search source and archive option.');
  const tokens=[...new Set(fold(query).split(/\s+/).filter(Boolean))];
  if(!tokens.length||tokens.length>16)throw Error('Use between 1 and 16 search terms.');
  return {query,scope,include_archived,tokens};
}
function excerpt(parts,tokens){
  const part=parts.find(p=>tokens.some(t=>fold(p).includes(t)))||parts.find(Boolean)||'';
  const text=String(part).replace(/\s+/g,' ').trim(),normalized=fold(text);
  // Folding can change character positions. Use the original string for the
  // excerpt; its approximate position affects presentation, never matching.
  const positions=tokens.map(t=>normalized.indexOf(t)).filter(x=>x>=0),at=positions.length?Math.min(...positions):0,start=Math.max(0,at-55),end=start+180;
  return (start?'…':'')+text.slice(start,end)+(text.length>end?'…':'');
}
export function searchWorkspace(data,options){
  const o=searchOptions(options),found=[],counts=Object.fromEntries(Object.keys(SEARCH_SOURCES).filter(k=>k!=='all').map(k=>[k,0]));
  const app=id=>APPS.find(a=>a.id===id)?.name||'Atlas';
  function add(source,kind,id,title,parts=[],metadata='',archived=false){
    if(o.scope!=='all'&&o.scope!==source||archived&&!o.include_archived)return;
    const cleanParts=parts.filter(v=>typeof v==='string'&&v),heading=fold(title),body=fold(cleanParts.join(' ')),all=heading+' '+body+' '+fold(metadata);
    if(!o.tokens.every(t=>all.includes(t)))return;
    const exact=heading===fold(o.query),score=(exact?100:0)+o.tokens.reduce((n,t)=>n+(heading.startsWith(t)?12:heading.includes(t)?8:body.includes(t)?3:1),0)-(archived?1:0);
    found.push({kind,id,title,source,metadata,archived,snippet:excerpt(cleanParts,o.tokens),score});counts[source]++;
  }
  for(const t of data.tasks||[])add('tasks','task',t.id,t.title,[t.due_date,t.week_start],`${app(t.app_id)} · ${t.status==='done'?'Completed':t.status==='archived'?'Archived':'Open'}${t.due_date?' · Due '+t.due_date:''}`,t.status==='archived');
  for(const p of data.projects||[])add('projects','project',p.id,p.title,[p.area,p.due_date],`${p.mode==='managed'?'Synced project':'Imported project'} · ${p.status==='done'?'Completed':'Open'}${p.due_date?' · Due '+p.due_date:''}`,!!p.archived_at);
  for(const w of data.weeks||[])add('weeks','review',w.week_start,'Week of '+w.week_start,[w.worked,w.change], 'Weekly reflection');
  for(const r of data.cadence?.[0]?.routines||[])add('cadence','routine',r.id,r.title,[r.start_date],`${r.frequency} · ${r.paused?'Paused':'Active'} · ${r.minutes} min`);
  const practice=data.practice?.[0],completed=new Set((practice?.items||[]).map(x=>x.id));
  for(const l of practice?.catalog||[])add('practice','lesson',l.id,l.title,[l.task,l.drill,l.track,l.day],`${l.track||'Courier'} · ${l.day} · ${completed.has(l.id)?'Completed':'To practise'}`);
  const ledger=data.ledger?.[0];
  for(const h of ledger?.habits||[])add('ledger','habit',h.id,h.title,[],h.archived?'Archived habit':'Habit',h.archived);
  for(const d of ledger?.days||[])add('ledger','day',d.date,'Reflection · '+d.date,[d.note,d.tomorrow],`${d.checked.length} recorded check-ins`);
  for(const r of data.communication?.[0]?.reps||[])add('communication','speaking',r.id,r.topic,[r.note,r.drill,r.skill,r.day],`${r.day} · ${r.drill}${r.skill?' · '+r.skill:''}`,r.archived);
  for(const r of data.herald?.[0]?.items||[])add('herald','content',r.id,r.title,[r.note,r.audience,r.scheduled_day,r.published_day],`${HERALD_FORMATS[r.format]} · ${HERALD_STAGES[r.stage]}${r.stage==='published'?r.published_day?' · Recorded published '+r.published_day:' · Publication date not recorded':r.scheduled_day?' · Planned '+r.scheduled_day:''}`,r.archived);
  found.sort((a,b)=>b.score-a.score||a.title.localeCompare(b.title)||a.kind.localeCompare(b.kind)||a.id.localeCompare(b.id));
  return {query:o.query,scope:o.scope,include_archived:o.include_archived,total:found.length,counts,results:found.slice(0,40).map(({score,...r})=>r),truncated:found.length>40};
}
