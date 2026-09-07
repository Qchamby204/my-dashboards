import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import * as model from '../model.mjs';
const week='2026-09-07';
function harness(){
 const nodes=new Map(),pending=[],opened=[],details=[],location={hash:'#ledger'};
 function node(selector){
  if(selector.startsWith('dialog[open]'))return null;
  if(!nodes.has(selector))nodes.set(selector,{id:selector.slice(1),value:'',textContent:'',innerHTML:'',open:false,hidden:false,disabled:false,addEventListener(){},focus(){this.focused=true;},close(){this.open=false;},showModal(){this.open=true;},querySelectorAll(){return [];},reset(){},insertAdjacentHTML(){},elements:Object.fromEntries(['title','app_id','project_id','week_start','minutes','due_date','note','worked'].map(k=>[k,{value:'',focus(){this.focused=true;},insertAdjacentHTML(){}}]))});
  return nodes.get(selector);
 }
 const document={querySelector:node,querySelectorAll:selector=>selector==='[data-project-id]'||selector==='[data-lesson-id]'?details:[],addEventListener(){},visibilityState:'visible'};
 const ui=kind=>({dirty:false,saving:false,weekly:()=>'',page:()=>'',openRecord:id=>opened.push({kind,id})});
 const context=vm.createContext({...model,createBudgetUI:()=>({dirty:false,saving:false,panel:()=>''}),createCommitmentsUI:()=>({page:()=>''}),createAgendaUI:()=>({panel:()=>''}),createSearchUI:()=>({}),createReflectionUI:()=>({dirty:false,saving:false,form:()=>'',notes:()=>''}),createHeraldUI:()=>ui('content'),createCommunicationUI:()=>ui('speaking'),createLedgerUI:()=>({dirty:false,saving:false,daily:()=>'',selectDay:id=>opened.push({kind:'day',id}),openHabit:id=>opened.push({kind:'habit',id})}),createEditionRefreshUI:()=>({saving:false,panel:()=>''}),document,window:{addEventListener(){}},location,history:{pushState:(a,b,hash)=>location.hash=hash},Date,structuredClone,console,setInterval(){},setTimeout(){},fetch:(path,options)=>new Promise((resolve,reject)=>pending.push({path,options,resolve,reject})),localDay:()=>week});
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
 vm.runInContext(source,context);
 const state={tasks:[],projects:[],week:null,ledger:null,practice:null,communication:null,herald:null};
 const reply=async(index,data=state)=>{pending[index].resolve({ok:true,json:async()=>structuredClone(data)});await new Promise(setImmediate);};
 return {context,node,pending,opened,details,location,state,reply,run:s=>vm.runInContext(s,context)};
}
test('actual app opens fresh records by exact ID, including hidden archives, older lessons and earlier weekly reviews without writes',async()=>{
 const h=harness();await h.reply(0);
 const fresh={...h.state,tasks:[{id:'task',title:'Fresh title',status:'archived',app_id:'life-map',minutes:30,revision:9}],projects:[{id:'project',title:'A completed archive',status:'done',mode:'managed',archived_at:'2026-09-01',area:'Community',revision:3}],practice:{items:[],catalog:Array.from({length:80},(_,i)=>({id:'lesson-'+i,title:'Lesson '+i,track:'Listening',task:'Try a question',day:week})),mode:'managed',imported_at:week+'T12:00:00Z'},ledger:{habits:[{id:'habit',title:'Read',archived:true}],days:[{date:'2026-08-03',note:'Saved day',checked:[]}]},communication:{reps:[{id:'speaking',topic:'Saved practice',archived:true}]},herald:{items:[{id:'content',title:'Saved content',archived:true}]}};
 for(const [kind,id] of [['task','task'],['project','project'],['lesson','lesson-79'],['habit','habit'],['day','2026-08-03'],['speaking','speaking'],['content','content'],['review','2026-08-03']]){
  h.node('#task-dialog').close();h.details.length=0;const d={dataset:{projectId:id,lessonId:id},open:false,scrollIntoView(){this.scrolled=true;},querySelector(){return {focus(){}};}};h.details.push(d);
  h.context.result={kind,id};const pending=h.run('resolveSavedRecord(result)');pending.catch(()=>{});const index=h.pending.length-1;const response={...fresh,week:kind==='review'?{week_start:id,worked:'An earlier review',change:'',revision:7}:null};await h.reply(index,response);const activate=await pending;
  assert.equal(h.pending[index].options.method,'GET');activate();
  if(kind==='task'){assert.equal(h.node('#task-form').elements.title.value,'Fresh title');assert.match(h.node('#task-record-status').textContent,/Archived/);assert.equal(h.run('editing.revision'),9);}
  if(kind==='project'){assert.equal(h.node('#project-filter').value,'archived');assert.equal(d.open,true);}
  if(kind==='lesson'){assert.equal(d.open,true);assert.equal(h.run('practiceSelected'),'lesson-79');assert.match(h.node('#content').innerHTML,/Showing the lesson opened/);assert.ok(!h.node('#content').innerHTML.includes('data-lesson-id="lesson-0"'));}
  if(['habit','day','speaking','content'].includes(kind))assert.deepEqual(h.opened.at(-1),{kind,id});
  if(kind==='review'){assert.equal(h.run('week'),id);assert.equal(h.run('data.week.revision'),7);assert.equal(h.node('#review-form').elements.worked.focused,true);}
 }
 assert.ok(h.pending.every(r=>r.options.method==='GET'));
});
test('actual app keeps state on unavailable records, failures, cancellation and new drafts, and invalidates earlier refreshes after activation',async()=>{
 const h=harness();await h.reply(0);h.context.result={kind:'day',id:week};
 let pending=h.run('resolveSavedRecord(result)');pending.catch(()=>{});await h.reply(1);await assert.rejects(pending,/no longer/);assert.equal(h.run('loadedWeek'),week);
 pending=h.run('resolveSavedRecord(result)');pending.catch(()=>{});h.pending[2].reject(Error('Offline'));await assert.rejects(pending,/offline/);assert.equal(h.run('data.ledger'),null);
 h.context.signal={aborted:false};pending=h.run('resolveSavedRecord(result,signal)');pending.catch(()=>{});h.context.signal.aborted=true;await h.reply(3);await assert.rejects(pending,/cancelled/);
 pending=h.run('resolveSavedRecord(result)');pending.catch(()=>{});h.run('reviewDirty=true');await h.reply(4);await assert.rejects(pending,/draft is still here/);const n=h.pending.length;await assert.rejects(h.run('resolveSavedRecord(result)'),/current draft/);assert.equal(h.pending.length,n);h.run('reviewDirty=false');
 const oldLoad=h.run('load()');pending=h.run('resolveSavedRecord(result)');pending.catch(()=>{});const fresh={...h.state,ledger:{days:[{date:week,note:'Fresh saved note',checked:[]}],habits:[]}};await h.reply(6,fresh);(await pending)();await h.reply(5);await oldLoad;assert.equal(h.run('data.ledger.days[0].note'),'Fresh saved note');
});

