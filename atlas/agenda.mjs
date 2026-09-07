import {addDays,localDay,monday,validDate} from './model.mjs';
import {HERALD_STAGES} from './herald.mjs';

export const AGENDA_SOURCES={all:'All sources',tasks:'Commitments',projects:'Life Map',herald:'Content plan',practice:'Courier practice',communication:'Speaking practice',ledger:'Life Ledger'};
export const AGENDA_TYPES={all:'Plan & activity',plan:'Plans & deadlines',activity:'Recorded activity'};
export function weeklyAgenda(data,week,{source='all',type='all'}={}){
  if(!validDate(week)||monday(week)!==week)throw Error('Choose a week starting on Monday.');
  if(typeof source!=='string'||!Object.hasOwn(AGENDA_SOURCES,source)||typeof type!=='string'||!Object.hasOwn(AGENDA_TYPES,type))throw Error('Choose an agenda filter.');
  const through=addDays(week,6),entries=[];
  const inWeek=date=>validDate(date)&&date>=week&&date<=through;
  const completedDay=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?localDay(new Date(value)):null;
  function add(source,kind,id,title,date,type,label,detail=''){
    if(inWeek(date))entries.push({key:kind+':'+id+':'+type,source,kind,id,title,date,type,label,detail});
  }
  for(const t of data.tasks||[]){
    if(t.status==='archived')continue;
    if(t.status==='open')add('tasks','task',t.id,t.title,t.due_date,'plan','Commitment due',t.week_start===week?'In this week’s commitment plan':t.week_start?'Planned for the week of '+t.week_start:'Not assigned to a planning week');
    if(t.status==='done')add('tasks','task',t.id,t.title,completedDay(t.completed_at),'activity','Commitment completed');
  }
  for(const p of data.projects||[]){
    if(p.archived_at)continue;
    if(p.status==='open')add('projects','project',p.id,p.title,p.due_date,'plan','Project due',p.mode==='managed'?'Synced project':'Imported project snapshot');
    if(p.status==='done')add('projects','project',p.id,p.title,completedDay(p.completed_at),'activity','Project completed');
  }
  for(const c of data.herald?.items||[]){
    if(c.archived)continue;
    if(c.stage==='published')add('herald','content',c.id,c.title,c.published_day,'activity','Publication recorded','Date entered in your content plan');
    else add('herald','content',c.id,c.title,c.scheduled_day,'plan','Content planned',HERALD_STAGES[c.stage]||'');
  }
  // Dates from the practice transfer are already resolved to calendar days.
  for(const p of data.practice?.items||[])add('practice','lesson',p.id,p.title,p.completedDay,'activity','Practice completed',p.track||'');
  for(const r of data.communication?.reps||[])if(!r.archived)add('communication','speaking',r.id,r.topic,r.day,'activity','Speaking session recorded',r.drill||'');
  for(const d of data.ledger?.days||[])add('ledger','day',d.date,'Daily check-in',d.date,'activity','Ledger day saved',`${d.checked?.length||0} ${d.checked?.length===1?'check-in':'check-ins'}${d.note||d.tomorrow?' · Reflection saved':''}`);
  const filtered=entries.filter(e=>(source==='all'||e.source===source)&&(type==='all'||e.type===type));
  filtered.sort((a,b)=>a.date.localeCompare(b.date)||(a.type===b.type?0:a.type==='plan'?-1:1)||a.source.localeCompare(b.source)||a.title.localeCompare(b.title)||a.key.localeCompare(b.key));
  const planned=(data.tasks||[]).filter(t=>t.status==='open'&&t.week_start===week);
  return {week,through,source,type,total:filtered.length,planned:filtered.filter(e=>e.type==='plan').length,recorded:filtered.filter(e=>e.type==='activity').length,
    undatedCommitments:planned.filter(t=>!t.due_date).length,otherDateCommitments:planned.filter(t=>t.due_date&&!inWeek(t.due_date)).length,
    days:Array.from({length:7},(_,i)=>{const date=addDays(week,i);return {date,entries:filtered.filter(e=>e.date===date)};})};
}
