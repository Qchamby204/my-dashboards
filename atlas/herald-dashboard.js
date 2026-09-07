/* The Herald owns content. Atlas stays a reference hub. */
(function(){
  const clone=x=>JSON.parse(JSON.stringify(x)),root=document.getElementById('connected-app');
  const labels={draft:'Idea / draft',approved:'Ready to produce',produced:'Filmed / edited',scheduled:'Scheduled on platform',published:'Published'};
  const packaging=[['title','Publication title'],['desc','Description'],['thumb','Thumbnail notes'],['broll','Supporting footage'],['emph','Key points'],['tags','Tags'],['blog','Article draft'],['cta','Closing / call to action']];
  const metrics=[['ctr','Click-through rate (%)'],['avd','Average view duration (min)'],['ret','Retention (%)'],['srch','Search traffic (%)'],['likes','Likes'],['com','Comments'],['subs','Subscribers gained']];
  let query='',format='',capture='',editor=null,editorBefore='',review=null,importRequest=0,returnFocus=null;
  const button=(act,label,id='',extra='')=>'<button type="button" data-h="'+act+'" data-id="'+esc(id)+'" '+extra+'>'+label+'</button>';
  const options=(pairs,value)=>pairs.map(([key,label])=>'<option value="'+key+'"'+(key===value?' selected':'')+'>'+label+'</option>').join('');
  const wordCount=s=>String(s||'').trim().split(/\s+/u).filter(Boolean).length;
  function reading(s){const n=wordCount(s);return n+' words · '+(n?Math.max(1,Math.round(n/150))+' min estimated read':'No script yet');}
  function filtered(){const q=query.trim().toLocaleLowerCase();return S.videos.filter(v=>(!vaultFilter||v.status===vaultFilter)&&(!format||v.fmt===format)&&(!q||[v.title,v.script,v.kw,v.vert].join(' ').toLocaleLowerCase().includes(q))).slice().reverse();}
  function row(v){return '<article class="hd-row"><div>'+button('edit',esc(v.title),v.id,'class="hd-title"')+'<p>'+esc(labels[v.status]||v.status)+' · '+(v.fmt==='short'?'Short':'Long form')+(v.vert?' · '+esc(v.vert):'')+'</p><p>'+esc(reading(v.script))+(v.status==='published'?' · Published '+esc(v.publishedDay||'date unknown'):v.sched?' · Planned '+esc(v.sched):'')+'</p></div>'+button('edit','Open',v.id,'class="hd-open" aria-label="Open '+esc(v.title)+'"')+'</article>';}
  function list(){const items=filtered();return '<p class="hd-count">'+items.length+' of '+S.videos.length+' items</p>'+(items.length?items.map(row).join(''):'<p class="hd-empty">'+(S.videos.length?'No content matches these filters.':'Capture an idea above. Add a script whenever you’re ready.')+'</p>');}
  renderVault=function(){return '<section class="hd-panel"><form id="hd-capture"><label for="hd-idea">Capture an idea</label><div class="hd-inline"><input id="hd-idea" maxlength="500" placeholder="What would you like to make?" value="'+esc(capture)+'" required><button class="hd-primary" type="submit">Add idea</button>'+button('new','Add with details')+'</div></form><div class="hd-filters" data-ui-only><label>Search<input id="hd-search" value="'+esc(query)+'" placeholder="Title, script, or keyword"></label><label>Stage<select id="hd-stage-filter">'+options([['','All stages'],...Object.entries(labels)],vaultFilter)+'</select></label><label>Format<select id="hd-format-filter">'+options([['','All formats'],['long','Long form'],['short','Short']],format)+'</select></label></div><div id="hd-list">'+list()+'</div></section>';};
  function contentDate(v){return v.status==='published'?v.publishedDay:v.sched;}
  renderCalendar=function(){
    const month=isoD(calYM.y,calYM.m,1).slice(0,7),dated=S.videos.filter(v=>contentDate(v)?.startsWith(month)).sort((a,b)=>contentDate(a).localeCompare(contentDate(b))||a.title.localeCompare(b.title));
    const undated=S.videos.filter(v=>!contentDate(v));
    return '<section class="hd-panel"><div class="hd-heading">'+button('month-prev','← Previous')+'<h2>'+new Date(calYM.y,calYM.m,1).toLocaleDateString(undefined,{month:'long',year:'numeric'})+'</h2>'+button('month-next','Next →')+'</div><p class="hd-help">Planned dates are your intention. “Scheduled on platform” means you have scheduled it yourself. Published dates record when it actually went out.</p>'+(dated.length?dated.map(v=>'<div class="hd-calendar-row"><span>'+esc(contentDate(v))+'<small>'+(v.status==='published'?'Published':'Planned')+'</small></span>'+row(v)+'</div>').join(''):'<p class="hd-empty">No dated content this month.</p>')+'<details class="hd-details"><summary>Without a date ('+undated.length+')</summary>'+(undated.length?undated.map(row).join(''):'<p>Every item has a date.</p>')+'</details></section>';
  };
  // Keep optional manual measurements without inventing benchmarks or missing values.
  renderMetrics=function(){const published=S.videos.filter(v=>v.status==='published');return '<section class="hd-panel"><h2>Recorded results</h2><p class="hd-help">Optional figures you enter from your platform. Blank values mean unknown. Open an item to update its results.</p>'+(published.length?'<div class="hd-table-wrap"><table><thead><tr><th>Content</th>'+metrics.map(m=>'<th>'+m[1]+'</th>').join('')+'</tr></thead><tbody>'+published.map(v=>'<tr><th>'+button('edit',esc(v.title),v.id)+'</th>'+metrics.map(([k])=>'<td>'+esc(v.metrics?.[k]??'—').replace(/^$/,'—')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>':'<p class="hd-empty">Published content will appear here.</p>')+'</section>';};
  renderRail=function(){};
  renderTabs=function(){document.getElementById('tabs').innerHTML=[['vault','Content'],['calendar','Calendar'],['tools','Tools']].map(([key,label])=>'<button type="button" class="tab '+(cur===key?'on':'')+'" data-h="tab" data-tab="'+key+'" aria-pressed="'+(cur===key)+'">'+label+'</button>').join('');};
  renderAll=function(){
    renderTabs();
    const tools='<section class="hd-panel"><h2>Optional tools</h2><p class="hd-help">Use these when they help. Capturing, writing, and publishing content do not require a daily checklist.</p><div class="hd-inline">'+button('metrics','Recorded results')+button('cadence','Earlier cadence checklist')+'</div></section>';
    document.getElementById('view').innerHTML=(cur==='vault'?renderVault():cur==='calendar'?renderCalendar():cur==='metrics'?renderMetrics():cur==='cadence'?renderCadence():tools);
  };
  function field(key,label,value,type='text',extra=''){return '<label>'+label+'<input data-field="'+key+'" type="'+type+'" value="'+esc(value??'')+'" '+extra+'></label>';}
  function area(key,label,value,rows=3){return '<label>'+label+'<textarea data-field="'+key+'" rows="'+rows+'">'+esc(value||'')+'</textarea></label>';}
  function select(key,label,pairs,value){return '<label>'+label+'<select data-field="'+key+'">'+options(pairs,value)+'</select></label>';}
  function dialogRoot(){let host=document.getElementById('hd-dialog-root');if(!host){host=document.createElement('div');host.id='hd-dialog-root';root.appendChild(host);}return host;}
  function showDialog(html,id){dialogRoot().innerHTML=html;const d=document.getElementById(id);if(d?.showModal){d.showModal();d.addEventListener('cancel',e=>{e.preventDefault();if(editor)closeEditor();else closeReview();});}}
  function edit(id){
    if(editor||review)return;const item=S.videos.find(v=>v.id===id);
    returnFocus=document.activeElement;
    editor=item?clone(item):{id:uid(),title:capture.trim(),script:'',fmt:'long',vert:'General',status:'draft',sched:'',publishedDay:'',kw:'',opt:blankOpt(),pub:{},metrics:{}};
    editor.opt={...editor.opt,...Object.fromEntries(packaging.map(([k])=>[k,{t:'',d:false,...editor.opt?.[k]}]))};editor.metrics??={};editor.pub??={};editorBefore=JSON.stringify(editor);
    const v=editor;
    showDialog('<dialog class="hd-dialog" id="hd-editor" aria-labelledby="hd-editor-title"><form id="hd-editor-form"><div class="hd-heading"><h2 id="hd-editor-title">'+(item?'Edit content':'New content')+'</h2>'+button('cancel','Cancel')+'</div>'+field('title','Working title',v.title,'text','maxlength="500" required')+'<div class="hd-grid">'+select('fmt','Format',[['long','Long form'],['short','Short']],v.fmt)+field('vert','Audience (optional)',v.vert,'text','maxlength="120"')+'</div>'+area('script','Script',v.script,14)+button('copy-script','Copy script')+'<p class="hd-help" id="hd-reading">'+reading(v.script)+' at 150 words/minute.</p><div class="hd-grid">'+select('status','Production stage',Object.entries(labels),v.status)+field('sched','Planned date (optional)',v.sched,'date')+'</div><div id="hd-published"'+(v.status==='published'?'':' hidden')+'>'+field('publishedDay','Actual publication date (optional)',v.publishedDay,'date','max="'+todayISO()+'"')+'<p class="hd-help">Leave blank if unknown. Changing this stage records your progress; it does not post to a platform.</p></div><details class="hd-details"><summary>Packaging and production notes</summary>'+field('kw','Keyword (optional)',v.kw)+packaging.map(([k,label])=>'<div class="hd-package">'+area('opt.'+k+'.t',label,v.opt[k].t)+'<label class="hd-check"><input type="checkbox" data-field="opt.'+k+'.d"'+(v.opt[k].d?' checked':'')+'> Reviewed</label></div>').join('')+'<label class="hd-check"><input type="checkbox" data-field="flow"'+(v.flow?' checked':'')+'> Script read through</label></details><details class="hd-details"><summary>Publication checklist</summary>'+PUBC.map(p=>'<label class="hd-check"><input type="checkbox" data-field="pub.'+p.k+'"'+(v.pub[p.k]?' checked':'')+'>'+esc(p.l)+'</label>').join('')+'</details><details class="hd-details"><summary>Results (optional)</summary><div class="hd-grid">'+metrics.map(([k,label])=>field('metrics.'+k,label,v.metrics[k],'number','min="0" step="any"'+(['ctr','ret','srch'].includes(k)?' max="100"':''))).join('')+'</div></details><p id="hd-editor-error" role="alert"></p><div id="hd-discard" class="hd-confirm" hidden><p>Discard the edits in this window?</p>'+button('keep','Keep editing')+button('discard','Discard edits')+'</div><div id="hd-delete" class="hd-confirm" hidden><p>Delete this content? You can undo immediately after deleting.</p>'+button('keep','Keep editing')+button('delete-confirm','Delete content',v.id)+'</div><div class="hd-actions">'+(item?button('delete','Delete',v.id,'class="hd-danger"'):'')+button('download','Download draft')+'<button type="submit" class="hd-primary">Save content</button></div></form></dialog>','hd-editor');
  }
  function closeEditor(force=false){
    if(!editor)return;
    if(!force&&JSON.stringify(editor)!==editorBefore){document.getElementById('hd-discard').hidden=false;return;}
    editor=null;dialogRoot().innerHTML='';window.AtlasConnected.clearInputDraft?.();returnFocus?.focus?.();
  }
  function writeField(key,value){
    if(!editor)return;const parts=key.split('.');let obj=editor;for(const k of parts.slice(0,-1)){obj[k]??={};obj=obj[k];}obj[parts.at(-1)]=value;
    if(key==='script')document.getElementById('hd-reading').textContent=reading(value)+' at 150 words/minute.';
    if(key==='status')document.getElementById('hd-published').hidden=value!=='published';
  }
  function saveContent(){
    if(!editor)return false;
    try{
      const item=clone(editor);item.title=item.title.trim();
      if(item.status!=='published')item.publishedDay='';
      if(item.publishedDay&&item.publishedDay>todayISO())throw Error('An actual publication date cannot be in the future. Use the planned date instead.');
      const next={...S,videos:S.videos.some(v=>v.id===item.id)?S.videos.map(v=>v.id===item.id?item:v):[...S.videos,item]};
      const checked=validateHeraldRecords(next);const isNew=!S.videos.some(v=>v.id===item.id);
      S=checked;editor=null;if(isNew)capture='';dialogRoot().innerHTML='';save();window.AtlasConnected.clearInputDraft?.();renderAll();returnFocus?.focus?.();return true;
    }catch(e){document.getElementById('hd-editor-error').textContent=e.message;return false;}
  }
  function addIdea(){
    const title=capture.trim();if(!title)return;
    const v={id:uid(),title,fmt:'long',status:'draft',vert:'General',script:'',opt:blankOpt(),pub:{},metrics:{},publishedDay:''};
    try{const next=validateHeraldRecords({...S,videos:[...S.videos,v]});S=next;capture='';save();renderAll();window.AtlasConnected.clearInputDraft?.();document.getElementById('hd-idea')?.focus();}catch(e){toast(e.message);}
  }
  function remove(id){
    const index=S.videos.findIndex(v=>v.id===id);if(index<0)return;const item=clone(S.videos[index]);
    S.videos.splice(index,1);closeEditor(true);save();renderAll();
    undoToast('Content deleted',()=>{if(S.videos.some(v=>v.id===item.id))return;S.videos.splice(Math.min(index,S.videos.length),0,item);save();renderAll();});
  }
  delScript=remove;
  schedVid=function(id,date){const v=S.videos.find(v=>v.id===id);if(!v)return;try{const next=validateHeraldRecords({...S,videos:S.videos.map(x=>x.id===id?{...x,sched:date||''}:x)});S=next;save();renderAll();}catch(e){toast(e.message);}};
  function draftState(){
    const next=clone(S);
    if(editor){const item=clone(editor);item.title=item.title.trim()||'Untitled idea';const i=next.videos.findIndex(v=>v.id===item.id);if(i<0)next.videos.push(item);else next.videos[i]=item;}
    if(capture.trim()&&(!editor||S.videos.some(v=>v.id===editor.id)))next.videos.push({id:uid(),title:capture.trim(),script:'',status:'draft',fmt:'long',vert:'General',opt:blankOpt(),metrics:{},pub:{}});
    return next;
  }
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(draftState(),null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='herald-backup-'+todayISO()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  exportData=download;
  function closeReview(){review=null;importRequest++;dialogRoot().innerHTML='';window.AtlasConnected.clearInputDraft?.();returnFocus?.focus?.();}
  importData=async function(ev){
    const file=ev?.target?.files?.[0]||ev;if(ev?.target)ev.target.value='';if(!file||editor||review)return;
    const ticket=++importRequest;
    if(file.size>1500000){toast('Choose a backup smaller than 1.5 MB.');return;}
    try{
      let raw=JSON.parse(await file.text());if(ticket!==importRequest||editor||review)return;
      if(raw.app==='atlas-connected-transfer')raw=raw.apps?.find(a=>a.kind==='herald')?.state;
      review=validateHeraldRecords(raw);returnFocus=document.activeElement;
      showDialog('<dialog class="hd-dialog" id="hd-restore" aria-labelledby="hd-restore-title"><h2 id="hd-restore-title">Restore this backup?</h2><p>'+review.videos.length+' content items will replace the '+S.videos.length+' currently in this Herald. Download a backup first to keep the current version.</p><div class="hd-actions">'+button('download','Download current backup')+button('restore-cancel','Cancel')+button('restore-confirm','Restore backup','','class="hd-primary"')+'</div></dialog>','hd-restore');
    }catch(e){toast(e.message||'This backup could not be read.');}
  };
  function restore(){if(!review)return;const before=clone(S);S=review;review=null;capture='';dialogRoot().innerHTML='';save();renderAll();window.AtlasConnected.clearInputDraft?.();const after=JSON.stringify(S);undoToast('Backup restored',()=>{if(JSON.stringify(S)!==after){toast('Newer edits exist. Restore your earlier backup to go back.');return;}S=before;save();renderAll();});}
  window.connectedDraftOpen=()=>!!editor||!!review||!!capture.trim()||(cur==='cadence'&&!!document.querySelector('#connected-app input:focus,#connected-app textarea:focus'));
  window.connectedDraftState=draftState;
  window.discardConnectedDraft=()=>{editor=null;review=null;capture='';dialogRoot().innerHTML='';};
  window.acceptConnectedState=next=>{S=next;renderAll();};
  root.addEventListener('input',e=>{
    const el=e.target;if(el.id==='hd-search'){query=el.value;document.getElementById('hd-list').innerHTML=list();}
    else if(el.id==='hd-idea'){capture=el.value;if(!capture.trim())window.AtlasConnected.clearInputDraft?.();}
    else if(el.dataset.field)writeField(el.dataset.field,el.type==='checkbox'?el.checked:el.value);
  });
  root.addEventListener('change',e=>{const el=e.target;if(el.dataset.field)writeField(el.dataset.field,el.type==='checkbox'?el.checked:el.value);else if(el.id==='hd-stage-filter'||el.id==='hd-format-filter'){if(el.id==='hd-stage-filter')vaultFilter=el.value;else format=el.value;document.getElementById('hd-list').innerHTML=list();}});
  root.addEventListener('submit',e=>{if(e.target.id==='hd-capture'){e.preventDefault();addIdea();}else if(e.target.id==='hd-editor-form'){e.preventDefault();saveContent();}});
  root.addEventListener('click',e=>{
    const el=e.target.closest('[data-h]');if(!el)return;const act=el.dataset.h,id=el.dataset.id;
    if(act==='edit'||act==='new')edit(act==='new'?null:id);
    else if(act==='cancel')closeEditor();else if(act==='discard')closeEditor(true);
    else if(act==='keep'){document.getElementById('hd-discard').hidden=true;document.getElementById('hd-delete').hidden=true;}
    else if(act==='delete')document.getElementById('hd-delete').hidden=false;
    else if(act==='delete-confirm')remove(id);
    else if(act==='download')download();
    else if(act==='copy-script'){try{if(!editor?.script.trim()){toast('Add a script first.');return;}navigator.clipboard.writeText(editor.script).then(()=>toast('Script copied'),()=>toast('Copy was unavailable. Select the script text to copy it.'));}catch{toast('Copy was unavailable. Select the script text to copy it.');}}
    else if(act==='restore-cancel')closeReview();else if(act==='restore-confirm')restore();
    else if(act==='metrics'||act==='cadence'){cur=act;renderAll();}
    else if(act==='tab'){cur=el.dataset.tab;renderAll();}
    else if(act==='month-prev'||act==='month-next')calNav(act==='month-prev'?-1:1);
  });
  window.HeraldDashboard={edit,writeField,saveContent,closeEditor,remove,filtered,draftState,restore,wordCount};
  renderAll();
  const linked=new URL(location.href).searchParams.get('record');if(linked&&S.videos.some(v=>v.id===linked))edit(linked);
})();
