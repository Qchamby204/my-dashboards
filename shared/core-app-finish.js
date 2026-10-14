/* Presentation and keyboard chrome only. Existing controls keep their listeners and records. */
(()=>{
 'use strict';
 const root=document.documentElement,app=root.dataset.atlasApp;
 if(!['life-ledger','life-map','workout-forge','communication-trainer'].includes(app)||window.CoreAppFinish)return;
 const paths={home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',appearance:'M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plates:'M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12',ledger:'M5 3h14v18H5z M8 7h8m-8 5h8m-8 5h5'};
 const svg=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+paths[name]+'"/></svg>';
 function icon(el,name){if(!el||el.dataset.coreIcon===name)return;el.innerHTML=svg(name);el.dataset.coreIcon=name;}
 function decorate(){
  icon(document.querySelector('.appbar .homebtn'),'home');
  icon(document.querySelector('.appbar .atlas-appearance-trigger'),'appearance');
  icon(document.querySelector('.appbar [data-act="settings"]'),'settings');
  icon(document.querySelector('.appbar [data-act="plates"]'),'plates');
  icon(document.querySelector('.appbar [data-lm="search"]'),'search');
  if(['life-ledger','workout-forge'].includes(app))icon(document.querySelector('.appbar>div:nth-child(2)>span:not(.appbar-title)'),app==='life-ledger'?'ledger':'plates');
 }
 function keyboard(){
  const v=window.visualViewport,editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  const offset=v&&v.scale===1?Math.max(0,window.innerHeight-v.height-v.offsetTop):0;
  root.classList.toggle('core-keyboard',editing&&offset>150);
  root.style.setProperty('--core-keyboard-bottom',Math.round(offset)+'px');
 }
 function ready(){
  root.classList.add('core-finished');decorate();keyboard();
  new MutationObserver(decorate).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>queueMicrotask(keyboard));
  window.visualViewport?.addEventListener('resize',keyboard,{passive:true});
  window.visualViewport?.addEventListener('scroll',keyboard,{passive:true});
 }
 window.CoreAppFinish=Object.freeze({decorate});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
