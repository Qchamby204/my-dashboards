import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url),hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const excluded=new Set(['gang-ops-roadmap.html','test-booking-downtown.html','test-booking-fort-garry.html']);
const assets=new Map();for(const name of await readdir(new URL('shared/',root)))if(/\.(js|mjs|css)$/.test(name))assets.set('shared/'+name,hash(await readFile(new URL('shared/'+name,root))));
for(const name of await readdir(root))if(name.endsWith('.webmanifest'))assets.set(name,hash(await readFile(new URL(name,root))));
const themeURL=new URL('shared/atlas-theme.js',root);let theme=await readFile(themeURL,'utf8');
for(const [path,digest]of assets){const file=path.slice(7);if(!path.startsWith('shared/')||file==='atlas-theme.js'||file==='communicator-theme.js')continue;theme=theme.replace(new RegExp(file.replaceAll('.','\\.')+'(?:\\?v=[a-zA-Z0-9_.-]+)?','g'),file+'?v='+digest);}
await writeFile(themeURL,theme);assets.set('shared/atlas-theme.js',hash(theme));
const communicatorTheme='// Generated Communicator entry from shared/atlas-theme.js.\n'+theme;await writeFile(new URL('shared/communicator-theme.js',root),communicatorTheme);assets.set('shared/communicator-theme.js',hash(communicatorTheme));
const paths=[...(await readdir(root)).filter(p=>p.endsWith('.html')&&!excluded.has(p)), 'atlas/life-map-legacy.html','atlas/index.html'];
for(const path of paths){let source=await readFile(new URL(path,root),'utf8');
  if(!source.includes('atlas-neumo'))continue;
  source=source.replace(/<link[^>]+(?:fonts\.googleapis\.com|fonts\.gstatic\.com)[^>]*>\s*/g,'');
  source=source.replace(/<script src="(?:\/)?shared\/atlas-streak\.js(?:\?v=[^"]*)?"><\/script>\s*/g,'').replace(/<script src="(?:\/)?shared\/atlas-experience\.js(?:\?v=[^"]*)?" defer><\/script>\s*/g,'');
  const prefix=path==='atlas/index.html'?'/':'';
  source=source.replace(/(<head[^>]*>)/,'$1\n<script src="'+prefix+'shared/atlas-streak.js?v='+assets.get('shared/atlas-streak.js')+'"></script>\n<script src="'+prefix+'shared/atlas-experience.js?v='+assets.get('shared/atlas-experience.js')+'" defer></script>');
  source=source.replace(/((?:\/)?shared\/[a-zA-Z0-9_-]+\.(?:css|js|mjs)|[a-zA-Z0-9_-]+\.webmanifest)(?:\?v=[a-zA-Z0-9_.-]+)?/g,(m,p)=>assets.has(p.replace(/^\//,''))?p+'?v='+assets.get(p.replace(/^\//,'')):m);
  source=source.replace(/<meta name="theme-color" content="#[a-fA-F0-9]+">/g,'<meta name="theme-color" content="#efeae3">');
  await writeFile(new URL(path,root),source);
}
