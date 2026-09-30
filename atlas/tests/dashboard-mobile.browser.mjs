// Browser journey checks. Serves this checkout, or uses BASE_URL when set.
// This emulates a mobile viewport/standalone flag; it does not certify physical iOS.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base=process.env.BASE_URL||`http://127.0.0.1:${server.address().port}/`;
const output=process.env.QA_OUTPUT||'/tmp/dashboard-mobile';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.LIBRARY_CHROMIUM||undefined,args:['--no-sandbox','--disable-gpu','--no-zygote','--single-process']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:'dark',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',reducedMotion:'reduce',timezoneId:'America/Winnipeg'});
await context.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));
let page=await context.newPage();page.setDefaultTimeout(10000);
const errors=[];page.on('pageerror',e=>errors.push({url:page.url(),error:e.message}));
const go=file=>page.goto(new URL(file,base).href,{waitUntil:'load'});
const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
const screenshot=name=>page.screenshot({path:output+'/'+name+'.png'});
try{
  await go('life-ledger.html');await page.waitForFunction(()=>!!window.LedgerDays);await settle();
  await page.locator('#screen-guardrail').selectOption('evening');
  await page.getByRole('button',{name:'Caught myself scrolling',exact:true}).click();
  await page.locator('#screen-trigger').selectOption('habit');
  await page.locator('#screen-action').selectOption('read');
  await page.getByRole('button',{name:'I did this reset',exact:true}).click();
  await page.locator('#ledger-screen').scrollIntoViewIfNeeded();await screenshot('ledger-checkin');
  await page.locator('[data-act="commit"]').click();await settle();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('lifeledger:v2')).at(-1).screen.slips[0].recovered),true);
  await page.close();page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({url:page.url(),error:e.message}));await go('life-ledger.html');await page.waitForFunction(()=>!!window.LedgerDays);
  assert.equal(await page.locator('#screen-guardrail').inputValue(),'evening');assert.equal(await page.getByRole('button',{name:'Undo reset',exact:true}).isVisible(),true);
  await page.setViewportSize({width:844,height:390});await settle();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.setViewportSize({width:390,height:844});
  // Saving a note is the only prerequisite. Opening the handoff creates no practice result.
  await go('the-library.html#topic/1/all/books');await page.locator('[data-book-row="b-1A-03"] [data-action="notes"]').first().click();
  await page.locator('#note-takeaway').fill('Good explanations connect an idea to a concrete example.');
  await page.getByRole('button',{name:'Practise explaining this · 60 seconds',exact:true}).click();
  await page.waitForURL('**/communication-trainer.html#library-book=*');await page.waitForFunction(()=>!!window.CommunicationImprovements);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mc_reps')||'[]').length),0);
  await screenshot('library-handoff');
  await page.getByRole('button',{name:'Start 60-second practice',exact:true}).click();
  assert.equal(await page.locator('#timer').innerText(),'1:00');
  await page.locator('#txBox').fill('A clear explanation gives the listener a picture they already understand.');
  const draft=await page.evaluate(()=>JSON.parse(localStorage.getItem('mc_practiceDraft')));
  assert.equal(draft.topic.librarySource.text,'Good explanations connect an idea to a concrete example.');
  await page.locator('#tbtn').click();await page.locator('#tbtn').click();
  await page.reload();await page.waitForFunction(()=>!!window.CommunicationImprovements);
  await page.getByRole('button',{name:'Resume practice',exact:true}).click();
  assert.equal(await page.locator('#txBox').inputValue(),draft.tx);
  await page.setViewportSize({width:390,height:470});await page.locator('#txBox').focus();await page.locator('#txBox').scrollIntoViewIfNeeded();await screenshot('practice-keyboard-viewport');await page.setViewportSize({width:390,height:844});
  // A second handoff must leave the unfinished draft intact until confirmed.
  await go('communication-trainer.html#library-book=b-1A-03');await page.waitForFunction(()=>!!window.CommunicationImprovements);
  await page.getByRole('button',{name:'Start 60-second practice',exact:true}).click();
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mc_practiceDraft')).id),draft.id);
  await page.getByRole('button',{name:'Dismiss',exact:true}).click();if(await page.getByRole('button',{name:'Resume practice',exact:true}).isVisible())await page.getByRole('button',{name:'Resume practice',exact:true}).click();
  await page.getByRole('button',{name:'Save practice (+10 XP)',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mc_reps')).length),1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mc_reps'))[0].librarySource.text),draft.topic.librarySource.text);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atlas.library.v1')).progress['b-1A-03'].takeaway),draft.topic.librarySource.text);
  await screenshot('practice-saved');
  // Everyday journeys on the other frequently used dashboards.
  await go('life-map.html');await page.getByRole('textbox',{name:'Add a task',exact:true}).fill('Mobile QA task');
  await page.getByRole('button',{name:'Add',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('lifemap_v1'))).includes('Mobile QA task')),true);
  await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(JSON.parse(localStorage.getItem('lifemap_v1'))).includes('Mobile QA task')),true);
  await go('the-herald.html');await page.locator('#nv-title').fill('Mobile QA script');await page.locator('#nv-script').fill('A synthetic script for the save-and-reopen check.');
  await page.getByRole('button',{name:'Add to vault',exact:true}).click();await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('herald:v1')).videos.some(v=>v.title==='Mobile QA script'&&v.script.includes('synthetic'))),true);
  await go('workout-forge.html');await page.waitForFunction(()=>!!document.querySelector('[data-act="day"]'));
  await page.locator('[data-act="day"]').first().click();await page.locator('[data-act="live"]').first().click();
  await page.locator('.forge-live-panel [data-act="forgemin"]').fill('5');
  await page.getByRole('button',{name:'Pause session',exact:true}).click();await page.reload();
  await page.getByRole('button',{name:'Resume session',exact:true}).click();
  assert.equal(await page.locator('.forge-live-panel [data-act="forgemin"]').inputValue(),'5');
  await page.locator('[data-act="livefinish"]').click();await page.getByRole('button',{name:'Save and finish',exact:true}).click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('forge:sessions:v2')).length),1);await screenshot('forge-saved');
  // Real HTMLAudioElement playback with synthetic local PCM; no published episode changes.
  const wav=Buffer.alloc(44+16000*2*8);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(16000,24);wav.writeUInt32LE(32000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(wav.length-44,40);
  const fixture={days:[{date:'2026-09-30',generatedAt:'2026-09-30T10:00:00Z',blocks:['a','b'].map(id=>({id,label:'QA '+id,title:'Synthetic playback '+id,minutes:8/60,words:3,script:'Synthetic audio verification.',talkingPoints:[],sources:[],audio:new URL('qa-'+id+'.wav',base).href}))}]};
  await page.route('**/courier/manifest.json*',r=>r.fulfill({json:fixture}));await page.route('**/qa-*.wav',r=>r.fulfill({contentType:'audio/wav',body:wav}));
  await go('courier.html');await page.locator('#playAll').click();await page.waitForFunction(()=>!document.querySelector('#audio').paused&&document.querySelector('#audio').duration>0);
  await page.locator('#pToggle').click();assert.equal(await page.locator('#audio').evaluate(a=>a.paused),true);
  await page.locator('#pToggle').click();await page.locator('#audio').evaluate(a=>{a.currentTime=a.duration-.1;});
  await page.waitForFunction(()=>document.querySelector('#audio').src.includes('qa-b.wav')&&!document.querySelector('#audio').paused);
  await page.locator('#pToggle').click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('courier:state')).lastPlayed.id),'b');await screenshot('courier-playback');
  await page.unroute('**/courier/manifest.json*');await page.unroute('**/qa-*.wav');
  const pages=['index','life-ledger','the-library','communication-trainer','workout-forge','courier','life-map','the-herald','the-chef','crucible','the-hourglass','operations-cadence','the-aqueduct','baby-brain','neural-map','review','quinton-os'];
  const results=[];
  for(const name of pages){
    await go(name+'.html');await settle();
    for(const size of [{width:390,height:844},{width:844,height:390}]){
      await page.setViewportSize(size);await settle();
      results.push({page:name,...size,...await page.evaluate(()=>({width:document.documentElement.scrollWidth,overflow:document.documentElement.scrollWidth>innerWidth,body:!!document.body.innerText.trim()}))});
    }
    await page.setViewportSize({width:390,height:844});await screenshot(name);
  }
  writeFileSync(output+'/results.json',JSON.stringify({journeys:'passed',results,errors},null,2));
  console.log(JSON.stringify({journeys:'passed',overflows:results.filter(r=>r.overflow),errors},null,2));
  assert.deepEqual(errors,[],'page errors');assert.deepEqual(results.filter(r=>r.overflow),[],'page overflow');
}catch(error){console.log(JSON.stringify({errors,requests:await page.evaluate(()=>[...document.scripts].map(s=>s.src))},null,2));await screenshot('failure');throw error;}finally{await browser.close();server.close();}
