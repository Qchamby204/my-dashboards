import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';

const html=readFileSync(new URL('../../life-ledger.html',import.meta.url),'utf8');
const css=readFileSync(new URL('../../shared/ledger-enhancements.css',import.meta.url),'utf8');
const theme=readFileSync(new URL('../../shared/atlas-theme.js',import.meta.url),'utf8');

test('earned achievement and level-up cards remain visible until dismissed',()=>{
  assert.match(html,/class=\\?"levelup panel\\?"/,'Life Ledger reward cards still use the shared levelup artwork');
  assert.match(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{\s*opacity\s*:\s*1\s*;\s*transform\s*:\s*scale\(1\)\s*\}/,'reward entrance animation must finish visible');
  assert.match(css,/\.ledger-reward \.levelup\s*\{\s*animation\s*:\s*ledgerRewardEnter [^}]+\}/,'native reward dialogs must override the legacy fading animation');
  assert.doesNotMatch(css,/@keyframes ledgerRewardEnter\s*\{[\s\S]*100%\s*\{[^}]*opacity\s*:\s*0/,'reward entrance animation must never fade the card out at its final frame');
});

test('modern Ledger boots its current enhancement without superseded migrations',()=>{
  assert.doesNotMatch(theme,/ledger-reward-hotfix-20260916/);
  const refinements=readFileSync(new URL('../../shared/atlas-refinements.js',import.meta.url),'utf8');
  assert.doesNotMatch(refinements,/ledger-simplify-20260916/);
  const js=readFileSync(new URL('../../shared/ledger-enhancements.js',import.meta.url),'utf8');
  const version=createHash('sha256').update(js).digest('hex').slice(0,12);
  const manifest=JSON.parse(html.match(/id="atlas-runtime-assets">([^<]+)</)[1]);
  assert.equal(manifest['ledger-enhancements.js'],version);
  assert(html.indexOf('shared/ledger-rhythm-core.js')<html.indexOf('shared/atlas-theme.js'),'modern record ownership is established before enhancements');
});

test('retired Ledger hotfix files stay removed and unreferenced',()=>{
  const retired=['ledger-reward-hotfix-20260916.js','ledger-season-reset-20260915.js','ledger-simplify-20260916.js'];
  for(const file of retired){
    assert.equal(existsSync(new URL('../../shared/'+file,import.meta.url)),false,file+' was retired on October 23, 2026');
    assert.doesNotMatch(html,new RegExp(file.replace('.','\\.')));
  }
});
