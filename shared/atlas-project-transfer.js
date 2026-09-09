import { parseProjectUpdates, mergeProjectUpdates } from './atlas-project-transfer-core.mjs';
import { parseBackup, previewRestore, applyRestore, recover, readRecovery } from './atlas-vault-core.mjs';
import { localDay } from '../atlas/model.mjs';
const host=document.getElementById('atlas-project-transfer');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let updates=null,before=null,selected=new Set(),message='',failed=false,busy=false;
function syncView(){const raw=localStorage.getItem('lifemap_v1');if(raw&&window.acceptSyncedProjectState)window.acceptSyncedProjectState(JSON.parse(raw));}
function mount(){
  let journal=null;try{journal=readRecovery(sessionStorage);}catch{}
  const canUndo=journal?.entries.length===1&&journal.entries[0].key==='lifemap_v1';
  let local=[];try{local=JSON.parse(before)?.projects||[];}catch{}
  host.className='workflow project-transfer';
  host.innerHTML='<details'+(updates?' open':'')+'><summary>Transfer project updates</summary><p>This Life Map keeps projects, notes, and chores in this browser. The private Life Map keeps its own saved records.</p><a class="inline-link" href="https://atlas-os-quinton.qchambers123018.chatgpt.site/apps/life-map" target="_blank" rel="noopener">Open private Life Map</a><p>To bring selected project changes here, review a “Project updates” file from your saved Atlas workspace below.</p><label>Review project updates<input id="project-transfer-file" type="file" accept=".json,application/json" '+(busy?'disabled':'')+'></label>'+
    (updates?'<p>Only selected project titles, areas, due dates, and open/completed status will change. Notes, priorities, chores, and absent projects stay here. Close other Life Map tabs first.</p><div class="transfer-rows">'+updates.map((p,i)=>{const old=local.find(x=>x.id===p.id);return '<label><input type="checkbox" data-transfer-item="'+i+'" '+(selected.has(p.id)?'checked ':'')+(busy?'disabled':'')+'><span><strong>'+esc(p.title)+'</strong><span class="workflow-meta">'+(old?'Update: '+esc(old.task)+' → '+esc(p.title):'Add new project')+' · '+esc(p.area)+' · '+(p.due_date||'No due date')+' · '+esc(p.status)+'</span></span></label>';}).join('')+'</div><div class="transfer-actions"><button id="project-transfer-apply" '+(busy||!selected.size?'disabled':'')+'>Apply reviewed updates</button><button id="project-transfer-cancel" '+(busy?'disabled':'')+'>Cancel</button></div>':'')+'</details>'+
    (canUndo?'<button id="project-transfer-undo" '+(busy?'disabled':'')+'>Undo last project update</button><p class="workflow-meta">Recovery survives reloading this tab. Closing it removes the recovery point.</p>':'')+
    '<p id="project-transfer-status" class="workflow-feedback '+(failed?'workflow-error':'')+'" role="'+(failed?'alert':'status')+'">'+esc(message)+'</p>';
  host.querySelector('#project-transfer-file').onchange=async e=>{
    const file=e.target.files[0];if(!file)return;
    try{if(file.size>2000000)throw Error('Choose a project-updates file smaller than 2 MB.');updates=parseProjectUpdates(await file.text());before=localStorage.getItem('lifemap_v1');mergeProjectUpdates(before===null?{projects:[],chores:[],checks:{},log:[],planned:{}}:JSON.parse(before),updates,[],localDay());selected=new Set(updates.map(p=>p.id));message='';failed=false;}
    catch(error){updates=null;message=error.message;failed=true;}mount();
  };
  for(const input of host.querySelectorAll('[data-transfer-item]'))input.onchange=()=>{const id=updates[Number(input.dataset.transferItem)].id;if(input.checked)selected.add(id);else selected.delete(id);host.querySelector('#project-transfer-apply').disabled=!selected.size;};
  if(updates){
    host.querySelector('#project-transfer-cancel').onclick=()=>{updates=null;message='No project records changed.';mount();};
    host.querySelector('#project-transfer-apply').onclick=async()=>{
      if(busy)return;busy=true;mount();
      try{
        const current=localStorage.getItem('lifemap_v1');if(current!==before)throw Error('Life Map changed after the preview. Review the file again.');
        const next=mergeProjectUpdates(before===null?{projects:[],chores:[],checks:{},log:[],planned:{}}:JSON.parse(before),updates,[...selected],localDay());
        const parsed=parseBackup(JSON.stringify({lifemap_v1:JSON.stringify(next)})),preview=previewRestore(parsed,localStorage);
        if(preview.entries.every(e=>e.action==='unchanged')){updates=null;message='These project values already match. No records changed.';failed=false;return;}
        await applyRestore(preview,['map'],localStorage,sessionStorage);syncView();updates=null;message='Project updates saved and verified. Your local notes and chores are preserved.';failed=false;
      }catch(error){message=error.message;failed=true;try{syncView();}catch{}}
      finally{busy=false;mount();host.querySelector('#project-transfer-status').tabIndex=-1;host.querySelector('#project-transfer-status').focus();}
    };
  }
  if(canUndo)host.querySelector('#project-transfer-undo').onclick=async()=>{if(busy)return;busy=true;mount();try{await recover(localStorage,sessionStorage);updates=null;message='Previous local records restored and verified.';failed=false;}catch(error){message=error.message;failed=true;}finally{try{syncView();}catch{}busy=false;mount();}};
}
mount();
