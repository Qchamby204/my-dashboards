/* Priority-led Home and category navigation over the existing Life Map records. */
(()=>{
  'use strict';
  const M=createLifeMapWorkflow(),D=window.LifeMapDashboard,W=window.LifeMapWorkflow;
  const C=window.LifeMapCalendar,K=createLifeMapCalendarModel();
  const OPS=window.AtlasConnected?null:window.LifeMapOperations;
  const UI_KEY='lifemap:day-drafts:v1',clone=M.clone;
  let ui={tab:'home',category:'all',q:'',month:todayISO().slice(0,7),yearView:false,taskFilter:'open',calendarDetail:'',calendarTools:false,date:todayISO(),food:null,block:null,main:null,reset:false,available:25,related:null,records:false,target:'',calendarLink:null,error:'',opsCadence:'daily',opsPicks:new Set(),opsOpen:false};
  try{const raw=localStorage.getItem(UI_KEY);if(raw&&raw.length<100000){const saved=JSON.parse(raw);if(saved&&typeof saved==='object'&&!Array.isArray(saved)){for(const k of ['food','block','main'])if(saved[k]!==undefined)ui[k]=saved[k];}}}catch{}
  function normalizeTab(tab){if(tab==='areas'){ui.category='all';return 'projects';}if(tab==='plan'||tab==='board'){ui.calendarDetail=tab==='plan'?'plan':'day';ui.calendarTools=true;if(M.validDate(ui.date))ui.month=ui.date.slice(0,7);return 'calendar';}return tab;}
  function readRoute(){const match=location.hash.match(/^#(home|projects|calendar|plan|areas|board)(?:\?(.*))?$/);if(!match)return;ui.tab=normalizeTab(match[1]);ui.records=false;const params=new URLSearchParams(match[2]||''),day=params.get('day'),month=params.get('month');if(M.validDate(day)){ui.date=day;ui.month=day.slice(0,7);}else if(month&&M.validDate(month+'-01')){ui.month=month;ui.date=month===todayISO().slice(0,7)?todayISO():month+'-01';}}

  readRoute();
  const attrs=s=>esc(String(s??'')),button=(label,action,extra='',primary=false)=>'<button type="button" class="btn lm-day-button'+(primary?' lm-day-primary':'')+'" data-day="'+action+'" '+extra+'>'+label+'</button>';
  const help=t=>'<p class="lm-help">'+esc(t)+'</p>';
  const info=(label,text)=>'<details class="atlas-info"><summary aria-label="'+esc(label)+'">i</summary><div class="atlas-info-body">'+esc(text)+'</div></details>';
  const input=(key,value,type='text',extra='')=>'<input id="lm-day-field-'+key.replace(/\./g,'-')+'" data-day-field="'+key+'" type="'+type+'" value="'+attrs(value)+'" '+extra+'>';
  const field=(title,body)=>'<label class="lm-day-field"><span>'+esc(title)+'</span>'+body+'</label>';
  const select=(key,value,options)=>'<select id="lm-day-field-'+key.replace(/\./g,'-')+'" data-day-field="'+key+'"'+(key==='areaFilter'?' aria-label="Filter by area"':'')+'>'+options.map(([v,t])=>'<option value="'+attrs(v)+'"'+(String(v)===String(value)?' selected':'')+'>'+esc(t)+'</option>').join('')+'</select>';
  const heading=(eyebrow,title,action='')=>'<div class="lm-day-heading"><div><div class="eyebrow">'+esc(eyebrow)+'</div><h1>'+esc(title)+'</h1></div><div class="lm-inline">'+action+(['plan','areas'].includes(ui.tab)&&view.qa.txt?button('Resume capture','capture'):'')+'</div></div>';
  const panel=(label,body)=>'<section class="panel lm-day-panel" aria-label="'+attrs(label)+'">'+body+'</section>';
  // Decorative title illustrations: distinct scenes, never a chart of saved progress.
  const featureArt=kind=>{
    const drawings={
      home:'<path d="M47 152h83c32 0 35-43 3-43h-15c-32 0-32-43 0-43h110"/><circle cx="47" cy="152" r="9" fill="#71b5b0"/><circle cx="130" cy="109" r="5" fill="#e6bd7b"/><path d="M228 66V28m0 0h35l-8 12 8 12h-35"/><path d="m43 78 21-19 21 19v26H43zM59 104V85h10v19" opacity=".5"/>',
      plan:'<rect x="72" y="30" width="176" height="132" rx="14" fill="#ffffff08"/><path d="M72 63h176M107 20v22m106-22v22"/><path d="m94 86 5 5 10-12m-15 34 5 5 10-12m-15 34 5 5 10-12" stroke="#71b5b0"/><path d="M128 86h88m-88 27h65m-65 27h78" opacity=".65"/>',
      board:'<rect x="27" y="38" width="76" height="118" rx="12" fill="#ffffff08"/><rect x="122" y="28" width="76" height="128" rx="12" fill="#ffffff08"/><rect x="217" y="48" width="76" height="108" rx="12" fill="#ffffff08"/><path d="M44 58h41m54-10h41m54 20h41M44 81h41m-41 18h28m67-28h41m-41 18h28m67 2h41" opacity=".5"/><circle cx="255" cy="126" r="12" stroke="#71b5b0"/><path d="m249 126 4 4 8-9" stroke="#71b5b0"/>',
      'area-household':'<path d="m72 91 88-65 88 65M89 80v80h142V80"/><path d="M145 160v-50h30v50M108 96h20v24h-20zM192 96h20v24h-20z"/><path d="M47 160h226M58 128v32m0-24c-22 0-22-31 0-31 22 0 22 31 0 31" stroke="#71b5b0"/><path d="M209 62V37h19v39" opacity=".5"/>',
      'area-food':'<circle cx="160" cy="98" r="62" fill="#ffffff08"/><circle cx="160" cy="98" r="43" opacity=".5"/><path d="M63 39v38c0 11 22 11 22 0V39M74 39v122M250 39v123m0-123c-22 17-22 54 0 54"/><path d="M143 112c-8-36 10-50 35-49-1 25-10 46-35 49Zm0 0 24-33" stroke="#71b5b0"/>',
      'area-family':'<path d="M160 149c-29-19-67-48-67-78 0-33 43-44 67-14 24-30 67-19 67 14 0 30-38 59-67 78Z" fill="#ffffff08"/><path d="M65 156h190M63 63l9-9m183 9-9-9M48 102h13m198 0h13" opacity=".5"/><path d="M136 100c11-16 37-16 48 0m-35 14 11 8 11-8" stroke="#71b5b0"/>',
      'area-health':'<path d="M55 103h43l15-34 24 65 23-86 21 55h84" stroke="#71b5b0"/><path d="M160 163c-44-28-89-58-89-95 0-40 52-51 89-13 37-38 89-27 89 13 0 37-45 67-89 95Z" fill="#ffffff08"/>',
      'area-work':'<path d="M160 56c-25-20-57-25-91-19v113c34-6 66-1 91 19 25-20 57-25 91-19V37c-34-6-66-1-91 19Zm0 0v113" fill="#ffffff08"/><path d="M91 63c17-1 31 2 47 10m-47 15c17-1 31 2 47 10m-47 15c17-1 31 2 47 10m44-50c16-8 30-11 47-10m-47 35c16-8 30-11 47-10" opacity=".5"/><path d="m202 125 9 9 18-23" stroke="#71b5b0"/>',
      'area-admin':'<path d="M69 68V46c0-8 5-13 13-13h66l20 22h68c9 0 15 6 15 15v83H69Z" fill="#ffffff08"/><path d="M69 79h182M110 105h66m-66 22h41"/><circle cx="230" cy="143" r="23" fill="#293d50" stroke="#71b5b0"/><path d="m220 143 7 7 13-16" stroke="#71b5b0"/>'
    };
    return '<svg class="lm-feature-art" data-illustration="'+attrs(kind)+'" viewBox="0 0 320 190" fill="none" aria-hidden="true"><path d="M26 174h268" stroke="currentColor" stroke-opacity=".18"/><circle cx="278" cy="30" r="5" fill="currentColor" opacity=".3"/><circle cx="38" cy="35" r="2" fill="currentColor" opacity=".5"/><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">'+(drawings[kind]||drawings.board)+'</g></svg>';
  };
  const feature=(kind,label,eyebrow,title,body,actions,extraClass='')=>'<section class="lm-feature '+extraClass+'" aria-label="'+attrs(label)+'"><div class="lm-feature-rail">'+esc(eyebrow)+'</div><div class="lm-feature-body"><div class="lm-feature-title"><h2>'+esc(title)+'</h2></div>'+featureArt(kind)+body+'</div><div class="lm-feature-footer lm-inline">'+actions+'</div></section>';
  const focusCard=(eyebrow,title,body,actions)=>{
    const direct=(actions.match(/<button[^>]+data-day="(?:focus|complete-task|complete-routine|ops-start|ops-complete)"[\s\S]*?<\/button>/g)||[]).join('');
    return feature('home','Current focus',eyebrow,title,body,direct+button('View projects','tab','data-tab="projects"'),'lm-now-card');
  };
  const daySelector=()=>'<section class="lm-day-date-bar" aria-label="Selected day">'+field(ui.tab==='plan'?'Schedule tasks for':'Day to view',input('date',ui.date,'date'))+'<div class="lm-day-date-actions">'+button('<span aria-hidden="true">‹</span>','day-step','data-step="-1" aria-label="Previous day"')+button('Today','plan-today')+button('<span aria-hidden="true">›</span>','day-step','data-step="1" aria-label="Next day"')+'</div>'+'</section>';
  const plan=(date=ui.date)=>S.dayPlans?.[date]||{reviewed:false,mainTaskId:'',blocks:[]};
  const openTasks=()=>S.projects.filter(M.open);
  const clock=()=>{const d=new Date();return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');};
  const recordUI=()=>{try{localStorage.setItem(UI_KEY,JSON.stringify({food:ui.food,block:ui.block,main:ui.main,date:ui.date}));}catch{ui.error='Your draft could not be saved. Keep this page open until you save it.';}};
  const tabPlaces=new Map();let tabVisit=0;
  function choose(tab,category,restore=false){
    tab=normalizeTab(tab);
    const pane=document.getElementById('lm-day-view-'+ui.tab);
    tabPlaces.set(ui.tab,{y:window.scrollY||0,records:ui.records,date:ui.date,month:ui.month,category:ui.category,open:[...(pane?.querySelectorAll('details[open]')||[])].map(el=>el.querySelector('summary')?.textContent)});
    const saved=restore?tabPlaces.get(tab):null,visit=++tabVisit;
    ui.tab=tab;ui.records=!!saved?.records;if(saved&&tab==='calendar'){ui.date=saved.date;ui.month=saved.month;}if(category)ui.category=category;else if(saved&&tab==='projects')ui.category=saved.category;
    ui.error='';render();
    if(saved)for(const el of document.getElementById('lm-day-view-'+tab)?.querySelectorAll('details')||[])if(saved.open.includes(el.querySelector('summary')?.textContent))el.open=true;
    const settle=()=>{if(visit!==tabVisit||ui.tab!==tab)return;window.scrollTo?.({top:saved?.y||0,behavior:'instant'});document.getElementById('lm-day-nav-'+tab)?.focus({preventScroll:true});};
    settle();if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>requestAnimationFrame(()=>{if(document.activeElement===document.getElementById('lm-day-nav-'+tab)&&visit===tabVisit&&ui.tab===tab)window.scrollTo?.({top:saved?.y||0,behavior:'instant'});}));
  }
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
    body+='<div class="'+(ui.tab==='projects'?'lm-two-col':'')+'">'+(ui.tab==='projects'?field('Build work for',input('date',ui.date,'date')):'')+field('Cadence',select('opsCadence',ui.opsCadence,Object.entries(opsLabels)))+'</div>'+help(count+' Ops task'+(count===1?'':'s')+' planned for '+fmtDay(ui.date)+'. Select what belongs in this day.');
    body+='<div class="lm-ops-choices">'+rows.map(t=>'<label class="lm-ops-choice"><input type="checkbox" data-ops-pick="'+attrs(t.id)+'"'+(ui.opsPicks.has(t.id)?' checked':'')+(t.status==='Done'||t.plan===ui.date?' disabled':'')+'><span><strong>'+esc(t.title)+'</strong><span class="lm-help">'+esc([t.system,t.schedule,t.status==='Done'?'Completed for this period':t.plan===ui.date?'Scheduled for this day':t.plan?'Move from '+fmtDay(t.plan):'Not scheduled',t.due?'Deadline '+fmtDay(t.due):t.season?'Season: '+t.season:''].filter(Boolean).join(' · '))+'</span></span></label>').join('')+'</div>';
    body+='<div class="lm-inline lm-ops-actions">'+button('Add selected to day'+(ui.opsPicks.size?' · '+ui.opsPicks.size:''),'ops-add',ui.opsPicks.size?'':'disabled',true)+button('View scheduled tasks','view-selected-day')+'<a class="btn lm-day-button" href="operations-cadence.html">Open Ops Cadence</a></div>';
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
  function dayTaskRow(t){return '<article class="lm-day-task'+(ui.target===t.id?' lm-day-target':'')+'" data-day-row-id="'+attrs(t.id)+'">'+D.taskRow(t)+'<div class="lm-inline">'+(M.open(t)&&t.status!=='Waiting'&&ui.date===todayISO()?button('Start','focus','data-kind="task" data-id="'+attrs(t.id)+'" aria-label="'+attrs('Start '+t.task)+'"'):'')+button('Apple Calendar','calendar-schedule','data-id="'+attrs(t.id)+'" aria-label="'+attrs('Schedule '+t.task+' in Apple Calendar')+'"')+button('Area','tab','data-tab="areas" data-category="'+M.categoryFor(t)+'" aria-label="'+attrs('Open the '+(M.categories.find(([k])=>k===M.categoryFor(t))?.[1]||'related')+' area')+'"')+'</div></article>';}
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
    if(!events.length){const focus=S.dayPlans?.[todayISO()]?.focus,active=focus?.kind==='ops'?opsPlanned(todayISO()).find(t=>t.id===focus.id):null,candidate=recommend(),base=S.projects.find(t=>t.id===candidate.id),chosen=opsPlanned(todayISO()).find(t=>t.status!=='Done');const ops=active?.status!=='Done'&&active?active:!(focus?.kind==='ops'?active?.status!=='Done'&&active:focus?.id)&&!['food','chore'].includes(candidate.kind)&&!(base&&(base.plan===todayISO()||base.status==='In progress'||base.due&&base.due<=todayISO()))?chosen:null;if(ops)return focusCard('Right now · Ops Cadence',ops.title,help(active?'Started Ops task':ops.system||'Selected work for today'),(!active?button('Start this task','ops-start','data-id="'+attrs(ops.id)+'"',true):'')+button('Done','ops-complete','data-id="'+attrs(ops.id)+'"',!!active)+button('View today’s Board','view-day-task','data-id="'+attrs(ops.id)+'"')+button('Change focus','change-focus'));return candidateCard(candidate);}
    const e=events[0],task=calendarTask(e);
    return focusCard('Right now · Apple Calendar',e.title,help(calendarTime(e,saved.zone)+' · '+e.calendar)+(!C.fresh(todayISO())?help('Based on calendar last refreshed '+new Date(saved.refreshedAt).toLocaleTimeString()+'. Refresh Apple Calendar if your schedule changed.'):'')+(task?help('Linked task: '+task.task+(task.status==='Done'?' · Completed':'')):'')+(events.length>1?help(events.length+' calendar events overlap right now. Review them in Calendar.'):''),(task&&M.open(task)?button('Open linked task','calendar-task','data-id="'+attrs(task.id)+'"',true)+button('Done','complete-task','data-id="'+attrs(task.id)+'"'):'')+button('View today’s Board','view-day-task',task?'data-id="'+attrs(task.id)+'"':''));
  }
  function boardView(){
    if(!M.validDate(ui.date))return heading('Your scheduled tasks','Choose a day')+panel('Choose a day',field('Day to view',input('date',ui.date,'date'))+help('Choose a valid date to see its scheduled tasks.'));
    const today=ui.date===todayISO(),tasks=scheduled(ui.date),open=tasks.filter(M.open),done=tasks.filter(t=>t.status==='Done'),deadline=M.sortTasks(openTasks().filter(t=>t.due&&(today?t.due<=ui.date:t.due===ui.date)&&!tasks.some(p=>p.id===t.id)),ui.date),routines=dayRoutines(ui.date);
    const ops=opsPlanned(),remaining=open.length+ops.filter(t=>t.status!=='Done').length,completed=done.length+ops.filter(t=>t.status==='Done').length;
    let html=heading('Your scheduled tasks',today?'Today’s Board':fmtDay(ui.date)+' Board',button('Add task','new-todo'))+feature('board','Your day at a glance',fmtDay(ui.date),remaining?remaining+' scheduled task'+(remaining===1?'':'s'):'Room for your next task',help(completed+' completed task'+(completed===1?'':'s')+(routines.length?' · '+routines.length+' scheduled routine'+(routines.length===1?'':'s'):'')),button('Build this day','tab','data-tab="plan"',true)+button('All records & projects','records'))+daySelector();
    if(ops.length)html+=panel('Scheduled operations','<div class="lm-day-section-title"><h2>Operations for this day</h2>'+button('Choose Ops tasks','ops-picker')+'</div>'+ops.map(opsTaskRow).join(''));
    html+=panel('Scheduled tasks','<div class="lm-day-section-title"><h2>Scheduled for '+(today?'today':fmtDay(ui.date))+'</h2></div>'+(open.length?M.sortTasks(open,ui.date).map(dayTaskRow).join(''):help('Nothing scheduled for this day.')));
    html+='<div data-day-capture-anchor></div>';
    if(deadline.length)html+=panel('Deadlines','<h2>Deadlines needing attention</h2>'+deadline.map(dayTaskRow).join(''));
    if(routines.length)html+=panel('Scheduled routines','<h2>Scheduled routines</h2>'+routines.map(c=>'<article class="lm-day-task" data-day-row-id="'+attrs(c.id)+'">'+(today?D.choreRow(c):'<strong>'+esc(c.chore)+'</strong>'+help('Scheduled for '+fmtDay(ui.date)))+'<div class="lm-inline">'+button('Remove from this day','unschedule-routine','data-id="'+attrs(c.id)+'"')+'</div></article>').join(''));
    if(today){const basics=dueRoutines().filter(c=>!routines.some(r=>r.id===c.id));if(basics.length)html+=panel('Due routines','<h2>The basics due today</h2>'+basics.map(c=>D.choreRow(c)).join(''));}
    if(done.length)html+=panel('Completed scheduled tasks','<details class="lm-block-editor"><summary>Completed · '+done.length+'</summary>'+done.map(dayTaskRow).join('')+'</details>');
    html+=calendarPanel();
    if(today)html+=panel('Right now',rightNow());
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
      ['home','Household',S.chores.filter(c=>!c.archived&&M.categoryFor(c)==='household'&&!isChecked(c)&&(!c.repeat&&c.cad==='Daily'||plannedToday(c)||c.repeat&&M.choreDue(c,todayISO())<=todayISO())).length+' essential routines open','Check the basics','areas','household']
    ];
    return '<div class="lm-foundation-grid">'+cards.map(([key,title,text,state,tab,category])=>'<button type="button" class="btn lm-foundation" data-day="tab" data-tab="'+tab+'" data-category="'+category+'"'+(key==='food'&&food.needsPrep?' data-attention="true"':'')+'><span class="eyebrow">'+title+'</span><strong>'+esc(text)+'</strong><small>'+esc(state)+' ›</small></button>').join('')+'</div>';
  }
  function candidateCard(c){
    let actions='';
    if(c.kind==='task'){
      const active=S.dayPlans?.[todayISO()]?.focus,started=active?.kind==='task'&&active.id===c.id;
      actions=(!started?button('Start','focus','data-kind="task" data-id="'+attrs(c.id)+'"',true):'')+button('Done','complete-task','data-id="'+attrs(c.id)+'"',started)+button('View today’s Board','view-day-task','data-id="'+attrs(c.id)+'"');
    }
    else if(c.kind==='chore')actions=button('Done','complete-routine','data-id="'+attrs(c.id)+'"',true)+button('View routines','tab','data-tab="areas" data-category="'+attrs(c.category)+'"');
    else if(c.kind==='food')actions=button('Open Food','tab','data-tab="areas" data-category="food"',true);
    else if(c.kind==='plan')actions=button('Build today','tab','data-tab="plan"',true);
    else actions=button('Choose a task','tab','data-tab="board"')+'<a class="btn lm-day-button" href="life-ledger.html">Leisure in Life Ledger ↗</a>';
    return focusCard('Right now'+(c.minutes?' · '+c.minutes+' min':''),c.title,help(c.why),actions+button('Change plan','change-focus'));
  }
  function categoryCards(){
    return '<div class="lm-category-grid">'+M.categories.map(([key,title])=>{
      const rows=openTasks().filter(p=>M.categoryFor(p)===key),due=rows.filter(p=>p.due&&p.due<=M.plus(todayISO(),7)).length,routines=dueRoutines().filter(c=>M.categoryFor(c)===key).length;
      return '<button type="button" class="btn lm-category-card" data-day="tab" data-tab="areas" data-category="'+key+'"><strong>'+title+'</strong><span>'+rows.length+' open task'+(rows.length===1?'':'s')+(due?' · '+due+' deadlines soon':'')+(routines?' · '+routines+' routines due':'')+'</span><small>Open ›</small></button>';
    }).join('')+'</div>';
  }
  function completedRecap(){
    const rows=M.completedToday(S,todayISO(),opsRows(todayISO()));if(!rows.length)return '';
    const row=r=>'<li><span class="lm-completed-check" aria-hidden="true">✓</span><div><strong>'+esc(r.title||'Completed item')+'</strong><span class="lm-help">'+esc(r.kind)+'</span></div></li>';
    return '<section class="panel lm-day-panel lm-completed-recap" aria-label="What you moved forward today"><div class="lm-day-section-title"><h2>What you moved forward today</h2>'+info('About today’s completed work','Tasks completed today, routine check-ins and dated Ops completions appear here from their existing saved records. Reopened tasks and undone check-ins drop out. Opening this view earns nothing.')+'</div><p class="lm-completed-count">'+rows.length+' completed today</p><ul>'+rows.slice(0,3).map(row).join('')+'</ul>'+(rows.length>3?'<details><summary>See all '+rows.length+' completions</summary><ul>'+rows.slice(3).map(row).join('')+'</ul></details>':'')+'</section>';
  }
  function mandatoryRow(c){
    const history=(S.choreHistory||[]).filter(h=>h.choreId===c.id&&h.date===todayISO()).at(-1),on=c.repeat?!!history:isChecked(c),skipped=history?.status==='skipped';
    return '<div class="lm-task-row'+(on&&!skipped?' lm-done':'')+'">'+button(on?(skipped?'—':'✓'):'','mandatory-toggle','data-id="'+attrs(c.id)+'" aria-pressed="'+on+'" aria-label="'+attrs((on?'Mark incomplete: ':'Complete ')+c.chore)+'"')+'<button type="button" class="btn lm-task-main" data-lm="edit-chore" data-id="'+attrs(c.id)+'"><span class="lm-task-title">'+esc(c.chore)+'</span><span class="lm-row-meta">'+esc(skipped?'Skipped today':on?'Done today':c.cad)+'</span></button></div>';
  }
  function homeView(){
    const routines=S.chores.filter(c=>!c.archived&&(!c.repeat&&c.cad==='Daily'||plannedToday(c)||c.repeat&&M.choreDue(c,todayISO())<=todayISO()||(S.choreHistory||[]).some(h=>h.choreId===c.id&&h.date===todayISO())));
    const complete=routines.filter(c=>c.repeat?(S.choreHistory||[]).some(h=>h.choreId===c.id&&h.date===todayISO()&&h.status==='done'):isChecked(c)&&!(S.choreHistory||[]).some(h=>h.choreId===c.id&&h.occurrence===periodKey(c.cad)&&h.status==='skipped')).length;
    let html=panel('Right now',rightNow());
    html+=panel('Daily mandatory','<div class="lm-day-section-title"><div><div class="eyebrow">The essentials</div><h2>Daily mandatory</h2></div><span class="lm-checklist-count">'+complete+' / '+routines.length+'</span></div><div class="lm-mandatory-list">'+(routines.length?routines.map(mandatoryRow).join(''):help('Add the routines you want to check off each day.'))+'</div>'+button('Add routine','area-routine','data-category="household"'));
    html+='<div data-day-capture-anchor></div>';
    const tasks=S.projects.filter(t=>!t.archived&&(t.plan===todayISO()||M.open(t)&&t.due&&t.due<=todayISO()));
    const ops=opsPlanned(todayISO());
    if(tasks.length||ops.length)html+=panel('Today’s tasks','<div class="lm-day-section-title"><h2>Today’s tasks</h2>'+button('Calendar','tab','data-tab="calendar"')+'</div>'+M.sortTasks(tasks,todayISO()).map(t=>D.taskRow(t)).join('')+ops.map(opsTaskRow).join(''));
    html+=completedRecap();
    if(!window.AtlasConnected)html+='<details class="lm-more-tools"><summary>Daily preparation & links</summary><section id="atlas-daily-root" aria-label="Daily preparation"></section></details>';
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
  // Projects answers "what is in this area, and what is next?" Filtering and search never write records.
  const areaTitleOf=record=>{const key=record?.area||record?.chore?M.categoryFor(record):'';return key?M.categories.find(([k])=>k===key)?.[1]||'Unfiled':'Unfiled';};
  const matches=(text,q)=>!q||String(text||'').toLowerCase().includes(q);
  const taskText=t=>[t.task,t.notes,...(t.checklist||[]).map(c=>c.text)].join(' ');
  function projectScope(){
    const key=ui.category,all=key==='all',q=(ui.q||'').trim().toLowerCase();
    const inArea=r=>all||M.categoryFor(r)===key;
    const areaTasks=S.projects.filter(t=>!t.archived&&inArea(t));
    const shown=t=>ui.taskFilter==='all'||(ui.taskFilter==='done'?t.status==='Done':M.open(t));
    const coreProjects=(S.groups||[]).filter(g=>!g.archived);
    const groups=coreProjects.filter(g=>inArea(g)&&(matches(g.title+' '+(g.notes||''),q)||S.projects.some(t=>!t.archived&&t.parentId===g.id&&matches(taskText(t),q))));
    const groupTitleHit=g=>matches(g.title+' '+(g.notes||''),q);
    const tasks=areaTasks.filter(t=>shown(t)&&(matches(taskText(t),q)||(groups.some(g=>g.id===t.parentId&&groupTitleHit(g)))));
    const openCount=areaTasks.filter(t=>M.open(t)&&(!q||tasks.includes(t))).length;
    return {key,all,q,groups,tasks,openCount,title:all?'All areas':M.categories.find(([id])=>id===key)?.[1]||'Projects'};
  }
  function projectSummary(scope){return scope.title+' · '+scope.openCount+' open task'+(scope.openCount===1?'':'s')+(scope.q?' matching “'+ui.q.trim()+'”':'');}
  // The project's next task: overdue first, then the nearest deadline, then the nearest planned day.
  function nextTask(tasks){
    const today=todayISO(),day=p=>p.plan||p.planWeek||'9999';
    return M.sortTasks(tasks,today).sort((a,b)=>{const over=p=>!!p.due&&p.due<today;if(over(a)!==over(b))return over(a)?-1:1;return (a.due||'9999').localeCompare(b.due||'9999')||day(a).localeCompare(day(b));})[0];
  }
  function projectCard(g,scope){
    const progress=M.projectProgress(S,g,todayISO()),range=K.projectRange(S,g),all=S.projects.filter(t=>!t.archived&&t.parentId===g.id);
    const rows=scope.tasks.filter(t=>t.parentId===g.id),next=nextTask(all.filter(M.open)),rest=rows.filter(t=>t!==next);
    const showNext=next&&(rows.includes(next)||!scope.q)&&ui.taskFilter!=='done';
    return '<article class="panel lm-day-panel lm-simple-project" data-project-id="'+attrs(g.id)+'"><div class="lm-day-section-title"><h2>'+esc(g.title)+'</h2><button type="button" class="btn lm-day-button" data-lm="edit-group" data-id="'+attrs(g.id)+'">Edit project</button></div>'+
      help(areaTitleOf(g)+' · '+progress.done+' / '+progress.total+' tasks complete'+(range?' · '+fmtDay(range.start)+' – '+fmtDay(range.end):''))+
      '<div class="lm-project-progress" role="progressbar" aria-label="'+attrs(g.title+' completion')+'" aria-valuenow="'+progress.percent+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+progress.percent+'%"></span></div>'+
      (showNext?'<div class="lm-project-next"><span class="lm-project-next-label">Next</span>'+D.taskRow(next)+'</div>':progress.total&&!next?help('Every task in this project is complete.'):'')+
      (rest.length?'<details class="lm-project-tasks"'+(scope.q?' open':'')+'><summary>'+(showNext?'More tasks':'Tasks')+' · '+rest.length+'</summary>'+rest.map(t=>D.taskRow(t)).join('')+'</details>':'')+
      '<div class="lm-inline">'+button('Add task','project-capture','data-id="'+attrs(g.id)+'"')+button('Set timeline','project-dates','data-id="'+attrs(g.id)+'"')+'</div></article>';
  }
  function projectResults(scope){
    let html='';
    if(scope.groups.length)html+='<section class="lm-project-collection" aria-label="Projects">'+scope.groups.map(g=>projectCard(g,scope)).join('')+'</section>';
    const standalone=scope.tasks.filter(t=>!t.parentId||!(S.groups||[]).some(g=>g.id===t.parentId&&!g.archived));
    const elsewhere=scope.tasks.filter(t=>t.parentId&&!standalone.includes(t)&&!scope.groups.some(g=>g.id===t.parentId));
    html+=panel('Tasks without a project','<h2>Tasks without a project</h2>'+(standalone.length?M.sortTasks(standalone,todayISO()).map(t=>D.taskRow(t)).join(''):help(scope.q?'No standalone tasks match.':'Standalone tasks appear here.')));
    if(elsewhere.length)html+=panel('Tasks in projects filed under another area','<h2>In projects under another area</h2>'+help('These tasks are filed under '+scope.title+'. Their project is filed elsewhere.')+M.sortTasks(elsewhere,todayISO()).map(t=>D.taskRow(t)).join(''));
    if(scope.q)html+='<div class="lm-inline">'+button('Search notes, routines & archive','search-all')+'</div>';
    return html;
  }
  function refreshProjectResults(){
    const scope=projectScope(),results=app.querySelector('#lm-project-results'),count=app.querySelectorAll('[data-project-summary]');
    if(results)results.innerHTML=projectResults(scope);count.forEach(node=>node.textContent=projectSummary(scope));
  }
  function projectsView(){
    if(ui.category!=='all'&&!M.categories.some(([key])=>key===ui.category))ui.category='all';
    const scope=projectScope(),key=scope.key,all=scope.all;
    const chores=S.chores.filter(c=>!c.archived&&(all||M.categoryFor(c)===key));
    const toolbar='<div class="lm-project-toolbar" role="search" aria-label="Filter projects and tasks">'+field('Area',select('areaFilter',key,[['all','All areas'],...M.categories]))+
      '<label class="lm-day-field lm-project-search"><span>Search</span><input id="lm-day-field-q" data-day-field="q" type="search" value="'+attrs(ui.q||'')+'" placeholder="Tasks and projects" autocomplete="off" enterkeyhint="search"></label></div>'+
      '<p class="lm-project-count" data-project-summary role="status">'+esc(projectSummary(scope))+'</p>';
    let html=feature('board','Projects overview',all?'Every project. Every task.':'Your area',all?'Projects & tasks':scope.title,toolbar,button('Add task','capture','',true)+'<button type="button" class="btn lm-day-button" data-lm="new-group">New project</button>');
    html+='<div id="lm-category-content"><div class="lm-project-sticky"><button type="button" class="btn lm-project-jump" data-day="focus-filter" aria-describedby="lm-project-jump-hint"><span data-project-summary>'+esc(projectSummary(scope))+'</span><span class="lm-project-jump-cue" aria-hidden="true">Change</span></button><span id="lm-project-jump-hint" hidden>Change area or search</span>'+select('taskFilter',ui.taskFilter,[['open','Open'],['all','All tasks'],['done','Completed']]).replace('<select ','<select aria-label="Show tasks" ')+'</div>';
    html+='<div id="lm-project-results">'+projectResults(scope)+'</div>';
    html+=panel('Recurring responsibilities','<div class="lm-day-section-title"><h2>Routines</h2>'+button('Add routine','area-routine','data-category="'+(all?'household':key)+'"')+'</div>'+chores.map(c=>D.choreRow(c)).join(''));
    html+='<details class="lm-more-tools"'+(ui.food||S.mealCoverage?' open':'')+'><summary>Dinner coverage</summary>'+foodView()+'</details><details class="lm-more-tools"><summary>Choose operations tasks</summary>'+opsPicker()+'</details>';
    html+='</div><details class="lm-more-tools"'+(ui.records?' open':'')+' data-full-record><summary>More tools & full record</summary>'+button('Open full record','records')+'</details>';
    return html;
  }
  function calendarView(){
    const month=ui.month,first=month+'-01',last=K.monthEnd(month),projects=K.projects(S),active=projects.filter(p=>K.inMonth(p.range,month)),events=K.events(S,month),label=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(first+'T12:00:00Z')),weekday=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7;
    const days=Number(last.slice(8));let grid='';for(let i=0;i<weekday;i++)grid+='<span aria-hidden="true"></span>';
    for(let n=1;n<=days;n++){const date=month+'-'+String(n).padStart(2,'0'),items=events.filter(e=>e.date===date),spanning=active.filter(p=>p.range.start<=date&&p.range.end>=date),count=new Set([...items.map(e=>e.task.parentId||'task:'+e.task.id),...spanning.map(p=>p.group.id)]).size;
      grid+='<button type="button" class="lm-month-day'+(count?' lm-month-has-work':'')+'" data-day="calendar-day" data-date="'+date+'" aria-label="'+attrs(fmtDay(date)+', '+items.length+' tasks, '+spanning.length+' projects')+'" aria-pressed="'+(date===ui.date)+'"'+(date===todayISO()?' aria-current="date"':'')+'><span>'+n+'</span><span class="lm-month-dots" aria-hidden="true">'+(count?'<i></i>'.repeat(Math.min(count,3)):'')+'</span></button>';
    }
    let html='<section class="lm-feature lm-calendar-feature" data-weeks="'+Math.ceil((weekday+days)/7)+'" aria-label="Project calendar"><div class="lm-feature-rail"><span>Project calendar</span>'+button('This month','calendar-today')+'</div><div class="lm-feature-body"><div class="lm-month-header">'+button('‹','calendar-month','data-step="-1" aria-label="Previous month"')+'<h2 aria-live="polite">'+esc(label)+'</h2>'+button('›','calendar-month','data-step="1" aria-label="Next month"')+'</div>'+help(active.length+' project'+(active.length===1?'':'s')+' · '+new Set(events.map(e=>e.task.id)).size+' dated tasks')+'<div class="lm-month-weekdays" aria-hidden="true">'+['M','T','W','T','F','S','S'].map(d=>'<span>'+d+'</span>').join('')+'</div><div class="lm-month-grid" role="group" aria-label="'+attrs(label)+'">'+grid+'</div><div class="lm-month-projects">'+active.slice(0,2).map(({group:g})=>button(esc(g.title),'project-dates','data-id="'+attrs(g.id)+'"')).join('')+'</div></div><div class="lm-feature-footer lm-inline">'+button(ui.yearView?'Close 12 months':'Next 12 months','calendar-year','aria-expanded="'+ui.yearView+'"',true)+button('Add task','capture')+'</div></section>';
    if(ui.yearView)html+=panel('Next 12 months','<h2>The next 12 months</h2><div class="lm-year-grid">'+Array.from({length:12},(_,i)=>{const m=K.shiftMonth(todayISO().slice(0,7),i),n=projects.filter(p=>K.inMonth(p.range,m)).length,tasks=new Set(K.events(S,m).map(e=>e.task.id)).size;return '<button type="button" class="lm-year-month" data-day="calendar-pick-month" data-month="'+m+'" aria-pressed="'+(m===month)+'"><strong>'+esc(fmtMonth(m))+'</strong><span>'+n+' project'+(n===1?'':'s')+' · '+tasks+' task'+(tasks===1?'':'s')+'</span></button>';}).join('')+'</div>');
    html+=panel('Projects this month','<div class="lm-day-section-title"><h2>Projects in '+esc(label)+'</h2><button type="button" class="btn lm-day-button" data-lm="new-group">New project</button></div><div class="lm-timeline-scale" aria-hidden="true"><span>1</span><span>'+Math.round(days/2)+'</span><span>'+days+'</span></div>'+active.map(({group:g,range,tasks})=>{const bar=K.bar(range,month),done=tasks.filter(t=>t.status==='Done').length;return '<button type="button" class="lm-project-timeline" data-day="project-dates" data-id="'+attrs(g.id)+'" aria-label="'+attrs('Change dates for '+g.title)+'"><span class="lm-timeline-title"><strong>'+esc(g.title)+'</strong><span>'+done+' / '+tasks.length+'</span></span><span class="lm-timeline-track"><span style="left:'+bar.left+'%;width:'+bar.width+'%"></span></span><span class="lm-row-meta">'+esc(fmtDay(range.start)+' – '+fmtDay(range.end))+(range.derived?' · From task dates':'')+'</span></button>';}).join('')+(active.length?'':help('No projects scheduled this month. Set dates on a project to place it here.')));
    const unscheduled=projects.filter(p=>!p.range);if(unscheduled.length)html+=panel('Projects without dates','<details><summary>Unscheduled projects · '+unscheduled.length+'</summary>'+unscheduled.map(({group:g})=>button(esc(g.title)+' · Set dates','project-dates','data-id="'+attrs(g.id)+'"')).join('')+'</details>');
    html+='<section class="panel lm-day-panel" aria-label="Selected day tasks"><div class="lm-day-section-title"><h2>'+esc(fmtDay(ui.date))+'</h2>'+button('Add task for this day','capture-date')+'</div>'+daySelector();
    const tasks=S.projects.filter(t=>!t.archived&&(t.plan===ui.date||t.due===ui.date||t.followUp===ui.date||t.planWeek===ui.date||t.showAfter===ui.date||!t.showAfter&&t.park&&t.park+'-01'===ui.date));
    html+=(tasks.length?M.sortTasks(tasks,ui.date).map(dayTaskRow).join(''):help('No dated tasks on this day.'))+opsPlanned().map(opsTaskRow).join('');
    const routines=dayRoutines(ui.date);if(routines.length)html+='<h3>Scheduled routines</h3>'+routines.map(c=>ui.date===todayISO()?D.choreRow(c):'<p>'+esc(c.chore)+'</p>').join('');html+='</section>';
    html+='<details class="lm-more-tools"'+(ui.calendarTools?' open':'')+'><summary>Apple Calendar & planning tools</summary>'+calendarPanel()+'<details'+(ui.calendarDetail==='plan'?' open':'')+'><summary>Plan a day from existing tasks</summary>'+planView()+'</details></details>';
    return html;
  }
  function areasView(){
    const key=ui.category,title=M.categories.find(([k])=>k===key)?.[1]||'Life areas';
    const tasks=M.sortTasks(openTasks().filter(p=>M.categoryFor(p)===key),todayISO()),chores=S.chores.filter(c=>!c.archived&&M.categoryFor(c)===key);
    let html=heading('Life areas',title);
    html+=feature('area-'+key,title+' overview',tasks.length+' open task'+(tasks.length===1?'':'s')+' · '+chores.length+' routine'+(chores.length===1?'':'s'),guides[key][0],help(guides[key][1]),button('+ Task','area-task','data-category="'+key+'"',true)+(guides[key][2]?'<a class="btn lm-day-button" href="'+guides[key][2]+'">'+guides[key][3]+' ↗</a>':''));
    html+='<div class="lm-category-tabs" role="tablist" aria-label="Life categories">'+M.categories.map(([k,t])=>'<button class="btn lm-day-button" id="lm-category-'+k+'" type="button" role="tab" aria-controls="lm-category-content" aria-selected="'+(key===k)+'" tabindex="'+(key===k?0:-1)+'" data-day="category" data-category="'+k+'">'+t+'</button>').join('')+'</div>';
    html+='<section id="lm-category-content" role="tabpanel" aria-labelledby="lm-category-'+key+'">'+(key==='food'?foodView():key==='work'?opsPicker():'')+panel(title+' tasks','<h2>Tasks & projects</h2>'+(tasks.length?tasks.map(p=>D.taskRow(p)).join(''):help('No open tasks in this category.')))+panel(title+' routines','<div class="lm-day-section-title"><h2>Recurring responsibilities</h2>'+button('+ Routine','area-routine','data-category="'+key+'"')+'</div>'+(chores.length?chores.map(c=>D.choreRow(c)).join(''):help('No routines recorded here yet. Add what actually needs repeating in your life.')))+'</section>';
    return html;
  }
  function planView(){
    const count=scheduled(ui.date).filter(M.open).length+opsPlanned().filter(t=>t.status!=='Done').length;
    let html=heading('Plan','Build around your day')+feature('plan','Your plan at a glance',M.validDate(ui.date)?fmtDay(ui.date):'Choose a day',count?count+' task'+(count===1?'':'s')+' scheduled':'Start with one task',help('Choose related tasks and routines from the parts of your day below.'),button('Add task','new-todo','',true)+button('View scheduled tasks','view-selected-day'));
    html+=panel('Build around your life','<h2>Choose a part of your day</h2>'+['Morning','Work','Home & evening'].map(group=>'<details class="lm-block-editor"><summary>'+group+'</summary><div class="lm-inline">'+(group==='Work'&&OPS?button('Operations Cadence','ops-picker'):'')+starters.map((row,i)=>row[0]===group?button(row[1],'related-tasks','data-index="'+i+'"'):'').join('')+'</div></details>').join(''));
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
    if(action==='capture')return W.captureSheet(ui.tab==='calendar'?ui.date:undefined,undefined,ui.tab==='projects'?areaName(ui.category):undefined);
    const id=el.dataset.id;
    if(action==='mandatory-toggle'){const c=S.chores.find(c=>c.id===id&&!c.archived),h=(S.choreHistory||[]).filter(h=>h.choreId===id&&h.date===todayISO()).at(-1);if(c?.repeat&&h)return commit(next=>{next.choreHistory=next.choreHistory.filter(x=>x.id!==h.id);next.chores.find(x=>x.id===id).nextDue=h.occurrence;},'Routine reopened');return D.choreAction(id,'done');}
    if(action==='back-projects'){ui.records=false;render();return;}
    if(action==='capture-date')return W.captureSheet(ui.date);
    if(action==='project-capture')return W.captureSheet(undefined,id);
    if(action==='project-dates'){const g=S.groups?.find(g=>g.id===id&&!g.archived);if(g){const r=K.projectRange(S,g);return W.openEditor('group',g,{startDate:g.startDate||r?.start||'',endDate:g.endDate||r?.end||''});}return;}
    if(action==='calendar-month'){ui.month=K.shiftMonth(ui.month,Number(el.dataset.step));ui.date=ui.month+'-01';render();app.querySelector('[data-day="calendar-month"][data-step="'+el.dataset.step+'"]')?.focus({preventScroll:true});return;}
    if(action==='calendar-today'){ui.month=todayISO().slice(0,7);ui.date=todayISO();ui.yearView=false;render();return;}
    if(action==='calendar-year'){ui.yearView=!ui.yearView;render();if(ui.yearView)app.querySelector('[aria-label="Next 12 months"]')?.scrollIntoView({block:'start'});else app.querySelector('[data-day="calendar-year"]')?.focus({preventScroll:true});return;}
    if(action==='calendar-pick-month'){ui.month=el.dataset.month;ui.date=ui.month===todayISO().slice(0,7)?todayISO():ui.month+'-01';ui.yearView=false;render();window.scrollTo?.({top:0,behavior:'instant'});return;}
    if(action==='calendar-day'){ui.date=el.dataset.date;render();app.querySelector('[aria-label="Selected day tasks"]')?.scrollIntoView({block:'start'});return;}
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

    if(action==='tab')return choose(el.dataset.tab,el.dataset.category,el.id==='lm-day-nav-'+el.dataset.tab);
    if(action==='category'){ui.category=el.dataset.category;ui.records=false;render();document.getElementById('lm-category-'+ui.category)?.focus({preventScroll:true});return;}
    if(action==='plan-today'){ui.date=todayISO();ui.month=ui.date.slice(0,7);ui.main=null;ui.block=null;recordUI();render();app.querySelector('[data-day="plan-today"]')?.focus({preventScroll:true});return;}
    if(action==='reset'){ui.reset=true;return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Ready to restart');}
    if(action==='reset-close'){ui.reset=false;render();return;}
    if(action==='change-focus')return commit(next=>editPlan(next,todayISO(),p=>{delete p.focus;}),'Focus cleared',()=>{ui.tab='plan';ui.date=todayISO();});
    if(action==='complete-task'){if(opsFind(id,ui.tab==='home'?todayISO():ui.date))return opsChange(()=>OPS.complete(id,ui.tab==='home'?todayISO():ui.date),'Ops task completed');return D.setStatus(id,'Done');}
    if(action==='focus')return commit(next=>editPlan(next,todayISO(),p=>{if(el.dataset.kind==='task'){const task=next.projects.find(t=>t.id===id&&M.open(t)&&t.status!=='Waiting');if(!task)throw Error('Choose an available task.');task.inbox=false;task.plan=todayISO();}p.focus={kind:el.dataset.kind,id};}),'Focus started',()=>{ui.tab='home';ui.reset=false;});
    if(action==='complete-routine')return D.choreAction(id,'done');
    if(action==='new-todo')return W.captureSheet(ui.date);
    if(action==='area-routine')return W.openEditor('chore',{chore:'',cad:'Daily',area:{food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents'}[el.dataset.category]});
    if(action==='records'){ui.tab='board';ui.records=true;render();window.scrollTo?.({top:0,behavior:'instant'});return;}
    if(action==='day-board'){ui.records=false;render();return;}
    if(action==='day-step'){ui.date=M.plus(M.validDate(ui.date)?ui.date:todayISO(),Number(el.dataset.step));ui.month=ui.date.slice(0,7);ui.target='';render();app.querySelector('[data-day="day-step"][data-step="'+el.dataset.step+'"]')?.focus({preventScroll:true});return;}
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
    if(action==='focus-filter'){const target=app.querySelector('#lm-day-field-areaFilter');target?.closest('.lm-feature')?.scrollIntoView({block:'start',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});target?.focus({preventScroll:true});return;}
    if(action==='search-all'){view.search=ui.q||'';W.openEditor('search');return;}
    if(action==='area-task'){const names={food:'Food System',household:'House — Interior',family:'Family & Baby',health:'Health & Fitness',work:'Work — Content',admin:'Life Admin & Documents'};W.openEditor('proj',{area:names[el.dataset.category],task:'',status:'Not started',pri:'Med',inbox:false});}
  }
  const draw=render;
  render=function(){
    if(ui.records){ui.tab='projects';}else ui.tab=normalizeTab(ui.tab);
    if(ui.tab==='calendar'&&!M.validDate(ui.month+'-01'))ui.month=todayISO().slice(0,7);
    const route='#'+ui.tab+(ui.tab==='calendar'?'?month='+ui.month+'&day='+ui.date:'');
    if(location.hash!==route)history.replaceState(null,'',location.pathname+location.search+route);
    draw();
    const captureLaunch=app.querySelector('#lm-capture-launch');if(captureLaunch)captureLaunch.hidden=!!view.editor||!ui.records;
    const capture=app.querySelector('.lm-capture');if(capture)capture.hidden=!ui.records;
    const children=[...app.children],records=document.createElement('div');records.id='lm-day-records';records.className='lm-day-records';
    for(const node of children)if(!node.matches('.appbar,.lm-capture,.lm-save-feedback,dialog,.lm-fab,.lm-tools'))records.append(node);
    const main=document.createElement('section');main.id='lm-day-view-'+ui.tab;main.className='lm-day-view';main.setAttribute('role','tabpanel');main.setAttribute('aria-labelledby','lm-day-nav-'+ui.tab);
    main.innerHTML=(ui.tab==='home'?homeView():ui.tab==='projects'?(ui.records?feature('board','Your full record','Projects, tasks & routines','All records',help('Your complete Life Map record and management tools.'),button('Back to projects','back-projects')+'<button type="button" class="btn lm-day-button" data-lm="search" aria-label="Search all Life Map">Search</button>')+'<div data-full-record-anchor></div>':projectsView()):calendarView())+(ui.error?'<p class="lm-error" role="alert">'+esc(ui.error)+'</p>':'');
    main.querySelector('.lm-feature h2')?.setAttribute('aria-level','1');
    const anchor=app.querySelector('.lm-save-feedback')||app.querySelector('.lm-capture')||app.querySelector('.appbar');anchor?.after(main);
    const slot=main.querySelector('[data-full-record-anchor]');if(slot)slot.replaceWith(records);else {records.hidden=true;main.append(records);}
    if(ui.records&&capture)main.querySelector('.lm-feature')?.after(capture);
    if(!window.AtlasConnected)window.AtlasDaily?.mount();
    for(const key of ['home','projects','calendar'])if(key!==ui.tab){const pane=document.createElement('section');pane.id='lm-day-view-'+key;pane.hidden=true;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','lm-day-nav-'+key);app.append(pane);}
    const icons={home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',projects:'M3 6h7l2 2h9v12H3z M3 6V4h7l2 2',calendar:'M4 5h16v16H4z M8 3v4m8-4v4M4 10h16m-12 4h3m2 0h3m-8 3h3'};
    const nav=document.createElement('nav');nav.className='lm-day-dock';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Life Map views');
    nav.innerHTML=[['home','Home'],['projects','Projects'],['calendar','Calendar']].map(([key,title])=>'<button type="button" class="btn" id="lm-day-nav-'+key+'" role="tab" aria-selected="'+(ui.tab===key)+'" aria-controls="lm-day-view-'+key+'" tabindex="'+(ui.tab===key?0:-1)+'" data-day="tab" data-tab="'+key+'"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+icons[key]+'"/></svg><strong>'+title+'</strong></button>').join('');app.append(nav);window.CoreAppFinish?.layoutOpening?.();
    W.busy&&app.querySelectorAll('[data-day]').forEach(el=>el.disabled=true);
  };
  document.addEventListener('click',event=>{const el=event.target.closest?.('[data-lm="inbox"]');if(el){ui.tab='board';ui.records=true;}},true);
  app.addEventListener('click',event=>{const el=event.target.closest?.('[data-day]');if(!el)return;event.stopImmediatePropagation();if(W.busy)return;try{const result=handle(el.dataset.day,el);if(result?.catch)result.catch(e=>{ui.error=e.message;render();});}catch(e){ui.error=e.message;render();}},true);
  app.addEventListener('input',event=>{
    const el=event.target.closest?.('[data-day-field]');if(!el)return;const [scope,key]=el.dataset.dayField.split('.');
    if(scope==='food'){ui.food??=clone(S.mealCoverage||{start:todayISO(),dinners:5,note:'',reminderTime:'09:00',skipDates:[]});ui.food[key]=el.value;const f=M.mealStatus({...ui.food,dinners:Number(ui.food.dinners),skipDates:String(ui.food.skipText??(ui.food.skipDates||[]).join(', ')).split(',').map(x=>x.trim()).filter(Boolean)},todayISO());const preview=document.getElementById('lm-meal-preview');if(preview)preview.textContent=f.set?'Covered through '+fmtDay(f.last)+' · remind '+fmtDay(f.remind):'Choose a valid first date and dinner count.';}
    else if(scope==='block'){ui.block??={title:'',start:'09:00',minutes:30,category:'work',taskId:''};ui.block[key]=el.value;}
    else ui[scope]=el.value;
    if(scope==='q'){refreshProjectResults();return;}
    recordUI();
  });
  app.addEventListener('change',event=>{const key=event.target.dataset?.dayField;if(key==='areaFilter'){ui.category=event.target.value;render();}else if(key==='date'){if(M.validDate(ui.date)){ui.month=ui.date.slice(0,7);ui.main=null;ui.block=null;ui.opsPicks.clear();recordUI();render();}}else if(key==='available'||key==='opsCadence'||key==='taskFilter')render();if(event.target.dataset?.opsPick){const id=event.target.dataset.opsPick;if(event.target.checked)ui.opsPicks.add(id);else ui.opsPicks.delete(id);const btn=app.querySelector('[data-day="ops-add"]');if(btn){btn.disabled=!ui.opsPicks.size;btn.textContent='Add selected to day'+(ui.opsPicks.size?' · '+ui.opsPicks.size:'');}}});
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
  window.LifeMapDay=Object.freeze({choose,showRecords:()=>{ui.tab='projects';ui.records=true;render();},get view(){return ui.tab;},get category(){return ui.category;}});
})();
