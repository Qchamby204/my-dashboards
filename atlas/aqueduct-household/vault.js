'use strict';
const Vault=(() => {
  const storageKey='aqueduct-offline-v1';
  const encoder=new TextEncoder();
  const decoder=new TextDecoder();
  const ITERATIONS=600000;
  const encode=bytes=>{
    let chars='';
    for(let i=0;i<bytes.length;i+=8192) chars+=String.fromCharCode(...bytes.subarray(i,i+8192));
    return btoa(chars);
  };
  const decode=str=>Uint8Array.from(atob(str),c=>c.charCodeAt(0));
  const random=n=>crypto.getRandomValues(new Uint8Array(n));
  function parse(serialized) {
    let b;
    try { b=JSON.parse(serialized); } catch { throw new Error('Select an Aqueduct encrypted backup.'); }
    if (!b||b.format!=='AqueductVault'||b.version!==1||b.iterations!==ITERATIONS||
        typeof b.data!=='string'||typeof b.salt!=='string'||typeof b.iv!=='string'||b.data.length>100_000_000||
        decode(b.salt).length!==16||decode(b.iv).length!==12) throw new Error('This backup format is invalid or unsupported.');
    return b;
  }
  async function key(password,salt) {
    if(!crypto.subtle) throw new Error('Encryption is unavailable in this browser context. Download the HTML and open it directly in Safari or Chrome.');
    const base=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:ITERATIONS,hash:'SHA-256'},base,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
  }
  async function seal(state,secret,salt) {
    const iv=random(12);
    const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},secret,encoder.encode(JSON.stringify(state)));
    return JSON.stringify({format:'AqueductVault',version:1,iterations:ITERATIONS,salt:encode(salt),iv:encode(iv),data:encode(new Uint8Array(encrypted))});
  }
  function validate(state) {
    if (!state || state.version!==1 || !['accounts','transactions','imports','rules','projects','bills','loans','goals','excludedMonths'].every(k=>Array.isArray(state[k])) ||
        !['config','targets','billStatus'].every(k=>state[k] && typeof state[k]==='object')) throw new Error('The ledger format is unsupported.');
    return state;
  }
  async function open(serialized,password) {
    const b=parse(serialized);
    const salt=decode(b.salt), secret=await key(password,salt);
    let state;
    try {
      const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(b.iv)},secret,decode(b.data));
      state=JSON.parse(decoder.decode(bytes));
    } catch { throw new Error('Incorrect passphrase or the backup was altered.'); }
    return {state:validate(state),secret,salt};
  }
  async function create(state,password) {
    const salt=random(16);
    const secret=await key(password,salt);
    return {state,secret,salt};
  }
  const get=()=>{try{return localStorage.getItem(storageKey);}catch{return null;}};
  const put=serialized=>localStorage.setItem(storageKey,serialized);
  return {storageKey,parse,open,create,seal,get,put};
})();
