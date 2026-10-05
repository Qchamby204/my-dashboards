/* Priority-led Home and category navigation over the existing Life Map records. */
(()=>{
  'use strict';
  const M=createLifeMapWorkflow(),D=window.LifeMapDashboard,W=window.LifeMapWorkflow;
  const C=window.LifeMapCalendar;
  const OPS=window.AtlasConnected?null:window.LifeMapOperations;
  const UI_KEY='lifemap:day-drafts:v1',clone=M.clone;
  let ui={tab:'home',category:'household',date:todayISO(),food:null,block:null,main:null,reset:false,available:25,related:null,records:false,target:'',calendarLink:null,error:'',opsCadence:'daily',opsPicks:new Set(),opsOpen:false};
  try{const raw=localStorage.getItem(UI_KEY);if(raw&&raw.length<100000){const saved=JSON.parse(raw);if(saved&&typeof saved==='object'&&!Array.isArray(saved)){for(const k of ['food','block','main'])if(saved[k]!==undefined)ui[k]=saved[k];}}}catch{}
  function readRoute(){const match=location.hash.match(/^#(home|plan|areas|board)(?:\?(.*))?$/);if(!match)return;ui.tab=match[1];ui.records=false;const day=new URLSearchParams(match[2]||'').get('day');if(M.validDate(day))ui.date=day;}
  readRoute();
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
  function choose(tab,category){ui.tab=tab;ui.records=false;if(category)ui.category=category;ui.error='';render();window.scrollTo?.({top:0,behavior:'instant'});document.getElementById('lm-day-nav-'+tab)?.focus({preventScroll:true});}
  function editPlan(next,date,fn){next.dayPlans??={};next.dayPlans[date]??={reviewed:false,mainTaskId:'',blocks:[]};next.dayPlans[date].blocks??=[];fn(next.dayPlans[date]);}
  function commit(change,message,success,options={}){return W.transaction(change,message,'day_planned',()=>{ui.error='';success?.();recordUI();},options);}
  const opsLabels={daily:'Daily',weekly:'Weekly',monthly:'Monthly',quarterly:'Quarterly',annually:'Annual',adhoc:'Ad hoc'};
  function opsRows(day=ui.date){try{return OPS?.rows(day)||[];}catch{return [];}}
  const opsFind=(id,day=ui.date)=>opsRows(day).find(t=>t.id===id);
  const opsPlanned=(day=ui.date)=>opsRows(day).filter(t=>t.selected);
  function opsChange(change,label,undo=true){const ticket=change();ui.error='';render();toast(label);if(undo)undoToast(label,()=>{try{OPS.undo(ticket);ui.error='';render();toast('Ops change undone');}catch(e){ui.error=e.message;render();}});}
  function opsPicker(){
    if(!OPS)return '';let all;try{all=OPS.rows(ui.date);}catch(e){return panel('Operations Cadence','<h2>Operations Cadence</h2>'+help(e.message)+'<a class="btn lm-day-button" href="operations-cadence.html">Open Ops Cadence</a>');}
    const eligible=all.filter(t=>t.status!=='Done'&&t.plan!==ui.date);ui.opsPicks=new Set([...ui.opsPicks].filter(id=>eligible.some(t=>t.id===id)));
    const rows=all.filter(t=>t.group===ui.opsCadence),count=all.filter(t=>t.selected&&t.status!=='Done').length;
    let body='<div class="lm-day-section-title"><h2>Operations Cadence</h2>'+info('How Ops tasks join your day','Pick tasks across the cadences and add them to a date. Each task has one planned date; picking another moves it. Checkmarks, custom tasks, names, notes and completion history use Ops Cadence’s records in this browser. Daily, weekly, monthly, quarterly and annual checkmarks reset on their existing cadence. Ad hoc tasks stay complete until reopened in Ops.')+'</div>';
    body+='<div class="'+(ui.tab==='areas'?'lm-two-col':'')+'">'+(ui.tab==='areas'?field('Build work for',input('date',ui.date,'date')):'')+field('Cadence',select('opsCadence',ui.opsCadence,Object.entries(opsLabels)))+'</div>'+help(count+' Ops task'+(count===1?'':'s')+' planned for '+fmtDay(ui.date)+'. Select what belongs in this day.');
    body+='<div class="lm-ops-choices">'+rows.map(t=>'<label class="lm-ops-choice"><input type="checkbox" data-ops-pick="'+attrs(t.id)+'"'+(ui.opsPicks.has(t.id)?' checked':'')+(t.status==='Done'||t.plan===ui.date?' disabled':'')+'><span><strong>'+esc(t.title)+'</strong><span class="lm-help">'+esc([t.system,t.schedule,t.status==='Done'?'Completed for this period':t.plan===ui.date?'Scheduled for this day':t.plan?'Move from '+fmtDay(t.plan):'Not scheduled',t.due?'Deadline '+fmtDay(t.due):t.season?'Season: '+t.season:''].filter(Boolean).join(' · '))+'</span></span></label>').join('')+'</div>';
    body+='<div class="lm-inline lm-ops-actions">'+button('Add selected to day'+(ui.opsPicks.size?' · '+ui.opsPicks.size:''),'ops-add',ui.opsPicks.size?'':'disabled',true)+button('View this day’s Board','view-selected-day')+'<a class="btn lm-day-button" href="operations-cadence.html">Open Ops Cadence</a></div>';
    return panel('Operations Cadence',body);
  }
  function opsTaskRow(t){return '<article class="lm-day-task" data-day-row-id="'+attrs(t.id)+'" data-ops-row-id="'+attrs(t.id)+'"><div class="eyebrow">Ops Cadence · '+opsLabels[t.group]+'</div><h3>'+esc(t.title)+'</h3>'+help([t.system,t.schedule,t.status==='Done'?'Completed':t.due?'Deadline '+fmtDay(t.due):'Scheduled for this day'].filter(Boolean).join(' · '))+'<div class="lm-inline">'+(t.status==='Done'?'':(ui.date===todayISO()?button('Start this task','ops-start','data-id="'+attrs(t.id)+'"'):'')+(t.canComplete?button('Done','ops-complete','data-id="'+attrs(t.id)+'"'):ui.date<todayISO()?button('Move to today','ops-today','data-id="'+attrs(t.id)+'"'):'')+button('Schedule in Apple Calendar','calendar-schedule','data-id="'+attrs(t.id)+'"')+button('Remove from this day','ops-remove','data-id="'+attrs(t.id)+'"'))+'</div></article>';}
  function coverageText(food){
    if(!food.set)return 'Set your dinner coverage';
    if(food.expired)return 'Dinner coverage has ended';
    if(food.startsLater)return food.remaining+' dinners from '+fmtDay(S.mealCoverage.start);
    return food.remaining+' dinner'+(food.remaining===1?'':'s')+' covered · through '+fmtDay(food.last);
  }
  const dueRoutines=()=>S.chores.filter(c=>!c.archived&&!isChecked(c)&&(c.repeat?M.choreDue(c,todayISO())<=todayISO():c.cad==='Daily'||plannedToday(c)));
  const recommend=(options={})=>{const day=S.dayPlans?.[todayISO()]||{},state={...S,dayPlans:{...S.dayPlans,[todayISO()]:{...day,blocks:[],mainTaskId:'',focus:day.focus?.kind==='task'?day.focus:undefined}}};return M.dayRecommendation(state,todayISO(),clock(),{routines:dueRoutines(),...options});};
  const areaName=category=>({food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents',rest:'Life Admin & Documents'}[category]||'');
  const scheduled=date=>S.projects.filter(t=>!t.archived&&t.plan===date);
  const dayRoutines=date=>S.chores.filter(c=>!c.archived&&S.planned?.[c.id]===date);
  function dayTaskRow(t){return '<article class="lm-day-task'+(ui.target===t.id?' lm-day-target':'')+'" data-day-row-id="'+attrs(t.id)+'">'+D.taskRow(t)+'<div class="lm-inline">'+(M.open(t)&&t.status!=='Waiting'&&ui.date===todayISO()?button('Start this task','focus','data-kind="task" data-id="'+attrs(t.id)+'"'):'')+button('Schedule in Apple Calendar','calendar-schedule','data-id="'+attrs(t.id)+'"')+button('Related area','tab','data-tab="areas" data-category="'+M.categoryFor(t)+'"')+'</div></article>';}
  const calendarTask=e=>{const id=(S.calendarLinks||[]).find(x=>x.eventId===e.id)?.taskId??e.taskId;return S.projects.find(t=>!t.archived&&t.id===id)||opsFind(id,ui.tab==='home'?todayISO():ui.date);};
  const calendarTime=(e,zone)=>e.allDay?'All day':new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(e.start))+' – '+new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit'}).format(new Date(e.end));
  function calendarPanel(){
    const saved=C?.snapshot(ui.date),events=saved?.events||[];
    let body='<div class="lm-day-section-title"><h2>Apple Calendar</h2>'+button(saved?'Refresh calendar':'Connect / refresh calendar','calendar-open')+'</div>';
    body+=help(saved?'Last refreshed '+new Date(saved.refreshedAt).toLocaleString()+'. Refresh to pick up calendar changes.':'Connect your selected iCloud calendars to see your real schedule here.');
    if(C?.message)body+='<p class="lm-help" role="status">'+esc(C.message)+'</p>';
    if(saved){body+=events.length?events.map(e=>{const t=calendarTask(e);return '<article class="lm-day-task" data-calendar-event="'+attrs(e.id)+'"><div class="eyebrow">'+esc(calendarTime(e,saved.zone))+' · '+esc(e.calendar)+'</div><h3>'+esc(e.title)+'</h3>'+(t?help('Linked task: '+t.task+(t.status==='Done'?' · Completed':'')):'')+'<div class="lm-inline">'+(t&&M.open(t)?button('Open linked task','calendar-task','data-id="'+attrs(t.id)+'"')+button('Done','complete-task','data-id="'+attrs(t.id)+'"'):'')+button(t?'Change linked task':'Link a task','calendar-link','data-event="'+attrs(e.id)+'"')+'</div></article>';}).join(''):help('No calendar events on this day.');}
    if(ui.calendarLink&&events.some(e=>e.id===ui.calendarLink)){const e=events.find(e=>e.id===ui.calendarLink),linked=calendarTask(e);body+='<div class="lm-day-task"><h3>Link '+esc(e.title)+'</h3>'+field('Life Map task','<select id="lm-calendar-task">'+[['','No linked task'],...S.projects.filter(t=>!t.archived).map(t=>[t.id,t.task]),...opsPlanned().map(t=>[t.id,'Ops · '+t.task])].map(([id,title])=>'<option value="'+attrs(id)+'"'+(linked?.id===id?' selected':'')+'>'+esc(title)+'</option>').join('')+'</select>')+'<div class="lm-inline">'+button('Save link','calendar-save-link')+button('Cancel','calendar-link-cancel')+'</div></div>';}
    body+='<details class="lm-calendar-transfer"><summary>Import calendar day</summary>'+help('If the calendar opens separately in Safari, choose Copy day link there, then paste it here in your Home Screen app.')+'<label class="lm-day-field"><span>Calendar day link</span><input id="lm-calendar-link" type="text" inputmode="url" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Paste the copied day link"></label>'+button('Import day link','calendar-import-link')+'<label class="lm-day-field"><span>Or import a downloaded calendar day file</span><input id="lm-calendar-import" type="file" accept=".json,application/json"></label></details>';
    return panel('Apple Calendar',body);
  }
  function rightNow(){
    const events=C?.active(todayISO())||[],saved=C?.snapshot(todayISO());
    if(!events.length){const focus=S.dayPlans?.[todayISO()]?.focus,active=focus?.kind==='ops'?opsPlanned(todayISO()).find(t=>t.id===focus.id):null,candidate=recommend(),base=S.projects.find(t=>t.id===candidate.id),chosen=opsPlanned(todayISO()).find(t=>t.status!=='Done');const ops=active?.status!=='Done'&&active?active:!(focus?.kind==='ops'?active?.status!=='Done'&&active:focus?.id)&&!['food','chore'].includes(candidate.kind)&&!(base&&(base.plan===todayISO()||base.status==='In progress'||base.due&&base.due<=todayISO()))?chosen:null;if(ops)return '<div class="lm-now-card"><div class="eyebrow">Right now · Ops Cadence</div><h2>'+esc(ops.title)+'</h2>'+help(active?'Started Ops task':ops.system||'Selected work for today')+'<div class="lm-inline">'+(!active?button('Start this task','ops-start','data-id="'+attrs(ops.id)+'"',true):'')+button('Done','ops-complete','data-id="'+attrs(ops.id)+'"')+button('View this day','view-day-task','data-id="'+attrs(ops.id)+'"')+button('Change focus','change-focus')+'</div></div>';return candidateCard(candidate);}
    const e=events[0],task=calendarTask(e);
    return '<div class="lm-now-card"><div class="eyebrow">Right now · Apple Calendar</div><h2>'+esc(e.title)+'</h2>'+help(calendarTime(e,saved.zone)+' · '+e.calendar)+(!C.fresh(todayISO())?help('Based on calendar last refreshed '+new Date(saved.refreshedAt).toLocaleTimeString()+'. Refresh today’s Board if your schedule changed.'):'')+(task?help('Linked task: '+task.task+(task.status==='Done'?' · Completed':'')):'')+(events.length>1?help(events.length+' calendar events overlap right now. Check today’s Board.'):'')+'<div class="lm-inline">'+(task&&M.open(task)?button('Open linked task','calendar-task','data-id="'+attrs(task.id)+'"',true)+button('Done','complete-task','data-id="'+attrs(task.id)+'"'):'')+button('View this day','view-day-task',task?'data-id="'+attrs(task.id)+'"':'')+'</div></div>';
  }
  function boardView(){
    if(!M.validDate(ui.date))return heading('Your scheduled tasks','Choose a day')+panel('Choose a day',field('Day to view',input('date',ui.date,'date'))+help('Choose a valid date to see its scheduled tasks.'));
    const today=ui.date===todayISO(),tasks=scheduled(ui.date),open=tasks.filter(M.open),done=tasks.filter(t=>t.status==='Done'),deadline=M.sortTasks(openTasks().filter(t=>t.due&&(today?t.due<=ui.date:t.due===ui.date)&&!tasks.some(p=>p.id===t.id)),ui.date),routines=dayRoutines(ui.date);
    let html=heading('Your scheduled tasks',today?'Today’s Board':fmtDay(ui.date)+' Board',button('Today','plan-today'));
    html+=panel('Choose a day','<div class="lm-inline">'+button('← Previous day','day-step','data-step="-1"')+button('Next day →','day-step','data-step="1"')+'</div>'+field('Day to view',input('date',ui.date,'date')));
    if(today)html+=panel('Right now',rightNow());
    html+=calendarPanel();
    const ops=opsPlanned();if(ops.length)html+=panel('Scheduled operations','<div class="lm-day-section-title"><h2>Operations for this day</h2>'+button('Choose Ops tasks','ops-picker')+'</div>'+ops.map(opsTaskRow).join(''));
    html+=panel('Scheduled tasks','<div class="lm-day-section-title"><h2>Scheduled for '+(today?'today':fmtDay(ui.date))+'</h2>'+button('Build this day','tab','data-tab="plan"')+'</div>'+(open.length?M.sortTasks(open,ui.date).map(dayTaskRow).join(''):help('No tasks scheduled for this day. Use Build around your day to pull in related tasks.')));
    if(deadline.length)html+=panel('Deadlines','<h2>Deadlines needing attention</h2>'+deadline.map(dayTaskRow).join(''));
    if(routines.length)html+=panel('Scheduled routines','<h2>Scheduled routines</h2>'+routines.map(c=>'<article class="lm-day-task" data-day-row-id="'+attrs(c.id)+'">'+(today?D.choreRow(c):'<strong>'+esc(c.chore)+'</strong>'+help('Scheduled for '+fmtDay(ui.date)))+'<div class="lm-inline">'+button('Remove from this day','unschedule-routine','data-id="'+attrs(c.id)+'"')+'</div></article>').join(''));
    if(today){const basics=dueRoutines().filter(c=>!routines.some(r=>r.id===c.id));if(basics.length)html+=panel('Due routines','<h2>The basics due today</h2>'+basics.map(c=>D.choreRow(c)).join(''));}
    if(done.length)html+=panel('Completed scheduled tasks','<details class="lm-block-editor"><summary>Completed · '+done.length+'</summary>'+done.map(dayTaskRow).join('')+'</details>');
    html+=panel('All records',button('All records & projects','records')+help('Browse the full task map, projects, chores and history.'));
    return html;
  }

  const guides={
    food:['Meals & groceries','Prepared dinners, the next grocery shop and your next prep session.','the-chef.html','Open Chef'],
    household:['Home & maintenance','Kitchen reset, laundry and cleaning; renovations, vehicles and seasonal maintenance.','',''],
    family:['Family & relationships','Make room for time with your wife and the people you want to show up for. Keep family commitments visible.','baby-brain.html','Open Baby Brain'],
    health:['Health & morning routine','Getting ready, meditation, walking the dog and the gym. Protect these blocks before the day fills up.','workout-forge.html','Open Forge'],
    work:['Work & personal growth','Build your day from Ops Cadence, business development, client work and content.','operations-cadence.html','Open Ops Cadence'],
    admin:['Money & life admin','Budget reviews, mail, documents, renewals and appointments. Separate real deadlines from work that can wait.','chambers-wealth-hq.html','Open Wealth HQ']
  };
  const starters=[['Morning','Get ready','health',30],['Morning','Meditation','health',10],['Morning','Walk the dog','health',20],['Morning','Gym','health',60],['Work','Business development','work',60],['Work','Client requests','work',45],['Work','Content / filming','work',45],['Work','Admin & day wrap-up','work',20],['Home & evening','Kitchen & home reset','household',15],['Home & evening','Renovation / maintenance','household',45],['Home & evening','Prepare dinners','food',45],['Home & evening','Time together','family',30],['Home & evening','Piano','work',20],['Home & evening','Read before bed','rest',20],['Home & evening','Deliberate downtime','rest',60]];
  function foundationCards(){
    const p=plan(todayISO()),food=M.mealStatus(S.mealCoverage,todayISO()),main=S.projects.find(t=>t.id===p.mainTaskId&&M.open(t));
    const cards=[
      ['food','Food',coverageText(food),food.needsPrep?'Prep next batch':food.set?'Coverage set':'Needs a check','areas','food'],
      ['plan','Today’s to-dos',(openTasks().filter(t=>t.plan===todayISO()).length+opsPlanned(todayISO()).filter(t=>t.status!=='Done').length)+' chosen for today',p.reviewed?'Reviewed':'Review your day','plan',''],
      ['day','Day view',(scheduled(todayISO()).filter(M.open).length+opsPlanned(todayISO()).filter(t=>t.status!=='Done').length)+' scheduled tasks remaining','Open today’s Board','board',''],
      ['home','Household',S.chores.filter(c=>!c.archived&&M.categoryFor(c)==='household'&&!isChecked(c)&&(c.cad==='Daily'||plannedToday(c)||c.repeat&&M.choreDue(c,todayISO())<=todayISO())).length+' essential routines open','Check the basics','areas','household']
    ];
    return '<div class="lm-foundation-grid">'+cards.map(([key,title,text,state,tab,category])=>'<button type="button" class="btn lm-foundation" data-day="tab" data-tab="'+tab+'" data-category="'+category+'"'+(key==='food'&&food.needsPrep?' data-attention="true"':'')+'><span class="eyebrow">'+title+'</span><strong>'+esc(text)+'</strong><small>'+esc(state)+' ›</small></button>').join('')+'</div>';
  }
  function candidateCard(c){
    let actions='';
    if(c.kind==='task')actions=button('Start','focus','data-kind="task" data-id="'+attrs(c.id)+'"',true)+button('Done','complete-task','data-id="'+attrs(c.id)+'"')+button('View this day','view-day-task','data-id="'+attrs(c.id)+'"');
    else if(c.kind==='chore')actions=button('Done','complete-routine','data-id="'+attrs(c.id)+'"',true)+button('View routines','tab','data-tab="areas" data-category="'+attrs(c.category)+'"');
    else if(c.kind==='food')actions=button('Open Food','tab','data-tab="areas" data-category="food"',true);
    else if(c.kind==='plan')actions=button('Build today','tab','data-tab="plan"',true);
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
    const c=recommend();
    let html=heading(niceToday(),'A clear next move.',button('I’m off track','reset'));
    html+=panel('Right now',rightNow()+ '<div class="lm-inline">'+button('Today’s scheduled tasks','view-day-task')+'</div>');
    if(ui.reset)html+=panel('Return to your day','<h2>Restart from here</h2>'+help('Choose the time you actually have. Your unfinished tasks stay available.')+field('Minutes available',select('available',ui.available,[[10,'10 minutes'],[25,'25 minutes'],[45,'45 minutes'],[60,'60 minutes']]))+candidateCard(recommend({available:Number(ui.available)}))+button('Close reset','reset-close'));
    html+=panel('Foundations','<div class="lm-day-section-title"><h2>Keep life running</h2>'+info('How foundations work','Real deadlines, due prep reminders, due routines and scheduled to-dos stay in view. Started work stays in focus until you finish or change it. Nothing is completed by the clock.')+'</div>'+foundationCards());
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
    html+='<section id="lm-category-content" role="tabpanel" aria-labelledby="lm-category-'+key+'">'+panel(title+' overview','<h2>'+guides[key][0]+'</h2>'+help(guides[key][1])+(guides[key][2]?'<a class="btn lm-day-button" href="'+guides[key][2]+'">'+guides[key][3]+' ↗</a>':''))+(key==='food'?foodView():key==='work'?opsPicker():'')+panel(title+' tasks','<h2>Tasks & projects</h2>'+(tasks.length?tasks.map(p=>D.taskRow(p)).join(''):help('No open tasks in this category.')))+panel(title+' routines','<div class="lm-day-section-title"><h2>Recurring responsibilities</h2>'+button('+ Routine','area-routine','data-category="'+key+'"')+'</div>'+(chores.length?chores.map(c=>D.choreRow(c)).join(''):help('No routines recorded here yet. Add what actually needs repeating in your life.')))+'</section>';
    return html;
  }
  function planView(){
    let html=heading('Choose what belongs in your day','Build around your day',button('Today','plan-today'));
    html+=panel('Schedule onto a day',field('Schedule tasks for',input('date',ui.date,'date'))+help('Choose a life area below to find related tasks and routines. Schedule them onto this date; use your calendar for times.')+button('View this day’s Board','view-selected-day'));
    html+=panel('Build around your life','<h2>Build around your day</h2>'+['Morning','Work','Home & evening'].map(group=>'<details class="lm-block-editor"><summary>'+group+'</summary><div class="lm-inline">'+(group==='Work'&&OPS?button('Operations Cadence','ops-picker'):'')+starters.map((row,i)=>row[0]===group?button(row[1],'related-tasks','data-index="'+i+'"'):'').join('')+'</div></details>').join(''));
    if(ui.opsOpen)html+=opsPicker();
    if(ui.related!==null){
      const row=starters[ui.related],queries=[/get ready|morning|prepar/,/meditat/,/dog|hudson|walk/,/gym|workout|train|exercise/,/business development|prospect|outreach/,/client|request/,/content|film|video/,/admin|wrap|email/,/kitchen|reset|tidy/,/renovat|repair|maintenance/,/meal|dinner|prep|grocery/,/wife|johanna|together|date night|relationship/,/piano|music/,/read|book/,/leisure|downtime|hobby/],all=openTasks().filter(t=>t.status!=='Waiting'),availableRoutines=S.chores.filter(c=>!c.archived),match=t=>queries[ui.related].test([t.task,t.chore,t.sub,t.notes].filter(Boolean).join(' ').toLowerCase());
      const exact=all.filter(match),exactRoutines=availableRoutines.filter(match),fallback=!exact.length&&!exactRoutines.length,tasks=M.sortTasks(fallback?all.filter(t=>M.categoryFor(t)===row[2]):exact,ui.date),routines=fallback?availableRoutines.filter(c=>M.categoryFor(c)===row[2]):exactRoutines;
      const action=(item,kind)=>{const date=kind==='task'?item.plan:S.planned?.[item.id],already=date===ui.date;return '<article class="lm-day-task"><strong>'+esc(item.task||item.chore)+'</strong>'+help(already?'Scheduled for '+fmtDay(ui.date):date?'Currently scheduled '+fmtDay(date):kind==='task'&&item.due?'Deadline '+fmtDay(item.due):'Not scheduled for a day')+'<div class="lm-inline">'+button(already?'Scheduled':date?'Move to '+fmtDay(ui.date):'Schedule for '+fmtDay(ui.date),'schedule-related','data-kind="'+kind+'" data-id="'+attrs(item.id)+'"'+(already?' disabled':''),!already)+'</div></article>';};
      html+=panel('Related tasks','<div class="lm-day-section-title"><h2>'+esc(row[1])+'</h2>'+button('Close','close-related')+'</div>'+help(fallback?'No direct matches. Other items in this life area are shown below.':'Related tasks and routines from your existing records.')+(tasks.length||routines.length?tasks.map(t=>action(t,'task')).join('')+routines.map(c=>action(c,'chore')).join(''):help('No related tasks or routines recorded yet.'))+button('+ Related task','new-related-task','data-index="'+ui.related+'"'));
    }
    return html;
  }
  function handle(action,el){
    const id=el.dataset.id;
    if(action==='ops-picker'){ui.opsOpen=true;if(ui.tab==='board')ui.tab='plan';render();document.querySelector('[aria-label="Operations Cadence"]')?.scrollIntoView({block:'start'});return;}
    if(action==='ops-add'){const ids=[...ui.opsPicks];return opsChange(()=>OPS.scheduleMany(ids,ui.date),ids.length+' Ops tasks added to '+fmtDay(ui.date),true);}
    if(action==='ops-today')return opsChange(()=>OPS.schedule(id,todayISO()),'Ops task moved to today');
    if(action==='ops-remove')return opsChange(()=>OPS.remove(id,ui.date),'Ops task removed from this day');
    if(action==='ops-complete')return opsChange(()=>OPS.complete(id,ui.tab==='home'?todayISO():ui.date),'Ops task completed');
    if(action==='ops-start'){const t=opsFind(id,todayISO());if(!t||!t.selected||t.status==='Done')throw Error('Choose an open Ops task scheduled for today.');return commit(next=>editPlan(next,todayISO(),p=>{p.focus={kind:'ops',id};}),'Ops focus started',()=>{ui.tab='home';ui.reset=false;});}
    if(action==='calendar-open')return C.open(ui.date);
    if(action==='calendar-import-link'){C.importLink(document.getElementById('lm-calendar-link').value.trim());ui.error='';return render();}
    if(action==='calendar-schedule'){const task=S.projects.find(t=>t.id===id&&!t.archived)||opsFind(id);if(task)C.open(ui.date,task);return;}
    if(action==='calendar-task'){const task=S.projects.find(t=>t.id===id&&!t.archived);if(task)return W.openEditor('proj',{...task});if(opsFind(id)){choose('board');app.querySelector('[data-ops-row-id="'+CSS.escape(id)+'"]')?.scrollIntoView({block:'center'});}return;}
    if(action==='calendar-link'){ui.calendarLink=el.dataset.event;render();document.getElementById('lm-calendar-task')?.focus();return;}
    if(action==='calendar-link-cancel'){ui.calendarLink=null;render();return;}
    if(action==='calendar-save-link'){const eventId=ui.calendarLink,taskId=document.getElementById('lm-calendar-task').value;return commit(next=>{next.calendarLinks=(next.calendarLinks||[]).filter(x=>x.eventId!==eventId);next.calendarLinks.push({eventId,taskId});},'Calendar task linked',()=>{ui.calendarLink=null;},{undo:false});}

    if(action==='tab')return choose(el.dataset.tab,el.dataset.category);
    if(action==='category'){ui.category=el.dataset.category;render();document.getElementById('lm-category-'+ui.category)?.focus({preventScroll:true});return;}
    if(action==='plan-today'){ui.date=todayISO();ui.main=null;ui.block=null;recordUI();render();return;}
    if(action==='reset'){ui.reset=true;return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Ready to restart');}
    if(action==='reset-close'){ui.reset=false;render();return;}
    if(action==='change-focus')return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Focus cleared',()=>{ui.tab='plan';ui.date=todayISO();});
    if(action==='complete-task'){if(opsFind(id,ui.tab==='home'?todayISO():ui.date))return opsChange(()=>OPS.complete(id,ui.tab==='home'?todayISO():ui.date),'Ops task completed');return D.setStatus(id,'Done');}
    if(action==='focus')return commit(next=>editPlan(next,todayISO(),p=>{if(el.dataset.kind==='task'){const task=next.projects.find(t=>t.id===id&&M.open(t)&&t.status!=='Waiting');if(!task)throw Error('Choose an available task.');task.inbox=false;task.plan=todayISO();}p.focus={kind:el.dataset.kind,id};}),'Focus started',()=>{ui.tab='home';ui.reset=false;});
    if(action==='complete-routine')return D.choreAction(id,'done');
    if(action==='new-todo')return W.openEditor('proj',{task:'',status:'Not started',pri:'Med',inbox:false,plan:ui.date});
    if(action==='area-routine')return W.openEditor('chore',{chore:'',cad:'Daily',area:{food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents'}[el.dataset.category]});
    if(action==='records'){ui.tab='board';ui.records=true;render();window.scrollTo?.({top:0,behavior:'instant'});return;}
    if(action==='day-board'){ui.records=false;render();return;}
    if(action==='day-step'){ui.date=M.plus(ui.date,Number(el.dataset.step));ui.target='';render();return;}
    if(action==='view-selected-day'){ui.target='';return choose('board');}
    if(action==='view-day-task'){ui.date=todayISO();ui.target=id||'';choose('board');if(id)app.querySelector('[data-day-row-id="'+CSS.escape(id)+'"]')?.scrollIntoView({block:'center'});return;}
    if(action==='related-tasks'){ui.related=Number(el.dataset.index);render();document.querySelector('[aria-label="Related tasks"]')?.scrollIntoView({block:'start'});return;}
    if(action==='close-related'){ui.related=null;render();return;}
    if(action==='new-related-task'){const row=starters[Number(el.dataset.index)];return W.openEditor('proj',{task:row[1],area:areaName(row[2]),status:'Not started',pri:'Med',inbox:false,plan:ui.date});}
    if(action==='schedule-related'){if(!M.validDate(ui.date))throw Error('Choose a valid day.');return commit(next=>{if(el.dataset.kind==='task'){const t=next.projects.find(t=>t.id===id&&M.open(t)&&t.status!=='Waiting');if(!t)throw Error('This task is no longer available.');M.setPlan(t,ui.date,todayISO());}else{if(!next.chores.some(c=>c.id===id&&!c.archived))throw Error('This routine is no longer available.');next.planned??={};next.planned[id]=ui.date;}editPlan(next,ui.date,p=>{p.reviewed=true;});},'Scheduled for '+fmtDay(ui.date),()=>{ui.tab='board';ui.records=false;ui.target=id;});}
    if(action==='unschedule-routine')return commit(next=>{if(next.planned?.[id]===ui.date)delete next.planned[id];},'Routine removed from this day');
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
    const route='#'+ui.tab+(['board','plan'].includes(ui.tab)&&M.validDate(ui.date)?'?day='+ui.date:'');
    if(location.hash!==route)history.replaceState(null,'',location.pathname+location.search+route);
    draw();
    const captureLaunch=app.querySelector('#lm-capture-launch');if(captureLaunch)captureLaunch.hidden=!(ui.tab==='board'&&ui.records);
    const children=[...app.children],records=document.createElement('section');records.id='lm-day-records';records.className='lm-day-records';records.hidden=!(ui.tab==='board'&&ui.records);
    for(const node of children)if(!node.matches('.appbar,.lm-capture,dialog,.lm-fab,.lm-tools'))records.append(node);
    const main=document.createElement('section');main.id='lm-day-view-'+ui.tab;main.className='lm-day-view';main.setAttribute('role','tabpanel');main.setAttribute('aria-labelledby','lm-day-nav-'+ui.tab);
    main.innerHTML=(ui.tab==='board'?(ui.records?heading('Full Life Map','All records',button('Day view','day-board')):boardView()):ui.tab==='home'?homeView():ui.tab==='plan'?planView():areasView())+(ui.error?'<p class="lm-error" role="alert">'+esc(ui.error)+'</p>':'');
    const anchor=app.querySelector('.lm-capture')||app.querySelector('.appbar');anchor?.after(main);main.append(records);
    for(const key of ['home','plan','areas','board'])if(key!==ui.tab){const pane=document.createElement('section');pane.id='lm-day-view-'+key;pane.hidden=true;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','lm-day-nav-'+key);app.append(pane);}
    const nav=document.createElement('nav');nav.className='lm-day-dock';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Life Map views');
    nav.innerHTML=[['home','⌂','Home'],['plan','◷','Plan'],['areas','◈','Areas'],['board','▦','Board']].map(([key,icon,title])=>'<button type="button" class="btn" id="lm-day-nav-'+key+'" role="tab" aria-selected="'+(ui.tab===key)+'" aria-controls="lm-day-view-'+key+'" tabindex="'+(ui.tab===key?0:-1)+'" data-day="tab" data-tab="'+key+'"><span aria-hidden="true">'+icon+'</span><strong>'+title+'</strong></button>').join('');app.append(nav);
    W.busy&&app.querySelectorAll('[data-day]').forEach(el=>el.disabled=true);
  };
  document.addEventListener('click',event=>{const el=event.target.closest?.('[data-lm="inbox"]');if(el){ui.tab='board';ui.records=true;}},true);
  app.addEventListener('click',event=>{const el=event.target.closest?.('[data-day]');if(!el)return;event.stopImmediatePropagation();if(W.busy)return;try{const result=handle(el.dataset.day,el);if(result?.catch)result.catch(e=>{ui.error=e.message;render();});}catch(e){ui.error=e.message;render();}},true);
  app.addEventListener('input',event=>{
    const el=event.target.closest?.('[data-day-field]');if(!el)return;const [scope,key]=el.dataset.dayField.split('.');
    if(scope==='food'){ui.food??=clone(S.mealCoverage||{start:todayISO(),dinners:5,note:'',reminderTime:'09:00',skipDates:[]});ui.food[key]=el.value;const f=M.mealStatus({...ui.food,dinners:Number(ui.food.dinners),skipDates:String(ui.food.skipText??(ui.food.skipDates||[]).join(', ')).split(',').map(x=>x.trim()).filter(Boolean)},todayISO());const preview=document.getElementById('lm-meal-preview');if(preview)preview.textContent=f.set?'Covered through '+fmtDay(f.last)+' · remind '+fmtDay(f.remind):'Choose a valid first date and dinner count.';}
    else if(scope==='block'){ui.block??={title:'',start:'09:00',minutes:30,category:'work',taskId:''};ui.block[key]=el.value;}
    else ui[scope]=el.value;
    recordUI();
  });
  app.addEventListener('change',event=>{const key=event.target.dataset?.dayField;if(key==='date'){if(M.validDate(ui.date)){ui.main=null;ui.block=null;ui.opsPicks.clear();recordUI();render();}}else if(key==='available'||key==='opsCadence')render();if(event.target.dataset?.opsPick){const id=event.target.dataset.opsPick;if(event.target.checked)ui.opsPicks.add(id);else ui.opsPicks.delete(id);const btn=app.querySelector('[data-day="ops-add"]');if(btn){btn.disabled=!ui.opsPicks.size;btn.textContent='Add selected to day'+(ui.opsPicks.size?' · '+ui.opsPicks.size:'');}}});
  app.addEventListener('keydown',event=>{
    const el=event.target.closest?.('[role="tab"][data-day]');if(!el||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();const buttons=[...el.parentNode.querySelectorAll('[role="tab"]')],i=buttons.indexOf(el),j=event.key==='Home'?0:event.key==='End'?buttons.length-1:(i+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length;buttons[j].click();
  });
  let lastMinute=clock();setInterval(()=>{const next=clock();if(next!==lastMinute&&!document.hidden&&!view.editor&&!W.busy&&!app.querySelector('[data-day-field]:focus')){lastMinute=next;render();}},60000);

  window.addEventListener('lifemap-calendar-update',event=>{if(event.detail?.imported&&M.validDate(event.detail.day)){ui.date=event.detail.day;ui.tab='board';ui.records=false;}if(!view.editor)render();});
  window.addEventListener('hashchange',()=>{readRoute();if(!view.editor)render();});
  window.addEventListener('lifemap-calendar-scheduled',event=>{const value=event.detail;if(!value||!M.validDate(value.day))return;if(opsFind(value.taskId,value.day)){try{ui.date=value.day;ui.tab='board';ui.records=false;opsChange(()=>OPS.schedule(value.taskId,value.day),'Ops task scheduled in Apple Calendar',false);}catch(e){ui.error='The calendar event was saved, but its Ops date could not be saved: '+e.message;render();}return;}commit(next=>{const t=next.projects.find(t=>t.id===value.taskId&&!t.archived);if(t)M.setPlan(t,value.day,todayISO());},'Task scheduled in Apple Calendar',()=>{ui.date=value.day;ui.tab='board';ui.records=false;},{undo:false});});
  window.addEventListener('storage',event=>{if(OPS&&event.key===OPS.key&&!view.editor)render();});
  document.addEventListener('visibilitychange',()=>{if(OPS&&!document.hidden&&!view.editor)render();});
  app.addEventListener('change',event=>{if(event.target.id!=='lm-calendar-import'||!event.target.files[0])return;C.importDay(event.target.files[0]).then(day=>{ui.date=day;ui.error='';render();}).catch(e=>{ui.error=e.message;render();});});
  setInterval(()=>{if(!document.hidden&&!view.editor&&ui.tab==='home'&&!app.querySelector('input:focus,textarea:focus,select:focus'))render();},60000);
  window.LifeMapDay=Object.freeze({choose,showRecords:()=>{ui.tab='board';ui.records=true;render();},get view(){return ui.tab;},get category(){return ui.category;}});
})();
