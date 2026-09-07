import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
import worker from '../../dist/server/index.js';
import {previewDatabase} from '../preview.mjs';
import {parseLedgerTransfer,ledgerContent,ledgerWeek} from '../ledger.mjs';

const date='2026-09-07',stamp=date+'T12:00:00.000Z';
const legacy=()=>({app:'life-ledger',version:2,exportedAt:stamp,days:[{date,units:{Read:25,'Household Chore':1},note:'Made time for a book.'}],model:{renames:{Read:'Read for pleasure'},hidden:{'Board Work':true},added:[{key:'art',label:'Make something',kind:'qty',goal:999,crit:'exclude criteria'}]},goals:{Read:1000},metrics:[{private:'excluded metric'}],unrelatedSecret:'never imported'});
const blank=(day=date)=>({date:day,checked:[],note:'',tomorrow:''});
async function req(db,path,method='GET',body,user='alice',origin='https://atlas.test'){
  const headers={Origin:origin};if(user)headers['oai-authenticated-user-id']=user;if(body)headers['Content-Type']='application/json';
  const r=await worker.fetch(new Request('https://atlas.test'+path,{method,headers,body:body?JSON.stringify(body):undefined}),{DB:db});return {status:r.status,data:await r.json()};
}
const state=db=>req(db,'/api/state?week='+date).then(x=>x.data);
const backup=db=>req(db,'/api/export').then(x=>x.data);
async function preview(db,p=legacy()){const r=await req(db,'/api/ledger/import/preview','POST',{pack:parseLedgerTransfer(p)});assert.equal(r.status,200,JSON.stringify(r.data));return r.data;}
async function apply(db,p=legacy()){const plan=await preview(db,p),r=await req(db,'/api/ledger/import','POST',plan);assert.equal(r.status,200,JSON.stringify(r.data));}
async function day(db,value){return req(db,'/api/ledger/day','PUT',{day:value,revision:(await state(db)).ledger?.revision||0});}
async function habit(db,id,action,title){return req(db,'/api/ledger/habit','PATCH',{id,action,title,revision:(await state(db)).ledger.revision});}

