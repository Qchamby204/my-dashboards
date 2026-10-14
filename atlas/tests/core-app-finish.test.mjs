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
 const document={documentElement:root,body:{},readyState:'complete',activeElement:{tagName:'BODY'},querySelector:s=>controls.get(s)||null,addEventListener(k,f){events[k]=f}};
 const visual={scale:1,height:800,offsetTop:0,addEventListener(k,f){events['viewport-'+k]=f}};
 const window={innerHeight:800,visualViewport:visual};
 const forbidden=()=>{throw Error('Presentation must not access records or network')};
 Object.defineProperty(window,'localStorage',{get:forbidden});
 vm.runInNewContext(script,{document,window,localStorage:new Proxy({},{get:forbidden}),fetch:forbidden,MutationObserver:class{constructor(f){observer=f}observe(){}},queueMicrotask:f=>pending.push(f)});
 return {root,classes,style,control,document,visual,window,events,redraw:()=>observer?.(),flush:()=>pending.splice(0).forEach(f=>f())};
}
test('control artwork preserves actions and accessible names and is stable across redraws',()=>{
 const h=harness();assert(h.classes.has('core-finished'));assert.equal(h.control.replacements,1);
 assert.match(h.control.html,/aria-hidden="true" focusable="false"/);assert.equal(h.control.label,'Settings');assert.equal(h.control.dataset.act,'settings');assert.equal(h.control.listener(),42);
 h.redraw();h.window.CoreAppFinish.decorate();assert.equal(h.control.replacements,1);
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
