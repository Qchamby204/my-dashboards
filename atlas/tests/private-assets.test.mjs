import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import worker from '../../dist/server/index.js';
import {connected,hub,css} from '../../dist/server/assets.mjs';
const request=path=>worker.fetch(new Request('https://atlas.test'+path,{headers:{'oai-authenticated-user-id':'fixture-owner'}}),{});
test('private entry points and conditional chrome dependencies have authenticated asset routes',async()=>{
  const paths=new Set(['/shared/atlas-activity.js']);
  for(const html of [hub,...Object.values(connected).filter(([,type])=>type.startsWith('text/html')).map(([body])=>body)]){
    for(const match of html.matchAll(/(?:src|href)="(\/(?:shared|connected)\/[^"?]+)(?:\?[^" ]*)?"/g))paths.add(match[1]);
  }
  for(const path of paths){const response=await request(path);assert.equal(response.status,200,path);assert.match(response.headers.get('content-type'),/text\/(?:javascript|css)/,path);}
});
test('private fonts retain exact bytes, load from self, and remain behind authentication',async()=>{
  for(const weight of [400,600,700]){
    const path='/shared/fonts/figtree-'+weight+'.ttf',response=await request(path);
    assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'font/ttf');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array(readFileSync(new URL('../../'+path.slice(1),import.meta.url))));
    assert.equal((await worker.fetch(new Request('https://atlas.test'+path),{})).status,302);
    assert.equal((await worker.fetch(new Request('https://atlas.test'+path,{method:'HEAD',headers:{'oai-authenticated-user-id':'fixture-owner'}}),{})).body,null);
  }
  for(const style of [css,...Object.values(connected).filter(([,type])=>type.startsWith('text/css')).map(([body])=>body)]){
    assert.doesNotMatch(style,/https:\/\/qchamby204\.github\.io\/my-dashboards\/shared\/fonts\//);
  }
});
