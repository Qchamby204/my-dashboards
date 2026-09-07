import {parseLifeMap,textValue,validDate} from './model.mjs';
import {heraldContent,heraldItem} from './herald.mjs';

const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
export const CONNECTED_APPS={'life-map':{name:'Life Map',key:'lifemap_v1'},herald:{name:'The Herald',key:'herald:v1'}};
export function validateAppState(kind,raw){
  if(!Object.hasOwn(CONNECTED_APPS,kind)||!object(raw))throw Error('Choose a supported app record.');
  const text=JSON.stringify(raw);
  if(new TextEncoder().encode(text).length>1500000)throw Error('This app exceeds 1.5 MB. Keep your original backup; no records were transferred.');
  const walk=(x,depth=0)=>{if(depth>30)throw Error('This app contains excessively nested records.');if(object(x)||Array.isArray(x))for(const [key,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(key))throw Error('This app contains an unsupported field.');if(['id','parentId'].includes(key)&&v!=null&&v!==''&&(typeof v!=='string'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(v)))throw Error('An app record ID is unsupported.');walk(v,depth+1);}};
  walk(raw);
  const state=JSON.parse(text);
  if(kind==='life-map'){
    parseLifeMap(state);
    if(!Array.isArray(state.chores)||!object(state.checks)||state.chores.length>2000)throw Error('Life Map chores or check-ins are invalid.');
    if(state.log!==undefined&&!Array.isArray(state.log)||state.planned!==undefined&&!object(state.planned))throw Error('Life Map activity is invalid.');
    state.log??=[];state.planned??={};
  }else{
    if(!Array.isArray(state.videos)||state.videos.length>1000||!object(state.cadence)||!Array.isArray(state.leads))throw Error('Choose a complete Herald backup.');
    if(state.leads.length)throw Error('This transfer includes legacy contact records. Use Connect existing apps to bring only content and publishing details.');
    const ids=new Set();
    for(const v of state.videos){
      const id=textValue(v?.id,200,true);if(ids.has(id))throw Error('The Herald has duplicate video IDs.');ids.add(id);
      textValue(v.title,500,true);
      if(!['draft','optimized','approved','produced','scheduled','published'].includes(v.status)||!['long','short'].includes(v.fmt))throw Error('A Herald stage or format is invalid.');
      if(v.sched&&!validDate(v.sched))throw Error('A Herald planned date is invalid.');
      if(v.opt!==undefined&&!object(v.opt)||v.pub!==undefined&&!object(v.pub))throw Error('A Herald checklist is invalid.');
    }
  }
  return state;
}
export function emptyAppState(kind){return kind==='life-map'?{projects:[],chores:[],checks:{},log:[],planned:{}}:{videos:[],cadence:{},weeks:{},leads:[],capture:[],roadmap:[],sys:{once:{},w:{},m:{}},goals:{leads:50,booked:20}};}
export function appStateRecord(r){
  if(!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.updated_at!=='string'||!Number.isFinite(Date.parse(r.updated_at)))throw Error('An app backup record is invalid.');
  return {id:textValue(r.id,80,true),kind:r.kind,state_json:JSON.stringify(validateAppState(r.kind,typeof r.state_json==='string'?JSON.parse(r.state_json):r.state_json)),revision:r.revision,updated_at:r.updated_at};
}
export function connectedState(kind,workspace,stored){
  const raw=stored?JSON.parse(stored.state_json):emptyAppState(kind);
  if(kind==='life-map'){
    const originals=new Map(raw.projects.map(p=>[p.id,p]));
    raw.projects=workspace.projects.filter(p=>!p.archived_at).map(p=>{
      const old=originals.get(p.source_id)||{};
      const next={sub:'',pri:'Med',notes:'',...old,id:p.source_id,task:p.title,area:p.area,due:p.due_date||'',status:p.status==='done'?'Done':old.status==='In progress'?'In progress':'Not started'};
      if(p.status==='done'&&p.completed_at)next.doneAt=p.completed_at.slice(0,10);else delete next.doneAt;
      return next;
    });
    // Project completion activity is derived from the same project status.
    raw.log=(raw.log||[]).filter(x=>x.t!=='proj');
    for(const p of raw.projects)if(p.status==='Done'&&p.doneAt)raw.log.push({t:'proj',id:p.id,d:p.doneAt});
  }else{
    const originals=new Map(raw.videos.map(v=>[v.id,v]));
    raw.videos=(workspace.herald[0]?.items||[]).filter(c=>!c.archived).map(c=>{
      const id=c.source_id||c.id,old=originals.get(id)||{};
      const opt=Object.fromEntries(['title','desc','thumb','broll','emph','tags','blog','cta'].map(k=>[k,{t:'',d:false,...old.opt?.[k]}]));
      return {script:'',metrics:{},pub:{},...old,id,title:c.title,fmt:c.format,vert:c.audience,status:c.stage,sched:c.scheduled_day||'',opt};
    });
  }
  return raw;
}
async function legacyId(id){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(id));return 'legacy:'+Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join('');}
export async function contentFromApp(raw,current,day){
  const known=new Map((current?.items||[]).map(c=>[c.source_id||c.id,c])),items=[];
  for(const v of raw.videos){
    const old=known.get(v.id),published=v.status==='published';
    items.push(heraldItem({id:old?.id||await legacyId(v.id),source_id:old?old.source_id:v.id,title:v.title,format:v.fmt,audience:v.vert||'',stage:v.status==='optimized'?'approved':v.status,scheduled_day:v.sched||null,
      published_day:published?(old?.stage==='published'?old.published_day:day):null,note:old?.note||'',archived:false}));
  }
  const included=new Set(items.map(x=>x.id));
  for(const old of current?.items||[])if(!included.has(old.id))items.push({...old,archived:true});
  return heraldContent({items});
}
export function retainAppDetails(kind,incoming,stored){
  const old=stored?JSON.parse(stored.state_json):emptyAppState(kind),key=kind==='life-map'?'projects':'videos',ids=new Set(incoming[key].map(r=>r.id));
  // Keep the details of archived records so restoring their canonical record
  // also restores the script or notes. They are hidden by connectedState.
  return validateAppState(kind,{...incoming,[key]:[...incoming[key],...old[key].filter(r=>!ids.has(r.id))]});
}
