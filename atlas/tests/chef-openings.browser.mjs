// Title images, original actions and exact saved-record preservation across Chef views.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/chef-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 for(const [theme,width,size]of [['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32]]){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{try{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await p.goto(origin+'/the-chef.html');await p.waitForFunction(()=>document.querySelector('#chef-opening .chef-title-art'));
  await p.evaluate(()=>{window.originalPlanAction=document.getElementById('plan-add');window.originalCopyAction=document.getElementById('g-copy');setState({favourites:{b01:true},ratings:{b01:4}});});
  if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await p.evaluate(()=>localStorage.getItem('chef:state'));
  for(const [tab,sub]of [['ingredients','week'],['mood','week'],['planner','week'],['planner','groceries'],['planner','recipes'],['favourites','week']]){
   await p.evaluate(([tab,sub])=>{ui.tab=tab;ui.weekView=sub;render();scrollTo(0,0);},[tab,sub]);await p.evaluate(()=>document.fonts.ready);
   const hero=p.locator('#chef-opening'),view=tab==='planner'?sub:tab;assert.equal(await hero.getAttribute('data-view'),view);assert(await hero.isVisible());assert.equal(await hero.locator('.chef-title-art').count(),1);
   const geometry=await hero.evaluate(n=>({width:innerWidth,page:document.documentElement.scrollWidth,art:n.querySelector('svg').getBoundingClientRect().toJSON(),card:n.getBoundingClientRect().toJSON()}));if(geometry.page>width+1){console.log({view,theme,size,geometry,overflow:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&(n.getBoundingClientRect().right>innerWidth+1||n.scrollWidth>n.clientWidth+2)).slice(0,12).map(n=>({tag:n.tagName,id:n.id,cls:n.className,text:n.textContent.slice(0,55),right:n.getBoundingClientRect().right,scroll:n.scrollWidth,width:n.clientWidth,overflow:getComputedStyle(n).overflowX})))});await p.screenshot({path:path.join(out,'overflow.png')});}
   assert(await hero.evaluate(n=>{const b=n.getBoundingClientRect(),a=n.querySelector('svg').getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&a.width>180&&a.left>=b.left&&a.right<=b.right+1;}),'title artwork and text fit the viewport');
   assert(await p.locator('#atlas-page-navigation button>span:last-child').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.height<=parseFloat(getComputedStyle(n).lineHeight)+1;})),'navigation labels stay whole at phone widths and enlarged text');
   assert.equal(await p.locator('#plan-add').count(),1);assert.equal(await p.locator('#g-copy').count(),1);
   assert(await p.evaluate(()=>originalPlanAction===document.getElementById('plan-add')&&originalCopyAction===document.getElementById('g-copy')),'original action nodes survive view changes');
   if(view==='week')assert(await hero.locator('#plan-add').isVisible());if(view==='groceries')assert(await hero.locator('#g-copy').isVisible());
   await p.screenshot({path:path.join(out,`chef-opening-${view}-${theme}-${width}-${size}.png`)});reports.push({view,theme,width,size});
  }
  assert.equal(await p.evaluate(()=>localStorage.getItem('chef:state')),before,'viewing all openings preserves exact saved records');
  await p.locator('#chef-opening [data-chef-opening="browse"]').click();assert.equal(await p.locator('#chef-opening').getAttribute('data-view'),'ingredients');assert.equal(await p.evaluate(()=>scrollY),0);
  const recipe=p.locator('#discover .recipe-card').first();await recipe.locator('.cc-recipe-options > summary').click();await recipe.locator('details.more').last().locator('summary').click();
  assert(await recipe.evaluate(n=>{const b=n.getBoundingClientRect();return document.documentElement.scrollWidth<=innerWidth+1&&[...n.querySelectorAll('[data-rate]')].every(s=>{const r=s.getBoundingClientRect();return r.left>=b.left&&r.right<=b.right+1;});}),'expanded recipe ratings and method fit enlarged text');
  await recipe.screenshot({path:path.join(out,`chef-expanded-${theme}-${width}-${size}.png`)});
  await p.evaluate(()=>{ui.tab='planner';ui.weekView='week';render();});await p.locator('#chef-opening #plan-add').click();assert(await p.locator('#meal-picker').isVisible());await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>localStorage.getItem('chef:state')),before,'cancelling the original meal picker preserves the record');
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log(engine+': '+reports.length+' Chef openings, original controls, picker cancellation and saved records passed');
}finally{writeFileSync(path.join(out,'chef-openings-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
