import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAgendaUI} from '../agenda-ui.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function harness(){
 const original={document:globalThis.document,window:globalThis.window},nodes=new Map(),events=new Map(),windowEvents=new Map(),pending=[],activated=[];let blocked=false,week='2026-09-07',lastError='';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,disabled:false,value:'',textContent:'',innerHTML:'',hidden:false,buttons:[],querySelectorAll(){return this.buttons;},focus(){this.focused=true;},scrollIntoView(){}});return nodes.get(id);};
 globalThis.document={querySelector:s=>node(s.slice(1)),addEventListener:(t,f)=>events.set(t,f)};globalThis.window={addEventListener:(t,f)=>windowEvents.set(t,f)};
 const data={tasks:Array.from({length:45},(_,i)=>({id:'task-'+i,title:'A <task> '+i,status:'open',week_start:week,due_date:week})),ledger:{days:[{date:week,checked:[],note:'Not in agenda preview'}]}};
 const ui=createAgendaUI({getData:()=>data,getWeek:()=>week,resolveResult:(row,signal,options)=>new Promise((resolve,reject)=>pending.push({row,signal,options,resolve:()=>resolve(()=>activated.push(row.id)),reject})),blocked:()=>blocked,error:m=>lastError=m,esc});
 const click=(key,value='')=>{const target={id:key==='agendaCancelOpen'?'agenda-cancel-open':'',dataset:{[key]:value},hasAttribute:n=>n==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}};return events.get('click')({target});};
 const change=(id,value)=>{node(id).value=value;events.get('change')({target:node(id)});};
 const draw=()=>{nodes.set('agenda-panel',{querySelectorAll:()=>[node('entry-button')]});const html=ui.panel();node('agenda-body').innerHTML=html;return html;};
 return {ui,data,node,pending,activated,click,change,draw,windowEvents,get lastError(){return lastError;},set blocked(v){blocked=v;},set week(v){week=v;},restore(){globalThis.document=original.document;globalThis.window=original.window;}};
}
test('agenda uses escaped record buttons, pages dense days, applies source/type filters and keeps counts exact',async()=>{
 const h=harness();try{
  const html=h.draw();assert.match(html,/45 planned entries · 1 recorded entry/);assert.equal((html.match(/data-agenda-open=/g)||[]).length,20);assert.match(html,/A &lt;task&gt;/);assert.ok(!html.includes('Not in agenda preview'));
  await h.click('agendaMore','2026-09-07');assert.equal((h.node('agenda-body').innerHTML.match(/data-agenda-open=/g)||[]).length,40);
  h.change('agenda-type','activity');assert.match(h.node('agenda-body').innerHTML,/0 planned entries · 1 recorded entry/);assert.ok(!h.node('agenda-body').innerHTML.includes('A &lt;task&gt;'));
  h.change('agenda-source','tasks');assert.match(h.node('agenda-body').innerHTML,/0 planned entries · 0 recorded entries/);assert.equal((h.node('agenda-body').innerHTML.match(/No matching dated entries/g)||[]).length,7);
  h.blocked=true;h.change('agenda-type','all');assert.equal(h.node('agenda-type').value,'activity');assert.match(h.lastError,/draft/);
 }finally{h.restore();}
});
test('agenda cancels pending navigation on explicit cancel, week switches, filter changes and replaced panels',async()=>{
 const h=harness();try{
  h.draw();let opening=h.click('agendaOpen','task:task-0:plan');assert.equal(h.node('entry-button').disabled,true);assert.equal(h.node('agenda-cancel-open').hidden,false);await h.click('agendaCancelOpen');h.pending[0].resolve();await opening;assert.equal(h.pending[0].signal.aborted,true);assert.equal(h.activated.length,0);
  opening=h.click('agendaOpen','task:task-0:plan');h.week='2026-09-14';h.pending[1].resolve();await opening;assert.equal(h.activated.length,0);
  h.week='2026-09-07';h.draw();opening=h.click('agendaOpen','task:task-0:plan');h.change('agenda-type','activity');h.pending[2].resolve();await opening;assert.equal(h.activated.length,0);
  h.change('agenda-type','all');opening=h.click('agendaOpen','task:task-0:plan');h.draw();h.pending[3].resolve();await opening;assert.equal(h.activated.length,0);assert.equal(h.pending[3].signal.aborted,true);
 }finally{h.restore();}
});
test('failed agenda reads keep a retry action; new drafts and page navigation prevent late activation',async()=>{
 const h=harness();try{
  h.draw();h.blocked=true;await h.click('agendaOpen','task:task-0:plan');assert.equal(h.pending.length,0);h.blocked=false;
  let opening=h.click('agendaOpen','task:task-0:plan');h.pending[0].reject(Error('Offline'));await opening;assert.match(h.node('agenda-opening-status').textContent,/Offline.*retry/);assert.equal(h.node('entry-button').disabled,false);
  opening=h.click('agendaOpen','task:task-0:plan');h.blocked=true;h.pending[1].resolve();await opening;assert.match(h.node('agenda-opening-status').textContent,/draft is still here/);assert.equal(h.activated.length,0);h.blocked=false;
  opening=h.click('agendaOpen','task:task-0:plan');h.windowEvents.get('hashchange')();h.pending[2].resolve();await opening;assert.equal(h.activated.length,0);
  h.draw();opening=h.click('agendaOpen','task:task-0:plan');assert.deepEqual(h.pending[3].options,{taskView:'week',taskWeek:'2026-09-07'});h.pending[3].resolve();await opening;assert.deepEqual(h.activated,['task-0']);
 }finally{h.restore();}
});
