const ASSETS=["index.html","manifest.json","favicon.svg","assets/dashboard-B7VtMk3p.css","assets/dashboard-Bw2yZ2Ix.js","assets/framework-DMp2t5-j.js","assets/planning-model-BedqVdkq.js","assets/planning-screens-CTFF5B_F.css","assets/planning-screens-iR6Gh4Wo.js"];
const PREFIX='northplan-dashboard:'+self.registration.scope;
const CACHE=PREFIX+'a4a8722855a4';
const url=path=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url)))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,requestUrl=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||requestUrl.origin!==scope.origin||!requestUrl.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate')event.respondWith((async()=>{try{return await fetch(request);}catch{return await caches.match(url('index.html'))||new Response('Reconnect to open NorthPlan.',{status:503});}})());
 else if(ASSETS.map(url).includes(requestUrl.origin+requestUrl.pathname))event.respondWith((async()=>await caches.match(request)||fetch(request))());
});
