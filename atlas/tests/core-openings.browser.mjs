// First-screen composition in simulated iPhone Home Screen windows; no device sign-off.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/core-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
async function inspect(p,app,view,theme,width){
 await p.waitForFunction(()=>!!document.querySelector('.core-opening-card'));await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await p.waitForTimeout(150);
 const result=await p.evaluate(()=>{
  const card=document.querySelector('.core-opening-card'),bar=document.querySelector('.appbar'),nav=document.querySelector('.ledger-nav,.lm-day-dock,#atlas-page-navigation');
  if(!card)return {issues:['missing opening card']};
  const b=card.getBoundingClientRect(),h=bar.getBoundingClientRect(),n=nav.getBoundingClientRect(),issues=[];
  if(Math.abs(b.top-h.bottom-24)>2)issues.push('opening top gap');
  if(b.bottom>n.top-16)issues.push('opening footer behind navigation');
  if(n.top-b.bottom>32)issues.push('supporting content competes with the opening');
  if(document.documentElement.scrollWidth>innerWidth+1)issues.push('horizontal overflow');
  for(const control of card.querySelectorAll('button,summary,a')){if(!control.checkVisibility()||control.closest('[hidden],[inert],[aria-hidden="true"]'))continue;const c=control.getBoundingClientRect();if(c.width<43.5||c.height<43.5||c.left<b.left-1||c.right>b.right+1||c.bottom>b.bottom+1)issues.push('opening control bounds: '+(control.getAttribute('aria-label')||control.textContent).trim());}
  return {top:b.top,bottom:b.bottom,header:h.bottom,dock:n.top,height:b.height,room:document.documentElement.style.getPropertyValue('--core-opening-height'),body:card.style.getPropertyValue('--core-opening-body-height'),scrollY,issues};
 });
 reports.push({app,view,theme,width,...result});await p.screenshot({path:path.join(out,`${app}-${view}-${theme}-${width}.png`)});
}
try{
 for(const theme of ['light','dark'])for(const width of [393,430]){
  const ctx=await browser.newContext({viewport:{width,height:width===430?932:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'});
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  for(const app of ['life-ledger','life-map','workout-forge','communication-trainer']){
   const p=await ctx.newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.goto(origin+'/'+app+'.html');await p.waitForFunction(()=>!!window.CoreAppFinish&&!!window.AtlasPageNavigation);await p.evaluate(()=>document.fonts.ready);
    await inspect(p,app,'initial',theme,width);
    if(app==='life-ledger'){
     for(const habit of ['Sleep','Read','Board Work']){await p.locator('#ledger-habit-picker').selectOption(habit);await inspect(p,app,habit.replace(/\W/g,''),theme,width);}
     for(const view of ['progress','achievements','history']){await p.locator('#ledger-nav-'+view).click();await inspect(p,app,view,theme,width);}
    }else if(app==='life-map'){
     for(const view of ['plan','areas','board']){await p.locator('#lm-day-nav-'+view).click();await inspect(p,app,view,theme,width);if(view==='areas')for(const area of ['food','family','health','work','admin']){await p.locator('#lm-category-'+area).click();await inspect(p,app,'area-'+area,theme,width);}}
     await p.getByRole('button',{name:'All records & projects',exact:true}).click();await inspect(p,app,'records',theme,width);
    }else{
     const entries=await p.locator('#atlas-page-menu [data-page-key],#atlas-page-navigation [data-page-key]').evaluateAll(ns=>[...new Set(ns.map(n=>n.dataset.pageKey))]);
     for(const entry of entries){await p.locator('#atlas-page-menu [data-page-key],#atlas-page-navigation [data-page-key]').evaluateAll((ns,key)=>ns.find(n=>n.dataset.pageKey===key).click(),entry);await inspect(p,app,entry,theme,width);}
    }
    if(errors.length)reports.push({app,theme,width,issues:errors});
   }catch(e){reports.push({app,theme,width,issues:[e.message]});await p.screenshot({path:path.join(out,`${app}-error-${theme}-${width}.png`)});}finally{await p.close();}
  }
  await ctx.close();
 }
 const failures=reports.filter(r=>r.issues?.length);console.log(JSON.stringify({engine,views:reports.length,failures}));assert.equal(failures.length,0,'opening cards align beneath the header and clear navigation in Home Screen mode');
}finally{writeFileSync(path.join(out,'opening-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
