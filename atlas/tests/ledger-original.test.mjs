import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../life-ledger.html',import.meta.url),'utf8');
let original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const fullOriginal=original.slice(0,original.indexOf('var SEED_METRICS='))+'var SEED_METRICS=[];\n'+original.slice(original.indexOf('var state={days:'));
// Exercise the original controls with generic reading / creative-work fixtures.
const habits={Read:{unit:'pages',kind:'qty',step:1,def:1,goal:100,chunk:10,noun:'book',outcome:'Recorded reading',crit:''},Make:{unit:'entries',kind:'count',step:1,def:1,goal:20,chunk:1,noun:'entry',outcome:'Recorded work',crit:''}};
const pillars=[{key:'GROWTH',title:'Learning',sub:'',color:'#5075aa',glow:'#5075aa',deep:'#5075aa',icon:'book',habits:['Read']},{key:'CONNECTION',title:'Making',sub:'',color:'#5075aa',glow:'#5075aa',deep:'#5075aa',icon:'book',habits:['Make']}];
original=original.slice(0,original.indexOf('var DEFAULT_HCFG'))+'var DEFAULT_HCFG='+JSON.stringify(habits)+';var DEFAULT_HABITS=["Read","Make"];var DEFAULT_PILLARS='+JSON.stringify(pillars)+';var DEFAULT_SHORT={};\n'+original.slice(original.indexOf('var HCFG, HABITS'));
original=original.slice(0,original.indexOf('var ACHV='))+'var ACHV=[];\n'+original.slice(original.indexOf('function iconSVG('));
original=original.slice(0,original.indexOf('var SEED_METRICS='))+'var SEED_METRICS=[];\n'+original.slice(original.indexOf('var state={days:'));
const enhancement=readFileSync(new URL('../../shared/ledger-enhancements.js',import.meta.url),'utf8');
const S='lifeledger:v2',D='lifeledger:drafts:v1',C='lifeledger:season:v1';
const file=o=>({size:100,text:async()=>JSON.stringify(o)});
const decode=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&');

test('saving from a stale tab preserves another window’s unrelated saved date',async()=>{
 const base=[{date:'2026-09-05',units:{Read:1}}],h=await boot({records:{[S]:JSON.stringify(base)}});
 h.storage.set(S,JSON.stringify([...base,{date:'2026-09-06',units:{Read:9}}]));h.run('state.draft.Read=4');await h.api.saveDay();
 assert.equal(JSON.parse(h.storage.get(S)).length,3);assert.equal(h.run('state.days.find(d=>d.date==="2026-09-06").units.Read'),9);
});
test('competing edits to the same day keep remote history and the local draft',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-07',units:{Read:1}}])}});
 h.storage.set(S,JSON.stringify([{date:'2026-09-07',units:{Read:9}}]));h.run('state.draft.Read=4');await h.api.saveDay();
 assert.equal(JSON.parse(h.storage.get(S))[0].units.Read,9);assert.equal(h.run('state.draft.Read'),4);assert.equal(h.node('ledger-notice').hidden,false);assert.match(h.node('ledger-notice').textContent,/Another window/);
});
test('hidden habit history retains its Life and value XP',async()=>{
 const h=await boot({realModel:true,records:{[S]:JSON.stringify([{date:'2026-09-07',units:{Read:250}}])}}),before=h.run('compute(state.days,state.goals)');
 h.run('userModel.hidden.Read=true;rebuildModel();render()');const after=h.run('compute(state.days,state.goals)');
 assert.equal(after.life.xp,before.life.xp);assert.equal(after.pillars.find(p=>p.key==='GROWTH').xp,before.pillars.find(p=>p.key==='GROWTH').xp);
});
test('the saved List preference survives reopening while new records start in Cards',async()=>{
 const h=await boot({records:{[D]:JSON.stringify({days:{},selected:'2026-09-07',mode:'list'})}});
 assert.equal(h.run('state.logMode'),'list');assert.equal((await boot()).run('state.logMode'),'cards');
});
test('independent draft dates merge and competing current drafts require review',async()=>{
 const initial={days:{},selected:'2026-09-07',mode:'cards'},h=await boot({records:{[D]:JSON.stringify(initial)}});
 h.storage.set(D,JSON.stringify({...initial,days:{'2026-09-06':{units:{Read:9}}}}));h.run('state.draft.Read=4');h.api.remember();
 assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-06'].units.Read,9);
 assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-07'].units.Read,4);
 const remote=JSON.parse(h.storage.get(D));remote.days['2026-09-07'].units.Read=8;h.storage.set(D,JSON.stringify(remote));h.run('state.draft.Read=5');await h.api.saveDay();
 assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-07'].units.Read,8);assert.equal(h.run('state.draft.Read'),5);assert.equal(h.run('state.days.length'),0);
});
test('reset archives the latest history from another window before clearing it',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-05',units:{Read:1}}])}});
 h.storage.set(S,JSON.stringify([{date:'2026-09-05',units:{Read:2}},{date:'2026-09-06',units:{Read:3}}]));await h.api.resetProgress();
 assert.equal(JSON.parse(h.storage.get(S)).length,0);assert.equal(h.api.drafts.archives[0].days.length,2);assert.equal(h.api.drafts.archives[0].days[0].units.Read,2);
});
test('verified Web Lock drafts do not queue unchanged writes on page close',async()=>{
 const h=await boot();h.context.navigator.locks={request:async(name,fn)=>fn()};h.run('state.draft.Read=4');h.api.remember();await h.settle();
 assert.equal(h.window.emit('beforeunload').prevented,undefined);assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-07'].units.Read,4);
});
async function boot({records={},blocked=false,width=390,realModel=false,nowISO='2026-09-07T22:49:00-05:00'}={}){
  let now=Date.parse(nowISO),serial=0;const ids=new Map(),timers=new Map(),blobs=new Map(),downloads=[];
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
    append(...a){a.forEach(n=>this.appendChild(n));}appendChild(n){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(x=>x!==n);this.children.push(n);n.parentNode=this;return n;}prepend(n){if(n.parentNode)n.parentNode.children=n.parentNode.children.filter(x=>x!==n);this.children.unshift(n);n.parentNode=this;}
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
    showModal(){this.open=true;this.setAttribute('open','');}close(){this.open=false;this.removeAttribute('open');this.emit('close');}
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
  const document=new Events();document.readyState='complete';document.hidden=false;document.visibilityState='visible';document.currentScript={src:'https://example.test/shared/ledger-enhancements.js'};document.documentElement=new Element('html');document.documentElement.dataset.atlasApp='life-ledger';document.head=new Element('head');document.body=new Element('body');document.activeElement=null;
  document.createElement=tag=>new Element(tag);document.createElementNS=(_,tag)=>new Element(tag);document.getElementById=id=>ids.get(id)||null;document.querySelector=s=>document.body.querySelector(s);document.querySelectorAll=s=>document.body.querySelectorAll(s);
  document.body.innerHTML=html.slice(html.indexOf('<body>')+6,html.indexOf('<script>',html.indexOf('<body>')));
  const storage=new Map(Object.entries(records)),localStorage={blocked,writeBlocked:false,blockedKey:null,getItem(k){if(this.blocked)throw Error('Blocked');return storage.get(k)??null;},setItem(k,v){if(this.blocked||this.writeBlocked||this.blockedKey===k)throw Error('Storage unavailable');storage.set(k,String(v));}};
  const window=new Events();window.innerWidth=width;window.innerHeight=844;window.matchMedia=q=>({matches:q.includes('max-width')?width<=700:true,addEventListener(){}});window.AtlasLedgerBoot={raw:{...records},readError:blocked};window.scrollTo=()=>{};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  class BlobURL extends URL{static createObjectURL(blob){const id='blob:'+(++serial);blobs.set(id,blob);return id;}static revokeObjectURL(id){blobs.delete(id);}}
  const context=vm.createContext({document,window,innerWidth:width,innerHeight:844,addEventListener:(...a)=>window.addEventListener(...a),performance:{now:()=>now},requestAnimationFrame:()=>++serial,cancelAnimationFrame(){},navigator:{},crypto:{randomUUID:()=> 'fixture-session-'+(++serial)},localStorage,Date:Clock,URL:BlobURL,URLSearchParams,location:{search:'',pathname:'/life-ledger.html'},history:{replaceState(){}},Blob,console,setTimeout:(fn,delay=0)=>{const id=++serial;timers.set(id,{fn,due:now+delay});return id;},clearTimeout:id=>timers.delete(id),setInterval:()=>++serial,clearInterval(){}});
  let legacyError;try{vm.runInContext(realModel?fullOriginal:original,context);for(let i=0;i<30;i++)await Promise.resolve();}catch(e){legacyError=e;}
  vm.runInContext(readFileSync(new URL('../../shared/ledger-rhythm-core.js',import.meta.url),'utf8'),context);vm.runInContext(enhancement,context);for(let i=0;i<30;i++)await Promise.resolve();const run=s=>vm.runInContext(s,context),node=id=>ids.get(id);
  return {run,node,document,window,context,api:window.LedgerDays,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    settle:async()=>{for(let i=0;i<30;i++)await Promise.resolve();},act(action,extra={}){const el=document.createElement('button');el.dataset={act:action,...extra};return node('app').emit('click',{target:el});},
    clickText(text){const scope=document.querySelectorAll('dialog[open]').at(-1)||document;const b=scope.querySelectorAll('button').find(n=>n.textContent===text);assert(b,'Missing button '+text);b.click();}};
}

