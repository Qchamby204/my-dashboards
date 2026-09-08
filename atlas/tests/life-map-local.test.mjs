import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createLifeMapLocalStore} from '../life-map-local-store.mjs';
import {validateLifeMapRecords} from '../life-map-records.mjs';
const fixture=()=>({projects:[{id:'one',task:'Room plan',status:'Not started',area:'Home',pri:'Med',notes:'Keep me'}],chores:[],checks:{},log:[],planned:{one:'2026-09-01'}});
function storage(raw){const data=new Map(raw===undefined?[]:[['lifemap_v1',raw]]);return {data,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};}
test('opening keeps original bytes and activity; first change retains a recovery copy',()=>{
 const raw=JSON.stringify(fixture()),s=storage(raw),local=createLifeMapLocalStore(s,validateLifeMapRecords),value=local.load();assert.equal(s.data.size,1);assert.equal(value.planned.one,'2026-09-01');value.projects[0].notes='Changed';assert(local.save(value));assert.equal(s.getItem('lifemap:before-github:v1'),raw);assert.equal(createLifeMapLocalStore(s,validateLifeMapRecords).load().projects[0].notes,'Changed');
});
test('corrupt records are never seeded over and a confirmed restore retains the original bytes',()=>{
 const s=storage('{broken'),local=createLifeMapLocalStore(s,validateLifeMapRecords);local.load();assert(local.blocked);assert.equal(local.save(fixture()),false);assert.equal(s.getItem('lifemap_v1'),'{broken');assert(local.save(fixture(),true));assert.equal(s.getItem('lifemap:before-github:v1'),'{broken');
});
test('quota failure and edits in another tab cannot silently overwrite the board',()=>{
 const s=storage(JSON.stringify(fixture())),local=createLifeMapLocalStore(s,validateLifeMapRecords),value=local.load();s.data.set('lifemap_v1','newer bytes');assert.equal(local.save(value),false);assert.match(local.error,/another tab/);assert.equal(s.getItem('lifemap_v1'),'newer bytes');
 const blocked=storage();blocked.setItem=()=>{throw Error('quota');};const other=createLifeMapLocalStore(blocked,validateLifeMapRecords);other.load();assert.equal(other.save(fixture()),false);assert.match(other.error,/could not be saved/);
});
test('private backup exports can be validated without fetching or publishing personal records',()=>{
 assert.deepEqual(validateLifeMapRecords({app:'atlas-connected-transfer',apps:[{kind:'life-map',state:fixture()}]}),fixture());assert.throws(()=>validateLifeMapRecords({projects:[{id:'bad',task:'Bad date',status:'Not started',due:'2026-02-30'}]}));
});
test('shipped GitHub dashboard boots existing records, saves edits, and needs no connected API',async()=>{
 const html=readFileSync(new URL('../../life-map.html',import.meta.url),'utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const nodes=new Map(),make=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},dataset:{},value:'',innerHTML:'',textContent:'',handlers:new Map(),classList:{add(){},remove(){}},addEventListener(k,v){this.handlers.set(k,v);},querySelector(){return null;},querySelectorAll(){return [];},append(){},appendChild(){},before(){},setAttribute(){},remove(){},focus(){},click(){}});return nodes.get(id);};
 const document={getElementById:make,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:make,body:make('body')};const s=storage(JSON.stringify(fixture())),window={addEventListener(){},innerWidth:390};
 const context=vm.createContext({document,window,localStorage:s,navigator:{},Date,TextEncoder,Blob,URL,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:f=>f()});vm.runInContext(script,context);await new Promise(setImmediate);
 assert.equal(window.LifeMapLocal.blocked,false);assert.match(make('app').innerHTML,/Projects/);assert.equal(vm.runInContext('S.projects[0].notes',context),'Keep me');window.LifeMapDashboard.setStatus('one','Done');assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects[0].status,'Done');assert.equal(window.AtlasConnected,undefined);
 vm.runInContext("view.editor=Object.assign({kind:'proj'},S.projects[0],{notes:'Edited locally'});saveEditor()",context);assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects[0].notes,'Edited locally');
});
test('public Life Map retains board identity, backups, and keyboard-operable explanation controls',()=>{
 const html=readFileSync(new URL('../../life-map.html',import.meta.url),'utf8');
 assert.match(html,/appbar lm-header/);assert.match(html,/Every area, one board/);assert.match(html,/lm-overview-values/);assert.match(html,/id="lm-backups"/);assert.match(html,/<details class="atlas-info"><summary aria-label=/);assert.match(html,/How repeating chores work/);
});
