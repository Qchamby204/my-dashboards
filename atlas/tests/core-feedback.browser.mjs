// Isolated browser evidence. This does not claim physical iPhone or VoiceOver verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/core-feedback';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];

const apps=['life-ledger','life-map','workout-forge','communication-trainer'];
async function shot(p,app,state,theme){await p.screenshot({path:path.join(out,app+'-'+state+'-'+theme+'.png')});}
async function ready(p){await p.waitForFunction(()=>!!window.CoreAppFinish&&document.documentElement.classList.contains('atlas-mobile'));await p.evaluate(()=>document.fonts.ready);}
try{
 for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'});
  await ctx.addInitScript(()=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.qaFailKeys?.includes(k))throw new DOMException('Synthetic storage full','QuotaExceededError');return set.call(this,k,v);};});
  for(const app of apps){
   const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
   try{
    await p.goto(origin+'/'+app+'.html');await ready(p);await shot(p,app,'empty',theme);
    if(app==='life-ledger'){
     await p.locator('#ledger-habit-picker').selectOption('Read');await p.locator('.ledger-habit-card:not([inert]) [data-act="num"]').fill('10');await p.keyboard.press('Tab');
     await p.evaluate(()=>{window.qaFailKeys=[KEY];});await p.evaluate(()=>LedgerDays.saveDay());
     assert.equal(await p.evaluate(()=>state.days.length),0);assert.equal(await p.evaluate(()=>state.draft.Read),10);
     const notice=p.locator('#ledger-notice');assert(await notice.isVisible());assert.match(await notice.innerText(),/could not be saved/);await notice.scrollIntoViewIfNeeded();await shot(p,app,'failed-save',theme);
     await p.evaluate(()=>{window.qaFailKeys=[];});await notice.getByRole('button',{name:'Retry saving',exact:true}).click();await p.waitForFunction(()=>!LedgerDays.failed);
     await p.evaluate(()=>{window.storage={get:async k=>({value:localStorage.getItem(k)}),set:async(k,v)=>{if(k===KEY)await new Promise(resolve=>{window.qaRelease=resolve;});localStorage.setItem(k,v);}};LedgerDays.saveDay();});
     await p.waitForFunction(()=>!!window.qaRelease);assert.match(await p.locator('#ledger-draft-status').innerText(),/Saving/);await shot(p,app,'saving',theme);
     await p.evaluate(()=>qaRelease());await p.waitForFunction(()=>state.days.some(d=>d.units.Read===10));await p.waitForFunction(()=>!document.getElementById('app').inert);await shot(p,app,'saved',theme);
     await p.reload();await ready(p);assert(await p.evaluate(()=>state.days.some(d=>d.units.Read===10)));
    }else if(app==='life-map'){
     const input=p.locator('#qaTxt');await input.fill('Feedback-state task');await p.keyboard.press('Tab');await p.evaluate(()=>{window.qaFailKeys=['lifemap_v1'];});await p.getByRole('button',{name:'Add task',exact:true}).click();
     assert.equal(await input.inputValue(),'Feedback-state task');assert.equal(await p.evaluate(()=>S.projects.length),0);await p.locator('#lm-day-nav-areas').click();
     const retry=p.locator('.lm-save-feedback').getByRole('button',{name:'Retry saving',exact:true});assert(await retry.isVisible(),'recovery remains outside contextual capture');assert.match(await p.locator('#lm-save-state').innerText(),/not.*sav|could not|quota|storage/i);await shot(p,app,'failed-save',theme);
     await p.evaluate(()=>{window.qaFailKeys=[];});await retry.click();await p.waitForFunction(()=>S.projects.some(t=>t.task==='Feedback-state task'));await shot(p,app,'saved',theme);await p.reload();await ready(p);assert(await p.evaluate(()=>S.projects.some(t=>t.task==='Feedback-state task')));
    }else if(app==='workout-forge'){
     await p.locator('[data-goal-action="open"][data-goal="bench"]').click();await shot(p,app,'current-session',theme);await p.getByRole('button',{name:'Log next set',exact:true}).click();await p.locator('.fg-editor input[name="w"]').fill('95');await p.locator('.fg-editor input[name="r"]').fill('5');await p.keyboard.press('Tab');await shot(p,app,'draft',theme);
     await p.evaluate(()=>{window.qaFailKeys=['forge:goals:v1'];});await p.locator('.fg-editor').getByRole('button',{name:'Save set',exact:true}).click();
     const error=p.locator('.fg-error[role="alert"]').first();assert(await error.isVisible());assert(await error.getByRole('button',{name:'Retry saving',exact:true}).isVisible());await error.scrollIntoViewIfNeeded();await shot(p,app,'failed-save',theme);
     await p.evaluate(()=>{window.qaFailKeys=[];});await error.getByRole('button',{name:'Retry saving',exact:true}).click();await p.waitForFunction(()=>!ForgeGoals.failed);await shot(p,app,'saved',theme);await p.reload();await ready(p);assert(await p.evaluate(()=>Object.values(JSON.parse(localStorage.getItem('forge:goals:v1')).plans.bench.done).some(s=>s.w==='95'&&s.r==='5')));
    }else{
     await p.getByRole('button',{name:'Start next challenge',exact:true}).click();await p.locator('#txBox').fill('A saved practice should keep this exact transcript after a failed save and recovery.');await p.locator('.card.rubric input[type="range"]').evaluateAll(ns=>ns.forEach(n=>{n.value='4';n.dispatchEvent(new Event('input',{bubbles:true}));}));await p.locator('[data-ladder-performed]').check();await p.keyboard.press('Tab');await shot(p,app,'draft',theme);
     await p.evaluate(()=>{window.qaFailKeys=['mc_reps'];});await p.locator('.card.rubric button[onclick="finishDrill()"]').click();assert.equal(await p.evaluate(()=>S.reps.length),0);assert.match(await p.locator('#communication-practice-status').innerText(),/Not saved/);assert.match(await p.locator('#txBox').inputValue(),/exact transcript/);await p.locator('#communication-practice-status').scrollIntoViewIfNeeded();await shot(p,app,'failed-save',theme);
     await p.evaluate(()=>{window.qaFailKeys=[];});await p.locator('.card.rubric button[onclick="finishDrill()"]').click();await p.waitForFunction(()=>S.reps.length===1);assert(await p.locator('.communication-saved[role="status"]').isVisible());await shot(p,app,'saved',theme);await p.reload();await ready(p);assert.match(await p.evaluate(()=>S.reps[0].transcript),/exact transcript/);
    }
    await p.emulateMedia({contrast:'more'});await shot(p,app,'increased-contrast',theme);
    // Render the shipped reduced-transparency rules explicitly. Browser engines
    // do not expose an OS transparency setting through Playwright emulation.
    const rules=await p.evaluate(()=>{const found=[];function scan(rs){for(const r of rs){if(r.conditionText?.includes('prefers-reduced-transparency'))found.push([...r.cssRules].map(n=>n.cssText).join('\n'));else if(r.cssRules)scan(r.cssRules);}}for(const sheet of document.styleSheets)try{scan(sheet.cssRules);}catch{}return found.join('\n');});assert(rules.length>0);await p.addStyleTag({content:rules});await shot(p,app,'reduced-transparency-rules',theme);
    assert.deepEqual(errors,[]);reports.push({app,theme,engine,empty:true,draft:true,failedSave:true,recovery:true,savedReload:true,reducedMotion:true,increasedContrast:true,reducedTransparencyRulesRendered:true,physicalDevice:false});
   }catch(e){reports.push({app,theme,engine,error:e.message});console.error(JSON.stringify(reports.at(-1)));await shot(p,app,'failure',theme).catch(()=>{});}finally{await p.close();}
  }
  await ctx.close();
 }
 const failures=reports.filter(r=>r.error);console.log(JSON.stringify({engine,cases:reports.length,failures}));assert.equal(failures.length,0,'feedback and recovery remain understandable and durable');
}finally{writeFileSync(path.join(out,'core-feedback.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
