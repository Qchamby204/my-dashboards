import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_PLAN,dayBounds,type CareEvent} from '../lib/care.ts';
import {buildTrendDays,completedTrendEnd,metricSummary,rollingAverage,volumePeriod} from '../lib/trends.ts';
import {feedingRange,pumpingRange} from '../lib/feeding-plan.ts';
import {trackingEnabled,visibleEvent} from '../lib/tracking.ts';
import {createDraft,entryPayload} from '../lib/entry.ts';

function event(day:string,kind:CareEvent['kind'],extra:Partial<CareEvent>={}):CareEvent {
 return {id:crypto.randomUUID(),kind,subtype:'',startedAt:dayBounds(day)[0],endedAt:null,amount:null,offered:null,duration:null,notes:'',actor:'Test',creatorId:'test',updatedBy:'Test',version:1,deleted:0,createdAt:'',updatedAt:'',...extra};
}
test('rolling averages preserve missing days, real diaper zeroes, and exclude deleted logs',()=>{
 const rows=buildTrendDays([
  event('2026-06-15','feed',{subtype:'milk',amount:100}),
  event('2026-06-17','feed',{subtype:'milk',amount:200}),
  event('2026-06-17','feed',{subtype:'nursing',duration:5}),
  event('2026-06-17','pump',{amount:300}),
  event('2026-06-17','feed',{subtype:'milk',amount:900,deleted:1}),
  event('2026-06-17','diaper',{subtype:'wet'}),
 ],'2026-06-17',7);
 assert.equal(metricSummary(rows,'milk').average,150);
 assert.equal(metricSummary(rows,'milk').recorded,2);
 assert.equal(rows.at(-2)!.values.milk,null);
 assert.equal(rows.at(-1)!.values.dirty,0);
 assert.equal(rows.at(-1)!.values.nursing,5);
 assert.equal(rows.at(-1)!.values.pumping,300);
 assert.equal(rollingAverage(rows,'milk',6),150);
 assert.equal(completedTrendEnd('2026-06-19','2026-06-19'),'2026-06-18');
 assert.equal(completedTrendEnd('2026-06-17','2026-06-19'),'2026-06-17');
});
test('sleep clips overnight intervals and does not double count overlap',()=>{
 const rows=buildTrendDays([
  event('2026-06-16','sleep',{startedAt:'2026-06-17T04:00:00Z',endedAt:'2026-06-17T07:00:00Z'}),
  event('2026-06-17','sleep',{startedAt:'2026-06-17T06:00:00Z',endedAt:'2026-06-17T07:00:00Z'}),
 ],'2026-06-17',2,Date.parse('2026-06-19T00:00Z'));
 assert.equal(rows[0].values.sleep,1);
 assert.equal(rows[1].values.sleep,2);
});
test('feeding uses the supplied ranges by weeks since birth, with an eight-feed comparison',()=>{
 const plan={...DEFAULT_PLAN,birthDate:'2026-05-28'};
 const current=feedingRange(plan,'2026-06-21');
 assert.equal(current.week,3);
 assert.equal(current.low,290);
 assert.equal(current.high,345);
 assert.equal(current.perFeedLow,36);
 assert.equal(current.perFeedHigh,43);
 assert.equal(feedingRange(plan,'2026-06-25').low,315);
 assert.equal(feedingRange(plan,'2026-10-22').low,700);
 assert.equal(feedingRange(plan,'2026-10-29').high,900);
 assert.equal(feedingRange(plan,'2026-11-05').low,null);
 assert.equal(pumpingRange(plan,'2026-06-21').low,290);
 assert.equal(pumpingRange({...plan,pumpGoal:500,pumpGoalMode:'custom'},'2026-06-21').low,500);
});
test('default visibility excludes sleep, nursing and growth without changing saved data',()=>{
 const records=[event('2026-06-17','sleep'),event('2026-06-17','weight',{amount:1920}),event('2026-06-17','feed',{subtype:'nursing',duration:5}),event('2026-06-17','feed',{subtype:'milk',amount:40})];
 assert.equal(trackingEnabled(DEFAULT_PLAN,'sleep'),false);
 assert.deepEqual(records.filter(record=>visibleEvent(DEFAULT_PLAN,record)).map(record=>record.subtype),['milk']);
 const enabled={...DEFAULT_PLAN,tracking:{sleep:true,weight:true,nursing:true}};
 assert.equal(records.filter(record=>visibleEvent(enabled,record)).length,4);
 assert.equal(records.length,4);
});
test('tummy history counts milestone sessions and exercise history counts checked activities',()=>{
 const start=dayBounds('2026-06-17')[0];
 const rows=buildTrendDays([event('2026-06-17','tummy',{endedAt:new Date(Date.parse(start)+60000).toISOString(),tummyCueSeconds:30,tummyComfort:'comfortable'}),event('2026-06-17','exercise',{endedAt:start,subtype:'bike,massage'})],'2026-06-17',1);
 assert.equal(rows[0].values.tummy,1);
 assert.equal(rows[0].tummyComfortable,1);
 assert.equal(rows[0].values.exercise,2);
});
test('new gas exercises preserve every existing checklist ID through entry saves',()=>{
 const saved=event('2026-06-17','exercise',{subtype:'bike,massage,knees,burp',endedAt:dayBounds('2026-06-17')[0]});
 const payload=entryPayload(createDraft('exercise','',saved));
 assert.equal(payload.subtype,'bike,massage,knees,burp');
});

