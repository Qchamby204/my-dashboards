/* Calendar seasons and durable daily entries for the original Life Ledger. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='life-ledger')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('ledger-enhancements.css',source).href;document.head.append(css);
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
    function validEntry(d){if(!plain(d)||!plain(d.units)||Object.values(d.units).some(v=>!finite(v))||d.note!==undefined&&typeof d.note!=='string'||d.mood!==undefined&&(!Number.isInteger(d.mood)||d.mood<0||d.mood>5))throw Error('A daily entry is invalid.');}
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
    function status(){notice.hidden=!blocked&&!failed.size;message.textContent=blocked?'Saved records could not be read. Keep a recovery backup, then restore a valid Life Ledger backup.':'Your latest changes are in this tab but could not be saved. Retry or back up before closing.';app.inert=blocked||busy;const label=document.getElementById('ledger-draft-status');if(label)label.textContent=failed.size?'Not saved on this device':dirty()?'Draft saved on this device. Use Save day to log it.':dayEntryFor(state.logDate)?'Saved day':'New day';}
    function write(key,value){
      if(blocked){status();return false;}
      if(window.storage?.get&&window.storage?.set){const job=(pending.get(key)||Promise.resolve()).then(async()=>{try{await window.storage.set(key,value);if((await window.storage.get(key))?.value!==value)throw Error();failed.delete(key);return true;}catch{failed.set(key,value);return false;}finally{status();}});pending.set(key,job);return job;}
      try{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error();failed.delete(key);status();return true;}catch{failed.set(key,value);status();return false;}
    }
    store.set=write;
    async function retry(){if(blocked||busy)return;for(const [key,value]of [...failed])await write(key,value);status();}
    function currentEntry(){return {units:clone(state.draft),mood:state.draftMood||0,note:state.draftNote||''};}
    function dirty(){const saved=dayEntryFor(state.logDate);return HABITS.some(h=>(saved?.units?.[h]||0)!==(state.draft[h]||0))||(saved?.mood||0)!==(state.draftMood||0)||(saved?.note||'')!==(state.draftNote||'');}
    function remember(){if(blocked||busy||!validDate(state.draftFor))return;if(dirty())drafts.days[state.draftFor]=currentEntry();else delete drafts.days[state.draftFor];drafts.selected=state.draftFor;drafts.mode=state.logMode;write(DRAFTKEY,JSON.stringify(drafts));}
    const originalLoad=loadDraftFor;
    loadDraftFor=function(date){originalLoad(date);const d=drafts.days[date];if(d){state.draft={...freshDraft(),...clone(d.units)};state.draftMood=d.mood||0;state.draftNote=d.note||'';}};
    let seenToday=todayISO();
    state.logMode=drafts.mode;state.logDate=seenToday;loadDraftFor(state.logDate);
    function selectDate(date){if(blocked||busy||!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return false;}remember();state.logDate=date;loadDraftFor(date);drafts.selected=date;write(DRAFTKEY,JSON.stringify(drafts));state.cardIndex=0;render();document.getElementById('ledger-log')?.scrollIntoView({behavior:'smooth',block:'start'});return true;}
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
    function confirmAction(title,body,label,fn){const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-confirm-title');const heading=make('h2',title);heading.id='ledger-confirm-title';const actions=make('div',null,'ledger-actions');actions.append(button('Cancel',()=>dialog.close()),button(label,async()=>{dialog.close();await fn();}));dialog.append(heading,make('p',body),actions);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
    async function saveDay(force=false){
      if(blocked||busy)return;const date=state.logDate;if(!validDate(date)||date>todayISO()){toast('Choose today or an earlier date.');return;}
      if(Object.values(state.draft).some(v=>!finite(v))){toast('Use a valid, non-negative number for each entry.');return;}
      if(!HABITS.some(h=>state.draft[h]>0)&&!state.draftMood&&!state.draftNote.trim()&&!force){confirmAction('Save an empty day?','This records the date with no check-ins or note.','Save day',()=>saveDay(true));return;}
      remember();const before=dayEntryFor(date),entry={...clone(before||{}),date,units:clone(before?.units||{})};
      for(const h of HABITS){delete entry.units[h];if(state.draft[h]>0)entry.units[h]=state.draft[h];}
      delete entry.mood;delete entry.note;if(state.draftMood)entry.mood=state.draftMood;if(state.draftNote.trim())entry.note=state.draftNote.trim();
      const next=state.days.filter(d=>d.date!==date).concat([entry]).sort((a,b)=>(a.date||'').localeCompare(b.date||'')).map((d,i)=>({...d,day:i+1}));
      busy=true;status();const ok=await write(KEY,JSON.stringify(next));busy=false;
      // A failed day save is retried explicitly with Save day, never as a stale queued snapshot.
      if(!ok){failed.delete(KEY);failed.set(DRAFTKEY,JSON.stringify(drafts));status();toast('Day not logged. Your draft is still here. Retry saving, then use Save day.');return;}
      state.days=next;lastUndo={date,before:before?clone(before):null,after:JSON.stringify(dayEntryFor(date))};
      delete drafts.days[date];loadDraftFor(date);await write(DRAFTKEY,JSON.stringify(drafts));render();toast('Saved '+pretty(date),'Undo',undoLast);
    }
    commit=saveDay;
    undoLast=async function(){if(!lastUndo||blocked||busy)return;const undo=lastUndo,current=dayEntryFor(undo.date);if(JSON.stringify(current)!==undo.after){toast('That day has changed. Open it to edit the latest entry.');return;}remember();const next=state.days.filter(d=>d.date!==undo.date);if(undo.before)next.push(undo.before);next.sort((a,b)=>(a.date||'').localeCompare(b.date||''));busy=true;status();const ok=await write(KEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(KEY);status();toast('Undo could not be saved. Try Undo again.');return;}state.days=next;lastUndo=null;delete drafts.days[undo.date];if(state.logDate===undo.date)loadDraftFor(undo.date);write(DRAFTKEY,JSON.stringify(drafts));render();toast('Last day save undone.');};
    async function setSeason(next){validate('season',next);if(blocked||busy)return false;busy=true;status();const ok=await write(SEASONKEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(SEASONKEY);status();toast('Season date was not saved. Try again.');return false;}season=clone(next);SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);state.levelInfo=null;state.achvQueue=[];render();toast('Season starts '+pretty(season.start)+'. Earlier days are kept.');return true;}
    function seasonDialog(){const dialog=make('dialog',null,'ledger-dialog');dialog.setAttribute('aria-labelledby','ledger-season-title');const heading=make('h2','Start a new season');heading.id='ledger-season-title';const form=make('form'),startLabel=make('label','Start date'),start=make('input'),endLabel=make('label','End date'),end=make('input'),error=make('p',null,'ledger-error');error.setAttribute('role','alert');start.type=end.type='date';start.required=end.required=true;start.value=numToISO(isoToNum(todayISO())+86400000);end.value=season.end<start.value?start.value.slice(0,4)+'-12-31':season.end;startLabel.append(start);endLabel.append(end);const actions=make('div',null,'ledger-actions'),submit=make('button','Start season','ledger-button');submit.type='submit';actions.append(button('Cancel',()=>dialog.close()),submit);form.append(startLabel,endLabel,error,actions);form.addEventListener('submit',async e=>{e.preventDefault();try{validate('season',{start:start.value,end:end.value});submit.disabled=true;if(await setSeason({start:start.value,end:end.value}))dialog.close();else error.textContent='Could not save the season. Try again.';}catch(err){error.textContent=err.message;}finally{submit.disabled=false;}});dialog.append(heading,make('p','Earlier days stay in Saved days and your backup. Only dates within the new season count toward its totals.'),form);dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}
    function parseBackup(o){if(Array.isArray(o))o={days:o};if(!plain(o)||o.app!==undefined&&o.app!=='life-ledger'||o.version!==undefined&&![1,2,3].includes(o.version))throw Error('Choose a Life Ledger backup.');const out={};for(const field of Object.keys(keys))if(Object.hasOwn(o,field))out[field]=clone(validate(field,o[field]));if(!out.days)throw Error('No saved days in this file.');return out;}
    function payload(){return {app:'life-ledger',version:3,exportedAt:new Date().toISOString(),days:state.days,goals:state.goals,model:userModel,metrics:state.metrics,season,drafts};}
    exportData=function(){remember();const data=blocked?{app:'life-ledger-recovery',version:1,records:boot.raw}:payload();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=blocked?'life-ledger-original-records.json':'life-ledger-'+todayISO()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('Backup prepared. Save the file in Files or Downloads.');};
    importData=async function(file){if(busy)return;const ticket=++importTicket;try{if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const next=parseBackup(JSON.parse(await file.text()));if(ticket!==importTicket)return;confirmAction('Restore Life Ledger?',next.days.length+' saved days will replace this history. '+(next.drafts?'The backup also replaces unfinished drafts.':'Current unfinished drafts and season dates stay unless included in the backup.')+(blocked?' Keep a recovery backup before replacing unreadable records.':''),'Restore backup',async()=>{if(ticket!==importTicket||busy)return;const all={...clone(payload()),...next};blocked=false;busy=true;failed.clear();state.days=all.days;state.goals=all.goals;state.metrics=all.metrics;userModel=all.model;season=all.season;drafts=all.drafts;rebuildModel();SEASON_START=isoToNum(season.start);SEASON_END=isoToNum(season.end);lastUndo=null;state.logMode=drafts.mode;state.logDate=drafts.selected<=todayISO()?drafts.selected:todayISO();loadDraftFor(state.logDate);for(const [field,key]of Object.entries(keys))await write(key,JSON.stringify(all[field]));busy=false;render();toast(failed.size?'Restored in this tab. Retry saving or keep a backup.':'Backup restored on this device.');});}catch(err){toast(err.message||'Could not read this backup.');}};
    function pickImport(){const input=make('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{if(input.files?.[0])importData(input.files[0]);});input.click();}
    function removeMetric(id){const removed=state.metrics.find(m=>m.id===id);if(!removed)return;confirmAction('Delete this metric?','This removes the metric and its readings from this device. An Undo action follows.','Delete metric',async()=>{const next=state.metrics.filter(m=>m.id!==id);busy=true;status();const ok=await write(METRICKEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(METRICKEY);status();toast('Metric was not deleted. Try again.');return;}state.metrics=next;render();toast('Metric deleted.','Undo',async()=>{if(state.metrics.some(m=>m.id===id)||busy)return;const restored=[...state.metrics,removed];busy=true;status();const saved=await write(METRICKEY,JSON.stringify(restored));busy=false;if(saved){state.metrics=restored;render();}else{failed.delete(METRICKEY);status();toast('Could not restore the metric. Keep a backup before closing.');}});});}
    const originalQuest=questLog,originalSettings=settingsView,originalDeckChrome=updateDeckChrome;
    function withLiteralUnits(fn){const units=Object.fromEntries(Object.entries(HCFG).map(([key,c])=>[key,c.unit]));try{Object.values(HCFG).forEach(c=>c.unit=esc(c.unit));return fn();}finally{for(const [key,unit]of Object.entries(units))HCFG[key].unit=unit;}}
    questLog=function(draft){const days=compute(state.days,state.goals).days,existing=days.find(d=>d.date===state.logDate),count=days.filter(d=>d.date<=state.logDate).length;const draw=()=>originalQuest(draft,existing?.day||count+1);return state.logMode==='list'?withLiteralUnits(draw):draw();};
    settingsView=function(){return withLiteralUnits(()=>originalSettings());};
    updateDeckChrome=function(idx,n){originalDeckChrome(idx,n);const prev=document.getElementById('deckPrev'),next=document.getElementById('deckNext');if(prev)prev.disabled=idx===0;if(next)next.disabled=idx>=n-1;};
    const originalRender=render;
    render=function(){originalRender();
      const log=app.querySelector('[data-act="logdate"]')?.closest('.panel');if(log){log.id='ledger-log';const actions=make('div',null,'ledger-actions');actions.append(button('Today',()=>selectDate(todayISO())),button('Yesterday',()=>selectDate(numToISO(isoToNum(todayISO())-86400000))));const stateLabel=make('p',null,'ledger-help');stateLabel.id='ledger-draft-status';stateLabel.setAttribute('role','status');actions.append(stateLabel);log.prepend(actions);const dateInput=log.querySelector('[data-act="logdate"]');dateInput.setAttribute('aria-label','Date to log');dateInput.parentNode.classList.add('ledger-date-row');const note=log.querySelector('[data-act="note"]');note?.setAttribute('aria-label','Daily note');}
      const bar=app.querySelector('.appbar');if(bar){const jump=button('Log today',()=>selectDate(todayISO()));bar.after(jump);jump.classList.add('ledger-jump');}
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
      if(act==='clear'){e.stopImmediatePropagation();confirmAction('Clear this draft?','Saved days remain in your history. Save day is required to replace an existing entry.','Clear draft',()=>{state.draft=freshDraft();state.draftMood=0;state.draftNote='';remember();render();});}
      if(act==='delmetric'){e.stopImmediatePropagation();removeMetric(el.dataset.id);}
      if(act==='restoreHabits'){e.stopImmediatePropagation();confirmAction('Restore the default habits?','Original habit names, locations and visibility return. Your custom habits and saved entries stay.','Restore habits',()=>{for(const h of Object.keys(DEFAULT_HCFG))for(const field of ['renames','moves','hidden','crit'])delete userModel[field][h];saveModel();rebuildModel();render();});}
    },true);
    app.addEventListener('click',e=>{const act=e.target.closest('[data-act]')?.dataset.act;if(['toggle','inc','dec','mood','logmode'].includes(act)){remember();status();}});
    app.addEventListener('input',e=>{if(blocked||busy)return;const act=e.target.dataset.act;if(act==='note'){state.draftNote=e.target.value;remember();}else if(act==='num'){const text=e.target.value.trim(),n=text===''?0:Number(text),ok=finite(n)&&/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text);e.target.setAttribute('aria-invalid',String(!ok));if(ok){state.draft[e.target.dataset.habit]=n;remember();}}});
    app.addEventListener('change',e=>{const el=e.target,act=el.dataset.act;if(act==='logdate'){e.stopImmediatePropagation();const date=el.value;if(!selectDate(date))el.value=state.logDate;}else if(act==='num'){e.stopImmediatePropagation();const text=el.value.trim(),n=text===''?0:Number(text);if(!finite(n)||!/^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(text)){el.value=state.draft[el.dataset.habit]||0;toast('Use a valid, non-negative number.');}else{state.draft[el.dataset.habit]=n;remember();}el.setAttribute('aria-invalid','false');}},true);
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('dialog[open]'))e.stopImmediatePropagation();},true);
    window.addEventListener('beforeunload',e=>{remember();if(failed.size){e.preventDefault();e.returnValue='';}});
    function checkDay(){if(busy||blocked)return;const today=todayISO();if(today!==seenToday){const follow=state.logDate===seenToday;remember();seenToday=today;if(follow){state.logDate=today;loadDraftFor(today);}render();}}
    document.addEventListener('visibilitychange',()=>{if(document.hidden)remember();else{checkDay();render();}});
    window.addEventListener('pageshow',()=>{checkDay();render();});setInterval(checkDay,60000);
    window.LedgerDays=Object.freeze({selectDate,setSeason,parseBackup,saveDay,remember,retry,get season(){return clone(season);},get drafts(){return clone(drafts);},get blocked(){return blocked;},get failed(){return failed.size;}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