test('ongoing totals include earlier history without rewriting saved bytes',async()=>{
 const rows=[{date:'2026-09-07',units:{Read:8},note:'Earlier note'},{date:'2026-09-08',units:{Read:2}}],h=await boot({records:{[S]:JSON.stringify(rows)}});
 assert.equal(h.legacyError,undefined);assert.equal(h.api.blocked,false);assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),8);assert.equal(h.storage.get(S),JSON.stringify(rows));
 h.at('2026-09-08T00:01:00-05:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),10);assert.equal(h.run('compute(state.days,state.goals).expectedLevel'),0);assert.equal(h.node('ledger-season-summary'),undefined);
});
test('archived season settings survive but no longer reset lasting totals',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-07',units:{Read:4}}])}});assert(await h.api.setSeason({start:'2026-09-10',end:'2026-12-31'}));
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.api.season.start,'2026-09-10');assert.equal(again.run('compute(state.days,state.goals).habit.Read.total'),4);assert.equal(again.node('app').querySelector('[data-act="reset"]'),null);
});
test('year-end does not stop progress and future entries stay excluded',async()=>{
 const rows=[{date:'2026-09-08',units:{Read:2}},{date:'2026-12-31',units:{Read:3}},{date:'2027-01-01',units:{Read:5}}],h=await boot({records:{[S]:JSON.stringify(rows)}});
 h.at('2026-12-31T23:30:00-06:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),5);h.at('2027-01-01T00:01:00-06:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),10);
});
test('draft values and notes survive date switching and refresh without being logged',async()=>{
 const h=await boot();h.run(`state.draft.Read=7;state.draftNote='Unfinished';state.draftMood=3;`);h.api.remember();h.api.selectDate('2026-09-06');assert.equal(h.run('state.draft.Read'),0);h.run(`state.draftNote='Separate'`);h.api.remember();h.api.selectDate('2026-09-07');assert.equal(h.run('state.draftNote'),'Unfinished');
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('state.draft.Read'),7);assert.equal(again.run('state.draftNote'),'Unfinished');assert.equal(again.run('state.days.length'),0);assert.equal(again.api.drafts.days['2026-09-06'].note,'Separate');
});
test('saving a day preserves hidden and unknown habit entries and updates the same date',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-07',units:{Read:2,Archived:8},note:'Old'}])}});h.run(`state.draft.Read=4;state.draftNote='New'`);await h.api.saveDay();assert.equal(h.run('state.days.length'),1);assert.equal(h.run('state.days[0].units.Archived'),8);assert.equal(h.run('state.days[0].units.Read'),4);assert.equal(h.run('state.days[0].note'),'New');assert.equal(h.api.drafts.days['2026-09-07'],undefined);
 h.run('state.draft.Read=5');await h.api.saveDay();assert.equal(h.run('state.days.length'),1);assert.equal(JSON.parse(h.storage.get(S))[0].units.Read,5);
});
test('failed day saves keep drafts and never claim a successful logged day',async()=>{
 const h=await boot();h.run('state.draft.Read=4');h.localStorage.blockedKey=S;await h.api.saveDay();assert.equal(h.run('state.days.length'),0);assert.equal(h.run('state.draft.Read'),4);assert.equal(h.api.failed,1);assert.equal(h.node('ledger-notice').hidden,false);
 h.localStorage.blockedKey=null;await h.api.retry();await h.api.saveDay();assert.equal(h.run('state.days.length'),1);assert.equal(JSON.parse(h.storage.get(S))[0].units.Read,4);assert.equal(h.api.failed,0);
});
test('Undo affects only the saved date and retains later unrelated work',async()=>{
 const h=await boot();h.run('state.draft.Read=4');await h.api.saveDay();h.run(`state.days.push({date:'2026-09-06',units:{Make:1},note:'Keep me'});`);await h.run('undoLast()');assert.equal(h.run('state.days.length'),1);assert.equal(h.run('state.days[0].note'),'Keep me');
});
test('backups include season and unfinished entries, and restore requires confirmation',async()=>{
 const h=await boot();h.run(`state.draftNote='Unfinished note';state.draft.Read=2`);h.run('exportData()');const pack=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(pack.version,3);assert.equal(pack.season.start,'2026-09-08');assert.equal(pack.drafts.days['2026-09-07'].note,'Unfinished note');
 const target=await boot();await target.run('importData')(file(pack));assert.equal(target.run('state.draftNote'),'');target.clickText('Restore backup');await target.settle();assert.equal(target.run('state.draftNote'),'Unfinished note');assert.equal(target.api.blocked,false);assert.equal(target.run('state.days.length'),0);
});
test('older backups preserve new season and current drafts; invalid files do not replace data',async()=>{
 const h=await boot();h.run(`state.draftNote='Keep draft'`);h.api.remember();await h.run('importData')(file({app:'life-ledger',version:2,days:[{date:'2026-09-06',units:{Read:3}}]}));h.clickText('Restore backup');await h.settle();assert.equal(h.api.season.start,'2026-09-08');assert.equal(h.run('state.draftNote'),'Keep draft');
 assert.throws(()=>h.api.parseBackup({app:'wrong',days:[]}));assert.throws(()=>h.api.parseBackup({days:[{date:'2026-02-30',units:{}}]}));assert.throws(()=>h.api.parseBackup({days:[{date:'2026-09-07',units:{Read:-1}}]}));assert.throws(()=>h.api.parseBackup({days:[],season:{start:'2026-10-01',end:'2026-09-01'}}));assert.throws(()=>h.api.parseBackup(JSON.parse('{"days":[],"model":{"__proto__":{}}}')));
});
test('clear and reset controls confirm first; corrupt original bytes remain recoverable',async()=>{
 const h=await boot();h.run('state.draft.Read=5');h.act('clear');assert.equal(h.run('state.draft.Read'),5);h.clickText('Clear draft');await h.settle();assert.equal(h.run('state.draft.Read'),0);h.act('reset');assert.equal(h.document.querySelector('dialog[open]'),null);assert.equal(h.api.season.start,'2026-09-08');
 const broken=await boot({records:{[S]:'[broken'}});assert.equal(broken.api.blocked,true);broken.run('exportData()');const recovery=JSON.parse(await broken.downloads.at(-1).blob.text());assert.equal(recovery.records[S],'[broken');assert.equal(broken.storage.get(S),'[broken');
});
test('empty pillars remain numeric and streaks require adjacent calendar dates',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-08',units:{Read:1}},{date:'2026-09-10',units:{Read:1}}])}});h.at('2026-09-10T12:00:00-05:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.streak'),1);
 h.run(`userModel.hidden={Read:true,Make:true};rebuildModel();`);assert.equal(h.run('compute(state.days,state.goals).life.level'),0);assert(h.run('compute(state.days,state.goals).pillars.every(p=>Number.isFinite(p.level))'));h.run('render()');
});
test('future log dates are refused; labels and card boundaries expose usable state',async()=>{
 const h=await boot();assert.equal(h.api.selectDate('2026-09-08'),false);assert.equal(h.run('state.logDate'),'2026-09-07');assert.equal(h.run('state.logMode'),'cards');assert.equal(h.node('app').querySelectorAll('.ledger-habit-card').length,2);assert.equal(h.node('app').querySelector('[data-act="toggle"][data-habit="Make"]').getAttribute('aria-label'),'Mark complete: Make');
 h.run(`state.logMode='cards';render()`);assert.equal(h.node('deckPrev').disabled,true);assert.equal(h.node('app').querySelectorAll('.ledger-habit-card')[1].inert,true);h.run('goCard(1)');assert.equal(h.node('app').querySelectorAll('.ledger-habit-card')[1].inert,false);assert.equal(h.node('deckNext').disabled,true);assert.equal(h.node('deckPrev').disabled,false);
});
test('midnight follows Today and retains the previous unfinished entry in history',async()=>{
 const h=await boot();h.run(`state.draftNote='Keep tonight'`);h.api.remember();h.at('2026-09-08T00:01:00-05:00');h.window.emit('pageshow');assert.equal(h.run('state.logDate'),'2026-09-08');assert.equal(h.run('state.draftNote'),'');assert.equal(h.api.drafts.days['2026-09-07'].note,'Keep tonight');assert.match(h.node('ledger-history').textContent,/Draft/);
});
test('custom units render literally and invalid measurement targets are rejected',async()=>{
 const h=await boot();h.run(`HCFG.Read.unit='<img src=x onerror=x>';render()`);assert.equal(h.node('app').querySelectorAll('img').length,0);assert.match(h.node('app').textContent,/<img src=x onerror=x>/);assert.equal(h.run('HCFG.Read.unit'),'<img src=x onerror=x>');
 assert.throws(()=>h.api.parseBackup({days:[],metrics:[{id:'test',name:'Test',unit:'items',readings:[],target:'<img>'}]}));
});
test('metric deletion uses the metric record and default-habit restore is functional',async()=>{
 const h=await boot();h.run(`state.metrics=[{id:'m_read',name:'Reading notes',unit:'notes',readings:[]}];userModel.renames.Read='Changed';userModel.hidden.Make=true;rebuildModel();`);h.act('delmetric',{id:'m_read'});assert.equal(h.run('state.metrics.length'),1);h.clickText('Delete metric');await h.settle();assert.equal(h.run('state.metrics.length'),0);assert.deepEqual(JSON.parse(h.storage.get('lifeledger:metrics:v1')),[]);
 h.act('restoreHabits');h.clickText('Restore habits');await h.settle();assert.equal(h.run('label("Read")'),'Read');assert.equal(h.run('HABITS.includes("Make")'),true);
});
test('reopening starts on Today and preserves historical unfinished work',async()=>{
 const h=await boot();h.api.selectDate('2026-09-05');h.run("state.draftNote='Continue this entry'");h.api.remember();
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('state.logDate'),'2026-09-07');again.api.selectDate('2026-09-05');assert.equal(again.run('state.draftNote'),'Continue this entry');assert.equal(again.run('state.days.length'),0);
});
test('Undo preserves a newer draft for the same date through date changes and reopening',async()=>{
 const h=await boot();h.run("state.draftNote='Saved version'");await h.api.saveDay();h.run("state.draftNote='New unfinished version'");h.api.remember();h.api.selectDate('2026-09-06');await h.run('undoLast()');
 assert.equal(h.run('state.days.length'),0);h.api.selectDate('2026-09-07');assert.equal(h.run('state.draftNote'),'New unfinished version');
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('state.draftNote'),'New unfinished version');
});
test('asynchronous draft saving remains pending until the latest queued write is verified',async()=>{
 const h=await boot();const writes=[];h.window.storage={set:(key,value)=>new Promise(resolve=>writes.push(()=>{h.storage.set(key,value);resolve();})),get:async key=>({value:h.storage.get(key)})};
 h.run("state.draftNote='First'");h.api.remember();await h.settle();assert.match(h.node('ledger-draft-status').textContent,/Storing draft/);
 h.run("state.draftNote='Latest'");h.api.remember();writes.shift()();await h.settle();assert.match(h.node('ledger-draft-status').textContent,/Storing draft/);
 writes.shift()();await h.settle();assert.match(h.node('ledger-draft-status').textContent,/Draft stored/);assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-07'].note,'Latest');
});

