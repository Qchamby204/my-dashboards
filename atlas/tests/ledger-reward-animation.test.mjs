import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../life-ledger.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../shared/ledger-enhancements.css',import.meta.url),'utf8');

test('earned achievement and level-up cards remain visible until dismissed',()=>{
  assert.match(html,/class=\\?"levelup panel\\?"/,'Life Ledger reward cards still use the shared levelup artwork');
  assert.match(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{\s*opacity\s*:\s*1\s*;\s*transform\s*:\s*scale\(1\)\s*\}/,'reward entrance animation must finish visible');
  assert.match(css,/\.ledger-reward \.levelup\s*\{\s*animation\s*:\s*ledgerRewardEnter [^}]+\}/,'native reward dialogs must override the legacy fading animation');
  assert.doesNotMatch(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{[^}]*opacity\s*:\s*0/,'reward entrance animation must never fade the card out at its final frame');
});
