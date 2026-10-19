// Browser text/contrast evidence; physical iPhone and VoiceOver remain separate.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engine=process.env.ATLAS_BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/core-large-text';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const frames=p=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
async function inspect(p){return p.evaluate(()=>{
 const visible=n=>n.checkVisibility()&&!n.closest('[hidden],[inert],[aria-hidden="true"]')&&!n.closest('details:not([open]) :not(summary)');
 const key=n=>n.id?'#'+n.id:n.tagName.toLowerCase()+'.'+String(n.className||'').trim().replace(/\s+/g,'.');
 const fits=n=>{const b=n.getBoundingClientRect(),walk=document.createTreeWalker(n,NodeFilter.SHOW_TEXT);let t;while(t=walk.nextNode()){if(!t.textContent.trim()||t.parentElement.closest('svg,[aria-hidden="true"],.sr-only,.visually-hidden'))continue;const r=document.createRange();r.selectNode(t);if([...r.getClientRects()].some(r=>r.width&&r.height&&(r.left<b.left-2||r.right>b.right+2||r.top<b.top-2||r.bottom>b.bottom+2)))return false;}return true;};
 const issues=[],dock=document.querySelector('.atlas-page-native,#atlas-page-navigation');
 if(document.documentElement.scrollWidth>innerWidth+1)issues.push({problem:'page overflow',width:document.documentElement.scrollWidth,offenders:[...document.querySelectorAll('main *,#app *,#main *')].filter(visible).map(n=>({control:key(n),right:Math.round(n.getBoundingClientRect().right)})).filter(r=>r.right>innerWidth+1).sort((a,b)=>b.right-a.right).slice(0,8)});
 for(const n of [...document.querySelectorAll('button,summary')].filter(visible)){
  if(n.closest('dialog:not([open])'))continue;
  if(!fits(n))issues.push({problem:'control text clipped',control:key(n),text:n.textContent.trim().slice(0,65)});
 }
 const nav=[...(dock?.querySelectorAll('button')||[])].filter(visible);
 const rgba=s=>{const a=s.match(/[\d.]+/g)?.map(Number);return a&&(s.startsWith('color(srgb')?[...a.slice(0,3),a[3]??1]:[...a.slice(0,3).map(x=>x/255),a[3]??1]);};
 const lum=a=>{const v=a?.slice(0,3).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return v&&.2126*v[0]+.7152*v[1]+.0722*v[2];};
 const under=rgba(getComputedStyle(dock).backgroundColor),ratios=nav.map(n=>{const c=getComputedStyle(n),over=rgba(c.backgroundColor),bg=over.slice(0,3).map((x,i)=>x*over[3]+under[i]*(1-over[3])),a=lum(rgba(c.color)),b=lum(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});
 if(ratios.some(r=>!Number.isFinite(r)||r<4.5))issues.push({problem:'navigation text contrast',ratios});
 if(dock&&parseFloat(getComputedStyle(dock).borderTopWidth)<2)issues.push({problem:'increased-contrast navigation edge'});
 for(const n of nav){const b=n.getBoundingClientRect();if(b.width<43.5||b.height<43.5||b.left<0||b.right>innerWidth+1)issues.push({problem:'navigation bounds',control:key(n),width:b.width});}
 const title=document.querySelector('.appbar .appbar-title,.appbar>h1');if(title&&!fits(title))issues.push({problem:'header text clipped'});
 const bar=document.querySelector('.appbar'),controls=bar?[title,...bar.querySelectorAll('button,a.homebtn')].filter(n=>n&&visible(n)):[];
 for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){if(controls[i].contains(controls[j])||controls[j].contains(controls[i]))continue;const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)issues.push({problem:'header overlap',controls:[key(controls[i]),key(controls[j])]});}
 return {issues,bodyFont:parseFloat(getComputedStyle(document.body).fontSize),dockHeight:dock?.getBoundingClientRect().height,minimumNavContrast:Math.min(...ratios)};
 });}
try{
 for(const theme of ['light','dark'])for(const width of [320,393,852]){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:900},colorScheme:theme,reducedMotion:'reduce',contrast:'more'});
  for(const app of ['life-ledger','life-map','workout-forge','communication-trainer']){
   const p=await ctx.newPage();p.setDefaultTimeout(10000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
   try{
    await p.goto(origin+'/'+app+'.html');await p.waitForFunction(()=>!!window.AtlasPageNavigation&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);
    await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});await frames(p);
    const native=app==='life-ledger'?'.ledger-nav':app==='life-map'?'.lm-day-dock':null;
    const entries=await p.locator(native?native+' button':'#atlas-page-menu [data-page-key],#atlas-page-navigation [data-page-key]').evaluateAll(ns=>[...new Set(ns.map(n=>n.id||n.dataset.pageKey))]);
    for(const [i,entry]of ['initial',...entries].entries()){
     if(i){if(native)await p.locator('#'+entry).evaluate(n=>n.click());else await p.locator('#atlas-page-menu [data-page-key],#atlas-page-navigation [data-page-key]').evaluateAll((ns,key)=>ns.find(n=>n.dataset.pageKey===key).click(),entry);}
     await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await frames(p);const result=await inspect(p);assert.equal(result.bodyFont,32,'content text receives 200% sizing');
     const row={app,view:entry,theme,width,engine,...result};reports.push(row);
     if(entry==='initial'||result.issues.length)await p.screenshot({path:path.join(out,`${app}-${i}-${theme}-${width}.png`)});
    }
    const first=p.locator('.atlas-page-native button,#atlas-page-navigation button').first();await p.keyboard.press('Tab');await first.focus();assert(await first.evaluate(n=>parseFloat(getComputedStyle(n).outlineWidth)>=2),'navigation retains a visible keyboard focus outline');
    assert.deepEqual(errors,[]);
   }catch(e){reports.push({app,theme,width,engine,error:e.message});}finally{await p.close();}
  }
  await ctx.close();
 }
 const failed=reports.filter(r=>r.error||r.issues?.length);console.log(JSON.stringify({engine,views:reports.length,failures:failed}));assert.equal(failed.length,0,'core views fit at 200% text with increased contrast');
}finally{writeFileSync(path.join(out,'core-large-text.json'),JSON.stringify(reports,null,2));await browser.close();server.close();}
