import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../the-aqueduct.html',import.meta.url),'utf8');
const original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const records=readFileSync(new URL('../../shared/aqueduct-records.js',import.meta.url),'utf8');
const enhancement=readFileSync(new URL('../../shared/aqueduct-enhancements.js',import.meta.url),'utf8');
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
    after(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this)+1,0,n);n.parentNode=p;}
    removeAttribute(k){delete this.attrs[k];}
    setSelectionRange(a,b){this.selectionStart=a;this.selectionEnd=b;}
    showModal(){this.open=true;}close(){this.open=false;this.emit('close');}
    setAttribute(k,v){this.attrs[k]=String(v);if(k==='id')this.id=v;if(k==='class')this.className=v;if(k==='value')this.value=decode(v);if(k==='hidden')this.hidden=true;if(k==='disabled')this.disabled=true;if(k.startsWith('data-'))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=v;}
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
    click(){if(this.tagName==='A'&&this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});if(!this.disabled){this.emit('click');this.onclick?.();}}
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
  const document=new Events();document.readyState='complete';document.hidden=false;document.documentElement={dataset:{atlasApp:'the-aqueduct'}};document.head=new Element('head');document.body=new Element('body');document.activeElement=null;
  document.createElement=tag=>new Element(tag);document.getElementById=id=>document.body.querySelector('#'+id);document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  document.body.innerHTML=html.slice(html.indexOf('<body>')+6,html.indexOf('<script>',html.indexOf('<body>')));
  const storage=new Map(raw===null?[]:[['aqueduct:v2',raw]]),localStorage={blocked,writeBlocked:false,getItem(k){if(this.blocked)throw Error('Blocked');return storage.get(k)??null;},setItem(k,v){if(this.blocked||this.writeBlocked)throw Error('Storage unavailable');storage.set(k,String(v));}};
  const window=new Events();window.scrollTo=()=>{};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const id='blob:'+(++serial);blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
  const context=vm.createContext({document,window,navigator:{},location:{reload(){}},localStorage,Date:Clock,URL:BlobURL,Blob,console,setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id)});
  let legacyError;try{vm.runInContext(records,context);vm.runInContext(original,context);}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);const run=s=>vm.runInContext(s,context),node=id=>document.getElementById(id);
  return {run,node,document,window,context,api:window.AqueductUI,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    undo(){const t=node('toast');assert(t);t.querySelector('button').click();}};
}

