import {workspace,guard,digest} from './recovery.mjs';
import {parseLifeMap,validDate} from './model.mjs';
import {heraldContent} from './herald.mjs';
import {CONNECTED_APPS,validateAppState,connectedState,contentFromApp,retainAppDetails} from './connected-model.mjs';

const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const appRecord=(data,kind)=>data.app_states.find(r=>r.kind===kind);
const versionParts=(data,kind)=>({app:data.app_states.filter(r=>r.kind===kind).map(r=>({id:r.id,revision:r.revision})),records:kind==='life-map'?data.projects.map(r=>({id:r.id,revision:r.revision})).sort((a,b)=>a.id.localeCompare(b.id)):data.herald.map(r=>({revision:r.revision}))});
function saveAppStatement(db,owner,kind,state,stored,now){
  return db.prepare('INSERT INTO atlas_app_states (id,owner,kind,state_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner,kind) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at,revision=atlas_app_states.revision+1')
    .bind(stored?.id||crypto.randomUUID(),owner,kind,JSON.stringify(state),now);
}
function projectStatements(db,owner,raw,current,now,{importing=false}={}){
  const previous=new Map(current.map(p=>[p.source_id,p])),incoming=parseLifeMap(raw),seen=new Set(incoming.map(p=>p.source_id)),updates=[];
  for(const row of incoming){
    const old=previous.get(row.source_id);
    if(importing&&old)continue;
    const rawProject=raw.projects.find(p=>p.id===row.source_id);
    const completed=row.status==='done'?(old?.status==='done'?old.completed_at:validDate(rawProject.doneAt)?rawProject.doneAt+'T12:00:00.000Z':importing?null:now):null;
    const p={id:old?.id||crypto.randomUUID(),...row,mode:'managed',completed_at:completed,archived_at:null,imported_at:old?.imported_at||now,revision:(old?.revision||0)+1,updated_at:now};
    if(!old||['title','area','status','due_date','mode','completed_at','archived_at'].some(k=>p[k]!==old[k]))updates.push(p);
  }
  if(!importing)for(const old of current)if(!old.archived_at&&!seen.has(old.source_id))updates.push({...old,archived_at:now,revision:old.revision+1,updated_at:now});
  if(!updates.length)return [];
  return [db.prepare(`INSERT INTO atlas_projects (id,owner,source_id,title,area,status,due_date,mode,completed_at,archived_at,imported_at,revision,updated_at)
    SELECT json_extract(value,'$.id'),?,json_extract(value,'$.source_id'),json_extract(value,'$.title'),json_extract(value,'$.area'),json_extract(value,'$.status'),json_extract(value,'$.due_date'),json_extract(value,'$.mode'),json_extract(value,'$.completed_at'),json_extract(value,'$.archived_at'),json_extract(value,'$.imported_at'),json_extract(value,'$.revision'),json_extract(value,'$.updated_at') FROM json_each(?) WHERE 1
    ON CONFLICT(id) DO UPDATE SET title=excluded.title,area=excluded.area,status=excluded.status,due_date=excluded.due_date,mode=excluded.mode,completed_at=excluded.completed_at,archived_at=excluded.archived_at,revision=excluded.revision,updated_at=excluded.updated_at WHERE atlas_projects.owner=excluded.owner`).bind(owner,JSON.stringify(updates))];
}
function heraldStatement(db,owner,next,current,now){
  if(current&&same(current.items,next.items))return [];
  return [db.prepare('INSERT INTO atlas_herald (owner,items,updated_at) VALUES (?,?,?) ON CONFLICT(owner) DO UPDATE SET items=excluded.items,updated_at=excluded.updated_at,revision=atlas_herald.revision+1').bind(owner,JSON.stringify(next.items),now)];
}
async function importPlan(pack,data){
  if(pack?.app!=='atlas-connected-transfer'||pack.version!==1||!Array.isArray(pack.apps)||!pack.apps.length||pack.apps.length>2)throw Error('Choose the Life Map and Herald transfer from the original apps.');
  const seen=new Set(),apps=[],rows=[];
  for(const a of pack.apps){
    if(seen.has(a.kind))throw Error('An app is repeated in this transfer.');seen.add(a.kind);
    const state=validateAppState(a.kind,a.state),stored=appRecord(data,a.kind);
    const list=a.kind==='life-map'?state.projects:state.videos,known=new Set(a.kind==='life-map'?data.projects.map(p=>p.source_id):(data.herald[0]?.items||[]).map(c=>c.source_id||c.id));
    rows.push({kind:a.kind,name:CONNECTED_APPS[a.kind].name,connected:!!stored,added:stored?0:list.filter(r=>!known.has(r.id)).length,kept:list.filter(r=>known.has(r.id)).length,titles:list.slice(0,20).map(r=>r.task||r.title)});
    apps.push({kind:a.kind,state});
  }
  return {pack:{app:'atlas-connected-transfer',version:1,apps},rows};
}
export async function connectedAPI({db,owner,path,method,b,now,HttpError}){
  const current=await workspace(db,owner),data=current.data;
  if(path==='/api/connected/import/preview'&&method==='POST'){
    const plan=await importPlan(b.pack,data);return {...plan,seq:current.seq,digest:await digest(plan.pack)};
  }
  if(path==='/api/connected/import'&&method==='POST'){
    const plan=await importPlan(b.pack,data);
    if(b.seq!==current.seq||b.digest!==await digest(plan.pack))throw new HttpError('Saved work changed. Review this transfer again before connecting.',409);
    const token=crypto.randomUUID(),statements=[guard(db,owner,current.seq,token)];
    for(const a of plan.pack.apps){
      if(appRecord(data,a.kind))continue;
      if(a.kind==='life-map')statements.push(...projectStatements(db,owner,a.state,data.projects,now,{importing:true}));
      else{
        const imported=await contentFromApp(a.state,null,null),previous=data.herald[0],known=new Set((previous?.items||[]).map(c=>c.id));
        const next=heraldContent({items:[...(previous?.items||[]),...imported.items.filter(c=>!known.has(c.id))]});
        statements.push(...heraldStatement(db,owner,next,previous,now));
      }
      statements.push(saveAppStatement(db,owner,a.kind,a.state,null,now));
    }
    statements.push(db.prepare('DELETE FROM atlas_restore_guards WHERE id=?').bind(token));
    await db.batch(statements);return {saved:true,rows:plan.rows};
  }
  const kind=path.slice('/api/connected/'.length);
  if(!Object.hasOwn(CONNECTED_APPS,kind))throw new HttpError('This connected app is unavailable.',404);
  const stored=appRecord(data,kind);
  if(method==='GET')return {state:connectedState(kind,data,stored),version:await digest(versionParts(data,kind)),connected:!!stored};
  if(method!=='PUT')throw new HttpError('This app action is unavailable.',404);
  if(b.version!==await digest(versionParts(data,kind)))throw new HttpError('This app changed in Atlas or another tab. Your draft is kept. Reload saved work before editing again.',409);
  if(!validDate(b.day))throw new HttpError('Choose a valid save day.');
  const raw=validateAppState(kind,b.state),token=crypto.randomUUID(),statements=[guard(db,owner,current.seq,token)];
  if(kind==='life-map')statements.push(...projectStatements(db,owner,raw,data.projects,now));
  else statements.push(...heraldStatement(db,owner,await contentFromApp(raw,data.herald[0],b.day),data.herald[0],now));
  statements.push(saveAppStatement(db,owner,kind,retainAppDetails(kind,raw,stored),stored,now));
  statements.push(db.prepare('DELETE FROM atlas_restore_guards WHERE id=?').bind(token));
  statements.push(db.prepare('SELECT id,revision FROM atlas_app_states WHERE owner=? AND kind=?').bind(owner,kind));
  statements.push(kind==='life-map'?db.prepare('SELECT id,revision FROM atlas_projects WHERE owner=? ORDER BY id').bind(owner):db.prepare('SELECT revision FROM atlas_herald WHERE owner=?').bind(owner));
  const results=await db.batch(statements);
  // Return the generation observed inside this save, never a later GET's
  // generation that could accidentally authorize overwriting another edit.
  const records=results.at(-1).results;if(kind==='life-map')records.sort((a,b)=>a.id.localeCompare(b.id));
  return {saved:true,version:await digest({app:results.at(-2).results,records})};
}
