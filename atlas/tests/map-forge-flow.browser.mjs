// Isolated records. Browser evidence does not complete physical iPhone sign-off.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engine=process.env.ATLAS_BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/map-forge-flow';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true});
const ready=async(p,flag)=>{await p.waitForFunction(name=>!!window[name]&&!!window.CoreAppFinish,flag);await p.evaluate(()=>document.fonts.ready);};
const fits=async p=>assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page does not overflow');
try{
 for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:393,height:900},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'}),p=await ctx.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  try{
   await p.goto(origin+'/life-map.html');await ready(p,'LifeMapDay');
   const dates=await p.evaluate(()=>({today:todayISO(),tomorrow:createLifeMapWorkflow().plus(todayISO(),1),later:createLifeMapWorkflow().plus(todayISO(),2)}));
   await p.evaluate(({today,tomorrow})=>localStorage.setItem('lifemap_v1',JSON.stringify({projects:[{id:'sample-today',task:'Review the sample plan',area:'Work — Content',status:'Not started',pri:'High',plan:today},{id:'sample-tomorrow',task:'Prepare sample notes',area:'Work — Content',status:'Not started',pri:'Med',plan:tomorrow}],chores:[],checks:{},planned:{},log:[]})),dates);
   await p.reload();await ready(p,'LifeMapDay');
   await p.goto(origin+'/life-map.html#board?day='+dates.today);await ready(p,'LifeMapDay');
   const bytes=await p.evaluate(()=>localStorage.getItem('lifemap_v1'));
   assert(await p.evaluate(()=>{const main=document.querySelector('#lm-day-view-board'),heading=main.querySelector('.lm-day-heading'),bar=main.querySelector('.lm-day-date-bar'),agenda=main.querySelector('[aria-label="Scheduled tasks"]'),capture=main.querySelector('.lm-capture');return !!capture&&[heading,bar,agenda,capture].every((n,i,a)=>!i||!!(a[i-1].compareDocumentPosition(n)&Node.DOCUMENT_POSITION_FOLLOWING));}),'Board heading, date and agenda precede capture in DOM order');
   assert(await p.locator('[aria-label="Scheduled tasks"]').getByText('Review the sample plan',{exact:true}).isVisible());
   await p.screenshot({path:path.join(out,'batch2-board-'+theme+'.png')});
   await p.locator('#qaTxt').fill('Keep my unfinished capture');
   await p.getByRole('button',{name:'Next day',exact:true}).click();
   assert.equal(await p.locator('[data-day-field="date"]').inputValue(),dates.tomorrow);
   assert(await p.evaluate(()=>document.activeElement?.dataset.step==='1'),'day navigation retains keyboard focus');
   assert.equal(await p.locator('#qaTxt').inputValue(),'Keep my unfinished capture');
   assert(await p.locator('[aria-label="Scheduled tasks"]').getByText('Prepare sample notes',{exact:true}).isVisible());
   await p.locator('#lm-day-nav-plan').click();assert.equal(await p.locator('[data-day-field="date"]').inputValue(),dates.tomorrow);
   assert.equal(await p.locator('.lm-day-date-bar').count(),1,'Plan uses the same day controls');
   await p.getByRole('button',{name:'Next day',exact:true}).click();
   await p.getByRole('button',{name:'View scheduled tasks',exact:true}).click();
   assert.equal(await p.locator('[data-day-field="date"]').inputValue(),dates.later);assert.match(p.url(),new RegExp('board\\?day='+dates.later));
   await p.reload();await ready(p,'LifeMapDay');assert.equal(await p.locator('[data-day-field="date"]').inputValue(),dates.later,'the selected Board date survives its route reload');
   await p.getByRole('button',{name:'Today',exact:true}).click();assert.equal(await p.locator('[data-day-field="date"]').inputValue(),dates.today);
   assert.equal(await p.locator('#qaTxt').inputValue(),'Keep my unfinished capture','capture survives dates, sections and reload');
   assert.equal(await p.evaluate(()=>localStorage.getItem('lifemap_v1')),bytes,'date navigation never rewrites task records');
   for(const [width,size]of [[393,20],[320,20],[320,32]]){
    await p.setViewportSize({width,height:900});const style=await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});await fits(p);
    assert(await p.locator('.lm-day-date-bar button').evaluateAll(ns=>ns.every(n=>{const r=n.getBoundingClientRect();return r.width>=44&&r.height>=44;})),'day controls retain comfortable targets');
    await p.locator('.lm-day-date-bar').screenshot({path:path.join(out,'batch2-date-'+theme+'-'+width+'-'+size+'.png')});await style.evaluate(n=>n.remove());
   }
   await p.setViewportSize({width:393,height:900});await p.getByRole('button',{name:'Next day',exact:true}).click();
   await p.locator('.lm-day-heading [data-day="new-todo"]').click();assert.equal(await p.evaluate(()=>view.editor.plan),dates.tomorrow,'Board Add task uses the selected date');await p.keyboard.press('Escape');
   assert.equal(await p.evaluate(()=>localStorage.getItem('lifemap_v1')),bytes,'opening the editor does not create a task');

   await p.goto(origin+'/workout-forge.html#goal-bench');await ready(p,'ForgeGoals');
   await p.getByRole('button',{name:'Log next set',exact:true}).click();
   assert.equal(await p.locator('.fg-effort').getAttribute('open'),null,'effort starts secondary');
   const editor=p.locator('.fg-editor');assert.match(await editor.locator('.fg-editor-heading').innerText(),/Set 1 of/);
   await p.locator('.fg-exercise').filter({has:editor}).scrollIntoViewIfNeeded();
   await p.screenshot({path:path.join(out,'batch2-forge-'+theme+'.png')});
   await editor.locator('[name="w"]').fill('135');await editor.locator('[name="r"]').fill('6');await editor.locator('.fg-effort>summary').click();await editor.locator('[name="e"]').fill('8');await editor.locator('.fg-effort>summary').click();
   const nav=name=>p.locator('#atlas-page-navigation').getByRole('button',{name,exact:true}).click();
   await nav('Deadlift');await nav('Bench');assert.equal(await editor.locator('[name="w"]').inputValue(),'135');assert.equal(await editor.locator('[name="e"]').inputValue(),'8');
   await p.reload();await ready(p,'ForgeGoals');assert.equal(await editor.locator('[name="r"]').inputValue(),'6','set draft survives navigation and reload');
   for(const [width,size]of [[393,16],[393,20],[320,20],[320,32]]){
    await p.setViewportSize({width,height:900});const style=await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});await fits(p);
    assert(await editor.locator('.fg-fields input').evaluateAll(ns=>ns.every(n=>parseFloat(getComputedStyle(n).fontSize)>=24)),'the set numbers lead the form');
    assert(await editor.evaluate(n=>{const b=n.getBoundingClientRect();return [...n.querySelectorAll('input,select,button')].filter(el=>el.checkVisibility()).every(el=>{const r=el.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1;});}),'set controls stay in their editor');
    await editor.screenshot({path:path.join(out,'batch2-editor-'+theme+'-'+width+'-'+size+'.png')});await style.evaluate(n=>n.remove());
   }
   await p.setViewportSize({width:393,height:900});await editor.getByRole('button',{name:'Save set',exact:true}).click();await p.reload();await ready(p,'ForgeGoals');
   assert(await p.evaluate(()=>{const v=JSON.parse(localStorage.getItem('forge:goals:v1')).plans.bench.done['0-d1-0-0'];return v.w==='135'&&v.r==='6'&&v.e==='8';}),'mandatory and optional values save in their existing fields');
   assert.match(await p.locator('.fg-set[aria-current="step"]').innerText(),/Next/);assert.deepEqual(errors,[]);console.log('Map Board/date and Forge editor journeys passed',theme,engine);
  }catch(error){await p.screenshot({path:path.join(out,'batch2-failure-'+theme+'.png')}).catch(()=>{});throw error;}
  finally{await ctx.close();}
 }
}finally{await browser.close();server.close();}
