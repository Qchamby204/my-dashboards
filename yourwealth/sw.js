const ASSETS=["index.html","manifest.json","favicon.svg","assets/framework-DMp2t5-j.js","assets/yourwealth-dashboard-CgysDn22.css","assets/yourwealth-dashboard-DqkVeOa5.js"];
const PREFIX='yourwealth-dashboard:'+self.registration.scope;
const CACHE=PREFIX+'9ed2e92deef9';
const url=path=>new URL(path,self.registration.scope).href;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS.map(url)))));
self.addEventListener('message',event=>{if(event.data?.type==='ACTIVATE_UPDATE')self.skipWaiting();});
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const request=event.request,requestUrl=new URL(request.url),scope=new URL(self.registration.scope);
 if(request.method!=='GET'||requestUrl.origin!==scope.origin||!requestUrl.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate')event.respondWith((async()=>{try{return await fetch(request);}catch{return await caches.match(url('index.html'))||new Response('Reconnect to open YourWealth.',{status:503});}})());
 else if(ASSETS.map(url).includes(requestUrl.origin+requestUrl.pathname))event.respondWith((async()=>await caches.match(request)||fetch(request))());
});
