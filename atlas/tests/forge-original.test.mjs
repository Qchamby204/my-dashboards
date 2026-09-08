import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../workout-forge.html',import.meta.url),'utf8');
let original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const fixture=['PUSH','PULL'].map(key=>({key,tag:'Sample '+key,title:'Sample session',accent:'#5075aa',glow:'rgba(80,117,170,.4)',blurb:'Test fixture',order:'Recorded order',sections:[{name:'Sample block',items:[{n:'Recorded movement',f:[],track:'load',sets:2,reps:'5',rest:'1 min',rpe:''},{n:'Recorded activity',f:[],track:'cardio',defMin:15,modes:['Walk','Bike']},{n:'Recorded item',f:[],track:'check'}]}]}));
original=original.slice(0,original.indexOf('var PROGRAM='))+'var PROGRAM='+JSON.stringify(fixture)+';\n'+original.slice(original.indexOf('PROGRAM.forEach(function(d){ d.sections'));
const enhancement=readFileSync(new URL('../../shared/forge-enhancements.js',import.meta.url),'utf8');
const S='forge:sessions:v2',D='forge:draft:v1',L='forge:live:v1',R='forge:rest:v1',J='forge:pending-log:v1';
const file=o=>({size:100,text:async()=>JSON.stringify(o)});
const draft={'PUSH-0-0':{sets:[{w:'10',r:'4'}],note:'Keep note',done:false}};
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
async function boot({records={},blocked=false,width=390}={}){
  let now=Date.parse('2026-09-08T12:00:00-05:00'),serial=0;const ids=new Map(),timers=new Map(),blobs=new Map(),downloads=[];
  class Events{
    constructor(){this.events=new Map();}
    addEventListener(type,fn,option){const a=this.events.get(type)||[];a.push({fn,capture:option===true||option?.capture});this.events.set(type,a);}
    emit(type,data={}){const e={target:this,...data,preventDefault(){this.prevented=true;},stopPropagation(){this.propagationStopped=true;},stopImmediatePropagation(){this.stopped=true;}};for(const h of [...(this.events.get(type)||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){h.fn(e);if(e.stopped)break;}return e;}
  }
  class Element extends Events{
    constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.attrs={};this.dataset={};this.style={setProperty:(k,v)=>{this.style[k]=v;}};this.children=[];this.hidden=false;this.value='';this.classes=new Set();this.classList={add:(...a)=>a.forEach(k=>this.classes.add(k)),remove:(...a)=>a.forEach(k=>this.classes.delete(k)),contains:k=>this.classes.has(k),toggle:(k,on)=>{if(on??!this.classes.has(k)){this.classes.add(k);return true;}this.classes.delete(k);return false;}};}
    set id(v){this.attrs.id=v;ids.set(v,this);}get id(){return this.attrs.id;}
    set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
    set textContent(v){this.replaceChildren();this.text=String(v);}get textContent(){return (this.text||'')+this.children.map(n=>n.textContent).join('');}
    set innerHTML(v){this._html=v;this.text='';this.replaceChildren();parse(v,this);}get innerHTML(){return this._html||'';}
    get firstElementChild(){return this.children[0]||null;}
    removeChild(n){n.remove();}
    get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
    append(...a){a.forEach(n=>this.appendChild(n));}appendChild(n){this.children.push(n);n.parentNode=this;return n;}prepend(n){this.children.unshift(n);n.parentNode=this;}
    before(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this),0,n);n.parentNode=p;}
    after(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this)+1,0,n);n.parentNode=p;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;const removeIDs=n=>{if(n.id)ids.delete(n.id);n.children.forEach(removeIDs);};removeIDs(this);}
    replaceChildren(...a){[...this.children].forEach(n=>n.remove());this.children=[];this.text='';this.append(...a);}
    replaceWith(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this),1,n);n.parentNode=p;this.parentNode=null;}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='class')this.className=v;if(k==='value')this.value=decode(v);if(k==='hidden')this.hidden=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;}
    removeAttribute(k){delete this.attrs[k];}
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
    getBoundingClientRect(){return {top:0,bottom:this.tagName==='HEADER'?100:160,height:100,width:390};}
    scrollTo(){this.scrollTop=0;}
    showModal(){this.open=true;this.setAttribute('open','');}close(){this.open=false;this.removeAttribute('open');}
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
  const document=new Events();document.readyState='complete';document.hidden=false;document.visibilityState='visible';document.currentScript={src:'https://example.test/shared/forge-enhancements.js'};document.documentElement=new Element('html');document.documentElement.dataset.atlasApp='workout-forge';document.head=new Element('head');document.body=new Element('body');document.activeElement=null;
  document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.getElementById=id=>ids.get(id)||null;document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  document.body.innerHTML=html.slice(html.indexOf('<body>')+6,html.indexOf('<script>',html.indexOf('<body>')));
  const storage=new Map(Object.entries(records)),localStorage={blocked,writeBlocked:false,blockedKey:null,getItem(k){if(this.blocked)throw Error('Blocked');return storage.get(k)??null;},setItem(k,v){if(this.blocked||this.writeBlocked||this.blockedKey===k)throw Error('Storage unavailable');storage.set(k,String(v));}};
  const window=new Events();window.innerWidth=width;window.innerHeight=844;window.matchMedia=q=>({matches:q.includes('max-width')?width<=700:true,addEventListener(){}});window.AtlasForgeBoot={raw:{...records},readError:blocked};window.scrollTo=()=>{};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const id='blob:'+(++serial);blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
  const context=vm.createContext({document,window,innerWidth:width,innerHeight:844,addEventListener:(...a)=>window.addEventListener(...a),performance:{now:()=>now},requestAnimationFrame:()=>++serial,cancelAnimationFrame(){},navigator:{},crypto:{randomUUID:()=> 'fixture-session-'+(++serial)},localStorage,Date:Clock,URL:BlobURL,Blob,console,setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++serial,clearInterval(){}});
  let legacyError;try{vm.runInContext(original,context);for(let i=0;i<30;i++)await Promise.resolve();}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);for(let i=0;i<30;i++)await Promise.resolve();const run=s=>vm.runInContext(s,context),node=id=>ids.get(id);
  return {run,node,document,window,context,api:window.ForgeSession,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    settle:async()=>{for(let i=0;i<30;i++)await Promise.resolve();},act(action,extra={}){const el=document.createElement('button');el.dataset={act:action,...extra};return node('app').emit('click',{target:el});},
    clickText(text){const scope=document.querySelector('dialog[open]')||document;const b=scope.querySelectorAll('button').find(n=>n.textContent===text);assert(b,'Missing button '+text);b.click();}};
}



