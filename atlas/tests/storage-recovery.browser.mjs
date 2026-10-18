// Isolated records only; browser evidence does not establish physical iPhone testing.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engine=process.env.ATLAS_BROWSER_ENGINE||'chromium',pw=createRequire(import.meta.url)('playwright');
const root=fileURLToPath(new URL('../../',import.meta.url)),out=process.env.ATLAS_SCREENSHOTS||'/tmp/storage-recovery';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);assert(f.startsWith(root));res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await pw[engine].launch();
async function chef(p){await p.goto(origin+'/the-chef.html');await p.waitForFunction(()=>typeof chefRecord!=='undefined'&&!!document.getElementById('record-recovery'));}
try{
 for(const theme of ['light','dark']){
  const c=await browser.newContext({viewport:{width:393,height:852},isMobile:true,hasTouch:true,reducedMotion:'reduce',colorScheme:theme}),p=await c.newPage(),errors=[];c.on('page',q=>q.on('pageerror',e=>errors.push(e.message)));p.on('pageerror',e=>errors.push(e.message));
  await chef(p);await p.evaluate(()=>localStorage.setItem('chef:state','{unreadable-chef'));await p.reload();await p.waitForFunction(()=>typeof chefRecord!=='undefined');
  assert(await p.locator('#storage-warn').isVisible());assert.equal(await p.evaluate(()=>setState({favourites:{b01:true}})),false);assert.equal(await p.evaluate(()=>localStorage.getItem('chef:state')),'{unreadable-chef');
  const dl=p.waitForEvent('download');await p.locator('#record-recovery').click();const download=await dl,pack=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(pack.recovery.originalRaw,'{unreadable-chef');await p.screenshot({path:path.join(out,'chef-read-recovery-'+theme+'.png')});
  await p.evaluate(()=>localStorage.removeItem('chef:state'));await p.reload();await p.waitForFunction(()=>typeof chefRecord!=='undefined');const second=await c.newPage();await chef(second);
  assert(await p.evaluate(()=>setState({favourites:{b01:true}})));assert(await second.evaluate(()=>setState({ratings:{b02:5}})));assert(await second.evaluate(()=>JSON.parse(localStorage.getItem('chef:state')).favourites.b01));
  assert.equal(await p.evaluate(()=>setState({ratings:{b02:3}})),false);assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('chef:state')).ratings.b02),5);assert(await p.locator('#storage-warn').isVisible());
  await p.evaluate(()=>localStorage.setItem('hourglass:v1','{unreadable-hourglass'));await p.goto(origin+'/the-hourglass.html');await p.waitForFunction(()=>!!window.HourglassImprovements);assert(await p.locator('#hourglass-save-error').isVisible());assert.equal(await p.evaluate(()=>{S.retireAge=55;return save();}),false);assert.equal(await p.evaluate(()=>localStorage.getItem('hourglass:v1')),'{unreadable-hourglass');
  await p.screenshot({path:path.join(out,'hourglass-read-recovery-'+theme+'.png')});
  const valid={tool:'hourglass',schemaVersion:1,state:{__v2:true,birth:'2000-01-01',healthyAge:90,retireAge:60,created:'2026-01-01',tab:'setup',fin:{currentAUM:'',pace:'',paceUnit:'month',growthPct:0,target:''},milestones:[],companions:[]}};
  p.once('dialog',d=>d.accept());await p.locator('[data-hourglass-restore]').setInputFiles({name:'hourglass-synthetic.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(valid))});await p.waitForFunction(()=>JSON.parse(localStorage.getItem('hourglass:v1')).retireAge===60);assert(!(await p.locator('#hourglass-save-error').isVisible()));
  await p.reload();await p.waitForFunction(()=>!!window.HourglassImprovements);assert.equal(await p.evaluate(()=>S.retireAge),60);assert.deepEqual(errors,[]);await c.close();
 }
 console.log(engine+': corrupt-record recovery, exported raw bytes, stale-tab merge/conflict and explicit restore passed');
}finally{await browser.close();await new Promise(r=>server.close(r));}
