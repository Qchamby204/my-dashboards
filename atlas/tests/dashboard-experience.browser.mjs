// Browser regression for the approved October suite update. Uses isolated records.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/atlas-experience';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage']}),reports=[];
const expectedHubCards=[...readFileSync(path.join(root,'index.html'),'utf8').matchAll(/<a class="hub-card" href="([^"]+)"/g)].map(m=>m[1]);
const files=['index','life-map','life-ledger','workout-forge','the-chef','baby-brain','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-aqueduct','the-library','courier','communication-trainer','neural-map','quinton-os','review'];
try{
 for(const [theme,width]of [['light',390],['dark',390],['light',1440],['dark',320]]){
  const context=await browser.newContext({viewport:{width,height:900},timezoneId:'America/Winnipeg',colorScheme:theme,reducedMotion:'reduce'});
  await context.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const file=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{const data=readFileSync(path.join(root,file));await r.fulfill({body:data,contentType:types[path.extname(file)]||'text/plain'});}catch{await r.abort();}});
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  for(const file of files){console.log('Checking',file,theme,width);const p=await context.newPage(),errors=[];p.setDefaultTimeout(10000);p.setDefaultNavigationTimeout(20000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/'+file+'.html',{waitUntil:'domcontentloaded'});await p.waitForTimeout(600);
   const info=await Promise.race([p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,width:document.documentElement.scrollWidth,bg:getComputedStyle(document.body).backgroundColor,canvas:getComputedStyle(document.documentElement).getPropertyValue('--neo-canvas').trim(),font:getComputedStyle(document.body).fontFamily,questions:document.querySelectorAll('.atlas-goal-question').length,heading:document.querySelector('h1')?.textContent})),new Promise((_,reject)=>setTimeout(()=>reject(Error(file+' evaluation stalled')),20000))]);reports.push({file,theme,width,errors,...info});
   writeFileSync(path.join(out,'audit.json'),JSON.stringify(reports,null,2));await p.screenshot({timeout:15000,path:path.join(out,file+'-'+theme+'-'+width+'.png'),fullPage:file==='index'});
   const palettes={'the-herald':{light:'#f3f0e9',dark:'#0d1316'},'life-map':{light:'#e7eff2',dark:'#01060a'},'communication-trainer':{light:'#eef0f8',dark:'#0b101e'},'life-ledger':{light:'#e8f1f3',dark:'#01060a'},'workout-forge':{light:'#eff5f3',dark:'#01060a'},'index':{light:'#efeae3',dark:'#01060a'}};
   const canvas=(palettes[file]||{light:'#efeae3',dark:'#1c1a2b'})[theme];
   assert.deepEqual(errors,[],file+' runtime errors');assert.match(info.font,/Figtree/,file+' shared font');assert.equal(info.canvas,canvas,file+' canvas palette');assert.equal(info.overflow,false,file+' '+width+' overflow');
   if(['life-map','life-ledger','workout-forge','communication-trainer','courier','the-library'].includes(file)){
     const tab=p.locator('#atlas-accountability-tabs button').last(),screen=p.locator('#atlas-accountability');
     const bounds=await tab.boundingBox();assert(bounds && bounds.y>=0 && bounds.y+bounds.height<900,file+' Accountability is visible on opening');
     await tab.click();await screen.waitFor({state:'visible'});
     assert.equal(await screen.locator('h1').innerText(),'Accountability');
     const meter=screen.getByRole('progressbar',{name:'Weekly goal'});
     assert(await meter.isVisible(),file+' shows its weekly goal');
     assert.equal(await meter.getAttribute('aria-valuenow'),'0',file+' opens do not earn progress');
     assert.equal(await meter.getAttribute('aria-valuemax'),String({'life-ledger':7,'life-map':6,'communication-trainer':3,'workout-forge':3,'courier':7,'the-library':3}[file]));
     const strip=screen.getByRole('group',{name:'Activity this week'});
     assert.equal(await strip.getByRole('button').count(),7,file+' has all seven days');
     assert.equal(await strip.locator('.acc-ink-mark').count(),0,file+' starts without earned marks');
     assert((await screen.locator('.acc-grid [data-date]').count())>=28,file+' has a real calendar');
     const month=await screen.locator('.acc-month h2').innerText();
     await screen.getByRole('button',{name:'Previous month'}).click();assert.notEqual(await screen.locator('.acc-month h2').innerText(),month);
     await screen.getByRole('button',{name:'Today',exact:true}).click();assert.equal(await screen.locator('.acc-month h2').innerText(),month);
     assert(await screen.evaluate(el=>el.scrollWidth<=el.clientWidth+1),file+' calendar fits');
     await p.screenshot({path:path.join(out,file+'-accountability-'+theme+'-'+width+'.png')});
     await p.goBack();await screen.waitFor({state:'hidden'});
     if(file==='life-ledger' && theme==='light' && width===390){
       const mini=tab.locator('.acc-week-mini');
       await p.locator('#ledger-habit-picker').selectOption('Read');
       await p.locator('.ledger-habit-card:not([inert]) [data-act="inc"]').first().click();
       assert.equal(await mini.evaluate(el=>el.style.getPropertyValue('--week-fill')),'0','a draft leaves the meter empty');
       await p.locator('#ledger-checkin-save [data-act="commit"]').click();
       await p.waitForFunction(()=>document.querySelector('#atlas-accountability-tabs button').title.includes('1 of 7'));
       await p.getByRole('dialog',{name:'Season Opens'}).getByRole('button',{name:'See all achievements'}).click();
       await tab.click();await meter.waitFor();
       assert.equal(await meter.getAttribute('aria-valuenow'),'1','a saved day fills one segment');
       for(const selector of ['.acc-week-strip','.acc-grid']){
         const saved=screen.locator(selector+' [aria-current="date"]');
         assert.equal(await saved.locator('.acc-ink-mark path').count(),2,'a saved day shows the two-stroke X');
         await saved.click();
         assert.match(await screen.locator('.acc-detail li').first().innerText(),/Read/);
       }
       await p.screenshot({path:path.join(out,'weekly-goal-earned.png')});
       await p.reload();await meter.waitFor();
       assert.equal(await meter.getAttribute('aria-valuenow'),'1','credit survives reload');
     }
   }
   if(file==='index'){assert.equal(await p.locator('a.hub-card').count(),expectedHubCards.length);assert.match(await p.locator('.hub-roster').textContent(),new RegExp('^'+expectedHubCards.length+' apps and tools'));const toolbar=await p.locator('.hub-toolbar').boundingBox(),brand=await p.locator('.hub-brand').boundingBox(),appearance=await p.locator('.atlas-appearance-trigger').boundingBox();assert(appearance.x>=brand.x+brand.width,'Appearance stays beside the brand');assert(Math.abs(appearance.y-brand.y)<2,'Header controls share a row');assert.equal(await p.locator('.hub-toolbar').evaluate(el=>getComputedStyle(el).boxShadow),'none','Toolbar must not inherit progress-track surfaces');assert(appearance.x+appearance.width<=toolbar.x+toolbar.width+1,'Appearance fits inside the toolbar');assert.equal(await p.locator('#hub-recents').isVisible(),false);assert.match(info.font,/Figtree/);}
   if(file==='life-map'){assert.equal(await p.locator('#atlas-daily-root .daily-grid > section').count(),3);}
   if(file==='workout-forge'){assert((await p.locator('.fg-starting-point').boundingBox()).y<350,'Forge workout split is visible first');await p.getByRole('button',{name:'Optional goal plans',exact:true}).click();await p.locator('[data-goal-action="open"][data-goal="bench"]').click();await p.locator('[data-goal-action="choose-focus"][data-goal="bench"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('forge:goals:v1')).goal),'bench');await p.reload();await p.waitForTimeout(250);assert.equal(await p.locator('[data-goal-action="choose-focus"]').count(),0);}
   if(file==='communication-trainer'){await p.locator('#communication-focus>summary').click();await p.locator('[data-communication-goal="clarity"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('mc_profile')).goal),'clarity');await p.reload();await p.waitForTimeout(400);assert.equal(await p.locator('[data-communication-goal]').count(),0);await p.goto(origin+'/'+file+'.html#investing-today');await p.waitForTimeout(400);assert.equal(await p.locator('[data-investing-goal="statements"]').count(),1);await p.locator('[data-investing-goal="statements"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('crucible:state')).goal),'statements');await p.waitForFunction(()=>document.getElementById('communicator-reference')?.value==='statements');await p.reload();await p.waitForTimeout(400);assert.equal(await p.locator('#communicator-reference').inputValue(),'statements');}
   if(file==='the-library'){await p.locator('[data-action="choose-goal"][data-goal="understand"]').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('atlas.library.v1')).goal),'understand');await p.reload();await p.waitForTimeout(250);assert.equal(await p.locator('[data-action="choose-goal"]').count(),0);}
   if(file==='prospecting-command-center'){assert.equal(await p.evaluate(()=>CONTACTS.length),0);assert.match(await p.locator('body').textContent(),/Import.*contact/i);}
   if(file==='the-hourglass'){const clear=await p.evaluate(()=>[...document.querySelectorAll('.hourglass-upcoming-row')].every(row=>{const a=row.querySelector('a').getBoundingClientRect(),b=row.querySelector('.hourglass-until').getBoundingClientRect();return a.width>100&&(a.bottom<=b.top||a.top>=b.bottom||a.right<=b.left||a.left>=b.right);}));assert(clear,'Hourglass planning action has its own row');const colors=await p.evaluate(()=>[getComputedStyle(document.querySelector('.hg-meter i')).backgroundColor,getComputedStyle(document.querySelector('.hg-meter')).backgroundColor]);assert.notEqual(colors[0],colors[1],'Time progress remains visible');}
   if(file==='the-chef'){await p.goto(origin+'/'+file+'.html#planner');assert.equal(await p.locator('#tab-planner').isVisible(),true);}
   await p.close();
  }
  await context.close();
 }
 // Date-boundary tests use the real mounted views, synthetic sources and no writes.
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'America/Winnipeg',reducedMotion:'reduce'}),p=await context.newPage();
 await p.clock.install({time:new Date('2026-10-11T22:59:50Z')});await p.goto(origin+'/life-map.html');await p.waitForTimeout(500);assert.match(await p.locator('#atlas-daily-root').textContent(),/Prepare the day/);assert.equal(await p.locator('a[href="the-chef.html#planner"]').count(),1);
 const before=await p.evaluate(()=>localStorage.getItem('lifemap_v1'));await p.clock.fastForward('00:00:40');assert.match(await p.locator('#atlas-daily-root').textContent(),/Close the day/);assert.equal(await p.evaluate(()=>localStorage.getItem('lifemap_v1')),before);
 await p.goto(origin+'/life-ledger.html#today');await p.waitForTimeout(400);await p.locator('.atlas-appearance-trigger').click();await p.locator('[name="atlas-streak-hide"]').check();assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.streaks.hidden.v1')),'true');await p.reload();await p.waitForTimeout(400);await p.locator('.atlas-appearance-trigger').click();assert.equal(await p.locator('[name="atlas-streak-hide"]').isChecked(),true);await p.goto(origin+'/index.html');await p.waitForTimeout(400);
 const recentRaw=await p.evaluate(()=>{const now=Date.now(),events=['life-ledger','life-ledger','workout-forge','courier'].map((app,i)=>({id:'fixture-'+i,app,type:'open',at:new Date(now-i*60000).toISOString()})),raw=JSON.stringify({version:1,events});localStorage.setItem('atlas:activity:v1',raw);window.dispatchEvent(new StorageEvent('storage',{key:'atlas:activity:v1',newValue:raw}));return raw;});
 assert.deepEqual(await p.locator('.hub-recent').allTextContents(),['Life Ledger','The Forge','The Courier']);assert.equal(await p.evaluate(()=>localStorage.getItem('atlas:activity:v1')),recentRaw);
 await p.evaluate(()=>{localStorage.setItem('atlas:activity:v1','unreadable');window.dispatchEvent(new StorageEvent('storage',{key:'atlas:activity:v1',newValue:'unreadable'}));});assert.equal(await p.locator('#hub-recents').isVisible(),false);assert.equal(await p.evaluate(()=>localStorage.getItem('atlas:activity:v1')),'unreadable');
 await p.close();await context.close();
 console.log('All suite browser checks passed.');
}finally{writeFileSync(path.join(out,'audit.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
