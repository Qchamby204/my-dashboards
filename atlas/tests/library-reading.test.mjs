import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
const window={};const context=vm.createContext({window});
for(const p of ['reading','catalog','pages','art'])vm.runInContext(read(`shared/library-${p}.js`),context);
const R=window.LibraryReading,seed=window.ATLAS_LIBRARY_CATALOG,refs=window.ATLAS_LIBRARY_PAGES;
const plain=x=>JSON.parse(JSON.stringify(x));
const books=[{id:'custom-a',title:'A'},{id:'custom-b',title:'B'}];
const scope=k=>['1:all','1:1A','1:1Xmine'].includes(k);
const summary=(reading,progress={},deadline='2026-10-07',today='2026-09-28',list=books)=>R.summary(list,progress,reading,{},[],deadline,today);
test('5000 pages over ten inclusive calendar days requires 500 pages per day',()=>{
 const r=summary({pageCounts:{'custom-a':2000,'custom-b':3000},pagesRead:{},goals:{}});
 assert.equal(r.total,5000);assert.equal(r.days,10);assert.equal(r.daily,500);assert.equal(r.remaining,5000);
});
test('completed books and partial progress reduce remaining pages and round targets up',()=>{
 const r=summary({pageCounts:{'custom-a':2000,'custom-b':3000},pagesRead:{'custom-a':100,'custom-b':101},goals:{}},{'custom-a':{status:'done'}});
 assert.equal(r.read,2101);assert.equal(r.remaining,2899);assert.equal(r.daily,290);
});
test('today, overdue deadlines, leap days and DST transitions use calendar dates',()=>{
 const reading={pageCounts:{'custom-a':5000},pagesRead:{},goals:{}};
 assert.equal(summary(reading,{},'2026-09-28').daily,5000);
 assert.equal(summary(reading,{},'2026-09-27').daily,null);
 assert.equal(summary(reading,{},'2026-09-27').overdue,true);
 assert.equal(summary(reading,{},'2026-03-09','2026-03-07').days,3);
 assert.equal(summary(reading,{},'2028-03-01','2028-02-28').days,3);
 for(const date of ['2026-02-29','2026-13-01','2026-09-31','','tomorrow','2026-9-1'])assert.equal(R.dayNumber(date),null);
});
test('unknown counts never silently become zero or make an unfinished section complete',()=>{
 const reading={pageCounts:{'custom-a':100,'custom-b':null},pagesRead:{},goals:{}};
 const r=summary(reading,{'custom-a':{status:'done'}});
 assert.equal(r.unknown,1);assert.equal(r.unknownRemaining,1);assert.equal(r.complete,false);
 assert.equal(summary(reading,{'custom-a':{status:'done'},'custom-b':{status:'done'}}).complete,true);
 assert.equal(summary(R.empty(),{},'',undefined,[]).complete,false);
});
test('progress beyond a revised page count is clamped without changing stored progress',()=>{
 const reading={pageCounts:{'custom-a':100},pagesRead:{'custom-a':200},goals:{}};
 assert.equal(summary(reading).remaining,0);assert.equal(reading.pagesRead['custom-a'],200);
});
test('reference counts remain distinguishable from user-confirmed counts and never follow renamed books',()=>{
 const book=seed.books[0],reading=R.empty();
 assert.equal(R.pageInfo(book,reading,refs,seed.books).confirmed,false);
 assert.equal(R.pageInfo(book,reading,refs,seed.books).pages,refs[book.id].pages);
 assert.equal(R.pageInfo({...book,title:'Another book'},reading,refs,seed.books).pages,null);
 assert.equal(R.pageInfo({...book,author:'Another author'},reading,refs,seed.books).pages,null);
 reading.pageCounts[book.id]=123;
 assert.equal(R.pageInfo(book,reading,refs,seed.books).confirmed,true);
 reading.pageCounts[book.id]=null;
 assert.equal(R.pageInfo(book,reading,refs,seed.books).pages,null);
});
test('old backups receive optional reading defaults; new backups round-trip custom books and scope goals',()=>{
 assert.deepEqual(plain(R.normalize(undefined,books,scope)),plain(R.empty()));
 const data={pageCounts:{'custom-a':5000,'custom-b':null},pagesRead:{'custom-a':250},goals:{'1:all':'2026-12-31','1:1A':'2026-11-30','1:1Xmine':'2027-01-01'}};
 assert.deepEqual(plain(R.normalize(JSON.parse(JSON.stringify(data)),books,scope)),data);
 assert.deepEqual(plain(R.normalize({pageCounts:{'removed-book':500}},books,scope).pageCounts),{});
});
test('malformed reading imports fail before replacement',()=>{
 for(const raw of [null,[],{pageCounts:[]},{pagesRead:[]},{goals:[]},{pageCounts:{'custom-a':0}},{pageCounts:{'custom-a':'200'}},{pageCounts:{'custom-a':-1}},{pageCounts:{'custom-a':1.5}},{pagesRead:{'custom-a':-1}},{goals:{'1:all':'2026-02-30'}},{goals:{'99:all':'2027-01-01'}}])assert.throws(()=>R.normalize(raw,books,scope));
});
test('all 129 original book IDs have sourced reference counts or explicit unknown reasons',()=>{
 assert.equal(seed.books.length,129);assert.equal(Object.keys(refs).length,129);
 for(const b of seed.books){const ref=refs[b.id];assert.ok(ref,b.id);if(ref.pages!==null){assert.ok(R.validPages(ref.pages),b.id);assert.match(ref.source,/^https:\/\//);assert.ok(ref.editionTitle);}else assert.ok(ref.issue,b.id);}
 assert.equal(Object.values(refs).filter(x=>x.pages!==null).length,123);
});
test('14 distinct decorative emblems have reduced-motion support and versioned assets load before the app',()=>{
 assert.equal(new Set(seed.topics.map(t=>window.LibraryArt.svg(t.id))).size,14);
 for(const t of seed.topics)assert.match(window.LibraryArt.svg(t.id),/aria-hidden="true"/);
 assert.match(read('shared/library.css'),/@media\(prefers-reduced-motion:reduce\)\{\.topic-art/);
 const html=read('the-library.html');
 for(const file of ['library-reading.js','library-pages.js','library-art.js','library.js','library.css']){
  const hash=createHash('sha256').update(read(`shared/${file}`)).digest('hex').slice(0,12);
  assert.ok(html.includes(`shared/${file}?v=${hash}`),file);
  if(file!=='library.js'&&file.endsWith('.js'))assert.ok(html.indexOf(`shared/${file}?`)<html.indexOf('shared/library.js?'));
 }
});

test('quick progress accepts exact pages and corrections, rejecting unknown totals and out-of-range entries',()=>{
 for(const value of [0,1,50,128])assert.equal(R.validProgress(value,128),true);
 for(const value of [-1,129,1.5,NaN,Infinity,'64'])assert.equal(R.validProgress(value,128),false);
 assert.equal(R.validProgress(50,null),false);
 const reading={pageCounts:{'custom-a':128},pagesRead:{'custom-a':110},goals:{}};
 reading.pagesRead['custom-a']=50;
 assert.equal(summary(reading).read,50);
 assert.equal(summary(reading).remaining,78);
});
