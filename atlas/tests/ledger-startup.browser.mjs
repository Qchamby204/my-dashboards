// Slow and failed cold launches, using isolated records and simulated Home Screen insets.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/ledger-startup';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const records={'lifeledger:v2':JSON.stringify([{date:'2026-10-20',units:{Read:4},note:'Keep this saved entry'}]),'lifeledger:drafts:v1':JSON.stringify({days:{'2026-10-20':{units:{Read:7},note:'Keep this unfinished entry'}},selected:'2026-10-20',mode:'cards'})};
const ready=p=>p.waitForFunction(()=>!!window.LedgerDays&&!document.documentElement.classList.contains('ledger-starting'));
async function verify(p,view,raw=true){
 await ready(p);await p.waitForTimeout(180);
 assert.equal(await p.locator('#ledger-view-'+view).isVisible(),true,'the requested current section is the first visible screen');
 assert.deepEqual(await p.evaluate(()=>window.ledgerLaunchFrames.filter(v=>v!=='loading')), [view], 'no legacy overview or automatic section flip is painted');
 const actual=await p.evaluate(keys=>Object.fromEntries(keys.map(k=>[k,localStorage.getItem(k)])),Object.keys(records));
 assert.equal(actual['lifeledger:v2'],records['lifeledger:v2'],'saved history remains byte-for-byte intact');
 assert.deepEqual(JSON.parse(actual['lifeledger:drafts:v1']).days,JSON.parse(records['lifeledger:drafts:v1']).days,'unfinished entries survive launch and recovery');
 if(raw)assert.deepEqual(actual,records,'a launch without user actions does not rewrite saved records or preferences');
}
try{
 for(const theme of ['light','dark'])for(const scenario of ['slow-script','slow-style','levels-link','script-failure','style-failure']){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'}),p=await ctx.newPage();p.setDefaultTimeout(15000);let failing=scenario.endsWith('failure'),releaseDelay;const delayed=new Promise(resolve=>releaseDelay=resolve);
  await ctx.addInitScript(values=>{
   Object.defineProperty(navigator,'standalone',{value:true,configurable:true});for(const [key,value]of Object.entries(values))if(localStorage.getItem(key)===null)localStorage.setItem(key,value);
   window.ledgerLaunchFrames=[];
   function sample(){const app=document.getElementById('app');let state='loading';if(app?.children.length&&getComputedStyle(app).visibility!=='hidden'){state=[...document.querySelectorAll('.ledger-view')].find(n=>!n.hidden)?.id.replace('ledger-view-','')||'legacy';}if(window.ledgerLaunchFrames.at(-1)!==state)window.ledgerLaunchFrames.push(state);requestAnimationFrame(sample);}requestAnimationFrame(sample);
  },records);
  await ctx.route('**/shared/ledger-enhancements.*',async route=>{
   const file=new URL(route.request().url()).pathname.split('/').pop(),style=file.endsWith('.css');
   if(failing&&((scenario==='script-failure'&&!style)||(scenario==='style-failure'&&style))){await route.abort();return;}
   if((scenario==='slow-script'&&!style)||(scenario==='slow-style'&&style))await delayed;
   await route.fulfill({body:readFileSync(path.join(root,'shared',file)),contentType:style?'text/css':'text/javascript'});
  });
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  try{
   await p.goto(origin+'/life-ledger.html'+(scenario==='levels-link'?'#levels':''),{waitUntil:scenario.startsWith('slow-')?'commit':'domcontentloaded'});
   if(scenario.startsWith('slow-')){
    await p.locator('#app').waitFor({state:'attached'});
    if(scenario==='slow-script')await p.waitForFunction(()=>document.getElementById('app').children.length>0);
    assert.equal(await p.locator('#ledger-startup').isVisible(),true,'slow startup has a deliberate loading screen');
    assert.equal(await p.locator('#app').evaluate(n=>getComputedStyle(n).visibility),'hidden','the legacy renderer is never exposed while assets load');
    releaseDelay();
   }
   if(failing){
    await p.locator('#ledger-startup-retry').waitFor({state:'visible'});
    assert.equal(await p.locator('#app').evaluate(n=>getComputedStyle(n).visibility),'hidden','a failed load does not expose the retired dashboard');
    await p.screenshot({path:path.join(out,`startup-${scenario}-${theme}-failure.png`)});
    failing=false;await p.locator('#ledger-startup-retry').click();
   }
   await verify(p,scenario==='levels-link'?'progress':'today',!scenario.endsWith('failure'));
   await p.screenshot({path:path.join(out,`startup-${scenario}-${theme}-ready.png`)});
   if(scenario==='slow-script'){
    await p.locator('#ledger-nav-progress').click();await p.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));assert.equal(await p.locator('#ledger-view-progress').isVisible(),true,'resuming a live window preserves its selected section');
    await p.reload({waitUntil:'domcontentloaded'});await verify(p,'today',false);
   }
   reports.push({theme,scenario,passed:true,frames:await p.evaluate(()=>window.ledgerLaunchFrames)});
  }catch(e){releaseDelay();reports.push({theme,scenario,error:e.message,frames:await p.evaluate(()=>window.ledgerLaunchFrames)});await p.screenshot({path:path.join(out,`startup-${scenario}-${theme}-error.png`)});}finally{releaseDelay();await ctx.close();}
 }
 const failures=reports.filter(r=>r.error);console.log(JSON.stringify({engine,cases:reports.length,failures}));assert.equal(failures.length,0,'Ledger cold launch reveals one current section and recovers failed assets');
}finally{writeFileSync(path.join(out,'ledger-startup-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
