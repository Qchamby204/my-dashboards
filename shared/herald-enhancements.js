/* Small improvements inside the original Herald. Same screens, same storage key. */
(()=>{
  function start(){
    if(document.documentElement.dataset.atlasApp!=='the-herald'||typeof S==='undefined'||window.HeraldImprovements)return;
    const copy=x=>JSON.parse(JSON.stringify(x));
    const oldRender=renderAll,oldItem=vaultItem,oldBody=vaultBody,oldToast=toast,oldAdd=addVideo,oldApply=applyPkg;
    let search='',timer=null,dirty=false,failed=false;
    const drafts=()=>{if(!S._writingDrafts||typeof S._writingDrafts!=='object'||Array.isArray(S._writingDrafts))S._writingDrafts={};return S._writingDrafts;};
    function status(){
      let box=document.getElementById('herald-save-error');
      if(!box){box=document.createElement('div');box.id='herald-save-error';box.setAttribute('role','alert');box.innerHTML='<p>Changes could not be saved on this device. Keep this page open or download a backup.</p><button type="button" data-herald-action="retry">Retry saving</button> <button type="button" data-herald-action="backup">Download backup</button>';document.getElementById('view').before(box);}
      box.hidden=!failed;
    }
    function persist(){
      clearTimeout(timer);
      try{const raw=JSON.stringify(S);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)throw Error('Write not retained');dirty=false;failed=false;}
      catch{dirty=true;failed=true;}
      status();return !failed;
    }
    function queue(){dirty=true;clearTimeout(timer);timer=setTimeout(persist,350);}
    save=function(){const ok=persist();renderRail();return ok;};
    toast=function(message){oldToast(failed?'Not saved. Download a backup before closing this page.':message);};
    function words(text){return String(text||'').trim().split(/\s+/).filter(Boolean).length;}
    function count(v){const n=words(v.script);return n+' words · '+(n?Math.max(1,Math.round(n/150))+' min estimated read':'No script yet');}
    function matches(v){const q=search.trim().toLocaleLowerCase();return (!vaultFilter||v.status===vaultFilter)&&(!q||[v.title,v.script,v.kw,v.vert].join(' ').toLocaleLowerCase().includes(q));}
    function filter(){
      let shown=0;for(const card of document.querySelectorAll('[data-herald-id]')){const v=vById(card.dataset.heraldId);card.hidden=!v||!matches(v);if(!card.hidden)shown++;}
      const result=document.getElementById('herald-search-count');if(result)result.textContent=shown+' matching script'+(shown===1?'':'s');
    }
    function restoreFields(){for(const [key,value] of Object.entries(drafts())){if(!['nv-title','nv-script','nv-kw','nv-fmt','nv-vert'].includes(key)&&!key.startsWith('pkg-')&&!key.startsWith('herald-title-'))continue;const el=document.getElementById(key);if(el&&el.type!=='file'&&typeof value==='string')el.value=value;}}
    function decorate(){
      if(cur==='vault'){
        const card=document.querySelector('#view .card:last-child');
        if(card&&!document.getElementById('herald-search')){const form=document.createElement('div');form.className='herald-vault-search';form.innerHTML='<label for="herald-search">Search the vault</label><input id="herald-search" type="search" placeholder="Title, script, or keyword" value="'+esc(search)+'"><p id="herald-search-count" aria-live="polite"></p>';card.prepend(form);}
        filter();
      }
      restoreFields();status();
    }
    vaultItem=function(v){return oldItem(v).replace('<div class="vitem"','<div class="vitem" data-herald-id="'+esc(v.id)+'"');};
    vaultBody=function(v){
      return oldBody(v).replace('<div class="vbody">','<div class="vbody"><label class="herald-title-label">Working title<input id="herald-title-'+esc(v.id)+'" data-herald-title="'+esc(v.id)+'" value="'+esc(v.title)+'" maxlength="500"></label>')
        .replace('onchange="setScript(', 'data-herald-script="'+esc(v.id)+'" onchange="setScript(')
        .replace('</textarea>','</textarea><div class="herald-script-tools"><span id="herald-words-'+esc(v.id)+'">'+count(v)+'</span><button type="button" class="btn sm line" data-herald-action="copy-script" data-id="'+esc(v.id)+'">Copy script</button></div>');
    };
    renderAll=function(){oldRender();decorate();};
    addVideo=function(...args){const before=S.videos.length;oldAdd(...args);if(S.videos.length>before){for(const key of ['nv-title','nv-script','nv-kw','nv-fmt','nv-vert'])delete drafts()[key];save();renderAll();}};
    applyPkg=function(id){const key='pkg-'+id;delete drafts()[key];oldApply(id);const el=document.getElementById(key);if(el?.value)drafts()[key]=el.value;else save();};
    function removeItems(ids){
      const removed=S.videos.map((v,index)=>({v:copy(v),index})).filter(x=>ids.has(x.v.id));if(!removed.length)return;
      S.videos=S.videos.filter(v=>!ids.has(v.id));save();renderAll();
      undoToast(removed.length===1?'Script deleted':removed.length+' scripts deleted',()=>{for(const {v,index} of removed)if(!vById(v.id))S.videos.splice(Math.min(index,S.videos.length),0,v);save();renderAll();});
    }
    delScript=id=>removeItems(new Set([id]));
    delSel=function(){if(!selIds.size){toast('Nothing selected');return;}if(!confirmDel){confirmDel=true;renderAll();return;}const ids=new Set(selIds);selIds.clear();selMode=false;confirmDel=false;removeItems(ids);};
    selectAllShown=function(){S.videos.filter(matches).forEach(v=>selIds.add(v.id));confirmDel=false;renderAll();};
    // The original fallback reported success even when Safari returned false.
    fallbackCopyText=function(text,message){
      const focus=document.activeElement,ta=document.createElement('textarea');ta.value=text;ta.style.cssText='position:fixed;left:0;top:0;opacity:0;font-size:16px';document.body.appendChild(ta);ta.focus();ta.select();
      try{if(!document.execCommand('copy'))throw Error('Copy unavailable');toast(message||'Copied');}catch{toast('Copy unavailable. Select the text and copy it manually.');}finally{ta.remove();focus?.focus?.({preventScroll:true});}
    };
    function rename(id,value){const v=vById(id),title=value.trim();if(!v)return;if(!title||title.length>500){toast('Use a title between 1 and 500 characters.');return false;}v.title=title;delete drafts()['herald-title-'+id];save();renderAll();return true;}
    document.addEventListener('input',e=>{
      const el=e.target;
      if(el.id==='herald-search'){search=el.value;filter();return;}
      if(el.dataset.heraldScript){const v=vById(el.dataset.heraldScript);if(v){v.script=el.value;const n=document.getElementById('herald-words-'+v.id);if(n)n.textContent=count(v);queue();}return;}
      if(el.id?.startsWith('nv-')||el.id?.startsWith('pkg-')||el.dataset.heraldTitle){drafts()[el.id]=el.value;queue();}
    });
    document.addEventListener('change',e=>{const el=e.target;if(el.dataset.heraldTitle)rename(el.dataset.heraldTitle,el.value);else if(el.id==='nv-fmt'||el.id==='nv-vert'){drafts()[el.id]=el.value;queue();}});
    document.addEventListener('click',e=>{
      const el=e.target.closest('[data-herald-action]');if(!el)return;
      if(el.dataset.heraldAction==='retry'){if(persist())toast('Saved on this device.');}
      else if(el.dataset.heraldAction==='backup')exportData();
      else if(el.dataset.heraldAction==='copy-script'){const v=vById(el.dataset.id);if(v)copyText(v.script||'','Script copied.');}
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty)persist();});
    window.addEventListener('beforeunload',e=>{if(dirty&&!persist()){e.preventDefault();e.returnValue='';}});
    window.HeraldImprovements=Object.freeze({persist,rename,matches,words,get pending(){return dirty;}});
    renderAll();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
