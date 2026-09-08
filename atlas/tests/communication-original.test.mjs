import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../communication-trainer.html',import.meta.url),'utf8');
const original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
const extension=readFileSync(new URL('../../shared/communication-enhancements.js',import.meta.url),'utf8');

function boot({speech=true}={}){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),intervals=new Map(),timeouts=new Map(),engines=[];let now=Date.parse('2026-09-08T12:00:00Z'),nextId=0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.attrs={};this.children=[];this.dataset={};this.value='';this.innerHTML='';this.hidden=false;this.classes=new Set();this.classList={add:(...keys)=>keys.forEach(k=>this.classes.add(k)),remove:key=>this.classes.delete(key),toggle:(key,on)=>{if(on)this.classes.add(key);else this.classes.delete(key);}};}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    set textContent(value){this._text=value;this.children=[];}get textContent(){return this._text||'';}
    setAttribute(key,value){this.attrs[key]=String(value);}removeAttribute(key){delete this.attrs[key];}
    appendChild(el){this.children.push(el);el.parentNode=this;return el;}before(el){el.parentNode=this;}
    remove(){this.parentNode=null;}focus(){this.focused=true;}select(){}click(){this.onclick?.();}
    querySelectorAll(){return [];}querySelector(){return null;}addEventListener(){}
  }
  const node=id=>{if(!nodes.has(id)){const n=new Element();n.id=id;}return nodes.get(id);};
  const on=(map,key,fn)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(fn);};
  const storage=new Map([['mc_catsEnabled','[]'],['mc_customTopics',JSON.stringify([{cat:'custom',text:'Explain a familiar hobby'}])],['mc_proCatsAdded','true']]);
  const localStorage={blocked:false,getItem:key=>storage.get(key)??null,removeItem:key=>storage.delete(key),setItem(key,value){if(this.blocked)throw Error('Quota');storage.set(key,String(value));}};
  const document={readyState:'complete',hidden:false,currentScript:{src:'https://example.test/shared/communication-enhancements.js'},documentElement:{dataset:{atlasApp:'communication-trainer'}},getElementById:node,createElement:tag=>new Element(tag),head:new Element(),body:new Element(),addEventListener:(key,fn)=>on(events,key,fn),execCommand:()=>false};
  class Recognition{constructor(){engines.push(this);}start(){this.started=(this.started||0)+1;}abort(){this.aborted=true;}stop(){this.stopped=true;}}
  const window={scrollX:0,scrollY:0,addEventListener:(key,fn)=>on(windowEvents,key,fn),scrollTo(x,y){this.scrollX=x;this.scrollY=y;}};if(speech)window.SpeechRecognition=Recognition;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({document,window,localStorage,navigator:{},Date:Clock,URL,Blob,console,
    setInterval:fn=>{const id=++nextId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
    setTimeout:fn=>{const id=++nextId;timeouts.set(id,fn);return id;},clearTimeout:id=>timeouts.delete(id)});
  vm.runInContext(original+'\n'+extension,context);
  const run=code=>vm.runInContext(code,context);
  run("uiConfirm=(title,body,label,action)=>{globalThis.importConfirm=action;};uiNote=message=>{globalThis.importMessage=message;};");
  const begin=()=>run("launchDrill({id:'synthetic',name:'Explain clearly',skill:SKILLS[0].id,time:90,steps:()=>['Speak about a familiar topic.'],rubric:['Clear point','Useful example','Clear ending']})");
  const fire=(map,name)=>{for(const fn of map.get(name)||[])fn();};
  return {run,node,begin,storage,localStorage,window,document,engines,api:window.CommunicationImprovements,context,intervals,timeouts,
    advance(ms,fireTimers=true){now+=ms;if(fireTimers)for(const [id,fn]of [...intervals])if(intervals.has(id))fn();},
    hidden(value){document.hidden=value;fire(events,'visibilitychange');},pagehide(){fire(windowEvents,'pagehide');},
    undo(){node('undoToast').children.find(child=>child.tagName==='BUTTON').click();}};
}
function result(text,isFinal=true){const entry=[{transcript:text}];entry.isFinal=isFinal;return {resultIndex:0,results:[entry]};}

