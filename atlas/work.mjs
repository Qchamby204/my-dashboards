import {addDays,monday,localDay} from './model.mjs';
import {HERALD_STAGES} from './herald.mjs';

export function workItems(data,day){
  const selected=new Map((data.priorities||[]).filter(p=>p.day===day).map(p=>[p.kind+':'+p.record_id,p]));
  const item=(kind,r,values)=>{const choice=selected.get(kind+':'+r.id);return {key:kind+':'+r.id,kind,id:r.id,record:r,focus:choice||null,...values};};
  return [
    ...(data.tasks||[]).filter(t=>t.status!=='archived').map(t=>item('task',t,{title:t.title,due:t.due_date,done:t.status==='done',completed:t.completed_at?localDay(new Date(t.completed_at)):null,source:t.routine_id?'Repeating obligation':'Commitment',detail:t.routine_id?'Generated from your saved routine':'',href:null,focus:t.focus_date===day?{slot:t.focus_slot}:null})),
    ...(data.projects||[]).filter(p=>!p.archived_at).map(p=>item('project',p,{title:p.title,due:p.due_date,done:p.status==='done',completed:p.completed_at?localDay(new Date(p.completed_at)):null,source:'Life Map',detail:p.area,href:'/apps/life-map?record='+encodeURIComponent(p.source_id)})),
    ...(data.herald?.items||[]).filter(c=>!c.archived).map(c=>item('content',c,{title:c.title,due:c.scheduled_day,done:c.stage==='published',completed:c.published_day,source:'The Herald',detail:HERALD_STAGES[c.stage],href:'/apps/herald?record='+encodeURIComponent(c.source_id||c.id)})),
  ];
}
export function workHome(data,day,{source='all',query=''}={}){
  const all=workItems(data,day),through=addDays(monday(day),6),active=all.filter(x=>!x.done);
  const byDate=(a,b)=>(a.due||'9999').localeCompare(b.due||'9999')||a.title.localeCompare(b.title)||a.key.localeCompare(b.key);
  const priorities=active.filter(x=>x.focus).sort((a,b)=>a.focus.slot-b.focus.slot);
  const match=x=>(source==='all'||x.kind===source)&&(!query||[x.title,x.source,x.detail].join(' ').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const waiting=active.filter(x=>!x.focus&&match(x)).sort(byDate);
  return {priorities,waiting,overdue:active.filter(x=>x.due&&x.due<day).sort(byDate),dueToday:active.filter(x=>x.due===day).sort(byDate),
    dueWeek:active.filter(x=>x.due&&x.due>day&&x.due<=through).sort(byDate),completed:all.filter(x=>x.done&&x.completed===day),
    next:priorities[0]||active.filter(x=>x.due&&x.due<=through).sort(byDate)[0]||null,through,total:active.length};
}
