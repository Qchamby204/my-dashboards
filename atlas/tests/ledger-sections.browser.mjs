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
  for(const [view,id]of [['progress','ledger-values-opening'],['achievements','ledger-next-milestone'],['history','ledger-record-overview']]){
   if(view==='history'){await page.locator('#ledger-nav-progress').click();await page.locator('#ledger-open-history').click();}
   else await page.locator('#ledger-nav-'+view).click();
   await page.evaluate(()=>scrollTo(0,0));await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const hero=page.locator('#'+id);assert(await hero.isVisible());
   const geometry=await hero.evaluate(node=>{const box=node.getBoundingClientRect(),title=node.querySelector('h2'),range=document.createRange();range.selectNodeContents(title);return {width:box.width,paneWidth:node.closest('[role="tabpanel"]').getBoundingClientRect().width,top:box.top,bottom:box.bottom,page:document.documentElement.scrollWidth,viewport:innerWidth,titleColor:getComputedStyle(title).color,background:getComputedStyle(node).backgroundColor,titleFits:[...range.getClientRects()].every(r=>r.right<=box.right+1&&r.left>=box.left-1),font:parseFloat(getComputedStyle(title).fontSize)};});
   assert(geometry.width>geometry.paneWidth*.9&&geometry.top<(textSize===32?430:280),'opening card is the prominent first record');assert(geometry.page<=width+1,'page does not overflow');assert(geometry.titleFits,'hero title fits inside its card');assert.equal(geometry.background,theme==='dark'?'rgb(16, 35, 45)':'rgb(249, 252, 252)');
   assert(await hero.locator('svg').count()>0,'each opening card retains illustration');
   if(view==='progress'){
    const field=await hero.locator('.ledger-orbit-field').boundingBox();
    const map=await hero.locator('.ledger-orbit-svg').boundingBox();
    assert(Math.abs(map.width-field.width)<=2,'the constellation fills its plot');
    if(width<=430)assert(field.width>=geometry.width*.9,'the mobile plot uses the width of the card');
   }
   if(view==='progress'){
    const dates=page.locator('.ledger-history-dates');
    const area=await dates.boundingBox(),today=await dates.locator('[aria-current="date"]').boundingBox();
    assert(today.width>=44&&today.x>=area.x-1&&today.x+today.width<=area.x+area.width+1,'today starts within the chart and has a full touch target');
   }
   for(const control of await hero.locator('button,summary').all()){if(!await control.isVisible())continue;const b=await control.boundingBox();assert(b.height>=43.5,'opening actions retain touch targets');}
   await page.screenshot({path:path.join(out,`${view}-${theme}-${width}-${textSize}.png`)});reports.push({view,theme,width,textSize,populated,...geometry});
   if(view==='progress'){assert.equal(await hero.locator('.ledger-value-key button').count(),5);assert(await hero.evaluate(n=>!!(n.compareDocumentPosition(document.querySelector('#ledger-lifetime-levels'))&Node.DOCUMENT_POSITION_FOLLOWING)));await page.locator('#ledger-lifetime-levels').getByRole('button',{name:'Explore rewards'}).click();assert(await page.locator('#ledger-personal-rewards').isVisible());}
   if(view==='achievements'){await hero.getByText('Choose milestone',{exact:true}).click();await page.locator('#ledger-milestone-choice').selectOption({label:'First Book'});assert.equal(await page.locator('#ledger-milestone-choice').inputValue(),'First Book');await hero.locator('.ledger-progress-info summary').click();assert(await hero.locator('.ledger-progress-info p').isVisible());await page.screenshot({path:path.join(out,`milestone-help-${theme}-${width}-${textSize}.png`)});await hero.locator('.ledger-progress-info summary').click();await page.locator('#ledger-milestone-choice').selectOption({label:'Master Communicator'});await page.screenshot({path:path.join(out,`milestone-long-title-${theme}-${width}-${textSize}.png`)});assert(await page.locator('#ledger-next-milestone h2').evaluate(node=>{const b=node.getBoundingClientRect(),r=document.createRange();r.selectNodeContents(node);return [...r.getClientRects()].every(t=>t.right<=b.right+1&&t.left>=b.left-1);}),'long chosen milestone fits its title column');}
   if(view==='history'&&populated){await hero.getByRole('button',{name:'Browse saved days'}).click();assert(await page.locator('#ledger-history').getAttribute('open')!==null);}
  }
  if(width===393&&textSize===16&&theme==='dark'){
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.evaluate(()=>{state.levelInfo={title:'Level gained',kicker:'Life level',detail:'Browser test'};render();});
   const reward=page.locator('dialog.ledger-reward[open] .levelup');
   await reward.waitFor();await reward.evaluate(async n=>{const entry=n.getAnimations().find(a=>a.animationName==='ledgerRewardEnter');if(entry)await entry.finished;});
   assert.equal(await reward.evaluate(n=>getComputedStyle(n).opacity),'1','the reward is still visible after its entrance');
   await reward.getByRole('button').click();assert.equal(await reward.count(),0);
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>localStorage.getItem('lifeledger:v2')),before,'section navigation and milestone selection do not save a day');await context.close();
 }
 console.log(engine+': '+reports.length+' Ledger section views passed opening-card, navigation, stored-record and responsive checks');
}finally{writeFileSync(path.join(out,'report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
