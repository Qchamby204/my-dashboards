import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkJarvis(browser, origin, out) {
  const context=await browser.newContext({viewport:{width:1360,height:900},reducedMotion:'reduce'});
  const page=await context.newPage(), errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try {
    await page.goto(origin+'/jarvis/index.html');
    await page.waitForFunction(()=>document.getElementById('core-state').textContent.includes('DASHBOARDS'));
    await page.getByText('No local plan',{exact:true}).waitFor();
    await page.screenshot({path:path.join(out,'jarvis-console.png'),fullPage:true});
    await page.getByRole('button',{name:'What’s due?'}).click();
    assert.match(await page.locator('#answer').innerText(),/no Life Map plan/i);
    const before=await page.evaluate(()=>{
      const d=new Date(),today=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
      const data=JSON.stringify({projects:[{id:'demo',task:'Review a sample project',due:today,status:'Active'}]});
      localStorage.setItem('lifemap_v1',data);localStorage.setItem('lifeledger:v2',JSON.stringify([{date:today}]));
      localStorage.setItem('atlas:activity:v1',JSON.stringify({events:[{id:'demo',app:'the-herald',type:'open',at:d.toISOString(),summary:'Opened The Herald'}]}));
      dispatchEvent(new StorageEvent('storage',{key:'lifemap_v1'}));return data;
    });
    assert.match(await page.locator('#answer').innerText(),/Review a sample project/);
    await page.getByText('Checked in today',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Recent activity',exact:true}).click();
    assert.match(await page.locator('#answer').innerText(),/Opened The Herald/);
    await page.getByRole('button',{name:'Run startup'}).click();
    assert.equal(await page.locator('#boot li').count(),4);
    await page.keyboard.press('Escape');
    await page.getByRole('link',{name:/Appian Work/i}).click();
    await page.locator('#app-list .app').first().waitFor();
    assert.match(await page.locator('#app-list').innerText(),/The Herald/);
    assert.doesNotMatch(await page.locator('#app-list').innerText(),/Life Ledger/);
    await page.getByRole('button',{name:'All',exact:true}).click();
    await page.getByRole('searchbox').fill('clearbill');
    assert.equal(await page.locator('#app-list a').count(),1);
    assert.equal(await page.locator('#app-list a').getAttribute('href'),'https://clearbill.qchambers123018.chatgpt.site/');
    const shortcut={name:'Example dashboard',url:'https://example.org/my-dashboard',area:'system'};
    await page.goto(origin+'/jarvis/index.html#connect='+encodeURIComponent(JSON.stringify([shortcut])));
    await page.getByRole('button',{name:'Save shortcuts'}).click();
    await page.reload();await page.getByRole('link',{name:/Example dashboard/}).waitFor();
    assert.equal(await page.evaluate(()=>localStorage.getItem('lifemap_v1')),before);
    await page.setViewportSize({width:320,height:800});
    for(const view of ['console','directory','activity']){
      await page.getByRole('navigation').getByRole('link',{name:view[0].toUpperCase()+view.slice(1),exact:true}).click();
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No horizontal overflow on '+view);
    }
    await page.getByRole('navigation').getByRole('link',{name:'Console'}).click();
    await page.screenshot({path:path.join(out,'jarvis-phone.png'),fullPage:true});
    await page.route('https://qchamby204.github.io/my-dashboards/the-herald.html',r=>r.fulfill({contentType:'text/html',body:'<h1>Dashboard destination</h1>'}));
    await page.getByRole('button',{name:'Open Herald'}).click();
    await page.waitForURL('https://qchamby204.github.io/my-dashboards/the-herald.html');
    assert.deepEqual(errors,[]);
  } finally { await context.close(); }
}
