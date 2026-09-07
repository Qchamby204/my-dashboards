import {LEGACY_ORIGIN,newId} from './model.mjs';
export function createConnectUI({api,load,esc,error,toast,blocked}){
  let popup=null,nonce=null,plan=null,ticket=0,saving=false;
  const $=s=>document.querySelector(s),origin=new URL(LEGACY_ORIGIN).origin;
  function page(){return `<div class="page-heading"><div><h1>Bring your existing work.</h1><p>One transfer from this browser. Future edits save directly in Atlas.</p></div></div><section class="panel"><h2>Life Map and The Herald</h2><p>This brings projects, notes, chores, scripts, content checklists, and publishing details. Legacy contact records stay in their original browser copy. Existing private records keep their saved titles, dates, and status. An app already connected here is kept as saved.</p><button class="primary" data-connect-open>Find records in the original apps</button><p id="connect-status" role="status"></p><details><summary>Use a transfer file instead</summary><p>If the browser cannot pass records between the two pages, download the transfer from the original-app page and choose it here.</p><label>Transfer file<input id="connect-file" type="file" accept=".json,application/json"></label></details><div id="connect-preview">${preview()}</div><p id="connect-error" class="form-error" role="alert"></p></section><section class="panel"><h2>Start with a new record</h2><p>You can use the connected apps immediately, even before bringing older work here.</p><a class="inline-link" href="/apps/life-map">Open Life Map</a> · <a class="inline-link" href="/apps/herald">Open The Herald</a></section>`;}
  function preview(){return plan?`<h2>Review the connection</h2>${plan.rows.map(r=>`<article class="connection-review"><h3>${esc(r.name)}</h3><p>${r.connected?'Already connected. Saved records will be kept.':`${r.added} new records · ${r.kept} already in Atlas. App details will come with the transfer.`}</p><ul>${r.titles.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></article>`).join('')}<p>After connecting, use the apps inside Atlas for all new edits. Your original browser copies remain available as backups.</p><button class="primary" data-connect-save${saving?' disabled':''}>Connect these apps</button>`:'';}
  async function review(pack){
    if(saving||blocked())return;const request=++ticket;plan=null;
    if(!$('#connect-preview'))return;$('#connect-preview').innerHTML='<p>Checking your saved records…</p>';$('#connect-error').textContent='';
    try{const next=await api('/api/connected/import/preview','POST',{pack});if(request!==ticket||!$('#connect-preview'))return;plan=next;$('#connect-preview').innerHTML=preview();}
    catch(e){if(request===ticket&&$('#connect-error')){$('#connect-preview').innerHTML='';$('#connect-error').textContent=e.message;}}
  }
  window.addEventListener('message',e=>{
    if(e.origin!==origin||e.source!==popup||!nonce||e.data?.nonce!==nonce||e.data?.type!=='atlas-connected-transfer')return;
    review(e.data.pack);
  });
  document.addEventListener('change',async e=>{
    if(e.target.id!=='connect-file')return;const file=e.target.files?.[0];if(!file||saving)return;const request=++ticket;plan=null;$('#connect-preview').innerHTML='';
    if(file.size>3200000){$('#connect-error').textContent='Choose a transfer smaller than 3.2 MB.';return;}
    try{const raw=await file.text();if(request!==ticket||!$('#connect-file'))return;await review(JSON.parse(raw));}catch{if(request===ticket&&$('#connect-error'))$('#connect-error').textContent='This file could not be read.';}
  });
  document.addEventListener('click',async e=>{
    if(e.target.closest('[data-connect-open]')){
      if(saving||blocked())return;nonce=newId();popup=window.open(LEGACY_ORIGIN+'connect-atlas.html#'+encodeURIComponent(nonce),'atlas-connect-records','popup,width=720,height=760');
      $('#connect-status').textContent=popup?'Choose which apps to bring over in the page that opened.':'Allow this page to open the original apps, or use a transfer file.';return;
    }
    const button=e.target.closest('[data-connect-save]');if(!button||!plan||saving||blocked())return;
    saving=true;button.disabled=true;
    try{
      await api('/api/connected/import','POST',{pack:plan.pack,digest:plan.digest,seq:plan.seq});
      if(popup&&nonce)popup.postMessage({type:'atlas-connected-saved',nonce,kinds:plan.rows.map(r=>r.kind)},origin);
      plan=null;nonce=null;await load();location.hash='today';toast('Your apps are connected. Open them from Atlas for future edits.');
    }catch(e){if($('#connect-error'))$('#connect-error').textContent=e.message;else error(e.message);plan=null;}
    finally{saving=false;button.disabled=false;}
  });
  return {page,get saving(){return saving;},get dirty(){return !!plan;}};
}
