import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCadenceUI} from '../cadence-ui.mjs';
import {missingOccurrences} from '../cadence.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';
const week='2026-09-07',esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const routine={id:'routine-one',source_id:null,title:'Review <the week>',frequency:'weekly',day:1,start_date:week,minutes:30,paused:false};
function harness(){
 const original=globalThis.document,nodes=new Map(),events=new Map(),pending=[],toasts=[];let loads=0,ui;
 function node(id){if(!nodes.has(id))nodes.set(id,{id,value:'',open:false,disabled:false,textContent:'',innerHTML:'',checked:false,events:new Map(),elements:{},addEventListener(t,f){this.events.set(t,f);},setAttribute(){},showModal(){this.open=true;},close(){this.open=false;},focus(){},querySelectorAll(){return [];}});return nodes.get(id);}
 const form=node('cadence-form');form.elements=Object.fromEntries(['title','frequency','day','start_date','minutes'].map(n=>[n,node(n)]));form.querySelectorAll=()=>[...Object.values(form.elements),node('submit'),node('discard')];
 globalThis.document={querySelector:s=>s==='dialog[open]'?[...nodes.values()].find(n=>n.open)||null:node(s.slice(1)),addEventListener(t,f){events.set(t,f);}};
 const data={cadence:{routines:[routine],revision:7},tasks:[]};
 ui=createCadenceUI({api:(path,method,body)=>new Promise((resolve,reject)=>pending.push({path,method,body,resolve,reject})),getData:()=>data,getWeek:()=>week,getToday:()=>week,load:async()=>{loads++;},blocked:()=>ui.dirty||ui.saving,error:m=>node('error').textContent=m,toast:m=>toasts.push(m),esc,formatDay:v=>v});
 function click(key,value=''){return events.get('click')({target:{dataset:{[key]:value},hasAttribute:n=>n==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}}});}
 const fire=(id,type,extra={})=>node(id).events.get(type)?.({target:node(id),currentTarget:node(id),preventDefault(){},...extra});
 return {ui,data,node,form,pending,click,fire,toasts,get loads(){return loads;},restore(){globalThis.document=original;}};
}
test('routine editor freezes pending saves, retains its revision after conflict, and discards only explicitly',async()=>{
 const h=harness();try{
  await h.click('cadenceEdit','routine-one');h.form.elements.day.value='1';h.form.elements.title.value='My new title';h.data.cadence.revision=8;
  const save=h.fire('cadence-form','submit');assert.equal(h.pending[0].body.revision,7);assert.equal(h.form.elements.title.disabled,true);await h.fire('cadence-form','submit');await h.click('cadenceDiscard');assert.equal(h.pending.length,1);assert.equal(h.node('cadence-dialog').open,true);
  let prevented=false;h.fire('cadence-dialog','cancel',{preventDefault(){prevented=true;}});assert.equal(prevented,true);
  h.pending[0].reject(Error('Another device saved first'));await save;assert.equal(h.ui.dirty,true);assert.equal(h.form.elements.title.value,'My new title');assert.equal(h.form.elements.title.disabled,false);assert.equal(h.form.elements.frequency.disabled,true);assert.match(h.node('cadence-error').textContent,/draft is still here/);
  await h.click('cadenceClose');assert.equal(h.node('cadence-dialog').open,true);await h.click('cadenceDiscard');assert.equal(h.ui.dirty,false);assert.equal(h.loads,1);
 }finally{h.restore();}
});
test('routine import ignores late previews after cancellation and requires renewed review after a failed save',async()=>{
 const h=harness();try{
  const raw=JSON.stringify({'operationsCadence.v1':JSON.stringify({custom:{weekly:[]}})});
  const select=()=>{h.node('cadence-file').files=[{size:raw.length,text:async()=>raw}];return h.fire('cadence-file','change');};
  const waitFor=async n=>{for(let i=0;i<100&&h.pending.length<n;i++)await new Promise(r=>setTimeout(r,2));assert.equal(h.pending.length,n);};
  await h.click('cadenceImport');const first=select();await waitFor(1);await h.click('cadenceImportClose');h.pending[0].resolve({rows:[],added:0,kept:0,pack:{},revision:7,digest:'old'});await first;assert.equal(h.node('cadence-import-preview').innerHTML,'');
  await h.click('cadenceImport');const second=select();await waitFor(2);h.pending[1].resolve({rows:[],added:0,kept:0,pack:{},revision:7,digest:'current'});await second;h.node('cadence-consent').checked=true;h.fire('cadence-consent','change');const save=h.fire('cadence-import-confirm','click');assert.equal(h.pending[2].body.revision,7);h.pending[2].reject(Error('Conflict'));await save;h.fire('cadence-consent','change');assert.equal(h.node('cadence-import-confirm').disabled,true);assert.match(h.node('cadence-import-error').textContent,/fresh import/);assert.equal(h.loads,0);
 }finally{h.restore();}
});
test('Home and Operations distinguish actual completion from skipped occurrences and escape routine titles',()=>{
 const h=harness();try{
  h.data.tasks=[{id:'a',routine_id:'routine-one',title:'Review <the week>',occurrence_date:week,due_date:week,status:'open'},{id:'b',routine_id:'routine-one',title:'Earlier completed',occurrence_date:week,due_date:week,status:'done'},{id:'c',routine_id:'routine-one',title:'Skipped',occurrence_date:week,due_date:week,status:'archived'}];
  assert.match(h.ui.home(),/Routines due this week/);assert.match(h.ui.home(),/1 completed · 1 skipped/);assert.match(h.ui.home(),/Review &lt;the week&gt;/);assert.match(h.ui.home(),/Skip occurrence/);assert.match(h.ui.page(),/Occurrence history/);assert.match(h.ui.page(),/data-action="restore"/);
 }finally{h.restore();}
});

