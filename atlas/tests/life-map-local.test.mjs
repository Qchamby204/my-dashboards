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
 const nodes=new Map(),make=id=>{if(!nodes.has(id))nodes.set(id,{id,style:{},dataset:{},value:'',innerHTML:'',textContent:'',handlers:new Map(),classList:{add(){},remove(){}},addEventListener(k,v){if(!this.handlers.has(k))this.handlers.set(k,[]);this.handlers.get(k).push(v);},querySelector(){return null;},querySelectorAll(){return [];},append(){},appendChild(){},after(){},setAttribute(){},remove(){},focus(){},click(){}});return nodes.get(id);};
 const document={getElementById:make,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:make,body:make('body')};const s=storage(JSON.stringify(fixture())),window={addEventListener(){},innerWidth:390};
 const context=vm.createContext({document,window,localStorage:s,navigator:{},Date,TextEncoder,Blob,URL,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:f=>f()});vm.runInContext(script,context);await new Promise(setImmediate);
 const fire=(kind,dataset={},value='',id='')=>{const target={dataset,value,id,closest:selector=>selector==='[data-act]'?target:selector==='[data-act="closeEditor"]'&&dataset.act==='closeEditor'?target:null};for(const fn of make('app').handlers.get(kind)||[])fn({target,key:kind==='keydown'?'Enter':undefined,preventDefault(){}});};
 assert.equal(window.LifeMapLocal.blocked,false);assert.match(make('app').innerHTML,/Projects/);assert.equal(vm.runInContext('S.projects[0].notes',context),'Keep me');window.LifeMapDashboard.setStatus('one','Done');assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects[0].status,'Done');assert.equal(window.AtlasConnected,undefined);
 vm.runInContext("view.editor=Object.assign({kind:'proj'},S.projects[0],{notes:'Edited locally'});saveEditor()",context);assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects[0].notes,'Edited locally');
 for(const key of ['horizon','map','proj','chores','mom'])assert.match(make('app').innerHTML,new RegExp('data-key="'+key+'"'));
 fire('click',{act:'section',key:'map'});assert.equal(vm.runInContext('view.open.map',context),true);assert.match(make('app').innerHTML,/data-act="area"/);
 fire('click',{act:'area',area:'Home'});assert.equal(vm.runInContext('view.fArea',context),'Home');assert.equal(vm.runInContext('view.open.proj',context),true);
 make('qaTxt').value='Future room project';vm.runInContext('view.qa.when=monthsAhead(2,1)[0]',context);fire('keydown',{},'','qaTxt');
 assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects.length,2);assert.equal(vm.runInContext('isParked(S.projects[1])',context),true);
 assert.equal(vm.runInContext('focusItems().some(x=>x.p.id===S.projects[1].id)',context),false);
 fire('click',{act:'add',kind:'chore'});assert.match(make('app').innerHTML,/role="dialog"/);
 fire('input',{act:'f',k:'chore'},'Water the plants');fire('change',{act:'f',k:'cad'},'Weekly');fire('click',{act:'saveEditor'});
 const chore=JSON.parse(s.getItem('lifemap_v1')).chores[0];assert.equal(chore.chore,'Water the plants');assert.equal(chore.cad,'Weekly');
 fire('click',{act:'plan',id:chore.id});assert.equal(vm.runInContext('plannedChores().length',context),1);
 fire('click',{act:'tick',id:chore.id});assert.equal(vm.runInContext('isChecked(S.chores[0])',context),true);
 const future=JSON.parse(s.getItem('lifemap_v1')).projects[1];fire('click',{act:'advance',id:future.id});fire('click',{act:'advance',id:future.id});
 assert.equal(JSON.parse(s.getItem('lifemap_v1')).projects[1].status,'Done');assert.equal(vm.runInContext('doneInLastDays(7)',context),2);
 fire('click',{act:'section',key:'mom'});assert.equal(vm.runInContext('view.open.mom',context),true);
});
test('public Life Map restores the original composition and retains native explanatory disclosures',()=>{
 const html=readFileSync(new URL('../../life-map.html',import.meta.url),'utf8');
 const legacy=readFileSync(new URL('../life-map-legacy.html',import.meta.url),'utf8');
 const composition=legacy.slice(legacy.indexOf('function render(){'),legacy.indexOf('/* ===================== actions'));
 assert(html.includes(composition));assert(!html.includes('class="lm-tabs"'));assert(!html.includes('class="lm-dashboard"'));
 for(const fn of ['hero','quickCapture','todayPanel','boardPanel','focusPanel','horizonView','mapView','projectsView','choresView','momentumView'])assert.match(html,new RegExp('function '+fn+'\\('));
 assert.match(html,/<details class="atlas-info"><summary aria-label=/);assert.match(html,/How repeating chores work/);
});
