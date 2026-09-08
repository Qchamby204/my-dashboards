import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../baby-brain.html',import.meta.url),'utf8');
let original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const fixture={l:'Reference',c:[{k:'guides',l:'Guides',c:[{l:'Reading',w:'A quiet activity.',q:['Which book?'],s:'0–6m',r:[['Ideas','<p>Picture books and stories.</p>']]},{l:'Music',w:'Listen together.',q:[],s:'all'}]},{k:'planning',l:'Planning',c:[{l:'Packing',w:'A checklist.',s:'6–12m',q:[]}]}]};
original=original.slice(0,original.indexOf('const TREE ='))+'const TREE='+JSON.stringify(fixture)+';\n'+original.slice(original.indexOf('const SVGNS='));
original=original.slice(0,original.indexOf('window.TTS ='));
const enhancement=readFileSync(new URL('../../shared/baby-enhancements.js',import.meta.url),'utf8');
const record=(n)=>({s:'learning',n,d:[],lk:[]});
const file=data=>({size:100,text:async()=>JSON.stringify({v:1,data})});
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');
function boot({raw=null,blocked=false,width=390}={}){
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
  const document=new Events();document.readyState='complete';document.hidden=false;document.currentScript={src:'https://example.test/shared/baby-enhancements.js'};document.documentElement=new Element('html');document.documentElement.dataset.atlasApp='baby-brain';document.head=new Element('head');document.body=new Element('body');document.activeElement=null;
  document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.getElementById=id=>ids.get(id)||null;document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  document.body.innerHTML=html.slice(html.indexOf('<body>')+6,html.indexOf('<script>',html.indexOf('<body>')));
  const storage=new Map(raw===null?[]:[['babybrain.v1',raw]]),localStorage={blocked,writeBlocked:false,getItem(k){if(this.blocked)throw Error('Blocked');return storage.get(k)??null;},setItem(k,v){if(this.blocked||this.writeBlocked)throw Error('Storage unavailable');storage.set(k,String(v));}};
  const window=new Events();window.innerWidth=width;window.innerHeight=844;window.matchMedia=q=>({matches:q.includes('max-width')?width<=700:true,addEventListener(){}});window.AtlasBabyBoot={raw,readError:blocked};window.scrollTo=()=>{};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const id='blob:'+(++serial);blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
  const context=vm.createContext({document,window,innerWidth:width,innerHeight:844,addEventListener:(...a)=>window.addEventListener(...a),performance:{now:()=>now},requestAnimationFrame:()=>++serial,cancelAnimationFrame(){},navigator:{},localStorage,Date:Clock,URL:BlobURL,Blob,console,setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  let legacyError;try{vm.runInContext(original,context);}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);const run=s=>vm.runInContext(s,context),node=id=>ids.get(id);
  return {run,node,document,window,context,api:window.BabyNavigation,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    clickText(text){const b=document.querySelectorAll('button').find(n=>n.textContent===text);assert(b,'Missing button '+text);b.click();}};
}


test('phone opens Topics and search excludes unrelated leaves while searching body text and notes',()=>{
  const h=boot();assert.equal(h.legacyError,undefined);assert.equal(h.api.mode,'list');assert.equal(h.api.findTopics().length,3);
  assert.equal(h.api.findTopics('zzzz').length,0);assert.equal(h.api.findTopics('PICTURE   stories')[0].l,'Reading');
  h.run(`STATE['guides/music']={s:'learning',n:'Friday playlist',d:[],lk:[]}`);assert.equal(h.api.findTopics('friday')[0].l,'Music');
  h.run(`renderSearch('zzzz')`);assert.match(h.node('searchRes').textContent,/No matching topics/);
  assert.equal(h.api.findTopics('','guides','0–6m').length,2);assert.equal(h.api.findTopics('','','',true).length,1);
});
test('opening a topic from the list retains query and closing restores focus',()=>{
  const h=boot();h.node('baby-find').value='Reading';h.node('baby-find').emit('input');const item=h.document.querySelector('.baby-topic');item.click();
  assert.equal(h.node('shTitle').textContent,'Reading');assert.equal(h.node('sheet').inert,false);assert.equal(h.node('notes').getAttribute('aria-label'),'Our notes and research');
  h.run('closeSheet(false)');assert.equal(h.node('sheet').inert,true);assert.equal(h.node('baby-find').value,'Reading');
  assert.equal(h.document.activeElement.dataset.topicId,'guides/reading');assert.equal(h.document.activeElement.isConnected,true);
});
test('every note input persists before pagehide and a save failure can be backed up and retried',async()=>{
  const h=boot();h.api.openTopic(h.api.findTopics('Reading')[0]);h.node('notes').value='Newest note';h.node('notes').emit('input');
  assert.equal(JSON.parse(h.storage.get('babybrain.v1'))['guides/reading'].n,'Newest note');assert.equal(h.api.dirty,false);
  h.localStorage.writeBlocked=true;h.node('notes').value='Unsaved edit';h.node('notes').emit('input');assert.equal(h.api.dirty,true);assert.match(h.node('baby-note-status').textContent,/Not saved/);
  h.run('exportNotes()');assert.equal(JSON.parse(await h.downloads.at(-1).blob.text()).data['guides/reading'].n,'Unsaved edit');
  h.localStorage.writeBlocked=false;h.clickText('Retry saving');assert.equal(h.api.dirty,false);assert.equal(JSON.parse(h.storage.get('babybrain.v1'))['guides/reading'].n,'Unsaved edit');
});
test('question controls toggle by keyboard and note text remains literal',()=>{
  const h=boot();h.api.openTopic(h.api.findTopics('Reading')[0]);const li=h.node('qlist').querySelector('li');assert.equal(li.getAttribute('role'),'checkbox');
  // Delegate the native click generated by the keyboard handler to the question list.
  li.click=()=>h.node('qlist').emit('click',{target:li});h.node('qlist').emit('keydown',{target:li,key:' '});assert.equal(li.getAttribute('aria-checked'),'true');
  h.node('notes').value='<img src=x onerror=alert(1)>';h.node('notes').emit('input');h.api.openTopic(h.api.findTopics('Reading')[0]);assert.equal(h.node('notes').value,'<img src=x onerror=alert(1)>');
});
test('web resources reject unsafe schemes and duplicates and give removal its own button',()=>{
  const h=boot();assert.equal(h.api.safeURL('javascript:alert(1)'),null);assert.equal(h.api.safeURL('data:text/html,test'),null);assert.equal(h.api.safeURL('https://user:pass@example.test'),null);assert.equal(h.api.safeURL('example.test/read'),'https://example.test/read');
  h.api.openTopic(h.api.findTopics('Reading')[0]);h.node('lkUrl').value='example.test/read';h.node('lkAdd').click();assert.equal(h.run(`STATE['guides/reading'].lk.length`),1);
  h.node('lkUrl').value='example.test/read';h.node('lkAdd').click();assert.equal(h.run(`STATE['guides/reading'].lk.length`),1);
  assert.equal(h.node('links').querySelector('a').querySelector('button'),null);h.clickText('Remove');assert.equal(h.run(`STATE['guides/reading'].lk.length`),0);
});
test('restore is validated before mutation and conflicting notes require an explicit choice',async()=>{
  const h=boot({raw:JSON.stringify({'guides/reading':record('Current'),'planning/packing':record('Keep')})});
  await h.api.restoreFile(file({'guides/reading':record('Imported'),'guides/music':record('New')}));assert.equal(h.run(`STATE['guides/reading'].n`),'Current');
  h.clickText('Keep existing notes');assert.equal(h.run(`STATE['guides/reading'].n`),'Current');assert.equal(h.run(`STATE['guides/music'].n`),'New');assert.equal(h.run(`STATE['planning/packing'].n`),'Keep');
  await h.api.restoreFile(file({'guides/reading':record('Imported')}));h.clickText('Use backup for matching topics');assert.equal(h.run(`STATE['guides/reading'].n`),'Imported');
  const before=h.run('JSON.stringify(STATE)');await h.api.restoreFile(file({'guides/reading':{n:[]}}));assert.equal(h.run('JSON.stringify(STATE)'),before);assert.equal(h.node('baby-restore'),undefined);
});
test('corrupt saved bytes remain recoverable and editing resumes only after a confirmed restore',async()=>{
  const raw='{broken json';const h=boot({raw});assert.equal(h.api.blocked,true);h.api.openTopic(h.api.findTopics('Reading')[0]);assert.equal(h.node('notes').disabled,true);h.run('save()');assert.equal(h.storage.get('babybrain.v1'),raw);
  h.run('exportNotes()');assert.equal(await h.downloads.at(-1).blob.text(),raw);
  await h.api.restoreFile(file({'guides/reading':record('Recovered')}));assert.equal(h.api.blocked,true);h.clickText('Replace with backup');assert.equal(h.api.blocked,false);assert.equal(JSON.parse(h.storage.get('babybrain.v1'))['guides/reading'].n,'Recovered');
});
test('imports reject prototype keys and unexpected files, retaining compatible unknown topic records',async()=>{
  const h=boot();assert.throws(()=>h.api.validate(JSON.parse('{"__proto__":{}}')));assert.throws(()=>h.api.validate([]));
  await h.api.restoreFile(file({'other-app':record('Unrelated')}));assert.equal(h.node('baby-restore'),undefined);
  await h.api.restoreFile(file({'guides/reading':record('Notes'),'old/topic':record('Older topic')}));h.clickText('Restore notes');assert.equal(h.run(`STATE['old/topic'].n`),'Older topic');
});
test('a later file selection wins when import reads complete out of order',async()=>{
  const h=boot();let finish;const first=h.api.restoreFile({size:10,text:()=>new Promise(r=>finish=r)});await h.api.restoreFile(file({'guides/reading':record('Latest')}));
  finish(JSON.stringify({v:1,data:{'guides/reading':record('Earlier')}}));await first;h.clickText('Restore notes');assert.equal(h.run(`STATE['guides/reading'].n`),'Latest');
});
test('desktop keeps the map available and view changes retain filters',()=>{
  const h=boot({width:1200});assert.equal(h.api.mode,'map');h.api.setMode('list');h.node('baby-find').value='packing';h.api.setMode('map');h.api.setMode('list');assert.equal(h.node('baby-find').value,'packing');
});
