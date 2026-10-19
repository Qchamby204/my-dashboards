import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const digest=source=>createHash('sha256').update(source).digest('hex').slice(0,12);
const reference=/(['"])(\.\/)?([a-zA-Z0-9_-]+\.(?:css|js|mjs))(?:\?v=[a-zA-Z0-9_.-]+)?\1/g;
// Resolve dependencies from leaves upward, then hash the rewritten parent. Plan the
// entire graph before writing so an accidental cycle cannot leave a partial build.
export async function versionSharedAssets(root){
  const shared=new URL('shared/',root),sources=new Map(),resolved=new Map(),visiting=new Set();
  for(const name of await readdir(shared))if(/\.(?:css|js|mjs)$/.test(name))sources.set(name,await readFile(new URL(name,shared),'utf8'));
  const excluded=new Set(['atlas-theme.js','communicator-theme.js']);
  function resolve(name){
    if(resolved.has(name))return resolved.get(name);
    if(visiting.has(name))throw Error('Circular shared asset dependency: '+[...visiting,name].join(' -> '));
    visiting.add(name);
    const source=sources.get(name);
    const next=/\.m?js$/.test(name)&&!excluded.has(name)?source.replace(reference,(match,quote,prefix,child)=>{
      if(!sources.has(child)||excluded.has(child))return match;
      return quote+(prefix||'')+child+'?v='+digest(resolve(child))+quote;
    }):source;
    visiting.delete(name);resolved.set(name,next);return next;
  }
  for(const name of sources.keys())resolve(name);
  for(const [name,next]of resolved)if(next!==sources.get(name))await writeFile(new URL(name,shared),next);
}

// Only the owning page carries these versions. Editing one enhancement must not
// invalidate the common appearance loader and every unrelated dashboard entry.
export function runtimeAssets(app){
  const assets=['atlas-mobile.js'];
  if(['crucible','neural-map','baby-brain','the-aqueduct','operations-cadence','chambers-wealth-hq','prospecting-command-center','review'].includes(app))assets.push('remaining-sports.css');
  if(['prospecting-command-center','the-hourglass','workout-forge'].includes(app))assets.push('atlas-refinements.css','atlas-refinements.js');
  const enhancements={'the-herald':'herald','communication-trainer':'communication','neural-map':'neural','operations-cadence':'operations','baby-brain':'baby','workout-forge':'forge','life-ledger':'ledger'};
  if(enhancements[app])assets.push(enhancements[app]+'-enhancements.js');
  if(app==='prospecting-command-center')assets.push('prospecting-records.mjs','prospecting-enhancements.js');
  return assets;
}