// Keep the production catalogue and five-value model for reward regressions.
test('first saved day updates all five values and queues Season Opens after durable save',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});
 assert.equal(h.legacyError,undefined);
 h.run('HABITS.forEach(k=>state.draft[k]=1)');await h.api.saveDay();
 assert.equal(h.run('compute(state.days,state.goals).pillars.filter(p=>p.exact>0).length'),5);
 assert(h.run('state.achvQueue.some(a=>a.name==="Season Opens")'));
 assert.match(h.node('app').textContent,/Achievement Unlocked|Level Up/);
});

test('lifetime levels and real amounts appear without year-end pace judgments',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('HABITS.forEach(k=>state.draft[k]=1)');await h.api.saveDay();
 assert.equal(h.node('app').querySelectorAll('[data-act="pillar"]').length,5);assert.match(h.node('app').querySelector('.ledger-lasting').textContent,/1 pages recorded overall/);
 assert.doesNotMatch(h.node('app').querySelector('.ledger-lasting').textContent,/\/99|pace|Dec 31/);assert.match(h.node('ledger-save-feedback').textContent,/progress is recorded/);
});
test('a failed or pending write earns nothing; retry verifies data before showing rewards',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=1');h.localStorage.blockedKey=S;await h.api.saveDay();
 assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.run('state.levelInfo'),null);assert.equal(h.run('state.days.length'),0);
 h.localStorage.blockedKey=null;await h.api.retry();await h.api.saveDay();assert(h.run('state.achvQueue.some(a=>a.name==="Season Opens")'));
});
test('unchanged resaves do not repeat rewards and editing only changes the affected value',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=1');await h.api.saveDay();await h.api.saveDay();
 assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.run('state.levelInfo'),null);assert.match(h.node('ledger-save-feedback').textContent,/up to date/);
 h.run('state.draft.Read=2');await h.api.saveDay();assert.equal(h.run('state.days.length'),1);assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),2);
 assert.match(h.node('ledger-save-feedback').textContent,/progress is recorded/);assert.doesNotMatch(h.node('ledger-save-feedback').textContent,/Health|Wealth|Discipline|Connection/);
});
test('prior saved entries recover earned achievements on reload without a new save',async()=>{
 const rows=[{date:'2026-09-08',units:{Read:1},note:'A reflection'}],h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00',records:{[S]:JSON.stringify(rows)}});
 assert(h.run('ACHV.find(a=>a.name==="Season Opens").test(compute(state.days,state.goals))'));
 assert(h.run('ACHV.find(a=>a.name==="First Reflection").test(compute(state.days,state.goals))'));
 assert.equal(h.storage.get(S),JSON.stringify(rows));assert.equal(h.run('state.achvQueue.length'),0);
 const earned=h.run('ACHV.filter(a=>a.test(compute(state.days,state.goals))).length');h.clickText(earned+' achievements');assert.equal(h.run('state.openSections.relics'),true);assert.equal(h.node('ledger-view-progress').hidden,false);
 assert.equal(h.node('app').querySelectorAll('[data-act="relic"][role="button"]').length,h.run('ACHV.length'));
});
test('streak award uses the longest calendar streak and survives a later gap',async()=>{
 const rows=Array.from({length:7},(_,i)=>({date:'2026-09-'+String(i+8).padStart(2,'0'),units:{Read:1}})),h=await boot({realModel:true,nowISO:'2026-09-20T19:00:00-05:00',records:{[S]:JSON.stringify(rows)}});
 assert.equal(h.run('compute(state.days,state.goals).streak.current'),0);assert(h.run('ACHV.find(a=>a.name==="Streak Keeper").test(compute(state.days,state.goals))'));
 h.run('state.days.splice(3,1)');assert.equal(h.run('ACHV.find(a=>a.name==="Streak Keeper").test(compute(state.days,state.goals))'),false);
});
test('empty configurations and empty dates do not earn blanket achievements',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-20T19:00:00-05:00'});h.run('HABITS.forEach(k=>userModel.hidden[k]=true);rebuildModel();state.days=[8,9,10].map(n=>({date:"2026-09-"+String(n).padStart(2,"0"),units:{}}))');
 for(const name of ['Perfect Day','Season Opens','Five for Five','Renaissance Soul','In Balance','Ahead of Pace'])assert.equal(h.run('ACHV.find(a=>a.name==='+JSON.stringify(name)+').test(compute(state.days,state.goals))'),false,name);
 assert.equal(h.run('ACHV.every(a=>typeof a.test(compute(state.days,state.goals))==="boolean")'),true);
});
test('reflection milestones and nonconsecutive entries use existing season history',async()=>{
 const rows=[8,10,12,14,16,18,20].map(n=>({date:'2026-09-'+String(n).padStart(2,'0'),units:{},note:'A reflection'})),h=await boot({realModel:true,nowISO:'2026-09-20T19:00:00-05:00',records:{[S]:JSON.stringify(rows)}});
 for(const name of ['First Reflection','Pages of Your Own','Finding Your Rhythm','Locked In'])assert(h.run('ACHV.find(a=>a.name==='+JSON.stringify(name)+').test(compute(state.days,state.goals))'),name);
 assert.equal(h.run('compute(state.days,state.goals).life.exact'),0);
});
test('Undo updates totals while earned awards and archived season metadata remain',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=1');await h.api.saveDay();await h.run('undoLast()');
 assert.equal(h.run('state.days.length'),0);assert.equal(h.run('state.achvQueue.length'),0);assert(h.run('ACHV.find(a=>a.name==="Season Opens").test(compute(state.days,state.goals))'));
 h.run('state.draft.Read=1');await h.api.saveDay();await h.api.setSeason({start:'2026-09-09',end:'2026-12-31'});assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),1);
});
test('reward dialogs are named native modals and Escape returns focus to Save Day',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=1');await h.api.saveDay();
 const modal=h.node('app').querySelector('dialog.ledger-reward');assert.equal(modal.open,true);assert.equal(modal.getAttribute('aria-label'),'Season Opens');modal.emit('cancel');
 assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.node('app').querySelector('dialog.ledger-reward'),null);assert.equal(h.document.activeElement.dataset.act,'commit');
});
test('a reading milestone earns a value level and retains its achievement',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=250');await h.api.saveDay();
 assert.equal(h.run('state.levelInfo.title'),'Growth · Level 1');assert(h.run('state.achvQueue.some(a=>a.name==="First Book")'));assert.equal(h.node('app').querySelector('dialog.ledger-reward').getAttribute('aria-label'),'Growth · Level 1');
});

