/* Reliability fixes for the original Communication Trainer and its mc_* records. */
(()=>{
  const source=document.currentScript?.src;
  function start(){
    if(document.documentElement.dataset.atlasApp!=='communication-trainer'||typeof S==='undefined'||window.CommunicationImprovements)return;
    if(source){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('communication-enhancements.css',source).href;document.head.appendChild(css);}
    const oldRender=render,oldDrillView=drillView,oldLaunch=launchDrill,oldNav=nav,oldFinish=finishDrill,oldToast=toast;
    const fields={assessments:'assessments',reps:'reps',lessonsDone:'lessonsDone',customTopics:'customTopics',retiredTopics:'retired',catsEnabled:'catsEnabled',city:'city',prepNotes:'prepNotes',refreshed:'refreshed',bankUpdated:'bankUpdated',grades:'grades',pendingGrades:'pendingGrades'};
    const shadow=new Map(),unsaved=new Set();
    const copy=value=>JSON.parse(JSON.stringify(value));
    const originalGet=Store.get.bind(Store);let diskAvailable=Store.usable();
    let deadline=null,remainingMs=null,timerSession=null,speechEpoch=0,restartTask=null,renderedPage=null,renderedSession=null;
    function status(){
      let box=$('communication-save-error');
      if(!box&&unsaved.size){box=document.createElement('section');box.id='communication-save-error';box.className='card';box.setAttribute('role','alert');box.innerHTML='<p>Some changes could not be saved on this device. Keep this page open, retry saving, or export your progress.</p><div class="flex"><button type="button" class="btn ghost" data-communication-action="retry">Retry saving</button><button type="button" class="btn ghost" data-communication-action="export">Export progress</button></div>';$('main').before(box);}
      if(box)box.hidden=!unsaved.size;
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
    Store.dump=function(){const result={};for(const [key,field]of Object.entries(fields))result[key]=copy(S[field]);for(const key of ['topics','goalNote','proCatsAdded'])result[key]=Store.get(key,null);return result;};
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
      deadline=null;if(timerInt!==null){clearInterval(timerInt);timerInt=null;}if(!recOn)relWake();timerUI();
    };
    toggleTimer=function(){
      if(!curDrill)return;
      if(deadline!==null){stopTimer();return;}
      if(timerSession!==curDrill){timerSession=curDrill;remainingMs=timerLeft*1000;}
      if(timerLeft<=0)return;
      deadline=Date.now()+(remainingMs??timerLeft*1000);reqWake();timerInt=setInterval(paintTimer,250);paintTimer();
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
    launchDrill=function(drill){if(!drill)return;stopTimer();timerSession=null;remainingMs=null;oldLaunch(drill);window.scrollTo(0,0);};
    nav=function(page){if(page!=='train'&&curDrill){stopRec();stopTimer();}oldNav(page);};
    finishDrill=function(){if(!curDrill)return;oldFinish();timerSession=null;remainingMs=null;};
    resetRep=function(){
      if(!curDrill)return;stopRec();stopTimer();
      const session=curDrill,snapshot={tx:session.tx||'',secs:session.recSecs||0};
      session.tx='';session.recSecs=0;session.graded=false;timerLeft=session.drill.time;remainingMs=timerLeft*1000;timerSession=session;render();
      if(snapshot.tx.trim())undoToast('Rep restarted. Previous transcript available with Undo.',()=>{
        if(curDrill!==session||session.tx||recOn||timerInt){toast('The current rep was kept','Undo cannot replace newer work.');return;}
        session.tx=snapshot.tx;session.recSecs=snapshot.secs;render();
      });else toast('Rep restarted','Same topic, full timer.');
    };
    function info(label,text){return '<details class="atlas-info"><summary aria-label="'+label+'"><span aria-hidden="true">i</span></summary><div class="atlas-info-body">'+text+'</div></details>';}
    drillView=function(){
      let html=oldDrillView().replace('↺ Reset the clock','Restart rep').replace('Record → transcript → AI grade','2 · Review your transcript').replace('Self-score this rep','3 · Score and save').replace('>Log rep (+10 XP)<','>Save practice (+10 XP)<');
      html=html.replace(/<p class="muted">Tap record and run the rep[\s\S]*?<\/p>/,info('About dictation and feedback','Dictation creates text, not an audio recording. You can also type or use keyboard dictation. Review the transcript before saving. External feedback is optional.'));
      html=html.replace('<p class="muted">Be honest, this calibrates your training plan.</p>',info('About self-scoring','Rate this attempt using the rubric. Your saved scores help you review progress and choose what to practise.'));
      html=html.replace('>● Record<','>Start dictation<').replace('>■ Stop recording<','>Stop dictation<');
      const start='<div class="flex" style="margin-top:8px">\n      <button class="btn" onclick="copyGradePrompt()">';
      html=html.replace(start,'<details class="communication-feedback"><summary>Optional external feedback</summary>'+info('How external feedback works','Copy the grading prompt to your chosen assistant, then paste its JSON feedback here. This page does not send your transcript automatically.')+start);
      html=html.replace('  </div>\n  <div class="card rubric">','    </details>\n  </div>\n  <div class="card rubric">');
      return html;
    };
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
      const allowed=new Set([...Object.keys(fields),'topics','goalNote','proCatsAdded']),out={};
      const arrays=new Set(['reps','assessments','grades','pendingGrades','customTopics','retiredTopics','catsEnabled']);
      const objects=new Set(['lessonsDone','prepNotes','refreshed']);
      for(const [key,value]of Object.entries(raw)){
        if(!allowed.has(key))continue;if(value===null&&key!=='bankUpdated')continue;
        if(arrays.has(key)&&!Array.isArray(value))throw Error('Invalid progress list.');
        if(objects.has(key)&&(!value||typeof value!=='object'||Array.isArray(value)))throw Error('Invalid progress details.');
        if(['city','goalNote'].includes(key)&&typeof value!=='string')throw Error('Invalid text field.');
        if(key==='bankUpdated'&&value!==null&&typeof value!=='string')throw Error('Invalid update date.');
        if(key==='proCatsAdded'&&typeof value!=='boolean')throw Error('Invalid settings.');
        if(['reps','assessments','grades','pendingGrades'].includes(key)&&value.some(item=>!item||typeof item!=='object'||Array.isArray(item)||typeof item.date!=='string'||!Number.isFinite(Date.parse(item.date))))throw Error('Invalid practice record.');
        const object=item=>item&&typeof item==='object'&&!Array.isArray(item);
        const score=item=>Number.isFinite(item)&&item>=0&&item<=100;
        if(key==='reps'&&value.some(item=>typeof item.drill!=='string'||typeof item.topic!=='string'||typeof item.skill!=='string'||!score(item.score)))throw Error('Invalid practice score.');
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
          stopRec();stopTimer();const imported=Store.load(data);for(const [key,field]of Object.entries(fields))if(Object.hasOwn(imported,key))S[field]=copy(imported[key]);render();
          if(!unsaved.size)uiNote('Progress imported.');else toast('Import retained in this page','Retry saving or export before closing.');
        });
      }catch(error){uiNote(error instanceof SyntaxError?'This is not a valid JSON progress file.':error.message||'Could not read this file.');}
      finally{input.value='';}
    };
    function hide(){if(document.hidden){stopRec();stopTimer();}}
    document.addEventListener('visibilitychange',hide);
    window.addEventListener('pagehide',()=>{stopRec();stopTimer();});
    document.addEventListener('input',event=>{if(event.target.id==='txBox'&&recOn)stopRec();});
    document.addEventListener('click',event=>{
      const action=event.target.closest?.('[data-communication-action]')?.dataset.communicationAction;
      if(action==='retry'){save();if(!unsaved.size)toast('Progress saved','Saved on this device.');}
      if(action==='export')exportData();
    });
    window.CommunicationImprovements=Object.freeze({validateBackup,get unsaved(){return unsaved.size;}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
