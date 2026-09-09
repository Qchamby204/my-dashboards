/* Presentation only: never reads or writes dashboard records. */
(() => {
  'use strict';
  const root=document.documentElement;
  if(!['crucible','the-chef'].includes(root.dataset.atlasApp))return;
  function insets(){
    const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
    const phone=/iPhone/.test(navigator.userAgent)&&standalone;
    const orientation=screen.orientation?.type;
    const portrait=orientation?orientation.startsWith('portrait'):typeof window.orientation==='number'?Math.abs(window.orientation)!==90:screen.height>=screen.width;
    root.style.setProperty('--cc-top',phone&&portrait?'max(64px,env(safe-area-inset-top))':'env(safe-area-inset-top,0px)');
    root.style.setProperty('--cc-side',phone&&!portrait?'64px':'0px');
    root.style.setProperty('--cc-bottom',phone?'max(21px,env(safe-area-inset-bottom))':'env(safe-area-inset-bottom,0px)');
  }
  function refresh(){
    for(const p of document.querySelectorAll('.panel>.lede,header>.mission,header>p.cc-explanation')){
      const help=document.createElement('details');help.className='cc-help';
      const summary=document.createElement('summary');
      const title=p.parentElement.querySelector('h1,h2,h3')?.textContent?.trim()||'this section';
      summary.setAttribute('aria-label','About '+title);summary.innerHTML='<span aria-hidden="true">i</span>';
      p.before(help);help.append(summary,p);
    }
    for(const button of document.querySelectorAll('button[data-pick],button[data-mood],button[data-meal],button[data-fav]'))button.setAttribute('aria-pressed',String(button.classList.contains('on')));
    if(root.dataset.atlasApp==='the-chef')for(const button of document.querySelectorAll('nav.tabs button'))button.setAttribute('aria-pressed',String(button.classList.contains('on')));
    for(const table of document.querySelectorAll('.tablewrap')){table.tabIndex=0;table.setAttribute('role','region');table.setAttribute('aria-label','Scrollable reference table');}
    const ledger=document.getElementById('ledger');if(ledger)ledger.setAttribute('aria-label','Today’s learning notes');
  }
  function announce(message){const status=document.getElementById('cc-status');if(status)status.textContent=message;}
  window.AtlasCraftUI=Object.freeze({refresh,announce});
  insets();
  window.addEventListener('resize',insets,{passive:true});
  window.addEventListener('orientationchange',insets,{passive:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh);else refresh();
})();
