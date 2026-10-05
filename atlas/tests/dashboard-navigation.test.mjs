import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const script=readFileSync(new URL('../../shared/dashboard-navigation.js',import.meta.url),'utf8');
function harness(app,selector,labels){
 const pending=[],events={},sources=new Map(),calls=[],writes=[];let document;
 class Node{
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attrs={};this.dataset={};this.listeners={};this.disabled=false;this.open=false;this.text='';const classes=new Set();this.classList={contains:k=>classes.has(k),add:k=>classes.add(k)};this.style={values:{},setProperty(k,v){this.values[k]=v},getPropertyValue(k){return this.values[k]||''}};}
  set className(v){for(const c of v.split(' '))this.classList.add(c)}
  set textContent(v){this.text=v;this.children=[]}get textContent(){return this.text+this.children.map(n=>n.textContent).join('')}
  set innerHTML(v){this.html=v;this.children=[]}get innerHTML(){return this.html||''}
  append(...nodes){for(const n of nodes){n.parentElement=this;this.children.push(n)}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes)}
  setAttribute(k,v){this.attrs[k]=String(v)}getAttribute(k){return this.attrs[k]??null}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  contains(n){return n===this||this.children.some(c=>c.contains(n))}
  focus(){document.activeElement=this}
  click(){for(const f of this.listeners.click||[])f({target:this});for(const f of events.click||[])f({target:this})}
  showModal(){this.open=true;this.querySelector('button')?.focus()}
  close(){this.open=false;for(const f of this.listeners.close||[])f()}
  getBoundingClientRect(){return {height:80,left:0,right:390,top:700,bottom:780}}
  matches(s){if(s.includes(':not(:disabled)')&&this.disabled)return false;s=s.replace(':not(:disabled)','');const attr=s.match(/\[([^=\]]+)(?:="([^"]+)")?\]/);if(attr){let value=this.getAttribute(attr[1]);if(attr[1].startsWith('data-'))value=this.dataset[attr[1].slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]??value;if(value===undefined||value===null||attr[2]!==undefined&&value!==attr[2])return false;s=s.slice(0,s.indexOf('['));}if(!s)return true;if(s.startsWith('.'))return this.classList.contains(s.slice(1));if(s.startsWith('#'))return this.id===s.slice(1);return this.tagName===s.toUpperCase();}
  querySelectorAll(s){const out=[];for(const n of this.children){if(s.split(',').some(x=>n.matches(x.trim())))out.push(n);out.push(...n.querySelectorAll(s))}return out}
  querySelector(s){return this.querySelectorAll(s)[0]||null}
 }
 const root=new Node('html');root.dataset.atlasApp=app;const body=new Node('body');
 document={documentElement:root,body,readyState:'complete',activeElement:body,createElement:t=>new Node(t),addEventListener(k,f){(events[k]??=[]).push(f)},querySelector:s=>sources.get(s)||body.querySelector(s)};
 const original=new Node('nav');sources.set(selector,original);body.append(original);
 labels.forEach((title,i)=>{const n=new Node('button');n.textContent=title;n.dataset.tab='page'+i;n.setAttribute('aria-pressed',String(i===0));n.addEventListener('click',()=>{calls.push(i);for(const b of original.children)b.setAttribute('aria-pressed',String(b===n))});original.append(n)});
 const window={addEventListener(k,f){(events[k]??=[]).push(f)}};const location={hash:''};
 vm.runInNewContext(script,{document,window,location,queueMicrotask:f=>pending.push(f),MutationObserver:class{observe(){}},localStorage:{getItem(){throw Error('Navigation must not read records')},setItem(...a){writes.push(a);throw Error('Navigation must not write records')}}});
 const flush=()=>{for(let i=0;pending.length&&i<20;i++)pending.shift()();assert.equal(pending.length,0)};
 return {document,root,body,original,window,location,calls,writes,flush,Node,dock:()=>body.querySelector('#atlas-page-navigation'),menu:()=>body.querySelector('#atlas-page-menu')};
}
test('bottom page controls invoke existing actions and retain selected state after redraws',()=>{
 const h=harness('the-chef','nav.tabs',['Ingredients','Mood','Planner','Favourites']);
 assert.equal(h.original.classList.contains('atlas-page-source'),true);
 h.dock().children[2].click();h.flush();assert.deepEqual(h.calls,[2]);
 assert.equal(h.dock().children[2].getAttribute('aria-current'),'page');assert.equal(h.document.activeElement,h.dock().children[2]);
 const replacement=new h.Node('button');replacement.dataset.tab='page2';replacement.textContent='Planner';replacement.setAttribute('aria-pressed','true');replacement.addEventListener('click',()=>h.calls.push('replacement'));
 h.original.children[2]=replacement;h.window.AtlasPageNavigation.reconcile();h.dock().children[2].click();h.flush();assert.deepEqual(h.calls,[2,'replacement']);assert.deepEqual(h.writes,[]);
});
test('large dashboards expose all pages through More and mark the overflow page active',()=>{
 const titles=['Today','Cadence','Arc','Review','Archive','Blocks','Statements','Workflow','Method','Arsenal'];
 const h=harness('crucible','#tabs',titles);assert.equal(h.dock().children.length,5);assert.equal(h.menu().querySelector('.atlas-page-menu-items').children.length,10);
 h.dock().children[4].click();assert.equal(h.menu().open,true);
 h.menu().querySelector('.atlas-page-menu-items').children[8].click();h.flush();assert.deepEqual(h.calls,[8]);assert.equal(h.menu().open,false);assert.equal(h.dock().children[4].getAttribute('aria-current'),'page');assert.equal(h.document.activeElement,h.dock().children[4]);
});
test('bottom bar keyboard movement keeps focus in the page navigation',()=>{
 const h=harness('the-herald','#tabs',['Vault','Calendar','Cadence','Metrics']),dock=h.dock();dock.children[0].focus();
 const e={target:dock.children[0],key:'ArrowLeft',preventDefault(){this.prevented=true}};dock.listeners.keydown[0](e);assert.equal(e.prevented,true);assert.equal(h.document.activeElement,dock.children[3]);assert.deepEqual(h.calls,[]);
});
test('Life Ledger retains its native navigation and save dock without proxy actions',()=>{
 const h=harness('life-ledger','.ledger-nav',['Today','Progress','History']);
 assert.equal(h.dock(),null);assert.equal(h.original.classList.contains('atlas-page-native'),true);assert.equal(h.original.classList.contains('atlas-page-source'),false);h.original.children[1].click();h.flush();assert.deepEqual(h.calls,[1]);assert.deepEqual(h.writes,[]);
});
test('Forge routes to existing goal pages without introducing storage access',()=>{
 const h=harness('workout-forge','#unused',[]);h.dock().children[2].click();h.flush();assert.equal(h.location.hash,'goal-deadlift');assert.deepEqual(h.writes,[]);
});
test('every multi-view dashboard loads versioned navigation assets, including generated Life Map',()=>{
 const pages=['life-ledger','life-map','communication-trainer','the-aqueduct','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-chef','crucible','the-library','baby-brain','neural-map','workout-forge'];
 for(const page of pages){const html=readFileSync(new URL('../../'+page+'.html',import.meta.url),'utf8');assert.match(html,/shared\/dashboard-navigation\.js\?v=[a-f0-9]{12}/,page);assert.match(html,/shared\/dashboard-navigation\.css\?v=[a-f0-9]{12}/,page);}
 const css=readFileSync(new URL('../../shared/dashboard-navigation.css',import.meta.url),'utf8');assert.match(css,/env\(safe-area-inset-bottom/);assert.match(css,/prefers-contrast/);assert.match(css,/min-height:55px/);
});
