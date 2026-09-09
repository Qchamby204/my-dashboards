/* Restore the original Life Map composition. Keep only bounded safety and help additions. */
(function(){
  var importRequest=0,originalConfirm=uiConfirm;
  function info(label,text){return '<details class="atlas-info"><summary aria-label="'+esc(label)+'"><span aria-hidden="true">i</span></summary><div class="atlas-info-body">'+esc(text)+'</div></details>';}
  var originalSection=section;
  section=function(key,title,accent,teaser,content){return originalSection(key,title,accent,teaser,content).replace('data-act="section"','aria-expanded="'+!!view.open[key]+'" data-act="section"');};
  var originalChores=choresView;
  var originalProjects=projectsView;
  projectsView=function(){return originalProjects().replace(/data-act="(q|fArea|fStatus|fPri)"/g,'data-ui-only data-act="$1"');};
  choresView=function(){return originalChores().replace(/<span style="[^"]*">Ticks clear themselves when the period rolls over\.<\/span>/,info('How repeating chores work','Each chore becomes due again at the start of its next daily, weekly, monthly, quarterly, or annual cycle. Use Today to include a chore in today’s plan.'));};
  var originalEditor=editorView;
  editorView=function(){
    var html=originalEditor();if(!html)return html;
    html=html.replace('<div class="overlay"','<div class="overlay" role="dialog" aria-modal="true" aria-label="'+(view.editor.kind==='chore'?'Chore details':'Project details')+'"');
    html=html.replace(/<div style="[^"]*">Parked tasks stay off Today,[\s\S]*?<\/div>/,info('How parked projects work','Parked tasks stay off Today, Coming up and the open list until about '+WAKE_DAYS+' days before that month. A due date within 14 days always wakes the task.'));
    var area=view.editor.area;
    if(area&&!AREAS.some(function(a){return a.name===area;}))html=html.replace(/(<select data-act="f" data-k="area"[^>]*>)/,'$1<option selected>'+esc(area)+'</option>');
    return html;
  };
  var originalSave=saveEditor;
  saveEditor=function(){
    var e=view.editor;if(!e)return;
    var test=JSON.parse(JSON.stringify(S)),key=e.kind==='chore'?'chores':'projects',item=Object.assign({},e,{id:e.id||'new-draft'});
    if(!e.id){if(key==='projects')item.status=item.status||'Not started';else item.cad=item.cad||'Weekly';}
    var at=test[key].findIndex(function(x){return x.id===e.id;});if(at<0)test[key].push(item);else test[key][at]=Object.assign(test[key][at],item);
    try{window.LifeMapRecords.validate(test);}catch(error){toast(error.message);return;}
    originalSave();window.AtlasConnected?.clearInputDraft?.();
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
  advance=function(id){var p=S.projects.find(function(x){return x.id===id;});if(p)setStatus(id,STATUSES[(Math.max(0,STATUSES.indexOf(p.status))+1)%STATUSES.length]);};
  app.addEventListener('click',function(ev){if(ev.target.closest('[data-act="closeEditor"]'))window.AtlasConnected?.clearInputDraft?.();});
  app.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&view.editor&&!document.getElementById('uiDlg')){ev.preventDefault();view.editor=null;window.AtlasConnected?.clearInputDraft?.();render();}});
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
  window.LifeMapDashboard={setStatus:setStatus};
})();
