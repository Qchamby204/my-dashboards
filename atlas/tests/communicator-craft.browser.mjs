// Isolated records; responsive browser review is separate from physical iPhone sign-off.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/communicator-craft';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const ready=async p=>{await p.waitForFunction(()=>!!window.CommunicatorLadder&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);};
const records=p=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>/^mc_|^crucible:/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))));
try{
 for(const [theme,width,size]of [['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['dark',1440,16],['light',393,32],['dark',320,32]]){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  await p.goto(origin+'/communication-trainer.html');await ready(p);if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await records(p);
  const check=async(view)=>{
   await p.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));scrollTo(0,0);});const hero=p.locator('#main .cm-feature').filter({visible:true}).first();assert(await hero.isVisible());if(view==='learn'||view.startsWith('investing-'))assert(await hero.evaluate(n=>n===document.getElementById('main').firstElementChild),'Learn opens with the title image before subject controls');const g=await hero.evaluate(n=>{const b=n.getBoundingClientRect(),title=n.querySelector('.cm-feature-title'),range=document.createRange();range.selectNodeContents(title.firstElementChild);return {top:b.top,face:getComputedStyle(n.querySelector('.cm-feature-body')).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,titleFits:[...range.getClientRects()].every(r=>r.left>=b.left-1&&r.right<=b.right+1)};});
   if(g.overflow){console.log(JSON.stringify({view,theme,width,size,overflow:await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length).map(n=>({tag:n.tagName,cls:n.className,text:n.textContent.slice(0,60),left:n.getBoundingClientRect().left,right:n.getBoundingClientRect().right,sw:n.scrollWidth,cw:n.clientWidth})).filter(n=>n.right>innerWidth+1||n.left<0||n.sw>n.cw+1).slice(0,25)}))}));await p.screenshot({path:path.join(out,'overflow.png'),fullPage:true});}
   assert(g.top<(size===32?650:400),view+' leads near the start');assert(!g.overflow,view+' page fits');assert(g.titleFits,view+' title fits');assert.equal(g.face,'rgb(21, 27, 52)');assert.equal(await hero.locator('.cm-feature-art').count(),1);const art=await hero.locator('.cm-feature-art').boundingBox(),live=await hero.evaluate(n=>n.classList.contains('cm-feature-live'));assert(art.width>=Math.min(live?180:220,width-90)&&art.height>=(live?100:112),'the opening has a full title image, with a compact active-drill variant');
   for(const button of await hero.locator('.cm-feature-footer button').all()){const b=await button.boundingBox();assert(b.height>=44&&b.width>=44,'main actions retain targets');}
   await p.screenshot({path:path.join(out,`${view}-${theme}-${width}-${size}.png`)});reports.push({view,theme,width,size,...g});
  };
  await p.locator('.cm-stage-key').last().click();
  assert(await p.locator('.cl-roadmap').evaluate(n=>n.open));
  assert(await p.locator('.cl-stage').last().evaluate(n=>n===document.activeElement));
  assert.equal(await records(p),before,'reading a locked stage does not start a practice');
  await p.screenshot({path:path.join(out,`expanded-ladder-${theme}-${width}-${size}.png`)});
  if(width===1440){
   const copy=await p.locator('.cl-next .cm-feature-copy').boundingBox(),stage=await p.locator('.cl-next .cm-stage').boundingBox();
   assert(stage.x>=copy.x+copy.width,'desktop places the projection alongside the prompt');
  }
  for(const view of ['dash','learn','train','topics','progress','assess']){await p.evaluate(id=>nav(id),view);await check(view);assert.equal(await p.locator('#main .cm-feature').filter({visible:true}).first().locator('.cm-feature-art').getAttribute('data-illustration'),{dash:'speak',learn:'learn',train:'practice',topics:'topics',progress:'progress',assess:'review'}[view]);if(view==='topics'){await p.locator('#communication-topic-open').click();const dialog=p.getByRole('dialog',{name:'Edit topics',exact:true});assert(await dialog.isVisible());assert(await dialog.evaluate(n=>{const b=n.getBoundingClientRect();return [...n.querySelectorAll('input,select,textarea,button')].filter(el=>el.checkVisibility()).every(el=>{const r=el.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1;});}),'topic editor controls fit');await p.screenshot({path:path.join(out,`topic-editor-${theme}-${width}-${size}.png`)});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();}}
  await p.evaluate(()=>nav('learn'));await p.locator('[data-learning-action="track"][data-learning-value="investing"]').click();
  for(const ref of ['blocks','statements','arsenal','workflow','method','arc','today','cadence']){await p.locator('#communicator-reference').selectOption(ref);await check('investing-'+ref);}
  assert.equal(await records(p),before,'browsing every opening and cancelling an editor preserves exact progress bytes');
  await p.evaluate(()=>nav('dash'));await p.locator('.cl-next [data-ladder-start]').first().click();await check('active-practice');
  if(width===393&&theme==='dark'&&size===16){
   await p.locator('#tbtn').click();
   await p.waitForFunction(()=>Number(document.querySelector('#cm-timer-arc').getAttribute('stroke-dashoffset'))>0);
   await p.locator('#tbtn').click();
   const paused=await p.locator('#cm-timer-arc').getAttribute('stroke-dashoffset');
   await p.waitForTimeout(1100);
   assert.equal(await p.locator('#cm-timer-arc').getAttribute('stroke-dashoffset'),paused);
  }
  await p.locator('#txBox').fill('A draft retained across the updated practice layout.');await p.reload();await ready(p);await p.evaluate(()=>nav('dash'));await check('unfinished-practice');assert(await p.getByRole('button',{name:'Resume practice',exact:true}).isVisible());await p.getByRole('button',{name:'Resume practice',exact:true}).click();assert.equal(await p.locator('#txBox').inputValue(),'A draft retained across the updated practice layout.');assert.deepEqual(errors,[]);await ctx.close();
 }
 // A real saved ladder attempt retains its transcript, score and receipt after reload.
 const ctx=await browser.newContext({viewport:{width:393,height:852},colorScheme:'light',reducedMotion:'reduce'}),p=await ctx.newPage();await p.goto(origin+'/communication-trainer.html');await ready(p);await p.locator('.cl-next [data-ladder-start]').first().click();await p.locator('#txBox').fill('One clear point, one concrete example, and why it matters.');await p.locator('[data-ladder-performed]').check();await p.getByRole('button',{name:'Save practice (+10 XP)',exact:true}).click();assert(await p.locator('.communication-saved.cm-feature').isVisible());assert(await p.locator('.communication-saved .cl-result').evaluate(n=>parseFloat(getComputedStyle(n).fontSize)>=32),'the saved score leads its metadata');assert.equal(await p.locator('.communication-saved .cm-feature-support>.cl-emblem').count(),0,'the receipt does not repeat its decorative artwork');await p.screenshot({path:path.join(out,'saved-practice.png')});const saved=await p.evaluate(()=>S.reps.map(r=>({id:r.id,score:r.score,transcript:r.transcript})));assert.equal(saved.length,1);await p.reload();await ready(p);assert.deepEqual(await p.evaluate(()=>S.reps.map(r=>({id:r.id,score:r.score,transcript:r.transcript}))),saved);await p.evaluate(()=>nav('progress'));assert(await p.locator('.communication-career.cm-feature').isVisible());assert(await p.locator('.communication-history details').first().isVisible());assert.equal(await p.locator('.cm-trend circle').count(),1);assert.equal(await p.locator('.cm-trend strong').textContent(),saved[0].score+'/100');await p.screenshot({path:path.join(out,'saved-history.png')});await ctx.close();
 const motion=await browser.newContext({viewport:{width:1280,height:850},reducedMotion:'no-preference'}),studio=await motion.newPage();
 await studio.goto(origin+'/communication-trainer.html');await ready(studio);
 assert.equal(await studio.locator('.cm-wave').first().evaluate(n=>getComputedStyle(n).animationName),'cm-ribbon');
 await studio.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await studio.locator('.cm-wave').first().evaluate(n=>getComputedStyle(n).animationName),'none');
 const samples=await studio.evaluate(()=>{
  S.reps=Array.from({length:9},(_,i)=>({date:'2020-01-'+String(i+1).padStart(2,'0'),score:i*10}));
  S.reps.reverse();S.reps.push({date:'2099-01-01',score:100},{date:'2020-01-09',score:98,scoreOrigin:'automated'});
  S.reps=S.reps.map((rep,i)=>({...rep,id:'trend-'+i,drill:'One point',skill:'clarity',topic:'Speak clearly'}));
  const prior=JSON.stringify(S.reps);nav('progress');
  return {scores:CommunicationImprovements.recentSelfScores(),same:prior===JSON.stringify(S.reps)};
 });
 assert.deepEqual(samples,{scores:[20,30,40,50,60,70,80],same:true});
 assert.equal(await studio.locator('.cm-trend circle').count(),7);
 await motion.close();
 console.log(engine+': '+reports.length+' Communicator openings, all investing references, topic editors, draft recovery and saved receipt/history passed');
}finally{writeFileSync(path.join(out,'craft-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
