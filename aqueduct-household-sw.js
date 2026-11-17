'use strict';

const cachePrefix = 'aqueduct-household-shell-';
const cacheName = cachePrefix+'eec91dc75435';
const shell = self.registration.scope;
const files = [shell, ...['aqueduct-assets/manifest.webmanifest','aqueduct-assets/icon.png']
  .map(file=>new URL(file,shell).href), ...["https://qchamby204.github.io/my-dashboards/shared/icons/the-aqueduct-32.png?v=0ec83fb69b5b","https://qchamby204.github.io/my-dashboards/shared/icons/the-aqueduct-64.png?v=ae9872b962dc","https://qchamby204.github.io/my-dashboards/shared/icons/the-aqueduct-apple.png?v=f7ba29485dca"]];

self.addEventListener('install', event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
});

self.addEventListener('activate', event=>{
  event.waitUntil((async()=>{
    for(const name of await caches.keys()){
      if(name.startsWith(cachePrefix)&&name!==cacheName) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event=>{
  const {request}=event;
  if(request.method!=='GET'||!files.includes(request.url))return;
  event.respondWith((async()=>{
    const cache=await caches.open(cacheName);
    // Use only the pre-cached app code and icons. Never persist user requests.
    const cached=await cache.match(request.url);
    return cached||fetch(request);
  })());
});
