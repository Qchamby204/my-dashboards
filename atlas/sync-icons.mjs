/* Keep every entry point's icon links versioned, including generated Life Map. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url);
const catalog=JSON.parse(await readFile(new URL('shared/icons/catalog.json',root),'utf8'));
const versioned=async(path,prefix)=>prefix+path+'?v='+createHash('sha256').update(await readFile(new URL(path,root))).digest('hex').slice(0,12);
for(const [page,slug] of Object.entries(catalog)){
 const prefix='https://qchamby204.github.io/my-dashboards/';
 const base='shared/icons/'+slug;
 const png=await versioned(base+'-32.png',prefix),apple=await versioned(base+'-apple.png',prefix);
 let links='<link rel="icon" type="image/png" sizes="32x32" href="'+png+'">\n';
 links+='<link rel="icon" type="image/png" sizes="64x64" href="'+await versioned(base+'-64.png',prefix)+'">\n';
 links+='<link rel="apple-touch-icon" sizes="180x180" href="'+apple+'">\n';
 const original=await readFile(new URL(page,root),'utf8');
 const html=original.replace(/<link\b[^>]*\brel=["'](?:icon|shortcut icon|apple-touch-icon(?:-precomposed)?)["'][^>]*>\s*/gi,'').replace('</head>',links+'</head>');
 if(html!==original)await writeFile(new URL(page,root),html);
}
