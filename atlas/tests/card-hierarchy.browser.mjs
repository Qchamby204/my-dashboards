// Reproduce the reported iPhone layouts, including scroll positions and populated records.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/card-hierarchy';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function settle(p){await p.waitForTimeout(220);await p.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]));}
async function capture(p,name,theme,w,size,locator=null){await settle(p);const errors=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1}));assert(!errors.overflow,name+' fits the viewport');const file=name+'-'+theme+'-'+w+'-'+size+'.png';if(locator)await locator.screenshot({path:path.join(out,file),timeout:15000});else await p.screenshot({path:path.join(out,file),timeout:15000});reports.push({name,theme,width:w,textSize:size,engine,...errors});}
try{
 for(const [theme,w,h,size]of [['light',393,852,16],['dark',393,852,16],['dark',320,740,16],['dark',393,852,20],['dark',852,393,16]]){
  const c=await browser.newContext({viewport:{width:w,height:h},userAgent:ua,isMobile:true,hasTouch:true,colorScheme:theme,timezoneId:'America/Winnipeg',reducedMotion:'reduce'});
  await c.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
  await c.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  const p=await c.newPage();p.setDefaultTimeout(10000);const runtime=[];p.on('pageerror',e=>runtime.push(e.message));
  async function open(file,hash=''){await p.goto(origin+'/'+file+'.html'+hash,{waitUntil:'domcontentloaded'});await settle(p);if(size!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});}
  await open('the-chef');
  assert(await p.locator('#ing-cats').evaluate(n=>{const rows=[...n.children].map(x=>x.getBoundingClientRect());return rows.every((r,i)=>!i||r.top-rows[i-1].bottom>=11);}), 'ingredient groups have separate rows');
  await p.locator('#ing-cats').scrollIntoViewIfNeeded();await capture(p,'chef-ingredients',theme,w,size);
  await p.locator('#ing-cats summary').first().click();await settle(p);assert(await p.locator('#ing-cats details').first().evaluate(n=>n.open));
  await open('the-chef','#mood');
  const card=p.locator('.recipe-card').first();assert(await card.isVisible());assert.match(await card.locator('.recipe-facts').textContent(),/Time.*Yield/s);
  assert(await card.evaluate(n=>getComputedStyle(n).backgroundColor!==getComputedStyle(document.body).backgroundColor),'recipe surface is distinct');
  await capture(p,'chef-recipe',theme,w,size,card);
  await card.locator('details.more').last().locator('summary').click();await capture(p,'chef-recipe-expanded',theme,w,size,card);
  await card.locator('[data-cook]').click();assert(await p.locator('dialog[open]').isVisible(),'recipe opens cooking view');await p.keyboard.press('Escape');
  await open('life-ledger');
  assert.equal(await p.locator('.ledger-save-row #ledger-quick-reset').count(),0,'reset is separate from saving');assert(await p.locator('.ledger-reset-row #ledger-quick-reset').count());
  assert(await p.locator('.ledger-card-heading').first().evaluate(n=>{const r=n.getBoundingClientRect();return r.width>200&&r.height>=44;}),'activity heading uses the card width');
  const active=p.locator('.ledger-habit-card[aria-hidden="false"]');await capture(p,'ledger-activity',theme,w,size,active);
  await p.locator('.ledger-reset-row').scrollIntoViewIfNeeded();await capture(p,'ledger-save-dock',theme,w,size);
  await p.locator('#ledger-quick-reset').click();assert(await p.locator('#ledger-reset-sheet').isVisible());await p.keyboard.press('Escape');
  await open('life-map');await p.locator('.daily-chips').scrollIntoViewIfNeeded();
  assert(await p.locator('.daily-chips a').evaluateAll(ns=>ns.every(n=>['inline-flex','flex'].includes(getComputedStyle(n).display)&&parseFloat(getComputedStyle(n).paddingLeft)>=18)),'links have complete padded targets');await capture(p,'life-map-actions',theme,w,size);
  await open('communication-trainer');assert(await p.locator('.atlas-goal-options').evaluate(n=>parseFloat(getComputedStyle(n).rowGap)>=12));await capture(p,'communicator-choices',theme,w,size);
  await open('the-library');
  const raw=await p.evaluate(()=>{const raw=localStorage.getItem('atlas.library.v1');return raw;});
  if(await p.locator('[data-action="choose-goal"]').count())await p.locator('[data-action="choose-goal"]').first().click();
  await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('atlas.library.v1'));const b=s.catalog[0];s.progress[b.id]={status:'reading',takeaway:'',notes:'',questions:'',application:'',completedAt:''};localStorage.setItem('atlas.library.v1',JSON.stringify(s));});
  await p.reload();await settle(p);if(size!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});
  if(w<h)assert(await p.locator('.topbar').evaluate(n=>parseFloat(getComputedStyle(n).paddingTop)>=64),'standalone header clears the status area');
  assert(await p.locator('.stat').evaluateAll(ns=>ns.every(n=>getComputedStyle(n,'::after').display==='none')),'stat decorations cannot cross text');
  await p.locator('.stats').scrollIntoViewIfNeeded();await capture(p,'library-stats',theme,w,size);
  assert(await p.locator('.continue-book .book-title').first().evaluate(n=>getComputedStyle(n).boxShadow==='none'&&parseFloat(getComputedStyle(n).borderTopWidth)===0),'book title is a text control');
  await capture(p,'library-reading-record',theme,w,size,p.locator('.continue-book').first());
  assert.deepEqual(runtime,[]);await c.close();
 }
 console.log(JSON.stringify({views:reports.length,engine,failures:0}));
}finally{writeFileSync(path.join(out,'card-hierarchy-audit.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
