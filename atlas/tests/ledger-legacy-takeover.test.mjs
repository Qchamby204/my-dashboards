import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

for(const file of ['ledger-season-reset-20260915.js','ledger-simplify-20260916.js']){
  test(file+' stops pending retries once the modern Ledger owns records',async()=>{
    const timers=[],listeners=new Map(),writes=[];
    const window={addEventListener:(name,fn)=>listeners.set(name,fn)};
    const document={documentElement:{dataset:{atlasApp:'life-ledger'}},readyState:'complete',addEventListener(){}};
    const context={window,document,setTimeout:fn=>{timers.push(fn);return timers.length;},localStorage:{getItem:()=>null,setItem:(...args)=>writes.push(args)}};
    vm.runInNewContext(readFileSync(new URL('../../shared/'+file,import.meta.url),'utf8'),context);
    assert.equal(timers.length,1,'legacy startup schedules a retry while APIs are unavailable');
    window.LedgerRhythm={};
    Object.defineProperty(window,'LedgerDays',{get(){throw Error('Legacy code accessed the modern record owner');}});
    await timers.shift()();
    await listeners.get('pageshow')?.();
    assert.equal(timers.length,0,'no new retry is scheduled');assert.deepEqual(writes,[]);
  });
}
