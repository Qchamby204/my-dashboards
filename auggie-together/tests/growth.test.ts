import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dayBounds,type CareEvent} from '../lib/care.ts';
import {growthSummary,weightHistory} from '../lib/growth.ts';
const weight=(day:string,amount:number,extra:Partial<CareEvent>={}):CareEvent=>({id:crypto.randomUUID(),kind:'weight',subtype:'',startedAt:dayBounds(day)[0],endedAt:null,amount,offered:null,duration:null,notes:'',actor:'Test',creatorId:'test',updatedBy:'Test',version:1,deleted:0,createdAt:'',updatedAt:'',...extra});
test('irregular weigh-ins calculate daily gain over elapsed dates, not recorded days',()=>{
 const rows=[weight('2026-06-03',1800),weight('2026-06-16',2150),weight('2026-06-23',2340)];
 const result=growthSummary(rows,'2026-06-25',7);
 assert.equal(result.interval,7);assert.equal(result.gain,190);assert.equal(result.dailyGain,190/7);assert.equal(result.ageDays,2);
 assert.equal(result.trendDays,7);assert.equal(result.trendGain,190/7);
 assert.equal(growthSummary(rows,'2026-06-16').dailyGain,350/13);
 assert.equal(growthSummary(rows,'2026-06-16').latest?.amount,2150);
});
test('same-day readings do not create zero-day rates; deletions and future readings are excluded',()=>{
 const rows=[weight('2026-06-14',1900),weight('2026-06-14',1920,{startedAt:'2026-06-14T18:00:00Z'}),weight('2026-06-21',2100,{deleted:1}),weight('2026-06-28',2200)];
 assert.equal(weightHistory(rows,'2026-06-23').length,1);
 assert.equal(growthSummary(rows,'2026-06-23').latest?.amount,1920);
 assert.equal(growthSummary(rows,'2026-06-23').dailyGain,null);
 assert.equal(growthSummary([],'2026-06-23').latest,null);
});
test('a new dated measurement recalibrates gain and selected-window trend without filling missing weights',()=>{
 const rows=[weight('2026-06-16',2150),weight('2026-06-23',2340),weight('2026-07-02',2538)];
 for(const range of [1,7,14,30]){
  const summary=growthSummary(rows,'2026-07-02',range);
  assert.equal(summary.dailyGain,22);assert.equal(summary.latest?.amount,2538);
  assert.equal(summary.history.length,3);
 }
 assert.equal(growthSummary(rows,'2026-07-02',14).trendGain,388/16);
 const loss=growthSummary([weight('2026-06-14',2000),weight('2026-06-21',1930)],'2026-06-21');
 assert.equal(loss.dailyGain,-10);
});
