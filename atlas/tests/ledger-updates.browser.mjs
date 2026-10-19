// Exercise a release appearing while a Ledger document stays open.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),html=readFileSync(path.join(root,'life-ledger.html'),'utf8');
const out=process.env.ATLAS_SCREENSHOTS||'/tmp/ledger-updates';mkdirSync(out,{recursive:true});
const current=JSON.parse(html.match(/id="atlas-runtime-assets">([^<]+)/)[1])['ledger-enhancements.js'],next=current==='abcdef012345'?'012345abcdef':'abcdef012345';
let published=current,checkMode='valid',checks=0;
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf'};
const server=createServer((req,res)=>{try{
 const url=new URL(req.url,'http://test'),file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))throw Error();
 res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');
 if(url.pathname==='/life-ledger.html'){
  if(url.searchParams.has('ledger-check')){checks++;if(checkMode==='offline'){res.writeHead(503);res.end();return;}if(checkMode==='invalid'){res.end('<html><body>Sign in</body></html>');return;}}
  const version=url.searchParams.get('ledger-release')|| (url.searchParams.has('ledger-check')?published:current);
  res.end(html.replace('"ledger-enhancements.js":"'+current+'"','"ledger-enhancements.js":"'+version+'"'));return;
 }
 res.end(readFileSync(file));
}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:393,height:852},colorScheme:'dark',reducedMotion:'reduce'});
 await context.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
 const records=JSON.stringify([{date:'2026-10-18',units:{Read:30},note:'Keep this record'}]);
 await context.addInitScript(value=>{if(localStorage.getItem('lifeledger:v2')===null)localStorage.setItem('lifeledger:v2',value);},records);
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const firstCheck=page.waitForResponse(r=>r.url().includes('ledger-check'));
 await page.goto(origin+'/life-ledger.html#levels');await page.waitForFunction(()=>!!window.LedgerDays);await firstCheck;
 assert(await page.locator('#ledger-lifetime-levels').isVisible());assert.equal(checks,1);
 const checkManually=async()=>{await page.locator('#ledger-nav-history').click();await page.locator('#ledger-reminder-tools>summary').click();await page.getByRole('button',{name:'Check for updates',exact:true}).click();};
 checkMode='offline';await checkManually();await page.getByText('Updates could not be checked. Your current Ledger is still available.',{exact:true}).waitFor();assert.equal(await page.locator('#ledger-release-notice').count(),0);
 checkMode='invalid';const invalidCheck=page.waitForResponse(r=>r.url().includes('ledger-check'));await page.getByRole('button',{name:'Check for updates',exact:true}).click();await invalidCheck;assert.equal(await page.locator('#ledger-release-notice').count(),0);
 checkMode='valid';published=next;
 await page.evaluate(()=>{state.draftNote='Unfinished thought';window.LedgerDays.remember();Date.now=(()=>{const original=Date.now;return ()=>original()+61000;})();window.dispatchEvent(new Event('pageshow'));});
 await page.getByRole('button',{name:'Refresh Ledger',exact:true}).waitFor();assert.equal(new URL(page.url()).search,'','finding an update never navigates automatically');
 await page.locator('#ledger-nav-progress').click();assert(await page.locator('#ledger-release-notice').isVisible(),'notice survives section renders');
 const checked=checks;await page.evaluate(()=>{for(let i=0;i<3;i++)window.dispatchEvent(new Event('pageshow'));});assert.equal(checks,checked,'repeated resumes are throttled');
 await page.screenshot({path:path.join(out,'ledger-update-ready.png')});
 await page.setViewportSize({width:320,height:852});const largerText=await page.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
 assert(await page.locator('#ledger-release-notice').evaluate(node=>{const b=node.getBoundingClientRect(),button=node.querySelector('button').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&button.left>=b.left&&button.right<=b.right+1&&button.height>=44;}),'update action fits at narrow width and doubled text');
 await page.screenshot({path:path.join(out,'ledger-update-large-text.png')});await largerText.evaluate(node=>node.remove());await page.setViewportSize({width:393,height:852});
 // Failed persistence must keep the old document and the in-memory draft.
 await page.evaluate(()=>{window.originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='lifeledger:drafts:v1')throw Error('Quota');return window.originalSetItem.call(this,key,value);};state.draftNote='Keep this even if saving fails';window.LedgerDays.remember();});
 await page.getByRole('button',{name:'Refresh Ledger',exact:true}).click();await page.getByText('Save or back up your current work before refreshing Ledger.',{exact:true}).waitFor();assert.equal(new URL(page.url()).search,'');assert.equal(await page.evaluate(()=>state.draftNote),'Keep this even if saving fails');
 await page.evaluate(async()=>{Storage.prototype.setItem=window.originalSetItem;await window.LedgerDays.retry();});
 // Wait for a verified pending write before replacing the document.
 await page.evaluate(()=>{const original=navigator.locks.request.bind(navigator.locks);navigator.locks.request=async(...args)=>{await new Promise(r=>window.releaseSave=r);return original(...args);};state.draftNote='A draft kept through the update';});
 await page.getByRole('button',{name:'Refresh Ledger',exact:true}).click();await page.waitForFunction(()=>typeof window.releaseSave==='function');assert.equal(new URL(page.url()).search,'');
 await page.evaluate(()=>window.releaseSave());await page.waitForURL('**/life-ledger.html?ledger-release='+next+'#levels');await page.waitForFunction(()=>!!window.LedgerDays);
 assert(await page.locator('#ledger-lifetime-levels').isVisible(),'refresh returns to the same section');assert.equal(await page.evaluate(()=>localStorage.getItem('lifeledger:v2')),records);
 assert.equal(await page.evaluate(()=>window.LedgerDays.drafts.days[new Date().toLocaleDateString('en-CA')].note),'A draft kept through the update');
 assert.equal(await page.locator('.ledger-day-progress').count(),0);assert.equal(await page.locator('.ledger-feature').count(),3);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,'ledger-updated-levels.png')});
 console.log(engine+': Ledger update detection, offline/invalid responses, failed/pending saves, section return and record preservation passed');await context.close();
}finally{await browser.close();await new Promise(r=>server.close(r));}
