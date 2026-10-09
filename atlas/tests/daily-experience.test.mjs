import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {compute} from '../../shared/atlas-streak-core.mjs';
import {dailySummary,dailyPhase,planningDay,WORKFLOW_KEYS} from '../../shared/atlas-workflow-core.mjs';
import {priorityDay,workHome} from '../work.mjs';
import {createBackup,parseBackup} from '../../shared/atlas-vault-core.mjs';
process.env.TZ='America/Winnipeg';
const storage=(data={})=>{const values=new Map(Object.entries(data));return {values,get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};};
test('one missed local day is forgiven, never earned, and another miss within seven days breaks the run',()=>{
 assert.deepEqual(compute([], '2026-10-09'),{current:0,longest:0,forgiven:0});
 assert.deepEqual(compute(['2026-10-01','2026-10-03','2026-10-04'],'2026-10-04'),{current:3,longest:3,forgiven:1});
 assert.deepEqual(compute(['2026-10-01','2026-10-03','2026-10-05'],'2026-10-05'),{current:1,longest:2,forgiven:0});
 const days=['2026-10-01',...Array.from({length:7},(_,i)=>'2026-10-'+String(i+3).padStart(2,'0')),'2026-10-11'];
 assert.deepEqual(compute(days,'2026-10-11'),{current:9,longest:9,forgiven:2});
});
test('duplicate, invalid and future completions do not count; an open day adds no count',()=>{
 const days=['2026-10-01','2026-10-01','2026-02-30','garbage','2026-10-10'];
 assert.equal(compute(days,'2026-10-01').current,1);assert.equal(compute(days,'2026-10-02').current,1);
 assert.equal(compute(days,'2026-10-03').current,1);assert.equal(compute(days,'2026-10-04').current,0);
 assert.equal(compute(['2026-10-04'],'2026-10-04').current,1,'a restored record recomputes directly');
});
test('public daily view and private priority slots share the 18:00 local boundary, including year rollover and DST',()=>{
 for(const day of ['2026-10-09','2026-11-01','2026-12-31']){
  const before=new Date(day+'T17:59:59'),after=new Date(day+'T18:00:00');
  assert.equal(dailyPhase(before),'morning');assert.equal(dailyPhase(after),'evening');
  assert.equal(planningDay(before),day);assert.equal(priorityDay(day,before),day);
  assert.equal(priorityDay(day,after),planningDay(after));
 }
 assert.equal(planningDay(new Date('2026-12-31T18:00:00')),'2027-01-01');
});
test('daily projection reads saved Ledger days and source priorities without rewriting any record',()=>{
 const map={projects:[{id:'one',task:'Source work',plan:'2026-10-09',due:'2026-10-10',status:'Not started'},{id:'done',task:'Completed',status:'Done',doneAt:'2026-10-09T12:00:00-05:00'}],dayPlans:{'2026-10-09':{focus:{kind:'task',id:'one'}}}};
 const s=storage({lifemap_v1:JSON.stringify(map),'lifeledger:v2':JSON.stringify([{date:'2026-10-09',units:{},note:'A saved reflection'}])});const before=[...s.values];
 const result=dailySummary(s,{days:[]},new Date('2026-10-09T18:00:00'));
 assert.equal(result.phase,'evening');assert.equal(result.ledgerSaved,true);assert.equal(result.priorities[0].id,'one');assert.equal(result.activity.find(a=>a.app==='Life Map').count,1);assert.equal(result.due[0].due,'2026-10-10');assert.deepEqual([...s.values],before);assert(WORKFLOW_KEYS.includes('lifeledger:v2'));
 const unavailable=dailySummary(storage({'lifeledger:v2':'{broken'}),null,new Date('2026-10-09T18:00:00'));assert(unavailable.issues.includes('Life Ledger'));
 const draft=dailySummary(storage({'lifeledger:drafts:v1':JSON.stringify({days:{'2026-10-09':{note:'Unsaved'}}})}),null,new Date('2026-10-09T18:00:00'));assert.equal(draft.ledgerSaved,false);
});
test('tomorrow pins are source references and leave actual completions on their saved day',()=>{
 const data={tasks:[],projects:[{id:'one',title:'Source item',status:'open'}],herald:{items:[]},priorities:[{kind:'project',record_id:'one',day:'2026-10-10',slot:1}]};
 assert.equal(workHome(data,'2026-10-09').priorities.length,0);assert.equal(workHome(data,'2026-10-10').priorities[0].record,data.projects[0]);assert.equal(data.tasks.length,0);
});
test('hide-streak preference and native practice goal round-trip through the unchanged Vault format',()=>{
 const s=storage({'atlas.streaks.hidden.v1':'true',mc_profile:JSON.stringify({goal:'clarity'})});const pack=createBackup(s),parsed=parseBackup(pack.text);
 assert.equal(pack.payload.version,2);assert.equal(parsed.entries.length,2);assert.throws(()=>parseBackup(JSON.stringify({mc_profile:'{"goal":"invalid"}'})));
});
test('investing first-use goal preserves old fields, rejects invalid answers and survives restoration',()=>{
 const s=storage({'crucible:state':JSON.stringify({checks:{},notes:{},tab:'today',oldField:'keep'}),'crucible:schema-version':'2'}),window={};vm.runInNewContext(readFileSync(new URL('../../shared/communicator-curriculum.js',import.meta.url),'utf8'),{window,localStorage:s,Date});
 assert.equal(s.values.get('crucible:state').includes('goal'),false);assert.equal(window.CrucibleCurriculum.chooseGoal('statements'),true);const pack=window.CrucibleCurriculum.snapshot();assert.equal(pack.state.oldField,'keep');assert.equal(pack.state.goal,'statements');assert.equal(window.CrucibleCurriculum.chooseGoal('process'),false);assert.throws(()=>window.CrucibleCurriculum.replace({...pack,state:{...pack.state,goal:'bad'}}));assert.equal(window.CrucibleCurriculum.replace(pack),true);assert.equal(window.CrucibleCurriculum.snapshot().state.goal,'statements');
});
