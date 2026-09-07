import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {connected} from '../../dist/server/assets.mjs';
import {emptyAppState,validateAppState,contentFromApp,connectedState} from '../connected-model.mjs';
const video=(id='one')=>({id,title:'A story',script:'Opening scene\nA second line',fmt:'long',vert:'General',status:'draft',opt:{title:{t:'Publication title',d:false}},pub:{p1:true},metrics:{ctr:0},customNote:'Keep this field'});
const raw=(...videos)=>({...emptyAppState('herald'),videos});
function harness(initial=raw(video())){
  const map=new Map(),node=id=>{if(!map.has(id))map.set(id,{id,value:'',innerHTML:'',textContent:'',hidden:false,dataset:{},handlers:new Map(),classList:{add(){},remove(){},toggle(){}},style:{},addEventListener(t,f){this.handlers.set(t,f);},querySelector(){return null;},querySelectorAll(){return [];},appendChild(){},setAttribute(){},focus(){},showModal(){},remove(){}});return map.get(id);};
  const saves=[],document={getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:node,body:node('body')};
  const window={AtlasConnected:{raw:()=>JSON.stringify(initial),save:s=>saves.push(structuredClone(s)),clearInputDraft(){}},addEventListener(){},scrollTo(){}};
  const context=vm.createContext({window,document,navigator:{},location:{href:'https://atlas.test/apps/herald'},URL,Date,Blob,TextEncoder,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:f=>f()});
  vm.runInContext(connected['/connected/herald-main.js'][0],context);
  return {node,window,saves,api:window.HeraldDashboard,run:s=>vm.runInContext(s,context)};
}
test('Herald editor preserves detailed records, changes title and script, and treats checklist review as explicit',()=>{
  const h=harness();h.api.edit('one');h.api.writeField('title','A revised story');h.api.writeField('script','A new opening\nAnd an ending.');h.api.writeField('opt.desc.t','Description');
  assert.equal(h.window.connectedDraftOpen(),true);assert.equal(h.saves.length,0);
  assert.equal(h.api.saveContent(),true);const saved=h.saves.at(-1).videos[0];
  assert.equal(saved.title,'A revised story');assert.equal(saved.script,'A new opening\nAnd an ending.');assert.equal(saved.customNote,'Keep this field');assert.equal(saved.pub.p1,true);assert.equal(saved.metrics.ctr,0);assert.equal(saved.opt.desc.d,false);assert.equal(h.window.connectedDraftOpen(),false);
  assert.equal(h.api.wordCount(saved.script),6);
});
test('new ideas need only a title; search includes script text and does not mutate saved content',()=>{
  const h=harness();h.api.edit();h.api.writeField('title','Another idea');assert.equal(h.api.saveContent(),true);assert.equal(h.saves.at(-1).videos.length,2);
  const input=h.node('connected-app').handlers.get('input');input({target:{id:'hd-search',value:'second line',dataset:{}}});
  assert.deepEqual(Array.from(h.api.filtered(),x=>x.id),['one']);assert.equal(h.window.connectedDraftOpen(),false);assert.equal(h.saves.length,1);
});
test('unsaved editor content is downloadable and cancel requires explicit discard',()=>{
  const h=harness();h.api.edit('one');h.api.writeField('script','Unsaved but recoverable');h.api.closeEditor();assert.equal(h.window.connectedDraftOpen(),true);assert.equal(h.node('hd-discard').hidden,false);
  assert.equal(h.window.connectedDraftState().videos[0].script,'Unsaved but recoverable');assert.equal(h.saves.length,0);
  h.api.closeEditor(true);assert.equal(h.window.connectedDraftOpen(),false);assert.equal(h.api.draftState().videos[0].script,video().script);
});
test('delete Undo restores only its record while keeping unrelated later edits',()=>{
  const h=harness(raw(video(),video('two')));h.api.remove('one');h.run("S.videos[0].script='A later edit'");h.node('button').onclick();
  assert.equal(h.saves.at(-1).videos.find(v=>v.id==='two').script,'A later edit');assert.equal(h.saves.at(-1).videos.find(v=>v.id==='one').script,video().script);
});
test('backup review rejects malformed scripts and protects newer edits from restore Undo',async()=>{
  const h=harness();await h.run("importData({size:10,text:async()=>JSON.stringify({videos:[{id:'bad'}],leads:[],cadence:{}})})");assert.equal(h.saves.length,0);assert.equal(h.api.draftState().videos[0].id,'one');
  await h.run("importData({size:10,text:async()=>JSON.stringify({...S,videos:[{...S.videos[0],id:'restored'}]})})");assert.equal(h.saves.length,0);assert.equal(h.window.connectedDraftOpen(),true);
  h.api.restore();assert.equal(h.saves.at(-1).videos[0].id,'restored');h.run("S.videos[0].script='Newer writing'");h.node('button').onclick();assert.equal(h.api.draftState().videos[0].script,'Newer writing');
  assert.throws(()=>validateAppState('herald',raw({...video(),script:{broken:true}})),/script/);
  assert.throws(()=>validateAppState('herald',raw({...video(),publishedDay:'2026-02-30'})),/publication/);
  assert.throws(()=>validateAppState('herald',{...raw(video()),leads:[{}]}),/contact/);
});
test('planned and actual publication dates round trip independently, including explicit unknown dates',async()=>{
  const first=await contentFromApp(raw({...video(),status:'published',sched:'2026-09-12',publishedDay:'2026-09-02'}),null,'2026-09-07');
  assert.equal(first.items[0].published_day,'2026-09-02');assert.equal(first.items[0].scheduled_day,'2026-09-12');
  const full=connectedState('herald',{herald:[first]},null);assert.equal(full.videos[0].publishedDay,'2026-09-02');
  full.videos[0].script='Retained after publishing';const second=await contentFromApp(full,first,'2026-09-07');assert.equal(second.items[0].published_day,'2026-09-02');
  full.videos[0].publishedDay='';assert.equal((await contentFromApp(full,second,'2026-09-07')).items[0].published_day,null);
  assert.equal((await contentFromApp(raw({...video(),status:'published'}),null,null)).items[0].published_day,null);
});
