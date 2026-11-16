import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const root=new URL('../../',import.meta.url);
const read=file=>readFileSync(new URL(file,root),'utf8');
const origin='https://qchamby204.github.io';
const pagePath='/my-dashboards/aqueduct-household.html';
const pageUrl=origin+pagePath;
const html=read('aqueduct-household.html');
const script=html.match(/<script>([\s\S]+)<\/script>/)[1];
const codeHash=createHash('sha256').update(script).digest('base64');

function boot(location, framed=false) {
  const nodes=new Map(), handlers=new Map(), data=new Map(), registrations=[];
  const node=id=>{
    if(!nodes.has(id)) nodes.set(id,{innerHTML:'',querySelector:node,click(){this.clicked=true;},addEventListener(type,callback){handlers.set([id,type].join(' '),callback);}});
    return nodes.get(id);
  };
  const window={addEventListener(){},scrollTo(){}};
  window.top=framed?{}:window;
  const context={window,location,crypto:webcrypto,TextEncoder,TextDecoder,Blob,btoa,atob,URL,
    setInterval(){},setTimeout(){},clearTimeout(){},structuredClone,
    document:{getElementById:id=>id==='cash-chart'?null:node(id),addEventListener:(kind,callback)=>handlers.set('document '+kind,callback)},
    FormData:class {constructor(form){this.values=form.values;}get(key){return this.values[key];}},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},
    navigator:{serviceWorker:{register(path,opts){registrations.push([path,opts.scope]);return Promise.resolve();}}}};
  runInNewContext(script+'\nglobalThis.api={Engine,Vault,ChatUpdate};',context);
  return {html:node('app').innerHTML,registrations,data,handlers,node,...context.api};
}

test('the Atlas link opens the canonical ledger with a matching CSP and its own storage key',async()=>{
  assert(read('index.html').includes('href="'+pageUrl+'"'));
  assert(html.includes("script-src 'sha256-"+codeHash+"'"));
  assert(html.includes("connect-src 'none'"));
  assert(html.includes("form-action 'none'"));
  assert.doesNotMatch(script,/\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket)\s*\(/);
  const hosted=boot(new URL(pageUrl));
  assert.doesNotMatch(hosted.html,/type="submit" disabled/);
  assert.deepEqual(hosted.registrations,[['./aqueduct-household-sw.js','./aqueduct-household.html']]);
  const v=await hosted.Vault.create(hosted.Engine.empty(),'fictional passphrase 123');
  v.state.accounts.push({name:'fictional credit card account'});
  const backup=await hosted.Vault.seal(v.state,v.secret,v.salt);
  hosted.Vault.put(backup);
  assert.deepEqual([...hosted.data.keys()],['aqueduct-offline-v1']);
  assert.doesNotMatch(backup,/fictional credit card account|fictional passphrase/);
  assert.equal((await hosted.Vault.open(backup,'fictional passphrase 123')).state.accounts[0].name,'fictional credit card account');
});

test('other sites and embedded copies cannot unlock the hosted ledger',()=>{
  for(const [where,framed] of [[new URL('https://example.com'+pagePath),false],[new URL(pageUrl),true],[new URL(origin+'/other.html'),false]]){
    const other=boot(where,framed);
    assert.match(other.html,/type="submit" disabled/);
    assert.equal(other.registrations.length,0);
  }
});

