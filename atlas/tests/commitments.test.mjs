import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commitmentList,commitmentActions} from '../commitments.mjs';
import {previewDatabase} from '../preview.mjs';
import worker from '../../dist/server/index.js';
const week='2026-09-07';
const task=(id,extra={})=>({id,title:id,app_id:'life-map',project_id:null,week_start:week,due_date:null,minutes:30,status:'open',updated_at:week+'T12:00:00Z',...extra});
test('commitment filters combine status, app, planning and literal title/project search without changing saved records',()=>{
 const data={projects:[{id:'garden',title:'Community garden'}],tasks:[task('a',{title:'Café outline',project_id:'garden',due_date:'2026-09-08'}),task('b',{title:'A completed item',status:'done',week_start:null}),task('c',{title:'Archived item',status:'archived'}),task('d',{title:'Newer item',app_id:'life-ledger',week_start:'2026-09-14',updated_at:'2026-09-08T12:00:00Z'}),task('e',{title:'Another outline',due_date:'2026-09-07'})]},before=structuredClone(data);
 let r=commitmentList(data,week);assert.deepEqual(r.rows.map(t=>t.id),['e','a','d']);assert.deepEqual(r.counts,{open:3,done:1,archived:1});assert.equal(r.all,5);
 assert.deepEqual(commitmentList(data,week,{query:'cafe GARDEN',plan:'selected'}).rows.map(t=>t.id),['a']);assert.equal(commitmentList(data,week,{query:'.*'}).total,0);
 assert.deepEqual(commitmentList(data,week,{status:'all',plan:'unscheduled'}).rows.map(t=>t.id),['b']);assert.equal(commitmentList(data,week,{status:'archived'}).rows[0].id,'c');assert.equal(commitmentList(data,week,{app:'life-ledger'}).total,1);
 assert.equal(commitmentList(data,week,{sort:'updated'}).rows[0].id,'d');assert.equal(commitmentList(data,week,{sort:'title'}).rows[0].id,'e');assert.deepEqual(data,before);
 for(const opts of [{status:'__proto__'},{plan:'tomorrow'},{sort:[]},{query:'a'.repeat(201)},{app:'unknown'}])assert.throws(()=>commitmentList(data,week,opts));
 assert.deepEqual(commitmentActions(task('open')).map(x=>x.action),['complete','archive']);assert.deepEqual(commitmentActions(task('done',{status:'done'})).map(x=>x.action),['reopen','archive']);assert.equal(commitmentActions(task('old',{status:'archived',completed_at:'2026-09-01T12:00:00Z'}))[0].label,'Restore as completed');
});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
 const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+week).then(r=>r.data);
async function change(db,id,action,extra={}){const t=(await state(db)).tasks.find(t=>t.id===id);return req(db,'/api/tasks/'+encodeURIComponent(id),'PATCH',{revision:t.revision,action,...extra});}
test('restoring archived commitments preserves prior completion and planning while clearing daily focus, including encoded IDs',async()=>{
 const db=previewDatabase(),id='review % / ü';assert.equal((await req(db,'/api/tasks','POST',task(id))).status,201);
 assert.equal((await change(db,id,'focus',{day:week})).status,200);assert.equal((await change(db,id,'archive')).status,200);assert.equal((await change(db,id,'restore')).status,200);
 let t=(await state(db)).tasks[0];assert.equal(t.status,'open');assert.equal(t.completed_at,null);assert.equal(t.focus_date,null);assert.equal(t.focus_slot,null);assert.equal(t.week_start,week);assert.equal((await change(db,id,'restore')).status,400);
 await change(db,id,'complete');const completed=(await state(db)).tasks[0].completed_at;await change(db,id,'archive');assert.equal((await state(db)).tasks[0].completed_at,completed);await change(db,id,'restore');t=(await state(db)).tasks[0];assert.equal(t.status,'done');assert.equal(t.completed_at,completed);assert.equal(t.week_start,week);assert.equal((await req(db,'/api/export')).data.tasks[0].completed_at,completed);
 await change(db,id,'reopen');assert.equal((await state(db)).tasks[0].completed_at,null);
});
test('restore enforces owner, origin and revision boundaries and does not overwrite a newer archived edit',async()=>{
 const db=previewDatabase();await req(db,'/api/tasks','POST',task('a'));await change(db,'a','archive');const archived=(await state(db)).tasks[0];
 assert.equal((await req(db,'/api/tasks/a','PATCH',{revision:archived.revision,action:'restore'},'bob')).status,404);assert.equal((await req(db,'/api/tasks/a','PATCH',{revision:archived.revision,action:'restore'},null)).status,401);assert.equal((await req(db,'/api/tasks/a','PATCH',{revision:archived.revision,action:'restore'},'alice','https://elsewhere.test')).status,403);
 await change(db,'a','edit',{...task('a'),title:'Newer saved details'});assert.equal((await req(db,'/api/tasks/a','PATCH',{revision:archived.revision,action:'restore'})).status,409);const current=(await state(db)).tasks[0];assert.equal(current.title,'Newer saved details');assert.equal(current.status,'archived');assert.equal((await change(db,'a','restore')).status,200);assert.equal((await state(db)).tasks[0].title,'Newer saved details');
});
test('a failed restore rolls back its record and history together',async()=>{
 const db=previewDatabase();await req(db,'/api/tasks','POST',task('a'));await change(db,'a','archive');const before=(await state(db)).tasks[0],history=(await req(db,'/api/history')).data;
 await db.prepare("CREATE TRIGGER reject_test_restore AFTER UPDATE ON atlas_tasks WHEN NEW.status!='archived' BEGIN SELECT RAISE(ABORT,'database restore failure'); END").run();
 assert.equal((await change(db,'a','restore')).status,503);assert.deepEqual((await state(db)).tasks[0],before);assert.deepEqual((await req(db,'/api/history')).data,history);
});
