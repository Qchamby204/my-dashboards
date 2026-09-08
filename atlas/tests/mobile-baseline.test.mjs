import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {connected} from '../../dist/server/assets.mjs';
const source=readFileSync(new URL('../../shared/atlas-mobile.js',import.meta.url),'utf8');
function boot(app='the-herald',options={}){
  const properties=new Map(),events=new Map(),windowEvents=new Map(),assets=[],observed=[];
  const classes=()=>({add(){},contains(){return false;}});
  const root={dataset:{atlasApp:app},classList:classes(),style:{getPropertyValue:k=>properties.get(k)||'',setProperty:(k,v)=>properties.set(k,v)}};
  const attrs=new Map(),tile={dataset:{},classList:classes(),querySelector:()=>null,hasAttribute:k=>attrs.has(k),setAttribute:(k,v)=>attrs.set(k,v),getAttribute:k=>attrs.get(k),click(){this.clicks=(this.clicks||0)+1;}};
  const header={height:80,getBoundingClientRect(){return {height:this.height};}},connection={getBoundingClientRect:()=>({height:52})},bottom={getBoundingClientRect:()=>({height:110})},viewport={content:'width=device-width, maximum-scale=1'};
  const document={documentElement:root,currentScript:{src:'https://example.test/shared/atlas-mobile.js'},readyState:'complete',head:{appendChild:e=>assets.push(e)},body:{},querySelector:s=>({'meta[name="viewport"]':viewport,'.appbar':header,'.connected-toolbar':options.connected===false?null:connection,'.tabbar':bottom}[s]||null),querySelectorAll:s=>s.startsWith('div[onclick]')?[tile]:[],createElement:()=>({}),addEventListener:(k,v)=>events.set(k,v)};
  class ResizeObserver{constructor(fn){this.callback=fn;}observe(el){observed.push(el);}}
  const window={ResizeObserver,navigator:{userAgent:options.phone?'iPhone':'Desktop',standalone:!!options.standalone},screen:{orientation:{type:'portrait-primary'}},visualViewport:{height:390,offsetTop:24,scale:1,addEventListener(){}},addEventListener:(k,v)=>windowEvents.set(k,v)};
  vm.runInNewContext(source,{window,document,URL,ResizeObserver,MutationObserver:class{observe(){}},getComputedStyle:()=>({overflowX:'visible'}),requestAnimationFrame:f=>f()});
  return {window,events,windowEvents,root,properties,assets,viewport,header,tile,attrs,observed};
}
test('mobile chrome follows measured header and keyboard space without restricting zoom',()=>{
  const h=boot();assert.equal(h.viewport.content,'width=device-width, initial-scale=1, viewport-fit=cover');assert.equal(h.properties.get('--atlas-top-h'),'132px');assert.equal(h.properties.get('--atlas-visible-height'),'390px');assert.equal(h.properties.get('--atlas-visible-top'),'24px');
  h.header.height=124;h.window.AtlasMobile.measure();assert.equal(h.properties.get('--atlas-top-h'),'176px');
  h.window.visualViewport.scale=2;h.window.AtlasMobile.measure();assert.equal(h.properties.get('--atlas-visible-height'),'100dvh');
});
test('legacy action tiles activate once from the keyboard and leave native inputs alone',()=>{
  const h=boot();assert.equal(h.attrs.get('role'),'button');assert.equal(h.tile.tabIndex,0);
  const key=h.events.get('keydown');let prevented=0;
  key({key:' ',target:{matches:()=>false,closest:()=>h.tile},preventDefault(){prevented++;}});assert.equal(h.tile.clicks,1);assert.equal(prevented,1);
  key({key:'Enter',target:{matches:()=>true},preventDefault(){throw Error('Do not hijack input');}});
  key({key:' ',repeat:true,target:{},preventDefault(){throw Error('Do not repeat');}});assert.equal(h.tile.clicks,1);
});
test('excluded dashboards receive no mobile hooks and both private script locations serve their baseline assets',()=>{
  const h=boot('gang-ops-roadmap');assert.equal(h.assets.length,0);assert.equal(h.window.AtlasMobile,undefined);
  for(const path of ['/atlas-mobile.js','/shared/atlas-mobile.js'])assert.equal(connected[path][0],source);
  for(const path of ['/atlas-mobile.css','/shared/atlas-mobile.css'])assert.ok(connected[path][0].includes('safe-area-inset-top'));
});
test('Forge, Life Map and Aqueduct reserve home-screen phone clearance and update it on rotation',()=>{
  for(const app of ['workout-forge','life-map','the-aqueduct']){
    const h=boot(app,{phone:true,standalone:true,connected:app==='life-map'});
    assert.equal(h.properties.get('--atlas-standalone-top'),'64px');assert.equal(h.properties.get('--atlas-standalone-bottom'),'34px');assert.equal(h.root.dataset.atlasInsetOwner,app==='life-map'?'connection':'app');
    h.window.screen.orientation.type='landscape-primary';h.windowEvents.get('orientationchange')();assert.equal(h.properties.get('--atlas-standalone-top'),'0px');assert.equal(h.properties.get('--atlas-standalone-side'),'64px');assert.equal(h.properties.get('--atlas-standalone-bottom'),'21px');
    h.window.screen.orientation.type='portrait-primary';h.windowEvents.get('pageshow')();assert.equal(h.properties.get('--atlas-standalone-top'),'64px');assert.equal(h.properties.get('--atlas-standalone-side'),'0px');
  }
  assert.equal(boot('workout-forge',{phone:true}).properties.get('--atlas-standalone-top'),'0px');
  assert.equal(boot('life-map',{standalone:true}).properties.get('--atlas-standalone-top'),'0px');
});
