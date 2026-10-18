// Focused learning/navigation journeys; physical iPhone and VoiceOver remain separate.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engine=process.env.ATLAS_BROWSER_ENGINE||'chromium',engines=createRequire(import.meta.url)('playwright');
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/communicator-learning';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!f.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await engines[engine].launch({headless:true});
const records=p=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>/^mc_|^crucible:/.test(k)).sort().map(k=>[k,localStorage.getItem(k)]))));
const ready=async p=>{await p.waitForFunction(()=>!!window.CommunicatorLadder&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);};
const nav=(p,name)=>p.locator('#atlas-page-navigation').getByRole('button',{name,exact:true}).click();
try{
 for(const theme of ['light','dark']){
  const ctx=await browser.newContext({viewport:{width:393,height:900},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg'}),p=await ctx.newPage(),errors=[];
  p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(15000);
  try{
   await p.goto('http://127.0.0.1:'+server.address().port+'/communication-trainer.html');await ready(p);
   const untouched=await records(p);
   assert.equal(await p.locator('.cl-next').count(),1,'Today recommends one challenge');
   await nav(p,'Practice');assert.equal(await p.locator('.cl-next').count(),0,'Practice does not duplicate Today');
   assert(await p.getByRole('heading',{name:'Choose your practice',exact:true}).isVisible());
   assert(await p.getByRole('button',{name:'Go',exact:true}).count()>0,'the drill catalogue is directly available');
   assert(await p.getByRole('heading',{name:'Practise your investing knowledge',exact:true}).isVisible());
   await p.screenshot({path:path.join(out,'communicator-catalogue-'+theme+'.png')});
   await nav(p,'Learn');assert.equal(await p.getByRole('button',{name:'Start learning',exact:true}).count(),1);
   assert.equal(await p.locator('.communication-curriculum-about').getAttribute('open'),null);
   assert.equal(await records(p),untouched,'browsing does not write progress, drafts or XP');
   for(const [width,size]of [[393,16],[393,20],[393,32],[320,32],[844,32]]){
    await p.setViewportSize({width,height:900});
    const style=await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:'+size+'px!important}'});
    await p.evaluate(()=>window.scrollTo(0,0));
    const layout=await p.evaluate(()=>{
     const header=document.querySelector('.communicator-learning-header'),h=header.querySelector('h2').getBoundingClientRect(),b=header.querySelector('[data-learning-action="assessment"]').getBoundingClientRect();
     return {overflow:document.documentElement.scrollWidth>innerWidth+1,overlap:h.left<b.right&&h.right>b.left&&h.top<b.bottom&&h.bottom>b.top,
      segments:[...header.querySelectorAll('[data-learning-action="track"]')].map(n=>{const r=document.createRange();r.selectNodeContents(n);const lines=[...r.getClientRects()].filter(r=>r.width&&r.height);return {lines:lines.length,font:parseFloat(getComputedStyle(n).fontSize),width:n.getBoundingClientRect().width,height:n.getBoundingClientRect().height};})};
    });
    assert.equal(layout.overflow,false,'Learn fits '+width+'px at '+size+'px text');assert.equal(layout.overlap,false,'assessment never overlaps Learn');
    for(const s of layout.segments){assert.equal(s.lines,1,'subject words remain whole');assert(s.font>=size,'subject text follows enlargement');assert(s.width>=44&&s.height>=44);}
    await p.screenshot({path:path.join(out,'communicator-learning-'+theme+'-'+width+'-'+size+'.png')});
    await style.evaluate(n=>n.remove());
   }
   await p.setViewportSize({width:393,height:900});
   const first=await p.evaluate(()=>CURRICULUM[0].lessons[0].id),second=await p.evaluate(()=>CURRICULUM[0].lessons[1]);
   await p.getByRole('button',{name:'Start learning',exact:true}).click();
   const lesson=p.locator('#ls_'+first),title=lesson.locator('.lesson-title');
   assert.equal(await title.getAttribute('aria-expanded'),'true');assert(await title.evaluate(n=>n===document.activeElement),'continuation focuses the opened lesson');
   assert.equal(await records(p),untouched,'opening the lesson does not complete it or grant XP');
   await lesson.getByRole('button',{name:/^Complete lesson:/}).click();
   const completed=await records(p);await p.reload();await ready(p);await nav(p,'Learn');
   assert.equal(await p.locator('#communication-next-lesson').textContent(),second.title,'reload selects the next saved unfinished lesson');
   await p.getByRole('button',{name:'Continue learning',exact:true}).click();
   assert.equal(await p.locator('#ls_'+second.id+' .lesson-title').getAttribute('aria-expanded'),'true');
   assert.equal(await records(p),completed,'continuing reads saved history without rewriting it');
   await p.screenshot({path:path.join(out,'communicator-lesson-open-'+theme+'.png')});
   // The existing lesson handoff and copy action still lead to the same practice.
   await p.locator('#ls_'+second.id).getByRole('button',{name:'Practise this skill →',exact:true}).click();
   assert(await p.getByRole('button',{name:'Learn about this topic · copy prompt',exact:true}).isVisible());
   const transcript='Keep this unfinished practice while I browse lessons.';await p.locator('#txBox').fill(transcript);
   await nav(p,'Today');assert(await p.getByRole('button',{name:'Resume practice',exact:true}).isVisible());
   await nav(p,'Learn');await nav(p,'Practice');assert.equal(await p.locator('#txBox').inputValue(),transcript);
   await p.reload();await ready(p);await nav(p,'Practice');assert.equal(await p.locator('#txBox').inputValue(),transcript,'draft survives reload after changing sections');
   assert.deepEqual(errors,[]);console.log('Communicator learning and catalogue passed',theme,engine);
  }catch(error){await p.screenshot({path:path.join(out,'communicator-learning-failure-'+theme+'.png')}).catch(()=>{});throw error;}
  finally{await ctx.close();}
 }
}finally{await browser.close();server.close();}
