import { searchOptions, searchWorkspace } from './search.mjs';
import { heraldContent, heraldRecord, heraldItem, parseHeraldTransfer, heraldImportPlan } from './herald.mjs';
import { communicationContent, communicationRecord, communicationRep, parseCommunicationTransfer, communicationImportPlan } from './communication.mjs';
import { fetchEditions, editionRefreshPlan, editionSignature } from './courier-editions.mjs';
import { html, css, js, theme, searchModel, searchUI, model, ledgerModel, ledgerUI, editionUI, reflectionUI, communicationModel, communicationUI, heraldModel, heraldUI } from './assets.mjs';
import { validDate, monday, textValue, dateValue, appValue, minutesValue, practiceItems, practiceCatalog, practicePayloadSize, parsePracticeTransfer, practiceImportPlan, practiceEditionRefresh } from './model.mjs';
import { ledgerContent, ledgerRecord, parseLedgerTransfer, ledgerImportPlan } from './ledger.mjs';
import { workspace, parseWorkspace, digest, changes, replaceWorkspace, checkpointData, guard, TABLES } from './recovery.mjs';

const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin' };
function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}}); }
class HttpError extends Error { constructor(message,status=400){super(message);this.status=status;} }
async function bodyOf(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError('Send JSON.');
  const body=await request.text(),path=new URL(request.url).pathname;
  if(new TextEncoder().encode(body).length>(path.startsWith('/api/restore')?8500000:(path.startsWith('/api/practice')||path.startsWith('/api/ledger')||path.startsWith('/api/communication')||path.startsWith('/api/herald'))?1800000:350000)) throw new HttpError('This request is too large.',413);
  try { const value=JSON.parse(body); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new HttpError('This request could not be read.'); }
}
async function ownedProject(db,owner,id) {
  if(!id) return null;
  const row=await db.prepare('SELECT id FROM atlas_projects WHERE id=? AND owner=?').bind(id,owner).first();
  if(!row) throw new HttpError('That project is unavailable.',404); return row.id;
}
function practiceRow(row){
  if(!row)return null;
  const items=practiceItems(JSON.parse(row.items));
  return {items,catalog:practiceCatalog(JSON.parse(row.catalog||'[]'),items),mode:row.mode||'snapshot',revision:row.revision,
    imported_at:row.imported_at,source_exported_at:row.source_exported_at,updated_at:row.updated_at||null,edition_refresh:practiceEditionRefresh(row.edition_refresh?JSON.parse(row.edition_refresh):null)};
}
async function currentPractice(db,owner){return practiceRow(await db.prepare('SELECT * FROM atlas_practice_snapshots WHERE owner=?').bind(owner).first());}
function ledgerRow(row){return row?ledgerRecord({...row,habits:JSON.parse(row.habits),days:JSON.parse(row.days)}):null;}
async function currentLedger(db,owner){return ledgerRow(await db.prepare('SELECT * FROM atlas_ledger WHERE owner=?').bind(owner).first());}
function communicationRow(row){return row?communicationRecord({...row,reps:JSON.parse(row.reps)}):null;}
async function currentCommunication(db,owner){return communicationRow(await db.prepare('SELECT * FROM atlas_communication WHERE owner=?').bind(owner).first());}
async function writeCommunication(db,owner,current,next,now,source=undefined){
  const reps=JSON.stringify(communicationContent(next).reps),imported=source!==undefined;
  if(current){
    const r=await db.prepare('UPDATE atlas_communication SET reps=?,revision=revision+1,updated_at=?,imported_at=?,source_exported_at=? WHERE owner=? AND revision=?')
      .bind(reps,now,imported?now:current.imported_at,imported?source:current.source_exported_at,owner,current.revision).run();
    if(!r.meta.changes)throw new HttpError('Speaking practice changed on another device. Keep your draft, then reload before trying again.',409);
  }else{
    try{await db.prepare('INSERT INTO atlas_communication (owner,reps,updated_at,imported_at,source_exported_at) VALUES (?,?,?,?,?)').bind(owner,reps,now,imported?now:null,source??null).run();}
    catch(e){if(String(e.message).includes('UNIQUE'))throw new HttpError('Speaking practice was saved on another device. Reload before trying again.',409);throw e;}
  }
}
function heraldRow(row){return row?heraldRecord({...row,items:JSON.parse(row.items)}):null;}
async function currentHerald(db,owner){return heraldRow(await db.prepare('SELECT * FROM atlas_herald WHERE owner=?').bind(owner).first());}
async function writeHerald(db,owner,current,next,now,source=undefined){
  const items=JSON.stringify(heraldContent(next).items),imported=source!==undefined;
  if(current){
    const r=await db.prepare('UPDATE atlas_herald SET items=?,revision=revision+1,updated_at=?,imported_at=?,source_exported_at=? WHERE owner=? AND revision=?')
      .bind(items,now,imported?now:current.imported_at,imported?source:current.source_exported_at,owner,current.revision).run();
    if(!r.meta.changes)throw new HttpError('Content planning changed on another device. Keep your draft, then reload before trying again.',409);
  }else{
    try{await db.prepare('INSERT INTO atlas_herald (owner,items,updated_at,imported_at,source_exported_at) VALUES (?,?,?,?,?)').bind(owner,items,now,imported?now:null,source??null).run();}
    catch(e){if(String(e.message).includes('UNIQUE'))throw new HttpError('Content planning was saved on another device. Reload before trying again.',409);throw e;}
  }
}
async function writeLedger(db,owner,current,next,now,source=undefined){
  const content=ledgerContent(next),habits=JSON.stringify(content.habits),days=JSON.stringify(content.days);
  const imported=source!==undefined;
  if(current){
    const result=await db.prepare('UPDATE atlas_ledger SET habits=?,days=?,updated_at=?,imported_at=?,source_exported_at=?,revision=revision+1 WHERE owner=? AND revision=?')
      .bind(habits,days,now,imported?now:current.imported_at,imported?source:current.source_exported_at,owner,current.revision).run();
    if(!result.meta.changes)throw new HttpError('Life Ledger changed on another device. Keep a copy of your draft, then reload the saved day before trying again.',409);
  }else{
    try{await db.prepare('INSERT INTO atlas_ledger (owner,habits,days,updated_at,imported_at,source_exported_at) VALUES (?,?,?,?,?,?)').bind(owner,habits,days,now,imported?now:null,imported?source:null).run();}
    catch(error){if(String(error.message).includes('UNIQUE'))throw new HttpError('Life Ledger was created on another device. Reload before trying again.',409);throw error;}
  }
}
async function writePractice(db,owner,current,next,now,imported=false){
  practicePayloadSize(next);
  const items=JSON.stringify(next.items),catalog=JSON.stringify(next.catalog);
  const refresh=Object.hasOwn(next,'edition_refresh')?practiceEditionRefresh(next.edition_refresh):imported&&next.mode==='snapshot'?null:current?.edition_refresh||null;
  const editionRefresh=refresh?JSON.stringify(refresh):null;
  if(current){
    const result=await db.prepare('UPDATE atlas_practice_snapshots SET items=?,catalog=?,mode=?,imported_at=?,source_exported_at=?,updated_at=?,edition_refresh=?,revision=revision+1 WHERE owner=? AND revision=?')
      .bind(items,catalog,next.mode,imported?now:current.imported_at,imported?next.source_exported_at:current.source_exported_at,now,editionRefresh,owner,current.revision).run();
    if(!result.meta.changes)throw new HttpError('Practice changed on another device. Refresh and review before trying again.',409);
  }else{
    try{await db.prepare('INSERT INTO atlas_practice_snapshots (owner,items,catalog,mode,imported_at,source_exported_at,updated_at,edition_refresh) VALUES (?,?,?,?,?,?,?,?)').bind(owner,items,catalog,next.mode,now,next.source_exported_at??null,now,editionRefresh).run();}
    catch(error){if(String(error.message).includes('UNIQUE'))throw new HttpError('Practice was created on another device. Refresh before trying again.',409);throw error;}
  }
}
async function state(db,owner,week) {
  const result=await db.batch([
    db.prepare("SELECT * FROM atlas_tasks WHERE owner=? ORDER BY created_at DESC").bind(owner),
    db.prepare('SELECT * FROM atlas_projects WHERE owner=? ORDER BY title').bind(owner),
    db.prepare('SELECT * FROM atlas_weeks WHERE owner=? AND week_start=?').bind(owner,week),
    db.prepare('SELECT * FROM atlas_practice_snapshots WHERE owner=?').bind(owner),
    db.prepare('SELECT * FROM atlas_ledger WHERE owner=?').bind(owner),
    db.prepare('SELECT * FROM atlas_communication WHERE owner=?').bind(owner),
    db.prepare('SELECT * FROM atlas_herald WHERE owner=?').bind(owner)
  ]);
  const practice=result[3].results[0];
  return { tasks:result[0].results, projects:result[1].results, week:result[2].results[0]||null,
    practice:practiceRow(practice),ledger:ledgerRow(result[4].results[0]),communication:communicationRow(result[5].results[0]),herald:heraldRow(result[6].results[0]) };
}
async function api(request,env,url,owner) {
  const db=env.DB;
  if(!db) throw new HttpError('Your saved workspace is temporarily unavailable. Please try again.',503);
  const path=url.pathname, now=new Date().toISOString();
  if(path==='/api/search'&&request.method==='POST'){
    const options=searchOptions(await bodyOf(request));
    const saved=await workspace(db,owner);
    return json(searchWorkspace(saved.data,options));
  }
  if(path.startsWith('/api/communication/')&&['POST','PATCH'].includes(request.method)){
    const b=await bodyOf(request),current=await currentCommunication(db,owner);
    if(path==='/api/communication/import/preview'&&request.method==='POST'){
      if(b.pack?.app!=='atlas-communication-transfer')throw new HttpError('Review the original export in Master Communicator first.');
      const pack=await parseCommunicationTransfer(b.pack),plan=communicationImportPlan(current,pack);
      return json({pack,digest:await digest(pack),revision:current?.revision||0,rows:plan.rows,added:plan.added,kept:plan.kept});
    }
    if(path==='/api/communication/rep'&&request.method==='POST'){
      const rep=communicationRep({...b.rep,archived:false,source_timestamp:null});
      if(!rep.id.startsWith('atlas:'))throw new HttpError('Choose a new Atlas practice ID.');
      const saved=current?.reps.find(r=>r.id===rep.id);
      if(saved){if(JSON.stringify(saved)!==JSON.stringify(rep))throw new HttpError('This practice record was already saved with different details. Reload to review it.',409);return json({saved:true});}
    }
    if(!Number.isSafeInteger(b.revision)||b.revision!==(current?.revision||0))throw new HttpError('Speaking practice changed on another device. Download your draft, then reload or review the import again.',409);
    if(path==='/api/communication/import'&&request.method==='POST'){
      if(b.pack?.app!=='atlas-communication-transfer')throw new HttpError('Choose a reviewed speaking practice transfer.');
      const pack=await parseCommunicationTransfer(b.pack);
      if(b.digest!==await digest(pack))throw new HttpError('This import changed after review. Choose the file again.',409);
      const plan=communicationImportPlan(current,pack);await writeCommunication(db,owner,current,plan.next,now,pack.exportedAt);
      return json({saved:true,added:plan.added,kept:plan.kept});
    }
    const next={reps:[...(current?.reps||[])]};
    if(path==='/api/communication/rep'&&request.method==='POST')next.reps.push(communicationRep({...b.rep,archived:false,source_timestamp:null}));
    else if(path==='/api/communication/rep'&&request.method==='PATCH'){
      const index=next.reps.findIndex(r=>r.id===b.id);if(index<0)throw new HttpError('This practice record is unavailable.',404);
      const rep=next.reps[index];
      if(b.action==='archive'||b.action==='restore')next.reps[index]={...rep,archived:b.action==='archive'};
      else if(b.action==='edit')next.reps[index]=communicationRep({...b.rep,id:rep.id,archived:rep.archived,source_timestamp:rep.source_timestamp});
      else throw new HttpError('Choose a practice action.');
    }else throw new HttpError('This practice action is unavailable.',404);
    await writeCommunication(db,owner,current,next,now);return json({saved:true});
  }
  if(path.startsWith('/api/herald/')&&['POST','PATCH'].includes(request.method)){
    const b=await bodyOf(request),current=await currentHerald(db,owner);
    if(path==='/api/herald/import/preview'&&request.method==='POST'){
      if(b.pack?.app!=='atlas-herald-transfer')throw new HttpError('Review the original export in The Herald first.');
      const pack=await parseHeraldTransfer(b.pack),plan=heraldImportPlan(current,pack);
      return json({pack,digest:await digest(pack),revision:current?.revision||0,rows:plan.rows,added:plan.added,kept:plan.kept});
    }
    if(path==='/api/herald/item'&&request.method==='POST'){
      const rep=heraldItem({...b.item,archived:false,source_id:null});
      if(!rep.id.startsWith('atlas:'))throw new HttpError('Choose a new Atlas content ID.');
      const saved=current?.items.find(r=>r.id===rep.id);
      if(saved){if(JSON.stringify(saved)!==JSON.stringify(rep))throw new HttpError('This content item was already saved with different details. Reload to review it.',409);return json({saved:true});}
    }
    if(!Number.isSafeInteger(b.revision)||b.revision!==(current?.revision||0))throw new HttpError('Content planning changed on another device. Download your draft, then reload or review the import again.',409);
    if(path==='/api/herald/import'&&request.method==='POST'){
      if(b.pack?.app!=='atlas-herald-transfer')throw new HttpError('Choose a reviewed content planning transfer.');
      const pack=await parseHeraldTransfer(b.pack);
      if(b.digest!==await digest(pack))throw new HttpError('This import changed after review. Choose the file again.',409);
      const plan=heraldImportPlan(current,pack);await writeHerald(db,owner,current,plan.next,now,pack.exportedAt);
      return json({saved:true,added:plan.added,kept:plan.kept});
    }
    const next={items:[...(current?.items||[])]};
    if(path==='/api/herald/item'&&request.method==='POST')next.items.push(heraldItem({...b.item,archived:false,source_id:null}));
    else if(path==='/api/herald/item'&&request.method==='PATCH'){
      const index=next.items.findIndex(r=>r.id===b.id);if(index<0)throw new HttpError('This content item is unavailable.',404);
      const rep=next.items[index];
      if(b.action==='archive'||b.action==='restore')next.items[index]={...rep,archived:b.action==='archive'};
      else if(b.action==='edit')next.items[index]=heraldItem({...b.item,id:rep.id,archived:rep.archived,source_id:rep.source_id});
      else throw new HttpError('Choose a content action.');
    }else throw new HttpError('This content action is unavailable.',404);
    await writeHerald(db,owner,current,next,now);return json({saved:true});
  }
  if(path.startsWith('/api/ledger/')&&['POST','PATCH','PUT'].includes(request.method)){
    const b=await bodyOf(request),current=await currentLedger(db,owner);
    if(path==='/api/ledger/import/preview'&&request.method==='POST'){
      const pack=parseLedgerTransfer(b.pack),plan=ledgerImportPlan(current,pack);
      return json({pack,digest:await digest(pack),revision:current?.revision||0,rows:plan.rows,added:plan.added,kept:plan.kept});
    }
    if(!Number.isSafeInteger(b.revision)||b.revision!==(current?.revision||0))throw new HttpError('Life Ledger changed on another device. Download your draft, then reload the saved day or review the import again.',409);
    if(path==='/api/ledger/import'&&request.method==='POST'){
      const pack=parseLedgerTransfer(b.pack);
      if(b.digest!==await digest(pack))throw new HttpError('This import changed after review. Choose the file and review it again.',409);
      const plan=ledgerImportPlan(current,pack);
      await writeLedger(db,owner,current,plan.next,now,pack.exportedAt);return json({saved:true,added:plan.added,kept:plan.kept});
    }
    const next={habits:[...(current?.habits||[])],days:[...(current?.days||[])]};
    if(path==='/api/ledger/habit'&&request.method==='POST'){
      const id=textValue(b.id,240,true),title=textValue(b.title,160,true);
      if(!id.startsWith('atlas:'))throw new HttpError('Choose a new Atlas habit ID.');
      if(next.habits.some(h=>h.id===id))throw new HttpError('This habit has already been saved. Reload Life Ledger.',409);
      next.habits.push({id,title,archived:false});
    }else if(path==='/api/ledger/habit'&&request.method==='PATCH'){
      const index=next.habits.findIndex(h=>h.id===b.id);if(index<0)throw new HttpError('This habit is unavailable.',404);
      const h={...next.habits[index]};
      if(b.action==='rename')h.title=textValue(b.title,160,true);
      else if(b.action==='archive')h.archived=true;
      else if(b.action==='restore')h.archived=false;
      else throw new HttpError('Choose a habit action.');
      next.habits[index]=h;
    }else if(path==='/api/ledger/day'&&request.method==='PUT'){
      const d=ledgerContent({habits:next.habits,days:[b.day]}).days[0];
      const index=next.days.findIndex(x=>x.date===d.date);
      if(index<0)next.days.push(d);else next.days[index]=d;
    }else throw new HttpError('This Life Ledger action is unavailable.',404);
    await writeLedger(db,owner,current,next,now);return json({saved:true});
  }
  if(path==='/api/restore/preview'&&request.method==='POST'){
    const b=await bodyOf(request),current=await workspace(db,owner),backup=parseWorkspace(b.backup,current.data.practice,current.data.ledger,current.data.communication,current.data.herald);
    return json({backup,seq:current.seq,digest:await digest(backup),changes:changes(current.data,backup),legacy:b.backup.version===1,legacyLedger:b.backup.version<4,legacyCommunication:b.backup.version<5,legacyHerald:b.backup.version<6});
  }
  if(path==='/api/restore'&&request.method==='POST'){
    const b=await bodyOf(request),current=await workspace(db,owner),backup=parseWorkspace(b.backup,current.data.practice,current.data.ledger,current.data.communication,current.data.herald);
    if(!Number.isSafeInteger(b.seq)||b.seq!==current.seq||b.digest!==await digest(backup))throw new HttpError('The workspace or backup changed. Review the restore again.',409);
    const id=await replaceWorkspace(db,owner,backup,current.data,b.seq,'Before workspace restore');
    return json({saved:true,checkpoint:id});
  }
  if(path==='/api/history'&&request.method==='GET'){
    const before=url.searchParams.has('before')?Number(url.searchParams.get('before')):Number.MAX_SAFE_INTEGER;
    if(!Number.isSafeInteger(before)||before<1)throw new HttpError('Choose a valid history page.');
    const result=await db.batch([
      db.prepare('SELECT * FROM atlas_history WHERE owner=? AND seq<? ORDER BY seq DESC LIMIT 51').bind(owner,before),
      db.prepare('SELECT * FROM atlas_checkpoints WHERE owner=? ORDER BY after_seq DESC LIMIT 20').bind(owner),
      db.prepare('SELECT COALESCE(MAX(seq),0) AS seq FROM atlas_history WHERE owner=?').bind(owner)
    ]);
    return json({events:result[0].results.slice(0,50).map(({owner,before_json,after_json,...r})=>({...r,before:before_json?JSON.parse(before_json):null,after:after_json?JSON.parse(after_json):null})),next:result[0].results.length>50?result[0].results[49].seq:null,seq:result[2].results[0].seq,checkpoints:result[1].results.map(({owner,...r})=>r)});
  }
  if(/^\/api\/history\/\d+\/undo$/.test(path)&&request.method==='POST'){
    const b=await bodyOf(request),seq=Number(path.split('/')[3]);
    const h=await db.prepare('SELECT * FROM atlas_history WHERE owner=? AND seq=?').bind(owner,seq).first();
    if(!h)throw new HttpError('This change is unavailable.',404);
    if(h.action!=='updated'||!['tasks','projects','weeks'].includes(h.entity))throw new HttpError('This entry cannot be reversed here. Use a reviewed workspace backup or the app controls.');
    const table=TABLES[h.entity],before=JSON.parse(h.before_json),after=JSON.parse(h.after_json);
    const current=await db.prepare(`SELECT * FROM ${table} WHERE owner=? AND id=?`).bind(owner,h.record_id).first();
    if(!current||current.revision!==after.revision)throw new HttpError('This record changed again. Its newer work is protected.',409);
    if(!Number.isSafeInteger(b.seq))throw new HttpError('Refresh history before restoring this change.',409);
    if(h.entity==='tasks')await ownedProject(db,owner,before.project_id);
    const values={...before,revision:current.revision+1,updated_at:now};delete values.id;
    const id=crypto.randomUUID(),columns=Object.keys(values);
    await db.batch([guard(db,owner,b.seq,id),db.prepare(`UPDATE ${table} SET ${columns.map(c=>c+'=?').join(',')} WHERE owner=? AND id=? AND revision=?`).bind(...columns.map(c=>values[c]),owner,h.record_id,current.revision),db.prepare('DELETE FROM atlas_restore_guards WHERE id=?').bind(id)]);
    return json({saved:true});
  }
  if(/^\/api\/checkpoints\/[^/]+\/(export|undo)$/.test(path)){
    const id=decodeURIComponent(path.split('/')[3]),checkpoint=await checkpointData(db,owner,id);
    if(!checkpoint)throw new HttpError('This recovery copy is unavailable.',404);
    if(path.endsWith('/export')&&request.method==='GET')return json(checkpoint.data);
    if(path.endsWith('/undo')&&request.method==='POST'){
      const b=await bodyOf(request),current=await workspace(db,owner);
      if(b.seq!==current.seq||current.seq!==checkpoint.after_seq)throw new HttpError('The workspace changed after this restore. Download the recovery copy and review it before applying it.',409);
      const recovery=await replaceWorkspace(db,owner,parseWorkspace(checkpoint.data,current.data.practice,current.data.ledger,current.data.communication,current.data.herald),current.data,current.seq,'Before reversing workspace restore');
      return json({saved:true,checkpoint:recovery});
    }
  }
  if(path==='/api/state' && request.method==='GET') {
    const week=url.searchParams.get('week'); if(!validDate(week) || monday(week)!==week) throw new HttpError('Choose a valid week.');
    return json(await state(db,owner,week));
  }
  if(path==='/api/projects' && request.method==='POST') {
    const b=await bodyOf(request),id=textValue(b.id,80,true),title=textValue(b.title,300,true),area=textValue(b.area,120),due=dateValue(b.due_date);
    const existing=await db.prepare('SELECT * FROM atlas_projects WHERE id=? AND owner=?').bind(id,owner).first();
    if(existing){if(existing.title!==title||existing.area!==area||existing.due_date!==due)throw new HttpError('This project was already saved with different details.',409);return json({id});}
    await db.prepare("INSERT INTO atlas_projects (id,owner,source_id,title,area,status,due_date,imported_at,mode,updated_at) VALUES (?,?,?,?,?,'open',?,?,'managed',?)")
      .bind(id,owner,'atlas:'+id,title,area,due,now,now).run();
    return json({id},201);
  }
  if(path.startsWith('/api/projects/') && request.method==='PATCH') {
    const id=path.slice('/api/projects/'.length),b=await bodyOf(request);
    const p=await db.prepare('SELECT * FROM atlas_projects WHERE id=? AND owner=?').bind(id,owner).first();
    if(!p)throw new HttpError('That project is unavailable.',404);
    if(!Number.isInteger(b.revision)||b.revision!==p.revision)throw new HttpError('This project changed on another device. Refresh before trying again.',409);
    let {title,area,due_date,status,mode,completed_at,archived_at}=p;
    if(b.action==='connect')mode='managed';
    else if(b.action==='disconnect')mode='snapshot';
    else {
      if(mode!=='managed')throw new HttpError('Use this as a synced project before editing it here.',409);
      if(b.action==='edit'){title=textValue(b.title,300,true);area=textValue(b.area,120);due_date=dateValue(b.due_date);}
      else if(b.action==='complete'){status='done';completed_at=status===p.status?p.completed_at:now;}
      else if(b.action==='reopen'){status='open';completed_at=null;}
      else if(b.action==='archive')archived_at=now;
      else if(b.action==='restore')archived_at=null;
      else throw new HttpError('Unknown project action.');
    }
    const result=await db.prepare('UPDATE atlas_projects SET title=?,area=?,due_date=?,status=?,mode=?,completed_at=?,archived_at=?,updated_at=?,revision=revision+1 WHERE id=? AND owner=? AND revision=?')
      .bind(title,area,due_date,status,mode,completed_at,archived_at,now,id,owner,b.revision).run();
    if(!result.meta.changes)throw new HttpError('This project changed on another device. Refresh before trying again.',409);
    return json({id});
  }
  if(path.startsWith('/api/practice')&&['POST','PATCH','PUT'].includes(request.method)){
    const b=await bodyOf(request),current=await currentPractice(db,owner),revision=current?.revision||0;
    if(path==='/api/practice/editions/preview'&&request.method==='POST'){
      let published;try{published=await fetchEditions();}catch(error){throw new HttpError(error.message,502);}
      const plan=editionRefreshPlan(current,published);
      return json({published,digest:await digest(editionSignature(published)),revision,rows:plan.rows,added:plan.added,kept:plan.kept,retained:plan.retained,mode:plan.next.mode});
    }
    if(path==='/api/practice/import/preview'&&request.method==='POST'){
      const pack=parsePracticeTransfer(b.pack),plan=practiceImportPlan(current,pack);
      return json({pack,digest:await digest(pack),revision,rows:plan.rows,added:plan.added,kept:plan.kept,removed:plan.removed,replaced:plan.replaced,mode:plan.next.mode});
    }
    if(!Number.isSafeInteger(b.revision)||b.revision!==revision)throw new HttpError('Practice changed on another device. Refresh and review before trying again.',409);
    if(path==='/api/practice/editions'&&request.method==='POST'){
      if(typeof b.digest!=='string'||!/^[a-f0-9]{64}$/.test(b.digest))throw new HttpError('Review Courier editions before saving them.');
      let published;try{published=await fetchEditions();}catch(error){throw new HttpError(error.message,502);}
      if(b.digest!==await digest(editionSignature(published)))throw new HttpError('Courier published a change after your review. Check for editions again before saving.',409);
      const plan=editionRefreshPlan(current,published),savedAt=new Date().toISOString();
      await writePractice(db,owner,current,{...plan.next,edition_refresh:published.refresh},savedAt);
      return json({saved:true,added:plan.added,kept:plan.kept,retained:plan.retained});
    }
    if(path==='/api/practice/import'&&request.method==='POST'){
      const pack=parsePracticeTransfer(b.pack);
      if(b.digest!==await digest(pack))throw new HttpError('The practice pack changed. Review it again.',409);
      const plan=practiceImportPlan(current,pack);
      await writePractice(db,owner,current,{...plan.next,source_exported_at:pack.exportedAt},now,true);
      return json({saved:true,added:plan.added,kept:plan.kept});
    }
    if(path==='/api/practice/manage'&&request.method==='POST'){
      if(!current?.catalog.length)throw new HttpError('Import lessons before using synced practice.');
      if(current.mode==='managed')return json({saved:true});
      await writePractice(db,owner,current,{...current,mode:'managed'},now);return json({saved:true});
    }
    if(path==='/api/practice/lesson'&&request.method==='PATCH'){
      if(current?.mode!=='managed')throw new HttpError('Choose synced practice before recording work here.',409);
      const lesson=current.catalog.find(x=>x.id===b.id);
      if(!lesson)throw new HttpError('This lesson is unavailable in your workspace.',404);
      if(!['complete','reopen'].includes(b.action))throw new HttpError('Choose a valid practice action.');
      const done=current.items.find(x=>x.id===b.id);
      if(b.action==='complete'&&done||b.action==='reopen'&&!done)return json({saved:true});
      let items=current.items.filter(x=>x.id!==b.id);
      if(b.action==='complete'){
        if(!validDate(b.day)||b.day<lesson.day)throw new HttpError('Choose a valid completion day on or after the lesson edition.');
        items.push({id:lesson.id,title:lesson.title,track:lesson.track,day:lesson.day,completedDay:b.day,completedAt:now});
      }
      await writePractice(db,owner,current,{...current,items:practiceItems(items)},now);return json({saved:true});
    }
    // Old clients can replace only snapshot-mode records; native work is protected.
    if(path==='/api/practice'&&request.method==='PUT'){
      if(current?.mode==='managed')throw new HttpError('Synced practice is protected. Use the reviewed practice import to add new lessons.',409);
      const items=practiceItems(b.items),exported=b.source_exported_at;
      if(exported!==null&&(typeof exported!=='string'||!Number.isFinite(Date.parse(exported))))throw new HttpError('The backup date is invalid.');
      await writePractice(db,owner,current,{items,catalog:practiceCatalog([],items),mode:'snapshot',source_exported_at:exported},now,true);
      return json({count:items.length});
    }
  }
  if(path==='/api/tasks' && request.method==='POST') {
    const b=await bodyOf(request), id=textValue(b.id,80,true), title=textValue(b.title,300,true), app=appValue(b.app_id);
    const project=await ownedProject(db,owner,b.project_id), week=dateValue(b.week_start), due=dateValue(b.due_date), minutes=minutesValue(b.minutes);
    if(week && monday(week)!==week) throw new HttpError('Choose a Monday for the week.');
    // A caller-generated ID makes a repeated save after a network failure safe.
    const existing=await db.prepare('SELECT * FROM atlas_tasks WHERE id=? AND owner=?').bind(id,owner).first();
    if(existing) {
      if(existing.title!==title || existing.app_id!==app || existing.project_id!==project || existing.week_start!==week || existing.due_date!==due || existing.minutes!==minutes)
        throw new HttpError('This commitment was already saved with different details. Close Capture and refresh to edit it.',409);
      return json({id},200);
    }
    await db.prepare('INSERT INTO atlas_tasks (id,owner,title,app_id,project_id,week_start,due_date,minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id,owner,title,app,project,week,due,minutes,now,now).run();
    return json({id},201);
  }
  if(path.startsWith('/api/tasks/') && request.method==='PATCH') {
    const id=path.slice('/api/tasks/'.length), b=await bodyOf(request);
    const task=await db.prepare('SELECT * FROM atlas_tasks WHERE id=? AND owner=?').bind(id,owner).first();
    if(!task) throw new HttpError('That commitment is unavailable.',404);
    if(!Number.isInteger(b.revision) || b.revision!==task.revision) throw new HttpError('This commitment changed on another device. Refresh and try again.',409);
    let {title,app_id,project_id,week_start,due_date,minutes,status,completed_at,focus_date,focus_slot}=task;
    if(b.action==='edit') {
      title=textValue(b.title,300,true); app_id=appValue(b.app_id); project_id=await ownedProject(db,owner,b.project_id);
      week_start=dateValue(b.week_start); due_date=dateValue(b.due_date); minutes=minutesValue(b.minutes);
      if(week_start && monday(week_start)!==week_start) throw new HttpError('Choose a valid week.');
    } else if(b.action==='complete') { status='done'; completed_at=now; focus_date=null; focus_slot=null; }
    else if(b.action==='reopen') {status='open';completed_at=null;focus_date=null;focus_slot=null;}
    else if(b.action==='archive') {status='archived';focus_date=null;focus_slot=null;}
    else if(b.action==='plan') {week_start=dateValue(b.week_start);if(week_start && monday(week_start)!==week_start) throw new HttpError('Choose a valid week.');}
    else if(b.action==='focus') {
      if(status!=='open') throw new HttpError('Reopen this commitment before choosing it for today.');
      const day=dateValue(b.day); if(!day) throw new HttpError('Choose a day.');
      if(focus_date===day) {focus_date=null;focus_slot=null;}
      else {
        const occupied=await db.prepare('SELECT focus_slot FROM atlas_tasks WHERE owner=? AND focus_date=? AND id<>?').bind(owner,day,id).all();
        focus_slot=[1,2,3].find(slot=>!occupied.results.some(t=>t.focus_slot===slot));
        if(!focus_slot) throw new HttpError('Your three priorities are set. Release one before adding another.',409);
        focus_date=day; week_start=monday(day);
      }
    } else throw new HttpError('Unknown action.');
    try {
      const result=await db.prepare('UPDATE atlas_tasks SET title=?,app_id=?,project_id=?,week_start=?,due_date=?,minutes=?,status=?,completed_at=?,focus_date=?,focus_slot=?,revision=revision+1,updated_at=? WHERE id=? AND owner=? AND revision=?')
        .bind(title,app_id,project_id,week_start,due_date,minutes,status,completed_at,focus_date,focus_slot,now,id,owner,b.revision).run();
      if(!result.meta.changes) throw new HttpError('This commitment changed on another device. Refresh and try again.',409);
    } catch(error) {
      if(String(error.message).includes('UNIQUE')) throw new HttpError('Your priorities changed on another device. Refresh and try again.',409);
      throw error;
    }
    return json({id});
  }
  if(path==='/api/import' && request.method==='POST') {
    const b=await bodyOf(request);
    if(!Array.isArray(b.projects) || !b.projects.length || b.projects.length>1000) throw new HttpError('Choose between 1 and 1,000 projects.');
    const seen=new Set(), entries=b.projects.map(p=>{
      const source=textValue(p.source_id,200,true); if(seen.has(source)) throw new HttpError('Duplicate project IDs.');seen.add(source);
      const title=textValue(p.title,300,true),area=textValue(p.area,120),due=dateValue(p.due_date);
      if(!['open','done'].includes(p.status)) throw new HttpError('Unknown project status.');
      return db.prepare("INSERT INTO atlas_projects (id,owner,source_id,title,area,status,due_date,imported_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,source_id) DO UPDATE SET title=excluded.title,area=excluded.area,status=excluded.status,due_date=excluded.due_date,imported_at=excluded.imported_at,revision=atlas_projects.revision+1 WHERE atlas_projects.mode='snapshot' AND atlas_projects.archived_at IS NULL")
        .bind(crypto.randomUUID(),owner,source,title,area,p.status,due,now);
    });
    const results=await db.batch(entries),count=results.reduce((sum,r)=>sum+(r.meta?.changes||0),0);return json({count,protected:entries.length-count});
  }
  if(path==='/api/week' && request.method==='PUT') {
    const b=await bodyOf(request),week=dateValue(b.week_start);
    if(!week || monday(week)!==week) throw new HttpError('Choose a valid week.');
    if(!Number.isInteger(b.capacity) || b.capacity<0 || b.capacity>10080) throw new HttpError('Use a weekly time budget between 0 and 168 hours.');
    const worked=textValue(b.worked,4000),change=textValue(b.change,4000);
    const existing=await db.prepare('SELECT revision FROM atlas_weeks WHERE owner=? AND week_start=?').bind(owner,week).first();
    if((existing?.revision||0)!==b.revision) throw new HttpError('This review changed on another device. Refresh and try again.',409);
    if(existing) {
      const r=await db.prepare('UPDATE atlas_weeks SET capacity=?,worked=?,change=?,updated_at=?,revision=revision+1 WHERE owner=? AND week_start=? AND revision=?').bind(b.capacity,worked,change,now,owner,week,b.revision).run();
      if(!r.meta.changes) throw new HttpError('This review changed. Refresh and try again.',409);
    } else {
      try { await db.prepare('INSERT INTO atlas_weeks (id,owner,week_start,capacity,worked,change,updated_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,week,b.capacity,worked,change,now).run(); }
      catch(error){if(String(error.message).includes('UNIQUE')) throw new HttpError('This review changed. Refresh and try again.',409);throw error;}
    }
    return json({saved:true});
  }
  if(path==='/api/export' && request.method==='GET') {
    return json((await workspace(db,owner)).data);
  }
  throw new HttpError('This page was not found.',404);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const user=request.headers.get('oai-authenticated-user-id');
    // This Worker is deployed only behind the Sites dispatcher, which provides identity.
    if(!user) return url.pathname.startsWith('/api/') ? json({error:'Sign in to open your workspace.'},401) : new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=%2F',...headers}});
    if(!['GET','HEAD'].includes(request.method)) {
      const origin=request.headers.get('origin');
      if(!origin || origin!==url.origin) return json({error:'This request is not allowed.'},403);
    }
    try {
      if(url.pathname.startsWith('/api/')) return await api(request,env,url,user);
      const assets={'/search.mjs':[searchModel,'text/javascript; charset=utf-8'],'/search-ui.mjs':[searchUI,'text/javascript; charset=utf-8'],'/herald.mjs':[heraldModel,'text/javascript; charset=utf-8'],'/herald-ui.mjs':[heraldUI,'text/javascript; charset=utf-8'],'/communication.mjs':[communicationModel,'text/javascript; charset=utf-8'],'/communication-ui.mjs':[communicationUI,'text/javascript; charset=utf-8'],'/':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[js,'text/javascript; charset=utf-8'],'/theme.js':[theme,'text/javascript; charset=utf-8'],'/model.mjs':[model,'text/javascript; charset=utf-8'],'/ledger.mjs':[ledgerModel,'text/javascript; charset=utf-8'],'/ledger-ui.mjs':[ledgerUI,'text/javascript; charset=utf-8'],'/edition-refresh-ui.mjs':[editionUI,'text/javascript; charset=utf-8'],'/reflection-ui.mjs':[reflectionUI,'text/javascript; charset=utf-8']};
      const asset=assets[url.pathname]; if(!asset || !['GET','HEAD'].includes(request.method)) return new Response('Not found',{status:404,headers});
      return new Response(request.method==='HEAD'?null:asset[0],{headers:{...headers,'Content-Type':asset[1],
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"}});
    } catch(error) {
      if(error instanceof HttpError) return json({error:error.message},error.status);
      if(/atlas_restore_guard_valid|UNIQUE constraint/i.test(error?.message))return json({error:'Your workspace changed or these records conflict. Refresh and review again; nothing from this request was saved.'},409);
      if(error instanceof Error && !/D1|SQL|database/i.test(error.message)) return json({error:error.message},400);
      console.error('Atlas request failed',error?.name);
      return json({error:'We could not save or load your workspace. Your draft is still here. Please try again.'},503);
    }
  }
};
