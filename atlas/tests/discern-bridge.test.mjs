import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const candidates=[new URL('../../shared/discern-bridge.js',import.meta.url),new URL('./discern-bridge.js',import.meta.url)];
let source;for(const p of candidates){try{source=readFileSync(p,'utf8');break;}catch{}}
const scope={Date,TextEncoder,crypto:webcrypto};vm.createContext(scope);vm.runInContext(source,scope);const B=scope.DiscernBridge;
const now=Date.parse('2026-10-12T17:00:00Z'),date=B.dateKey(new Date(now)),id='a1234567-1234-4123-8123-123456789abc';
const allowance=otherDeviceMinutes=>B.makeAllowance({date,otherDeviceMinutes},{now,id});
const usage=()=>({app:'discern',kind:'discern-usage',version:1,id,date,generatedAt:now,phoneMinutes:24.5,otherDeviceMinutes:10,totalMinutes:34.5,source:'user-confirmed-native-report',observedThresholdLowerBound:20,emergencyReleased:false});
test('phone allowance applies strict under-hour cap and subtracts other devices once',()=>{
 assert.equal(B.effectivePhoneBudget(allowance(0),{now}),59);
 assert.equal(B.effectivePhoneBudget(allowance(10.5),{now}),48);
 assert.equal(B.effectivePhoneBudget(allowance(59.1),{now}),0);
});
test('recorded combined usage is informational and never subtracted as other-device usage',()=>{
 const p=B.makeAllowance({date,otherDeviceMinutes:10,recordedTotalMinutes:35},{now,id});
 assert.equal(B.effectivePhoneBudget(p,{now}),49);
});
test('allowance roundtrips through the native URL without exposing another record',()=>{
 const p=allowance(10),url=new URL(B.allowanceURL(p,{now}));
 assert.equal(url.protocol,'discern:');assert.equal(url.hostname,'ledger');
 assert.equal(JSON.parse(url.searchParams.get('payload')).otherDeviceMinutes,10);
 assert.deepEqual(Object.keys(JSON.parse(url.searchParams.get('payload'))).sort(),Object.keys(p).sort());
});
test('allowance expires at local midnight and cannot be future dated',()=>{
 assert.throws(()=>B.validateAllowance({...allowance(0),date:'2026-10-11'},{now}));
 assert.throws(()=>B.validateAllowance({...allowance(0),generatedAt:now+300001},{now}));
});
test('invalid numeric values, malformed IDs and impossible dates are rejected',()=>{
 for(const n of [-1,NaN,Infinity,true,1441])assert.throws(()=>allowance(n));
 for(const delta of [{allowanceMinutes:61},{allowanceMinutes:1.5},{id:'constructor'},{date:'2026-02-30'}])assert.throws(()=>B.validateAllowance({...allowance(0),...delta},{now}));
});
test('combined usage is an explicit reviewed total, never a threshold estimate',()=>{
 assert.equal(B.parseUsage(JSON.stringify(usage()),{now}).totalMinutes,34.5);
 assert.throws(()=>B.validateUsage({...usage(),source:'automatic-live-counter'},{now}));
 assert.throws(()=>B.validateUsage({...usage(),totalMinutes:54.5},{now}));
 assert.throws(()=>B.validateUsage({...usage(),observedThresholdLowerBound:25},{now}));
});
test('foreign apps, versions, booleans and future reports are rejected',()=>{
 for(const delta of [{app:'other'},{version:2},{phoneMinutes:true},{emergencyReleased:'no'},{generatedAt:now+300001}])assert.throws(()=>B.validateUsage({...usage(),...delta},{now}));
});
test('malformed JSON, overlarge files and prototype keys cannot modify records',()=>{
 assert.throws(()=>B.parseUsage('{oops',{now}));assert.throws(()=>B.parseUsage(' '.repeat(8193),{now}));
 assert.throws(()=>B.parseUsage(JSON.stringify(usage()).replace('"app":','"__proto__":{},"app":'),{now}));
});
test('historical usage preserves its original date for a reviewed import',()=>{
 const previous=now-86400000,p={...usage(),date:B.dateKey(new Date(previous)),generatedAt:previous};
 assert.equal(B.validateUsage(p,{now}).date,p.date);
});
test('unknown fields are removed from the exchanged object',()=>{
 const p=B.validateUsage({...usage(),privateJournal:'never transfer this'}, {now});
 assert.equal(p.privateJournal,undefined);
});