test('Ledger migration appends a private table without changing existing practice records or history',()=>{
  const db=new DatabaseSync(':memory:'),dir=new URL('../../drizzle/',import.meta.url),files=readdirSync(dir).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files.slice(0,4))db.exec(readFileSync(new URL(file,dir),'utf8'));
  db.prepare('INSERT INTO atlas_practice_snapshots (owner,items,imported_at) VALUES (?,?,?)').run('alice','[]',stamp);
  const before=db.prepare('SELECT * FROM atlas_practice_snapshots').all(),history=db.prepare('SELECT * FROM atlas_history').all();
  db.exec(readFileSync(new URL(files[4],dir),'utf8'));
  assert.deepEqual(db.prepare('SELECT * FROM atlas_practice_snapshots').all(),before);assert.deepEqual(db.prepare('SELECT * FROM atlas_history').all(),history);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM atlas_ledger').get().n,0);db.close();
});
test('legacy imports whitelist check-ins and notes, preserve names and archives, and reject ambiguous or oversized records',()=>{
  const p=parseLedgerTransfer(legacy()),text=JSON.stringify(p);
  assert.equal(p.habits.find(h=>h.id==='legacy:Read').title,'Read for pleasure');assert.equal(p.habits.find(h=>h.id==='legacy:Board Work').archived,true);
  assert.deepEqual(p.days[0].checked,['legacy:Household Chore','legacy:Read']);assert.equal(p.days[0].note,'Made time for a book.');
  for(const excluded of ['never imported','excluded metric','exclude criteria','goal','crit','25'])assert.equal(text.includes(excluded),false);
  assert.throws(()=>parseLedgerTransfer({...legacy(),days:[...legacy().days,...legacy().days]}),/duplicate dates/);
  assert.throws(()=>parseLedgerTransfer({...legacy(),days:[{...legacy().days[0],date:'2026-02-30'}]}),/date/);
  assert.throws(()=>parseLedgerTransfer({...legacy(),days:[{date,units:{Read:-1}}]}),/amount/);
  assert.throws(()=>ledgerContent({habits:[],days:[{...blank(),checked:['missing']}]}),/unknown/);
  assert.throws(()=>ledgerContent({habits:[],days:Array.from({length:400},(_,i)=>({...blank(new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10)),note:'x'.repeat(4000)}))}),/1.5 MB/);
});
test('native check-ins and reflection persist across requests, update review, and remain private to the owner',async()=>{
  const db=previewDatabase();assert.equal((await req(db,'/api/ledger/habit','POST',{id:'atlas:read',title:'Read something',revision:0})).status,200);
  const entry={...blank(),checked:['atlas:read'],note:'A good conversation.',tomorrow:'Make room for a project.'};assert.equal((await day(db,entry)).status,200);
  const s=await state(db);assert.deepEqual(s.ledger.days,[entry]);assert.equal(ledgerWeek(s.ledger,date).length,1);assert.equal(ledgerWeek(s.ledger,'2026-09-14').length,0);
  assert.equal((await req(db,'/api/state?week='+date,'GET',null,'bob')).data.ledger,null);
  assert.equal((await req(db,'/api/ledger/habit','PATCH',{id:'atlas:read',action:'archive',revision:0},'bob')).status,404);
  assert.equal((await req(db,'/api/ledger/day','PUT',{revision:0,day:entry},null)).status,401);
  assert.equal((await req(db,'/api/ledger/day','PUT',{revision:0,day:entry},'alice','https://other.test')).status,403);db.close();
});
test('later imports preserve a cleared day, renamed habits, and archives while adding unseen dates',async()=>{
  const db=previewDatabase();await apply(db);await day(db,blank());await habit(db,'legacy:Read','rename','My reading');await habit(db,'legacy:Read','archive');
  const older=legacy();older.days.push({date:'2026-09-08',units:{Read:1},note:'A new day.'});const plan=await preview(db,older);
  assert.equal(plan.rows.find(r=>r.kind==='Day'&&r.title===date).action,'Keep');assert.equal(plan.added,1);
  await req(db,'/api/ledger/import','POST',plan);const l=(await state(db)).ledger;
  assert.deepEqual(l.days[0],blank());assert.equal(l.days[1].note,'A new day.');assert.deepEqual(l.habits.find(h=>h.id==='legacy:Read'),{id:'legacy:Read',title:'My reading',archived:true});db.close();
});
test('stale imports, edited previews, and simultaneous day writes cannot overwrite a newer Ledger',async()=>{
  const db=previewDatabase();await apply(db);const plan=await preview(db);await day(db,{...blank(),note:'Newer choice'});
  assert.equal((await req(db,'/api/ledger/import','POST',plan)).status,409);
  const changed=await preview(db);changed.pack.days[0].note='Changed after review';assert.equal((await req(db,'/api/ledger/import','POST',changed)).status,409);
  const revision=(await state(db)).ledger.revision,results=await Promise.all(['first','second'].map(note=>req(db,'/api/ledger/day','PUT',{revision,day:{...blank(),note}})));
  assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);assert.equal((await state(db)).ledger.revision,revision+1);db.close();
});
test('version 4 workspace restores and recovery copies retain Ledger contents; older backups preserve current Ledger',async()=>{
  const db=previewDatabase();await apply(db);const before=await backup(db);assert.equal(before.version,7);await day(db,blank());
  const plan=(await req(db,'/api/restore/preview','POST',{backup:before})).data;
  assert.equal(plan.changes.find(c=>c.key==='ledger').replace,1);const r=await req(db,'/api/restore','POST',plan);assert.equal(r.status,200);
  assert.deepEqual((await state(db)).ledger.days,before.ledger[0].days);
  const h=(await req(db,'/api/history')).data;
  assert.equal((await req(db,'/api/checkpoints/'+r.data.checkpoint+'/undo','POST',{seq:h.seq})).status,200);assert.deepEqual((await state(db)).ledger.days,[blank()]);
  for(const version of [1,2,3]){
    const old={...before,version};delete old.ledger;if(version===1)delete old.practice;
    const p=await req(db,'/api/restore/preview','POST',{backup:old});assert.equal(p.status,200);assert.equal(p.data.legacyLedger,true);assert.deepEqual(p.data.backup.ledger[0].days,[blank()]);
    assert.equal((await req(db,'/api/restore','POST',p.data)).status,200);assert.deepEqual((await state(db)).ledger.days,[blank()]);
  }
  const invalid={...before};delete invalid.ledger;assert.equal((await req(db,'/api/restore/preview','POST',{backup:invalid})).status,400);db.close();
});
test('Ledger history is atomic, excludes reflection text, and protects a restore against a concurrent check-in',async()=>{
  const db=previewDatabase();await apply(db);const b=await backup(db),p=(await req(db,'/api/restore/preview','POST',{backup:b})).data;
  await day(db,{...blank(),note:'Private reflection text'});assert.equal((await req(db,'/api/restore','POST',p)).status,409);
  const before=(await state(db)).ledger,events=(await req(db,'/api/history')).data.events;
  assert.ok(events.some(h=>h.entity==='ledger'&&h.after.day_count===1));assert.equal(JSON.stringify(events).includes('Private reflection text'),false);
  db.prepare("CREATE TRIGGER ledger_history_failure BEFORE INSERT ON atlas_history WHEN NEW.entity='ledger' BEGIN SELECT RAISE(ABORT,'D1 history failure'); END;").run();
  assert.equal((await day(db,blank())).status,503);assert.deepEqual((await state(db)).ledger,before);db.close();
});
