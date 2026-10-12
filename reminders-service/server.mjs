import {createServer} from 'node:http';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import webpush from 'web-push';
import {openStore} from './store.mjs';
import {createAPI} from './api.mjs';
import {dispatch} from './delivery.mjs';
const file=process.env.REMINDER_DB;
if(!file?.startsWith('/'))throw Error('Set REMINDER_DB to an absolute path on a persistent disk.');
mkdirSync(dirname(file),{recursive:true});
const db=openStore(file);
let keys=db.prepare("SELECT value FROM settings WHERE key='vapid'").get();
if(!keys){db.prepare("INSERT INTO settings(key,value) VALUES ('vapid',?)").run(JSON.stringify(webpush.generateVAPIDKeys()));keys=db.prepare("SELECT value FROM settings WHERE key='vapid'").get();}
const vapid=JSON.parse(keys.value);
if(!/^mailto:.+@.+/.test(process.env.VAPID_SUBJECT||''))throw Error('Set VAPID_SUBJECT to an operator contact email.');
webpush.setVapidDetails(process.env.VAPID_SUBJECT,vapid.publicKey,vapid.privateKey);
const send=(sub,data)=>webpush.sendNotification(sub,JSON.stringify(data),{TTL:600,urgency:'normal',timeout:10000});
const handle=createAPI({db,pairingToken:process.env.PAIRING_TOKEN,publicKey:vapid.publicKey,send});
const server=createServer(async(req,res)=>{
 try{
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>30000){res.writeHead(413);res.end();return;}chunks.push(chunk);}
  const method=req.method,body=['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks);
  const response=await handle(new Request('https://reminders.invalid'+req.url,{method,headers:req.headers,body}));
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
 }catch{res.writeHead(500,{'Content-Type':'application/json'});res.end('{"error":"Service unavailable."}');}
});
let busy=false;
async function tick(){if(busy)return;busy=true;try{await dispatch(db,send);}catch{console.error('Reminder dispatch failed; check service health.');}finally{busy=false;}}
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>{console.log('Reminder service started.');void tick();});
const timer=setInterval(tick,30000);
process.on('SIGTERM',()=>{clearInterval(timer);server.close(()=>{db.close();process.exit(0);});});
