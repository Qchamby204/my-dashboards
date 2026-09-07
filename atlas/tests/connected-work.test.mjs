import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {previewDatabase} from '../preview.mjs';
import worker from '../../dist/server/index.js';
import {workHome} from '../work.mjs';
import {emptyAppState,validateAppState} from '../connected-model.mjs';
const day='2026-09-07';
process.env.TZ='America/Winnipeg';
beforeEach(t=>t.mock.timers.enable({apis:['Date'],now:Date.parse(day+'T12:00:00Z')}));
async function request(db,path,method='GET',body,owner='alice'){
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers:{'oai-authenticated-user-id':owner,Origin:'https://atlas.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
async function ok(db,path,method='GET',body,owner){const r=await request(db,path,method,body,owner);assert.ok(r.status<300,JSON.stringify(r));return r.data;}
const state=db=>ok(db,'/api/state?week='+day);
const app=(db,kind)=>ok(db,'/api/connected/'+kind);
async function save(db,kind,raw,version){const before=version?{version}:await app(db,kind);return ok(db,'/api/connected/'+kind,'PUT',{state:raw,version:before.version,day});}
const project=(id='project-one')=>({id,task:'Finish the room plan',area:'Home',due:day,status:'In progress',notes:'Keep this detailed note',pri:'High',sub:'Renovation'});
const video=(id='video-one')=>({id,title:'Write a story',fmt:'long',vert:'General',status:'scheduled',sched:day,script:'The complete script stays here.',opt:{title:{t:'An alternate title',d:true}},metrics:{ctr:6},pub:{p1:true}});
const mapRaw=(...projects)=>({...emptyAppState('life-map'),projects,chores:[{id:'chore-one',chore:'Tidy the desk',cad:'Weekly'}]});
const heraldRaw=(...videos)=>({...emptyAppState('herald'),videos});
const transfer=(...apps)=>({app:'atlas-connected-transfer',version:1,apps});
async function connect(db,pack){const preview=await ok(db,'/api/connected/import/preview','POST',{pack});return ok(db,'/api/connected/import','POST',{pack:preview.pack,digest:preview.digest,seq:preview.seq});}

test('actual full-app saves populate Home without tasks; priorities reference their source and completion is shared',async()=>{
  const db=previewDatabase();try{
    assert.equal((await app(db,'herald')).state.videos.length,0);assert.equal((await ok(db,'/api/history')).events.length,0);
    await save(db,'life-map',mapRaw(project()));await save(db,'herald',heraldRaw(video()));
    let s=await state(db),home=workHome(s,day);assert.equal(s.tasks.length,0);assert.equal(home.dueToday.length,2);
    let p=s.projects[0],c=s.herald.items[0];
    await ok(db,'/api/priorities','POST',{kind:'content',id:c.id,day,action:'choose',revision:s.herald.revision});
    await ok(db,'/api/priorities','POST',{kind:'project',id:p.id,day,action:'choose',revision:p.revision});
    s=await state(db);assert.equal(s.tasks.length,0);assert.equal(workHome(s,day).priorities.length,2);
    const original=await app(db,'herald');original.state.videos[0].title='A revised story';original.state.videos[0].sched='2026-09-10';
    await save(db,'herald',original.state,original.version);
    s=await state(db);assert.equal(workHome(s,day).priorities[0].title,'A revised story');assert.equal(workHome(s,day).priorities[0].due,'2026-09-10');
    await ok(db,'/api/herald/item','PATCH',{id:c.id,action:'publish',day,revision:s.herald.revision});
    s=await state(db);assert.equal(s.herald.items[0].published_day,day);assert.equal(workHome(s,day).priorities.length,1);
    const full=await app(db,'herald');assert.equal(full.state.videos[0].status,'published');assert.equal(full.state.videos[0].script,video().script);assert.deepEqual(full.state.videos[0].metrics,{ctr:6});
    await ok(db,'/api/projects/'+p.id,'PATCH',{action:'complete',revision:s.projects[0].revision});
    const life=await app(db,'life-map');assert.equal(life.state.projects[0].status,'Done');assert.equal(life.state.projects[0].notes,project().notes);assert.equal(life.state.chores.length,1);
    s=await state(db);assert.equal(s.tasks.length,0);assert.equal(s.priorities.length,0);assert.equal(workHome(s,day).completed.length,2);
  }finally{db.close();}
});
test('one shared capacity covers commitments and app records, including racing saves and owner boundaries',async()=>{
  const db=previewDatabase();try{
    await save(db,'life-map',mapRaw(project('p1'),project('p2'),project('p3')));await save(db,'herald',heraldRaw(video()));
    let s=await state(db);
    await ok(db,'/api/priorities','POST',{kind:'project',id:s.projects[0].id,day,action:'choose',revision:s.projects[0].revision});
    await ok(db,'/api/priorities','POST',{kind:'content',id:s.herald.items[0].id,day,action:'choose',revision:s.herald.revision});
    const payload={id:'task-one',title:'Send an outline',app_id:'life-map',project_id:null,week_start:day,due_date:null,minutes:30,focus_day:day};
    const races=await Promise.all([request(db,'/api/tasks','POST',payload),request(db,'/api/priorities','POST',{kind:'project',id:s.projects[1].id,day,action:'choose',revision:s.projects[1].revision})]);
    assert.deepEqual(races.map(r=>r.status<300?200:r.status).sort(),[200,409]);
    s=await state(db);assert.equal(workHome(s,day).priorities.length,3);
    assert.equal((await request(db,'/api/priorities','POST',{kind:'project',id:s.projects[2].id,day,action:'choose',revision:s.projects[2].revision},'bob')).status,409);
    assert.equal((await app(db,'life-map')).state.projects.length,3);
    assert.equal((await ok(db,'/api/connected/life-map','GET',undefined,'bob')).state.projects.length,0);
  }finally{db.close();}
});
test('same-app edits protect a stale full-app draft; unrelated Atlas work does not force re-entry',async()=>{
  const db=previewDatabase();try{
    await save(db,'herald',heraldRaw(video()));const before=await app(db,'herald');
    await save(db,'life-map',mapRaw(project()));before.state.videos[0].script='Changed without copying a task';
    await save(db,'herald',before.state,before.version);
    const stale=await app(db,'herald'),s=await state(db);
    await ok(db,'/api/herald/item','PATCH',{id:s.herald.items[0].id,action:'edit',revision:s.herald.revision,item:{...s.herald.items[0],scheduled_day:'2026-09-12'}});
    stale.state.videos[0].script='Old tab edit';const r=await request(db,'/api/connected/herald','PUT',{state:stale.state,version:stale.version,day});assert.equal(r.status,409);
    const latest=await app(db,'herald');assert.equal(latest.state.videos[0].sched,'2026-09-12');assert.equal(latest.state.videos[0].script,'Changed without copying a task');
  }finally{db.close();}
});
test('one-time connection preserves full details and existing private choices; repeated transfer never overwrites a connected app',async()=>{
  const db=previewDatabase();try{
    await ok(db,'/api/import','POST',{projects:[{source_id:'project-one',title:'Already renamed here',area:'Home',status:'open',due_date:'2026-09-09'}]});
    const pack=transfer({kind:'life-map',state:mapRaw(project())},{kind:'herald',state:heraldRaw({...video(),status:'published'})});
    const preview=await ok(db,'/api/connected/import/preview','POST',{pack});assert.equal((await state(db)).herald,null);
    await ok(db,'/api/connected/import','POST',{pack:preview.pack,digest:preview.digest,seq:preview.seq});
    let s=await state(db);assert.equal(s.projects.length,1);assert.equal(s.projects[0].title,'Already renamed here');assert.equal(s.herald.items[0].published_day,null);
    let life=await app(db,'life-map');assert.equal(life.state.projects[0].notes,project().notes);assert.equal(life.state.projects[0].due,'2026-09-09');
    life.state.projects[0].notes='New private note';await save(db,'life-map',life.state,life.version);
    await connect(db,pack);life=await app(db,'life-map');assert.equal(life.state.projects[0].notes,'New private note');
    assert.equal((await state(db)).tasks.length,0);
  }finally{db.close();}
});
test('deleting an app item archives the shared record, releases its priority, and retains details for restoration',async()=>{
  const db=previewDatabase();try{
    await save(db,'herald',heraldRaw(video()));let s=await state(db),c=s.herald.items[0];
    await ok(db,'/api/priorities','POST',{kind:'content',id:c.id,day,action:'choose',revision:s.herald.revision});
    const full=await app(db,'herald');full.state.videos=[];await save(db,'herald',full.state,full.version);
    s=await state(db);assert.equal(s.herald.items[0].archived,true);assert.equal(s.priorities.length,0);assert.equal((await app(db,'herald')).state.videos.length,0);
    await ok(db,'/api/herald/item','PATCH',{id:c.id,action:'restore',revision:s.herald.revision});
    assert.equal((await app(db,'herald')).state.videos[0].script,video().script);
  }finally{db.close();}
});
test('format 8 restores app details and selected source references atomically; older backups retain connected details',async()=>{
  const db=previewDatabase();try{
    await save(db,'life-map',mapRaw(project()));await save(db,'herald',heraldRaw(video()));let s=await state(db);
    await ok(db,'/api/priorities','POST',{kind:'project',id:s.projects[0].id,day,action:'choose',revision:s.projects[0].revision});
    const backup=await ok(db,'/api/export');assert.equal(backup.version,8);assert.equal(backup.app_states.length,2);assert.equal(backup.priorities.length,1);
    const h=await app(db,'herald');h.state.videos[0].script='Changed later';await save(db,'herald',h.state,h.version);
    const p=await ok(db,'/api/restore/preview','POST',{backup});await ok(db,'/api/restore','POST',{backup:p.backup,seq:p.seq,digest:p.digest});
    assert.equal((await app(db,'herald')).state.videos[0].script,video().script);assert.equal(workHome(await state(db),day).priorities.length,1);
    const older={...backup,version:7};delete older.app_states;delete older.priorities;
    const preview=await ok(db,'/api/restore/preview','POST',{backup:older});assert.equal(preview.legacyConnected,true);assert.equal(preview.backup.app_states.length,2);
    const invalid=structuredClone(backup);invalid.priorities[0].record_id='missing';assert.equal((await request(db,'/api/restore/preview','POST',{backup:invalid})).status,400);
  }finally{db.close();}
});
test('failed history and races roll back source changes and app details together',async()=>{
  const db=previewDatabase();try{
    const before=await app(db,'life-map');
    db.prepare("CREATE TRIGGER connected_history_failure BEFORE INSERT ON atlas_history WHEN NEW.entity='app_states' BEGIN SELECT RAISE(ABORT,'D1 history unavailable'); END").run();
    const r=await request(db,'/api/connected/life-map','PUT',{state:mapRaw(project()),version:before.version,day});assert.equal(r.status,503);
    const s=await state(db);assert.equal(s.projects.length,0);assert.equal(s.connections.length,0);assert.equal((await ok(db,'/api/history')).events.length,0);
  }finally{db.close();}
});
test('unsafe app fields, oversized payloads, foreign origins and anonymous requests fail closed',async()=>{
  assert.throws(()=>validateAppState('herald',heraldRaw({...video(),id:"bad'()"})),/ID/);
  assert.throws(()=>validateAppState('life-map',JSON.parse('{"projects":[],"chores":[],"checks":{},"__proto__":{}}')),/unsupported/);
  assert.throws(()=>validateAppState('herald',heraldRaw({...video(),script:'x'.repeat(1600000)})),/1.5 MB/);
  const db=previewDatabase();try{
    const r=await worker.fetch(new Request('https://atlas.test/api/connected/herald',{method:'PUT',headers:{Origin:'https://other.test','oai-authenticated-user-id':'alice','Content-Type':'application/json'},body:'{}'}),{DB:db});assert.equal(r.status,403);
    const anonymous=await worker.fetch(new Request('https://atlas.test/api/connected/herald'),{DB:db});assert.equal(anonymous.status,401);
  }finally{db.close();}
});
