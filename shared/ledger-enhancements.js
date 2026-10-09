/* Ongoing goals, lasting progress and durable daily entries for Life Ledger. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='life-ledger')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ledger-enhancements.css?v=e197a7bdb92e',source).href;document.head.append(css);
  function ready(){
    if(window.LedgerDays||typeof state==='undefined')return;
    // Requested on September 7 in Winnipeg. This is a fixed date, never a rolling tomorrow.
    const DEFAULT_SEASON={start:'2026-09-08',end:'2026-12-31'};
    const SEASONKEY='lifeledger:season:v1',DRAFTKEY='lifeledger:drafts:v1';
    const keys={days:KEY,goals:GOALKEY,model:MODELKEY,metrics:METRICKEY,season:SEASONKEY,drafts:DRAFTKEY};
    const clone=v=>JSON.parse(JSON.stringify(v)),plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const validDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const make=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;return el;};
    const button=(text,fn)=>{const b=make('button',text,'ledger-button');b.type='button';b.addEventListener('click',fn);return b;};
    const pretty=date=>new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
    function safeKeys(o){if(o&&typeof o==='object')for(const k of Object.keys(o)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Invalid record key.');safeKeys(o[k]);}}
    const guardrails={'':'Choose one for today',feeds:'No YouTube / Instagram feeds today',work:'Phone out of reach during work blocks',evening:'Phone charges out of reach this evening'};
    const triggers={'':'Optional: what pulled you in?',bored:'Boredom',stress:'Stress',avoid:'Avoiding a task',habit:'Opened it automatically'};
    const resets={task:'Phone away · 10 minutes on my next task',read:'Phone away · read for 10 minutes',walk:'Phone away · walk Hudson for 10 minutes'};
    const emptyScreen=()=>({guardrail:'',slips:[]});
    const hasScreen=s=>!!s&&(!!s.guardrail||s.slips.length>0);
    const R=window.LedgerRhythm;
    if(!R)return;
    const DEFAULT_LEISURE={habits:1,gaming:60,reading:20};
    const emptyLeisure=()=>({gamingMinutes:0,readingDone:false});
    const hasLeisure=l=>!!l&&(l.gamingMinutes>0||l.readingDone||l.screenMinutes>0||l.screenConfirmed);
    function validLeisureRule(r){
      if(!plain(r)||!Number.isInteger(r.habits)||r.habits<1||r.habits>100||!Number.isInteger(r.gaming)||r.gaming<1||r.gaming>60||!Number.isInteger(r.reading)||r.reading<1||r.reading>120)throw Error('Use 1–100 habits, 1–60 gaming minutes and 1–120 reading minutes.');
    }
    function validLeisure(l){if(!plain(l)||!finite(l.gamingMinutes)||l.gamingMinutes>1440||typeof l.readingDone!=='boolean'||l.screenMinutes!==undefined&&(!finite(l.screenMinutes)||l.screenMinutes>1440)||l.screenConfirmed!==undefined&&(typeof l.screenConfirmed!=='boolean'||l.screenConfirmed&&!finite(l.screenMinutes)))throw Error('Invalid screen-time entry.');}
    function validScreen(s){
      if(!plain(s)||!Object.hasOwn(guardrails,s.guardrail)||!Array.isArray(s.slips)||s.slips.length>100||s.slips.some(v=>!plain(v)||!Object.hasOwn(triggers,v.trigger)||!Object.hasOwn(resets,v.action)||typeof v.recovered!=='boolean'))throw Error('Invalid Screen Discipline entry.');
    }
    function validEntry(d){if(!plain(d)||!plain(d.units)||Object.values(d.units).some(v=>!finite(v))||d.note!==undefined&&typeof d.note!=='string'||d.mood!==undefined&&(!Number.isInteger(d.mood)||d.mood<0||d.mood>5))throw Error('A daily entry is invalid.');if(d.missed!==undefined&&(!Array.isArray(d.missed)||d.missed.length>100||d.missed.some(h=>typeof h!=='string')||new Set(d.missed).size!==d.missed.length))throw Error('Invalid missed check-ins.');if(d.screen!==undefined)validScreen(d.screen);if(d.leisure!==undefined)validLeisure(d.leisure);}
    function validate(field,value){
      safeKeys(value);
      if(field==='days'){
        if(!Array.isArray(value)||value.length>10000)throw Error('Choose a list of saved days.');
        for(const d of value){validEntry(d);if(d.date!==undefined&&d.date!==null&&!validDate(d.date))throw Error('A saved date is invalid.');}
        const dates=value.filter(d=>d.date).map(d=>d.date);if(new Set(dates).size!==dates.length)throw Error('The backup repeats a date.');
      }else if(field==='goals'){if(!plain(value)||Object.values(value).some(v=>!finite(v)||v===0))throw Error('A saved goal is invalid.');}
      else if(field==='model'){
        if(!plain(value))throw Error('Invalid habit settings.');
        for(const k of ['renames','moves','crit'])if(value[k]!==undefined&&(!plain(value[k])||Object.values(value[k]).some(v=>typeof v!=='string')))throw Error('Invalid habit settings.');
        if(value.hidden!==undefined&&(!plain(value.hidden)||Object.values(value.hidden).some(v=>typeof v!=='boolean')))throw Error('Invalid hidden habits.');
        if(value.added!==undefined&&(!Array.isArray(value.added)||value.added.some(h=>!plain(h)||typeof h.key!=='string'||!h.key||['label','unit','noun','outcome','crit','pillar','kind'].some(k=>h[k]!==undefined&&typeof h[k]!=='string')||['step','def','goal','chunk'].some(k=>h[k]!==undefined&&(!finite(h[k])||h[k]===0)))))throw Error('Invalid custom habits.');
      }else if(field==='metrics'){
        if(!Array.isArray(value)||value.some(m=>!plain(m)||typeof m.id!=='string'||typeof m.name!=='string'||typeof m.unit!=='string'||m.target!=null&&(typeof m.target!=='number'||!Number.isFinite(m.target))||!Array.isArray(m.readings)||m.readings.some(r=>!plain(r)||!validDate(r.date)||typeof r.value!=='number'||!Number.isFinite(r.value))))throw Error('Invalid saved measurements.');
      }else if(field==='season'){if(!plain(value)||!validDate(value.start)||!validDate(value.end)||value.start>value.end||isoToNum(value.end)-isoToNum(value.start)>731*86400000)throw Error('Choose a season end on or after its start, within two years.');}
      else if(field==='drafts'){
        if(!plain(value)||!plain(value.days)||!validDate(value.selected)||!['cards','list'].includes(value.mode))throw Error('Invalid unfinished entries.');
        if(value.archives!==undefined){
          if(!Array.isArray(value.archives)||value.archives.length>100)throw Error('Invalid progress archive.');
          for(const a of value.archives){
            if(!plain(a)||typeof a.id!=='string'||!a.id||a.id.length>120||typeof a.createdAt!=='string'||!Number.isFinite(Date.parse(a.createdAt))||!plain(a.drafts)||a.drafts.archives!==undefined||a.drafts.resetPending!==undefined)throw Error('Invalid progress archive.');
            validate('days',a.days);validate('drafts',a.drafts);
          }
          if(new Set(value.archives.map(a=>a.id)).size!==value.archives.length)throw Error('Repeated progress archive.');
        }
        if(value.resetPending!==undefined&&(typeof value.resetPending!=='string'||!value.archives?.some(a=>a.id===value.resetPending)))throw Error('Invalid pending progress reset.');
        if(value.rhythm!==undefined)R.validate(value.rhythm);
        if(value.leisureRule!==undefined)validLeisureRule(value.leisureRule);
        if(value.leisureTimer!==undefined&&(!plain(value.leisureTimer)||!finite(value.leisureTimer.startedAt)||value.leisureTimer.startedAt===0))throw Error('Invalid leisure timer.');
        for(const [date,d]of Object.entries(value.days)){if(!validDate(date))throw Error('Invalid draft date.');validEntry(d);}
      }
      return value;
    }
    let season=clone(DEFAULT_SEASON),drafts={days:{},selected:todayISO(),mode:'cards'},blocked=false,busy=false,importTicket=0,historyLimit=7,historyOpen=false,lastUndo=null;
    let dashboardView='today',leisureOpen=false,screenOpen=false,remainingOnly=false,resetOpen=false;
    const failed=new Map(),pending=new Map(),boot=window.AtlasLedgerBoot||{raw:{},readError:false};
    try{
      if(boot.readError&&!window.storage)throw Error();
      for(const [field,key]of Object.entries(keys))if(boot.raw[key]!=null)validate(field,JSON.parse(boot.raw[key]));
      if(boot.raw[SEASONKEY])season=JSON.parse(boot.raw[SEASONKEY]);
      if(boot.raw[DRAFTKEY])drafts=JSON.parse(boot.raw[DRAFTKEY]);
    }catch{blocked=true;state.days=[];state.goals={};state.metrics=[];userModel={renames:{},moves:{},hidden:{},added:[],crit:{}};rebuildModel();}
    if(drafts.resetPending)state.days=[];
    SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);
    const observed=new Map(Object.values(keys).map(key=>[key,boot.raw[key]??null])),written=new Map(),conflicts=new Set();
    const notice=make('section',null,'ledger-notice');notice.id='ledger-notice';notice.setAttribute('aria-live','polite');notice.setAttribute('role','status');
    const message=make('p'),review=button('Review latest',()=>confirmAction('Load the latest record?','Another window has newer changes. Export your current work first if you want to keep this draft, then reload to review the saved version.','Reload latest',()=>location.reload()));review.hidden=true;
    notice.append(message,button('Retry saving',retry),button('Back up current work',()=>exportData()),review,button('Restore backup',pickImport));document.body.append(notice);
    function status(){notice.hidden=!blocked&&!failed.size&&!conflicts.size;review.hidden=!conflicts.size;message.textContent=blocked?'Saved records could not be read. Keep a recovery backup, then restore a valid Life Ledger backup.':conflicts.size?'Another window has newer changes. Your current work is kept in this tab. Back it up, then review the latest record.':'Your latest changes are in this tab but could not be saved. Retry or back up before closing.';app.inert=blocked||busy;const label=document.getElementById('ledger-draft-status');if(label)label.textContent=failed.size||conflicts.size?'Changes need saving':busy||pending.size?'Storing draft…':dirty()?'Draft stored · Save to earn XP':dayEntryFor(state.logDate)?'Progress saved':'New day';}
    function reconcile(key,value,latest,replace){
      const base=observed.get(key)??null;
      if(latest===base||latest===value)return value;
      if(replace)throw Error('Another window changed this record.');
      const field=Object.keys(keys).find(field=>keys[field]===key),fallback=field==='days'?[]:{},mine=JSON.parse(value),old=base===null?fallback:JSON.parse(base),remote=latest===null?fallback:validate(field,JSON.parse(latest));
      if(field==='drafts'&&R.stable(remote.days?.[state.logDate])!==R.stable(old.days?.[state.logDate])&&R.stable(mine.days?.[state.logDate])!==R.stable(remote.days?.[state.logDate]))throw Error('Another window changed this draft.');
      const merged=field==='days'?R.mergeDays(old,mine,remote):R.merge(old,mine,remote,field);
      validate(field,merged);return JSON.stringify(merged);
    }
    function accepted(key,value){observed.set(key,value);written.set(key,value);failed.delete(key);conflicts.delete(key);if(key===DRAFTKEY)drafts=JSON.parse(value);if(key===GOALKEY)state.goals=JSON.parse(value);if(key===METRICKEY)state.metrics=JSON.parse(value);if(key===MODELKEY){userModel=JSON.parse(value);rebuildModel();}}
    function write(key,value,replace=false){
      if(blocked){status();return false;}
      if(value===observed.get(key)&&!failed.has(key)&&!pending.has(key)){written.set(key,value);return true;}
      if(window.storage?.get&&window.storage?.set){const job=(pending.get(key)||Promise.resolve()).then(async()=>{try{let next;try{next=reconcile(key,value,(await window.storage.get(key))?.value??null,replace);}catch(err){conflicts.add(key);throw err;}await window.storage.set(key,next);if((await window.storage.get(key))?.value!==next)throw Error();accepted(key,next);return true;}catch{failed.set(key,value);return false;}finally{if(pending.get(key)===job)pending.delete(key);status();}});pending.set(key,job);status();return job;}
      const persist=()=>{try{let next;try{next=reconcile(key,value,localStorage.getItem(key),replace);}catch(err){conflicts.add(key);throw err;}localStorage.setItem(key,next);if(localStorage.getItem(key)!==next)throw Error();accepted(key,next);status();return true;}catch{failed.set(key,value);status();return false;}};
      // Serialize read/merge/write across browser tabs when Web Locks is available.
      if(navigator.locks?.request){const job=(pending.get(key)||Promise.resolve()).then(()=>navigator.locks.request('life-ledger:'+key,persist)).finally(()=>{if(pending.get(key)===job)pending.delete(key);status();});pending.set(key,job);status();return job;}
      return persist();
    }
    store.set=write;
    async function retry(){if(blocked||busy)return;for(const [key,value]of [...failed])await write(key,value);if(drafts.resetPending)await finishProgressReset();status();}
    function currentEntry(){return {units:clone(state.draft),missed:clone(state.draftMissed||[]),mood:state.draftMood||0,note:state.draftNote||'',...(hasScreen(state.draftScreen)?{screen:clone(state.draftScreen)}:{}),...(hasLeisure(state.draftLeisure)?{leisure:clone(state.draftLeisure)}:{})};}
    function dirty(){const saved=dayEntryFor(state.logDate);return HABITS.some(h=>(saved?.units?.[h]||0)!==(state.draft[h]||0))||(saved?.mood||0)!==(state.draftMood||0)||(saved?.note||'')!==(state.draftNote||'')||JSON.stringify(saved?.missed||[])!==JSON.stringify(state.draftMissed||[])||JSON.stringify(saved?.screen||emptyScreen())!==JSON.stringify(state.draftScreen||emptyScreen())||JSON.stringify(saved?.leisure||emptyLeisure())!==JSON.stringify(state.draftLeisure||emptyLeisure());}
    function remember(){if(blocked||busy||!validDate(state.draftFor))return;if(dirty())drafts.days[state.draftFor]=currentEntry();else delete drafts.days[state.draftFor];drafts.selected=state.draftFor;drafts.mode=state.logMode;write(DRAFTKEY,JSON.stringify(drafts));}
    const originalLoad=loadDraftFor;
    loadDraftFor=function(date){originalLoad(date);const d=drafts.days[date];if(d){state.draft={...freshDraft(),...clone(d.units)};state.draftMood=d.mood||0;state.draftNote=d.note||'';}state.draftMissed=clone((d||dayEntryFor(date))?.missed||[]);state.draftScreen=clone((d||dayEntryFor(date))?.screen||emptyScreen());state.draftLeisure=clone((d||dayEntryFor(date))?.leisure||emptyLeisure());};
    let seenToday=todayISO();
    state.logMode=drafts.mode;state.logDate=seenToday;loadDraftFor(state.logDate);
    function selectDate(date){if(blocked||busy||!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return false;}remember();dashboardView='today';state.logDate=date;loadDraftFor(date);drafts.selected=date;write(DRAFTKEY,JSON.stringify(drafts));state.cardIndex=0;render();document.getElementById('ledger-view-today')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return true;}
    // Keep storage bytes and archived settings; adapt old quantity habits in memory.
    const tapDays=['Run / Work Out','YouTube Strategy','LinkedIn Strategy','Household Chore','Walk Hud'];
    for(const h of tapDays)if(DEFAULT_HCFG[h])Object.assign(DEFAULT_HCFG[h],{kind:'count',unit:'days',step:1,def:1});
    const dayDefinitions={
      'Run / Work Out':{chunk:5,noun:'training week',outcome:'Completed training days',crit:'A completed workout in The Forge counts once for the day, regardless of the number of sessions or exercises.'},
      'YouTube Strategy':{chunk:5,noun:'YouTube week',outcome:'Days advancing your YouTube strategy',crit:'Count one day when you meaningfully advance a video: scripting, filming, editing or publishing. Several pieces in one day still count as one check-in.'},
      'Household Chore':{chunk:5,noun:'household week',outcome:'Days caring for your home',crit:'At least one meaningful household chore or home-maintenance task. Count the day once.'},
      'Walk Hud':{chunk:5,noun:'week walking Hudson',outcome:'Days walking Hudson',crit:'A purposeful walk with Hudson. Count the day once; distance does not affect this check-in.'}
    };
    for(const [h,definition]of Object.entries(dayDefinitions))if(DEFAULT_HCFG[h])Object.assign(DEFAULT_HCFG[h],definition);
    for(const [h,goal]of Object.entries({'Run / Work Out':60,'YouTube Strategy':75,'LinkedIn Strategy':75,'Household Chore':75,'Walk Hud':75}))if(DEFAULT_HCFG[h])DEFAULT_HCFG[h].goal=goal;
    if(DEFAULT_HCFG['Screen Discipline'])Object.assign(DEFAULT_HCFG['Screen Discipline'],{crit:'Keep scrolling and video games combined under 60 minutes for the day. Work, content creation and purposeful reading are excluded. Confirm your total in Screen Time, or tap the outcome when you know you stayed under.',outcome:'Days with scrolling and gaming combined under one hour'});
    rebuildModel();
    if(HCFG['Screen Discipline']){HCFG['Screen Discipline'].crit=DEFAULT_HCFG['Screen Discipline'].crit;SHORT['Screen Discipline']='Screen time under 1 hour';}
    const preferences=()=>drafts.rhythm||{};
    const focusHabits=()=>R.focus(HABITS,preferences());
    const normalizedDays=allDays=>(allDays||[]).map(d=>({...d,units:Object.fromEntries(Object.entries(d.units||{}).map(([h,v])=>[h,R.value(d,h,HCFG[h]||DEFAULT_HCFG[h])]))}));
    compute=function(allDays,goals){
      const today=todayISO(),all=normalizedDays(allDays),days=all.filter(d=>!d.date||validDate(d.date)&&d.date<=today).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((d,i)=>({...d,day:i+1}));
      const habit={},allKeys=[...new Set([...Object.keys(HCFG),...Object.keys(DEFAULT_HCFG)])];
      for(const h of allKeys){const c=HCFG[h]||DEFAULT_HCFG[h],g=goals?.[h]>0?goals[h]:c.goal,total=R.total(all,h,c,preferences(),today),progress=R.experience(total,c,h),dm={};
        days.forEach(d=>{if(d.date&&R.value(d,h,c)>0)dm[d.date]=1;});
        habit[h]={key:h,cfg:c,goal:g,total,doneDays:Object.keys(dm).length,...progress,pctTo99:Math.min(1,progress.level/99),onPace:true,chunksDone:Math.floor(total/c.chunk),goalChunks:Math.round(g/c.chunk),streak:streaksFrom(dm).current};}
      const scoreKeys=allKeys.filter(h=>h!==R.REMOVED),pillarFor=h=>userModel.moves?.[h]||(userModel.added||[]).find(a=>a.key===h)?.pillar||DEFAULT_PILLARS.find(p=>p.habits.includes(h))?.key||PILLARS[0]?.key;
      const pillars=PILLARS.map(p=>{const earnedHabits=scoreKeys.filter(h=>pillarFor(h)===p.key),progress=R.levelProgress(earnedHabits.reduce((sum,h)=>sum+habit[h].xp,0),earnedHabits.reduce((sum,h)=>sum+R.annualCost(h),0));return {...p,...progress,pctTo99:Math.min(1,progress.level/99),onPace:true,proj:null};});
      const life={...R.levelProgress(scoreKeys.reduce((sum,h)=>sum+habit[h].xp,0),R.lifeCost),onPace:true,proj:null};
      const sorted=pillars.slice().sort((a,b)=>b.exact-a.exact),balanced=!sorted.length||sorted[0].exact-sorted.at(-1).exact<=6;
      const history=days.map(d=>({day:d.day,done:HABITS.filter(h=>R.value(d,h,HCFG[h])>0).length,life:0}));
      const dm=dateMap(days.filter(d=>d.date));for(const d of days)if(d.date)dm[d.date]=Math.max(1,dm[d.date]||0);const streak=streaksFrom(dm),dates=Object.keys(dm).filter(k=>dm[k]>0),bestDay={count:0,date:null};dates.forEach(date=>{if(dm[date]>bestDay.count)Object.assign(bestDay,{count:dm[date],date});});
      return {habit,pillars,life,identity:'Your lifetime levels',balanced,history,days,consistency:0,active:streak.current,expectedLevel:0,daysLeft:0,elapsed:0,canForecast:false,lead:sorted[0],dateMap:dm,streak,bestDay,activeDays:dates.length};
    };
    // Lifetime XP is derived from saved records. Recorded achievements stay claimed.
    const meaningful=day=>Object.values(day.units).some(v=>v>0)||!!day.mood||!!day.note?.trim();
    const earnedDays=d=>d.days.filter(meaningful);
    function revise(name,desc,test){const a=ACHV.find(a=>a.name===name);if(a){a.desc=desc;a.test=test;}}
    for(const [name,count]of [['Season Opens',1],['Locked In',7],['Habit Formed',30],['Centurion',100]])revise(name,'Save '+(count===1?'your first day':count+' days')+' with a check-in or reflection',d=>earnedDays(d).length>=count);
    revise('Streak Keeper','Reach a 7-day active streak',d=>d.streak.longest>=7);
    revise('Perfect Day','Log every enabled habit in a day',d=>HABITS.length>0&&d.days.some(day=>HABITS.every(h=>day.units[h]>0)));
    revise('Ahead of Pace','Build progress on three different days; no deadline',d=>earnedDays(d).length>=3);
    revise('Five for Five','Record progress across all five values',d=>d.pillars.length===5&&d.pillars.every(p=>p.habits.length>0&&p.exact>0));
    revise('Renaissance Soul','Every value at Level 10+',d=>d.pillars.length>0&&d.pillars.every(p=>p.habits.length>0&&p.level>=10));
    revise('In Balance','All values within 6 levels (Level 10+)',d=>d.pillars.length>0&&d.pillars.every(p=>p.habits.length>0&&p.level>=10)&&Math.max(...d.pillars.map(p=>p.level))-Math.min(...d.pillars.map(p=>p.level))<=6);
    // The old book description promised 250 pages even when a book's configured size differed.
    revise('First Book','Complete one reading milestone',d=>(d.habit.Read?.chunksDone||0)>=1);
    const additions=[
      {cat:'Consistency',name:'Finding Your Rhythm',desc:'Save three days with a check-in or reflection; no streak required',icon:'\u2736',test:d=>earnedDays(d).length>=3},
      {cat:'Milestones',name:'First Reflection',desc:'Save your first daily note',icon:'\u270e',test:d=>d.days.some(day=>!!day.note?.trim())},
      {cat:'Milestones',name:'Pages of Your Own',desc:'Save a daily note on seven different dates',icon:'\u25a4',test:d=>d.days.filter(day=>!!day.note?.trim()).length>=7},
      ...PILLARS.map(p=>({cat:'Milestones',name:p.title+': First Step',desc:'Record progress in '+p.title,icon:'\u2727',test:d=>d.pillars.some(value=>value.key===p.key&&value.exact>0)}))
    ];
    for(const a of additions)if(!ACHV.some(old=>old.name===a.name))ACHV.push(a);
    for(const [name,count]of [['Rainmaker',10],['Pipeline Full',30],['Momentum',50],['Relentless',70]])revise(name,'Archived LinkedIn achievement · '+count+' completed days',d=>(d.habit['LinkedIn Strategy']?.total||0)>=count);
    revise('On the Record','Complete 10 YouTube strategy days',d=>(d.habit['YouTube Strategy']?.total||0)>=10);
    revise('Content Engine','Complete 40 YouTube strategy days',d=>(d.habit['YouTube Strategy']?.total||0)>=40);
    revise('With Hudson','Walk Hudson on 25 days',d=>(d.habit['Walk Hud']?.total||0)>=25);
    // Recorded awards survive a smaller week, goal changes, and passage of time.
    for(const a of ACHV){const test=a.test;a.test=d=>preferences().earned?.includes(a.name)||test(d);}
    let saveFeedback='';
    function clearCelebrations(){state.levelInfo=null;state.achvQueue=[];state.achvReview=false;}
    function celebrate(before,after,date){
      clearCelebrations();
      state.achvQueue=ACHV.filter(a=>a.test(after)&&!a.test(before));
      const lifeUp=after.life.level>before.life.level,valueUp=after.pillars.find(p=>p.level>(before.pillars.find(old=>old.key===p.key)?.level||0)),habitUp=HABITS.find(h=>after.habit[h].level>before.habit[h].level);
      if(lifeUp||valueUp||habitUp){
        const progress=lifeUp?after.life:valueUp||after.habit[habitUp],name=lifeUp?'Life':valueUp?valueUp.title:label(habitUp);
        state.levelInfo={kicker:'Level Up',title:name+' · Level '+progress.level,detail:fmt(progress.xp)+' XP earned from saved activity. Your progress carries forward.'};
      }else if(!state.achvQueue.length){
        const key=HABITS.find(k=>after.habit[k].chunksDone>before.habit[k].chunksDone);
        if(key){const h=after.habit[key];state.levelInfo={kicker:'Outcome Reached',title:h.chunksDone+' '+plural(h.cfg.noun,h.chunksDone),detail:label(key)+' · '+fmt(h.total)+' '+h.cfg.unit+' recorded overall.'};}
      }
      saveFeedback='Saved '+pretty(date)+' · '+(HABITS.some(h=>after.habit[h].total>before.habit[h].total)?'Your progress is recorded.':'Your record is up to date.');
      if(after.life.xp>before.life.xp)saveFeedback+=' · +'+fmt(after.life.xp-before.life.xp)+' XP';
      if(state.achvQueue.length)saveFeedback+=' · '+state.achvQueue.length+' new achievement'+(state.achvQueue.length===1?'':'s');
    }
    // Keep the original cards and constellation, but show the progress that whole levels hid.
    function confirmAction(title,body,label,fn){const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-confirm-title');const heading=make('h2',title);heading.id='ledger-confirm-title';const actions=make('div',null,'ledger-actions');actions.append(button('Cancel',()=>dialog.close()),button(label,async()=>{dialog.close();await fn();}));dialog.append(heading,make('p',body),actions);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
    async function saveDay(force=false){
      if(blocked||busy)return;if(drafts.resetPending&&!await finishProgressReset())return;const date=state.logDate;if(!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return;}
      if(Object.values(state.draft).some(v=>!finite(v))){toast('Use a valid, non-negative number for each entry.');return;}
      if((state.draft.Sleep||0)>24||(state.draft['Board Work']||0)>1440){toast('Use at most 24 sleep hours or 1,440 board-work minutes in one day.');return;}
      checkpointLeisureTimer(false);
      if(!HABITS.some(h=>state.draft[h]>0)&&!state.draftMood&&!state.draftNote.trim()&&!hasScreen(state.draftScreen)&&!hasLeisure(state.draftLeisure)&&!force){confirmAction('Save an empty day?','This records the date with no check-ins or note.','Save day',()=>saveDay(true));return;}
      remember();if(pending.has(DRAFTKEY))await pending.get(DRAFTKEY);if(conflicts.size){toast('Another window changed this record. Back up your draft, then review the latest version.');return;}
      const progressBefore=compute(state.days,state.goals),before=dayEntryFor(date),entry={...clone(before||{}),date,units:clone(before?.units||{})};
      for(const h of HABITS){delete entry.units[h];if(state.draft[h]>0)entry.units[h]=state.draft[h];}
      delete entry.mood;delete entry.note;if(state.draftMood)entry.mood=state.draftMood;if(state.draftNote.trim())entry.note=state.draftNote.trim();
      delete entry.screen;if(hasScreen(state.draftScreen))entry.screen=clone(state.draftScreen);
      delete entry.leisure;if(hasLeisure(state.draftLeisure))entry.leisure=clone(state.draftLeisure);
      entry.missed=clone((state.draftMissed||[]).filter(h=>!(entry.units[h]>0)));
      const next=state.days.filter(d=>d.date!==date).concat([entry]).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((d,i)=>({...d,day:i+1}));
      busy=true;status();const ok=await write(KEY,JSON.stringify(next));
      // A failed day save is retried explicitly with Save day, never as a stale queued snapshot.
      if(!ok){busy=false;failed.delete(KEY);failed.set(DRAFTKEY,JSON.stringify(drafts));status();toast('Day not logged. Your draft is still here. Retry saving, then use Save day.');return;}
      leisureOpen=false;state.days=JSON.parse(written.get(KEY));lastUndo={date,before:before?clone(before):null,after:JSON.stringify(dayEntryFor(date))};
      delete drafts.days[date];loadDraftFor(date);const after=compute(state.days,state.goals);celebrate(progressBefore,after,date);drafts.rhythm={...preferences(),earned:[...new Set([...(preferences().earned||[]),...ACHV.filter(a=>a.test(after)).map(a=>a.name)])]};await write(DRAFTKEY,JSON.stringify(drafts));busy=false;render();window.AtlasExperience?.complete(document.querySelector('[data-act="commit"]')||document.querySelector('.ledger-save-feedback'));toast('Saved '+pretty(date),'Undo',undoLast);
    }
    commit=saveDay;
    undoLast=async function(){if(!lastUndo||blocked||busy)return;const undo=lastUndo,current=dayEntryFor(undo.date);if(JSON.stringify(current)!==undo.after){toast('That day has changed. Open it to edit the latest entry.');return;}remember();const next=state.days.filter(d=>d.date!==undo.date);if(undo.before)next.push(undo.before);next.sort((a,b)=>(a.date||'').localeCompare(b.date||''));busy=true;status();const ok=await write(KEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(KEY);status();toast('Undo could not be saved. Try Undo again.');return;}state.days=JSON.parse(written.get(KEY));lastUndo=null;clearCelebrations();saveFeedback='Last day save undone.';if(state.logDate===undo.date)loadDraftFor(undo.date);write(DRAFTKEY,JSON.stringify(drafts));render();toast('Last day save undone.');};
    // Save the archive and reset intent together before touching the active day key.
    // A reload can finish that intent after an interrupted or failed second write.
    async function finishProgressReset(){
      if(!drafts.resetPending||blocked||busy)return !drafts.resetPending;
      busy=true;status();
      try{
        const raw=window.storage?.get?(await window.storage.get(KEY))?.value??null:localStorage.getItem(KEY),latest=raw===null?[]:validate('days',JSON.parse(raw)),archive=drafts.archives.find(a=>a.id===drafts.resetPending);
        // Include edits from another window in the archive before clearing them.
        if(latest.length&&R.stable(latest)!==R.stable(archive.days)){const next=clone(drafts);next.archives.find(a=>a.id===next.resetPending).days=clone(latest);if(!await write(DRAFTKEY,JSON.stringify(next))){busy=false;status();return false;}}
        observed.set(KEY,raw);
      }catch{busy=false;status();toast('Latest history could not be read. Progress was not cleared.');return false;}
      const ok=await write(KEY,JSON.stringify(state.days),true);
      let finalized=false;
      if(ok){const next=clone(drafts);delete next.resetPending;finalized=await write(DRAFTKEY,JSON.stringify(next));if(finalized)drafts=next;}
      busy=false;status();return ok&&finalized;
    }
    async function resetProgress(){
      if(blocked||busy)return false;
      if(drafts.resetPending)return finishProgressReset();
      checkpointLeisureTimer(false);remember();await Promise.all([...pending.values()]);
      if(failed.size){toast('Save or back up your current work before resetting.');return false;}
      if((drafts.archives||[]).length>=100){toast('Keep a backup before starting another progress record.');return false;}
      const snapshot=clone(drafts);delete snapshot.archives;delete snapshot.resetPending;
      const id=new Date().toISOString()+'-'+crypto.randomUUID();
      const archive={id,createdAt:new Date().toISOString(),days:clone(state.days),drafts:snapshot};
      const rhythm=clone(preferences());delete rhythm.earned;delete rhythm.catchups;delete rhythm.weeks;
      for(const g of Object.values(rhythm.goals||{}))g.baseline=0;
      const next={days:{},selected:todayISO(),mode:'cards',rhythm,archives:[...(drafts.archives||[]),archive],resetPending:id};
      if(drafts.leisureRule)next.leisureRule=clone(drafts.leisureRule);
      validate('drafts',next);busy=true;status();const staged=await write(DRAFTKEY,JSON.stringify(next));busy=false;
      if(!staged){failed.delete(DRAFTKEY);status();toast('Progress was not reset. Your record is still here.');return false;}
      drafts=next;state.days=[];state.logDate=todayISO();state.logMode='cards';state.cardIndex=0;loadDraftFor(state.logDate);
      lastUndo=null;clearCelebrations();leisureOpen=screenOpen=resetOpen=false;dashboardView='today';saveFeedback='Progress reset · your previous record is archived.';
      const ok=await finishProgressReset();render();toast(ok?'Fresh start. Your previous record is in History.':'Fresh start saved. Retry saving to finish the reset.');return true;
    }
    function resetProgressDialog(){confirmAction('Reset progress?','Start Life Level, habit levels, values, achievements and weekly progress at zero. Your saved days and unfinished entries are kept in a recoverable archive in History. Your habits and goals stay.','Reset progress',resetProgress);}
    function progressArchives(){
      const panel=make('details',null,'ledger-history');panel.id='ledger-progress-archives';panel.append(make('summary','Previous progress · '+(drafts.archives||[]).length+' archives'));
      for(const a of [...(drafts.archives||[])].reverse()){
        const record=make('details');record.append(make('summary','Before '+new Date(a.createdAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})+' · '+a.days.length+' saved days'));
        for(const d of a.days){const row=make('p',d.date?pretty(d.date):'Undated entry','ledger-help');row.append(make('span',' · '+Object.entries(d.units).filter(([,n])=>n>0).map(([h,n])=>label(h)+': '+fmt(n)).join(' · ')));if(d.note)row.append(make('span',' · '+d.note));record.append(row);}
        record.append(button('Restore this progress',()=>{const restored={...clone(drafts),...clone(a.drafts),archives:clone(drafts.archives||[])};delete restored.resetPending;const data={...payload(),days:a.days,drafts:restored};importData({size:JSON.stringify(data).length,text:async()=>JSON.stringify(data)});}));panel.append(record);
      }
      return panel;
    }
    async function setSeason(next){validate('season',next);if(blocked||busy)return false;busy=true;status();const ok=await write(SEASONKEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(SEASONKEY);status();toast('Season date was not saved. Try again.');return false;}season=clone(next);SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);clearCelebrations();saveFeedback='';render();toast('Season starts '+pretty(season.start)+'. Earlier days are kept.');return true;}
    function seasonDialog(){const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-season-title');const heading=make('h2','Start a new season');heading.id='ledger-season-title';const form=make('form'),startLabel=make('label','Start date'),start=make('input'),endLabel=make('label','End date'),end=make('input'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');start.type=end.type='date';start.required=end.required=true;start.value=numToISO(isoToNum(todayISO())+86400000);end.value=season.end<start.value?start.value.slice(0,4)+'-12-31':season.end;startLabel.append(start);endLabel.append(end);const actions=make('div',null,'ledger-actions'),submit=make('button','Start season','ledger-button');submit.type='submit';actions.append(button('Cancel',()=>dialog.close()),submit);form.append(startLabel,endLabel,error,actions);form.addEventListener('submit',async e=>{e.preventDefault();try{validate('season',{start:start.value,end:end.value});submit.disabled=true;if(await setSeason({start:start.value,end:end.value}))dialog.close();else error.textContent='Could not save the season. Try again.';}catch(err){error.textContent=err.message;}finally{submit.disabled=false;}});dialog.append(heading,make('p','Earlier days stay in Saved days and your backup. Only dates within the new season count toward its totals.'),form);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
    function parseBackup(o){if(Array.isArray(o))o={days:o};if(!plain(o)||o.app!==undefined&&o.app!=='life-ledger'||o.version!==undefined&&![1,2,3].includes(o.version))throw Error('Choose a Life Ledger backup.');const out={};for(const field of Object.keys(keys))if(Object.hasOwn(o,field))out[field]=clone(validate(field,o[field]));if(!out.days)throw Error('No saved days in this file.');return out;}
    function payload(){return {app:'life-ledger',version:3,exportedAt:new Date().toISOString(),days:state.days,goals:state.goals,model:userModel,metrics:state.metrics,season,drafts};}
    exportData=function(){remember();const data=blocked?{app:'life-ledger-recovery',version:1,records:boot.raw}:payload();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=blocked?'life-ledger-original-records.json':'life-ledger-'+todayISO()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('Backup prepared. Save the file in Files or Downloads.');};
    importData=async function(file){if(busy)return;const ticket=++importTicket;try{if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const next=parseBackup(JSON.parse(await file.text()));if(ticket!==importTicket)return;confirmAction('Restore Life Ledger?',next.days.length+' saved days will replace this history. '+(next.drafts?'The backup also replaces unfinished drafts.':'Current unfinished drafts and season dates stay unless included in the backup.')+(blocked?' Keep a recovery backup before replacing unreadable records.':''),'Restore backup',async()=>{if(ticket!==importTicket||busy)return;const all={...clone(payload()),...next};blocked=false;busy=true;failed.clear();state.days=all.days;state.goals=all.goals;state.metrics=all.metrics;userModel=all.model;season=all.season;drafts=all.drafts;rebuildModel();SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);lastUndo=null;clearCelebrations();saveFeedback='';state.logMode=drafts.mode;state.logDate=drafts.selected<=todayISO()?drafts.selected:todayISO();loadDraftFor(state.logDate);for(const [field,key]of Object.entries(keys))await write(key,JSON.stringify(all[field]));busy=false;render();toast(failed.size?'Restored in this tab. Retry saving or keep a backup.':'Backup restored on this device.');});}catch(err){toast(err.message||'Could not read this backup.');}};
    function pickImport(){const input=make('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{if(input.files?.[0])importData(input.files[0]);});input.click();}
    function removeMetric(id){const removed=state.metrics.find(m=>m.id===id);if(!removed)return;confirmAction('Delete this metric?','This removes the metric and its readings from this device. An Undo action follows.','Delete metric',async()=>{const next=state.metrics.filter(m=>m.id!==id);busy=true;status();const ok=await write(METRICKEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(METRICKEY);status();toast('Metric was not deleted. Try again.');return;}state.metrics=next;render();toast('Metric deleted.','Undo',async()=>{if(state.metrics.some(m=>m.id===id)||busy)return;const restored=[...state.metrics,removed];busy=true;status();const saved=await write(METRICKEY,JSON.stringify(restored));busy=false;if(saved){state.metrics=restored;render();}else{failed.delete(METRICKEY);status();toast('Could not restore the metric. Keep a backup before closing.');}});});}
    // Optional daily notes share the existing draft/save/backup path. They never
    // change habit units or XP. No record is written merely by drawing this view.
    let screenInfoOpen=false,screenPatternsOpen=false;
    function screenPattern(end){
      const rows=[],reasons={};let guarded=0,slips=0,recovered=0,recorded=0;
      for(let i=6;i>=0;i--){
        const date=numToISO(isoToNum(end)-i*86400000);
        const s=(date===state.logDate?state.draftScreen:(drafts.days[date]||dayEntryFor(date))?.screen)||emptyScreen();
        if(hasScreen(s))recorded++;if(s.guardrail)guarded++;
        const done=s.slips.filter(v=>v.recovered).length;slips+=s.slips.length;recovered+=done;
        for(const v of s.slips)if(v.trigger)reasons[v.trigger]=(reasons[v.trigger]||0)+1;
        rows.push({date,guardrail:!!s.guardrail,slips:s.slips.length,recovered:done,recorded:hasScreen(s)});
      }
      const max=Math.max(0,...Object.values(reasons)),top=Object.keys(reasons).filter(k=>reasons[k]===max).map(k=>triggers[k]);
      return {rows,guarded,slips,recovered,recorded,top};
    }
    function beginScreenReset(){
      if(blocked||busy)return;
      if(state.logDate!==todayISO()){remember();state.logDate=todayISO();loadDraftFor(state.logDate);}
      const slips=state.draftScreen.slips;
      if(!slips.length||slips.at(-1).recovered){
        if(slips.length>=100){toast('Today’s slip log is full. Use your existing Screen Discipline controls.');return;}
        const prior=Object.keys({...Object.fromEntries(state.days.filter(d=>d.date).map(d=>[d.date,d])),...drafts.days}).filter(d=>d<=todayISO()).sort().reverse().map(d=>(drafts.days[d]||dayEntryFor(d))?.screen?.slips?.at(-1)).find(Boolean);
        slips.push({trigger:'',action:slips.at(-1)?.action||prior?.action||'task',recovered:false});remember();
      }
      leisureOpen=false;resetOpen=true;render();document.getElementById('screen-reset-action')?.focus();
    }
    function resetSheet(){
      if(!resetOpen)return;
      const date=state.logDate,last=state.draftScreen.slips.at(-1);
      if(date!==todayISO()||!last||last.recovered||state.levelInfo||state.achvQueue?.length){resetOpen=false;return;}
      const sheet=make('dialog',null,'ledger-dialog ledger-sheet');sheet.id='ledger-reset-sheet';sheet.setAttribute('aria-labelledby','screen-reset-title');
      const close=()=>{resetOpen=false;sheet.close();document.getElementById('ledger-quick-reset')?.focus();};
      const heading=make('h2','Take back the next 10 minutes');heading.id='screen-reset-title';
      sheet.append(heading,make('p','Close the feed. Put your phone out of reach. Choose one small action.','ledger-help'));
      const valid=()=>{if(blocked||busy)return false;if(state.logDate!==date||date!==todayISO()){resetOpen=false;checkDay();render();toast('A new day has started. Start a reset for today.');return false;}return true;};
      for(const [id,title,options,key]of [['screen-reset-action','My next action',resets,'action'],['screen-reset-trigger','What pulled me in? (optional)',triggers,'trigger']]){
        const label=make('label',title),select=make('select');select.id=id;
        for(const [value,text]of Object.entries(options)){const option=make('option',text);option.value=value;select.append(option);}select.value=last[key];
        select.addEventListener('change',()=>{if(valid()){last[key]=select.value;remember();}});label.append(select);sheet.append(label);
      }
      const done=button('I’m back',()=>{if(!valid())return;last.recovered=true;remember();resetOpen=false;render();toast('Reset recorded. Welcome back.');document.getElementById('ledger-quick-reset')?.focus();});done.id='screen-reset-done';done.classList.add('ledger-primary');
      sheet.append(done,button('Do this now · close',close),make('p','Your reset stays in your draft. Save day to log it.','ledger-help'));
      sheet.addEventListener('cancel',e=>{e.preventDefault();close();});app.append(sheet);sheet.showModal();
    }
    function screenPanel(){
      const date=state.logDate,s=state.draftScreen,last=s.slips.at(-1),today=date===todayISO();
      const panel=make('section',null,'ledger-screen');panel.id='ledger-screen';panel.setAttribute('aria-labelledby','ledger-screen-title');
      const header=make('div',null,'ledger-screen-heading'),title=make('h3','Screen Discipline');title.id='ledger-screen-title';
      const info=make('details',null,'ledger-progress-info'),infoToggle=make('summary','i');infoToggle.setAttribute('aria-label','About Screen Discipline');info.open=screenInfoOpen;info.addEventListener('toggle',()=>screenInfoOpen=info.open);
      info.append(infoToggle,make('p','Pick a practical boundary before you open a feed. If you drift, note it and protect the next 10 minutes. These manual notes stay on this device with your drafts and backups. Only your separate Under 1 Hour check-in counts toward that habit; a slip or reset never changes it.','ledger-help'));
      header.append(title,info);panel.append(header);
      function change(fn,focus){
        if(blocked||busy)return;
        if(date!==todayISO()||state.logDate!==date){checkDay();toast('The day changed. Use today’s Screen Discipline controls.');return;}
        fn();remember();render();document.getElementById(focus)?.focus({preventScroll:true});
      }
      function choose(id,text,options,value,fn){
        const label=make('label',text),select=make('select');select.id=id;
        for(const [key,text]of Object.entries(options)){const option=make('option',text);option.value=key;select.append(option);}select.value=value;
        select.addEventListener('change',()=>change(()=>fn(select.value),id));label.append(select);panel.append(label);
      }
      function action(id,text,fn,focus=id){const b=button(text,()=>change(fn,focus));b.id=id;panel.append(b);return b;}
      if(today){
        choose('screen-guardrail','Today’s guardrail',guardrails,s.guardrail,v=>s.guardrail=v);
        const caught=action('screen-slip','Caught myself scrolling',()=>{if(s.slips.length>=100)return;s.slips.push({trigger:'',action:'task',recovered:false});},'screen-recovery');
        caught.disabled=s.slips.length>=100;
        if(last){
          const feedback=make('p',last.recovered?'Reset recorded. Keep the next block intentional.':'Slip noted. Close the feed; protect the next block.','ledger-help');feedback.setAttribute('role','status');panel.append(feedback);
          if(!last.recovered){
            choose('screen-trigger','What pulled you in? (optional)',triggers,last.trigger,v=>last.trigger=v);
            choose('screen-action','Next 10 minutes',resets,last.action,v=>last.action=v);
            action('screen-recovery','I did this reset',()=>last.recovered=true,'screen-slip');
          }else action('screen-unrecover','Undo reset',()=>last.recovered=false,'screen-recovery');
          action('screen-undo','Undo last slip',()=>s.slips.pop(),'screen-slip');
        }
      }else{
        panel.append(make('p',pretty(date)+' · '+(s.guardrail?guardrails[s.guardrail]:'No guardrail recorded'),'ledger-help'));
        panel.append(button('Open today’s controls',()=>selectDate(todayISO())));
      }
      const count=(n,word)=>n+' '+word+(n===1?'':'s');
      const pattern=screenPattern(date),details=make('details',null,'ledger-screen-patterns');details.open=screenPatternsOpen;details.addEventListener('toggle',()=>screenPatternsOpen=details.open);
      details.append(make('summary','Last 7 days · '+count(pattern.slips,'slip')+' · '+count(pattern.recovered,'reset')));
      details.append(make('p',pattern.guarded+' / 7 days with a guardrail. '+pattern.recorded+' days with intervention notes.','ledger-help'));
      if(pattern.top.length)details.append(make('p','Most noted trigger: '+pattern.top.join(' / ')+'.','ledger-help'));
      const list=make('ul');for(const row of pattern.rows)list.append(make('li',fmtDay(row.date)+' · '+(row.recorded?(row.guardrail?'Guardrail · ':'')+count(row.slips,'slip')+' / '+count(row.recovered,'reset'):'No notes')));details.append(list);
      details.append(make('p','Manual notes, including drafts. No notes does not mean no scrolling.','ledger-help'));panel.append(details);
      return panel;
    }
    // Daily leisure is derived from saved check-ins, never an accumulating bank.
    let leisureInfoOpen=false,leisureHistoryOpen=false;
    const leisureRule=()=>DEFAULT_LEISURE;
    const leisureHabits=()=>HABITS.filter(h=>h!=='Screen Discipline');
    const leisureTarget=h=>HCFG[h].kind==='count'?1:(HCFG[h].def||1);
    const leisureCount=units=>leisureHabits().filter(h=>Number(units?.[h]||0)>=leisureTarget(h)).length;
    const localISO=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
    const timerEnd=()=>Math.min(Date.now(),(drafts.leisureTimer?.startedAt||Date.now())+86400000);
    function timerMinutes(date){
      if(!drafts.leisureTimer)return 0;
      const start=new Date(date+'T00:00:00'),end=new Date(start);end.setDate(end.getDate()+1);
      return Math.max(0,Math.min(timerEnd(),end.getTime())-Math.max(drafts.leisureTimer.startedAt,start.getTime()))/60000;
    }
    // Split a session at local midnight. Elapsed wall time survives suspension and
    // reload; saving mid-session checkpoints it exactly once before continuing.
    function checkpointLeisureTimer(stop){
      if(!drafts.leisureTimer)return;
      const end=timerEnd(),started=drafts.leisureTimer.startedAt;
      for(let cursor=started;cursor<end;){
        const date=localISO(new Date(cursor)),boundary=new Date(date+'T00:00:00');boundary.setDate(boundary.getDate()+1);
        const until=Math.min(end,boundary.getTime()),entry=date===state.logDate?currentEntry():clone(drafts.days[date]||dayEntryFor(date)||{units:{}});
        entry.leisure={...emptyLeisure(),...entry.leisure};entry.leisure.screenMinutes=Math.min(1440,screenMinutes(entry.leisure)+(until-cursor)/60000);entry.leisure.screenConfirmed=false;
        drafts.days[date]=entry;if(date===state.logDate)state.draftLeisure=clone(entry.leisure);cursor=until;
      }
      if(stop||Date.now()-started>=86400000)delete drafts.leisureTimer;else drafts.leisureTimer.startedAt=Math.max(started,end);
    }
    const screenMinutes=l=>l?.screenMinutes??l?.gamingMinutes??0;
    function paintLeisureClock(){
      const usage=document.getElementById('leisure-usage'),clock=document.getElementById('leisure-clock');if(!usage||!clock)return;
      const used=screenMinutes(state.draftLeisure)+timerMinutes(state.logDate),remaining=60-used;
      const time=n=>{const seconds=Math.round(Math.abs(n)*60);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
      usage.textContent=time(used)+' recorded · '+(remaining<=0?(remaining===0?'Daily limit reached':time(remaining)+' over the limit'):time(remaining)+' to the limit');
      usage.classList.toggle('ledger-leisure-over',remaining<=0);
      const level=remaining<=0?'empty':remaining<=12?'low':'ready';
      for(const id of ['leisure-budget-meter','leisure-preview-meter']){const meter=document.getElementById(id);if(!meter)continue;meter.max=60;meter.value=Math.max(0,remaining);meter.dataset.level=level;meter.setAttribute('aria-valuetext',time(Math.max(0,remaining))+' to the one-hour limit');}
      const preview=document.getElementById('leisure-preview-time'),meta=document.getElementById('leisure-preview-meta');
      if(preview)preview.textContent=remaining<=0?(remaining===0?'Daily limit reached':time(remaining)+' over the limit'):time(remaining)+' to the limit';
      if(meta)meta.textContent=time(used)+' min recorded · scrolling + gaming'+(drafts.leisureTimer?' · Timer running':state.draftLeisure?.screenConfirmed?' · Total confirmed':' · Total not confirmed');
      const wrap=document.getElementById('leisure-wrap-up');if(wrap){wrap.hidden=!drafts.leisureTimer||remaining>0||state.logDate!==todayISO();const actions=document.getElementById('leisure-timer-actions');if(actions)actions.hidden=!wrap.hidden;clock.hidden=!wrap.hidden;}
      const running=document.getElementById('ledger-running-timer');if(running)running.textContent=remaining<=0&&state.logDate===todayISO()?'Time’s up · End session':'Screen-time timer running · Open';
      clock.textContent=drafts.leisureTimer?'Timer running · keeps time while you leave this app.':state.draftLeisure?.screenConfirmed?'Total confirmed for this date.':'Confirm the full day’s scrolling and gaming total when you know it.';
    }
    function leisureMinutesDialog(){
      if(blocked||busy||drafts.leisureTimer)return;closeLeisure();
      const date=state.logDate,dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','leisure-minutes-title');
      const title=make('h2','Screen time · '+pretty(date));title.id='leisure-minutes-title';
      const form=make('form'),labelEl=make('label','Total scrolling + gaming minutes for this day'),input=make('input'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');
      input.id='leisure-manual-minutes';input.type='number';input.inputMode='decimal';input.min='0';input.max='1440';input.step='any';input.required=true;input.value=screenMinutes(state.draftLeisure);labelEl.append(input);
      const submit=make('button','Confirm total','ledger-button ledger-primary');submit.type='submit';form.append(labelEl,error,submit,button('Cancel',()=>dialog.close()));
      form.addEventListener('submit',e=>{e.preventDefault();const value=Number(input.value);if(!finite(value)||value>1440||input.value.trim()===''){error.textContent='Use a total from 0 to 1,440 minutes.';return;}if(blocked||busy||state.logDate!==date)return;state.draftLeisure={...state.draftLeisure,screenMinutes:value,screenConfirmed:true};state.draft['Screen Discipline']=value<60?1:0;state.draftMissed=(state.draftMissed||[]).filter(h=>h!=='Screen Discipline');if(value>=60)state.draftMissed.push('Screen Discipline');remember();dialog.close();render();toast('Screen total confirmed in your draft. Save day to log it.');});
      dialog.append(title,make('p','Include all scrolling and video games, including time outside the timer. Work, content creation and purposeful reading are excluded. Exactly 60 minutes does not meet “under one hour”.','ledger-help'),form);
      dialog.addEventListener('close',()=>{dialog.remove();openLeisure();document.getElementById('leisure-minutes')?.focus();});document.body.append(dialog);dialog.showModal();input.focus();input.select();
    }
    function leisurePanel(){
      const date=state.logDate,l=state.draftLeisure||emptyLeisure(),today=date===todayISO(),panel=make('section',null,'ledger-screen ledger-leisure');panel.id='ledger-leisure';panel.setAttribute('aria-labelledby','ledger-leisure-title');
      const header=make('div',null,'ledger-screen-heading'),title=make('h3','Screen Time');title.id='ledger-leisure-title';header.append(title,detailsInfo('About screen time','A manual total of scrolling and video games combined. Stay under 60 minutes each day. The timer tracks only sessions you start; it cannot read your phone’s Screen Time or block apps. Confirm the full day’s total to update the under-one-hour habit. Legacy gaming records stay preserved and are not assumed to be total screen time.'));panel.append(header);
      const meter=make('progress',null,'ledger-time-meter');meter.id='leisure-budget-meter';meter.max=60;meter.value=60;meter.setAttribute('aria-label','Screen time left to the one-hour limit');panel.append(meter);
      const usage=make('p',null,'ledger-leisure-progress');usage.id='leisure-usage';const clock=make('p',null,'ledger-help');clock.id='leisure-clock';panel.append(usage,clock);
      if(!l.screenConfirmed&&l.gamingMinutes>0)panel.append(make('p','Earlier gaming record: '+fmt(l.gamingMinutes)+' min. Confirm a combined total to include scrolling.','ledger-help'));
      const wrap=make('section',null,'ledger-wrap-up');wrap.id='leisure-wrap-up';wrap.hidden=true;
      const end=button('End session',()=>{if(blocked||busy||!drafts.leisureTimer)return;checkpointLeisureTimer(true);remember();render();toast('Session ended. Confirm your total, then save the day.');});end.id='leisure-end-session';
      const extra=button('Review total',()=>{if(blocked||busy)return;checkpointLeisureTimer(true);remember();render();leisureMinutesDialog();});extra.id='leisure-log-extra';wrap.append(make('h4','Time’s up'),make('p','The timer keeps counting until you stop it. Record extra time honestly; your earlier progress stays earned.','ledger-help'),end,extra);panel.append(wrap);
      const actions=make('div',null,'ledger-actions');actions.id='leisure-timer-actions';
      if(drafts.leisureTimer)actions.append(button('Stop screen-time timer',()=>{if(blocked||busy)return;checkpointLeisureTimer(true);remember();render();toast('Session minutes kept in your draft.');}));
      else if(today)actions.append(button('Start screen-time timer',()=>{if(blocked||busy||drafts.leisureTimer)return;if(date!==todayISO()||state.logDate!==date){checkDay();return;}remember();state.draft['Screen Discipline']=0;state.draftLeisure={...l,screenMinutes:screenMinutes(l),screenConfirmed:false};drafts.leisureTimer={startedAt:Date.now()};remember();render();}));
      const manual=button('Confirm or edit total',leisureMinutesDialog);manual.id='leisure-minutes';manual.disabled=!!drafts.leisureTimer;actions.append(manual);panel.append(actions);
      if(!today)panel.append(make('p',pretty(date)+' · Historical daily total','ledger-help'));
      const history=make('details',null,'ledger-screen-patterns');history.open=leisureHistoryOpen;history.addEventListener('toggle',()=>leisureHistoryOpen=history.open);history.append(make('summary','Last seven days · recorded screen time'));
      const rows=make('ul');for(let i=6;i>=0;i--){const day=R.addDays(date,-i),entry=day===date?{leisure:l}:(drafts.days[day]||dayEntryFor(day)),prior=entry?.leisure;rows.append(make('li',fmtDay(day)+' · '+(prior?.screenConfirmed?fmt(prior.screenMinutes)+' min total':prior?.gamingMinutes>0?fmt(prior.gamingMinutes)+' min gaming · total unknown':'Total not recorded')));}history.append(rows);panel.append(history);return panel;
    }
    function closeLeisure(){leisureOpen=false;document.getElementById('ledger-leisure-sheet')?.close();}
    function openLeisure(){if(blocked||busy)return;leisureOpen=true;render();document.getElementById('ledger-leisure-close')?.focus();}
    function setDashboardView(view){
      if(blocked||busy||!['today','progress','history'].includes(view))return;
      remember();dashboardView=view;leisureOpen=false;
      if(view==='history')historyOpen=true;
      if(view==='today'&&state.logDate!==todayISO()){state.logDate=todayISO();loadDraftFor(state.logDate);}
      render();window.scrollTo({top:0,behavior:'instant'});document.getElementById('ledger-nav-'+view)?.focus({preventScroll:true});
    }
    function composeDashboard(log,data,earned){
      if(!log)return;
      const panes={};
      for(const [key,title]of [['today','Today'],['progress','Progress'],['history','History']]){
        const pane=make('section',null,'ledger-view');pane.id='ledger-view-'+key;pane.setAttribute('role','tabpanel');pane.setAttribute('aria-labelledby','ledger-nav-'+key);pane.hidden=dashboardView!==key;panes[key]=pane;app.append(pane);
      }
      const move=(selector,pane)=>{const node=app.querySelector(selector);if(node)pane.append(node);return node;};
      const intro=make('div',null,'ledger-day-heading');
      intro.append(make('div',state.logDate===todayISO()?new Date(state.logDate+'T12:00:00').toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'}):'Editing '+pretty(state.logDate),'eyebrow'),make('h1',state.logDate===todayISO()?'Your check-in':'Your saved day','cinzel'));
      const awards=button(earned.length+' achievements',()=>{state.openSections.relics=true;setDashboardView('progress');app.querySelector('[data-act="section"][data-key="relics"]')?.closest('.panel')?.scrollIntoView({block:'start'});});awards.classList.add('ledger-awards-link');const levelLink=button('Life Level '+data.life.level+' · '+fmt(Math.ceil(data.life.remaining))+' XP to next level',()=>setDashboardView('progress'));levelLink.id='ledger-life-level';levelLink.classList.add('ledger-level-link');const progressLinks=make('div',null,'ledger-day-progress');progressLinks.append(levelLink,awards);intro.append(progressLinks);panes.today.append(intro);
      const wrap=move('.ledger-log-wrap',panes.today)||log;if(wrap===log)panes.today.append(log);
      move('#ledger-rhythm',panes.today);
      const preview=button('',openLeisure);preview.id='ledger-leisure-preview';preview.classList.add('ledger-leisure-preview');preview.setAttribute('aria-haspopup','dialog');preview.setAttribute('aria-label','Open screen-time timer and controls');
      const previewHead=make('span',null,'ledger-preview-heading');previewHead.append(make('span','Screen time · under 1 hour'),make('span','Open ›','ledger-preview-open'));
      const previewTime=make('strong');previewTime.id='leisure-preview-time';const previewMeta=make('span',null,'ledger-help');previewMeta.id='leisure-preview-meta';
      const previewMeter=make('progress',null,'ledger-time-meter');previewMeter.id='leisure-preview-meter';previewMeter.setAttribute('aria-label','Screen time left to the limit');preview.append(previewHead,previewTime,previewMeter,previewMeta);panes.today.append(preview);
      const panel=app.querySelector('#ledger-leisure');
      if(panel){
        const sheet=make('dialog',null,'ledger-dialog ledger-sheet');sheet.id='ledger-leisure-sheet';sheet.setAttribute('aria-labelledby','ledger-leisure-title');
        const close=button('Done',()=>{closeLeisure();document.getElementById('ledger-leisure-preview')?.focus();});close.id='ledger-leisure-close';close.classList.add('ledger-sheet-close');
        const save=button('Save day',()=>{leisureOpen=false;saveDay();});save.classList.add('ledger-primary');
        sheet.append(close,panel,save);app.append(sheet);sheet.addEventListener('cancel',e=>{e.preventDefault();closeLeisure();document.getElementById('ledger-leisure-preview')?.focus();});
        if(leisureOpen&&!state.levelInfo&&!state.achvQueue?.length)sheet.showModal();else leisureOpen=false;
      }
      const screen=app.querySelector('#ledger-screen');
      if(screen){const fold=make('details',null,'ledger-screen-fold');fold.id='ledger-screen-fold';fold.open=screenOpen;fold.addEventListener('toggle',()=>screenOpen=fold.open);fold.append(make('summary','Screen Discipline · '+(state.draftScreen?.guardrail?'guardrail set':'set a guardrail')),screen);panes.today.append(fold);}
      const mode=log.querySelector('[data-act="logmode"]')?.parentNode;
      if(mode&&state.logMode==='list'){
        const filters=make('div',null,'ledger-habit-filters');
        for(const [value,title]of [[false,'All habits'],[true,'Remaining']]){const b=button(title,()=>{remainingOnly=value;render();document.getElementById('ledger-filter-'+(value?'remaining':'all'))?.focus();});b.id='ledger-filter-'+(value?'remaining':'all');b.setAttribute('aria-pressed',String(remainingOnly===value));filters.append(b);}
        mode.after(filters);
        let left=0;
        for(const row of log.querySelectorAll('.row')){const control=row.querySelector('[data-habit]'),habit=control?.dataset.habit;if(!habit)continue;const complete=state.draft[habit]>=leisureTarget(habit);row.classList.toggle('ledger-habit-complete',complete);row.hidden=remainingOnly&&complete;if(!complete)left++;}
        if(remainingOnly&&!left)filters.after(make('p','All your habits are checked in. Save your day to bank the progress.','ledger-help'));
      }
      const oldActions=log.querySelector('#ledger-draft-status')?.parentNode;
      // Date navigation lives with the date field; achievement access lives above.
      if(oldActions){for(const b of [...oldActions.querySelectorAll('button')])if(b.textContent.startsWith('Achievements'))b.remove();}
      for(const jump of app.querySelectorAll('.ledger-jump'))jump.remove();
      move('.ledger-identity',panes.progress);move('#ledger-season-summary',panes.progress);move('.ledger-overall',panes.progress);panes.progress.append(recentPanel());
      const relic=app.querySelector('[data-act="section"][data-key="relics"]')?.closest('.panel');
      move('.ledger-values-heading',panes.progress);move('.ledger-values-info',panes.progress);
      move('.ledger-values',panes.progress);if(relic)panes.progress.append(relic);
      panes.history.append(make('h1','Your record','cinzel ledger-view-title'),make('p','Revisit a day, catch up, or keep a backup.','ledger-help'));
      move('#ledger-history',panes.history);
      for(const key of ['chronicle','consistency','forecast','pace','oracle','outcomes']){const section=app.querySelector('[data-act="section"][data-key="'+key+'"]')?.closest('.panel');if(section)(['chronicle','consistency'].includes(key)?panes.history:panes.progress).append(section);}
      const toolsPanel=make('details',null,'ledger-manage');toolsPanel.append(make('summary','Manage Ledger & backups'));
      const tools=app.querySelector('[data-act="export"]')?.parentNode;if(tools)toolsPanel.append(tools);move('.ledger-storage-note',toolsPanel);move('.ledger-app-links',toolsPanel);toolsPanel.append(button('Reset progress',resetProgressDialog));panes.history.append(toolsPanel);if(drafts.archives?.length)panes.history.append(progressArchives());
      const clear=log.querySelector('[data-act="clear"]');if(clear){const options=make('details',null,'ledger-day-options');options.append(make('summary','Day options'));if(oldActions)options.append(oldActions);if(state.logDate===todayISO()){const dateRow=log.querySelector('.ledger-date-row');if(dateRow)options.append(dateRow);}options.append(clear);panes.today.append(options);}
      const dock=make('div',null,'tabbar ledger-dock');dock.id='ledger-dock';
      const saveRow=make('div',null,'ledger-save-row');saveRow.hidden=dashboardView!=='today';
      const statusLabel=app.querySelector('#ledger-draft-status'),saveButton=log.querySelector('[data-act="commit"]');if(statusLabel)saveRow.append(statusLabel);if(saveButton){saveButton.textContent=state.logDate===todayISO()?'Save day':'Save '+fmtDay(state.logDate);saveButton.classList.add('ledger-primary');saveRow.append(saveButton);}dock.append(saveRow);
      const running=button('Screen-time timer running · Open',openLeisure);running.id='ledger-running-timer';running.hidden=!drafts.leisureTimer;running.classList.add('ledger-running-timer');dock.append(running);
      const nav=make('nav',null,'ledger-nav');nav.setAttribute('role','tablist');nav.setAttribute('aria-label','Life Ledger sections');
      const icons={today:'<path d="M4 5h16v15H4zM8 3v4m8-4v4M8 13l3 3 5-6"/>',progress:'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',history:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'};
      for(const [key,title]of [['today','Today'],['progress','Progress'],['history','History']]){const b=button('',()=>setDashboardView(key));b.id='ledger-nav-'+key;b.dataset.view=key;b.setAttribute('role','tab');b.setAttribute('aria-selected',String(dashboardView===key));b.setAttribute('aria-controls',panes[key].id);b.setAttribute('tabindex',dashboardView===key?'0':'-1');b.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+icons[key]+'</svg><span>'+title+'</span>';nav.append(b);}
      nav.addEventListener('keydown',e=>{const keys=['today','progress','history'],index=keys.indexOf(e.target.dataset.view);if(index<0)return;let next;if(e.key==='ArrowRight')next=(index+1)%3;else if(e.key==='ArrowLeft')next=(index+2)%3;else if(e.key==='Home')next=0;else if(e.key==='End')next=2;else return;e.preventDefault();setDashboardView(keys[next]);});
      const todayScreen=state.logDate===todayISO()?state.draftScreen:(drafts.days[todayISO()]||dayEntryFor(todayISO()))?.screen;
      const quick=button(todayScreen?.slips?.at(-1)&&!todayScreen.slips.at(-1).recovered?'Resume my scrolling reset':'Getting pulled into scrolling?',beginScreenReset);quick.id='ledger-quick-reset';quick.setAttribute('aria-label',quick.textContent);quick.title=quick.textContent;if(dashboardView==='today'){quick.textContent=todayScreen?.slips?.at(-1)&&!todayScreen.slips.at(-1).recovered?'Resume reset':'Scrolling reset';saveRow.append(quick);if(saveButton)saveRow.append(saveButton);}
      dock.append(nav);app.append(dock);log.querySelector('.ledger-save-inline')?.remove();resetSheet();
    }

    // Settings live inside the existing draft/backup record; drawing does not write.
    async function saveRhythm(next){
      R.validate(next);if(blocked||busy)return false;
      drafts.rhythm=clone(next);const ok=await write(DRAFTKEY,JSON.stringify(drafts));render();return ok;
    }
    function detailsInfo(title,text){const d=make('details',null,'ledger-progress-info'),summary=make('summary','i');summary.setAttribute('aria-label',title);d.append(summary,make('p',text,'ledger-help'));return d;}
    function weekStats(h,week=R.weekStart(state.logDate)){return R.weekly(state.days,h,HCFG[h],preferences(),week,todayISO());}
    function rhythmPanel(){
      const panel=make('section',null,'panel ledger-rhythm');panel.id='ledger-rhythm';
      const week=R.weekStart(state.logDate),mode=preferences().weeks?.[week]||'normal',head=make('div',null,'ledger-rhythm-heading');
      head.append(make('h2','This week’s focus','cinzel'),detailsInfo('About weekly rhythm','Your chosen rhythm is a guide for this week. Smaller weeks change the target, never your accumulated progress. Blank check-ins stay unknown. Weekly catch-up records remembered totals without inventing dates.'));
      panel.append(head,make('p',fmtDay(week)+' – '+fmtDay(R.addDays(week,6)),'ledger-help'));
      const choices=make('div',null,'ledger-actions');
      for(const [value,text]of [['normal','Normal week'],['reduced','Smaller week']]){const b=button(text,async()=>{if(await saveRhythm({...preferences(),weeks:{...(preferences().weeks||{}),[week]:value}}))toast('Week updated. Your progress stays earned.');});b.id='rhythm-week-'+value;b.setAttribute('aria-pressed',String(mode===value));choices.append(b);}panel.append(choices);
      const focused=focusHabits();
      for(const h of focused){const g=R.goal(h,HCFG[h],preferences()),w=weekStats(h,week),row=make('div',null,'ledger-rhythm-row'),head=make('div',null,'ledger-rhythm-heading');
        const edit=button('Edit',()=>goalDialog(h));edit.setAttribute('aria-label','Edit goal for '+label(h));head.append(make('strong',label(h)),edit);row.append(head);
        if(g.type==='practice'){const target=mode==='reduced'?g.reduced:g.normal,amount=g.mode==='sessions'?w.sessions:w.amount,unit=g.mode==='sessions'?'days':HCFG[h].unit;
          row.append(make('p',fmt(amount)+' / '+fmt(target)+' '+(h==='Sleep'&&g.mode==='sessions'?'target nights':unit)+' this week','ledger-rhythm-count'));
          if(h==='Sleep'&&g.mode==='sessions')row.append(make('p','At least '+fmt(g.minimum)+' hours per target night','ledger-help'));
          const meter=make('progress');meter.max=target;meter.value=Math.min(target,amount);meter.setAttribute('aria-label',label(h)+' weekly progress');row.append(meter);
        }else{const m=R.milestone(state.days,h,HCFG[h],preferences(),todayISO());row.append(make('p',fmt(m.amount)+' / '+fmt(g.target)+' '+HCFG[h].unit+' · '+(m.complete?'Completed':g.type==='deadline'?'Due '+pretty(g.due):'Milestone'),'ledger-rhythm-count'));if(g.type==='deadline'&&!m.complete&&g.due<todayISO())row.append(make('p','Past the chosen deadline · edit the plan or continue.','ledger-help'));}
        row.append(detailsInfo('Logging details for '+label(h),w.unlogged+' day'+(w.unlogged===1?'':'s')+' without a dated check-in'+(w.reported?' · includes a weekly catch-up':'')+'. Undated days stay unknown.'));
        if(w.conflict){row.append(make('p','Your weekly total conflicts with dated entries. Review it to keep progress accurate.','ledger-error'),button('Review catch-up',()=>catchupDialog(h,week)));}
        panel.append(row);
      }
      if(!focused.length)panel.append(make('p','Choose up to three habits to focus on. All other habits stay available.','ledger-help'));
      const actions=make('div',null,'ledger-actions'),choose=button('Choose focus habits',focusDialog);choose.id='ledger-choose-focus';actions.append(choose,button('Quick catch-up',catchupDialog));panel.append(actions);return panel;
    }
    function focusDialog(){
      if(blocked||busy)return;remember();const dialog=make('dialog',null,'ledger-dialog'),title=make('h2','Choose up to three focus habits');title.id='rhythm-focus-title';dialog.setAttribute('aria-labelledby',title.id);
      const selected=new Set(focusHabits()),form=make('form'),error=make('p',null,'ledger-error'),count=make('p',null,'ledger-focus-count');count.id='ledger-focus-count';count.setAttribute('role','status');const updateCount=()=>count.textContent=selected.size+' of 3 selected'+(selected.size===3?' · uncheck one to switch':'');updateCount();form.append(count);error.setAttribute('role','alert');
      for(const h of HABITS){const labelEl=make('label',label(h)),input=make('input');input.type='checkbox';input.value=h;input.checked=selected.has(h);input.addEventListener('change',()=>{if(input.checked&&selected.size>=3){input.checked=false;error.textContent='Keep up to three habits in focus.';return;}input.checked?selected.add(h):selected.delete(h);updateCount();error.textContent='';});labelEl.classList.add('ledger-focus-choice');labelEl.prepend(input);form.append(labelEl);}
      const submit=make('button','Save focus','ledger-button ledger-primary');submit.type='submit';const footer=make('div',null,'ledger-dialog-actions');footer.append(button('Cancel',()=>dialog.close()),submit);form.append(error,footer);
      form.addEventListener('submit',async e=>{e.preventDefault();submit.disabled=true;try{if(await saveRhythm({...preferences(),focus:[...selected]})){dialog.close();toast('Focus updated. All other habits are still available.');}else error.textContent='Not saved. Retry before closing.';}finally{submit.disabled=false;}});
      dialog.append(title,form);dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('ledger-choose-focus')?.focus({preventScroll:true});});document.body.append(dialog);dialog.showModal();
    }
    function goalDialog(h){
      if(blocked||busy||!HABITS.includes(h))return;remember();
      const current=R.goal(h,HCFG[h],preferences()),dialog=make('dialog',null,'ledger-dialog'),title=make('h2',label(h)+' · Goal');title.id='rhythm-goal-title';dialog.setAttribute('aria-labelledby',title.id);
      const form=make('form'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');
      function field(id,text,kind,value){const labelEl=make('label',text),input=make(kind==='select'?'select':'input');input.id=id;if(kind!=='select')input.type=kind;input.value=value;labelEl.append(input);form.append(labelEl);return input;}
      const type=field('rhythm-goal-type','Goal type','select','');for(const [v,t]of [['practice','Ongoing practice'],['milestone','Milestone'],['deadline','Actual deadline']]){const o=make('option',t);o.value=v;type.append(o);}type.value=current.type;
      const mode=field('rhythm-goal-mode','Weekly target measured in','select','');for(const [v,t]of [['sessions','Days completed'],['amount',HCFG[h].unit]]){const o=make('option',t);o.value=v;mode.append(o);}mode.value=current.mode;
      const normal=field('rhythm-goal-normal','Normal week target','number',current.normal),reduced=field('rhythm-goal-reduced','Smaller week target','number',current.reduced),target=field('rhythm-goal-target','Amount for this milestone ('+HCFG[h].unit+')','number',current.target),due=field('rhythm-goal-due','Deadline','date',current.due);
      const minimum=h==='Sleep'?field('rhythm-goal-minimum','Hours for a target night','number',current.minimum):null;if(minimum){minimum.min='0.1';minimum.max='24';minimum.step='any';minimum.required=true;}
      for(const input of [normal,reduced,target]){input.min='0.1';input.step='any';input.required=true;}
      const note=make('p',null,'ledger-help');form.append(note);
      function show(){for(const input of [normal,reduced]){input.min=mode.value==='sessions'?'1':'0.1';input.step=mode.value==='sessions'?'1':'any';input.max=mode.value==='sessions'?'7':'';}for(const input of [mode,normal,reduced]){input.parentNode.hidden=type.value!=='practice';input.disabled=type.value!=='practice';}for(const input of [target,due]){input.parentNode.hidden=type.value==='practice'||input===due&&type.value!=='deadline';input.disabled=input.parentNode.hidden;}due.required=type.value==='deadline';note.textContent=type.value==='practice'?'Use a weekly rhythm that fits your life.':current.type==='practice'?'This milestone starts from your current accumulated total. Earlier progress stays recorded.':'This milestone continues from its original starting amount.';}
      const showFields=()=>{show();if(minimum){minimum.parentNode.hidden=type.value!=='practice'||mode.value!=='sessions';minimum.disabled=minimum.parentNode.hidden;}};type.addEventListener('change',showFields);mode.addEventListener('change',showFields);showFields();
      const submit=make('button','Save goal','ledger-button ledger-primary');submit.type='submit';const footer=make('div',null,'ledger-dialog-actions');footer.append(button('Cancel',()=>dialog.close()),submit);form.append(error,footer);
      form.addEventListener('submit',async e=>{e.preventDefault();try{const g={type:type.value,mode:mode.value,normal:Number(normal.value),reduced:Number(reduced.value),target:Number(target.value),baseline:current.type==='practice'&&type.value!=='practice'?R.total(state.days,h,HCFG[h],preferences(),todayISO()):current.baseline,due:type.value==='deadline'?due.value:'',...(minimum?{minimum:Number(minimum.value)}:{})};R.validate({goals:{[h]:g}});submit.disabled=true;if(await saveRhythm({...preferences(),goals:{...(preferences().goals||{}),[h]:g}})){dialog.close();toast('Goal saved.');}else error.textContent='Not saved. Retry before closing.';}catch(err){error.textContent=err.message;}finally{submit.disabled=false;}});
      dialog.append(title,form);dialog.addEventListener('close',()=>{dialog.remove();[...app.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')==='Edit goal for '+label(h))?.focus({preventScroll:true});});document.body.append(dialog);dialog.showModal();type.focus();
    }
    function goalsDialog(){
      if(blocked||busy)return;const dialog=make('dialog',null,'ledger-dialog'),title=make('h2','Weekly goals & milestones');title.id='rhythm-goals-title';dialog.setAttribute('aria-labelledby',title.id);dialog.append(title);
      for(const h of HABITS){const b=button(label(h)+' · '+R.goal(h,HCFG[h],preferences()).type,()=>{dialog.close();goalDialog(h);});b.classList.add('ledger-goal-choice');dialog.append(b);}dialog.append(button('Reset progress',()=>{dialog.close();resetProgressDialog();}),button('Done',()=>dialog.close()));dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
    }
    function catchupDialog(chosenHabit,chosenWeek){
      if(blocked||busy)return;remember();const dialog=make('dialog',null,'ledger-dialog'),title=make('h2','Quick weekly catch-up');title.id='rhythm-catchup-title';dialog.setAttribute('aria-labelledby',title.id);
      const form=make('form'),weekLabel=make('label','Week'),week=make('select'),habitLabel=make('label','Habit'),habit=make('select');week.id='rhythm-catchup-week';habit.id='rhythm-catchup-habit';
      const weeks=new Set([R.weekStart(state.logDate),...Array.from({length:12},(_,i)=>R.addDays(R.weekStart(todayISO()),-i*7)),...Object.keys(preferences().catchups||{})]);
      for(const date of [...weeks].filter(d=>d<=todayISO()).sort().reverse()){const o=make('option',fmtDay(date)+' – '+fmtDay(R.addDays(date,6)));o.value=date;week.append(o);}week.value=validDate(chosenWeek)?chosenWeek:R.weekStart(state.logDate);
      for(const h of HABITS){const o=make('option',label(h));o.value=h;habit.append(o);}habit.value=HABITS.includes(chosenHabit)?chosenHabit:focusHabits()[0]||HABITS[0];
      weekLabel.append(week);habitLabel.append(habit);form.append(weekLabel,habitLabel);
      const amountLabel=make('label'),amount=make('input'),sessionsLabel=make('label','Completed days this week (if remembered)'),sessions=make('input'),recorded=make('p',null,'ledger-help'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');amount.id='rhythm-catchup-amount';sessions.id='rhythm-catchup-sessions';amount.type=sessions.type='number';amount.step='any';sessions.step='1';amount.min=sessions.min='0';amount.required=sessions.required=true;amountLabel.append(amount);sessionsLabel.append(sessions);form.append(recorded,amountLabel,sessionsLabel,error);
      function refresh(){const h=habit.value,c=HCFG[h],w=weekStats(h,week.value),report=preferences().catchups?.[week.value]?.[h];amountLabel.replaceChildren(make('span','Total for the entire week ('+c.unit+')'),amount);amount.value=w.conflict?report.amount:w.amount;sessions.value=w.conflict?report.sessions:w.sessions;sessionsLabel.replaceChildren(make('span',h==='Sleep'?'Target nights this week':'Completed days this week (0 if unknown)'),sessions);sessionsLabel.hidden=c.kind==='count';amount.step=c.kind==='count'?'1':'any';amount.max=c.kind==='count'?'7':'';recorded.textContent=fmt(w.datedAmount)+' '+c.unit+' already dated. Enter the whole remembered total, including those entries. '+(h==='Sleep'?'Completed days must meet your '+fmt(R.goal(h,c,preferences()).minimum)+'-hour target. ':'')+'Catch-up adds only the difference; dates stay unknown.';}
      week.addEventListener('change',refresh);habit.addEventListener('change',refresh);refresh();
      const submit=make('button','Save weekly total','ledger-button ledger-primary');submit.type='submit';const footer=make('div',null,'ledger-dialog-actions');footer.append(button('Cancel',()=>dialog.close()),submit);form.append(footer);
      form.addEventListener('submit',async e=>{e.preventDefault();try{const h=habit.value,c=HCFG[h],w=weekStats(h,week.value),row={amount:Number(amount.value),sessions:c.kind==='count'?Number(amount.value):Number(sessions.value)},span=Math.min(7,Math.round((isoToNum(todayISO())-isoToNum(week.value))/86400000)+1);R.validate({catchups:{[week.value]:{[h]:row}}});if(row.amount<w.datedAmount||row.sessions<w.datedSessions)throw Error('A weekly total cannot be below the activity already logged on individual dates. Edit those dates first.');if(row.sessions>span-w.misses)throw Error('Only '+(span-w.misses)+' days are available after your dated missed or below-target entries. Review those dates or lower this total.');if(h==='Sleep'&&row.sessions*R.goal(h,c,preferences()).minimum>row.amount)throw Error('The sleep total is too low for that many target nights.');if(row.sessions>0&&row.amount===0)throw Error('Enter an amount for completed days.');const before=compute(state.days,state.goals);submit.disabled=true;const next={...preferences(),catchups:{...(preferences().catchups||{}),[week.value]:{...(preferences().catchups?.[week.value]||{}),[h]:row}}};if(await saveRhythm(next)){const after=compute(state.days,state.goals);celebrate(before,after,week.value);drafts.rhythm.earned=[...new Set([...(preferences().earned||[]),...ACHV.filter(a=>a.test(after)).map(a=>a.name)])];await write(DRAFTKEY,JSON.stringify(drafts));dialog.close();render();toast('Weekly total saved. Dates remain unrecorded.');}else error.textContent='Not saved. Retry before closing.';}catch(err){error.textContent=err.message;}finally{submit.disabled=false;}});
      dialog.append(title,form);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();
    }
    function xpMeter(progress,name){const meter=make('progress',null,'ledger-xp-meter');meter.max=progress.cost;meter.value=progress.into;meter.setAttribute('aria-label',name+' XP toward next level');return meter;}
    function lastingProgress(data){
      const panel=make('section',null,'panel ledger-overall ledger-lasting');panel.id='ledger-lifetime-levels';
      const head=make('div',null,'ledger-rhythm-heading');head.append(make('h2','Life Level '+data.life.level,'cinzel'),detailsInfo('How lifetime levels work','Saved activity earns 100 XP per standard check-in amount; partial amounts earn partial XP. Habit thresholds are calibrated to reach Level 99 after about 52 weeks at their original normal weekly rhythm. Values use the combined rhythms of their habits. Life Level 99 takes 3,224 standard check-ins, about 52 weeks at the original weekly rhythms across all 13 habits. Your habit XP builds its value and your overall Life Level. Hiding a habit keeps its earned XP. There is no maximum level, annual reset, missed-day penalty or streak multiplier. Weekly targets and goal edits do not change XP. Catch-up counts once. Correcting or undoing an entry recalculates its XP.'));
      panel.append(head,make('p',fmt(data.life.xp)+' lifetime XP · '+fmt(Math.ceil(data.life.remaining))+' XP to Level '+(data.life.level+1),'ledger-rhythm-count'),xpMeter(data.life,'Life'));
      const map=make('div',null,'ledger-level-constellation');map.innerHTML=constellation(data.pillars.map(p=>({...p,exact:Math.min(99,p.exact)})),data.life,state.active);panel.append(map);
      for(const h of focusHabits()){const progress=data.habit[h],row=make('div',null,'ledger-rhythm-row');row.append(make('strong',label(h)+' · Level '+progress.level),make('p',fmt(progress.total)+' '+HCFG[h].unit+' recorded overall','ledger-rhythm-count'),make('p',fmt(progress.xp)+' XP · '+fmt(Math.ceil(progress.remaining))+' XP to next level','ledger-help'),xpMeter(progress,label(h)));panel.append(row);}return panel;
    }
    function recentPanel(){
      const panel=make('details',null,'ledger-history');panel.id='ledger-recent';panel.append(make('summary','Recent rhythm · last four weeks'));
      for(let i=0;i<4;i++){const week=R.addDays(R.weekStart(todayISO()),-i*7),group=make('div',null,'ledger-rhythm-row');group.append(make('strong',fmtDay(week)+' – '+fmtDay(R.addDays(week,6))));for(const h of focusHabits()){const w=weekStats(h,week);group.append(make('p',label(h)+' · '+fmt(w.sessions)+' completed days · '+w.unlogged+' days without dated check-ins'+(w.reported?' · weekly total supplied':''),'ledger-help'));}panel.append(group);}return panel;
    }
    pillarCard=function(p,habits,expected,open){
      const rows=p.habits.map(h=>{const hs=habits[h];return '<div class="ledger-rhythm-row"><div class="ledger-rhythm-heading"><span>'+esc(label(h))+'</span><strong>Level '+hs.level+'</strong></div><p class="ledger-help">'+fmt(hs.total)+' '+esc(HCFG[h].unit)+' · '+fmt(hs.xp)+' XP</p><progress class="ledger-xp-meter" max="'+hs.cost+'" value="'+hs.into+'" aria-label="'+esc(label(h))+' XP toward next level"></progress><p class="ledger-help">100 XP per '+fmt(R.xpUnit(HCFG[h]))+' '+esc(HCFG[h].unit)+' · '+fmt(Math.ceil(hs.remaining))+' XP to next level</p></div>';}).join('');
      return '<section class="panel card ledger-value" style="--ledger-value:'+p.color+';padding:16px;border-color:'+(open?p.color:'var(--neo-line)')+'"><button class="ledger-rhythm-heading ledger-value-toggle" data-act="pillar" data-key="'+esc(p.key)+'" aria-expanded="'+open+'" aria-controls="ledger-value-details-'+esc(p.key)+'">'+iconSVG(p.icon,p.color)+'<span class="cinzel">'+esc(p.title)+'</span><strong class="mono ledger-value-level">Level '+p.level+'</strong><span aria-hidden="true">'+(open?'⌃':'⌄')+'</span></button><p class="ledger-help">'+fmt(p.xp)+' XP · '+fmt(Math.ceil(p.remaining))+' XP to Level '+(p.level+1)+'</p><progress class="ledger-xp-meter" max="'+p.cost+'" value="'+p.into+'" aria-label="'+esc(p.title)+' XP toward next level"></progress><div id="ledger-value-details-'+esc(p.key)+'"'+(open?'':' hidden')+'>'+ (open?rows:'')+'</div></section>';
    };
    function decorateRhythm(log,data){
      for(const key of ['forecast','pace','oracle','outcomes','chronicle','consistency'])app.querySelector('[data-act="section"][data-key="'+key+'"]')?.closest('.panel')?.remove();
      app.querySelector('.ledger-overall')?.replaceWith(lastingProgress(data));
      const identity=app.querySelector('.ledger-identity');if(identity)identity.innerHTML='<div class="eyebrow">Lifetime progress</div><h1 class="cinzel">Your Life Ledger</h1>';
      const badge=app.querySelector('.appbar-lvl');if(badge)badge.textContent='LV '+data.life.level;
      const tools=app.querySelector('[data-act="export"]')?.parentNode;
      app.querySelector('[data-act="reset"]')?.remove();app.querySelector('[data-act="card"]')?.remove();
      if(tools){const b=button('Quick catch-up',catchupDialog);tools.append(b);}
      const storageNote=app.querySelector('.ledger-storage-note');if(storageNote)storageNote.textContent='Saved on this device · export a backup to keep or move your record';
      if(log){log.before(rhythmPanel());
        for(const row of log.querySelectorAll('.row,.ledger-habit-card')){const control=row.querySelector('[data-habit]'),h=control?.dataset.habit;if(!h)continue;
          const meta=make('div',null,'ledger-checkin-state'),statusText=make('span',state.draft[h]>0?'Recorded':state.draftMissed?.includes(h)?'Didn’t do':'Not recorded');statusText.classList.add('ledger-habit-status');meta.append(statusText);
          const missed=button(state.draftMissed?.includes(h)?'Leave unknown':'Didn’t do',()=>{if(blocked||busy)return;const set=new Set(state.draftMissed||[]);if(set.has(h))set.delete(h);else{set.add(h);state.draft[h]=0;}if(h==='Screen Discipline')state.draftLeisure={...state.draftLeisure,screenConfirmed:false};state.draftMissed=[...set];remember();render();});missed.classList.add('ledger-missed');missed.setAttribute('aria-label',(state.draftMissed?.includes(h)?'Leave unknown: ':'Did not do: ')+label(h));meta.append(missed);row.append(meta);
        }
      }
    }

    function refreshCheckinState(h){
      for(const row of app.querySelectorAll('.row,.ledger-habit-card')){if(row.querySelector('[data-habit]')?.dataset.habit!==h)continue;
        const known=state.draftMissed?.includes(h),status=row.querySelector('.ledger-habit-status');if(status)status.textContent=state.draft[h]>0?'Recorded':known?'Didn’t do':'Not recorded';
        const missed=row.querySelector('.ledger-missed');if(missed){missed.textContent=known?'Leave unknown':'Didn’t do';missed.setAttribute('aria-label',(known?'Leave unknown: ':'Did not do: ')+label(h));}
      }
      const count=app.querySelector('.ledger-log-heading .mono');if(count)count.textContent=HABITS.filter(h=>state.draft[h]>0).length+' activities entered';
    }

    const originalQuest=questLog,originalSettings=settingsView,originalDeckChrome=updateDeckChrome;
    let deckResize=null;
    function withLiteralUnits(fn){const units=Object.fromEntries(Object.entries(HCFG).map(([key,c])=>[key,c.unit]));try{Object.values(HCFG).forEach(c=>c.unit=esc(c.unit));return fn();}finally{for(const [key,unit]of Object.entries(units))HCFG[key].unit=unit;}}
    questLog=function(draft){return withLiteralUnits(()=>originalQuest(draft,1));};
    settingsView=function(){return withLiteralUnits(()=>originalSettings());};
    updateDeckChrome=function(idx,n){
      originalDeckChrome(idx,n);
      const prev=document.getElementById('deckPrev'),next=document.getElementById('deckNext');
      if(prev){prev.disabled=idx===0;prev.setAttribute('aria-label','Previous habit');}
      if(next){next.disabled=idx>=n-1;next.setAttribute('aria-label','Next habit');}
      const counter=document.getElementById('deckCounter');if(counter){counter.setAttribute('aria-live','polite');counter.setAttribute('aria-atomic','true');}
      [...app.querySelectorAll('.ledger-habit-card')].forEach((card,i)=>{const info=card.querySelector('.ledger-card-definition');if(info)info.hidden=i!==idx;card.inert=i!==idx;card.setAttribute('aria-hidden',String(i!==idx));card.setAttribute('role','group');card.setAttribute('aria-label',label(HABITS[i])+' · '+(i+1)+' of '+n);});
      const picker=document.getElementById('ledger-habit-picker');if(picker)picker.value=HABITS[idx];
      const card=app.querySelectorAll('.ledger-habit-card')[idx],viewport=document.getElementById('deckViewport'),fit=()=>{if(card?.offsetHeight>0&&viewport)viewport.style.height=card.offsetHeight+'px';};fit();
      if(deckResize)deckResize.disconnect();if(window.ResizeObserver&&card){deckResize=new window.ResizeObserver(fit);deckResize.observe(card);}
    };
    const originalLevelView=levelUpView,originalAchievementView=achvView;
    function rewardDialog(markup){return markup.replace('<div class="overlay"','<dialog class="overlay ledger-reward"').replace(/<\/div>$/, '</dialog>');}
    levelUpView=info=>rewardDialog(originalLevelView(info));
    achvView=()=>rewardDialog(originalAchievementView());
    let rewardOpener=null,progressInfoOpen=false;
    const originalRender=render;
    render=function(){
      const active=document.activeElement,restoreControl=active?.dataset&&['inc','dec','logmode','pillar'].includes(active.dataset.act)?{...active.dataset}:null;
      if(!rewardOpener&&(state.levelInfo||state.achvQueue?.length)){const active=document.activeElement;rewardOpener=active?.dataset?.act==='relic'?'[data-act="relic"][data-idx="'+active.dataset.idx+'"]':'[data-act="commit"]';}
      if(screenMinutes(state.draftLeisure)>=60)state.draft['Screen Discipline']=0;
      originalRender();
      for(const [i,card]of [...app.querySelectorAll('.ledger-habit-card')].entries()){
        const h=HABITS[i],c=HCFG[h],amount=c.kind==='count'?1:c.step;
        const xp=Number((amount/R.xpUnit(c)*100).toFixed(2));
        const hint=make('div',null,'ledger-card-xp');
        if(c.kind!=='count')hint.append(make('span','+'+fmt(amount)+' '+c.unit+' · '));
        hint.append(make('strong','+'+xp+' XP'),make('span',c.kind==='count'?' per check-in':' per tap'));
        hint.title='XP is earned when you save the day.';
        const old=card.querySelector('.ledger-tap-amount');
        if(old)old.replaceWith(hint);else card.querySelector('[data-act="toggle"]')?.parentNode.append(hint);
        if(c.kind!=='count'){
          const done=button('Done',()=>{
            if(blocked||busy)return;
            const input=card.querySelector('[data-act="num"]'),text=input.value.trim(),n=text===''?0:Number(text);
            if(!finite(n)||!/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text)){input.setAttribute('aria-invalid','true');toast('Use a valid, non-negative amount.');input.focus();return;}
            if(h==='Sleep'&&n>24||h==='Board Work'&&n>1440){input.setAttribute('aria-invalid','true');toast(h==='Sleep'?'Use at most 24 hours in one day.':'Use at most 1,440 minutes in one day.');input.focus();return;}
            input.setAttribute('aria-invalid','false');state.draft[h]=n;
            if(n>0)state.draftMissed=(state.draftMissed||[]).filter(key=>key!==h);
            remember();refreshCheckinState(h);goCard(state.cardIndex+1);
            if(i<HABITS.length-1){const next=app.querySelectorAll('.ledger-habit-card')[i+1];next.setAttribute('tabindex','-1');next.focus({preventScroll:true});}
            else app.querySelector('[data-act="commit"]')?.focus({preventScroll:true});
          });
          done.classList.add('btn','tap','ledger-amount-done');done.setAttribute('aria-label','Confirm amount and next habit: '+label(h));const footer=make('div',null,'ledger-amount-confirm');hint.before(footer);footer.append(hint,done);
        }
      }
      const data=compute(state.days,state.goals),earned=ACHV.filter(a=>a.test(data));
      for(const heading of app.querySelectorAll('.eyebrow'))if(heading.textContent.startsWith('The Five Values')){
        const info=make('details',null,'ledger-progress-info ledger-values-info'),summary=make('summary','i');summary.setAttribute('aria-label','How values and achievements work');info.open=progressInfoOpen;info.addEventListener('toggle',()=>progressInfoOpen=info.open);
        info.append(summary,make('p','Saved activity earns lifetime XP for habits, values and your Life Level. Habit and value levels are calibrated to about a year at their original normal rhythms. Life Level 99 takes 3,224 standard check-ins, about a year across the original 13 habits. Levels have no ceiling or time limit. Recent rhythm is shown separately. Unknown days stay unknown. Earned achievements stay claimed when a week is smaller or a goal changes.','ledger-help'));heading.after(info);
      }
      const reward=app.querySelector('dialog.ledger-reward');
      if(reward){reward.setAttribute('aria-label',state.levelInfo?.title||state.achvQueue[0]?.name||'Achievement');reward.addEventListener('cancel',e=>{e.preventDefault();clearCelebrations();render();});reward.showModal();}
      else if(rewardOpener){app.querySelector(rewardOpener)?.focus();rewardOpener=null;}
      for(const node of app.querySelectorAll('[data-act="node"]')){const p=data.pillars.find(p=>p.key===node.dataset.key);node.setAttribute('role','button');node.setAttribute('tabindex','0');node.setAttribute('aria-label',p.title+' · Level '+p.level);node.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();node.click();}});}
      for(const relic of app.querySelectorAll('[data-act="relic"]')){const a=ACHV[+relic.dataset.idx];relic.setAttribute('role','button');relic.setAttribute('tabindex','0');relic.setAttribute('aria-label',a.name+(a.test(data)?' · Earned':' · Locked'));relic.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();relic.click();}});}

      const log=app.querySelector('[data-act="logdate"]')?.closest('.panel');if(log){log.id='ledger-log';const actions=make('div',null,'ledger-actions');actions.append(button('Today',()=>selectDate(todayISO())),button('Yesterday',()=>selectDate(numToISO(isoToNum(todayISO())-86400000))));const stateLabel=make('p',null,'ledger-help');stateLabel.id='ledger-draft-status';stateLabel.setAttribute('role','status');actions.append(stateLabel);const achievements=button('Achievements · '+earned.length+' earned',()=>{dashboardView='progress';state.openSections.relics=true;clearCelebrations();render();app.querySelector('[data-act="section"][data-key="relics"]')?.closest('.panel')?.scrollIntoView({block:'start'});});actions.append(achievements);log.prepend(actions);if(saveFeedback){const feedback=make('p',saveFeedback,'ledger-save-feedback');feedback.id='ledger-save-feedback';feedback.setAttribute('role','status');log.prepend(feedback);}const dateInput=log.querySelector('[data-act="logdate"]');dateInput.setAttribute('aria-label','Date to log');dateInput.parentNode.classList.add('ledger-date-row');const note=log.querySelector('[data-act="note"]');note?.setAttribute('aria-label','Daily note');}
      if(log){const heading=log.querySelector('.ledger-log-heading');if(heading){heading.firstElementChild.hidden=true;const count=heading.querySelector('.mono');count.textContent=HABITS.filter(h=>state.draft[h]>0).length+' activities entered';count.parentNode.classList.add('ledger-entry-count');}
        const counter=log.querySelector('#deckCounter');if(counter){const picker=make('select',null,'ledger-habit-picker');picker.id='ledger-habit-picker';picker.setAttribute('aria-label','Jump to a habit');for(const h of HABITS){const option=make('option',label(h));option.value=h;picker.append(option);}picker.value=HABITS[state.cardIndex];picker.addEventListener('change',()=>{goCard(HABITS.indexOf(picker.value));});counter.parentNode.firstElementChild.replaceWith(picker);}
      }
      const bar=app.querySelector('.appbar');if(bar){const jump=button('Log today',()=>selectDate(todayISO()));bar.after(jump);jump.classList.add('ledger-jump');}
      if(log&&HABITS.includes('Screen Discipline'))log.querySelector('[data-act="logdate"]')?.parentNode.after(screenPanel());
      if(log)log.querySelector('[data-act="logdate"]')?.parentNode.after(leisurePanel());
      paintLeisureClock();
      decorateRhythm(log,data);
      const saved=make('details',null,'ledger-history');saved.id='ledger-history';saved.open=historyOpen;const summary=make('summary','Saved days · '+state.days.length+(Object.keys(drafts.days).length?' · '+Object.keys(drafts.days).length+' drafts':''));saved.append(summary);saved.addEventListener('toggle',()=>historyOpen=saved.open);const dates=[...new Set([...state.days.filter(d=>d.date).map(d=>d.date),...Object.keys(drafts.days)])].sort().reverse();dates.slice(0,historyLimit).forEach(date=>{const d=drafts.days[date]||dayEntryFor(date),b=button(pretty(date)+(drafts.days[date]?' · Draft':''),()=>selectDate(date));b.classList.add('ledger-history-day');if(d.note)b.append(make('span',d.note,'ledger-help'));saved.append(b);});if(dates.length>historyLimit)saved.append(button('Show earlier days',()=>{historyLimit+=28;historyOpen=true;render();document.getElementById('ledger-history')?.scrollIntoView({block:'start'});}));if(!dates.length)saved.append(make('p','Your saved dates will appear here.'));if(state.days.some(d=>!d.date))saved.append(make('p','Undated legacy entries remain in your backup.'));log?.after(saved);
      for(const el of app.querySelectorAll('[data-act="toggle"],[data-act="num"],[data-act="inc"],[data-act="dec"]')){const h=el.dataset.habit;if(!h)continue;const act=el.dataset.act;el.setAttribute('aria-label',(act==='toggle'?'Mark complete: ':act==='inc'?'Increase ':act==='dec'?'Decrease ':'Amount for ')+label(h));if(act==='toggle')el.setAttribute('aria-pressed',String(state.draft[h]>0));}
      for(const el of app.querySelectorAll('[data-act="mood"]'))el.setAttribute('aria-pressed',String(state.draftMood===+el.dataset.v));
      const prev=document.getElementById('deckPrev'),next=document.getElementById('deckNext');if(prev){prev.disabled=state.cardIndex===0;prev.setAttribute('aria-label','Previous habit');}if(next)next.disabled=state.cardIndex>=HABITS.length-1;
      composeDashboard(log,data,earned);
      updateDeckChrome(state.cardIndex,HABITS.length);
      for(const mode of log?.querySelectorAll('[data-act="logmode"]')||[])mode.setAttribute('aria-pressed',String(mode.dataset.mode===state.logMode));
      paintLeisureClock();status();
      if(restoreControl)[...app.querySelectorAll('button')].find(b=>b.dataset.act===restoreControl.act&&b.dataset.habit===restoreControl.habit&&b.dataset.mode===restoreControl.mode&&b.dataset.key===restoreControl.key)?.focus({preventScroll:true});
    };
    app.addEventListener('click',e=>{
      const el=e.target.closest('[data-act]');if(!el)return;if(blocked||busy){e.stopImmediatePropagation();return;}
      const act=el.dataset.act;
      if(act==='toggle'&&el.dataset.habit==='Screen Discipline'&&state.draftLeisure?.screenConfirmed){e.stopImmediatePropagation();leisureMinutesDialog();return;}
      if(act==='achvAll')dashboardView='progress';
      if(act==='reset'){e.stopImmediatePropagation();return;}
      if(act==='settings'){e.stopImmediatePropagation();goalsDialog();}
      if(act==='clear'){e.stopImmediatePropagation();confirmAction('Clear this draft?','Saved days remain in your history. Save day is required to replace an existing entry.','Clear draft',()=>{state.draft=freshDraft();state.draftMood=0;state.draftNote='';state.draftScreen=emptyScreen();state.draftLeisure=emptyLeisure();state.draftMissed=[];remember();render();});}
      if(act==='delmetric'){e.stopImmediatePropagation();removeMetric(el.dataset.id);}
      if(act==='restoreHabits'){e.stopImmediatePropagation();confirmAction('Restore the default habits?','Original habit names, locations and visibility return. Your custom habits and saved entries stay.','Restore habits',()=>{for(const h of Object.keys(DEFAULT_HCFG))for(const field of ['renames','moves','hidden','crit'])delete userModel[field][h];saveModel();rebuildModel();render();});}
    },true);
    app.addEventListener('click',e=>{const act=e.target.closest('[data-act]')?.dataset.act;if(['toggle','inc','dec','mood','logmode'].includes(act)){state.draftMissed=(state.draftMissed||[]).filter(h=>!(state.draft[h]>0));remember();status();}});
    app.addEventListener('input',e=>{if(blocked||busy)return;const act=e.target.dataset.act;if(act==='note'){state.draftNote=e.target.value;remember();}else if(act==='num'){const text=e.target.value.trim(),n=text===''?0:Number(text),ok=finite(n)&&/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text);e.target.setAttribute('aria-invalid',String(!ok));if(ok){state.draft[e.target.dataset.habit]=n;if(n>0)state.draftMissed=(state.draftMissed||[]).filter(h=>h!==e.target.dataset.habit);remember();refreshCheckinState(e.target.dataset.habit);document.getElementById('ledger-leisure')?.replaceWith(leisurePanel());paintLeisureClock();}}});
    app.addEventListener('change',e=>{const el=e.target,act=el.dataset.act;if(act==='logdate'){e.stopImmediatePropagation();const date=el.value;if(!selectDate(date))el.value=state.logDate;}else if(act==='num'){e.stopImmediatePropagation();const text=el.value.trim(),n=text===''?0:Number(text);if(!finite(n)||!/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text)){el.setAttribute('aria-invalid','true');toast('Use a valid, non-negative number.');return;}else{state.draft[el.dataset.habit]=n;remember();}el.setAttribute('aria-invalid','false');document.getElementById('ledger-leisure')?.replaceWith(leisurePanel());paintLeisureClock();}},true);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('dialog[open]'))e.stopImmediatePropagation();},true);
    window.addEventListener('beforeunload',e=>{remember();if(failed.size||conflicts.size||pending.size||busy){e.preventDefault();e.returnValue='';}});
    function checkDay(){if(busy||blocked)return;const today=todayISO();if(today!==seenToday){const follow=state.logDate===seenToday;remember();seenToday=today;if(follow){state.logDate=today;loadDraftFor(today);}render();}}
    document.addEventListener('visibilitychange',()=>{if(document.hidden)remember();else{checkDay();render();}});
    window.addEventListener('hashchange',()=>{if(location.hash==='#today'){setDashboardView('today');selectDate(todayISO());}});
    window.addEventListener('pageshow',()=>{checkDay();render();});setInterval(checkDay,60000);
    setInterval(()=>{checkDay();paintLeisureClock();},1000);
    window.LedgerDays=Object.freeze({selectDate,setSeason,resetProgress,parseBackup,saveDay,remember,retry,saveRhythm,catchupDialog,goalDialog,focusDialog,get season(){return clone(season);},get drafts(){return clone(drafts);},get blocked(){return blocked;},get failed(){return failed.size;}});
    render();if(drafts.resetPending)finishProgressReset().then(()=>render());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