test('agenda record links keep the selected planning week while opening fresh commitment details without writes',async()=>{
 const h=harness();await h.reply(0);h.run("week='2026-08-03';loadedWeek=week;view='week'");h.context.result={kind:'task',id:'task'};
 const pending=h.run("resolveSavedRecord(result,undefined,{taskView:'week',taskWeek:week})");
 assert.equal(h.pending[1].path,'/api/state?week=2026-08-03');await h.reply(1,{...h.state,tasks:[{id:'task',title:'Review the draft',status:'done',app_id:'life-map',minutes:30,completed_at:'2026-08-03T12:00:00Z',week_start:'2026-08-03',revision:9}]});(await pending)();
 assert.equal(h.run('week'),'2026-08-03');assert.equal(h.run('view'),'week');assert.equal(h.location.hash,'#week');assert.equal(h.node('#task-form').elements.title.value,'Review the draft');assert.equal(h.run('editing.revision'),9);assert.ok(h.pending.every(r=>r.options.method==='GET'));
});

test('archive undo restores earlier completion and is not offered after a newer intervening edit',async()=>{
 for(const latestRevision of [8,10]){
  const h=harness(),original={id:'task',title:'Earlier work',status:'done',completed_at:'2026-09-01T12:00:00Z',app_id:'life-map',minutes:30,revision:7};await h.reply(0,{...h.state,tasks:[original]});
  const pending=h.run("mutate(data.tasks[0],'archive')");await h.reply(1,{});await h.reply(2,{...h.state,tasks:[{...original,status:'archived',revision:latestRevision}]});await pending;
  if(latestRevision===10){assert.equal(h.run('undoAction'),null);continue;}
  const undo=h.run('undoAction()');assert.equal(JSON.parse(h.pending[3].options.body).action,'restore');assert.equal(JSON.parse(h.pending[3].options.body).revision,8);await h.reply(3,{});await h.reply(4,{...h.state,tasks:[{...original,revision:9}]});await undo;assert.equal(h.run('data.tasks[0].completed_at'),original.completed_at);
 }
});
test('commitment browsing opens the latest editor inside its own view and retains the selected week',async()=>{
 const h=harness();await h.reply(0);h.context.result={kind:'task',id:'task'};const pending=h.run("resolveSavedRecord(result,undefined,{taskView:'commitments',taskWeek:week})");await h.reply(1,{...h.state,tasks:[{id:'task',title:'Saved archive',status:'archived',revision:12,minutes:30,app_id:'life-map'}]});(await pending)();assert.equal(h.run('view'),'commitments');assert.equal(h.location.hash,'#commitments');assert.equal(h.node('#task-form').elements.title.value,'Saved archive');assert.equal(h.run('editing.revision'),12);
});
