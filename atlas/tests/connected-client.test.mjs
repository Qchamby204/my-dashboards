import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {connected} from '../../dist/server/assets.mjs';
import {emptyAppState} from '../connected-model.mjs';
import {readFileSync} from 'node:fs';

const tick=()=>new Promise(setImmediate);
function nodes(){
  const map=new Map(),node=id=>{if(!map.has(id))map.set(id,{id,style:{},dataset:{},innerHTML:'',textContent:'',value:'',hidden:false,inert:true,handlers:new Map(),classList:{add(){},remove(){},toggle(){}},addEventListener(t,f){this.handlers.set(t,f);},querySelector:()=>null,querySelectorAll:()=>[],appendChild(){},setAttribute(){},remove(){},focus(){}});return map.get(id);};return {node};
}
test('both shipped full-app scripts boot with saved data and existing editors send changes through the connected adapter',async()=>{
  for(const kind of ['life-map','herald']){
    const {node}=nodes(),document={getElementById:node,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){},createElement:node,body:node('body')},saves=[],raw=emptyAppState(kind);
    if(kind==='herald')raw.videos=[{id:'video-one',title:'A story',fmt:'long',vert:'General',status:'draft',opt:{},metrics:{},pub:{},script:'Original script'}];
    else raw.projects=[{id:'project-one',task:'A room plan',area:'Home',status:'Not started',notes:'Original note',pri:'High',sub:'',due:''}];
    const window={AtlasConnected:{raw:()=>JSON.stringify(raw),save:s=>saves.push(structuredClone(s))},addEventListener(){},scrollTo(){},innerWidth:1200};
    const context=vm.createContext({window,document,navigator:{},location:{href:'https://atlas.test/apps/'+kind},URL,Date,Blob,setInterval(){},setTimeout(){},clearTimeout(){},requestAnimationFrame:f=>f()});
    vm.runInContext(connected['/connected/'+kind+'-main.js'][0],context);await tick();assert.equal(typeof window.acceptConnectedState,'function');
    if(kind==='herald'){
      vm.runInContext("schedVid('video-one','2026-09-10')",context);assert.equal(saves.at(-1).videos[0].sched,'2026-09-10');assert.equal(saves.at(-1).videos[0].script,'Original script');
      const changed=structuredClone(saves.at(-1));changed.videos[0].status='published';window.acceptConnectedState(changed);assert.equal(vm.runInContext('S.videos[0].status',context),'published');
    }else{
      vm.runInContext("view.editor=Object.assign({kind:'proj'},S.projects[0],{status:'Done'});saveEditor()",context);assert.equal(saves.at(-1).projects[0].status,'Done');assert.equal(saves.at(-1).projects[0].notes,'Original note');
      const changed=structuredClone(saves.at(-1));changed.projects[0].task='A revised plan';window.acceptConnectedState(changed);assert.equal(vm.runInContext('S.projects[0].task',context),'A revised plan');
    }
  }
});
function bootstrap(){
  const {node}=nodes(),events=new Map(),windowEvents=new Map(),pending=[],applied=[];
  const window={addEventListener(t,f){windowEvents.set(t,f);},acceptConnectedState:s=>applied.push(s),connectedDraftOpen:()=>false};
  const document={currentScript:{dataset:{kind:'herald'}},hidden:false,querySelector:node,addEventListener(t,f){events.set(t,f);},createElement:tag=>({tag}),body:{appendChild(script){queueMicrotask(()=>script.onload());}}};
  const context=vm.createContext({window,document,structuredClone,Date,URL,Blob,location:{href:'https://atlas.test/apps/herald'},setInterval(){},setTimeout(){},
    fetch:(path,options)=>new Promise(resolve=>pending.push({path,options,resolve}))});
  vm.runInContext(readFileSync(new URL('../connected-bootstrap.js',import.meta.url),'utf8'),context);
  const reply=async(i,data,status=200)=>{pending[i].resolve({ok:status<300,json:async()=>structuredClone(data)});await tick();};
  return {window,node,events,windowEvents,pending,applied,reply};
}
test('connected persistence waits for initial records, serializes edits and preserves the newest draft after a rejected save',async()=>{
  const h=bootstrap();assert.equal(h.node('#connected-app').inert,true);await h.reply(0,{state:emptyAppState('herald'),version:'v1',connected:true});assert.equal(h.node('#connected-app').inert,false);
  const one=emptyAppState('herald');one.roadmap=[{id:'one',t:'First idea'}];h.window.AtlasConnected.save(one);
  const two=structuredClone(one);two.roadmap[0].t='Updated idea';h.window.AtlasConnected.save(two);
  assert.equal(h.pending.length,2);assert.equal(JSON.parse(h.pending[1].options.body).version,'v1');
  await h.reply(1,{saved:true,version:'v2'});assert.equal(h.pending.length,3);assert.equal(JSON.parse(h.pending[2].options.body).version,'v2');
  await h.reply(2,{error:'This app changed in another tab.'},409);assert.equal(JSON.parse(h.window.AtlasConnected.raw()).roadmap[0].t,'Updated idea');assert.equal(h.node('#connected-download').hidden,false);assert.equal(h.window.AtlasConnected.pending,true);
  let prevented=false;h.windowEvents.get('beforeunload')({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  h.windowEvents.get('focus')();await tick();assert.equal(h.pending.length,3);
});
test('a late automatic refresh cannot replace input entered while that request was in flight',async()=>{
  const h=bootstrap();await h.reply(0,{state:emptyAppState('herald'),version:'v1',connected:true});
  h.windowEvents.get('focus')();assert.equal(h.pending.length,2);
  h.events.get('input')({target:{closest:s=>s==='#connected-app'?{}:null}});
  await h.reply(1,{state:{...emptyAppState('herald'),roadmap:[{id:'late',t:'Saved elsewhere'}]},version:'v2',connected:true});
  assert.equal(h.applied.length,0);assert.equal(h.window.AtlasConnected.pending,true);assert.match(h.node('#connected-status').textContent,/Unsaved/);
});