test('async publication of a day waits for verified storage before progress and rewards',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});let release;const gate=new Promise(resolve=>release=resolve);
 h.window.storage={get:async key=>({value:h.storage.get(key)}),set:async(key,value)=>{if(key===S)await gate;h.storage.set(key,value);}};
 h.run('state.draft.Read=1');const saving=h.api.saveDay();await h.settle();assert.equal(h.run('state.days.length'),0);assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.node('app').inert,true);
 release();await saving;assert.equal(h.run('state.days.length'),1);assert(h.run('state.achvQueue.some(a=>a.name==="Season Opens")'));assert.equal(h.node('app').inert,false);
});
test('restoring a backup clears stale popups and derives achievements from restored dates',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=1');await h.api.saveDay();
 h.context.backup=file({days:[{date:'2026-09-07',units:{Read:1}}]});await h.run('importData(backup)');h.clickText('Restore backup');await h.settle();
 assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.run('state.levelInfo'),null);assert.equal(h.run('state.days.length'),1);assert.equal(h.run('ACHV.find(a=>a.name==="Season Opens").test(compute(state.days,state.goals))'),true);
});

test('habit logging omits reflection inputs and retains saved reflections when updating a day',async()=>{
 const rows=[{date:'2026-09-07',units:{Read:2,Archived:8},mood:4,note:'A saved reflection'}],h=await boot({records:{[S]:JSON.stringify(rows)}});
 for(const mode of ['cards','list']){
  h.run(`state.logMode='${mode}';render()`);
  assert.equal(h.node('app').querySelector('[data-act="mood"]'),null);
  assert.equal(h.node('app').querySelector('[data-act="note"]'),null);
  assert.doesNotMatch(h.node('app').textContent,/Day felt|A line for the chronicle/);
 }
 assert.equal(h.storage.get(S),JSON.stringify(rows));
 h.run('state.draft.Read=5');await h.api.saveDay();
 const saved=JSON.parse(h.storage.get(S))[0];assert.equal(saved.units.Read,5);assert.equal(saved.units.Archived,8);assert.equal(saved.mood,4);assert.equal(saved.note,'A saved reflection');
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('state.days[0].mood'),4);assert.equal(again.run('state.days[0].note'),'A saved reflection');
});

// Screen Discipline uses the production day/draft/backup path and real habit model.
const screenNow='2026-09-30T09:00:00-05:00';
const screenBoot=options=>boot({realModel:true,nowISO:screenNow,...options});
const chooseScreen=(h,id,value)=>{h.node(id).value=value;h.node(id).emit('change');};
const screenDraft=h=>JSON.parse(h.storage.get(D)).days['2026-09-30'].screen;

test('Screen Discipline is optional on legacy days and opening adds no intervention records',async()=>{
 const rows=[{date:'2026-09-30',units:{Read:10,'Screen Discipline':1},note:'Keep this',mood:4}],h=await screenBoot({records:{[S]:JSON.stringify(rows)}});
 assert.equal(h.storage.get(S),JSON.stringify(rows));assert.equal(h.storage.has(D),false);
 assert.equal(h.run('state.draftScreen.guardrail'),'');assert.match(h.node('ledger-screen').textContent,/0 slips · 0 resets/);
 assert.equal(h.node('screen-guardrail').parentNode.tagName,'LABEL');assert.equal(h.node('screen-trigger'),undefined);
 for(const mode of ['cards','list']){h.run(`state.logMode='${mode}';render()`);assert.equal(h.node('app').querySelectorAll('#ledger-screen').length,1);}
 h.run(`userModel.hidden['Screen Discipline']=true;rebuildModel();render()`);assert.equal(h.node('ledger-screen'),undefined);
});

test('guardrail, one-tap slip, optional trigger and reset persist without changing habits or rewards',async()=>{
 const h=await screenBoot();chooseScreen(h,'screen-guardrail','feeds');
 assert.equal(screenDraft(h).guardrail,'feeds');h.node('screen-slip').click();
 assert.equal(screenDraft(h).slips.length,1);assert.equal(h.node('screen-slip').disabled,false);
 assert.equal(h.document.activeElement.id,'screen-recovery');chooseScreen(h,'screen-trigger','avoid');chooseScreen(h,'screen-action','read');h.node('screen-recovery').click();
 assert.deepEqual(screenDraft(h).slips[0],{trigger:'avoid',action:'read',recovered:true});
 assert.equal(h.run('state.draft["Screen Discipline"]'),0);assert.equal(h.run('state.days.length'),0);assert.equal(h.run('state.achvQueue.length'),0);
 const again=await screenBoot({records:Object.fromEntries(h.storage)});assert.equal(again.run('state.draftScreen.slips[0].recovered'),true);
 again.node('screen-unrecover').click();assert.equal(screenDraft(again).slips[0].recovered,false);again.node('screen-recovery').click();again.node('screen-slip').click();assert.equal(screenDraft(again).slips.length,2);
 again.node('screen-undo').click();assert.equal(screenDraft(again).slips.length,1);assert.equal(screenDraft(again).slips[0].recovered,true);
});

