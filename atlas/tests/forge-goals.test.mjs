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

test('actual run distances produce mile pace and mph without assuming a 3-mile run',()=>{
 const s=M.runStats({w:'15:00',distance:'1.5',unit:'mi'});assert.equal(s.pace,600);assert.equal(s.mph,6);assert.equal(M.format(s.pace),'10:00');
 const km=M.runStats({w:'10:00',distance:'1.609344',unit:'km'});assert.equal(km.mph,6);assert.equal(km.pace,600);
 for(const distance of ['','0','-1','Infinity','NaN'])assert.equal(M.runStats({w:'15:00',distance,unit:'mi'}),null);
 assert.equal(M.runStats({w:'00:00',distance:'1',unit:'mi'}),null);assert.equal(M.runStats({w:'10:00',distance:'1',unit:'yards'}),null);
});
test('partial trials validate, do not replace the completed 5K and preserve old logs',()=>{
 const e=P.run.build().weeks[0].d1[0],p=M.fresh();
 const short={...entry('08:00'),distance:'0.75',unit:'mi'};assert.doesNotThrow(()=>M.validateEntry('run',e,short));assert.equal(M.fullTrial(e,short),false);
 p.done['0-d1-0-0']=entry('27:00');p.done['4-d1-0-0']=short;assert.equal(M.latestTrial(p),'27:00');
 assert.doesNotThrow(()=>M.validate({version:1,plans:{run:p}}));assert.equal(M.defaults('run',p,'0-d1-0-0').distance,'5');assert.equal(p.done['0-d1-0-0'].distance,undefined);
 assert.equal(M.fullTrial(e,{...entry('27:00'),distance:'3',unit:'mi'}),false);
 assert.equal(M.fullTrial(e,{...entry('27:00'),distance:'3.107',unit:'mi'}),true);
});
test('run averages divide total time by total distance and exclude old unmeasured sets',()=>{
 const p=M.fresh();p.done['1-d1-0-0']={...entry('04:00'),distance:'0.5',unit:'mi'};p.done['1-d1-0-1']={...entry('18:00'),distance:'1.5',unit:'mi'};p.done['1-d1-0-2']=entry('02:00');
 const {stats,unmeasured}=M.runTotals(p,1,'d1');assert.equal(stats.seconds,1320);assert.equal(stats.miles,2);assert.equal(stats.pace,660);assert.equal(M.format(stats.pace),'11:00');assert.equal(unmeasured,1);
});
