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
    if(!nodes.has(id)) nodes.set(id,{innerHTML:'',querySelector:node,addEventListener(type,callback){handlers.set([id,type].join(' '),callback);}});
    return nodes.get(id);
  };
  const window={addEventListener(){}};
  window.top=framed?{}:window;
  const context={window,location,crypto:webcrypto,TextEncoder,TextDecoder,Blob,btoa,atob,URL,
    setInterval(){},setTimeout(){},clearTimeout(){},structuredClone,
    document:{getElementById:node,addEventListener(){}},
    localStorage:{getItem:k=>data.get(k)??null,setItem:(k,v)=>{data.set(k,v);}},
    navigator:{serviceWorker:{register(path,opts){registrations.push([path,opts.scope]);return Promise.resolve();}}}};
  runInNewContext(script+'\nglobalThis.api={Engine,Vault};',context);
  return {html:node('app').innerHTML,registrations,data,...context.api};
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
    self:{registration:{scope:pageUrl},clients:{claim:async()=>{}},addEventListener:(kind,fn)=>{events[kind]=fn;}},
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
