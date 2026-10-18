/* Verified browser records. Missing, unreadable and conflicting data stay distinct. */
(()=>{
 'use strict';
 const host=typeof window==='undefined'?globalThis:window;
 const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 function stable(v){return JSON.stringify(v,(_,x)=>plain(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);}
 function safe(v,depth=0){
  if(depth>30)throw Error('Record is too deeply nested.');
  if(v&&typeof v==='object')for(const k of Object.keys(v)){
   if(['__proto__','prototype','constructor'].includes(k))throw Error('Invalid record key.');
   safe(v[k],depth+1);
  }
 }
 function merge(base,mine,remote,path='record'){
  if(stable(mine)===stable(base))return clone(remote);
  if(stable(remote)===stable(base)||stable(mine)===stable(remote))return clone(mine);
  if(plain(mine)&&plain(remote)&&(base===undefined||plain(base))){
   const out={};for(const k of new Set([...Object.keys(base||{}),...Object.keys(mine),...Object.keys(remote)])){
    const value=merge(base?.[k],mine[k],remote[k],path+'.'+k);if(value!==undefined)out[k]=value;
   }return out;
  }
  if(path.endsWith('.deletedRecipes')&&Array.isArray(mine)&&Array.isArray(remote))return [...new Set([...mine,...remote])];
  const keyed=a=>Array.isArray(a)&&a.every(v=>plain(v)&&typeof v.id==='string')&&new Set(a.map(v=>v.id)).size===a.length;
  if(keyed(mine)&&keyed(remote)&&(base===undefined||keyed(base))){
   const map=a=>Object.fromEntries((a||[]).map(v=>[v.id,v])),b=map(base),m=map(mine),r=map(remote),out=[];
   for(const id of new Set([...Object.keys(b),...Object.keys(r),...Object.keys(m)])){
    const value=merge(b[id],m[id],r[id],path+'.'+id);if(value!==undefined)out.push(value);
   }return out;
  }
  throw Error('Another tab changed '+path+'. Export this tab’s work, then reload to review the saved record.');
 }
 function open(key,{validate=v=>{if(!plain(v))throw Error('Choose an object record.');},normalize=v=>v,storage=localStorage}={}){
  let observed=null,base,pending,error='',kind='',latest=null;
  const parse=raw=>{const v=JSON.parse(raw);safe(v);validate(v);return v;};
  try{observed=storage.getItem(key);latest=observed;if(observed!==null)base=parse(observed);}
  catch{error='Saved records could not be read. Download a recovery copy before restoring a valid backup.';kind='read';}
  function write(value,{replace=false,restore=false}={}){
   pending=clone(value);
   if(kind==='read'&&!restore)return false;
   try{
    safe(value);validate(value);latest=storage.getItem(key);
    let next=value;
    if(replace){if(latest!==observed)throw Error('Another tab changed these records. Reload before replacing them.');}
    else if(latest!==observed){
     let remote;try{remote=latest===null?undefined:parse(latest);}catch{kind='read';throw Error('Saved records could not be read. Download a recovery copy before restoring a valid backup.');}
     try{next=merge(base,value,remote);}catch(e){kind='conflict';throw e;}
    }
    next=normalize(next);safe(next);validate(next);const raw=JSON.stringify(next);
    storage.setItem(key,raw);if(storage.getItem(key)!==raw)throw Error('Save could not be verified.');
    observed=latest=raw;base=clone(next);pending=undefined;error=kind='';return true;
   }catch(e){error=e.message||'Changes could not be saved. Keep this tab open and export a backup.';if(!kind)kind='write';return false;}
  }
  return Object.freeze({write,retry:()=>pending!==undefined&&write(pending),
   get value(){return clone(base);},get pending(){return clone(pending);},get blocked(){return kind==='read';},get error(){return error;},get kind(){return kind;},
   recovery:()=>({originalRaw:observed,latestRaw:latest,pending:clone(pending),reason:error}),
   changed(raw){if(raw!==observed){error='Another tab changed these records. Independent edits will merge; competing edits need review.';if(!kind)kind='changed';return true;}return false;}
  });
 }
 host.AtlasRecords=Object.freeze({open,merge,plain,safe});
})();
