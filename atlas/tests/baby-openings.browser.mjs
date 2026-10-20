// Illustrated Topics, original map and reading/notes journeys without record rewrites.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/baby-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.json':'application/json','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 const profiles=[['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32],['light',393,16,'empty'],['light',1280,16]];
 for(const [theme,width,size,empty]of profiles){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{try{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await p.goto(origin+'/baby-brain.html');await p.waitForFunction(()=>!!window.BabyNavigation&&!!window.AtlasPageNavigation);await p.waitForFunction(()=>getComputedStyle(document.querySelector('.baby-opening')).borderRadius==='24px');
  assert.equal(await p.evaluate(()=>BabyNavigation.mode),width<=700?'list':'map','original device default retained');if(width>700)await p.waitForFunction(()=>{const n=document.getElementById('nodes').getBoundingClientRect();return n.top>=document.querySelector('.baby-map-chooser').getBoundingClientRect().bottom&&n.bottom<=document.getElementById('legend').getBoundingClientRect().top;});
  const topic=await p.evaluate(()=>{const n=BabyNavigation.findTopics('')[0];return {id:n.id,label:n.l};});
  if(!empty){await p.evaluate(id=>localStorage.setItem('babybrain.v1',JSON.stringify({[id]:{n:'Sample retained note',s:'learning',d:[],lk:[]},'retained-unknown-topic':{n:'A compatible record to retain',s:'empty',d:[],lk:[]}})),topic.id);await p.reload();await p.waitForFunction(()=>!!window.BabyNavigation&&!!window.AtlasPageNavigation);}
  if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  await p.evaluate(()=>document.fonts.ready);
  const before=await p.evaluate(()=>localStorage.getItem('babybrain.v1')),stage=await p.locator('#stage').elementHandle(),search=await p.locator('#baby-find').elementHandle(),originalTopics=await p.evaluate(()=>LEAVES.length);
  const choose=async label=>{await p.locator('#atlas-page-navigation').getByRole('button',{name:label,exact:true}).click();await p.waitForFunction(label=>BabyNavigation.mode===(label==='Topics'?'list':'map'),label);};
  await choose('Topics');assert.equal(await p.locator('.baby-topic').count(),originalTopics,'all original leaf topics remain');
  assert(await p.locator('.baby-list').evaluate(n=>n.scrollTop===0),'Topics selection opens at its title image');
  const g=await p.locator('.baby-opening').evaluate(n=>({card:n.getBoundingClientRect().toJSON(),art:n.querySelector('svg').getBoundingClientRect().toJSON(),page:document.documentElement.scrollWidth,list:document.querySelector('.baby-list').scrollWidth}));
  assert(g.page<=width+1&&g.list<=width+1&&g.art.width>180&&g.art.left>=g.card.left&&g.art.right<=g.card.right+1,'opening image fits');
  assert.equal(await p.locator('.baby-title-art image').count(),1,'original full-colour moon emblem retained');
  assert(await p.locator('.baby-opening').evaluate(n=>{const lum=c=>{const a=c.match(/[\d.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return a[0]*.2126+a[1]*.7152+a[2]*.0722;},bg=lum(getComputedStyle(n).backgroundColor),fg=lum(getComputedStyle(n.querySelector('h1')).color);return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05)>=4.5;}),'title contrast');
  await p.screenshot({path:path.join(out,`baby-topics-${theme}-${width}-${size}${empty?'-empty':''}.png`)});
  await p.getByRole('button',{name:'Browse topics',exact:true}).click();assert(await p.locator('#baby-find').evaluate(n=>n===document.activeElement),'Browse reaches original search');
  assert(await p.locator('.baby-filters').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.hud').getBoundingClientRect().bottom),'filters clear the header');
  if(width===393&&size===16&&!empty)await p.screenshot({path:path.join(out,'baby-filters-'+theme+'.png')});await p.locator('#baby-find').fill(topic.label);assert(await p.locator('.baby-topic').count()>0);await p.locator('.baby-topic').filter({has:p.getByText(topic.label,{exact:true})}).first().click();await p.waitForSelector('#sheet.show');assert.equal(await p.locator('#shTitle').textContent(),topic.label);
  if(!empty)assert.equal(await p.locator('#notes').inputValue(),'Sample retained note');assert(await p.locator('#notes').evaluate((n,size)=>parseFloat(getComputedStyle(n).fontSize)>=size,size),'note field respects enlarged text');
  await p.locator('.baby-jumps').getByRole('button',{name:'Notes',exact:true}).click();assert(await p.locator('#notes').evaluate(n=>n===document.activeElement));assert(await p.locator('#notes').evaluate(n=>n.getBoundingClientRect().top>=document.querySelector('.baby-jumps').getBoundingClientRect().bottom-1),'Notes clears wrapped reading navigation');await p.screenshot({path:path.join(out,`baby-notes-${theme}-${width}-${size}.png`)});await p.locator('#shClose').click();
  assert.equal(await p.locator('#baby-find').inputValue(),topic.label,'query retained when closing a topic');assert(await p.locator('.baby-topic').evaluateAll(ns=>ns.some(n=>n===document.activeElement)),'focus returns to topic');
  await choose('Map');assert(await p.locator('#stage').isVisible());assert(await p.getByRole('heading',{name:'Follow your curiosity',exact:true}).isVisible());
  await p.screenshot({path:path.join(out,`baby-map-${theme}-${width}-${size}.png`)});
  assert(await p.locator('.baby-map-chooser').evaluate(n=>n.scrollWidth<=n.clientWidth+1),'map introduction and chooser fit');
  assert(await p.locator('#graph .node').count()>1,'original branches remain');assert(await p.locator('#nodes').evaluate(n=>n.getBoundingClientRect().bottom<=document.getElementById('legend').getBoundingClientRect().top+1),'original map fits above legend and navigation');assert(await stage.evaluate(n=>n===document.getElementById('stage')),'original interactive SVG node retained');
  await p.locator('#baby-map-choice').selectOption(topic.id);await p.locator('.baby-map-chooser').getByRole('button',{name:'Show topic',exact:true}).click();await p.waitForSelector('#sheet.show');assert.equal(await p.locator('#shTitle').textContent(),topic.label);await p.keyboard.press('Escape');
  await choose('Topics');assert(await p.locator('.baby-list').evaluate(n=>n.scrollTop===0),'returning opens at title');assert.equal(await p.locator('#baby-find').inputValue(),topic.label);assert(await search.evaluate(n=>n===document.getElementById('baby-find')),'original search node retained');assert.equal(await p.evaluate(()=>localStorage.getItem('babybrain.v1')),before,'reading and navigation do not rewrite records');
  await p.getByRole('button',{name:'Browse topics',exact:true}).click();await p.locator('.baby-topic').first().click();await p.locator('.baby-jumps').getByRole('button',{name:'Notes',exact:true}).click();await p.locator('#notes').fill('Opening regression note');await p.reload();await p.waitForFunction(()=>!!window.BabyNavigation);assert.equal(await p.evaluate(id=>JSON.parse(localStorage.getItem('babybrain.v1'))[id].n,topic.id),'Opening regression note','notes survive reload');
  if(!empty)assert.equal(await p.evaluate(()=>JSON.parse(localStorage.getItem('babybrain.v1'))['retained-unknown-topic'].n),'A compatible record to retain','unrelated saved records remain');
  assert.deepEqual(errors,[]);reports.push({theme,width,size,empty:!!empty,views:2});await ctx.close();
 }
 console.log(engine+': '+reports.length*2+' Baby Brain opening states, original SVG/search identity, unchanged records while browsing, retained queries/focus and notes save/reload passed');
}finally{writeFileSync(path.join(out,'baby-openings-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
