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
    const openings={
      vault:['Your next story','Script Vault','Write a script','Shape an idea, refine its packaging and keep every draft together.'],
      calendar:['Make room for your stories','Publishing calendar','See the calendar','Give each story a date and see the month take shape.'],
      cadence:['Find your rhythm','Weekly cadence','See this week','Keep your publishing and engagement rhythm in view.'],
      metrics:['Learn from what lands','Channel metrics','See the results','Review the numbers you’ve recorded and the stories behind them.']
    };
    function opening(){
      const kind=openings[cur]?cur:'vault',c=openings[kind];
      const scenes={
        vault:'<path d="M57 75 H244 V224 H57 Z" fill="#f1e4c9"/><path d="M57 111 H244 M80 75 L102 111 M129 75 L151 111 M178 75 L200 111 M80 140 H182 M80 165 H170 M80 190 H147"/><rect x="206" y="131" width="99" height="99" rx="22" fill="#2c3049"/><image href="shared/icons/the-herald-apple.png?v=8a1621338f3a" x="213" y="138" width="85" height="85"/>',
        calendar:'<path d="M52 76 H308 V225 H52 Z" fill="#f1e4c9"/><path d="M52 116 H308 M94 59 V92 M266 59 V92 M86 143 H116 V168 H86 Z M138 143 H168 V168 H138 Z M190 143 H220 V168 H190 Z M242 143 H272 V168 H242 Z"/><rect x="138" y="187" width="30" height="25" rx="5" fill="#b29dcd"/><rect x="190" y="187" width="30" height="25" rx="5" fill="#b29dcd"/>',
        cadence:'<path d="M44 75 H316 V224 H44 Z" fill="#f1e4c9"/><path d="M44 111 H316 M83 137 V200 M132 137 V200 M181 137 V200 M230 137 V200 M279 137 V200" stroke="#d0b78b"/><path d="M60 178 H93 L108 143 L124 196 L145 161 H173 L189 139 L207 199 L226 164 H300" stroke="#8e79a9" stroke-width="5"/>',
        metrics:'<path d="M55 59 H305 V218 H55 Z" fill="#f1e4c9"/><path d="M42 233 H318 M84 188 V157 H115 V188 M141 188 V132 H172 V188 M198 188 V110 H229 V188 M255 188 V88 H282 V188" fill="#b29dcd"/><path d="M84 128 L138 104 L191 114 L271 67 M254 67 H271 V84" stroke-width="5"/>'
      };
      return '<section class="herald-opening" data-opening="'+kind+'"><div class="herald-opening-rail">'+c[1]+'</div><div class="herald-opening-face"><h1>'+c[0]+'</h1><svg class="herald-title-art" viewBox="0 0 360 280" aria-hidden="true" focusable="false"><circle cx="180" cy="142" r="122" fill="#ffffff0c"/><g stroke="#977348" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none">'+scenes[kind]+'</g></svg><p>'+c[3]+'</p></div><div class="herald-opening-footer"><button class="btn" type="button" data-herald-action="open-view">'+c[2]+'</button></div></section>';
    }
    function decorateOpening(){
      const view=document.getElementById('view'),rail=document.querySelector('.rail-card');
      if(rail&&rail.previousElementSibling!==view)view.after(rail);
      if(!document.querySelector('.herald-opening'))view.insertAdjacentHTML?.('afterbegin',opening());
    }
    function decorate(){
      decorateOpening();
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
      if(el.dataset.heraldAction==='open-view'){const target=document.querySelector('#view .card'),bar=document.querySelector('.appbar');if(target){target.style.scrollMarginTop=((bar?.getBoundingClientRect().height||72)+16)+'px';target.scrollIntoView({block:'start',behavior:'instant'});if(cur==='vault')document.getElementById('nv-title')?.focus({preventScroll:true});}}
      else if(el.dataset.heraldAction==='retry'){if(persist())toast('Saved on this device.');}
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
