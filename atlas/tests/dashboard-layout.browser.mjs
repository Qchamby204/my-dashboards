// Exercise content-bearing screens, including saved progress and opened panels.
// The fresh-screen suite cannot see full-card buttons or goal set editors.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import vm from 'node:vm';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const out=process.env.ATLAS_SCREENSHOTS||'/tmp/atlas-layout';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port;
const model=vm.createContext({window:{}});
for(const f of ['forge-goal-plans.js','forge-goal-model.js'])vm.runInContext(readFileSync(path.join(root,'shared',f),'utf8'),model);
const M=model.window.ForgeGoalModel,goals=M.blank();
for(const [id,completed]of [['bench',['0-d1','0-d2','1-d1']],['deadlift',['0-d1']],['run',['0-d1']]]){
 const p=M.fresh();goals.plans[id]=p;
 for(const k of completed){p.done[k+'-0-0']={w:id==='run'?'28:00':id==='bench'?'245':'405',r:id==='run'?'':'5',e:'',at:'2026-10-08T15:00:00Z'};p.completed[k]='2026-10-08T15:00:00Z';}
}
M.validate(goals);
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),reports=[];
const apps=['index','life-map','life-ledger','workout-forge','the-chef','baby-brain','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-aqueduct','the-library','courier','communication-trainer','neural-map','quinton-os','review'];
const config=process.env.ATLAS_LAYOUT_CASE?[JSON.parse(process.env.ATLAS_LAYOUT_CASE)]:[['light',393,16],['dark',393,16],['dark',320,16],['light',844,16],['dark',393,20]];
const slug=s=>s.replace(/[^a-z0-9-]/gi,'-').slice(0,70);
async function settle(p){await p.waitForTimeout(160);await p.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2000))]));}
async function capture(p,file,view,theme,width,textSize,errors){
 await settle(p);
 const result=await p.evaluate(()=>{
  const visible=n=>{
   if(!n.checkVisibility({checkVisibilityCSS:true,checkOpacity:true}))return false;
   for(let el=n;el;el=el.parentElement)if(el.tagName==='DETAILS'&&!el.open&&!el.querySelector(':scope > summary')?.contains(n))return false;
   return !!n.getClientRects().length;
  };
  const selector='.fg-card,.card,.panel,.topic-card,.qcard,.runcard,.drillcard,.neural-card,.baby-topic,.fg-exercise,.fg-editor';
  const content=[];
  for(const card of document.querySelectorAll(selector)){
   if(!visible(card))continue;
   const bounds=card.getBoundingClientRect(),walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
   let n;
   while(n=walker.nextNode()){
    if(!n.textContent.trim()||!visible(n.parentElement)||n.parentElement.closest('svg,style,script,textarea'))continue;
    let skip=false;const clips=[];
    for(let el=n.parentElement;el;el=el.parentElement){const css=getComputedStyle(el);if(['absolute','fixed'].includes(css.position)||['auto','scroll'].includes(css.overflowX)||['auto','scroll'].includes(css.overflowY)||css.textOverflow==='ellipsis'||css.webkitLineClamp!=='none'){skip=true;break;}if(el===card)break;if([css.overflowX,css.overflowY].some(v=>v==='hidden'||v==='clip'))clips.push({rect:el.getBoundingClientRect(),x:['hidden','clip'].includes(css.overflowX),y:['hidden','clip'].includes(css.overflowY)});}
    if(skip)continue;
    const range=document.createRange();range.selectNodeContents(n);
    for(const r of range.getClientRects()){
     // A carousel's off-screen slides are clipped by its inner viewport.
     // Compare the text that is painted, while retaining the outer card bounds.
     let left=r.left,right=r.right,top=r.top,bottom=r.bottom;
     for(const c of clips){if(c.x){left=Math.max(left,c.rect.left);right=Math.min(right,c.rect.right);}if(c.y){top=Math.max(top,c.rect.top);bottom=Math.min(bottom,c.rect.bottom);}}
     if(right>left&&bottom>top&&(left<bounds.left-1||right>bounds.right+1||top<bounds.top-1||bottom>bounds.bottom+1))content.push({card:card.className,text:n.textContent.trim().slice(0,90),side:right>bounds.right+1?'right':left<bounds.left-1?'left':bottom>bounds.bottom+1?'bottom':'top'});
    }
   }
  }
  const tallPills=[...document.querySelectorAll('button')].filter(n=>visible(n)&&n.getBoundingClientRect().height>100&&parseFloat(getComputedStyle(n).borderTopLeftRadius)>32&&!(getComputedStyle(n).backgroundColor==='rgba(0, 0, 0, 0)'&&parseFloat(getComputedStyle(n).borderTopWidth)===0&&getComputedStyle(n).boxShadow==='none')).map(n=>({class:n.className,text:n.textContent.trim().slice(0,90)}));
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,content,tallPills,forgeCards:[...document.querySelectorAll('.fg-card')].filter(visible).map(n=>({radius:parseFloat(getComputedStyle(n).borderTopLeftRadius),padding:parseFloat(getComputedStyle(n).paddingLeft)}))};
 });
 reports.push({file,view,theme,width,textSize,errors:[...errors],...result});
 writeFileSync(path.join(out,'layout-audit.json'),JSON.stringify(reports,null,2));
 await p.screenshot({path:path.join(out,slug(file+'-'+view+'-'+theme+'-'+width+'-'+textSize)+'.png'),fullPage:file==='workout-forge'&&view==='home',timeout:15000});
 console.log('Layout',file,view,theme,width,textSize,result.content.length?'CONTENT '+JSON.stringify(result.content.slice(0,6)):'',result.tallPills.length?'PILLS '+JSON.stringify(result.tallPills.slice(0,6)):'');
}
try{
 for(const [theme,width,textSize]of config){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'America/Winnipeg',colorScheme:theme,reducedMotion:'reduce'});
  await context.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await context.addInitScript(raw=>localStorage.setItem('forge:goals:v1',raw),JSON.stringify(goals));
  for(const file of apps){
   console.log('Opening',file,theme,width,textSize);
   const p=await context.newPage(),errors=[];p.setDefaultTimeout(10000);p.setDefaultNavigationTimeout(20000);p.on('pageerror',e=>errors.push(e.message));
   await p.goto(origin+'/'+file+'.html',{waitUntil:'domcontentloaded'});await settle(p);
   if(textSize!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+textSize+'px!important}'});
   if(file==='the-herald'){
    await p.locator('#nv-title').fill('Quarterly planning: a practical guide to priorities and follow-through');await p.locator('#nv-script').fill('A synthetic saved script used only in this isolated layout check.');await p.getByRole('button',{name:'Add to vault',exact:true}).click();
   }
   await capture(p,file,'home',theme,width,textSize,errors);
   // The menu holds all native page entries, including those behind More.
   const entries=await p.locator('#atlas-page-menu [data-page-key]').evaluateAll(nodes=>nodes.map(n=>({key:n.dataset.pageKey,title:n.textContent.trim()})));
   if(file==='life-ledger')for(const view of ['today','progress','history']){await p.locator('#ledger-nav-'+view).click();await capture(p,file,view,theme,width,textSize,errors);}
   if(file==='life-map')for(const view of await p.locator('.lm-day-dock button').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('data-tab')).filter(Boolean))){await p.locator('.lm-day-dock button[data-tab="'+view+'"]').click();await capture(p,file,view,theme,width,textSize,errors);}
   for(const entry of entries){
    if(file==='baby-brain'||file==='neural-map')continue; // Their toolbar opens action dialogs, not pages.
    await p.locator('#atlas-page-menu [data-page-key]').evaluateAll((nodes,key)=>nodes.find(n=>n.dataset.pageKey===key)?.click(),entry.key);
    await capture(p,file,entry.title,theme,width,textSize,errors);
    if(file==='workout-forge'&&entry.key!=='home'){
     await p.locator('[data-goal-action="set"]').first().click();await capture(p,file,entry.title+'-editor',theme,width,textSize,errors);
     await p.locator('[data-goal-action="close-editor"]').click();
    }
   }
   if(file==='life-ledger')for(const selector of ['#ledger-screen-fold','#ledger-week-fold'])if(await p.locator(selector).count()){await p.locator(selector).evaluate(n=>n.open=true);await capture(p,file,'expanded-'+selector,theme,width,textSize,errors);}
   await p.close();
  }
  await context.close();
 }
 const bad=reports.filter(r=>r.errors.length||r.overflow||r.content.length||r.tallPills.length||r.forgeCards.some(c=>c.radius>24||c.padding<24));
 console.log(JSON.stringify({views:reports.length,failures:bad.map(r=>({file:r.file,view:r.view,overflow:r.overflow,errors:r.errors,content:r.content.slice(0,6),tallPills:r.tallPills.slice(0,6)}))},null,2));assert.equal(bad.length,0,'content screens fit within their cards; see layout-audit.json');
}finally{writeFileSync(path.join(out,'layout-audit.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
