import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {previewDatabase} from '../preview.mjs';
import worker from '../../dist/server/index.js';
import {routine,routineDates,missingOccurrences,parseCadenceTransfer,cadenceImportPlan} from '../cadence.mjs';

const week='2026-09-07';
const base=(id='routine-one',extra={})=>({id,source_id:null,title:'Review the week',frequency:'weekly',day:1,start_date:week,minutes:30,paused:false,...extra});
async function request(db,path,method='GET',body,owner='alice',origin='https://atlas.test'){
 const headers={'Content-Type':'application/json'};if(owner)headers['oai-authenticated-user-id']=owner;if(origin)headers.Origin=origin;
 const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=async db=>(await request(db,'/api/state?week='+week)).data;
const backup=async db=>(await request(db,'/api/export')).data;
const create=(db,r=base(),revision=0)=>request(db,'/api/cadence/routine','POST',{routine:r,revision});
const plan=(db,w=week,revision=1)=>request(db,'/api/cadence/plan','POST',{week:w,revision});
const patch=(db,action,revision,extra={})=>request(db,'/api/cadence/routine','PATCH',{id:'routine-one',action,revision,...extra});
const restorePreview=(db,b)=>request(db,'/api/restore/preview','POST',{backup:b});
const apply=(db,p)=>request(db,'/api/restore','POST',{backup:p.backup,digest:p.digest,seq:p.seq});

test('weekly and monthly dates respect starts, leap years, short months, Sundays and year boundaries',()=>{
 assert.deepEqual(routineDates(base(),week),[week]);
 assert.deepEqual(routineDates(base('routine-one',{day:0}),week),['2026-09-13']);
 assert.deepEqual(routineDates(base('routine-one',{start_date:'2026-09-08'}),week),[]);
 for(const [w,expected] of [['2028-02-28','2028-02-29'],['2027-02-22','2027-02-28'],['2026-04-27','2026-04-30'],['2026-12-28','2026-12-31']])assert.deepEqual(routineDates(base('routine-one',{frequency:'monthly',day:31,start_date:'2026-01-01'}),w),[expected]);
 assert.deepEqual(routineDates(base('routine-one',{paused:true}),week),[]);
 assert.throws(()=>routine(base('routine-one',{day:7})));assert.throws(()=>routine(base('routine-one',{frequency:'monthly',day:0})));assert.throws(()=>routineDates(base(),'2026-09-08'));
 assert.equal(missingOccurrences({routines:[base()]},[{routine_id:'routine-one',occurrence_date:week,status:'archived'}],week).length,0);
});

test('planning is explicit, concurrent-safe and repeatable; completion and skipping affect only their own occurrence',async()=>{
 const db=previewDatabase();try{
  assert.equal((await create(db)).status,200);assert.equal((await create(db)).status,200);assert.equal((await state(db)).tasks.length,0);
  const results=await Promise.all([plan(db),plan(db)]);assert.ok(results.every(r=>r.status===200),JSON.stringify(results));assert.equal(results.reduce((n,r)=>n+r.data.added,0),1);
  let s=await state(db);assert.equal(s.tasks.length,1);const t=s.tasks[0];assert.equal(t.app_id,'operations-cadence');assert.equal(t.week_start,week);assert.equal(t.occurrence_date,week);
  await request(db,'/api/tasks/'+t.id,'PATCH',{action:'complete',revision:1});await plan(db);await plan(db,'2026-09-14');
  s=await state(db);assert.equal(s.tasks.length,2);assert.equal(s.tasks.find(x=>x.id===t.id).status,'done');const next=s.tasks.find(x=>x.id!==t.id);assert.equal(next.status,'open');
  await request(db,'/api/tasks/'+next.id,'PATCH',{action:'archive',revision:1});await plan(db,'2026-09-14');s=await state(db);assert.equal(s.tasks.length,2);assert.equal(s.tasks.find(x=>x.id===next.id).status,'archived');
  await request(db,'/api/tasks/'+next.id,'PATCH',{action:'restore',revision:2});assert.equal((await state(db)).tasks.find(x=>x.id===next.id).status,'open');
 }finally{db.close();}
});

test('pausing and resuming retain history, avoid paused-period catch-up and preserve generated details',async()=>{
 const db=previewDatabase();try{
  await create(db);await plan(db);assert.equal((await patch(db,'pause',1)).status,200);assert.equal((await plan(db,'2026-09-14',2)).data.added,0);
  assert.equal((await patch(db,'resume',2,{day:'2026-09-16'})).status,200);assert.equal((await plan(db,'2026-09-14',3)).data.added,0);
  const edited=base('routine-one',{title:'New title',minutes:45,start_date:'2026-09-16'});assert.equal((await patch(db,'edit',3,{routine:edited})).status,200);
  assert.equal((await patch(db,'edit',4,{routine:{...edited,day:2}})).status,400);
  await plan(db,'2026-09-21',4);const s=await state(db);assert.equal(s.tasks.length,2);assert.equal(s.tasks.find(t=>t.occurrence_date===week).title,'Review the week');assert.equal(s.tasks.find(t=>t.occurrence_date==='2026-09-21').minutes,45);
 }finally{db.close();}
});

test('routine APIs isolate owners, require origin and revision, and expose routines through private search',async()=>{
 const db=previewDatabase();try{
  await create(db);assert.equal((await request(db,'/api/cadence/plan','POST',{week,revision:1},null)).status,401);
  assert.equal((await request(db,'/api/cadence/plan','POST',{week,revision:1},'alice','https://other.test')).status,403);
  assert.equal((await request(db,'/api/cadence/routine','PATCH',{action:'pause',id:'routine-one',revision:0},'bob')).status,404);
  assert.equal((await patch(db,'pause',0)).status,409);assert.equal((await plan(db,week,0)).status,409);
  assert.equal((await request(db,'/api/search','POST',{query:'Review',scope:'cadence'})).data.results[0].kind,'routine');
  assert.equal((await request(db,'/api/search','POST',{query:'Review',scope:'cadence'},'bob')).data.total,0);
 }finally{db.close();}
});

test('a pause between planning and its atomic batch prevents partial occurrence or history writes',async()=>{
 const db=previewDatabase();try{
  await create(db);const batch=db.batch;let armed=true;
  db.batch=statements=>{if(armed&&statements.length===3){armed=false;const routines=[base('routine-one',{paused:true})];db.prepare('UPDATE atlas_cadence SET routines=?,revision=revision+1 WHERE owner=?').bind(JSON.stringify(routines),'alice').run();}return batch(statements);};
  assert.equal((await plan(db)).status,409);assert.equal((await state(db)).tasks.length,0);
  const events=(await request(db,'/api/history')).data.events;assert.equal(events.filter(e=>e.entity==='tasks').length,0);assert.equal(events.length,2);
 }finally{db.close();}
});

test('Operations import projects only supported names and schedules, starts paused and preserves saved edits on reimport',async()=>{
 const raw={data:{'operationsCadence.v1':JSON.stringify({custom:{weekly:[{cid:'c1',t:'Prepare an outline',sys:'Private system'}]},overrides:{'weekly:5':'Read weekly updates'},recur:{'weekly:c1':{kind:'weekday',wd:4},'monthly:0':{kind:'yearly',month:2,day:1}},events:[{note:'PRIVATE'}],'weekly:0':{done:true,note:'SECRET'}}),unrelated:'NEVER'}};
 const pack=await parseCadenceTransfer(raw,week);assert.equal(pack.unsupported,1);assert.equal(pack.routines.length,16);assert.ok(pack.routines.every(r=>r.paused));assert.ok(!/PRIVATE|SECRET|NEVER|Private system/.test(JSON.stringify(pack)));assert.equal(pack.routines.find(r=>r.source_id==='weekly:c1').day,4);assert.equal(pack.routines.find(r=>r.source_id==='weekly:5').title,'Read weekly updates');
 const changed={routines:pack.routines.map(r=>({...r,title:'My saved title',paused:false}))};assert.equal(cadenceImportPlan(pack,changed).added,0);assert.equal(cadenceImportPlan(pack,changed).next.routines[0].title,'My saved title');
 const db=previewDatabase();try{
  const preview=(await request(db,'/api/cadence/import/preview','POST',{pack})).data;assert.equal((await state(db)).cadence,null);
  assert.equal((await request(db,'/api/cadence/import','POST',preview)).status,200);assert.equal((await plan(db)).data.added,0);
  assert.equal((await request(db,'/api/cadence/import','POST',{...preview,digest:'tampered',revision:1})).status,409);
  const next=(await request(db,'/api/cadence/import/preview','POST',{pack})).data;assert.equal(next.added,0);assert.equal((await request(db,'/api/cadence/import','POST',next)).status,200);
 }finally{db.close();}
});

test('format 7 restore and recovery preserve routine links; older exports retain new routine records',async()=>{
 const db=previewDatabase();try{
  const old=await backup(db);old.version=6;delete old.cadence;
  await create(db);await plan(db);const before=await backup(db);assert.equal(before.version,7);const first=before.tasks[0];
  await request(db,'/api/tasks/'+first.id,'PATCH',{action:'complete',revision:1});const p=(await restorePreview(db,before)).data;assert.equal((await apply(db,p)).status,200);
  let s=await state(db);assert.equal(s.tasks[0].status,'open');assert.equal(s.tasks[0].routine_id,'routine-one');
  const h=(await request(db,'/api/history')).data;assert.equal((await request(db,'/api/checkpoints/'+h.checkpoints[0].id+'/undo','POST',{seq:h.seq})).status,200);assert.equal((await state(db)).tasks[0].status,'done');
  const prior=(await restorePreview(db,old)).data;assert.equal(prior.legacyCadence,true);assert.equal(prior.backup.tasks.length,1);assert.equal(prior.backup.cadence.length,1);assert.equal((await apply(db,prior)).status,200);
  s=await state(db);await plan(db,week,s.cadence.revision);assert.equal((await state(db)).tasks.length,1);
  const absent=await backup(db);delete absent.tasks[0].routine_id;assert.equal((await restorePreview(db,absent)).status,400);
  const bad=await backup(db);bad.tasks[0].routine_id='routine-missing';assert.equal((await restorePreview(db,bad)).status,400);
  const repeated=await backup(db);repeated.tasks.push({...repeated.tasks[0],id:'duplicate'});assert.equal((await restorePreview(db,repeated)).status,400);
 }finally{db.close();}
});

test('routine history failures roll back edits and generated commitments',async()=>{
 const db=previewDatabase();try{
  await create(db);db.prepare("CREATE TRIGGER cadence_history_failure BEFORE INSERT ON atlas_history WHEN NEW.entity IN ('cadence','tasks') BEGIN SELECT RAISE(ABORT,'D1 history failure'); END;").run();
  const failed=await plan(db);assert.equal(failed.status,503);assert.equal((await patch(db,'pause',1)).status,503);assert.equal((await state(db)).tasks.length,0);assert.equal((await state(db)).cadence.routines[0].paused,false);assert.equal((await request(db,'/api/history')).data.events.length,1);
 }finally{db.close();}
});

test('the new migration adds nullable origins while preserving existing tasks and history',()=>{
 const db=new DatabaseSync(':memory:');try{
  const files=readdirSync(new URL('../../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files.slice(0,-1))db.exec(readFileSync(new URL('../../drizzle/'+file,import.meta.url),'utf8'));
  db.prepare("INSERT INTO atlas_tasks (id,owner,title,app_id,status,minutes,created_at,updated_at) VALUES ('old','alice','Keep this','life-map','open',30,?,?)").run(week+'T12:00:00Z',week+'T12:00:00Z');
  const old=db.prepare('SELECT * FROM atlas_tasks').get(),history=db.prepare('SELECT * FROM atlas_history').all();
  db.exec(readFileSync(new URL('../../drizzle/'+files.at(-1),import.meta.url),'utf8'));
  assert.deepEqual({...db.prepare('SELECT * FROM atlas_tasks').get()},{...old,routine_id:null,occurrence_date:null});assert.deepEqual(db.prepare('SELECT * FROM atlas_history').all(),history);
 }finally{db.close();}
});
