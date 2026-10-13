// Push only: never intercept dashboard fetches or cache private records.
self.addEventListener('push',event=>{
 let p;try{p=event.data.json();}catch{p={};}
 const allowed=['life-map.html','the-library.html','life-ledger.html','workout-forge.html','communication-trainer.html','the-chef.html','reminders.html'];
 const base=new URL('./',self.location.href);let url=new URL('reminders.html',base);
 try{const candidate=new URL(p.url);if(candidate.origin===base.origin&&allowed.some(file=>candidate.pathname===base.pathname+file)&&!candidate.search&&!candidate.hash)url=candidate;}catch{}
 event.waitUntil(self.registration.showNotification(String(p.title||'Atlas Reminders').slice(0,80),{body:String(p.body||'Open your reminders.').slice(0,160),tag:String(p.tag||'atlas-reminder').slice(0,160),icon:new URL('shared/icons/reminders-192.png?v=ae55f7e82aa3',base).href,data:{url:url.href}}));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{const url=event.notification.data?.url||new URL('reminders.html',self.location.href).href;const open=await self.clients.matchAll({type:'window',includeUncontrolled:true});const client=open.find(c=>c.url===url);if(client)return client.focus();return self.clients.openWindow(url);})());
});
