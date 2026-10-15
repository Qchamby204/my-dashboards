import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';

// Resolve stylesheet dependencies before hashing their script and theme loaders.
// A new script URL alone cannot invalidate an unchanged, previously cached CSS URL.
export async function versionSharedStylesheets(root){
  const shared=new URL('shared/',root),names=await readdir(shared),styles=new Map();
  for(const name of names.filter(n=>n.endsWith('.css'))){
    styles.set(name,createHash('sha256').update(await readFile(new URL(name,shared))).digest('hex').slice(0,12));
  }
  for(const name of names.filter(n=>/\.(?:js|mjs)$/.test(n))){
    const file=new URL(name,shared),source=await readFile(file,'utf8');
    const next=source.replace(/(['"])([a-zA-Z0-9_-]+\.css)(?:\?v=[a-zA-Z0-9_.-]+)?\1/g,(match,quote,style)=>styles.has(style)?quote+style+'?v='+styles.get(style)+quote:match);
    if(next!==source)await writeFile(file,next);
  }
}
