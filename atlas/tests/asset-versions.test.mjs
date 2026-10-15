import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {versionSharedStylesheets} from '../asset-versions.mjs';

test('a stylesheet edit invalidates the nested loader URL and its parent script hash',async()=>{
  const dir=await mkdtemp(tmpdir()+'/atlas-asset-versions-'),root=pathToFileURL(dir+'/'),shared=new URL('shared/',root);
  const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
  try{
    await mkdir(shared);const css=new URL('record.css',shared),js=new URL('record.js',shared);
    await writeFile(css,'.record{background:white}');
    await writeFile(js,`new URL('record.css?v=old-version',source); new URL('missing.css?v=keep',source); new URL('https://example.test/record.css?v=external',source);`);
    await versionSharedStylesheets(root);const first=await readFile(js,'utf8');
    assert(first.includes('record.css?v='+hash(await readFile(css))));
    assert(first.includes('missing.css?v=keep'));assert(first.includes('https://example.test/record.css?v=external'));
    await writeFile(css,'.record{background:ivory}');await versionSharedStylesheets(root);const second=await readFile(js,'utf8');
    assert.notEqual(first,second);assert.notEqual(hash(first),hash(second),'the parent theme can now invalidate its changed script dependency');
    assert(second.includes('record.css?v='+hash(await readFile(css))));
    await versionSharedStylesheets(root);assert.equal(await readFile(js,'utf8'),second,'unchanged builds produce stable URLs');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('shipped script loaders use the actual stylesheet content versions',async()=>{
  const shared=new URL('../../shared/',import.meta.url);
  for(const name of (await readdir(shared)).filter(n=>/\.(?:js|mjs)$/.test(n))){
    const source=await readFile(new URL(name,shared),'utf8');
    for(const m of source.matchAll(/(['"])([a-zA-Z0-9_-]+\.css)(?:\?v=([a-zA-Z0-9_.-]+))?\1/g)){
      let css;try{css=await readFile(new URL(m[2],shared));}catch(e){if(e.code==='ENOENT')continue;throw e;}
      assert.equal(m[3],createHash('sha256').update(css).digest('hex').slice(0,12),name+' must invalidate '+m[2]+' when its appearance changes');
    }
  }
});
