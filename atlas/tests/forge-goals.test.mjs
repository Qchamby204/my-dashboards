import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context=vm.createContext({window:{}});
for(const file of ['forge-goal-plans.js','forge-goal-model.js'])vm.runInContext(readFileSync(new URL('../../shared/'+file,import.meta.url),'utf8'),context);
const {ForgeGoalPlans:P,ForgeGoalModel:M}=context.window;
const plain=o=>JSON.parse(JSON.stringify(o));
const entry=(w,r)=>({w,r,e:'',at:'2026-09-27T12:00:00Z'});
test('four home goals use available equipment in every session across eight weeks',()=>{
 assert.equal(Object.keys(P).length,4);
 for(const plan of Object.values(P)){
   const b=plan.build();assert.equal(b.weeks.length,8);
   for(const w of b.weeks)for(const d of ['d1','d2']){
     assert.ok(w[d].length);
     assert.doesNotMatch(JSON.stringify(w[d]),/barbell|cable|box jump|backboard|track lap|pulldown|machine|kettlebell|straps|weighted dip/i);
   }
 }
 assert.equal(P.bench.build().weeks[7].d2.at(-1).n,'Dumbbell bench press');
 assert.equal(P.deadlift.build().weeks[7].d2.at(-1).n,'Dumbbell Romanian deadlift');
 assert.equal(P.dunk.build().weeks[7].d2.at(-1).n,'Standing jump retest');
});
test('earlier gym sets and drafts keep their prescriptions across backup restoration',()=>{
 const p=M.fresh(),run=M.fresh();p.done['7-d2-3-0']=entry('315','1');
 p.draft={key:'7-d2-0-4',values:{w:'255',r:'1'}};
 const old={version:1,goal:'bench',plans:{bench:p,run}},input=JSON.stringify(old);
 const next=M.validate(old);
 assert.equal(JSON.stringify(old),input);assert.deepEqual(plain(next.gymPlans.bench),plain(p));
 assert.equal(next.plans.bench,undefined);assert.deepEqual(plain(next.plans.run),plain(run));
 assert.equal(M.locate('bench','7-d2-3-0',p.base,context.window.ForgeGymGoalPlans).e.n,'Third attempt');
 assert.deepEqual(plain(M.validate(plain(next))),plain(next));
});
test('running paces derive from the entered trial, not the long-term goal',()=>{
 assert.equal(P.run.build('28:00').weeks[1].d1[0].rx,'2:12 each');
 assert.equal(P.run.build('25:00').weeks[1].d1[0].rx,'1:58 each');
 assert.equal(P.run.phase,'Phase 1');
 assert.equal(M.seconds('26:75'),null);
});
test('strength goals start without an assumed load and retest the first recorded dumbbell',()=>{
 const p=M.fresh();assert.equal(M.defaults('bench',p,'0-d1-0-0').w,'');
 p.done['0-d1-0-0']=entry('35','8');p.done['5-d1-0-0']=entry('45','8');
 assert.equal(M.defaults('bench',p,'5-d1-0-1').w,'45');
 assert.equal(M.defaults('bench',p,'7-d2-0-0').w,'35');
 assert.equal(M.metric('bench',p),'45 lb per dumbbell × 8+ reps');
});
test('saving partial sessions counts once and all 16 sessions complete a block',()=>{
 const p=M.fresh();p.done['0-d1-0-0']=entry('240','5');
 assert.deepEqual(plain(M.counts('bench',p,0,'d1')),{total:18,logged:1});
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
test('touch metrics ignore training notes and unmeasured jumps',()=>{
 const p=M.fresh();p.done['0-d1-2-0']=entry('35 lb dumbbells','');
 p.done['0-d1-1-0']=entry('','');assert.equal(M.metric('dunk',p),'No result logged yet');
 p.done['0-d1-1-1']=entry('123.5','');p.done['1-d1-1-0']=entry('122','');
 assert.equal(M.metric('dunk',p),'123.5 in · 3.5 above rim');assert.doesNotThrow(()=>M.validate({...M.blank(),plans:{dunk:p}}));
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

test('home strength sessions show the workload and time for each phase',()=>{
  for(const id of ['bench','deadlift']){
    const weeks=P[id].build().weeks;
    for(const [index,week] of weeks.entries())for(const day of ['d1','d2']){
      const items=week[day],overview=M.sessionOverview(id,items);
      assert.equal(overview.sets,items.reduce((total,e)=>total+e.sets,0));
      assert.equal(overview.exercises,items.length);
      assert.match(overview.warmup,/practice sets/);
      if(week.phase==='baseline'||week.phase==='build'){
        assert.equal(overview.exercises,6);
        assert.equal(overview.sets,index===0?18:19);
        assert.ok(overview.min>=40&&overview.max<=65);
      }else{
        assert.ok(overview.max<40);
        if(week.phase==='retest'&&day==='d2')assert.equal(overview.sets,1);
      }
    }
  }
  const jumps=P.dunk.build().weeks[0].d1,jump=M.sessionOverview('dunk',jumps);
  assert.equal(jump.exercises,4);assert.equal(jump.sets,11);assert.ok(jump.max<40);
  assert.equal(M.sessionOverview('run',P.run.build().weeks[0].d1),null);
});

test('existing home logs, including completed sessions and drafts, retain exercise identities',()=>{
  const names={
    bench:[['Dumbbell bench press','Bench-supported one-arm dumbbell row','Lying dumbbell triceps extension'],['Paused dumbbell bench press','Incline dumbbell press','Incline dumbbell reverse fly']],
    deadlift:[['Dumbbell Romanian deadlift','Dumbbell split squat','Kneeling ab-wheel rollout'],['Staggered-stance dumbbell Romanian deadlift','Dumbbell glute bridge','Dumbbell suitcase march']]
  };
  for(const [id,days] of Object.entries(names)){
    const p=M.fresh();
    for(let w=0;w<8;w++)for(const [d,exercises] of days.entries()){
      const day='d'+(d+1),retest=w===7&&d===1,light=w===3||w===6;
      for(const [i,name] of (retest?[days[0][0]]:exercises).entries()){
        const oldSets=i===0?(retest?1:light||w===0?2:3):light?1:2;
        const key=M.key(w,day,i,oldSets-1);
        assert.equal(M.locate(id,key,p.base).e.n,name);
        p.done[key]=entry('25','8');
      }
      p.completed[w+'-'+day]='2026-11-20T12:00:00Z';
    }
    p.draft={key:'0-d1-2-1',values:{w:'25',r:'10'}};
    assert.deepEqual(plain(M.validate({...M.blank(),plans:{[id]:p}}).plans[id]),plain(p));
    const sorted=M.orderedExercises(P[id].build().weeks[0].d1);
    assert.deepEqual(plain(sorted.map(item=>item.e.order)),[1,2,3,4,5,6]);
    assert.equal(sorted[2].index,3+(id==='deadlift'?1:0));
  }
});
