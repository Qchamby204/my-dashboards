/* A durable adapter for the original app UI. It never treats browser storage
   as a saved record. A failed save leaves the latest draft in this tab. */
(()=>{
  const kind=document.currentScript.dataset.kind,$=s=>document.querySelector(s);
  let state=null,version=null,loaded=false,active=null,queued=null,failure=false,inputDirty=false,generation=0,refreshing=false;
  const status=message=>{$('#connected-status').textContent=message;};
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const pending=()=>!!active||!!queued||inputDirty;
  async function request(method='GET',body){
    let response;try{response=await fetch('/api/connected/'+kind,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{throw Error('Connection lost. Your draft is still in this tab.');}
    let data;try{data=await response.json();}catch{throw Error('Your saved app could not load. Please sign in again or retry.');}
    if(!response.ok)throw Error(data.error||'This change could not be saved.');return data;
  }
  function controls(){
    $('#connected-retry').hidden=!failure;$('#connected-download').hidden=!failure;
    $('#connected-reload').hidden=!failure||!loaded;
  }
  function save(next){
    state=structuredClone(next);if(kind==='herald'){const keys=['videos','cadence','weeks','capture','roadmap','sys','goals'];state={...Object.fromEntries(keys.filter(k=>Object.hasOwn(state,k)).map(k=>[k,state[k]])),leads:[]};}queued={state:structuredClone(state),day:today()};generation++;inputDirty=false;
    status('Saving…');if(!failure)flush();
  }
  async function flush(){
    if(active)return active;
    if(!queued||failure)return false;
    active=(async()=>{
      while(queued&&!failure){
        const work=queued;queued=null;
        try{const result=await request('PUT',{...work,version});version=result.version;}
        catch(e){if(!queued)queued=work;failure=true;status(e.message);controls();return false;}
      }
      if(!inputDirty)status('Saved across devices');
      return true;
    })();
    try{return await active;}finally{active=null;if(queued&&!failure)flush();}
  }
  async function refresh(initial=false,discard=false){
    if(refreshing||!initial&&(pending()||failure||!discard&&window.connectedDraftOpen?.()))return false;
    refreshing=true;const ticket=generation;
    try{
      const next=await request();
      if(!initial&&(ticket!==generation||pending()||!discard&&window.connectedDraftOpen?.()))return false;
      state=next.state;version=next.version;
      if(initial){
        const script=document.createElement('script');script.src='/connected/'+kind+'-main.js';
        await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('The app could not start. Retry to open it.'));document.body.appendChild(script);});
        if(typeof window.acceptConnectedState!=='function')throw Error('The app could not start. Reload this page.');
        loaded=true;$('#connected-app').inert=false;
      }else {if(discard)window.discardConnectedDraft?.();window.acceptConnectedState?.(structuredClone(state));}
      failure=false;status('Saved across devices');$('#connected-import').hidden=next.connected;controls();return true;
    }catch(e){failure=true;status(e.message);controls();return false;}finally{refreshing=false;}
  }
  window.AtlasConnected={raw:()=>JSON.stringify(state),save,flush,clearInputDraft(){inputDirty=!!window.connectedDraftOpen?.();if(!inputDirty&&!active&&!queued&&!failure)status('Saved across devices');},get pending(){return pending();}};
  document.addEventListener('input',e=>{if(e.target.closest('#connected-app')&&!e.target.closest('#atlas-appearance-dialog')&&!e.target.closest('[data-ui-only]')){inputDirty=true;generation++;status('Unsaved changes');}});
  document.addEventListener('click',async e=>{
    const a=e.target.closest('a[href]');if(!a||!pending()||!loaded||a.hasAttribute('download')||a.target==='_blank')return;
    const url=new URL(a.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash)return;
    e.preventDefault();
    if(inputDirty){status('Finish or save your open edit before leaving.');return;}
    if(await flush())location.assign(a.href);
  });
  window.addEventListener('beforeunload',e=>{if(pending()){e.preventDefault();e.returnValue='';}});
  $('#connected-retry').addEventListener('click',()=>{if(!loaded){failure=false;refresh(true);return;}failure=false;controls();if(queued)flush();else refresh();});
  $('#connected-download').addEventListener('click',()=>{
    if(!state)return;
    const url=URL.createObjectURL(new Blob([JSON.stringify({app:'atlas-connected-transfer',version:1,apps:[{kind,state}]},null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=kind+'-unsaved-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('#connected-reload').addEventListener('click',()=>{
    $('#connected-discard').hidden=false;
  });
  $('#connected-keep').addEventListener('click',()=>{$('#connected-discard').hidden=true;});
  $('#connected-discard-confirm').addEventListener('click',()=>{queued=null;inputDirty=false;failure=false;$('#connected-discard').hidden=true;refresh(false,true);});
  window.addEventListener('focus',()=>refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  setInterval(()=>{if(!document.hidden)refresh();},30000);
  refresh(true);
})();
