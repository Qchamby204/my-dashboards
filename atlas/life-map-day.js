/* Priority-led Home and category navigation over the existing Life Map records. */
(()=>{
  'use strict';
  const M=createLifeMapWorkflow(),D=window.LifeMapDashboard,W=window.LifeMapWorkflow;
  const UI_KEY='lifemap:day-drafts:v1',clone=M.clone;
  let ui={tab:'home',category:'household',date:todayISO(),food:null,block:null,main:null,reset:false,available:25,error:''};
  try{const raw=localStorage.getItem(UI_KEY);if(raw&&raw.length<100000){const saved=JSON.parse(raw);if(saved&&typeof saved==='object'&&!Array.isArray(saved)){for(const k of ['food','block','main'])if(saved[k]!==undefined)ui[k]=saved[k];}}}catch{}
  const attrs=s=>esc(String(s??'')),button=(label,action,extra='',primary=false)=>'<button type="button" class="btn lm-day-button'+(primary?' lm-day-primary':'')+'" data-day="'+action+'" '+extra+'>'+label+'</button>';
  const help=t=>'<p class="lm-help">'+esc(t)+'</p>';
  const info=(label,text)=>'<details class="atlas-info"><summary aria-label="'+esc(label)+'">i</summary><div class="atlas-info-body">'+esc(text)+'</div></details>';
  const input=(key,value,type='text',extra='')=>'<input id="lm-day-field-'+key.replace(/\./g,'-')+'" data-day-field="'+key+'" type="'+type+'" value="'+attrs(value)+'" '+extra+'>';
  const field=(title,body)=>'<label class="lm-day-field"><span>'+esc(title)+'</span>'+body+'</label>';
  const select=(key,value,options)=>'<select id="lm-day-field-'+key.replace(/\./g,'-')+'" data-day-field="'+key+'">'+options.map(([v,t])=>'<option value="'+attrs(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
  const heading=(eyebrow,title,action='')=>'<div class="lm-day-heading"><div><div class="eyebrow">'+esc(eyebrow)+'</div><h1>'+esc(title)+'</h1></div>'+action+'</div>';
  const panel=(label,body)=>'<section class="panel lm-day-panel" aria-label="'+attrs(label)+'">'+body+'</section>';
  const plan=(date=ui.date)=>S.dayPlans?.[date]||{reviewed:false,mainTaskId:'',blocks:[]};
  const openTasks=()=>S.projects.filter(M.open);
  const clock=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  const recordUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify({food:ui.food,block:ui.block,main:ui.main,date:ui.date}));}catch{ui.error='Your draft could not be saved. Keep this page open until you save it.';}};
  function choose(tab,category){ui.tab=tab;if(category)ui.category=category;ui.error='';render();window.scrollTo?.({top:0,behavior:'instant'});document.getElementById('lm-day-nav-'+tab)?.focus({preventScroll:true});}
  function editPlan(next,date,fn){next.dayPlans??={};next.dayPlans[date]??={reviewed:false,mainTaskId:'',blocks:[]};next.dayPlans[date].blocks??=[];fn(next.dayPlans[date]);}
  function commit(change,message,success){return W.transaction(change,message,'day_planned',()=>{ui.error='';success?.();recordUI();});}
  function coverageText(food){
    if(!food.set)return 'Set your dinner coverage';
    if(food.expired)return 'Dinner coverage has ended';
    if(food.startsLater)return food.remaining+' dinners from '+fmtDay(S.mealCoverage.start);
    return food.remaining+' dinner'+(food.remaining===1?'':'s')+' covered · through '+fmtDay(food.last);
  }
  const dueRoutines=()=>S.chores.filter(c=>!c.archived&&!isChecked(c)&&(c.repeat?M.choreDue(c,todayISO())<=todayISO():c.cad==='Daily'||plannedToday(c)));
  const recommend=(options={})=>M.dayRecommendation(S,todayISO(),clock(),{routines:dueRoutines(),...options});
  const guides={
    food:['Meals & groceries','Prepared dinners, the next grocery shop and your next prep session.','the-chef.html','Open Chef'],
    household:['Home & maintenance','Kitchen reset, laundry and cleaning; renovations, vehicles and seasonal maintenance.','',''],
    family:['Family & relationships','Make room for time with your wife and the people you want to show up for. Keep family commitments visible.','baby-brain.html','Open Baby Brain'],
    health:['Health & morning routine','Getting ready, meditation, walking the dog and the gym. Protect these blocks before the day fills up.','workout-forge.html','Open Forge'],
    work:['Work & personal growth','Business development, client work, filming/content and an admin wrap-up. Leave room for piano and reading too.','',''],
    admin:['Money & life admin','Budget reviews, mail, documents, renewals and appointments. Separate real deadlines from work that can wait.','chambers-wealth-hq.html','Open Wealth HQ']
  };
  const starters=[['Morning','Get ready','health',30],['Morning','Meditation','health',10],['Morning','Walk the dog','health',20],['Morning','Gym','health',60],['Work','Business development','work',60],['Work','Client requests','work',45],['Work','Content / filming','work',45],['Work','Admin & day wrap-up','work',20],['Home & evening','Kitchen & home reset','household',15],['Home & evening','Renovation / maintenance','household',45],['Home & evening','Prepare dinners','food',45],['Home & evening','Time together','family',30],['Home & evening','Piano','work',20],['Home & evening','Read before bed','rest',20],['Home & evening','Deliberate downtime','rest',60]];
  function foundationCards(){
    const p=plan(todayISO()),food=M.mealStatus(S.mealCoverage,todayISO()),main=S.projects.find(t=>t.id===p.mainTaskId&&M.open(t));
    const cards=[
      ['food','Food',coverageText(food),food.needsPrep?'Prep next batch':food.set?'Coverage set':'Needs a check','areas','food'],
      ['plan','Today’s to-dos',openTasks().filter(t=>t.plan===todayISO()).length+' chosen for today',p.reviewed?'Reviewed':'Review your day','plan',''],
      ['time','Time blocks',(p.blocks||[]).length?(p.blocks.filter(b=>b.done).length+' of '+p.blocks.length+' blocks done'):'No blocks set for today',(p.blocks||[]).some(b=>!b.done)?'Follow your plan':'Set or review','plan',''],
      ['home','Household',S.chores.filter(c=>!c.archived&&M.categoryFor(c)==='household'&&!isChecked(c)&&(c.cad==='Daily'||plannedToday(c)||c.repeat&&M.choreDue(c,todayISO())<=todayISO())).length+' essential routines open','Check the basics','areas','household']
    ];
    return '<div class="lm-foundation-grid">'+cards.map(([key,title,text,state,tab,category])=>'<button type="button" class="btn lm-foundation" data-day="tab" data-tab="'+tab+'" data-category="'+category+'"'+(key==='food'&&food.needsPrep?' data-attention="true"':'')+'><span class="eyebrow">'+title+'</span><strong>'+esc(text)+'</strong><small>'+esc(state)+' ›</small></button>').join('')+'</div>';
  }
  function candidateCard(c){
    let actions='';
    if(c.kind==='task')actions=button('Start','focus','data-kind="task" data-id="'+attrs(c.id)+'"',true)+button('Done','complete-task','data-id="'+attrs(c.id)+'"');
    else if(c.kind==='block')actions=button('Continue / start','focus','data-kind="block" data-id="'+attrs(c.id)+'"',true)+button('Done','block-done','data-date="'+todayISO()+'" data-id="'+attrs(c.id)+'"');
    else if(c.kind==='chore')actions=button('Done','complete-routine','data-id="'+attrs(c.id)+'"',true)+button('View routines','tab','data-tab="areas" data-category="'+attrs(c.category)+'"');
    else if(c.kind==='food')actions=button('Open Food','tab','data-tab="areas" data-category="food"',true);
    else if(c.kind==='plan')actions=button('Plan today','tab','data-tab="plan"',true);
    else actions=button('Choose a task','tab','data-tab="board"')+'<a class="btn lm-day-button" href="life-ledger.html">Leisure in Life Ledger ↗</a>';
    return '<div class="lm-now-card"><div class="eyebrow">Right now'+(c.minutes?' · '+c.minutes+' min':'')+'</div><h2>'+esc(c.title)+'</h2>'+help(c.why)+'<div class="lm-inline">'+actions+button('Change plan','change-focus')+'</div></div>';
  }
  function categoryCards(){
    return '<div class="lm-category-grid">'+M.categories.map(([key,title])=>{
      const rows=openTasks().filter(p=>M.categoryFor(p)===key),due=rows.filter(p=>p.due&&p.due<=M.plus(todayISO(),7)).length,routines=dueRoutines().filter(c=>M.categoryFor(c)===key).length;
      return '<button type="button" class="btn lm-category-card" data-day="tab" data-tab="areas" data-category="'+key+'"><strong>'+title+'</strong><span>'+rows.length+' open task'+(rows.length===1?'':'s')+(due?' · '+due+' deadlines soon':'')+(routines?' · '+routines+' routines due':'')+'</span><small>Open ›</small></button>';
    }).join('')+'</div>';
  }
  function homeView(){
    const c=recommend(),p=plan(todayISO()),upcoming=(p.blocks||[]).filter(b=>!b.done&&M.blockMinutes(b.start)>M.blockMinutes(clock())).sort((a,b)=>a.start.localeCompare(b.start))[0];
    let html=heading(niceToday(),'A clear next move.',button('I’m off track','reset'));
    html+=panel('Right now',candidateCard(c)+(upcoming?'<div class="lm-next-block"><span class="eyebrow">Next block · '+upcoming.start+'</span><strong>'+esc(upcoming.title)+'</strong></div>':''));
    if(ui.reset)html+=panel('Restart the next block','<h2>Restart from here</h2>'+help('Choose the time you actually have. Your unfinished tasks stay available.')+field('Minutes available',select('available',ui.available,[[10,'10 minutes'],[25,'25 minutes'],[45,'45 minutes'],[60,'60 minutes']]))+candidateCard(recommend({available:Number(ui.available)}))+button('Close reset','reset-close'));
    html+=panel('Foundations','<div class="lm-day-section-title"><h2>Keep life running</h2>'+info('How foundations work','Real deadlines come first, followed by your current block, a due prep reminder, due routines and chosen to-dos. Started work stays in focus until you finish or change it. Nothing is completed by the clock.')+'</div>'+foundationCards());
    const routines=dueRoutines();if(routines.length)html+=panel('Due routines','<div class="lm-day-section-title"><h2>The basics due today</h2>'+button('All routines','tab','data-tab="board"')+'</div>'+routines.slice(0,5).map(c=>D.choreRow(c)).join(''));
    html+=panel('Your life areas','<h2>Your life areas</h2>'+categoryCards());
    const due=M.sortTasks(openTasks().filter(p=>p.due&&p.due<=M.plus(todayISO(),7)),todayISO()).slice(0,3);
    if(due.length)html+=panel('Upcoming deadlines','<div class="lm-day-section-title"><h2>Deadlines to keep in view</h2>'+button('View Board','tab','data-tab="board"')+'</div>'+due.map(p=>D.taskRow(p)).join(''));
    return html;
  }
  function foodView(){
    const food=M.mealStatus(S.mealCoverage,todayISO()),f=ui.food||S.mealCoverage||{start:todayISO(),dinners:5,note:'',reminderTime:'09:00',skipDates:[]};
    const preview=M.mealStatus({...f,dinners:Number(f.dinners),skipDates:String(f.skipText??(f.skipDates||[]).join(', ')).split(',').map(x=>x.trim()).filter(Boolean)},todayISO());
    let body='<div class="lm-day-section-title"><h2>Dinner coverage</h2>'+info('What dinner coverage means','One dinner is one evening covered for your household. The dates estimate usage; this is not a food-storage or freshness check. Skip a date when eating out. The prep reminder appears the day before your last covered dinner and remains until you extend or replace the coverage.')+'</div><div class="lm-meal-status'+(food.needsPrep?' lm-meal-attention':'')+'"><strong>'+esc(coverageText(food))+'</strong>';
    if(food.set)body+=help(food.needsPrep?'Prep reminder · plan the next batch now.':'Prep reminder on '+fmtDay(food.remind))+ '<progress max="'+S.mealCoverage.dinners+'" value="'+food.remaining+'" aria-label="Dinners remaining" aria-valuetext="'+food.remaining+' dinners remaining"></progress>';
    body+='</div><details class="lm-meal-editor"'+(!food.set||ui.food?' open':'')+'><summary>'+(food.set?'Update dinner coverage':'Record prepared dinners')+'</summary><div class="lm-two-col">'+field('First dinner covered',input('food.start',f.start,'date'))+field('Dinners prepared',input('food.dinners',f.dinners,'number','min="1" max="60" step="1"'))+'</div>'+field('Description (optional)',input('food.note',f.note,'text','maxlength="1000" placeholder="Dinner portions for this week"'))+field('Skip evenings (comma-separated dates)',input('food.skipText',f.skipText??(f.skipDates||[]).join(', '),'text','placeholder="2026-10-09, 2026-10-10"'))+field('Calendar reminder time',input('food.reminderTime',f.reminderTime||'09:00','time'))+'<p id="lm-meal-preview" class="lm-help">'+esc(preview.set?'Covered through '+fmtDay(preview.last)+' · remind '+fmtDay(preview.remind):'Choose a valid first date and dinner count.')+'</p><div class="lm-inline">'+button('Save coverage','save-food','',true)+(ui.food?button('Discard draft','discard-food'):'')+'</div></details>';
    if(food.set)body+='<div class="lm-inline lm-meal-actions">'+button('Add dinners','add-food')+button('Export calendar alert','meal-reminder')+'</div><div class="lm-inline">'+field('Additional dinners',input('extraDinners',ui.extraDinners||3,'number','min="1" max="60" step="1"'))+button('Skip tonight / eating out','skip-dinner')+'</div>'+help('The reminder appears here and on Home. Import the calendar alert for a notification while Life Map is closed.');
    return panel('Dinner coverage',body);
  }
  function areasView(){
    const key=ui.category,title=M.categories.find(([k])=>k===key)?.[1]||'Life areas';
    const tasks=M.sortTasks(openTasks().filter(p=>M.categoryFor(p)===key),todayISO()),chores=S.chores.filter(c=>!c.archived&&M.categoryFor(c)===key);
    let html=heading('Life areas',title,button('+ Task','area-task','data-category="'+key+'"',true));
    html+='<div class="lm-category-tabs" role="tablist" aria-label="Life categories">'+M.categories.map(([k,t])=>'<button class="btn lm-day-button" id="lm-category-'+k+'" type="button" role="tab" aria-controls="lm-category-content" aria-selected="'+(key===k)+'" tabindex="'+(key===k?0:-1)+'" data-day="category" data-category="'+k+'">'+t+'</button>').join('')+'</div>';
    html+='<section id="lm-category-content" role="tabpanel" aria-labelledby="lm-category-'+key+'">'+panel(title+' overview','<h2>'+guides[key][0]+'</h2>'+help(guides[key][1])+(guides[key][2]?'<a class="btn lm-day-button" href="'+guides[key][2]+'">'+guides[key][3]+' ↗</a>':''))+(key==='food'?foodView():'')+panel(title+' tasks','<h2>Tasks & projects</h2>'+(tasks.length?tasks.map(p=>D.taskRow(p)).join(''):help('No open tasks in this category.')))+panel(title+' routines','<div class="lm-day-section-title"><h2>Recurring responsibilities</h2>'+button('+ Routine','area-routine','data-category="'+key+'"')+'</div>'+(chores.length?chores.map(c=>D.choreRow(c)).join(''):help('No routines recorded here yet. Add what actually needs repeating in your life.')))+'</section>';
    return html;
  }
  function planView(){
    const p=plan(),main=ui.main??p.mainTaskId??'',b=ui.block||{title:'',start:'09:00',minutes:30,category:'work',taskId:''},tasks=openTasks().filter(t=>t.status!=='Waiting');
    let html=heading('Make room for what matters','Your day',button('Today','plan-today'));
    const today=ui.date===todayISO(),chosen=M.sortTasks(tasks.filter(t=>t.plan===ui.date||t.due&&t.due<=ui.date),ui.date),suggested=M.sortTasks(tasks.filter(t=>M.actionable(t,ui.date)&&!chosen.some(c=>c.id===t.id)),ui.date).slice(0,5);
    html+=panel('Today’s to-dos','<h2>'+ (today?'Today’s to-dos':'To-dos for '+fmtDay(ui.date))+'</h2>'+help('Start with deadlines and essentials. Choose a small amount of work, then give it space in the time blocks below.')+(chosen.length?chosen.map(t=>D.taskRow(t)).join(''):help('No to-dos chosen for this day yet.'))+(suggested.length?'<details class="lm-block-editor"><summary>Choose from your open to-dos</summary>'+suggested.map(t=>'<div class="lm-time-block"><strong>'+esc(t.task)+'</strong><div class="lm-inline">'+button(today?'Add to Today':'Add to this day','choose-todo','data-id="'+attrs(t.id)+'"')+button('Give it a time','task-block','data-id="'+attrs(t.id)+'"')+'</div></div>').join('')+'</details>':'')+'<div class="lm-inline">'+button('+ To-do','new-todo')+button(p.reviewed?'Reviewed · review again':'I’ve reviewed this day','save-plan')+'</div><details class="lm-block-editor"><summary>Plan a different day</summary>'+field('Day to view',input('date',ui.date,'date'))+'</details>');
    const blocks=(p.blocks||[]).slice().sort((a,b)=>a.start.localeCompare(b.start));
    html+=panel('Time blocks','<div class="lm-day-section-title"><h2>Time blocks</h2>'+info('Following blocks','Starting a block keeps it on Home until you finish or change focus. Passing the scheduled end does not mark it complete. Completing a block does not automatically complete its linked task.')+'</div>'+
      (blocks.length?blocks.map(block=>'<article class="lm-time-block'+(block.done?' lm-block-done':'')+'"><div><span class="eyebrow">'+block.start+' · '+block.minutes+' min</span><strong>'+esc(block.title)+'</strong></div><div class="lm-inline">'+(ui.date===todayISO()&&!block.done?button('Start','focus','data-kind="block" data-id="'+attrs(block.id)+'"'):'')+button(block.done?'Reopen':'Done','block-done','data-date="'+ui.date+'" data-id="'+attrs(block.id)+'"')+button('Edit','edit-block','data-id="'+attrs(block.id)+'"')+button('Remove','remove-block','data-id="'+attrs(block.id)+'"')+'</div></article>').join(''):help('Add a few blocks for your ideal day. Keep space between them for real life.'))+
      '<details class="lm-block-editor"'+(ui.block?' open':'')+'><summary>'+(b.id?'Edit time block':'Add a time block')+'</summary>'+field('Block title',input('block.title',b.title,'text','maxlength="300" placeholder="Meal prep, focused work, family time…"'))+'<div class="lm-two-col">'+field('Start time',input('block.start',b.start,'time'))+field('Minutes',input('block.minutes',b.minutes,'number','min="5" max="720" step="5"'))+'</div>'+field('Category',select('block.category',b.category,[...M.categories,['rest','Rest & leisure']]))+field('Link an existing task (optional)',select('block.taskId',b.taskId||'',[['','No linked task'],...tasks.map(t=>[t.id,t.task])]))+'<div class="lm-inline">'+button(b.id?'Save block':'Add block','save-block','',true)+(ui.block?button('Discard block draft','discard-block'):'')+'</div></details>');
    html+=panel('Build around your life','<h2>Build around your day</h2>'+help('Use a starting point, choose its time, then save it. These suggestions do not add tasks or claim anything is done.')+['Morning','Work','Home & evening'].map(group=>'<details class="lm-block-editor"><summary>'+group+'</summary><div class="lm-inline">'+starters.map((row,i)=>row[0]===group?button(row[1],'starter-block','data-index="'+i+'"'):'').join('')+'</div></details>').join(''));
    html+=panel('Ideal day templates','<h2>Repeat your ideal day</h2>'+help('Save these blocks as a weekday or weekend template, then reuse them on a day you choose. Existing blocks are retained; overlaps are checked.')+
      '<div class="lm-inline">'+button('Save weekday template','save-template','data-template="weekday"'+(!blocks.length?' disabled':''))+button('Save weekend template','save-template','data-template="weekend"'+(!blocks.length?' disabled':''))+'</div><div class="lm-inline">'+button('Use weekday template','use-template-day','data-template="weekday"'+(!S.dayTemplates?.weekday?.length?' disabled':''))+button('Use weekend template','use-template-day','data-template="weekend"'+(!S.dayTemplates?.weekend?.length?' disabled':''))+'</div>');
    return html;
  }
  function handle(action,el){
    const id=el.dataset.id;
    if(action==='tab')return choose(el.dataset.tab,el.dataset.category);
    if(action==='category'){ui.category=el.dataset.category;render();document.getElementById('lm-category-'+ui.category)?.focus({preventScroll:true});return;}
    if(action==='plan-today'){ui.date=todayISO();ui.main=null;ui.block=null;recordUI();render();return;}
    if(action==='reset'){ui.reset=true;return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Ready to restart');}
    if(action==='reset-close'){ui.reset=false;render();return;}
    if(action==='change-focus')return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Focus cleared',()=>{ui.tab='plan';ui.date=todayISO();});
    if(action==='complete-task')return D.setStatus(id,'Done');
    if(action==='focus')return commit(next=>editPlan(next,todayISO(),p=>{if(el.dataset.kind==='task'){const task=next.projects.find(t=>t.id===id&&M.open(t)&&t.status!=='Waiting');if(!task)throw Error('Choose an available task.');task.inbox=false;task.plan=todayISO();}p.focus={kind:el.dataset.kind,id};}),'Focus started',()=>{ui.tab='home';ui.reset=false;});
    if(action==='block-done')return commit(next=>editPlan(next,el.dataset.date||ui.date,p=>{const b=p.blocks.find(b=>b.id===id);if(!b)throw Error('Block not found.');b.done=!b.done;if(b.done&&p.focus?.id===id)delete p.focus;}),'Block updated');
    if(action==='edit-block'){ui.block=clone(plan().blocks.find(b=>b.id===id));recordUI();render();return;}
    if(action==='remove-block')return commit(next=>editPlan(next,ui.date,p=>{p.blocks=p.blocks.filter(b=>b.id!==id);if(p.focus?.id===id)delete p.focus;}),'Block removed');
    if(action==='discard-block'){ui.block=null;recordUI();render();return;}
    if(action==='complete-routine')return D.choreAction(id,'done');
    if(action==='new-todo')return W.openEditor('proj',{task:'',status:'Not started',pri:'Med',inbox:false,plan:ui.date});
    if(action==='area-routine')return W.openEditor('chore',{chore:'',cad:'Daily',area:{food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents'}[el.dataset.category]});
    if(action==='choose-todo')return commit(next=>{const t=next.projects.find(t=>t.id===id);M.setPlan(t,ui.date,todayISO());},'To-do added to your day');
    if(action==='task-block'){const t=S.projects.find(t=>t.id===id);ui.block={title:t.task,start:'09:00',minutes:t.effortMinutes||30,category:M.categoryFor(t),taskId:id};recordUI();render();document.querySelector('.lm-block-editor[open]')?.scrollIntoView({block:'center'});return;}
    if(action==='starter-block'){const row=starters[Number(el.dataset.index)];if(!row)return;ui.block={title:row[1],start:'09:00',minutes:row[3],category:row[2],taskId:''};recordUI();render();document.querySelector('.lm-block-editor[open]')?.scrollIntoView({block:'center'});return;}
    if(action==='save-plan')return commit(next=>editPlan(next,ui.date,p=>{p.reviewed=true;}),'Day reviewed',()=>{ui.main=null;});
    if(action==='save-block'){const b=ui.block||{};if(!b.title?.trim()){ui.error='Give the block a title.';render();return;}return commit(next=>editPlan(next,ui.date,p=>{const row={id:b.id||uid(),title:b.title.trim(),start:b.start||'09:00',minutes:Number(b.minutes||30),category:b.category||'work',taskId:b.taskId||'',done:!!b.done};const i=p.blocks.findIndex(x=>x.id===row.id);if(i<0)p.blocks.push(row);else p.blocks[i]=row;}),'Time block saved',()=>{ui.block=null;});}
    if(action==='save-template')return commit(next=>{next.dayTemplates??={};next.dayTemplates[el.dataset.template]=plan().blocks.map(b=>({...clone(b),done:false}));},'Ideal day template saved');
    if(action==='use-template-day')return commit(next=>editPlan(next,ui.date,p=>{for(const b of next.dayTemplates?.[el.dataset.template]||[])p.blocks.push({...clone(b),id:uid(),done:false});}),'Ideal day blocks added');
    if(action==='save-food'){const f=ui.food||S.mealCoverage||{start:todayISO(),dinners:5,note:'',reminderTime:'09:00'};return commit(next=>{next.mealCoverage={start:f.start,dinners:Number(f.dinners),note:f.note||'',reminderTime:f.reminderTime||'09:00',skipDates:String(f.skipText??(f.skipDates||[]).join(', ')).split(',').map(x=>x.trim()).filter(Boolean)};},'Dinner coverage saved',()=>{ui.food=null;});}
    if(action==='discard-food'){ui.food=null;recordUI();render();return;}
    if(action==='add-food')return commit(next=>{if(!next.mealCoverage)throw Error('Record dinner coverage first.');if(M.mealStatus(next.mealCoverage,todayISO()).expired){next.mealCoverage.start=todayISO();next.mealCoverage.dinners=Number(ui.extraDinners||3);next.mealCoverage.skipDates=[];}else next.mealCoverage.dinners+=Number(ui.extraDinners||3);},'Dinner coverage extended');
    if(action==='skip-dinner')return commit(next=>{const f=M.mealStatus(next.mealCoverage,todayISO());if(!f.dates?.includes(todayISO()))throw Error('Tonight is not one of the covered dinners.');next.mealCoverage.skipDates??=[];next.mealCoverage.skipDates.push(todayISO());},'Dinner kept for another evening');
    if(action==='meal-reminder'){
      const f=M.mealStatus(S.mealCoverage,todayISO());if(!f.set)return;
      const date=f.remind<todayISO()?todayISO():f.remind,text=M.calendarReminder({id:'dinner-coverage-'+S.mealCoverage.start,title:'Prep the next batch of dinners',date,time:S.mealCoverage.reminderTime||'09:00',note:'Dinner coverage ends '+f.last+'. Open Life Map to extend or update it. Re-export if coverage changes.'});
      const url=URL.createObjectURL(new Blob([text],{type:'text/calendar;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='life-map-dinner-reminder.ics';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Calendar alert prepared. Import it to schedule the notification.');return;
    }
    if(action==='area-task'){const names={food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents'};W.openEditor('proj',{area:names[el.dataset.category],task:'',status:'Not started',pri:'Med',inbox:false});}
  }
  const draw=render;
  render=function(){
    draw();
    const captureLaunch=app.querySelector('#lm-capture-launch');if(captureLaunch&&ui.tab!=='board')captureLaunch.hidden=true;
    const children=[...app.children],board=document.createElement('section');board.id='lm-day-view-board';board.className='lm-day-view';board.setAttribute('role','tabpanel');board.setAttribute('aria-labelledby','lm-day-nav-board');board.hidden=ui.tab!=='board';
    for(const node of children)if(!node.matches('.appbar,.lm-capture,dialog,.lm-fab,.lm-tools'))board.append(node);
    const main=document.createElement('section');main.id='lm-day-view-'+ui.tab;main.className='lm-day-view';main.setAttribute('role','tabpanel');main.setAttribute('aria-labelledby','lm-day-nav-'+ui.tab);
    if(ui.tab!=='board')main.innerHTML=(ui.tab==='home'?homeView():ui.tab==='plan'?planView():areasView())+(ui.error?'<p class="lm-error" role="alert">'+esc(ui.error)+'</p>':'');
    else if(ui.error)board.insertAdjacentHTML('afterbegin','<p class="lm-error" role="alert">'+esc(ui.error)+'</p>');
    const anchor=app.querySelector('.lm-capture')||app.querySelector('.appbar');if(ui.tab!=='board')anchor?.after(main);app.append(board);for(const key of ['home','plan','areas'])if(key!==ui.tab){const pane=document.createElement('section');pane.id='lm-day-view-'+key;pane.hidden=true;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','lm-day-nav-'+key);app.append(pane);}
    const nav=document.createElement('nav');nav.className='lm-day-dock';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Life Map views');
    nav.innerHTML=[['home','⌂','Home'],['plan','◷','Plan'],['areas','◈','Areas'],['board','▦','Board']].map(([key,icon,title])=>'<button type="button" class="btn" id="lm-day-nav-'+key+'" role="tab" aria-selected="'+(ui.tab===key)+'" aria-controls="lm-day-view-'+key+'" tabindex="'+(ui.tab===key?0:-1)+'" data-day="tab" data-tab="'+key+'"><span aria-hidden="true">'+icon+'</span><strong>'+title+'</strong></button>').join('');app.append(nav);
    W.busy&&app.querySelectorAll('[data-day]').forEach(el=>el.disabled=true);
  };
  document.addEventListener('click',event=>{const el=event.target.closest?.('[data-lm="inbox"]');if(el&&ui.tab!=='board')ui.tab='board';},true);
  app.addEventListener('click',event=>{const el=event.target.closest?.('[data-day]');if(!el)return;event.stopImmediatePropagation();if(W.busy)return;try{const result=handle(el.dataset.day,el);if(result?.catch)result.catch(e=>{ui.error=e.message;render();});}catch(e){ui.error=e.message;render();}},true);
  app.addEventListener('input',event=>{
    const el=event.target.closest?.('[data-day-field]');if(!el)return;const [scope,key]=el.dataset.dayField.split('.');
    if(scope==='food'){ui.food??=clone(S.mealCoverage||{start:todayISO(),dinners:5,note:'',reminderTime:'09:00',skipDates:[]});ui.food[key]=el.value;const f=M.mealStatus({...ui.food,dinners:Number(ui.food.dinners),skipDates:String(ui.food.skipText??(ui.food.skipDates||[]).join(', ')).split(',').map(x=>x.trim()).filter(Boolean)},todayISO());const preview=document.getElementById('lm-meal-preview');if(preview)preview.textContent=f.set?'Covered through '+fmtDay(f.last)+' · remind '+fmtDay(f.remind):'Choose a valid first date and dinner count.';}
    else if(scope==='block'){ui.block??={title:'',start:'09:00',minutes:30,category:'work',taskId:''};ui.block[key]=el.value;}
    else ui[scope]=el.value;
    recordUI();
  });
  app.addEventListener('change',event=>{const key=event.target.dataset?.dayField;if(key==='date'){if(M.validDate(ui.date)){ui.main=null;ui.block=null;recordUI();render();}}else if(key==='available')render();});
  app.addEventListener('keydown',event=>{
    const el=event.target.closest?.('[role="tab"][data-day]');if(!el||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=[...el.parentNode.querySelectorAll('[role="tab"]')],i=buttons.indexOf(el),j=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[j].click();
  });
  let lastMinute=clock();setInterval(()=>{const next=clock();if(next!==lastMinute&&!document.hidden&&!view.editor&&!W.busy&&!app.querySelector('[data-day-field]:focus')){lastMinute=next;render();}},60000);
  window.LifeMapDay=Object.freeze({choose,get view(){return ui.tab;},get category(){return ui.category;}});
})();
