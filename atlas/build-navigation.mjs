import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const navigationPages=['life-ledger','life-map','communication-trainer','the-aqueduct','the-hourglass','the-herald','prospecting-command-center','operations-cadence','the-chef','crucible','the-library','baby-brain','neural-map','workout-forge'];
const root=new URL('../',import.meta.url),hash=async path=>createHash('sha256').update(await readFile(new URL(path,root))).digest('hex').slice(0,12);
const theme=new URL('shared/atlas-theme.js',root);let source=await readFile(theme,'utf8');
for(const asset of ['baby-enhancements.js','neural-enhancements.js','atlas-mobile.js']){
  const version=await hash('shared/'+asset);
  source=source.replace(new RegExp(asset.replaceAll('.','\\.')+'(?:\\?v=[a-zA-Z0-9-]+)?','g'),asset+'?v='+version);
}
await writeFile(theme,source);
const themeHash=await hash('shared/atlas-theme.js'),cssHash=await hash('shared/dashboard-navigation.css'),jsHash=await hash('shared/dashboard-navigation.js');
for(const page of navigationPages){
  const path=new URL(page==='life-map'?'atlas/life-map-legacy.html':page+'.html',root);let html=await readFile(path,'utf8');
  html=html.replace(/shared\/atlas-theme\.js(?:\?v=[a-zA-Z0-9-]+)?/g,'shared/atlas-theme.js?v='+themeHash);
  html=html.replace(/\n?<link rel="stylesheet" href="shared\/dashboard-navigation\.css\?v=[a-z0-9]+">/g,'').replace(/\n?<script src="shared\/dashboard-navigation\.js\?v=[a-z0-9]+" defer><\/script>/g,'');
  html=html.replace('</head>','<link rel="stylesheet" href="shared/dashboard-navigation.css?v='+cssHash+'">\n<script src="shared/dashboard-navigation.js?v='+jsHash+'" defer></script>\n</head>');
  await writeFile(path,html);
}
