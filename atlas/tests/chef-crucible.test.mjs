import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

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

test('Fit Foodie imports every recipe page once and retains all 200 existing recipes',()=>{
  const a=app('chef',chefState());
  const separators=new Set([14,24,29,33,37,43,46,68,74,78,82,94,97,103,108]);
  const expected=Array.from({length:109},(_,i)=>i+2).filter(p=>!separators.has(p));
  assert.deepEqual(a.json('RECIPES.filter(x=>x.tags.includes("fitfoodie")).map(x=>x.source.page)'),expected);
  assert.equal(a.run('RECIPES.length'),449);
  assert.equal(a.run('new Set(RECIPES.map(x=>x.id)).size'),449);
  assert.equal(a.run('RECIPES.filter(x=>x.source).every(x=>x.steps.every(s=>!/^Page\\b/i.test(s)))'),true);
  assert.equal(a.run('BY_ID["ff-002"].steps.length'),6);
  assert.equal(a.run('RECIPES.filter(x=>!x.source).length'),200);
  assert.equal(a.run('RECIPES.every(x=>x.ingredients.length&&x.steps.length&&validServings(x.servings))'),true);
  assert.equal(a.writes.length,0);
  assert.deepEqual(a.json('state.plan'),chefState().plan);
});
test('cookbook and category search includes sauces and drinks without filling meal slots with them',()=>{
  const a=app('chef',chefState());
  a.run('ui.source="fitfoodie"');assert.equal(a.run('discoverList().length'),94);
  a.run('ui.search="low cal sauces"');assert.equal(a.run('discoverList().length'),3);
  a.run('ui.search="";ui.meal="drink"');assert.equal(a.run('discoverList().length'),9);
  assert.equal(a.run('cardHtml(BY_ID["ff-075"],false).includes("data-add")'),false);
  assert.equal(a.run('planRecipe("mon","dinner","ff-075",2)'),false);
  assert.equal(a.run('Object.values(fillWeek({})).every(day=>Object.values(day).every(id=>MEALS.includes(BY_ID[id].meal)))'),true);
});
test('known cookbook amounts scale and per-pocket quantities use the full batch',()=>{
  const a=app('chef',{...chefState(),plan:{},checked:{}});
  assert.equal(a.run('planRecipe("mon","dinner","ff-019",4)'),true);
  const items=a.json('groceryList().flatMap(g=>g.items)');
  assert.equal(items.find(i=>i.n==='96/4 ground beef').q,'200 g');
  assert.equal(items.find(i=>i.n==='low carb tortilla').q,'2');
  assert.equal(items.find(i=>i.n==='american cheese').q,'2 slices');
  assert.equal(items.find(i=>i.n==='pickle (minced is best)').q,'4');
  assert.equal(a.run('BY_ID["ff-019"].ingredients[0].q'),'400 g');
  assert.equal(a.run('BY_ID["ff-002"].ingredients[4].q'),'1/4 cup');
});
test('quantity ranges stay ranges and unspecified amounts remain unspecified',()=>{
  const a=app('chef',chefState());
  assert.equal(a.run('parseQty("250-300 g")'),null);
  assert.equal(a.run('scaledQty("250-300 g",2)'),'500–600 g');
  assert.equal(a.run('scaledQty("1/2-3/4 cup",2)'),'1–1 1/2 cup');
  assert.equal(a.run('scaledQty("as needed",4)'),'as needed');
  assert.equal(a.run('parseQty("1 tsp per cup of mixture")'),null);
});
test('source timing conflicts and variable nutrition never become zero-minute or zero-calorie claims',()=>{
  const a=app('chef',chefState());a.run('ui.time=20');
  assert.equal(a.run('discoverList().some(x=>x.id==="ff-052"||x.id==="ff-069"||x.id==="ff-062")'),false);
  assert.ok(a.run('sourceDetails(BY_ID["ff-052"])').includes('Timing conflict'));
  assert.ok(a.run('sourceDetails(BY_ID["ff-049"])').includes('2–6 calories'));
  assert.equal(a.run('cardHtml(BY_ID["ff-047"],false).includes("nullg protein")'),false);
  assert.equal(a.run('validServings(200)'),true);
  assert.equal(a.run('validServings(501)'),false);
});
test('grocery lists exclude equipment and prepared filling references',()=>{
  const a=app('chef',{...chefState(),plan:{mon:{dessert:'ff-047',dinner:'ff-031'}},checked:{}});
  assert.equal(a.run('groceryList().flatMap(g=>g.items).some(i=>/pipette|mold|buffalo chicken|low cal. ranch sauce/.test(i.n))'),false);
  assert.ok(a.run('sourceDetails(BY_ID["ff-047"])').includes('silicone molds'));
  assert.equal(a.run('BY_ID["ff-109"].ingredients.length'),18);
});
test('deleting an imported recipe stays local and keeps original recipe records',()=>{
  const a=app('chef',chefState());assert.equal(a.run('deleteRecipe("ff-002")'),true);
  a.run('ui.source="fitfoodie"');assert.equal(a.run('discoverList().length'),93);
  assert.deepEqual(a.json('state.favourites'),{b01:true});assert.deepEqual(a.json('state.plan'),chefState().plan);
  const reopened=app('chef',JSON.parse(a.records.get('chef:state')));
  assert.equal(reopened.run('recipeDeleted("ff-002")'),true);assert.equal(reopened.writes.length,0);
});

