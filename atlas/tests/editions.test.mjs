import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {fetchEditions,publishedEditions,editionSignature,COURIER_FEED} from '../courier-editions.mjs';
import {lessonItems} from '../../shared/atlas-workflow-core.mjs';

const date='2026-09-07',stamp=date+'T12:00:00.000Z';
const lesson=(index=0)=>({track:'communication',label:'Communication',sequence:'Clear thinking',index,title:'Explain an idea '+index,task:'Explain one idea clearly.',drill:'Try another opening.',script:'excluded long script',audio:'https://excluded.test/audio'});
const edition=(day=date,lessons=[lesson()])=>({date:day,generatedAt:day+'T09:00:00Z',blocks:[{id:'lessons',lessons}],usage:{private:'excluded usage'}});
const feed=(days=[edition()])=>({schemaVersion:1,days});
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+date).then(x=>x.data);
const backup=db=>req(db,'/api/export').then(x=>x.data);
async function preview(db){const r=await req(db,'/api/practice/editions/preview','POST',{});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function refresh(db){const p=await preview(db),r=await req(db,'/api/practice/editions','POST',{digest:p.digest,revision:p.revision});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function act(db,id,action){return req(db,'/api/practice/lesson','PATCH',{id,action,day:date,revision:(await state(db)).practice.revision});}

test('edition projection keeps original Courier IDs, labels missing lessons, and excludes all other publication fields',()=>{
  const raw=feed([edition('2026-09-06'),edition(date,[])]),p=publishedEditions(raw,stamp);
  assert.deepEqual(p.catalog,lessonItems(raw));assert.equal(p.refresh.latest_edition,date);assert.equal(p.refresh.latest_lesson_edition,'2026-09-06');assert.equal(p.editions[0].lessons,0);
  assert.equal(JSON.stringify(p).includes('excluded'),false);
  assert.deepEqual(editionSignature(p),editionSignature(publishedEditions(raw,'2026-09-08T12:00:00Z')));
  const actual=JSON.parse(readFileSync(new URL('../../courier/manifest.json',import.meta.url),'utf8'));
  const actualProjection=publishedEditions(actual,stamp);assert.deepEqual(actualProjection.catalog.map(x=>x.id).sort(),lessonItems(actual).map(x=>x.id).sort());
  assert.throws(()=>publishedEditions({...raw,schemaVersion:2}),/not supported/);
  assert.throws(()=>publishedEditions(feed([edition(),edition()])),/repeated edition/);
  assert.throws(()=>publishedEditions(feed([edition(date,[lesson(),lesson()])])),/IDs/);
  assert.throws(()=>publishedEditions(feed([edition('2026-02-30')])),/date/);
});

test('feed requests use a fixed origin with no private headers and reject oversized, malformed, and timed-out responses',async t=>{
  let options,url;const p=await fetchEditions(async(u,o)=>{url=u;options=o;return response(feed());});
  assert.equal(url,COURIER_FEED);assert.deepEqual(options.headers,{Accept:'application/json'});assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');assert.equal(p.catalog.length,1);
  for(const r of [new Response('bad',{status:503}),new Response('<html>',{headers:{'Content-Type':'text/html'}}),new Response('bad',{headers:{'Content-Type':'application/json'}}),new Response('x'.repeat(2000001),{headers:{'Content-Type':'application/json'}})])await assert.rejects(fetchEditions(async()=>r));
  t.mock.timers.enable({apis:['setTimeout']});
  const timeout=fetchEditions(async(_,o)=>new Promise((resolve,reject)=>o.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')))));
  t.mock.timers.tick(8001);await assert.rejects(timeout,/too long/);
});

test('reviewing editions writes nothing; applying creates private synced lessons without importing completions',async t=>{
  const db=previewDatabase(),calls=[];t.mock.method(globalThis,'fetch',async(url,options)=>{calls.push({url,options});return response(feed());});
  const p=await preview(db);assert.equal(p.added,1);assert.equal((await state(db)).practice,null);assert.equal((await req(db,'/api/history')).data.events.length,0);
  const r=await req(db,'/api/practice/editions','POST',{digest:p.digest,revision:p.revision,pack:{items:['forged completion']},url:'https://other.test'});assert.equal(r.status,200);
  const practice=(await state(db)).practice;assert.equal(practice.mode,'managed');assert.equal(practice.catalog.length,1);assert.deepEqual(practice.items,[]);assert.equal(practice.edition_refresh.latest_edition,date);
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.url===COURIER_FEED));
  assert.equal((await req(db,'/api/state?week='+date,'GET',null,'bob')).data.practice,null);
  assert.equal((await req(db,'/api/practice/editions/preview','POST',{},null)).status,401);
  assert.equal((await req(db,'/api/practice/editions/preview','POST',{},'alice','https://other.test')).status,403);assert.equal(calls.length,2);db.close();
});

test('refresh retains reopened choices, completions, older editions, and snapshot mode',async t=>{
  const db=previewDatabase();let raw=feed([edition('2026-09-06',[lesson(0),lesson(1)])]);t.mock.method(globalThis,'fetch',async()=>response(raw));await refresh(db);
  const [a,b]=(await state(db)).practice.catalog;await act(db,a.id,'complete');await act(db,a.id,'reopen');await act(db,b.id,'complete');const before=(await state(db)).practice;
  raw=feed([edition(date),edition('2026-09-06',[{...lesson(0),title:'Changed title'}])]);const p=await preview(db);assert.equal(p.added,1);assert.equal(p.kept,1);assert.equal(p.retained,1);await req(db,'/api/practice/editions','POST',p);
  let after=(await state(db)).practice;assert.deepEqual(after.items,before.items);assert.equal(after.catalog.find(l=>l.id===a.id).title,a.title);assert.equal(after.catalog.length,3);
  await db.prepare("UPDATE atlas_practice_snapshots SET mode='snapshot' WHERE owner=?").bind('alice').run();raw=feed([]);await refresh(db);after=(await state(db)).practice;
  assert.equal(after.mode,'snapshot');assert.deepEqual(after.items,before.items);assert.equal(after.catalog.length,3);assert.equal(after.edition_refresh.latest_edition,null);db.close();
});

test('feed changes, newer private work, and upstream failures invalidate the refresh without partial writes',async t=>{
  const db=previewDatabase();let raw=feed(),fail=false;t.mock.method(globalThis,'fetch',async()=>fail?new Response('Unavailable',{status:503}):response(raw));await refresh(db);
  let p=await preview(db);raw=feed([edition(date,[lesson(1)])]);assert.equal((await req(db,'/api/practice/editions','POST',p)).status,409);
  p=await preview(db);const id=(await state(db)).practice.catalog[0].id;await act(db,id,'complete');assert.equal((await req(db,'/api/practice/editions','POST',p)).status,409);
  const before=await backup(db);p=await preview(db);fail=true;assert.equal((await req(db,'/api/practice/editions','POST',p)).status,502);assert.equal((await req(db,'/api/practice/editions/preview','POST',{})).status,502);
  assert.deepEqual((await backup(db)).practice,before.practice);db.close();
});

test('a completion arriving during the second feed request is protected by the database revision guard',async t=>{
  const db=previewDatabase();t.mock.method(globalThis,'fetch',async()=>response(feed()));await refresh(db);const p=await preview(db),id=(await state(db)).practice.catalog[0].id;
  t.mock.method(globalThis,'fetch',async()=>{await act(db,id,'complete');return response(feed());});
  assert.equal((await req(db,'/api/practice/editions','POST',p)).status,409);assert.equal((await state(db)).practice.items[0].id,id);db.close();
});

test('refresh provenance survives export and recovery, while an older practice export has no invented refresh date',async t=>{
  const db=previewDatabase();let raw=feed();t.mock.method(globalThis,'fetch',async()=>response(raw));await refresh(db);const before=await backup(db);raw=feed([]);await refresh(db);
  const p=(await req(db,'/api/restore/preview','POST',{backup:before})).data;assert.equal((await req(db,'/api/restore','POST',p)).status,200);
  assert.deepEqual((await state(db)).practice.edition_refresh,before.practice[0].edition_refresh);
  const old={...before,practice:before.practice.map(({edition_refresh,...p})=>p)};
  const older=(await req(db,'/api/restore/preview','POST',{backup:old})).data;assert.equal(older.backup.practice[0].edition_refresh,null);
  const history=(await req(db,'/api/history')).data.events;assert.ok(history.some(h=>h.after?.feed_checked_at));assert.equal(JSON.stringify(history).includes('Explain one idea'),false);db.close();
});

test('the edition metadata migration preserves existing practice bytes, revisions, and history',()=>{
  const db=new DatabaseSync(':memory:'),dir=new URL('../../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for(const f of files.slice(0,5))db.exec(readFileSync(new URL(f,dir),'utf8'));
  db.prepare('INSERT INTO atlas_practice_snapshots (owner,items,catalog,mode,imported_at) VALUES (?,?,?,?,?)').run('alice','[]',JSON.stringify(publishedEditions(feed()).catalog),'managed',stamp);
  const before=db.prepare('SELECT * FROM atlas_practice_snapshots').get(),history=db.prepare('SELECT * FROM atlas_history').all();db.exec(readFileSync(new URL(files[5],dir),'utf8'));
  const {edition_refresh,...after}=db.prepare('SELECT * FROM atlas_practice_snapshots').get();assert.deepEqual({...before},after);assert.equal(edition_refresh,null);assert.deepEqual(db.prepare('SELECT * FROM atlas_history').all(),history);db.close();
});
