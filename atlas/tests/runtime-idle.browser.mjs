// Confirm clock text updates avoid whole-page chrome scans while structural
// redraws, focus recovery, and navigation state changes still reconcile.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const {chromium}=createRequire(import.meta.url)('playwright');
const root=fileURLToPath(new URL('../../',import.meta.url));
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.ttf':'font/ttf'};
const server=createServer((req,res)=>{try{const f=path.resolve(root,'.'+new URL(req.url,'http://local').pathname);if(!f.startsWith(root))throw Error();res.setHeader('Content-Type',types[path.extname(f)]||'text/plain');res.end(readFileSync(f));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true}),origin='http://127.0.0.1:'+server.address().port;
try{
  for(const app of ['life-ledger','workout-forge','communication-trainer','the-hourglass','operations-cadence']){
    const context=await browser.newContext({viewport:{width:393,height:844},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],failed=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('response',response=>{if(response.url().startsWith(origin)&&response.status()>=400)failed.push(response.url());});
    await page.route('https://**',route=>route.abort());
    await page.goto(origin+'/'+app+'.html');await page.waitForTimeout(800);
    const result=await page.evaluate(async()=>{
      const settle=async()=>{for(let i=0;i<12;i++)await new Promise(resolve=>queueMicrotask(resolve));};
      const probe=document.createElement('span');probe.textContent='00:00';document.body.append(probe);await settle();
      const original=document.querySelectorAll.bind(document),scans=[];
      document.querySelectorAll=selector=>{scans.push(selector);return original(selector);};
      for(let i=0;i<20;i++){probe.textContent='00:'+i;await settle();}
      const idle=scans.splice(0);
      // Removed headers must still receive the very same appearance control.
      const trigger=document.querySelector('.atlas-appearance-trigger');trigger.remove();await settle();
      const reattached=trigger.isConnected;
      // Added legacy controls retain keyboard support.
      const control=document.createElement('div');control.setAttribute('onclick','void 0');document.body.append(control);await settle();
      const keyboard=control.getAttribute('role')==='button'&&control.tabIndex===0;
      const structural=scans.splice(0);
      document.querySelectorAll=original;probe.remove();control.remove();
      return {idle,structural,reattached,keyboard};
    });
    assert.deepEqual(result.idle,[],app+' text-only clock refresh must not scan page controls');
    assert(result.structural.length>0,app+' structural redraw must still reconcile');
    assert(result.reattached,app+' appearance control reattaches');assert(result.keyboard,app+' added control receives keyboard semantics');
    if(app==='the-hourglass'){
      // Attribute-only selection changes still update the generated dock.
      await page.evaluate(()=>{const buttons=[...document.querySelectorAll('.tabbar button[data-tab]')];for(const b of buttons){b.classList.remove('active','on');b.removeAttribute('aria-current');b.setAttribute('aria-selected','false');}buttons[1].classList.add('active');buttons[1].setAttribute('aria-current','page');buttons[1].setAttribute('aria-selected','true');});
      await page.waitForFunction(()=>{const source=document.querySelector('.tabbar button.active'),label=(source.querySelector('.tlbl,.tl,.rail-label')?.textContent||source.getAttribute('aria-label')||source.textContent).trim();return document.querySelector('#atlas-page-navigation [aria-current="page"]')?.getAttribute('aria-label')===label;});
      // Text changes inside native navigation still refresh its labels.
      await page.evaluate(()=>{const active=document.querySelector('.tabbar button.active');active.removeAttribute('aria-label');active.textContent='Updated section';});
      await page.waitForFunction(()=>document.querySelector('#atlas-page-navigation [aria-current="page"]')?.textContent.trim()==='Updated section');
    }
    if(app==='life-ledger'){
      const requested=await page.evaluate(()=>performance.getEntriesByType('resource').map(entry=>entry.name));
      assert(!requested.some(url=>/ledger-(?:reward-hotfix|season-reset|simplify)-/.test(url)),'modern Ledger must not request superseded patches');
    }
    assert.deepEqual(errors,[],app+' runtime errors');assert.deepEqual(failed,[],app+' missing local assets');
    console.log('PASS',app,'20 text updates: zero control scans; redraw/keyboard/navigation retained');await context.close();
  }
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
