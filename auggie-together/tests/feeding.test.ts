import {test} from 'node:test';import assert from 'node:assert/strict';import {feedingDay,countdown,milkReminder,leftoverDeadline} from '../lib/feeding.ts';import {DEFAULT_PLAN,type CareEvent,dayBounds} from '../lib/care.ts';
const day='2026-06-17';const [startedAt]=dayBounds(day);const ev=(kind:string,amount:number|null,extra={})=>({id:crypto.randomUUID(),kind,subtype:'milk',amount,startedAt,...extra}) as CareEvent;
test('1900g reference, nursing and pumping never inflate bottle average',()=>{const d=feedingDay([ev('feed',40),ev('feed',30),ev('feed',null,{subtype:'nursing'}),ev('pump',100)],[],DEFAULT_PLAN,day);assert.equal(d.milk,70);assert.equal(d.average,35);assert.equal(d.nursing,1);assert.equal(d.referenceLow,285);assert.equal(d.referenceHigh,342);assert.equal(d.goal,null);});
test('weight-based approved goal follows measured weights as of each day',()=>{const weights=[ev('weight',1900),ev('weight',2000,{startedAt:'2026-06-19T12:00:00Z'})];const p={...DEFAULT_PLAN,interval:3,mlKgGoal:160};assert.equal(feedingDay([],weights,p,day).goal,304);assert.equal(feedingDay([],weights,p,day).perFeed,38);assert.equal(feedingDay([],weights,p,'2026-06-19').goal,320);assert.equal(feedingDay([],[],p,day).goal,null);});
test('fixed goals remain fixed and plan history does not rewrite prior days',()=>{const p={...DEFAULT_PLAN,dailyGoal:320,goalHistory:[{from:day,dailyGoal:300,mlKgGoal:null,interval:3,feedTarget:null},{from:'2026-06-19',dailyGoal:320,mlKgGoal:null,interval:3,feedTarget:null}]};assert.equal(feedingDay([],[],p,'2026-06-16').goal,null);assert.equal(feedingDay([],[],p,day).goal,300);assert.equal(feedingDay([],[],p,'2026-06-19').goal,320);});
test('countdown derives from saved time and does not restart after expiry',()=>{assert.equal(countdown('2026-06-17T15:30:00Z',Date.parse('2026-06-17T12:00:00Z')),'3h 30m 00s');assert.equal(countdown('2026-06-17T15:30:00Z',Date.parse('2026-06-17T15:30:00Z')),'Limit reached');});

test('refrigeration reminder always uses original expression time plus 210 minutes',()=>{const deadline=milkReminder('2026-06-17T12:00:00Z');assert.equal(deadline,'2026-06-17T15:30:00.000Z');assert.equal(countdown(deadline,Date.parse('2026-06-17T12:00:00Z')),'3h 30m 00s');});

test('leftover bottles use two hours after feed end or an earlier limit',()=>{assert.equal(leftoverDeadline('2026-06-17T12:00:00Z'),'2026-06-17T14:00:00.000Z');assert.equal(leftoverDeadline('2026-06-17T12:00:00Z','2026-06-17T13:00:00Z'),'2026-06-17T13:00:00.000Z');assert.equal(leftoverDeadline('2026-06-17T12:00:00Z','2026-06-17T16:00:00Z'),'2026-06-17T14:00:00.000Z');const d=feedingDay([ev('bottle',20)],[],DEFAULT_PLAN,day);assert.equal(d.milk,0);assert.equal(d.bottles,0);});

test('weight-based goals distinguish a missing weight from an unset goal',()=>{const result=feedingDay([],[],{...DEFAULT_PLAN,mlKgGoal:160},day);assert.equal(result.goal,null);assert.equal(result.needsWeight,true);assert.equal(feedingDay([],[],{...DEFAULT_PLAN,dailyGoal:300},day).needsWeight,false);assert.equal(feedingDay([],[],DEFAULT_PLAN,day).needsWeight,false);});

test('tracker ranges use the goal mode, rate, weight, and interval effective on that day',async()=>{
 const {feedingRange,pumpingRange}=await import('../lib/feeding-plan.ts');
 const weights=[ev('weight',2100),ev('weight',2250,{startedAt:'2026-06-19T12:00:00Z'})];
 const plan={
  ...DEFAULT_PLAN,feedingGoalMode:'weight' as const,mlKgGoal:160,pumpGoalMode:'custom' as const,pumpGoal:450,
  goalHistory:[
   {from:day,dailyGoal:null,mlKgGoal:150,interval:3,feedTarget:null,pumpGoal:400},
   {from:'2026-06-19',dailyGoal:null,mlKgGoal:160,interval:4,feedTarget:null,pumpGoal:450},
  ],
 };
 assert.equal(feedingRange(plan,day,weights).low,315);
 assert.equal(feedingRange(plan,day,weights).plannedFeeds,8);
 assert.equal(feedingRange(plan,'2026-06-19',weights).low,360);
 assert.equal(feedingRange(plan,'2026-06-19',weights).plannedFeeds,6);
 assert.equal(pumpingRange(plan,day,weights).low,400);
});

test('auto feeding goal uses the recorded weight from the adjustment date',async()=>{
 const {feedingRange,pumpingRange}=await import('../lib/feeding-plan.ts');
 const weights=[
  ev('weight',2100,{startedAt:'2026-06-23T17:00:00Z'}),
  ev('weight',2400,{startedAt:'2026-06-30T12:00:00Z'}),
  ev('weight',2500,{startedAt:'2026-07-07T16:00:00Z'}),
 ];
 const before=feedingRange(DEFAULT_PLAN,'2026-06-29',weights);
 assert.deepEqual([before.low,before.high,before.goalWeight],[315,375,null]);
 const adjusted=feedingRange(DEFAULT_PLAN,'2026-06-30',weights);
 assert.deepEqual([adjusted.low,adjusted.high,adjusted.perFeedLow,adjusted.perFeedHigh,adjusted.goalWeight],[360,432,45,54,2400]);
 const next=feedingRange(DEFAULT_PLAN,'2026-07-07',weights);
 assert.deepEqual([next.low,next.high],[375,450]);
 assert.equal(feedingRange(DEFAULT_PLAN,'2026-07-21',weights).goalWeight,null);
 assert.equal(feedingRange(DEFAULT_PLAN,'2026-06-30',[]).low,315);
 assert.equal(feedingRange({...DEFAULT_PLAN,feedingGoalMode:'daily',dailyGoal:400},'2026-06-30',weights).low,400);
 assert.deepEqual(pumpingRange({...DEFAULT_PLAN,pumpGoalMode:'custom',pumpGoal:450},'2026-06-30',weights),{low:450,high:450,followsFeeding:false});
});
