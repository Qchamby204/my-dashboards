// Isolated browser evidence. This does not claim physical iPhone or VoiceOver verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/suite-accessibility';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];

const apps=['life-ledger','life-map','workout-forge','communication-trainer','the-aqueduct','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-chef','the-library','baby-brain','neural-map'];
async function audit(p,app,view,theme){
 const result=await p.evaluate(()=>{
  const visible=n=>{for(let a=n.parentElement;a;a=a.parentElement)if(a.tagName==='DETAILS'&&!a.open&&!a.querySelector(':scope>summary')?.contains(n))return false;const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&!n.closest('[hidden],[inert],[aria-hidden="true"]');};
  const text=n=>{const c=n.cloneNode(true);c.querySelectorAll('[aria-hidden="true"],svg').forEach(x=>x.remove());return c.textContent.trim().replace(/\s+/g,' ');};
  const name=n=>n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')?.split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ')||[...(n.labels||[])].map(text).join(' ')||n.getAttribute('title')||(['button','submit','reset'].includes(n.type)?n.value:'')||(['BUTTON','A','SUMMARY'].includes(n.tagName)||n.getAttribute('role')==='button'?text(n):'');
  let checked=0;const issues=[];
  for(const n of document.querySelectorAll('button,a[href],summary,input:not([type="hidden"]),select,textarea,[role="button"],[onclick]')){
   if(!visible(n)||n.disabled)continue;checked++;
   const label=name(n),r=n.getBoundingClientRect(),tag=n.tagName.toLowerCase(),key=n.id?'#'+n.id:tag+(n.className?'.'+String(n.className).trim().replace(/\s+/g,'.'):''),row={control:key,name:label.slice(0,100)};
   if(!label.trim()||/^[×✕+−⌂◐◑⋮⋯☰<>‹›←→↑↓✓✎]+$/.test(label.trim()))issues.push({...row,problem:'accessible name'});
   if(n.hasAttribute('onclick')&&!['BUTTON','A','INPUT','SELECT','TEXTAREA','SUMMARY'].includes(n.tagName)&&!(n.tabIndex>=0&&n.getAttribute('role')==='button'))issues.push({...row,problem:'keyboard semantics'});
   let target=r;if(['checkbox','radio'].includes(n.type)){const labels=[...(n.labels||[])].filter(visible);if(labels.length)target=labels[0].getBoundingClientRect();}
   // Inline prose links use the WCAG inline-target exception; report the other controls at 44px.
   const inlineLink=tag==='a'&&getComputedStyle(n).display==='inline';
   if(!inlineLink&&(target.width<43.5||target.height<43.5))issues.push({...row,problem:'target size',width:Math.round(target.width),height:Math.round(target.height)});
  }
  return {checked,issues};
 });reports.push({app,view,theme,engine,...result});
}
async function frames(p){await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
try{
 for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce'});
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  for(const app of apps){
   const p=await ctx.newPage();p.setDefaultTimeout(12000);
   try{
    await p.goto(origin+'/'+app+'.html');await p.waitForFunction(()=>!!window.AtlasPageNavigation&&document.documentElement.classList.contains('atlas-page-navigation'));await p.evaluate(()=>document.fonts.ready);
    const native=app==='life-ledger'?'.ledger-nav':app==='life-map'?'.lm-day-dock':null;
    const entries=await p.locator(native?native+' button':'#atlas-page-menu [data-page-key],#atlas-page-navigation [data-page-key]').evaluateAll(ns=>[...new Set(ns.map(n=>n.id||n.dataset.pageKey))]);
    await audit(p,app,'initial',theme);
    for(const key of entries){
     if(native)await p.locator('#'+key).click();
     else{
      const primary=p.locator('#atlas-page-navigation [data-page-key]:visible');
      const direct=await primary.evaluateAll((ns,key)=>ns.some(n=>n.dataset.pageKey===key),key);
      if(direct)await p.locator('#atlas-page-navigation [data-page-key]').evaluateAll((ns,key)=>ns.find(n=>n.dataset.pageKey===key).click(),key);
      else{await p.locator('#atlas-page-navigation [data-more]').click();await p.locator('#atlas-page-menu [data-page-key]').evaluateAll((ns,key)=>ns.find(n=>n.dataset.pageKey===key).click(),key);}
     }
     await frames(p);await audit(p,app,key,theme);
     if(app==='neural-map'&&await p.locator('#neural-map-choice').isVisible()){
      await p.screenshot({path:path.join(out,'neural-map-controls-'+theme+'.png')});
      await p.locator('#neural-map-choice').selectOption({label:'Life Ledger'});await p.locator('.neural-map-chooser').getByRole('button',{name:'Show',exact:true}).click();
      assert(await p.getByRole('dialog',{name:'Resource details'}).isVisible());await p.screenshot({path:path.join(out,'neural-map-selection-'+theme+'.png')});await p.keyboard.press('Escape');assert(await p.locator('.neural-map-chooser button').evaluate(n=>n===document.activeElement));
     }
     if(app==='baby-brain'&&await p.locator('#baby-map-choice').isVisible()){
      await p.screenshot({path:path.join(out,'baby-map-controls-'+theme+'.png')});
      const id=await p.evaluate(()=>BabyNavigation.findTopics('')[0].id);await p.locator('#baby-map-choice').selectOption(id);await p.locator('.baby-map-chooser').getByRole('button',{name:'Show topic',exact:true}).click();
      await p.waitForSelector('#sheet.show');await p.screenshot({path:path.join(out,'baby-map-selection-'+theme+'.png')});await p.keyboard.press('Escape');
     }
     await p.locator('main details,#app details,.app details').evaluateAll(ns=>ns.forEach(n=>{if(n.getClientRects().length&&!n.closest('dialog'))n.open=true;}));await frames(p);await audit(p,app,key+' expanded',theme);
    }
   }catch(e){reports.push({app,theme,engine,error:e.message});}finally{await p.close();}
  }
  await ctx.close();
 }
 const issues=reports.flatMap(r=>(r.issues||[]).map(i=>({app:r.app,view:r.view,theme:r.theme,...i}))),errors=reports.filter(r=>r.error);
 console.log(JSON.stringify({engine,views:reports.length,controls:reports.reduce((s,r)=>s+(r.checked||0),0),errors,issues:issues.slice(0,100),issueCount:issues.length}));
 assert.equal(errors.length,0,'all suite views were audited');assert.equal(issues.length,0,'visible controls have names, keyboard semantics and comfortable targets');
}finally{writeFileSync(path.join(out,'suite-accessibility.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
