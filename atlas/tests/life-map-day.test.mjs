import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLifeMapWorkflow} from '../life-map-workflow-core.mjs';
import {validateLifeMapRecords as validate} from '../life-map-records.mjs';
import {validateAppState} from '../connected-model.mjs';
const M=createLifeMapWorkflow(),today='2026-10-05';
const task=(id,extra={})=>({id,task:'Task '+id,area:'Work — Content',status:'Not started',pri:'Med',...extra});
const board=(projects=[],extra={})=>({projects,chores:[],checks:{},planned:{},log:[],...extra});

test('five prepared dinners cover Monday–Friday and remind on Thursday',()=>{
 const food={start:today,dinners:5};
 assert.equal(M.mealStatus(food,'2026-10-07').remaining,3);
 assert.equal(M.mealStatus(food,'2026-10-07').remind,'2026-10-08');
 assert.equal(M.mealStatus(food,'2026-10-07').needsPrep,false);
 assert.equal(M.mealStatus(food,'2026-10-08').needsPrep,true);
 assert.equal(M.mealStatus(food,'2026-10-09').remaining,1);
 assert.equal(M.mealStatus(food,'2026-10-10').remaining,0);
 assert.equal(M.mealStatus(food,'2026-10-10').expired,true);
});
test('skipping an evening retains a dinner and shifts the next prep reminder',()=>{
 const food={start:today,dinners:5,skipDates:['2026-10-07']};
 const status=M.mealStatus(food,'2026-10-07');
 assert.equal(status.last,'2026-10-10');assert.equal(status.remind,'2026-10-09');assert.equal(status.remaining,3);
 assert(!status.dates.includes('2026-10-07'));
});
test('coverage works across daylight savings and a year boundary without mutating records',()=>{
 const food={start:'2026-10-31',dinners:3},bytes=JSON.stringify(food);
 assert.deepEqual(M.dinnerDates(food),['2026-10-31','2026-11-01','2026-11-02']);
 assert.equal(JSON.stringify(food),bytes);
 assert.equal(M.mealStatus({start:'2026-12-30',dinners:4},'2027-01-01').remaining,2);
});
test('unset, future, one-dinner and invalid coverage have defined behavior',()=>{
 assert.equal(M.mealStatus(null,today).set,false);
 assert.equal(M.mealStatus({start:'2026-10-06',dinners:2},today).startsLater,true);
 assert.equal(M.mealStatus({start:today,dinners:1},today).remind,today);
 for(const c of [{start:'2026-02-30',dinners:3},{start:today,dinners:0},{start:today,dinners:3,skipDates:['bad']}])assert.equal(M.mealStatus(c,today).set,false);
});
test('extending prepared dinners removes a due reminder as coverage grows',()=>{
 const food={start:today,dinners:5};
 assert(M.mealStatus(food,'2026-10-08').needsPrep);
 assert.equal(M.mealStatus({...food,dinners:9},'2026-10-08').needsPrep,false);
});
test('category views preserve catch-all sub-area meaning and explicit chore areas',()=>{
 assert.equal(M.categoryFor({area:'Life Admin & Documents',sub:'Work — Growth'}),'work');
 assert.equal(M.categoryFor({area:'House — Interior'}),'household');
 assert.equal(M.categoryFor({area:'Food System',chore:'Kitchen reset'}),'food');
 assert.equal(M.categoryFor({chore:'Grocery shop',zone:'Kitchen'}),'food');
 assert.equal(M.categoryFor({area:'Unusual custom area'}),'admin');
});
test('a saved plan, coverage and ideal-day template round-trip through both adapters',()=>{
 const b=board([task('main')],{mealCoverage:{start:today,dinners:5,skipDates:[],reminderTime:'09:00'},dayPlans:{[today]:{reviewed:true,mainTaskId:'main',blocks:[{id:'b',title:'Focus',start:'09:00',minutes:60,category:'work',taskId:'main',done:false}],focus:{kind:'task',id:'main'}}},dayTemplates:{weekday:[{id:'anchor',title:'Focus',start:'09:00',minutes:60}]}});
 assert.deepEqual(validate(b),b);assert.deepEqual(validateAppState('life-map',b),b);
});
test('opening and calculating recommendations leave legacy records exactly unchanged',()=>{
 const b=board([task('main',{plan:today})]),bytes=JSON.stringify(b);
 validate(b);M.dayRecommendation(b,today,'09:00');M.mealStatus(b.mealCoverage,today);
 assert.equal(JSON.stringify(b),bytes);assert.equal(b.dayPlans,undefined);
});
test('actual deadlines surface before optional free-time work; explicit focus remains stable',()=>{
 const b=board([task('due',{due:today}),task('main')],{dayPlans:{[today]:{reviewed:true,mainTaskId:'main',blocks:[]}}});
 assert.equal(M.dayRecommendation(b,today,'09:00').id,'due');
 b.dayPlans[today].focus={kind:'task',id:'main'};
 assert.equal(M.dayRecommendation(b,today,'09:00').id,'main');
 b.projects[1].status='Done';assert.equal(M.dayRecommendation(b,today,'09:00').id,'due');
});
test('scheduled blocks surface in their window and are never completed by the clock',()=>{
 const b=board([],{dayPlans:{[today]:{reviewed:true,blocks:[{id:'prep',title:'Meal prep',start:'17:00',minutes:30,category:'food',done:false}]}}});
 assert.equal(M.dayRecommendation(b,today,'17:15').id,'prep');
 const bytes=JSON.stringify(b);M.dayRecommendation(b,today,'18:00');assert.equal(JSON.stringify(b),bytes);
 b.dayPlans[today].focus={kind:'block',id:'prep'};
 assert.equal(M.dayRecommendation(b,today,'18:00').id,'prep');
});
test('existing to-dos do not require a priority form or unknown dinner coverage',()=>{
 const b=board([task('main',{plan:today,effortMinutes:20})]);
 assert.equal(M.dayRecommendation(b,today,'09:00').id,'main');
 b.dayPlans={[today]:{reviewed:true,blocks:[]}};
 assert.equal(M.dayRecommendation(b,today,'09:00').id,'main');
 b.mealCoverage={start:today,dinners:5};
 assert.equal(M.dayRecommendation(b,'2026-10-08','09:00').kind,'food');
});
test('due routines come before optional work, but deadlines and current blocks stay first',()=>{
 const b=board([task('optional',{plan:today})]),routines=[{id:'laundry',chore:'Laundry',category:'household'}];
 assert.equal(M.dayRecommendation(b,today,'09:00',{routines}).id,'laundry');
 b.projects.push(task('due',{due:today}));
 assert.equal(M.dayRecommendation(b,today,'09:00',{routines}).id,'due');
 b.projects.pop();b.dayPlans={[today]:{blocks:[{id:'gym',title:'Gym',start:'09:00',minutes:60}]}};
 assert.equal(M.dayRecommendation(b,today,'09:00',{routines}).id,'gym');
});
test('reset only chooses known-duration work that fits and keeps waiting/future tasks out',()=>{
 const b=board([task('short',{plan:today,effortMinutes:10}),task('long',{plan:today,effortMinutes:60}),task('unknown',{plan:today}),task('wait',{plan:today,status:'Waiting',effortMinutes:5}),task('future',{plan:'2026-10-06',effortMinutes:5})],{mealCoverage:{start:today,dinners:5},dayPlans:{[today]:{reviewed:true,mainTaskId:'long',blocks:[]}}});
 assert.equal(M.dayRecommendation(b,today,'09:00',{available:15}).id,'short');
 assert.equal(M.dayRecommendation(b,today,'09:00',{available:5}).kind,'free');
});
test('invalid coverage, overlapping blocks and unsupported template times fail without altering input',()=>{
 const base=board(),bytes=JSON.stringify(base);
 for(const c of [{start:today,dinners:-1},{start:today,dinners:61},{start:today,dinners:2,skipDates:[today,today]}])assert.throws(()=>validate({...base,mealCoverage:c}));
 const blocks=[{id:'one',title:'One',start:'09:00',minutes:60},{id:'two',title:'Two',start:'09:30',minutes:30}];
 assert.throws(()=>validate({...base,dayPlans:{[today]:{blocks}}}),/overlap/);
 assert.throws(()=>validate({...base,dayTemplates:{weekday:[{id:'one',title:'One',start:'23:45',minutes:60}]}}));
 assert.equal(JSON.stringify(base),bytes);
});
test('calendar alert uses the coverage reminder date and an actual VALARM',()=>{
 const f=M.mealStatus({start:today,dinners:5},today),ics=M.calendarReminder({id:'dinner',title:'Prep next dinners',date:f.remind});
 assert.match(ics,/DTSTART:20261008T090000/);assert.match(ics,/BEGIN:VALARM/);
});

