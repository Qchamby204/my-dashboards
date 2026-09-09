import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../../prospecting-command-center.html',import.meta.url),'utf8');
const script=html.slice(html.indexOf('/* ================= STATE ================= */'),html.indexOf('</script>',html.indexOf('/* ================= STATE ================= */')));
const enhancement=readFileSync(new URL('../../shared/prospecting-enhancements.js',import.meta.url),'utf8');
// The original workflow runs against synthetic contacts only, without loading the embedded database.
const fixture=`
const CONTACTS=[
 {uid:'c1',name:'Alex Example',first:'Alex',title:'Project manager',co:'Example Studio',email:'alex@example.test',url:'https://www.linkedin.com/in/alex-example',src:'cold',tier:null,score:80,base:'pool',senti:'mid'},
 {uid:'c2',name:'Blair Sample',first:'Blair',title:'Owner',co:'Sample Workshop',email:'blair@example.test',url:'https://www.linkedin.com/in/blair-sample',src:'cold',tier:null,score:75,base:'pool',senti:'mid'},
 {uid:'w3',name:'Casey Demo',first:'Casey',title:'Engineer',co:'Demo Studio',email:'casey@example.test',url:'',src:'warm',tier:1,score:null,base:'replied',senti:'pos'},
 {uid:'c4',name:'Drew Peer',first:'Drew',title:'Consultant',co:'Peer Studio',email:'drew@example.test',url:'',src:'cold',tier:null,score:90,base:'messaged',senti:'mid',peer:true}
];
const BYUID=Object.fromEntries(CONTACTS.map(c=>[c.uid,c])),URLIX={},WARM=[],COLD_STAGE={},STAGE_ORDER={};
const G={avgHH:100,hhFirstYear:n=>n},EV={messaged:1,replied:2,meeting:3,won:4},GOAL={contacts:10,responses:5,meetings:2,won:1},SEASON_END=new Date(2026,11,31);
const TIERS={1:{name:'Existing contact'}},DEF_TPL={t0:'Hello {first}'},TPL_LABEL={t0:'Opener'};
const normUrl=u=>u,variantsFor=c=>[{l:'Simple',t:'Hello '+c.first}],tpl=k=>S.tpl?.[k]||DEF_TPL[k];
`;
export function boot({raw=null,readBlocked=false,writeBlocked=false,clipboard='success',contacts=null}={}){
  let now=Date.parse('2026-09-08T12:00:00Z'),id=0;const ids=new Map(),timers=new Map(),blobs=new Map(),downloads=[];
  class Events{
    constructor(){this.events=new Map();}
    addEventListener(type,fn,options){const list=this.events.get(type)||[];list.push({fn,capture:options===true||options?.capture});this.events.set(type,list);}
    emit(type,input={}){const e={target:this,...input,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;}};for(const h of [...(this.events.get(type)||[])].sort((a,b)=>Number(!!b.capture)-Number(!!a.capture))){h.fn(e);if(e.stopped)break;}return e;}
  }
  class Element extends Events{
    constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.attrs={};this.style={};this.children=[];this.classes=new Set();this.value='';this.writes=0;this.classList={contains:k=>this.classes.has(k),add:k=>this.classes.add(k),remove:k=>this.classes.delete(k)};}
    set id(v){this._id=v;ids.set(v,this);}get id(){return this._id;}
    set className(v){this.classes=new Set(v.split(/\s+/));}get className(){return [...this.classes].join(' ');}
    set textContent(v){this._text=String(v);this.replaceChildren();}get textContent(){return (this._text||'')+this.children.map(n=>n.textContent).join('');}
    set innerHTML(v){this.writes++;this._html=v;this.replaceChildren();for(const m of v.matchAll(/<(input|div|span|textarea)\b[^>]*\bid="([^"]+)"[^>]*>/g)){const n=new Element(m[1]);n.id=m[2];n.value=m[0].match(/value="([^"]*)"/)?.[1]||'';if(m[1]==='textarea')n.value=v.slice(m.index+m[0].length).split('</textarea>')[0];this.appendChild(n);}}get innerHTML(){return this._html||'';}
    get isConnected(){return this===document.body||this===document.head||!!this.parentNode?.isConnected;}
    get lastElementChild(){return this.children.at(-1)||null;}
    appendChild(n){this.children.push(n);n.parentNode=this;return n;}append(...a){a.forEach(n=>this.appendChild(n));}prepend(n){this.children.unshift(n);n.parentNode=this;}
    before(n){const p=this.parentNode;p.children.splice(p.children.indexOf(this),0,n);n.parentNode=p;}
    remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null;if(this.id)ids.delete(this.id);}
    replaceChildren(...a){this.children.forEach(n=>{n.parentNode=null;if(n.id)ids.delete(n.id);});this.children=[];this.append(...a);}
    setAttribute(k,v){this.attrs[k]=String(v);}getAttribute(k){return this.attrs[k]??null;}
    matches(s){return s.split(',').some(x=>{x=x.trim();if(x==='a[href]')return this.tagName==='A'&&!!this.href;if(x.startsWith('.'))return this.classes.has(x.slice(1));if(x.startsWith('#'))return this.id===x.slice(1);return x.toUpperCase()===this.tagName;});}
    closest(s){return this.matches(s)?this:this.parentNode?.closest(s)||null;}
    querySelectorAll(s){return this.children.flatMap(n=>[...(n.matches(s)?[n]:[]),...n.querySelectorAll(s)]);}querySelector(s){return this.querySelectorAll(s)[0]||null;}
    focus(){document.activeElement=this;}select(){this.selected=true;}blur(){document.activeElement=null;}
    click(){if(this.tagName==='A'&&this.download)downloads.push({name:this.download,blob:blobs.get(this.href)});this.emit('click');}
    showModal(){this.open=true;}close(){this.open=false;}
  }
  const document=new Events();document.readyState='complete';document.currentScript={src:'https://example.test/shared/prospecting-enhancements.js'};
  document.documentElement={dataset:{atlasApp:'prospecting-command-center'}};document.head=new Element('head');document.body=new Element('body');
  document.createElement=t=>new Element(t);document.getElementById=id=>ids.get(id)||null;document.querySelector=s=>document.body.querySelector(s);document.execCommand=()=>false;
  for(const key of ['main','tabs','subCounts','barPill','runner','tplOv','toast','impF']){const n=new Element(key==='impF'?'input':'div');n.id=key;document.body.appendChild(n);}
  for(const [key,parent] of [['runCard','runner'],['tplCard','tplOv']]){const n=new Element();n.id=key;ids.get(parent).appendChild(n);}
  const storage=new Map(raw===null?[]:[['hq_v1',raw]]),localStorage={readBlocked,writeBlocked,getItem(key){if(this.readBlocked)throw Error('Storage blocked');return storage.get(key)??null;},setItem(key,value){if(this.writeBlocked)throw Error('Storage full');storage.set(key,String(value));}};
  const window=new Events();window.scrollY=0;window.scrollTo=()=>{};window.open=()=>{throw Error('Tests must not open or send anything');};window.AtlasProspectingBoot={raw,readError:readBlocked};
  const navigator={clipboard:clipboard==='missing'?undefined:{writeText:async text=>{if(clipboard==='denied')throw Error('Denied');navigator.copied=text;}}};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const key='blob:test-'+(++id);blobs.set(key,blob);return key;}static revokeObjectURL(key){blobs.delete(key);}}
  const context=vm.createContext({document,window,navigator,localStorage,Date:Clock,performance:{now:()=>now},URL:BlobURL,Blob,console,prompt:()=>null,setTimeout:fn=>{const key=++id;timers.set(key,fn);return key;},clearTimeout:key=>timers.delete(key)});
  let legacyError=null;try{vm.runInContext((contacts?fixture.replace(/const CONTACTS=\[[\s\S]*?\];/,()=> 'const CONTACTS='+JSON.stringify(contacts)+';'):fixture)+'\n'+script,context);}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);const run=code=>vm.runInContext(code,context),node=key=>ids.get(key);
  return {run,node,api:window.ProspectingImprovements,document,window,context,localStorage,storage,downloads,navigator,legacyError,
    advance(ms=400){now+=ms;},flush(){for(const [id,fn]of [...timers])if(timers.delete(id))fn();},
    clickText(parent,text){const n=parent.children.find(n=>n.tagName==='BUTTON'&&n.textContent===text);assert(n,'Missing '+text+' button');n.click();}};
}
const empty=()=>({stage:{},note:{},fu:{},aum:{},log:[],set:{target:20,replyN:10,fuDays:7,peers:false}});

