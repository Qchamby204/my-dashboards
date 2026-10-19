import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {versionSharedAssets} from '../asset-versions.mjs';

test('a stylesheet edit invalidates the nested loader URL and its parent script hash',async()=>{
  const dir=await mkdtemp(tmpdir()+'/atlas-asset-versions-'),root=pathToFileURL(dir+'/'),shared=new URL('shared/',root);
  const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
  try{
    await mkdir(shared);const css=new URL('record.css',shared),js=new URL('record.js',shared);
    await writeFile(css,'.record{background:white}');
    await writeFile(js,`new URL('record.css?v=old-version',source); new URL('missing.css?v=keep',source); new URL('https://example.test/record.css?v=external',source);`);
    await versionSharedAssets(root);const first=await readFile(js,'utf8');
    assert(first.includes('record.css?v='+hash(await readFile(css))));
    assert(first.includes('missing.css?v=keep'));assert(first.includes('https://example.test/record.css?v=external'));
    await writeFile(css,'.record{background:ivory}');await versionSharedAssets(root);const second=await readFile(js,'utf8');
    assert.notEqual(first,second);assert.notEqual(hash(first),hash(second),'the parent theme can now invalidate its changed script dependency');
    assert(second.includes('record.css?v='+hash(await readFile(css))));
    await versionSharedAssets(root);assert.equal(await readFile(js,'utf8'),second,'unchanged builds produce stable URLs');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('shipped nested script and stylesheet loaders use actual content versions',async()=>{
  const shared=new URL('../../shared/',import.meta.url);
  for(const name of (await readdir(shared)).filter(n=>/\.(?:js|mjs)$/.test(n)&&!['atlas-theme.js','communicator-theme.js'].includes(n))){
    const source=await readFile(new URL(name,shared),'utf8');
    for(const m of source.matchAll(/(['"])(?:\.\/)?([a-zA-Z0-9_-]+\.(?:css|js|mjs))(?:\?v=([a-zA-Z0-9_.-]+))?\1/g)){
      let css;try{css=await readFile(new URL(m[2],shared));}catch(e){if(e.code==='ENOENT')continue;throw e;}
      assert.equal(m[3],createHash('sha256').update(css).digest('hex').slice(0,12),name+' must invalidate '+m[2]+' when its appearance changes');
    }
  }
});

test('nested modules and dynamic scripts propagate leaf edits through every parent',async()=>{
  const dir=await mkdtemp(tmpdir()+'/atlas-asset-chain-'),root=pathToFileURL(dir+'/'),shared=new URL('shared/',root);
  const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
  try{
    await mkdir(shared);
    await writeFile(new URL('leaf.mjs',shared),'export const value=1;');
    await writeFile(new URL('middle.js',shared),"import './leaf.mjs?v=date';");
    await writeFile(new URL('parent.js',shared),"import('./middle.js?v=1'); new URL('https://example.test/leaf.mjs?v=external',source);");
    await versionSharedAssets(root);
    const before=await readFile(new URL('parent.js',shared),'utf8');
    await writeFile(new URL('leaf.mjs',shared),'export const value=2;');
    await versionSharedAssets(root);
    const middle=await readFile(new URL('middle.js',shared),'utf8'),parent=await readFile(new URL('parent.js',shared),'utf8');
    assert(middle.includes('./leaf.mjs?v='+hash('export const value=2;')));
    assert(parent.includes('./middle.js?v='+hash(middle)));assert.notEqual(parent,before);
    assert(parent.includes('https://example.test/leaf.mjs?v=external'));
    await versionSharedAssets(root);assert.equal(await readFile(new URL('parent.js',shared),'utf8'),parent);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('dependency cycles fail before changing any file',async()=>{
  const dir=await mkdtemp(tmpdir()+'/atlas-asset-cycle-'),root=pathToFileURL(dir+'/'),shared=new URL('shared/',root);
  try{
    await mkdir(shared);
    const a="import './b.js?v=old';",b="import './a.js?v=old';";
    await writeFile(new URL('a.js',shared),a);await writeFile(new URL('b.js',shared),b);
    await assert.rejects(versionSharedAssets(root),/Circular shared asset dependency/);
    assert.equal(await readFile(new URL('a.js',shared),'utf8'),a);assert.equal(await readFile(new URL('b.js',shared),'utf8'),b);
  }finally{await rm(dir,{recursive:true,force:true});}
});
