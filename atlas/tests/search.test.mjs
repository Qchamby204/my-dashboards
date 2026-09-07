import {test} from 'node:test';
import assert from 'node:assert/strict';
import {searchOptions,searchWorkspace} from '../search.mjs';
import {previewDatabase} from '../preview.mjs';
import worker from '../../dist/server/index.js';
const day='2026-09-07';
const fixture=()=>({tasks:[{id:'task',title:'Café plan',status:'open',app_id:'life-map',due_date:day}],projects:[{id:'project',title:'Plan café visit',area:'Community',mode:'managed',status:'done',archived_at:null}],weeks:[{week_start:'2026-08-03',worked:'The café conversation helped.',change:'Make more room.'}],practice:[{items:[{id:'lesson'}],catalog:[{id:'lesson',title:'Listen first',task:'Plan a café conversation',drill:'Ask a question',track:'Communication',day}]}],ledger:[{habits:[{id:'habit',title:'Read café notes',archived:true}],days:[{date:day,note:'A café reflection',tomorrow:'Plan the visit',checked:[]}]}],communication:[{reps:[{id:'speaking',topic:'Café introduction',drill:'Tell a story',skill:'Clarity',note:'Allow a pause',day,archived:false}]}],herald:[{items:[{id:'content',title:'Café stories',format:'short',stage:'published',audience:'Community',published_day:day,scheduled_day:'2026-08-31',note:'Plan the opening',archived:false,script:'excluded-secret'}]}],checkpoints:[{text:'excluded-secret'}]});
const search=(data,query,extra={})=>searchWorkspace(data,{query,...extra});
test('workspace search matches literal normalized terms across saved sources and scopes archives explicitly',()=>{
  const data=fixture(),original=structuredClone(data);
  assert.equal(search(data,'CAFE').total,7);assert.equal(search(data,'cafe',{include_archived:true}).total,8);
  assert.deepEqual(search(data,'cafe clarity',{scope:'communication'}).results.map(r=>r.id),['speaking']);
  assert.equal(search(data,'cafe unlikely').total,0);assert.equal(search(data,'.*').total,0);
  assert.equal(search(data,'excluded-secret').total,0);assert.equal(search(data,'2026-08-03').results[0].kind,'review');
  assert.equal(search(data,'cafe plan').results[0].id,'task');assert.equal(search(data,'2026-09-07',{scope:'herald'}).total,1);
  assert.deepEqual(data,original);assert.ok(!('script' in search(data,'cafe',{scope:'herald'}).results[0]));
  assert.equal(search(data,'cafe',{scope:'herald'}).counts.herald,1);
});
test('search bounds results and snippets while preserving an exact matching total',()=>{
  const data={tasks:Array.from({length:60},(_,i)=>({id:String(i),title:'Reading '+i,status:i===0?'archived':'open',app_id:'life-map'})),weeks:[{week_start:day,worked:'Opening '.repeat(100)+'reading'+' ending'.repeat(100)}]};
  const r=search(data,'reading');assert.equal(r.total,60);assert.equal(r.results.length,40);assert.equal(r.truncated,true);assert.equal(r.counts.tasks,59);assert.equal(r.counts.weeks,1);
  const w=search(data,'reading',{scope:'weeks'}).results[0];assert.ok(w.snippet.includes('reading'));assert.ok(w.snippet.length<=182);
  for(const input of [{query:'a'},{query:'x'.repeat(161)},{query:'\u0301\u0301'},{query:'a b c d e f g h i j k l m n o p q'},{query:'plan',scope:'__proto__'},{query:'plan',scope:['tasks']},{query:'plan',include_archived:'false'}])assert.throws(()=>searchOptions(input));
});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,headers:r.headers,data:await r.json()};
}
test('search is authenticated, owner scoped, same-origin, read-only and includes earlier saved reviews',async()=>{
  const db=previewDatabase();
  await db.prepare('INSERT INTO atlas_weeks (id,updated_at,owner,week_start,worked) VALUES (?,?,?,?,?)').bind('alice-week',day+'T12:00:00Z','alice','2026-08-03','Café discussion').run();
  await db.prepare('INSERT INTO atlas_weeks (id,updated_at,owner,week_start,worked) VALUES (?,?,?,?,?)').bind('bob-week',day+'T12:00:00Z','bob',day,'Café other owner').run();
  const before=(await req(db,'/api/export')).data,history=(await req(db,'/api/history')).data;
  const r=await req(db,'/api/search','POST',{query:'cafe'});assert.equal(r.status,200);assert.equal(r.data.total,1);assert.equal(r.data.results[0].id,'2026-08-03');assert.equal(r.headers.get('Cache-Control'),'no-store');
  assert.equal(JSON.stringify(r.data).includes('owner'),false);assert.equal(JSON.stringify(r.data).includes('bob'),false);
  const after=(await req(db,'/api/export')).data;after.exportedAt=before.exportedAt;assert.deepEqual(after,before);assert.deepEqual((await req(db,'/api/history')).data,history);
  assert.equal((await req(db,'/api/search','POST',{query:'cafe'},null)).status,401);
  assert.equal((await req(db,'/api/search','POST',{query:'cafe'},'alice','https://other.test')).status,403);
  assert.equal((await req(db,'/api/search?query=cafe')).status,404);
  assert.equal((await req(db,'/api/search','POST',{query:'cafe'},'charlie')).data.total,0);
});
test('invalid searches do not query the database and the built authenticated client dependency graph resolves',async()=>{
  const db={batch(){throw Error('database must not be queried');},prepare(){throw Error('database must not be queried');}};
  assert.equal((await req(db,'/api/search','POST',{query:'a'})).status,400);
  const pending=['/app.js'],seen=new Set();
  while(pending.length){const path=pending.pop();if(seen.has(path))continue;seen.add(path);const r=await worker.fetch(new Request('https://atlas.test'+path,{headers:{'oai-authenticated-user-id':'test'}}),{});assert.equal(r.status,200,path);const body=await r.text();for(const match of body.matchAll(/from ['"]\.\/([^'"]+)['"]/g))pending.push('/'+match[1]);}
  assert.ok(seen.has('/search-ui.mjs'));assert.ok(seen.has('/search.mjs'));
});
