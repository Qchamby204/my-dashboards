/* Compose the same dashboard over the existing GitHub browser store. */
(()=>{
  const local=createLifeMapLocalStore({getItem:k=>localStorage.getItem(k),setItem:(k,v)=>localStorage.setItem(k,v)},validateLifeMapRecords);
  const shell=document.createElement('section');shell.className='lm-local-status';
  const status=document.createElement('p');status.setAttribute('role','status');
  const retry=document.createElement('button');retry.textContent='Retry saving';retry.onclick=()=>{save();render();};
  const backup=document.createElement('button');backup.textContent='Download backup';backup.onclick=()=>exportData();
  const restore=document.createElement('button');restore.textContent='Restore backup';
  const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.hidden=true;input.onchange=()=>{if(input.files[0])importData(input.files[0]);};restore.onclick=()=>input.click();
  const earlier=document.createElement('details'),summary=document.createElement('summary');summary.textContent='i';summary.setAttribute('aria-label','About browser saving and private record transfer');earlier.className='atlas-info';
  const help=document.createElement('p');help.textContent='Open the private Life Map, choose Backups → Download backup, then restore that file here. Restoring replaces this browser’s board after confirmation. The private copy stays available.';
  const link=document.createElement('a');link.href='https://atlas-os-quinton.qchambers123018.chatgpt.site/apps/life-map';link.textContent='Open private Life Map';link.target='_blank';link.rel='noopener';
  const helpBody=document.createElement('div');helpBody.className='atlas-info-body';helpBody.append(help,link);earlier.append(summary,helpBody);shell.append(status,earlier,retry,backup,restore,input);app.before(shell);
  function feedback(){status.textContent=local.error||(view.editor||view.qa.txt.trim()?'Unsaved entry. Use Save or Add to keep it.':local.saved?'Saved in this browser':'No saved projects yet');retry.hidden=!local.error||local.blocked;backup.hidden=restore.hidden=!local.error;shell.className='lm-local-status'+(local.error?' lm-save-error':'');}
  const draw=render;render=function(){draw();feedback();app.inert=local.blocked;};
  document.addEventListener('input',feedback);
  save=function(){const ok=local.save(S);status.textContent=local.error||'Saved in this browser.';return ok;};
  const originalExport=exportData;
  exportData=function(){if(!local.blocked)return originalExport();const url=URL.createObjectURL(new Blob([local.raw??'No readable browser copy was available.'],{type:'text/plain'})),a=document.createElement('a');a.href=url;a.download='life-map-recovery.txt';document.body.append(a);a.click();setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},1000);};
  importData=async function(file){try{if(file.size>1500000)throw Error('Choose a backup smaller than 1.5 MB.');const next=validateLifeMapRecords(JSON.parse(await file.text()));uiConfirm('Restore this Life Map?',next.projects.length+' projects and '+next.chores.length+' chores will replace this browser’s board. Download a backup first to keep your current work.','Restore',()=>{if(local.save(next,true)){S=next;view.editor=null;view.qa.txt='';}render();},true);}catch(e){toast(e.message||'Could not read this backup.');}};
  window.addEventListener('beforeunload',e=>{if(local.error||view.editor||view.qa.txt.trim()){e.preventDefault();e.returnValue='';}});
  S=local.load();render();
  window.LifeMapLocal=local;
})();