function appHarness(){
 const nodes=new Map(),pending=[],windowEvents=new Map();
 function node(s){if(s.startsWith('dialog[open]'))return null;if(!nodes.has(s))nodes.set(s,{id:s.slice(1),value:'',textContent:'',innerHTML:'',disabled:false,open:false,addEventListener(){},querySelectorAll:()=>[],elements:{},setAttribute(){},focus(){}});return nodes.get(s);}
 const document={querySelector:node,querySelectorAll:()=>[],addEventListener(){},visibilityState:'visible'};
 const cadence={dirty:false,saving:false,home:()=>'',page:()=>''};
 const context=vm.createContext({...model,missingOccurrences,createCadenceUI:()=>cadence,createBudgetUI:()=>({dirty:false,saving:false,panel:()=>''}),createCommitmentsUI:()=>({page:()=>''}),createAgendaUI:()=>({panel:()=>''}),createSearchUI:()=>({}),createReflectionUI:()=>({dirty:false,saving:false}),createLedgerUI:()=>({dirty:false,saving:false}),createHeraldUI:()=>({dirty:false,saving:false}),createCommunicationUI:()=>({dirty:false,saving:false}),createEditionRefreshUI:()=>({saving:false}),document,window:{addEventListener:(t,f)=>windowEvents.set(t,f)},location:{hash:'#week'},Date,structuredClone,setInterval(){},setTimeout(){},localDay:()=>week,fetch:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
 const run=s=>vm.runInContext(s,context);run(readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 const reply=async(i,data,status=200)=>{pending[i].resolve({ok:status<400,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
 return {run,node,pending,reply,context,cadence,windowEvents};
}
test('actual app prepares missing week occurrences once, reloads saved tasks and suppresses planning after a new draft',async()=>{
 const h=appHarness(),state={tasks:[],projects:[],week:null,cadence:{routines:[routine],revision:7}};
 await h.reply(0,state);assert.equal(h.pending[1].path,'/api/cadence/plan');assert.deepEqual(JSON.parse(h.pending[1].options.body),{week,revision:7});
 await h.reply(1,{added:1});const ready={...state,tasks:[{id:'occ-one',title:'Weekly review',routine_id:'routine-one',occurrence_date:week,week_start:week,due_date:week,app_id:'operations-cadence',minutes:30,status:'open',revision:1}]};await h.reply(2,ready);assert.equal(h.run('data.tasks.length'),1);
 const reload=h.run('load()');await h.reply(3,ready);await reload;assert.equal(h.pending.filter(x=>x.options.method==='POST').length,1);
 const stale=h.run('load()');h.cadence.dirty=true;await h.reply(4,state);await stale;assert.equal(h.pending.length,5);assert.equal(h.run('data.tasks.length'),1);h.context.location.hash='#projects';h.windowEvents.get('hashchange')();assert.equal(h.run('view'),'week');
});
