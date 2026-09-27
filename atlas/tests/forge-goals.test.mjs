import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
for(const file of ['forge-goal-plans.js','forge-goal-model.js'])vm.runInContext(readFileSync(new URL('../../shared/'+file,import.meta.url),'utf8'),context);
const {ForgeGoalPlans:P,ForgeGoalModel:M}=context.window;
const plain=o=>JSON.parse(JSON.stringify(o));
const entry=(w,r)=>({w,r,e:'',at:'2026-09-27T12:00:00Z'});
test('four independent eight-week goals preserve test sessions and trunk units',()=>{
 assert.equal(Object.keys(P).length,4);
 for(const plan of Object.values(P)){const b=plan.build();assert.equal(b.weeks.length,8);for(const w of b.weeks)for(const d of ['d1','d2'])assert.ok(w[d].length);}
 assert.equal(P.bench.build().weeks[7].d2.at(-1).rx,'1 @ 315');
 assert.equal(P.deadlift.build().weeks[7].d2.at(-1).rx,'1 x 5 @ 455');
 assert.ok(P.deadlift.build().weeks[0].d2.some(e=>e.rl==='Seconds'));
 assert.ok(P.deadlift.build().weeks[0].d1.some(e=>e.rl==='Metres'));
 assert.equal(P.dunk.build().weeks[7].d2.at(-1).n,'Dunk attempts');
});
test('running paces derive from the entered trial, not the long-term goal',()=>{
 assert.equal(P.run.build('28:00').weeks[1].d1[0].rx,'2:12 each');
 assert.equal(P.run.build('25:00').weeks[1].d1[0].rx,'1:58 each');
 assert.equal(P.run.phase,'Phase 1');
 assert.equal(M.seconds('26:75'),null);
});
test('test warm-ups default per set, and accessory defaults use prior logged weight',()=>{
 const p=M.fresh();assert.equal(M.defaults('bench',p,'7-d2-0-0').w,'45');assert.equal(M.defaults('bench',p,'7-d2-0-4').w,'255');
 assert.equal(M.defaults('deadlift',p,'7-d2-1-4').w,'415');
 p.done['0-d1-1-0']=entry('65','8');assert.equal(M.defaults('bench',p,'0-d1-1-1').w,'65');
});
test('saving partial sessions counts once and all 16 sessions complete a block',()=>{
 const p=M.fresh();p.done['0-d1-0-0']=entry('240','5');
 assert.deepEqual(plain(M.counts('bench',p,0,'d1')),{total:16,logged:1});
 assert.deepEqual(plain(M.next(p)),{week:0,day:'d1'});
 p.completed['0-d1']='2026-09-27T12:00:00Z';assert.deepEqual(plain(M.next(p)),{week:0,day:'d2'});
 for(let w=0;w<8;w++)for(const d of ['d1','d2'])p.completed[`${w}-${d}`]='2026-09-27T12:00:00Z';assert.equal(M.next(p),null);
});
test('record validation rejects invalid sets, unknown goals, invalid dates and phantom sessions',()=>{
 const goals=M.blank(),p=M.fresh();goals.plans.bench=p;p.done['0-d1-0-0']=entry('240','5');assert.doesNotThrow(()=>M.validate(goals));
 p.done['0-d1-0-0'].r='-1';assert.throws(()=>M.validate(goals));p.done['0-d1-0-0'].r='5';
 p.completed['7-d2']='2026-09-27T12:00:00Z';assert.throws(()=>M.validate(goals));delete p.completed['7-d2'];
 p.done['0-d1-0-0'].at='invalid';assert.throws(()=>M.validate(goals));
 assert.throws(()=>M.validate({version:1,plans:{unknown:{}}}));
});
test('touch metrics ignore box-height notes and use the highest approach touch',()=>{
 const p=M.fresh();p.done['0-d1-1-0']=entry('200','');assert.equal(M.metric('dunk',p),'No result logged yet');
 p.done['0-d1-2-0']=entry('123.5','');assert.equal(M.metric('dunk',p),'123.5 in · 3.5 above rim');
 p.done['1-d1-2-0']=entry('122','');assert.equal(M.metric('dunk',p),'123.5 in · 3.5 above rim');
});