test('screen notes alone save without awarding a successful day; normal outcomes keep their milestones',async()=>{
 const h=await screenBoot();h.node('screen-slip').click();h.node('screen-recovery').click();await h.api.saveDay();
 assert.equal(h.run('state.days[0].screen.slips[0].recovered'),true);assert.equal(h.run('compute(state.days,state.goals).life.exact'),0);
 assert.equal(h.run('state.achvQueue.length'),0);assert.equal(h.run('compute(state.days,state.goals).habit["Screen Discipline"].total'),0);
 const rows=Array.from({length:29},(_,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),units:{'Screen Discipline':1}}));
 const earned=await screenBoot({records:{[S]:JSON.stringify(rows),[C]:JSON.stringify({start:'2026-09-01',end:'2026-12-31'})}});
 earned.node('screen-slip').click();earned.node('screen-recovery').click();earned.act('toggle',{habit:'Screen Discipline'});await earned.api.saveDay();
 assert.equal(earned.run('compute(state.days,state.goals).habit["Screen Discipline"].total'),30);assert(earned.run('state.achvQueue.some(a=>a.name==="Unplugged")'));
});

test('saving and undoing Screen Discipline preserve other units, notes, mood and season history',async()=>{
 const rows=[{date:'2026-09-30',units:{Read:15,Archived:4,'Screen Discipline':1},note:'Keep me',mood:3}],h=await screenBoot({records:{[S]:JSON.stringify(rows)}});
 chooseScreen(h,'screen-guardrail','work');h.node('screen-slip').click();await h.api.saveDay();
 const saved=JSON.parse(h.storage.get(S))[0];assert.deepEqual(saved.units,rows[0].units);assert.equal(saved.note,'Keep me');assert.equal(saved.mood,3);assert.equal(saved.screen.slips.length,1);
 h.node('screen-recovery').click();await h.run('undoLast()');assert.equal(h.run('state.days[0].screen'),undefined);assert.equal(h.run('state.draftScreen.slips[0].recovered'),true);
 await h.api.saveDay();await h.api.setSeason({start:'2026-10-01',end:'2026-12-31'});assert.equal(h.run('state.days[0].screen.slips.length'),1);assert.equal(h.run('compute(state.days,state.goals).habit["Screen Discipline"].total'),1);
});

test('backup round-trip retains saved and draft interventions and old backups remain valid',async()=>{
 const h=await screenBoot();chooseScreen(h,'screen-guardrail','evening');h.node('screen-slip').click();await h.api.saveDay();h.node('screen-recovery').click();
 h.run('exportData()');const pack=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(pack.days[0].screen.slips[0].recovered,false);assert.equal(pack.drafts.days['2026-09-30'].screen.slips[0].recovered,true);
 const restored=await screenBoot();await restored.run('importData')(file(pack));restored.clickText('Restore backup');await restored.settle();
 assert.equal(restored.run('state.draftScreen.slips[0].recovered'),true);assert.equal(restored.run('state.days[0].screen.slips[0].recovered'),false);
 for(const version of [1,2,3])assert.doesNotThrow(()=>h.api.parseBackup({app:'life-ledger',version,days:[{date:'2026-09-20',units:{Read:2}}]}));
});

test('malformed screen imports are rejected and corrupt original bytes remain recoverable',async()=>{
 const h=await screenBoot(),slip={trigger:'',action:'task',recovered:false};
 for(const screen of [{guardrail:'<img>',slips:[]},{guardrail:'feeds',slips:null},{guardrail:'',slips:[{...slip,recovered:'yes'}]},{guardrail:'',slips:[{...slip,action:'<script>'}]},{guardrail:'',slips:Array(101).fill(slip)}]){
  assert.throws(()=>h.api.parseBackup({days:[{date:'2026-09-30',units:{},screen}]}),/Invalid Screen Discipline/);
 }
 const raw=JSON.stringify([{date:'2026-09-30',units:{},screen:{guardrail:'invalid',slips:[]}}]),broken=await screenBoot({records:{[S]:raw}});
 assert.equal(broken.api.blocked,true);assert.equal(broken.storage.get(S),raw);broken.run('exportData()');assert.equal(JSON.parse(await broken.downloads.at(-1).blob.text()).records[S],raw);
});

test('failed draft writes keep the intervention for retry and recovery backup',async()=>{
 const h=await screenBoot();h.localStorage.blockedKey=D;h.node('screen-slip').click();assert.equal(h.api.failed,1);assert.equal(h.run('state.draftScreen.slips.length'),1);
 assert.match(h.node('ledger-draft-status').textContent,/Changes need saving/);h.run('exportData()');const pack=JSON.parse(await h.downloads.at(-1).blob.text());assert.equal(pack.drafts.days['2026-09-30'].screen.slips.length,1);
 h.localStorage.blockedKey=null;await h.api.retry();assert.equal(h.api.failed,0);assert.equal(screenDraft(h).slips.length,1);
});

test('midnight starts a fresh guardrail and retains yesterday; stale controls cannot write the wrong day',async()=>{
 const h=await screenBoot();chooseScreen(h,'screen-guardrail','work');h.node('screen-slip').click();const stale=h.node('screen-recovery');
 h.at('2026-10-01T00:01:00-05:00');stale.click();assert.equal(h.run('state.logDate'),'2026-10-01');assert.equal(h.run('state.draftScreen.guardrail'),'');assert.equal(h.run('state.draftScreen.slips.length'),0);
 assert.equal(JSON.parse(h.storage.get(D)).days['2026-09-30'].screen.slips[0].recovered,false);
 h.api.selectDate('2026-09-30');assert.equal(h.node('screen-slip'),undefined);assert.match(h.node('ledger-screen').textContent,/Phone out of reach/);
 h.api.selectDate('2026-10-01');assert.equal(h.node('screen-guardrail').value,'');
});

test('seven-day patterns combine saved days and drafts once and leave missing dates unknown',async()=>{
 const slip={trigger:'bored',action:'task',recovered:false};
 const rows=[{date:'2026-09-23',units:{},screen:{guardrail:'feeds',slips:[slip]}},{date:'2026-09-24',units:{},screen:{guardrail:'work',slips:[slip]}},{date:'2026-09-30',units:{},screen:{guardrail:'evening',slips:[slip]}}];
 const drafts={selected:'2026-09-30',mode:'list',days:{'2026-09-30':{units:{},screen:{guardrail:'feeds',slips:[{...slip,recovered:true}]}}}};
 const h=await screenBoot({records:{[S]:JSON.stringify(rows),[D]:JSON.stringify(drafts)}}),view=h.node('ledger-screen');
 assert.match(view.textContent,/Last 7 days · 2 slips · 1 reset/);assert.match(view.textContent,/2 \/ 7 days with a guardrail/);assert.match(view.textContent,/Most noted trigger: Boredom/);assert.equal(view.querySelectorAll('li').length,7);
 assert.match(view.textContent,/No notes does not mean no scrolling/);assert.doesNotMatch(view.textContent,/Sep 23/);
});


test('another slip can be noted without claiming the previous reset was completed',async()=>{
 const h=await screenBoot();h.node('screen-slip').click();chooseScreen(h,'screen-trigger','stress');h.node('screen-slip').click();
 assert.equal(screenDraft(h).slips.length,2);assert.equal(screenDraft(h).slips[0].recovered,false);assert.equal(screenDraft(h).slips[0].trigger,'stress');
 h.node('screen-recovery').click();assert.equal(screenDraft(h).slips[1].recovered,true);assert.match(h.node('ledger-screen').textContent,/2 slips · 1 reset/);
});