test('offline caching is scoped to the published shell and never caches ledger requests',async()=>{
  const events={}, added=[], deleted=[];
  const manifests=new URL('./aqueduct-assets/manifest.webmanifest',pageUrl);
  const manifest=JSON.parse(read('aqueduct-assets/manifest.webmanifest'));
  assert.equal(new URL(manifest.start_url,manifests).href,pageUrl);
  assert.equal(new URL(manifest.scope,manifests).href,pageUrl);
  const cache={addAll:files=>{added.push(...files.map(f=>f.url));},match:async()=>new Response('cached shell')};
  runInNewContext(read('aqueduct-household-sw.js'),{
    URL,Request,fetch:()=>{throw Error('Unexpected network call');},
    self:{registration:{scope:pageUrl},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(kind,fn)=>{events[kind]=fn;}},
    caches:{open:async()=>cache,keys:async()=>['aqueduct-household-shell-old','another-dashboard'],delete:async name=>{deleted.push(name);}}
  });
  await new Promise(resolve=>events.install({waitUntil:p=>resolve(p)}));
  const icons=[...html.matchAll(/<link rel="(?:apple-touch-icon|icon)"[^>]*href="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(icons.length,3);
  assert.deepEqual(added,[pageUrl,manifests.href,new URL('./icon.png',manifests).href,...icons]);
  await new Promise(resolve=>events.activate({waitUntil:p=>resolve(p)}));
  assert.deepEqual(deleted,['aqueduct-household-shell-old']);
  for(const req of [
    new Request(pageUrl,{method:'POST',body:'fictional statement'}),
    new Request(pageUrl+'?transaction=fictional'),
    new Request(new URL('the-aqueduct.html',pageUrl)),
    new Request('https://example.com/'+pagePath)
  ]) events.fetch({request:req,respondWith:()=>{throw Error('Unrelated request intercepted');}});
  let response;
  events.fetch({request:new Request(pageUrl),respondWith:p=>{response=p;}});
  assert.equal(await (await response).text(),'cached shell');
});

const fixture=()=>({
  format:'aqueduct-chat-update',version:1,id:'fictional-november',
  accounts:[{key:'joint',name:'Joint account',type:'Chequing',balance:200000,balanceDate:'2026-11-15'},{key:'card',name:'Card A',type:'Credit card'}],
  projects:[{key:'basement',name:'Basement',status:'Complete'}],
  loans:[{key:'loc',name:'Home line',type:'Line of credit',balance:400000,asOf:'2026-11-15',rate:7.5,payment:10000,account:'joint'}],
  bills:[
    {key:'loc-payment',name:'Loan payment',direction:'Bill',account:'joint',amount:10000,start:'2026-11-19',loan:'loc'},
    {key:'pay',name:'Payday',direction:'Income',account:'joint',amount:270000,start:'2026-11-21',frequency:'Biweekly'}
  ],
  goals:[{key:'travel',name:'Travel',target:160000,saved:10000,priority:2}],
  targets:[{category:'Insurance',method:'Fixed',amount:5000}],
  excludedMonths:['2025-10'],
  config:{floor:65000,surplus:45000,debtShare:60},
  statements:[
    {key:'joint-oct',account:'joint',label:'October chequing',start:'2026-10-01',end:'2026-10-31',coverageConfirmed:true,reconciled:true,transactions:[
      {date:'2026-10-01',description:'Payroll',amount:270000,kind:'Income',category:'Paycheque',external:'x1'},
      {date:'2026-10-08',description:'Card transfer',amount:-42000,kind:'Transfer',external:'x2'}]},
    {key:'card-oct',account:'card',label:'October card',start:'2026-10-01',end:'2026-10-31',coverageConfirmed:true,transactions:[
      {date:'2026-10-08',description:'Transfer received',amount:42000,kind:'Transfer',external:'c1'},
      {date:'2026-10-10',description:'Grocer',amount:-10000,kind:'Spending',category:'Groceries'},
      {date:'2026-10-10',description:'Grocer',amount:-10000,kind:'Spending',category:'Groceries'},
      {date:'2026-10-22',description:'Home supplies',amount:-25000,allocations:[
        {amount:-20000,kind:'Project',project:'basement'},{amount:-5000,kind:'Spending',category:'Home maintenance'}]},
      {date:'2026-10-24',description:'Hardware',amount:-1700,kind:'Review',question:'Basement or household supplies?'}
    ]}
  ]
});

test('one prepared update loads the reviewed statements, schedules and priorities',()=>{
  const {Engine,ChatUpdate}=boot(new URL(pageUrl));
  const state=Engine.empty(), pack=ChatUpdate.read(JSON.stringify(fixture()));
  const result=ChatUpdate.apply(state,pack,'2026-11-16');
  assert.equal(result.added,7);
  assert.equal(result.review,1);
  assert.equal(state.transactions.filter(t=>t.pair).length,2);
  assert.equal(state.projects[0].status,'Complete');
  assert.equal(state.bills.length,2);
  assert.equal(state.loans[0].rate,7.5);
  assert.equal(state.goals[0].target,160000);
  assert.equal(state.config.debtShare,60);
  const history=Engine.history(state,'2026-11-16');
  assert.equal(history.complete[0],'2026-10');
  assert.equal(history.rows.find(r=>r.category==='Groceries').average,20000);
  assert.equal(history.rows.find(r=>r.category==='Home maintenance').suggestion,5000);
  assert.equal(history.rows.find(r=>r.category==='Insurance').suggestion,5000);
  assert.equal(Engine.history(state,'2026-11-16','2026-10').projects,20000);
});

test('an overlapping update preserves reviewed rows, newer balances and custom targets',()=>{
  const {Engine,ChatUpdate}=boot(new URL(pageUrl));
  const state=Engine.empty(), pack=fixture();
  state.accounts.push({id:'original',name:'Joint account',type:'Chequing',balance:350000,balanceDate:'2026-11-16',floor:1700,history:true,forecast:true});
  state.targets.Insurance={method:'Fixed',amount:6000};
  ChatUpdate.apply(state,pack,'2026-11-16');
  assert.equal(state.accounts[0].id,'original');
  assert.equal(state.accounts[0].balance,350000);
  assert.equal(state.accounts[0].floor,1700);
  assert.equal(state.targets.Insurance.amount,6000);
  assert.equal(ChatUpdate.apply(state,pack,'2026-11-16').already,true);
  const overlap=fixture();
  overlap.id='fictional-overlap';
  assert.equal(ChatUpdate.apply(state,overlap,'2026-11-16').duplicates,7);
  assert.equal(state.transactions.length,7);
  assert.equal(state.imports.length,2);
  assert.equal(state.accounts.length,2);
  const resolution={format:pack.format,version:1,id:'fictional-resolution',
    corrections:[{account:'card',date:'2026-10-24',description:'Hardware',amount:-1700,kind:'Project',project:'basement'}]};
  assert.equal(ChatUpdate.apply(state,resolution,'2026-11-16').corrected,1);
  assert.equal(Engine.history(state,'2026-11-16','2026-10').projects,21700);
});

test('the welcome screen applies a queued update when the device ledger is first opened',async()=>{
  const app=boot(new URL(pageUrl));
  assert.match(app.html,/Apply chat update/);
  const picker=app.node('chat-update-file');
  const dispatch=app.handlers.get('document click');
  await dispatch({target:{closest:()=>({disabled:false,dataset:{act:'chat-update'}})}});
  assert.equal(picker.clicked,true);
  picker.files=[new Blob([JSON.stringify(fixture())])];
  await app.handlers.get('chat-update-file change')();
  assert.match(app.node('app').innerHTML,/Chat update ready/);
  assert.equal(app.data.size,0);
  const form=app.node('#vault-form');
  const fictional='fictional password only';
  form.values={password:fictional,confirm:fictional};
  await app.handlers.get('#vault-form submit')({preventDefault(){},target:form});
  const sealed=app.data.get('aqueduct-offline-v1');
  assert.ok(sealed);
  assert.doesNotMatch(sealed,/Grocer|Joint account/);
  const state=(await app.Vault.open(sealed,fictional)).state;
  assert.equal(state.transactions.length,7);
  assert.equal(state.chatUpdates.length,1);
  assert.match(app.node('app').innerHTML,/Chat update applied/);
  const malformed=fixture();
  malformed.id='fictional-bad-update';
  malformed.statements[1].transactions[4].date='2025-01-02';
  picker.files=[new Blob([JSON.stringify(malformed)])];
  await app.handlers.get('chat-update-file change')();
  assert.equal(app.data.get('aqueduct-offline-v1'),sealed);
  assert.match(app.node('toast').textContent,/outside its statement dates/);
});
