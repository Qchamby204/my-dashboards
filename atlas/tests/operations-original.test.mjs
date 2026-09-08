import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../operations-cadence.html',import.meta.url),'utf8');
let original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const fixture=['daily','weekly','monthly','quarterly','annually','adhoc'].map(id=>({id,label:id,cadence:'Reference checklist',tasks:[{t:'Review '+id+' reference',sys:'Example system'},{t:'Second '+id+' item',sys:'Example system'}]}));
original=original.slice(0,original.indexOf('const DATA ='))+'const DATA='+JSON.stringify(fixture)+';\n'+original.slice(original.indexOf('// ---------- state ----------'));
const enhancement=readFileSync(new URL('../../shared/operations-enhancements.js',import.meta.url),'utf8');
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function boot({raw=null,blocked=false}={}){
  let now=Date.parse('2026-09-08T12:00:00-05:00'),serial=0;const ids=new Map(),timers=new Map(),blobs=new Map(),downloads=[];
  class Events{
    constructor(){this.events=new Map();}
    addEventListener(type,fn,option){const a=this.events.get(type)||[];a.push({fn,capture:option===true||option?.capture});this.events.set(type,a);}
    emit(type,data={}){const e={target:this,...data,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const h of [...(this.events.get(type)||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){h.fn(e);if(e.stopped)break;}return e;}
  }
  class Element extends Events{
    constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.style={};this.children=[];this.hidden=false;this.value='';this.classes=new Set();this.classList={add:(...a)=>a.forEach(k=>this.classes.add(k)),remove:(...a)=>a.forEach(k=>this.classes.delete(k)),contains:k=>this.classes.has(k),toggle:(k,on)=>{if(on??!this.classes.has(k)){this.classes.add(k);return true;}this.classes.delete(k);return false;}};}
    set id(v){this.attrs.id=v;ids.set(v,this);}get id(){return this.attrs.id;}
    set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
    set textContent(v){this.replaceChildren();this.text=String(v);}get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join('');}
    set innerHTML(v){this._html=v;this.text='';this.replaceChildren();parse(v,this);}get innerHTML(){return this._html||'';}
    get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
    append(...a){a.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parentNode=this;return n;}prepend(n){this.children.unshift(n);n.parentNode=this;}
    before(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this),0,n);n.parentNode=p;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;const removeIDs=n=>{if(n.id)ids.delete(n.id);n.children.forEach(removeIDs);};removeIDs(this);}
    replaceChildren(...a){[...this.children].forEach(n=>n.remove());this.children=[];this.text='';this.append(...a);}
    replaceWith(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1,n);n.parentNode=p;this.parentNode=null;}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='class')this.className=v;if(k==='value')this.value=decode(v);if(k==='hidden')this.hidden=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;}
    getAttribute(k){if(k.startsWith('data-'))return this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]??null;return this.attrs[k]??null;}
    matchesOne(s){
      const tag=s.match(/^[\w-]+/)?.[0];if(tag&&this.tagName!==tag.toUpperCase())return false;
      const id=s.match(/#([\w-]+)/)?.[1];if(id&&this.id!==id)return false;
      if(![...s.matchAll(/\.([\w-]+)/g)].every(m=>this.classes.has(m[1])))return false;
      for(const m of s.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)){const val=this.getAttribute(m[1]);if(val===null||m[2]!==undefined&&val!==m[2])return false;}return true;
    }
    matches(s){return s.split(',').some(selector=>{const parts=selector.trim().split(/\s+/);if(!this.matchesOne(parts.pop()))return false;let p=this.parentNode;while(parts.length){const part=parts.pop();while(p&&!p.matchesOne(part))p=p.parentNode;if(!p)return false;p=p.parentNode;}return true;});}
    closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}
    querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
    focus(){document.activeElement=this;}blur(){document.activeElement=null;}select(){}scrollIntoView(){this.scrolled=true;}
    click(){if(this.tagName==='A'&&this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});this.emit('click');this.onclick?.();}
  }
  function parse(markup,parent){
    const stack=[parent],voids=new Set(['input','br','hr','meta','link','img','path','circle']);
    for(const m of markup.matchAll(/<!--[\s\S]*?-->|<\/?[a-zA-Z][^>]*>|[^<]+/g)){
      const token=m[0];if(token.startsWith('<!--'))continue;
      if(token.startsWith('</')){const tag=token.match(/^<\/([\w-]+)/)[1].toUpperCase();for(let j=stack.length-1;j>0;j--)if(stack[j].tagName===tag){stack.length=j;break;}continue;}
      if(token.startsWith('<')){const tag=token.match(/^<([\w-]+)/)[1],n=new Element(tag);for(const a of token.slice(tag.length+1,-1).matchAll(/([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g))n.setAttribute(a[1],a[2]??a[3]??a[4]??'');stack.at(-1).appendChild(n);if(!voids.has(tag)&&!token.endsWith('/>'))stack.push(n);}
      else{const top=stack.at(-1);top.text=(top.text||'')+decode(token);if(top.tagName==='TEXTAREA')top.value=top.text;}
    }
    parent.querySelectorAll('select').forEach(s=>{s.value=s.querySelectorAll('option').find(o=>o.getAttribute('selected')!==null)?.value||s.querySelector('option')?.value||'';});
  }
  const document=new Events();document.readyState='complete';document.hidden=false;document.currentScript={src:'https://example.test/shared/operations-enhancements.js'};document.documentElement={dataset:{atlasApp:'operations-cadence'}};document.head=new Element('head');document.body=new Element('body');document.activeElement=null;
  document.createElement=tag=>new Element(tag);document.getElementById=id=>ids.get(id)||null;document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  document.body.innerHTML=html.slice(html.indexOf('<body>')+6,html.indexOf('<script>',html.indexOf('<body>')));
  const storage=new Map(raw===null?[]:[['operationsCadence.v1',raw]]),localStorage={blocked,writeBlocked:false,getItem(k){if(this.blocked)throw Error('Blocked');return storage.get(k)??null;},setItem(k,v){if(this.blocked||this.writeBlocked)throw Error('Storage unavailable');storage.set(k,String(v));}};
  const window=new Events();window.AtlasOperationsBoot={raw,readError:blocked};window.scrollTo=()=>{};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const id='blob:'+(++serial);blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
  const context=vm.createContext({document,window,navigator:{},localStorage,Date:Clock,URL:BlobURL,Blob,console,setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  let legacyError;try{vm.runInContext(original,context);}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);const run=s=>vm.runInContext(s,context),node=id=>ids.get(id);
  return {run,node,document,window,context,api:window.OperationsImprovements,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    undo(){const t=node('ocToast');assert(t);t.querySelector('button').click();}};
}

test('Today counts only dated work and keeps undated capture visible beside routines',()=>{
  const h=boot();assert.equal(h.api.dueRows().length,0);assert.match(h.node('todayBody').textContent,/No scheduled tasks are due/);assert.match(h.node('todayBody').textContent,/Routine checklists/);
  h.node('capText').value='Remember the sample document';h.node('capAdd').click();assert.match(h.node('todayBody').textContent,/Remember the sample document/);assert.equal(h.run('getLog().length'),1);assert.equal(h.node('tBig').textContent,'0');
  h.run("setSched('daily',0,'2026-09-08');render()");assert.equal(h.api.dueRows().length,1);assert.equal(h.node('tBig').textContent,'1');
});
test('repeat completion resets at its occurrence even within the same cadence period',()=>{
  const h=boot();h.run("setRecur('monthly',0,{kind:'weekday',wd:2});set('monthly',0,{done:true})");assert.equal(h.run("get('monthly',0).done"),true);
  h.at('2026-09-15T12:00:00-05:00');assert.equal(h.run("get('monthly',0).done"),false);assert.equal(h.api.dueRows().length,1);h.api.completeRow(h.api.dueRows()[0]);assert.equal(h.api.dueRows().length,0);assert.equal(h.run("get('monthly',0).done"),true);
});
test('every-N-day schedules stay on calendar days across spring DST and support long intervals',()=>{
  const h=boot();h.at('2026-03-09T12:00:00-05:00');assert.equal(h.run("lastOccurrence({kind:'everyn',n:2,anchor:'2026-03-07'})"),'2026-03-09');
  h.at('2026-09-08T12:00:00-05:00');assert.equal(h.run("nextOccurrence({kind:'everyn',n:500,anchor:'2026-09-08'})"),'2028-01-21');
  assert.equal(h.run("lastOccurrence({kind:'weekday',wd:5,start:'2026-09-08'})"),null);assert.equal(h.run("nextOccurrence({kind:'weekday',wd:5,start:'2026-09-08'})"),'2026-09-11');
});
test('one-off dates are consumed in a checklist and a newly assigned date reopens the task',()=>{
  const h=boot();h.run("setSched('weekly',0,'2026-09-08');set('weekly',0,{done:true})");assert.equal(h.run("schedFor('weekly',0)"),'');h.run("setSched('weekly',0,'2026-09-08')");assert.equal(h.run("get('weekly',0).done"),false);assert.equal(h.api.dueRows().length,1);
});
test('legacy overlapping schedules produce one row and completing a repeat retains a future pin',()=>{
  const h=boot();h.run("setSched('weekly',0,'2026-09-30');setRecur('weekly',0,{kind:'weekday',wd:2})");assert.equal(h.api.dueRows().length,1);h.api.completeRow(h.api.dueRows()[0]);assert.equal(h.run("schedFor('weekly',0)"),'2026-09-30');assert.equal(h.api.dueRows().length,0);
});
test('completion Undo preserves later notes and unrelated completion history',()=>{
  const h=boot();h.run("setSched('weekly',0,'2026-09-08')");h.api.completeRow(h.api.dueRows()[0]);h.run("set('weekly',0,{note:'Keep this later note'});addEvent({kind:'cadence',cadence:'daily',key:'daily:0',label:'Other completion'})");h.undo();
  assert.equal(h.run("get('weekly',0).note"),'Keep this later note');assert.equal(h.run("schedFor('weekly',0)"),'2026-09-08');assert.equal(h.run('getEvents().length'),1);
});
test('log completion works the same from Today and the log and removes old-format events on undo',()=>{
  const h=boot();h.run("addLog('Sample task','2026-09-08','Admin')");const id=h.run('getLog()[0].id');h.run(`toggleLog('${id}')`);assert(h.run('getLog()[0].doneAt'));assert.equal(h.run('getEvents()[0].logId'),id);h.run(`toggleLog('${id}')`);assert.equal(h.run('getEvents().length'),0);
  h.run(`getLog()[0].done=true;addEvent({kind:'log',key:'log:${id}',label:'Old completion'});toggleLog('${id}')`);assert.equal(h.run('getEvents().length'),0);
});
test('log dates can be changed and deletion Undo keeps later captures',()=>{
  const h=boot();h.run("addLog('First task','','Admin');active='log';render()");const id=h.run('getLog()[0].id');h.node('logList').querySelector('.operations-button').click();h.node('uiF_d').value='2026-09-10';h.node('uiOk').click();assert.equal(h.run('getLog()[0].due'),'2026-09-10');
  h.run(`deleteLog('${id}');addLog('Second task','','Admin')`);h.undo();assert.equal(h.run('getLog().length'),2);
});
test('search focuses the matching task and notes remain literal in section markup',()=>{
  const h=boot();h.run("set('weekly',1,{note:'Needle </textarea><img src=x onerror=alert(1)> & more'})");h.run("searchAll('needle')[0].go()");const row=h.document.querySelectorAll('[data-operations-key]').find(n=>n.dataset.operationsKey==='weekly:1');assert.equal(h.document.activeElement,row);assert(row.scrolled);assert(!row.querySelector('img'));assert.match(row.innerHTML,/&lt;\/textarea&gt;/);assert.match(h.run("get('weekly',1).note"),/<\/textarea>/);
});
test('schedule editor chooses one schedule, validates inputs and does not create past occurrences',()=>{
  const h=boot();h.run("scheduleSheet('weekly',0,'Example task')");h.node('op-kind').value='weekday';h.node('op-week').value='5';h.node('op-kind').emit('input');h.node('op-save').click();assert.equal(h.run("schedFor('weekly',0)"),'');assert.equal(h.run("recurFor('weekly',0).start"),'2026-09-08');assert.equal(h.api.dueRows().length,0);
  h.run("scheduleSheet('weekly',0,'Example task')");h.node('op-kind').value='once';h.node('op-date').value='2026-02-30';h.node('op-save').click();assert(h.node('uiDlg'));assert.match(h.node('op-preview').textContent,/valid date/);
});
test('save failures preserve the current backup and malformed saved state stays recoverable',async()=>{
  const h=boot();h.localStorage.writeBlocked=true;h.run("set('daily',0,{note:'Unsaved note'})");assert(h.api.unsaved);h.api.backup();assert.equal(JSON.parse(await h.downloads[0].blob.text()).state['daily:0'].note,'Unsaved note');h.localStorage.writeBlocked=false;h.run('save()');assert(!h.api.unsaved);
  const corrupt=boot({raw:'null'});assert(corrupt.api.blocked);assert.equal(corrupt.storage.get('operationsCadence.v1'),'null');corrupt.api.backup();assert.equal(await corrupt.downloads[0].blob.text(),'null');
});
test('backup restore validates before replacing state and confirms the replacement',async()=>{
  const h=boot();assert.throws(()=>h.api.validateState({recur:{'weekly:0':{kind:'everyn',n:0,anchor:'2026-09-08'}}}));assert.throws(()=>h.api.validateState({log:[{id:'bad'}]}));
  const before=h.storage.get('operationsCadence.v1');h.context.file={value:'chosen',files:[{size:100,text:async()=>JSON.stringify({app:'operations-cadence',version:1,state:{'daily:0':{done:false,note:'Restored note'}}})}]};await h.run('OperationsImprovements.restore(file)'.replace('OperationsImprovements','window.OperationsImprovements'));assert.equal(h.storage.get('operationsCadence.v1'),before);h.node('uiOk').click();assert.equal(h.run("get('daily',0).note"),'Restored note');
});
test('day rollover waits while typing and updates when the field is left',()=>{
  const h=boot();h.run("setSched('weekly',0,'2026-09-09')");h.node('capText').focus();h.at('2026-09-09T12:00:00-05:00');h.api.refreshDay();assert.equal(h.node('tBig').textContent,'0');h.node('capText').blur();h.api.refreshDay();assert.equal(h.node('tBig').textContent,'1');
});
