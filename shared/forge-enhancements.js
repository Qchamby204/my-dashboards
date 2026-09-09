/* Session controls and recovery for the original Forge. No program prescriptions. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='workout-forge')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('forge-enhancements.css?v=save-20260909',source).href;document.head.append(css);
  function ready(){
    if(window.ForgeSession||typeof state==='undefined')return;
    const RESTKEY='forge:rest:v1',JOURNALKEY='forge:pending-log:v1',keys={sessions:KEY,draft:DRAFTKEY,live:LIVEKEY,swaps:SWAPKEY,order:ORDERKEY,rest:RESTKEY,pendingLog:JOURNALKEY};
    const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
    const button=(text,fn)=>{const b=make('button',text,'forge-button');b.type='button';b.addEventListener('click',fn);return b;};
    const clone=v=>JSON.parse(JSON.stringify(v)),plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
    const finite=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
    const numeric=v=>v===''||v===undefined||v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0||typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v);
    const validDate=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\d$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
    function safeKeys(v){if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Invalid backup key.');safeKeys(v[k]);}}
    function validateItem(o,draft=false){const value=v=>numeric(v)||draft&&typeof v==='string';if(!plain(o)||o.done!==undefined&&typeof o.done!=='boolean'||o.note!==undefined&&typeof o.note!=='string'||o.name!==undefined&&typeof o.name!=='string'||o.mode!==undefined&&typeof o.mode!=='string'||!value(o.min)||o.sets!==undefined&&(!Array.isArray(o.sets)||o.sets.some(s=>!plain(s)||!value(s.w)||!value(s.r))))throw Error('Invalid exercise entry.');}
    function validatePart(field,value){
      safeKeys(value);
      if(field==='sessions'){if(!Array.isArray(value))throw Error('Expected a session list.');const ids=value.filter(s=>s?.id!==undefined).map(s=>s.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)throw Error('Saved sessions must have distinct record IDs.');value.forEach(s=>{if(!plain(s)||!validDate(s.date)||typeof s.type!=='string'||!plain(s.items)||s.dur!==undefined&&!finite(s.dur))throw Error('Invalid saved session.');Object.values(s.items).forEach(o=>validateItem(o));});}
      else if(field==='draft'){if(!plain(value))throw Error('Invalid draft.');Object.values(value).forEach(o=>validateItem(o,true));}
      else if(field==='live'){if(value!==null&&(!plain(value)||!dayBy(value.key)||!finite(value.startedAt)||value.startedAt===0||!Number.isInteger(value.exIdx)||value.exIdx<0||value.pausedAt!==undefined&&!finite(value.pausedAt)||value.pausedMs!==undefined&&!finite(value.pausedMs)))throw Error('Invalid active session.');}
      else if(field==='rest'){if(value!==null&&(!plain(value)||!finite(value.endAt)||!finite(value.total)||value.total===0||value.pausedRemaining!==undefined&&!finite(value.pausedRemaining)))throw Error('Invalid rest timer.');}
      else if(field==='swaps'){if(!plain(value)||Object.values(value).some(v=>!Number.isInteger(v)||v<0))throw Error('Invalid exercise choices.');}
      else if(field==='order'){if(!plain(value)||Object.values(value).some(v=>!Array.isArray(v)||v.some(id=>typeof id!=='string')||new Set(v).size!==v.length))throw Error('Invalid exercise order.');}
      else if(field==='pendingLog'&&value!==null){if(!plain(value)||typeof value.session?.id!=='string')throw Error('Invalid unfinished save.');validatePart('sessions',[value.session]);validatePart('draft',value.draft);if(value.live!==null&&(!plain(value.live)||typeof value.live.key!=='string'||!finite(value.live.startedAt)))throw Error('Invalid unfinished session.');}
      return value;
    }
    let blocked=false,busy=false,importToken=0,pendingLog=null;
    const boot=window.AtlasForgeBoot||{raw:{},readError:false},failed=new Map(),pending=new Map();
    try{if(boot.readError&&!window.storage)throw Error();for(const [field,key]of Object.entries(keys)){if(boot.raw[key]!==null&&boot.raw[key]!==undefined)validatePart(field,JSON.parse(boot.raw[key]));}pendingLog=boot.raw[JOURNALKEY]?JSON.parse(boot.raw[JOURNALKEY]):null;}catch{blocked=true;Object.assign(state,{sessions:[],draft:{},live:null,swaps:{},order:{}});}
    const notice=make('div',null,'forge-save-notice');notice.id='forge-save-notice';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');const message=make('p');
    notice.append(message,button('Retry saving',async()=>{if(pendingLog)await commitPending();else for(const [key,value]of [...failed])await write(key,value);}),button('Back up current work',()=>exportData()),button('Restore backup',pickImport));document.body.append(notice);
    function paintStatus(){notice.hidden=!blocked&&!failed.size&&!pendingLog;message.textContent=blocked?'Saved work could not be read. Back up the original records, then restore a valid Forge backup.':pendingLog?'Finishing this save. If it is interrupted, retry or back up your current work.':'Changes are in this tab but could not be saved. Retry or back up before closing.';app.inert=blocked||busy||!!pendingLog;
      for(const label of app.querySelectorAll('.forge-draft-status'))label.textContent=failed.size?'Not saved on this device':busy||pending.size?'Saving changes…':'Draft saved on this device';}
    function write(key,value){
      if(blocked){paintStatus();return false;}
      if(window.storage?.set&&window.storage?.get){const job=(pending.get(key)||Promise.resolve()).then(async()=>{try{await window.storage.set(key,value);const r=await window.storage.get(key);if(r?.value!==value)throw Error();failed.delete(key);return true;}catch{failed.set(key,value);return false;}finally{if(pending.get(key)===job)pending.delete(key);paintStatus();}});pending.set(key,job);paintStatus();return job;}
      try{localStorage.setItem(key,value);if(localStorage.getItem(key)!==value)throw Error();failed.delete(key);paintStatus();return true;}catch{failed.set(key,value);paintStatus();return false;}
    }
    store.set=write;
    const persistRest=()=>write(RESTKEY,JSON.stringify(timer));
    const timerBox=make('section',null,'forge-rest');timerBox.id='forge-rest';timerBox.hidden=true;timerBox.setAttribute('aria-label','Rest timer');
    const timerLabel=make('span','Rest','forge-rest-label'),time=make('strong','0:00','mono');time.id='forge-rest-time';const restPause=button('Pause rest',()=>pauseRest()),plus=button('+30 sec',()=>adjustRest(30)),minus=button('−30 sec',()=>adjustRest(-30)),dismiss=button('Dismiss',()=>stopTimer());
    timerLabel.setAttribute('role','status');timerLabel.setAttribute('aria-live','polite');timerBox.append(timerLabel,time,minus,plus,restPause,dismiss);document.body.append(timerBox);
    function restRemaining(){return !timer?0:timer.pausedRemaining!==undefined?timer.pausedRemaining:Math.max(0,timer.endAt-Date.now());}
    function measure(){root.style.setProperty('--forge-rest-height',timerBox.hidden?'0px':Math.ceil(timerBox.getBoundingClientRect().height+16)+'px');}
    tickTimer=function(){if(!timer)return;const left=restRemaining();time.textContent=clk(Math.ceil(left/1000));timerLabel.textContent=left===0?'Rest finished':timer.pausedRemaining!==undefined?'Rest paused':'Rest';restPause.textContent=timer.pausedRemaining!==undefined?'Resume rest':'Pause rest';restPause.disabled=left===0;
      if(left===0&&!timer.fired){timer.fired=true;persistRest();beep();}measure();};
    startTimer=function(sec){if(blocked)return;const total=Number(sec);if(!Number.isFinite(total)||total<=0)return;try{if(!audioCtx)audioCtx=new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume()?.catch?.(()=>{});}catch{}
      timer={endAt:Date.now()+total*1000,total,fired:false};timerBox.hidden=false;if(!timerInterval)timerInterval=setInterval(tickTimer,250);persistRest();tickTimer();};
    stopTimer=function(){timer=null;if(timerInterval){clearInterval(timerInterval);timerInterval=null;}timerBox.hidden=true;const saved=persistRest();measure();return saved;};
    function pauseRest(source='manual'){if(!timer||!restRemaining())return;if(timer.pausedRemaining!==undefined){if(source==='session')return;timer.endAt=Date.now()+timer.pausedRemaining;delete timer.pausedRemaining;delete timer.pauseSource;}else{timer.pausedRemaining=restRemaining();timer.pauseSource=source;}persistRest();tickTimer();}
    function adjustRest(seconds){if(!timer)return;const left=Math.max(0,restRemaining()+seconds*1000);timer.endAt=Date.now()+left;if(timer.pausedRemaining!==undefined)timer.pausedRemaining=left;timer.total=Math.max(1,left/1000);timer.fired=false;persistRest();tickTimer();}
    function restoreRest(rest){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}timer=rest?clone(rest):null;timerBox.hidden=!timer;if(timer){if(timer.endAt<=Date.now()&&timer.pausedRemaining===undefined)timer.fired=true;timerInterval=setInterval(tickTimer,250);tickTimer();}measure();}
    function elapsedMs(live=state.live){return live?Math.max(0,(live.pausedAt||Date.now())-live.startedAt-(live.pausedMs||0)):0;}
    liveElapsed=function(){return clk(Math.floor(elapsedMs()/1000));};
    function pauseLive(){const live=state.live;if(!live||blocked)return;if(live.pausedAt){live.pausedMs=(live.pausedMs||0)+Math.max(0,Date.now()-live.pausedAt);delete live.pausedAt;if(timer?.pauseSource==='session')pauseRest();}else{live.pausedAt=Date.now();if(timer&&timer.pausedRemaining===undefined)pauseRest('session');}saveLive();render();}
    let wakeWanted=false,wakePending=false;
    keepAwake=function(on){wakeWanted=!!on&&!document.hidden;if(!wakeWanted){const lock=__wakeLock;__wakeLock=null;lock?.release()?.catch?.(()=>{});return;}if(__wakeLock||wakePending||!navigator.wakeLock)return;wakePending=true;
      navigator.wakeLock.request('screen').then(lock=>{if(!wakeWanted){lock.release()?.catch?.(()=>{});return;}__wakeLock=lock;lock.addEventListener('release',()=>{if(__wakeLock===lock)__wakeLock=null;});}).catch(()=>{}).finally(()=>{wakePending=false;});};
    function goExercise(index){const d=state.live&&dayBy(state.live.key);if(!d||state.live.pausedAt)return;state.live.exIdx=Math.max(0,Math.min(orderedItems(d).length-1,index));saveLive();render();document.getElementById('forge-exercise')?.focus({preventScroll:true});}
    function current(){const d=state.live&&dayBy(state.live.key);return d?orderedItems(d)[state.live.exIdx]:null;}
    function localDay(ts){const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
    // Keep stored order and record identities intact; date ordering belongs in derived views.
    function orderedSessions(){return state.sessions.map((session,index)=>({session,index})).sort((a,b)=>a.session.date.localeCompare(b.session.date)||(a.session.startedAt||0)-(b.session.startedAt||0)||a.index-b.index);}
    function withOrderedSessions(fn){const original=state.sessions;state.sessions=orderedSessions().map(x=>x.session).filter(s=>s.date<=todayISO());try{return fn();}finally{state.sessions=original;}}
    const oldLastSets=lastSets,oldLastCardio=lastCardio,oldLastNote=lastNote,oldExHistory=exHistory,oldNoteHistory=noteHistory,oldRecordsList=recordsList,oldPriorBest=priorBestMap,oldCardioTotals=cardioTotals,oldStats=stats,oldHistory=history,oldLastSessionFor=lastSessionFor,oldPrFor=prFor,oldCardioBest=cardioBest,oldHistoryStrip=historyStrip;
    lastSets=id=>withOrderedSessions(()=>oldLastSets(id));lastCardio=id=>withOrderedSessions(()=>oldLastCardio(id));lastNote=id=>withOrderedSessions(()=>oldLastNote(id));
    exHistory=id=>withOrderedSessions(()=>oldExHistory(id));noteHistory=id=>withOrderedSessions(()=>oldNoteHistory(id));
    recordsList=()=>withOrderedSessions(oldRecordsList);priorBestMap=()=>withOrderedSessions(oldPriorBest);cardioTotals=()=>withOrderedSessions(oldCardioTotals);
    lastSessionFor=id=>withOrderedSessions(()=>oldLastSessionFor(id));prFor=id=>withOrderedSessions(()=>oldPrFor(id));cardioBest=id=>withOrderedSessions(()=>oldCardioBest(id));
    draftBeatsPR=id=>{const prior=prFor(id);return !!prior&&setsTopE1RM(state.draft[id]?.sets||[])>prior.e+.01;};
    historyStrip=(it,accent)=>oldHistoryStrip(it,accent).replace('<div ','<div class="forge-history-strip" ').replace('NEW PR ON THE BOARD','Draft exceeds saved record');
    stats=()=>withOrderedSessions(()=>{const result=oldStats(),season=state.sessions.filter(s=>s.date>=SEASON_START_ISO&&s.date<=localDay(SEASON_END)).length;return {...result,season,onPace:season>=result.expected-1};});
    history=function(){const original=state.sessions,ordered=orderedSessions(),best={};state.sessions=ordered.map(({session})=>{const items={};for(const [id,item]of Object.entries(session.items)){const value=setsTopE1RM(item.sets||[]);items[id]={...item,pr:value>0&&(best[id]||0)>0&&value>best[id]+.01};best[id]=Math.max(best[id]||0,value);}return {...session,items};});try{return oldHistory().replace(/data-idx="(\d+)"/g,(_,index)=>'data-idx="'+ordered[Number(index)].index+'"');}finally{state.sessions=original;}};
    function sessionItems(day){const items={};allItems(day).forEach(it=>{const eid=effId(it),dr=state.draft[eid];if(!dr)return;const o={done:!!dr.done,name:effName(it)};
      if(dr.note?.trim())o.note=dr.note.trim();
      if(it.track==='load'){o.sets=(dr.sets||[]).filter(s=>String(s.w??'')!==''||String(s.r??'')!=='').map(s=>{if(!numeric(s.w)||!numeric(s.r)||!Number.isInteger(Number(s.r))||Number(s.r)<=0)throw Error('Complete or clear the partial set for '+effName(it)+'.');return {w:s.w??'',r:s.r??''};});if(o.sets.length||o.done||o.note)items[eid]=o;}
      else if(it.track==='cardio'){o.min=dr.min===''||dr.min==null?0:Number(dr.min);if(!Number.isFinite(o.min)||o.min<0)throw Error('Enter valid minutes.');o.mode=dr.mode||'';if(o.min>0||o.done||o.note)items[eid]=o;}
      else if(o.done||o.note)items[eid]=o;
    });return items;}
    async function commitPending(){
      if(!pendingLog||busy||blocked)return false;busy=true;paintStatus();const job=pendingLog;
      try{
        if(!state.sessions.some(s=>s.id===job.session.id)){const sessions=[...state.sessions,job.session];if(!await write(KEY,JSON.stringify(sessions)))return false;state.sessions=sessions;}
        const draft=clone(state.draft);for(const [id,value]of Object.entries(job.draft))if(JSON.stringify(draft[id])===JSON.stringify(value))delete draft[id];
        if(!await write(DRAFTKEY,JSON.stringify(draft)))return false;state.draft=draft;
        if(job.live&&(!state.live||state.live.key===job.live.key&&state.live.startedAt===job.live.startedAt)){if(state.live&&!await write(LIVEKEY,'null'))return false;state.live=null;if(!await stopTimer())return false;keepAwake(false);stopLiveClock();}
        if(!await write(JOURNALKEY,'null'))return false;pendingLog=null;const tag=dayBy(job.session.type)?.tag||job.session.type;state.handoff={date:job.session.date,tag,sessionId:job.session.id};
        const prs=Object.entries(job.session.items).filter(([,o])=>o.pr).map(([id,o])=>({name:o.name||nameForEid(id),e:setsTopE1RM(o.sets||[])}));state.prCel=prs.length?{prs,tag}:null;toast('Session saved.');return true;
      }finally{busy=false;render();}
    }
    logDay=async function(key,durMin){
      if(busy||blocked||pendingLog)return false;const day=dayBy(key);if(!day)return false;let items;try{items=sessionItems(day);}catch(e){toast(e.message);return false;}
      if(!Object.keys(items).length){toast('Nothing recorded yet. You can end the session without logging it.');return false;}
      const live=state.live?.key===key?state.live:null,sess={id:crypto.randomUUID(),date:live?localDay(live.startedAt):todayISO(),type:key,items};
      if(live){sess.startedAt=live.startedAt;sess.elapsedSeconds=Math.floor(elapsedMs(live)/1000);sess.dur=Math.round(sess.elapsedSeconds/60);}else if(durMin!==undefined)sess.dur=durMin;
      const prior=priorBestMap();for(const [id,o]of Object.entries(items)){const best=setsTopE1RM(o.sets||[]);if(best>0&&(prior[id]||0)>0&&best>prior[id]+.01)o.pr=true;}
      const draft={};allItems(day).forEach(it=>{const id=effId(it);if(state.draft[id])draft[id]=clone(state.draft[id]);});const job={session:sess,draft,live:live?{key:live.key,startedAt:live.startedAt}:null};
      busy=true;paintStatus();const ok=await write(JOURNALKEY,JSON.stringify(job));busy=false;
      if(!ok){failed.set(JOURNALKEY,'null');paintStatus();toast('Session not logged yet. Your draft is still here.');return false;}
      pendingLog=job;return commitPending();
    };
    function confirmAction(title,text,okLabel,fn){document.getElementById('forge-confirm')?.remove();const dialog=make('dialog',null,'forge-confirm');dialog.id='forge-confirm';const h=make('h2',title);h.id='forge-confirm-title';dialog.setAttribute('aria-labelledby',h.id);const cancel=()=>{dialog.close();dialog.remove();};dialog.append(h,make('p',text),button('Cancel',cancel),button(okLabel,()=>{cancel();fn();}));document.body.append(dialog);dialog.showModal();}
    finishLive=function(){if(!state.live||busy||blocked)return;const session=state.live;let items;try{items=sessionItems(dayBy(session.key));}catch(e){toast(e.message);return;}
      confirmAction('Finish session?',Object.keys(items).length?'Save the entries you recorded and end the clock. Unmarked exercises stay unmarked.':'End the clock without adding an empty session to your history.',Object.keys(items).length?'Save and finish':'End session',async()=>{
        if(state.live!==session)return;if(Object.keys(items).length){await logDay(session.key);return;}const ok=await write(LIVEKEY,'null');if(!ok){failed.set(LIVEKEY,JSON.stringify(state.live));return;}state.live=null;stopTimer();keepAwake(false);stopLiveClock();render();
      });};
    save=function(){return write(KEY,JSON.stringify(state.sessions));};saveDraft=function(){return write(DRAFTKEY,JSON.stringify(state.draft));};saveLive=function(){return write(LIVEKEY,JSON.stringify(state.live));};saveOrder=function(){return write(ORDERKEY,JSON.stringify(state.order||{}));};
    const oldSetRows=setRows;setRows=function(it,accent,day){const id=effId(it),draft=state.draft[id];if(!draft)return oldSetRows(it,accent,day);state.draft[id]={...draft,sets:(draft.sets||[]).map(s=>({...s,w:esc(s.w??''),r:esc(s.r??'')}))};try{return oldSetRows(it,accent,day);}finally{state.draft[id]=draft;}};
    cardioRows=function(it){const id=effId(it),d=state.draft[id]||{},prior=lastCardio(id);return '<div class="forge-cardio"><label>Minutes recorded<input inputmode="decimal" data-act="forgemin" data-id="'+esc(id)+'" value="'+esc(d.min??'')+'" placeholder="Not recorded" aria-label="Minutes recorded"/></label><div class="forge-cardio-steps"><button class="forge-button" data-act="cmin" data-id="'+esc(id)+'" data-delta="-5">−5 min</button><button class="forge-button" data-act="cmin" data-id="'+esc(id)+'" data-delta="5">+5 min</button></div>'+(prior?'<p>Last recorded: '+esc(prior.min)+' min</p>':'')+'<div class="forge-cardio-modes">'+(it.modes||[]).map(m=>'<button class="forge-button" data-act="cmode" data-id="'+esc(id)+'" data-mode="'+esc(m)+'" aria-pressed="'+String(d.mode===m)+'">'+esc(m)+'</button>').join('')+'</div></div>';};
    const oldLiveView=liveView;liveView=function(){return oldLiveView().replace('<div class="overlay"','<div class="overlay forge-live"');};
    const infoOpen=new Set();
    function info(id,label,text){const d=make('details',null,'forge-info'),summary=make('summary','i');d.id=id;d.open=infoOpen.has(id);summary.setAttribute('aria-label',label);d.append(summary,make('p',text));d.addEventListener('toggle',()=>{if(d.open)infoOpen.add(id);else infoOpen.delete(id);});return d;}
    function showSection(key){state.prCel=null;state.openSections[key]=true;render();app.querySelector('[data-act="section"][data-key="'+key+'"]')?.scrollIntoView({block:'start'});}
    function savedSummary(session){const panel=make('section',null,'panel forge-summary');panel.id='forge-session-summary';panel.setAttribute('aria-label','Saved session');const items=Object.values(session.items),sets=items.reduce((n,o)=>n+(o.sets?.length||0),0),minutes=items.reduce((n,o)=>n+(Number(o.min)||0),0),prs=items.filter(o=>o.pr).length;
      const heading=make('h2','Session saved'),status=make('p',(dayBy(session.type)?.tag||session.type)+' · '+fmtDate(session.date));status.setAttribute('role','status');panel.append(heading,status);
      const counts=[items.length+' exercise entr'+(items.length===1?'y':'ies'),sets+' recorded set'+(sets===1?'':'s')];if(minutes)counts.push(minutes+' recorded cardio min');if(session.elapsedSeconds!==undefined)counts.push(clk(session.elapsedSeconds)+' elapsed');else if(session.dur!==undefined)counts.push(session.dur+' min elapsed');if(prs)counts.push(prs+' new record'+(prs===1?'':'s'));panel.append(make('p',counts.join(' · '),'forge-summary-counts'));
      const actions=make('div',null,'forge-summary-actions');actions.append(button('View saved session',()=>{showSection('log');const index=state.sessions.indexOf(session);app.querySelector('[data-act="del"][data-idx="'+index+'"]')?.closest('.row')?.scrollIntoView({block:'center'});}));const link=make('a','Review in Life Ledger','forge-button');link.href='life-ledger.html?forge=1&d='+encodeURIComponent(session.date);actions.append(link,button('Dismiss',()=>{state.handoff=null;render();}));panel.append(actions,info('forge-summary-info','About this saved session','Only the entries you recorded were saved. Skipped exercises remain unmarked. The first entry establishes a baseline; later saved entries can set records. Life Ledger opens a separate daily entry for you to review and save.'));return panel;
    }
    const oldPRView=prCelView;
    prCelView=()=>oldPRView().replace('<div class="overlay"','<dialog class="overlay forge-record-dialog"').replace(' data-act="closepr"','').replace(/<\/div>$/, '</dialog>');
    async function replaceSessions(next){if(blocked||busy||pendingLog)return false;busy=true;paintStatus();const ok=await write(KEY,JSON.stringify(next));busy=false;if(!ok){failed.delete(KEY);paintStatus();toast('History was not changed. Try again.');return false;}state.sessions=next;state.prCel=null;if(state.handoff?.sessionId&&!next.some(s=>s.id===state.handoff.sessionId))state.handoff=null;render();return true;}
    let recordWasOpen=false;
    const oldRender=render;
    render=function(){if(blocked){paintStatus();return;}oldRender();
      const handoff=state.handoff?.sessionId&&state.sessions.find(s=>s.id===state.handoff.sessionId),handoffPanel=app.querySelector('[data-act="hodismiss"]')?.parentNode;if(handoff&&handoffPanel)handoffPanel.replaceWith(savedSummary(handoff));
      const recordDialog=app.querySelector('dialog.forge-record-dialog');if(recordDialog){recordDialog.setAttribute('aria-label','New personal record');recordDialog.firstElementChild.append(info('forge-record-info','How records are calculated','These estimates compare recorded load and repetitions for the same exercise variation. They are calculated from saved entries, not a measured maximum. The first entry is a baseline.'));recordDialog.addEventListener('cancel',e=>{e.preventDefault();state.prCel=null;render();});recordDialog.addEventListener('click',e=>{if(e.target===recordDialog){state.prCel=null;render();}});recordDialog.showModal();}
      if(recordWasOpen&&!recordDialog)(document.getElementById('forge-session-summary')?.querySelector('button')||app.querySelector('[data-act="section"][data-key="records"]'))?.focus();recordWasOpen=!!recordDialog;
      for(const action of app.querySelectorAll('[data-act="section"]'))if(action.dataset.key==='records')action.parentNode.append(info('forge-records-info','How saved records work','Records are recalculated from your saved sessions for each exercise variation. Draft comparisons only become saved records when you finish saving. Deleting a session updates the records list.'));
      const live=state.live,overlay=app.querySelector('.forge-live');
      if(overlay&&live){const panel=overlay.firstElementChild;panel.classList.add('forge-live-panel');overlay.setAttribute('aria-label','Current training session');const finish=overlay.querySelector('[data-act="livefinish"]'),header=finish.parentNode;
        const pause=button(live.pausedAt?'Resume session':'Pause session',pauseLive);pause.id='forge-pause';header.append(pause);header.classList.add('forge-live-header');const draftStatus=make('p',null,'forge-draft-status');draftStatus.setAttribute('role','status');header.append(draftStatus,info('forge-draft-info','About unfinished session saving','Edits are saved on this device as you type. Finish adds the session to history. The session and rest clocks use elapsed time when you return after locking the phone. Backups include unfinished entries.'));
        const label=make('label','Exercise','forge-picker'),select=make('select');select.id='forge-exercise';const items=orderedItems(dayBy(live.key));items.forEach((it,i)=>{const o=make('option',(i+1)+'. '+effName(it)+(state.draft[effId(it)]?.done?' · done':''));o.value=String(i);select.append(o);});select.value=String(live.exIdx);select.disabled=!!live.pausedAt;select.addEventListener('change',()=>goExercise(Number(select.value)));label.append(select);header.after(label);
        const done=overlay.querySelector('[data-act="livedone"]'),prev=overlay.querySelector('[data-act="liveprev"]');prev.disabled=live.exIdx===0||!!live.pausedAt;
        if(state.draft[effId(items[live.exIdx])]?.done)done.textContent=live.exIdx===items.length-1?'Already marked done':'Next exercise';
        const skip=button('Skip for now',()=>goExercise(live.exIdx+1));skip.id='forge-skip';skip.disabled=live.exIdx===items.length-1||!!live.pausedAt;done.parentNode.append(skip);done.parentNode.classList.add('forge-live-actions');
        if(live.pausedAt){const paused=make('p','Session paused. Resume when you are ready.','forge-paused');label.after(paused);overlay.querySelectorAll('input,textarea,[data-act="livedone"],[data-act="livefill"],[data-act="livelater"],[data-act="rest"],[data-act="cmin"],[data-act="cmode"]').forEach(e=>e.disabled=true);}
      }
      app.querySelectorAll('[data-act="setw"],[data-act="setr"]').forEach(e=>{e.setAttribute('aria-label',(e.dataset.act==='setw'?'Weight in pounds':'Repetitions')+', set '+(Number(e.dataset.set)+1));});app.querySelectorAll('[data-act="note"]').forEach(e=>e.setAttribute('aria-label','Exercise notes'));
      keepAwake(!!live&&!live.hidden&&!live.pausedAt);paintStatus();measure();
    };
    // Capture only the changed actions; all other original handlers remain in place.
    app.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(!el)return;const act=el.dataset.act;
      if(blocked||busy||pendingLog){e.preventDefault();e.stopImmediatePropagation();return;}
      if(act==='day'&&window.matchMedia?.('(prefers-reduced-motion: reduce)').matches){e.stopImmediatePropagation();state.openDay=state.openDay===el.dataset.key?null:el.dataset.key;render();if(state.openDay)app.querySelector('[data-act="day"][data-key="'+state.openDay+'"]')?.scrollIntoView({behavior:'instant',block:'start'});return;}
      if(act==='livedone'&&state.live){const it=current();if(state.live.pausedAt||state.draft[effId(it)]?.done){e.stopImmediatePropagation();if(!state.live.pausedAt)goExercise(state.live.exIdx+1);return;}}
      if(act==='log'&&state.live?.key===el.dataset.key){e.stopImmediatePropagation();finishLive();return;}
      if(act==='cmin'){e.stopImmediatePropagation();const dr=state.draft[el.dataset.id]||{sets:[]},base=Number(dr.min)||0;dr.min=Math.max(0,base+Number(el.dataset.delta));state.draft[el.dataset.id]=dr;saveDraft();render();return;}
      if(act==='live'&&state.live&&state.live.key!==el.dataset.key){e.stopImmediatePropagation();toast('Finish the current session before starting another. Your draft is still available.');return;}
      if(act==='clearday'){e.stopImmediatePropagation();const d=dayBy(el.dataset.key);confirmAction('Clear this draft?','Remove this day’s unfinished entries. Saved sessions stay in your history.','Clear draft',()=>{allItems(d).forEach(it=>delete state.draft[effId(it)]);saveDraft();render();});return;}
      if(act==='del'){e.stopImmediatePropagation();const removed=state.sessions[Number(el.dataset.idx)];if(!removed)return;(async()=>{if(await replaceSessions(state.sessions.filter(s=>s!==removed)))undoToast('Session deleted',async()=>{if(!state.sessions.some(s=>s===removed||removed.id&&s.id===removed.id))await replaceSessions([...state.sessions,removed]);});})();return;}
      if(act==='reset'){e.stopImmediatePropagation();confirmAction('Clear saved history?','This removes the training log. Back up first if you want to keep it. The current draft stays available.','Clear history',async()=>{const removed=state.sessions.slice();if(await replaceSessions([]))undoToast('History cleared',async()=>{const missing=removed.filter(old=>!state.sessions.some(s=>s===old||old.id&&s.id===old.id));await replaceSessions([...missing,...state.sessions]);});});return;}
    },true);
    app.addEventListener('input',e=>{if(e.target.dataset.act==='forgemin'&&!blocked&&!busy&&!pendingLog){const id=e.target.dataset.id,dr=state.draft[id]||{sets:[]};dr.min=e.target.value;state.draft[id]=dr;saveDraft();}});
    function payload(){return {app:'forge',version:3,exportedAt:new Date().toISOString(),sessions:state.sessions,draft:state.draft,live:state.live,swaps:state.swaps,order:state.order,rest:timer,pendingLog};}
    exportData=function(){const data=blocked?{app:'forge-recovery',version:1,records:boot.raw}:payload();const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=blocked?'forge-original-records.json':'forge-training-'+todayISO()+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);toast('Backup prepared. Save the file in Files or Downloads.');};
    function parseBackup(o){if(Array.isArray(o))o={sessions:o};if(!plain(o)||o.app!==undefined&&o.app!=='forge'||o.version!==undefined&&![2,3].includes(o.version))throw Error('Choose a Forge backup.');const next={};for(const field of Object.keys(keys))if(Object.hasOwn(o,field))next[field]=clone(validatePart(field,o[field]));if(!next.sessions)throw Error('No session list in this file.');return next;}
    importData=async function(file){if(busy)return;const token=++importToken;try{if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const next=parseBackup(JSON.parse(await file.text()));if(token!==importToken)return;confirmAction('Restore Forge backup?',next.sessions.length+' saved sessions will replace this log. '+(blocked?'Unreadable records will be replaced. Keep a recovery backup first.':Object.hasOwn(next,'draft')?'The backup also replaces unfinished work.':'Your current draft stays available.'),'Restore backup',async()=>{if(token!==importToken||busy)return;if(blocked){for(const field of Object.keys(keys))if(!Object.hasOwn(next,field))next[field]=field==='rest'||field==='pendingLog'?null:clone(state[field]);}blocked=false;busy=true;failed.clear();pendingLog=null;paintStatus();next.pendingLog=next.pendingLog||null;for(const [field,value]of Object.entries(next)){if(field==='rest')restoreRest(value);else if(field==='pendingLog')pendingLog=value;else state[field]=value;await write(keys[field],JSON.stringify(value));}busy=false;state.prCel=null;state.handoff=null;render();if(pendingLog&&!failed.size)await commitPending();toast(failed.size?'Restored in this tab. Retry saving or keep a backup.':'Backup restored on this device.');});}catch(e){toast(e.message||'Could not read this backup.');}};
    function pickImport(){const input=make('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{if(input.files?.[0])importData(input.files[0]);});input.click();}
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.querySelector('dialog[open]'))e.stopImmediatePropagation();},true);
    document.addEventListener('visibilitychange',()=>{tickTimer();keepAwake(!!state.live&&!state.live.hidden&&!state.live.pausedAt);});window.addEventListener('pageshow',()=>{tickTimer();const clock=document.getElementById('liveClock');if(clock&&state.live)clock.textContent=liveElapsed();});window.addEventListener('beforeunload',e=>{if(failed.size||pending.size||busy||pendingLog){e.preventDefault();e.returnValue='';}});window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);
    if(window.ResizeObserver)new ResizeObserver(measure).observe(timerBox);
    if(!blocked){try{restoreRest(boot.raw[RESTKEY]?JSON.parse(boot.raw[RESTKEY]):null);}catch{restoreRest(null);}}
    window.ForgeSession=Object.freeze({pauseLive,pauseRest,adjustRest,goExercise,elapsedMs,sessionItems,parseBackup,restoreRest,get blocked(){return blocked;},get failed(){return failed.size;},get busy(){return busy;}});
    render();if(pendingLog&&!blocked)commitPending();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
