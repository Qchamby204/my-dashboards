/* Extend the original Hourglass in place. Existing records stay in hourglass:v1. */
(()=>{
  const source=document.currentScript?.src;
  function start(){
    if(document.documentElement.dataset.atlasApp!=='the-hourglass'||typeof S==='undefined'||window.HourglassImprovements)return;
    if(source){const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('hourglass-enhancements.css',source).href;document.head.appendChild(css);}
    const originalRender=render,originalWire=wire,originalWeeks=viewWeeks,originalSetup=viewSetup,originalToast=toast;
    const clone=value=>JSON.parse(JSON.stringify(value));
    let failed=false,visibleDay='',focusAfter=null;
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
      if(!box&&failed){box=document.createElement('div');box.id='hourglass-save-error';box.className='panel';box.setAttribute('role','alert');box.innerHTML='<p>Changes could not be saved on this device. Keep this page open and retry, or download a backup.</p><div class="hourglass-actions"><button type="button" class="btn line" data-hourglass-action="retry">Retry saving</button><button type="button" class="btn line" data-hourglass-action="backup">Download backup</button></div>';document.getElementById('app').prepend(box);}
      if(box)box.hidden=!failed;
    }
    save=function(){
      try{const raw=JSON.stringify(S);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)throw Error('Write not retained');failed=false;}
      catch{failed=true;}
      saveStatus();return !failed;
    };
    toast=function(message,label,action){originalToast(failed?'Changes are not saved. Retry saving or download a backup.':message,label,action);};
    function upcomingPanel(){
      const rows=upcoming();
      return '<section class="panel hourglass-upcoming" aria-labelledby="hourglass-upcoming-title"><div class="hourglass-section-heading"><h2 id="hourglass-upcoming-title">Coming up</h2><button type="button" class="btn line" data-hourglass-action="add">Add milestone</button></div>'+
        (rows.length?rows.map(({item,days})=>'<div class="hourglass-upcoming-row"><span aria-hidden="true">'+esc(item.emoji||'📌')+'</span><div><strong>'+esc(item.label||'Untitled milestone')+'</strong><p>'+esc(niceDate(new Date(item.date+'T00:00:00')))+'</p></div><span class="hourglass-until">'+(days===0?'Today':days===1?'Tomorrow':comma(days)+' days away')+'</span><button type="button" class="btn line" data-hourglass-action="edit" data-hourglass-id="'+esc(item.id)+'" aria-label="Edit '+esc(item.label||'milestone')+'">Edit</button></div>').join(''):
          '<p class="hourglass-empty">No upcoming milestones. Add a date you want to keep in view.</p>')+'</section>';
    }
    viewWeeks=function(){return upcomingPanel()+originalWeeks();};
    viewSetup=function(){return originalSetup().replace('Healthy until age','Planning horizon (age)').replace('Healthspan is the honest target, not lifespan. Ninety is optimistic and worth aiming at. The retirement age sets the runway that matters most.','The horizon is an assumption for this calendar. You can change it at any time.');};
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
      const blob=new Blob([JSON.stringify({tool:'hourglass',schemaVersion:1,exportedAt:new Date().toISOString(),state:S},null,2)],{type:'application/json'});
      const link=document.createElement('a'),url=URL.createObjectURL(blob);link.href=url;link.download='hourglass-'+localDate()+'.json';document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }
    document.addEventListener('click',event=>{
      const target=event.target.closest?.('[data-hourglass-action]');if(!target)return;
      const action=target.dataset.hourglassAction;
      if(action==='add')addMilestone();
      if(action==='edit')editMilestone(target.dataset.hourglassId);
      if(action==='retry'&&save())toast('Saved on this device.');
      if(action==='backup')backup();
    });
    document.addEventListener('visibilitychange',resume);
    window.addEventListener('pageshow',resume);
    window.addEventListener('pagehide',clearTicker);
    window.HourglassImprovements=Object.freeze({upcoming,calendarDay,updateRecord,removeRecord});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
