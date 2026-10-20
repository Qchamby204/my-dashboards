// Opening hierarchy, original catalogue actions, and byte-for-byte record preservation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/library-openings';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.ttf':'font/ttf','.webmanifest':'application/manifest+json'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
try{
 for(const [index,[theme,width,size]]of [['light',393,16],['dark',393,16],['light',320,16],['dark',852,16],['light',393,32],['dark',320,32]].entries()){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:size===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async r=>{try{const f=new URL(r.request().url()).pathname.replace('/my-dashboards/','');await r.fulfill({body:readFileSync(path.join(root,f)),contentType:types[path.extname(f)]||'text/plain'});}catch{await r.abort();}});
  await p.goto(origin+'/the-library.html#books');await p.waitForSelector('.library-opening');assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.library.v1')),null);
  await p.locator('[data-complete]').first().check();await p.waitForFunction(()=>localStorage.getItem('atlas.library.v1'));
  if(size===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  const before=await p.evaluate(()=>localStorage.getItem('atlas.library.v1'));
  const routes=['home','books','understanding',...(index===0?Array.from({length:14},(_,i)=>`topic/${i+1}/all/books`):['topic/1/all/books','topic/12/all/books']),'topic/1/all/distill'];
  for(const route of routes){
   await p.evaluate(hash=>{location.hash=hash;},route);await p.waitForFunction(hash=>location.hash==='#'+hash&&document.querySelector('.library-opening h1')&&document.querySelector('.library-opening').dataset.opening===(hash.startsWith('topic/')?(hash.endsWith('distill')?'distill':'topic'):hash),route);await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await p.evaluate(()=>{scrollTo(0,0);return document.fonts.ready;});
   const hero=p.locator('.library-opening'),geometry=await hero.evaluate(n=>({width:innerWidth,page:document.documentElement.scrollWidth,art:n.querySelector('svg').getBoundingClientRect().toJSON(),card:n.getBoundingClientRect().toJSON()}));
   if(geometry.page>width+1){console.log({route,theme,size,geometry,overflow:await p.evaluate(()=>[...document.querySelectorAll('body *')].filter(n=>n.getClientRects().length&&(n.getBoundingClientRect().right>innerWidth+1||n.scrollWidth>n.clientWidth+2)).slice(0,12).map(n=>({tag:n.tagName,id:n.id,cls:n.className,text:n.textContent.slice(0,55),right:n.getBoundingClientRect().right,scroll:n.scrollWidth,width:n.clientWidth})))});await p.screenshot({path:path.join(out,'overflow.png')});}
   assert(geometry.page<=width+1&&geometry.art.width>180&&geometry.art.left>=geometry.card.left&&geometry.art.right<=geometry.card.right+1,'opening artwork and content fit '+route);
   assert(await hero.evaluate(n=>{const luminance=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(v=>{v=Number(v)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;},bg=luminance(getComputedStyle(n).backgroundColor),ink=luminance(getComputedStyle(n.querySelector('h1')).color);return (Math.max(bg,ink)+.05)/(Math.min(bg,ink)+.05)>=4.5;}),'title has readable contrast on its opening face');
   assert(await hero.evaluate(n=>!document.querySelector('#main-content > *:first-child:not(.library-opening):not(.back-link)')),'title leads the page');
   assert.equal(await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length===new Set(ids).size;}),true,'artwork IDs are unique');
   if(route==='home'){assert.equal(await p.locator('.topic-card .topic-art').count(),14);assert.equal(await p.locator('.library-bookshelf > .book-shelf .book-jacket').count(),3);}
   await p.screenshot({path:path.join(out,`library-opening-${route.replaceAll('/','-')}-${theme}-${width}-${size}.png`)});reports.push({route,theme,width,size});
  }
  assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.library.v1')),before,'browsing openings preserves exact saved reading records');
  await heroAction(p,'new-book');assert(await p.locator('#book-editor-form').isVisible());await p.keyboard.press('Escape');assert.equal(await p.evaluate(()=>localStorage.getItem('atlas.library.v1')),before,'cancelling Add book preserves records');
  assert.deepEqual(errors,[]);await ctx.close();
 }
 console.log(engine+': '+reports.length+' Library openings, original badges, book jackets, Add book cancellation and saved records passed');
}finally{writeFileSync(path.join(out,'library-openings-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
async function heroAction(p,action){await p.locator('.library-opening [data-action="'+action+'"]').click();}
