import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {parsePracticeTransfer,weeklySummary} from '../model.mjs';
import {createPracticeTransfer,PRACTICE_KEY} from '../../shared/atlas-workflow-core.mjs';
const stamp='2026-09-07T12:00:00.000Z',day='2026-09-07';
const lesson=(id='a')=>({id:'lesson/'+id,day,title:'Explain '+id,track:'Communication',task:'Explain an idea in one sentence.',drill:'Practise a clear opening.'});
const completion=(id='a')=>({...lesson(id),completedDay:day,completedAt:stamp});
const pack=(catalog=[lesson()],items=[])=>({app:'atlas-practice-transfer',version:1,exportedAt:stamp,catalog,items});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+day).then(x=>x.data);
const backup=db=>req(db,'/api/export').then(x=>x.data);
async function preview(db,p){const r=await req(db,'/api/practice/import/preview','POST',{pack:p});assert.equal(r.status,200);return r.data;}
async function apply(db,p){const plan=await preview(db,p),r=await req(db,'/api/practice/import','POST',plan);assert.equal(r.status,200);return r.data;}
async function connect(db){const p=(await state(db)).practice;assert.equal((await req(db,'/api/practice/manage','POST',{revision:p.revision})).status,200);}
async function act(db,id,action){const p=(await state(db)).practice;return req(db,'/api/practice/lesson','PATCH',{id:'lesson/'+id,action,day,revision:p.revision});}

