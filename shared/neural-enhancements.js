/* Navigation for the original resource map. No new records, accounts or sync. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='neural-map')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('neural-enhancements.css',source).href;document.head.appendChild(css);
  function ready(){
    if(window.NeuralNavigation||typeof CATS==='undefined')return;
    const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const button=(text,action)=>{const n=make('button',text);n.type='button';n.addEventListener('click',action);return n;};
    const toolNodes=[...gNodes.querySelectorAll('.node.tool')],allNodes=[...gNodes.querySelectorAll('.node')];
    const tools=toolNodes.map(n=>n._tool),nodesById=new Map(toolNodes.map(n=>[n._tool.id,n]));
    const routes={'Prospecting Command Center':'prospecting-command-center.html','Operations Cadence':'operations-cadence.html'};
    const normal=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function findTools(query='',category=''){
      const words=normal(query).trim().split(/\s+/).filter(Boolean);
      return tools.filter(t=>(!category||t.cat.key===category)&&words.every(word=>normal([t.label,t.full,t.file,t.note,t.cat.title,t.sub].join(' ')).includes(word)));
    }
    function destinations(tool){
      const doors=[...(tool.doors||[])];
      if(routes[tool.full]&&!doors.some(d=>d.k==='live'))doors.unshift({k:'live',label:'Open dashboard',url:new URL(routes[tool.full],location.href).href});
      return doors.map(d=>{let url;try{url=new URL(d.url,location.href);}catch{return null;}return {...d,url:url.href,web:['https:','http:'].includes(url.protocol),local:url.protocol==='file:'};}).filter(Boolean);
    }
    let mode=window.matchMedia('(max-width:700px)').matches?'list':'map',returnFocus=null;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const hud=document.querySelector('header.hud'),stage=document.getElementById('stage'),legend=document.querySelector('.legend'),hint=document.querySelector('.hint');
    const toolbar=make('nav',null,'neural-toolbar');toolbar.setAttribute('aria-label','Neural Map views');
    const mapButton=button('Map',()=>setMode('map')),listButton=button('List & search',()=>setMode('list'));
    toolbar.append(mapButton,listButton);document.body.appendChild(toolbar);
    const list=make('main',null,'neural-list');list.id='neural-list';
    const filters=make('div',null,'neural-filters');
    const searchLabel=make('label','Find a tool');const search=make('input');search.type='search';search.placeholder='Name, purpose, or file';search.id='neural-search';searchLabel.appendChild(search);
    const branchLabel=make('label','Area');const branch=make('select');branch.id='neural-area';
    const option=make('option','All areas');option.value='';branch.appendChild(option);
    CATS.forEach(cat=>{const o=make('option',cat.title);o.value=cat.key;branch.appendChild(o);});branchLabel.appendChild(branch);
    const clear=button('Clear filters',()=>{search.value='';branch.value='';renderList();search.focus();});filters.append(searchLabel,branchLabel,clear);
    const count=make('p',null,'neural-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
    const cards=make('div',null,'neural-cards');list.append(filters,count,cards);document.body.appendChild(list);
    function linksFor(tool){
      const wrap=make('div',null,'neural-links');
      destinations(tool).forEach(d=>{
        if(d.web){const a=make('a',d.label||(d.k==='live'?'Open dashboard':d.k==='chat'?'Open chat':d.k==='drive'?'Open Drive':'Open resource'));a.href=d.url;a.target='_blank';a.rel='noopener noreferrer';wrap.appendChild(a);}
        else if(d.local){const note=make('p','Stored on your computer. This file cannot open from the web dashboard.','neural-local');const path=make('code');try{path.textContent=decodeURI(new URL(d.url).pathname);}catch{path.textContent=d.url;}note.appendChild(path);wrap.appendChild(note);}
      });
      if(tool.note&&!routes[tool.full])wrap.appendChild(make('p',tool.note,'neural-note'));
      if(!wrap.children.length)wrap.appendChild(make('p','No web link is available for this resource yet.','neural-note'));
      return wrap;
    }
    function renderList(){
      const found=findTools(search.value,branch.value);cards.replaceChildren();
      count.textContent=found.length+' of '+tools.length+' tools';clear.hidden=!search.value&&!branch.value;
      found.forEach(tool=>{
        const card=make('article',null,'neural-card');card.dataset.toolId=tool.id;
        card.append(make('p',[tool.cat.title,tool.sub].filter(Boolean).join(' · '),'neural-category'),make('h2',tool.full||tool.label),make('p',tool.file,'neural-description'),linksFor(tool));
        const show=button('Show on map',()=>{setMode('map');const node=nodesById.get(tool.id);focusTool(node);node.focus({preventScroll:true});});show.setAttribute('aria-label','Show '+(tool.full||tool.label)+' on map');card.appendChild(show);cards.appendChild(card);
      });
      if(!found.length)cards.appendChild(make('p','No matching tools. Try another word or clear the filters.','neural-empty'));
    }
    search.addEventListener('input',renderList);branch.addEventListener('change',renderList);
    function measure(){
      const top=Math.ceil(hud.getBoundingClientRect().bottom);root.style.setProperty('--neural-toolbar-top',top+'px');
      root.style.setProperty('--neural-content-top',Math.ceil(toolbar.getBoundingClientRect().bottom+8)+'px');
    }
    function available(){
      const top=Math.max(hud.getBoundingClientRect().bottom,toolbar.getBoundingClientRect().bottom)+16;
      const bottom=Math.max(top+60,Math.min(window.innerHeight-100,legend.getBoundingClientRect().top-44));
      const padding=getComputedStyle(hud),left=Math.max(16,parseFloat(padding.paddingLeft)||0),right=Math.max(16,parseFloat(padding.paddingRight)||0);
      return {x:left,y:top,w:Math.max(80,window.innerWidth-left-right),h:Math.max(60,bottom-top)};
    }
    fitTarget=function(){
      if(!BOUNDS)BOUNDS=computeBounds();const a=available(),bw=BOUNDS.x1-BOUNDS.x0,bh=BOUNDS.y1-BOUNDS.y0;
      const s=Math.min(a.w/bw,a.h/bh)*.98;return {s,x:a.x+a.w/2-(BOUNDS.x0+BOUNDS.x1)/2*s,y:a.y+a.h/2-(BOUNDS.y0+BOUNDS.y1)/2*s};
    };
    const originalAnimate=animateTo;
    animateTo=function(s,x,y){if(reduced.matches){stopAnim();scale=s;tx=x;ty=y;applyT();}else originalAnimate(s,x,y);};
    focusCat=function(cat){
      if(!cat?._pts?.length)return;const xs=cat._pts.map(p=>p[0]),ys=cat._pts.map(p=>p[1]),a=available();
      const x0=Math.min(...xs)-170,x1=Math.max(...xs)+170,y0=Math.min(...ys)-70,y1=Math.max(...ys)+70;
      const s=Math.min(a.w/(x1-x0),a.h/(y1-y0),1.7);animateTo(s,a.x+a.w/2-(x0+x1)/2*s,a.y+a.h/2-(y0+y1)/2*s);
    };
    function focusTool(node){
      const match=/translate\(([-\d.]+) ([-\d.]+)\)/.exec(node.getAttribute('transform'));if(!match)return;
      const a=available(),s=Math.min(1.3,a.w/360);animateTo(s,a.x+a.w/2-Number(match[1])*s,a.y+a.h/2-Number(match[2])*s);
      allNodes.forEach(n=>n.classList.toggle('neural-selected',n===node));
    }
    const minScale=()=>Math.min(.3,fitTarget().s*.75),clamp=s=>Math.max(minScale(),Math.min(3,s));
    zoomBy=function(f){stopAnim();const a=available(),mx=a.x+a.w/2,my=a.y+a.h/2,nx=(mx-tx)/scale,ny=(my-ty)/scale,s=clamp(scale*f);animateTo(s,mx-nx*s,my-ny*s);closePop();};
    ['zin','zout','zreset'].forEach((id,i)=>document.getElementById(id).setAttribute('aria-label',['Zoom in','Zoom out','Fit all tools'][i]));
    function setMode(next){
      mode=next;root.dataset.neuralView=mode;list.hidden=mode!=='list';stage.hidden=mode!=='map';legend.hidden=mode!=='map';hint.hidden=mode!=='map';
      hud.querySelector('.zoom').hidden=mode!=='map';mapButton.setAttribute('aria-pressed',String(mode==='map'));listButton.setAttribute('aria-pressed',String(mode==='list'));
      closePop();stopAnim();resetGesture();measure();if(mode==='map')fit();syncMotion();
    }
    pop.hidden=true;pop.setAttribute('role','dialog');pop.setAttribute('aria-label','Resource details');
    closePop=function(restore=false){pop.classList.remove('show');pop.hidden=true;if(restore&&returnFocus?.isConnected)returnFocus.focus({preventScroll:true});returnFocus=null;};
    openPop=function(node){
      const tool=node?._tool;if(!tool)return;returnFocus=node;pop.replaceChildren();
      const close=button('Close',()=>closePop(true));close.className='neural-close';
      pop.append(close,make('p',[tool.cat.title,tool.sub].filter(Boolean).join(' · '),'neural-category'),make('h3',tool.full||tool.label),make('p',tool.file,'neural-description'),linksFor(tool));
      pop.hidden=false;pop.classList.add('show');pop.style.left='';pop.style.top='';close.focus({preventScroll:true});
    };
    allNodes.forEach(node=>{
      node.setAttribute('tabindex','0');node.setAttribute('role','button');
      node.setAttribute('aria-label',node._tool?'Details for '+(node._tool.full||node._tool.label):node._hub?'Focus '+node._hub.title:'Fit all tools');
    });
    gNodes.addEventListener('keydown',e=>{if(!['Enter',' '].includes(e.key)||e.repeat)return;const node=e.target.closest('.node');if(!node)return;e.preventDefault();if(node._tool)openPop(node);else if(node._hub){closePop();focusCat(node._hub);}else{closePop();animateFit();}});
    window.addEventListener('keydown',e=>{
      if(e.key==='Escape'&&!pop.hidden){e.preventDefault();e.stopImmediatePropagation();closePop(true);}
      else if(e.key==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.target.closest('input,textarea,select,[contenteditable="true"],dialog')){e.preventDefault();setMode('list');search.focus();}
    },true);
    // One gesture controller replaces the overlapping legacy pan and pinch listeners.
    const points=new Map();let base=null,dragged=false,suppressUntil=0,lastBlankTap=null;
    function rebase(){const p=[...points.values()];if(!p.length){base=null;return;}const a=p[0],b=p[1]||a;base={mx:(a.x+b.x)/2,my:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y),s:scale,x:tx,y:ty};}
    function release(id){try{if(graph.hasPointerCapture(id))graph.releasePointerCapture(id);}catch{/* A canceled pointer may already have released capture. */}}
    function resetGesture(){for(const id of points.keys())release(id);points.clear();base=null;dragged=false;lastBlankTap=null;graph.classList.remove('grabbing');}
    function down(e){
      e.stopImmediatePropagation();if(e.button!==undefined&&e.button!==0)return;
      stopAnim();if(!points.size){dragged=false;suppressUntil=0;}
      points.set(e.pointerId,{x:e.clientX,y:e.clientY,node:e.target.closest('.node')});
      if(points.size>1){dragged=true;lastBlankTap=null;}rebase();
    }
    function move(e){
      e.stopImmediatePropagation();if(!points.has(e.pointerId)||!base)return;
      const previous=points.get(e.pointerId);points.set(e.pointerId,{...previous,x:e.clientX,y:e.clientY});
      const p=[...points.values()],a=p[0],b=p[1]||a,mx=(a.x+b.x)/2,my=(a.y+b.y)/2;
      if(p.length===1&&!dragged&&Math.hypot(mx-base.mx,my-base.my)<6)return;
      dragged=true;lastBlankTap=null;closePop();graph.classList.add('grabbing');
      for(const id of points.keys())try{graph.setPointerCapture(id);}catch{/* Some synthetic pointers cannot be captured. */}
      const s=p.length>1&&base.d>0?clamp(base.s*Math.hypot(a.x-b.x,a.y-b.y)/base.d):base.s;
      tx=mx-(base.mx-base.x)/base.s*s;ty=my-(base.my-base.y)/base.s*s;scale=s;applyT();
    }
    function up(e,canceled=false){
      e.stopImmediatePropagation();const start=points.get(e.pointerId);if(!start)return;
      points.delete(e.pointerId);release(e.pointerId);
      if(dragged||canceled){suppressUntil=performance.now()+450;lastBlankTap=null;}
      else if(!start.node){
        closePop();const now=performance.now();
        if(lastBlankTap&&now-lastBlankTap.time<330&&Math.hypot(e.clientX-lastBlankTap.x,e.clientY-lastBlankTap.y)<30){
          const nx=(e.clientX-tx)/scale,ny=(e.clientY-ty)/scale,s=clamp(scale*1.8);animateTo(s,e.clientX-nx*s,e.clientY-ny*s);lastBlankTap=null;
        }else lastBlankTap={time:now,x:e.clientX,y:e.clientY};
      }else lastBlankTap=null;
      rebase();if(!points.size)graph.classList.remove('grabbing');
    }
    graph.addEventListener('pointerdown',down,true);graph.addEventListener('pointermove',move,true);graph.addEventListener('pointerup',e=>up(e),true);graph.addEventListener('pointercancel',e=>up(e,true),true);
    graph.addEventListener('lostpointercapture',e=>{if(points.has(e.pointerId))up(e,true);},true);
    graph.addEventListener('click',e=>{if(performance.now()<suppressUntil){e.preventDefault();e.stopImmediatePropagation();}},true);
    graph.addEventListener('wheel',e=>{
      e.preventDefault();e.stopImmediatePropagation();if(!e.deltaY)return;stopAnim();closePop();
      const nx=(e.clientX-tx)/scale,ny=(e.clientY-ty)/scale,f=e.ctrlKey?1.045:1.12,s=clamp(scale*(e.deltaY<0?f:1/f));scale=s;tx=e.clientX-nx*s;ty=e.clientY-ny*s;applyT();
    },{capture:true,passive:false});
    let pulseFrame=null;
    tick=function(now){
      if(pulseFrame!==null)cancelAnimationFrame(pulseFrame);pulseFrame=null;
      const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
      if(document.hidden||reduced.matches||mode!=='map')return;
      for(const e of edges){e.phase=(e.phase+dt*.26)%1;const t=e.phase,u=1-t;e.pl.setAttribute('cx',(u*u*e.x1+2*u*t*e.qx+t*t*e.x2).toFixed(2));e.pl.setAttribute('cy',(u*u*e.y1+2*u*t*e.qy+t*t*e.y2).toFixed(2));e.pl.setAttribute('opacity',Math.sin(t*Math.PI).toFixed(3));}
      pulseFrame=requestAnimationFrame(tick);
    };
    function syncMotion(){
      if(pulseFrame!==null)cancelAnimationFrame(pulseFrame);pulseFrame=null;last=performance.now();
      const active=!document.hidden&&!reduced.matches&&mode==='map';gPulses.style.display=active?'':'none';
      if(active)pulseFrame=requestAnimationFrame(tick);
    }
    document.addEventListener('visibilitychange',()=>{if(document.hidden){resetGesture();stopAnim();closePop();}syncMotion();});
    window.addEventListener('pagehide',()=>{resetGesture();stopAnim();if(pulseFrame!==null)cancelAnimationFrame(pulseFrame);pulseFrame=null;});
    window.addEventListener('pageshow',syncMotion);
    reduced.addEventListener('change',()=>{stopAnim();syncMotion();});
    let oldSize={w:window.innerWidth,h:window.innerHeight};
    function resize(){
      measure();const w=window.innerWidth,h=window.innerHeight;
      if(w!==oldSize.w||h!==oldSize.h){resetGesture();stopAnim();if(mode==='map'){closePop();fit();}oldSize={w,h};}
    }
    window.addEventListener('resize',resize);window.visualViewport?.addEventListener('resize',measure);
    if(window.ResizeObserver){const observer=new ResizeObserver(measure);observer.observe(hud);observer.observe(toolbar);}
    css.addEventListener('load',()=>{measure();if(mode==='map')fit();});
    hint.textContent='Tap a branch to focus · drag or pinch to explore · use List & search to find a tool';
    renderList();setMode(mode);
    window.NeuralNavigation=Object.freeze({findTools,destinations,setMode,get mode(){return mode;}});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
