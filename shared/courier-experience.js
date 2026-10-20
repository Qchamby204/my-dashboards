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

  let opening=null,openingDay=null;
  function decorateOpening(day){
    if(!opening){
      const header=document.querySelector('body>header'),tools=document.querySelector('.courier-playback-tools'),play=$('playAll');
      if(!header||!tools||!play)return;
      opening=document.createElement('section');opening.id='courier-opening';opening.className='courier-opening';
      opening.innerHTML='<div class="courier-opening-rail"><span id="courier-opening-date">Your briefing</span></div><div class="courier-opening-face"><h1 id="courier-opening-title">Make room to listen</h1><svg class="courier-title-art" viewBox="0 0 360 280" aria-hidden="true" focusable="false"><circle cx="180" cy="142" r="122" fill="#ffffff0c"/><g stroke="#977348" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M88 97 H272 V227 H88 Z" fill="#f1e4c9"/><path d="M110 123 H250 M110 149 H181 M110 174 H181 M110 199 H162"/><g class="courier-headphones"><path d="M62 155 V119 A118 118 0 0 1 298 119 V155" stroke="#9db1c3" stroke-width="15"/><rect x="51" y="136" width="38" height="70" rx="15" fill="#9db1c3"/><rect x="271" y="136" width="38" height="70" rx="15" fill="#9db1c3"/></g><rect x="203" y="155" width="60" height="60" rx="14" fill="#26394b"/><image href="shared/icons/courier-apple.png?v=7706c5e677d5" x="208" y="160" width="50" height="50"/></g></svg><p id="courier-opening-copy">Choose an edition, listen at your pace, or read its sections.</p></div><div class="courier-opening-footer"></div>';
      header.after(opening);opening.after(tools);
      const footer=opening.querySelector('.courier-opening-footer');footer.append(play);
      const browse=document.createElement('button');browse.type='button';browse.id='courier-browse-edition';browse.textContent='Browse edition';browse.onclick=()=>{const target=$('blocks');target.style.scrollMarginTop='24px';target.scrollIntoView({block:'start',behavior:'instant'});};footer.append(browse);
    }
    const key=day?.date||'';
    const audio=day?.blocks?.some(b=>b.audio),signature=key+'|'+!!audio;
    if(openingDay!==signature){
      openingDay=signature;opening.dataset.editionKind=day?(audio?'audio':'text'):'unavailable';const dateLabel=$('courier-opening-date');dateLabel.replaceChildren();if(key){dateLabel.append(document.createTextNode('Edition · '));const date=document.createElement('time');date.dateTime=key;date.textContent=key;dateLabel.append(date);}else dateLabel.textContent='Your briefing';
      setText($('courier-opening-title'),day&&!audio?'Read at your own pace':'Make room to listen');
      setText($('courier-opening-copy'),day?(audio?'Listen at your pace, then return to the talking points, transcript and sources.':'Read the talking points, transcript and sources in this text-only edition.'):'Choose an edition, listen at your pace, or read its sections.');
      $('courier-browse-edition').disabled=!day;$('playAll').hidden=!audio;
    }
  }

  function refresh(){
    const day=currentDay();
    decorateOpening(day);
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
