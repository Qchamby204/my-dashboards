import {test} from 'node:test';
import assert from 'node:assert/strict';
import {budgetMinutes,createBudgetUI} from '../budget-ui.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';
const week='2026-09-07';
test('budget validation distinguishes an empty input from zero and preserves whole-minute precision',()=>{
 assert.equal(budgetMinutes('0'),0);assert.equal(budgetMinutes('2.5'),150);assert.equal(budgetMinutes('10.25'),615);assert.equal(budgetMinutes(String(61/60)),61);assert.equal(budgetMinutes('168'),10080);
 for(const raw of ['', ' ', '-1','169','Infinity','no','0.001'])assert.throws(()=>budgetMinutes(raw));
});
function harness(){
 const old=globalThis.document,nodes=new Map(),events=new Map(),writes=[],toasts=[];let loads=0,blocked=false,reload=async()=>true;
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,value:'',disabled:false,textContent:'',innerHTML:''});return nodes.get(id);};
 globalThis.document={querySelector:s=>node(s.slice(1)),addEventListener:(t,f)=>events.set(t,f)};
 const data={week:{week_start:week,revision:7,capacity:600,worked:'Saved reflection',change:'Saved adjustment'}};
 const ui=createBudgetUI({api:(path,method,body)=>new Promise((resolve,reject)=>writes.push({path,method,body,resolve,reject})),getData:()=>data,getWeek:()=>week,load:async()=>{loads++;return reload();},blocked:()=>blocked,error:m=>node('error').textContent=m,toast:m=>toasts.push(m),esc:v=>String(v),duration:m=>m+' min'});
 const input=value=>{node('capacity').value=value;events.get('input')({target:node('capacity')});};
 const click=id=>events.get('click')({target:{id,closest(){return this;}}});
 return {ui,data,node,writes,toasts,input,click,get loads(){return loads;},set blocked(v){blocked=v;},set reload(fn){reload=fn;},restore(){globalThis.document=old;}};
}
test('saving freezes budget controls, rejects repeat clicks and preserves the starting revision and draft on conflict',async()=>{
 const h=harness();try{
  h.input('4.5');h.data.week={...h.data.week,revision:8,worked:'Newer reflection'};const pending=h.click('save-capacity');assert.equal(h.ui.saving,true);assert.equal(h.node('capacity').disabled,true);assert.equal(h.node('discard-capacity').disabled,true);assert.equal(h.writes[0].body.revision,7);assert.equal(h.writes[0].body.worked,'Saved reflection');assert.equal(h.writes[0].body.capacity,270);
  await h.click('save-capacity');assert.equal(h.writes.length,1);h.input('8');h.writes[0].reject(Error('Another device saved first.'));await pending;assert.equal(h.ui.dirty,true);assert.equal(h.node('capacity').disabled,false);assert.match(h.ui.panel(100),/value="4.5"/);assert.match(h.node('budget-error').textContent,/draft is kept/);assert.equal(h.loads,0);
 }finally{h.restore();}
});
test('invalid budget text makes no write; an explicit zero can be saved without modifying review answers',async()=>{
 const h=harness();try{
  h.input('');await h.click('save-capacity');assert.equal(h.writes.length,0);assert.equal(h.ui.dirty,true);assert.match(h.node('budget-error').textContent,/Enter the hours/);
  h.input('0');const pending=h.click('save-capacity');assert.equal(h.writes[0].body.capacity,0);assert.equal(h.writes[0].body.change,'Saved adjustment');h.writes[0].resolve({saved:true});await pending;assert.equal(h.ui.dirty,false);assert.equal(h.node('budget-draft-state').textContent,'Saved budget');assert.equal(h.toasts.length,1);
 }finally{h.restore();}
});
test('discard exposes failed refreshes and can retry; a saved budget is distinguished from a failed subsequent refresh',async()=>{
 const h=harness();try{
  h.input('3');h.reload=async()=>false;await h.click('discard-capacity');assert.equal(h.ui.dirty,false);assert.equal(h.node('capacity').value,'10');assert.match(h.node('budget-error').textContent,/last loaded budget/);
  h.reload=async()=>{h.data.week={...h.data.week,capacity:480,revision:8};return true;};await h.click('discard-capacity');assert.equal(h.node('capacity').value,'8');assert.equal(h.node('budget-draft-state').textContent,'Saved budget');assert.equal(h.writes.length,0);
  h.input('2');h.reload=async()=>{throw Error('Refresh failed');};const pending=h.click('save-capacity');h.writes[0].resolve({saved:true});await pending;assert.equal(h.ui.dirty,false);assert.match(h.node('budget-error').textContent,/budget was saved/);assert.equal(h.node('capacity').disabled,false);
 }finally{h.restore();}
});
test('the actual app protects budget drafts from late refresh and navigation, then discards only after an explicit reload',async()=>{
 const old=globalThis.document,nodes=new Map(),listeners=new Map(),windowEvents=new Map(),pending=[];
 function node(s){if(s.startsWith('dialog[open]'))return null;if(!nodes.has(s))nodes.set(s,{id:s.slice(1),value:'',textContent:'',innerHTML:'',disabled:false,open:false,addEventListener(){},querySelectorAll:()=>[],focus(){},elements:{},closest(selector){return selector.split(',').includes('#'+this.id)?this:null;}});return nodes.get(s);}
 const document={querySelector:node,querySelectorAll:()=>[],visibilityState:'visible',addEventListener(t,f){if(!listeners.has(t))listeners.set(t,[]);listeners.get(t).push(f);}};globalThis.document=document;
 const context=vm.createContext({...model,createBudgetUI,createCommitmentsUI:()=>({page:()=>''}),createAgendaUI:()=>({panel:()=>''}),createSearchUI:()=>({}),createReflectionUI:()=>({dirty:false,saving:false}),createLedgerUI:()=>({dirty:false,saving:false}),createHeraldUI:()=>({dirty:false,saving:false}),createCommunicationUI:()=>({dirty:false,saving:false}),createEditionRefreshUI:()=>({saving:false}),document,window:{addEventListener:(t,f)=>windowEvents.set(t,f)},location:{hash:'#week'},Date,structuredClone,setInterval(){},setTimeout(){},localDay:()=>week,fetch:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 const state={tasks:[],projects:[],week:{week_start:week,capacity:600,revision:7,worked:'Saved reflection',change:''}};
 const reply=async(i,data,status=200)=>{pending[i].resolve({ok:status===200,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
 const run=s=>vm.runInContext(s,context),fire=(t,target)=>Promise.all((listeners.get(t)||[]).map(f=>f({target,preventDefault(){}})));
 try{
  run(source);await reply(0,state);const refresh=run('load()');node('#capacity').value='4';await fire('input',node('#capacity'));await reply(1,{...state,week:{...state.week,revision:8,capacity:480}});await refresh;assert.equal(run('data.week.revision'),7);assert.equal(run('hasDraft()'),true);assert.match(run('budgetUI.panel(0)'),/value="4"/);
  context.location.hash='#projects';windowEvents.get('hashchange')();assert.equal(run('view'),'week');
  const saving=fire('click',node('#save-capacity'));assert.equal(JSON.parse(pending[2].options.body).revision,7);await reply(2,{error:'Another device saved first.'},409);await saving;assert.equal(run('budgetUI.dirty'),true);
  const discard=fire('click',node('#discard-capacity'));await reply(3,{...state,week:{...state.week,revision:8,capacity:480}});await discard;assert.equal(run('budgetUI.dirty'),false);assert.equal(run('data.week.revision'),8);assert.equal(node('#capacity').value,'8');assert.equal(pending.filter(r=>r.options.method==='PUT').length,1);
 }finally{globalThis.document=old;}
});
