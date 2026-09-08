/* Shared mobile behavior for the existing dashboards. No records or navigation change. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const apps=new Set(['atlas-hub','atlas-os','atlas-connect','life-map','life-ledger','workout-forge','the-aqueduct','the-hourglass','baby-brain','communication-trainer','prospecting-command-center','operations-cadence','the-herald','courier','neural-map','chambers-wealth-hq']);
  if(!apps.has(root.dataset.atlasApp)||window.AtlasMobile)return;
  const source=document.currentScript.src;
  let viewport=document.querySelector('meta[name="viewport"]');
  if(!viewport){viewport=document.createElement('meta');viewport.name='viewport';document.head.appendChild(viewport);}
  viewport.content='width=device-width, initial-scale=1, viewport-fit=cover';
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('atlas-mobile.css',source).href;document.head.appendChild(css);
  let queued=false,observer;const observed=new WeakSet();
  const height=el=>el?Math.ceil(el.getBoundingClientRect().height):0;
  const set=(name,value)=>{if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);};
  function measure(){
    queued=false;
    const chrome=document.querySelector('.appbar'),connection=document.querySelector('.connected-toolbar');
    const bottom=document.querySelector(root.dataset.atlasApp==='courier'?'#player':'.tabbar');
    for(const el of [chrome,connection,bottom])if(el&&observer&&!observed.has(el)){observed.add(el);observer.observe(el);}
    set('--atlas-connection-h',height(connection)+'px');
    set('--atlas-top-h',height(connection)+height(chrome)+'px');
    set('--atlas-bottom-h',height(bottom)+'px');
    const visual=window.visualViewport;
    set('--atlas-visible-height',visual&&visual.scale===1?Math.round(visual.height)+'px':'100dvh');
    set('--atlas-visible-top',visual&&visual.scale===1?Math.round(visual.offsetTop)+'px':'0px');
    const bottomOffset=visual&&visual.scale===1?window.innerHeight-visual.height-visual.offsetTop:0;
    set('--atlas-bottom-offset',(Number.isFinite(bottomOffset)?Math.max(0,Math.round(bottomOffset)):0)+'px');
  }
  function schedule(){if(!queued){queued=true;requestAnimationFrame(measure);}}
  function controls(){
    for(const el of document.querySelectorAll('div[onclick],span[onclick],td[onclick]')){
      if(el.querySelector('button,a[href],input,select,textarea,[contenteditable="true"]'))continue;
      if(el.classList.contains('tickbox')){el.setAttribute('role','checkbox');el.setAttribute('aria-checked',String(el.classList.contains('done')));}
      else if(!el.hasAttribute('role'))el.setAttribute('role','button');
      if(!el.hasAttribute('tabindex'))el.tabIndex=0;
      el.dataset.atlasKeyboard='true';
    }
    for(const table of document.querySelectorAll('table')){
      const parent=table.parentElement;if(!parent||parent.classList.contains('atlas-mobile-table')||['auto','scroll'].includes(getComputedStyle(parent).overflowX))continue;
      const wrap=document.createElement('div');wrap.className='atlas-mobile-table';wrap.tabIndex=0;wrap.setAttribute('role','region');wrap.setAttribute('aria-label',table.caption?.textContent||'Scrollable table');
      parent.insertBefore(wrap,table);wrap.appendChild(table);
    }
    schedule();
  }
  function ready(){
    document.head.appendChild(css);
    root.classList.add('atlas-mobile');
    if(window.ResizeObserver)observer=new ResizeObserver(schedule);
    controls();measure();
    new MutationObserver(controls).observe(document.body,{childList:true,subtree:true});
    window.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('resize',schedule,{passive:true});
    window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
    document.addEventListener('change',schedule);
    document.addEventListener('click',e=>{if(e.target.closest('[data-atlas-keyboard]'))controls();});
    document.addEventListener('keydown',e=>{
      if(e.repeat||!['Enter',' '].includes(e.key)||e.target.matches('input,select,textarea,button,a,[contenteditable="true"]'))return;
      const el=e.target.closest('[data-atlas-keyboard]');if(!el||el.getAttribute('aria-disabled')==='true')return;
      e.preventDefault();el.click();controls();
    });
  }
  window.AtlasMobile=Object.freeze({measure});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
