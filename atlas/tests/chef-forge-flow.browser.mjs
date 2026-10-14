import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.FLOW_BROWSER||'chromium',root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=path.join(root,'artifacts/chef-forge-flow');mkdirSync(out,{recursive:true});
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css','.png':'image/png','.ttf':'font/ttf'})[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true});
try{
 for(const theme of ['dark','light']){
 const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce',timezoneId:'America/Winnipeg',colorScheme:theme}),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/the-chef.html#planner');await p.waitForSelector('#plan-add');
 const chefRecord=()=>p.evaluate(()=>localStorage.getItem('chef:state'));
 const before=await chefRecord();await p.locator('#plan-add').click();await p.locator('[data-picker-id="b01"]').click();await p.locator('#prep-days').fill('2');await p.locator('#prep-per-day').fill('2');await p.locator('#prep-cancel').click();assert.equal(await chefRecord(),before,'Cancel does not change saved meals');
 await p.locator('#plan-add').click();await p.locator('[data-picker-id="b01"]').click();await p.locator('#prep-days').fill('2');await p.locator('#prep-per-day').fill('2');assert.equal(await p.locator('#prep-save').textContent(),'Save meal plan');assert(await p.locator('#prep-close').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Header Cancel label fits');await p.screenshot({path:path.join(out,'chef-editor-'+theme+'.png')});await p.locator('#prep-save').click();await p.waitForFunction(()=>!document.getElementById('prep-dialog').open);let saved=JSON.parse(await chefRecord());const prep=Object.values(saved.preparations).find(x=>x.recipeId==='b01');assert.equal(prep.portionCount,4);
 await p.locator('[data-edit-prep]').first().click();assert.equal(await p.locator('#prep-save').textContent(),'Save changes');await p.locator('#prep-days').fill('1');await p.locator('#prep-close').click();assert.equal(Object.values(JSON.parse(await chefRecord()).preparations)[0].days,prep.days,'Cancel edit keeps saved coverage');
 assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));
 await p.goto(origin+'/workout-forge.html');await p.waitForFunction(()=>!!window.ForgeSession);
 await p.waitForSelector(".fg-home");
 await p.evaluate(()=>{state.openDay=PROGRAM[0].key;render();});await p.locator('[data-act="live"]').first().click();await p.waitForSelector('.forge-live-panel');
 const first=await p.evaluate(()=>{const items=orderedItems(dayBy(state.live.key)),i=items.findIndex(it=>it.track==='load');state.live.exIdx=i;const id=effId(items[i]);state.draft[id]={sets:[{w:'10',r:''}]};saveDraft();render();return {id,index:i};});
 await p.evaluate(()=>{ForgeSession.goExercise(orderedItems(dayBy(state.live.key)).length-1);});await p.locator('[data-act="livefinish"]').click();await p.waitForSelector('#forge-entry-error');assert.equal(await p.evaluate(()=>state.live.exIdx),first.index,'Finish takes you to incomplete exercise');assert.equal(await p.evaluate(()=>state.sessions.length),0);await p.screenshot({path:path.join(out,'forge-validation-'+theme+'.png')});
 await p.locator('[data-act="setr"]').first().fill('5');await p.locator('[data-act="livefinish"]').click();await p.waitForSelector('#forge-confirm[open]');await p.screenshot({path:path.join(out,'forge-finish-'+theme+'.png')});await p.keyboard.press('Escape');assert.equal(await p.locator('#forge-confirm').count(),0);assert(await p.locator('[data-act="livefinish"]').evaluate(e=>e===document.activeElement),'Escape restores focus');
 await p.locator('[data-act="livefinish"]').click();await p.locator('#forge-confirm').getByRole('button',{name:'Save and finish',exact:true}).click();await p.waitForSelector('#forge-session-summary');assert.equal(await p.evaluate(()=>state.sessions.length),1);assert.equal(await p.evaluate(()=>state.live),null);
 assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1));assert.deepEqual(errors,[]);await c.close();
 }
 console.log(engine+': Chef cancellation and verified saving; Forge inline recovery, focus and session saving passed');
}finally{await browser.close();server.close();}