test('permanent deletion removes only the chosen recipe and its planned servings, including after reopening',()=>{
  const a=app('chef',{...chefState(),plan:{mon:{breakfast:'b01',lunch:'l01'},tue:{breakfast:'b01'}},portions:{mon:{breakfast:6,lunch:2},tue:{breakfast:3}},ratings:{b01:4,b02:5}});
  assert.equal(a.run('deleteRecipe("b01")'),true);
  assert.deepEqual(a.json('state.deletedRecipes'),['b01']);
  assert.deepEqual(a.json('state.plan'),{mon:{lunch:'l01'}});
  assert.deepEqual(a.json('state.portions'),{mon:{lunch:2}});
  assert.deepEqual(a.json('state.ratings'),{b02:5});
  assert.deepEqual(a.json('state.favourites'),{});
  assert.deepEqual(a.json('state.checked'),{eggs:true});
  assert.equal(a.run('discoverList().some(x=>x.id==="b01")'),false);
  assert.equal(a.run('planRecipe("mon","breakfast","b01",4)'),false);
  assert.equal(a.records.get('unrelated'),'preserve');
  const reopened=app('chef',JSON.parse(a.records.get('chef:state')));
  assert.equal(reopened.run('availableRecipes().some(x=>x.id==="b01")'),false);
  for(let n=0;n<10;n++)assert.equal(reopened.run('JSON.stringify(fillWeek({})).includes("b01")'),false);
  assert.equal(reopened.writes.length,0);
});
test('cancelled or failed permanent deletion preserves all saved records',()=>{
  for(const options of [{accept:false},{failSave:true}]){
    const a=app('chef',chefState(),options),before=a.json('state'),raw=a.records.get('chef:state');
    assert.equal(a.run('deleteRecipe("b01")'),false);
    assert.deepEqual(a.json('state'),before);assert.equal(a.records.get('chef:state'),raw);
    assert.equal(a.run('recipeDeleted("b01")'),false);
  }
});
test('deletion survives reset, older imported state, planning undo, and a stale tab save',()=>{
  const a=app('chef',chefState());
  a.run('planRecipe("tue","breakfast","b02",4)');
  a.run('deleteRecipe("b01")');assert.equal(a.run('canUndo()'),false);
  a.run('resetTool()');assert.equal(a.run('recipeDeleted("b01")'),true);
  a.run('setState({...defaultState(),plan:{mon:{breakfast:"b01"}},favourites:{b01:true}})');
  assert.equal(a.run('recipeDeleted("b01")'),true);assert.deepEqual(a.json('state.plan'),{});assert.deepEqual(a.json('state.favourites'),{});
  const stale=app('chef',chefState());
  stale.records.set('chef:state',JSON.stringify({...chefState(),deletedRecipes:['b01']}));
  stale.run('setState({ratings:{b02:5}})');assert.equal(stale.run('recipeDeleted("b01")'),true);assert.deepEqual(stale.json('state.plan'),{});
});

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
  assert.equal(a.run('RECIPES.filter(x=>!x.source).length'),200);
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

test('household feedback changes discovery priority and survives ordinary state updates',()=>{
 const a=app('chef',chefState());const id=a.run('RECIPES[0].id');a.run(`setState({recipeFeedback:{[RECIPES[0].id]:{verdict:'again',reason:'Family favourite',note:'Use less salt'}}})`);assert.equal(a.run('trustedRank(RECIPES[0])'),2);a.run('setState({checked:{eggs:true}})');assert.equal(a.json('state.recipeFeedback')[id].note,'Use less salt');a.run(`setState({recipeFeedback:{[RECIPES[0].id]:{verdict:'not-again'}}})`);assert.equal(a.run('trustedRank(RECIPES[0])'),-1);
});