test('schema upgrade preserves legacy practice bytes and completion dates with conservative snapshot defaults',()=>{
  const db=new DatabaseSync(':memory:'),dir=new URL('../../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for(const f of files.slice(0,3))db.exec(readFileSync(new URL(f,dir),'utf8'));
  const items=JSON.stringify([completion()]);db.prepare('INSERT INTO atlas_practice_snapshots (owner,items,imported_at) VALUES (?,?,?)').run('alice',items,stamp);
  const count=db.prepare('SELECT COUNT(*) AS n FROM atlas_history').get().n;
  db.exec(readFileSync(new URL(files[3],dir),'utf8'));
  const p=db.prepare('SELECT * FROM atlas_practice_snapshots').get();assert.equal(p.items,items);assert.equal(p.mode,'snapshot');assert.equal(p.catalog,'[]');assert.equal(p.revision,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM atlas_history').get().n,count);db.close();
});
test('practice packs whitelist lesson and completion fields without exporting unrelated stores',()=>{
  const storage={getItem:k=>k===PRACTICE_KEY?JSON.stringify({version:1,revision:1,completions:{'lesson/a':{...completion(),apiKey:'excluded'}}}):'unrelated-secret'};
  const raw=createPracticeTransfer(storage,{days:[]},new Date(stamp));assert.equal(JSON.stringify(raw).includes('excluded'),false);
  const parsed=parsePracticeTransfer(raw);assert.equal(parsed.catalog[0].id,'lesson/a');assert.equal(parsed.items[0].completedAt,stamp);
  assert.throws(()=>parsePracticeTransfer(pack([lesson(),lesson()])),/IDs/);
  assert.throws(()=>parsePracticeTransfer(pack([lesson()],[{...completion(),day:'2026-09-08'}])),/date/);
  const large=Array.from({length:300},(_,i)=>({...lesson(String(i)),task:'a'.repeat(3000),drill:'b'.repeat(3000)}));assert.throws(()=>parsePracticeTransfer(pack(large)),/1.5 MB/);
});
test('private practice completes and reopens across requests, updates review, and stays inside its owner',async()=>{
  const db=previewDatabase();await apply(db,pack());assert.equal((await act(db,'a','complete')).status,409);await connect(db);
  const before=(await state(db)).practice.revision;
  assert.equal((await act(db,'a','complete')).status,200);let p=(await state(db)).practice;assert.equal(p.items.length,1);assert.equal(p.items[0].completedDay,day);
  assert.equal(weeklySummary(await state(db),day).practice.length,1);assert.equal(p.revision,before+1);
  assert.equal((await req(db,'/api/practice/lesson','PATCH',{id:'lesson/a',action:'reopen',day,revision:p.revision},'bob')).status,409);
  assert.equal((await req(db,'/api/state?week='+day,'GET',null,'bob')).data.practice,null);
  assert.equal((await req(db,'/api/practice/lesson','PATCH',{},null)).status,401);
  assert.equal((await req(db,'/api/practice/lesson','PATCH',{},'alice','https://other.test')).status,403);
  assert.equal((await act(db,'a','reopen')).status,200);p=(await state(db)).practice;assert.equal(p.items.length,0);assert.equal(p.catalog.length,1);db.close();
});
test('managed imports preserve reopened lessons and completion timestamps while adding genuinely new lessons',async()=>{
  const db=previewDatabase();await apply(db,pack([lesson('a'),lesson('b')],[completion('a'),completion('b')]));await connect(db);await act(db,'a','reopen');
  const imported=pack([lesson('a'),lesson('b'),lesson('c')],[completion('a'),{...completion('b'),completedDay:'2026-09-08'},completion('c')]);
  const plan=await preview(db,imported);assert.equal(plan.kept,2);assert.equal(plan.added,1);
  await req(db,'/api/practice/import','POST',plan);const p=(await state(db)).practice;
  assert.deepEqual(p.items.map(x=>x.id),['lesson/b','lesson/c']);assert.equal(p.items[0].completedDay,day);
  const old=await req(db,'/api/practice','PUT',{revision:p.revision,items:[completion('a')],source_exported_at:stamp});assert.equal(old.status,409);
  assert.equal((await state(db)).practice.catalog.length,3);db.close();
});
test('stale and tampered imports or concurrent completion writes cannot overwrite newer practice',async()=>{
  const db=previewDatabase();await apply(db,pack([lesson('a'),lesson('b')]));await connect(db);
  const plan=await preview(db,pack([lesson('c')]));await act(db,'a','complete');
  assert.equal((await req(db,'/api/practice/import','POST',plan)).status,409);
  const fresh=await preview(db,pack([lesson('c')]));fresh.pack.catalog[0].title='Changed after review';assert.equal((await req(db,'/api/practice/import','POST',fresh)).status,409);
  const revision=(await state(db)).practice.revision;
  const results=await Promise.all(['a','b'].map(id=>req(db,'/api/practice/lesson','PATCH',{id:'lesson/'+id,action:id==='a'?'reopen':'complete',day,revision})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);db.close();
});
test('practice history is atomic and full workspace restore preserves native choices and lesson instructions',async()=>{
  const db=previewDatabase();await apply(db,pack([lesson('a'),lesson('b')],[completion('a')]));await connect(db);await act(db,'a','reopen');await act(db,'b','complete');
  const before=await backup(db);assert.equal(before.version,8);assert.equal(before.practice[0].mode,'managed');
  const old={...before,version:2,practice:before.practice.map(({catalog,mode,updated_at,...r})=>r)};const compatible=await req(db,'/api/restore/preview','POST',{backup:old});assert.equal(compatible.status,200);assert.equal(compatible.data.backup.practice[0].mode,'snapshot');
  assert.equal((await req(db,'/api/restore/preview','POST',{backup:{...old,version:3}})).status,400);
  await act(db,'a','complete');const plan=(await req(db,'/api/restore/preview','POST',{backup:before})).data;
  const restored=await req(db,'/api/restore','POST',{backup:plan.backup,seq:plan.seq,digest:plan.digest});assert.equal(restored.status,200);
  const p=(await state(db)).practice;assert.deepEqual(p.items.map(x=>x.id),['lesson/b']);assert.equal(p.catalog[0].task,lesson().task);assert.equal(p.mode,'managed');
  const h=(await req(db,'/api/history')).data.events.filter(x=>x.entity==='practice_snapshots');assert.ok(h.length);assert.ok(h.some(x=>x.after?.mode==='managed'));assert.equal(JSON.stringify(h).includes('Explain an idea'),false);
  const failing={prepare:sql=>{if(sql.startsWith('UPDATE atlas_practice_snapshots'))throw Error('D1 database unavailable');return db.prepare(sql);},batch:s=>db.batch(s)};
  const revision=p.revision;assert.equal((await req(failing,'/api/practice/lesson','PATCH',{id:'lesson/a',action:'complete',day,revision})).status,503);
  assert.equal((await state(db)).practice.revision,revision);db.close();
});