test('database typing updates results without replacing the search field or main screen',()=>{
  const h=boot();h.run("nav('base');S.note.c1='Send the purple project brief'");const field=h.node('dbq'),writes=h.node('main').writes;
  field.value='purple brief';h.run("dbSearch('purple brief')");h.flush();assert.equal(h.node('dbq'),field);assert.equal(h.node('main').writes,writes);
  assert.deepEqual(Array.from(h.api.databaseMatches(),c=>c.uid),['c1']);assert.match(h.node('prospecting-result-count').textContent,/1 contacts/);
  h.run("q='drew@example.test'");assert.equal(h.api.databaseMatches()[0].uid,'c4');h.run("dbStage='won'");assert.equal(h.api.databaseMatches().length,0);
});
test('manual stages schedule follow-ups, retain chosen dates and clear closed prospects',()=>{
  const h=boot();h.run("setStage('c1','messaged')");assert.equal(h.run('S.fu.c1'),'2026-09-15');assert.equal(h.run('S.log.length'),1);
  h.run("setStage('c1','messaged')");assert.equal(h.run('S.log.length'),1);h.run("setFu('c1','2026-09-30');setStage('c1','meeting')");assert.equal(h.run('S.fu.c1'),'2026-09-30');
  h.run("setFu('c1','2026-02-30')");assert.equal(h.run('S.fu.c1'),'2026-09-30');h.run("setStage('c1','lost')");assert.equal(h.run('S.fu.c1'),'');
});
test('daily queue deduplicates replied contacts and consistently excludes peers',()=>{
  const h=boot();h.run("S.fu.w3='2026-09-08';S.fu.c4='2026-09-08'");const queue=h.api.dayQueue();assert.equal(queue.filter(c=>c.uid==='w3').length,1);assert(!queue.some(c=>c.uid==='c4'));
  h.run('S.set.peers=true');assert(h.api.dayQueue().some(c=>c.uid==='c4'));
});
test('skip ends a one-contact session without changing progress and can be undone',()=>{
  const h=boot();h.run("runOne('c1');runAct('skip')");assert.equal(h.run('rQ.length'),1);assert.equal(h.run('rI'),1);assert.equal(h.run('S.log.length'),0);assert.match(h.node('runCard').textContent,/1 skipped/);
  h.run('undoLast()');assert.equal(h.run('rI'),0);assert.equal(h.run('rQ[0].uid'),'c1');
});
test('Undo removes only its own action and preserves later notes and activity',()=>{
  const h=boot();h.run("runOne('c1');runAct('pitched');S.note.c1='A later note';logAct('c2','messaged');undoLast()");
  assert.equal(h.run('S.note.c1'),'A later note');assert.equal(h.run('S.stage.c1'),undefined);assert.equal(h.run('BYUID.c1.pitched'),undefined);assert.equal(h.run('S.log.length'),1);assert.equal(h.run('S.log[0].uid'),'c2');
  h.run("runOne('c1');runAct('sent');runOne('c2');undoLast()");assert.equal(h.run('S.stage.c1'),'messaged');assert.equal(h.run('rQ[0].uid'),'c2');
});
test('rapid double activation, held keys and focused buttons cannot advance extra prospects',()=>{
  const h=boot();h.api.startQueue('fresh');h.run("runAct('sent');runAct('sent')");assert.equal(h.run('rI'),1);h.advance();
  const held=h.document.emit('keydown',{key:'Enter',repeat:true,target:h.document.body});assert(held.prevented);assert.equal(h.run('rI'),1);
  const button=h.document.createElement('button');h.document.emit('keydown',{key:'Enter',target:button});assert.equal(h.run('rI'),1);
  h.document.emit('keydown',{key:'Enter',target:h.document.body});assert.equal(h.run('rI'),2);
});
test('copy denial never reports success or opens a window; successful copy leaves progress alone',async()=>{
  const h=boot({clipboard:'denied'});h.run("runOne('c1')");await h.run('runCopy()');assert.match(h.node('toast').textContent,/Copy was unavailable/);assert(h.node('runMsg').selected);assert.equal(h.run('S.log.length'),0);
  const good=boot();good.run("runOne('c1')");good.node('runMsg').value='A custom message';await good.run('runCopy()');assert.equal(good.navigator.copied,'A custom message');assert.match(good.node('toast').textContent,/Message copied/);assert.equal(good.run('S.log.length'),0);
});
test('failed writes keep current progress available for export and successful retry',async()=>{
  const h=boot();h.localStorage.writeBlocked=true;h.run("setNote('c1','Keep this unsaved note')");assert(h.api.unsaved);assert.equal(h.node('prospecting-save-notice').hidden,false);
  h.run('exportBackup()');const out=JSON.parse(await h.downloads[0].blob.text());assert.equal(out.state.note.c1,'Keep this unsaved note');
  h.localStorage.writeBlocked=false;h.run('save()');assert(!h.api.unsaved);assert.equal(JSON.parse(h.storage.get('hq_v1')).note.c1,'Keep this unsaved note');
});
test('malformed saved data is preserved and editing paused, including legacy boot overwrite',async()=>{
  const h=boot({raw:'{broken json'});assert(h.api.blocked);assert.equal(h.storage.get('hq_v1'),'{broken json');assert(h.node('main').inert);
  h.run("setStage('c1','messaged');exportBackup()");assert.equal(h.storage.get('hq_v1'),'{broken json');assert.equal(await h.downloads[0].blob.text(),'{broken json');
  const blocked=boot({readBlocked:true});assert(blocked.legacyError);assert(blocked.api.blocked);blocked.localStorage.readBlocked=false;blocked.clickText(blocked.node('prospecting-save-notice'),'Retry loading');assert(!blocked.api.blocked);assert(blocked.storage.has('hq_v1'));
});
test('backup restore validates before mutation and requires the explicit restore action',async()=>{
  const h=boot();h.run("S.note.c1='Current note';save()");const before=h.storage.get('hq_v1');
  assert.throws(()=>h.api.validateBackup({app:'other',version:1,state:empty()}));assert.throws(()=>h.api.validateBackup({app:'chambers-hq',version:1,state:{...empty(),fu:{c1:'2026-02-30'}}}));
  assert.throws(()=>h.api.validateState(JSON.parse('{"stage":{"__proto__":"pool"}}')));
  const next=empty();next.note.c1='Restored note';h.context.upload={value:'chosen',files:[{size:300,text:async()=>JSON.stringify({app:'chambers-hq',version:1,state:next})}]};
  await h.run('importBackup(upload)');assert.equal(h.storage.get('hq_v1'),before);assert(h.node('prospecting-restore').open);
  h.clickText(h.node('prospecting-restore'),'Restore backup');assert.equal(h.run('S.note.c1'),'Restored note');assert.equal(h.node('prospecting-restore').open,false);
});
test('CSV quotes formulas as text and preserves multiline notes',async()=>{
  const h=boot();assert.equal(h.api.csvCell('=2+2'),'"\'=2+2"');assert.equal(h.api.csvCell(' \t@SUM(A1)'),'"\' \t@SUM(A1)"');assert.equal(h.api.csvCell('A "quote"\nNext line'),'"A ""quote""\nNext line"');
  h.run("S.note.c1='=2+2';exportCSV()");const csv=await h.downloads[0].blob.text();assert(csv.includes('"\'=2+2"'));assert(csv.includes('\r\n'));
});

