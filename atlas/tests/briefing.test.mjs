import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dailyBriefing,localDay} from '../model.mjs';
import {localBriefing,dailySummary} from '../../shared/atlas-workflow-core.mjs';
const today='2026-09-07';
const task=(id,extra={})=>({id,title:id,app_id:'the-herald',status:'open',week_start:today,minutes:30,due_date:null,...extra});
const project=(id,extra={})=>({id,title:id,status:'open',due_date:today,...extra});
test('briefing respects explicit priorities and includes dated work from across the app registry without mutations',()=>{
  const data={tasks:[task('later-slot',{focus_date:today,focus_slot:2}),task('first-slot',{focus_date:today,focus_slot:1,app_id:'courier'}),task('late',{due_date:'2026-09-06',app_id:'life-ledger'}),task('completed',{status:'done',due_date:'2026-09-01'}),task('archived',{status:'archived',due_date:'2026-09-01'})],projects:[project('live'),project('completed-project',{status:'done'}),project('archived-project',{archived_at:'2026-09-01'})]};
  const before=JSON.stringify(data),result=dailyBriefing(data,today);
  assert.equal(result.next.id,'first-slot');assert.equal(result.reason,'Your first chosen priority');
  assert.deepEqual(result.deadlines.map(x=>x.id),['late','live']);assert.equal(result.overdue.length,1);
  assert.equal(JSON.stringify(data),before);
});
test('briefing ranks urgent work, bounds the upcoming window, and handles empty and invalid dates',()=>{
  const data={tasks:[task('carry',{week_start:'2026-08-31'}),task('due',{due_date:today}),task('invalid',{due_date:'2026-02-31'})],projects:[project('overdue',{due_date:'2026-09-06'}),project('boundary',{due_date:'2026-09-14'}),project('far',{due_date:'2026-09-15'})]};
  const b=dailyBriefing(data,today);assert.equal(b.next.id,'overdue');assert.equal(b.carryover.length,1);
  assert.deepEqual(b.upcoming.map(x=>x.id),['boundary']);
  data.projects=[];assert.equal(dailyBriefing(data,today).next.id,'due');
  data.tasks=data.tasks.filter(t=>t.id!=='due');assert.equal(dailyBriefing(data,today).next.id,'carry');
  assert.equal(dailyBriefing({},today).next,null);assert.throws(()=>dailyBriefing({},'bad'),/valid briefing date/);
  assert.equal(dailyBriefing({tasks:[task('unscheduled',{week_start:null})]},today).next.id,'unscheduled');
});
test('capacity uses the actual calendar week, retains a chosen zero, and completed-today uses local dates',()=>{
  const now=new Date(2026,8,7,0,5),data={tasks:[task('a'),task('done',{status:'done',completed_at:now.toISOString()}),task('old',{week_start:'2026-08-31'}),task('archive',{status:'archived'})],week:{week_start:today,capacity:0}};
  let b=dailyBriefing(data,localDay(now));assert.equal(b.plannedMinutes,60);assert.equal(b.capacity,0);assert.equal(b.overCapacity,60);assert.equal(b.completed,1);
  data.week.week_start='2026-08-31';b=dailyBriefing(data,today);assert.equal(b.capacity,null);assert.equal(b.overCapacity,null);
  assert.equal(dailyBriefing(data,'2026-09-08').completed,0);
});
test('Home briefing never treats an unreadable source as zero and only suggests available, uncompleted practice',()=>{
  const source={getItem:key=>key==='lifemap_v1'?'broken':null};
  let s=dailySummary(source,{days:[]},new Date(2026,8,7));let b=localBriefing(s);assert.equal(b.overdue,null);assert.equal(b.next,null);
  s={...s,issues:[],mapPresent:true,due:[],pending:[{title:'Rehearse an opening',day:today}]};
  assert.equal(localBriefing(s,false).next,null);assert.equal(localBriefing(s,true).next.source,'Courier');
  s.due=[{title:'Prepare a project',due:today,reason:'Due today'}];assert.equal(localBriefing(s).next.source,'Life Map');assert.equal(localBriefing(s).dueToday,1);
});
