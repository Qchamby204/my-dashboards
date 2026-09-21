import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root));
const catalog=JSON.parse(read('shared/icons/catalog.json'));
test('all dashboard entry points have versioned browser and home-screen icons',()=>{
 for(const [page,slug]of Object.entries(catalog)){
  const html=read(page).toString(),tags=[...html.matchAll(/<link\b[^>]*\brel="(?:icon|apple-touch-icon)"[^>]*>/g)].map(m=>m[0]);
  assert.equal(tags.filter(t=>t.includes('rel="apple-touch-icon"')).length,1,page);
  assert.equal(tags.filter(t=>t.includes('type="image/png"')).length,1,page);
  const svg=existsSync(new URL('shared/icons/'+slug+'.svg',root));assert.equal(tags.length,svg?3:2,page);
  for(const tag of tags){
   const url=new URL(tag.match(/href="([^"]+)"/)[1]);assert.equal(url.origin,'https://qchamby204.github.io');
   const file=url.pathname.replace('/my-dashboards/',''),bytes=read(file);
   assert.equal(url.searchParams.get('v'),createHash('sha256').update(bytes).digest('hex').slice(0,12),file);
   if(file.endsWith('.png')){assert.equal(bytes.subarray(1,4).toString(),'PNG');const size=file.endsWith('-32.png')?32:180;assert.equal(bytes.readUInt32BE(16),size);assert.equal(bytes.readUInt32BE(20),size);assert.ok(tag.includes('sizes="'+size+'x'+size+'"'));}
   else {assert.ok(tag.includes('sizes="any"'));assert.doesNotMatch(bytes.toString(),/<script|<foreignObject|https?:\/\/(?!www.w3.org)/i);}
  }
 }
});
test('every public HTML page is covered, and small tab icons stay lightweight',async()=>{
 const {readdir}=await import('node:fs/promises');for(const file of await readdir(root))if(file.endsWith('.html'))assert.ok(catalog[file],file);
 for(const slug of new Set(Object.values(catalog)))assert.ok(read('shared/icons/'+slug+'-32.png').length<6000,slug);
});
