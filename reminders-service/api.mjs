import {randomUUID,timingSafeEqual} from 'node:crypto';
import {validate,localParts} from '../shared/reminder-core.mjs';
import {hash,newToken,readDevice} from './store.mjs';
import {subscription,payload} from './delivery.mjs';
const reply=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
export function createAPI({db,pairingToken,publicKey,send,origin='https://qchamby204.github.io',clock=Date.now}){
 if(!pairingToken||pairingToken.length<32)throw Error('Set a private pairing token of at least 32 characters.');
 let attempts=0,windowStart=0;
 return async function handle(req){
  const url=new URL(req.url),now=clock();
  if(url.pathname==='/health'&&req.method==='GET')return reply({ok:true});
  if(req.headers.get('origin')!==origin)return reply({error:'This origin is not allowed.'},403);
  const cors={'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS'};
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  try{
   if(url.pathname==='/config'&&req.method==='GET')return reply({publicKey},200,cors);
   let b={};
   if(['POST','PUT'].includes(req.method)){
    if(!req.headers.get('content-type')?.startsWith('application/json'))return reply({error:'Send JSON.'},415,cors);
    const raw=await req.text();if(raw.length>30000)return reply({error:'Request too large.'},413,cors);b=JSON.parse(raw);
   }
   if(url.pathname==='/devices'&&req.method==='POST'){
    if(now-windowStart>60000){attempts=0;windowStart=now;}if(++attempts>20)return reply({error:'Too many pairing attempts. Try again in a minute.'},429,cors);
    if(typeof b.pairingToken!=='string'||!timingSafeEqual(Buffer.from(hash(b.pairingToken)),Buffer.from(hash(pairingToken))))return reply({error:'Check your private pairing code.'},401,cors);
    const sub=subscription(b.subscription),prefs=validate(b.prefs);
    const existing=db.prepare('SELECT id FROM devices WHERE subscription=?').get(JSON.stringify(sub));
    if(!existing&&db.prepare('SELECT COUNT(*) AS n FROM devices').get().n>=10)return reply({error:'Device limit reached. Remove an old device first.'},409,cors);
    const id=existing?.id||randomUUID(),token=newToken();
    // Re-pairing replaces this same subscription, preventing duplicate deliveries.
    db.prepare('INSERT INTO devices(id,token_hash,subscription,prefs,created,updated) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET token_hash=excluded.token_hash,prefs=excluded.prefs,updated=excluded.updated,revision=devices.revision+1,active=1').run(id,hash(token),JSON.stringify(sub),JSON.stringify(prefs),now,now);
    return reply({token,...state(db,id)},201,cors);
   }
   const token=req.headers.get('authorization')?.replace(/^Bearer /,''),device=readDevice(db,token);
   if(!device)return reply({error:'Pair this device to manage its reminders.'},401,cors);
   if(url.pathname==='/device'&&req.method==='GET')return reply(state(db,device.id),200,cors);
   if(url.pathname==='/device'&&req.method==='PUT'){
    const prefs=validate(b.prefs);
    const r=db.prepare('UPDATE devices SET prefs=?,revision=revision+1,updated=? WHERE id=? AND revision=?').run(JSON.stringify(prefs),now,device.id,b.revision);
    if(!r.changes)return reply({error:'Settings changed elsewhere. Reload before saving.'},409,cors);
    return reply(state(db,device.id),200,cors);
   }
   if(url.pathname==='/device'&&req.method==='DELETE'){db.prepare('DELETE FROM devices WHERE id=?').run(device.id);return reply({removed:true},200,cors);}
   if(url.pathname==='/skip'&&req.method==='POST'){
    const p=JSON.parse(device.prefs);if(!p.reminders.some(r=>r.id===b.id))throw Error('Reminder not found.');
    const day=localParts(now,p.timezone).date;
    db.prepare('INSERT OR IGNORE INTO skips(device,reminder,day) VALUES (?,?,?)').run(device.id,b.id,day);
    return reply({skipped:true,day},200,cors);
   }
   if(url.pathname==='/test'&&req.method==='POST'){
    if(!device.active)return reply({error:'This subscription expired. Pair again.'},409,cors);
    if(db.prepare("SELECT 1 FROM deliveries WHERE device=? AND key LIKE 'test:%' AND at>?").get(device.id,now-60000))return reply({error:'Wait a minute before sending another test.'},429,cors);
    const key='test:'+now;
    db.prepare("INSERT INTO deliveries(device,key,day,status,at) VALUES (?,?,?,'sending',?)").run(device.id,key,localParts(now,JSON.parse(device.prefs).timezone).date,now);
    try{await send(JSON.parse(device.subscription),payload({app:'life-map',title:'Reminders are connected. Tap to open Life Map.'},key));}
    catch(e){db.prepare("UPDATE deliveries SET status='failed' WHERE device=? AND key=?").run(device.id,key);if([404,410].includes(e.statusCode))db.prepare('UPDATE devices SET active=0 WHERE id=?').run(device.id);return reply({error:'Test was not confirmed. Check connection and pair again if needed.'},502,cors);}
    db.prepare("UPDATE deliveries SET status='accepted' WHERE device=? AND key=?").run(device.id,key);return reply({accepted:true},200,cors);
   }
   return reply({error:'Not found.'},404,cors);
  }catch{ return reply({error:'Could not save this request. Check the fields and try again.'},400,cors); }
 };
}
function state(db,id){const d=db.prepare('SELECT * FROM devices WHERE id=?').get(id);return {prefs:JSON.parse(d.prefs),revision:d.revision,active:!!d.active,history:db.prepare('SELECT key,status,at FROM deliveries WHERE device=? ORDER BY at DESC LIMIT 10').all(id)};}
