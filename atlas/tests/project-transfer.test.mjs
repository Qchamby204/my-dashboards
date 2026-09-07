import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProjectUpdates, mergeProjectUpdates } from '../../shared/atlas-project-transfer-core.mjs';
import { parseBackup, previewRestore, applyRestore, recover } from '../../shared/atlas-vault-core.mjs';
const original={projects:[{id:'one',task:'Original',area:'Home',due:'',status:'In progress',notes:'Keep my notes',pri:'High',sub:'Details',park:'2026-12'},{id:'untouched',task:'Other',status:'Not started'}],chores:[{id:'c',chore:'Keep this'}],checks:{weekly:true},planned:{week:['one']},log:[]};
const envelope={app:'atlas-project-updates',version:1,projects:[{id:'one',title:'Updated title',area:'Learning',due_date:'2026-09-10',status:'done'},{id:'new',title:'New project',area:'Learning',due_date:null,status:'open'}]};
test('reviewed local updates preserve notes, priorities, chores and absent projects, and allow per-project selection',()=>{
  const rows=parseProjectUpdates(JSON.stringify(envelope)),next=mergeProjectUpdates(original,rows,['one'],'2026-09-07');
  assert.equal(next.projects.length,2);assert.equal(next.projects[0].task,'Updated title');assert.equal(next.projects[0].notes,'Keep my notes');assert.equal(next.projects[0].pri,'High');assert.equal(next.projects[0].doneAt,'2026-09-07');assert.deepEqual(next.chores,original.chores);assert.deepEqual(next.checks,original.checks);assert.deepEqual(next.planned,original.planned);assert.deepEqual(next.projects[1],original.projects[1]);assert.equal(original.projects[0].task,'Original');
  const reopened=mergeProjectUpdates(next,[{...rows[0],status:'open'}],['one'],'2026-09-08');assert.equal(reopened.projects[0].doneAt,undefined);assert.equal(reopened.log.length,0);
  const unchangedStatus=mergeProjectUpdates(original,[{...rows[0],status:'open'}],['one'],'2026-09-08');assert.equal(unchangedStatus.projects[0].status,'In progress');
  assert.throws(()=>parseProjectUpdates(JSON.stringify({...envelope,projects:[envelope.projects[0],envelope.projects[0]]})),/repeats/);
});
test('local project update and undo use verified Vault recovery with exact original text',async()=>{
  class Storage{constructor(value){this.map=new Map(value||[]);}getItem(k){return this.map.get(k)??null;}setItem(k,v){this.map.set(k,v);}removeItem(k){this.map.delete(k);}}
  const before=JSON.stringify(original,null,2),storage=new Storage([['lifemap_v1',before]]),session=new Storage();
  const updates=parseProjectUpdates(JSON.stringify(envelope)),next=mergeProjectUpdates(original,updates,updates.map(p=>p.id),'2026-09-07');
  const preview=previewRestore(parseBackup(JSON.stringify({lifemap_v1:JSON.stringify(next)})),storage);
  await applyRestore(preview,['map'],storage,session);assert.equal(JSON.parse(storage.getItem('lifemap_v1')).projects.length,3);
  await recover(storage,session);assert.equal(storage.getItem('lifemap_v1'),before);
});
