// Isolated records; responsive browser review is separate from physical iPhone sign-off.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const engines=createRequire(import.meta.url)('playwright'),engine=process.env.ATLAS_BROWSER_ENGINE||'chromium';
const root=path.resolve(fileURLToPath(new URL('../../',import.meta.url))),out=process.env.ATLAS_SCREENSHOTS||'/tmp/life-map-craft';mkdirSync(out,{recursive:true});
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf','.json':'application/json','.png':'image/png'};
const server=createServer((req,res)=>{try{const file=path.resolve(root,'.'+new URL(req.url,'http://test').pathname);if(!file.startsWith(root+path.sep))throw Error();res.setHeader('Content-Type',types[path.extname(file)]||'text/plain');res.end(readFileSync(file));}catch{res.writeHead(404);res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port,browser=await engines[engine].launch({headless:true}),reports=[];
const ready=async p=>{await p.waitForFunction(()=>!!window.LifeMapDay&&!!window.CoreAppFinish);await p.evaluate(()=>document.fonts.ready);};
try{
 for(const [theme,width,textSize,populated]of [['light',393,16,false],['dark',393,16,true],['light',320,16,true],['dark',852,16,true],['light',393,32,true],['dark',320,32,true]]){
  const ctx=await browser.newContext({viewport:{width,height:width===852?393:852},colorScheme:theme,reducedMotion:'reduce',timezoneId:'America/Winnipeg',contrast:textSize===32?'more':'no-preference'}),p=await ctx.newPage(),errors=[];
  p.setDefaultTimeout(15000);p.on('pageerror',e=>errors.push(e.message));
  await ctx.route('https://qchamby204.github.io/my-dashboards/**',async route=>{try{const file=new URL(route.request().url()).pathname.replace('/my-dashboards/','');await route.fulfill({body:readFileSync(path.join(root,file)),contentType:types[path.extname(file)]||'text/plain'});}catch{await route.abort();}});
  await p.goto(origin+'/life-map.html');await ready(p);const dates=await p.evaluate(()=>({today:todayISO(),tomorrow:createLifeMapWorkflow().plus(todayISO(),1)}));
  const records={projects:populated?[{id:'home-task',task:'Prepare the home for a busy week with a long but useful next action',area:'House — Interior',status:'Not started',pri:'High',due:dates.today,plan:dates.today,parentId:'project',notes:'Keep this saved note.',checklist:[{id:'step',text:'Review the checklist',done:false}]},{id:'done',task:'Review the supplies',area:'House — Interior',status:'Done',pri:'Med',doneAt:dates.today,parentId:'project'},{id:'later',task:'Prepare tomorrow’s notes',area:'Work — Content',status:'Not started',pri:'Med',plan:dates.tomorrow}]:[],groups:populated?[{id:'project',title:'Prepare the home',area:'House — Interior',notes:'A project note'}]:[],chores:populated?[{id:'routine',chore:'Kitchen reset and household routine',cad:'Daily',area:'House — Interior',zone:'Kitchen',who:'Household'}]:[],checks:{},planned:{},log:[]};
  await p.evaluate(value=>localStorage.setItem('lifemap_v1',value),JSON.stringify(records));await p.reload();await ready(p);const before=await p.evaluate(()=>localStorage.getItem('lifemap_v1'));
  if(textSize===32)await p.addStyleTag({content:'html.atlas-neumo,html.atlas-neumo body{font-size:32px!important}'});
  for(const view of ['home','projects','calendar']){
   await p.locator('#lm-day-nav-'+view).click();await p.evaluate(()=>scrollTo(0,0));const pane=p.locator('#lm-day-view-'+view),hero=pane.locator('.lm-feature').first();assert(await hero.isVisible());
   const g=await hero.evaluate(node=>{const b=node.getBoundingClientRect(),range=document.createRange();range.selectNodeContents(node.querySelector('h2'));return {top:b.top,width:b.width,background:getComputedStyle(node).backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth+1,titleFits:[...range.getClientRects()].every(r=>r.left>=b.left-1&&r.right<=b.right+1)};});
   assert(g.top<(textSize===32?550:380),'opening card remains near the start');assert(!g.overflow,'page fits the viewport');assert(g.titleFits,'long feature title stays in its card');assert.equal(g.background,theme==='dark'?'rgb(41, 61, 80)':'rgb(37, 56, 76)');
   if(view!=='calendar'){assert.equal(await hero.locator('.lm-feature-art').count(),1);const art=await hero.locator('.lm-feature-art').boundingBox();assert(art.width>=Math.min(220,width-80)&&art.height>=112,'the opening illustration remains a focal image');}for(const el of await hero.locator('button,a').all()){const b=await el.boundingBox();assert(b.height>=43.5,'feature actions retain touch targets');}
   await p.screenshot({path:path.join(out,`${view}-${theme}-${width}-${textSize}.png`)});reports.push({view,theme,width,textSize,...g});
   if(view==='home')assert.equal(await p.locator('.appbar [data-day="capture"]').count(),1,'capture is directly available in the header');
   if(view==='projects'){
    const filter=p.getByLabel('Filter by project',{exact:true});assert.deepEqual(await filter.locator('option').allTextContents(),populated?['All projects','Prepare the home']:['All projects']);
    if(populated){await filter.selectOption('project');assert.equal(await p.locator('.lm-simple-project').count(),1);await p.screenshot({path:path.join(out,`project-filter-${theme}-${width}-${textSize}.png`)});}
   }
  }
  assert.equal(await p.evaluate(()=>localStorage.getItem('lifemap_v1')),before,'browsing and opening cards never rewrite records');
  await p.evaluate(()=>LifeMapDay.showRecords());assert(await p.getByRole('region',{name:'Your full record',exact:true}).isVisible());
  if(populated){await p.locator('[data-act="section"][data-key="proj"]').click();const progress=p.locator('.lm-project-card [role="progressbar"]').first();assert.equal(await progress.getAttribute('aria-valuenow'),'50');assert(await progress.locator('.fill').evaluate(node=>{const parent=node.parentElement.getBoundingClientRect(),b=node.getBoundingClientRect();return b.width>parent.width*.45&&b.width<parent.width*.55&&getComputedStyle(node).backgroundColor!==getComputedStyle(node.parentElement).backgroundColor;}),'project progress is visible at its actual saved fraction');}
  await p.screenshot({path:path.join(out,`records-${theme}-${width}-${textSize}.png`)});
  for(const [kind,title]of [['proj','New task'],['group','New project'],['chore','New chore']]){
   await p.evaluate(kind=>window.LifeMapWorkflow.openEditor(kind),kind);const dialog=p.getByRole('dialog',{name:title,exact:true});assert(await dialog.isVisible());
   await p.screenshot({path:path.join(out,`editor-${kind}-${theme}-${width}-${textSize}.png`)});const spill=await dialog.evaluate(n=>{const b=n.querySelector('.lm-sheet').getBoundingClientRect();return [...n.querySelectorAll('input,select,textarea,button')].filter(el=>el.checkVisibility()).map(el=>({label:el.getAttribute('data-field')||el.textContent,left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,parentLeft:b.left,parentRight:b.right})).filter(r=>r.left<r.parentLeft-1||r.right>r.parentRight+1);});assert.deepEqual(spill,[],'editor controls fit at supported sizes');
   assert(await dialog.locator('.lm-sheet-footer [data-lm-save]').isVisible(),'save stays available outside the scrolling form');assert(await dialog.locator('.lm-sheet-footer').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight+1),'save footer clears the viewport');await p.keyboard.press('Escape');
  }
  assert.deepEqual(errors,[]);assert.equal(await p.evaluate(()=>localStorage.getItem('lifemap_v1')),before);await ctx.close();
 }
 // Editor/record journey after using the compact capture form.
 const ctx=await browser.newContext({viewport:{width:393,height:852},timezoneId:'America/Winnipeg'}),p=await ctx.newPage();await p.goto(origin+'/life-map.html');await ready(p);
 await p.locator('.appbar [data-day="capture"]').click();const capture=p.getByRole('dialog',{name:'Add task',exact:true});await capture.getByLabel('Task',{exact:true}).fill('A task for the workflow check');await capture.getByRole('button',{name:'Add task',exact:true}).click();await p.locator('#lm-day-nav-projects').click();await p.getByRole('button',{name:'Actions for A task for the workflow check',exact:true}).click();await p.getByRole('button',{name:'Today',exact:true}).click();await p.locator('#lm-day-nav-home').click();await p.getByRole('region',{name:'Today’s tasks',exact:true}).getByRole('button',{name:'Complete A task for the workflow check',exact:true}).click();await p.reload();await ready(p);assert(await p.evaluate(()=>S.projects.some(t=>t.task==='A task for the workflow check'&&t.status==='Done')));await p.locator('#lm-day-nav-projects').click();await p.locator('[data-day-field="taskFilter"]').selectOption('all');await p.locator('.lm-day-view [data-lm="edit-task"]').filter({hasText:'A task for the workflow check'}).first().click();const editor=p.getByRole('dialog',{name:'Task details',exact:true});await editor.getByText('Notes, checklist & links',{exact:true}).click();await editor.getByLabel('Notes',{exact:true}).fill('A saved edit after reopening');await editor.getByRole('button',{name:'Save task',exact:true}).click();await p.reload();await ready(p);assert(await p.evaluate(()=>S.projects.some(t=>t.task==='A task for the workflow check'&&t.status==='Done'&&t.notes==='A saved edit after reopening')));await ctx.close();
 console.log(engine+': '+reports.length+' Life Map opening views, saved-project filters, record/editor layouts, saved progress and workflow passed');
}finally{writeFileSync(path.join(out,'craft-report.json'),JSON.stringify(reports,null,2));await browser.close();await new Promise(r=>server.close(r));}
