import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import worker from '../../dist/server/index.js';
import { parseLifeMap, validDate, monday, APPS } from '../model.mjs';

function database(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../../drizzle/'+file,import.meta.url),'utf8'));
  return {
    prepare(sql){const values=[];return {bind(...args){values.push(...args);return this;},
      first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},
      run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};},
      execute(){return /^\s*SELECT/i.test(sql)?this.all():this.run();}};},
    batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s.execute());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}},
    close(){sqlite.close();}
  };
}
async function request(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={};if(user)headers['oai-authenticated-user-id']=user;if(origin)headers.Origin=origin;
  if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});
  return {status:r.status,data:r.headers.get('Content-Type')?.includes('json')?await r.json():await r.text(),headers:r.headers};
}
const task=(id,extra={})=>({id,title:'Prepare a project outline',app_id:'life-map',project_id:null,week_start:'2026-09-07',due_date:null,minutes:30,...extra});
const snapshot=db=>request(db,'/api/state?week=2026-09-07');

test('Life Map projection excludes all other backup data and validates source IDs',()=>{
  const file={app:'atlas',data:{lifemap_v1:JSON.stringify({projects:[{id:'p1',task:'Write an outline',area:'Projects',status:'Not started',due:'2026-09-08',notes:'private notes'}]}),'babybrain.tts':'sensitive configuration','unrelated':'other data'}};
  const rows=parseLifeMap(file);assert.deepEqual(rows,[{source_id:'p1',title:'Write an outline',area:'Projects',status:'open',due_date:'2026-09-08'}]);
  assert.throws(()=>parseLifeMap({projects:[{id:'a',task:'A'},{id:'a',task:'B'}]}),/duplicate/i);
  assert.throws(()=>parseLifeMap({projects:[{task:'No id'}]}));
  assert.equal(validDate('2026-02-30'),false);assert.equal(monday('2026-09-06'),'2026-08-31');assert.equal(monday('2026-09-07'),'2026-09-07');
  assert.equal(APPS.length,13);assert.ok(!APPS.some(a=>/gang|booking/.test(a.file)));
});
test('anonymous visitors are redirected, APIs require identity, and writes require same origin',async()=>{
  const db=database();
  assert.equal((await request(db,'/','GET',null,null)).status,302);
  assert.equal((await request(db,'/api/state?week=2026-09-07','GET',null,null)).status,401);
  assert.equal((await request(db,'/api/tasks','POST',task('a'),'alice','https://other.test')).status,403);
  assert.equal((await request(db,'/api/tasks','POST',task('a'),'alice',null)).status,403);
  assert.equal((await request(db,'/style.css')).status,200);
  const appearance=await request(db,'/theme.js');
  assert.equal(appearance.status,200);
  assert.ok(appearance.data.includes('AtlasAppearance'));
  assert.match(appearance.headers.get('Content-Type'),/text\/javascript/);
  assert.equal((await request(db,'/theme.js','GET',null,null)).status,302);
  db.close();
});
test('capture, plan, complete, reopen, and export retain a stable record across requests',async()=>{
  const db=database();assert.equal((await request(db,'/api/tasks','POST',task('a'))).status,201);
  assert.equal((await request(db,'/api/tasks','POST',task('a'))).status,200);
  assert.equal((await request(db,'/api/tasks','POST',task('a',{title:'Changed retry'}))).status,409);
  assert.equal((await snapshot(db)).data.tasks.length,1);
  assert.equal((await request(db,'/api/tasks/a','PATCH',{revision:1,action:'plan',week_start:'2026-09-14'})).status,200);
  assert.equal((await request(db,'/api/tasks/a','PATCH',{revision:2,action:'complete'})).status,200);
  let saved=(await request(db,'/api/export')).data.tasks[0];assert.equal(saved.status,'done');assert.ok(saved.completed_at);assert.equal(saved.owner,undefined);
  assert.equal((await request(db,'/api/tasks/a','PATCH',{revision:3,action:'reopen'})).status,200);
  saved=(await snapshot(db)).data.tasks[0];assert.equal(saved.status,'open');assert.equal(saved.completed_at,null);assert.equal(saved.week_start,'2026-09-14');db.close();
});
test('every task, project, review, and export stays inside the authenticated owner',async()=>{
  const db=database();await request(db,'/api/tasks','POST',task('alice-task'));
  await request(db,'/api/import','POST',{projects:[{source_id:'map1',title:'Private project',area:'Life',status:'open',due_date:null}]});
  const p=(await snapshot(db)).data.projects[0];
  assert.equal((await request(db,'/api/tasks','POST',task('bob-task',{project_id:p.id}),'bob')).status,404);
  assert.equal((await request(db,'/api/tasks/alice-task','PATCH',{revision:1,action:'complete'},'bob')).status,404);
  assert.equal((await request(db,'/api/state?week=2026-09-07','GET',null,'bob')).data.tasks.length,0);
  assert.deepEqual((await request(db,'/api/export','GET',null,'bob')).data.projects,[]);db.close();
});
test('reimport keeps project identity and existing task links; invalid batches write nothing',async()=>{
  const db=database(),row={source_id:'map1',title:'First name',area:'Life',status:'open',due_date:null};
  assert.equal((await request(db,'/api/import','POST',{projects:[row]})).status,200);
  const id=(await snapshot(db)).data.projects[0].id;
  await request(db,'/api/tasks','POST',task('a',{project_id:id}));
  await request(db,'/api/import','POST',{projects:[{...row,title:'Updated name'}]});
  let result=(await snapshot(db)).data;assert.equal(result.projects.length,1);assert.equal(result.projects[0].id,id);assert.equal(result.projects[0].title,'Updated name');assert.equal(result.tasks[0].project_id,id);
  assert.equal((await request(db,'/api/import','POST',{projects:[{...row,source_id:'new'},{...row,source_id:'bad',due_date:'2026-02-30'}]})).status,400);
  assert.equal((await snapshot(db)).data.projects.length,1);db.close();
});
test('stale task and weekly review edits are rejected without losing newer data',async()=>{
  const db=database();await request(db,'/api/tasks','POST',task('a'));
  await request(db,'/api/tasks/a','PATCH',{revision:1,action:'complete'});
  assert.equal((await request(db,'/api/tasks/a','PATCH',{revision:1,action:'archive'})).status,409);
  const week={week_start:'2026-09-07',capacity:300,worked:'A useful week',change:'Leave room',revision:0};
  assert.equal((await request(db,'/api/week','PUT',week)).status,200);
  assert.equal((await request(db,'/api/week','PUT',{...week,worked:'Stale overwrite'})).status,409);
  assert.equal((await snapshot(db)).data.week.worked,week.worked);
  assert.equal((await request(db,'/api/week','PUT',{...week,worked:'Refined',revision:1})).status,200);db.close();
});
test('focus cannot exceed three priorities and concurrent choices preserve the slot invariant',async()=>{
  const db=database();for(let i=0;i<5;i++)await request(db,'/api/tasks','POST',task('t'+i));
  for(let i=0;i<3;i++)assert.equal((await request(db,'/api/tasks/t'+i,'PATCH',{revision:1,action:'focus',day:'2026-09-08'})).status,200);
  assert.equal((await request(db,'/api/tasks/t3','PATCH',{revision:1,action:'focus',day:'2026-09-08'})).status,409);
  await request(db,'/api/tasks/t0','PATCH',{revision:2,action:'complete'});
  const results=await Promise.all([3,4].map(i=>request(db,'/api/tasks/t'+i,'PATCH',{revision:1,action:'focus',day:'2026-09-08'})));
  assert.equal(results.filter(r=>r.status===200).length,1);
  const focused=(await snapshot(db)).data.tasks.filter(t=>t.focus_date==='2026-09-08');assert.equal(focused.length,3);assert.equal(new Set(focused.map(t=>t.focus_slot)).size,3);db.close();
});
test('invalid input and database outages return useful errors instead of success',async()=>{
  const db=database();assert.equal((await request(db,'/api/tasks','POST',task('a',{minutes:-10}))).status,400);
  assert.equal((await request(db,'/api/tasks','POST',task('b',{due_date:'2026-02-30'}))).status,400);
  assert.equal((await request(null,'/api/tasks','POST',task('c'))).status,503);
  assert.equal((await request(db,'/api/state?week=2026-09-08')).status,400);db.close();
});