test('live pause excludes elapsed pause time and persists a paused rest timer',async()=>{
 const h=await boot();assert.equal(h.legacyError,undefined);h.act('live',{key:'PUSH'});h.run('startTimer(90)');h.at('2026-09-08T12:00:20-05:00');h.api.pauseLive();assert.equal(h.api.elapsedMs(),20000);
 h.at('2026-09-08T12:05:20-05:00');assert.equal(h.api.elapsedMs(),20000);assert.equal(h.run('timer.pausedRemaining'),70000);h.api.pauseLive();h.at('2026-09-08T12:05:30-05:00');assert.equal(h.api.elapsedMs(),30000);assert.equal(h.run('timer.endAt-Date.now()'),60000);
 assert.equal(JSON.parse(h.storage.get(L)).pausedMs,300000);
});
test('rest survives refresh, uses wall time, and expired rest remains dismissible without replaying a sound',async()=>{
 const h=await boot();h.run('startTimer(60)');h.at('2026-09-08T12:00:22-05:00');h.run('tickTimer()');assert.equal(h.node('forge-rest-time').textContent,'0:38');
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('timer.total'),60);again.at('2026-09-08T12:02:00-05:00');again.run('tickTimer()');assert.equal(again.node('forge-rest-time').textContent,'0:00');assert.equal(again.node('forge-rest').hidden,false);
 again.run('startTimer(30)');again.api.adjustRest(30);assert.equal(again.run('timer.endAt-Date.now()'),60000);again.run('stopTimer()');assert.equal(JSON.parse(again.storage.get(R)),null);
});
test('skipping and choosing exercises do not mark them done; revisiting done does not restart rest',async()=>{
 const h=await boot();h.act('live',{key:'PUSH'});h.node('forge-skip').click();assert.equal(h.run('state.live.exIdx'),1);assert.equal(h.run(`!!state.draft['PUSH-0-0']?.done`),false);
 h.api.goExercise(0);h.run(`state.draft['PUSH-0-0']={sets:[],done:true};startTimer(90)`);const end=h.run('timer.endAt');h.act('livedone');assert.equal(h.run('timer.endAt'),end);assert.equal(h.run('state.live.exIdx'),1);
});
test('cardio logs entered minutes rather than an unrecorded program default',async()=>{
 const h=await boot();h.act('live',{key:'PUSH'});h.api.goExercise(1);const field=h.node('app').querySelector('[data-act="forgemin"]');assert.equal(field.value,'');field.value='12';h.node('app').emit('input',{target:field});assert.equal(h.api.sessionItems(h.run(`dayBy('PUSH')`))['PUSH-0-1'].min,12);
 assert.equal(h.run(`!!state.draft['PUSH-0-1'].done`),false);
});
test('finishing confirms, keeps the start date across midnight, and logs only recorded data',async()=>{
 const h=await boot();h.at('2026-09-08T23:58:00-05:00');h.act('live',{key:'PUSH'});h.run('state.draft='+JSON.stringify(draft));h.at('2026-09-09T00:03:00-05:00');h.run('finishLive()');assert.equal(h.run('state.sessions.length'),0);h.clickText('Save and finish');await h.settle();
 assert.equal(h.run('state.sessions.length'),1);assert.equal(h.run('state.sessions[0].date'),'2026-09-08');assert.equal(h.run('state.sessions[0].dur'),5);assert.equal(h.run(`state.sessions[0].items['PUSH-0-0'].done`),false);assert.equal(h.run('state.live'),null);assert.equal(h.run('timer'),null);
});
test('failed session writes keep drafts and the interrupted save completes once after retry',async()=>{
 const h=await boot();h.run('state.draft='+JSON.stringify(draft));h.localStorage.blockedKey=S;await h.run(`logDay('PUSH')`);assert.equal(h.run('state.sessions.length'),0);assert.equal(h.run(`state.draft['PUSH-0-0'].note`),'Keep note');assert(h.storage.get(J));
 h.localStorage.blockedKey=null;h.clickText('Retry saving');await h.settle();assert.equal(h.run('state.sessions.length'),1);assert.equal(h.run(`state.draft['PUSH-0-0']`),undefined);assert.equal(JSON.parse(h.storage.get(J)),null);
});
test('reload recovers a partially saved session without duplicate history or erasing changed drafts',async()=>{
 const h=await boot();h.run('state.draft='+JSON.stringify(draft));h.run('saveDraft()');h.localStorage.blockedKey=D;await h.run(`logDay('PUSH')`);assert.equal(JSON.parse(h.storage.get(S)).length,1);
 const records=Object.fromEntries(h.storage);records[D]=JSON.stringify({...draft,'PULL-0-0':{sets:[],note:'Separate'}});const again=await boot({records});assert.equal(again.run('state.sessions.length'),1);assert.equal(again.run(`state.draft['PULL-0-0'].note`),'Separate');assert.equal(JSON.parse(again.storage.get(J)),null);
});
test('backup includes current drafts, active session and paused timer; restore requires confirmation',async()=>{
 const h=await boot();h.act('live',{key:'PUSH'});h.run('state.draft='+JSON.stringify(draft));h.run('startTimer(60)');h.api.pauseLive();h.run('exportData()');const saved=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(saved.version,3);assert.equal(saved.draft['PUSH-0-0'].note,'Keep note');assert(saved.live.pausedAt);assert(saved.rest.pausedRemaining);
 const target=await boot();await target.run('importData')(file(saved));assert.equal(target.run('state.live'),null);target.clickText('Restore backup');await target.settle();assert.equal(target.run(`state.draft['PUSH-0-0'].note`),'Keep note');assert(target.run('state.live.pausedAt'));
});
test('partial input stays editable and literal, while logging requires complete valid sets',async()=>{
 const h=await boot();h.run(`state.draft['PUSH-0-0']={sets:[{w:'10',r:''}]};state.openDay='PUSH';render()`);assert.equal(await h.run(`logDay('PUSH')`),false);assert.equal(h.run('state.sessions.length'),0);
 h.run(`state.draft['PUSH-0-0'].sets[0].w='" onfocus="alert(1)';render()`);const field=h.node('app').querySelector('[data-act="setw"]');assert.equal(field.getAttribute('onfocus'),null);assert.equal(field.value,'" onfocus="alert(1)');
});
test('delete Undo restores only that record and preserves later logged work',async()=>{
 const h=await boot();h.run('state.draft='+JSON.stringify(draft));await h.run(`logDay('PUSH')`);h.act('del',{idx:'0'});h.run('state.draft='+JSON.stringify(draft));await h.run(`logDay('PUSH')`);h.node('undoToast').querySelector('button').click();assert.equal(h.run('state.sessions.length'),2);
});
test('malformed backups are rejected before mutation and version 2 retains current drafts',async()=>{
 const h=await boot();assert.throws(()=>h.api.parseBackup({app:'other',sessions:[]}));assert.throws(()=>h.api.parseBackup({app:'forge',version:99,sessions:[]}));assert.throws(()=>h.api.parseBackup({sessions:[{date:'2026-02-31',type:'PUSH',items:{}}]}));assert.throws(()=>h.api.parseBackup(JSON.parse('{"sessions":[],"draft":{"__proto__":{}}}')));
 h.run('state.draft='+JSON.stringify(draft));await h.run('importData')(file({app:'forge',version:2,sessions:[]}));h.clickText('Restore backup');await h.settle();assert.equal(h.run(`state.draft['PUSH-0-0'].note`),'Keep note');
});
test('empty sessions can end without history and clearing drafts requires confirmation',async()=>{
 const h=await boot();h.act('live',{key:'PUSH'});h.run('finishLive()');h.clickText('End session');await h.settle();assert.equal(h.run('state.sessions.length'),0);assert.equal(h.run('state.live'),null);
 h.run('state.draft='+JSON.stringify(draft));h.act('clearday',{key:'PUSH'});h.clickText('Cancel');assert(h.run(`state.draft['PUSH-0-0']`));
});
test('unreadable saved bytes are preserved and can be backed up before confirmed recovery',async()=>{
 const raw='{broken json',h=await boot({records:{[S]:raw}});assert.equal(h.api.blocked,true);h.run('save()');assert.equal(h.storage.get(S),raw);h.run('exportData()');const recovery=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(recovery.records[S],raw);
 await h.run('importData')(file({app:'forge',version:3,sessions:[],draft:{},live:null,swaps:{},order:{},rest:null}));assert.equal(h.api.blocked,true);h.clickText('Restore backup');await h.settle();assert.equal(h.api.blocked,false);assert.equal(h.storage.get(S),'[]');
});
test('a late wake-lock request is released after the session ends',async()=>{
 const h=await boot();let complete,releases=0;h.context.navigator.wakeLock={request:()=>new Promise(r=>complete=r)};h.act('live',{key:'PUSH'});h.run('finishLive()');h.clickText('End session');await h.settle();
 complete({release(){releases++;return Promise.resolve();},addEventListener(){}});await h.settle();assert.equal(releases,1);assert.equal(h.run('__wakeLock'),null);
});
