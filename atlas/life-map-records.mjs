export function validateLifeMapRecords(input){
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  let raw=input;
  if(raw?.app==='atlas-connected-transfer')raw=raw.apps?.find(x=>x.kind==='life-map')?.state;
  if(!object(raw)||!Array.isArray(raw.projects))throw Error('Choose a Life Map backup.');
  const text=JSON.stringify(raw);if(new TextEncoder().encode(text).length>1500000)throw Error('Choose a Life Map backup smaller than 1.5 MB.');
  const walk=(x,depth=0)=>{if(depth>30)throw Error('This backup is too deeply nested.');if(object(x)||Array.isArray(x))for(const [k,v] of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))throw Error('This backup contains an unsupported field.');walk(v,depth+1);}};walk(raw);
  const copy=JSON.parse(text),out={projects:copy.projects,chores:copy.chores??[],checks:copy.checks??{},planned:copy.planned??{},log:copy.log??[]};
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&Number.isFinite(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  const id=x=>typeof x==='string'&&/^[a-zA-Z0-9:_-]{1,200}$/.test(x);
  const string=(x,max,required=false)=>typeof x==='string'&&x.length<=max&&(!required||!!x.trim());
  if(out.projects.length>1000||!Array.isArray(out.chores)||out.chores.length>2000||!object(out.checks)||!object(out.planned)||!Array.isArray(out.log)||out.log.length>10000)throw Error('This backup has invalid record lists.');
  for(const [kind,rows] of [['project',out.projects],['chore',out.chores]]){
    const seen=new Set();for(const r of rows){if(!object(r)||!id(r.id)||seen.has(r.id))throw Error('The backup contains invalid or duplicate '+kind+' IDs.');seen.add(r.id);
      if(!string(kind==='project'?r.task:r.chore,300,true)||!string(r.notes??'',20000))throw Error('A '+kind+' title or note is invalid.');
      if(kind==='project'){
        if(!string(r.area??'',120)||!string(r.sub??'',500)||!['Not started','In progress','Done'].includes(r.status)||r.pri&&!['High','Med','Low'].includes(r.pri))throw Error('A project has invalid details.');
        if(r.due&&!date(r.due)||r.doneAt&&!date(r.doneAt)||r.park&&(!/^\d{4}-\d{2}$/.test(r.park)||!date(r.park+'-01')))throw Error('A project date is invalid.');
      }else if(!['Daily','Weekly','Monthly','Quarterly','Annual'].includes(r.cad)||!string(r.zone??'',300)||!string(r.who??'',300))throw Error('A chore has invalid details.');
    }
  }
  if(Object.entries(out.checks).some(([k,v])=>!id(k)||!string(v,100))||Object.entries(out.planned).some(([k,v])=>!id(k)||!date(v))||out.log.some(x=>!object(x)||!id(x.id)||x.t!=='proj'||!date(x.d)))throw Error('The backup contains invalid activity records.');
  return out;
}
