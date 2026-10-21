// Isolated records; responsive browser review is separate from physical iPhone sign-off.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/forge-craft';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const ready=async p=>{await p.waitForFunction(()=>!!window.ForgeGoals&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);};
try{
 for(const [theme,width,size] of [['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32]]){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  await p.goto(origin+'/workout-forge.html');await ready(p);
  if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const check=async(view,selector)=>{
   const hero=p.locator(selector);assert(await hero.isVisible());const g=await hero.evaluate(n=>{const b=n.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(n.querySelector('h1,h2'));return {top:b.top,background:getComputedStyle(n).backgroundColor,titleFits:[...r.getClientRects()].every(x=>x.left>=b.left-1&&x.right<=b.right+1),overflow:document.documentElement.scrollWidth>innerWidth+1};});
   assert(g.top<(size===32?650:400),'opening stays near the start');assert(!g.overflow,view+' fits the viewport');assert(g.titleFits);assert.equal(g.background,theme==='dark'?'rgb(52, 57, 81)':'rgb(48, 52, 77)');assert.equal(await hero.locator('.fg-feature-art').count(),1);const art=await hero.locator('.fg-feature-art').boundingBox();assert(art.width>=Math.min(220,width-90)&&art.height>=112,'the title illustration is the opening image');
   for(const button of await hero.locator('button').all()){const box=await button.boundingBox();assert(box.height>=44&&box.width>=44,'opening actions retain targets');}
   await p.screenshot({path:path.join(out,`${view}-${theme}-${width}-${size}.png`)});reports.push({view,theme,width,size,...g});
  };
  const initial=await p.evaluate(()=>localStorage.getItem('forge:goals:v1'));await check('home','.fg-starting-point');assert.equal(await p.locator('[data-goal-action="choose-focus"]').count(),4);assert.equal(await p.evaluate(()=>localStorage.getItem('forge:goals:v1')),initial,'viewing an opening does not create goal records');
  for(const goal of ['bench','deadlift','dunk','run']){
   await p.evaluate(id=>{location.hash='goal-'+id;},goal);await p.waitForFunction(id=>document.querySelector('.fg-detail')?.getAttribute('aria-label')===ForgeGoalPlans[id].title+' plan',goal);await p.evaluate(()=>scrollTo(0,0));
   await check(goal,'.fg-current-session');assert.equal(await p.locator('.fg-current-session .fg-feature-art').getAttribute('data-illustration'),goal);assert.equal(await p.locator('.fg-detail h1').textContent(),await p.evaluate(id=>ForgeGoalPlans[id].title,goal));
   const done=await p.evaluate(id=>JSON.stringify(ForgeGoals.snapshot().plans[id].done),goal);await p.locator('.fg-current-session [data-goal-action="next-set"]').click();const editor=p.locator('.fg-editor');assert(await editor.isVisible());
   assert(await editor.evaluate(n=>{const b=n.getBoundingClientRect();return [...n.querySelectorAll('input,select,button')].filter(el=>el.checkVisibility()).every(el=>{const r=el.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1;});}),'set editor controls fit');
   await p.screenshot({path:path.join(out,`editor-${goal}-${theme}-${width}-${size}.png`)});await editor.locator('[data-goal-action="close-editor"]').click();assert.equal(await p.evaluate(id=>JSON.stringify(ForgeGoals.snapshot().plans[id].done),goal),done,'opening and closing set editors preserves logged sets');
  }
  await p.locator('[data-goal-action="home"]').click();
  for(const key of ['PUSH','LEGS','PULL','ENGINE']){
   await p.locator('.forge-day-card[data-key="'+key+'"]').click();await p.locator('[data-act="live"][data-key="'+key+'"]').click();const live=p.locator('.forge-live');await live.waitFor({state:'visible'});
   const record=live.locator('.forge-live-record');assert(await record.isVisible());assert.equal(await record.locator('.forge-live-face').evaluate(n=>getComputedStyle(n).backgroundColor),theme==='dark'?'rgb(52, 57, 81)':'rgb(48, 52, 77)','the exercise face retains readable contrast');assert(await record.evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=-1&&b.right<=innerWidth+1&&n.scrollWidth<=n.clientWidth+1;}),'regular exercise record fits');
   assert(await live.evaluate(n=>{const picker=n.querySelector('.forge-picker'),record=n.querySelector('.forge-live-record'),actions=n.querySelector('.forge-live-actions'),last=n.querySelector('.forge-last-time');return [picker,record,actions,last].every((v,i,a)=>!i||!!(a[i-1].compareDocumentPosition(v)&Node.DOCUMENT_POSITION_FOLLOWING));}),'current exercise and its actions precede supporting history');
   await record.scrollIntoViewIfNeeded();await p.screenshot({path:path.join(out,`regular-${key}-${theme}-${width}-${size}.png`)});await live.getByRole('button',{name:'Cancel workout',exact:true}).click();await p.getByRole('dialog',{name:'Cancel this workout?',exact:true}).getByRole('button',{name:'Discard workout',exact:true}).click();await p.waitForFunction(()=>!document.querySelector('.forge-live'));
  }
  assert.deepEqual(errors,[]);await ctx.close();
 }
 // Saved regular records and their progress must retain a visible fill.
 const ctx=await browser.newContext({viewport:{width:393,height:852}}),p=await ctx.newPage();await p.goto(origin+'/workout-forge.html');await ready(p);
 const record={id:'saved-craft-session',date:'2026-10-18',type:'PUSH',dur:30,items:{'push-bench':{name:'Bench press',done:true,sets:[{w:135,r:6}]}}};await p.evaluate(r=>localStorage.setItem('forge:sessions:v2',JSON.stringify([r])),record);await p.reload();await ready(p);const before=await p.evaluate(()=>localStorage.getItem('forge:sessions:v2'));
 assert(await p.locator('.forge-season .bartrack .fill').evaluate(n=>getComputedStyle(n).backgroundColor!==getComputedStyle(n.parentElement).backgroundColor&&getComputedStyle(n.parentElement,'::after').content==='none'),'saved progress is visible');
 await p.locator('[data-act="section"][data-key="log"]').click();assert(await p.locator('.forge-log-record').isVisible());assert.equal(await p.evaluate(()=>localStorage.getItem('forge:sessions:v2')),before);await p.screenshot({path:path.join(out,'saved-records.png')});await ctx.close();
 console.log(engine+': '+reports.length+' Forge opening states, all four goal editors and saved records passed');
}finally{writeFileSync(path.join(out,'craft-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
