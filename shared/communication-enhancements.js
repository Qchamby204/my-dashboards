/* Reliability fixes for the original Communication Trainer and its mc_* records. */
(()=>{
  const source=document.currentScript?.src;
  function start(){
    if(document.documentElement.dataset.atlasApp!=='communication-trainer'||typeof S==='undefined'||window.CommunicationImprovements)return;
    if(source){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('communication-enhancements.css?v=topics-20260909',source).href;document.head.appendChild(css);}
    const oldRender=render,oldDrillView=drillView,oldLaunch=launchDrill,oldNav=nav,oldToast=toast;
    const fields={assessments:'assessments',reps:'reps',lessonsDone:'lessonsDone',customTopics:'customTopics',retiredTopics:'retired',catsEnabled:'catsEnabled',city:'city',prepNotes:'prepNotes',refreshed:'refreshed',bankUpdated:'bankUpdated',grades:'grades',pendingGrades:'pendingGrades',topicBank:'topicBank'};
    const shadow=new Map(),unsaved=new Set();
    const copy=value=>JSON.parse(JSON.stringify(value));
    const originalGet=Store.get.bind(Store);let diskAvailable=Store.usable();
    let deadline=null,remainingMs=null,timerSession=null,speechEpoch=0,restartTask=null,renderedPage=null,renderedSession=null;
    const DRAFT='practiceDraft';let draftProblem=null,lastSaveError='',lastSaved=null;
    const recordDay=value=>/^\d{4}-\d\d-\d\d$/.test(value)?value:dstr(new Date(value));
    dstr=date=>date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
    const eligible=rows=>rows.filter(r=>Number.isFinite(Date.parse(r.date))&&recordDay(r.date)<=dstr(new Date()));
    activityDates=()=>eligible(S.reps).map(r=>recordDay(r.date));
    repsByDay=()=>{const days={};for(const date of activityDates())days[date]=(days[date]||0)+1;return days;};
    streak=()=>{const days=new Set(activityDates()),date=new Date();let count=0;if(!days.has(dstr(date)))date.setDate(date.getDate()-1);while(days.has(dstr(date))){count++;date.setDate(date.getDate()-1);}return count;};
    repsThisWeek=()=>{const since=new Date();since.setDate(since.getDate()-6);return activityDates().filter(date=>date>=dstr(since)).length;};
    bestByDrill=()=>{const best={};for(const r of eligible(S.reps))if(!best[r.drill]||r.score>best[r.drill].score)best[r.drill]={score:r.score,topic:r.topic,date:recordDay(r.date),skill:r.skill};return best;};
    const sorted=rows=>eligible(rows).slice().sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
    latestScores=()=>sorted(S.assessments).at(-1)?.scores||null;firstScores=()=>sorted(S.assessments)[0]?.scores||null;
    const oldProjectedScores=projectedScores;
    projectedScores=()=>{const rows=S.assessments;S.assessments=sorted(rows);try{return oldProjectedScores();}finally{S.assessments=rows;}};
    xp=()=>eligible(S.reps).length*10+Object.values(S.lessonsDone).filter(Boolean).length*15+eligible(S.assessments).length*25;
    function validateDraft(value){
      if(value===null)return null;
      if(!value||typeof value!=='object'||Array.isArray(value)||value.schemaVersion!==1||typeof value.id!=='string'||!value.id||typeof value.drillId!=='string'||!value.topic||typeof value.topic.text!=='string'||typeof value.topic.cat!=='string'||!Array.isArray(value.scores)||!value.scores.length||value.scores.some(n=>!Number.isInteger(n)||n<1||n>5)||typeof value.tx!=='string'||typeof value.recSecs!=='number'||!Number.isFinite(value.recSecs)||value.recSecs<0||typeof value.remainingMs!=='number'||!Number.isFinite(value.remainingMs)||value.remainingMs<0||value.deadline!==null&&(typeof value.deadline!=='number'||!Number.isFinite(value.deadline))||value.gradePaste!==undefined&&typeof value.gradePaste!=='string')throw Error('The unfinished practice could not be read.');
      return copy(value);
    }
    function draftSnapshot(){if(!curDrill)return null;return {schemaVersion:1,id:curDrill.id,drillId:curDrill.drill.id,topic:copy(curDrill.topic),scores:curDrill.scores.slice(),tx:curDrill.tx||'',recSecs:(curDrill.recSecs||0)+(recOn&&recT0?Math.max(0,(Date.now()-recT0)/1000):0),remainingMs:deadline!==null?Math.max(0,deadline-Date.now()):remainingMs??timerLeft*1000,deadline,prepOpen:!!curDrill.prepOpen,graded:!!curDrill.graded,gradePaste:curDrill.gradePaste||''};}
    function rememberPractice(){if(!curDrill?.id||draftProblem)return false;return Store.set(DRAFT,draftSnapshot());}
    function restorePractice(value){
      const draft=validateDraft(value);if(!draft||S.reps.some(r=>r.id===draft.id)){curDrill=null;return;}
      const drill=DRILLS.find(d=>d.id===draft.drillId);if(!drill||draft.scores.length!==drill.rubric.length)throw Error('This unfinished drill is unavailable. Export it before replacing it.');
      curDrill={id:draft.id,drill,topic:copy(draft.topic),scores:draft.scores.slice(),tx:draft.tx,recSecs:draft.recSecs,prepOpen:!!draft.prepOpen,graded:!!draft.graded,gradePaste:draft.gradePaste||''};
      remainingMs=Math.min(drill.time*1000,draft.deadline!==null?Math.max(0,draft.deadline-Date.now()):draft.remainingMs);timerLeft=Math.ceil(remainingMs/1000);deadline=null;timerSession=curDrill;
    }
    function writeProgress(key,next){if(Store.set(key,next))return true;shadow.set(key,copy(S[fields[key]]));unsaved.delete(key);lastSaveError='Not saved. Your work is still here. Retry Save when storage is available.';rememberPractice();status();return false;}
    function leavePractice(){stopRec();stopTimer();rememberPractice();curPage='train';curDrill=null;render();}
    function resumePractice(){if(draftProblem){toast('Unfinished practice unavailable','Export it before replacing it.');return;}if(!curDrill)try{restorePractice(Store.get(DRAFT,null));}catch(error){draftProblem=error.message;render();return;}if(curDrill){curPage='train';render();}}
    function discardPractice(){uiConfirm('Discard unfinished practice?','This removes the unfinished transcript and scores. Saved practice history stays.','Discard',()=>{stopRec();stopTimer();if(!Store.set(DRAFT,null))return;curDrill=null;draftProblem=null;lastSaveError='';render();});}
    function status(){
      let box=$('communication-save-error');
      if(!box&&unsaved.size){box=document.createElement('section');box.id='communication-save-error';box.className='card';box.setAttribute('role','alert');box.innerHTML='<p>Some changes could not be saved on this device. Keep this page open, retry saving, or export your progress.</p><div class="flex"><button type="button" class="btn ghost" data-communication-action="retry">Retry saving</button><button type="button" class="btn ghost" data-communication-action="export">Export progress</button></div>';$('main').before(box);}
      if(box)box.hidden=!unsaved.size;
      const label=$('communication-practice-status');if(label)label.textContent=lastSaveError|| (unsaved.has(DRAFT)?'Draft not saved on this device':'Draft saved on this device');
    }
    Store.set=function(key,value){
      shadow.set(key,copy(value));
      try{const raw=JSON.stringify(value);localStorage.setItem('mc_'+key,raw);if(localStorage.getItem('mc_'+key)!==raw)throw Error('Write not retained');unsaved.delete(key);diskAvailable=true;}
      catch{unsaved.add(key);diskAvailable=false;}
      status();return !unsaved.has(key);
    };
    Store.get=function(key,fallback){
      if(unsaved.has(key))return copy(shadow.get(key));
      try{const raw=localStorage.getItem('mc_'+key);if(raw!==null)return JSON.parse(raw);}catch{}
      return shadow.has(key)?copy(shadow.get(key)):originalGet(key,fallback);
    };
    Store.dump=function(){const result={};for(const [key,field]of Object.entries(fields))result[key]=copy(S[field]);for(const key of ['topics','goalNote','proCatsAdded'])result[key]=Store.get(key,null);result.practiceDraft=curDrill?draftSnapshot():Store.get(DRAFT,null);if(draftProblem)try{result.unreadablePracticeDraft=localStorage.getItem('mc_'+DRAFT);}catch{}return result;};
    Store.usable=()=>diskAvailable&&unsaved.size===0;
    toast=function(title,sub){oldToast(unsaved.size?'Progress is not fully saved':title,unsaved.size?'Keep this page open and retry, or export your progress.':sub);};
    function timerUI(){
      const value=$('timer'),button=$('tbtn');
      if(value){value.textContent=fmtT(Math.max(0,Math.ceil(timerLeft)));value.setAttribute('role','timer');value.setAttribute('aria-label','Time remaining');value.style.color=timerLeft<=0?'var(--good)':'';}
      if(button){button.textContent=deadline!==null?'Pause':timerLeft<=0?'Time’s up':timerLeft<curDrill?.drill.time?'Resume':'Start timer';button.disabled=timerLeft<=0;}
    }
    function paintTimer(){
      if(deadline!==null){remainingMs=Math.max(0,deadline-Date.now());timerLeft=Math.ceil(remainingMs/1000);}
      timerUI();
      if(deadline!==null&&remainingMs<=0){stopTimer();stopRec();toast('Time’s up','Review your transcript and score this rep when you are ready.');}
    }
    stopTimer=function(){
      if(deadline!==null){remainingMs=Math.max(0,deadline-Date.now());timerLeft=Math.ceil(remainingMs/1000);}
      deadline=null;if(timerInt!==null){clearInterval(timerInt);timerInt=null;}if(!recOn)relWake();timerUI();if(timerSession===curDrill)rememberPractice();
    };
    toggleTimer=function(){
      if(!curDrill)return;
      if(deadline!==null){stopTimer();return;}
      if(timerSession!==curDrill){timerSession=curDrill;remainingMs=timerLeft*1000;}
      if(timerLeft<=0)return;
      deadline=Date.now()+(remainingMs??timerLeft*1000);reqWake();timerInt=setInterval(paintTimer,250);paintTimer();rememberPractice();
    };
    function recordingUI(message){
      const button=$('recBtn');if(button){button.textContent=recOn?'Stop dictation':'Start dictation';button.setAttribute('aria-pressed',String(recOn));button.classList.toggle('reclive',recOn);}
      const meta=$('recMeta');if(meta&&message!==undefined)meta.textContent=message;
    }
    stopRec=function(){
      speechEpoch++;clearTimeout(restartTask);restartTask=null;
      const engine=rec,wasOn=recOn;recOn=false;rec=null;
      if(engine){engine.onresult=null;engine.onend=null;engine.onerror=null;engine.onstart=null;try{engine.abort();}catch{try{engine.stop();}catch{}}}
      if(recTick!==null){clearInterval(recTick);recTick=null;}
      if(recT0&&curDrill)curDrill.recSecs=(curDrill.recSecs||0)+Math.max(0,(Date.now()-recT0)/1000);
      recT0=0;if(!timerInt)relWake();
      const stats=curDrill?txStats(curDrill.tx||'',curDrill.recSecs||0):null;
      recordingUI(wasOn&&stats?`${stats.words} words · ${stats.wpm||'?'} wpm · ${stats.fillers} possible filler words`:undefined);
      if(wasOn)rememberPractice();
    };
    recToggle=function(){
      if(recOn){stopRec();return;}if(!curDrill)return;
      const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
      if(!Recognition){toast('Live dictation is unavailable','Type your transcript or use your keyboard’s dictation button.');$('txBox')?.focus();return;}
      const session=curDrill,ticket=++speechEpoch;let engine,base=session.tx||'',finals=new Map();
      try{engine=new Recognition();}catch{toast('Dictation unavailable','You can still type your transcript.');return;}
      rec=engine;recOn=true;engine.continuous=true;engine.interimResults=true;engine.lang='en-CA';
      const active=()=>recOn&&rec===engine&&speechEpoch===ticket&&curDrill===session;
      engine.onstart=()=>{if(!active())return;if(!recT0)recT0=Date.now();reqWake();if(!timerInt&&timerLeft>0)toggleTimer();recordingUI('Listening…');};
      engine.onresult=event=>{
        if(!active())return;
        let interim='';
        for(let i=event.resultIndex;i<event.results.length;i++){
          const result=event.results[i],text=String(result[0]?.transcript||'').trim();
          if(result.isFinal)finals.set(i,text);else interim+=(interim?' ':'')+text;
        }
        session.tx=[base,...[...finals].sort((a,b)=>a[0]-b[0]).map(([,value])=>value),interim].filter(Boolean).join(' ').trim();
        const box=$('txBox');if(box){box.value=session.tx;box.scrollTop=box.scrollHeight;}
        rememberPractice();
      };
      engine.onend=()=>{
        if(!active())return;
        if(document.hidden){stopRec();return;}
        base=session.tx||'';finals=new Map();
        restartTask=setTimeout(()=>{if(!active())return;try{engine.start();}catch{stopRec();toast('Dictation stopped','Your transcript is retained. Tap Start dictation to continue.');}},250);
      };
      engine.onerror=event=>{
        if(!active())return;stopRec();
        const blocked=['not-allowed','service-not-allowed'].includes(event.error);
        toast(blocked?'Microphone access was denied':'Dictation stopped',blocked?'Allow microphone access or type your transcript.':'Your transcript is retained. Check your connection, then tap Start dictation to retry.');
      };
      recordingUI('Starting dictation…');
      try{engine.start();}catch{stopRec();toast('Dictation unavailable','Type your transcript or use keyboard dictation.');return;}
      if(!active())return;
      recTick=setInterval(()=>{if(active()&&recT0)recordingUI('Listening · '+fmtT(Math.floor((session.recSecs||0)+(Date.now()-recT0)/1000)));},1000);
    };
    launchDrill=function(drill){
      if(!drill)return;if(draftProblem){toast('Keep a backup first','Your unreadable unfinished practice has been preserved.');return;}
      const available=allTopics().filter(t=>!drill.cats||drill.cats.includes(t.cat));
      if(!available.length){toast('No active topics for this drill','Open Topics to add topics or enable a matching category.');return;}
      const begin=()=>{stopRec();stopTimer();timerSession=null;remainingMs=null;oldLaunch(drill);curDrill.id=crypto.randomUUID();curDrill.scores=drill.rubric.map(()=>3);lastSaveError='';remainingMs=timerLeft*1000;timerSession=curDrill;rememberPractice();render();window.scrollTo(0,0);};
      let draft=curDrill?draftSnapshot():Store.get(DRAFT,null);if(draft?.id&&S.reps.some(r=>r.id===draft.id))draft=null;
      if(draft&&(draft.tx.trim()||draft.recSecs>0||draft.scores.some(n=>n!==3)||draft.remainingMs<(DRILLS.find(d=>d.id===draft.drillId)?.time||0)*1000))uiConfirm('Start a new practice?','Your unfinished transcript and scores will be replaced. Save this practice or export progress first if you want to keep it.','Start new practice',begin);else begin();
    };
    nav=function(page){if(page!=='train'&&curDrill){stopRec();stopTimer();}oldNav(page);};
    finishDrill=function(){
      if(!curDrill)return false;stopRec();stopTimer();const session=curDrill,{drill,topic,scores}=session;if(S.reps.some(r=>r.id===session.id)){toast('This practice is already saved','Your current draft is kept. Start a new practice to record a separate attempt.');return false;}
      if(scores.length!==drill.rubric.length||scores.some(n=>!Number.isInteger(n)||n<1||n>5)){lastSaveError='Choose a score from 1 to 5 for each rubric item.';status();return false;}
      const previous=S.reps.filter(r=>r.drill===drill.name),best=previous.reduce((n,r)=>Math.max(n,r.score),0),score=Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*20),beforeXP=xp();
      const entry={id:session.id,date:new Date().toISOString(),drill:drill.name,skill:drill.skill,topic:topic.text,score,transcript:session.tx||'',recSecs:session.recSecs||0,rubricScores:scores.slice()};
      const next=[...S.reps,entry];if(!writeProgress('reps',next)){toast('Practice not saved','Your transcript and scores are still here. Try Save practice again.');return false;}
      S.reps=next;const topicKey=normT(topic.text);if(topicKey&&!S.retired.includes(topicKey)){S.retired=[...S.retired,topicKey];Store.set('retiredTopics',S.retired);}
      lastSaved={...entry,xp:xp()-beforeXP,first:previous.length===0,best:previous.length>0&&score>best};lastSaveError='';curDrill=null;timerSession=null;remainingMs=null;Store.set(DRAFT,null);nav('progress');toast('Practice saved',lastSaved.xp+' XP added'+(lastSaved.best?' · New personal best':lastSaved.first?' · First practice for this drill':''));return true;
    };
    doneLesson=function(id){const next={...S.lessonsDone};if(next[id])delete next[id];else next[id]=true;if(!writeProgress('lessonsDone',next)){toast('Lesson change not saved','Try again when storage is available.');return;}S.lessonsDone=next;lastSaveError='';render();toast(next[id]?'Lesson saved':'Lesson marked incomplete',next[id]?'+15 XP':'Progress updated');};
    submitAssess=function(){if(Object.keys(curAnswers).length<ASSESS.length)return;const scores={};for(const skill of SKILLS){const answers=ASSESS.map((q,i)=>q.s===skill.id?curAnswers[i]:null).filter(n=>n!==null);if(!answers.length||answers.some(n=>!Number.isInteger(n)||n<1||n>5))return;scores[skill.id]=Math.round(answers.reduce((a,b)=>a+b,0)/answers.length*20);}const next=[...S.assessments,{date:new Date().toISOString(),scores}];if(!writeProgress('assessments',next)){toast('Assessment not saved','Your answers are still here. Try saving again.');return;}S.assessments=next;curAnswers={};lastSaveError='';nav('progress');toast('Assessment saved','+25 XP');};
    resetRep=function(){
      if(!curDrill)return;stopRec();stopTimer();
      const session=curDrill,snapshot={tx:session.tx||'',secs:session.recSecs||0};
      session.tx='';session.recSecs=0;session.graded=false;timerLeft=session.drill.time;remainingMs=timerLeft*1000;timerSession=session;rememberPractice();render();
      if(snapshot.tx.trim())undoToast('Rep restarted. Previous transcript available with Undo.',()=>{
        if(curDrill!==session||session.tx||recOn||timerInt){toast('The current rep was kept','Undo cannot replace newer work.');return;}
        session.tx=snapshot.tx;session.recSecs=snapshot.secs;rememberPractice();render();
      });else toast('Rep restarted','Same topic, full timer.');
    };
    function info(label,text){return '<details class="atlas-info"><summary aria-label="'+label+'"><span aria-hidden="true">i</span></summary><div class="atlas-info-body">'+text+'</div></details>';}
    drillView=function(){
      let html=oldDrillView().replace('↺ Reset the clock','Restart rep').replace('Record → transcript → AI grade','2 · Review your transcript').replace('Self-score this rep','3 · Score and save').replace('>Log rep (+10 XP)<','>Save practice (+10 XP)<');
      html=html.replace('stopRec();curDrill=null;stopTimer();render()','CommunicationImprovements.leavePractice()');
      html=html.replace(/(<textarea id="gradeBox"[^>]*>)[\s\S]*?(<\/textarea>)/,(_,open,close)=>open+esc(curDrill.gradePaste||'')+close);
      html=html.replace('<div class="card rubric">','<div class="card rubric"><p id="communication-practice-status" role="status">'+esc(lastSaveError||'Draft saved on this device')+'</p>'+info('How practice is saved','Your transcript, timer and rubric scores stay in an unfinished draft on this device. Save practice adds one history record and 10 XP. Returning to a draft keeps dictation off until you start it.'));
      html=html.replace(/<p class="muted">Tap record and run the rep[\s\S]*?<\/p>/,info('About dictation and feedback','Dictation creates text, not an audio recording. You can also type or use keyboard dictation. Review the transcript before saving. External feedback is optional.'));
      html=html.replace('<p class="muted">Be honest, this calibrates your training plan.</p>',info('About self-scoring','Rate this attempt using the rubric. Your saved scores help you review progress and choose what to practise.'));
      html=html.replace('>● Record<','>Start dictation<').replace('>■ Stop recording<','>Stop dictation<');
      const start='<div class="flex" style="margin-top:8px">\n      <button class="btn" onclick="copyGradePrompt()">';
      html=html.replace(start,'<details class="communication-feedback"><summary>Optional external feedback</summary>'+info('How external feedback works','Copy the grading prompt to your chosen assistant, then paste its JSON feedback here. This page does not send your transcript automatically.')+start);
      html=html.replace('  </div>\n  <div class="card rubric">','    </details>\n  </div>\n  <div class="card rubric">');
      return html;
    };
    function recoveryBanner(){const saved=curDrill||Store.get(DRAFT,null);if(!saved&&!draftProblem)return '';if(saved?.id&&S.reps.some(r=>r.id===saved.id)&&!draftProblem)return '';return '<section class="card communication-resume"><h2>'+(draftProblem?'Unfinished practice unavailable':'Unfinished practice')+'</h2><p>'+esc(draftProblem||curDrill?.topic.text||saved?.topic?.text||'Your draft is saved on this device.')+'</p><div class="flex">'+(!draftProblem?'<button class="btn" onclick="CommunicationImprovements.resumePractice()">Resume practice</button>':'<button class="btn ghost" onclick="exportData()">Export recovery backup</button>')+'<button class="btn ghost" onclick="CommunicationImprovements.discardPractice()">Discard draft</button></div></section>';}
    function recentHistory(){const recent=sorted(S.reps).reverse().slice(0,8);if(!recent.length)return '';return '<div class="card communication-history"><h2>Recent practice</h2>'+recent.map(r=>'<details><summary><span><b>'+esc(r.drill)+'</b><span class="muted">'+esc(r.topic)+'</span></span><span>'+r.score+'/100 · '+recordDay(r.date)+'</span></summary>'+(typeof r.transcript==='string'&&r.transcript?'<p class="communication-transcript">'+esc(r.transcript)+'</p>':'<p class="muted">No transcript was saved for this practice.</p>')+'</details>').join('')+'</div>';}
    const oldDash=pageDash,oldTrain=pageTrain,oldProgress=pageProgress;
    const topicShortcut=()=>'<div class="communication-topic-shortcut"><button id="communication-topic-open" type="button" class="btn ghost" onclick="CommunicationImprovements.editTopics()">Edit topics</button></div>';
    pageDash=()=>recoveryBanner()+topicShortcut()+oldDash();pageTrain=()=>curDrill?oldTrain():recoveryBanner()+topicShortcut()+oldTrain();
    pageProgress=function(){const assessments=S.assessments,reps=S.reps;S.assessments=sorted(assessments);S.reps=sorted(reps);try{let html=oldProgress().replace(/<div class="card"><h2>Recent reps<\/h2>[\s\S]*?(?=\n  <div class="card">\n    <h2>Backup & restore<\/h2>)/,recentHistory());if(lastSaved)html='<section class="card communication-saved" role="status"><h2>Practice saved</h2><p>'+esc(lastSaved.drill)+' · '+lastSaved.score+'/100 · +'+lastSaved.xp+' XP'+(lastSaved.best?' · New personal best':lastSaved.first?' · First practice for this drill':'')+'</p></section>'+html;return html;}finally{S.assessments=assessments;S.reps=reps;}};
    const oldGradeSave=saveGradePaste;
    saveGradePaste=function(src){const count=S.grades.length;oldGradeSave(src);if(curDrill){if(S.grades.length>count)curDrill.gradePaste='';rememberPractice();render();}};
    render=function(){
      const keep=renderedPage===curPage&&renderedSession===curDrill,x=window.scrollX||0,y=window.scrollY||0;
      oldRender();renderedPage=curPage;renderedSession=curDrill;if(keep)window.scrollTo(x,y);
      timerUI();recordingUI();status();
      $('txBox')?.setAttribute('aria-label','Practice transcript');$('gradeBox')?.setAttribute('aria-label','Paste JSON feedback');
    };
    fallbackCopy=function(text,done){
      const focus=document.activeElement,box=document.createElement('textarea');box.value=text;box.style.cssText='position:fixed;left:0;top:0;opacity:0;font-size:16px';document.body.appendChild(box);box.focus();box.select();
      try{if(!document.execCommand('copy'))throw Error('Copy rejected');done();}catch{toast('Copy unavailable','Select the text and copy it manually.');}finally{box.remove();focus?.focus?.({preventScroll:true});}
    };
    exportData=function(){
      const url=URL.createObjectURL(new Blob([JSON.stringify(Store.dump(),null,2)],{type:'application/json'})),link=document.createElement('a');link.href=url;link.download='communication-trainer-progress.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    };
    function validateBackup(raw){
      if(!raw||typeof raw!=='object'||Array.isArray(raw)||!['reps','assessments','grades'].some(key=>Array.isArray(raw[key])))throw Error('Use an exported Communication Trainer progress file.');
      const allowed=new Set([...Object.keys(fields),'topics','goalNote','proCatsAdded',DRAFT]),out={};
      const arrays=new Set(['reps','assessments','grades','pendingGrades','customTopics','retiredTopics','catsEnabled']);
      const objects=new Set(['lessonsDone','prepNotes','refreshed']);
      for(const [key,value]of Object.entries(raw)){
        if(!allowed.has(key))continue;if(key===DRAFT){out[key]=validateDraft(value);continue;}if(key==='topicBank'){out[key]=validateTopicBank(value);continue;}if(value===null&&key!=='bankUpdated')continue;
        if(arrays.has(key)&&!Array.isArray(value))throw Error('Invalid progress list.');
        if(objects.has(key)&&(!value||typeof value!=='object'||Array.isArray(value)))throw Error('Invalid progress details.');
        if(['city','goalNote'].includes(key)&&typeof value!=='string')throw Error('Invalid text field.');
        if(key==='bankUpdated'&&value!==null&&typeof value!=='string')throw Error('Invalid update date.');
        if(key==='proCatsAdded'&&typeof value!=='boolean')throw Error('Invalid settings.');
        if(['reps','assessments','grades','pendingGrades'].includes(key)&&value.some(item=>!item||typeof item!=='object'||Array.isArray(item)||typeof item.date!=='string'||!Number.isFinite(Date.parse(item.date))))throw Error('Invalid practice record.');
        const object=item=>item&&typeof item==='object'&&!Array.isArray(item);
        const score=item=>Number.isFinite(item)&&item>=0&&item<=100;
        if(key==='reps'&&value.some(item=>typeof item.drill!=='string'||typeof item.topic!=='string'||typeof item.skill!=='string'||!score(item.score)))throw Error('Invalid practice score.');
        if(key==='reps'){const ids=value.filter(item=>item.id!==undefined).map(item=>item.id);if(ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length||value.some(item=>item.transcript!==undefined&&typeof item.transcript!=='string'||item.recSecs!==undefined&&(!Number.isFinite(item.recSecs)||item.recSecs<0)||item.rubricScores!==undefined&&(!Array.isArray(item.rubricScores)||item.rubricScores.some(n=>!Number.isInteger(n)||n<1||n>5))))throw Error('Invalid saved practice details.');}
        if(key==='assessments'&&value.some(item=>!object(item.scores)||SKILLS.some(skill=>!score(item.scores[skill.id]))))throw Error('Invalid assessment scores.');
        if(key==='grades'&&value.some(item=>!score(item.overall)||!object(item.scores)||typeof item.topic!=='string'||typeof item.drill!=='string'||Object.values(item.scores).some(n=>n!==null&&(!Number.isFinite(n)||n<1||n>10))))throw Error('Invalid saved grade.');
        if(key==='pendingGrades'&&value.some(item=>typeof item.topic!=='string'||typeof item.drill!=='string'))throw Error('Invalid pending feedback.');
        if(['retiredTopics','catsEnabled'].includes(key)&&value.some(item=>typeof item!=='string'))throw Error('Invalid topic settings.');
        if(key==='customTopics'&&value.some(item=>!object(item)||typeof item.text!=='string'||typeof item.cat!=='string'))throw Error('Invalid custom topic.');
        if(key==='lessonsDone'&&Object.values(value).some(item=>typeof item!=='boolean'))throw Error('Invalid lesson completion.');
        if(key==='prepNotes'&&Object.values(value).some(item=>typeof item!=='string'))throw Error('Invalid preparation note.');
        if(key==='refreshed'&&Object.values(value).some(items=>!Array.isArray(items)||items.some(item=>typeof item!=='string')))throw Error('Invalid refreshed topic list.');
        out[key]=copy(value);
      }
      return out;
    }
    Store.load=function(raw){const data=validateBackup(raw);for(const [key,value]of Object.entries(data))Store.set(key,value);return data;};
    importData=async function(input){
      const file=input.files?.[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error('This file is too large to import.');
        const data=validateBackup(JSON.parse(await file.text()));
        uiConfirm('Import this progress?','Progress categories present in this file will replace their current values. Categories missing from an older backup will be kept.','Import',()=>{
          stopRec();stopTimer();const imported=Store.load(data);for(const [key,field]of Object.entries(fields))if(Object.hasOwn(imported,key))S[field]=copy(imported[key]);lastSaved=null;lastSaveError='';if(Object.hasOwn(imported,DRAFT)){draftProblem=null;try{restorePractice(imported[DRAFT]);}catch(error){draftProblem=error.message;curDrill=null;}}render();
          if(!unsaved.size)uiNote('Progress imported.');else toast('Import retained in this page','Retry saving or export before closing.');
        });
      }catch(error){uiNote(error instanceof SyntaxError?'This is not a valid JSON progress file.':error.message||'Could not read this file.');}
      finally{input.value='';}
    };
    // Category edits are one atomic record. The original bank and all practice
    // records remain intact; opening the editor never migrates or writes data.
    const topicCategories=[...Object.keys(DEFAULT_TOPICS),'custom'];
    const topicName=cat=>DEFAULT_TOPICS[cat]?.name||'Custom';
    const uniqueTopics=items=>{const seen=new Set();return items.map(t=>t.trim()).filter(t=>t&&!seen.has(normT(t))&&seen.add(normT(t)));};
    function validateTopicBank(value){
      if(value===null)return null;
      if(!value||value.schemaVersion!==1||!value.categories||typeof value.categories!=='object'||Array.isArray(value.categories)||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt)))throw Error('The edited topic bank could not be read.');
      for(const [cat,items]of Object.entries(value.categories))if(!topicCategories.includes(cat)||!Array.isArray(items)||items.length>1000||items.some(t=>typeof t!=='string'||!t.trim()||t.length>1000))throw Error('Invalid edited topic category.');
      return copy(value);
    }
    let topicProblem='',topicEditor=null,topicDialog=null,lastTopicError='';
    S.topicBank=null;
    try{const raw=localStorage.getItem('mc_topicBank');if(raw!==null)S.topicBank=validateTopicBank(JSON.parse(raw));}catch{topicProblem='Saved topic edits could not be read. Export your progress before replacing them.';}
    const oldDump=Store.dump;
    Store.dump=function(){const result=oldDump();if(topicProblem)try{result.unreadableTopicBank=localStorage.getItem('mc_topicBank');}catch{}return result;};
    function categoryItems(cat){return uniqueTopics(S.topicBank?.categories[cat]??[...(S.refreshed[cat]||[]),...(DEFAULT_TOPICS[cat]?.items||[]),...S.customTopics.filter(t=>t.cat===cat).map(t=>t.text)]);}
    effectiveItems=cat=>categoryItems(cat).filter(t=>!isRetired(t));
    allTopics=()=>topicCategories.filter(cat=>cat==='custom'||S.catsEnabled.includes(cat)).flatMap(cat=>effectiveItems(cat).map(text=>({cat,text})));
    function topicStamp(){return JSON.stringify(Object.entries({topicBank:null,refreshed:{},customTopics:[],retiredTopics:[]}).map(([key,fallback])=>{const raw=localStorage.getItem('mc_'+key);return raw===null?fallback:JSON.parse(raw);}));}
    function syncTopics(){
      const bank=localStorage.getItem('mc_topicBank');S.topicBank=bank===null?null:validateTopicBank(JSON.parse(bank));
      for(const key of ['refreshed','customTopics','retiredTopics'])S[fields[key]]=Store.get(key,S[fields[key]]);
      topicProblem='';
    }
    function topicError(message){lastTopicError=message;const box=$('communication-topic-error');if(box)box.textContent=message;return false;}
    function cleanTopicLines(raw){
      if(typeof raw!=='string'||raw.length>250000)throw Error('Use a shorter topic list.');
      const lines=raw.split(/\r?\n/).map(t=>t.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/,'')).filter(Boolean);
      if(lines.length>1000||lines.some(t=>t.length>1000))throw Error('Use up to 1,000 topics, each under 1,000 characters.');
      return uniqueTopics(lines);
    }
    function topicCount(){try{const items=cleanTopicLines($('communication-topic-text').value);$('communication-topic-count').textContent=items.length+' topic'+(items.length===1?'':'s')+' · duplicates removed on save';}catch(error){$('communication-topic-count').textContent=error.message;}}
    function selectTopicCategory(cat){
      if(!topicCategories.includes(cat))return false;
      if(topicEditor&&$('communication-topic-text').value!==topicEditor.text){$('communication-topic-category').value=topicEditor.cat;return topicError('Save or cancel these edits before switching categories.');}
      const text=effectiveItems(cat).join('\n');topicEditor={cat,text,stamp:topicStamp()};
      $('communication-topic-category').value=cat;$('communication-topic-text').value=text;topicError('');topicCount();return true;
    }
    function editTopics(cat='custom'){
      if(unsaved.size){toast('Save pending changes first','Retry saving or export your progress before editing topics.');return false;}
      try{syncTopics();}catch{toast('Topic edits unavailable','Export your progress before replacing unreadable topic data.');return false;}
      if(!topicDialog){
        topicDialog=document.createElement('dialog');topicDialog.id='communication-topic-editor';topicDialog.setAttribute('aria-labelledby','communication-topic-title');
        topicDialog.innerHTML='<form id="communication-topic-form"><div class="communication-topic-heading"><h2 id="communication-topic-title">Edit topics</h2>'+info('How topic edits work','Write one topic per line. Edit, remove, or paste lines to update this category. Blank lines, bullets and duplicates are cleaned up when you save. Edits apply to future practice; history, preparation notes and retired topics are kept. Saved on this device and included in progress exports.')+'</div><label for="communication-topic-category">Category</label><select id="communication-topic-category">'+topicCategories.map(k=>'<option value="'+k+'">'+esc(topicName(k))+'</option>').join('')+'</select><label for="communication-topic-text">Topics · one per line</label><textarea id="communication-topic-text" rows="10" aria-describedby="communication-topic-count communication-topic-error" placeholder="Explain a new idea clearly\nMake the case for a local improvement"></textarea><p id="communication-topic-count" class="muted" role="status"></p><p id="communication-topic-error" role="alert"></p><div class="communication-topic-actions"><button type="button" class="btn ghost" id="communication-topic-cancel">Cancel</button><button type="submit" class="btn">Save topics</button></div></form>';
        document.body.appendChild(topicDialog);
        $('communication-topic-form').onsubmit=event=>{event.preventDefault();saveTopics();};
        $('communication-topic-text').oninput=topicCount;
        $('communication-topic-category').onchange=event=>selectTopicCategory(event.target.value);
        $('communication-topic-cancel').onclick=()=>topicDialog.close();
        topicDialog.addEventListener('close',()=>{topicEditor=null;});
      }
      if(topicDialog.open)return false;
      topicEditor=null;selectTopicCategory(topicCategories.includes(cat)?cat:'custom');
      if(curDrill){stopRec();stopTimer();rememberPractice();}
      topicDialog.showModal();$('communication-topic-text').focus();return true;
    }
    function commitTopics(next,stamp){
      try{if(topicStamp()!==stamp)throw Error('Topics changed in another tab. Copy your edits, then reopen the editor to use the latest list.');validateTopicBank(next);}
      catch(error){return topicError(error.message);}
      const before=copy(S.topicBank);
      if(!writeProgress('topicBank',next))return topicError('Topics were not saved. Your edits are still here. Free some browser storage, then try Save topics again.');
      S.topicBank=copy(next);topicProblem='';lastSaveError='';
      undoToast('Topics saved on this device.',()=>{
        try{if(localStorage.getItem('mc_topicBank')!==JSON.stringify(next)){toast('Newer topic edits were kept','Undo cannot replace a later update.');return;}}catch{return;}
        if(!writeProgress('topicBank',before)){toast('Undo was not saved','Your current topics were kept.');return;}S.topicBank=before;render();
      });return true;
    }
    function saveTopics(){
      if(!topicEditor)return false;
      let items;try{items=cleanTopicLines($('communication-topic-text').value);}catch(error){return topicError(error.message);}
      const {cat,stamp}=topicEditor;
      const next={schemaVersion:1,updatedAt:new Date().toISOString(),categories:{...(S.topicBank?.categories||{}),[cat]:uniqueTopics([...items,...categoryItems(cat).filter(isRetired)])}};
      if(!commitTopics(next,stamp))return false;
      topicDialog.close();topicEditor=null;render();$('communication-topic-open')?.focus({preventScroll:true});return true;
    }
    toggleCat=function(cat){
      if(!Object.hasOwn(DEFAULT_TOPICS,cat))return;
      const next=S.catsEnabled.includes(cat)?S.catsEnabled.filter(k=>k!==cat):[...S.catsEnabled,cat];
      if(!writeProgress('catsEnabled',next)){toast('Category change not saved','Try again when storage is available.');return;}S.catsEnabled=next;lastSaveError='';render();
    };
    retireTopic=function(text){
      const key=normT(text);if(!key||S.retired.includes(key))return false;
      const before=S.retired.slice(),next=[...before,key];if(!writeProgress('retiredTopics',next))return false;
      S.retired=next;undoToast('Topic retired.',()=>{if(JSON.stringify(S.retired)!==JSON.stringify(next))return;if(writeProgress('retiredTopics',before)){S.retired=before;render();}});return true;
    };
    restoreTopic=function(key){const next=S.retired.filter(k=>k!==key);if(writeProgress('retiredTopics',next)){S.retired=next;render();}};
    applyTopicPaste=function(){
      const parsed=parseTopicPaste($('pasteBox').value);if(!parsed){toast('Could not read those topics','Paste a topic refresh with category lists.');return false;}
      try{
        if(unsaved.size)throw Error('Retry saving your pending changes first.');syncTopics();const stamp=topicStamp(),categories={...(S.topicBank?.categories||{})};
        for(const [cat,items]of Object.entries(parsed))categories[cat]=uniqueTopics([...cleanTopicLines(items.join('\n')),...categoryItems(cat)]);
        if(!commitTopics({schemaVersion:1,updatedAt:new Date().toISOString(),categories},stamp)){toast('Topics were not saved',lastTopicError);return false;}
        render();return true;
      }catch(error){toast('Topics were not saved',error.message);return false;}
    };
    const oldStaleLine=staleLine;
    staleLine=()=>S.topicBank?.updatedAt?'Topics updated '+S.topicBank.updatedAt.slice(0,10)+'.':oldStaleLine();
    daysSinceRefresh=()=>Math.max(0,Math.floor((new Date()-new Date(S.topicBank?.updatedAt||S.bankUpdated||'2026-06-10T00:00:00'))/86400000));
    pageTopics=function(){
      const rows=topicCategories.map(cat=>{
        const items=effectiveItems(cat),enabled=cat==='custom'||S.catsEnabled.includes(cat);
        return '<section class="card communication-topic-category"><div class="communication-topic-heading"><h3>'+esc(topicName(cat))+'</h3><div class="flex">'+(cat==='custom'?'<span class="muted">Always on</span>':'<button type="button" class="btn ghost" aria-pressed="'+enabled+'" aria-label="Use '+esc(topicName(cat))+' topics" onclick="toggleCat(\''+cat+'\')">'+(enabled?'On':'Off')+'</button>')+'<button type="button" class="btn ghost" aria-label="Edit '+esc(topicName(cat))+' topics" onclick="CommunicationImprovements.editTopics(\''+cat+'\')">Edit</button></div></div><details class="communication-topic-list"><summary>'+items.length+' active topic'+(items.length===1?'':'s')+'</summary>'+(items.length?items.map(t=>'<div class="topicitem"><span>'+esc(t)+(S.prepNotes[t]?' <span class="tag">prepped</span>':'')+'</span><div class="flex"><button type="button" class="btn ghost" data-learn="'+esc(t)+'">Learn ↗</button><button type="button" class="btn ghost" data-topic-retire="'+esc(t)+'">Retire</button></div></div>').join(''):'<p class="muted">Add topics with Edit to use this category.</p>')+'</details></section>';
      }).join('');
      return '<section class="card"><div class="communication-topic-heading"><h2>Your topics</h2>'+info('About your topic bank','Practice draws from categories marked On, plus Custom. Edit any category using plain text. Topics you complete or retire stay out of rotation until restored. Changing a topic’s wording leaves its earlier practice and preparation notes under the original wording.')+'</div><p class="muted">'+esc(staleLine())+'</p>'+(topicProblem?'<p role="alert">'+esc(topicProblem)+'</p>':'')+'<button id="communication-topic-open" type="button" class="btn" onclick="CommunicationImprovements.editTopics()">Edit topics</button></section>'+rows+
      '<details class="card communication-topic-refresh"><summary>Optional: refresh with an assistant</summary>'+info('About assisted refresh','Copy the prompt to your chosen assistant and paste its reply below. Adding the reply merges those topics into your existing categories. Nothing is sent automatically.')+'<label for="cityInput">City for local topics</label><div class="flex"><input id="cityInput" value="'+esc(S.city)+'"><button type="button" class="btn ghost" onclick="saveCity()">Save city</button></div><label for="refreshPrompt">Refresh prompt</label><textarea id="refreshPrompt" rows="5" readonly>'+esc(refreshPromptText())+'</textarea><button type="button" class="btn ghost" onclick="copyRefreshPrompt()">Copy prompt</button><label for="pasteBox">Paste the reply</label><textarea id="pasteBox" rows="5"></textarea><button type="button" class="btn" onclick="applyTopicPaste()">Add these topics</button><details><summary>Browse topic sources</summary>'+Object.entries(CATEGORY_SOURCES).map(([cat,sources])=>'<h3>'+esc(topicName(cat))+'</h3>'+sources.map(([name,url])=>'<a class="pill" href="'+esc(url)+'" target="_blank" rel="noopener">'+esc(name)+' ↗</a>').join('')).join('')+'</details></details>'+
      (S.retired.length?'<details class="card communication-topic-list"><summary>Retired topics · '+S.retired.length+'</summary>'+info('About retired topics','Completed or dismissed topics stay out of future practice. Restore one for another attempt.')+S.retired.map(t=>'<div class="topicitem"><span>'+esc(t)+'</span><button type="button" class="btn ghost" data-topic-restore="'+esc(t)+'">Restore</button></div>').join('')+'</details>':'');
    };
    document.addEventListener('click',event=>{
      const retire=event.target.closest?.('[data-topic-retire]'),restore=event.target.closest?.('[data-topic-restore]');
      if(retire){retireTopic(retire.dataset.topicRetire,'Retired:');render();}
      if(restore)restoreTopic(restore.dataset.topicRestore);
    });
    function hide(){if(document.hidden){stopRec();stopTimer();rememberPractice();}}
    document.addEventListener('visibilitychange',hide);
    window.addEventListener('pagehide',()=>{stopRec();stopTimer();rememberPractice();});
    window.addEventListener('beforeunload',event=>{rememberPractice();if(unsaved.size||topicDialog?.open&&topicEditor&&$('communication-topic-text').value!==topicEditor.text){event.preventDefault();event.returnValue='';}});
    document.addEventListener('input',event=>{if(event.target.id==='txBox'&&recOn)stopRec();if(curDrill){if(event.target.id==='txBox')curDrill.tx=event.target.value;if(event.target.id==='gradeBox')curDrill.gradePaste=event.target.value;lastSaveError='';rememberPractice();}});
    document.addEventListener('click',event=>{
      const action=event.target.closest?.('[data-communication-action]')?.dataset.communicationAction;
      if(action==='retry'){save();if(curDrill)rememberPractice();else if(unsaved.has(DRAFT))Store.set(DRAFT,shadow.get(DRAFT));if(!unsaved.size){lastSaveError='';toast('Progress saved','Saved on this device.');status();}}
      if(action==='export')exportData();
    });
    let savedDraftRaw;try{savedDraftRaw=localStorage.getItem('mc_'+DRAFT);}catch{diskAvailable=false;}
    if(savedDraftRaw!=null)try{restorePractice(JSON.parse(savedDraftRaw));}catch(error){draftProblem=error.message||'Could not read the unfinished practice.';}
    window.CommunicationImprovements=Object.freeze({validateBackup,rememberPractice,resumePractice,leavePractice,discardPractice,editTopics,saveTopics,selectTopicCategory,cleanTopicLines,get unsaved(){return unsaved.size;}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
