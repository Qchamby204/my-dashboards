// Ledger's secondary pages use the same opening hierarchy as Today.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=process.env.ATLAS_SCREENSHOTS||'/tmp/ledger-sections';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 for(const [theme,width,textSize,populated]of [['light',393,16,false],['dark',393,16,true],['light',320,16,true],['dark',852,16,true],['light',393,32,true],['dark',320,32,true]]){
  const context=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',contrast:textSize===32?'more':'no-preference'});
  await context.route('https://qchamby204.github.io/my-dashboards/**',async route=>{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');try{await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  const rows=populated?[{date:'2026-10-18',units:{Read:30,'Run / Work Out':1},note:'A saved reflection'},{date:'2026-10-17',units:{Read:20}},{date:'2026-10-15',units:{Read:10}}]:[];
  await context.addInitScript(records=>localStorage.setItem('lifeledger:v2',JSON.stringify(records)),rows);
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(origin+'/life-ledger.html');await page.waitForFunction(()=>!!window.LedgerRhythm&&document.getElementById('ledger-nav-progress'));await page.evaluate(()=>document.fonts.ready);
  if(textSize===32)await page.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await page.evaluate(()=>localStorage.getItem('lifeledger:v2'));
  for(const [view,id]of [['progress','ledger-lifetime-levels'],['achievements','ledger-next-milestone'],['history','ledger-record-overview']]){
   await page.locator('#ledger-nav-'+view).click();await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const hero=page.locator('#'+id);assert(await hero.isVisible());
   const geometry=await hero.evaluate(node=>{const box=node.getBoundingClientRect(),title=node.querySelector('h2'),range=document.createRange();range.selectNodeContents(title);return {width:box.width,paneWidth:node.closest('[role="tabpanel"]').getBoundingClientRect().width,top:box.top,bottom:box.bottom,page:document.documentElement.scrollWidth,viewport:innerWidth,titleColor:getComputedStyle(title).color,background:getComputedStyle(node).backgroundColor,titleFits:[...range.getClientRects()].every(r=>r.right<=box.right+1&&r.left>=box.left-1),font:parseFloat(getComputedStyle(title).fontSize)};});
   assert(geometry.width>geometry.paneWidth*.9&&geometry.top<(textSize===32?430:280),'opening card is the prominent first record');assert(geometry.page<=width+1,'page does not overflow');assert(geometry.titleFits,'hero title fits inside its card');assert.equal(geometry.background,theme==='dark'?'rgb(48, 42, 69)':'rgb(41, 37, 61)');
   assert(await hero.locator('svg').count()>0,'each opening card retains illustration');
   for(const control of await hero.locator('button,summary').all()){if(!await control.isVisible())continue;const b=await control.boundingBox();assert(b.height>=43.5,'opening actions retain touch targets');}
   await page.screenshot({path:path.join(out,`${view}-${theme}-${width}-${textSize}.png`)});reports.push({view,theme,width,textSize,populated,...geometry});
   if(view==='progress'){await hero.getByRole('button',{name:'Explore rewards'}).click();assert(await page.locator('#ledger-personal-rewards').isVisible());}
   if(view==='achievements'){await hero.getByText('Choose milestone',{exact:true}).click();await page.locator('#ledger-milestone-choice').selectOption({label:'First Book'});assert.equal(await page.locator('#ledger-milestone-choice').inputValue(),'First Book');await hero.locator('.ledger-progress-info summary').click();assert(await hero.locator('.ledger-progress-info p').isVisible());await page.screenshot({path:path.join(out,`milestone-help-${theme}-${width}-${textSize}.png`)});await hero.locator('.ledger-progress-info summary').click();await page.locator('#ledger-milestone-choice').selectOption({label:'Master Communicator'});await page.screenshot({path:path.join(out,`milestone-long-title-${theme}-${width}-${textSize}.png`)});assert(await page.locator('#ledger-next-milestone h2').evaluate(node=>{const b=node.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(node);return [...r.getClientRects()].every(t=>t.right<=b.right+1&&t.left>=b.left-1);}),'long chosen milestone fits its title column');}
   if(view==='history'&&populated){await hero.getByRole('button',{name:'Browse saved days'}).click();assert(await page.locator('#ledger-history').getAttribute('open')!==null);}
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('lifeledger:v2')),before,'section navigation and milestone selection do not save a day');await context.close();
 }
 console.log(engine+': '+reports.length+' Ledger section views passed opening-card, navigation, stored-record and responsive checks');
}finally{writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
