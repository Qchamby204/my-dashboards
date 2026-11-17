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
    if(!nodes.has(id)) nodes.set(id,{innerHTML:'',querySelector:node,focus(){},click(){this.clicked=true;},addEventListener(type,callback){handlers.set([id,type].join(' '),callback);}});
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

test('a classification follow-up preserves confirmed transactions and edited schedules',()=>{
  const {Engine,ChatUpdate}=boot(new URL(pageUrl));
  const state=Engine.empty(), pack=fixture();
  ChatUpdate.apply(state,pack,'2026-11-16');
  const hardware=state.transactions.find(t=>t.description==='Hardware');
  const payment=state.bills.find(b=>b.direction==='Bill');
  payment.amount=12500;
  const revised=fixture();
  revised.id='fictional-merchant-review';
  revised.baseUpdate=pack.id;
  revised.corrections=[
    {account:'card',date:hardware.date,description:hardware.description,amount:hardware.amount,kind:'Spending',category:'Home maintenance',onlyReview:true}
  ];
  const apply=target=>ChatUpdate.apply(target,ChatUpdate.read(JSON.stringify(revised)),'2026-11-16');
  const fresh=Engine.empty();
  assert.equal(apply(fresh).corrected,1);
  assert.equal(apply(structuredClone(state)).corrected,1);
  Object.assign(hardware,{kind:'Project',project:state.projects[0].id,manual:true});
  const result=apply(state);
  assert.equal(result.added,0);
  assert.equal(result.corrected,0);
  assert.equal(hardware.kind,'Project');
  assert.equal(payment.amount,12500);
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


test('quick review suggests exact purchases, links a pair, and can undo a grouped confirmation',async()=>{
  const app=boot(new URL(pageUrl));
  const dispatch=app.handlers.get('document click');
  const click=(act,id='')=>dispatch({target:{closest:()=>({dataset:{act,id}})}});
  await click('demo');
  await click('nav','Import & review');
  const ui=()=>app.node('app').innerHTML;
  assert.match(ui(),/7 to review/);
  assert.match(ui(),/Link both/);
  const pair=/data-act="review-pair" data-id="([^"]+)"/.exec(ui())[1];
  await click('review-pair',pair);
  assert.match(ui(),/5 to review/);
  assert.match(ui(),/Use Groceries/);
  assert.match(ui(),/applies to all 2 matching charges/);
  const group=/data-act="review-category" data-id="([^"]+)"/.exec(ui())[1].replaceAll('&#39;',"'").replaceAll('&quot;','"');
  await click('review-category',group);
  assert.match(ui(),/3 to review/);
  await click('review-undo');
  assert.match(ui(),/5 to review/);
  assert.match(ui(),/Use Groceries/);
  await click('review-picker',JSON.parse(group)[0]);
  const misc=/data-act="review-category" data-id="([^"]+)">Miscellaneous<\/button>/.exec(ui())[1].replaceAll('&quot;','"');
  assert.equal(JSON.parse(misc)[1],'Other');
  await click('review-category',misc);
  assert.match(ui(),/3 to review/);
  await click('nav','Spending');
  assert.match(ui(),/data-act="spending-drill" data-id="Other">Other<\/button>/);
});

test('recurring charges require a regular cadence and compatible amounts and categories',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty();
  for(const [i,date] of ['2026-07-21','2026-08-20','2026-09-20','2026-10-20'].entries()){
    const base={date,amount:-1050,id:String(i),kind:'Spending',category:'Subscriptions',account:'card'};
    state.transactions.push({...base,description:'Video subscription'});
    state.transactions.push({...base,id:'b'+i,description:'Volatile merchant',amount:-200*(i+1)});
    state.transactions.push({...base,id:'c'+i,description:'Amazon'});
  }
  const rows=E.recurringCharges(state);
  assert.equal(rows.length,1);
  assert.equal(rows[0].transaction.description,'Video subscription');
  assert.equal(rows[0].frequency,'Monthly');
  assert.equal(rows[0].amount,1050);
  assert.equal(rows[0].count,4);
});

