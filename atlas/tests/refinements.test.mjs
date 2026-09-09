import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../../shared/atlas-refinements.js',import.meta.url),'utf8');

function harness(app='the-herald'){
  const events={},nodes=[],pending=[];
  let observer;
  const document={readyState:'complete',addEventListener:(type,fn)=>events[type]=fn,
    querySelectorAll:s=>{
      const live=nodes.filter(n=>n.isConnected);
      if(s==='#tabs button')return live.filter(n=>n.nav);
      if(s==='details.atlas-info')return live.filter(n=>n.tagName==='DETAILS');
      if(s.startsWith('button,input,select'))return live.filter(n=>n.control);
      return [];
    },
    querySelector:s=>s==='dialog[open]'?nodes.find(n=>n.native&&n.open)||null:null,
    getElementById:id=>nodes.find(n=>n.isConnected&&n.id===id)||null};
  function node(tag='BUTTON',id='',attrs={}){
    const classes=new Set(),n={tagName:tag,id,attrs:{...attrs},classList:{add:x=>classes.add(x),contains:x=>classes.has(x)},
      dataset:{},isConnected:true,inert:false,disabled:false,tabIndex:tag==='BUTTON'?0:-1,control:tag==='BUTTON',children:[],
      get attributes(){return Object.entries(n.attrs).map(([name,value])=>({name,value}));},
      getAttribute:k=>Object.hasOwn(n.attrs,k)?n.attrs[k]:null,hasAttribute:k=>Object.hasOwn(n.attrs,k),
      setAttribute:(k,v)=>n.attrs[k]=v,removeAttribute:k=>delete n.attrs[k],
      contains:el=>el===n||n.children.includes(el),querySelector:()=>null,querySelectorAll:()=>n.children,
      getClientRects:()=>n.hidden?[]:[{}],
      closest:s=>s==='[hidden],[inert]'?(n.inert?n:null):s==='[id],[data-id],[data-key]'?(n.id||n.attrs['data-id']?n:n.parentElement):n,
      focus(){document.activeElement=n;events.focusin?.({target:n});},
      remove(){n.isConnected=false;if(document.activeElement===n)document.activeElement=document.body;}};
    n.parentElement=document.body;nodes.push(n);return n;
  }
  document.documentElement=node('HTML');document.documentElement.dataset.atlasApp=app;
  document.body=node('BODY');document.activeElement=document.body;
  const window={};
  vm.runInNewContext(source,{document,window,queueMicrotask:fn=>pending.push(fn),MutationObserver:class{constructor(fn){observer=fn;}observe(){}}});
  function click(n){events.click({target:n});}
  function redraw(old,next){old.remove();document.activeElement=document.body;observer();return next;}
  function key(key,shiftKey=false){const e={key,shiftKey,preventDefault(){this.prevented=true;},stopImmediatePropagation(){}};events.keydown(e);return e;}
  return {document,window,node,events,click,redraw,key,reconcile:()=>window.AtlasRefinements.reconcile()};
}

test('a redraw restores the same control without stealing deliberately moved focus',()=>{
  const h=harness(),old=h.node('BUTTON','save');old.focus();const next=h.node('BUTTON','save');
  h.redraw(old,next);assert.equal(h.document.activeElement,next);
  const other=h.node('INPUT','writing');other.focus();h.reconcile();assert.equal(h.document.activeElement,other);
});

test('identical action buttons stay scoped to their own record and ambiguity fails safely',()=>{
  const h=harness('courier'),one=h.node('SECTION','',{'data-id':'one'}),two=h.node('SECTION','',{'data-id':'two'});
  const old=h.node('BUTTON','',{'data-act':'play'});old.parentElement=one;old.focus();
  const wrong=h.node('BUTTON','',{'data-act':'play'});wrong.parentElement=two;
  const right=h.node('BUTTON','',{'data-act':'play'});right.parentElement=one;
  h.redraw(old,right);assert.equal(h.document.activeElement,right);
  const duplicate=h.node('BUTTON','',{'data-act':'play'});duplicate.parentElement=one;
  const duplicate2=h.node('BUTTON','',{'data-act':'play'});duplicate2.parentElement=one;
  h.redraw(right,duplicate);assert.equal(h.document.activeElement,h.document.body);
});

test('confirmation contains focus, Escape cancels, and pre-existing inert state is preserved',()=>{
  const h=harness(),trigger=h.node('BUTTON','edit'),background=h.node('MAIN'),already=h.node('ASIDE');already.inert=true;
  trigger.focus();h.click(trigger);
  const modal=h.node('DIV','uiDlg'),cancel=h.node('BUTTON','cancel'),save=h.node('BUTTON','confirm');
  modal.children=[cancel,save];h.document.body.children=[background,already,trigger,modal];
  h.window.uiClose=()=>modal.remove();h.reconcile();
  assert.equal(h.document.activeElement,modal);assert.equal(background.inert,true);assert.equal(modal.attrs['aria-modal'],'true');
  assert.equal(h.key('Tab').prevented,true);assert.equal(h.document.activeElement,cancel);
  h.key('Tab',true);assert.equal(h.document.activeElement,save);
  h.key('Escape');assert.equal(modal.isConnected,false);assert.equal(background.inert,false);assert.equal(already.inert,true);assert.equal(h.document.activeElement,trigger);
});

test('native dialogs retain ownership of Escape and navigation reports the selected screen',()=>{
  const h=harness(),active=h.node('BUTTON','active'),other=h.node('BUTTON','other');active.nav=true;other.nav=true;active.classList.add('on');
  h.reconcile();assert.equal(active.attrs['aria-current'],'page');assert.equal(other.attrs['aria-current'],undefined);
  const modal=h.node('DIV','uiDlg');h.reconcile();const native=h.node('DIALOG','native');native.native=true;native.open=true;
  assert.equal(h.key('Escape').prevented,undefined);assert.equal(modal.isConnected,true);
});

test('open information survives redraws and Life Map is excluded from suite hooks',()=>{
  const h=harness(),old=h.node('DETAILS','help');old.matches=()=>true;old.open=true;
  h.events.toggle({target:old});old.remove();const next=h.node('DETAILS','help');next.open=false;h.reconcile();assert.equal(next.open,true);
  assert.equal(harness('life-map').window.AtlasRefinements,undefined);
});
