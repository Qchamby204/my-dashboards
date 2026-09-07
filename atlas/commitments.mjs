import {APPS,validDate,monday} from './model.mjs';

export const COMMITMENT_STATUSES={open:'Open',done:'Completed',archived:'Archived',all:'All records'};
export const COMMITMENT_PLANS={all:'Any planning week',selected:'Selected week',unscheduled:'Unscheduled'};
export const COMMITMENT_SORTS={due:'Due date',updated:'Recently changed',title:'Title'};
const fold=value=>String(value??'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase();
export function commitmentList(data,week,{status='open',app='all',plan='all',query='',sort='due'}={}){
  if(!validDate(week)||monday(week)!==week)throw Error('Choose a valid planning week.');
  for(const [value,choices] of [[status,COMMITMENT_STATUSES],[plan,COMMITMENT_PLANS],[sort,COMMITMENT_SORTS]])if(typeof value!=='string'||!Object.hasOwn(choices,value))throw Error('Choose a supported commitment filter.');
  if(app!=='all'&&!APPS.some(a=>a.id===app)||typeof query!=='string'||query.length>200)throw Error('Choose an app and a search of up to 200 characters.');
  const projects=new Map((data.projects||[]).map(p=>[p.id,p.title])),apps=new Map(APPS.map(a=>[a.id,a.name])),terms=fold(query.trim()).split(/\s+/).filter(Boolean),tasks=data.tasks||[];
  const rows=tasks.filter(t=>(status==='all'||t.status===status)&&(app==='all'||t.app_id===app)&&(plan==='all'||(plan==='selected'?t.week_start===week:!t.week_start))&&terms.every(term=>fold(t.title+' '+(projects.get(t.project_id)||'')+' '+(apps.get(t.app_id)||'')).includes(term))).slice();
  rows.sort((a,b)=>(sort==='due'?(a.due_date||'9999-12-31').localeCompare(b.due_date||'9999-12-31'):sort==='updated'?(b.updated_at||'').localeCompare(a.updated_at||''):a.title.localeCompare(b.title))||a.title.localeCompare(b.title)||a.id.localeCompare(b.id));
  return {rows,total:rows.length,all:tasks.length,counts:Object.fromEntries(['open','done','archived'].map(status=>[status,tasks.filter(t=>t.status===status).length]))};
}
export function commitmentActions(task){return task.status==='archived'?[{action:'restore',label:task.completed_at?'Restore as completed':'Restore as open'}]:task.status==='done'?[{action:'reopen',label:'Reopen'},{action:'archive',label:'Archive'}]:[{action:'complete',label:'Complete'},{action:'archive',label:'Archive'}];}
