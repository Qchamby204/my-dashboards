import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';
import {previewDatabase} from '../preview.mjs';
import worker from '../../dist/server/index.js';

const day='2026-09-07';
const payload=id=>({id,title:'Finish an outline',app_id:'life-map',project_id:null,week_start:day,due_date:null,minutes:30,focus_day:day});
async function request(db,path,method='GET',body,owner='alice'){
 const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers:{'oai-authenticated-user-id':owner,Origin:'https://atlas.test','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
test('adding a priority creates and selects it in one save, and a retry preserves the same record',async()=>{
 const db=previewDatabase();try{
  assert.equal((await request(db,'/api/tasks','POST',payload('one'))).status,201);
  assert.equal((await request(db,'/api/tasks','POST',payload('one'))).status,200);
  const state=(await request(db,'/api/state?week='+day)).data;assert.equal(state.tasks.length,1);assert.equal(state.tasks[0].focus_date,day);assert.equal(state.tasks[0].focus_slot,1);
  const history=(await request(db,'/api/history')).data;assert.equal(history.events.length,1);assert.equal(history.events[0].action,'created');
 }finally{db.close();}
});
test('priority capacity and owner boundaries reject extra creation without leaving a hidden task',async()=>{
 const db=previewDatabase();try{
  for(const id of ['one','two','three'])assert.equal((await request(db,'/api/tasks','POST',payload(id))).status,201);
  assert.equal((await request(db,'/api/tasks','POST',payload('four'))).status,409);
  assert.equal((await request(db,'/api/state?week='+day)).data.tasks.length,3);
  assert.equal((await request(db,'/api/tasks','POST',payload('bob-one'),'bob')).status,201);
  assert.equal((await request(db,'/api/state?week='+day,'GET',undefined,'bob')).data.tasks[0].focus_slot,1);
  assert.equal((await request(db,'/api/tasks','POST',{...payload('bad-date'),focus_day:'not-a-day'})).status,400);
 }finally{db.close();}
});
test('racing priority saves and history failures never create a partially selected commitment',async()=>{
 const db=previewDatabase();try{
  await request(db,'/api/tasks','POST',payload('one'));await request(db,'/api/tasks','POST',payload('two'));
  const results=await Promise.all(['three','four'].map(id=>request(db,'/api/tasks','POST',payload(id))));assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);
  let state=(await request(db,'/api/state?week='+day)).data;assert.equal(state.tasks.length,3);assert.equal(new Set(state.tasks.map(t=>t.focus_slot)).size,3);
  db.prepare("CREATE TRIGGER priority_history_failure BEFORE INSERT ON atlas_history BEGIN SELECT RAISE(ABORT,'D1 history unavailable'); END;").run();
  assert.equal((await request(db,'/api/tasks','POST',{...payload('next-day'),focus_day:'2026-09-08'})).status,503);
  state=(await request(db,'/api/state?week='+day)).data;assert.equal(state.tasks.length,3);
 }finally{db.close();}
});

function harness(){
 const nodes=new Map(),pending=[],events=new Map();
 function node(s){
  if(s.startsWith('dialog[open]'))return null;
  if(!nodes.has(s))nodes.set(s,{id:s.slice(1),value:'',textContent:'',innerHTML:'',open:false,disabled:false,hidden:false,handlers:new Map(),addEventListener(t,f){this.handlers.set(t,f);},focus(){},showModal(){this.open=true;},close(){this.open=false;},reset(){},insertAdjacentHTML(){},querySelectorAll(){return [];},elements:{}});
  return nodes.get(s);
 }
 const form=node('#task-form');form.elements=Object.fromEntries(['title','app_id','project_id','week_start','due_date','minutes'].map(k=>[k,{value:'',disabled:false,focus(){},insertAdjacentHTML(){}}]));form.querySelector=()=>node('#task-submit');form.querySelectorAll=()=>[...Object.values(form.elements),node('#task-submit')];
 const document={querySelector:node,querySelectorAll:()=>[],visibilityState:'visible',addEventListener(t,f){if(!events.has(t))events.set(t,[]);events.get(t).push(f);}};
 const context=vm.createContext({...model,createCadenceUI:()=>({dirty:false,saving:false,home:()=>''}),createBudgetUI:()=>({dirty:false,saving:false}),createCommitmentsUI:()=>({}),createAgendaUI:()=>({}),createSearchUI:()=>({}),createReflectionUI:()=>({dirty:false,saving:false}),createLedgerUI:()=>({dirty:false,saving:false}),createHeraldUI:()=>({dirty:false,saving:false}),createCommunicationUI:()=>({dirty:false,saving:false}),createEditionRefreshUI:()=>({saving:false}),document,window:{addEventListener(){}},location:{hash:'#today'},Date,structuredClone,setInterval(){},setTimeout(){},localDay:()=>day,
 FormData:class{constructor(f){this.fields=Object.entries(f.elements).filter(([,e])=>!e.disabled).map(([k,e])=>[k,e.value]);}[Symbol.iterator](){return this.fields[Symbol.iterator]();}},
 fetch:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
 const run=s=>vm.runInContext(s,context);run(readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,''));
 const reply=async(i,data,status=200)=>{pending[i].resolve({ok:status<400,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
 const add=()=>Promise.all((events.get('click')||[]).map(f=>f({target:{closest:s=>s==='[data-add-priority]'?{}:null},preventDefault(){}})));
 return {run,node,form,pending,reply,add,submit:()=>form.handlers.get('submit')({currentTarget:form,preventDefault(){}})};
}
test('empty Home offers a priority action first and explains its data coverage instead of pointing to a missing list',async()=>{
 const h=harness();await h.reply(0,{tasks:[],projects:[],week:null});const html=h.node('#content').innerHTML;
 assert.match(html,/data-add-priority/);assert.ok(html.indexOf('Your three priorities')<html.indexOf('Saved planning dates'));assert.ok(!html.includes('list below'));assert.match(html,/0 saved commitments · 0 Life Map projects/);assert.match(html,/Original Herald plans and Prospecting follow-ups are not automatically connected/);
});
test('the actual Add a priority flow saves directly without a second selection request and keeps a rejected draft',async()=>{
 const h=harness();await h.reply(0,{tasks:[],projects:[],week:null});await h.add();assert.equal(h.node('#task-dialog').open,true);assert.equal(h.node('#task-details').open,false);assert.equal(h.node('#task-submit').textContent,'Save priority');
 h.form.elements.title.value='Write an outline';let save=h.submit();assert.equal(h.pending[1].path,'/api/tasks');assert.equal(JSON.parse(h.pending[1].options.body).focus_day,day);const id=JSON.parse(h.pending[1].options.body).id;
 await h.submit();assert.equal(h.pending.length,2);await h.reply(1,{error:'Three priorities are already chosen.'},409);await save;assert.equal(h.node('#task-dialog').open,true);assert.equal(h.form.elements.title.value,'Write an outline');assert.equal(h.node('#task-submit').disabled,false);
 save=h.submit();assert.equal(JSON.parse(h.pending[2].options.body).id,id);await h.reply(2,{id},201);await h.reply(3,{tasks:[{...payload(id),status:'open',focus_date:day,focus_slot:1,revision:1}],projects:[],week:null});await save;
 assert.equal(h.node('#task-dialog').open,false);assert.equal(h.run('data.tasks[0].focus_slot'),1);assert.equal(h.pending.filter(r=>r.options.method==='PATCH').length,0);assert.match(h.node('#toast span').textContent,/Priority saved/);
});
