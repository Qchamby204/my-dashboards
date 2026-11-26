import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

const {chromium}=createRequire(import.meta.url)('playwright');
const browser=await chromium.launch();
const url=new URL('../../portfolio-studio.html',import.meta.url);
url.hash='compare-holding';

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
  assert.deepEqual(errors,[]);
  await context.close();
 }
 console.log('Portfolio comparisons, meeting restoration and fixed-scale replay passed on phone and desktop viewports.');
}finally{await browser.close();}
