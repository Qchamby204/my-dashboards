import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const script=readFileSync(new URL('../../shared/core-app-finish.js',import.meta.url),'utf8');
function harness(app='life-ledger'){
 const classes=new Set(),events={},pending=[],style={},controls=new Map();let observer;
 const control={dataset:{act:'settings'},label:'Settings',listener:()=>42,replacements:0,set innerHTML(value){this.html=value;this.replacements++;}};
 controls.set('.appbar [data-act="settings"]',control);
 const root={dataset:{atlasApp:app},classList:{add:k=>classes.add(k),toggle(k,value){value?classes.add(k):classes.delete(k)}},style:{setProperty(k,v){style[k]=v}}};
 const mode={dataset:{act:'logmode',mode:'cards'},textContent:'Cards',children:[],listener:()=>17,set innerHTML(value){this.html=value},append(n){this.children.push(n)}};
 const choice={...mode,dataset:{goal:'run',goalAction:'choose-focus'},textContent:'5K run',children:[]};
 const avatar={html:"📖",dataset:{},attrs:{},set innerHTML(value){this.html=value},setAttribute(k,v){this.attrs[k]=v},closest:()=>({querySelector:()=>({dataset:{habit:'Read'}})})};
 const document={documentElement:root,body:{},readyState:'complete',activeElement:{tagName:'BODY'},querySelector:s=>controls.get(s)||null,querySelectorAll:s=>s==='[data-act="logmode"]'?[mode]:s==='.ledger-card-avatar,.ledger-list-avatar'?[avatar]:s==='.atlas-goal-options [data-goal]'?[choice]:[],createElement:()=>({}),addEventListener(k,f){events[k]=f}};
 const visual={scale:1,height:800,offsetTop:0,addEventListener(k,f){events['viewport-'+k]=f}};
 const window={innerHeight:800,visualViewport:visual,addEventListener(k,f){events['window-'+k]=f}};
 const forbidden=()=>{throw Error('Presentation must not access records or network')};
 Object.defineProperty(window,'localStorage',{get:forbidden});
 vm.runInNewContext(script,{document,window,localStorage:new Proxy({},{get:forbidden}),fetch:forbidden,MutationObserver:class{constructor(f){observer=f}observe(){}},requestAnimationFrame:()=>0,queueMicrotask:f=>pending.push(f)});
 return {root,classes,style,control,mode,choice,avatar,document,visual,window,events,redraw:()=>observer?.([{type:'childList',addedNodes:[{nodeType:1}],removedNodes:[]}]),flush:()=>pending.splice(0).forEach(f=>f())};
}
test('control artwork preserves actions and accessible names and is stable across redraws',()=>{
 const h=harness();assert(h.classes.has('core-finished'));assert.equal(h.control.replacements,1);
 assert.match(h.control.html,/aria-hidden="true" focusable="false"/);assert.equal(h.control.label,'Settings');assert.equal(h.control.dataset.act,'settings');assert.equal(h.control.listener(),42);
 h.redraw();h.window.CoreAppFinish.decorate();assert.equal(h.control.replacements,1);
 assert.equal(h.avatar.html,'📖','original activity imagery survives decoration and redraws');assert.equal(h.avatar.attrs['aria-hidden'],'true');
 assert.equal(h.mode.children[0].textContent,'Cards');assert.equal(h.mode.listener(),17);assert.equal(h.mode.dataset.act,'logmode');assert.equal(h.mode.children.length,1,'redraw does not duplicate the visible label');
});
test('training choice artwork retains the goal action and its visible name',()=>{
 const h=harness('workout-forge');assert.equal(h.choice.dataset.coreIcon,'run');assert.equal(h.choice.dataset.goal,'run');assert.equal(h.choice.dataset.goalAction,'choose-focus');assert.equal(h.choice.children[0].textContent,'5K run');assert.equal(h.choice.listener(),17);
 h.redraw();assert.equal(h.choice.children.length,1);
});
test('keyboard chrome stays stable during a save tap until the viewport restores',()=>{
 const h=harness();h.document.activeElement={tagName:'INPUT'};h.visual.height=430;h.events['viewport-resize']();
 assert(h.classes.has('core-keyboard'));assert.equal(h.style['--core-keyboard-bottom'],'370px');
 h.document.activeElement={tagName:'BUTTON'};h.events.focusout();h.flush();assert(h.classes.has('core-keyboard'),'a save tap must not move the dock while the keyboard is still open');
 h.visual.height=800;h.events['viewport-resize']();assert(!h.classes.has('core-keyboard'));
 h.visual.scale=2;h.document.activeElement={tagName:'TEXTAREA'};h.events['viewport-resize']();assert(!h.classes.has('core-keyboard'),'zoom does not masquerade as a keyboard');
});
test('unrelated dashboards receive no artwork, keyboard listeners or record access',()=>{
 const h=harness('the-chef');assert.equal(h.control.replacements,0);assert.equal(h.window.CoreAppFinish,undefined);assert.deepEqual(Object.keys(h.events),[]);
});