test('remembered categories apply only to exact unclassified chat purchases on the same account',()=>{
  const {Engine:E,ChatUpdate:C}=boot(new URL(pageUrl));
  const state=E.empty(), pack=fixture();
  C.apply(state,pack,'2026-11-16');
  state.rules.push({merchant:'hardware',account:state.accounts[1].id,direction:-1,kind:'Spending',category:'Home maintenance',project:''});
  const row={date:'2026-11-04',description:'HARDWARE!',amount:-1600};
  const result=C.apply(state,{format:pack.format,version:1,id:'fictional-new-charges',statements:[
    {key:'new-card',account:'card',label:'November card',start:'2026-11-01',end:'2026-11-15',transactions:[
      row,{...row,amount:1600},{...row,amount:-1800,category:'Shopping',kind:'Spending'}, {...row,description:'Other Hardware'}]},
    {key:'new-bank',account:'joint',label:'November bank',start:'2026-11-01',end:'2026-11-15',transactions:[row]}
  ]},'2026-11-16');
  assert.equal(result.added,5);
  assert.equal(result.review,3);
  assert.equal(state.transactions.filter(t=>t.why==='Saved rule').length,1);
  assert.equal(state.transactions.find(t=>t.amount===-1800).category,'Shopping');
});

test('cash flow separates identified income, withdrawals, card payments and internal movements',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty();
  state.accounts=[
    {id:'bank',type:'Chequing',history:true},
    {id:'joint',type:'Chequing',forecast:true},
    {id:'reserve',type:'Savings',history:false,forecast:false},
    {id:'card',type:'Credit card',history:true}
  ];
  const item=(id,account,amount,kind,category='',pair='',date='2026-10-15')=>({id,account,amount,kind,category,pair,date});
  state.transactions=[
    item('pay','bank',600000,'Income','Paycheque'),
    item('contribution','joint',300000,'Income','Household contribution'),
    item('unknown','joint',40000,'Review'),
    item('refund','bank',15000,'Reimbursement','Shopping'),
    item('between','bank',-160000,'Transfer','Between accounts','receive'),
    item('receive','joint',160000,'Transfer','Between accounts','between','2026-11-01'),
    item('withdraw','joint',-20000,'Transfer','Transfer','reserve-side'),
    item('reserve-side','reserve',20000,'Transfer','Transfer','withdraw'),
    item('card-pay','bank',-100000,'Transfer','Credit card payment','card-receive'),
    item('card-receive','card',100000,'Transfer','Credit card payment','card-pay'),
    item('groceries','card',-70000,'Spending','Groceries'),
    {...item('split','joint',-150000,'Spending'),allocations:[
      {amount:-90000,kind:'Spending',category:'Housing & utilities'},
      {amount:-60000,kind:'Project',project:'basement'}
    ]}
  ];
  state.imports=[
    {account:'bank',start:'2026-10-01',end:'2026-10-31',coverageConfirmed:true},
    {account:'joint',start:'2026-10-01',end:'2026-10-20',coverageConfirmed:true}
  ];
  const october=E.recordedCash(state,'2026-11-16','2026-10');
  assert.equal(october.inflow,955000);
  assert.equal(october.knownIncome,900000);
  assert.equal(october.outflow,270000);
  assert.equal(october.net,685000);
  assert.equal(october.uncertainty,1);
  assert.equal(october.internal,1);
  assert.equal(october.covered,false);
  assert.equal(october.uses.find(r=>r.name==='Credit card payments').amount,100000);
  assert.equal(october.uses.find(r=>r.name==='One-time project payments').amount,60000);
  assert.equal(E.recordedCash(state,'2026-11-16','2026-11').inflow,0);
  assert.equal(E.recordedCash(state,'2026-11-16','2026-09').available,false);
});

test('debt comparison ranks eligible rates and shows a separately modeled extra payment',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty();
  const base={asOf:'2026-11-01',rateAfter:null,rateDate:'',frequency:'Monthly',method:'Monthly estimate',prepay:null};
  state.loans=[
    {...base,id:'missing',type:'Line of credit',balance:700000,rate:8,payment:0},
    {...base,id:'td',type:'Credit card',balance:418490,rate:26.99,payment:14087},
    {...base,id:'scotia',type:'Credit card',balance:807923,rate:20.99,payment:1494},
    {...base,id:'mortgage',type:'Mortgage',balance:30000000,rate:4.49,payment:165000,prepay:0}
  ];
  const now='2026-11-16';
  const profile=E.debtProfile(state,now);
  assert.equal(profile.target.id,'td');
  assert.equal(profile.missing[0].id,'missing');
  const baseline=E.singlePayoff(profile.target,now,0);
  const extra=E.singlePayoff(profile.target,now,25000);
  assert.ok(extra.months<baseline.months&&extra.interest<baseline.interest);
  assert.equal(E.singlePayoff(state.loans[0],now,10000),null);
  assert.equal(E.singlePayoff(state.loans[2],now,0),null);
});

