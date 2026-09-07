import { textValue, dateValue, validDate } from '../atlas/model.mjs';
export function parseProjectUpdates(raw){
  const value=JSON.parse(raw);
  if(value?.app!=='atlas-project-updates'||value.version!==1||!Array.isArray(value.projects)||!value.projects.length||value.projects.length>1000)throw Error('Choose a project-updates file downloaded from synced Life Map.');
  const seen=new Set();
  return value.projects.map(p=>{
    const id=textValue(p?.id,200,true);if(seen.has(id))throw Error('The file repeats a project ID.');seen.add(id);
    if(!['open','done'].includes(p.status))throw Error('A project status is invalid.');
    return {id,title:textValue(p.title,300,true),area:textValue(p.area,120),due_date:dateValue(p.due_date),status:p.status};
  });
}
export function mergeProjectUpdates(current,updates,selected,day){
  if(!current||!Array.isArray(current.projects)||!validDate(day))throw Error('Local Life Map records could not be read.');
  const next=JSON.parse(JSON.stringify(current)),ids=new Set(selected),byId=new Map(next.projects.filter(p=>p&&typeof p==='object').map(p=>[p.id,p]));
  const unique=new Set();for(const p of next.projects){if(!p||typeof p.id!=='string'||unique.has(p.id))throw Error('Local project IDs need attention before importing.');unique.add(p.id);}
  if(next.log!==undefined&&!Array.isArray(next.log))throw Error('Local project history could not be read.');
  next.log=next.log||[];
  for(const update of updates){
    if(!ids.has(update.id))continue;
    let p=byId.get(update.id);if(!p){p={id:update.id,sub:'',pri:'Med',notes:'',park:'',status:'Not started'};next.projects.push(p);byId.set(p.id,p);}
    const wasDone=p.status==='Done';p.task=update.title;p.area=update.area;p.due=update.due_date||'';
    if(update.status==='done'){p.status='Done';if(!wasDone){p.doneAt=day;next.log.push({t:'proj',id:p.id,d:day});}}
    else if(wasDone){p.status='Not started';delete p.doneAt;next.log=next.log.filter(e=>!(e?.t==='proj'&&e.id===p.id));}
    // Preserve the more precise local open status, such as In progress.
  }
  return next;
}
