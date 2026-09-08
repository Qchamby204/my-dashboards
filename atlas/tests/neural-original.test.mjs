import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,existsSync} from 'node:fs';
const html=readFileSync(new URL('../../neural-map.html',import.meta.url),'utf8');
const original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const extension=readFileSync(new URL('../../shared/neural-enhancements.js',import.meta.url),'utf8');

function boot({width=390,reduced=false}={}){
  let now=1000,nextFrame=0;const frames=new Map(),ids=new Map();
  class Events{
    constructor(){this.events=new Map();}
    addEventListener(type,fn,options){const a=this.events.get(type)||[];a.push({fn,capture:options===true||options?.capture===true});this.events.set(type,a);}
    emit(type,input={},phase='all'){
      const e=input.stopImmediatePropagation?input:{target:this,button:0,...input,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.stopped=true;this.immediate=true;}};
      const hooks=[...(this.events.get(type)||[])].sort((a,b)=>Number(b.capture)-Number(a.capture));
      for(const h of hooks){if(phase==='capture'&&!h.capture||phase==='bubble'&&h.capture)continue;h.fn(e);if(e.immediate)break;}return e;
    }
  }
  class Element extends Events{
    constructor(tag='div'){
      super();this.tagName=tag.toUpperCase();this.attrs={};this.children=[];this.dataset={};this.value='';this.hidden=false;this.classes=new Set();this.style={setProperty:(k,v)=>{this.style[k]=v;}};
      this.classList={add:(...a)=>a.forEach(k=>this.classes.add(k)),remove:(...a)=>a.forEach(k=>this.classes.delete(k)),contains:k=>this.classes.has(k),toggle:(k,on)=>{if(on??!this.classes.has(k)){this.classes.add(k);return true;}this.classes.delete(k);return false;}};this.captured=new Set();
    }
    set id(v){this.attrs.id=v;ids.set(v,this);}get id(){return this.attrs.id;}
    set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
    set textContent(v){this.text=String(v);this.children=[];}get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join('');}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.className=String(v);if(k==='id')this.id=v;}
    getAttribute(k){return this.attrs[k]??null;}
    append(...a){a.forEach(n=>this.appendChild(n));}appendChild(n){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(c=>c!==n);this.children.push(n);n.parentNode=this;return n;}
    replaceChildren(...a){this.children.forEach(n=>{n.parentNode=null;});this.children=[];this.text='';this.append(...a);}
    get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
    matches(selector){return selector.split(',').some(s=>{s=s.trim();if(s.startsWith('#'))return this.id===s.slice(1);const tag=s.match(/^[a-z]+/i)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;const classes=[...s.matchAll(/\.([\w-]+)/g)].map(m=>m[1]);if(!classes.every(c=>this.classes.has(c)))return false;const attr=s.match(/\[data-id="([^"]+)"\]/);if(attr&&this.dataset.id!==attr[1])return false;if(s.includes('[contenteditable'))return false;return !!(tag||classes.length||attr);});}
    closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}
    querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}
    querySelector(s){return this.querySelectorAll(s)[0]||null;}
    focus(){document.activeElement=this;}
    getBoundingClientRect(){
      if(this.hidden)return {top:0,bottom:0,left:0,right:0,width:0,height:0};
      if(this.classes.has('hud'))return {top:0,bottom:90,left:0,right:window.innerWidth,width:window.innerWidth,height:90};
      if(this.classes.has('neural-toolbar'))return {top:90,bottom:150,left:0,right:window.innerWidth,width:window.innerWidth,height:60};
      if(this.classes.has('legend'))return {top:window.innerHeight-65,bottom:window.innerHeight,left:0,right:window.innerWidth,width:window.innerWidth,height:65};
      return {top:0,bottom:40,left:0,right:40,width:40,height:40};
    }
    setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}releasePointerCapture(id){this.captured.delete(id);}
    click(){this.emit('click');this.onclick?.();}
  }
  const document=new Events();document.hidden=false;document.readyState='complete';document.currentScript={src:'https://example.test/shared/neural-enhancements.js'};
  document.documentElement=new Element('html');document.documentElement.dataset.atlasApp='neural-map';document.head=new Element('head');document.body=new Element('body');
  document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.getElementById=id=>ids.get(id);
  document.querySelectorAll=s=>document.body.querySelectorAll(s);document.querySelector=s=>document.body.querySelector(s);
  const window=new Events();window.innerWidth=width;window.innerHeight=844;
  const motion=new Events();motion.matches=reduced;window.matchMedia=q=>q.includes('reduced-motion')?motion:{matches:width<=700};
  const add=(tag,id,cls,parent=document.body)=>{const n=new Element(tag);if(id)n.id=id;if(cls)n.className=cls;parent.appendChild(n);return n;};
  const hud=add('header',null,'hud'),zoom=add('div',null,'zoom',hud);for(const id of ['zin','zout','zreset'])add('button',id,null,zoom);
  const stage=add('div','stage'),graph=add('svg','graph','graph',stage),viewport=add('g','viewport',null,graph);
  for(const id of ['stars','edges','pulses','nodes'])add('g',id,null,viewport);
  add('div',null,'hint');add('div',null,'legend');add('div','pop','pop');
  const context=vm.createContext({document,window,URL,location:{href:'https://example.test/my-dashboards/neural-map.html'},performance:{now:()=>now},console,getComputedStyle:()=>({paddingLeft:'16px',paddingRight:'16px'}),
    requestAnimationFrame:fn=>{const id=++nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>frames.delete(id),
    localStorage:{getItem(){throw Error('Neural Map must not read user records');},setItem(){throw Error('Neural Map must not write user records');}}});
  vm.runInContext(original+'\n'+extension,context);const run=code=>vm.runInContext(code,context);
  const node=id=>ids.get(id),api=window.NeuralNavigation;
  const frame=(ms=16)=>{now+=ms;const pending=[...frames];pending.forEach(([id,fn])=>{if(frames.delete(id))fn(now);});};
  function pointer(type,id,x,y,target=graph){return graph.emit(type,{pointerId:id,clientX:x,clientY:y,target});}
  function click(target){const e=graph.emit('click',{target},'capture');if(!e.stopped)node('nodes').emit('click',e);if(!e.stopped)document.emit('click',e);return e;}
  return {api,document,window,motion,run,node,graph,frame,frames,pointer,click,now:()=>now,
    hidden(value){document.hidden=value;document.emit('visibilitychange');},
    resize(w,h){window.innerWidth=w;window.innerHeight=h;window.emit('resize');},
    reduce(value){motion.matches=value;motion.emit('change');}};
}