test('timer uses elapsed time, preserves fractional pause time and stays accurate through renders',()=>{
  const h=boot();h.begin();h.run('toggleTimer()');h.advance(10400);assert.equal(h.run('timerLeft'),80);
  h.run('togglePrep()');assert.equal(h.node('tbtn').textContent,'Pause');h.run('toggleTimer()');
  h.advance(3600000);assert.equal(h.run('timerLeft'),80);assert.equal(h.node('tbtn').textContent,'Resume');
  h.run('toggleTimer()');h.advance(79600);assert.equal(h.run('timerLeft'),0);assert.equal(h.run('timerInt'),null);
  assert.equal(h.node('tbtn').disabled,true);h.run('toggleTimer()');assert.equal(h.run('timerLeft'),0);
});
test('leaving the app or Train pauses controls and never silently restarts the microphone',()=>{
  const h=boot();h.begin();h.run('recToggle()');h.engines[0].onstart();h.advance(10000);h.hidden(true);
  assert.equal(h.run('recOn'),false);assert.equal(h.run('timerInt'),null);assert.equal(h.engines[0].aborted,true);
  h.advance(50000);h.hidden(false);assert.equal(h.run('timerLeft'),80);assert.equal(h.run('recOn'),false);
  h.run("recToggle()");h.engines[1].onstart();h.run("nav('learn')");assert.equal(h.run('recOn'),false);assert.equal(h.run('timerInt'),null);
});
test('late speech results, endings and errors cannot modify or stop a newer rep',()=>{
  const h=boot();h.begin();h.run('recToggle()');const first=h.engines[0];first.onstart();first.onresult(result('Old transcript',false));
  const late={result:first.onresult,end:first.onend,error:first.onerror};h.begin();h.run('recToggle()');h.engines[1].onstart();
  late.result(result('Late old words'));late.end();late.error({error:'not-allowed'});
  assert.equal(h.run("curDrill.tx||''"),'');assert.equal(h.run('recOn'),true);assert.equal(h.engines[1].aborted,undefined);
  h.engines[1].onresult(result('New words'));assert.equal(h.run('curDrill.tx'),'New words');
});
test('dictation keeps displayed interim words when stopped and stops when time expires',()=>{
  const h=boot();h.begin();h.run('recToggle()');const engine=h.engines[0];engine.onstart();engine.onresult(result('A useful thought',false));
  h.advance(90000);assert.equal(h.run('recOn'),false);assert.equal(engine.aborted,true);assert.equal(h.run('curDrill.tx'),'A useful thought');
  assert.equal(h.run('curDrill.recSecs'),90);assert.equal(h.run('S.reps.length'),0);
});
test('unsupported or denied dictation leaves typing available and does not start a timer',()=>{
  const missing=boot({speech:false});missing.begin();missing.run('recToggle()');assert.equal(missing.node('txBox').focused,true);assert.equal(missing.run('recOn'),false);
  const denied=boot();denied.begin();denied.run('recToggle()');assert.equal(denied.run('timerInt'),null);denied.engines[0].onerror({error:'not-allowed'});
  assert.equal(denied.run('recOn'),false);assert.equal(denied.run('timerInt'),null);assert.equal(denied.node('recBtn').textContent,'Start dictation');
});
test('restart Undo cannot put an old transcript into a new rep or overwrite newer typing',()=>{
  const h=boot();h.begin();h.run("curDrill.tx='Previous words';resetRep()");h.begin();h.run("curDrill.tx='New work'");h.undo();assert.equal(h.run('curDrill.tx'),'New work');
  h.run('resetRep()');h.undo();assert.equal(h.run('curDrill.tx'),'New work');
  h.run("resetRep();curDrill.tx='Typed after reset'");h.undo();assert.equal(h.run('curDrill.tx'),'Typed after reset');
});
test('progress export includes saved grades, pending feedback and unsaved in-memory changes',()=>{
  const h=boot();h.run("S.grades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'A hobby',overall:70,scores:{clarity:7}}];S.pendingGrades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'Another hobby'}];save()");
  assert.equal(h.run('Store.dump().grades.length'),1);assert.equal(h.run('Store.dump().pendingGrades.length'),1);
  h.localStorage.blocked=true;h.run("S.prepNotes['A hobby']='Unsaved preparation';save()");assert(h.api.unsaved>0);assert.equal(h.node('communication-save-error').hidden,false);
  assert.equal(h.run("Store.dump().prepNotes['A hobby']"),'Unsaved preparation');assert.equal(h.run("Store.get('prepNotes',{})['A hobby']"),'Unsaved preparation');
  h.localStorage.blocked=false;h.run('save()');assert.equal(h.api.unsaved,0);assert.equal(JSON.parse(h.storage.get('mc_prepNotes'))['A hobby'],'Unsaved preparation');
});
test('invalid backups are rejected before writes, while older backups preserve omitted grades',async()=>{
  const h=boot(),before=h.storage.get('mc_catsEnabled');
  assert.throws(()=>h.api.validateBackup({reps:[{date:'invalid'}],catsEnabled:['changed']}));assert.equal(h.storage.get('mc_catsEnabled'),before);
  assert.throws(()=>h.api.validateBackup({reps:[],customTopics:[null]}));assert.throws(()=>h.api.validateBackup({assessments:[{date:'2026-09-08',scores:[]}]}));
  h.run("S.grades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'A hobby',overall:70,scores:{clarity:7}}];save()");
  h.context.fileInput={files:[{size:50,text:async()=>JSON.stringify({reps:[],city:'A place'})}],value:'selected'};
  await h.run('importData(fileInput)');assert.equal(h.run('S.city'),'');h.run('importConfirm()');
  assert.equal(h.run('S.city'),'A place');assert.equal(h.run('S.grades.length'),1);assert.equal(h.context.fileInput.value,'');
});
test('a rejected clipboard fallback never reports success',()=>{
  const h=boot();h.run("globalThis.copySucceeded=false;fallbackCopy('Test',()=>{globalThis.copySucceeded=true})");assert.equal(h.run('copySucceeded'),false);
});
