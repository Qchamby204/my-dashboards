/* Apple Design applied to the original board: immediate feedback, clear controls,
   stable focus and accessible editors. No records or navigation are replaced. */
(()=>{
  if(window.LifeMapInteractions)return;
  window.LifeMapInteractions=true;
  const originalRender=render;
  let editorOpen=false,opener=null,lastTrigger=null;
  const keys=['act','id','key','k','area','w'];
  const fieldNames={task:'Task',chore:'Chore',cad:'Repeat',area:'Area',sub:'Sub-area',pri:'Priority',status:'Status',due:'Due date',park:'Park until',notes:'Notes',zone:'Zone',who:'Assigned to'};
  function identity(el){
    if(!el?.closest?.('#app'))return null;
    return {id:el.id||'',tag:el.tagName,data:Object.fromEntries(keys.filter(k=>el.dataset?.[k]!==undefined).map(k=>[k,el.dataset[k]]))};
  }
  function find(saved){
    if(!saved)return null;
    if(saved.id){const el=document.getElementById(saved.id);if(el&&app.contains(el))return el;}
    if(!Object.keys(saved.data).length)return null;
    const el=[...app.querySelectorAll('[data-act]')].find(el=>el.tagName===saved.tag&&keys.every(k=>el.dataset[k]===saved.data[k]));
    return el?.tagName!=='BUTTON'&&el?.dataset.act==='edit'?(el.querySelector('button[data-act="edit"]')||el):el||null;
  }
  function focus(el){el?.focus?.({preventScroll:true});}
  function decorate(){
    for(const el of app.querySelectorAll('[data-act="advance"],[data-act="tick"],[data-act="plan"],[data-act="edit"],[data-act="editc"]')){
      const a=el.dataset.act,id=el.dataset.id;
      const item=(a==='tick'||a==='plan'||a==='editc'?S.chores:S.projects).find(x=>x.id===id);
      if(!item)continue;
      const title=item.task||item.chore;
      let label='Edit '+title;
      if(a==='advance')label=(item.status==='Done'?'Reopen ':item.status==='In progress'?'Complete ':'Start ')+title;
      if(a==='tick'){label=(isChecked(item)?'Mark incomplete: ':'Complete ')+title;el.setAttribute('aria-pressed',String(isChecked(item)));}
      if(a==='plan'){label=(plannedToday(item)?'Remove from Today: ':'Add to Today: ')+title;el.setAttribute('aria-pressed',String(plannedToday(item)));}
      el.setAttribute('aria-label',label);
      // Timeline rows have no nested controls; make those rows keyboard operable.
      if(el.tagName!=='BUTTON'&&!el.querySelector('button,input,select,textarea,a[href]')){el.setAttribute('role','button');el.tabIndex=0;el.dataset.lmKeyboard='true';}
    }
    for(const el of app.querySelectorAll('.row > div > div:first-child')){
      if(el.style.fontSize==='12.5px')el.classList.add('lm-task-title');
    }
    for(const el of app.querySelectorAll('[data-act="f"]')){
      const key=el.dataset.k;el.id='lm-field-'+key;el.setAttribute('aria-label',fieldNames[key]||key);
      if(el.previousElementSibling?.tagName==='LABEL')el.previousElementSibling.htmlFor=el.id;
    }
    const quick=document.getElementById('qaTxt');if(quick){quick.setAttribute('aria-label','Add a task');quick.maxLength=300;}
    for(const [act,label] of [['q','Search projects'],['fArea','Filter by area'],['fStatus','Filter by status'],['fPri','Filter by priority']]){
      app.querySelector('[data-act="'+act+'"]')?.setAttribute('aria-label',label);
    }
    const toastNode=document.getElementById('toast');if(toastNode){toastNode.setAttribute('role','status');toastNode.setAttribute('aria-live','polite');}
  }
  app.addEventListener('click',e=>{lastTrigger=identity(e.target.closest?.('[data-act]'));},true);
  render=function(){
    const active=identity(document.activeElement),opening=!!view.editor&&!editorOpen;
    if(opening)opener=active||lastTrigger;
    const help=[...app.querySelectorAll('details.atlas-info[open]')].map(el=>el.querySelector('summary')?.getAttribute('aria-label'));
    originalRender();decorate();
    for(const el of app.querySelectorAll('details.atlas-info'))if(help.includes(el.querySelector('summary')?.getAttribute('aria-label')))el.open=true;
    const dialog=app.querySelector('.overlay[role="dialog"]');
    if(dialog){
      dialog.tabIndex=-1;
      for(const child of app.children)if(child!==dialog)child.inert=true;
      if(opening)focus(dialog);else focus(find(active));
    }else if(editorOpen){focus(find(opener));opener=null;}else focus(find(active));
    editorOpen=!!view.editor;
  };
  document.addEventListener('keydown',e=>{
    if(e.target?.dataset?.lmKeyboard==='true'&&['Enter',' '].includes(e.key)){e.preventDefault();e.target.click();return;}
    const dialog=app.querySelector('.overlay[role="dialog"]');
    if(!dialog||document.getElementById('uiDlg'))return;
    if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();view.editor=null;window.AtlasConnected?.clearInputDraft?.();render();return;
    }
    if(e.key!=='Tab')return;
    const controls=[...dialog.querySelectorAll('button:not(:disabled),input:not([type="hidden"]),select,textarea,summary,a[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&!el.closest('[inert]'));
    if(!controls.length){e.preventDefault();focus(dialog);return;}
    const first=controls[0],last=controls[controls.length-1],active=document.activeElement;
    if(e.shiftKey&&(active===first||!controls.includes(active))){e.preventDefault();focus(last);}
    else if(!e.shiftKey&&(active===last||!controls.includes(active))){e.preventDefault();focus(first);}
  },true);
})();
