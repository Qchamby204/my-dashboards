import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {defaults} from '../../shared/reminder-core.mjs';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=path.join(root,'artifacts/reminders');mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.mjs':'text/javascript','.webmanifest':'application/manifest+json','.png':'image/png','.ttf':'font/ttf'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true});
try{
for(const [theme,width,size] of [['light',393,16],['dark',320,16],['dark',393,20]]){
 const c=await browser.newContext({viewport:{width,height:852},isMobile:true,hasTouch:true,colorScheme:theme});const p=await c.newPage();const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message);});p.setDefaultTimeout(10000);
 await p.goto(origin+'/reminders.html');await p.waitForSelector('.reminder');await p.evaluate(size=>document.documentElement.style.fontSize=size+'px',size);
 assert.equal(await p.locator('.reminder').count(),3);assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.reminders.v1')),null,'opening does not save defaults');
 await p.locator('#save').click();await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('saved on this device'));
 await p.reload();await p.waitForSelector('.reminder');assert.equal(await p.locator('.reminder').count(),3);
 await p.locator('#add').click();assert.equal(await p.locator('.reminder').count(),4);
 const last=p.locator('.reminder').last();await last.locator('[data-field="repeat"]').selectOption('once');await p.locator('#save').click();assert.match(await p.locator('#feedback').textContent(),/Choose a date/);
 await last.locator('[data-field="date"]').fill('2026-12-01');await last.locator('[data-field="title"]').fill('Prepare for a meaningful conversation');await p.locator('#save').click();
 await p.waitForFunction(()=>JSON.parse(localStorage.getItem('atlas.reminders.v1')).reminders.length===4);
 await p.locator('#paused').check();await p.locator('#save').click();assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('atlas.reminders.v1')).paused),true);
 await p.locator('#setup').evaluate(el=>el.open=true);await p.locator('#setup').scrollIntoViewIfNeeded();
 assert(!await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),'setup fits phone');
 await p.screenshot({path:path.join(out,`setup-${theme}-${width}-${size}.png`)});
 await p.locator('.reminder').first().locator('summary').click();
 await p.locator('.reminder').first().screenshot({path:path.join(out,`schedule-${theme}-${width}-${size}.png`)});
 // Quota failures must not become saved feedback.
 await p.evaluate(()=>Storage.prototype.setItem=function(){throw Error('Storage full');});await p.locator('#save').click();assert.match(await p.locator('#feedback').textContent(),/Storage full/);
 assert.deepEqual(errors,[]);await c.close();
}
const c=await browser.newContext({viewport:{width:393,height:852}});await c.addInitScript(()=>localStorage.setItem('atlas.reminders.device.v1',JSON.stringify({endpoint:'https://delivery.test',token:'x'.repeat(43)})));
const p=await c.newPage();let prefs=defaults(),revision=1,fail=false,removed=false;
await p.route('https://delivery.test/**',async route=>{const r=route.request(),endpoint=new URL(r.url()).pathname;if(r.method()==='OPTIONS')return route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'}});let body={prefs,revision,active:true,history:[]},status=200;
 if(r.method()==='PUT'){if(fail){status=503;body={error:'Service offline. Changes not saved.'};}else{prefs=r.postDataJSON().prefs;revision++;body={prefs,revision,active:true,history:[]};}}
 if(endpoint==='/skip')body={skipped:true};if(endpoint==='/test')body={accepted:true};if(r.method()==='DELETE'){removed=true;body={removed:true};}
 await route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(body)});
});
await p.goto(origin+'/reminders.html');await p.waitForFunction(()=>document.getElementById('status').textContent==='Push connected');
await p.locator('#paused').check();await p.locator('#save').click();await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('paused on this device'));assert(prefs.paused);
await p.locator('[data-action="skip"]').first().click();await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Skipped for today'));
fail=true;await p.locator('#paused').uncheck();await p.locator('#save').click();await p.waitForFunction(()=>document.getElementById('feedback').textContent.includes('Service offline'));assert(prefs.paused,'failed save leaves server paused');
await p.locator('#disconnect').click();await p.waitForFunction(()=>document.getElementById('status').textContent==='Not connected');assert(removed);assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.reminders.device.v1')),null);
await c.close();
const pc=await browser.newContext();
await pc.addInitScript(()=>{
 const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/test',keys:{p256dh:'x'.repeat(87),auth:'y'.repeat(22)}}),unsubscribe:async()=>true};
 const reg={pushManager:{getSubscription:async()=>null,subscribe:async()=>sub}};
 Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>reg,ready:Promise.resolve(reg),getRegistration:async()=>reg}});
 Object.defineProperty(window,'PushManager',{value:function(){}});
 Object.defineProperty(window,'Notification',{value:{requestPermission:async()=>{window.permissionAsked=true;return 'granted';}}});
});
const pp=await pc.newPage();let paired=false;
await pp.route('https://delivery.test/**',async route=>{const r=route.request(),endpoint=new URL(r.url()).pathname;let body={};if(endpoint==='/config')body={publicKey:'A'.repeat(87)};if(endpoint==='/devices'){paired=true;body={token:'z'.repeat(43),prefs:r.postDataJSON().prefs,revision:1,active:true,history:[]};}await route.fulfill({status:r.method()==='OPTIONS'?204:200,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'*'},body:r.method()==='OPTIONS'?undefined:JSON.stringify(body)});});
await pp.goto(origin+'/reminders.html');await pp.waitForSelector('.reminder');await pp.locator('#setup').evaluate(el=>el.open=true);await pp.locator('#endpoint').fill('https://delivery.test');await pp.locator('#pairing').fill('p'.repeat(40));await pp.locator('#connect').click();await pp.waitForFunction(()=>document.getElementById('status').textContent==='Push connected');assert(paired);assert(await pp.evaluate(()=>window.permissionAsked));assert.equal(await pp.locator('#pairing').inputValue(),'');assert.equal(await pp.evaluate(()=>JSON.parse(localStorage.getItem('atlas.reminders.device.v1')).token),'z'.repeat(43));await pc.close();
console.log(engine+': reminder mobile layouts, local saves, one-time dates, pause, skip, errors and disconnect passed');
}finally{await browser.close();server.close();}