test('recommendations expose ledger-specific actions and link to the underlying screens',async()=>{
  const app=boot(new URL(pageUrl));
  const dispatch=app.handlers.get('document click');
  const click=(act,id='')=>dispatch({target:{closest:()=>({dataset:{act,id}})}});
  const ui=()=>app.node('app').innerHTML;
  await click('demo');
  await click('nav','Recommendations');
  assert.match(ui(),/<h1>Recommendations<\/h1>/);
  assert.match(ui(),/Check bills due by your next paycheque/);
  assert.match(ui(),/Use Line of credit as the first candidate for extra payments/);
  assert.match(ui(),/Identify the deposits still in review/);
  assert.match(ui(),/one-time projects visible separately/);
  const detail=/data-act="cash-bucket" data-id="([^"]+)">Review deposits<\/button>/.exec(ui())[1].replaceAll('&quot;','"');
  await click('cash-bucket',detail);
  assert.match(ui(),/<h2>Transaction ledger<\/h2>/);
  assert.match(ui(),/Interac e-transfer received/);
  assert.doesNotMatch(ui(),/Online banking payment/);
  await click('nav','Recommendations');
  await click('open-recurring');
  assert.match(ui(),/<h2>Recurring charges<\/h2>/);
  await click('nav','Settings');
  assert.match(ui(),/<h1>Settings<\/h1>/);
});

test('payday stress shifts estimated variable deposits only and keeps bills and booked amounts intact',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty(), now='2026-11-16';
  state.config.floor=20000;
  state.accounts=[
    {id:'personal',type:'Chequing',forecast:true,balance:60000,balanceDate:now,floor:10000},
    {id:'joint',type:'Chequing',forecast:true,balance:155000,balanceDate:now,floor:50000}
  ];
  const schedule=(id,start,direction,account,amount,variable=false)=>({id,name:id,start,direction,account,amount,variable,frequency:'Once'});
  state.bills=[
    schedule('variable','2026-11-18','Income','personal',120000,true),
    schedule('confirmed','2026-11-28','Income','personal',70000,true),
    schedule('draw','2026-11-21','Income','personal',30000),
    schedule('bill','2026-11-19','Bill','personal',70000),
    schedule('joint contribution','2026-11-30','Income','joint',100000)
  ];
  state.billStatus['confirmed/2026-11-28']={amount:60000};
  const base=E.forecast(state,now), stress=E.forecast(state,now,{incomeCut:15,incomeDelay:7});
  assert.equal(base.lows.personal,60000);
  assert.equal(stress.lows.personal,-10000);
  assert.equal(stress.affected.length,1);
  assert.equal(stress.changed.get('variable/2026-11-18').date,'2026-11-25');
  assert.equal(stress.changed.get('variable/2026-11-18').forecastAmount,102000);
  assert.equal(stress.shortfalls[0].key,'bill/2026-11-19');
  assert.equal(stress.ending,base.ending-18000);
  assert.equal(state.bills[0].start,'2026-11-18');
  assert.equal(E.commitmentRange(state,base,stress,'personal',true).base,50000);
  assert.equal(E.commitmentRange(state,base,stress,'personal',true).stress,0);
  assert.equal(E.commitmentRange(state,base,stress,'personal',false).base,null);
  state.accounts[0].balanceDate='2026-11-15';
  assert.equal(E.commitmentRange(state,E.forecast(state,now),E.forecast(state,now),'personal',true).stress,null);
  state.config.flex=10000;
  assert.equal(E.forecast(state,now).headroom,null);
});

test('debt profile flags a payment that cannot cover estimated interest',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty();
  state.loans=[{id:'card',type:'Credit card',balance:807923,rate:20.99,payment:1494,asOf:'2026-10-26'}];
  const [loan]=E.debtProfile(state,'2026-11-16').underInterest;
  assert.equal(loan.required,1494);
  assert.equal(loan.monthlyInterest,14132);
});

