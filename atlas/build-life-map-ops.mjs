import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
export async function lifeMapOpsScript(root){
  const html=await readFile(new URL('operations-cadence.html',root),'utf8'),match=html.match(/const DATA = (\[[\s\S]*?\n\]);/);
  if(!match)throw Error('Review Operations Cadence task extraction.');
  const data=vm.runInNewContext('('+match[1]+')',{}, {timeout:100});
  if(data.map(s=>s.id).join(',')!=='daily,weekly,monthly,quarterly,annually,adhoc')throw Error('Review Operations Cadence categories.');
  const source=(await readFile(new URL('atlas/life-map-ops.mjs',root),'utf8')).replace('export function','function');
  return source+'\n(()=>{let storage;try{storage=localStorage;}catch{}window.LifeMapOperations=createLifeMapOperations('+JSON.stringify(data)+',storage);})();\n';
}
