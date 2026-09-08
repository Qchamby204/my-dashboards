import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../life-ledger.html',import.meta.url),'utf8');
let original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
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
async function boot({records={},blocked=false,width=390}={}){
  let now=Date.parse('2026-09-07T22:49:00-05:00'),serial=0;const ids=new Map(),timers=new Map(),blobs=new Map(),downloads=[];
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
  let legacyError;try{vm.runInContext(original,context);for(let i=0;i<30;i++)await Promise.resolve();}catch(e){legacyError=e;}
  vm.runInContext(enhancement,context);for(let i=0;i<30;i++)await Promise.resolve();const run=s=>vm.runInContext(s,context),node=id=>ids.get(id);
  return {run,node,document,window,context,api:window.LedgerDays,localStorage,storage,downloads,legacyError,
    at(date){now=new Date(date).getTime();},flush(){for(const [id,t]of [...timers])if(t.due<=now&&timers.delete(id))t.fn();},
    settle:async()=>{for(let i=0;i<30;i++)await Promise.resolve();},act(action,extra={}){const el=document.createElement('button');el.dataset={act:action,...extra};return node('app').emit('click',{target:el});},
    clickText(text){const scope=document.querySelector('dialog[open]')||document;const b=scope.querySelectorAll('button').find(n=>n.textContent===text);assert(b,'Missing button '+text);b.click();}};
}

test('requested season starts September 8 locally and keeps earlier days intact',async()=>{
 const rows=[{date:'2026-09-07',units:{Read:8},note:'Earlier note'},{date:'2026-09-08',units:{Read:2}}],h=await boot({records:{[S]:JSON.stringify(rows)}});
 assert.equal(h.legacyError,undefined);assert.equal(h.api.blocked,false);assert.equal(h.api.season.start,'2026-09-08');assert.equal(h.run('todayISO()'),'2026-09-07');assert.equal(h.run('compute(state.days,state.goals).days.length'),0);assert.equal(h.run('state.days.length'),2);
 assert.match(h.node('ledger-season-summary').textContent,/Sep 8, 2026/);h.at('2026-09-08T00:01:00-05:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),2);assert.equal(h.run('compute(state.days,state.goals).history[0].day'),1);assert.equal(h.storage.get(S),JSON.stringify(rows));
});
test('new season changes dates without erasing records and survives reload as a fixed date',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-07',units:{Read:4}}])}});assert(await h.api.setSeason({start:'2026-09-10',end:'2026-12-31'}));assert.equal(h.run('state.days.length'),1);
 const again=await boot({records:Object.fromEntries(h.storage)});assert.equal(again.api.season.start,'2026-09-10');assert.equal(again.run('state.days.length'),1);assert.equal(again.run('compute(state.days,state.goals).life.level'),0);
});
test('calendar totals exclude dates after season end or today and include the final day',async()=>{
 const rows=[{date:'2026-09-08',units:{Read:2}},{date:'2026-12-31',units:{Read:3}},{date:'2027-01-01',units:{Read:5}}];const h=await boot({records:{[S]:JSON.stringify(rows)}});h.at('2026-12-31T23:30:00-06:00');
 assert.equal(h.run('compute(state.days,state.goals).daysLeft'),1);assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),5);h.at('2027-01-01T00:01:00-06:00');assert.equal(h.run('compute(state.days,state.goals).elapsed'),1);assert.equal(h.run('compute(state.days,state.goals).habit.Read.total'),5);
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
 const h=await boot();h.run('state.draft.Read=5');h.act('clear');assert.equal(h.run('state.draft.Read'),5);h.clickText('Clear draft');await h.settle();assert.equal(h.run('state.draft.Read'),0);h.act('reset');assert(h.document.querySelector('dialog[open]'));assert.equal(h.api.season.start,'2026-09-08');
 const broken=await boot({records:{[S]:'[broken'}});assert.equal(broken.api.blocked,true);broken.run('exportData()');const recovery=JSON.parse(await broken.downloads.at(-1).blob.text());assert.equal(recovery.records[S],'[broken');assert.equal(broken.storage.get(S),'[broken');
});
test('empty pillars remain numeric and streaks require adjacent calendar dates',async()=>{
 const h=await boot({records:{[S]:JSON.stringify([{date:'2026-09-08',units:{Read:1}},{date:'2026-09-10',units:{Read:1}}])}});h.at('2026-09-10T12:00:00-05:00');assert.equal(h.run('compute(state.days,state.goals).habit.Read.streak'),1);
 h.run(`userModel.hidden={Read:true,Make:true};rebuildModel();`);assert.equal(h.run('compute(state.days,state.goals).life.level'),0);assert(h.run('compute(state.days,state.goals).pillars.every(p=>Number.isFinite(p.level))'));h.run('render()');
});
test('future log dates are refused; labels and card boundaries expose usable state',async()=>{
 const h=await boot();assert.equal(h.api.selectDate('2026-09-08'),false);assert.equal(h.run('state.logDate'),'2026-09-07');assert.equal(h.run('state.logMode'),'list');assert.equal(h.node('app').querySelector('[data-act="toggle"]').getAttribute('aria-label'),'Mark complete: Make');
 h.run(`state.logMode='cards';render()`);assert.equal(h.node('deckPrev').disabled,true);h.run('goCard(1)');assert.equal(h.node('deckNext').disabled,true);assert.equal(h.node('deckPrev').disabled,false);
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
