import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {TREES,emptyState,addEntry,stats,addDays,daysBetween,rate,validateState,mergeBackup,newSeason} from '../../shared/advisor-core.mjs';
const start='2026-10-24';
const entry=(s,overrides={})=>({seasonId:s.seasons[0].id,treeId:'planning',skill:'Corporate planning',date:start,source:'practice',reference:'CASE-01',evidence:'Compared the case options and checked the model.',checks:[true,true,true,true],...overrides});

test('season dates survive DST, month ends and leap years',()=>{
 assert.equal(addDays(start,27),'2026-11-20');assert.equal(daysBetween(start,addDays(start,28)),28);
 assert.equal(addDays('2028-02-01',28),'2028-02-29');assert.equal(addDays('2026-12-20',27),'2027-01-16');
 assert.throws(()=>addDays('2026-02-30',1));
});
test('completed, checked evidence earns XP; duplicate references and future practice do not',()=>{
 const s=emptyState(start),saved=addEntry(s,entry(s),start);
 assert.equal(s.entries.length,0);assert.equal(stats(saved,s.seasons[0].id,start).xp,25);
 assert.throws(()=>addEntry(saved,entry(s,{reference:' case-01 '}),start),/already counts/);
 assert.throws(()=>addEntry(s,entry(s,{date:addDays(start,1)}),start),/Future/);
 assert.throws(()=>addEntry(s,entry(s,{checks:[true,true,false,true]}),start),/incomplete/);
 const voided=structuredClone(saved);voided.entries[0].void=true;assert.equal(stats(voided,s.seasons[0].id,start).xp,0);
 assert.equal(addEntry(voided,entry(s),start).entries.length,2,'a corrected replacement can reuse voided evidence');
});
test('extra units remain visible while progress caps; assessments and outcomes never earn XP',()=>{
 let s=emptyState(start);s.seasons[0].targets.planning=1;
 for(let i=0;i<11;i++)s=addEntry(s,entry(s,{reference:'CASE-'+i}),start);
 const before=stats(s,s.seasons[0].id,start);assert.equal(before.trees.find(t=>t.id==='planning').progress,100);assert.equal(before.units,11);assert.equal(before.level,2);assert.equal(before.levelXP,25);
 s.assessments.push({id:'a',treeId:'planning',skill:'Corporate planning',score:5,date:start,assessor:'colleague',evidence:'An observed case.'});validateState(s);
 assert.equal(stats(s,s.seasons[0].id,start).xp,before.xp);
});
test('operating reviews count at most once in each season week',()=>{
 const s=emptyState(start),t=TREES.find(t=>t.id==='leadership'),input=entry(s,{treeId:t.id,skill:t.skills[0],checks:t.rules.map(()=>true)}),a=addEntry(s,input,start);
 assert.throws(()=>addEntry(a,{...input,reference:'REVIEW-02',date:addDays(start,6)},addDays(start,6)),/per season week/);
 assert.equal(addEntry(a,{...input,reference:'REVIEW-02',date:addDays(start,7)},addDays(start,7)).entries.length,2);
});
test('rates expose missing opportunity, exact denominator and integer shortfall',()=>{
 assert.deepEqual(rate(0,0,95),{value:null,gap:null});assert.equal(rate(18,20,95).gap,1);assert.equal(rate(19,20,95).value,95);
 assert.equal(rate(1,3,95).gap,2);assert.throws(()=>rate(2,1,95));assert.throws(()=>rate(1.5,2,95));
});
test('independent backup records merge and conflicting versions are refused',()=>{
 const s=emptyState(start),a=addEntry(s,entry(s),start),b=addEntry(s,entry(s,{reference:'CASE-02'}),start),m=mergeBackup(a,b);
 assert.equal(m.entries.length,2);assert.equal(a.entries.length,1);
 const conflict=structuredClone(a);conflict.entries[0].evidence='Changed evidence';assert.throws(()=>mergeBackup(a,conflict),/conflicts/);
 const overlap=emptyState(addDays(start,1));assert.throws(()=>mergeBackup(a,overlap),/overlap/);
});
test('restores reject malformed counts, unsafe keys, incomplete cohorts and overlapping seasons',()=>{
 const s=emptyState(start);s.seasons.push(newSeason(addDays(start,27)));assert.throws(()=>validateState(s),/overlap/);
 assert.throws(()=>validateState(JSON.parse('{"version":1,"__proto__":{"polluted":true}}')),/Invalid record key/);
 const a=emptyState(start);a.reliability.push({id:'r',seasonId:a.seasons[0].id,metricId:'actions',passed:3,eligible:2});assert.throws(()=>validateState(a),/cannot exceed/);
 const b=emptyState(start);b.outcomes.push({id:'o',kind:'conversion',start:'2026-07-01',end:'2026-07-31',asOf:start,a:3,b:5});assert.throws(()=>validateState(b),/90 days/);b.outcomes[0].end='2026-07-01';validateState(b);
 b.outcomes[0]={id:'o',kind:'retention',start:'2026-01-01',end:start,asOf:start,a:3,b:5};assert.throws(()=>validateState(b),/12-month/);
});
test('stale tabs preserve independent practice; competing snapshots block with recoverable work',()=>{
 const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)},context={structuredClone,console,window:{},localStorage:storage};vm.runInNewContext(readFileSync(new URL('../../shared/record-guard.js',import.meta.url),'utf8'),context);
 const open=()=>context.window.AtlasRecords.open('advisor',{storage,validate:validateState}),initial=open(),s=emptyState(start);assert(initial.write(s));const one=open(),two=open();assert(one.write(addEntry(one.value,entry(s),start)));assert(two.write(addEntry(two.value,entry(s,{reference:'CASE-02'}),start)));assert.equal(open().value.entries.length,2);
 const x=open(),y=open(),xv=x.value,yv=y.value;xv.seasons[0].focus=['growth'];yv.seasons[0].focus=['investing'];assert(x.write(xv));assert.equal(y.write(yv),false);assert.match(y.error,/Another tab/);assert(y.recovery().pending);
});
