import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {parseWorkspace} from '../recovery.mjs';

async function request(db,path,method='GET',body,owner='alice'){
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers:{'oai-authenticated-user-id':owner,Origin:'https://atlas.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{DB:db});
  return {status:r.status,data:await r.json()};
}
const task=(id,title='Draft an outline')=>({id,title,app_id:'life-map',project_id:null,week_start:'2026-09-07',due_date:null,minutes:30});
const snapshot=async db=>(await request(db,'/api/export')).data;
const history=async db=>(await request(db,'/api/history')).data;
const preview=async(db,backup)=>(await request(db,'/api/restore/preview','POST',{backup})).data;
const apply=(db,p)=>request(db,'/api/restore','POST',{backup:p.backup,seq:p.seq,digest:p.digest});
const content=b=>Object.fromEntries(['projects','tasks','weeks','practice'].map(k=>[k,b[k].map(({revision,updated_at,...r})=>r)]));

test('reviewed full restore retains links and all four record types, creates a durable copy, and reverses after a reload',async()=>{
  const db=previewDatabase();
  await request(db,'/api/projects','POST',{id:'project',title:'Learn something',area:'Learning',due_date:null});
  await request(db,'/api/tasks','POST',{...task('a'),project_id:'project'});
  await request(db,'/api/tasks/a','PATCH',{revision:1,action:'focus',day:'2026-09-07'});
  await request(db,'/api/week','PUT',{week_start:'2026-09-07',revision:0,capacity:600,worked:'Line one\nLine two',change:'Keep space'});
  await request(db,'/api/practice','PUT',{revision:0,items:[{id:'lesson/a',day:'2026-09-07',title:'Explain clearly',track:'Communication',completedDay:'2026-09-07',completedAt:'2026-09-07T12:00:00Z'}],source_exported_at:null});
  const backup=await snapshot(db);
  await request(db,'/api/tasks','POST',task('remove-me'));
  const before=await snapshot(db),p=await preview(db,backup);
  assert.equal(p.changes.find(c=>c.key==='tasks').remove,1);
  const r=await apply(db,p);assert.equal(r.status,200,JSON.stringify(r.data));
  const restored=await snapshot(db);assert.deepEqual(content(restored),content(backup));assert.ok(restored.tasks[0].revision>backup.tasks[0].revision);
  const checkpoint=r.data.checkpoint;
  const recoveryCopy=(await request(db,'/api/checkpoints/'+checkpoint+'/export')).data;
  for(const key of ['tasks','projects','weeks','practice'])assert.deepEqual(recoveryCopy[key],before[key]);
  assert.equal((await request(db,'/api/checkpoints/'+checkpoint+'/export','GET',null,'bob')).status,404);
  const h=await history(db);assert.equal(h.checkpoints[0].id,checkpoint);
  assert.equal((await request(db,'/api/checkpoints/'+checkpoint+'/undo','POST',{seq:h.seq})).status,200);
  assert.deepEqual(content(await snapshot(db)),content(before));assert.equal((await history(db)).checkpoints.length,2);db.close();
});
test('stale previews, edited backup payloads, and newer work after restore cannot be overwritten',async()=>{
  const db=previewDatabase();await request(db,'/api/tasks','POST',task('a'));
  const backup=await snapshot(db),p=await preview(db,backup);
  await request(db,'/api/tasks/a','PATCH',{revision:1,action:'complete'});
  assert.equal((await apply(db,p)).status,409);
  const fresh=await preview(db,backup);fresh.backup.tasks[0].title='Tampered';assert.equal((await apply(db,fresh)).status,409);
  const r=await apply(db,await preview(db,backup));assert.equal(r.status,200);
  const seq=(await history(db)).seq;await request(db,'/api/tasks','POST',task('newer'));
  assert.equal((await request(db,'/api/checkpoints/'+r.data.checkpoint+'/undo','POST',{seq})).status,409);
  assert.ok((await snapshot(db)).tasks.some(t=>t.id==='newer'));db.close();
});
test('the transactional restore guard catches a write between validation and the batch',async()=>{
  const db=previewDatabase();await request(db,'/api/tasks','POST',task('a'));
  const p=await preview(db,await snapshot(db)),batch=db.batch;let armed=true;
  db.batch=function(statements){if(armed&&statements.length>5){armed=false;db.prepare("UPDATE atlas_tasks SET title='Concurrent edit',revision=revision+1 WHERE id='a'").run();}return batch(statements);};
  const r=await apply(db,p);assert.equal(r.status,409,JSON.stringify(r.data));
  assert.equal((await snapshot(db)).tasks[0].title,'Concurrent edit');assert.equal((await history(db)).checkpoints.length,0);db.close();
});
test('foreign-owner ID conflicts roll back every replacement, checkpoint and history write',async()=>{
  const db=previewDatabase();await request(db,'/api/tasks','POST',task('a'));await request(db,'/api/tasks','POST',task('bob'),'bob');
  const before=await snapshot(db),h=await history(db),backup=structuredClone(before);backup.tasks[0].id='bob';
  const r=await apply(db,await preview(db,backup));assert.equal(r.status,409);
  assert.deepEqual(content(await snapshot(db)),content(before));assert.equal((await history(db)).seq,h.seq);assert.equal((await history(db)).checkpoints.length,0);db.close();
});
test('history is atomic with saves, owner-scoped, and can recover a prior edit without changing other records',async()=>{
  const db=previewDatabase();await request(db,'/api/tasks','POST',task('a'));
  await request(db,'/api/tasks/a','PATCH',{revision:1,action:'edit',...task('a','Revised outline')});
  const h=await history(db),event=h.events[0];assert.equal(event.before.title,'Draft an outline');assert.equal(event.after.title,'Revised outline');
  assert.equal((await request(db,'/api/history','GET',null,'bob')).data.events.length,0);
  assert.equal((await request(db,'/api/history/'+event.seq+'/undo','POST',{seq:h.seq},'bob')).status,404);
  assert.equal((await request(db,'/api/history/'+event.seq+'/undo','POST',{seq:h.seq})).status,200);
  assert.equal((await snapshot(db)).tasks[0].title,'Draft an outline');
  assert.equal((await request(db,'/api/history/'+event.seq+'/undo','POST',{seq:(await history(db)).seq})).status,409);
  db.prepare("CREATE TRIGGER fail_history BEFORE INSERT ON atlas_history BEGIN SELECT RAISE(ABORT, 'database history unavailable'); END").run();
  assert.equal((await request(db,'/api/tasks','POST',task('blocked'))).status,503);
  assert.equal((await snapshot(db)).tasks.length,1);db.close();
});
test('malformed or unrelated backups write nothing and old exports preserve current practice',async()=>{
  const db=previewDatabase();await request(db,'/api/tasks','POST',task('a'));const backup=await snapshot(db);
  for(const bad of [{...backup,version:9},{...backup,tasks:[...backup.tasks,...backup.tasks]},{...backup,tasks:[{...backup.tasks[0],project_id:'missing'}]},{...backup,tasks:[{...backup.tasks[0],focus_date:'2026-09-07',focus_slot:null}]}])assert.equal((await request(db,'/api/restore/preview','POST',{backup:bad})).status,400);
  const current=[{items:[],catalog:[],mode:'managed',updated_at:null,revision:2,imported_at:'2026-09-07T12:00:00Z',source_exported_at:null}];
  assert.deepEqual(parseWorkspace({...backup,version:1,practice:undefined},current).practice,current);
  const clean=parseWorkspace({...backup,tasks:[{...backup.tasks[0],apiKey:'excluded',owner:'someone'}]});assert.equal(JSON.stringify(clean).includes('excluded'),false);
  assert.equal((await history(db)).events.length,1);db.close();
});
test('empty restores advance history and practice entries retain only counts and provenance',async()=>{
  const db=previewDatabase(),empty=await snapshot(db);assert.equal((await apply(db,await preview(db,empty))).status,200);assert.equal((await history(db)).events[0].entity,'workspace');
  await request(db,'/api/practice','PUT',{revision:0,items:[{id:'lesson/a',title:'Private lesson title',track:'Communication',day:'2026-09-07',completedDay:'2026-09-07',completedAt:'2026-09-07T12:00:00Z'}],source_exported_at:null});
  const h=await history(db);assert.equal(h.events[0].after.count,1);assert.equal(JSON.stringify(h).includes('Private lesson title'),false);db.close();
});
