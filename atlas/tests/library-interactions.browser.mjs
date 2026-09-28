// Run with Playwright installed: node atlas/tests/library-interactions.browser.mjs
// LIBRARY_CHROMIUM optionally supplies a local Chromium executable.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root))throw Error('Invalid path');res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=`http://127.0.0.1:${server.address().port}/the-library.html`;
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.LIBRARY_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu']});
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
  await p.locator('.topic-card').first().click();
  await p.locator('#reading-deadline').fill('2099-12-31');await p.getByRole('button',{name:'Save goal',exact:true}).click();
  await p.locator('[data-action=set-focus]').click();
  const id='b-1A-01',row=p.locator(`[data-book-row="${id}"]`);
  await row.getByRole('button',{name:'Start reading',exact:true}).click();
  let editor=row.locator('[data-progress-form]');
  await editor.locator('[data-progress-slider]').fill('64');assert.equal((await records()).reading.pagesRead[id],undefined,'slider preview must not write');
  await editor.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],64);
  await row.getByRole('button',{name:'Stop reading',exact:true}).click();assert.equal((await records()).progress[id].status,'unread');assert.equal((await records()).reading.pagesRead[id],64);
  await row.getByRole('button',{name:'Resume reading',exact:true}).click();assert.equal((await records()).progress[id].status,'reading');
  await row.locator('[data-action=notes]').first().click();await p.locator('#note-notes').fill('Keep this note when toggling and logging pages.');await p.getByRole('button',{name:'Done',exact:true}).click();await settled();
  await p.goto(base+'#home');await settled();
  const card=p.locator('.continue-book').first();assert.equal(await card.locator('[data-progress-page]').inputValue(),'64');
  await card.locator('[data-progress-page]').fill('123');await card.getByRole('button',{name:'+10',exact:true}).click();assert.equal(await card.locator('[data-progress-page]').inputValue(),'128');
  await card.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],128);assert.equal((await records()).progress[id].status,'reading','a full bar does not silently mark completion');
  // Corrections work in both directions and do not overwrite the reference edition count.
  await card.locator('[data-progress-page]').fill('50');await card.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],50);assert.equal((await records()).reading.pageCounts[id],undefined);
  await p.locator('[data-action=log-focus-progress]').click();editor=p.locator('#modal [data-progress-form]');
  await editor.locator('[data-progress-slider]').fill('110');await editor.getByRole('button',{name:'Save',exact:true}).click();assert.equal((await records()).reading.pagesRead[id],110);
  await p.getByRole('button',{name:'Done',exact:true}).click();await settled();assert.equal(await p.locator('.focus-progress progress').getAttribute('value'),'110');
  if(process.env.LIBRARY_SCREENSHOTS){await photo('progress');await card.scrollIntoViewIfNeeded();await photo('reading-card');}
  await card.getByRole('button',{name:'Stop reading',exact:true}).click();assert.equal(await p.locator('.continue-book').count(),0);assert.equal((await records()).reading.pagesRead[id],110);assert.match((await records()).progress[id].notes,/Keep this note/);
  await p.reload();assert.equal(await p.locator('.focus-progress progress').getAttribute('value'),'110');
  // Export / preview / restore includes both the new progress and all existing notes.
  await p.locator('[data-action=settings]:visible').first().click();const download=p.waitForEvent('download');await p.locator('[data-action=export-backup]').click();const backup=JSON.parse(readFileSync(await (await download).path(),'utf8'));
  await p.locator('#import-file').setInputFiles({name:'reading-roundtrip.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
  await p.locator('[data-action=confirm-import]').waitFor();p.once('dialog',d=>d.accept());await p.locator('[data-action=confirm-import]').click();assert.deepEqual((await records()).reading,backup.data.reading);assert.equal((await records()).progress[id].notes,backup.data.progress[id].notes);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no horizontal page overflow');
  assert.deepEqual(errors,[]);console.log(`${mobile?'Mobile':'Desktop'}: reading toggle, slider, page entry, focus progress, persistence, notes and backup restoration passed.`);
  await context.close();
 }
}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