test('phone starts in a searchable list; multiword and area filters keep the original catalog',()=>{
  const h=boot();assert.equal(h.api.mode,'list');assert.equal(h.node('stage').hidden,true);
  assert.equal(h.api.findTools().length,h.run('gNodes.querySelectorAll(".node.tool").length'));
  assert.equal(h.api.findTools('  OPERATIONS   cadence ')[0].full,'Operations Cadence');
  assert.equal(h.api.findTools('operations','personal').length,0);
  h.node('neural-search').value='word-that-does-not-exist';h.node('neural-search').emit('input');
  assert.match(h.document.querySelector('.neural-empty').textContent,/No matching tools/);
  h.api.setMode('map');h.api.setMode('list');assert.equal(h.node('neural-search').value,'word-that-does-not-exist');
});
test('available dashboards receive real web routes while original chat doors remain intact',()=>{
  const h=boot();for(const name of ['Prospecting Command Center','Operations Cadence']){
    const tool=h.api.findTools(name)[0],before=tool.doors.length,d=h.api.destinations(tool),live=d.find(x=>x.k==='live');
    assert(live.web);const filename=new URL(live.url).pathname.split('/').pop();assert(existsSync(new URL('../../'+filename,import.meta.url)));assert.equal(tool.doors.length,before);
  }
  const local=h.document.querySelectorAll('.neural-local');assert(local.length>0);assert(local.every(n=>n.querySelector('code')));
  assert(h.document.querySelectorAll('a').every(a=>/^https?:/.test(a.href)));
});
test('pinch preserves its anchor, never runs legacy pan, and resumes one-finger dragging without a jump',()=>{
  const h=boot({width:1200,reduced:true});h.run('scale=1;tx=0;ty=0;applyT()');
  h.pointer('pointerdown',1,100,100);h.pointer('pointerdown',2,200,100);h.pointer('pointermove',2,300,100);
  assert.equal(h.run('scale'),2);assert.equal(h.run('tx'),-100);assert.equal(h.run('ty'),-100);assert.equal(h.run('panning'),false);
  h.pointer('pointerup',1,100,100);h.pointer('pointermove',2,320,120);
  assert.equal(h.run('tx'),-80);assert.equal(h.run('ty'),-80);
  h.pointer('pointercancel',2,320,120);h.pointer('pointermove',2,500,500);assert.equal(h.run('tx'),-80);assert.equal(h.graph.classList.contains('grabbing'),false);
});
test('dragging a node cannot open it; a deliberate subsequent tap still opens details',()=>{
  const h=boot({width:1200,reduced:true}),tool=h.node('nodes').querySelector('.node.tool');
  h.pointer('pointerdown',1,100,100,tool);h.pointer('pointermove',1,150,150,tool);h.pointer('pointerup',1,150,150,tool);h.click(tool);assert.equal(h.node('pop').hidden,true);
  h.pointer('pointerdown',2,150,150,tool);h.pointer('pointerup',2,150,150,tool);h.click(tool);assert.equal(h.node('pop').hidden,false);
  h.node('pop').querySelector('button').click();assert.equal(h.node('pop').hidden,true);assert.equal(h.document.activeElement,tool);
});
test('first blank tap does not zoom; double tap does, and zoom out works below the old mobile limit',()=>{
  const h=boot({reduced:true});h.api.setMode('map');const initial=h.run('scale');assert(initial<.3);
  h.node('zout').click();assert(h.run('scale')<initial);const small=h.run('scale');
  h.pointer('pointerdown',1,100,300);h.pointer('pointerup',1,100,300);assert.equal(h.run('scale'),small);
  h.frame(150);h.pointer('pointerdown',2,100,300);h.pointer('pointerup',2,100,300);assert.equal(h.run('scale'),small*1.8);
});
test('map fits after rotation, fits beneath controls, and preserves the chosen view',()=>{
  const h=boot({width:1200,reduced:true});const before=h.run('scale');h.resize(390,844);assert.equal(h.api.mode,'map');assert(h.run('scale')<before);
  assert(h.run('BOUNDS.y0*scale+ty')>=166);assert(h.run('BOUNDS.y1*scale+ty')<=735);
  h.api.setMode('list');h.resize(844,390);assert.equal(h.api.mode,'list');assert.equal(h.node('stage').hidden,true);
});
test('pulses stop in list, when hidden and with reduced motion, then resume as a single loop',()=>{
  const h=boot({width:1200});h.frame();h.frame();assert.equal(h.frames.size,1);
  h.hidden(true);h.frame();assert.equal(h.frames.size,0);h.hidden(false);h.frame();assert.equal(h.frames.size,1);
  h.reduce(true);h.frame();assert.equal(h.frames.size,0);h.run('zoomBy(1.3)');assert.equal(h.frames.size,0);
  h.reduce(false);h.frame();assert.equal(h.frames.size,1);h.api.setMode('list');h.frame();assert.equal(h.frames.size,0);
});
test('keyboard users can open nodes and return focus with Escape or use slash to find a tool',()=>{
  const h=boot({width:1200,reduced:true}),tool=h.node('nodes').querySelector('.node.tool');
  assert.equal(tool.getAttribute('role'),'button');h.node('nodes').emit('keydown',{target:tool,key:'Enter'});assert.equal(h.node('pop').hidden,false);
  h.window.emit('keydown',{target:h.document.activeElement,key:'Escape'});assert.equal(h.node('pop').hidden,true);assert.equal(h.document.activeElement,tool);
  h.window.emit('keydown',{target:tool,key:'/'});assert.equal(h.api.mode,'list');assert.equal(h.document.activeElement,h.node('neural-search'));
  const prevented=h.window.emit('keydown',{target:h.node('neural-search'),key:'/'});assert.equal(prevented.prevented,undefined);
});
