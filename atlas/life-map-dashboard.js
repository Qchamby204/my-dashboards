/* Life Map owns projects and recurring household work. Atlas is only its link hub. */
(function(){
  var tab='projects',choreFilter='due',importRequest=0;
  var originalSave=saveEditor,originalConfirm=uiConfirm;
  function button(action,id,label,extra){return '<button type="button" data-lm="'+action+'" data-id="'+esc(id)+'" '+(extra||'')+'>'+label+'</button>';}
  function info(label,text){return '<details class="atlas-info"><summary aria-label="'+esc(label)+'"><span aria-hidden="true">i</span></summary><div class="atlas-info-body">'+esc(text)+'</div></details>';}
  function selected(value,actual){return value===actual?' selected':'';}
  function options(values,current){return values.map(function(v){return '<option value="'+esc(v)+'"'+selected(v,current)+'>'+esc(v)+'</option>';}).join('');}
  function filtered(){
    var q=view.q.toLowerCase();
    return S.projects.filter(function(p){return (!view.fArea||p.area===view.fArea)&&(!view.fPri||p.pri===view.fPri)&&(!q||[p.task,p.sub,p.area,p.notes].join(' ').toLowerCase().includes(q))&&(view.fStatus==='_open'?p.status!=='Done'&&!isParked(p):view.fStatus==='_parked'?isParked(p):!view.fStatus||p.status===view.fStatus);}).sort(function(a,b){return (a.due||'9999').localeCompare(b.due||'9999')||({High:0,Med:1,Low:2}[a.pri]||0)-({High:0,Med:1,Low:2}[b.pri]||0)||a.task.localeCompare(b.task);});
  }
  function projectPanel(){
    var list=filtered();
    return '<div class="lm-capture"><label for="qaTxt">Add a project</label><div><input id="qaTxt" data-act="qatxt" maxlength="300" placeholder="What needs doing?" value="'+esc(view.qa.txt)+'"><button type="button" data-act="qaAdd" class="lm-primary">Add</button></div></div>'+
      '<div class="lm-filters" data-ui-only><label>Search<input data-act="q" value="'+esc(view.q)+'" placeholder="Title or notes"></label><label>Area<select data-act="fArea"><option value="">All areas</option>'+options([...new Set(AREAS.map(function(a){return a.name;}).concat(S.projects.map(function(p){return p.area;})))],view.fArea)+'</select></label><label>Show<select data-act="fStatus"><option value="_open"'+selected('_open',view.fStatus)+'>Open</option><option value="_parked"'+selected('_parked',view.fStatus)+'>Parked</option><option value="Done"'+selected('Done',view.fStatus)+'>Completed</option><option value=""'+selected('',view.fStatus)+'>Everything</option></select></label><label>Priority<select data-act="fPri"><option value="">Any priority</option>'+options(PRIS,view.fPri)+'</select></label></div>'+
      '<div class="lm-list-heading"><span>'+list.length+' project'+(list.length===1?'':'s')+'</span><button type="button" data-act="add" data-kind="proj">Add with details</button></div>'+
      (list.length?list.map(function(p){var done=p.status==='Done';return '<article class="lm-row'+(done?' lm-done':'')+'">'+button('complete',p.id,done?'✓':'','class="lm-check" aria-label="'+(done?'Reopen ':'Complete ')+esc(p.task)+'"')+'<div class="lm-row-body"><button class="lm-title" type="button" data-act="edit" data-id="'+esc(p.id)+'">'+esc(p.task)+'</button><p>'+esc(p.area)+' · '+esc(p.status)+(p.due?' · <span class="'+(isOverdue(p)?'lm-overdue':'')+'">'+(isOverdue(p)?'Overdue ':'' )+fmtDay(p.due)+'</span>':'')+(p.park&&!done?' · Parked until '+fmtMonth(p.park):'')+'</p>'+(p.notes?'<p class="lm-note">'+esc(p.notes)+'</p>':'')+'</div>'+(!done?button('start',p.id,p.status==='In progress'?'Pause':'Start','class="lm-secondary"'):'')+'</article>';}).join(''):'<p class="lm-empty">'+(S.projects.length?'No projects match these filters.':'Add your first project above.')+'</p>');
  }
  function chorePanel(){
    var rows=S.chores.filter(function(c){return choreFilter==='all'||!isChecked(c);});
    return '<div class="lm-list-heading"><label data-ui-only>Show<select data-lm="chore-filter"><option value="due"'+selected('due',choreFilter)+'>Still to do</option><option value="all"'+selected('all',choreFilter)+'>All chores</option></select></label><button type="button" data-act="add" data-kind="chore" class="lm-primary">Add chore</button></div>'+info('How repeating chores work','Each chore becomes due again at the start of its next daily, weekly, monthly, quarterly, or annual cycle.')+''+(rows.length?CADS.map(function(cad){var list=rows.filter(function(c){return c.cad===cad;});return list.length?'<section class="lm-chore-group"><h2>'+cad+'</h2>'+list.map(function(c){return '<article class="lm-row">'+button('chore',c.id,isChecked(c)?'✓':'','class="lm-check" aria-label="'+(isChecked(c)?'Uncheck ':'Complete ')+esc(c.chore)+'"')+'<div class="lm-row-body"><button class="lm-title" type="button" data-act="editc" data-id="'+esc(c.id)+'">'+esc(c.chore)+'</button><p>'+esc([c.zone,c.who].filter(Boolean).join(' · '))+'</p>'+(c.notes?'<p class="lm-note">'+esc(c.notes)+'</p>':'')+'</div></article>';}).join('')+'</section>':'';}).join(''):'<p class="lm-empty">'+(S.chores.length?'You’re caught up for this cycle.':'Add a chore and choose how often it repeats.')+'</p>');
  }
  editorView=function(){
    var e=view.editor;if(!e)return '';var chore=e.kind==='chore';
    function input(key,label,type,max){return '<label>'+label+'<input data-act="f" data-k="'+key+'" type="'+(type||'text')+'" '+(max?'maxlength="'+max+'"':'')+' value="'+esc(e[key]||'')+'"></label>';}
    function select(key,label,values){return '<label>'+label+'<select data-act="f" data-k="'+key+'">'+options(values,e[key]||values[0])+'</select></label>';}
    return '<dialog id="lm-editor" aria-labelledby="lm-editor-title"><form id="lm-editor-form"><div class="lm-editor-heading"><h2 id="lm-editor-title">'+(e.id?'Edit ':'New ')+(chore?'chore':'project')+'</h2><button type="button" data-act="closeEditor">Cancel</button></div>'+input(chore?'chore':'task',chore?'Chore':'Project','text',300)+(chore?select('cad','Repeat',CADS)+input('zone','Location')+input('who','Assigned to'):select('area','Area',[...new Set(AREAS.map(function(a){return a.name;}).concat(e.area||[]))])+input('sub','Category')+'<div class="lm-editor-grid">'+select('pri','Priority',PRIS)+select('status','Status',STATUSES)+'</div><div class="lm-editor-grid">'+input('due','Due date','date')+input('park','Park until','month')+'</div>')+'<label>Notes<textarea data-act="f" data-k="notes" rows="5">'+esc(e.notes||'')+'</textarea></label><p id="lm-editor-error" role="alert"></p><div class="lm-editor-actions">'+(e.id?'<button type="button" data-act="delEditor" class="lm-delete">Delete</button>':'')+'<button type="submit" class="lm-primary">Save</button></div></form></dialog>';
  };
  render=function(){
    app.innerHTML='<div class="lm-dashboard"><header class="appbar lm-header"><div class="lm-brand"><a class="homebtn" href="'+(window.AtlasConnected?'/':'index.html')+'" aria-label="Back to Atlas">◈</a><div><h1 class="appbar-title">Life Map</h1><span class="appbar-sub">Every area, one board</span></div></div><details id="lm-backups" class="lm-backups"><summary>Backups</summary><button type="button" data-act="export">Download backup</button><button type="button" data-act="import">Restore backup</button><input type="file" id="importFile" accept="application/json,.json" hidden></details></header><section class="lm-overview panel" aria-label="Board overview"><div class="lm-kicker">Your board</div><div class="lm-overview-values"><div><strong>'+S.projects.filter(p=>p.status!=='Done').length+'</strong><span>Open projects</span></div><div><strong>'+S.projects.filter(p=>isOverdue(p)&&p.status!=='Done').length+'</strong><span>Overdue</span></div><div><strong>'+S.chores.filter(c=>!isChecked(c)).length+'</strong><span>Chores to do</span></div></div></section><nav class="lm-tabs" aria-label="Life Map">'+[['projects','Projects'],['chores','Chores'],['timeline','Timeline']].map(function(x){return '<button type="button" data-lm="tab" data-tab="'+x[0]+'" aria-pressed="'+(tab===x[0])+'">'+x[1]+'</button>';}).join('')+'</nav><section class="lm-panel">'+(tab==='projects'?projectPanel():tab==='chores'?chorePanel():horizonView())+'</section>'+editorView()+'</div>';
    var dialog=document.getElementById('lm-editor');
    if(view.editor&&dialog&&dialog.showModal){dialog.showModal();dialog.addEventListener('cancel',function(ev){ev.preventDefault();view.editor=null;window.AtlasConnected.clearInputDraft();render();});}
  };
  saveEditor=function(){
    var e=view.editor;if(!e)return;
    if(e.kind!=='chore'&&e.due&&!/^\d{4}-\d{2}-\d{2}$/.test(e.due)){document.getElementById('lm-editor-error').textContent='Choose a valid date.';return;}
    originalSave();
  };
  delEditor=function(){
    var e=view.editor;if(!e||!e.id)return;var chore=e.kind==='chore',key=chore?'chores':'projects',item=S[key].find(function(x){return x.id===e.id;});if(!item)return;
    var copy=JSON.parse(JSON.stringify(item));
    uiConfirm('Delete '+(chore?'chore':'project')+'?',chore?item.chore:item.task,'Delete',function(){
      S[key]=S[key].filter(function(x){return x.id!==copy.id;});view.editor=null;save();render();
      undoToast('Deleted',function(){if(S[key].some(function(x){return x.id===copy.id;}))return;S[key].push(copy);save();render();});
    },true);
  };
  // Confirmation text can include user-entered project names; keep it text.
  uiConfirm=function(title,body,label,callback,danger){return originalConfirm(esc(title),esc(body),esc(label),callback,danger);};
  function setStatus(id,next){
    var p=S.projects.find(function(x){return x.id===id;});if(!p)return;
    var before={status:p.status,doneAt:p.doneAt,log:(S.log||[]).filter(function(x){return x.t==='proj'&&x.id===id;})};
    p.status=next;S.log=(S.log||[]).filter(function(x){return !(x.t==='proj'&&x.id===id);});
    if(next==='Done'){p.doneAt=todayISO();S.log.push({t:'proj',id:id,d:todayISO()});}else delete p.doneAt;
    save();render();
    undoToast(next==='Done'?'Project completed':'Status updated',function(){var current=S.projects.find(function(x){return x.id===id;});if(!current||current.status!==next)return;current.status=before.status;if(before.doneAt)current.doneAt=before.doneAt;else delete current.doneAt;S.log=(S.log||[]).filter(function(x){return !(x.t==='proj'&&x.id===id);}).concat(before.log);save();render();});
  }
  app.addEventListener('click',function(ev){
    if(ev.target.closest('[data-act="closeEditor"]')){window.AtlasConnected.clearInputDraft();return;}
    var el=ev.target.closest('[data-lm]');if(!el)return;var id=el.dataset.id;
    if(el.dataset.lm==='tab'){tab=el.dataset.tab;render();}
    else if(el.dataset.lm==='complete'){var p=S.projects.find(function(x){return x.id===id;});if(p)setStatus(id,p.status==='Done'?'Not started':'Done');}
    else if(el.dataset.lm==='start'){var p=S.projects.find(function(x){return x.id===id;});if(p)setStatus(id,p.status==='In progress'?'Not started':'In progress');}
    else if(el.dataset.lm==='chore')tick(id);
  });
  app.addEventListener('submit',function(ev){if(ev.target.id==='lm-editor-form'){ev.preventDefault();saveEditor();}});
  app.addEventListener('change',function(ev){if(ev.target.dataset.lm==='chore-filter'){choreFilter=ev.target.value;render();}});
  // The original file input was unreachable because the delegated handler
  // required data-act before it checked importFile.
  document.addEventListener('change',function(ev){if(ev.target.id==='importFile'&&ev.target.files[0])importData(ev.target.files[0]);});
  importData=async function(file){
    var request=++importRequest;
    if(file.size>1500000){toast('Choose a backup smaller than 1.5 MB.');return;}
    try{
      var raw=JSON.parse(await file.text());if(request!==importRequest)return;
      var next=window.LifeMapRecords.validate(raw),projects=next.projects.length,chores=next.chores.length;
      uiConfirm('Restore this backup?',projects+' projects and '+chores+' chores will replace this Life Map. Download a backup first to keep the current version.','Restore',function(){if(request!==importRequest)return;var before=JSON.stringify(S);S=next;view.editor=null;save();render();var restored=JSON.stringify(S);undoToast('Backup restored',function(){if(JSON.stringify(S)!==restored){toast('Newer changes exist. Restore your earlier backup to go back.');return;}S=JSON.parse(before);save();render();});},true);
    }catch(e){toast(e.message||'This backup could not be read.');}
  };
  window.LifeMapDashboard={setStatus:setStatus,filtered:filtered};
})();
