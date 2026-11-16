'use strict';

const cachePrefix = 'aqueduct-household-shell-';
const cacheName = cachePrefix+'__SHELL_VERSION__';
const shell = self.registration.scope;
const files = [shell, ...['aqueduct-assets/manifest.webmanifest','aqueduct-assets/icon.png']
  .map(file=>new URL(file,shell).href), ...__ICONS_URLS__];

self.addEventListener('install', event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(files.map(url=>new Request(url,{cache:'reload'})))));
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
