// Run with Playwright installed: node atlas/tests/library-interactions.browser.mjs
// LIBRARY_CHROMIUM optionally supplies a local Chromium executable.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import path from 'node:path';
const {chromium,webkit}=createRequire(import.meta.url)('playwright');
const engine=process.env.LIBRARY_BROWSER==='webkit'?webkit:chromium;
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/the-library.html`;
let browser;
try{
 browser=await engine.launch({headless:true,...(engine===chromium?{executablePath:process.env.LIBRARY_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu']}:{})});
 for(const mobile of [false,true]){
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce',timezoneId:'America/Winnipeg'});
  const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  // Dialog close and hashchange each queue a render; let both finish before editing.
  const settled=()=>p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const records=()=>p.evaluate(()=>JSON.parse(localStorage.getItem('atlas.library.v1')));
  const photo=async name=>{if(process.env.LIBRARY_SCREENSHOTS){mkdirSync(process.env.LIBRARY_SCREENSHOTS,{recursive:true});await p.screenshot({path:path.join(process.env.LIBRARY_SCREENSHOTS,(mobile?'mobile-':'desktop-')+name+'.png'),fullPage:name==='home'});}};
  await p.goto(base+'#home');await settled();assert.equal(await p.locator('.topic-card').count(),14);assert.equal(await records(),null);
  assert.equal(await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(x=>x.id);return ids.length===new Set(ids).size;}),true,'no colliding SVG IDs');
  assert.equal(await p.locator('.badge-symbol').first().evaluate(e=>getComputedStyle(e).animationName),'none');
  await photo('home');
  await p.locator('.topic-card').first().click();await settled();
  assert.deepEqual(await p.locator('[data-learning-sub]').evaluateAll(es=>es.map(e=>e.dataset.learningSub)),['1A','1C','1B','1E','1D','1F','1G']);
  assert.deepEqual(await p.locator('[data-learning-sub="1A"] [data-book-row]').evaluateAll(es=>es.map(e=>e.dataset.bookRow)),['b-1A-03','b-1A-04','b-1A-05','b-1A-02','b-1A-01']);
  await p.locator('.learning-guide summary').click();assert.equal(await p.locator('.learning-guide').evaluate(e=>e.open),true);
  await p.locator('.learning-reason summary').first().focus();await p.keyboard.press('Enter');assert.equal(await p.locator('.learning-reason').first().evaluate(e=>e.open),true);
  assert.equal(await records(),null,'learning guidance must not write records');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await photo('learning');
  await p.goto(base+'#topic/12/all/books');await settled();assert.equal(await p.locator('.learning-label').filter({hasText:'Optional branch'}).count(),3);
  await p.goto(base+'#topic/1/all/books');await settled();
  await p.locator('#reading-deadline').fill('2099-12-31');
  await p.locator('[data-complete="b-1A-03"]').check();await settled();
  assert.equal(await p.locator('#reading-deadline').inputValue(),'2099-12-31','selecting a date then completing a book must retain the deadline');
  await p.locator('[data-complete="b-1A-03"]').uncheck();await settled();
  await p.getByRole('button',{name:'Save goal',exact:true}).click();
  await p.locator('[data-action=set-focus]').click();
  const id='b-1A-01',row=p.locator(`[data-book-row="${id}"]`);
  await row.getByRole('button',{name:'Start reading',exact:true}).click();
  let editor=row.locator('[data-progress-form]');
  await editor.locator('[data-progress-slider]').fill('64');assert.equal((await records()).reading.pagesRead[id],undefined,'slider preview must not write');
  // A date picker can deliver input before change; the visible target must survive Save.
  await p.locator('#reading-deadline').evaluate(el=>{el.value='2099-12-30';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await editor.getByRole('button',{name:'Save',exact:true}).click();
  assert.equal(await p.locator('#reading-deadline').inputValue(),'2099-12-30','progress Save must preserve the visible deadline before change fires');
  await p.locator('#reading-deadline').fill('2099-12-31');await p.locator('#reading-deadline').blur();
  assert.equal((await records()).reading.pagesRead[id],64);assert.equal((await records()).reading.goals['1:all'],'2099-12-31');assert.equal(await p.locator('#reading-deadline').inputValue(),'2099-12-31');
  await row.getByRole('button',{name:'Stop reading',exact:true}).click();assert.equal((await records()).progress[id].status,'unread');assert.equal((await records()).reading.pagesRead[id],64);assert.equal((await records()).reading.goals['1:all'],'2099-12-31');assert.equal(await p.locator('#reading-deadline').inputValue(),'2099-12-31');
  await row.getByRole('button',{name:'Resume reading',exact:true}).click();assert.equal((await records()).progress[id].status,'reading');
  await row.locator('[data-action=notes]').first().click();await p.locator('#note-notes').fill('Keep this note when toggling and logging pages.');await p.getByRole('button',{name:'Done',exact:true}).click();await settled();
  await p.goto(base+'#home');await settled();
  const card=p.locator('.continue-book').first();assert.equal(await card.locator('[data-progress-page]').inputValue(),'64');
  await card.locator('[data-progress-page]').fill('123');await card.getByRole('button',{name:'+10',exact:true}).click();assert.equal(await card.locator('[data-progress-page]').inputValue(),'128');
  await card.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],128);assert.equal((await records()).progress[id].status,'reading','a full bar does not silently mark completion');
  // Corrections work in both directions and do not overwrite the reference edition count.
  await card.locator('[data-progress-page]').fill('50');await card.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],50);assert.equal((await records()).reading.pageCounts[id],undefined);
  await p.locator('[data-action=log-focus-progress]').click();editor=p.locator('#modal [data-progress-form]');
  await editor.locator('[data-progress-slider]').fill('110');await editor.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],110);assert.equal((await records()).reading.goals['1:all'],'2099-12-31');
  await p.getByRole('button',{name:'Done',exact:true}).click();await settled();assert.equal(await p.locator('.focus-progress progress').getAttribute('value'),'110');
  if(process.env.LIBRARY_SCREENSHOTS){await photo('progress');await card.scrollIntoViewIfNeeded();await photo('reading-card');}
  await card.getByRole('button',{name:'Stop reading',exact:true}).click();assert.equal(await p.locator('.continue-book').count(),0);assert.equal((await records()).reading.pagesRead[id],110);assert.match((await records()).progress[id].notes,/Keep this note/);
  await p.reload();assert.equal(await p.locator('.focus-progress progress').getAttribute('value'),'110');
  // A fixed deadline survives completion, undo, skipping, inclusion, reload and backup.
  await p.goto(base+'#topic/1/all/books');await settled();
  const deadline=await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()+9);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;});
  await p.locator('#reading-deadline').fill(deadline);await p.locator('#reading-deadline').blur();
  assert.equal((await records()).reading.goals['1:all'],deadline);
  const remaining=async()=>Number((await p.locator('#reading-goal-output .reading-metrics b').nth(1).innerText()).replaceAll(',',''));
  const pace=async()=>Number((await p.locator('#reading-goal-output .reading-target').innerText()).split(' ')[0].replaceAll(',',''));
  // Every daily logging entry point keeps both the stored and visible deadline.
  const assertGoal=async()=>{
   assert.equal((await records()).reading.goals['1:all'],deadline);
   assert.equal(await p.locator('#reading-deadline').inputValue(),deadline);
   assert.equal(await p.locator('.reading-saved-deadline').count(),1);
   assert.equal(await pace(),Math.ceil((await remaining())/10));
  };
  const logRow=p.locator(`[data-book-row="${id}"]`);
  await logRow.locator('[data-progress-page]').fill('55');await logRow.getByRole('button',{name:'Save',exact:true}).click();await settled();await assertGoal();
  // An incomplete replacement date must not hide the previously saved target.
  await p.locator('#reading-deadline').fill('');
  assert.equal(await p.locator('.reading-saved-deadline').count(),1);
  assert.equal(await pace(),Math.ceil((await remaining())/10));
  await logRow.locator('[data-progress-page]').fill('56');await logRow.getByRole('button',{name:'Save',exact:true}).click();await settled();await assertGoal();
  await p.goto(base+'#home');await settled();
  await p.locator('.continue-book [data-progress-page]').fill('60');await p.locator('.continue-book').getByRole('button',{name:'Save',exact:true}).click();await settled();
  assert.equal((await records()).reading.goals['1:all'],deadline);
  await p.locator('[data-action=log-focus-progress]').click();await p.locator('#modal [data-progress-page]').fill('70');await p.locator('#modal').getByRole('button',{name:'Save',exact:true}).click();
  assert.equal((await records()).reading.goals['1:all'],deadline);
  await p.getByRole('button',{name:'Done',exact:true}).click();await settled();
  await p.goto(base+'#topic/1/all/books');await settled();await assertGoal();
  await logRow.locator('[data-action=notes]').first().click();await p.locator('#reading-current').fill('110');await p.getByRole('button',{name:'Save pages',exact:true}).click();
  assert.equal((await records()).reading.goals['1:all'],deadline);
  await p.getByRole('button',{name:'Done',exact:true}).click();await settled();await assertGoal();
  const baseline=await remaining(),changed='b-1A-03';
  const changedPages=await p.evaluate(id=>window.ATLAS_LIBRARY_PAGES[id].pages,changed);
  await p.locator(`[data-complete="${changed}"]`).check();await settled();
  assert.equal(await remaining(),baseline-changedPages);assert.equal(await pace(),Math.ceil((baseline-changedPages)/10));
  assert.equal(await p.locator('#reading-deadline').inputValue(),deadline);
  await p.locator(`[data-complete="${changed}"]`).uncheck();await settled();assert.equal(await remaining(),baseline);
  await p.locator(`[data-action="skip-book"][data-id="${id}"]`).click();await settled();
  assert.equal((await records()).progress[id].status,'skipped');assert.equal((await records()).reading.pagesRead[id],110);
  assert.equal((await records()).progress[id].notes,'Keep this note when toggling and logging pages.');
  assert.equal(await p.locator('#reading-deadline').inputValue(),deadline);
  const skippedRemaining=await remaining();assert.ok(skippedRemaining<baseline);assert.equal(await pace(),Math.ceil(skippedRemaining/10));
  await p.locator(`[data-action="include-book"][data-id="${id}"]`).click();await settled();assert.equal(await remaining(),baseline);
  await p.locator(`[data-action="skip-book"][data-id="${id}"]`).click();await settled();
  await p.reload();await settled();assert.equal((await records()).progress[id].status,'skipped');assert.equal(await remaining(),skippedRemaining);assert.equal(await p.locator('#reading-deadline').inputValue(),deadline);
  // Subsection goals remain separate, and neither completion nor navigation clears either date.
  await p.goto(base+'#topic/1/1A/books');await settled();await p.locator('#reading-deadline').fill('2099-12-31');await p.locator('#reading-deadline').blur();
  await p.locator(`[data-complete="${changed}"]`).check();await settled();
  assert.equal((await records()).reading.goals['1:all'],deadline);assert.equal((await records()).reading.goals['1:1A'],'2099-12-31');
  await p.locator(`[data-complete="${changed}"]`).uncheck();await settled();
  await p.goto(base+'#home');await settled();
  // Priority edits are a preview until saved; moves must not remap book or goal IDs.
  const beforeOrder=await records();
  await p.locator('[data-action=edit-priorities]').click();await p.locator('#priority-14').selectOption('1');
  assert.deepEqual((await records()).topicOrder,beforeOrder.topicOrder);
  await p.getByRole('button',{name:'Cancel',exact:true}).click();await settled();
  assert.match(await p.locator('.topic-card').first().getAttribute('href'),/#topic\/1\//);
  await p.locator('[data-action=edit-priorities]').click();await p.locator('#priority-14').selectOption('1');await p.locator('#priority-3').selectOption('2');
  if(process.env.LIBRARY_SCREENSHOTS)await photo('priorities');
  await p.getByRole('button',{name:'Save priorities',exact:true}).click();await settled();
  assert.match(await p.locator('.topic-card').first().getAttribute('href'),/#topic\/14\//);
  assert.equal(await p.locator('.topic-card').first().locator('.topic-index').innerText(),'Priority 01');
  const ranked=await records();assert.deepEqual(ranked.catalog,beforeOrder.catalog);assert.deepEqual(ranked.reading,beforeOrder.reading);assert.deepEqual(ranked.progress,beforeOrder.progress);assert.deepEqual(ranked.focus,beforeOrder.focus);
  await p.reload();assert.match(await p.locator('.topic-card').first().getAttribute('href'),/#topic\/14\//);
  await p.locator('[data-action=edit-priorities]').click();await p.getByRole('button',{name:'Original order',exact:true}).click();await p.getByRole('button',{name:'Cancel',exact:true}).click();await settled();
  assert.deepEqual((await records()).topicOrder,ranked.topicOrder);
  // Export / preview / restore includes both the new progress and all existing notes.
  await p.locator('[data-action=settings]:visible').first().click();const download=p.waitForEvent('download');await p.locator('[data-action=export-backup]').click();const backup=JSON.parse(readFileSync(await (await download).path(),'utf8'));
  await p.locator('#import-file').setInputFiles({name:'reading-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await p.locator('[data-action=confirm-import]').waitFor();p.once('dialog',d=>d.accept());await p.locator('[data-action=confirm-import]').click();assert.deepEqual((await records()).reading,backup.data.reading);assert.deepEqual((await records()).topicOrder,backup.data.topicOrder);assert.equal((await records()).progress[id].notes,backup.data.progress[id].notes);assert.equal((await records()).progress[id].status,'skipped');
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
  assert.deepEqual(errors,[]);console.log(`${mobile?'Mobile':'Desktop'}: reading toggle, slider, page entry, focus progress, section priorities, persistence, notes and backup restoration passed.`);
  await context.close();
 }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