test('Recipe Book imports source content faithfully and consolidates repeated posts',()=>{
  const a=app('chef',chefState());
  const imported=a.json('RECIPES.filter(x=>x.id.startsWith("rb-"))');
  assert.equal(imported.length,155);
  const content=imported.map(x=>[x.id,x.name,x.ingredients.map(i=>i.raw),x.steps]);
  assert.equal(createHash('sha256').update(JSON.stringify(content)).digest('hex'),'ab16c20713d25914462feea6f9e10477988f23832234f2c5b1afefc91b9a1b67');
  assert.equal(imported.filter(x=>x.name==='Cinnamon Rolls').length,1);
  assert.equal(imported.find(x=>x.name==='Cinnamon Rolls').source.references.length,2);
  const crunch=imported.filter(x=>x.name==='Sheet Pan Crunchwrap Supreme');
  assert.equal(crunch.length,1);assert.equal(crunch[0].source.references.length,2);
  assert.ok(crunch[0].ingredients.some(i=>i.raw==='⅓ cup sour cream or Greek yogurt'));
  assert.equal(imported.some(x=>x.name==='Korean Fried Chicken Sandwich (healthy)'),false);
  assert.ok(a.run('sourceDetails(BY_ID["ff-100"])').includes('DPwn1NRkQUO'));
  assert.ok(a.run('sourceDetails(BY_ID["ff-100"])').includes('380°F'));
  assert.equal(imported.filter(x=>x.name==='Fuet Tartare').length,2);
  assert.equal(a.writes.length,0);assert.deepEqual(a.json('state.plan'),chefState().plan);
});
test('Recipe Book filters, creator and method search work independently of Fit Foodie',()=>{
  const a=app('chef',chefState());
  a.run('ui.source="recipebook"');assert.equal(a.run('discoverList().length'),156);
  a.run('ui.search="@studiobyferi"');assert.equal(a.run('discoverList().length'),1);
  a.run('ui.search="slippery dough"');assert.equal(a.run('discoverList().length'),1);
  a.run('ui.search="";ui.meal="drink"');assert.equal(a.run('discoverList().length'),8);
  a.run('ui.meal="all";ui.time=20');assert.equal(a.run('discoverList().filter(x=>x.id.startsWith("rb-")).length'),0);
  a.run('ui.source="fitfoodie";ui.time=0');assert.equal(a.run('discoverList().length'),94);
});
test('Recipe Book batches scale measured ingredients without inventing servings or per-item quantities',()=>{
  const a=app('chef',{...chefState(),plan:{},checked:{}});
  const pasta=a.json('RECIPES.find(x=>x.name==="High Protein Creamy Tomato Pasta")');
  assert.equal(pasta.servings,1);assert.equal(pasta.portionUnit,'batch');
  assert.equal(a.run('portionLabel(BY_ID['+JSON.stringify(pasta.id)+'])'),'Batches');
  assert.equal(a.run('planRecipe("mon","dinner",'+JSON.stringify(pasta.id)+',2)'),true);
  assert.equal(a.json('groceryList().flatMap(g=>g.items)').find(i=>i.n==='pasta of choice').q,'32 ounces');
  assert.equal(a.run('scaledQty("",2)'),'');
  const pumpkin=a.json('RECIPES.find(x=>x.name==="Pumpkin Spice Protein Loaf").ingredients[0]');
  assert.equal(a.run('ingredientText('+JSON.stringify(pumpkin)+',1)'),pumpkin.raw);
  assert.equal(a.run('ingredientText('+JSON.stringify(pumpkin)+',2)'),'360 g canned pumpkin puree');
  const pancakes=a.json('RECIPES.find(x=>x.name==="Nutella Stuffed Mini Pancakes")');
  const nutella=pancakes.ingredients.find(i=>i.raw.includes('per pancake'));
  assert.equal(nutella.fixedBatch,true);
  assert.equal(a.run('ingredientFactor('+JSON.stringify(nutella)+',2)'),1);
  const html=a.run('cardHtml(BY_ID['+JSON.stringify(pasta.id)+'],false)');
  assert.ok(html.includes('Batches'));assert.ok(!html.includes('nullg protein'));
  assert.ok(html.includes('rel="noopener noreferrer"'));
  const drink=a.json('RECIPES.find(x=>x.name.startsWith("Jalapeño Lime Infused"))');
  assert.ok(!drink.ingredients.some(i=>i.n.includes('quart-sized jar')));
  assert.ok(drink.equipment.includes('A quart-sized jar'));
});


test('Chef opens alphabetically without ratings or feedback reshuffling the collection',()=>{
 const a=app('chef',{...chefState(),ratings:{b01:5},recipeFeedback:{b01:{verdict:'again'}}});
 assert.equal(a.run('ui.sort'),'name');
 assert.equal(a.run('discoverList().every((x,i,all)=>i===0||recipeNameOrder(all[i-1],x)<=0)'),true);
 assert.equal(a.writes.length,0);assert.deepEqual(a.json('state.plan'),chefState().plan);
});
test('Category browsing shows each matching recipe once under alphabetized meal groups',()=>{
 const a=app('chef',chefState());a.run('ui.sort="category";ui.source="recipebook"');
 assert.equal(a.run('discoverList().every((x,i,all)=>i===0||RECIPE_TYPES.indexOf(all[i-1].meal)<RECIPE_TYPES.indexOf(x.meal)||all[i-1].meal===x.meal&&recipeNameOrder(all[i-1],x)<=0)'),true);
 const list=a.json('discoverList()'),html=a.run('recipeCardsHtml(discoverList(),true,true)');
 assert.equal((html.match(/class="recipe-category"/g)||[]).length,new Set(list.map(x=>x.meal)).size);
 assert.equal((html.match(/class="card" data-id=/g)||[]).length,list.length);
 for(const recipe of list)assert.equal(html.split('data-id="'+recipe.id+'"').length-1,1);
 a.run('ui.meal="drink"');const drinks=a.run('recipeCardsHtml(discoverList(),true,true)');
 assert.equal((drinks.match(/class="recipe-category"/g)||[]).length,1);assert.ok(drinks.includes('Drink <span>8 recipes'));
});
