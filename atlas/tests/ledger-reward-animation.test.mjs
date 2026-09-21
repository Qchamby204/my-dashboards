import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const html=readFileSync(new URL('../../life-ledger.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../shared/ledger-enhancements.css',import.meta.url),'utf8');
const theme=readFileSync(new URL('../../shared/atlas-theme.js',import.meta.url),'utf8');
const hotfix=readFileSync(new URL('../../shared/ledger-reward-hotfix-20260916.js',import.meta.url),'utf8');

test('earned achievement and level-up cards remain visible until dismissed',()=>{
  assert.match(html,/class=\\?"levelup panel\\?"/,'Life Ledger reward cards still use the shared levelup artwork');
  assert.match(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{\s*opacity\s*:\s*1\s*;\s*transform\s*:\s*scale\(1\)\s*\}/,'reward entrance animation must finish visible');
  assert.match(css,/\.ledger-reward \.levelup\s*\{\s*animation\s*:\s*ledgerRewardEnter [^}]+\}/,'native reward dialogs must override the legacy fading animation');
  assert.doesNotMatch(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{[^}]*opacity\s*:\s*0/,'reward entrance animation must never fade the card out at its final frame');
});

test('Ledger loads a uniquely versioned reward hotfix instead of the September cache key',()=>{
  assert.match(theme,/ledger-reward-hotfix-20260916\.js/);
  const js=readFileSync(new URL('../../shared/ledger-enhancements.js',import.meta.url),'utf8');
  const version=createHash('sha256').update(js).digest('hex').slice(0,12);
  assert.ok(theme.includes('ledger-enhancements.js?v='+version));
  assert.doesNotMatch(theme,/ledger-enhancements\.js\?v=progress-20260909/);
});

test('runtime hotfix defeats the legacy fade even when stale CSS is present',()=>{
  assert.match(hotfix,/@keyframes ledgerRewardStable[\s\S]*100%\{opacity:1;transform:scale\(1\)\}/);
  assert.match(hotfix,/\.levelup\{[\s\S]*animation:ledgerRewardStable[^}]*!important/);
  assert.match(hotfix,/setProperty\('animation','none','important'\)/);
  assert.match(hotfix,/setProperty\('opacity','1','important'\)/);
  assert.match(hotfix,/MutationObserver\(scan\)/);
});
