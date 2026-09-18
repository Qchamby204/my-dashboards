/* Input, focus and safe-area behavior shared by the public and private Life Map. */
(()=>{
  if(window.LifeMapInteractions)return;window.LifeMapInteractions=true;
  const originalRender=render;let editorOpen=false,opener=null,lastTrigger=null;
  const keys=['act','lm','id','key','k','field','area','w','index','group'];
  function identity(el){if(!el?.closest?.('#app'))return null;return {id:el.id||'',tag:el.tagName,data:Object.fromEntries(keys.filter(k=>el.dataset?.[k]!==undefined).map(k=>[k,el.dataset[k]])),start:el.selectionStart,end:el.selectionEnd};}
  function find(saved){if(!saved)return null;if(saved.id){const el=document.getElementById(saved.id);if(el&&app.contains(el))return el;}if(!Object.keys(saved.data).length)return null;return [...app.querySelectorAll('[data-act],[data-lm]')].find(el=>el.tagName===saved.tag&&keys.every(k=>el.dataset[k]===saved.data[k]))||null;}
  function focus(el,saved){el?.focus?.({preventScroll:true});if(el&&saved&&typeof saved.start==='number')try{el.setSelectionRange(saved.start,saved.end);}catch{}}
  function decorate(){
    for(const el of app.querySelectorAll('[data-act="advance"],[data-act="tick"],[data-act="plan"],[data-act="edit"],[data-act="editc"]')){
      const a=el.dataset.act,id=el.dataset.id,item=(['tick','plan','editc'].includes(a)?S.chores:S.projects).find(x=>x.id===id);if(!item)continue;const title=item.task||item.chore;let label='Edit '+title;
      if(a==='advance')label=(item.status==='Done'?'Reopen ':'Complete ')+title;
      if(a==='tick'){label=(isChecked(item)?'Mark incomplete: ':'Complete ')+title;el.setAttribute('aria-pressed',String(isChecked(item)));}
      if(a==='plan'){label=(plannedToday(item)?'Remove from Today: ':'Add to Today: ')+title;el.setAttribute('aria-pressed',String(plannedToday(item)));}
      el.setAttribute('aria-label',label);if(el.tagName!=='BUTTON'&&!el.querySelector('button,input,select,textarea,a[href]')){el.setAttribute('role','button');el.tabIndex=0;el.dataset.lmKeyboard='true';}
    }
    for(const el of app.querySelectorAll('[data-act="f"],[data-lm="field"]')){const key=el.dataset.k||el.dataset.field;el.id='lm-field-'+key;if(!el.closest('label'))el.setAttribute('aria-label',key);}
    for(const [a,label]of [['q','Search tasks'],['fArea','Filter by area'],['fStatus','Task view'],['fPri','Priority']])app.querySelector('[data-act="'+a+'"]')?.setAttribute('aria-label',label);
    const t=document.getElementById('toast');if(t){t.setAttribute('role','status');t.setAttribute('aria-live','polite');}
  }
  // Document capture runs before the board's action dispatcher stops propagation.
  document.addEventListener('pointerdown',e=>{lastTrigger=identity(e.target.closest?.('[data-act],[data-lm]'));},true);
  app.addEventListener('click',e=>{lastTrigger=identity(e.target.closest?.('[data-act],[data-lm]'));},true);
  render=function(){
    const active=identity(document.activeElement),opening=!!view.editor&&!editorOpen;
    if(opening)opener=active||lastTrigger;
    const oldDialog=app.querySelector('.overlay[role="dialog"]'),scroll=oldDialog?.querySelector('.lm-sheet-body')?.scrollTop||0;
    const help=[...app.querySelectorAll('details[open]')].map(el=>el.className+'|'+(el.querySelector('summary')?.getAttribute('aria-label')||el.querySelector('summary')?.textContent||''));
    originalRender();decorate();
    for(const el of app.querySelectorAll('details')){const key=el.className+'|'+(el.querySelector('summary')?.getAttribute('aria-label')||el.querySelector('summary')?.textContent||'');if(help.includes(key))el.open=true;}
    const dialog=app.querySelector('.overlay[role="dialog"]');
    if(dialog){dialog.tabIndex=-1;
      if(dialog.tagName!=='DIALOG')for(const child of app.children)if(child!==dialog)child.inert=true;
      if(opening)focus(dialog.querySelector('#lm-capture-text,#lm-search,[data-field="task"],[data-field="title"],[data-field="chore"]')||dialog);
      else {const field=find(active);if(field)focus(field,active);const body=dialog.querySelector('.lm-sheet-body');if(body)body.scrollTop=scroll;}
    }else if(editorOpen){focus(find(opener));opener=null;}else focus(find(active),active);
    editorOpen=!!view.editor;
  };
  document.addEventListener('keydown',e=>{
    if(e.target?.dataset?.lmKeyboard==='true'&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();return;}
    const dialog=app.querySelector('.overlay[role="dialog"]');if(!dialog||document.getElementById('uiDlg'))return;
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();if(window.LifeMapWorkflow)window.LifeMapWorkflow.closeEditor();else{view.editor=null;window.AtlasConnected?.clearInputDraft?.();render();}return;}
    if(e.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not([type="hidden"]):not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
    if(!controls.length){e.preventDefault();focus(dialog);return;}
    const first=controls[0],last=controls.at(-1),active=document.activeElement;
    if(e.shiftKey&&(active===first||!controls.includes(active))){e.preventDefault();focus(last);}else if(!e.shiftKey&&(active===last||!controls.includes(active))){e.preventDefault();focus(first);}
  },true);
  function viewport(){if(!document.documentElement?.style)return;const v=window.visualViewport;document.documentElement.style.setProperty('--lm-viewport-height',(v?.height||window.innerHeight||800)+'px');document.documentElement.style.setProperty('--lm-viewport-top',(v?.offsetTop||0)+'px');}
  window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);window.addEventListener('resize',viewport);viewport();
})();
