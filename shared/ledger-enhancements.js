/* Calendar seasons and durable daily entries for the original Life Ledger. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='life-ledger')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ledger-enhancements.css?v=63f502ed4998',source).href;document.head.append(css);
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
    const resets={task:'Phone away · 10 minutes on my next task',read:'Phone away · read for 10 minutes',walk:'Phone away · take a 10-minute walk'};
    const emptyScreen=()=>({guardrail:'',slips:[]});
    const hasScreen=s=>!!s&&(!!s.guardrail||s.slips.length>0);
    const DEFAULT_LEISURE={habits:8,gaming:45,reading:20};
    const emptyLeisure=()=>({gamingMinutes:0,readingDone:false});
    const hasLeisure=l=>!!l&&(l.gamingMinutes>0||l.readingDone);
    function validLeisureRule(r){
      if(!plain(r)||!Number.isInteger(r.habits)||r.habits<1||r.habits>100||!Number.isInteger(r.gaming)||r.gaming<1||r.gaming>60||!Number.isInteger(r.reading)||r.reading<1||r.reading>120)throw Error('Use 1–100 habits, 1–60 gaming minutes and 1–120 reading minutes.');
    }
    function validLeisure(l){if(!plain(l)||!finite(l.gamingMinutes)||l.gamingMinutes>1440||typeof l.readingDone!=='boolean')throw Error('Invalid Earned Leisure entry.');}
    function validScreen(s){
      if(!plain(s)||!Object.hasOwn(guardrails,s.guardrail)||!Array.isArray(s.slips)||s.slips.length>100||s.slips.some(v=>!plain(v)||!Object.hasOwn(triggers,v.trigger)||!Object.hasOwn(resets,v.action)||typeof v.recovered!=='boolean'))throw Error('Invalid Screen Discipline entry.');
    }
    function validEntry(d){if(!plain(d)||!plain(d.units)||Object.values(d.units).some(v=>!finite(v))||d.note!==undefined&&typeof d.note!=='string'||d.mood!==undefined&&(!Number.isInteger(d.mood)||d.mood<0||d.mood>5))throw Error('A daily entry is invalid.');if(d.screen!==undefined)validScreen(d.screen);if(d.leisure!==undefined)validLeisure(d.leisure);}
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
        if(value.leisureRule!==undefined)validLeisureRule(value.leisureRule);
        if(value.leisureTimer!==undefined&&(!plain(value.leisureTimer)||!finite(value.leisureTimer.startedAt)||value.leisureTimer.startedAt===0))throw Error('Invalid leisure timer.');
        for(const [date,d]of Object.entries(value.days)){if(!validDate(date))throw Error('Invalid draft date.');validEntry(d);}
      }
      return value;
    }
    let season=clone(DEFAULT_SEASON),drafts={days:{},selected:todayISO(),mode:'list'},blocked=false,busy=false,importTicket=0,historyLimit=7,historyOpen=false,lastUndo=null;
    const failed=new Map(),pending=new Map(),boot=window.AtlasLedgerBoot||{raw:{},readError:false};
    try{
      if(boot.readError&&!window.storage)throw Error();
      for(const [field,key]of Object.entries(keys))if(boot.raw[key]!=null)validate(field,JSON.parse(boot.raw[key]));
      if(boot.raw[SEASONKEY])season=JSON.parse(boot.raw[SEASONKEY]);
      if(boot.raw[DRAFTKEY])drafts=JSON.parse(boot.raw[DRAFTKEY]);
    }catch{blocked=true;state.days=[];state.goals={};state.metrics=[];userModel={renames:{},moves:{},hidden:{},added:[],crit:{}};rebuildModel();}
    SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);
    const notice=make('section',null,'ledger-notice');notice.id='ledger-notice';notice.setAttribute('aria-live','polite');notice.setAttribute('role','status');
    const message=make('p');notice.append(message,button('Retry saving',retry),button('Back up current work',()=>exportData()),button('Restore backup',pickImport));document.body.append(notice);
    function status(){notice.hidden=!blocked&&!failed.size;message.textContent=blocked?'Saved records could not be read. Keep a recovery backup, then restore a valid Life Ledger backup.':'Your latest changes are in this tab but could not be saved. Retry or back up before closing.';app.inert=blocked||busy;const label=document.getElementById('ledger-draft-status');if(label)label.textContent=failed.size?'Not saved on this device':busy||pending.size?'Saving changes…':dirty()?'Draft saved on this device. Use Save day to log it.':dayEntryFor(state.logDate)?'Saved day':'New day';}
    function write(key,value){
      if(blocked){status();return false;}
      if(window.storage?.get&&window.storage?.set){const job=(pending.get(key)||Promise.resolve()).then(async()=>{try{await window.storage.set(key,value);if((await window.storage.get(key))?.value!==value)throw Error();failed.delete(key);return true;}catch{failed.set(key,value);return false;}finally{if(pending.get(key)===job)pending.delete(key);status();}});pending.set(key,job);status();return job;}
      try{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error();failed.delete(key);status();return true;}catch{failed.set(key,value);status();return false;}
    }
    store.set=write;
    async function retry(){if(blocked||busy)return;for(const [key,value]of [...failed])await write(key,value);status();}
    function currentEntry(){return {units:clone(state.draft),mood:state.draftMood||0,note:state.draftNote||'',...(hasScreen(state.draftScreen)?{screen:clone(state.draftScreen)}:{}),...(hasLeisure(state.draftLeisure)?{leisure:clone(state.draftLeisure)}:{})};}
    function dirty(){const saved=dayEntryFor(state.logDate);return HABITS.some(h=>(saved?.units?.[h]||0)!==(state.draft[h]||0))||(saved?.mood||0)!==(state.draftMood||0)||(saved?.note||'')!==(state.draftNote||'')||JSON.stringify(saved?.screen||emptyScreen())!==JSON.stringify(state.draftScreen||emptyScreen())||JSON.stringify(saved?.leisure||emptyLeisure())!==JSON.stringify(state.draftLeisure||emptyLeisure());}
    function remember(){if(blocked||busy||!validDate(state.draftFor))return;if(dirty())drafts.days[state.draftFor]=currentEntry();else delete drafts.days[state.draftFor];drafts.selected=state.draftFor;drafts.mode=state.logMode;write(DRAFTKEY,JSON.stringify(drafts));}
    const originalLoad=loadDraftFor;
    loadDraftFor=function(date){originalLoad(date);const d=drafts.days[date];if(d){state.draft={...freshDraft(),...clone(d.units)};state.draftMood=d.mood||0;state.draftNote=d.note||'';}state.draftScreen=clone((d||dayEntryFor(date))?.screen||emptyScreen());state.draftLeisure=clone((d||dayEntryFor(date))?.leisure||emptyLeisure());};
    let seenToday=todayISO();
    state.logMode=drafts.mode;state.logDate=validDate(drafts.selected)&&drafts.selected<=seenToday?drafts.selected:seenToday;loadDraftFor(state.logDate);
    function selectDate(date){if(blocked||busy||!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return false;}remember();state.logDate=date;loadDraftFor(date);drafts.selected=date;write(DRAFTKEY,JSON.stringify(drafts));state.cardIndex=0;render();document.getElementById('ledger-log')?.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});return true;}
    // Use calendar dates, count the complete final day, and keep entries outside the season as history.
    compute=function(allDays,goals){
      const today=todayISO(),now=isoToNum(today),end=SEASON_END+86400000;
      const days=(allDays||[]).filter(d=>validDate(d.date)&&d.date>=season.start&&d.date<=season.end&&d.date<=today).slice().sort((a,b)=>a.date.localeCompare(b.date)).map((d,i)=>({...d,day:i+1}));
      const elapsed=Math.max(0,Math.min(1,(now-SEASON_START)/(end-SEASON_START))),expectedLevel=elapsed*99,daysLeft=Math.max(0,Math.round((end-Math.max(now,SEASON_START))/86400000));
      const habit={},allKeys=[...new Set([...HABITS,...Object.keys(DEFAULT_HCFG)])];
      allKeys.forEach(h=>{const c=HCFG[h]||DEFAULT_HCFG[h],g=goals?.[h]>0?goals[h]:c.goal,total=days.reduce((sum,d)=>sum+(d.units[h]||0),0),exact=Math.min(99,total/g*99);const dm={};days.forEach(d=>{if(d.units[h]>0)dm[d.date]=1;});
        habit[h]={key:h,cfg:c,goal:g,total,doneDays:Object.keys(dm).length,exact,level:Math.floor(exact),pctTo99:exact/99,onPace:exact>=expectedLevel-.01,chunksDone:Math.floor(total/c.chunk),goalChunks:Math.round(g/c.chunk),streak:streaksFrom(dm).current};});
      const activePillars=PILLARS.filter(p=>p.habits.length),average=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0,canForecast=elapsed>.03&&days.length>=2&&activePillars.length>0;
      const pillars=PILLARS.map(p=>{const exact=average(p.habits.map(h=>habit[h].exact));return {...p,exact,level:Math.floor(exact),pctTo99:exact/99,onPace:exact>=expectedLevel-.01,proj:canForecast&&p.habits.length?Math.min(99,exact/elapsed):null};});
      const lifeExact=average(pillars.filter(p=>p.habits.length).map(p=>p.exact)),life={exact:lifeExact,level:Math.floor(lifeExact),pctTo99:lifeExact/99,onPace:lifeExact>=expectedLevel-.01,proj:canForecast?Math.min(99,lifeExact/elapsed):null};
      const sorted=pillars.slice().sort((a,b)=>b.exact-a.exact),balanced=!sorted.length||sorted[0].exact-sorted.at(-1).exact<=6;
      const running={};HABITS.forEach(h=>running[h]=0);const history=days.map(d=>{let done=0;HABITS.forEach(h=>{const v=d.units[h]||0;if(v>0)done++;running[h]+=v;});return {day:d.day,done,life:average(activePillars.map(p=>average(p.habits.map(h=>Math.min(99,running[h]/habit[h].goal*99)))))};});
      const dm=dateMap(days),streak=streaksFrom(dm),dates=Object.keys(dm).filter(k=>dm[k]>0),bestDay={count:0,date:null};dates.forEach(date=>{if(dm[date]>bestDay.count)Object.assign(bestDay,{count:dm[date],date});});
      return {habit,pillars,life,identity:balanced?'Everything Connected':'Led by '+sorted[0].title,balanced,history,days,consistency:average(days.map(d=>HABITS.filter(h=>d.units[h]>0).length/(HABITS.length||1))),active:streak.current,expectedLevel,daysLeft,elapsed,canForecast,lead:sorted[0],dateMap:dm,streak,bestDay,activeDays:dates.length};
    };
    // Rewards are derived from saved season records, including entries made before this fix.
    // No separate award store can drift from edits, Undo, imports or a new season.
    const meaningful=day=>Object.values(day.units).some(v=>v>0)||!!day.mood||!!day.note?.trim();
    const earnedDays=d=>d.days.filter(meaningful);
    function revise(name,desc,test){const a=ACHV.find(a=>a.name===name);if(a){a.desc=desc;a.test=test;}}
    for(const [name,count]of [['Season Opens',1],['Locked In',7],['Habit Formed',30],['Centurion',100]])revise(name,'Save '+(count===1?'your first day':count+' days')+' with a check-in or reflection',d=>earnedDays(d).length>=count);
    revise('Streak Keeper','Reach a 7-day active streak this season',d=>d.streak.longest>=7);
    revise('Perfect Day','Log every enabled habit in a day',d=>HABITS.length>0&&d.days.some(day=>HABITS.every(h=>day.units[h]>0)));
    revise('Ahead of Pace','Life Level above the target line after three saved days',d=>earnedDays(d).length>=3&&d.life.exact>0&&d.life.onPace);
    revise('Five for Five','All five values have progress and are on pace',d=>earnedDays(d).length>=3&&d.pillars.length===5&&d.pillars.every(p=>p.habits.length>0&&p.exact>0&&p.onPace));
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
    let saveFeedback='';
    const exactLabel=value=>value>0&&value<.01?'<0.01':(Math.floor((value+1e-10)*100)/100).toFixed(2);
    function clearCelebrations(){state.levelInfo=null;state.achvQueue=[];state.achvReview=false;}
    function celebrate(before,after,date){
      clearCelebrations();
      state.achvQueue=ACHV.filter(a=>a.test(after)&&!a.test(before));
      if(after.life.level>before.life.level)state.levelInfo={kicker:after.life.level===99?'Season Complete':'Level Up',title:'Life Level '+after.life.level,detail:'Your saved progress has reached a new level.'};
      else if(!state.achvQueue.length){
        const key=HABITS.find(k=>after.habit[k].chunksDone>before.habit[k].chunksDone);
        if(key){const h=after.habit[key];state.levelInfo={kicker:'Outcome Reached',title:h.chunksDone+' '+plural(h.cfg.noun,h.chunksDone),detail:label(key)+' · '+fmt(h.total)+' '+h.cfg.unit+' recorded this season.'};}
      }
      const changes=after.pillars.flatMap(p=>{const delta=p.exact-(before.pillars.find(old=>old.key===p.key)?.exact||0);return Math.abs(delta)>1e-10?[p.title+' '+(delta>0?'+':'−')+exactLabel(Math.abs(delta))]:[];});
      saveFeedback='Saved '+pretty(date)+' · '+(date<season.start||date>season.end?'Kept in history; outside this season.':changes.length?changes.join(' · '):'No change to value totals.');
      if(state.achvQueue.length)saveFeedback+=' · '+state.achvQueue.length+' new achievement'+(state.achvQueue.length===1?'':'s');
    }
    // Keep the original cards and constellation, but show the progress that whole levels hid.
    const originalPillar=pillarCard,originalConstellation=constellation;
    pillarCard=function(p,habit,expected,open){return originalPillar({...p,level:esc(exactLabel(p.exact))},habit,expected,open);};
    constellation=function(pillars,life,active){return originalConstellation(pillars.map(p=>({...p,level:esc(exactLabel(p.exact))})),{...life,level:esc(exactLabel(life.exact))},active).replace('font-size="19"','font-size="14"').replaceAll('font-size="11"','font-size="8"');};
    function confirmAction(title,body,label,fn){const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-confirm-title');const heading=make('h2',title);heading.id='ledger-confirm-title';const actions=make('div',null,'ledger-actions');actions.append(button('Cancel',()=>dialog.close()),button(label,async()=>{dialog.close();await fn();}));dialog.append(heading,make('p',body),actions);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
    async function saveDay(force=false){
      if(blocked||busy)return;const date=state.logDate;if(!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return;}
      if(Object.values(state.draft).some(v=>!finite(v))){toast('Use a valid, non-negative number for each entry.');return;}
      checkpointLeisureTimer(false);
      if(!HABITS.some(h=>state.draft[h]>0)&&!state.draftMood&&!state.draftNote.trim()&&!hasScreen(state.draftScreen)&&!hasLeisure(state.draftLeisure)&&!force){confirmAction('Save an empty day?','This records the date with no check-ins or note.','Save day',()=>saveDay(true));return;}
      remember();const progressBefore=compute(state.days,state.goals),before=dayEntryFor(date),entry={...clone(before||{}),date,units:clone(before?.units||{})};
      for(const h of HABITS){delete entry.units[h];if(state.draft[h]>0)entry.units[h]=state.draft[h];}
      delete entry.mood;delete entry.note;if(state.draftMood)entry.mood=state.draftMood;if(state.draftNote.trim())entry.note=state.draftNote.trim();
      delete entry.screen;if(hasScreen(state.draftScreen))entry.screen=clone(state.draftScreen);
      delete entry.leisure;if(hasLeisure(state.draftLeisure))entry.leisure=clone(state.draftLeisure);
      const next=state.days.filter(d=>d.date!==date).concat([entry]).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((d,i)=>({...d,day:i+1}));
      busy=true;status();const ok=await write(KEY,JSON.stringify(next));
      // A failed day save is retried explicitly with Save day, never as a stale queued snapshot.
      if(!ok){busy=false;failed.delete(KEY);failed.set(DRAFTKEY,JSON.stringify(drafts));status();toast('Day not logged. Your draft is still here. Retry saving, then use Save day.');return;}
      state.days=next;lastUndo={date,before:before?clone(before):null,after:JSON.stringify(dayEntryFor(date))};
      delete drafts.days[date];loadDraftFor(date);await write(DRAFTKEY,JSON.stringify(drafts));busy=false;celebrate(progressBefore,compute(state.days,state.goals),date);render();toast('Saved '+pretty(date),'Undo',undoLast);
    }
    commit=saveDay;
    undoLast=async function(){if(!lastUndo||blocked||busy)return;const undo=lastUndo,current=dayEntryFor(undo.date);if(JSON.stringify(current)!==undo.after){toast('That day has changed. Open it to edit the latest entry.');return;}remember();const next=state.days.filter(d=>d.date!==undo.date);if(undo.before)next.push(undo.before);next.sort((a,b)=>(a.date||'').localeCompare(b.date||''));busy=true;status();const ok=await write(KEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(KEY);status();toast('Undo could not be saved. Try Undo again.');return;}state.days=next;lastUndo=null;clearCelebrations();saveFeedback='Last day save undone.';if(state.logDate===undo.date)loadDraftFor(undo.date);write(DRAFTKEY,JSON.stringify(drafts));render();toast('Last day save undone.');};
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
    const leisureRule=()=>drafts.leisureRule||DEFAULT_LEISURE;
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
        entry.leisure={...emptyLeisure(),...entry.leisure};entry.leisure.gamingMinutes=Math.min(1440,entry.leisure.gamingMinutes+(until-cursor)/60000);
        drafts.days[date]=entry;if(date===state.logDate)state.draftLeisure=clone(entry.leisure);cursor=until;
      }
      if(stop||Date.now()-started>=86400000)delete drafts.leisureTimer;else drafts.leisureTimer.startedAt=Math.max(started,end);
    }
    function paintLeisureClock(){
      const usage=document.getElementById('leisure-usage'),clock=document.getElementById('leisure-clock');if(!usage||!clock)return;
      const rule=leisureRule(),earned=leisureCount(state.draft)>=rule.habits&&leisureCount(dayEntryFor(state.logDate)?.units)>=rule.habits?rule.gaming:0;
      const used=(state.draftLeisure?.gamingMinutes||0)+timerMinutes(state.logDate),remaining=earned-used;
      const time=n=>{const seconds=Math.round(Math.abs(n)*60);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');};
      usage.textContent=time(used)+' used · '+(remaining<0?time(remaining)+' over budget':time(remaining)+' remaining');
      usage.classList.toggle('ledger-leisure-over',remaining<0);
      clock.textContent=drafts.leisureTimer?(Date.now()-drafts.leisureTimer.startedAt>=86400000?'24-hour timer limit reached. Stop and review minutes.':remaining<=0?'Time is up. Stop the timer when you stop playing.':'Timer running · keeps time when you leave this app.'):'Gaming time for '+(state.logDate===todayISO()?'today':pretty(state.logDate));
    }
    function leisureMinutesDialog(){
      if(blocked||busy||drafts.leisureTimer)return;
      const date=state.logDate,dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','leisure-minutes-title');
      const title=make('h2','Gaming time · '+pretty(date));title.id='leisure-minutes-title';
      const form=make('form'),label=make('label','Total gaming minutes for this day'),input=make('input'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');
      input.type='number';input.inputMode='decimal';input.min='0';input.max='1440';input.step='any';input.required=true;input.value=fmt(state.draftLeisure?.gamingMinutes||0);input.id='leisure-manual-minutes';label.append(input);
      const actions=make('div',null,'ledger-actions'),submit=make('button','Save minutes','ledger-button');submit.type='submit';actions.append(button('Cancel',()=>dialog.close()),submit);form.append(label,error,actions);
      form.addEventListener('submit',e=>{
        e.preventDefault();if(blocked||busy||state.logDate!==date)return;
        const minutes=Number(input.value);if(input.value.trim()===''||!finite(minutes)||minutes>1440){error.textContent='Enter 0–1,440 minutes.';return;}
        state.draftLeisure={...(state.draftLeisure||emptyLeisure()),gamingMinutes:minutes};remember();render();dialog.close();toast('Minutes kept in your draft. Save day to log them.');
      });
      dialog.append(title,make('p','Include gaming outside the timer. You can record more than your allowance to keep the tracking honest.','ledger-help'),form);
      dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('leisure-minutes')?.focus();});document.body.append(dialog);dialog.showModal();input.focus();input.select();
    }
    function leisureSettings(){
      if(blocked||busy)return;
      const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-leisure-settings-title');
      const title=make('h2','Earned Leisure settings');title.id='ledger-leisure-settings-title';
      const form=make('form'),error=make('p',null,'ledger-error'),fields={};error.setAttribute('role','alert');
      for(const [key,text,max]of [['habits','Completed habits to unlock',100],['gaming','Gaming minutes',60],['reading','Reading Reset minutes',120]]){
        const label=make('label',text),input=make('input');input.type='number';input.inputMode='numeric';input.min='1';input.max=String(max);input.step='1';input.required=true;input.value=leisureRule()[key];input.id='leisure-rule-'+key;label.append(input);form.append(label);fields[key]=input;
      }
      const actions=make('div',null,'ledger-actions'),submit=make('button','Save rule','ledger-button');submit.type='submit';
      actions.append(button('Cancel',()=>dialog.close()),submit);form.append(error,actions);
      form.addEventListener('submit',async e=>{
        e.preventDefault();if(blocked||busy)return;
        try{
          const rule=Object.fromEntries(Object.entries(fields).map(([k,input])=>[k,Number(input.value)]));validLeisureRule(rule);
          if(rule.habits>leisureHabits().length)throw Error('Choose no more than '+leisureHabits().length+' enabled habits. Screen Discipline is excluded.');
          remember();drafts.leisureRule=rule;submit.disabled=true;const ok=await write(DRAFTKEY,JSON.stringify(drafts));
          render();if(ok){dialog.close();toast('Leisure rule saved.');}else error.textContent='Rule is only in this tab. Retry Save rule before closing.';
        }catch(err){error.textContent=err.message;}finally{submit.disabled=false;}
      });
      dialog.append(title,form);dialog.addEventListener('close',()=>{dialog.remove();document.getElementById('leisure-settings')?.focus();});document.body.append(dialog);dialog.showModal();fields.habits.focus();
    }
    function leisurePanel(){
      const date=state.logDate,rule=leisureRule(),count=leisureCount(state.draft),savedCount=leisureCount(dayEntryFor(date)?.units),l=state.draftLeisure||emptyLeisure();
      const unlocked=count>=rule.habits&&savedCount>=rule.habits,today=date===todayISO();
      const panel=make('section',null,'ledger-screen ledger-leisure');panel.id='ledger-leisure';panel.setAttribute('aria-labelledby','ledger-leisure-title');
      const heading=make('div',null,'ledger-screen-heading'),title=make('h3','Earned Leisure');title.id='ledger-leisure-title';
      const info=make('details',null,'ledger-progress-info'),summary=make('summary','i');summary.setAttribute('aria-label','How Earned Leisure works');info.open=leisureInfoOpen;info.addEventListener('toggle',()=>leisureInfoOpen=info.open);
      info.append(summary,make('p','Save '+rule.habits+' completed habits to unlock '+rule.gaming+' minutes of gaming for that date. Each habit counts once; Screen Discipline is excluded. No banking or carryover. Below target, finish with '+rule.reading+' extra minutes of reading. A Reading Reset does not unlock gaming or add habit credit. Gaming still counts toward your combined screen-time limit. This is a manual commitment, not an app blocker.','ledger-help'));
      const amounts=leisureHabits().filter(h=>HCFG[h].kind!=='count').map(h=>label(h)+': '+leisureTarget(h)+' '+HCFG[h].unit);
      if(amounts.length)info.append(make('p','A full quantity check-in: '+amounts.join(' · ')+'.','ledger-help'));
      heading.append(title,info);panel.append(heading);
      const progress=make('p',count+' / '+rule.habits+' completed · '+savedCount+' saved','ledger-leisure-progress');progress.id='leisure-progress';panel.append(progress);
      const meter=make('progress');meter.max=rule.habits;meter.value=Math.min(count,rule.habits);meter.setAttribute('aria-label','Completed habits toward gaming');panel.append(meter);
      const statusText=unlocked?rule.gaming+' minutes of gaming unlocked.':count>=rule.habits?'Save day to unlock '+rule.gaming+' minutes of gaming.':(rule.habits-count)+' more to unlock '+rule.gaming+' minutes of gaming.';
      const feedback=make('p',statusText,'ledger-help');feedback.id='leisure-status';feedback.setAttribute('role','status');panel.append(feedback);
      if(rule.habits>leisureHabits().length)panel.append(make('p','Only '+leisureHabits().length+' habits are enabled. Edit the rule or restore habits to make this target reachable.','ledger-help'));
      const record=(key,value)=>{
        if(blocked||busy||date!==state.logDate)return;
        if(today&&date!==todayISO()){checkDay();toast('The day changed. Use today’s leisure controls.');return;}
        state.draftLeisure={...(state.draftLeisure||emptyLeisure()),[key]:value};remember();render();document.getElementById('leisure-'+key)?.focus();
      };
      const usage=make('p',null,'ledger-leisure-progress');usage.id='leisure-usage';panel.append(usage);
      const clock=make('p',null,'ledger-help');clock.id='leisure-clock';panel.append(clock);
      const timerActions=make('div',null,'ledger-actions');
      if(drafts.leisureTimer)timerActions.append(button('Stop gaming timer',()=>{if(blocked||busy)return;checkpointLeisureTimer(true);remember();render();toast('Gaming minutes kept in your draft. Save day to log them.');}));
      else if(today)timerActions.append(button(unlocked?'Start gaming timer':'Track unearned gaming',()=>{
        if(blocked||busy||drafts.leisureTimer)return;
        if(date!==todayISO()||state.logDate!==date){checkDay();return;}
        remember();drafts.leisureTimer={startedAt:Date.now()};write(DRAFTKEY,JSON.stringify(drafts));render();
      }));
      const manual=button('Edit gaming minutes',leisureMinutesDialog);manual.id='leisure-minutes';manual.disabled=!!drafts.leisureTimer;timerActions.append(manual);panel.append(timerActions);
      if(!unlocked||l.readingDone){
        panel.append(make('p',l.readingDone?'Reading Reset complete.':'Finishing below target? Reading Reset · '+rule.reading+' extra minutes.','ledger-help'));
        const reset=button(l.readingDone?'Undo Reading Reset':'I completed my Reading Reset',()=>record('readingDone',!l.readingDone));reset.id='leisure-readingDone';panel.append(reset);
      }
      if(JSON.stringify(dayEntryFor(date)?.leisure||emptyLeisure())!==JSON.stringify(l))panel.append(make('p','Check-in kept in your draft. Save day to log it.','ledger-help'));
      if(!today)panel.append(make('p',pretty(date)+' · This allowance cannot be used today.','ledger-help'));
      const history=make('details',null,'ledger-screen-patterns');history.open=leisureHistoryOpen;history.addEventListener('toggle',()=>leisureHistoryOpen=history.open);
      const rows=make('ul');let total=0;
      for(let i=6;i>=0;i--){const day=numToISO(isoToNum(date)-i*86400000),entry=day===state.logDate?{leisure:state.draftLeisure}:(drafts.days[day]||dayEntryFor(day)),minutes=(entry?.leisure?.gamingMinutes||0)+timerMinutes(day);total+=minutes;rows.append(make('li',pretty(day)+' · '+(minutes>0?fmt(minutes)+' min gaming':'No gaming time logged')));}
      history.append(make('summary','Last 7 days · '+fmt(total)+' min gaming'),rows);panel.append(history);
      const edit=button('Edit leisure rule',leisureSettings);edit.id='leisure-settings';panel.append(edit);
      return panel;
    }
    const originalQuest=questLog,originalSettings=settingsView,originalDeckChrome=updateDeckChrome;
    function withLiteralUnits(fn){const units=Object.fromEntries(Object.entries(HCFG).map(([key,c])=>[key,c.unit]));try{Object.values(HCFG).forEach(c=>c.unit=esc(c.unit));return fn();}finally{for(const [key,unit]of Object.entries(units))HCFG[key].unit=unit;}}
    questLog=function(draft){const days=compute(state.days,state.goals).days,existing=days.find(d=>d.date===state.logDate),count=days.filter(d=>d.date<=state.logDate).length;const draw=()=>originalQuest(draft,existing?.day||count+1);return state.logMode==='list'?withLiteralUnits(draw):draw();};
    settingsView=function(){return withLiteralUnits(()=>originalSettings());};
    updateDeckChrome=function(idx,n){originalDeckChrome(idx,n);const prev=document.getElementById('deckPrev'),next=document.getElementById('deckNext');if(prev)prev.disabled=idx===0;if(next)next.disabled=idx>=n-1;};
    const originalLevelView=levelUpView,originalAchievementView=achvView;
    function rewardDialog(markup){return markup.replace('<div class="overlay"','<dialog class="overlay ledger-reward"').replace(/<\/div>$/, '</dialog>');}
    levelUpView=info=>rewardDialog(originalLevelView(info));
    achvView=()=>rewardDialog(originalAchievementView());
    let rewardOpener=null,progressInfoOpen=false;
    const originalRender=render;
    render=function(){
      if(!rewardOpener&&(state.levelInfo||state.achvQueue?.length)){const active=document.activeElement;rewardOpener=active?.dataset?.act==='relic'?'[data-act="relic"][data-idx="'+active.dataset.idx+'"]':'[data-act="commit"]';}
      originalRender();
      const data=compute(state.days,state.goals),earned=ACHV.filter(a=>a.test(data));
      for(const heading of app.querySelectorAll('.eyebrow'))if(heading.textContent.startsWith('The Five Values')){
        const info=make('details',null,'ledger-progress-info'),summary=make('summary','i');summary.setAttribute('aria-label','How values and achievements work');info.open=progressInfoOpen;info.addEventListener('toggle',()=>progressInfoOpen=info.open);
        info.append(summary,make('p','Each habit earns a share of its season goal, up to 99. A value averages its enabled habits; Life Level averages your active values. Decimal numbers show progress between whole levels. Only Save day counts toward values and achievements. Editing a saved date replaces its totals. Achievements use saved days in the current season, including earlier entries.','ledger-help'));heading.after(info);
      }
      const reward=app.querySelector('dialog.ledger-reward');
      if(reward){reward.setAttribute('aria-label',state.levelInfo?.title||state.achvQueue[0]?.name||'Achievement');reward.addEventListener('cancel',e=>{e.preventDefault();clearCelebrations();render();});reward.showModal();}
      else if(rewardOpener){app.querySelector(rewardOpener)?.focus();rewardOpener=null;}
      for(const relic of app.querySelectorAll('[data-act="relic"]')){const a=ACHV[+relic.dataset.idx];relic.setAttribute('role','button');relic.setAttribute('tabindex','0');relic.setAttribute('aria-label',a.name+(a.test(data)?' · Earned':' · Locked'));relic.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();relic.click();}});}

      const log=app.querySelector('[data-act="logdate"]')?.closest('.panel');if(log){log.id='ledger-log';const actions=make('div',null,'ledger-actions');actions.append(button('Today',()=>selectDate(todayISO())),button('Yesterday',()=>selectDate(numToISO(isoToNum(todayISO())-86400000))));const stateLabel=make('p',null,'ledger-help');stateLabel.id='ledger-draft-status';stateLabel.setAttribute('role','status');actions.append(stateLabel);const achievements=button('Achievements · '+earned.length+' earned',()=>{state.openSections.relics=true;clearCelebrations();render();app.querySelector('[data-act="section"][data-key="relics"]')?.closest('.panel')?.scrollIntoView({block:'start'});});actions.append(achievements);log.prepend(actions);if(saveFeedback){const feedback=make('p',saveFeedback,'ledger-save-feedback');feedback.id='ledger-save-feedback';feedback.setAttribute('role','status');log.prepend(feedback);}const dateInput=log.querySelector('[data-act="logdate"]');dateInput.setAttribute('aria-label','Date to log');dateInput.parentNode.classList.add('ledger-date-row');const note=log.querySelector('[data-act="note"]');note?.setAttribute('aria-label','Daily note');}
      const bar=app.querySelector('.appbar');if(bar){const jump=button('Log today',()=>selectDate(todayISO()));bar.after(jump);jump.classList.add('ledger-jump');}
      if(log&&HABITS.includes('Screen Discipline'))log.querySelector('[data-act="logdate"]')?.parentNode.after(screenPanel());
      if(log)log.querySelector('[data-act="logdate"]')?.parentNode.after(leisurePanel());
      paintLeisureClock();
      const seasonInfo=make('section',null,'ledger-season-summary');seasonInfo.id='ledger-season-summary';const archived=state.days.filter(d=>!d.date||d.date<season.start||d.date>season.end).length;seasonInfo.append(make('strong',todayISO()<season.start?'Season starts '+pretty(season.start):'Season: '+pretty(season.start)+' to '+pretty(season.end)),make('p',archived+' earlier or outside-season entries kept in Saved days.'));if(log)log.before(seasonInfo);
      if(state.logDate<season.start||state.logDate>season.end){const info=make('p','This date is outside the current season. Saving keeps it in your history.','ledger-help');log?.prepend(info);}
      const reset=app.querySelector('[data-act="reset"]');if(reset)reset.textContent='Start new season';
      for(const label of app.querySelectorAll('.eyebrow')){if(label.textContent.startsWith('Season · '))label.textContent='Season · '+pretty(season.start)+' → '+pretty(season.end);if(label.textContent.startsWith('Forecast · Projected finish'))label.textContent='Forecast · Projected finish ('+pretty(season.end)+')';}
      const saved=make('details',null,'ledger-history');saved.id='ledger-history';saved.open=historyOpen;const summary=make('summary','Saved days · '+state.days.length+(Object.keys(drafts.days).length?' · '+Object.keys(drafts.days).length+' drafts':''));saved.append(summary);saved.addEventListener('toggle',()=>historyOpen=saved.open);const dates=[...new Set([...state.days.filter(d=>d.date).map(d=>d.date),...Object.keys(drafts.days)])].sort().reverse();dates.slice(0,historyLimit).forEach(date=>{const d=drafts.days[date]||dayEntryFor(date),b=button(pretty(date)+(drafts.days[date]?' · Draft':'')+(date<season.start||date>season.end?' · Outside season':''),()=>selectDate(date));b.classList.add('ledger-history-day');if(d.note)b.append(make('span',d.note,'ledger-help'));saved.append(b);});if(dates.length>historyLimit)saved.append(button('Show earlier days',()=>{historyLimit+=28;historyOpen=true;render();document.getElementById('ledger-history')?.scrollIntoView({block:'start'});}));if(!dates.length)saved.append(make('p','Your saved dates will appear here.'));if(state.days.some(d=>!d.date))saved.append(make('p','Undated legacy entries remain in your backup.'));log?.after(saved);
      for(const el of app.querySelectorAll('[data-act="toggle"],[data-act="num"],[data-act="inc"],[data-act="dec"]')){const h=el.dataset.habit;if(!h)continue;const act=el.dataset.act;el.setAttribute('aria-label',(act==='toggle'?'Mark complete: ':act==='inc'?'Increase ':act==='dec'?'Decrease ':'Amount for ')+label(h));if(act==='toggle')el.setAttribute('aria-pressed',String(state.draft[h]>0));}
      for(const el of app.querySelectorAll('[data-act="mood"]'))el.setAttribute('aria-pressed',String(state.draftMood===+el.dataset.v));
      const prev=document.getElementById('deckPrev'),next=document.getElementById('deckNext');if(prev){prev.disabled=state.cardIndex===0;prev.setAttribute('aria-label','Previous habit');}if(next)next.disabled=state.cardIndex>=HABITS.length-1;
      status();
    };
    app.addEventListener('click',e=>{
      const el=e.target.closest('[data-act]');if(!el)return;if(blocked||busy){e.stopImmediatePropagation();return;}
      const act=el.dataset.act;
      if(act==='reset'){e.stopImmediatePropagation();remember();seasonDialog();}
      if(act==='clear'){e.stopImmediatePropagation();confirmAction('Clear this draft?','Saved days remain in your history. Save day is required to replace an existing entry.','Clear draft',()=>{state.draft=freshDraft();state.draftMood=0;state.draftNote='';state.draftScreen=emptyScreen();state.draftLeisure=emptyLeisure();remember();render();});}
      if(act==='delmetric'){e.stopImmediatePropagation();removeMetric(el.dataset.id);}
      if(act==='restoreHabits'){e.stopImmediatePropagation();confirmAction('Restore the default habits?','Original habit names, locations and visibility return. Your custom habits and saved entries stay.','Restore habits',()=>{for(const h of Object.keys(DEFAULT_HCFG))for(const field of ['renames','moves','hidden','crit'])delete userModel[field][h];saveModel();rebuildModel();render();});}
    },true);
    app.addEventListener('click',e=>{const act=e.target.closest('[data-act]')?.dataset.act;if(['toggle','inc','dec','mood','logmode'].includes(act)){remember();status();}});
    app.addEventListener('input',e=>{if(blocked||busy)return;const act=e.target.dataset.act;if(act==='note'){state.draftNote=e.target.value;remember();}else if(act==='num'){const text=e.target.value.trim(),n=text===''?0:Number(text),ok=finite(n)&&/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text);e.target.setAttribute('aria-invalid',String(!ok));if(ok){state.draft[e.target.dataset.habit]=n;remember();document.getElementById('ledger-leisure')?.replaceWith(leisurePanel());paintLeisureClock();}}});
    app.addEventListener('change',e=>{const el=e.target,act=el.dataset.act;if(act==='logdate'){e.stopImmediatePropagation();const date=el.value;if(!selectDate(date))el.value=state.logDate;}else if(act==='num'){e.stopImmediatePropagation();const text=el.value.trim(),n=text===''?0:Number(text);if(!finite(n)||!/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text)){el.value=state.draft[el.dataset.habit]||0;toast('Use a valid, non-negative number.');}else{state.draft[el.dataset.habit]=n;remember();}el.setAttribute('aria-invalid','false');document.getElementById('ledger-leisure')?.replaceWith(leisurePanel());paintLeisureClock();}},true);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('dialog[open]'))e.stopImmediatePropagation();},true);
    window.addEventListener('beforeunload',e=>{remember();if(failed.size||pending.size||busy){e.preventDefault();e.returnValue='';}});
    function checkDay(){if(busy||blocked)return;const today=todayISO();if(today!==seenToday){const follow=state.logDate===seenToday;remember();seenToday=today;if(follow){state.logDate=today;loadDraftFor(today);}render();}}
    document.addEventListener('visibilitychange',()=>{if(document.hidden)remember();else{checkDay();render();}});
    window.addEventListener('pageshow',()=>{checkDay();render();});setInterval(checkDay,60000);
    setInterval(()=>{checkDay();paintLeisureClock();},1000);
    window.LedgerDays=Object.freeze({selectDate,setSeason,parseBackup,saveDay,remember,retry,get season(){return clone(season);},get drafts(){return clone(drafts);},get blocked(){return blocked;},get failed(){return failed.size;}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
