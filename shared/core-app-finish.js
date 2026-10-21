/* Presentation and keyboard chrome only. Existing controls keep their listeners and records. */
(()=>{
 'use strict';
 const root=document.documentElement,app=root.dataset.atlasApp;
 if(!['life-ledger','life-map','workout-forge','communication-trainer'].includes(app)||window.CoreAppFinish)return;
 const paths={home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',appearance:'M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',plates:'M3 9v6m3-9v12m12-12v12m3-9v6M6 12h12',ledger:'M5 3h14v18H5z M8 7h8m-8 5h8m-8 5h5'};
 Object.assign(paths,{book:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3z M12 6v15',film:'M4 5h12v14H4z M16 9l5-3v12l-5-3',speech:'M3 4h18v13H9l-5 4v-4H3z M7 8h10m-10 5h6',capsule:'M6 6a5 5 0 0 1 7-1l6 6a5 5 0 0 1-7 7l-6-6a5 5 0 0 1 0-6z M9 9l7 7',moon:'M20 15A9 9 0 0 1 9 3a9 9 0 1 0 11 12',case:'M3 7h18v13H3z M8 7V4h8v3M3 12h18m-11 0v3h4v-3',calendar:'M4 5h16v16H4z M8 3v4m8-4v4M4 10h16m-12 5 3 3 5-5',wallet:'M3 5h16v4H3z M3 9h18v12H3z M16 13h5v4h-5z',phone:'M7 3h10v18H7z M10 6h4m-3 12h2',globe:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M3 12h18 M12 3c-6 6-6 12 0 18 6-6 6-12 0-18',paw:'M7 14c-3 2-3 7 1 6l4-1 4 1c4 1 4-4 1-6l-2-3H9z M4 6v3m5-6v3m6-3v3m5 0v3',link:'M10 14l4-4 M8 15l-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 6 0m2 1 2-2a4 4 0 0 1 6 5l-4 4a4 4 0 0 1-6 0',cards:'M5 6h14v15H5z M8 3h13v15 M8 10h8m-8 4h8',list:'M8 5h13M8 12h13M8 19h13 M3 5h1m-1 7h1m-1 7h1',run:'M14 4h.01 M9 9l4-2 3 5h4 M13 7l-2 7-6 6m6-6 5 2-1 5 M9 9l-3 4H3',jump:'M5 20V9m-3 3 3-3 3 3M13 20V4m-3 3 3-3 3 3M20 20v-7',listen:'M8 15c-5-4-2-12 4-12 7 0 10 10 3 13-2 1-1 5-4 5-2 0-3-1-3-3 M10 12c-2-3 0-6 3-5 3 1 2 5 0 5',confidence:'M12 3l9 4v6c0 4-5 7-9 9-4-2-9-5-9-9V7z M8 12l3 3 5-6'});
 const svg=name=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+paths[name]+'"/></svg>';
 function icon(el,name){if(!el||el.dataset.coreIcon===name)return;el.innerHTML=svg(name);el.dataset.coreIcon=name;}
 function labeledIcon(el,name,label=el?.textContent){
  if(!el||el.dataset.coreIcon===name)return;
  const text=document.createElement('span');text.className='core-icon-label';text.textContent=label;
  el.innerHTML=svg(name);el.append(text);el.dataset.coreIcon=name;
 }
 function decorate(){
  icon(document.querySelector('.appbar .homebtn'),'home');
  icon(document.querySelector('.appbar .atlas-appearance-trigger'),'appearance');
  icon(document.querySelector('.appbar [data-act="settings"]'),'settings');
  icon(document.querySelector('.appbar [data-act="plates"]'),'plates');
  icon(document.querySelector('.appbar [data-lm="search"]'),'search');
  if(['life-ledger','workout-forge'].includes(app))icon(document.querySelector('.appbar>div:nth-child(2)>span:not(.appbar-title)'),app==='life-ledger'?'ledger':'plates');
  if(app==='life-ledger'){
   for(const avatar of document.querySelectorAll('.ledger-card-avatar,.ledger-list-avatar')){
    avatar.setAttribute('aria-hidden','true');
   }
   for(const control of document.querySelectorAll('[data-act="logmode"]'))labeledIcon(control,control.dataset.mode==='cards'?'cards':'list',control.dataset.mode==='cards'?'Cards':'List');
  }
  if(app==='workout-forge')for(const control of document.querySelectorAll('.atlas-goal-options [data-goal]'))labeledIcon(control,{bench:'plates',deadlift:'plates',run:'run',dunk:'jump'}[control.dataset.goal]||'plates');
  if(app==='communication-trainer')for(const control of document.querySelectorAll('.atlas-goal-options button'))labeledIcon(control,/clearly/i.test(control.textContent)?'speech':/confidence/i.test(control.textContent)?'confidence':'listen');
 }
 let openingQueued=false,openingResize,openingChrome=[];
 function opening(){
  openingQueued=false;
  if(root.classList.contains('core-keyboard'))return;
  const header=document.querySelector('.appbar'),nav=document.querySelector('.ledger-nav,.lm-day-dock,#atlas-page-navigation');
  if(!header||!nav||!nav.checkVisibility())return;
  if(openingResize&&(openingChrome[0]!==header||openingChrome[1]!==nav)){openingResize.disconnect();openingChrome=[header,nav];for(const node of openingChrome)openingResize.observe(node);}
  // Chrome owns its measured safe-area clearance. Keeping those live CSS
  // variables avoids retaining pre-stylesheet header or dock measurements.
  const fallback=Math.max(0,window.innerHeight-nav.getBoundingClientRect().top);
  const inset=app==='life-ledger'?8:0; // The native Ledger tabs have an 8px top margin inside their shell.
  const value='max(0px,calc('+window.innerHeight+'px - var(--atlas-page-nav-height,'+fallback+'px) - var(--atlas-top-h,'+header.getBoundingClientRect().height+'px) - 48px + '+inset+'px))';if(root.style.getPropertyValue('--core-opening-height')!==value)root.style.setProperty('--core-opening-height',value);
  const selectors={'life-ledger':'.ledger-view:not([hidden]) .ledger-deck-frame,.ledger-view:not([hidden]) .ledger-feature','life-map':'.lm-day-view:not([hidden]) .lm-feature','workout-forge':'.fg-feature','communication-trainer':'#main>.cm-feature'};
  const card=[...document.querySelectorAll(selectors[app])].find(n=>n.checkVisibility());
  for(const prior of document.querySelectorAll('.core-opening-card'))if(prior!==card)prior.classList.remove('core-opening-card');
  if(!card)return;card.classList.add('core-opening-card');
  const rail=card.querySelector(':scope>.ledger-deck-rail,:scope>.ledger-feature-rail,:scope>.lm-feature-rail,:scope>.fg-feature-rail,:scope>.cm-feature-rail');
  const footer=card.querySelector(':scope>.ledger-checkin-save,:scope>.ledger-feature-footer,:scope>.lm-feature-footer,:scope>.fg-feature-footer,:scope>.cm-feature-footer');
  const body='max(0px,calc(var(--core-opening-height) - '+((rail?.getBoundingClientRect().height||0)+(footer?.getBoundingClientRect().height||0)+2)+'px))';
  if(card.style.getPropertyValue('--core-opening-body-height')!==body)card.style.setProperty('--core-opening-body-height',body);
 }
 function scheduleOpening(){if(!openingQueued){openingQueued=true;requestAnimationFrame(opening);}}
 function loaded(){window.AtlasMobile?.measure();opening();}
 let keyboardVisible=false;
 function keyboard(){
  const v=window.visualViewport,editing=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName);
  const offset=v&&v.scale===1?Math.max(0,window.innerHeight-v.height-v.offsetTop):0;
  // Focus moves to Save before a touch finishes. Keep chrome in place until
  // the keyboard's viewport gap actually closes, so the first tap can commit.
  const wasKeyboardVisible=keyboardVisible;keyboardVisible=offset>150&&(editing||keyboardVisible);
  if(keyboardVisible&&!wasKeyboardVisible){
   const card=document.querySelector('.core-opening-card'),height=card&&window.getComputedStyle?.(card).minHeight;
   if(height&&height!=='auto')root.style.setProperty('--core-opening-height',height);
  }
  root.classList.toggle('core-keyboard',keyboardVisible);
  root.style.setProperty('--core-keyboard-bottom',Math.round(offset)+'px');
  const saving=app==='life-ledger'&&document.activeElement?.matches?.('#ledger-checkin-save button');
  if((editing||saving)&&offset>150){
   const rect=document.activeElement?.getBoundingClientRect?.(),dock=app==='life-ledger'?document.querySelector('.ledger-dock'):null;
   const bottom=Math.min(v.offsetTop+v.height,dock?.getBoundingClientRect?.().top??Infinity)-16;
   if(rect&&rect.bottom>bottom)window.scrollBy?.({top:rect.bottom-bottom,behavior:'instant'});
  }
 }
 function ready(){
  root.classList.add('core-finished');decorate();keyboard();scheduleOpening();
  new MutationObserver(records=>{if(records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>node.nodeType===1)))decorate();scheduleOpening();}).observe(document.body,{childList:true,subtree:true});
  new MutationObserver(scheduleOpening).observe(root,{attributes:true,attributeFilter:['class','style']});
  if(window.ResizeObserver)openingResize=new ResizeObserver(scheduleOpening);
  window.addEventListener('resize',scheduleOpening,{passive:true});window.addEventListener('load',loaded);window.addEventListener('pageshow',scheduleOpening);document.fonts?.ready.then(scheduleOpening);
  document.addEventListener('load',event=>{if(event.target?.tagName==='LINK')loaded();},true);
  document.addEventListener('focusin',keyboard);document.addEventListener('focusout',()=>queueMicrotask(keyboard));
  window.visualViewport?.addEventListener('resize',keyboard,{passive:true});
  window.visualViewport?.addEventListener('scroll',keyboard,{passive:true});
 }
 window.CoreAppFinish=Object.freeze({decorate,layoutOpening:opening});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
