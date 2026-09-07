import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {parseHeraldTransfer,heraldContent,heraldWeek} from '../herald.mjs';
const day='2026-09-07',stamp=day+'T12:00:00.000Z';
const item=(id='atlas:one',extra={})=>({id,source_id:null,title:'A useful explanation',format:'long',audience:'General',stage:'draft',scheduled_day:day,published_day:null,note:'Outline the opening.',archived:false,...extra});
const legacy=()=>({videos:[{id:'v-one',title:'A first idea',fmt:'long',vert:'General',status:'scheduled',sched:day,script:'excluded script',kw:'excluded keyword',opt:{private:'excluded checklist'},metrics:{secret:'excluded metric'}}],cadence:{},weeks:{},leads:[{name:'excluded lead'}],roadmap:[{private:'excluded strategy'}]});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+day).then(x=>x.data);
const backup=db=>req(db,'/api/export').then(x=>x.data);
async function preview(db,b=legacy()){const r=await req(db,'/api/herald/import/preview','POST',{pack:await parseHeraldTransfer(b)});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function apply(db,b=legacy()){const p=await preview(db,b),r=await req(db,'/api/herald/import','POST',p);assert.equal(r.status,200,JSON.stringify(r.data));}
async function create(db,r=item(),revision){return req(db,'/api/herald/item','POST',{item:r,revision:revision??(await state(db)).herald?.revision??0});}
async function edit(db,id,action,extra={}){return req(db,'/api/herald/item','PATCH',{id,action,revision:(await state(db)).herald?.revision||0,...extra});}

test('Herald migration preserves every earlier record and history entry while adding an empty owner table',()=>{
  const db=new DatabaseSync(':memory:'),dir=new URL('../../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files.slice(0,7))db.exec(readFileSync(new URL(file,dir),'utf8'));
  db.prepare('INSERT INTO atlas_communication (owner,reps,updated_at) VALUES (?,?,?)').run('alice','[]',stamp);
  const before=db.prepare('SELECT * FROM atlas_communication').all(),history=db.prepare('SELECT * FROM atlas_history').all();
  db.exec(readFileSync(new URL(files[7],dir),'utf8'));assert.deepEqual(db.prepare('SELECT * FROM atlas_communication').all(),before);assert.deepEqual(db.prepare('SELECT * FROM atlas_history').all(),history);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM atlas_herald').get().n,0);db.close();
});
test('Herald imports accept original file and transfer envelopes, retain stable source IDs, and omit scripts, leads and analytics',async()=>{
  const b=legacy(),p=await parseHeraldTransfer(b),wrapped=await parseHeraldTransfer({app:'herald',v:1,at:stamp,state:b});
  assert.deepEqual(wrapped.items,p.items);assert.equal(wrapped.exportedAt,stamp);assert.equal(p.items[0].source_id,'v-one');assert.equal(p.items[0].note,'');
  for(const phrase of ['excluded','script','keyword','metrics','leads','roadmap'])assert.equal(JSON.stringify(p).includes(phrase),false);
  const changed=await parseHeraldTransfer({...b,videos:[{...b.videos[0],title:'Source correction',status:'optimized'}]});assert.equal(changed.items[0].id,p.items[0].id);assert.equal(changed.items[0].stage,'approved');
  await assert.rejects(parseHeraldTransfer({...b,videos:[...b.videos,...b.videos]}),/duplicate/);
  await assert.rejects(parseHeraldTransfer({...b,videos:[{...b.videos[0],sched:'2026-02-30'}]}),/date/);
  await assert.rejects(parseHeraldTransfer({...b,videos:[{...b.videos[0],status:'__proto__'}]}),/stage/);
  await assert.rejects(parseHeraldTransfer({...b,app:'other'}),/backup/);
  assert.throws(()=>heraldContent({items:[item('atlas:bad',{source_id:'source'})]}),/ID/);
  assert.throws(()=>heraldContent({items:[item('atlas:bad',{archived:'false'})]}),/archive/);
  assert.throws(()=>heraldContent({items:Array.from({length:1001},(_,i)=>item('atlas:'+i))}),/1,000/);
  assert.throws(()=>heraldContent({items:Array.from({length:500},(_,i)=>item('atlas:'+i,{note:'x'.repeat(3000)}))}),/1.5 MB/);
});
test('planned dates never become publication evidence; weekly summaries use actual recorded dates and omit archives',async()=>{
  const b=legacy();b.videos[0].status='published';b.videos[0].published_at=stamp;
  const p=await parseHeraldTransfer(b);assert.equal(p.items[0].published_day,null);assert.deepEqual(heraldWeek(p,day),{planned:[],published:[]});
  const current=heraldContent({items:[item(),item('atlas:actual',{stage:'published',scheduled_day:'2026-08-31',published_day:day}),item('atlas:earlier',{stage:'published',published_day:'2026-08-31'}),item('atlas:archived',{stage:'published',published_day:day,archived:true}),item('atlas:later',{scheduled_day:'2026-09-14'})]});
  assert.deepEqual(heraldWeek(current,day).planned.map(x=>x.id),['atlas:one']);assert.deepEqual(heraldWeek(current,day).published.map(x=>x.id),['atlas:actual']);
  assert.throws(()=>heraldContent({items:[item('atlas:contradiction',{published_day:day})]}),/Only a published/);
});
test('native content saves and identical retries remain private and record only one create event',async()=>{
  const db=previewDatabase(),r=item();assert.equal((await create(db,r,0)).status,200);const seq=(await req(db,'/api/history')).data.seq;
  assert.equal((await create(db,r,0)).status,200);assert.equal((await req(db,'/api/history')).data.seq,seq);
  assert.equal((await create(db,{...r,title:'Different retry'},0)).status,409);
  assert.equal((await edit(db,r.id,'edit',{item:{...r,stage:'published',published_day:day}})).status,200);
  assert.equal(heraldWeek((await state(db)).herald,day).published.length,1);
  assert.equal((await req(db,'/api/state?week='+day,'GET',null,'bob')).data.herald,null);
  assert.equal((await req(db,'/api/herald/item','PATCH',{id:r.id,action:'archive',revision:0},'bob')).status,404);
  assert.equal((await req(db,'/api/herald/item','POST',{item:r,revision:0},null)).status,401);
  assert.equal((await req(db,'/api/herald/item','POST',{item:r,revision:0},'alice','https://other.test')).status,403);
  assert.deepEqual((await req(db,'/api/export','GET',null,'bob')).data.herald,[]);db.close();
});
test('reviewed additive imports keep renamed, rescheduled, reopened and archived content intact',async()=>{
  const db=previewDatabase(),p=await preview(db);assert.equal((await state(db)).herald,null);assert.equal((await req(db,'/api/history')).data.seq,0);
  await req(db,'/api/herald/import','POST',p);const r=(await state(db)).herald.items[0];
  const saved={...r,title:'My saved title',stage:'draft',scheduled_day:null,note:'My private next step'};await edit(db,r.id,'edit',{item:saved});await edit(db,r.id,'archive');
  const b=legacy();b.videos[0].title='Changed source title';b.videos[0].status='published';b.videos.push({...b.videos[0],id:'v-two'});
  const next=await preview(db,b);assert.equal(next.added,1);assert.equal(next.kept,1);assert.equal(next.rows.find(x=>x.action==='Keep').title,'My saved title');
  await req(db,'/api/herald/import','POST',next);assert.deepEqual((await state(db)).herald.items.find(x=>x.id===r.id),{...saved,archived:true});
  await apply(db,{...b,videos:[]});assert.equal((await state(db)).herald.items.length,2);await edit(db,r.id,'restore');assert.equal((await state(db)).herald.items.find(x=>x.id===r.id).archived,false);db.close();
});
test('stale or altered import previews and simultaneous content edits preserve newer saved work',async()=>{
  const db=previewDatabase(),p=await preview(db);await create(db);assert.equal((await req(db,'/api/herald/import','POST',p)).status,409);
  const changed=await preview(db);changed.pack.items[0].title='Changed after review';assert.equal((await req(db,'/api/herald/import','POST',changed)).status,409);
  const revision=(await state(db)).herald.revision,results=await Promise.all([create(db,item('atlas:two'),revision),create(db,item('atlas:three'),revision)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal((await state(db)).herald.revision,revision+1);db.close();
});
test('format 6 backup and recovery reverse content changes; formats 1–5 retain the current content plan',async()=>{
  const db=previewDatabase();await create(db);await edit(db,'atlas:one','archive');const before=await backup(db);assert.equal(before.version,6);
  await edit(db,'atlas:one','restore');await create(db,item('atlas:two',{stage:'published',published_day:day}));const current=(await state(db)).herald;
  const p=(await req(db,'/api/restore/preview','POST',{backup:before})).data;assert.equal(p.changes.find(x=>x.key==='herald').replace,1);
  const restored=await req(db,'/api/restore','POST',p);assert.equal(restored.status,200);assert.deepEqual((await state(db)).herald.items,before.herald[0].items);
  const h=(await req(db,'/api/history')).data;assert.equal((await req(db,'/api/checkpoints/'+restored.data.checkpoint+'/undo','POST',{seq:h.seq})).status,200);assert.deepEqual((await state(db)).herald.items,current.items);
  for(const version of [1,2,3,4,5]){
    const old={...before,version};delete old.herald;if(version<5)delete old.communication;if(version<4)delete old.ledger;if(version===1)delete old.practice;
    const plan=await req(db,'/api/restore/preview','POST',{backup:old});assert.equal(plan.status,200);assert.equal(plan.data.legacyHerald,true);assert.deepEqual(plan.data.backup.herald[0].items,current.items);
    assert.equal((await req(db,'/api/restore','POST',plan.data)).status,200);assert.deepEqual((await state(db)).herald.items,current.items);
  }
  const invalid={...before};delete invalid.herald;assert.equal((await req(db,'/api/restore/preview','POST',{backup:invalid})).status,400);db.close();
});
test('Herald history excludes note text and failed history writes roll back edits and full workspace restores',async()=>{
  const db=previewDatabase();await create(db);const before=await backup(db),p=(await req(db,'/api/restore/preview','POST',{backup:before})).data;
  await edit(db,'atlas:one','edit',{item:item('atlas:one',{note:'A private updated note'})});assert.equal((await req(db,'/api/restore','POST',p)).status,409);
  const current=(await state(db)).herald,h=(await req(db,'/api/history')).data;assert.ok(h.events.some(e=>e.entity==='herald'&&e.after.item_count===1));assert.equal(JSON.stringify(h).includes('A private updated note'),false);
  db.prepare("CREATE TRIGGER herald_history_failure BEFORE INSERT ON atlas_history WHEN NEW.entity='herald' BEGIN SELECT RAISE(ABORT,'D1 history failure'); END;").run();
  assert.equal((await edit(db,'atlas:one','archive')).status,503);assert.deepEqual((await state(db)).herald,current);
  const restore=(await req(db,'/api/restore/preview','POST',{backup:before})).data;assert.equal((await req(db,'/api/restore','POST',restore)).status,503);
  assert.deepEqual((await state(db)).herald,current);assert.deepEqual((await req(db,'/api/history')).data,h);db.close();
});
