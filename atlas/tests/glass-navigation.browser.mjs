// Real browser input and isolated records; no claim of physical iPhone verification.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/glass-navigation';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const files=['life-ledger','life-map','workout-forge','communication-trainer','the-aqueduct','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-chef','crucible','the-library','baby-brain','neural-map'];
const core=files.slice(0,4);
try{
 for(const theme of ['light','dark']){
  const context=await browser.newContext({viewport:{width:393,height:852},colorScheme:theme,hasTouch:true,isMobile:true,timezoneId:'America/Winnipeg'});
  await context.route('https://qchamby204.github.io/my-dashboards/**',async r=>{const file=new URL(r.request().url()).pathname.replace('/my-dashboards/','');try{await r.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await r.abort();}});
  for(const app of files){
   const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(12000);
   try{
    await p.goto(origin+'/'+app+'.html');await p.waitForFunction(()=>!!window.AtlasPageNavigation&&document.documentElement.classList.contains('atlas-page-navigation'));await p.evaluate(()=>document.fonts.ready);
    const selector=app==='life-ledger'?'.ledger-nav':app==='life-map'?'.lm-day-dock':'#atlas-page-navigation',nav=p.locator(selector);
    const geometry=await nav.evaluate(n=>{const r=n.getBoundingClientRect(),c=getComputedStyle(n);return {x:r.x,right:r.right,bottom:r.bottom,width:r.width,radius:parseFloat(c.borderBottomLeftRadius),border:parseFloat(c.borderBottomWidth),blur:c.backdropFilter||c.webkitBackdropFilter,buttons:[...n.querySelectorAll('button')].map(b=>{const r=b.getBoundingClientRect();return {width:r.width,height:r.height,name:b.getAttribute('aria-label')||b.textContent.trim()}})}});
    assert(geometry.x>=12&&geometry.right<=381,'navigation floats inside both screen edges: '+JSON.stringify(geometry));assert(geometry.bottom<=840,'navigation clears the bottom edge');assert(geometry.radius>=30&&geometry.border>=1,'navigation is a complete capsule');assert.match(geometry.blur,/blur/,'glass material separates navigation from content');assert(geometry.buttons.every(b=>b.width>=44&&b.height>=44&&b.name),'all tabs have touch targets and names');
    await p.screenshot({path:path.join(out,app+'-floating-'+theme+'.png')});
    const buttons=nav.locator('button');assert(await buttons.count()>=2);await buttons.nth(1).click();await p.waitForTimeout(120);assert(await nav.locator('[aria-current="page"],[aria-selected="true"]').count()>=1,'selection follows the existing page action');
    if(app==='life-ledger'){await p.locator('#ledger-nav-today').click();await p.waitForTimeout(100);}
    if(app==='baby-brain')await nav.getByRole('button',{name:'Topics',exact:true}).click();
    await p.evaluate(()=>{const space=document.createElement('div');space.id='navigation-test-space';space.style.height='2400px';const list=[...document.querySelectorAll('.baby-list,.neural-list')].find(n=>!n.hidden);(list||document.body).append(space);if(list)list.scrollTop=180;else scrollTo(0,180);document.activeElement?.blur()});await p.waitForTimeout(80);
    assert(!(await p.evaluate(()=>document.documentElement.classList.contains('atlas-page-minimized'))),'programmatic scrolling leaves navigation available');
    await p.mouse.move(180,300);await p.mouse.wheel(0,280);await p.waitForFunction(()=>document.documentElement.classList.contains('atlas-page-minimized'));await p.waitForTimeout(260);
    assert.equal(await nav.evaluate(n=>getComputedStyle(n).opacity),'0','tabs tuck away after downward scroll');
    if(app==='life-ledger'){const save=await p.locator('.ledger-save-row').boundingBox();assert(save&&save.y>=0&&save.y+save.height<=840,'save accessory remains reachable');}
    await p.screenshot({path:path.join(out,app+'-scrolled-'+theme+'.png')});
    await p.mouse.wheel(0,-80);await p.waitForFunction(()=>!document.documentElement.classList.contains('atlas-page-minimized'));await p.waitForTimeout(260);assert.equal(await nav.evaluate(n=>getComputedStyle(n).opacity),'1','upward scroll restores the bar');
    await p.mouse.wheel(0,180);await p.waitForFunction(()=>document.documentElement.classList.contains('atlas-page-minimized'));await nav.locator('button').first().focus();await p.waitForFunction(()=>!document.documentElement.classList.contains('atlas-page-minimized'));
    if(core.includes(app)){
     await p.emulateMedia({reducedMotion:'reduce',contrast:'more'});assert.equal(await nav.evaluate(n=>getComputedStyle(n).transitionDuration),'0s','reduced motion removes sliding');assert(await nav.evaluate(n=>parseFloat(getComputedStyle(n).borderBottomWidth)>=2),'increased contrast defines the capsule');
     await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:20px!important}'});await p.setViewportSize({width:320,height:852});await p.waitForTimeout(100);assert(!(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)),'larger text fits on narrow phones');
     await p.screenshot({path:path.join(out,app+'-large-narrow-'+theme+'.png')});await p.setViewportSize({width:852,height:393});await p.waitForTimeout(100);const r=await nav.boundingBox();assert(r.x>=12&&r.x+r.width<=840,'landscape navigation fits');await p.screenshot({path:path.join(out,app+'-landscape-'+theme+'.png')});
    }
    assert.deepEqual(errors,[]);reports.push({app,theme,engine,floating:true,scrollDown:true,scrollUp:true,focusReveal:true});
   }catch(e){reports.push({app,theme,engine,error:e.message});console.error(JSON.stringify({app,theme,error:e.message}));await p.screenshot({path:path.join(out,app+'-failure-'+theme+'.png')}).catch(()=>{});}
   finally{await p.close()}
  }
  await context.close();
 }
 const failures=reports.filter(r=>r.error);console.log(JSON.stringify({engine,cases:reports.length,failures}));assert.equal(failures.length,0,'suite navigation cases passed');
}finally{writeFileSync(path.join(out,'navigation.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
