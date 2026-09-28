import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const context=vm.createContext({window:{}});vm.runInContext(read('shared/library-catalog.js'),context);
const seed=JSON.parse(JSON.stringify(context.window.ATLAS_LIBRARY_CATALOG));
test('Every original subsection has exactly one learning step and reflection',()=>{
 assert.equal(seed.books.length,129);
 assert.equal(Object.keys(seed.learning).length,14);
 for(const t of seed.topics){const path=seed.learning[t.id];assert.ok(path.overview.length>30);
  assert.deepEqual(path.steps.map(s=>s.id).sort(),t.subtopics.map(s=>s.id).sort());
  for(const step of path.steps){assert.ok(step.label);assert.ok(step.why.length>30);assert.ok(step.checkpoint.length>30);}
 }
});
test('Suggested book orders contain every original book in their subsection exactly once',()=>{
 for(const [sid,ids] of Object.entries(seed.bookOrder))assert.deepEqual([...ids].sort(),seed.books.filter(b=>b.subtopic===sid).map(b=>b.id).sort());
 assert.deepEqual(seed.learning['1'].steps.map(s=>s.id),['1A','1C','1B','1E','1D','1F','1G']);
 assert.equal(seed.learning['12'].steps.filter(s=>s.label==='Optional branch').length,3);
 assert.equal(seed.learning['14'].steps.find(s=>s.id==='14B').label,'Story sequence');
});
test('Presentation ordering leaves records intact and does not rank renamed or moved titles',()=>{
 const js=read('shared/library.js');
 const start=js.indexOf('function learningBookRank('),end=js.indexOf('function learningGuide(');
 const original=seed.books.find(b=>b.id==='b-1A-03');
 const added={id:'custom-test',title:'My new book',author:'Me',topic:'1',subtopic:'1A'};
 const renamed={...original,id:'b-1A-04',title:'Replacement title'};
 const moved={...seed.books.find(b=>b.id==='b-1C-01'),subtopic:'1A'};
 const state={catalog:[added,renamed,moved,...seed.books.filter(b=>!['b-1A-04','b-1C-01'].includes(b.id))]};
 const before=JSON.stringify(state);
 const ctx=vm.createContext({seed,state});vm.runInContext(js.slice(start,end),ctx);
 assert.equal(vm.runInContext("booksIn('1','1A')[0].id",ctx),'b-1A-03');
 assert.equal(vm.runInContext("learningBookRank(state.catalog[0])",ctx),Infinity);
 assert.equal(vm.runInContext("learningBookRank(state.catalog[1])",ctx),Infinity);
 assert.equal(vm.runInContext("learningBookRank(state.catalog[2])",ctx),Infinity);
 assert.equal(JSON.stringify(state),before);
 ctx.t={...seed.topics[0],subtopics:[...seed.topics[0].subtopics,{id:'1Xmine',title:'My own'}]};
 assert.equal(vm.runInContext('learningSubs(t).at(-1).id',ctx),'1Xmine');
});
test('Learning catalogue URL has a content hash',()=>{
 const hash=createHash('sha256').update(read('shared/library-catalog.js')).digest('hex').slice(0,12);
 assert.ok(read('the-library.html').includes('shared/library-catalog.js?v='+hash));
});
