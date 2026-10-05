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
    smartPlayLabel();
  }

  function wire(){
    const audio=$('audio');
    audio?.addEventListener('playing',refresh);
    for(const event of ['timeupdate','durationchange','ratechange','loadedmetadata','ended'])audio?.addEventListener(event,refresh);
    document.addEventListener('change',refresh,true);
    document.addEventListener('click',()=>queueMicrotask(refresh),true);
    new MutationObserver(()=>queueMicrotask(refresh)).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','disabled']});
    refresh();
  }

  window.CourierExperience=Object.freeze({refresh});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire,{once:true});else wire();
})();
