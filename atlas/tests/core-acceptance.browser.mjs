// Isolated browser evidence. This does not claim physical iPhone or VoiceOver verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/core-acceptance';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const apps=[['life-ledger','Life Ledger','.ledger-habit-card:not([inert])'],['life-map','Life Map','.lm-now-card'],['workout-forge','The Forge','.fg-card'],['communication-trainer','Communicator','.cl-next']];
async function ready(p){await p.waitForFunction(()=>!!window.CoreAppFinish&&document.documentElement.classList.contains('atlas-mobile'));await p.evaluate(()=>document.fonts.ready);}
async function keyboard(p,input,app){
 assert(await input.evaluate(n=>!!(n.getAttribute('aria-label')||n.getAttribute('aria-labelledby')||[...(n.labels||[])].some(l=>l.textContent.trim()))),'focused input has an accessible name');
 await input.focus();await p.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{value:430,configurable:true});window.visualViewport.dispatchEvent(new Event('resize'));});
 await p.waitForFunction(()=>document.documentElement.classList.contains('core-keyboard'));
 if(app==='life-ledger'){
  assert(!(await p.locator('.ledger-nav').isVisible()),'navigation yields room to the keyboard');assert.equal(await p.locator('.ledger-dock [data-act="commit"]').count(),0,'saving remains in the check-in');
  assert.equal(await p.locator('.ledger-dock').evaluate(n=>getComputedStyle(n).paddingBottom),'7px','keyboard save bar does not retain the Home indicator gap');
 }else assert(!(await p.locator(app==='life-map'?'.lm-day-dock':'#atlas-page-navigation').isVisible()),'navigation yields space to the keyboard');
 const bounds=await input.boundingBox(),limit=430;assert(bounds.y+bounds.height<=limit-12,'focused field remains above keyboard chrome');
 assert(await input.evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=20),'form text follows the larger text setting');
 assert.equal(await input.evaluate(n=>parseFloat(getComputedStyle(n).borderTopLeftRadius)),14,'field corners follow the shared form style');
 await p.screenshot({path:path.join(out,app+'-keyboard-'+engine+'.png')});
 await input.blur();assert(await p.evaluate(()=>document.documentElement.classList.contains('core-keyboard')),'chrome stays stable while the keyboard viewport is still reduced');
 await p.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});await p.waitForFunction(()=>!document.documentElement.classList.contains('core-keyboard'));
}
try{
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'});
  await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
  await context.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  for(const [app,title,heroSelector]of apps){
   const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   try{
   await p.goto(origin+'/'+app+'.html');await ready(p);
   assert.equal(await p.locator('meta[name="apple-mobile-web-app-title"]').count(),1);assert.equal(await p.locator('meta[name="apple-mobile-web-app-title"]').getAttribute('content'),title);
   assert((await p.locator('link[rel="apple-touch-icon"]').getAttribute('href')).includes('/'+app+'-apple.png'),'Home Screen icon has the app identity');
   assert.equal(await p.locator('.appbar .homebtn svg').getAttribute('aria-hidden'),'true');
   const appearance=p.getByRole('button',{name:/^Appearance:/});await appearance.focus();await p.keyboard.press('Enter');assert(await p.locator('#atlas-appearance-dialog').isVisible());await p.keyboard.press('Escape');await p.waitForFunction(()=>!document.getElementById('atlas-appearance-dialog').open);assert(await appearance.evaluate(n=>n===document.activeElement),'dialog returns focus to its trigger');
   await appearance.blur();
   assert.equal(await p.locator('.appbar').evaluate(n=>parseFloat(getComputedStyle(n).borderBottomWidth)),1,'header uses one quiet divider');
   assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
   const hero=p.locator(heroSelector).first();
    assert(await hero.evaluate(n=>{const s=getComputedStyle(n);return s.backgroundImage==='none'&&s.backgroundColor!==getComputedStyle(document.body).backgroundColor;}),'the primary record has a solid surface distinct from the canvas');
    if(app==='life-ledger'){
    const record=await hero.boundingBox(),navigation=await p.locator('.ledger-nav').boundingBox();
    assert(record.y+record.height<=navigation.y-8,'the initial check-in clears floating navigation');assert(await p.locator('#ledger-checkin-save').evaluate(n=>getComputedStyle(n).position==='static'&&!!n.closest('#ledger-log')),'saving is embedded in the check-in');
    }else if(app==='life-map')assert(await p.locator('.lm-capture').evaluate(n=>n.previousElementSibling?.getAttribute('aria-label')==='Right now'),'the current task comes before capture in visual and keyboard order');
   if(app==='workout-forge'||app==='communication-trainer')assert.equal(await p.locator('.atlas-goal-question').evaluate(n=>getComputedStyle(n).backgroundColor),'rgba(0, 0, 0, 0)','supporting choices do not compete with the focal record');
   if(app==='life-ledger'){
    assert.equal(await hero.locator('.ledger-card-avatar').getAttribute('aria-hidden'),'true');assert.equal(await hero.locator('.ledger-card-avatar').textContent(),await p.evaluate(()=>habitEmoji(HABITS[state.cardIndex])),'card retains its original activity symbol');
    assert.equal(await hero.locator('.ledger-card-identity').evaluate(n=>getComputedStyle(n).textAlign),'left');
    assert.equal(await p.getByRole('button',{name:'Cards',exact:true}).count(),1,'mode labels remain clear with decorative icons');
   }else if(app==='life-map')assert.equal(await hero.locator('..').evaluate(n=>getComputedStyle(n).boxShadow),'none','next move has one focal surface');
   else if(app==='workout-forge'){
    const target=await hero.locator('.fg-target').boundingBox(),unit=await hero.locator('.fg-target small').boundingBox();
    assert(unit.x>target.x+20&&Math.abs(unit.y+unit.height-target.y-target.height)<8,'the unit stays beside the target on its baseline: '+JSON.stringify({target,unit}));
   }
   else{
    await p.locator('.cl-roadmap>summary').click();assert.equal(await p.locator('.cl-stage-heading').first().evaluate(n=>getComputedStyle(n).display),'grid','stage identities use a stable grid');
    await p.screenshot({path:path.join(out,app+'-expanded-'+theme+'.png'),fullPage:true});await p.locator('.cl-roadmap>summary').click();await p.evaluate(()=>scrollTo(0,0));
   }
   const home=await p.locator('.appbar .homebtn').boundingBox();assert(home.y>=64,'standalone header clears the status area');
   writeFileSync(path.join(out,app+'-header-'+theme+'.txt'),await p.locator('.appbar').ariaSnapshot());
   await p.screenshot({path:path.join(out,app+'-home-'+theme+'.png')});await hero.screenshot({path:path.join(out,app+'-record-'+theme+'.png')});
   if(app==='life-ledger'){
    await hero.locator('[data-act="hinfo"]').click();await p.screenshot({path:path.join(out,'ledger-definition-'+theme+'.png')});await hero.locator('[data-act="hinfo"]').click();
    await p.getByRole('button',{name:'List',exact:true}).click();assert(await p.locator('.ledger-list-records .row').count()>=13,'list retains every activity');assert.equal(await p.locator('.ledger-list-avatar').first().getAttribute('aria-hidden'),'true','original activity imagery stays decorative in the list');await p.screenshot({path:path.join(out,'ledger-list-'+theme+'.png')});
    await p.getByRole('button',{name:'Cards',exact:true}).click();await p.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   }
   await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:20px!important}'});assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'large text fits');await p.screenshot({path:path.join(out,app+'-large-text-'+theme+'.png')});
   await p.emulateMedia({contrast:'more'});assert(await hero.evaluate(n=>parseFloat(getComputedStyle(n).borderTopWidth)>=2),'increased contrast defines the record edge');await p.emulateMedia({contrast:'no-preference'});
   await p.setViewportSize({width:852,height:393});await p.waitForTimeout(100);assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'landscape fits');
   const landscape=await hero.boundingBox();assert(landscape.x>=64&&landscape.x+landscape.width<=788,'landscape records clear both reserved side areas');
   await p.screenshot({path:path.join(out,app+'-landscape-'+theme+'.png')});await p.setViewportSize({width:393,height:852});await p.waitForFunction(()=>innerWidth===393&&innerHeight>=800);
   if(app==='life-ledger'){
    await p.locator('#ledger-habit-picker').selectOption('Read');const input=p.locator('.ledger-habit-card:not([inert]) [data-act="num"]');await input.fill('12');await input.press('Tab');
    await p.evaluate(()=>scrollTo({top:180,behavior:'instant'}));const todayPlace=await p.evaluate(()=>scrollY);
    await p.locator('#ledger-nav-progress').click();assert.equal(await p.getByRole('heading',{name:'Levels by value',exact:true}).count(),1);
    assert.equal(await p.locator('.ledger-value-key button').count(),5,'every value has a named, reachable chart key');
    await p.locator('#ledger-nav-achievements').click();assert(await p.getByRole('heading',{name:'Achievements',exact:true}).isVisible());assert(await p.getByRole('region',{name:'Projected next milestone'}).isVisible());assert.equal(await p.locator('#ledger-next-milestone').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(37, 34, 53)','milestone keeps the indigo surface behind its cream text in both themes');await p.screenshot({path:path.join(out,'ledger-achievements-'+theme+'.png'),fullPage:true});await p.locator('#ledger-nav-history').click();await p.locator('#ledger-nav-today').click();
    await p.waitForFunction(y=>Math.abs(scrollY-y)<2,todayPlace);assert.equal(await input.inputValue(),'12','section switches preserve the unfinished check-in');
    assert.equal(await p.locator('.ledger-checkin-save .ledger-primary').evaluate(n=>getComputedStyle(n).borderTopLeftRadius),'999px','Save Day follows the shared action shape');
    await keyboard(p,input,app);
    await p.reload();await ready(p);assert.equal(await p.evaluate(()=>state.draft.Read),12,'unfinished check-in survives reload');
    await p.locator('#ledger-habit-picker').selectOption('Read');await p.locator('.ledger-habit-card:not([inert]) [data-act="num"]').focus();
    await p.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{value:430,configurable:true});window.visualViewport.dispatchEvent(new Event('resize'));});
    const save=p.locator('.ledger-checkin-save').getByRole('button',{name:'Save day',exact:true});await save.focus();
    assert(await p.evaluate(()=>document.documentElement.classList.contains('core-keyboard')),'focusing Save keeps the keyboard layout stable');
    const saveBounds=await save.boundingBox();assert(saveBounds.y>=0&&saveBounds.y+saveBounds.height<=430,'inline Save can be focused above the keyboard');
    await save.tap();await p.waitForFunction(()=>state.days.some(d=>d.units.Read===12));await p.reload();await ready(p);assert(await p.evaluate(()=>state.days.some(d=>d.units.Read===12)),'first save tap commits and saved check-in survives reload');
    await p.evaluate(()=>localStorage.setItem('lifeledger:v2',JSON.stringify([14,7,1].map(n=>({date:LedgerRhythm.addDays(todayISO(),-n),units:{Read:50}})))));await p.reload();await ready(p);await p.locator('#ledger-nav-achievements').click();assert.match(await p.locator('#ledger-next-milestone').innerText(),/Around /,'sufficient dated activity has an estimated milestone date');await p.screenshot({path:path.join(out,'ledger-achievements-populated-'+theme+'.png'),fullPage:true});
    await p.locator('#ledger-achievement-category').selectOption('Consistency');assert(await p.locator('.ledger-achievement-record').evaluateAll(ns=>ns.length>0&&ns.every(n=>n.querySelector('.ledger-achievement-badge').dataset.category==='Consistency')),'category filters retain only their badges');
    await p.locator('#ledger-achievement-category').selectOption('all');await p.locator('.ledger-achievement-record').filter({hasText:'First Book'}).click();assert(await p.getByRole('dialog',{name:'First Book',exact:true}).isVisible());assert.equal(await p.getByRole('dialog',{name:'First Book',exact:true}).locator('progress').getAttribute('value'),'150');await p.screenshot({path:path.join(out,'ledger-achievement-detail-'+theme+'.png')});
    await p.getByRole('button',{name:'Make this my next milestone',exact:true}).click();assert.equal(await p.locator('#ledger-next-milestone h2').innerText(),'First Book');await p.locator('.ledger-milestone-choices>summary').click();await p.locator('#ledger-milestone-choice').selectOption('Locked In');assert.equal(await p.locator('#ledger-next-milestone h2').innerText(),'Locked In');await p.screenshot({path:path.join(out,'ledger-milestone-choice-'+theme+'.png')});
    await p.getByRole('button',{name:'Earned',exact:true}).click();assert(await p.locator('.ledger-achievement-record').evaluateAll(ns=>ns.length>0&&ns.every(n=>n.dataset.earned==='true')));await p.locator('#ledger-nav-achievements').press('ArrowRight');assert.equal(await p.locator('#ledger-nav-history').getAttribute('aria-selected'),'true','keyboard navigation reaches the fourth tab');
   }else if(app==='life-map'){
    const input=p.locator('#qaTxt');await input.fill('Synthetic acceptance task');await input.press('Tab');
    await p.locator('#lm-day-nav-plan').click();assert.equal(await p.getByRole('heading',{name:'Build around your day',exact:true}).count(),1,'planning has one clear title');
    assert(!(await p.locator('.lm-capture').isVisible()),'planning keeps capture behind its contextual action');
    await p.getByRole('button',{name:'Resume capture',exact:true}).click();assert.equal(await p.locator('#lm-capture-text').inputValue(),'Synthetic acceptance task');await p.keyboard.press('Escape');
    await p.locator('#lm-day-nav-areas').click();assert(!(await p.locator('.lm-capture').isVisible()));
    await p.locator('#lm-day-nav-home').click();assert.equal(await input.inputValue(),'Synthetic acceptance task','contextual capture retains unfinished work across sections');
    await keyboard(p,input,app);await p.reload();await ready(p);assert.equal(await p.locator('#qaTxt').inputValue(),'Synthetic acceptance task','unfinished task capture survives reload');
    await p.getByRole('button',{name:'Add task',exact:true}).click();await p.waitForFunction(()=>S.projects.some(t=>t.task==='Synthetic acceptance task'));await p.reload();await ready(p);assert(await p.evaluate(()=>S.projects.some(t=>t.task==='Synthetic acceptance task')),'saved task survives reload');
   }else if(app==='workout-forge'){
    await p.locator('[data-goal-action="open"][data-goal="bench"]').click();
    assert(await p.locator('.fg-weeks button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'week choices have comfortable targets');
    assert.equal(await p.locator('.fg-set[aria-current="step"]').count(),1,'one set is identified as next');
    assert.match(await p.locator('.fg-set[aria-current="step"]').textContent(),/Next/);
    await p.getByRole('button',{name:'Log next set',exact:true}).click();assert.match(await p.locator('.fg-set[aria-current="step"]').textContent(),/Editing/);const input=p.locator('.fg-editor input[name="w"]');await input.fill('95');await p.locator('.fg-editor input[name="r"]').fill('5');
    await p.locator('#atlas-page-navigation').getByRole('button',{name:'Deadlift',exact:true}).click();await p.locator('#atlas-page-navigation').getByRole('button',{name:'Bench',exact:true}).click();
    assert.equal(await input.inputValue(),'95','goal navigation preserves the unfinished set');
    await keyboard(p,input,app);
    await p.reload();await ready(p);assert.equal(await p.locator('.fg-editor input[name="w"]').inputValue(),'95','unfinished training entry survives reload');await p.locator('.fg-editor').getByRole('button',{name:'Save set',exact:true}).click();await p.reload();await ready(p);
    assert(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('forge:goals:v1')).plans.bench.done).some(v=>v.w==='95'&&v.r==='5')),'saved training entry survives reload');
    assert.equal(await p.locator('.fg-set[aria-current="step"]').getAttribute('data-key'),'0-d1-0-1','next step advances only after the set saves');
   }else{
    await p.waitForFunction(()=>!!window.CommunicatorLadder);
    assert.equal(await p.locator('[data-ladder-start]:visible').count(),1,'Today has one next practice');
    assert.equal(await p.locator('.communication-career').count(),0,'rank belongs in Progress');
    assert.equal(await p.getByRole('button',{name:'Edit topics',exact:true}).count(),0,'Today keeps topic management in its existing section');
    await p.locator('#atlas-page-navigation').getByRole('button',{name:'Topics',exact:true}).click();assert(await p.getByRole('button',{name:'Edit topics',exact:true}).isVisible(),'topic management remains reachable');await p.locator('#atlas-page-navigation').getByRole('button',{name:'Today',exact:true}).click();
    assert.equal(await p.locator('.communicator-session').count(),0,'investing learning belongs in Learn');
    const other=p.locator('.communication-alternatives>summary').first();await other.focus();await p.keyboard.press('Enter');assert(await p.getByRole('button',{name:'Surprise me',exact:true}).isVisible());await p.keyboard.press('Enter');
    await p.locator('[data-ladder-start="clear-point"]').first().click();const input=p.locator('#txBox');const transcript='A clear plan helps us choose what matters. For example, preparing one decision before a meeting makes the conversation easier. The next step is to write that decision down.';await input.fill(transcript);await keyboard(p,input,app);
    await p.reload();await ready(p);assert.equal(await p.locator('[data-ladder-start]:visible').count(),0,'unfinished practice leads over a new challenge');await p.getByRole('button',{name:'Resume practice',exact:true}).click();assert.equal(await p.locator('#txBox').inputValue(),transcript,'unfinished practice survives reload');
    await p.locator('.card.rubric input[type="range"]').evaluateAll(ns=>ns.forEach(n=>{n.value='4';n.dispatchEvent(new Event('input',{bubbles:true}));}));await p.locator('[data-ladder-performed]').check();await p.locator('.card.rubric button[onclick="finishDrill()"] ').click();await p.waitForFunction(()=>S.reps.length===1);await p.reload();await ready(p);assert.equal(await p.evaluate(()=>S.reps[0].transcript),transcript,'saved practice survives reload');
   }
   assert.deepEqual(errors,[]);reports.push({app,theme,engine,saveAndReload:true,draftAndReload:true,keyboardSimulation:true,accessibleControlNames:true,physicalIPhone:false,physicalVoiceOver:false});
   }catch(error){reports.push({app,theme,engine,error:error.message,physicalIPhone:false,physicalVoiceOver:false});console.error(JSON.stringify({app,theme,error:error.message}));await p.screenshot({path:path.join(out,app+'-failure-'+theme+'.png')}).catch(()=>{});}
   finally{await p.close();}
  }
  await context.close();
 }
 const failures=reports.filter(r=>r.error);console.log(JSON.stringify({apps:reports.length,engine,failures,physicalDeviceVerified:false}));assert.equal(failures.length,0,'core acceptance cases passed');
}finally{writeFileSync(path.join(out,'core-acceptance.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
