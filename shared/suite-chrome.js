/* Header presentation only. Preserve original controls, listeners and record ownership. */
(()=>{
 'use strict';
 const root=document.documentElement,app=root.dataset.atlasApp;
 const svg=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="'+path+'"/></svg>';
 const homeIcon=svg('M3 10 12 3l9 7v10H3z M9 20v-7h6v7');
 const appearanceIcon=svg('M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18');
 function refresh(){
  const canvas=['baby-brain','neural-map'].includes(app);
  if(app==='courier'&&!document.querySelector('.courier-suite-header')){
   const header=document.querySelector('body>header'),title=header?.querySelector('h1'),playback=header?.querySelector('.bar'),home=playback?.querySelector('a[href="index.html"]');
   if(header&&title&&playback&&home){
    const bar=document.createElement('div'),identity=document.createElement('div'),stamp=title.querySelector('#stamp');
    bar.className='appbar courier-suite-header';identity.className='atlas-header-identity';title.classList.add('appbar-title');
    if(stamp){stamp.classList.add('courier-edition-stamp');playback.prepend(stamp);}
    home.className='homebtn';home.setAttribute('aria-label','Atlas');identity.append(title);bar.append(home,identity);header.prepend(bar);
    playback.classList.add('courier-playback-tools');playback.setAttribute('role','group');playback.setAttribute('aria-label','Playback controls');playback.querySelector('#day')?.setAttribute('aria-label','Edition');
   }
  }
  const bar=document.querySelector('.appbar,body>header>.bar')||(canvas?document.querySelector('header.hud'):null);if(!bar)return;
  if(canvas&&!bar.dataset.suiteCanvas){
   const originals=[...bar.children],title=bar.querySelector('h1'),identity=document.createElement('div'),home=document.createElement('a');
   identity.className='atlas-header-identity';if(title){title.classList.add('appbar-title');identity.append(title);}
   home.className='homebtn';home.href='index.html';home.setAttribute('aria-label','Atlas');bar.replaceChildren(home,identity);bar._suiteCanvasControls=originals;bar.dataset.suiteCanvas='true';bar.classList.add('atlas-map-header');
  }
  if(app==='the-chef'){const title=document.querySelector('body>header>h1');if(title){title.classList.add('appbar-title');const identity=document.createElement('div');identity.className='atlas-header-identity';identity.append(title);bar.querySelector('.cc-home')?.after(identity);}}
  if(!bar.classList.contains('atlas-suite-header'))bar.classList.add('atlas-suite-header');
  const home=bar.querySelector('.homebtn,.cc-home'),appearance=bar.querySelector('.atlas-appearance-trigger')||((canvas||app==='courier')?document.querySelector('.atlas-appearance-trigger'):null);
  if(home&&!home.dataset.suiteHome){home.innerHTML=homeIcon;home.dataset.suiteHome='true';}
  if(appearance&&!appearance.dataset.suiteAppearance){appearance.innerHTML=appearanceIcon;appearance.dataset.suiteAppearance='true';}
  if(!['operations-cadence','the-hourglass','the-chef','the-herald','courier'].includes(app)&&!canvas)return;
  const title=bar.querySelector('.appbar-title'),identity=title?.parentElement;if(!home||!identity)return;
  const oldHome=home.parentElement;
  if(home.parentElement!==bar)bar.prepend(home);
  if(identity.parentElement!==bar)home.after(identity);
  if(oldHome!==bar&&oldHome!==identity&&!oldHome.children.length)oldHome.remove();
  if(!identity.classList.contains('atlas-header-identity'))identity.classList.add('atlas-header-identity');
  let actions=bar.querySelector('.atlas-header-actions');
  if(!actions){actions=document.createElement('div');actions.className='atlas-header-actions';bar.append(actions);}
  if(appearance&&appearance.parentElement!==actions){appearance.classList.remove('atlas-appearance-map','atlas-appearance-floating');actions.prepend(appearance);}
  if(app==='the-chef'){
   const help=bar.parentElement.querySelector(':scope>.cc-help');
   if(help){help.classList.add('atlas-header-help');actions.append(help);help.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();help.open=false;help.querySelector('summary')?.focus({preventScroll:true});}});}
  }
  let tools=actions.querySelector('.atlas-header-tools');
  if(!tools&&!['the-chef','courier'].includes(app)){
   tools=document.createElement('details');tools.className='atlas-header-tools';
   const summary=document.createElement('summary');summary.setAttribute('aria-label','App tools');summary.innerHTML=svg('M5 12h.01M12 12h.01M19 12h.01');
   const body=document.createElement('div');body.className='atlas-header-tools-body';tools.append(summary,body);actions.append(tools);
   tools.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();tools.open=false;summary.focus({preventScroll:true});}});
  }
  const body=tools?.querySelector('.atlas-header-tools-body');
  if(canvas&&body&&bar._suiteCanvasControls){for(const node of bar._suiteCanvasControls){node.querySelector('.eyebrow')?.setAttribute('hidden','');body.append(node);}bar._suiteCanvasControls=null;if(app==='neural-map'){const help=document.createElement('p');help.textContent='Zoom controls are available in Map. List & search finds any resource.';body.append(help);}}
  for(const node of bar.querySelectorAll('.appbar-pill,.operations-backup-tools'))if(body&&node.parentElement!==body)body.append(node);
  if(app==='the-herald'&&body){
   for(const control of bar.querySelectorAll('.iconbtn,input[type="file"]')){
    if(control.parentElement===body)continue;
    if(control.tagName==='BUTTON'){control.textContent=control.getAttribute('aria-label');control.classList.remove('iconbtn');}
    const old=control.parentElement;body.append(control);if(old!==bar&&old!==body&&!old.children.length)old.remove();
   }
  }
  if(!bar.classList.contains('atlas-header-compact'))bar.classList.add('atlas-header-compact');
 }
 window.AtlasSuiteChrome=Object.freeze({refresh});
 document.addEventListener('click',event=>{const tools=document.querySelector('.atlas-header-tools[open],.atlas-header-help[open]');if(tools&&!tools.contains(event.target))tools.open=false;});
 document.addEventListener('DOMContentLoaded',refresh,{once:true});
 if(document.readyState!=='loading')refresh();
})();
