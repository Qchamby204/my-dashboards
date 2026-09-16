import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../shared/ledger-season-reset-20260915.js',import.meta.url),'utf8');

async function run({season={start:'2026-09-08',end:'2026-12-31'},marker=null}={}){
  const storage=new Map(marker?[["lifeledger:migration:season-20260915:v1",marker]]:[]);
  const calls=[];
  const window={LedgerDays:{get season(){return season;},async setSeason(next){calls.push(next);season={...next};return true;}},addEventListener(){}};
  const document={readyState:'complete',documentElement:{dataset:{atlasApp:'life-ledger'}},addEventListener(){}};
  const context=vm.createContext({window,document,localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v))},setTimeout:fn=>{fn();return 1;},URL,console});
  vm.runInContext(source,context);
  for(let i=0;i<8;i++)await Promise.resolve();
  return {calls,storage,season};
}

test('moves the legacy Sep 8 season to Sep 15 without deleting history itself',async()=>{
  const r=await run();
  assert.deepEqual(r.calls,[{start:'2026-09-15',end:'2026-12-31'}]);
  assert.equal(r.storage.get('lifeledger:migration:season-20260915:v1'),'done');
});

test('does not override a season already changed manually',async()=>{
  const r=await run({season:{start:'2026-09-10',end:'2026-12-31'}});
  assert.equal(r.calls.length,0);
  assert.equal(r.storage.get('lifeledger:migration:season-20260915:v1'),'done');
});

test('migration marker prevents later forced resets',async()=>{
  const r=await run({marker:'done'});
  assert.equal(r.calls.length,0);
});
