import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const refinedPages=['life-ledger','workout-forge','the-aqueduct','the-hourglass','communication-trainer','the-herald','prospecting-command-center','operations-cadence','courier','baby-brain','neural-map','chambers-wealth-hq'];
const root=new URL('../',import.meta.url);
for(const ext of ['css','js']){
  const asset='shared/atlas-refinements.'+ext;
  const digest=createHash('sha256').update(await readFile(new URL(asset,root))).digest('hex').slice(0,12);
  for(const name of refinedPages){
    if(['prospecting-command-center','the-hourglass','workout-forge'].includes(name))continue; // Preserve embedded reference data; load through the existing theme entry.
    const path=new URL(name+'.html',root),before=await readFile(path,'utf8');
    const pattern=new RegExp(asset.replaceAll('.','\\.')+'\\?v=[a-z0-9]+','g');
    if(!pattern.test(before))throw Error('Missing design asset in '+name);
    const after=before.replace(pattern,asset+'?v='+digest);
    if(after!==before)await writeFile(path,after);
  }
  const path=new URL('shared/atlas-theme.js',root),before=await readFile(path,'utf8');
  const after=before.replace(new RegExp('atlas-refinements\\.'+ext+'\\?v=[a-z0-9]+','g'),'atlas-refinements.'+ext+'?v='+digest);
  if(after!==before)await writeFile(path,after);
}
