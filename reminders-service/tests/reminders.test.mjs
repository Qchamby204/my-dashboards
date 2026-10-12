import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'web-push';
import {defaults,validate,dueOccurrences,quietAt} from '../../shared/reminder-core.mjs';
import {openStore} from '../store.mjs';
import {dispatch,subscription} from '../delivery.mjs';
import {createAPI} from '../api.mjs';
const origin='https://qchamby204.github.io',pairingToken='a'.repeat(40);
const key=createECDH('prime256v1');key.generateKeys();
const sub={endpoint:'https://web.push.apple.com/test-subscription',keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};
const morning=Date.parse('2026-10-13T13:00:00Z');
async function fixture(send=async()=>{},path=':memory:'){
 const db=openStore(path);let now=morning-3600000;
 const api=createAPI({db,pairingToken,publicKey:'public',send,clock:()=>now});
 async function req(path,method='GET',data,token){const res=await api(new Request('https://service.test'+path,{method,headers:{origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:data?JSON.stringify(data):undefined}));return {status:res.status,body:await res.json()};}
 const enrolled=await req('/devices','POST',{pairingToken,subscription:sub,prefs:defaults()});assert.equal(enrolled.status,201);
 return {db,req,token:enrolled.body.token,setNow:n=>now=n};
}
test('validates recurrence and rejects impossible dates, unknown apps and duplicate IDs',()=>{
 const p=defaults();assert.deepEqual(validate(p),p);
 for(const edit of [p=>p.reminders[0].date='2026-02-30',p=>p.reminders[0].days=[],p=>p.reminders[0].app='__proto__',p=>p.reminders.push(p.reminders[0]),p=>p.timezone='Moon',p=>p.quietEnd='24:00']){const p=defaults();edit(p);assert.throws(()=>validate(p));}
});
test('Winnipeg due time observes daylight saving and bounded catchup',()=>{
 assert.equal(dueOccurrences(defaults(),morning).length,1);
 assert.equal(dueOccurrences(defaults(),morning+11*60000).length,0);
 assert.equal(dueOccurrences(defaults(),Date.parse('2026-12-01T14:00:00Z')).length,1);
 assert.equal(dueOccurrences(defaults(),morning,morning+1).length,0);
});
test('quiet hours, pause, one-time dates and weekdays',()=>{
 const p=defaults();assert(quietAt('22:00',p));assert(quietAt('07:29',p));assert(!quietAt('07:30',p));
 p.paused=true;assert.equal(dueOccurrences(p,morning).length,0);p.paused=false;
 p.reminders[0].date='2026-10-14';assert.equal(dueOccurrences(p,morning).length,0);
 p.reminders[0].date='2026-10-13';assert.equal(dueOccurrences(p,morning).length,1);
 p.quietStart='08:00';p.quietEnd='09:00';assert.equal(dueOccurrences(p,morning).length,0);
});
test('DST fall-back duplicate hours share one occurrence key; spring gap is skipped',()=>{
 const p=defaults();p.quietStart=p.quietEnd='00:00';p.reminders[0].time='01:30';
 const first=dueOccurrences(p,Date.parse('2026-11-01T06:30:00Z'))[0];
 const second=dueOccurrences(p,Date.parse('2026-11-01T07:30:00Z'))[0];assert.equal(first.key,second.key);
 p.reminders[0].time='02:30';assert.equal(dueOccurrences(p,Date.parse('2026-03-08T08:30:00Z')).length,0);
});
test('endpoint validation blocks localhost, attacker suffixes and malformed keys',()=>{
 assert.equal(subscription(sub).endpoint,sub.endpoint);
 for(const endpoint of ['http://web.push.apple.com/a','https://localhost/a','https://web.push.apple.com.evil.test/a','https://127.0.0.1/a','https://web.push.apple.com:8443/a'])assert.throws(()=>subscription({...sub,endpoint}));
 assert.throws(()=>subscription({...sub,keys:{auth:'x',p256dh:'x'}}));
});
test('pairing and device access are authenticated; tokens are hashed in storage',async()=>{
 const f=await fixture();assert.equal((await f.req('/device')).status,401);
 assert.equal((await f.req('/devices','POST',{pairingToken:'bad',subscription:sub,prefs:defaults()})).status,401);
 assert.equal((await f.req('/device','GET',undefined,f.token)).status,200);
 assert(!JSON.stringify(f.db.prepare('SELECT * FROM devices').all()).includes(f.token));f.db.close();
});
test('wrong origin denied even with valid credential',async()=>{
 const f=await fixture();const api=createAPI({db:f.db,pairingToken,publicKey:'public',send:async()=>{}});
 const res=await api(new Request('https://service.test/device',{headers:{origin:'https://evil.test',Authorization:'Bearer '+f.token}}));assert.equal(res.status,403);f.db.close();
});
test('schedule save uses revision checks and rejects stale overwrite',async()=>{
 const f=await fixture(),p=defaults();p.paused=true;
 assert.equal((await f.req('/device','PUT',{prefs:p,revision:1},f.token)).status,200);
 assert.equal((await f.req('/device','PUT',{prefs:defaults(),revision:1},f.token)).status,409);
 assert((await f.req('/device','GET',undefined,f.token)).body.prefs.paused);f.db.close();
});
test('re-pairing same subscription replaces device credential without duplicates',async()=>{
 const f=await fixture();const r=await f.req('/devices','POST',{pairingToken,subscription:sub,prefs:defaults()});assert.equal(r.status,201);
 assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM devices').get().n,1);
 assert.equal((await f.req('/device','GET',undefined,f.token)).status,401);f.db.close();
});
test('dispatch claims persist across repeated runs and service restarts',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'reminders-')),path=join(dir,'data.sqlite');let calls=0;const send=async()=>{calls++;};
 const f=await fixture(send,path);await dispatch(f.db,send,morning);await dispatch(f.db,send,morning+30000);f.db.close();
 const db=openStore(path);await dispatch(db,send,morning+60000);assert.equal(calls,1);db.close();rmSync(dir,{recursive:true});
});
test('skip today suppresses only that reminder on that date',async()=>{
 const f=await fixture();f.setNow(morning);assert.equal((await f.req('/skip','POST',{id:'morning'},f.token)).status,200);
 let calls=0;await dispatch(f.db,async()=>calls++,morning);assert.equal(calls,0);await dispatch(f.db,async()=>calls++,morning+86400000);assert.equal(calls,1);f.db.close();
});
test('expired subscriptions stop and uncertain sends are not retried',async()=>{
 for(const statusCode of [410,undefined]){const f=await fixture();let calls=0;const send=async()=>{calls++;throw Object.assign(Error(),{statusCode});};await dispatch(f.db,send,morning);await dispatch(f.db,send,morning+60000);assert.equal(calls,1);assert.equal(f.db.prepare('SELECT active FROM devices').get().active,statusCode?0:1);f.db.close();}
});
test('test push is rate-limited and reports acceptance, not receipt',async()=>{
 const f=await fixture();assert.equal((await f.req('/test','POST',{},f.token)).body.accepted,true);assert.equal((await f.req('/test','POST',{},f.token)).status,429);f.db.close();
});
test('disconnect deletes subscription and all delivery records',async()=>{
 const f=await fixture();await dispatch(f.db,async()=>{},morning);assert.equal((await f.req('/device','DELETE',undefined,f.token)).body.removed,true);assert.equal(f.db.prepare('SELECT COUNT(*) AS n FROM deliveries').get().n,0);assert.equal((await f.req('/device','GET',undefined,f.token)).status,401);f.db.close();
});
test('maximum six scheduled notifications per day',async()=>{
 const f=await fixture(),p=defaults();p.reminders=Array.from({length:8},(_,i)=>({...p.reminders[0],id:'r'+i}));await f.req('/device','PUT',{prefs:p,revision:1},f.token);let n=0;await dispatch(f.db,async()=>n++,morning);assert.equal(n,6);f.db.close();
});
test('real web-push library encrypts payload with VAPID and a bounded TTL',()=>{
 const keys=webpush.generateVAPIDKeys();const request=webpush.generateRequestDetails(sub,JSON.stringify({title:'Test'}),{TTL:600,vapidDetails:{subject:'mailto:operator@example.com',publicKey:keys.publicKey,privateKey:keys.privateKey}});
 assert.equal(request.headers.TTL,600);assert(request.headers.Authorization.startsWith('vapid '));assert(Buffer.isBuffer(request.body));assert(!request.body.toString().includes('Test'));
});
