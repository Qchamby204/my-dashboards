import {cadenceRecord,cadenceContent,routine,cadenceImportPlan,missingOccurrences} from './cadence.mjs';
import {validDate,monday} from './model.mjs';
import {digest} from './recovery.mjs';

export const cadenceRow=row=>row?cadenceRecord({...row,routines:JSON.parse(row.routines)}):null;
export async function cadenceAPI({db,owner,path,method,b,now,HttpError}){
  const current=cadenceRow(await db.prepare('SELECT * FROM atlas_cadence WHERE owner=?').bind(owner).first());
  const revision=current?.revision||0;
  const conflict=()=>{throw new HttpError('Routines changed on another device. Keep your draft, then discard and reload before retrying.',409);};
  const check=()=>{if(!Number.isSafeInteger(b.revision)||b.revision!==revision)conflict();};
  let next=cadenceContent(current||{routines:[]}),imported=false;
  if(path==='/api/cadence/import/preview'&&method==='POST'){
    const plan=cadenceImportPlan(b.pack,current);return {pack:plan.pack,rows:plan.rows,added:plan.added,kept:plan.kept,revision,digest:await digest(plan.pack)};
  }
  if(path==='/api/cadence/plan'&&method==='POST'){
    check();if(!validDate(b.week)||monday(b.week)!==b.week)throw new HttpError('Choose a week starting Monday.');
    const tasks=(await db.prepare('SELECT routine_id,occurrence_date FROM atlas_tasks WHERE owner=? AND routine_id IS NOT NULL').bind(owner).all()).results;
    const missing=missingOccurrences(current,tasks,b.week);if(!missing.length)return {added:0};
    const guardID=crypto.randomUUID(),statements=[db.prepare('INSERT INTO atlas_restore_guards (id,valid) VALUES (?, (SELECT CASE WHEN revision=? THEN 1 ELSE 0 END FROM atlas_cadence WHERE owner=?))').bind(guardID,revision,owner)];
    for(const {routine:r,date} of missing){
      const id='occ-'+await digest({owner,routine:r.id,date});
      statements.push(db.prepare("INSERT INTO atlas_tasks (id,owner,title,app_id,project_id,week_start,due_date,minutes,status,created_at,updated_at,routine_id,occurrence_date) VALUES (?,?,?,'operations-cadence',NULL,?,?,?,'open',?,?,?,?) ON CONFLICT(owner,routine_id,occurrence_date) DO NOTHING").bind(id,owner,r.title,b.week,date,r.minutes,now,now,r.id,date));
    }
    statements.push(db.prepare('DELETE FROM atlas_restore_guards WHERE id=?').bind(guardID));
    const result=await db.batch(statements);return {added:result.slice(1,-1).reduce((n,r)=>n+(r.meta?.changes||0),0)};
  }
  if(path==='/api/cadence/import'&&method==='POST'){
    check();const plan=cadenceImportPlan(b.pack,current);if(b.digest!==await digest(plan.pack))throw new HttpError('Review this import again.',409);
    if(!plan.added)return {saved:true};next=plan.next;imported=true;
  }else if(path==='/api/cadence/routine'&&method==='POST'){
    const r=routine({...b.routine,source_id:null});const existing=next.routines.find(x=>x.id===r.id);
    if(existing){if(JSON.stringify(existing)===JSON.stringify(r))return {saved:true};throw new HttpError('This routine is already saved with different details. Reload it before editing.',409);}
    check();next.routines.push(r);
  }else if(path==='/api/cadence/routine'&&method==='PATCH'){
    check();const index=next.routines.findIndex(r=>r.id===b.id);if(index<0)throw new HttpError('That routine is unavailable.',404);
    const previous=next.routines[index];
    if(b.action==='pause')next.routines[index]={...previous,paused:true};
    else if(b.action==='resume'){
      if(!validDate(b.day))throw new HttpError('Choose a valid resume date.');
      next.routines[index]={...previous,paused:false,start_date:previous.start_date>b.day?previous.start_date:b.day};
    }else if(b.action==='edit'){
      const r=routine({...b.routine,id:previous.id,source_id:previous.source_id,paused:previous.paused});
      const used=await db.prepare('SELECT id FROM atlas_tasks WHERE owner=? AND routine_id=? LIMIT 1').bind(owner,previous.id).first();
      if((!previous.paused||used)&&(r.frequency!==previous.frequency||r.day!==previous.day||r.start_date!==previous.start_date))throw new HttpError('This routine already has dated commitments. Pause it and create a new routine to change its schedule.');
      next.routines[index]=r;
    }else throw new HttpError('Choose a routine action.');
  }else if(!imported)throw new HttpError('This routine action is unavailable.',404);
  const routines=JSON.stringify(cadenceContent(next).routines);
  if(current){const r=await db.prepare('UPDATE atlas_cadence SET routines=?,revision=revision+1,updated_at=?,imported_at=? WHERE owner=? AND revision=?').bind(routines,now,imported?now:current.imported_at,owner,revision).run();if(!r.meta.changes)conflict();}
  else await db.prepare('INSERT INTO atlas_cadence (owner,routines,updated_at,imported_at) VALUES (?,?,?,?)').bind(owner,routines,now,imported?now:null).run();
  return {saved:true};
}
