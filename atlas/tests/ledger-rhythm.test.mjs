import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const context=vm.createContext({window:{}});vm.runInContext(readFileSync(new URL('../../shared/ledger-rhythm-core.js',import.meta.url),'utf8'),context);const R=context.window.LedgerRhythm,cfg={kind:'minutes',chunk:100},today='2026-10-08',week='2026-10-05';
test('weekly catch-up counts only the difference and never creates dated check-ins',()=>{
 const prefs={catchups:{[week]:{Read:{amount:50,sessions:3}}}},rows=[{date:week,units:{Read:20}}];assert.equal(R.total(rows,'Read',cfg,prefs,today),50);assert.equal(R.weekly(rows,'Read',cfg,prefs,week,today).unlogged,3);
 rows.push({date:'2026-10-06',units:{Read:30}});assert.equal(R.total(rows,'Read',cfg,prefs,today),50);rows.push({date:'2026-10-07',units:{Read:10}});assert.equal(R.total(rows,'Read',cfg,prefs,today),60);
});
test('explicit missed days are known while untouched dates remain unknown',()=>{
 const w=R.weekly([{date:week,units:{},missed:['Read']},{date:'2026-10-06',units:{Read:20}}],'Read',cfg,{},week,today);assert.equal(w.sessions,1);assert.equal(w.unlogged,2);
});
test('smaller weeks change targets without removing lasting progress',()=>{
 const rows=[{units:{Read:30}},{date:'2025-01-01',units:{Read:20}},{date:'2027-01-01',units:{Read:100}}],prefs={weeks:{[week]:'reduced'}};assert.equal(R.goal('Read',cfg,prefs).reduced,2);assert.equal(R.total(rows,'Read',cfg,prefs,today),50);
});
test('milestones start at their saved baseline; only actual deadlines require a date',()=>{
 const g={type:'milestone',mode:'sessions',normal:4,reduced:2,target:100,baseline:50,due:''};assert.doesNotThrow(()=>R.validate({goals:{Read:g}}));assert.throws(()=>R.validate({goals:{Read:{...g,type:'deadline'}}}));assert.equal(R.milestone([{units:{Read:80}}],'Read',cfg,{goals:{Read:g}},today).amount,30);
});
test('focus excludes LinkedIn and is limited to three unique choices',()=>{
 assert.throws(()=>R.validate({focus:['Read','Read']}));assert.throws(()=>R.validate({focus:['LinkedIn Strategy']}));assert.equal(R.focus(['Read','Run / Work Out','Screen Discipline','LinkedIn Strategy'],{}).length,3);
});
test('combined screen-time boundary is strict and old gaming totals do not confirm scrolling',()=>{
 const h=R.SCREEN,c={kind:'count'};assert.equal(R.value({units:{},leisure:{gamingMinutes:40}},h,c),0);assert.equal(R.value({leisure:{screenMinutes:59,screenConfirmed:true}},h,c),1);assert.equal(R.value({units:{[h]:1},leisure:{screenMinutes:60,screenConfirmed:true}},h,c),0);
});

test('XP normalizes existing check-in amounts; partial work counts and levels continue past 99',()=>{
 assert.equal(R.experience(25,{kind:'qty',def:25}).xp,100);assert.equal(R.experience(5,{kind:'qty',def:25}).xp,20);assert.equal(R.experience(1,{kind:'count'}).xp,100);
 const progress=R.levelProgress(100100);assert.equal(progress.level,100);assert.equal(progress.remaining,900);assert.equal(progress.fraction,.1);
});

test('each habit reaches 99 after 52 reference weeks without depending on editable goals',()=>{
 for(const [h,cfg,weekly] of [['Run / Work Out',{kind:'count'},3],['Read',{kind:'qty',def:25},4],['Screen Discipline',{kind:'count'},7],['Board Work',{kind:'qty',def:30},1],['Custom',{kind:'count'},3]]){
  const target=52*weekly*R.xpUnit(cfg);
  assert.equal(R.experience(target,cfg,h).level,99);
  assert(R.experience(target-R.xpUnit(cfg),cfg,h).level<99);
  assert.equal(R.experience(target*2,cfg,h).level,198);
  assert.equal(R.experience(target,cfg,h).into,0);
 }
 assert.equal(R.levelProgress(52*62*100,R.lifeCost).level,99);
 assert.equal(R.levelProgress(52*14*100,R.lifeCost).level,22);
 const cost=R.annualCost('Read')+R.annualCost('Screen Discipline');
 assert.equal(R.levelProgress(52*(4+7)*100,cost).level,99);
});

test('explicit missed Screen Discipline overrides a previously confirmed total',()=>{
 const row={units:{[R.SCREEN]:1},missed:[R.SCREEN],leisure:{screenMinutes:55,screenConfirmed:true}};
 assert.equal(R.value(row,R.SCREEN,{kind:'count'}),0);
 assert.equal(R.total([row],R.SCREEN,{kind:'count'},{},today),0);
});
test('catch-up cannot override dated missed days',()=>{
 const rows=[0,1,2,3].map(n=>({date:R.addDays(week,n),units:{},missed:['Read']})),prefs={catchups:{[week]:{Read:{amount:100,sessions:4}}}};
 assert.equal(R.weekly(rows,'Read',cfg,prefs,week,today).conflict,true);
 assert.equal(R.total(rows,'Read',cfg,prefs,today),0);
});
test('partial sleep earns amount XP but only target nights count in weekly sessions',()=>{
 const sleep={kind:'qty',def:7.5},rows=[{date:week,units:{Sleep:.5}},{date:R.addDays(week,1),units:{Sleep:8}}];
 assert.equal(R.weekly(rows,'Sleep',sleep,{},week,today).sessions,1);
 assert.equal(R.total(rows,'Sleep',sleep,{},today),8.5);
 assert.equal(R.weekly(rows,'Sleep',sleep,{goals:{Sleep:{minimum:8.5}}},week,today).sessions,0);
});
test('three-way day merge preserves independent dates and rejects competing edits',()=>{
 const base=[{date:week,units:{Read:1},day:1}],mine=[...base,{date:R.addDays(week,1),units:{Read:2}}],remote=[...base,{date:R.addDays(week,2),units:{Read:3}}];
 assert.equal(R.mergeDays(base,mine,remote).length,3);
 assert.throws(()=>R.mergeDays(base,[{...base[0],units:{Read:2}}],[{...base[0],units:{Read:3}}]),/Another window/);
});
