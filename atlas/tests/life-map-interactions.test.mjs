import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../life-map-interactions.js',import.meta.url),'utf8');

function harness(){
  let nodes={},dialog=null;
  const events={},clicks=[];
  const view={editor:null},S={projects:[{id:'one',task:'Room plan',status:'Not started'}],chores:[{id:'chore',chore:'Water plants',done:false}]};
  const document={activeElement:null,getElementById:id=>Object.values(nodes).find(x=>x.id===id)||null,addEventListener:(type,fn)=>events[type]=fn};
  const app={children:[],contains:el=>Object.values(nodes).includes(el),addEventListener:(type,fn)=>{if(type==='click')clicks.push(fn);},querySelector:selector=>selector.startsWith('.overlay')?dialog:null,
    querySelectorAll:selector=>{
      if(selector==='[data-act]')return Object.values(nodes).filter(x=>x.dataset.act);
      if(selector.startsWith('[data-act="advance"]'))return [nodes.advance,nodes.tick,nodes.edit,nodes.timeline];
      if(selector.startsWith('details.atlas-info'))return !nodes.help?[]:selector.endsWith('[open]')?(nodes.help.open?[nodes.help]:[]):[nodes.help];
      if(selector==='[data-act="f"]')return dialog?[nodes.field]:[];
      return [];
    }};
  function node(name,tag='BUTTON',data={}){
    const n={name,id:name,tagName:tag,dataset:data,attrs:{},style:{},inert:false,tabIndex:tag==='BUTTON'?0:-1,classList:{add(){}},setAttribute(k,v){this.attrs[k]=v;},getAttribute(k){return this.attrs[k];},querySelector:()=>null,
      closest:selector=>selector==='#app'?app:selector==='[data-act]'&&n.dataset.act?n:null,
      focus(){document.activeElement=n;},getClientRects:()=>[{}],click(){n.activated=(n.activated||0)+1;}};
    nodes[name]=n;return n;
  }
  function draw(){
    nodes={};dialog=null;
    node('advance','BUTTON',{act:'advance',id:'one'});node('tick','BUTTON',{act:'tick',id:'chore'});node('edit','BUTTON',{act:'edit',id:'one'});
    node('timeline','DIV',{act:'edit',id:'one'});node('toast','DIV');
    const help=node('help','DETAILS'),summary=node('helpSummary','SUMMARY');summary.attrs['aria-label']='How parked projects work';help.querySelector=()=>summary;
    app.children=[nodes.advance,nodes.tick,nodes.edit,nodes.timeline,nodes.help];
    if(view.editor){
      dialog=node('dialog','DIV');node('cancel');node('field','INPUT',{act:'f',k:'task'});node('save');
      dialog.querySelectorAll=()=>[nodes.cancel,nodes.field,nodes.save];app.children.push(dialog);
    }
  }
  const context=vm.createContext({app,document,window:{},view,S,render:draw,isChecked:c=>c.done,plannedToday:()=>false});
  vm.runInContext(code,context);
  const render=()=>context.render();render();
  function key(value,shiftKey=false){const event={key:value,shiftKey,target:document.activeElement,preventDefault(){this.prevented=true;},stopPropagation(){}};events.keydown(event);return event;}
  return {context,S,view,document,app,render,key,node:name=>nodes[name],click:name=>clicks.forEach(fn=>fn({target:nodes[name]}))};
}

test('redrawing an updated record preserves focus, open help, and meaningful state labels',()=>{
  const h=harness();const before=h.node('advance');before.focus();h.node('help').open=true;
  assert.equal(before.attrs['aria-label'],'Start Room plan');
  h.S.projects[0].status='In progress';h.S.chores[0].done=true;h.render();
  assert.notEqual(h.document.activeElement,before);assert.equal(h.document.activeElement,h.node('advance'));
  assert.equal(h.node('advance').attrs['aria-label'],'Complete Room plan');assert.equal(h.node('tick').attrs['aria-pressed'],'true');assert.equal(h.node('help').open,true);
});

test('the original editor receives focus, contains Tab navigation, and returns to its trigger on Escape',()=>{
  const h=harness();h.click('edit');h.view.editor={kind:'proj',id:'one'};h.render();
  assert.equal(h.document.activeElement,h.node('dialog'));assert.equal(h.node('edit').inert,true);
  assert.equal(h.key('Tab').prevented,true);assert.equal(h.document.activeElement,h.node('cancel'));
  h.key('Tab',true);assert.equal(h.document.activeElement,h.node('save'));
  h.key('Tab');assert.equal(h.document.activeElement,h.node('cancel'));
  h.key('Escape');assert.equal(h.view.editor,null);assert.equal(h.document.activeElement,h.node('edit'));assert.equal(h.node('edit').inert,false);
});

test('timeline rows activate once with the keyboard without intercepting text fields',()=>{
  const h=harness();h.node('timeline').focus();assert.equal(h.node('timeline').tabIndex,0);h.key('Enter');assert.equal(h.node('timeline').activated,1);
  h.click('edit');h.view.editor={kind:'proj',id:'one'};h.render();h.node('field').focus();const event=h.key(' ');assert.equal(event.prevented,undefined);assert.equal(h.view.editor.id,'one');
});
