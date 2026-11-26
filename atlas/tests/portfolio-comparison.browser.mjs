import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch();
const url=new URL('../../portfolio-studio.html',import.meta.url);
url.hash='compare-holding';

async function assertReadableRangeRow(row) {
 const ratios = await row.evaluate(group => {
  function luminance(node) {
   const rgb = getComputedStyle(node).fill.match(/[\d.]+/g).slice(0,3).map(value => {
    const channel = Number(value) / 255;
    return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4;
   });
   return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  }
  const background = luminance(group.querySelector('.pj-row-bg'));
  return [...group.querySelectorAll('text')].map(text => {
   const ink = luminance(text);
   return (Math.max(background,ink) + .05) / (Math.min(background,ink) + .05);
  });
 });
 assert(ratios.length >= 2 && ratios.every(value => value >= 4.5), 'Range row text contrast: ' + ratios);
}

try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.goto(url.href);
  const find=selector=>page.locator(selector);
  const holdings=find('#pfCompare');
  await holdings.waitFor();
  assert.match(await holdings.innerText(),/\$7,670/);
  assert.match(await holdings.innerText(),/\$9,772/);
  assert.deepEqual(await find('.hc-tick').allTextContents(),['0%','0.25%','0.5%','0.75%','1%','1.25%']);
  assert.equal(await find('.hc-point').count(),2);
  await find('#compare-allocation').click();
  assert.equal(await find('.hc-delta:visible').count(),width===390?3:14);
  if(width===390){await find('.hc-more').click();assert.equal(await find('.hc-delta:visible').count(),14);}
  await find('#compare-returns').click();assert(await find('#growthPlot').isVisible());
  await find('#snap').selectOption('archive');await find('#compare-holdings').click();
  assert.match(await holdings.innerText(),/No reported match/);assert.equal(await find('.hc-point').count(),0);
  await find('#snap').selectOption('latest');await find('#balance').fill('500000');
  await find('#prepareSequence').click();
  await find('#sequenceSteps select').nth(1).selectOption('replay');
  await find('#saveSequence').click();await find('#sequenceClose').click();
  await page.reload();await find('#prepareSequence').click();await find('#resumeSequence').click();
  assert.equal(await find('#balance').inputValue(),'500000');
  await find('#sequenceNext').click();
  await page.reload();await find('#prepareSequence').click();assert.match(await find('#resumeSequence').innerText(),/step 2/);
  await find('#resumeSequence').click();assert.match(await find('#sequencePosition').innerText(),/Step 2 of 3/);
  assert.equal(await find('.coach-markers button').count(),1);
  const path=await find('.coach-chart .pf-past').getAttribute('d');
  await find('#coachingReveal').click();assert.equal(await find('.coach-chart .pf-past').getAttribute('d'),path);
  assert.match(await find('.coach-readout').innerText(),/Aug 2009 · \$95\.07/);
  await find('[data-point="low"]').click();assert.match(await find('.coach-readout').innerText(),/Feb 2009 · \$75\.01/);
  await find('#sequenceNext').click();assert(await find('#pfCompare details').first().evaluate(el=>el.open));
  await find('#sequenceNext').click();assert(await find('#sequenceBar').isHidden());
  await page.goto(new URL('#purchasing-power',url).href);
  await find('#pp-days').waitFor();
  assert.equal(await find('#pp-days').innerText(),'19.8 days');
  await find('#pp-inflation').fill('3');
  assert.match(await find('#pp-cost').innerText(),/\$9,031/);
  assert.equal(await find('#pp-days').innerText(),'16.6 days');
  await find('#pp-current').fill('3');
  assert.equal(await find('#pp-days').innerText(),'30 days');
  assert.equal(await find('#pp-calendar .is-full').count(),30);
  await find('.pp-basket summary').click();
  await find('#pp-expense-0').fill('2500');
  assert.equal(await find('#pp-month').inputValue(),'5100');
  await find('#pp-month').fill('1234.56');
  const cents=await find('.pp-budget-row input').evaluateAll(els=>els.reduce((sum,el)=>sum+Math.round(el.valueAsNumber*100),0));
  assert.equal(cents,123456);
  await find('#pp-model-a').selectOption('DFA917');
  await find('#pp-path').selectOption('a');
  await find('#pp-fee').fill('0.2');
  assert.equal(await find('#pp-days').innerText(),'30 days');
  await find('#pp-current').fill('6');
  assert.match(await find('.pp-card').nth(1).innerText(),/fewer months/);
  await find('#pp-month').fill('0');
  assert(await find('#pp-error').isVisible());
  assert(await find('#pp-days').isHidden());
  await find('#pp-month').fill('4500');
  await find('#prepareSequence').click();
  await find('#sequenceSteps select').first().selectOption('power');
  await find('#saveSequence').click();
  await page.reload();
  await find('#prepareSequence').click();await find('#resumeSequence').click();
  assert.equal(await find('#pp-month').inputValue(),'4500');
  assert.equal(await find('#pp-path').inputValue(),'a');
  assert.equal(await find('#pp-current').inputValue(),'6');
  assert.equal(await find('#pp-days').innerText(),'30 days');
  assert(await find('#purchasing-power').isVisible());
  await page.goto(url.href);
  await page.reload();
  await find('#balance').fill('10000');
  await page.goto(new URL('#outcome-range',url).href);
  const selected = find('#pjRange .pj-row.on');
  const other = find('#pjRange .pj-row:not(.on)').first();
  for (const theme of ['dark','light']) {
   await page.emulateMedia({colorScheme:theme});
   await page.waitForFunction(value=>document.documentElement.dataset.theme===value,theme);
   await selected.waitFor();
   await assertReadableRangeRow(selected);
   await other.hover();
   await assertReadableRangeRow(other);
   const nextName = await other.locator('.pj-name').textContent();
   await other.click();
   assert.equal(await selected.locator('.pj-name').textContent(),nextName);
   await assertReadableRangeRow(selected);
  }
  const cash=find('#pjRange .pj-cash-row'), cashValue=cash.locator('.pj-mid');
  const waitForCash=value=>page.waitForFunction(expected=>document.querySelector('.pj-cash-row .pj-mid')?.textContent===expected,value);
  const selectedModel=await find('#pjModel').inputValue();
  await find('#pjYears').fill('10');
  await page.waitForFunction(()=>document.querySelector('#pjYearsOut').textContent==='10');
  await waitForCash('$12,677');
  assert.equal(await cash.locator('.pj-bar').count(),0);
  await cash.locator('.pj-cash-dot').click();
  assert.equal(await find('#pjModel').inputValue(),selectedModel);
  await find('#pjCashBasis').selectOption('zero');
  assert.equal(await cashValue.textContent(),'$10,000');
  await find('#pjReal').click();
  assert.equal(await cashValue.textContent(),'$8,123');
  await find('#pjNominal').click();
  await find('#pjCashBasis').selectOption('custom');
  await find('#pjCashRate').fill('5');
  assert.equal(await cashValue.textContent(),'$16,289');
  await find('#pjCashRate').fill('');
  assert(await find('#pjCashError').isVisible());
  assert.equal(await cash.count(),0);
  assert.equal(await find('#pjRange .pj-row').count(),8);
  await find('#pjCashBasis').selectOption('zero');
  await find('#pjIndexed').uncheck();
  await find('#pjAdd').fill('1200');
  await waitForCash('$22,000');
  await find('#pjTake').fill('600');
  await waitForCash('$16,000');
  await find('#pjHist').click();
  assert.equal(await cashValue.textContent(),'$16,000');
  await find('#pjCashBasis').selectOption('benchmark');
  assert.equal(await cash.locator('.pj-bar').count(),2);
  assert.match(await cash.locator('desc').textContent(),/T-bills.*8 in 10/);
  const historical=await cashValue.textContent();
  await find('#pjFee').fill('4');
  await page.waitForFunction(()=>document.querySelector('#pjRangeSub').textContent.includes('4.00%'));
  assert.equal(await cashValue.textContent(),historical);
  await find('#pjCashBasis').selectOption('zero');
  await find('#pjIndexed').check();
  await find('#pjG2').click();
  await page.getByLabel('Income per year').fill('200');
  await page.getByLabel('Starting in year').fill('4');
  const inflation=1.021;
  const indexedCash=Array.from({length:10},(_,year)=>
   (year<3?600:-800)*inflation**year).reduce((balance,flow)=>Math.max(0,balance+flow),10000);
  await waitForCash('$'+Math.round(indexedCash).toLocaleString('en-CA'));
  await page.getByLabel('Income per year').fill('100000');
  await waitForCash('$0');
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Portfolio comparisons, cash outcomes, meeting restoration and fixed-scale replay passed on phone and desktop viewports.');
}finally{await browser.close();}
