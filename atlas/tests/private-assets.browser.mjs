// Synthetic authentication and an unavailable record API; no real user records.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import worker from '../../dist/server/index.js';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const server=createServer(async(req,res)=>{
  try{
    const url='http://127.0.0.1:'+server.address().port+req.url;
    const response=req.url.startsWith('/api/')?new Response(JSON.stringify({error:'Synthetic record service unavailable'}),{status:503,headers:{'Content-Type':'application/json'}}):await worker.fetch(new Request(url,{headers:{'oai-authenticated-user-id':'fixture-owner'}}),{});
    res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch(error){res.writeHead(500);res.end(String(error));}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true});
try{
  for(const path of ['/','/apps/life-map']){
    const page=await browser.newPage({viewport:{width:393,height:844}}),missing=[],errors=[],fonts=[];
    await page.route('https://**',route=>route.abort());
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().includes('/shared/')){if(response.status()>=400)missing.push(response.url());if(response.url().includes('/fonts/'))fonts.push(response.status());}});
    await page.goto(origin+path);await page.waitForFunction(()=>!!window.AtlasMobile&&!!window.AtlasActivity);await page.evaluate(()=>document.fonts.ready);
    assert.deepEqual(missing,[],path+' bundles all shared requests');assert.deepEqual(errors,[],path+' runtime errors');
    if(path==='/')assert(fonts.length>0&&fonts.every(status=>status===200),'private hub loads Figtree from its own authenticated origin');
    else{await page.waitForFunction(()=>!!window.CoreAppFinish);assert.match(await page.locator('#connected-status').textContent(),/Synthetic record service unavailable/,'failed record load remains explicit');}
    await page.close();
  }
  console.log(engine+': private hub and Life Map load their shared scripts/styles/fonts without missing assets');
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
