import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {parseCommunicationTransfer,communicationContent,communicationWeek} from '../communication.mjs';

const day='2026-09-07',stamp=day+'T12:00:00.000Z';
const rep=(id='atlas:one',extra={})=>({id,day,topic:'Explain a new idea',drill:'Free practice',skill:'Clarity',note:'Keep the opening simple.',archived:false,source_timestamp:null,...extra});
const legacy=()=>({reps:[{date:stamp,topic:'A thoughtful question',drill:'Listen and respond',skill:'Listening',score:99}],assessments:[{secret:'excluded assessment'}],lessonsDone:{private:true},grades:[{secret:'excluded grade'}],prepNotes:'excluded preparation'});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+day).then(x=>x.data);
const backup=db=>req(db,'/api/export').then(x=>x.data);
async function preview(db,b=legacy()){const r=await req(db,'/api/communication/import/preview','POST',{pack:await parseCommunicationTransfer(b)});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function apply(db,b=legacy()){const p=await preview(db,b),r=await req(db,'/api/communication/import','POST',p);assert.equal(r.status,200,JSON.stringify(r.data));}
async function create(db,r=rep(),revision){return req(db,'/api/communication/rep','POST',{rep:r,revision:revision??(await state(db)).communication?.revision??0});}
async function edit(db,id,action,extra={}){return req(db,'/api/communication/rep','PATCH',{id,action,revision:(await state(db)).communication?.revision||0,...extra});}

test('the speaking migration adds an empty private log without altering earlier records or history',()=>{
  const db=new DatabaseSync(':memory:'),dir=new URL('../../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files.slice(0,6))db.exec(readFileSync(new URL(file,dir),'utf8'));
  db.prepare('INSERT INTO atlas_ledger (owner,habits,days,updated_at) VALUES (?,?,?,?)').run('alice','[]','[]',stamp);
  const before=db.prepare('SELECT * FROM atlas_ledger').all(),history=db.prepare('SELECT * FROM atlas_history').all();
  db.exec(readFileSync(new URL(files[6],dir),'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM atlas_ledger').all(),before);assert.deepEqual(db.prepare('SELECT * FROM atlas_history').all(),history);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM atlas_communication').get().n,0);db.close();
});
test('legacy speaking projection excludes assessment data and gives reordered sessions stable distinct IDs',async()=>{
  const b=legacy();b.reps.push({...b.reps[0]}, {...b.reps[0],topic:'A second topic'});
  const p=await parseCommunicationTransfer(b),reordered=await parseCommunicationTransfer({...b,reps:b.reps.toReversed()});
  assert.deepEqual(p,reordered);assert.equal(new Set(p.reps.map(r=>r.id)).size,3);
  assert.equal(p.reps[0].source_timestamp,stamp);assert.equal(p.reps[0].note,'');
  for(const excluded of ['score','assessment','grade','preparation','lessonsDone'])assert.equal(JSON.stringify(p).includes(excluded),false);
  await assert.rejects(parseCommunicationTransfer({...b,reps:[{...b.reps[0],date:'2026-02-30T00:00:00Z'}]}),/timestamp/);
  await assert.rejects(parseCommunicationTransfer({reps:[],app:'another-app'}),/Export progress/);
  assert.throws(()=>communicationContent({reps:[rep(),rep()]}),/duplicate/);
  assert.throws(()=>communicationContent({reps:[rep('atlas:invalid',{archived:'false'})]}),/archive/);
  assert.throws(()=>communicationContent({reps:Array.from({length:3001},(_,i)=>rep('atlas:'+i))}),/3,000/);
  assert.throws(()=>communicationContent({reps:Array.from({length:800},(_,i)=>rep('atlas:'+i,{note:'x'.repeat(2000)}))}),/1.5 MB/);
});
test('an imported day uses the browser timezone once and survives canonical review in UTC',async()=>{
  const source=new URL('../communication.mjs',import.meta.url).href;
  const script=`import {parseCommunicationTransfer} from ${JSON.stringify(source)};const p=await parseCommunicationTransfer(${JSON.stringify({...legacy(),reps:[{...legacy().reps[0],date:'2026-09-08T01:00:00.000Z'}]})});process.stdout.write(JSON.stringify(p));`;
  const p=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',script],{env:{...process.env,TZ:'America/Winnipeg'},encoding:'utf8'}));
  assert.equal(p.reps[0].day,'2026-09-07');assert.equal((await parseCommunicationTransfer(p)).reps[0].day,'2026-09-07');
});
test('native sessions save privately, retry once without duplication, and contribute only active sessions to review',async()=>{
  const db=previewDatabase(),r=rep();assert.equal((await create(db,r,0)).status,200);
  const before=(await req(db,'/api/history')).data.seq;
  assert.equal((await create(db,r,0)).status,200);assert.equal((await req(db,'/api/history')).data.seq,before);
  assert.equal((await create(db,{...r,note:'Different retry'},0)).status,409);
  assert.equal((await edit(db,r.id,'edit',{rep:{...r,note:'A revised note'}})).status,200);
  let c=(await state(db)).communication;assert.equal(c.reps[0].note,'A revised note');assert.equal(communicationWeek(c,day).length,1);
  assert.equal(communicationWeek(c,'2026-09-14').length,0);
  assert.equal((await edit(db,r.id,'archive')).status,200);assert.equal(communicationWeek((await state(db)).communication,day).length,0);
  assert.equal((await edit(db,r.id,'restore')).status,200);
  assert.equal((await req(db,'/api/state?week='+day,'GET',null,'bob')).data.communication,null);
  assert.equal((await req(db,'/api/communication/rep','PATCH',{id:r.id,action:'archive',revision:0},'bob')).status,404);
  assert.equal((await req(db,'/api/communication/rep','POST',{rep:r,revision:0},null)).status,401);
  assert.equal((await req(db,'/api/communication/rep','POST',{rep:r,revision:0},'alice','https://other.test')).status,403);
  assert.equal((await req(db,'/api/export','GET',null,'bob')).data.communication.length,0);db.close();
});
test('reviewed imports write nothing until applied and preserve edited and archived sessions across repeated imports',async()=>{
  const db=previewDatabase(),p=await preview(db);assert.equal((await state(db)).communication,null);assert.equal((await req(db,'/api/history')).data.seq,0);
  assert.equal((await req(db,'/api/communication/import','POST',p)).status,200);
  const r=(await state(db)).communication.reps[0];await edit(db,r.id,'edit',{rep:{...r,topic:'My saved topic',day:'2026-09-06',note:'Keep this private note'}});await edit(db,r.id,'archive');
  const b=legacy();b.reps.push({...b.reps[0],topic:'A new session'});const next=await preview(db,b);assert.equal(next.kept,1);assert.equal(next.added,1);
  await req(db,'/api/communication/import','POST',next);const c=(await state(db)).communication;
  assert.equal(c.reps.length,2);assert.deepEqual(c.reps.find(x=>x.id===r.id),{...r,topic:'My saved topic',day:'2026-09-06',note:'Keep this private note',archived:true});
  await apply(db,b);assert.deepEqual((await state(db)).communication.reps,c.reps);db.close();
});
test('stale and edited import previews and simultaneous native writes cannot replace newer speaking practice',async()=>{
  const db=previewDatabase(),p=await preview(db);await create(db);assert.equal((await req(db,'/api/communication/import','POST',p)).status,409);
  const modified=await preview(db);modified.pack.reps[0].topic='Changed after review';assert.equal((await req(db,'/api/communication/import','POST',modified)).status,409);
  const revision=(await state(db)).communication.revision;
  const results=await Promise.all([create(db,rep('atlas:two'),revision),create(db,rep('atlas:three'),revision)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await state(db)).communication.revision,revision+1);
  const unchanged=(await state(db)).communication;
  assert.equal((await req(db,'/api/communication/rep','PATCH',{id:'atlas:one',action:'edit',rep:rep('atlas:one',{day:'2026-02-30'}),revision:unchanged.revision})).status,400);
  assert.deepEqual((await state(db)).communication,unchanged);db.close();
});
test('version 5 recovery retains notes and archive choices, while versions 1–4 retain current speaking practice',async()=>{
  const db=previewDatabase();await create(db);await edit(db,'atlas:one','archive');const before=await backup(db);assert.equal(before.version,5);
  await edit(db,'atlas:one','restore');await create(db,rep('atlas:two'));
  const p=(await req(db,'/api/restore/preview','POST',{backup:before})).data;assert.equal(p.changes.find(x=>x.key==='communication').replace,1);
  const restored=await req(db,'/api/restore','POST',p);assert.equal(restored.status,200);assert.deepEqual((await state(db)).communication.reps,before.communication[0].reps);
  const h=(await req(db,'/api/history')).data;assert.equal((await req(db,'/api/checkpoints/'+restored.data.checkpoint+'/undo','POST',{seq:h.seq})).status,200);
  const current=(await state(db)).communication;assert.equal(current.reps.length,2);assert.equal(current.reps[0].archived,false);
  for(const version of [1,2,3,4]){
    const old={...before,version};delete old.communication;if(version<4)delete old.ledger;if(version===1)delete old.practice;
    const previewed=await req(db,'/api/restore/preview','POST',{backup:old});assert.equal(previewed.status,200);assert.equal(previewed.data.legacyCommunication,true);
    assert.deepEqual(previewed.data.backup.communication[0].reps,current.reps);assert.equal((await req(db,'/api/restore','POST',previewed.data)).status,200);
    assert.deepEqual((await state(db)).communication.reps,current.reps);
  }
  const malformed={...before};delete malformed.communication;assert.equal((await req(db,'/api/restore/preview','POST',{backup:malformed})).status,400);db.close();
});
test('compact speaking history is atomic and its changes invalidate pending workspace recovery',async()=>{
  const db=previewDatabase();await create(db);const b=await backup(db),p=(await req(db,'/api/restore/preview','POST',{backup:b})).data;
  await edit(db,'atlas:one','edit',{rep:rep('atlas:one',{note:'A private revised note'})});assert.equal((await req(db,'/api/restore','POST',p)).status,409);
  const before=(await state(db)).communication,history=(await req(db,'/api/history')).data;
  assert.ok(history.events.some(h=>h.entity==='communication'&&h.after.rep_count===1));assert.equal(JSON.stringify(history).includes('A private revised note'),false);
  db.prepare("CREATE TRIGGER speaking_history_failure BEFORE INSERT ON atlas_history WHEN NEW.entity='communication' BEGIN SELECT RAISE(ABORT,'D1 history failure'); END;").run();
  assert.equal((await edit(db,'atlas:one','archive')).status,503);assert.deepEqual((await state(db)).communication,before);
  const restorePlan=(await req(db,'/api/restore/preview','POST',{backup:b})).data;
  assert.equal((await req(db,'/api/restore','POST',restorePlan)).status,503);
  assert.deepEqual((await state(db)).communication,before);assert.deepEqual((await req(db,'/api/history')).data,history);db.close();
});
