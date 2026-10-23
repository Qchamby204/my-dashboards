import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLifeMapCalendarModel} from '../life-map-calendar-core.mjs';
import {validateLifeMapRecords} from '../life-map-records.mjs';
import {validateAppState} from '../connected-model.mjs';
const K=createLifeMapCalendarModel();
const task=(id,extra={})=>({id,task:id,status:'Not started',area:'House — Interior',...extra});
const state=(projects=[],groups=[])=>({projects,groups,chores:[],checks:{},planned:{},log:[]});
test('calendar months and daily spans cross years, leap days and daylight savings',()=>{
 assert.equal(K.shiftMonth('2026-12',1),'2027-01');assert.equal(K.shiftMonth('2027-01',-1),'2026-12');
 assert.equal(K.monthEnd('2028-02'),'2028-02-29');assert.equal(K.monthEnd('2027-02'),'2027-02-28');
 assert.equal(K.distance('2026-10-31','2026-11-02'),2);assert.equal(K.plus('2026-11-01',1),'2026-11-02');
 assert.equal(K.shiftMonth('2026-10',11),'2027-09');
});
test('project ranges include task dates, respect explicit dates and exclude archived tasks',()=>{
 const g={id:'g',title:'Renovation'},s=state([task('a',{parentId:'g',plan:'2026-10-24'}),task('b',{parentId:'g',due:'2026-11-14'}),task('old',{parentId:'g',due:'2027-12-01',archived:true})],[g]);
 const before=JSON.stringify(s);assert.deepEqual(K.projectRange(s,g),{start:'2026-10-24',end:'2026-11-14',derived:true});
 assert(K.inMonth(K.projectRange(s,g),'2026-11'));assert(!K.inMonth(K.projectRange(s,g),'2026-12'));assert.equal(JSON.stringify(s),before);
 assert.deepEqual(K.projectRange(s,{...g,startDate:'2026-12-01',endDate:'2026-12-18'}),{start:'2026-12-01',end:'2026-12-18',derived:false});
 assert.equal(K.projectRange(state(),g),null);
});
test('month bars clip to the calendar and include the final day',()=>{
 assert.deepEqual(K.bar({start:'2026-09-28',end:'2026-11-12'},'2026-10'),{left:0,width:100});
 const b=K.bar({start:'2026-10-31',end:'2026-11-02'},'2026-10');assert(Math.abs(b.left-30/31*100)<.0001);assert(Math.abs(b.width-100/31)<.0001);
});
test('calendar projects and dated tasks remain distinct and do not invent dates',()=>{
 const s=state([task('one',{parentId:'g',plan:'2026-10-23',due:'2026-10-23'}),task('two',{due:'2026-10-24'}),task('undated'),task('hidden',{due:'2026-10-24',archived:true})],[{id:'g',title:'Project'},{id:'empty',title:'Unscheduled'},{id:'archive',title:'Old',archived:true}]);
 assert.deepEqual(K.events(s,'2026-10').map(e=>[e.date,e.task.id]),[['2026-10-23','one'],['2026-10-24','two']]);
 assert.equal(K.projects(s).length,2);assert.equal(K.projects(s)[1].range,null);
});
test('project dates round-trip public/private adapters and reject invalid or reversed ranges',()=>{
 const s=state([],[{id:'g',title:'Project',startDate:'2026-10-23',endDate:'2027-01-01'}]);
 assert.deepEqual(validateLifeMapRecords(s),s);assert.deepEqual(validateAppState('life-map',s),s);
 for(const [startDate,endDate]of [['2026-02-30','2026-03-03'],['2026-10-24','2026-10-23']])assert.throws(()=>validateLifeMapRecords(state([],[{id:'g',title:'Project',startDate,endDate}])));
 assert.doesNotThrow(()=>validateLifeMapRecords(state([],[{id:'g',title:'Legacy project'}])));
});
test('a task planned and due on the same day keeps both meanings in one calendar entry',()=>{
 const s=state([task('both',{plan:'2026-10-23',due:'2026-10-23'}),task('plan-only',{plan:'2026-10-24'}),task('split',{plan:'2026-10-25',due:'2026-10-27'})]);
 const ev=K.events(s,'2026-10');
 const both=ev.find(e=>e.task.id==='both');
 assert.deepEqual(both.kinds,['plan','due']);assert.equal(both.label,'Planned · Deadline');
 assert.equal(ev.filter(e=>e.task.id==='both').length,1,'still one entry for that day');
 assert.deepEqual(ev.find(e=>e.task.id==='plan-only').kinds,['plan']);
 assert.deepEqual(ev.filter(e=>e.task.id==='split').map(e=>[e.date,e.label]),[['2026-10-25','Planned'],['2026-10-27','Deadline']]);
});
