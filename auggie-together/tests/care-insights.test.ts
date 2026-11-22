import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLAN, dayBounds, type CareEvent, type Plan} from '../lib/care.ts';
import {buildTrendDays} from '../lib/trends.ts';
import {buildCareInsights, developmentalAge} from '../lib/care-insights.ts';

const end='2026-07-04';
function event(day:string,kind:CareEvent['kind'],changes:Partial<CareEvent>={}):CareEvent {
  return {id:crypto.randomUUID(),kind,subtype:'',startedAt:dayBounds(day)[0],endedAt:null,
    amount:null,offered:null,duration:null,notes:'',actor:'QA',creatorId:'qa',updatedBy:'QA',
    version:1,deleted:0,createdAt:'',updatedAt:'',...changes};
}
function rows(events:CareEvent[],plan:Plan=DEFAULT_PLAN){
  return buildCareInsights(buildTrendDays(events,end,14),plan,events.filter(e=>e.kind==='weight'),end);
}
test('weekly insight excludes today and missing days and honours the target on the recorded date',()=>{
  const plan:Plan={...DEFAULT_PLAN, goalHistory:[300,400].map((dailyGoal,i)=>({
    from:i?'2026-07-02':'2026-06-14',dailyGoal,feedingGoalMode:'daily',mlKgGoal:null,interval:null,feedTarget:null
  }))};
  const [feed]=rows([
    event('2026-06-29','feed',{amount:300}),event(end,'feed',{amount:400}),
    event('2026-07-05','feed',{amount:30}),event(end,'feed',{subtype:'nursing',duration:5}),
    event(end,'feed',{amount:100,deleted:1}),
  ],plan);
  assert.equal(feed.value,'350');
  assert.equal(feed.context,'2 logged days');
  assert.equal(feed.visual.kind,'days');
  if(feed.visual.kind==='days'){
    assert.deepEqual(feed.visual.marks.map(m=>m.actual),[null,300,null,null,null,null,400]);
    assert.deepEqual(feed.visual.marks.map(m=>m.low),[300,300,300,300,400,400,400]);
  }
  assert.match(feed.detail,/matched the target across 2 days/);
  assert.match(feed.detail,/400 mL/);
});
test('tummy time counts practice independently of observation coverage and compares adjacent weeks',()=>{
  const tummy=(day:string,o:CareEvent['tummyObservation'])=>event(day,'tummy',{endedAt:dayBounds(day)[0],tummyObservation:o});
  const [row]=rows([tummy('2026-06-25','rested'),tummy(end,'lifted'),tummy(end,'held'),tummy(end,'session')]);
  assert.equal(row.value,'3');
  assert.equal(row.context,'1 practice day');
  assert.deepEqual(row.visual,{kind:'observations',current:{all:2,lifts:2},previous:{all:1,lifts:0}});
  assert.match(row.detail,/2 of 2 sessions with a head observation, compared with 0 of 1/);
});
test('wet zeroes, single measured weights and hidden categories are handled',()=>{
  const logs=[event(end,'diaper',{subtype:'dirty'}),event('2026-07-03','weight',{amount:2400}),event('2026-07-05','weight',{amount:2450})];
  const summary=rows(logs,{...DEFAULT_PLAN,wetTarget:5,tracking:{weight:true}});
  assert.equal(summary[0].value,'2,400');
  assert.deepEqual(summary[0].visual,{kind:'weight',measures:[{day:'2026-07-03',grams:2400}]});
  assert.equal(summary[1].visual.kind,'days');
  if(summary[1].visual.kind==='days') assert.deepEqual(summary[1].visual.marks.map(m=>m.actual),[null,null,null,null,null,null,0]);
  assert.match(summary[0].detail,/One weigh-in/);
  assert.match(summary[1].detail,/0 of 1 logged day/);
  assert.deepEqual(rows(logs,{...DEFAULT_PLAN,tracking:{diaper:false}}),[]);
  assert.deepEqual(rows([]),[]);
});
test('age uses the saved due date, including the days before and immediately after it',()=>{
  assert.equal(developmentalAge('2026-07-21','2026-07-05'),'16 days until his due date');
  assert.equal(developmentalAge('2026-07-21','2026-07-21'),'Today is his due date');
  assert.equal(developmentalAge('2026-07-21','2026-07-29'),'1 week, 1 day corrected age');
});
