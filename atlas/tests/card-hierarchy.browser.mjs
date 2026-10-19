// Reproduce the reported iPhone layouts, including scroll positions and populated records.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/card-hierarchy';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
async function settle(p){await p.waitForTimeout(220);await p.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1500))]));}
async function capture(p,name,theme,w,size,locator=null){await settle(p);const errors=await p.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1}));assert(!errors.overflow,name+' fits the viewport');const file=name+'-'+theme+'-'+w+'-'+size+'.png';if(locator)await locator.screenshot({path:path.join(out,file),timeout:15000});else await p.screenshot({path:path.join(out,file),timeout:15000});reports.push({name,theme,width:w,textSize:size,engine,...errors});}
async function prominent(locator,label){
 const colors=await locator.evaluate(n=>{const c=getComputedStyle(n);return [c.color,c.backgroundColor];});
 const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 const [a,b]=colors.map(luminance);assert((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,label+' has readable primary-action contrast');
}
async function coreChrome(p,app,w,h){
 const header=p.locator('.appbar'),appearance=header.locator('.atlas-appearance-trigger'),home=header.locator('.homebtn');
 assert(await appearance.isVisible());const a=await appearance.boundingBox(),b=await home.boundingBox();
 if(w<=600){
  assert(Math.abs((a.y+a.height/2)-(b.y+b.height/2))<3,app+' keeps header tools on the same row');
  if(app==='Forge')assert.equal(await header.locator('.appbar-pill').isVisible(),false,'Forge keeps weekly totals in the season record');
  else assert.equal(await header.locator('.appbar-lvl').isVisible(),false,'Communicator keeps XP in its Progress record');
  const tool=header.locator('[data-act="plates"],[data-act="settings"]');if(await tool.count()){const r=await tool.boundingBox();assert(Math.abs((r.y+r.height/2)-(b.y+b.height/2))<3,app+' utility stays in the header row');}
 }
 const dock=p.locator('#atlas-page-navigation');
 await p.waitForFunction(()=>!!window.AtlasPageNavigation);
 const labels=await dock.locator('button>span:last-child').evaluateAll(ns=>ns.map(n=>({label:n.textContent,height:n.getBoundingClientRect().height,line:parseFloat(getComputedStyle(n).lineHeight),width:n.clientWidth,scroll:n.scrollWidth})));
 assert(labels.every(n=>n.height<=n.line+1&&n.scroll<=n.width+1),app+' navigation labels stay whole: '+JSON.stringify(labels));
 assert(await dock.locator('button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect(),s=getComputedStyle(n);return r.height>=44&&r.width>=44&&parseFloat(s.borderRadius)>=22&&parseFloat(s.borderTopWidth)===0&&s.boxShadow==='none';})),app+' uses distinct, full-size navigation targets');
 if(w<=360){
  await dock.locator('[data-more]').click();const menu=p.locator('#atlas-page-menu');assert(await menu.isVisible());
  await menu.getByRole('button',{name:app==='Forge'?'Run':'Progress',exact:true}).click();
  assert.equal(await dock.locator('[data-more]').getAttribute('aria-current'),'page','overflow selection stays visible');
  await dock.locator('button').first().click();
  await p.setViewportSize({width:393,height:852});await p.waitForFunction(()=>!document.querySelector('#atlas-page-navigation [data-more]'));await settle(p);assert.equal(await dock.locator('[data-more]').count(),0,'rotation or resizing restores the five tabs');
  await p.setViewportSize({width:w,height:h});await p.waitForFunction(()=>!!document.querySelector('#atlas-page-navigation [data-more]'));await settle(p);assert.equal(await dock.locator('[data-more]').count(),1);
 }
 await capture(p,app.toLowerCase()+'-chrome',await p.evaluate(()=>document.documentElement.dataset.atlasTheme),w,16);
}
try{
 for(const [theme,w,h,size]of [['light',393,852,16],['dark',393,852,16],['dark',320,740,16],['dark',393,852,20],['dark',852,393,16]]){
  const c=await browser.newContext({viewport:{width:w,height:h},userAgent:ua,isMobile:true,hasTouch:true,colorScheme:theme,timezoneId:'America/Winnipeg',reducedMotion:'reduce'});
  await c.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
  await c.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  const p=await c.newPage();p.setDefaultTimeout(10000);const runtime=[];p.on('pageerror',e=>runtime.push(e.message));
  async function open(file,hash=''){await p.goto(origin+'/'+file+'.html'+hash,{waitUntil:'domcontentloaded'});await settle(p);if(size!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});}
  await open('workout-forge');
  const goalChoices=p.locator('.fg-starting-point .fg-feature-footer');await goalChoices.waitFor({state:'visible'});
  assert.equal(await goalChoices.locator('button').count(),4,'all first-goal choices remain available');
  assert(await goalChoices.locator('button').evaluateAll(ns=>{const rs=ns.map(n=>n.getBoundingClientRect());return rs.every((r,i)=>r.height>=52&&r.width>=44&&(!i||r.top>=rs[i-1].bottom+11||r.left>=rs[i-1].right+11));}),'Forge first-goal choices have full targets and separated rows');
  await capture(p,'forge-first-goal-choices',theme,w,size,p.locator('.fg-starting-point'));
  await coreChrome(p,'Forge',w,h);

  assert(await p.locator('.fg-card').first().evaluate(n=>getComputedStyle(n).backgroundColor!==getComputedStyle(document.body).backgroundColor),'Forge goal records are distinct from the canvas');await capture(p,'forge-goal-record',theme,w,size,p.locator('.fg-card').first());
  const goalBytes=await p.evaluate(()=>localStorage.getItem('forge:goals:v1')),guide=p.locator('.fg-week-guide-disclosure');
  assert.equal(await guide.getAttribute('open'),null,'the weekly guide starts secondary');
  assert(await p.locator('.fg-grid').evaluate(n=>!!(n.compareDocumentPosition(document.querySelector('.fg-week-guide-disclosure'))&Node.DOCUMENT_POSITION_FOLLOWING)),'goal records precede the training guide');
  await guide.locator('summary').first().focus();await p.keyboard.press('Enter');assert(await guide.evaluate(n=>n.open),'the weekly guide opens with the keyboard');
  assert.equal(await guide.locator('.fg-week-day').count(),7,'the original seven-day pairing guide remains available');
  await capture(p,'forge-weekly-guide',theme,w,size,guide);await guide.locator('summary').first().click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('forge:goals:v1')),goalBytes,'reading the guide never changes goal records');
  const lift=await p.evaluate(()=>{
    const it=allItems(dayBy('PUSH')).find(it=>it.n==='Barbell bench press'),id=it.id,name=it.n;
    const ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
    state.sessions=[7,3].map(n=>({date:ago(n),type:'PUSH',items:{[id]:{name,feedback:'smooth',prescription:{name,sets:it.sets,reps:it.reps},sets:Array.from({length:it.sets},()=>({w:'200',r:'5'}))}}}));
    state.draft={};state.openDay='PUSH';save();saveDraft();render();return {id,sets:it.sets};
  });
  const progression=p.locator('[data-progression-id="'+lift.id+'"]');
  assert.match(await progression.textContent(),/Ready for a small increase/);
  assert.match(await progression.locator('.fp-target').textContent(),/205 lbs/);
  await progression.locator('summary').click();assert.equal(await p.evaluate(()=>state.openDay),'PUSH','disclosure does not collapse workout');await capture(p,'forge-progression-expanded',theme,w,size,progression);
  await progression.locator('[data-act="progression-step"]').selectOption('2.5');
  assert.match(await progression.locator('.fp-target').textContent(),/202.5 lbs/);
  await progression.locator('summary').click();await progression.locator('[data-act="progression-step"]').selectOption('5');
  await progression.locator('[data-act="progression-use"]').click();
  assert.equal(await p.evaluate(id=>state.draft[id].sets[0].w,lift.id),'205');
  assert.equal(await p.evaluate(id=>state.draft[id].sets[0].r,lift.id),'','planned reps are not recorded as performed');
  assert(await progression.locator('[data-act="progression-use"]').isDisabled(),'existing input cannot be overwritten');
  for(let i=0;i<lift.sets;i++)await p.locator('[data-act="setr"][data-id="'+lift.id+'"][data-set="'+i+'"]').fill('5');
  await progression.locator('[data-act="progression-feedback"]').selectOption('smooth');
  await capture(p,'forge-progression',theme,w,size,progression);
  await p.locator('[data-act="log"][data-key="PUSH"]').click();
  assert.equal(await p.evaluate(id=>state.sessions.at(-1).items[id].feedback,lift.id),'smooth');
  if(await p.locator('[data-act="closepr"]').count())await p.locator('[data-act="closepr"]').click();
  await p.evaluate(({id,sets})=>{state.draft[id]={sets:Array.from({length:sets},()=>({w:'205',r:'6'})),feedback:'smooth'};state.openDay='PUSH';render();},lift);
  await p.locator('[data-act="log"][data-key="PUSH"]').click();
  if(await p.locator('[data-act="closepr"]').count())await p.locator('[data-act="closepr"]').click();
  assert.match(await p.locator('.forge-saved-gain').textContent(),new RegExp(lift.sets+' more reps at the same 205 lb'));
  await capture(p,'forge-saved-improvement',theme,w,size,p.locator('#forge-session-summary'));
  await p.reload();await settle(p);
  assert.equal(await p.evaluate(id=>state.sessions.at(-1).items[id].prescription.sets,lift.id),lift.sets,'feedback and target survive reload');
  assert.equal(await p.evaluate(id=>state.progressionSettings[id],lift.id),5);
  await p.locator('[data-act="day"][data-key="PUSH"]').click();
  await progression.locator('[data-act="progression-feedback"]').selectOption('pain');
  assert.match(await progression.textContent(),/Pause this exercise/);assert.equal(await progression.locator('[data-act="progression-use"]').count(),0);
  await capture(p,'forge-progression-pause',theme,w,size,progression);
  await p.evaluate(id=>{delete state.draft[id];state.live={key:'PUSH',exIdx:orderedItems(dayBy('PUSH')).findIndex(it=>it.id===id),startedAt:Date.now(),hidden:false};render();},lift.id);
  await capture(p,'forge-progression-live',theme,w,size,p.locator('.overlay .forge-progression'));
  await open('the-chef');
  assert(await p.locator('#ing-cats').evaluate(n=>{const rows=[...n.children].map(x=>x.getBoundingClientRect());return rows.every((r,i)=>!i||r.top-rows[i-1].bottom>=11);}), 'ingredient groups have separate rows');
  await p.locator('#ing-cats').scrollIntoViewIfNeeded();await capture(p,'chef-ingredients',theme,w,size);
  await p.locator('#ing-cats summary').first().click();await settle(p);assert(await p.locator('#ing-cats details').first().evaluate(n=>n.open));
  await open('the-chef','#mood');
  const card=p.locator('.recipe-card').first();assert(await card.isVisible());assert.match(await card.locator('.recipe-facts').textContent(),/Time.*Yield/s);
  assert(await card.evaluate(n=>getComputedStyle(n).backgroundColor!==getComputedStyle(document.body).backgroundColor),'recipe surface is distinct');
  await capture(p,'chef-recipe',theme,w,size,card);
  await card.locator('details.more').last().locator('summary').click();await capture(p,'chef-recipe-expanded',theme,w,size,card);
  await card.locator('[data-cook]').click();assert(await p.locator('dialog[open]').isVisible(),'recipe opens cooking view');await p.keyboard.press('Escape');
  await open('the-chef','#planner');
  assert(await p.locator('body').evaluate(n=>['none','normal'].includes(getComputedStyle(n,'::before').content)),'Chef has no fixed blank status-area overlay');
  if(w<h)assert(await p.locator('body>header').evaluate(n=>parseFloat(getComputedStyle(n).paddingTop)>=64),'initial header keeps iPhone status-area clearance');
  const thirdDay=p.locator('#week .day').nth(2);await thirdDay.scrollIntoViewIfNeeded();await capture(p,'chef-planner-scrolled',theme,w,size);
  assert(await p.locator('body>header').evaluate(n=>n.getBoundingClientRect().bottom<0),'planner scrolls past the header');
  assert(await p.locator('.atlas-page-dock').isVisible(),'page navigation remains available after scrolling');
  await p.evaluate(()=>{const recipe=availableRecipes().find(r=>r.meal==='dinner');savePreparation(daysPlan(recipe.id,localDateKey(),3,2));render();});
  await p.reload();await settle(p);if(size!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});
  await p.locator('#chef-tonight').scrollIntoViewIfNeeded();await capture(p,'chef-tonight',theme,w,size,p.locator('#chef-tonight'));
  assert.equal(await p.locator('#week .chef-meal-record').count(),3);
  await capture(p,'chef-meal-board',theme,w,size,p.locator('#week .day').first());
  await p.locator('#chef-tonight [data-cook]').click();await p.locator('#cook-steps input').first().check();
  assert.match(await p.locator('#cook-step-progress').textContent(),/^1 of/);await capture(p,'chef-cooking-steps',theme,w,size,p.locator('#cook-dialog'));await p.keyboard.press('Escape');
  await open('life-ledger');
  assert.equal(await p.locator('.ledger-save-row #ledger-quick-reset').count(),0,'reset is separate from saving');assert.equal(await p.locator('#ledger-view-today .ledger-reset-row').count(),0);
  assert(await p.locator('.ledger-card-heading').first().evaluate(n=>{const r=n.getBoundingClientRect();return r.width>200&&r.height>=44;}),'activity heading uses the card width');
  assert(await p.locator('.ledger-xp-save-note').first().isVisible(),'XP saving requirement is visible on the card');
  const active=p.locator('.ledger-habit-card[aria-hidden="false"]');await capture(p,'ledger-activity',theme,w,size,active);
  await p.locator('#ledger-checkin-save').scrollIntoViewIfNeeded();await capture(p,'ledger-save-dock',theme,w,size);
  const ledgerBytes=await p.evaluate(()=>localStorage.getItem('lifeledger:v2'));await p.locator('#ledger-nav-achievements').click();
  if(w===393&&size===16){const collection=await p.locator('.ledger-collection-heading h2').boundingBox(),dock=await p.locator('.ledger-nav').boundingBox();assert(collection.y+collection.height<dock.y-8,'the collection heading appears on the first phone screen');}
  await capture(p,'ledger-collection-first-screen',theme,w,size);
  await p.locator('.ledger-milestone-choices>summary').click();assert(await p.locator('#ledger-milestone-choice').isVisible());await capture(p,'ledger-milestone-choices',theme,w,size,p.locator('#ledger-next-milestone'));
  await p.locator('#ledger-next-milestone .ledger-progress-info>summary').click();await capture(p,'ledger-milestone-explanation',theme,w,size,p.locator('#ledger-next-milestone'));
  assert.equal(await p.evaluate(()=>localStorage.getItem('lifeledger:v2')),ledgerBytes,'viewing milestone controls never rewrites saved days');
  await p.locator('#ledger-nav-history').click();await p.locator('#ledger-checkin-tools>summary').click();await p.locator('#ledger-quick-reset').click();assert(await p.locator('#ledger-reset-sheet').isVisible());await p.keyboard.press('Escape');
  await open('life-map');await p.locator('.daily-chips').scrollIntoViewIfNeeded();
  assert(await p.locator('.daily-chips a').evaluateAll(ns=>ns.every(n=>['inline-flex','flex'].includes(getComputedStyle(n).display)&&parseFloat(getComputedStyle(n).paddingLeft)>=18)),'links have complete padded targets');await capture(p,'life-map-actions',theme,w,size);
  await p.evaluate(async()=>{await LifeMapWorkflow.transaction(next=>{next.projects.push({id:'recap-example',task:'Prepare the nursery shelf',area:'Family & Baby',status:'Not started',pri:'Med'});},'Added task','task_created');await LifeMapDashboard.setStatus('recap-example','Done');});
  await p.locator('#lm-day-nav-home').click();assert.match(await p.locator('.lm-completed-recap').textContent(),/Prepare the nursery shelf/);await capture(p,'life-map-completed-today',theme,w,size,p.locator('.lm-completed-recap'));
  await open('communication-trainer');assert(await p.locator('.atlas-goal-options').evaluate(n=>parseFloat(getComputedStyle(n).rowGap)>=12));await capture(p,'communicator-choices',theme,w,size);
  await p.waitForFunction(()=>!!window.CommunicatorLadder);
  await coreChrome(p,'Communicator',w,h);
  assert.equal(await p.evaluate(()=>CommunicatorLadder.snapshot().completed),0);
  await prominent(p.locator('.cl-next>.cl-actions>[data-ladder-start]').first(),'Next practice');assert(await p.locator('.cl-next').evaluate(n=>getComputedStyle(n).backgroundColor!==getComputedStyle(document.body).backgroundColor),'Practice card is distinct from the canvas');
  await capture(p,'communicator-ladder',theme,w,size,p.locator('.cl-next'));
  await p.locator('.cl-roadmap summary').click();await capture(p,'communicator-ladder-expanded',theme,w,size,p.locator('.cl-next'));
  assert.equal(await p.locator('[data-ladder-start="handle-objection"]').count(),0,'later challenges preview without bypassing prerequisites');
  await p.locator('[data-ladder-start="clear-point"]').first().click();assert(await p.locator('#txBox').isVisible());
  assert(await p.locator('.card.rubric button[onclick="finishDrill()"]').isDisabled(),'unperformed challenge cannot be saved');
  await p.locator('#txBox').fill('A plan helps you choose what matters, compare the tradeoffs, and decide what to do next. Here is a fictional example of choosing between two goals.');
  await p.locator('.card.rubric input[type="range"]').evaluateAll(ns=>ns.forEach(n=>{n.value='4';n.dispatchEvent(new Event('input',{bubbles:true}));}));
  await p.locator('[data-ladder-performed]').check();await p.locator('.card.rubric button[onclick="finishDrill()"]').click();
  assert.match(await p.locator('.cl-receipt').textContent(),/Challenge completed/);assert.match(await p.locator('.cl-receipt').textContent(),/80.*100 self-score/s);
  assert.equal(await p.evaluate(()=>S.reps.length),1);assert.equal(await p.evaluate(()=>xp()),10);
  assert.equal(await p.locator('.cl-receipt .cm-feature-art').count(),1,'the earned receipt keeps one illustration');assert.equal(await p.locator('.cl-receipt .cm-feature-support>.cl-emblem').count(),0,'the receipt does not repeat its artwork');assert.match(await p.locator('.cl-unlock-bridge').textContent(),/Make the idea land/);
  await p.locator('#toasts .toast').waitFor({state:'detached'});await capture(p,'communicator-ladder-saved',theme,w,size,p.locator('.cl-receipt'));
  await p.reload();await settle(p);assert.equal(await p.evaluate(()=>CommunicatorLadder.snapshot().completed),1);
  await p.locator('[data-ladder-start="make-it-land"]').first().click();await p.locator('#txBox').fill('My unfinished second challenge.');
  await p.reload();await settle(p);
  await p.getByRole('button',{name:'Resume practice',exact:true}).click();assert.equal(await p.locator('#txBox').inputValue(),'My unfinished second challenge.');assert.equal(await p.evaluate(()=>recOn),false);
  await capture(p,'communicator-ladder-draft',theme,w,size,p.locator('.drillcard'));
  await open('the-library');
  const raw=await p.evaluate(()=>{const raw=localStorage.getItem('atlas.library.v1');return raw;});
  if(await p.locator('[data-action="choose-goal"]').count())await p.locator('[data-action="choose-goal"]').first().click();
  await p.evaluate(()=>{const s=JSON.parse(localStorage.getItem('atlas.library.v1'));const b=s.catalog[0];s.progress[b.id]={status:'reading',takeaway:'',notes:'',questions:'',application:'',completedAt:''};const finished=s.catalog[1],d=new Date(),day=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');s.progress[finished.id]={status:'done',takeaway:'Keep the process simple enough to repeat.',notes:'',questions:'',application:'',completedAt:day};localStorage.setItem('atlas.library.v1',JSON.stringify(s));});
  await p.reload();await settle(p);if(size!==16)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});
  if(w<h)assert(await p.locator('.topbar').evaluate(n=>parseFloat(getComputedStyle(n).paddingTop)>=64),'standalone header clears the status area');
  assert(await p.locator('.stat').evaluateAll(ns=>ns.every(n=>getComputedStyle(n,'::after').display==='none')),'stat decorations cannot cross text');
  await p.locator('.stats').scrollIntoViewIfNeeded();await capture(p,'library-stats',theme,w,size);
  assert(await p.locator('.continue-book .book-title').first().evaluate(n=>getComputedStyle(n).boxShadow==='none'&&parseFloat(getComputedStyle(n).borderTopWidth)===0),'book title is a text control');
  await capture(p,'library-reading-record',theme,w,size,p.locator('.continue-book').first());
  assert.equal(await p.locator('.finished-shelf .shelf-book').count(),1);assert.match(await p.locator('.finished-shelf blockquote').textContent(),/Keep the process/);
  await p.locator('.library-bookshelf').scrollIntoViewIfNeeded();await capture(p,'library-bookshelf',theme,w,size,p.locator('.library-bookshelf'));
  await p.locator('.continue-book [data-action=log-pages]').first().click();await capture(p,'library-log-pages',theme,w,size,p.locator('.continue-book').first());
  assert.deepEqual(runtime,[]);await c.close();
 }
 console.log(JSON.stringify({views:reports.length,engine,failures:0}));
}finally{writeFileSync(path.join(out,'card-hierarchy-audit.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}



