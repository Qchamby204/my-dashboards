import {dueOccurrences,APPS} from '../shared/reminder-core.mjs';
export const DASHBOARD_BASE='https://qchamby204.github.io/my-dashboards/';
// Push endpoints are capabilities: never accept arbitrary URLs for server fetches.
export function subscription(value){
 if(!value||typeof value.endpoint!=='string'||value.endpoint.length>2048)throw Error('Invalid push subscription.');
 const u=new URL(value.endpoint),h=u.hostname;
 const allowed=h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com';
 if(u.protocol!=='https:'||!allowed||u.username||u.password||u.port||u.hash)throw Error('Unsupported push provider.');
 if(!/^[A-Za-z0-9_-]{87}$/.test(value.keys?.p256dh||'')||! /^[A-Za-z0-9_-]{22}$/.test(value.keys?.auth||''))throw Error('Invalid push keys.');
 return {endpoint:u.href,keys:{p256dh:value.keys.p256dh,auth:value.keys.auth}};
}
export function payload(r,key){return {title:APPS[r.app].name,body:r.title,url:DASHBOARD_BASE+APPS[r.app].file,tag:key};}
export async function dispatch(db,send,now=Date.now()){
 let accepted=0,failed=0;
 for(const d of db.prepare('SELECT * FROM devices WHERE active=1').all()){
  const p=JSON.parse(d.prefs);
  for(const item of dueOccurrences(p,now,d.created)){
   if(db.prepare('SELECT 1 FROM skips WHERE device=? AND reminder=? AND day=?').get(d.id,item.reminder.id,item.date))continue;
   // Claim before I/O. An ambiguous network failure is not retried: avoid duplicate nudges.
   const claim=db.prepare("INSERT OR IGNORE INTO deliveries(device,key,day,status,at) VALUES (?,?,?,'sending',?)").run(d.id,item.key,item.date,now);
   if(!claim.changes)continue;
   const count=db.prepare("SELECT COUNT(*) AS n FROM deliveries WHERE device=? AND day=? AND key NOT LIKE '!test:%' AND status IN ('sending','accepted','unknown')").get(d.id,item.date).n;
   if(count>6){db.prepare("UPDATE deliveries SET status='daily-limit' WHERE device=? AND key=?").run(d.id,item.key);continue;}
   try{
    await send(JSON.parse(d.subscription),payload(item.reminder,item.key));
    db.prepare("UPDATE deliveries SET status='accepted' WHERE device=? AND key=?").run(d.id,item.key);accepted++;
   }catch(e){
    const expired=[404,410].includes(e.statusCode);
    db.prepare('UPDATE deliveries SET status=? WHERE device=? AND key=?').run(expired?'expired':e.statusCode?'rejected':'unknown',d.id,item.key);failed++;
    if(expired){db.prepare('UPDATE devices SET active=0 WHERE id=?').run(d.id);break;}
   }
  }
 }
 db.prepare('DELETE FROM deliveries WHERE at<?').run(now-30*86400000);
 db.prepare('DELETE FROM skips WHERE day<?').run(new Date(now-7*86400000).toISOString().slice(0,10));
 return {accepted,failed};
}
