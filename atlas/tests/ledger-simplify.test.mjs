import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../../shared/ledger-simplify-20260916.js',import.meta.url),'utf8');

const tapNames=['Run / Work Out','YouTube Strategy','LinkedIn Strategy','Household Chore','Walk Hud'];
const oldGoals={'Run / Work Out':90,'YouTube Strategy':120,'LinkedIn Strategy':400,'Household Chore':100,'Walk Hud':150};

function config(){
  return Object.fromEntries(tapNames.map(name=>[name,{unit:'old',kind:'qty',step:1,def:2,goal:oldGoals[name],chunk:1,noun:'old',outcome:'old',crit:'old'}]));
}

async function run({marker=null}={}){
  const DEFAULT_HCFG=config(),HCFG={};
  const rebuildModel=()=>{for(const [key,value] of Object.entries(DEFAULT_HCFG))HCFG[key]={...value};};
  rebuildModel();

  const state={
    days:[
      {date:'2026-09-15',units:{'Run / Work Out':3,'YouTube Strategy':2,'LinkedIn Strategy':8,'Household Chore':4,'Walk Hud':2.5}},
      {date:'2026-09-16',units:{'Run / Work Out':0,'YouTube Strategy':1,'LinkedIn Strategy':5,'Household Chore':0,'Walk Hud':1.5}},
    ],
    draft:{'Run / Work Out':2,'YouTube Strategy':4,'LinkedIn Strategy':12,'Household Chore':3,'Walk Hud':1.5},
    goals:{...oldGoals,Read:1200},
    openSections:{forecast:true,pace:true,oracle:true,outcomes:true,chronicle:true},
  };
  const savedDrafts={days:{'2026-09-14':{units:{'Run / Work Out':2,'LinkedIn Strategy':10,'Walk Hud':3}}},selected:'2026-09-16',mode:'list'};
  const storage=new Map(marker?[["lifeledger:migration:tap-habits-20260916:v1",marker]]:[]),writes=new Map(),removed=[];
  const panels=Object.fromEntries(['forecast','pace','oracle','outcomes'].map(key=>[key,{remove(){removed.push(key);}}]));
  const app={querySelector(selector){const m=selector.match(/data-key="([^"]+)"/);return m&&panels[m[1]]?{closest(){return panels[m[1]];}}:null;}};
  let computeInput=null,renderCount=0;
  const compute=(days,goals)=>{computeInput=JSON.parse(JSON.stringify(days));return {days,goals};};
  const render=()=>{renderCount++;};
  const ACHV=['On the Record','Content Engine','Ten Sessions In','Iron Forged','Rainmaker','Pipeline Full','Momentum','Relentless','House in Order','With Hudson']
    .map(name=>({name,desc:'old',test:()=>false}));
  const store={async set(key,value){writes.set(key,value);return true;}};
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value))};
  const window={
    LedgerDays:{get drafts(){return JSON.parse(JSON.stringify(savedDrafts));}},
    addEventListener(){},
  };
  const document={readyState:'complete',documentElement:{dataset:{atlasApp:'life-ledger'}},addEventListener(){}};
  const context=vm.createContext({
    window,document,localStorage,setTimeout:fn=>{fn();return 1;},console,
    state,DEFAULT_HCFG,HCFG,rebuildModel,compute,render,ACHV,store,KEY:'lifeledger:v2',GOALKEY:'lifeledger:goals:v2',app,
  });
  vm.runInContext(source,context);
  for(let i=0;i<12;i++)await Promise.resolve();
  return {context,state,DEFAULT_HCFG,HCFG,ACHV,writes,storage,removed,get computeInput(){return computeInput;},get renderCount(){return renderCount;}};
}

test('five requested habits become binary taps with season-calibrated goals',async()=>{
  const r=await run();
  const expected={'Run / Work Out':60,'YouTube Strategy':75,'LinkedIn Strategy':75,'Household Chore':75,'Walk Hud':75};
  for(const [name,goal] of Object.entries(expected)){
    assert.equal(r.DEFAULT_HCFG[name].kind,'count');
    assert.equal(r.DEFAULT_HCFG[name].unit,'days');
    assert.equal(r.DEFAULT_HCFG[name].goal,goal);
    assert.equal(r.HCFG[name].kind,'count');
  }
  assert.deepEqual(JSON.parse(JSON.stringify(r.context.window.LedgerSimplify20260916.goals)),expected);
});

test('migration caps old quantities to one completion per day and clears old goal overrides',async()=>{
  const r=await run();
  for(const name of tapNames)assert.ok([0,1].includes(r.state.days[0].units[name]));
  assert.equal(r.state.days[0].units['LinkedIn Strategy'],1);
  assert.equal(r.state.days[0].units['Walk Hud'],1);
  assert.equal(r.state.days[1].units['Run / Work Out'],0);
  for(const name of tapNames)assert.equal(Object.hasOwn(r.state.goals,name),false);
  assert.equal(r.state.goals.Read,1200);
  assert.equal(r.state.draft['LinkedIn Strategy'],1);
  assert.equal(JSON.parse(r.writes.get('lifeledger:v2'))[0].units['LinkedIn Strategy'],1);
  assert.equal(Object.hasOwn(JSON.parse(r.writes.get('lifeledger:goals:v2')),'LinkedIn Strategy'),false);
  assert.equal(JSON.parse(r.writes.get('lifeledger:drafts:v1')).days['2026-09-14'].units['Walk Hud'],1);
  assert.equal(r.storage.get('lifeledger:migration:tap-habits-20260916:v1'),'done');
});

test('scoring defensively treats quantities from an old backup as binary',async()=>{
  const r=await run({marker:'done'});
  r.context.compute([{date:'2026-09-15',units:{'LinkedIn Strategy':99,'Walk Hud':12}}],{});
  assert.equal(r.computeInput[0].units['LinkedIn Strategy'],1);
  assert.equal(r.computeInput[0].units['Walk Hud'],1);
});

test('forecast, pace coach, oracle and outcomes are removed after render',async()=>{
  const r=await run();
  for(const key of ['forecast','pace','oracle','outcomes'])assert.ok(r.removed.includes(key));
  assert.equal(r.state.openSections.forecast,undefined);
  assert.equal(r.state.openSections.pace,undefined);
  assert.equal(r.state.openSections.oracle,undefined);
  assert.equal(r.state.openSections.outcomes,undefined);
  assert.equal(r.state.openSections.chronicle,true);
  assert.ok(r.renderCount>=1);
});

test('quantity-based achievements are recalibrated to completion-day milestones',async()=>{
  const r=await run();
  const byName=name=>r.ACHV.find(a=>a.name===name);
  assert.match(byName('Rainmaker').desc,/10 LinkedIn strategy days/);
  assert.equal(byName('Rainmaker').test({habit:{'LinkedIn Strategy':{total:10}}}),true);
  assert.equal(byName('Pipeline Full').test({habit:{'LinkedIn Strategy':{total:29}}}),false);
  assert.equal(byName('Relentless').test({habit:{'LinkedIn Strategy':{total:70}}}),true);
  assert.equal(byName('With Hudson').test({habit:{'Walk Hud':{total:25}}}),true);
  assert.match(byName('On the Record').desc,/YouTube strategy days/);
});
