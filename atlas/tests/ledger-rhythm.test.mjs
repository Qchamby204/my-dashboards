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
