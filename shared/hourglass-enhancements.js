/* Extend the original Hourglass in place. Existing records stay in hourglass:v1. */
(()=>{
  const source=document.currentScript?.src;
  function start(){
    if(document.documentElement.dataset.atlasApp!=='the-hourglass'||typeof S==='undefined'||window.HourglassImprovements)return;
    if(source){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('hourglass-enhancements.css?v=26caa58b8a04',source).href;document.head.appendChild(css);}
    const originalRender=render,originalWire=wire,originalWeeks=viewWeeks,originalSetup=viewSetup,originalReckon=viewReckon,originalClimb=viewClimb,originalOverview=hourglassOverview,originalToast=toast;
    const clone=value=>JSON.parse(JSON.stringify(value));
    let failed=!!hourglassRecord.error,visibleDay='',focusAfter=null;
    function localDate(now=new Date()){
      return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    }
    function calendarDay(value){
      if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;
      const date=new Date(value+'T00:00:00Z');
      return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date.getTime()/MS_DAY:null;
    }
    function upcoming(today=localDate()){
      const todayNumber=calendarDay(today);if(todayNumber===null)return [];
      return (S.milestones||[]).map((item,index)=>({item,index,days:calendarDay(item.date)===null?null:calendarDay(item.date)-todayNumber}))
        .filter(row=>row.days!==null&&row.days>=0).sort((a,b)=>a.days-b.days||a.index-b.index).slice(0,3);
    }
    function saveStatus(){
      let box=document.getElementById('hourglass-save-error');
      if(!box&&failed){box=document.createElement('div');box.id='hourglass-save-error';box.className='panel';box.setAttribute('role','alert');box.innerHTML='<p>Changes could not be saved on this device. Keep this page open and retry, or download a backup.</p><div class="hourglass-actions"><button type="button" class="btn line" data-hourglass-action="retry">Retry saving</button><button type="button" class="btn line" data-hourglass-action="backup">Download backup</button><button type="button" class="btn line" data-hourglass-action="restore">Restore backup</button><input type="file" accept="application/json" data-hourglass-restore hidden><button type="button" class="btn line" data-hourglass-action="reload">Reload saved record</button></div>';document.getElementById('app').prepend(box);}
      if(box){box.hidden=!failed;const message=box.querySelector('p');if(message)message.textContent=hourglassRecord.error||'Changes could not be saved. Keep this page open and retry, or download a backup.';}
    }
    save=function(){
      const ok=hourglassRecord.write(S);if(ok)S=hourglassRecord.value;failed=!ok;
      saveStatus();return ok;
    };
    toast=function(message,label,action){originalToast(failed?'Changes are not saved. Retry saving or download a backup.':message,label,action);};
    function openingArtwork(kind){
      const scenes={
        weeks:'<rect x="65" y="38" width="222" height="139" rx="13" fill="#ffffff09" stroke="#e6c38b" stroke-width="2"/><path d="M65 72h222M106 26v26M246 26v26" stroke="#e6c38b" stroke-width="3" stroke-linecap="round"/><g fill="#8eafaa"><rect x="89" y="91" width="21" height="18" rx="4"/><rect x="126" y="91" width="21" height="18" rx="4"/><rect x="163" y="91" width="21" height="18" rx="4"/></g><g fill="#c49a6b"><rect x="200" y="91" width="21" height="18" rx="4"/><rect x="237" y="91" width="21" height="18" rx="4"/></g><g fill="none" stroke="#b49aca" stroke-width="2"><rect x="89" y="129" width="21" height="18" rx="4"/><rect x="126" y="129" width="21" height="18" rx="4"/><rect x="163" y="129" width="21" height="18" rx="4"/><rect x="200" y="129" width="21" height="18" rx="4"/><rect x="237" y="129" width="21" height="18" rx="4"/></g>',
        reckon:'<path d="M116 33h120M116 181h120M126 33v26c0 30 35 35 50 52-15 17-50 22-50 52v18m100-148v26c0 30-35 35-50 52 15 17 50 22 50 52v18" fill="none" stroke="#e6c38b" stroke-width="3" stroke-linecap="round"/><path d="M140 59h72c-5 16-24 24-36 35-12-11-31-19-36-35zM140 166c5-15 24-24 36-35 12 11 31 20 36 35z" fill="#ca9f72"/><path d="M176 100v20" stroke="#e6c38b" stroke-width="2" stroke-dasharray="3 5"/><circle cx="257" cy="111" r="22" fill="none" stroke="#9ab4aa" stroke-width="2"/><path d="M257 98v14l9 5" fill="none" stroke="#9ab4aa" stroke-width="2"/>',
        climb:'<path d="m34 176 93-119 64 85 44-59 83 93z" fill="#84768d" opacity=".45"/><path d="m34 176 93-119 64 85m-85-56 21-29 24 32-23-9z" fill="none" stroke="#e6c38b" stroke-width="2"/><path d="M84 178c83-7 48-41 91-49s42-18 56-38" fill="none" stroke="#9ab4aa" stroke-width="4" stroke-linecap="round"/><path d="M235 83V37l36 12-36 12" fill="#b38986" stroke="#e6c38b" stroke-width="2"/><circle cx="284" cy="77" r="17" fill="#e6c38b" opacity=".3"/>',
        setup:'<rect x="87" y="40" width="178" height="139" rx="11" fill="#dfd0b4"/><path d="M120 40v139M137 72h102M137 111h70M137 150h85" stroke="#82705f" stroke-width="2"/><g fill="none" stroke="#82705f" stroke-width="2"><circle cx="108" cy="72" r="4"/><circle cx="108" cy="111" r="4"/><circle cx="108" cy="150" r="4"/></g><path d="m223 176 57-100 13 8-57 100-17 7z" fill="#9ab4aa" stroke="#e6c38b" stroke-width="2"/>'
      };
      return '<svg class="hourglass-title-art" viewBox="0 0 352 220" aria-hidden="true" focusable="false"><circle cx="305" cy="29" r="4" fill="#e6c38b" opacity=".4"/><path d="M25 199h302" stroke="#e6c38b" stroke-opacity=".23"/>'+scenes[kind]+'</svg>';
    }
    function opening(kind){
      const copy={weeks:['Your time in view','Make this chapter count','See your weeks, keep important dates in view, and make room for what matters.','View your weeks'],reckon:['A wider perspective','Time worth spending','Put your chosen horizon, milestones and shared years into perspective.','See the perspective'],climb:['Your next milestone','The climb ahead','Explore how your starting point, new assets and growth assumptions shape the path to your target.','Review your assumptions'],setup:['Make it yours','The dates that matter','Keep your birth date, planning horizon, milestones and bonds together.','Edit your dates']}[kind];
      return '<section class="hourglass-opening" data-opening="'+kind+'" aria-labelledby="hourglass-opening-title"><div class="hourglass-opening-rail">'+copy[0]+'</div><div class="hourglass-opening-face"><h1 id="hourglass-opening-title">'+copy[1]+'</h1>'+openingArtwork(kind)+'<p>'+copy[2]+'</p></div><div class="hourglass-opening-footer"><button type="button" class="btn" data-hourglass-jump="'+kind+'">'+copy[3]+'</button></div></section>';
    }
    hourglassOverview=function(){return opening('weeks')+originalOverview().replace('<h1 class="hg-title" id="hg-overview-title">Make this chapter count</h1>','<h2 class="hg-title" id="hg-overview-title">Your time overview</h2>');};
    viewReckon=function(){return opening('reckon')+'<div id="hourglass-reckon-content">'+originalReckon()+'</div>';};
    viewClimb=function(){return opening('climb')+'<div id="hourglass-climb-content">'+originalClimb()+'</div>';};
    function upcomingPanel(){
      const rows=upcoming();
      return '<section class="panel hourglass-upcoming" aria-labelledby="hourglass-upcoming-title"><div class="hourglass-section-heading"><h2 id="hourglass-upcoming-title">Coming up</h2><button type="button" class="btn line" data-hourglass-action="add">Add milestone</button></div>'+
        (rows.length?rows.map(({item,days})=>'<div class="hourglass-upcoming-row"><span aria-hidden="true">'+esc(item.emoji||'📌')+'</span><div><strong>'+esc(item.label||'Untitled milestone')+'</strong><p>'+esc(niceDate(new Date(item.date+'T00:00:00')))+'</p></div><span class="hourglass-until">'+(days===0?'Today':days===1?'Tomorrow':comma(days)+' days away')+'</span><button type="button" class="btn line" data-hourglass-action="edit" data-hourglass-id="'+esc(item.id)+'" aria-label="Edit '+esc(item.label||'milestone')+'">Edit</button><a class="btn line" href="life-map.html#capture='+encodeURIComponent('Plan time for '+(item.label||'this milestone')+' on '+item.date)+'">Plan something</a></div>').join(''):
          '<p class="hourglass-empty">No upcoming milestones. Add a date you want to keep in view.</p>')+'</section>';
    }
    viewWeeks=function(){return upcomingPanel()+'<div id="hourglass-weeks-content">'+originalWeeks()+'</div>';};
    viewSetup=function(){return opening('setup')+'<div id="hourglass-setup-content">'+originalSetup().replace('Healthy until age','Planning horizon (age)').replace('Healthspan is the honest target, not lifespan. Ninety is optimistic and worth aiming at. The retirement age sets the runway that matters most.','The horizon is an assumption for this calendar. You can change it at any time.')+'</div>';};
    function record(collection,id){return (S[collection]||[]).find(item=>item.id===id);}
    function updateRecord(collection,id,key,value){
      const item=record(collection,id),allowed=collection==='milestones'?['emoji','label','date']:collection==='companions'?['emoji','label','start','end']:[];
      if(!item||!allowed.includes(key))return false;
      if(['date','start','end'].includes(key)&&value&&calendarDay(value)===null)return false;
      if(collection==='companions'){
        const next={...item,[key]:value};if(next.start&&next.end&&calendarDay(next.end)<calendarDay(next.start))return false;
      }
      item[key]=value;save();return true;
    }
    function removeRecord(collection,id){
      if(!['milestones','companions'].includes(collection))return;
      const index=S[collection].findIndex(item=>item.id===id);if(index<0)return;
      const removed=clone(S[collection][index]);S[collection].splice(index,1);save();render();
      toast(collection==='milestones'?'Milestone removed':'Bond removed','Undo',()=>{
        if(record(collection,id)){toast('That record is already present.');return;}
        S[collection].splice(Math.min(index,S[collection].length),0,removed);save();render();
      });
    }
    function editMilestone(id){focusAfter=id;S.tab='setup';save();render();}
    function addMilestone(){const item={id:uid(),label:'',date:'',emoji:'📌'};S.milestones.push(item);editMilestone(item.id);}
    function decorateFields(){
      const app=document.getElementById('app');
      for(const el of app.querySelectorAll('[data-m],[data-c]')){
        const milestone=el.dataset.m!==undefined,collection=milestone?'milestones':'companions',id=milestone?el.dataset.m:el.dataset.c,key=el.dataset.k;
        const prefix=milestone?'Milestone':'Bond';
        el.setAttribute('aria-label',`${prefix} ${key==='label'?'name':key}`);
        if(el.type==='date'){
          el.onchange=()=>{
            el.setCustomValidity('');
            if(!updateRecord(collection,id,key,el.value)){el.setCustomValidity('Use a valid date. An end date must be on or after the start.');el.reportValidity();el.value=record(collection,id)?.[key]||'';el.setCustomValidity('');return;}
          };
        }else{
          // The original milestone handler wrote every text field into the name.
          el.oninput=()=>updateRecord(collection,id,key,el.value);
          el.onchange=()=>save();
        }
        if(milestone)el.parentElement.classList.add('hourglass-milestone-row');
        else if(key==='label'||key==='emoji')el.parentElement.classList.add('hourglass-bond-heading');
        else el.parentElement.parentElement.classList.add('hourglass-bond-dates');
      }
      for(const [attr,collection]of [['data-delm','milestones'],['data-delc','companions']]){
        for(const button of app.querySelectorAll('['+attr+']')){
          const id=button.getAttribute(attr);button.setAttribute('aria-label','Delete '+(record(collection,id)?.label||(collection==='milestones'?'milestone':'bond')));
          button.onclick=()=>removeRecord(collection,id);
        }
      }
      const add=document.getElementById('addMile');if(add)add.onclick=addMilestone;
      const horizon=app.querySelector('[data-s="healthyAge"]');if(horizon)horizon.setAttribute('aria-label','Planning horizon in years');
      for(const button of app.querySelectorAll('[data-tab]')){if(button.dataset.tab===(S.tab||'weeks'))button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');}
      if(focusAfter){const el=[...app.querySelectorAll('[data-m]')].find(el=>el.dataset.m===focusAfter&&el.dataset.k==='label');focusAfter=null;el?.scrollIntoView?.({block:'center'});el?.focus?.({preventScroll:true});}
    }
    wire=function(){originalWire();decorateFields();};
    render=function(){visibleDay=localDate();originalRender();saveStatus();};
    function tick(){
      const days=document.getElementById('tickDays'),clock=document.getElementById('tickClock');if(!days||!clock)return;
      const remaining=Math.max(0,deathDate().getTime()-Date.now()),wholeDays=Math.floor(remaining/MS_DAY),remainder=remaining-wholeDays*MS_DAY;
      days.textContent=comma(wholeDays);
      clock.textContent=[Math.floor(remainder/3600000),Math.floor(remainder%3600000/60000),Math.floor(remainder%60000/1000)].map(value=>String(value).padStart(2,'0')).join(':');
    }
    startTicker=function(){clearTicker();tick();if(!document.hidden)TICKER=setInterval(tick,1000);};
    function resume(){
      if(document.hidden){clearTicker();return;}
      if(visibleDay!==localDate()&&(S.tab||'weeks')!=='setup')render();
      else if(S.tab==='reckon')startTicker();
    }
    function backup(){
      const blob=new Blob([JSON.stringify({tool:'hourglass',schemaVersion:1,exportedAt:new Date().toISOString(),state:S,...(hourglassRecord.error?{recovery:hourglassRecord.recovery(),recoveryOnly:hourglassRecord.blocked}: {})},null,2)],{type:'application/json'});
      const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='hourglass-'+localDate()+(hourglassRecord.error?'-recovery':'')+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    document.addEventListener('click',event=>{
      const jump=event.target.closest?.('[data-hourglass-jump]');
      if(jump?.dataset.hourglassJump){const block=document.getElementById('hourglass-'+jump.dataset.hourglassJump+'-content');if(block){block.style.scrollMarginTop=((document.querySelector('.appbar')?.getBoundingClientRect().height||72)+16)+'px';block.scrollIntoView?.({block:'start'});block.querySelector('input')?.focus?.({preventScroll:true});}return;}
      const target=event.target.closest?.('[data-hourglass-action]');if(!target)return;
      const action=target.dataset.hourglassAction;
      if(action==='add')addMilestone();
      if(action==='edit')editMilestone(target.dataset.hourglassId);
      if(action==='retry'&&save())toast('Saved on this device.');
      if(action==='backup')backup();
      if(action==='restore')document.querySelector('[data-hourglass-restore]')?.click();
      if(action==='reload'&&confirm('Reload the latest saved record? Download this tab’s backup first if you need to keep its work.'))location.reload();
    });
    document.addEventListener('change',async event=>{
      const file=event.target.matches?.('[data-hourglass-restore]')&&event.target.files?.[0];if(!file)return;
      try{
        if(file.size>3000000)throw Error('Choose a backup smaller than 3 MB.');
        const pack=JSON.parse(await file.text());if(pack.tool!=='hourglass'||pack.schemaVersion!==1||pack.recoveryOnly)throw Error('Choose a valid Hourglass backup, not a recovery copy.');
        const next={...clone(DEF),...pack.state};if(!window.AtlasRecords.plain(pack.state))throw Error('Invalid Hourglass state.');
        if(!confirm('Replace the saved Hourglass record with this backup? Keep a recovery copy first.'))return;
        if(!hourglassRecord.write(next,{replace:true,restore:true}))throw Error(hourglassRecord.error);
        S=hourglassRecord.value;failed=false;render();toast('Backup restored on this device.');
      }catch(e){toast(e.message||'Backup could not be restored.');}finally{event.target.value='';}
    });
    window.addEventListener('storage',event=>{if(event.key===KEY&&hourglassRecord.changed(event.newValue)){failed=true;saveStatus();}});
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pageshow',resume);
    window.addEventListener('pagehide',clearTicker);
    window.HourglassImprovements=Object.freeze({upcoming,calendarDay,updateRecord,removeRecord});
    render();saveStatus();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