test('period summaries use all recorded days and weighted feed/pump averages for 7, 14 and 30 days',()=>{
 const entries=[
  event('2026-06-17','feed',{subtype:'milk',amount:100}),
  event('2026-06-18','feed',{subtype:'milk',amount:30}),
  event('2026-06-18','feed',{subtype:'milk',amount:30}),
  event('2026-06-18','feed',{subtype:'nursing',duration:5}),
  event('2026-06-17','pump',{amount:120}),
  event('2026-06-18','pump',{amount:60}),
  event('2026-06-18','pump',{amount:60}),
  event('2026-06-19','feed',{subtype:'milk',amount:999}),
 ];
 const history=buildTrendDays(entries,'2026-06-18',66);
 for(const window of [7,14,30]){
  const days=history.slice(-window);
  const milk=volumePeriod(days,'milk',()=>({low:290,high:345}));
  assert.equal(milk.average,80);
  assert.equal(milk.recorded,2);
  assert.equal(milk.sessionsPerDay,1.5);
  assert.equal(milk.perSession,160/3);
  assert.equal(milk.goal.low,290);
  const pump=volumePeriod(days,'pumping',()=>({low:400,high:400}));
  assert.equal(pump.average,120);
  assert.equal(pump.perSession,80);
  assert.equal(pump.sessionsPerDay,1.5);
 }
});
test('period goal averages follow the goals on logged dates and preserve unknown days',()=>{
 const history=buildTrendDays([
  event('2026-06-17','feed',{subtype:'milk',amount:0}),
  event('2026-06-18','feed',{subtype:'milk',amount:320}),
 ],'2026-06-18',7);
 const period=volumePeriod(history,'milk',day=>day==='2026-06-17'?{low:290,high:345}:{low:315,high:375});
 assert.equal(period.average,160);
 assert.equal(period.goal.low,302.5);
 assert.equal(period.goal.high,360);
 assert.equal(period.goalDays,2);
 const partial=volumePeriod(history,'milk',day=>day==='2026-06-17'?{low:null,high:null}:{low:315,high:375});
 assert.equal(partial.goalDays,1);
 assert.equal(partial.recorded,2);
 const empty=volumePeriod(buildTrendDays([],'2026-06-18',7),'milk',()=>({low:290,high:345}));
 assert.equal(empty.average,null);
 assert.equal(empty.perSession,null);
 assert.equal(empty.sessionsPerDay,null);
 assert.equal(empty.goal.low,null);
});

test('mixed diapers count once as a change and lift counts distinguish zero from missing',()=>{
 const day='2026-06-22';
 const next='2026-06-23';
 const endedAt='2026-06-22T06:00:00Z';
 const rows=buildTrendDays([
  event(day,'diaper',{subtype:'both'}),
  event(day,'diaper',{subtype:'wet'}),
  event(day,'tummy',{endedAt,amount:0}),
  event(day,'tummy',{endedAt,amount:5}),
  event(day,'tummy',{amount:9}),
  event(next,'tummy',{endedAt:'2026-06-23T06:00:00Z',amount:null}),
 ],next,2);
 assert.deepEqual([rows[0].values.diapers,rows[0].values.wet,rows[0].values.dirty],[2,2,1]);
 assert.equal(rows[0].values.tummy,2);
 assert.equal(rows[0].values.lifts,5);
 assert.equal(rows[1].values.lifts,null);
 assert.equal(metricSummary(rows,'lifts').average,5);
 assert.equal(buildTrendDays([event(day,'tummy',{endedAt,amount:0})],day,1)[0].values.lifts,0);
});
