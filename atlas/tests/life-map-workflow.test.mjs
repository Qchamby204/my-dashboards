import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createLifeMapWorkflow} from '../life-map-workflow-core.mjs';
import {validateLifeMapRecords as validate} from '../life-map-records.mjs';
import {validateAppState,connectedState,retainAppDetails} from '../connected-model.mjs';
const m=createLifeMapWorkflow(),today='2026-09-17';
const task=(id,extra={})=>({id,task:'Task '+id,status:'Not started',area:'Home',pri:'Med',due:'',...extra});
const board=(projects=[])=>({projects,chores:[],checks:{},planned:{},log:[]});
let sequence=0;const uid=()=>`test-${++sequence}`;

test('title-only capture belongs in Inbox; no guessed area or artificial deadline',()=>{
 const [p]=m.capture('Call the contractor',{},today,uid);assert(p.inbox);assert.equal(p.area,'');assert.equal(p.due,'');assert.equal(p.plan,'');
});
test('Today and This week are plans, not deadlines',()=>{
 const [t]=m.capture('Call the contractor',{when:'today'},today,uid);assert.equal(t.plan,today);assert.equal(t.due,'');assert(!t.inbox);
 const [w]=m.capture('Compare quotes',{when:'wk'},today,uid);assert.equal(w.planWeek,'2026-09-14');assert.equal(w.due,'');assert.equal(w.plan,'');
});
test('planning actions never move actual deadlines',()=>{
 for(const when of ['today','tomorrow','wk','next','inbox','someday','2026-10-20','2026-12']){const p=task('one',{due:'2026-10-30'});m.setPlan(p,when,today);assert.equal(p.due,'2026-10-30');}
});
test('limited natural language parsing exposes plan, week and deadline separately',()=>{
 assert.deepEqual(m.parseCapture('Email contractor tomorrow',today),{title:'Email contractor',plan:'2026-09-18',planWeek:'',due:''});
 assert.deepEqual(m.parseCapture('File document — due October 30',today),{title:'File document',plan:'',planWeek:'',due:'2026-10-30'});
 assert.deepEqual(m.parseCapture('Compare estimates this week',today),{title:'Compare estimates',plan:'',planWeek:'2026-09-14',due:''});
 assert.equal(m.parseCapture('Call Friday due October 30',today).plan,'2026-09-18');
});
test('invalid dates and disabled parsing preserve original wording',()=>{
 for(const title of ['Something due February 30','Something due 2026-02-30','tomorrow'])assert.equal(m.parseCapture(title,today).title,title);
 const [p]=m.capture('Watch The Day After Tomorrow',{parse:false},today,uid);assert.equal(p.task,'Watch The Day After Tomorrow');assert.equal(p.plan,'');
});
test('multiline capture previews separate bounded tasks and unique IDs',()=>{
 const rows=m.capture('- First task\n• Second task\n3. Third task',{},today,uid);assert.equal(rows.length,3);assert.deepEqual(rows.map(p=>p.task),['First task','Second task','Third task']);assert.equal(new Set(rows.map(p=>p.id)).size,3);
 assert.throws(()=>m.capture(Array(51).fill('task').join('\n'),{},today,uid));assert.throws(()=>m.capture('x'.repeat(301),{},today,uid));
});
test('Today shows due, chosen, followups, and rollover without duplicating a task',()=>{
 const b=[task('both',{plan:today,due:today}),task('chosen',{plan:today}),task('waiting',{status:'Waiting',followUp:today}),task('old',{plan:'2026-09-16'}),task('future',{plan:'2026-09-18'})];
 const t=m.todayTasks(b,today);assert.deepEqual(t.due.map(x=>x.id),['both']);assert.deepEqual(t.chosen.map(x=>x.id),['chosen']);assert.deepEqual(t.waiting.map(x=>x.id),['waiting']);assert.deepEqual(t.rollover.map(x=>x.id),['old']);
});
test('Next excludes Inbox, Waiting, completed, archived and future-planned work',()=>{
 for(const extra of [{inbox:true},{status:'Waiting'},{status:'Done'},{archived:true},{plan:'2026-09-18'},{planWeek:'2026-09-21'},{someday:true}])assert(!m.actionable(task('one',extra),today));assert(m.actionable(task('one'),today));
});
test('exact return dates and legacy parking retain deadline safety',()=>{
 assert(m.parked(task('one',{showAfter:'2026-12-01'}),today));assert(!m.parked(task('one',{showAfter:'2026-12-01',due:'2026-09-20'}),today));assert(!m.parked(task('one',{showAfter:today}),today));assert(m.parked(task('one',{park:'2026-12'}),today));
});
test('group first, then sort tasks within one heading per area',()=>{
 const groups=m.groupTasks([task('a',{area:'Home',due:'2026-09-18'}),task('b',{area:'Work',due:'2026-09-19'}),task('c',{area:'Home',due:'2026-09-20'})],today);assert.equal(groups.length,2);assert.deepEqual(groups[0][1].map(x=>x.id),['a','c']);
});
test('project progress counts finite tasks and selects an actionable next action',()=>{
 const g={id:'office',title:'Office'};const b=board([task('wait',{parentId:'office',status:'Waiting'}),task('done',{parentId:'office',status:'Done'}),task('next',{parentId:'office'}),task('other')]);const p=m.projectProgress(b,g,today);assert.equal(p.total,3);assert.equal(p.done,1);assert.equal(p.next.id,'next');
});
test('unified search includes checklist, notes and chores with explicit archive inclusion',()=>{
 const b=board([task('a',{notes:'contractor invoice'}),task('b',{status:'Done',task:'Archived invoice'})]);b.groups=[{id:'group',title:'Office invoice'}];b.chores=[{id:'c',chore:'Invoice filing',cad:'Monthly'}];assert.equal(m.search(b,'invoice').length,3);assert.equal(m.search(b,'invoice',{archive:true}).length,4);
});
test('fixed weekly schedules do not drift after late completion',()=>{
 const r={mode:'fixed',unit:'week',every:1,anchor:'2026-09-13'};assert.equal(m.nextFixed(r,'2026-09-17'),'2026-09-20');assert.equal(m.nextFixed(r,'2026-09-20'),'2026-09-27');
});
test('month and year schedules retain the original anchor through short months',()=>{
 const r={unit:'month',every:1,anchor:'2027-01-31'};assert.equal(m.nextFixed(r,'2027-01-31'),'2027-02-28');assert.equal(m.nextFixed(r,'2027-02-28'),'2027-03-31');assert.equal(m.addPeriod('2024-02-29','year',1),'2025-02-28');
});
test('after-completion recurrence uses the completion date, not the old deadline',()=>{
 const c={repeat:{mode:'after',unit:'month',every:3,anchor:'2026-09-01'},nextDue:'2026-09-01'};assert.equal(m.advanceChore(c,today),'2026-12-17');
});
test('calendar date operations remain stable across DST and the year boundary',()=>{
 assert.equal(m.plus('2026-11-01',1),'2026-11-02');assert.equal(m.plus('2026-12-31',1),'2027-01-01');assert.equal(m.week('2027-01-01'),'2026-12-28');
});
test('templates create fresh projects, tasks and unchecked checklist items',()=>{
 const g={id:'office',title:'Office',area:'Home'},b=board([task('a',{parentId:g.id,status:'Done',due:today,checklist:[{id:'check',text:'Verify',done:true}]})]);const t=m.taskTemplate(b,g),x=m.fromTemplate(t,today,uid);assert.notEqual(x.group.id,g.id);assert.equal(x.tasks[0].status,'Not started');assert.equal(x.tasks[0].due,'');assert.equal(x.tasks[0].checklist[0].done,false);assert.notEqual(x.tasks[0].id,'a');
});
test('validation preserves legacy bytes and unknown optional fields without migration',()=>{
 const b=board([task('one')]);b.legacyExtra={note:'keep'};const raw=JSON.stringify(b);assert.equal(JSON.stringify(validate(b)),raw);assert.equal(JSON.stringify(b),raw);
});
test('new fields round-trip through both local and connected validators',()=>{
 const b=board([task('one',{status:'Waiting',waitingFor:'Supplier',followUp:today,parentId:'group',plan:today,inbox:false,tags:['Calls'],links:['https://example.com/quote'],checklist:[{id:'check',text:'Read quote',done:false}]})]);b.groups=[{id:'group',title:'Office'}];b.chores=[{id:'chore',chore:'Inspection',cad:'Monthly',repeat:{mode:'after',unit:'month',every:3,anchor:today},nextDue:today}];b.choreHistory=[{id:'history',choreId:'chore',date:today,occurrence:today,status:'skipped'}];b.preferences={areaOrder:['Home'],hideEmpty:true};b.templates=[{id:'template',...m.taskTemplate(b,b.groups[0])}];assert.deepEqual(validate(b),b);assert.deepEqual(validateAppState('life-map',b),b);
});
test('unsafe links, missing parents and invalid recurrence are rejected',()=>{
 for(const extra of [{parentId:'missing'},{links:['javascript:alert(1)']},{followUp:'2026-02-30'},{checklist:[{id:'one',text:'Check',done:'yes'}]}])assert.throws(()=>validate(board([task('one',extra)])));
 assert.throws(()=>validate({...board(),chores:[{id:'c',chore:'Thing',cad:'Monthly',repeat:{mode:'fixed',unit:'month',every:0,anchor:today}}]}));
 assert.throws(()=>validate(JSON.parse('{"projects":[],"__proto__":{"bad":1}}')));
});
test('private canonical status preserves Waiting and rich task details',()=>{
 const raw=board([task('one',{status:'Waiting',waitingFor:'Supplier',followUp:today,parentId:'group'})]);raw.groups=[{id:'group',title:'Office'}];
 const x=connectedState('life-map',{projects:[{source_id:'one',title:'Task one',area:'Home',status:'open',due_date:null,archived_at:null}]},{state_json:JSON.stringify(raw)});assert.equal(x.projects[0].status,'Waiting');assert.equal(x.projects[0].parentId,'group');assert.deepEqual(x.groups,raw.groups);
});
test('calendar reminder escapes content, includes an alert and folds Unicode safely',()=>{
 const x=m.calendarReminder({id:'one',title:'Call; vendor, confirm\n'+ 'é'.repeat(90),date:today,time:'14:30'});assert(x.includes('DTSTART:20260917T143000'));assert(x.includes('BEGIN:VALARM'));assert(!x.includes('\nBEGIN:ATTACK'));assert(x.includes('Call\\; vendor\\, confirm\\n'));for(const line of x.split('\r\n'))assert(new TextEncoder().encode(line).length<=75);assert.throws(()=>m.calendarReminder({id:'one',title:'Bad',date:'2026-02-30'}));
});
test('generated script treats replacement-token text literally and compiles',()=>{
 const html=readFileSync(new URL('../../life-map.html',import.meta.url),'utf8');const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];assert(script.includes('createLifeMapWorkflow'));new vm.Script(script);const build=readFileSync(new URL('../build-life-map.mjs',import.meta.url),'utf8');assert(build.includes('replace(match[0],()=>'));
});


test('private deletion retains archived parent metadata for canonical record recovery',()=>{
 const old=board([task('child',{parentId:'group'})]);old.groups=[{id:'group',title:'Old project'}];const retained=retainAppDetails('life-map',board(),{state_json:JSON.stringify(old)});assert.equal(retained.groups[0].archived,true);assert.equal(retained.projects[0].parentId,'group');
});