const file=pack=>({size:100,text:async()=>JSON.stringify(pack)});
function setup(h,tab='book'){h.run(`S.aum=1000000;S.book.startAUM=1000000;S.book.startDate='2026-01-01';S.tab='${tab}';save();render()`);}
function input(h,id,value){const n=h.node(id);assert(n,'Missing '+id);n.value=value;n.oninput?.();n.emit('input');}
function select(h,id,value){const n=h.node(id);assert(n,'Missing '+id);n.value=value;n.onchange?.();}
function confirm(h){const dialog=h.document.querySelector('dialog');assert(dialog,'Expected confirmation');dialog.querySelectorAll('button').at(-1).click();}
test('original Aqueduct boots with validated storage and all six views remain available',()=>{
  const h=boot();assert.ifError(h.legacyError);assert(h.api);assert.match(h.node('aqueduct-status').textContent,/Saved on this device/);
  for(const tab of ['book','pay','plan','goals','wealth','review']){setup(h,tab);assert(h.node('app').innerHTML.length>500);}
});
test('household drafts survive source changes, tab changes and reload without a log entry',()=>{
  const h=boot();setup(h);input(h,'hhAmt','125,000');input(h,'hhDate','2026-08-31');h.node('segRef').click();
  assert.equal(h.node('hhAmt').value,'125,000');assert.equal(h.node('hhDate').value,'2026-08-31');assert.equal(h.run('S.hhs.length'),0);
  h.run("S.tab='pay';render();S.tab='book';render()");assert.equal(h.node('hhAmt').value,'125,000');
  const reload=boot({raw:h.storage.get('aqueduct:v2')});assert.ifError(reload.legacyError);assert.equal(reload.node('hhAmt').value,'125,000');assert.equal(reload.run('draftType'),'ref');reload.node('hhAdd').click();
  assert.equal(reload.run('S.hhs.length'),1);assert.equal(reload.run('S.hhs[0].amt'),125000);assert.equal(reload.node('hhAmt').value,'');reload.node('hhAdd').click();assert.equal(reload.run('S.hhs.length'),1);
});
test('date-only statements retain local month boundaries and malformed dates stay undated',()=>{
  const h=boot();const result=h.run(`parseStatement('Date,Description,Debit,Credit\n2026-09-01,"Shop, \\""quoted\\""",12.50,\n2026-08-31,Earlier,20,\n2026-02-30,Bad date,3,')`.replaceAll('\n','\\n'));
  assert.equal(result.txns[0].d,'2026-09-01');assert.equal(result.txns[1].ym,'2026-08');assert.equal(result.txns[2].ym,'?');
});
test('statement review retains more than 400 transactions, scopes months and pages through all matches',()=>{
  const h=boot();setup(h,'review');const csv='Date,Description,Debit,Credit\n'+Array.from({length:451},(_,i)=>`2026-09-01,Merchant ${i},1,`).join('\n')+'\n2026-08-31,Earlier month,100,\ninvalid,Undated row,30,';
  assert(h.api.analyze(csv));assert.equal(h.run('S.audit.txns.length'),453);assert.equal(h.api.monthRows().length,451);assert.equal(h.document.querySelectorAll('[data-aq-tx]').length,50);
  select(h,'aq-month','2026-08');assert.equal(h.api.monthRows().length,1);assert.equal(h.api.monthRows()[0].amt,100);
  select(h,'aq-month','2026-09');h.node('aq-next').click();assert.match(h.node('app').innerHTML,/Merchant 50/);assert(!h.node('app').innerHTML.includes('<strong>Merchant 0</strong>'));
  input(h,'aq-search','Merchant 450');assert.equal(h.document.querySelectorAll('[data-aq-tx]').length,1);const category=h.document.querySelector('[data-aq-tx]');category.value='income';category.onchange();assert.equal(h.api.matchingRows()[0].b,'income');
  select(h,'aq-month','?');input(h,'aq-search','');assert.equal(h.api.monthRows()[0].desc,'Undated row');assert(h.run('S.audit.txns.length')===453);
});
test('statement drafts reload and failed saves expose current work in a complete backup',async()=>{
  const h=boot();setup(h,'review');input(h,'audText','Unfinished CSV');const reload=boot({raw:h.storage.get('aqueduct:v2')});assert.equal(reload.node('audText').value,'Unfinished CSV');
  h.localStorage.writeBlocked=true;input(h,'audText','Keep this unsaved text');assert(h.window.AqueductRecords.unsaved);assert.match(h.node('aqueduct-status').textContent,/have not saved/);h.api.backup();
  const pack=JSON.parse(await h.downloads[0].blob.text());assert.equal(pack.state._drafts.statement,'Keep this unsaved text');assert.equal(h.api.parseBackup(pack)._drafts.statement,'Keep this unsaved text');h.localStorage.writeBlocked=false;assert(h.run('save()'));assert(!h.window.AqueductRecords.unsaved);
});
test('deletion Undo restores one row and keeps later additions and edits',()=>{
  const h=boot();h.run("S.expenses=[{id:'one',name:'First',amt:10,freq:'monthly',cat:'Other'},{id:'two',name:'Second',amt:20,freq:'monthly',cat:'Other'}]");
  h.api.removeRecord('expenses','one','Expense');h.run("S.expenses[0].amt=99;S.expenses.push({id:'three',name:'Third',amt:30,freq:'monthly',cat:'Other'});save()");h.undo();assert.equal(h.run('S.expenses.length'),3);assert.equal(h.run("S.expenses.find(x=>x.id==='two').amt"),99);
});
test('clearing the household ledger requires confirmation and Undo keeps newer entries',()=>{
  const h=boot();setup(h);h.run("S.hhs=[{id:'old',amt:1,d:'2026-09-01',type:'ext'}]");h.api.clearHouseholds();assert.equal(h.run('S.hhs.length'),1);confirm(h);assert.equal(h.run('S.hhs.length'),0);h.run("S.hhs.push({id:'new',amt:2,d:'2026-09-02',type:'ext'})");h.undo();assert.equal(h.run('S.hhs.length'),2);
});
test('malformed saved bytes are not replaced by defaults and a confirmed valid backup repairs them',async()=>{
  const valid=boot().api.payload(),raw='{broken';const h=boot({raw});assert(h.window.AqueductRecords.blocked);assert.equal(h.storage.get('aqueduct:v2'),raw);assert.equal(h.node('app').innerHTML,'');h.api.backup();assert.equal(JSON.parse(await h.downloads[0].blob.text()).records['aqueduct:v2'],raw);
  await h.api.importBackup(file(valid));assert.equal(h.storage.get('aqueduct:v2'),raw);confirm(h);assert(!h.window.AqueductRecords.blocked);assert.match(h.node('aqueduct-status').textContent,/Saved on this device/);
});
test('invalid backups and failed restores preserve current state',async()=>{
  const h=boot();const pack=h.api.payload();pack.state.expenses[0].id='bad"id';assert.throws(()=>h.api.parseBackup(pack),/ID/);
  const safe=h.api.payload();safe.state.expenses[0].name='Restored name';await h.api.importBackup(file(safe));h.localStorage.writeBlocked=true;confirm(h);assert.notEqual(h.run('S.expenses[0].name'),'Restored name');
  assert.throws(()=>h.api.parseBackup(JSON.parse('{"app":"the-aqueduct","version":1,"state":{"__proto__":{}}}')),/record key/);
});
test('a newer file selection supersedes a slow read and another tab cannot silently overwrite saved data',async()=>{
  const h=boot();setup(h,'review');let finish;const old=h.api.importStatement({size:100,text:()=>new Promise(resolve=>finish=resolve)});
  await h.api.importStatement({size:100,text:async()=> 'Date,Description,Debit\n2026-09-01,Newest,15'});finish('Date,Description,Debit\n2026-09-01,Old,20');await old;assert.equal(h.run('S.audit.txns[0].desc'),'Newest');
  const other=JSON.parse(h.storage.get('aqueduct:v2'));other.aum=999;h.storage.set('aqueduct:v2',JSON.stringify(other));h.run('S.aum=888;save()');assert(h.window.AqueductRecords.unsaved);assert.equal(JSON.parse(h.storage.get('aqueduct:v2')).aum,999);
});

test('backup text stays literal and non-finite money input cannot corrupt saved JSON',()=>{
  const h=boot();assert.equal(h.run('toNum('+JSON.stringify('9'.repeat(400))+')'),'');
  assert.equal(h.run('guessEmoji({emoji:'+JSON.stringify('<img src=x onerror=alert(1)>')+'})'),'&lt;img src=x onerror=alert(1)&gt;');
});
