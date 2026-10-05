import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createLifeMapOperations} from '../life-map-ops.mjs';
import {lifeMapOpsScript} from '../build-life-map-ops.mjs';
const root=new URL('../../',import.meta.url),html=await readFile(new URL('operations-cadence.html',root),'utf8'),catalog=vm.runInNewContext('('+html.match(/const DATA = (\[[\s\S]*?\n\]);/)[1]+')');
const today='2026-09-17',clock=()=>Date.parse(today+'T18:00:00Z');
function fixture(value){const data=new Map(value===undefined?[]:[['operationsCadence.v1',typeof value==='string'?value:JSON.stringify(value)]]),writes=[];const storage={getItem:k=>data.get(k)??null,setItem(k,v){writes.push(k);data.set(k,v);},removeItem(k){writes.push(k);data.delete(k);}};return {data,writes,storage,ops:createLifeMapOperations(catalog,storage,clock),state:()=>JSON.parse(data.get('operationsCadence.v1'))};}
test('all shipped cadences are derived from Ops; opening never writes either board',async()=>{
 const a=fixture();assert.deepEqual(a.ops.groups,['daily','weekly','monthly','quarterly','annually','adhoc']);assert.equal(a.ops.rows(today).length,catalog.reduce((n,c)=>n+c.tasks.length,0));assert.equal(a.writes.length,0);assert.equal(a.data.size,0);const script=await lifeMapOpsScript(root);assert.ok(script.includes('operationsCadence.v1'));assert.ok(script.includes(catalog[0].tasks[0].t));
});
test('custom additions, renames, notes, log deadlines and unrelated fields stay in their source',()=>{
 const value={custom:{monthly:[{cid:'cone',t:'Monthly custom review',sys:'CRM'}]},overrides:{'daily:0':'My commission review'},'daily:0':{note:'Reference note'},log:[{id:'lone',text:'One-off account follow-up',due:'2026-09-21',done:false,category:'Client Service'}],untouched:{value:42}},a=fixture(value),raw=a.data.get(a.ops.key),rows=a.ops.rows(today);
 assert.equal(rows.find(r=>r.id==='ops:daily:0').title,'My commission review');assert.equal(rows.find(r=>r.id==='ops:daily:0').notes,'Reference note');assert.equal(rows.find(r=>r.id==='ops:monthly:cone').system,'CRM');assert.equal(rows.find(r=>r.id==='ops:log:lone').due,'2026-09-21');assert.equal(a.data.get(a.ops.key),raw);assert.equal(a.writes.length,0);
 a.ops.scheduleMany(['ops:daily:0','ops:monthly:cone','ops:log:lone'],today);assert.deepEqual(a.state().untouched,value.untouched);assert.deepEqual(a.state().log,value.log);assert.deepEqual(a.state().custom,value.custom);assert.deepEqual(a.state().overrides,value.overrides);assert.equal(a.ops.planned(today).length,3);assert.ok(a.writes.every(k=>k===a.ops.key));
});
test('each cadence resets in its own period and future planning does not carry current checkmarks',()=>{
 const a=fixture({'daily:0':{done:true,p:today},'weekly:0':{done:true,p:'W2026-09-14'},'monthly:0':{done:true,p:'M2026-8'},'quarterly:0':{done:true,p:'Q2026-2'},'annually:0':{done:true,p:'Y2026'},'adhoc:0':{done:true,p:'perm'}});
 for(const g of a.ops.groups)assert.equal(a.ops.find('ops:'+g+':0',today).status,'Done');
 for(const [g,d] of [['daily','2026-09-18'],['weekly','2026-09-21'],['monthly','2026-10-01'],['quarterly','2026-10-01'],['annually','2027-01-01']])assert.equal(a.ops.find('ops:'+g+':0',d).status,'Not started');assert.equal(a.ops.find('ops:adhoc:0','2027-01-01').status,'Done');
 assert.equal(a.ops.period('weekly','2027-01-01'),'W2026-12-28');assert.equal(a.ops.period('monthly','2026-12-31'),'M2026-11');
});
test('moving a pin reuses its source task, and completion keeps the original notes and a dated history',()=>{
 const a=fixture({'daily:0':{note:'Keep this'},recur:{'monthly:0':{kind:'monthday',day:31}}});a.ops.schedule('ops:daily:0','2026-09-18');a.ops.schedule('ops:daily:0',today);assert.equal(a.ops.planned('2026-09-18').length,0);assert.equal(a.ops.planned(today).length,1);
 const before=a.data.get(a.ops.key),ticket=a.ops.complete('ops:daily:0',today),s=a.state();assert.equal(s['daily:0'].done,true);assert.equal(s['daily:0'].p,today);assert.equal(s['daily:0'].note,'Keep this');assert.equal(s.sched['daily:0'],undefined);assert.equal(s.events.length,1);assert.equal(s.events[0].key,'daily:0');assert.equal(s.events[0].planDate,today);assert.equal(a.ops.planned(today)[0].status,'Done');
 a.ops.schedule('ops:daily:0','2026-09-18');assert.equal(a.ops.planned(today)[0].status,'Done');assert.equal(a.ops.planned('2026-09-18')[0].status,'Not started');assert.throws(()=>a.ops.undo(ticket),/changed after/);
 const b=fixture(JSON.parse(before)),undo=b.ops.complete('ops:daily:0',today);b.ops.undo(undo);assert.equal(b.data.get(b.ops.key),before);
});
test('ad hoc completion preserves the true deadline and updates the Ops log',()=>{
 const a=fixture({log:[{id:'lone',text:'Client review',due:'2026-09-19',done:false,category:'Planning'}]});a.ops.schedule('ops:log:lone',today);a.ops.complete('ops:log:lone',today);assert.equal(a.state().log[0].due,'2026-09-19');assert.equal(a.state().log[0].done,true);assert.equal(a.state().events[0].logId,'lone');assert.equal(a.state().events[0].category,'Planning');
});
test('explicit recurrence overrides a bucket and clamps dates without DST drift',()=>{
 const a=fixture({recur:{'daily:0':{kind:'weekday',wd:1}},'daily:0':{done:true,p:today,lastDone:today}});assert.equal(a.ops.find('ops:daily:0','2026-09-18').status,'Done');assert.equal(a.ops.find('ops:daily:0','2026-09-21').status,'Not started');assert.equal(a.ops.find('ops:daily:0',today).schedule,'Every Monday');
 assert.equal(a.ops.occurrence({kind:'monthday',day:31},'2026-02-28'),'2026-02-28');assert.equal(a.ops.occurrence({kind:'yearly',month:1,day:29},'2027-02-28'),'2027-02-28');assert.equal(a.ops.occurrence({kind:'everyn',n:3,anchor:'2026-03-05'},'2026-03-08'),'2026-03-08');
});
test('invalid or stale selections, corrupt storage, quota failure and future completion never replace records',()=>{
 const a=fixture({extra:'keep'}),raw=a.data.get(a.ops.key);assert.throws(()=>a.ops.scheduleMany(['ops:daily:0','gone'],today));assert.equal(a.data.get(a.ops.key),raw);a.storage.setItem=()=>{throw Error('quota');};assert.throws(()=>a.ops.schedule('ops:daily:0',today),/could not be saved/);assert.equal(a.data.get(a.ops.key),raw);
 const b=fixture('{broken');assert.throws(()=>b.ops.schedule('ops:daily:0',today),/recover/);assert.equal(b.data.get(b.ops.key),'{broken');
 const c=fixture();c.ops.schedule('ops:daily:0','2026-09-18');const future=c.data.get(c.ops.key);assert.throws(()=>c.ops.complete('ops:daily:0','2026-09-18'));assert.equal(c.data.get(c.ops.key),future);
});
