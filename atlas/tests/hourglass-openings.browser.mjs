// Hourglass openings, original calendar and countdown, and byte-for-byte record preservation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/hourglass-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 const profiles=[['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32],['light',393,16,'empty']];
 for(const [theme,width,size,empty]of profiles){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  if(!empty)await ctx.addInitScript(()=>{if(!localStorage.getItem('hourglass:v1'))localStorage.setItem('hourglass:v1',JSON.stringify({__v2:true,birth:'1990-01-01',healthyAge:95,retireAge:65,created:'2026-01-01',tab:'weeks',fin:{currentAUM:1000000,pace:20000,paceUnit:'month',growthPct:6,target:5000000},milestones:[{id:'sample',label:'A date to remember',emoji:'📌',date:'2027-01-01'}],companions:[{id:'bond',label:'Companion',emoji:'✨',start:'2020-01-01',end:''}]}));});
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{try{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await p.goto(origin+'/the-hourglass.html');await p.waitForSelector('.hourglass-opening');if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await p.evaluate(()=>localStorage.getItem('hourglass:v1')),assumptions=await p.evaluate(()=>JSON.stringify(S.fin));
  for(const tab of ['weeks','reckon','climb','setup']){
   await p.evaluate(tab=>{S.tab=tab;render();scrollTo(0,0);},tab);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.evaluate(()=>document.fonts.ready);
   const hero=p.locator('.hourglass-opening');assert.equal(await hero.getAttribute('data-opening'),tab);
   const g=await hero.evaluate(n=>({page:document.documentElement.scrollWidth,card:n.getBoundingClientRect().toJSON(),art:n.querySelector('svg').getBoundingClientRect().toJSON()}));
   if(g.page>width+1){console.log({tab,theme,size,g,overflow:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&(n.getBoundingClientRect().right>innerWidth+1||n.scrollWidth>n.clientWidth+2)).slice(0,14).map(n=>({tag:n.tagName,id:n.id,cls:n.className,text:n.textContent.slice(0,55),right:n.getBoundingClientRect().right,width:n.clientWidth,scroll:n.scrollWidth})))});await p.screenshot({path:path.join(out,'overflow.png')});}
   assert(g.page<=width+1&&g.art.width>180&&g.art.left>=g.card.left&&g.art.right<=g.card.right+1,'title art and original content fit '+tab);
   assert(await hero.evaluate(n=>{const lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;},bg=lum(getComputedStyle(n).backgroundColor),fg=lum(getComputedStyle(n.querySelector('h1')).color);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)>=4.5;}),'opening title is readable');
   assert(await p.locator('#atlas-page-navigation button>span:last-child').evaluateAll(ns=>ns.length===4&&ns.every(n=>{const r=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.height<=parseFloat(getComputedStyle(n).lineHeight)+1;})),'all page labels remain whole');
   assert(await p.locator('.appbar-title').evaluate(n=>n.getBoundingClientRect().height<=2*parseFloat(getComputedStyle(n).lineHeight)+1),'app name wraps within two complete lines');
   assert(await p.locator('.appbar-title').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>parseFloat(getComputedStyle(document.querySelector('.appbar-sub')).fontSize)),'secondary header text stays subordinate to the app name');
   if(tab==='weeks'){assert.equal(await p.locator('#makeWall').count(),1);assert.equal(await p.locator('.hg-art').count(),1);assert.equal(await p.locator('.grid-wrap .cell').count(),await p.evaluate(()=>Math.min(healthyAge(),120)*52));assert.equal(await p.locator('.hg-meter').evaluate(n=>getComputedStyle(n,'::after').display),'none');assert(await p.locator('.hg-meter i').evaluate(n=>n.getBoundingClientRect().width>0));}
   assert(await p.locator('.bar').evaluateAll(ns=>ns.every(n=>getComputedStyle(n,'::after').display==='none')),'original progress fills remain visible');
   if(tab==='reckon'){assert.equal(await p.locator('#tickDays').count(),1);assert(Number((await p.locator('#tickDays').textContent()).replaceAll(',',''))>0);}
   await p.screenshot({path:path.join(out,`hourglass-opening-${tab}-${theme}-${width}-${size}${empty?'-empty':''}.png`)});
   await hero.locator('[data-hourglass-jump]').click();assert(await p.evaluate(()=>scrollY>0),'opening action reaches the original content');assert.equal(await p.evaluate(()=>localStorage.getItem('hourglass:v1')),before,'reading and opening actions do not write records');reports.push({tab,theme,width,size,empty:!!empty});
  }
  assert.equal(await p.evaluate(()=>JSON.stringify(S.fin)),assumptions,'projection inputs remain unchanged');
  if(!empty){await p.evaluate(()=>{S.tab='weeks';render();});await p.locator('[data-hourglass-action="add"]').click();const field=p.locator('[data-m][data-k="label"]').last();assert(await field.evaluate(n=>document.activeElement===n));await field.fill('Opening regression milestone');await p.locator('[data-m][data-k="date"]').last().fill('2027-04-01');await p.reload();assert.equal(await p.locator('[data-m][data-k="label"]').last().inputValue(),'Opening regression milestone');assert.equal(await p.locator('[data-m][data-k="date"]').last().inputValue(),'2027-04-01');}
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log(engine+': '+reports.length+' Hourglass openings, original calendar and countdown, readable progress, unchanged records and milestone save/reload passed');
}finally{writeFileSync(path.join(out,'hourglass-openings-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
