/* Suite page navigation. Delegates to existing controls; never accesses records. */
(()=>{
  'use strict';
  const root=document.documentElement,app=root.dataset.atlasApp;
  const configs={
    'life-ledger':{native:'.ledger-nav',shell:'.ledger-dock'},
    'life-map':{native:'.lm-day-dock'},
    'communication-trainer':{source:'#nav',buttons:'button'},
    'the-aqueduct':{source:'.tabbar',buttons:'button[data-tab]'},
    'the-hourglass':{source:'.tabbar',buttons:'button[data-tab]'},
    'the-herald':{source:'#tabs',buttons:'button'},
    'prospecting-command-center':{source:'#tabs',buttons:'button'},
    'operations-cadence':{source:'#rail',buttons:'.rail-btn'},
    'the-chef':{source:'nav.tabs',buttons:'button[data-tab]'},
    'crucible':{source:'#tabs',buttons:'button[data-tab]'},
    'library':{source:'#mobile-nav',buttons:'a[href]'},
    'baby-brain':{source:'.baby-toolbar',buttons:'button'},
    'neural-map':{source:'.neural-toolbar',buttons:'button'},
    'workout-forge':{routes:[['home','Forge','#'],['bench','Bench','#goal-bench'],['deadlift','Deadlift','#goal-deadlift'],['dunk','Jump','#goal-dunk'],['run','Run','#goal-run']]}
  };
  const config=configs[app];if(!config||window.AtlasPageNavigation)return;
  const icons={home:'M3 10 12 3l9 7v10H3z M9 20v-7h6v7',today:'M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',plan:'M4 5h16v16H4z M7 3v4m10-4v4M4 10h16m-12 4h3m2 0h3m-8 3h3',progress:'M4 20V10m8 10V4m8 16V7',history:'M4 5v5h5 M4 10a8 8 0 1 1 0 5 M12 7v5l3 2',book:'M3 4h7l2 2 2-2h7v16h-7l-2 1-2-1H3z M12 6v15',grid:'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',heart:'M12 20 4 12C-1 5 8 0 12 7c4-7 13-2 8 5z',search:'M16 16l5 5 M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',map:'M3 5l6-2 6 2 6-2v16l-6 2-6-2-6 2z M9 3v16m6-14v16',target:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0 M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0 M12 10v4m-2-2h4',list:'M8 5h13M8 12h13M8 19h13 M3 5h1m-1 7h1m-1 7h1',more:'M5 12h.01M12 12h.01M19 12h.01'};
  function icon(label){
    const key=/more/i.test(label)?'more':/home|forge/i.test(label)?'home':/today/i.test(label)?'today':/calendar|plan|cadence/i.test(label)?'plan':/progress|growth|score|insight|metric/i.test(label)?'progress':/history|archive|review|reckon/i.test(label)?'history':/book|script|vault|curriculum/i.test(label)?'book':/favourite/i.test(label)?'heart':/search|list|database/i.test(label)?'search':/map/i.test(label)?'map':/goal|bench|deadlift|jump|run|train|climb/i.test(label)?'target':/area|board|topic|ingredient|block/i.test(label)?'grid':'list';
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+icons[key]+'"/></svg>';
  }
  const make=(tag,cls)=>{const n=document.createElement(tag);if(cls)n.className=cls;return n;};
  let dock=null,menu=null,entries=[],signature='',queued=false,lastKey=null,resizeObserver;
  function selected(n){return n.getAttribute('aria-selected')==='true'||n.getAttribute('aria-pressed')==='true'||n.getAttribute('aria-current')==='page'||n.classList.contains('on')||n.classList.contains('active');}
  function label(n){return (n.querySelector('.tlbl,.tl,.rail-label')?.textContent||n.getAttribute('aria-label')||n.textContent).trim().replace(/\s+/g,' ');}
  function readEntries(){
    if(config.routes)return config.routes.map(([key,title,href])=>({key,title,href,selected:key==='home'?!location.hash||!location.hash.startsWith('#goal-'):location.hash==='#goal-'+key}));
    const source=document.querySelector(config.source);if(!source)return [];
    if(!source.classList.contains('atlas-page-source'))source.classList.add('atlas-page-source');
    if(app==='library'){const desktop=document.querySelector('#desktop-nav');if(desktop&&!desktop.classList.contains('atlas-page-source'))desktop.classList.add('atlas-page-source');}
    return [...source.querySelectorAll(config.buttons)].map((n,i)=>({key:n.dataset.tab||n.dataset.id||n.getAttribute('href')||n.getAttribute('onclick')||String(i),title:label(n),selected:selected(n),original:n,disabled:n.disabled}));
  }
  function activate(key){
    const entry=readEntries().find(e=>e.key===key);if(!entry||entry.disabled)return;
    lastKey=key;if(menu?.open)menu.close();
    if(entry.href){location.hash=entry.href.slice(1);}else entry.original.click();
    queueMicrotask(reconcile);
  }
  function item(entry){
    const n=make('button','atlas-page-item');n.type='button';n.dataset.pageKey=entry.key;n.disabled=!!entry.disabled;
    n.innerHTML=icon(entry.title);const text=make('span');text.textContent=entry.title;n.append(text);
    n.setAttribute('aria-label',entry.title);if(entry.selected)n.setAttribute('aria-current','page');
    n.addEventListener('click',()=>activate(entry.key));return n;
  }
  function setup(){
    dock=make('nav','atlas-page-dock');dock.id='atlas-page-navigation';dock.setAttribute('aria-label','Dashboard pages');document.body.append(dock);
    menu=make('dialog','atlas-page-menu');menu.id='atlas-page-menu';menu.setAttribute('aria-labelledby','atlas-page-menu-title');
    const head=make('div','atlas-page-menu-head'),title=make('h2');title.id='atlas-page-menu-title';title.textContent='All pages';const close=make('button');close.type='button';close.textContent='Close';close.addEventListener('click',()=>menu.close());head.append(title,close);
    const links=make('nav','atlas-page-menu-items');links.setAttribute('aria-label','All dashboard pages');menu.append(head,links);document.body.append(menu);
    menu.addEventListener('close',()=>{dock.querySelector('[data-more]')?.setAttribute('aria-expanded','false');dock.querySelector('[data-more]')?.focus({preventScroll:true});});
    menu.addEventListener('click',e=>{if(e.target===menu){const b=menu.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)menu.close();}});
    dock.addEventListener('keydown',e=>{
      const buttons=[...dock.querySelectorAll('button:not(:disabled)')],i=buttons.indexOf(e.target);if(i<0)return;
      const next=e.key==='ArrowRight'?(i+1)%buttons.length:e.key==='ArrowLeft'?(i+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:-1;
      if(next<0)return;e.preventDefault();buttons[next].focus({preventScroll:true});
    });
    if(window.ResizeObserver){resizeObserver=new ResizeObserver(measure);resizeObserver.observe(dock);}
  }
  function measure(){
    const shell=config.native?document.querySelector(config.shell||config.native):dock;if(!shell)return;
    const h=Math.ceil(shell.getBoundingClientRect().height),value=h+'px';
    for(const name of ['--atlas-page-nav-height','--atlas-bottom-h'])if(root.style.getPropertyValue(name)!==value)root.style.setProperty(name,value);
  }
  function reconcile(){
    queued=false;
    if(config.native){
      const nav=document.querySelector(config.native);if(!nav)return;
      if(!root.classList.contains('atlas-page-navigation'))root.classList.add('atlas-page-navigation');if(!nav.classList.contains('atlas-page-native'))nav.classList.add('atlas-page-native');
      if(config.shell){const shell=document.querySelector(config.shell);if(shell&&!shell.classList.contains('atlas-page-shell'))shell.classList.add('atlas-page-shell');}
      measure();return;
    }
    entries=readEntries();if(entries.length<2)return;
    if(!root.classList.contains('atlas-page-navigation'))root.classList.add('atlas-page-navigation');if(!dock)setup();
    const next=JSON.stringify(entries.map(e=>[e.key,e.title,e.selected,!!e.disabled]));
    if(next!==signature){
      const focused=dock.contains(document.activeElement)?document.activeElement.dataset.pageKey||'more':null;
      signature=next;const shown=entries.length>5?entries.slice(0,4):entries;dock.replaceChildren(...shown.map(item));dock.style.setProperty('--atlas-page-count',String(shown.length+(entries.length>5?1:0)));
      menu.querySelector('.atlas-page-menu-items').replaceChildren(...entries.map(item));
      if(entries.length>5){
        const more=make('button','atlas-page-item');more.type='button';more.dataset.more='true';more.innerHTML=icon('More');const text=make('span');text.textContent='More';more.append(text);more.setAttribute('aria-haspopup','dialog');more.setAttribute('aria-controls',menu.id);more.setAttribute('aria-expanded',String(menu.open));
        if(entries.slice(4).some(e=>e.selected))more.setAttribute('aria-current','page');
        more.addEventListener('click',()=>{more.setAttribute('aria-expanded','true');menu.showModal();});dock.append(more);
      }
      const key=lastKey||focused;lastKey=null;
      if(key){const target=[...dock.querySelectorAll('[data-page-key]')].find(n=>n.dataset.pageKey===key)||dock.querySelector('[data-more]');target?.focus({preventScroll:true});}
    }
    measure();
  }
  function schedule(){if(!queued){queued=true;queueMicrotask(reconcile);}}
  function ready(){
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-selected','aria-pressed','aria-current','disabled']});
    document.addEventListener('click',schedule);window.addEventListener('hashchange',schedule);window.addEventListener('resize',measure,{passive:true});
    window.visualViewport?.addEventListener('resize',()=>{root.classList.toggle('atlas-page-keyboard',window.innerHeight-window.visualViewport.height>150&&/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName));});
    reconcile();
  }
  window.AtlasPageNavigation=Object.freeze({reconcile,handles:id=>Object.hasOwn(configs,id)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
