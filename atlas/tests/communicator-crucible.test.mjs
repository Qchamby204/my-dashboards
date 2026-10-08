import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
function boot(records={},blocked=false){
  const storage=new Map(Object.entries(records)),writes=[];
  const localStorage={getItem:k=>storage.get(k)??null,setItem(k,v){if(blocked)throw Error('Quota');writes.push(k);storage.set(k,v);}};
  const window={};vm.runInNewContext(readFileSync(new URL('../../shared/communicator-curriculum.js',import.meta.url),'utf8'),{window,localStorage,console,Date});
  return {api:window.CrucibleCurriculum,storage,writes};
}
const saved={checks:{'canon::old':true,'blocks::b01':true,'stmt::l1_test':true,'2023-01-03::t:t1':true},notes:{'2023-01-03':'Keep this old learning note'},tab:'archive'};
test('combined curriculum reads existing Crucible records without writing or expiring them',()=>{
  for(const version of [1,2]){const h=boot({'crucible:state':JSON.stringify(saved),'crucible:schema-version':String(version),'mc_reps':'["keep"]'});
    assert.equal(h.writes.length,0);assert.deepEqual(JSON.parse(JSON.stringify(h.api.snapshot().state)),saved);assert.equal(h.api.stats().mastery,10);assert.equal(h.api.stats().blocks,1);assert.match(h.api.view('archive'),/Keep this old learning note/);
  }
});
test('all ten reference views remain available in the combined app',()=>{
  const h=boot();for(const id of ['today','cadence','arc','review','archive','blocks','statements','workflow','method','arsenal'])assert.ok(h.api.view(id).length>100);
  assert.equal(h.api.BLOCKS.length,17);assert.equal(h.api.STATEMENTS.length,10);assert.equal(h.api.ARSENAL.length,12);
});
test('one investing edit preserves older notes, unknown checks and communication records',()=>{
  const h=boot({'crucible:state':JSON.stringify(saved),'crucible:schema-version':'2','mc_reps':'["keep"]'});
  assert.equal(h.api.change('checks','blocks::b02',true),true);const next=JSON.parse(h.storage.get('crucible:state'));
  assert.equal(next.checks['canon::old'],true);assert.equal(next.notes['2023-01-03'],saved.notes['2023-01-03']);assert.equal(h.storage.get('mc_reps'),'["keep"]');assert.equal(h.api.stats().mastery,10);
});
test('stale-tab field edits merge the latest persisted investing records',()=>{
  const h=boot({'crucible:state':JSON.stringify(saved),'crucible:schema-version':'2'});
  h.storage.set('crucible:state',JSON.stringify({...saved,notes:{...saved.notes,'2026-10-08':'A newer tab'}}));
  h.api.change('checks','blocks::b02',true);assert.equal(JSON.parse(h.storage.get('crucible:state')).notes['2026-10-08'],'A newer tab');
});
test('failed saves keep exportable investing changes and do not write communication records',()=>{
  const h=boot({'crucible:state':JSON.stringify(saved),'crucible:schema-version':'2'},true);
  assert.equal(h.api.change('notes','2026-10-08','Unsaved but recoverable'),false);assert.equal(h.api.pending,true);assert.equal(h.api.snapshot().state.notes['2026-10-08'],'Unsaved but recoverable');assert.deepEqual(JSON.parse(h.storage.get('crucible:state')),saved);assert.equal(h.writes.length,0);
});
test('malformed records are preserved for recovery and cannot be overwritten by ordinary edits',()=>{
  const h=boot({'crucible:state':'{broken','crucible:schema-version':'2'});assert.ok(h.api.problem);assert.equal(h.api.change('checks','blocks::b01',true),false);assert.equal(h.api.snapshot().unreadableState,'{broken');assert.equal(h.writes.length,0);
});
test('validated Crucible backups round-trip and reject wrong identity or malformed checks before writes',()=>{
  const h=boot();assert.throws(()=>h.api.replace({tool:'chef',schemaVersion:2,state:saved}));assert.throws(()=>h.api.replace({tool:'crucible',schemaVersion:2,state:{...saved,checks:[]}}));assert.equal(h.writes.length,0);
  assert.equal(h.api.replace({tool:'crucible',schemaVersion:2,state:saved}),true);assert.deepEqual(JSON.parse(h.storage.get('crucible:state')),saved);assert.equal(h.api.snapshot().state.notes['2023-01-03'],saved.notes['2023-01-03']);
});
