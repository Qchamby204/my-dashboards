import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../../shared/record-guard.js',import.meta.url),'utf8');
function fixture(raw){
 const rows=new Map(raw===undefined?[]:[['record',raw]]),window={},storage={blocked:false,getItem:k=>rows.get(k)??null,setItem(k,v){if(this.blocked)throw Error('Storage unavailable');rows.set(k,v);}};
 vm.runInNewContext(source,{window,localStorage:storage});return {rows,storage,open:()=>window.AtlasRecords.open('record')};
}
test('independent stale-tab edits merge without erasing saved values',()=>{
 const f=fixture(JSON.stringify({favourites:{},ratings:{}})),a=f.open(),b=f.open();assert(a.write({favourites:{first:true},ratings:{}}));assert(b.write({favourites:{},ratings:{second:5}}));assert.deepEqual(JSON.parse(f.rows.get('record')),{favourites:{first:true},ratings:{second:5}});
});
test('competing edits and delete-versus-edit retain the saved record and pending recovery',()=>{
 const f=fixture(JSON.stringify({rows:[{id:'a',title:'Original'}]})),a=f.open(),b=f.open();assert(a.write({rows:[{id:'a',title:'Latest'}]}));const bytes=f.rows.get('record');assert.equal(b.write({rows:[]}),false);assert.equal(f.rows.get('record'),bytes);assert.equal(b.kind,'conflict');assert.equal(b.recovery().pending.rows.length,0);
});
test('keyed records merge independent edits to different milestones',()=>{
 const f=fixture(JSON.stringify({rows:[{id:'a',title:'A'},{id:'b',title:'B'}]})),a=f.open(),b=f.open();assert(a.write({rows:[{id:'a',title:'Edited A'},{id:'b',title:'B'}]}));assert(b.write({rows:[{id:'a',title:'A'},{id:'b',title:'Edited B'}]}));assert.deepEqual(JSON.parse(f.rows.get('record')).rows.map(x=>x.title),['Edited A','Edited B']);
});
test('malformed or wrong-shaped saved data remains untouched until explicit valid restore',()=>{
 for(const raw of ['{broken','null','[]']){const f=fixture(raw),s=f.open();assert(s.blocked);assert.equal(s.write({ok:true}),false);assert.equal(f.rows.get('record'),raw);assert.equal(s.recovery().originalRaw,raw);assert(s.write({ok:true},{replace:true,restore:true}));assert.equal(s.blocked,false);}
});
test('failed writes keep pending changes for verified retry and do not claim success',()=>{
 const f=fixture('{"value":1}'),s=f.open();f.storage.blocked=true;assert.equal(s.write({value:2}),false);assert.equal(f.rows.get('record'),'{"value":1}');assert.equal(s.pending.value,2);f.storage.blocked=false;assert(s.retry());assert.equal(JSON.parse(f.rows.get('record')).value,2);assert.equal(s.error,'');
});
test('restore refuses to replace a record changed after the recovery view opened',()=>{
 const f=fixture('{broken'),s=f.open();f.rows.set('record','{"newer":true}');assert.equal(s.write({restored:true},{replace:true,restore:true}),false);assert.equal(f.rows.get('record'),'{"newer":true}');
});
test('unsafe record keys are refused without writing storage',()=>{
 const f=fixture('{}'),s=f.open();assert.equal(s.write(JSON.parse('{"__proto__":{"bad":true}}')),false);assert.equal(f.rows.get('record'),'{}');
});