test('the payday plan is reachable and marks the optional payment estimate as pending until confirmed',async()=>{
  const app=boot(new URL(pageUrl));
  const dispatch=app.handlers.get('document click');
  const click=(act,id='')=>dispatch({target:{closest:()=>({dataset:{act,id}})}});
  await click('demo');
  assert.match(app.node('app').innerHTML,/Open payday plan/);
  await click('nav','Cash plan');
  const view=app.node('app').innerHTML;
  assert.match(view,/<h1>Payday plan<\/h1>/);
  assert.match(view,/confirm all regular living costs/);
  assert.match(view,/Variable pay delay/);
  assert.match(view,/Lower or later pay low/);
});

test('monthly snapshot uses conservative pay, keeps mortgage in costs once and exposes the cuts an extra-payment plan requires',()=>{
  const {Engine:E}=boot(new URL(pageUrl));
  const state=E.empty(), now='2026-11-16';
  const next='2026-12-01';
  state.bills=[
    {id:'draw',name:'Payroll draw',direction:'Income',start:next,frequency:'Monthly',amount:100000},
    {id:'second',name:'Paycheque',direction:'Income',start:next,frequency:'Monthly',amount:560949,variable:true},
    {id:'contribution',name:'Household contribution',direction:'Income',start:next,frequency:'Monthly',amount:300000},
    {id:'mortgage',name:'Mortgage',direction:'Bill',start:next,frequency:'Monthly',amount:300000,loan:'house'}
  ];
  const loan={type:'Credit card',asOf:now,rate:20,frequency:'Monthly',payment:20000,prepay:null};
  state.loans=[
    {...loan,id:'house',type:'Mortgage',balance:30000000,payment:300000},
    {...loan,id:'card',balance:300000},
    {...loan,id:'loc',type:'Line of credit',balance:900000,payment:0}
  ];
  state.config.monthlySnapshot={variable:700000, fixed:380000};
  const b=E.monthlySnapshot(state,now);
  assert.equal(b.income,900000);
  assert.equal(b.fixedRows[0].amount,300000);
  assert.equal(b.debtLoans.length,2);
  assert.equal(b.assumptions[0].assumed,17500);
  assert.equal(b.room,-217500);
  assert.equal(b.exampleVariable,432500);
  assert.equal(b.exampleRoom,50000);
  const repayment=E.monthlyDebtPlan(state,now,b,b.exampleRoom,100);
  const minimums=E.monthlyDebtPlan(state,now,b,b.exampleRoom,0,false);
  assert.ok(repayment.end<minimums.end);
  assert.ok(repayment.interest<minimums.interest);
  assert.ok(repayment.items.every(x=>x.clear>'2026-11-30'));
});

test('monthly snapshot shows expense categories and payoff milestones from the dashboard',async()=>{
  const app=boot(new URL(pageUrl));
  const dispatch=app.handlers.get('document click');
  const click=(act,id='')=>dispatch({target:{closest:()=>({dataset:{act,id}})}});
  await click('demo');
  assert.match(app.node('app').innerHTML,/Monthly Snapshot/);
  await click('nav','Monthly snapshot');
  const view=app.node('app').innerHTML;
  assert.match(view,/<h1>Monthly Snapshot<\/h1>/);
  assert.match(view,/Fixed household costs/);
  assert.match(view,/Variable living expenses/);
  assert.match(view,/Debt repayment timeline/);
});

test('combined statement descriptions stay out of categories and the normal review queue',()=>{
  const {Engine:E,ChatUpdate:C}=boot(new URL(pageUrl));
  const state=E.empty(), pack=fixture();
  const affected=pack.statements[1].transactions[4];
  affected.description='FIRST MERCHANT 102 Oct 10 Oct 11 SECOND MERCHANT';
  C.apply(state,pack,'2026-11-16');
  const bad=state.transactions.find(t=>t.description===affected.description);
  assert.equal(bad.kind,'Review');
  assert.ok(!E.reviewGroups(state).cards.some(c=>c.rows.some(t=>t.id===bad.id)));
  bad.kind='Spending';
  bad.category='Groceries';
  assert.equal(E.ledgerRows([bad])[0].kind,'Review');
  assert.ok(!E.recurringCharges(state).some(x=>x.transaction.id===bad.id));
  const repair={...bad,sourceDescription:bad.description,sourceDate:bad.date,date:'2026-10-11',description:'SECOND MERCHANT'};
  const importing=[{transaction:bad},{transaction:{...repair}}];
  E.duplicateReview([repair],importing);
  assert.ok(importing.every(r=>r.duplicate));
});