// Earned Leisure uses the same day/draft/backup path as Screen Discipline.
const fillLeisure=(h,n)=>h.run(`state.draft=freshDraft();HABITS.filter(k=>k!=='Screen Discipline').slice(0,${n}).forEach(k=>state.draft[k]=HCFG[k].kind==='count'?1:HCFG[k].def);render()`);

const clickLeisure=(h,text)=>{const b=h.node('ledger-leisure').querySelectorAll('button').find(b=>b.textContent===text);assert(b,'Missing leisure button '+text);b.click();};

test('screen time has a fixed daily limit without habit gating and legacy gaming stays unknown',async()=>{
 const h=await screenBoot({records:{[S]:JSON.stringify([{date:'2026-09-30',units:{},leisure:{gamingMinutes:40,readingDone:true}}])}});
 assert.equal(h.node('leisure-preview-meter').max,60);assert.equal(h.node('leisure-preview-meter').value,20);assert.match(h.node('leisure-preview-meta').textContent,/Total not confirmed/);assert.match(h.node('ledger-leisure').textContent,/Earlier gaming record: 40/);
 assert.doesNotMatch(h.node('ledger-leisure').textContent,/unlock|unearned|Reading Reset/);assert.equal(h.run('state.draft["Screen Discipline"]'),0);assert.equal(JSON.parse(h.storage.get(S))[0].leisure.gamingMinutes,40);
});

test('59 minutes confirms the outcome, exactly 60 does not, and editing totals preserves other units',async()=>{
 const h=await screenBoot();h.run('state.draft.Read=7;render()');
 for(const [value,credit]of [[59,1],[60,0],[61,0],[0,1]]){h.node('leisure-minutes').click();h.node('leisure-manual-minutes').value=String(value);h.document.querySelector('dialog.ledger-dialog form').emit('submit');assert.equal(h.run('state.draft["Screen Discipline"]'),credit);assert.equal(h.run('state.draft.Read'),7);await h.api.saveDay();assert.equal(h.run('compute(state.days,state.goals).habit["Screen Discipline"].total'),credit);}
});

test('legacy reading and gaming records round-trip without adding new penalties',async()=>{
 const rows=[{date:'2026-09-29',units:{Read:10},leisure:{gamingMinutes:50,readingDone:true}}],h=await screenBoot({records:{[S]:JSON.stringify(rows)}});h.run('exportData()');const pack=JSON.parse(await h.downloads.at(-1).blob.text());
 assert.deepEqual(pack.days.map(({day,...row})=>row),rows);const restored=await screenBoot();await restored.run('importData')(file(pack));restored.clickText('Restore backup');await restored.settle();assert.deepEqual(JSON.parse(restored.storage.get(S)).map(({day,...row})=>row),rows);
});

test('legacy leisure rules remain valid in backups while malformed screen totals are refused',async()=>{
 const h=await screenBoot();h.run('exportData()');const pack=JSON.parse(await h.downloads.at(-1).blob.text());pack.drafts.leisureRule={habits:6,gaming:30,reading:15};assert.doesNotThrow(()=>h.api.parseBackup(pack));
 for(const leisure of [{gamingMinutes:0,readingDone:false,screenMinutes:-1,screenConfirmed:true},{gamingMinutes:0,readingDone:false,screenConfirmed:true}])assert.throws(()=>h.api.parseBackup({days:[{date:'2026-09-30',units:{},leisure}]}),/Invalid screen-time/);
});

test('unearned gaming is tracked, a session crossing midnight splits by local date, and no allowance carries over',async()=>{
 const h=await screenBoot({nowISO:'2026-09-30T23:50:00-05:00'});clickLeisure(h,'Start screen-time timer');h.at('2026-10-01T00:10:00-05:00');h.window.emit('pageshow');
 assert.equal(h.run('state.logDate'),'2026-10-01');assert.match(h.node('leisure-usage').textContent,/10:00 recorded · 50:00 to the limit/);clickLeisure(h,'Stop screen-time timer');
 assert.equal(h.run('state.draftLeisure.screenMinutes'),10);assert.equal(h.api.drafts.days['2026-09-30'].leisure.screenMinutes,10);await h.api.saveDay();
 h.api.selectDate('2026-09-30');assert.equal(h.run('state.draftLeisure.screenMinutes'),10);await h.api.saveDay();assert.equal(h.run('state.days.length'),2);
});

test('manual tracking supports over-budget minutes and edits without changing any habit',async()=>{
 const h=await screenBoot();fillLeisure(h,8);await h.api.saveDay();const units=h.run('JSON.stringify(state.draft)');
 h.node('leisure-minutes').click();h.node('leisure-manual-minutes').value='55';h.document.querySelector('dialog.ledger-dialog form').emit('submit');
 assert.match(h.node('leisure-usage').textContent,/55:00 recorded · 5:00 to the limit/);assert.equal(h.run('state.draft.Read'),25);assert.equal(h.run('state.draft["Screen Discipline"]'),1);await h.api.saveDay();
 const reload=await screenBoot({records:Object.fromEntries(h.storage)});assert.equal(reload.run('state.draftLeisure.screenMinutes'),55);assert.match(reload.node('ledger-leisure').textContent,/55 min total/);
 reload.run('exportData()');const pack=JSON.parse(await reload.downloads.at(-1).blob.text());assert.equal(pack.days[0].leisure.screenMinutes,55);
});

test('a failed timer write is surfaced and retry preserves the running session; stale start controls cannot start yesterday',async()=>{
 const h=await screenBoot(),stale=h.node('ledger-leisure').querySelectorAll('button').find(b=>b.textContent==='Start screen-time timer');
 h.localStorage.blockedKey=D;stale.click();assert.equal(h.api.failed,1);assert.equal(h.api.drafts.leisureTimer.startedAt,Date.parse(screenNow));h.localStorage.blockedKey=null;await h.api.retry();assert.equal(h.api.failed,0);
 h.at('2026-09-30T09:05:00-05:00');clickLeisure(h,'Stop screen-time timer');assert.equal(h.run('state.draftLeisure.screenMinutes'),5);
 const yesterday=h.node('ledger-leisure').querySelectorAll('button').find(b=>b.textContent==='Start screen-time timer');h.at('2026-10-01T00:01:00-05:00');yesterday.click();assert.equal(h.run('state.logDate'),'2026-10-01');assert.equal(h.api.drafts.leisureTimer,undefined);
});

test('screen meters show the fixed 60-minute boundary and remain independent of other habits',async()=>{
 const h=await screenBoot();h.run('state.draftLeisure.screenMinutes=55;render()');
 for(const id of ['leisure-budget-meter','leisure-preview-meter']){assert.equal(h.node(id).value,5);assert.equal(h.node(id).max,60);assert.equal(h.node(id).dataset.level,'low');}
 h.run('state.draftLeisure.screenMinutes=60;render()');assert.equal(h.node('leisure-preview-meter').value,0);assert.match(h.node('leisure-preview-time').textContent,/Daily limit reached/);
 h.run('state.draftLeisure.screenMinutes=65;render()');assert.match(h.node('leisure-preview-time').textContent,/5:00 over the limit/);
 h.run('state.draftLeisure.screenMinutes=0;render()');assert.equal(h.node('leisure-preview-meter').value,60);
});

test('Today, Progress and History compose one copy of the controls and retain edits across navigation',async()=>{
 const h=await screenBoot();const today=h.node('ledger-view-today'),children=[...today.children];assert(children.indexOf(h.node('ledger-log').closest('.ledger-log-wrap'))<children.indexOf(h.node('ledger-rhythm')));assert(children.indexOf(h.node('ledger-rhythm'))<children.indexOf(h.node('ledger-leisure-preview')));assert.equal(h.node('ledger-view-today').hidden,false);assert.equal(h.node('ledger-view-progress').hidden,true);assert.equal(h.node('ledger-view-history').hidden,true);
 h.run('state.draft.Read=12');h.api.remember();h.node('ledger-nav-progress').click();assert.equal(h.node('ledger-view-progress').hidden,false);assert.equal(h.node('ledger-view-today').hidden,true);assert.equal(h.node('ledger-nav-progress').getAttribute('aria-selected'),'true');assert.equal(!!h.run('state.openSections.relics'),false);
 assert.equal(h.node('app').querySelectorAll('[data-act="commit"]').length,1);assert(h.node('app').querySelector('[data-act="commit"]').closest('#ledger-dock'));
 h.node('ledger-nav-history').click();assert(h.node('ledger-history').closest('#ledger-view-history'));assert.equal(h.node('ledger-history').open,true);
 h.node('ledger-nav-today').click();assert.equal(h.run('state.draft.Read'),12);assert(h.node('ledger-log').closest('#ledger-view-today'));assert(h.node('app').querySelector('.ledger-overall').closest('#ledger-view-progress'));
 h.api.selectDate('2026-09-29');assert.match(h.node('ledger-view-today').textContent,/Editing Sep 29/);h.node('ledger-nav-today').click();assert.equal(h.run('state.logDate'),'2026-09-30');assert.equal(h.run('state.draft.Read'),12);
});

