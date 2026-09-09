import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

function app(name,saved,options={}){
  const key=name==='crucible'?'crucible':'chef',version=key==='chef'?1:2;
  const records=new Map([[key+':state',JSON.stringify(saved)],[key+':schema-version',String(version)],['unrelated','preserve']]);
  const writes=[],messages=[],prompts=[];
  const context=vm.createContext({console,setTimeout,clearTimeout,
    window:{AtlasCraftUI:{announce:m=>messages.push(m)}},
    document:{addEventListener(){},getElementById(){return null;}},
    localStorage:{getItem:k=>records.get(k)??null,setItem(k,v){if(options.failSave)throw Error('storage full');writes.push(k);records.set(k,v);}},
    confirm:message=>{prompts.push(message);return options.accept!==false;}
  });
  const html=readFileSync(new URL('../../'+(key==='chef'?'the-chef':'crucible')+'.html',import.meta.url),'utf8');
  vm.runInContext(html.match(/<script>([\s\S]*?)<\/script>/)[1],context);
  vm.runInContext('render=()=>{}',context);
  return {run:code=>vm.runInContext(code,context),json:code=>JSON.parse(vm.runInContext('JSON.stringify('+code+')',context)),writes,messages,prompts,records};
}
const chefState=()=>({favourites:{b01:true},ratings:{b01:4},plan:{mon:{breakfast:'b01'}},checked:{eggs:true}});

test('Crucible keeps old notes/checks and does not rewrite current records on load',()=>{
  const saved={checks:{'2023-01-03::t:t1':true,'blocks::b01':true},notes:{'2023-01-03':'Old learning note'},tab:'today'};
  const a=app('crucible',saved);
  assert.deepEqual(a.json('state'),saved);assert.equal(a.writes.length,0);
  assert.equal(a.json('historyEntries("old learning")')[0].day,'2023-01-03');
  assert.equal(a.records.get('unrelated'),'preserve');
});
test('Archive searches dates, notes and completed exercise text while escaping notes',()=>{
  const a=app('crucible',{checks:{'2026-09-08::t:t1':true},notes:{'2026-09-08':'<img src=x onerror=alert(1)>'},tab:'archive'});
  assert.equal(a.json('historyEntries("Overnight")').length,1);
  assert.equal(a.json('historyEntries("2026-09-08")').length,1);
  assert.equal(a.json('historyEntries("not found")').length,0);
  assert.ok(a.run('viewArchive()').includes('&lt;img'));
  assert.ok(!a.run('viewArchive()').includes('<img'));
});
test('Weekly review respects Monday–Sunday and keeps undated mastery as current progress',()=>{
  const a=app('crucible',{checks:{'stmt::l1_test':true},notes:{'2026-09-06':'Previous Sunday','2026-09-07':'Monday','2026-09-13':'Sunday','2026-09-14':'Next week'},tab:'review'});
  assert.deepEqual(a.json('reviewData("2026-09-07").entries.map(e=>e.day)').sort(),['2026-09-07','2026-09-13']);
  assert.equal(a.run('statementScore()'),10);
  assert.equal(a.run('mondayOf(new Date("2026-09-13T12:00:00"))'),'2026-09-07');
});
test('Crucible streaks are not capped at the former retention period',()=>{
  const a=app('crucible',{checks:{},notes:{},tab:'today'});
  a.run('for(let i=0,d=new Date();i<150;i++,d.setDate(d.getDate()-1))state.checks[dateKey(d)+"::l:l1"]=true');
  assert.equal(a.run('streak()'),150);
  for(const view of ['viewToday','viewCadence','viewArc','viewReview','viewArchive','viewBlocks','viewStatements','viewWorkflow','viewMethod','viewArsenal'])assert.ok(a.run(view+'().length')>0);
});
test('Chef loads legacy plans without changing recipes, favourites or records',()=>{
  const saved=chefState(),a=app('chef',saved);
  assert.deepEqual(a.json('state.plan'),saved.plan);assert.deepEqual(a.json('state.favourites'),saved.favourites);
  assert.equal(a.writes.length,0);assert.equal(a.run('slotServings("mon","breakfast",BY_ID.b01)'),4);
  assert.equal(a.run('RECIPES.length'),200);
  assert.equal(a.run('RECIPES.every(x=>cardHtml(x,false).includes("data-cook"))'),true);
});
test('Declining replacement leaves the plan and servings unchanged',()=>{
  const a=app('chef',chefState(),{accept:false});const before=a.json('state');
  assert.equal(a.run('planRecipe("mon","breakfast","b02",6)'),false);
  assert.deepEqual(a.json('state'),before);assert.equal(a.writes.length,0);assert.equal(a.prompts.length,1);
});
test('Undo restores the previous meal and serving count while retaining later ratings',()=>{
  const a=app('chef',{...chefState(),portions:{mon:{breakfast:2}}});
  assert.equal(a.run('planRecipe("mon","breakfast","b02",8)'),true);
  a.run('setState({ratings:{b01:5,b02:3}})');
  assert.equal(a.run('undoPlan()'),true);
  assert.deepEqual(a.json('state.plan'),{mon:{breakfast:'b01'}});
  assert.deepEqual(a.json('state.portions'),{mon:{breakfast:2}});
  assert.deepEqual(a.json('state.ratings'),{b01:5,b02:3});
  assert.equal(a.run('canUndo()'),false);
});
test('Per-meal portions scale combined grocery quantities without changing base recipes',()=>{
  const a=app('chef',{...chefState(),plan:{mon:{breakfast:'b01'},tue:{breakfast:'b01'}},portions:{mon:{breakfast:2},tue:{breakfast:8}}});
  const groceries=a.json('groceryList().flatMap(g=>g.items)');
  assert.equal(groceries.find(i=>i.n==='eggs').q,'10');
  assert.equal(groceries.find(i=>i.n==='potatoes').q,'7 1/2');
  assert.equal(a.run('scaledQty("1 1/2 cups",2)'),'3 cups');
  assert.equal(a.run('scaledQty("to taste",2)'),'to taste × 2');
  assert.equal(a.run('BY_ID.b01.servings'),4);
});
test('Invalid servings and failed writes never report a saved plan or install Undo',()=>{
  const a=app('chef',chefState(),{failSave:true});const before=a.json('state');
  assert.equal(a.run('planRecipe("mon","breakfast","b01",0)'),false);
  assert.equal(a.run('planRecipe("mon","breakfast","b01",2.5)'),false);
  assert.equal(a.run('planRecipe("mon","breakfast","b01",8)'),false);
  assert.deepEqual(a.json('state'),before);assert.equal(a.run('canUndo()'),false);
  assert.ok(a.messages.at(-1).startsWith('Could not save'));
});
test('Clear-week Undo cannot overwrite grocery checks changed afterward',()=>{
  const a=app('chef',chefState());
  a.run('commitPlan({plan:{},portions:{},checked:{}},"Week cleared.")');
  a.run('setState({checked:{eggs:true}})');
  assert.equal(a.run('undoPlan()'),false);assert.deepEqual(a.json('state.checked'),{eggs:true});
});
