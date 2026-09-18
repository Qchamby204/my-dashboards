/* Atlas Activity Log: browser-local usage and meaningful-change telemetry for The Review. */
(()=>{
  'use strict';
  if(window.AtlasActivity)return;
  const KEY='atlas:activity:v1',VERSION=1,MAX_EVENTS=2500,MAX_AGE=120*86400000,SESSION_GAP=30*60000;
  const rawGet=Storage.prototype.getItem,rawSet=Storage.prototype.setItem,rawRemove=Storage.prototype.removeItem;
  const root=document.documentElement;
  const path=(location.pathname.split('/').pop()||'').toLowerCase();
  const PATHS={
    '':'atlas-hub','index.html':'atlas-hub','life-map.html':'life-map','life-ledger.html':'life-ledger',
    'workout-forge.html':'workout-forge','the-chef.html':'the-chef','baby-brain.html':'baby-brain',
    'the-hourglass.html':'the-hourglass','the-herald.html':'the-herald','prospecting-command-center.html':'prospecting-command-center',
    'operations-cadence.html':'operations-cadence','the-aqueduct.html':'the-aqueduct','courier.html':'courier',
    'communication-trainer.html':'communication-trainer','crucible.html':'crucible','neural-map.html':'neural-map',
    'chambers-wealth-hq.html':'chambers-wealth-hq','review.html':'review'
  };
  const LABELS={
    'atlas-hub':'Atlas','atlas-os':'Atlas Workspace',review:'The Review','life-map':'Life Map','life-ledger':'Life Ledger',
    'workout-forge':'The Forge','the-chef':'The Chef','baby-brain':'Baby Brain','the-hourglass':'The Hourglass',
    'the-herald':'The Herald','prospecting-command-center':'Prospecting Command Center','operations-cadence':'Operations Cadence',
    'the-aqueduct':'The Aqueduct',courier:'The Courier','communication-trainer':'Master Communicator',crucible:'The Crucible',
    'neural-map':'Neural Map','chambers-wealth-hq':'Chambers Wealth HQ'
  };
  const app=root.dataset.atlasApp||PATHS[path]||path.replace(/\.html$/,'')||'unknown';
  const label=id=>LABELS[id]||id;
  const uuid=()=>crypto.randomUUID?.()||`${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  let writing=false;
  function local(){try{return window.localStorage}catch{return null}}
  function session(){try{return window.sessionStorage}catch{return null}}
  function read(){
    const store=local();if(!store)return {version:VERSION,events:[]};
    try{const value=JSON.parse(rawGet.call(store,KEY)||'null');return {version:VERSION,events:Array.isArray(value?.events)?value.events:[]};}
    catch{return {version:VERSION,events:[]};}
  }
  function write(value){
    const store=local();if(!store)return false;
    const now=Date.now(),events=(value.events||[]).filter(e=>Number.isFinite(Date.parse(e.at))&&Date.parse(e.at)>=now-MAX_AGE).slice(-MAX_EVENTS);
    try{writing=true;rawSet.call(store,KEY,JSON.stringify({version:VERSION,events}));return true;}catch{return false;}finally{writing=false;}
  }
  function record({app:target=app,type,kind='usage',summary='',seconds=0,sourceApp=''}){
    if(!target||!type)return null;
    const event={id:uuid(),at:new Date().toISOString(),app:target,type,kind:kind==='meaningful'?'meaningful':'usage',summary:String(summary||'').slice(0,300),seconds:Number.isFinite(seconds)?Math.max(0,Math.round(seconds)):0,sourceApp};
    const value=read();value.events.push(event);write(value);window.dispatchEvent(new CustomEvent('atlas:activity',{detail:event}));return event;
  }
  function clear(){const store=local();if(!store)return;try{writing=true;rawRemove.call(store,KEY);}catch{}finally{writing=false;}}

  const sessionKey=`atlas:activity:session:${app}`;
  let current={id:uuid(),lastSeen:0,engaged:false,changed:false};
  const ss=session();
  if(ss){try{const saved=JSON.parse(rawGet.call(ss,sessionKey)||'null');if(saved&&Date.now()-Number(saved.lastSeen||0)<SESSION_GAP)current={...current,...saved};}catch{}}
  const isNew=!current.lastSeen||Date.now()-current.lastSeen>=SESSION_GAP;
  current.lastSeen=Date.now();
  function saveSession(){if(!ss)return;try{rawSet.call(ss,sessionKey,JSON.stringify(current));}catch{}}
  saveSession();
  if(isNew)record({type:'open',summary:`Opened ${label(app)}`});

  let visibleSince=document.hidden?null:Date.now();
  function closeSegment(){
    if(visibleSince===null)return;
    const seconds=Math.round((Date.now()-visibleSince)/1000);visibleSince=null;
    if(seconds>=5)record({type:'session',summary:`Used ${label(app)}`,seconds});
    current.lastSeen=Date.now();saveSession();
  }
  function engage(){
    if(current.engaged)return;current.engaged=true;current.lastSeen=Date.now();saveSession();
    record({type:'engaged',summary:`Interacted with ${label(app)}`});
  }
  document.addEventListener('pointerdown',engage,{capture:true,once:true});
  document.addEventListener('keydown',engage,{capture:true,once:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)closeSegment();else if(visibleSince===null)visibleSince=Date.now();});
  window.addEventListener('pagehide',closeSegment);

  function ignoredKey(key){return key===KEY||key==='atlas.appearance.v1'||/^atlas:activity:/.test(key)||/(?:appearance|theme|probe|schema-version)$/i.test(key||'');}
  function changed(){
    if(current.changed||app==='review'||app==='atlas-hub'||app==='life-map'&&window.LifeMapWorkflow?.semanticEvents)return;
    current.changed=true;current.lastSeen=Date.now();saveSession();
    record({type:'data_changed',kind:'meaningful',summary:`${label(app)} recorded a change`});
  }
  Storage.prototype.setItem=function(key,value){
    let localWrite=false;try{localWrite=this===window.localStorage;}catch{}
    const result=rawSet.call(this,key,value);
    if(localWrite&&!writing&&!ignoredKey(String(key)))queueMicrotask(changed);
    return result;
  };
  Storage.prototype.removeItem=function(key){
    let localWrite=false;try{localWrite=this===window.localStorage;}catch{}
    const result=rawRemove.call(this,key);
    if(localWrite&&!writing&&!ignoredKey(String(key)))queueMicrotask(changed);
    return result;
  };

  function target(href){
    let url;try{url=new URL(href,location.href);}catch{return null;}
    if(url.hostname==='atlas-os-quinton.qchambers123018.chatgpt.site'){
      return {app:url.pathname.startsWith('/apps/prospecting')?'prospecting-command-center':'atlas-os',url};
    }
    const file=url.pathname.split('/').pop()||'';return {app:PATHS[file]||null,url};
  }
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a.hub-card,a[data-atlas-app-link]');if(!link)return;
    const resolved=target(link.href),targetApp=link.dataset.atlasAppLink||resolved?.app;
    if(!targetApp||targetApp===app||!resolved||resolved.url.origin===location.origin)return;
    record({app:targetApp,type:'launch',summary:`Opened ${label(targetApp)} from ${label(app)}`,sourceApp:app});
  },true);

  window.AtlasActivity=Object.freeze({
    app,
    read,
    clear,
    log:(type,summary,kind='usage')=>record({type,summary,kind}),
    meaningful:(type,summary)=>record({type,summary,kind:'meaningful'}),
  });
})();