test('the leisure sheet opens and dismisses with focus return without stopping a running timer',async()=>{
 const h=await screenBoot();assert.equal(h.node('ledger-leisure-sheet').open,undefined);h.node('ledger-leisure-preview').click();assert.equal(h.node('ledger-leisure-sheet').open,true);
 clickLeisure(h,'Start screen-time timer');h.node('ledger-leisure-close').click();assert.equal(h.node('ledger-leisure-sheet').open,false);assert.equal(h.document.activeElement.id,'ledger-leisure-preview');assert(h.api.drafts.leisureTimer);
 h.node('ledger-nav-progress').click();assert.equal(h.node('ledger-running-timer').hidden,false);h.node('ledger-running-timer').click();assert.equal(h.node('ledger-leisure-sheet').open,true);
 h.node('ledger-leisure-sheet').emit('cancel');assert.equal(h.node('ledger-leisure-sheet').open,false);assert(h.api.drafts.leisureTimer);
});

test('remaining filter hides completed habits without erasing quantities or changing the full habit list',async()=>{
 const h=await screenBoot();h.run("state.logMode='list';state.draft.Read=25;render()");h.node('ledger-filter-remaining').click();
 const row=h.node('app').querySelector('[data-act="num"][data-habit="Read"]').closest('.row');assert.equal(row.hidden,true);assert.equal(h.run('state.draft.Read'),25);assert.equal(h.run('HABITS.length'),13);
 h.node('ledger-filter-all').click();assert.equal(h.node('app').querySelector('[data-act="num"][data-habit="Read"]').closest('.row').hidden,false);
});

test('time-up actions retain overruns and checkpoint the session only once',async()=>{
 const h=await screenBoot();fillLeisure(h,8);await h.api.saveDay();h.run('state.levelInfo=null;state.achvQueue=[];render()');clickLeisure(h,'Start screen-time timer');
 h.at('2026-09-30T10:06:00-05:00');h.run('render()');assert.equal(h.node('leisure-wrap-up').hidden,false);assert.match(h.node('ledger-running-timer').textContent,/Time’s up/);
 h.node('leisure-end-session').click();assert.equal(h.api.drafts.leisureTimer,undefined);assert.equal(h.run('state.draftLeisure.screenMinutes'),66);assert.equal(h.node('leisure-wrap-up').hidden,true);await h.api.saveDay();assert.equal(h.run('state.days[0].leisure.screenMinutes'),66);
 h.run('state.levelInfo=null;state.achvQueue=[];render()');clickLeisure(h,'Start screen-time timer');h.at('2026-09-30T10:08:00-05:00');h.run('render()');h.node('leisure-log-extra').click();assert.equal(h.api.drafts.leisureTimer,undefined);assert.equal(h.node('leisure-manual-minutes').value,68);
});

test('quick scrolling reset resumes a pending slip, remembers its action and preserves habits and saved history',async()=>{
 const h=await screenBoot();const units=h.run('JSON.stringify(state.draft)');h.node('ledger-quick-reset').click();assert.equal(h.node('ledger-reset-sheet').open,true);assert.equal(h.run('state.draftScreen.slips.length'),1);
 h.node('screen-reset-action').value='read';h.node('screen-reset-action').emit('change');h.node('ledger-reset-sheet').emit('cancel');h.node('ledger-quick-reset').click();assert.equal(h.run('state.draftScreen.slips.length'),1);assert.equal(h.node('screen-reset-action').value,'read');
 h.node('screen-reset-done').click();assert.equal(h.run('state.draftScreen.slips[0].recovered'),true);assert.equal(h.run('JSON.stringify(state.draft)'),units);await h.api.saveDay();
 const again=await screenBoot({records:Object.fromEntries(h.storage)});again.api.selectDate('2026-09-29');again.node('ledger-quick-reset').click();assert.equal(again.run('state.logDate'),'2026-09-30');assert.equal(again.node('screen-reset-action').value,'read');assert.equal(again.run('state.draftScreen.slips.length'),2);
 again.at('2026-10-01T00:01:00-05:00');again.node('screen-reset-done').click();assert.equal(again.run('state.logDate'),'2026-10-01');assert.equal(again.run('state.draftScreen.slips.length'),0);assert.equal(again.api.drafts.days['2026-09-30'].screen.slips[1].recovered,false);
});


test('XP and levels are independent of week modes, goal amounts, focus and calendar gaps',async()=>{
 const rows=[{date:'2025-01-01',units:{Read:250}},{date:'2026-09-08',units:{'Run / Work Out':1}}],h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00',records:{[S]:JSON.stringify(rows)}});
 const xp=h.run('compute(state.days,state.goals).life.xp');assert.equal(xp,1100);assert.equal(h.run('compute(state.days,state.goals).life.level'),0);
 h.run('state.goals.Read=99999');await h.api.saveRhythm({focus:['Screen Discipline'],weeks:{'2026-09-07':'reduced'}});h.at('2027-01-15T12:00:00-06:00');h.run('render()');
 assert.equal(h.run('compute(state.days,state.goals).life.xp'),xp);assert.equal(h.storage.get(S),JSON.stringify(rows));assert.match(h.node('ledger-life-level').textContent,/Life Level 0/);
});
test('weekly catch-up earns XP once and future entries do not earn XP yet',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00',records:{[S]:JSON.stringify([{date:'2026-09-08',units:{Read:25}},{date:'2026-09-09',units:{Read:25}}])}});
 await h.api.saveRhythm({catchups:{'2026-09-07':{Read:{amount:50,sessions:2}}}});assert.equal(h.run('compute(state.days,state.goals).life.xp'),200);
 h.at('2026-09-09T12:00:00-05:00');assert.equal(h.run('compute(state.days,state.goals).life.xp'),200);
});
test('a failed level-crossing save earns no XP; resaves do not replay the level reward',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00'});h.run('state.draft.Read=250');h.localStorage.blockedKey=S;await h.api.saveDay();assert.equal(h.run('compute(state.days,state.goals).life.xp'),0);assert.equal(h.run('state.levelInfo'),null);
 h.localStorage.blockedKey=null;await h.api.saveDay();assert.equal(h.run('state.levelInfo.title'),'Growth · Level 1');await h.api.saveDay();assert.equal(h.run('state.levelInfo'),null);assert.equal(h.run('compute(state.days,state.goals).life.xp'),1000);
 const again=await boot({realModel:true,nowISO:'2026-09-08T19:00:00-05:00',records:Object.fromEntries(h.storage)});assert.equal(again.run('compute(state.days,state.goals).life.level'),0);assert.equal(again.run('state.levelInfo'),null);
});


