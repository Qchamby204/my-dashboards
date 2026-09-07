import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {weeklyAgenda} from '../agenda.mjs';
const week='2026-09-07',last='2026-09-13',stamp=week+'T12:00:00Z';
const rows=a=>a.days.flatMap(d=>d.entries);
const task=(id,extra={})=>({id,title:id,status:'open',week_start:week,due_date:week,...extra});
test('agenda separates explicit deadlines from week-only plans, excludes archives, and keeps completed work on its completion date',()=>{
 const data={tasks:[task('due'),task('unscheduled',{week_start:null}),task('week-only',{due_date:null}),task('different-date',{due_date:'2026-09-14'}),task('archived',{status:'archived'}),task('done',{status:'done',completed_at:stamp,due_date:last}),task('unknown-completion',{status:'done',completed_at:null})],projects:[{id:'project',title:'Project',due_date:last,status:'open',mode:'snapshot'},{id:'archived-project',title:'Archived',due_date:week,status:'open',archived_at:stamp},{id:'snapshot-done',title:'Imported completed project',status:'done',completed_at:null}]};
 const before=structuredClone(data),agenda=weeklyAgenda(data,week),entries=rows(agenda);
 assert.deepEqual(entries.map(r=>r.id).sort(),['done','due','project','unscheduled']);assert.equal(agenda.planned,3);assert.equal(agenda.recorded,1);assert.equal(agenda.undatedCommitments,1);assert.equal(agenda.otherDateCommitments,1);
 assert.equal(entries.find(r=>r.id==='done').date,week);assert.match(entries.find(r=>r.id==='unscheduled').detail,/Not assigned/);assert.match(entries.find(r=>r.id==='project').detail,/snapshot/);assert.deepEqual(data,before);
});
test('Herald publication uses only the recorded actual date and completed lessons never come from listening or publication dates',()=>{
 const data={herald:{items:[{id:'planned',title:'Plan',stage:'scheduled',scheduled_day:week,published_day:null},{id:'published',title:'Published',stage:'published',scheduled_day:'2026-08-31',published_day:last},{id:'undated',title:'Undated',stage:'published',scheduled_day:week,published_day:null},{id:'archived',title:'Archived',stage:'draft',scheduled_day:week,archived:true},{id:'outside',title:'Outside',stage:'published',scheduled_day:week,published_day:'2026-09-14'}]},practice:{catalog:[{id:'unpractised',title:'Published lesson',day:week}],items:[{id:'practised',title:'Earlier lesson',day:'2026-08-03',completedDay:last,completedAt:last+'T12:00:00Z'}]},communication:{reps:[{id:'speaking',topic:'A session',day:week,drill:'A question',archived:false},{id:'archived-session',topic:'Archived',day:week,archived:true}]},ledger:{days:[{date:week,checked:['habit'],note:'A private reflection',tomorrow:'A private plan'}]}};
 const agenda=weeklyAgenda(data,week),entries=rows(agenda);
 assert.deepEqual(entries.map(r=>r.id).sort(),['2026-09-07','planned','practised','published','speaking']);assert.equal(agenda.planned,1);assert.equal(agenda.recorded,4);assert.equal(entries.find(r=>r.id==='practised').date,last);assert.equal(entries.find(r=>r.id==='published').date,last);
 assert.ok(!JSON.stringify(agenda).includes('A private reflection'));assert.match(entries.find(r=>r.kind==='day').detail,/1 check-in · Reflection saved/);
});
test('agenda filters retain seven ordered calendar days, exact counts, and no invented entries in an empty workspace',()=>{
 const data={tasks:[task('task')],herald:{items:[{id:'content',title:'Content',stage:'published',published_day:last}]}};
 const a=weeklyAgenda(data,week,{source:'herald',type:'activity'});assert.equal(a.total,1);assert.equal(a.planned,0);assert.equal(a.recorded,1);assert.deepEqual(a.days.map(d=>d.date),['2026-09-07','2026-09-08','2026-09-09','2026-09-10','2026-09-11','2026-09-12','2026-09-13']);assert.equal(weeklyAgenda({},week).total,0);
 assert.equal(weeklyAgenda(data,week,{source:'tasks',type:'activity'}).total,0);
 for(const options of [{source:'__proto__'},{type:'calendar'},{source:['tasks']}])assert.throws(()=>weeklyAgenda(data,week,options));assert.throws(()=>weeklyAgenda(data,'2026-09-08'));
 const crossing=weeklyAgenda({tasks:[task('year-end',{due_date:'2027-01-03'})]},'2026-12-28');assert.equal(crossing.total,1);assert.equal(crossing.days.at(-1).date,'2027-01-03');
});
test('completion timestamps use the viewing timezone across daylight saving boundaries; explicit stored days stay unchanged',()=>{
 const code=`import {weeklyAgenda} from ${JSON.stringify(new URL('../agenda.mjs',import.meta.url).href)};const a=weeklyAgenda({tasks:[{id:'late',title:'Late Sunday',status:'done',completed_at:'2026-11-02T05:30:00Z'},{id:'next',title:'Monday',status:'done',completed_at:'2026-11-02T06:30:00Z'},{id:'first',title:'First one-thirty',status:'done',completed_at:'2026-11-01T06:30:00Z'},{id:'second',title:'Second one-thirty',status:'done',completed_at:'2026-11-01T07:30:00Z'}],ledger:{days:[{date:'2026-11-01',checked:[]}]}},'2026-10-26');console.log(JSON.stringify(a.days.flatMap(d=>d.entries).map(e=>({id:e.id,date:e.date}))));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,TZ:'America/Winnipeg'}});assert.equal(child.status,0,child.stderr);const r=JSON.parse(child.stdout);assert.deepEqual(r.map(x=>x.id).sort(),['2026-11-01','first','late','second']);assert.ok(r.every(x=>x.date==='2026-11-01'));
});
