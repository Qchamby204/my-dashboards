import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const defined=new Set([...(read('shared/atlas-neumorphism.css')+read('shared/atlas-palette.css')).matchAll(/(--neo-[a-z0-9-]+)\s*:/g)].map(m=>m[1]));

// An undefined --neo-* token silently falls back to the legacy navy palette in light theme.
test('Life Map styles only use colour tokens the shared theme defines',()=>{
  for(const file of ['atlas/life-map-day.css','atlas/life-map-dashboard.css']){
    const used=new Set([...read(file).matchAll(/var\((--neo-[a-z0-9-]+)/g)].map(m=>m[1]));
    const missing=[...used].filter(t=>!defined.has(t));
    assert.deepEqual(missing,[],file+' uses undefined tokens');
  }
});
