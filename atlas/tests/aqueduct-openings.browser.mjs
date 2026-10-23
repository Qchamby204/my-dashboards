// Aqueduct openings, original financial records, and byte-for-byte record preservation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/aqueduct-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 const profiles=[['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32],['light',393,16,'empty']];
 for(const [theme,width,size,empty]of profiles){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{try{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await p.goto(origin+'/the-aqueduct.html');await p.waitForSelector('.aqueduct-opening');
  if(!empty)await p.evaluate(()=>{S.aum=1000000;S.book.startAUM=1000000;S.book.startDate='2026-01-01';S.incomeMode='actual';S.actualIncomeMo=6000;S.expenses=[{id:'sample',name:'Home',cat:'Home',amt:1200,freq:'monthly'}];save();render();});
  if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await p.evaluate(()=>localStorage.getItem('aqueduct:v2')),income=await p.evaluate(()=>takeHomeMo());
  for(const tab of ['book','pay','plan','goals','wealth','review']){
   await p.evaluate(tab=>{S.tab=tab;render();scrollTo(0,0);},tab);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.evaluate(()=>document.fonts.ready);
   const hero=p.locator('.aqueduct-opening');assert.equal(await hero.getAttribute('data-opening'),tab);
   await p.waitForFunction(()=>document.querySelector('.aqueduct-title-art')?.getBoundingClientRect().width>180);
   const g=await p.evaluate(()=>{const n=document.querySelector('.aqueduct-opening');return {page:document.documentElement.scrollWidth,card:n.getBoundingClientRect().toJSON(),art:n.querySelector('svg').getBoundingClientRect().toJSON()};});
   if(g.page>width+1)console.log({tab,theme,width,size,g,overflow:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&n.getBoundingClientRect().right>innerWidth+1).slice(0,12).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,50),right:n.getBoundingClientRect().right})))});
   await p.screenshot({path:path.join(out,`aqueduct-opening-${tab}-${theme}-${width}-${size}${empty?'-empty':''}.png`)});
   if(!(g.page<=width+1&&g.art.width>180&&g.art.left>=g.card.left&&g.art.right<=g.card.right+1))console.log({tab,theme,width,size,g});assert(g.page<=width+1&&g.art.width>180&&g.art.left>=g.card.left&&g.art.right<=g.card.right+1,'title art and original content fit '+tab);
   // Aqueduct can redraw its opening while settling; measure whichever card is connected, never a detached one.
   const contrast=await (await p.waitForFunction(()=>{const n=document.querySelector('.aqueduct-opening'),h=n?.querySelector('h1');if(!n?.isConnected||!h)return null;const bgc=getComputedStyle(n).backgroundColor,fgc=getComputedStyle(h).color;if(!/\d/.test(bgc)||!/\d/.test(fgc))return null;const lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;},bg=lum(bgc),fg=lum(fgc);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05);})).jsonValue();
   assert(contrast>=4.5,'opening title is readable ('+contrast.toFixed(2)+':1)');
   assert(await p.locator('#atlas-page-navigation button>span:last-child').evaluateAll(ns=>ns.length===5&&ns.every(n=>{const r=n.getBoundingClientRect(),b=n.parentElement.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.height<=parseFloat(getComputedStyle(n).lineHeight)+1;})),'primary page labels and More remain whole');
   await hero.locator('[data-aqueduct-jump]').click();assert(await p.evaluate(()=>scrollY>0),'opening action reaches original content');assert(await hero.evaluate(n=>n.nextElementSibling.getBoundingClientRect().top>=document.querySelector('.appbar').getBoundingClientRect().bottom-1),'destination below sticky header');if(width===393&&size===16&&!empty)await p.screenshot({path:path.join(out,`aqueduct-content-${tab}-${theme}.png`)});assert.equal(await p.evaluate(()=>localStorage.getItem('aqueduct:v2')),before,'reading and opening actions do not write records');assert.equal(await p.evaluate(()=>takeHomeMo()),income,'income calculation unchanged');reports.push({tab,theme,width,size,empty:!!empty});
  }
  if(!empty){await p.evaluate(()=>{S.tab='book';render();});await p.locator('#hhAmt').fill('125000');await p.locator('#hhDate').fill('2026-10-20');await p.locator('#hhAdd').click();assert.equal(await p.evaluate(()=>S.hhs.at(-1).amt),125000);await p.reload();assert.equal(await p.evaluate(()=>S.hhs.at(-1).amt),125000);await p.evaluate(()=>{S.tab='review';render();});await p.locator('#audText').fill('Date,Description,Debit,Credit\n2026-10-01,Sample shop,12.50,');await p.locator('#audText').press('Tab');await p.locator('#audRun').press('Enter');await p.screenshot({path:path.join(out,`statement-${theme}-${width}-${size}.png`)});await p.waitForSelector('.aqueduct-transaction');assert.equal(await p.locator('.aqueduct-transaction').count(),1);assert.equal(await p.evaluate(()=>S.audit.txns[0].amt),12.5);}
  if(theme==='light'&&width===393&&size===16&&!empty){await p.evaluate(()=>scrollTo(0,0));await p.locator('#atlas-page-navigation [data-more]').click();await p.locator('#atlas-page-menu').getByRole('button',{name:'Wealth',exact:true}).click();await p.waitForSelector('.aqueduct-opening[data-opening=wealth]');assert(await p.evaluate(()=>scrollY<5),'page selection opens at title image');await p.locator('#atlas-page-navigation [data-more]').click();await p.locator('#atlas-page-menu').getByRole('button',{name:'Review',exact:true}).click();await p.waitForSelector('.aqueduct-opening[data-opening=review]');assert(await p.evaluate(()=>scrollY<5));}
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log(engine+': '+reports.length+' Aqueduct openings, unchanged records and calculations, original household save/reload and statement review passed');
}finally{writeFileSync(path.join(out,'aqueduct-openings-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
