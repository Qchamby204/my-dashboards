import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCommitmentsUI} from '../commitments-ui.mjs';
const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
function harness(){
 const original={document:globalThis.document,window:globalThis.window},nodes=new Map(),events=new Map(),windowEvents=new Map(),opens=[],writes=[],activated=[];let blocked=false,lastError='';
 const node=id=>{if(!nodes.has(id))nodes.set(id,{id,disabled:false,value:'',innerHTML:'',textContent:'',hidden:false,elements:{query:{value:''}},querySelectorAll:()=>[node('control')],focus(){}});return nodes.get(id);};
 globalThis.document={querySelector:s=>node(s.slice(1)),addEventListener:(t,f)=>events.set(t,f)};globalThis.window={addEventListener:(t,f)=>windowEvents.set(t,f)};
 const data={projects:[],tasks:Array.from({length:55},(_,i)=>({id:'task-'+i,title:'Task <'+i+'>',app_id:'life-map',week_start:'2026-09-07',status:'open',minutes:30,revision:7}))};data.tasks.push({id:'archive',title:'Earlier completed work',app_id:'life-map',status:'archived',completed_at:'2026-09-01T12:00:00Z',revision:9});
 const ui=createCommitmentsUI({getData:()=>data,getWeek:()=>'2026-09-07',resolveResult:(row,signal,options)=>new Promise((resolve,reject)=>opens.push({row,signal,options,resolve:()=>resolve(()=>activated.push(row.id)),reject})),mutate:(task,action)=>new Promise((resolve,reject)=>writes.push({task,action,resolve,reject})),blocked:()=>blocked,error:m=>lastError=m,esc});
 const click=(key,value='',id='')=>{const target={id,dataset:{[key]:value,...(key==='commitmentAction'?{commitmentId:id}:{})},hasAttribute:n=>n==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}};return events.get('click')({target});};
 const change=(id,value)=>{node(id).value=value;events.get('change')({target:node(id)});};
 const draw=()=>{nodes.set('commitments-panel',{querySelectorAll:()=>[node('control')]});const html=ui.page();node('commitments-list').innerHTML=html;return html;};
 return {ui,data,node,opens,writes,activated,click,change,draw,events,windowEvents,get lastError(){return lastError;},set blocked(v){blocked=v;},restore(){globalThis.document=original.document;globalThis.window=original.window;}};
}
test('commitment browsing pages records, escapes titles, exposes archive restoration and clears all filters',async()=>{
 const h=harness();try{
  let html=h.draw();assert.match(html,/55 matching commitments/);assert.equal((html.match(/data-commitment-open=/g)||[]).length,50);assert.match(html,/Task &lt;/);await h.click('','', 'commitments-more');assert.equal((h.node('commitments-list').innerHTML.match(/data-commitment-open=/g)||[]).length,55);
  h.change('commitments-status','archived');html=h.node('commitments-list').innerHTML;assert.match(html,/Restore as completed/);assert.ok(!html.includes('data-commitment-action="complete"'));assert.equal(h.writes.length,0);
  h.change('commitments-app','life-ledger');assert.match(h.node('commitments-list').innerHTML,/No commitments match/);await h.click('','','commitments-reset');assert.equal(h.node('commitments-status').value,'all');assert.equal(h.node('commitments-app').value,'all');assert.match(h.node('commitments-list').innerHTML,/56 matching commitments/);
 }finally{h.restore();}
});
test('status actions capture the displayed revision, block duplicate saves, and leave the view usable after failure',async()=>{
 const h=harness();try{
  h.draw();h.change('commitments-status','archived');const saving=h.click('commitmentAction','restore','archive');assert.equal(h.node('control').disabled,true);assert.equal(h.writes[0].task.revision,9);assert.equal(h.writes[0].action,'restore');await h.click('commitmentAction','restore','archive');assert.equal(h.writes.length,1);
  h.change('commitments-status','open');assert.equal(h.node('commitments-status').value,'archived');h.writes[0].reject(Error('Another device saved first.'));await saving;assert.equal(h.node('control').disabled,false);assert.match(h.lastError,/Another device/);assert.equal(h.opens.length,0);
 }finally{h.restore();}
});
test('commitment editor reads respect cancellation, filter changes, failures and new drafts',async()=>{
 const h=harness();try{
  h.draw();let pending=h.click('commitmentOpen','task-0');await h.click('','','commitments-cancel-open');h.opens[0].resolve();await pending;assert.equal(h.activated.length,0);assert.equal(h.opens[0].signal.aborted,true);
  pending=h.click('commitmentOpen','task-0');h.change('commitments-status','archived');h.opens[1].resolve();await pending;assert.equal(h.activated.length,0);
  pending=h.click('commitmentOpen','archive');h.opens[2].reject(Error('Record no longer exists.'));await pending;assert.match(h.node('commitments-status-message').textContent,/retry/);assert.equal(h.node('control').disabled,false);
  pending=h.click('commitmentOpen','archive');h.blocked=true;h.opens[3].resolve();await pending;assert.equal(h.activated.length,0);assert.match(h.lastError,/draft/);h.blocked=false;
  pending=h.click('commitmentOpen','archive');assert.deepEqual(h.opens[4].options,{taskView:'commitments',taskWeek:'2026-09-07'});h.opens[4].resolve();await pending;assert.deepEqual(h.activated,['archive']);assert.equal(h.writes.length,0);
 }finally{h.restore();}
});
