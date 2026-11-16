import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source=new URL('aqueduct-household/',import.meta.url);
const root=new URL('../',import.meta.url);
const load=name=>readFile(new URL(name,source),'utf8');
const digest=(value,encoding)=>createHash('sha256').update(value).digest(encoding);
const script=(await Promise.all(['engine.js','vault.js','app.js'].map(load))).join('\n');
if(/<\/script/i.test(script))throw Error('Embedded Aqueduct script contains a script end tag');
const iconOrigin='https://qchamby204.github.io/my-dashboards/';
const icons=await Promise.all(['32','64','apple'].map(async size=>{
  const file='shared/icons/the-aqueduct-'+size+'.png';
  const href=iconOrigin+file+'?v='+digest(await readFile(new URL(file,root)),'hex').slice(0,12);
  const rel=size==='apple'?'apple-touch-icon':'icon';
  const pixels=size==='apple'?'180':size;
  return {
    href,
    link:'<link rel="'+rel+'"'+(rel==='icon'?' type="image/png"':'')+
      ' sizes="'+pixels+'x'+pixels+'" href="'+href+'">\n'
  };
}));
const styles=await load('style.css');
const html=(await load('shell.html'))
  .replace('__SCRIPT_HASH__',digest(script,'base64'))
  .replace('__ICONS__',()=>icons.map(i=>i.link).join(''))
  .replace('__STYLES__',()=>styles)
  .replace('__SCRIPT__',()=>script);
const version=await shellVersion(html);
await writeFile(new URL('aqueduct-household.html',root),html);
const worker=(await load('worker.js')).replace('__SHELL_VERSION__',version)
  .replace('__ICONS_URLS__',JSON.stringify(icons.map(i=>i.href)));
await writeFile(new URL('aqueduct-household-sw.js',root),worker);

async function shellVersion(html) {
  const hash=createHash('sha256').update(html);
  for (const asset of ['manifest.webmanifest','icon.png']) {
    hash.update(await readFile(new URL('aqueduct-assets/'+asset,root)));
  }
  return hash.digest('hex').slice(0,12);
}
