/* Topic navigation and device-local notes for the original Baby Brain. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='baby-brain')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('baby-enhancements.css',source).href;document.head.appendChild(css);
  function ready(){
    if(window.BabyNavigation||typeof ALL==='undefined')return;
    const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
    const button=(text,fn)=>{const b=make('button',text,'baby-button');b.type='button';b.addEventListener('click',fn);return b;};
    const clone=v=>JSON.parse(JSON.stringify(v));
    const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
    const cleanText=v=>{const e=make('div');e.innerHTML=String(v||'');return e.textContent||'';};
    const normalize=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const known=new Map(ALL.map(n=>[n.id,n]));
    const states=['empty','learning','solid'];
    function safeURL(value){
      const text=String(value||'').trim();if(!text||/[\u0000-\u0020]/.test(text))return null;
      if(/^[a-z][a-z0-9+.-]*:/i.test(text)&&!/^https?:\/\//i.test(text))return null;
      try{const u=new URL(/^https?:\/\//i.test(text)?text:'https://'+text);return ['http:','https:'].includes(u.protocol)&&u.hostname&&!u.username&&!u.password?u.href:null;}catch{return null;}
    }
    function validate(data){
      if(!plain(data))throw Error('Expected a notes record.');
      function keys(v){if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))throw Error('Unsafe record key.');keys(v[k]);}}keys(data);
      for(const [id,o]of Object.entries(data)){
        if(!id||!plain(o)||o.n!==undefined&&typeof o.n!=='string'||o.s!==undefined&&!states.includes(o.s)||o.d!==undefined&&(!Array.isArray(o.d)||o.d.some(i=>!Number.isInteger(i)||i<0))||o.lk!==undefined&&(!Array.isArray(o.lk)||o.lk.some(l=>!plain(l)||typeof l.u!=='string'||l.t!==undefined&&typeof l.t!=='string')))throw Error('Invalid topic record.');
      }
      return clone(data);
    }
    let blocked=false,dirty=false,raw=window.AtlasBabyBoot?.raw??null,activeNode=null,returnFocus=null;
    try{if(window.AtlasBabyBoot?.readError)throw Error();validate(raw===null?STATE:JSON.parse(raw));}catch{blocked=true;STATE={};}
    let mode=window.matchMedia('(max-width:700px)').matches?'list':'map';
    const hud=document.querySelector('header.hud'),stage=$('stage'),toolbar=make('nav',null,'baby-toolbar');toolbar.setAttribute('aria-label','Baby Brain views');
    const listButton=button('Topics',()=>setMode('list')),mapButton=button('Map',()=>setMode('map'));
    toolbar.append(listButton,mapButton);document.body.appendChild(toolbar);
    const list=make('main',null,'baby-list');list.id='baby-list';
    const filters=make('div',null,'baby-filters');
    function field(title,tag,id){const label=make('label',title),e=make(tag);e.id=id;label.append(e);filters.append(label);return e;}
    const search=field('Find a topic','input','baby-find');search.type='search';search.placeholder='Topic, question, or your notes';
    const area=field('Area','select','baby-area'),age=field('Stage','select','baby-stage'),saved=field('Show','select','baby-saved');
    function option(select,title,value){const o=make('option',title);o.value=value;select.append(o);}
    option(area,'All areas','');HUBS.forEach(n=>option(area,n.l,n.id));
    option(age,'All stages','');[...new Set(LEAVES.map(n=>n.s).filter(s=>s&&s!=='all'))].forEach(s=>option(age,s,s));
    option(saved,'All topics','');option(saved,'With my notes or links','notes');
    const clear=button('Clear filters',()=>{search.value=area.value=age.value=saved.value='';renderList();search.focus();});filters.append(clear);
    const count=make('p',null,'baby-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
    const cards=make('div',null,'baby-cards');list.append(filters,count,cards);document.body.append(list);
    const notice=make('div',null,'baby-save-notice');notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
    const noticeText=make('p');notice.append(noticeText,button('Retry saving',()=>{if(blocked){toast('Back up the unreadable record, then restore a valid notes file.');return;}save();}),button('Back up notes',()=>exportNotes()));document.body.append(notice);
    const body=$('shBody');sheet.setAttribute('aria-labelledby','shTitle');sheet.inert=true;sheet.setAttribute('aria-hidden','true');
    function hasNotes(n){const o=STATE[n.id];return !!(o&&(o.n?.trim()||o.lk?.length));}
    const catalog=new Map(ALL.map(n=>[n.id,normalize([n.l,n.pathLabels.join(' '),cleanText(n.w),(n.q||[]).map(cleanText).join(' '),(n.r||[]).map(s=>s[0]+' '+cleanText(s[1])).join(' ')].join(' '))]));
    function findTopics(query='',hub='',stageFilter='',onlyNotes=false,includeBranches=false){
      const words=normalize(query).trim().split(/\s+/).filter(Boolean);
      return (includeBranches?ALL.filter(n=>n.depth>0):LEAVES).filter(n=>(!hub||n.id.startsWith(hub+'/')||n.id===hub)&&(!stageFilter||n.s===stageFilter||n.s==='all')&&(!onlyNotes||hasNotes(n))&&words.every(w=>(catalog.get(n.id)+' '+normalize(STATE[n.id]?.n||'')).includes(w))).sort((a,b)=>{
        const q=normalize(query).trim(),score=n=>q?(normalize(n.l)===q?3:normalize(n.l).startsWith(q)?2:normalize(n.l).includes(q)?1:0):0;
        return score(b)-score(a)||a.l.localeCompare(b.l);
      });
    }
    function renderList(){
      const found=findTopics(search.value,area.value,age.value,saved.value==='notes');cards.replaceChildren();
      count.textContent=found.length+' topics';clear.hidden=!search.value&&!area.value&&!age.value&&!saved.value;
      found.forEach(n=>{const b=button('',()=>openTopic(n,b));b.className='baby-topic';b.dataset.topicId=n.id;
        b.append(make('span',n.pathLabels.slice(0,-1).join(' / '),'baby-path'),make('strong',n.l),make('span',[n.s==='all'?'Every stage':n.s,hasNotes(n)?'Notes saved':''].filter(Boolean).join(' · '),'baby-meta'));cards.append(b);});
      if(!found.length)cards.append(make('p','No matching topics. Try another word or clear the filters.','baby-empty'));
    }
    [search,area,age,saved].forEach(e=>e.addEventListener(e===search?'input':'change',renderList));
    function measure(){root.style.setProperty('--baby-toolbar-top',Math.ceil(hud.getBoundingClientRect().bottom)+'px');root.style.setProperty('--baby-content-top',Math.ceil(toolbar.getBoundingClientRect().bottom+8)+'px');}
    function paintSave(){
      notice.hidden=!blocked&&!dirty;noticeText.textContent=blocked?'Saved notes could not be read. Back up the original record before restoring a valid file.':"Changes are in this tab, but could not be saved. Retry or back up your notes before closing.";
      const s=$('baby-note-status');if(s)s.textContent=blocked?'Editing paused to protect saved notes.':dirty?'Not saved on this device.':'Saved on this device';
      const notes=$('notes');if(notes)notes.disabled=blocked;
    }
    save=function(){
      if(blocked){paintSave();return false;}
      try{const json=JSON.stringify(STATE);localStorage.setItem(SKEY,json);if(localStorage.getItem(SKEY)!==json)throw Error();dirty=false;}
      catch{dirty=true;}paintSave();return !dirty;
    };
    function setMode(next){
      if(!['list','map'].includes(next))return;mode=next;root.dataset.babyView=mode;list.hidden=mode!=='list';stage.hidden=mode!=='map';
      ['legend','hint','prog'].forEach(id=>$(id).hidden=mode!=='map');document.querySelector('.zfab').hidden=mode!=='map';
      ['btnExpand','btnReset'].forEach(id=>$(id).hidden=mode!=='map');listButton.setAttribute('aria-pressed',String(mode==='list'));mapButton.setAttribute('aria-pressed',String(mode==='map'));
      closeSheet(false);searchUI.classList.remove('show');measure();if(mode==='map')animateFit();else renderList();
    }
    const originalOpen=openSheet,originalClose=closeSheet;
    openSheet=function(node){
      window.TTS?.stop();activeNode=node;originalOpen(node);sheet.inert=false;sheet.setAttribute('aria-hidden','false');body.scrollTop=0;measure();
      if(blocked){body.querySelectorAll('input,textarea,button,[role="checkbox"],[role="button"]').forEach(e=>{if(!e.classList.contains('baby-jump')){e.disabled=true;e.setAttribute('aria-disabled','true');}});}
      paintSave();$('shClose').focus({preventScroll:true});
    };
    closeSheet=function(refit){const was=sheet.classList.contains('show'),topicId=returnFocus?.dataset?.topicId;originalClose(refit);sheet.inert=true;sheet.setAttribute('aria-hidden','true');activeNode=null;if(was){renderList();const target=topicId?[...cards.querySelectorAll('.baby-topic')].find(b=>b.dataset.topicId===topicId):returnFocus;if(target?.isConnected)target.focus({preventScroll:true});else if(mode==='list')search.focus({preventScroll:true});}returnFocus=null;};
    function openTopic(node,trigger){returnFocus=trigger||document.activeElement;if(mode==='list'){setCrumb(node);openSheet(node);}else goTo(node);}
    function refresh(node){paintNode(node);refreshProgress();paintSave();}
    wireSheet=function(node){
      const o=st(node),notes=$('notes'),questions=$('qlist');
      const jumps=make('nav',null,'baby-jumps');jumps.setAttribute('aria-label','Topic sections');
      const read=button('Read',()=>body.scrollTo({top:0,behavior:'auto'}));read.classList.add('baby-jump');jumps.append(read);
      [['Notes','notes'],['Resources','links']].forEach(([name,id])=>{const target=$(id);if(target){const b=button(name,()=>{target.scrollIntoView({block:'start',behavior:'auto'});if(id==='notes')target.focus({preventScroll:true});});b.classList.add('baby-jump');jumps.append(b);}});body.prepend(jumps);
      if(notes){notes.setAttribute('aria-label','Our notes and research');notes.disabled=blocked;const s=make('p',null,'baby-note-status');s.id='baby-note-status';s.setAttribute('role','status');notes.after(s);
        notes.addEventListener('input',()=>{if(blocked)return;o.n=notes.value;if(o.n.trim()&&o.s==='empty')o.s='learning';save();markStates(node);refresh(node);});}
      function keyboard(e){if(['Enter',' '].includes(e.key)&&!e.repeat&&e.target.matches('[role="checkbox"],[role="button"]')){e.preventDefault();e.stopPropagation();e.target.click();}}
      if(questions){questions.querySelectorAll('li').forEach(li=>{li.setAttribute('role','checkbox');li.tabIndex=0;li.setAttribute('aria-checked',String(o.d.includes(+li.dataset.i)));});questions.addEventListener('keydown',keyboard);
        questions.addEventListener('click',e=>{const li=e.target.closest('li');if(!li||blocked)return;const i=+li.dataset.i;if(o.d.includes(i))o.d=o.d.filter(x=>x!==i);else o.d.push(i);li.classList.toggle('done',o.d.includes(i));li.setAttribute('aria-checked',String(o.d.includes(i)));if(o.d.length&&o.s==='empty')o.s='learning';save();markStates(node);refresh(node);});}
      const status=$('states');if(status){status.addEventListener('keydown',keyboard);status.querySelectorAll('.st').forEach(b=>{b.setAttribute('role','button');b.tabIndex=0;b.setAttribute('aria-pressed',String(nodeStatus(node)===b.dataset.v));});status.addEventListener('click',e=>{const b=e.target.closest('.st');if(!b||blocked)return;o.s=b.dataset.v;save();markStates(node);status.querySelectorAll('.st').forEach(x=>x.setAttribute('aria-pressed',String(nodeStatus(node)===x.dataset.v)));refresh(node);});}
      const add=$('lkAdd');if(add){$('lkTitle').setAttribute('aria-label','Resource label');$('lkUrl').setAttribute('aria-label','Resource web address');$('lkUrl').inputMode='url';
        add.addEventListener('click',()=>{if(blocked)return;const u=safeURL($('lkUrl').value);if(!u){toast('Enter a valid http or https web address.');return;}if(o.lk.some(l=>safeURL(l.u)===u)){toast('That link is already saved.');return;}o.lk.push({t:$('lkTitle').value.trim()||new URL(u).hostname,u});if(o.s==='empty')o.s='learning';save();openSheet(node);refresh(node);});}
      const links=$('links');if(links){links.querySelectorAll('a').forEach(a=>{const u=safeURL(a.getAttribute('href'));a.rel='noopener noreferrer';if(u)a.href=u;else{a.removeAttribute('href');a.setAttribute('aria-disabled','true');}
          const old=a.querySelector('.rm');if(old){const i=+old.dataset.i;old.remove();const wrap=make('div',null,'baby-resource');a.replaceWith(wrap);wrap.append(a,button('Remove',()=>{if(blocked)return;o.lk.splice(i,1);save();openSheet(node);refresh(node);}));}});}
      const kids=$('kids');if(kids){kids.querySelectorAll('.kid').forEach(k=>{k.setAttribute('role','button');k.tabIndex=0;});kids.addEventListener('keydown',keyboard);kids.addEventListener('click',e=>{const k=e.target.closest('.kid'),n=known.get(k?.dataset.id);if(n)openTopic(n);});}
    };
    renderSearch=function(q){const found=findTopics(q,'','',false,true);searchRes.replaceChildren();
      const visible=found.slice(0,60);searchRes.append(make('p',found.length>60?'Showing 60 of '+found.length+' matches. Add another word to narrow the results.':found.length+' matching topics','baby-count'));
      visible.forEach(n=>{const b=button('',()=>{searchUI.classList.remove('show');openTopic(n,$('btnSearch'));});b.className='baby-topic';b.append(make('strong',n.l),make('span',n.pathLabels.slice(0,-1).join(' / '),'baby-path'));searchRes.append(b);});
      if(!found.length)searchRes.append(make('p','No matching topics. Try another word.','baby-empty'));
    };
    $('btnSearch').onclick=()=>{if(mode==='list'){search.focus();return;}searchUI.classList.add('show');searchIn.value='';renderSearch('');searchIn.focus();};
    $('searchClose').onclick=()=>{searchUI.classList.remove('show');$('btnSearch').focus();};
    function download(text,name){const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
    exportNotes=function(){download(blocked&&raw!==null?raw:JSON.stringify({v:1,saved:new Date().toISOString(),data:STATE},null,2),blocked?'baby-brain-original-record.json':'baby-brain-notes.json');toast('Notes file prepared. Save it in Files or Downloads.');};
    let importToken=0;
    async function restoreFile(file){
      const token=++importToken;
      try{if(file.size>5*1024*1024)throw Error('Choose a notes file smaller than 5 MB.');const parsed=JSON.parse(await file.text());if(token!==importToken)return;
        const envelope=plain(parsed)&&Object.hasOwn(parsed,'data');if(envelope&&parsed.v!==1)throw Error('This backup version is not supported.');
        const next=validate(envelope?parsed.data:parsed),ids=Object.keys(next);if(!ids.length||!ids.some(id=>known.has(id)))throw Error('No matching Baby Brain notes were found.');
        const conflicts=ids.filter(id=>STATE[id]&&JSON.stringify(STATE[id])!==JSON.stringify(next[id])).length;
        document.getElementById('baby-restore')?.remove();const dialog=make('dialog',null,'baby-restore');dialog.id='baby-restore';dialog.setAttribute('aria-labelledby','baby-restore-title');const heading=make('h2','Restore notes');heading.id='baby-restore-title';
        const message=blocked?'Saved notes are unreadable. Restore will replace that record. Back up the original first.':ids.length+' topics will be imported. '+conflicts+' existing topic records differ. Other topics stay as they are.';
        const close=()=>{dialog.close();dialog.remove();};dialog.append(heading,make('p',message),button('Back up current notes',()=>exportNotes()));
        if(!blocked&&conflicts)dialog.append(button('Keep existing notes',()=>apply(false)));
        dialog.append(button(blocked?'Replace with backup':conflicts?'Use backup for matching topics':'Restore notes',()=>apply(true)),button('Cancel',close));document.body.append(dialog);dialog.showModal();
        function apply(overwrite){if(token!==importToken)return;const merged=blocked?{}:clone(STATE);for(const id of ids)if(overwrite||!Object.hasOwn(merged,id))merged[id]=next[id];STATE=merged;blocked=false;raw=null;const ok=save();closeSheet(false);render();renderList();close();toast(ok?'Notes restored on this device.':'Restored in this tab. Back up your notes or retry saving.');}
      }catch(e){toast(e instanceof SyntaxError?'Could not read that JSON file.':e.message||'Could not restore that file.');}
    }
    importNotes=function(){const input=make('input');input.type='file';input.accept='.json,application/json';input.addEventListener('change',()=>{if(input.files?.[0])restoreFile(input.files[0]);});input.click();};window.babyBrainImport=importNotes;
    showGuide=function(){window.TTS?.stop();$('rdBtn').classList.remove('on');activeNode=null;$('shPath').textContent='Baby Brain';$('shTitle').textContent='Find what you need';body.replaceChildren();
      [['Topics and Map','Topics gives you a searchable list. Choose an area or stage, or show topics with your notes and links. Map keeps the original branches available.'],['Reading and notes','Open a topic and use Read, Notes, or Resources to jump within it. Writing notes is optional. The reference material is already available to read.'],['Saving','Notes save in this browser on this device. They do not sync automatically. Use Back up our notes to keep a copy, and Restore from backup to bring that file to another device.']].forEach(([title,text])=>{const sec=make('section',null,'sec');sec.append(make('h4',title),make('p',text,'why'));body.append(sec);});sheet.classList.add('show');sheet.inert=false;sheet.setAttribute('aria-hidden','false');$('shClose').focus();};
    const oldRender=render;render=function(){oldRender();gNodes.querySelectorAll('.node').forEach(g=>{g.setAttribute('role','button');g.tabIndex=0;g.setAttribute('aria-label',known.get(g.dataset.id)?.l||'Topic');});};
    gNodes.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||e.repeat)return;const g=e.target.closest('.node');if(!g)return;e.preventDefault();const n=known.get(g.dataset.id);if(n){if(n.depth===0)collapseAll();else openTopic(n,g);}});
    window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&!$('vPanel')?.classList.contains('show')){e.preventDefault();e.stopImmediatePropagation();if(searchUI.classList.contains('show')){searchUI.classList.remove('show');$('btnSearch').focus();}else closeSheet(false);}},true);
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&dirty&&!blocked)save();});window.addEventListener('pagehide',()=>{if(dirty&&!blocked)save();});window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)'),originalAnimate=animateTo;
    animateTo=function(s,x,y){if(reduced.matches){stopAnim();scale=s;px=x;py=y;applyT();}else originalAnimate(s,x,y);};
    const originalInsets=insets;
    insets=function(ignoreSheet){return {...originalInsets(ignoreSheet),top:Math.max(hud.getBoundingClientRect().bottom,toolbar.getBoundingClientRect().bottom)+16};};
    ensureVisible=function(node){if(!node)return;const top=toolbar.getBoundingClientRect().bottom+16,bottom=Math.max(top+60,sheet.classList.contains('show')?sheet.getBoundingClientRect().top-18:innerHeight-60),p=node.parent||node;animateTo(scale,innerWidth/2-(node.tx*.68+p.tx*.32)*scale,(top+bottom)/2-(node.ty*.68+p.ty*.32)*scale);};
    refreshProgress=function(){const n=LEAVES.filter(hasNotes).length;$('progFill').style.width=(100*n/Math.max(1,LEAVES.length)).toFixed(1)+'%';$('progTxt').textContent=n+' topics with notes or links';};
    // The legacy speech shortcut must not also run when a focused control uses Space.
    body.addEventListener('keydown',e=>{if(e.key===' '&&e.target.closest('button,[role="button"],[role="checkbox"]'))e.stopPropagation();});
    window.addEventListener('resize',measure);window.visualViewport?.addEventListener('resize',measure);if(window.ResizeObserver)new ResizeObserver(measure).observe(hud);
    ['zin','zout'].forEach((id,i)=>$(id).setAttribute('aria-label',i?'Zoom out':'Zoom in'));
    window.BabyNavigation=Object.freeze({findTopics,setMode,openTopic,safeURL,validate,restoreFile,get mode(){return mode;},get blocked(){return blocked;},get dirty(){return dirty;}});
    render();setMode(mode);paintSave();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
