// Isolated touch gestures. Physical iPhone keyboard timing remains a separate check.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/ledger-touch';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 for(const [theme,motion]of [['light','reduce'],['dark','no-preference']])for(const standalone of [false,true]){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',colorScheme:theme,reducedMotion:motion,timezoneId:'America/Winnipeg'}),p=await ctx.newPage();p.setDefaultTimeout(15000);if(standalone)await ctx.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true,configurable:true}));const mode=standalone?'home-screen':'browser';
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/life-ledger.html');await p.waitForFunction(()=>!!window.LedgerDays&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);
  await p.evaluate(()=>{window.touchFocus=[];document.addEventListener('click',e=>{const b=e.target.closest('button');if(b?.matches('.ledger-amount-done,[data-act="commit"],[data-act="inc"],[data-act="dec"]'))touchFocus.push({action:b.dataset.act||'done',habit:document.activeElement?.dataset.habit||null});},true);});
  const initial=await p.locator('.ledger-habit-card:not([inert])').boundingBox(),navigation=await p.locator('.ledger-nav').boundingBox();assert(initial.y+initial.height<=navigation.y-8,'the initial activity clears navigation with Home Screen insets too');
  // A genuine tap while editing must reach the action before blur can dismiss the keyboard.
  for(const [habit,amount]of [['Sleep','7.5'],['Read','25'],['Board Work','45']]){
   await p.locator('#ledger-habit-picker').selectOption(habit);const card=p.locator('.ledger-habit-card:not([inert])');await card.locator('[data-act="num"]').fill(amount);await card.locator('.ledger-amount-done').tap();
   assert.equal(await p.evaluate(h=>state.draft[h],habit),Number(amount));assert.equal(await p.evaluate(()=>state.cardIndex),await p.evaluate(h=>HABITS.indexOf(h)+1,habit));
   assert.deepEqual(await p.evaluate(()=>touchFocus.at(-1)),{action:'done',habit},'Done receives its first tap before the quantity input loses focus');
  }
  await p.locator('#ledger-habit-picker').selectOption('Read');const input=p.locator('.ledger-habit-card:not([inert]) [data-act="num"]');await input.fill('10');
  await p.locator('.ledger-habit-card:not([inert]) [data-act="inc"]').tap();assert.equal(await input.inputValue(),'20');assert(await input.evaluate(n=>n===document.activeElement));
  await p.locator('.ledger-habit-card:not([inert]) [data-act="dec"]').tap();assert.equal(await input.inputValue(),'10');assert(await input.evaluate(n=>n===document.activeElement));
  assert.equal(await p.evaluate(()=>state.days.length),0,'entry gestures never save a day or earn XP');
  for(const habit of await p.evaluate(()=>HABITS.filter(h=>HCFG[h].kind==='count'))){await p.locator('#ledger-habit-picker').selectOption(habit);await p.locator('.ledger-habit-card:not([inert]) [data-act="toggle"]').tap();assert.equal(await p.evaluate(h=>state.draft[h],habit),1);assert.equal(await p.evaluate(()=>state.cardIndex),await p.evaluate(h=>Math.min(HABITS.indexOf(h)+1,HABITS.length-1),habit));}
  await p.locator('[data-act="logmode"][data-mode="list"]').tap();
  const rows=p.locator('.ledger-list-records>.row');assert.equal(await rows.count(),await p.evaluate(()=>HABITS.length));assert.equal(await rows.evaluateAll(ns=>new Set(ns.map(n=>n.dataset.value)).size),5);
  await p.locator('.ledger-list-records [data-act="num"][data-habit="Read"]').fill('10');
  const workout=p.locator('.ledger-list-records [data-act="toggle"][data-habit="Run / Work Out"]');await workout.tap();assert.equal(await p.evaluate(()=>state.draft['Run / Work Out']),0);await workout.tap();assert.equal(await p.evaluate(()=>state.draft['Run / Work Out']),1);assert.equal(await p.evaluate(()=>state.days.length),0);
  assert(await workout.evaluate(n=>{const c=getComputedStyle(n);return getComputedStyle(n.querySelector('path')).stroke===c.color&&c.color!==c.backgroundColor;}),'the selected list check retains a contrasting tick in either theme');
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,`${theme}-${mode}-list.png`)});await p.locator('[data-act="logmode"][data-mode="cards"]').tap();
  const faces=new Set();for(const habit of ['Run / Work Out','Read','Chambers Wealth','Screen Discipline','Walk Hud']){
   await p.locator('#ledger-habit-picker').selectOption(habit);const card=p.locator('.ledger-habit-card:not([inert])'),art=card.locator('.ledger-card-art');const b=await art.boundingBox();assert(b.width>240&&b.height>=112,'the activity has a full artwork panel');assert.equal(await card.locator('.ledger-card-avatar').textContent(),await p.evaluate(h=>habitEmoji(h),habit),'original artwork is retained');faces.add(await card.evaluate(n=>getComputedStyle(n).backgroundColor));await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:path.join(out,`${theme}-${mode}-${habit.replace(/\W/g,'')}.png`)});
  }assert.equal(faces.size,5,'the five values have distinct card faces');
  await p.locator('#ledger-habit-picker').selectOption('Read');await p.locator('.ledger-habit-card:not([inert]) [data-act="num"]').fill('30');
  const before=await p.evaluate(()=>JSON.stringify(state.draft));await p.locator('#ledger-checkin-save [data-act="commit"]').dispatchEvent('mousedown',{button:0});assert.equal(await p.evaluate(()=>JSON.stringify(state.draft)),before);assert.equal(await p.evaluate(()=>state.days.length),0,'a press alone does not save');
  await p.locator('#ledger-checkin-save [data-act="commit"]').tap();assert.deepEqual(await p.evaluate(()=>touchFocus.at(-1)),{action:'commit',habit:'Read'},'Save receives its first tap before keyboard dismissal');await p.waitForFunction(()=>state.days.length===1);assert.equal(await p.evaluate(()=>state.days[0].units.Read),30);
  await p.reload();await p.waitForFunction(()=>!!window.LedgerDays);assert.equal(await p.evaluate(()=>state.days[0].units.Read),30);assert.deepEqual(errors,[]);reports.push({theme,motion,standalone,firstTap:true,originalArtwork:true,distinctFaces:5,savedReload:true});await ctx.close();
 }
 console.log(engine+': first touch for Done, steppers, all daily checks and Save; five card identities; saved reload passed');
}finally{writeFileSync(path.join(out,'touch-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
