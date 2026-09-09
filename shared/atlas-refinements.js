/* Shared interaction polish over the original dashboards. No record writes. */
(()=>{
  'use strict';
  const root=document.documentElement;
  const navigation={
    'life-ledger':'', 'workout-forge':'', 'the-aqueduct':'.tabbar [data-tab]',
    'the-hourglass':'.tabbar [data-tab]', 'communication-trainer':'#nav button',
    'the-herald':'#tabs button', 'prospecting-command-center':'#tabs button',
    'operations-cadence':'#rail .rail-btn', 'courier':'.block .tabs [data-pane]',
    'baby-brain':'', 'neural-map':'', 'chambers-wealth-hq':''
  };
  if(!Object.hasOwn(navigation,root.dataset.atlasApp)||window.AtlasRefinements)return;
  const controls='button,input,select,textarea,summary,a[href],[tabindex],[data-act],[onclick]';
  const helpState=new Map();
  let remembered=null,lastTrigger=null,modal=null,returnTo=null,inerted=[];
  const list=selector=>[...document.querySelectorAll(selector)];
  const available=el=>!!el?.isConnected&&!el.disabled&&!el.closest('[hidden],[inert]')&&el.getClientRects().length>0;
  const focus=el=>{if(available(el))el.focus?.({preventScroll:true});};
  function attributes(el){
    return [...el.attributes].filter(a=>a.name==='onclick'||a.name.startsWith('data-')&&!a.name.startsWith('data-atlas-'))
      .map(a=>[a.name,a.value]);
  }
  function identity(el){
    if(!el||el===document.body||el===root)return null;
    const scope=el.parentElement?.closest('[id],[data-id],[data-key]');
    return {element:el,id:el.id,tag:el.tagName,attrs:attributes(el),
      scope:scope?{id:scope.id,attrs:attributes(scope)}:null};
  }
  function find(saved){
    if(!saved)return null;
    if(saved.element.isConnected)return saved.element;
    if(saved.id){const el=document.getElementById(saved.id);return el?.tagName===saved.tag?el:null;}
    if(!saved.attrs.length)return null;
    const matches=list(controls).filter(el=>el.tagName===saved.tag&&saved.attrs.every(([k,v])=>el.getAttribute(k)===v)).filter(el=>{
      if(!saved.scope)return true;
      const scope=el.parentElement?.closest('[id],[data-id],[data-key]');
      return scope&&scope.id===saved.scope.id&&saved.scope.attrs.every(([k,v])=>scope.getAttribute(k)===v);
    });
    // Ambiguous controls must not send focus to a different record.
    return matches.length===1?matches[0]:null;
  }
  function helpKey(el){return el.id||el.querySelector('summary')?.getAttribute('aria-label');}
  function explanations(){
    const candidates=root.dataset.atlasApp==='the-herald'?list('#view .hint').filter(el=>/^(Every script lives|Two long-form anchors|Where to pull these|Benchmark diagnostics)/.test(el.textContent.trim())):
      root.dataset.atlasApp==='operations-cadence'?list('.operations-explainer'):[];
    for(const el of candidates){
      if(el.closest('details')||el.querySelector('button,input,select,textarea')||el.hasAttribute('role'))continue;
      const details=document.createElement('details'),summary=document.createElement('summary'),body=document.createElement('div');
      details.className='atlas-info';body.className='atlas-info-body';summary.textContent='i';
      const heading=el.previousElementSibling?.textContent?.trim()||'this section';
      summary.setAttribute('aria-label','About '+heading.slice(0,90));
      details.append(summary,body);el.before(details);body.append(el);
    }
  }
  function decorate(){
    explanations();
    const nav=navigation[root.dataset.atlasApp];
    if(nav)for(const el of list(nav)){
      const selected=el.classList.contains('active')||el.classList.contains('on');
      if(root.dataset.atlasApp==='courier')el.setAttribute('aria-pressed',String(selected));
      else if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    }
    for(const el of list('details.atlas-info')){
      const key=helpKey(el);if(key&&helpState.has(key)&&el.open!==helpState.get(key))el.open=helpState.get(key);
    }
    // Associate existing visible labels, without hiding names or validation.
    for(const el of list('input,select,textarea')){
      if(el.closest('label')||el.labels?.length||el.hasAttribute('aria-label')||el.hasAttribute('aria-labelledby'))continue;
      const label=el.previousElementSibling;
      if(label?.tagName==='LABEL'&&!label.htmlFor){
        if(!el.id)el.id='atlas-field-'+(++fieldId);
        label.htmlFor=el.id;
      }
    }
    for(const el of list('#toast,#toasts,.toast,#undoToast')){
      if(!el.hasAttribute('role'))el.setAttribute('role','status');
    }
  }
  let fieldId=0;
  function release(){for(const el of inerted)el.inert=false;inerted=[];}
  function reconcile(){
    decorate();
    const next=document.getElementById('uiDlg');
    if(next!==modal){
      const was=modal;release();modal=next;
      if(next){
        if(!was)returnTo=lastTrigger||remembered;
        next.setAttribute('role','dialog');next.setAttribute('aria-modal','true');next.tabIndex=-1;
        const title=next.querySelector('h1,h2,h3')||next.firstElementChild?.firstElementChild;
        if(title&&!next.hasAttribute('aria-labelledby')&&!next.hasAttribute('aria-label')){
          if(!title.id)title.id='atlas-dialog-heading';next.setAttribute('aria-labelledby',title.id);
        }
        // These legacy confirmation panels are direct children of body.
        if(next.parentElement===document.body)for(const el of document.body.children){
          if(el!==next&&!el.inert&&!['SCRIPT','STYLE','LINK','DIALOG'].includes(el.tagName)){el.inert=true;inerted.push(el);}
        }
        if(!next.contains(document.activeElement))focus(next);
      }else if(was){focus(find(returnTo));returnTo=null;}
    }
    if(!modal&&remembered&&!remembered.element.isConnected&&
      (!document.activeElement||document.activeElement===document.body))focus(find(remembered));
  }
  function keydown(e){
    if(!modal||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopImmediatePropagation();
      if(typeof window.uiClose==='function')window.uiClose();else modal.remove();
      reconcile();return;
    }
    if(e.key!=='Tab')return;
    const items=[...modal.querySelectorAll('button,input:not([type="hidden"]),select,textarea,summary,a[href],[tabindex]')]
      .filter(el=>available(el)&&el.tabIndex>=0);
    const active=document.activeElement,first=items[0],last=items.at(-1);
    if(!items.length){e.preventDefault();focus(modal);}
    else if(e.shiftKey&&(active===first||!items.includes(active))){e.preventDefault();focus(last);}
    else if(!e.shiftKey&&(active===last||!items.includes(active))){e.preventDefault();focus(first);}
  }
  function ready(){
    root.classList.add('atlas-refined');
    document.addEventListener('focusin',e=>{remembered=identity(e.target);});
    document.addEventListener('click',e=>{
      const trigger=e.target.closest?.(controls);lastTrigger=identity(trigger);
      if(trigger)remembered=lastTrigger;
      // iOS taps need not focus buttons; retain their place when a screen redraws.
      queueMicrotask(reconcile);
    },true);
    document.addEventListener('toggle',e=>{
      if(!e.target.matches?.('details.atlas-info'))return;
      const key=helpKey(e.target);if(key)helpState.set(key,e.target.open);
    },true);
    document.addEventListener('change',()=>queueMicrotask(reconcile),true);
    document.addEventListener('keydown',keydown,true);
    new MutationObserver(reconcile).observe(document.body,{childList:true,subtree:true});
    reconcile();
  }
  window.AtlasRefinements=Object.freeze({reconcile});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
