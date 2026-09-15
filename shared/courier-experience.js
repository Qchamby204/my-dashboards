/* Courier-only experience refinements layered over the legacy inline player. */
(()=>{
  'use strict';
  if(document.documentElement.dataset.atlasApp!=='courier'||window.CourierExperience)return;

  const $=id=>document.getElementById(id);
  const fmt=seconds=>{
    const n=Math.max(0,Math.round(Number(seconds)||0));
    return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
  };
  const setText=(el,value)=>{if(el&&el.textContent!==value)el.textContent=value;};
  const context=()=>window.getCourierContext?.()||{};
  const exactDuration=block=>{
    const seconds=Number(block?.durationSeconds);
    return Number.isFinite(seconds)&&seconds>0?seconds:null;
  };

  function currentId(){return document.querySelector('.block.active')?.dataset.id||null;}
  function currentDay(){return context().day||null;}

  function decorateSectionTimes(day){
    let elapsed=0;
    let allExact=true;
    for(const block of day.blocks||[]){
      const section=document.querySelector(`.block[data-id="${CSS.escape(block.id)}"]`);
      const seconds=exactDuration(block);
      if(!seconds){
        allExact=false;
        elapsed+=Math.max(0,Number(block.minutes)||0)*60;
        continue;
      }
      setText(section?.querySelector('.mins'),`${fmt(seconds)} audio`);
      setText(section?.querySelector('.startat'),`starts ${fmt(elapsed)}`);
      elapsed+=seconds;
    }
    if(!currentId()&&allExact&&elapsed>0){
      setText($('railTotal'),fmt(elapsed));
      const cap=day.budgetMinutes?`Total audio · cap ${Math.round(day.budgetMinutes)} min`:'Total audio';
      setText($('railCap'),cap);
    }
  }

  function decorateQueueTime(day){
    const id=currentId(),audio=$('audio');
    if(!id||!audio)return;
    const index=day.blocks.findIndex(block=>block.id===id);
    if(index<0)return;
    const current=day.blocks[index];
    const browserDuration=Number(audio.duration);
    const currentDuration=Number.isFinite(browserDuration)&&browserDuration>0?browserDuration:exactDuration(current);
    if(!currentDuration)return;
    const later=(day.blocks||[]).slice(index+1).filter(block=>block.audio);
    const laterDurations=later.map(exactDuration);
    if(laterDurations.some(value=>value===null))return;
    const elapsed=Math.max(0,Math.min(Number(audio.currentTime)||0,currentDuration));
    const rate=Number(audio.playbackRate)>0?Number(audio.playbackRate):1;
    const remaining=(Math.max(0,currentDuration-elapsed)+laterDurations.reduce((sum,value)=>sum+value,0))/rate;
    const rateText=rate===1?'':` at ${rate}×`;
    setText($('pQueueTime'),`${fmt(remaining)} left in edition${rateText}`);
    setText($('railTotal'),fmt(remaining));
    setText($('railCap'),'Audio left in edition');
  }

  function smartPlayLabel(){
    const button=$('playAll'),day=currentDay();
    if(!button||!day)return;
    const resume=$('resumeListening');
    const heard=document.querySelector('.block.done');
    setText(button,(!resume?.hidden||heard)?'Continue all':'Play all');
  }

  function refresh(){
    const day=currentDay();
    if(!day)return;
    decorateSectionTimes(day);
    decorateQueueTime(day);
    smartPlayLabel();
  }

  function enableQueue(){
    const checkbox=$('pContinue');
    if(checkbox&&!checkbox.checked){
      checkbox.checked=true;
      checkbox.dispatchEvent(new Event('change',{bubbles:true}));
    }
  }

  function smartStartTarget(){
    const resume=$('resumeListening');
    if(resume&&!resume.hidden)return resume;
    const unheard=document.querySelector('.block:not(.done):not(.mute) [data-act="play"]');
    if(unheard&&document.querySelector('.block.done'))return unheard;
    return null;
  }

  let skippedSource='';
  function wire(){
    document.addEventListener('click',event=>{
      const trigger=event.target.closest?.('#playAll');
      if(!trigger)return;
      const target=smartStartTarget();
      if(!target)return; // untouched first-run behaviour
      event.preventDefault();
      event.stopImmediatePropagation();
      enableQueue();
      target.click();
    },true);

    const audio=$('audio');
    audio?.addEventListener('error',()=>{
      const next=$('pNext'),continueBox=$('pContinue');
      const source=audio.currentSrc||audio.src||'';
      if(!source||source===skippedSource||!continueBox?.checked||next?.disabled)return;
      skippedSource=source;
      setText($('pStatus'),'Audio unavailable. Skipping to the next section…');
      setTimeout(()=>{
        if((audio.currentSrc||audio.src)===source&&continueBox.checked&&!next.disabled)next.click();
      },500);
    });
    audio?.addEventListener('playing',()=>{skippedSource='';refresh();});
    for(const event of ['timeupdate','durationchange','ratechange','loadedmetadata','ended'])audio?.addEventListener(event,refresh);
    document.addEventListener('change',refresh,true);
    document.addEventListener('click',()=>queueMicrotask(refresh),true);
    new MutationObserver(()=>queueMicrotask(refresh)).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled']});
    refresh();
  }

  window.CourierExperience=Object.freeze({refresh});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
