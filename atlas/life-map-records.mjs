export function validateLifeMapRecords(input){
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  let raw=input;
  if(raw?.app==='atlas-connected-transfer')raw=raw.apps?.find(x=>x.kind==='life-map')?.state;
  if(!object(raw)||!Array.isArray(raw.projects))throw Error('Choose a Life Map backup.');
  const text=JSON.stringify(raw);if(new TextEncoder().encode(text).length>1500000)throw Error('Choose a Life Map backup smaller than 1.5 MB.');
  const walk=(x,depth=0)=>{if(depth>30)throw Error('This backup is too deeply nested.');if(object(x)||Array.isArray(x))for(const [k,v] of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))throw Error('This backup contains an unsupported field.');walk(v,depth+1);}};walk(raw);
  const copy=JSON.parse(text),out={...copy,projects:copy.projects,chores:copy.chores??[],checks:copy.checks??{},planned:copy.planned??{},log:copy.log??[]};
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,200}$/.test(x);
  const string=(x,max,required=false)=>typeof x==='string'&&x.length<=max&&(!required||!!x.trim());
  if(out.projects.length>1000||!Array.isArray(out.chores)||out.chores.length>2000||!object(out.checks)||!object(out.planned)||!Array.isArray(out.log)||out.log.length>10000)throw Error('This backup has invalid record lists.');
  for(const [kind,rows] of [['project',out.projects],['chore',out.chores]]){
    const seen=new Set();for(const r of rows){if(!object(r)||!id(r.id)||seen.has(r.id))throw Error('The backup contains invalid or duplicate '+kind+' IDs.');seen.add(r.id);
      if(!string(kind==='project'?r.task:r.chore,300,true)||!string(r.notes??'',20000))throw Error('A '+kind+' title or note is invalid.');
      if(kind==='project'){
        if(!string(r.area??'',120)||!string(r.sub??'',500)||!['Not started','In progress','Waiting','Done'].includes(r.status)||r.pri&&!['High','Med','Low'].includes(r.pri))throw Error('A project has invalid details.');
        if(r.due&&!date(r.due)||r.doneAt&&!date(r.doneAt)||r.park&&(!/^\d{4}-\d{2}$/.test(r.park)||!date(r.park+'-01')))throw Error('A project date is invalid.');
      }else if(!['Daily','Weekly','Monthly','Quarterly','Annual'].includes(r.cad)||!string(r.zone??'',300)||!string(r.who??'',300))throw Error('A chore has invalid details.');
    }
  }
  // Workflow fields are optional: existing records open without rewriting or seeding.
  const flag=(r,k)=>r[k]===undefined||typeof r[k]==='boolean';
  const optionalDates=(r,fields)=>fields.every(k=>r[k]==null||r[k]===''||date(r[k]));
  const link=x=>{try{return typeof x==='string'&&x.length<=3000&&['http:','https:'].includes(new URL(x).protocol);}catch{return false;}};
  const checklist=x=>x===undefined||Array.isArray(x)&&x.length<=100&&new Set(x.map(c=>c.id)).size===x.length&&x.every(c=>object(c)&&id(c.id)&&string(c.text,500,true)&&typeof c.done==='boolean');
  for(const p of out.projects){
    if(p.effortMinutes!==undefined&&(!Number.isInteger(p.effortMinutes)||p.effortMinutes<1||p.effortMinutes>10080))throw Error('A task has an invalid effort estimate.');
    if(!optionalDates(p,['plan','planWeek','showAfter','followUp','createdAt','updatedAt'])||!['inbox','someday','archived'].every(k=>flag(p,k))||!string(p.waitingFor??'',300)||p.parentId&&!id(p.parentId)||!checklist(p.checklist))throw Error('A task has invalid planning or checklist details.');
    if(p.tags!==undefined&&(!Array.isArray(p.tags)||p.tags.length>10||p.tags.some(t=>!string(t,40,true))))throw Error('Use up to ten short context tags.');
    if(p.links!==undefined&&(!Array.isArray(p.links)||p.links.length>10||p.links.some(x=>!link(x))))throw Error('Task links must start with https:// or http://.');
  }
  if(out.groups!==undefined){
    if(!Array.isArray(out.groups)||out.groups.length>500)throw Error('Choose up to 500 projects.');
    const ids=new Set();for(const g of out.groups){if(!object(g)||!id(g.id)||ids.has(g.id)||!string(g.title,300,true)||!string(g.area??'',120)||!string(g.notes??'',20000)||!flag(g,'archived'))throw Error('A project group is invalid.');ids.add(g.id);}
  }
  const groupIds=new Set((out.groups||[]).map(g=>g.id));
  if(out.projects.some(p=>p.parentId&&!groupIds.has(p.parentId)))throw Error('A task refers to a missing project.');
  for(const c of out.chores){
    if(!flag(c,'archived')||!optionalDates(c,['nextDue']))throw Error('A chore schedule is invalid.');
    if(c.repeat!==undefined&&c.repeat!==null){const r=c.repeat;if(!object(r)||!['fixed','after'].includes(r.mode)||!['day','week','month','year'].includes(r.unit)||!Number.isInteger(r.every)||r.every<1||r.every>365||!date(r.anchor))throw Error('Choose a valid repeat schedule and start date.');}
  }
  if(out.choreHistory!==undefined){
    if(!Array.isArray(out.choreHistory)||out.choreHistory.length>10000)throw Error('Chore history exceeds 10,000 entries. Export an archive first.');
    const ids=new Set();for(const h of out.choreHistory){if(!object(h)||!id(h.id)||ids.has(h.id)||!id(h.choreId)||!date(h.date)||!string(h.occurrence,120,true)||!['done','skipped'].includes(h.status))throw Error('A chore history entry is invalid.');ids.add(h.id);}
  }
  if(out.templates!==undefined){
    if(!Array.isArray(out.templates)||out.templates.length>50)throw Error('Keep up to 50 project templates.');
    const ids=new Set();for(const t of out.templates){if(!object(t)||!id(t.id)||ids.has(t.id)||!string(t.title,300,true)||!string(t.area??'',120)||!string(t.notes??'',20000)||!Array.isArray(t.tasks)||t.tasks.length>100)throw Error('A project template is invalid.');ids.add(t.id);for(const p of t.tasks){if(!object(p)||!string(p.task,300,true)||!string(p.notes??'',20000)||p.pri&&!['High','Med','Low'].includes(p.pri)||p.tags&&(!Array.isArray(p.tags)||p.tags.length>10||p.tags.some(x=>!string(x,40,true)))||p.links&&(!Array.isArray(p.links)||p.links.length>10||p.links.some(x=>!link(x)))||p.checklist&&(!Array.isArray(p.checklist)||p.checklist.length>100||p.checklist.some(x=>!object(x)||!string(x.text,500,true))))throw Error('A template task is invalid.');}}
  }
  if(out.preferences!==undefined){const p=out.preferences;if(!object(p)||p.hideEmpty!==undefined&&typeof p.hideEmpty!=='boolean'||p.areaOrder!==undefined&&(!Array.isArray(p.areaOrder)||p.areaOrder.length>100||p.areaOrder.some(x=>!string(x,120,true))))throw Error('Area display settings are invalid.');}
  if(Object.entries(out.checks).some(([k,v])=>!id(k)||!string(v,100))||Object.entries(out.planned).some(([k,v])=>!id(k)||!date(v))||out.log.some(x=>!object(x)||!id(x.id)||x.t!=='proj'||!date(x.d)))throw Error('The backup contains invalid activity records.');
  return out;
}
