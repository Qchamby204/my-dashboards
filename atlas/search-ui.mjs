import { SEARCH_SOURCES } from './search.mjs';

export function createSearchUI({api,resolveResult,blocked,error,esc}){
  const $=s=>document.querySelector(s),dialog=$('#workspace-search-dialog'),query=$('#workspace-query'),scope=$('#workspace-source'),archives=$('#workspace-archives'),list=$('#workspace-results'),status=$('#workspace-search-status');
  let ticket=0,controller=null,timer=null,rows=[],opening=false;
  function invalidate(){ticket++;controller?.abort();controller=null;clearTimeout(timer);timer=null;rows=[];}
  function freeze(on){opening=on;for(const el of [query,scope,archives,$('#workspace-search-submit')])el.disabled=on;}
  function clear(){invalidate();freeze(false);query.value='';scope.value='all';archives.checked=false;list.innerHTML='';status.textContent='Enter at least two characters. All words must match.';$('#workspace-search-error').textContent='';}
  function open(){
    if(blocked()||document.querySelector('dialog[open]')){error('Finish or close your current editor before opening workspace search.');return;}
    clear();dialog.showModal();query.focus();
  }
  async function run(){
    invalidate();if(!dialog.open)return;const current=ticket;$('#workspace-search-error').textContent='';list.innerHTML='';
    if(query.value.trim().length<2){status.textContent='Enter at least two characters. All words must match.';return;}
    status.textContent='Searching your saved workspace…';controller=new AbortController();
    try{
      const result=await api('/api/search','POST',{query:query.value,scope:scope.value,include_archived:archives.checked},controller.signal);
      if(current!==ticket||!dialog.open)return;rows=result.results;
      status.textContent=`${result.total} ${result.total===1?'match':'matches'}${result.truncated?' · Showing the best 40. Add words or choose a source to narrow the results.':'.'}`;
      list.innerHTML=rows.map((r,i)=>`<button type="button" class="workspace-result" data-workspace-result="${i}"><span class="workspace-result-source">${SEARCH_SOURCES[r.source]}${r.archived?' · Archived':''}</span><strong>${esc(r.title)}</strong><span class="small">${esc(r.metadata)}</span>${r.snippet?`<span class="workspace-result-snippet">${esc(r.snippet)}</span>`:''}<span class="workspace-result-open">Open ${r.kind==='review'?'review':r.kind==='day'?'day':r.kind==='lesson'?'lesson':'record'} →</span></button>`).join('')||'<p class="quiet-message">No matching saved records. Try fewer words or another source. Browser-local app records must be imported before Atlas can search them.</p>';
    }catch(e){if(current!==ticket||!dialog.open)return;status.textContent='Search is unavailable.';$('#workspace-search-error').textContent=e.message;}
  }
  function schedule(){invalidate();list.innerHTML='';status.textContent=query.value.trim().length<2?'Enter at least two characters. All words must match.':'Waiting to search…';$('#workspace-search-error').textContent='';timer=setTimeout(run,250);}
  $('#workspace-search').addEventListener('click',open);
  $('#workspace-search-form').addEventListener('submit',e=>{e.preventDefault();if(!opening)run();});
  query.addEventListener('input',schedule);scope.addEventListener('change',()=>{if(!opening)run();});archives.addEventListener('change',()=>{if(!opening)run();});
  list.addEventListener('click',async e=>{
    const button=e.target.closest('[data-workspace-result]');if(!button||opening)return;const result=rows[Number(button.dataset.workspaceResult)];if(!result)return;
    invalidate();const current=ticket;controller=new AbortController();freeze(true);list.querySelectorAll('button').forEach(b=>b.disabled=true);status.textContent='Opening the latest saved record…';$('#workspace-search-error').textContent='';
    try{const activate=await resolveResult(result,controller.signal);if(current!==ticket||!dialog.open)return;dialog.close();activate();}
    catch(err){if(current!==ticket||!dialog.open)return;list.innerHTML='';status.textContent='The record could not be opened.';$('#workspace-search-error').textContent=err.message+' Search again to refresh the results.';}
    finally{if(current===ticket)freeze(false);}
  });
  query.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){const first=list.querySelector('button');if(first){e.preventDefault();first.focus();}}});
  list.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp'].includes(e.key))return;const buttons=[...list.querySelectorAll('button')],at=buttons.indexOf(e.target);if(at<0)return;e.preventDefault();const next=e.key==='ArrowDown'?at+1:at-1;if(next<0)query.focus();else buttons[Math.min(next,buttons.length-1)]?.focus();});
  document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'&&!e.altKey){e.preventDefault();if(dialog.open){if(!opening)query.focus();}else open();}});
  dialog.addEventListener('close',()=>{if(!dialog.open)clear();});
  window.addEventListener('hashchange',()=>{if(dialog.open)dialog.close();});
  return {open};
}
