import {validDate,textValue} from './model.mjs';
export async function occupiedSlots(db,owner,day){
  return (await db.prepare('SELECT focus_slot AS slot FROM atlas_tasks WHERE owner=? AND focus_date=? UNION ALL SELECT slot FROM atlas_priorities WHERE owner=? AND day=?').bind(owner,day,owner,day).all()).results;
}
export async function priorityAPI({db,owner,b,now,HttpError}){
  if(!['project','content'].includes(b.kind)||!['choose','release'].includes(b.action)||!validDate(b.day))throw new HttpError('Choose a saved item and a valid priority day.');
  const id=textValue(b.id,200,true);
  if(b.action==='release'){
    await db.prepare('DELETE FROM atlas_priorities WHERE owner=? AND kind=? AND record_id=? AND day=?').bind(owner,b.kind,id,b.day).run();
    return {saved:true};
  }
  const existing=await db.prepare('SELECT * FROM atlas_priorities WHERE owner=? AND kind=? AND record_id=?').bind(owner,b.kind,id).first();
  if(existing?.day===b.day)return {saved:true};
  let project=null;
  if(b.kind==='project'){
    project=await db.prepare('SELECT * FROM atlas_projects WHERE owner=? AND id=?').bind(owner,id).first();
    if(!project||project.archived_at||project.status!=='open')throw new HttpError('This project is no longer open. Refresh Home.',409);
    if(project.revision!==b.revision)throw new HttpError('This project changed. Refresh Home before choosing it.',409);
  }else{
    const row=await db.prepare('SELECT items,revision FROM atlas_herald WHERE owner=?').bind(owner).first();
    const content=row&&JSON.parse(row.items).find(x=>x.id===id);
    if(!content||content.archived||content.stage==='published')throw new HttpError('This content item is no longer open. Refresh Home.',409);
    if(row.revision!==b.revision)throw new HttpError('Your content changed. Refresh Home before choosing it.',409);
  }
  const occupied=await occupiedSlots(db,owner,b.day),slot=[1,2,3].find(n=>!occupied.some(p=>p.slot===n));
  if(!slot)throw new HttpError('Three priorities are already chosen. Release one before choosing another.',409);
  const statements=[];
  // Selecting a snapshot makes this saved project authoritative. The full Life
  // Map reads this same record; subsequent snapshot imports cannot overwrite it.
  if(project?.mode==='snapshot')statements.push(db.prepare("UPDATE atlas_projects SET mode='managed',revision=revision+1,updated_at=? WHERE owner=? AND id=? AND revision=?").bind(now,owner,id,project.revision));
  statements.push(db.prepare('INSERT INTO atlas_priorities (id,owner,kind,record_id,day,slot,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(owner,kind,record_id) DO UPDATE SET day=excluded.day,slot=excluded.slot,revision=atlas_priorities.revision+1,updated_at=excluded.updated_at').bind(existing?.id||crypto.randomUUID(),owner,b.kind,id,b.day,slot,now));
  await db.batch(statements);
  return {saved:true};
}