test('annual calibration reaches habit and value 99 at their rhythms and Life 99 across the complete normal rhythm',async()=>{
 const h=await boot({realModel:true,nowISO:'2026-10-08T12:00:00-05:00'});
 h.run(`state.days=Array.from({length:364},(_,i)=>({date:window.LedgerRhythm.addDays('2025-01-06',i),units:Object.fromEntries(HABITS.filter(h=>i%7<window.LedgerRhythm.goal(h,HCFG[h],{}).normal).map(h=>[h,window.LedgerRhythm.xpUnit(HCFG[h])]))}));render()`);
 assert.equal(h.run('Object.values(compute(state.days,state.goals).habit).filter(h=>HABITS.includes(h.key)).every(h=>h.level===99)'),true);
 assert.equal(h.run('compute(state.days,state.goals).pillars.every(p=>p.level===99)'),true);
 assert.equal(h.run('compute(state.days,state.goals).life.level'),99);
 h.run(`state.days=state.days.map(d=>({...d,units:Object.fromEntries(Object.entries(d.units).filter(([h])=>['Run / Work Out','Read','Screen Discipline'].includes(h)))}));render()`);
 assert.equal(h.run('compute(state.days,state.goals).life.level'),22);
 const before=h.run('JSON.stringify(compute(state.days,state.goals).habit.Read)');
 await h.api.saveRhythm({focus:['Board Work'],goals:{Read:{type:'practice',mode:'sessions',normal:1,reduced:1,target:250,baseline:0,due:''}},weeks:{'2026-10-05':'reduced'}});
 assert.equal(h.run('JSON.stringify(compute(state.days,state.goals).habit.Read)'),before);
 assert.equal(h.run('compute(state.days,state.goals).life.level'),22);
 const meter=h.node('app').querySelector('.ledger-xp-meter');assert.equal(meter.max,h.run('window.LedgerRhythm.lifeCost'));
});


test('typing a quantity updates check-in state in place and clears an explicit missed state',async()=>{
 const h=await boot();h.run("state.draftMissed=['Read'];render()");const input=h.node('app').querySelector('[data-act="num"][data-habit="Read"]'),card=input.closest('.ledger-habit-card');input.value='5';h.node('app').emit('input',{target:input});
 assert.equal(card.querySelector('.ledger-habit-status').textContent,'Recorded');assert.equal(h.run('state.draftMissed.includes("Read")'),false);assert.equal(card.querySelector('.ledger-missed').getAttribute('aria-label'),'Did not do: Read');assert.equal(h.node('app').querySelector('[data-act="num"][data-habit="Read"]'),input);
 input.value='';h.node('app').emit('input',{target:input});assert.equal(card.querySelector('.ledger-habit-status').textContent,'Not recorded');
});


test('explicit progress reset archives history, drafts and catch-up, and survives reload and backup restore',async()=>{
 const rows=[{date:'2026-09-06',units:{Read:9},note:'Keep my history'}];
 const h=await boot({records:{[S]:JSON.stringify(rows)}});
 h.run(`state.draft.Read=3;state.draftNote='Keep my draft'`);h.api.remember();
 await h.api.saveRhythm({focus:['Read'],catchups:{'2026-08-31':{Read:{amount:12,sessions:3}}},earned:['Season Opens']});
 const before=h.run('compute(state.days,state.goals).life.xp');assert(before>0);
 assert.equal(await h.api.resetProgress(),true);
 assert.equal(h.run('compute(state.days,state.goals).life.xp'),0);assert.equal(h.run('state.draft.Read'),0);
 assert.equal(h.api.drafts.archives.length,1);assert.equal(h.api.drafts.archives[0].days[0].note,'Keep my history');
 assert.equal(h.api.drafts.archives[0].drafts.days['2026-09-07'].note,'Keep my draft');
 assert.equal(h.api.drafts.rhythm.catchups,undefined);assert.equal(h.api.drafts.rhythm.earned,undefined);
 assert.deepEqual(Array.from(h.api.drafts.rhythm.focus),['Read']);
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('compute(state.days,state.goals).life.xp'),0);assert.equal(again.api.drafts.archives.length,1);
 again.run('exportData()');const pack=JSON.parse(await again.downloads.at(-1).blob.text());const target=await boot();
 await target.run('importData')(file(pack));target.clickText('Restore backup');await target.settle();assert.equal(target.api.drafts.archives[0].days[0].note,'Keep my history');
 h.clickText('Restore this progress');await h.settle();h.clickText('Restore backup');await h.settle();assert.equal(h.run('compute(state.days,state.goals).life.xp'),before);assert.equal(h.run('state.draftNote'),'Keep my draft');
});
test('failed archive staging leaves progress intact and does not queue a destructive retry',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-06',units:{Read:9}}])}});
 // Fail only the staged archive write, after the pre-reset draft checkpoint succeeds.
 const set=h.localStorage.setItem.bind(h.localStorage);h.localStorage.setItem=(k,v)=>{if(k===D&&JSON.parse(v).resetPending)throw Error('Full storage');set(k,v);};
 assert.equal(await h.api.resetProgress(),false);assert.equal(h.run('state.days.length'),1);assert.equal(h.api.drafts.archives,undefined);await h.api.retry();assert.equal(h.run('state.days.length'),1);
});
test('interrupted active-history clearing recovers the explicit reset without losing its archive',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-06',units:{Read:9},note:'Recover me'}])}});
 h.localStorage.blockedKey=S;assert.equal(await h.api.resetProgress(),true);assert(h.api.drafts.resetPending);assert.equal(h.run('compute(state.days,state.goals).life.xp'),0);
 const again=await boot({records:Object.fromEntries(h.storage)});await again.settle();assert.equal(again.run('state.days.length'),0);assert.equal(again.api.drafts.resetPending,undefined);assert.equal(again.api.drafts.archives[0].days[0].note,'Recover me');
 again.run('state.draft.Read=2');await again.api.saveDay();const final=await boot({records:Object.fromEntries(again.storage)});assert.equal(final.run('compute(state.days,state.goals).habit.Read.total'),2);
});


test('card XP matches actual check-in increments for count and amount habits',async()=>{
 const h=await boot({realModel:true});
 const hints=()=>h.node('app').querySelectorAll('.ledger-card-xp').map(n=>n.textContent);
 assert.equal(hints().length,13);assert(hints().includes('+100 XP per check-in'));
 assert(hints().includes('+10 pages · +40 XP per tap'));
 assert(hints().includes('+15 minutes · +50 XP per tap'));
 assert(hints().includes('+0.5 hours · +6.67 XP per tap'));
 h.act('inc',{habit:'Read'});await h.api.saveDay();assert.equal(h.run('compute(state.days,state.goals).habit.Read.xp'),40);
 h.run('render()');assert.equal(hints().filter(t=>t==='+10 pages · +40 XP per tap').length,1);
});


test('amount Done confirms the typed quantity and advances without changing it or saving the day',async()=>{
 const h=await boot({realModel:true});
 for(const [habit,amount]of [['Sleep','7'],['Read','13'],['Board Work','45']]){
  h.run('goCard(HABITS.indexOf('+JSON.stringify(habit)+'))');
  const card=h.node('app').querySelectorAll('.ledger-habit-card')[h.run('state.cardIndex')];
  const input=card.querySelector('[data-act="num"]');input.value=amount;
  card.querySelector('.ledger-amount-done').click();
  assert.equal(h.run('state.draft['+JSON.stringify(habit)+']'),Number(amount));
  assert.equal(h.run('state.cardIndex'),h.run('HABITS.indexOf('+JSON.stringify(habit)+')')+1);
  assert.equal(h.api.drafts.days['2026-09-07'].units[habit],Number(amount));
  assert.equal(h.run('state.days.length'),0);assert.equal(h.run('compute(state.days,state.goals).life.xp'),0);
 }
 assert.equal(h.node('app').querySelectorAll('.ledger-amount-done').length,3);
});
test('amount Done keeps invalid input on its card for correction',async()=>{
 const h=await boot({realModel:true});h.run('goCard(HABITS.indexOf("Read"))');
 const card=h.node('app').querySelectorAll('.ledger-habit-card')[h.run('state.cardIndex')];
 const input=card.querySelector('[data-act="num"]');input.value='-4';card.querySelector('.ledger-amount-done').click();
 assert.equal(h.run('state.cardIndex'),h.run('HABITS.indexOf("Read")'));assert.equal(input.getAttribute('aria-invalid'),'true');assert.equal(h.document.activeElement,input);assert.equal(h.run('state.draft.Read'),0);
});
