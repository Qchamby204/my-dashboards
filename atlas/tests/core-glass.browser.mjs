// Floating glass over real light/dark content, tab handoffs and accessible materials.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/core-glass';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const dock='.ledger-nav,.lm-day-dock,#atlas-page-navigation',controls=':is('+dock+') button';
async function lens(p){await p.waitForTimeout(300);return p.evaluate(selector=>{
 const nav=document.querySelector(selector),selected=nav.querySelector('button[aria-current="page"],button[aria-selected="true"]'),r=nav.getBoundingClientRect(),b=selected.getBoundingClientRect(),s=getComputedStyle(nav,'::before'),m=new DOMMatrixReadOnly(s.transform);
 return {gap:Math.max(Math.abs(r.left+nav.clientLeft+m.m41-b.left),Math.abs(r.top+nav.clientTop+m.m42-b.top),Math.abs(parseFloat(s.width)-b.width),Math.abs(parseFloat(s.height)-b.height)),selected:selected.textContent.trim(),transition:s.transitionDuration,filter:getComputedStyle(nav).backdropFilter||getComputedStyle(nav).webkitBackdropFilter};
},dock);}
async function sample(p,bg){
 await p.evaluate(({selector,bg})=>{const nav=document.querySelector(selector);let plate=document.getElementById('glass-test-backplate');if(!plate){plate=document.createElement('div');plate.id='glass-test-backplate';plate.style.cssText='position:fixed;inset:0;z-index:39;pointer-events:none';nav.before(plate);}plate.style.background=bg;},{selector:dock,bg});
 await p.waitForTimeout(50);const buffer=await p.locator(dock).screenshot();
 return p.evaluate(async data=>{const img=new Image();img.src=data;await img.decode();const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const c=canvas.getContext('2d');c.drawImage(img,0,0);return [...c.getImageData(Math.floor(img.width/2),img.height-4,1,1).data].slice(0,3);},'data:image/png;base64,'+buffer.toString('base64'));
}
function contrast(rgb,ink){const lum=a=>a.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((v,x,i)=>v+x*[.2126,.7152,.0722][i],0),a=lum(rgb),b=lum(ink);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);}
try{
 for(const theme of ['light','dark'])for(const accessible of [false,true])for(const app of ['life-ledger','life-map','workout-forge','communication-trainer']){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:accessible?'reduce':'no-preference',contrast:accessible?'more':'no-preference',timezoneId:'America/Winnipeg'}),p=await ctx.newPage();p.setDefaultTimeout(15000);const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  try{
   await p.goto(origin+'/'+app+'.html');await p.bringToFront();await p.waitForFunction(()=>!!document.querySelector('.core-glass-nav[data-core-glass-ready]'));await p.evaluate(()=>document.fonts.ready);
   const initial=await lens(p);assert(initial.gap<1.5,'selection lens aligns with the active control');assert.equal(initial.filter==='none',accessible,'glass is clear normally and solid under increased contrast');
   if(accessible)assert.equal(initial.transition,'0s','reduced motion keeps selection immediate');
   await p.screenshot({path:path.join(out,`glass-${app}-${theme}-${accessible?'accessible':'initial'}.png`)});
   const black=await sample(p,'#000'),white=await sample(p,'#fff'),ink=await p.locator(dock).evaluate(n=>getComputedStyle(n.querySelector('button')).color.match(/[\d.]+/g).slice(0,3).map(Number));
   const delta=Math.max(...black.map((x,i)=>Math.abs(x-white[i]))),minimumContrast=Math.min(contrast(black,ink),contrast(white,ink));
   assert(accessible?delta<3:delta>8,'material respects the content beneath it and its solid accessibility fallback');assert(minimumContrast>=4.5,'navigation labels remain readable over black and white content');
   await p.evaluate(()=>document.getElementById('glass-test-backplate')?.remove());
   const count=await p.locator(controls).count();
   // Re-query after every tap because Ledger rebuilds its controls.
   for(const index of [count-1,0,Math.min(1,count-1)]){await p.locator(controls).nth(index).evaluate(n=>n.click());await p.waitForTimeout(40);}
   const final=await lens(p);assert(final.gap<1.5,'rapid tab changes finish on the current selection');
   await p.evaluate(()=>scrollTo({top:Math.min(600,document.documentElement.scrollHeight-innerHeight),behavior:'instant'}));await p.waitForTimeout(100);
   await p.screenshot({path:path.join(out,`glass-${app}-${theme}-${accessible?'accessible':'scrolled'}-tabs.png`)});
   await p.locator('.appbar .atlas-appearance-trigger').click();await p.locator('#atlas-appearance-dialog').waitFor({state:'visible'});await p.screenshot({path:path.join(out,`glass-${app}-${theme}-${accessible?'accessible':'sheet'}.png`)});await p.getByRole('button',{name:'Close appearance',exact:true}).click();
   assert.deepEqual(errors,[],'glass has no runtime errors');reports.push({app,theme,accessible,delta,minimumContrast,initial,final,passed:true});
  }catch(e){reports.push({app,theme,accessible,error:e.message});await p.evaluate(()=>document.getElementById('glass-test-backplate')?.remove());await p.screenshot({path:path.join(out,`glass-${app}-${theme}-${accessible}-error.png`)});}finally{await ctx.close();}
 }
 const failures=reports.filter(r=>r.error);console.log(JSON.stringify({engine,cases:reports.length,failures}));assert.equal(failures.length,0,'core glass stays legible and follows existing navigation');
}finally{writeFileSync(path.join(out,'core-glass-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