const linkedInContact=(overrides={})=>({uid:'li-'+('a'.repeat(24)),url:'https://www.linkedin.com/in/alex-example',name:'Alex Updated',first:'Alex',title:'Studio director',co:'Updated Studio',email:'',connectedOn:'2026-09-04',inboundCount:2,outboundCount:3,lastInboundAt:'2026-09-06T10:00:00Z',lastOutboundAt:'2026-09-05T10:00:00Z',...overrides});
const linkedInUpdate=(contacts=[linkedInContact()])=>({app:'chambers-hq-linkedin',version:1,exportedOn:'2026-09-09',contacts});
async function previewImport(h,data){await h.api.importLinkedIn({value:'chosen',files:[{size:1000,text:async()=>JSON.stringify(data)}]});}
async function applyImport(h,data){await previewImport(h,data);assert(h.node('prospecting-linkedin-import').open);h.clickText(h.node('prospecting-linkedin-import'),'Apply update');}

test('LinkedIn import updates exact profile matches and adds stable IDs while preserving manual work',async()=>{
  const h=boot();h.run("BYUID.c1.pitched=true;S.stage.c1='won';S.note.c1='Keep my note';S.fu.c1='2026-09-30';S.aum.c1=321;logAct('c1','won');save()");
  const before=JSON.parse(h.storage.get('hq_v1'));
  const newcomer=linkedInContact({uid:'li-'+('b'.repeat(24)),url:'https://www.linkedin.com/in/new-example',name:'New Example',first:'New'});
  await previewImport(h,linkedInUpdate([linkedInContact({url:'http://ca.linkedin.com/in/Alex-Example/?trk=test'}),newcomer]));
  assert.equal(h.run('CONTACTS.length'),4);assert.equal(h.storage.get('hq_v1'),JSON.stringify(before));
  h.clickText(h.node('prospecting-linkedin-import'),'Apply update');
  assert.equal(h.run('CONTACTS.length'),5);assert.equal(h.run('BYUID.c1.name'),'Alex Updated');assert.equal(h.run('BYUID.c1.email'),'alex@example.test');
  const after=JSON.parse(h.storage.get('hq_v1'));for(const k of Object.keys(before))assert.deepEqual(after[k],before[k]);
  assert.equal(h.run('stg(BYUID.c1)'),'won');assert.equal(h.run("BYUID['"+newcomer.uid+"'].base"),'pool');
  assert.equal(h.run('S.log.length'),1);assert.equal(h.run('BYUID.c1.linkedin.inboundCount'),2);assert.equal(h.run('BYUID.c1.pitched'),true);
});
test('LinkedIn re-import is idempotent, reload retains records, and backups include the update',async()=>{
  const h=boot(),data=linkedInUpdate();await applyImport(h,data);const raw=h.storage.get('hq_v1');
  await previewImport(h,data);assert.equal(h.storage.get('hq_v1'),raw);assert.match(h.node('toast').textContent,/already saved/);
  const again=boot({raw});assert.equal(again.run('BYUID.c1.name'),'Alex Updated');assert.equal(again.run('CONTACTS.length'),4);
  again.run('exportBackup()');const backup=JSON.parse(await again.downloads[0].blob.text());assert.equal(backup.state.linkedin.contacts[0].inboundCount,2);
  const fresh=boot();fresh.context.backup={files:[{size:2000,text:async()=>JSON.stringify(backup)}]};await fresh.run('importBackup(backup)');fresh.clickText(fresh.node('prospecting-restore'),'Restore backup');assert.equal(fresh.run('BYUID.c1.name'),'Alex Updated');
});
test('a failed LinkedIn storage write leaves the live roster and saved progress intact',async()=>{
  const h=boot(),before=h.storage.get('hq_v1');await previewImport(h,linkedInUpdate());h.localStorage.writeBlocked=true;
  h.clickText(h.node('prospecting-linkedin-import'),'Apply update');assert.equal(h.storage.get('hq_v1'),before);assert.equal(h.run('BYUID.c1.name'),'Alex Example');assert(h.node('prospecting-linkedin-import').open);
  h.localStorage.writeBlocked=false;h.clickText(h.node('prospecting-linkedin-import'),'Apply update');assert.equal(h.run('BYUID.c1.name'),'Alex Updated');
});
test('an import cannot overwrite progress changed by another tab after preview',async()=>{
  const h=boot();await previewImport(h,linkedInUpdate());const newer=JSON.parse(h.storage.get('hq_v1'));newer.note.c1='Changed elsewhere';h.storage.set('hq_v1',JSON.stringify(newer));
  h.clickText(h.node('prospecting-linkedin-import'),'Apply update');assert.equal(h.run('BYUID.c1.name'),'Alex Example');assert.equal(JSON.parse(h.storage.get('hq_v1')).note.c1,'Changed elsewhere');assert(h.node('prospecting-linkedin-import').open);
});
test('LinkedIn rejects invalid URLs, duplicate identities, raw message bodies and stale exports',async()=>{
  const h=boot();for(const c of [linkedInContact({url:'javascript:alert(1)'}),linkedInContact({url:'https://linkedin.com.attacker.test/in/alex'}),linkedInContact({inboundCount:-1}),linkedInContact({content:'Do not import message bodies'}),linkedInContact({lastInboundAt:'not-a-date'})])assert.throws(()=>h.api.validateLinkedIn(linkedInUpdate([c])));
  assert.throws(()=>h.api.validateLinkedIn(linkedInUpdate([linkedInContact(),linkedInContact({uid:'li-'+('b'.repeat(24))})])));
  await applyImport(h,linkedInUpdate());assert.throws(()=>h.api.mergeLinkedIn({...linkedInUpdate(),exportedOn:'2026-09-08'}));
});
test('LinkedIn activity filters are factual and previously messaged contacts leave fresh outreach',async()=>{
  const h=boot();await applyImport(h,linkedInUpdate());assert(!h.run('freshQueue().some(c=>c.uid===\'c1\')'));assert.equal(h.run('stg(BYUID.c1)'),'pool');
  h.api.filterLinkedIn('received');assert.deepEqual(Array.from(h.api.databaseMatches(),c=>c.uid),['c1']);h.api.filterLinkedIn('sent');assert.equal(h.api.databaseMatches().length,0);h.api.clearFilters();assert(h.api.databaseMatches().length>1);
  const row=h.run('rowHTML(BYUID.c1,true)');assert.match(row,/Last message received/);assert.match(row,/aria-label="LinkedIn activity details"/);
});
test('LinkedIn updates preserve duplicate original IDs and do not infer identity from a shared name',()=>{
  const contacts=[{uid:'c1',name:'Same Name',url:'https://www.linkedin.com/in/alex-example'},{uid:'c2',name:'Same Name',url:'https://ca.linkedin.com/in/alex-example/?trk=old'},{uid:'c3',name:'Same Name',url:'https://www.linkedin.com/in/someone-else'}].map(c=>({...c,first:'Same',title:'',co:'',email:'',src:'cold',tier:null,score:40,base:'pool'}));
  const h=boot({contacts}),overlaid=h.api.overlayContacts(h.api.validateLinkedIn(linkedInUpdate()));assert.equal(overlaid.length,3);assert.equal(overlaid[0].uid,'c1');assert.equal(overlaid[1].uid,'c2');assert.equal(overlaid[1].name,'Alex Updated');assert.equal(overlaid[2].name,'Same Name');
});
