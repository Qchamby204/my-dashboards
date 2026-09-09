/* Reliability for the original Prospecting Command Center and its existing hq_v1 state. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='prospecting-command-center')return;
  const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('prospecting-enhancements.css?v=linkedin-20260909',source).href;document.head.appendChild(css);
  function ready(){
    if(window.ProspectingImprovements||typeof S==='undefined')return;
    const stages=['pool','messaged','replied','meeting','won','lost','parked'],closed=new Set(['won','lost','parked']);
    const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
    const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
    const safeKey=k=>typeof k==='string'&&/^[\w-]{1,100}$/.test(k)&&!['__proto__','prototype','constructor'].includes(k);
    const originalContacts=CONTACTS.map(c=>({...c}));let appliedLinkedIn,linkedInFilter='';
    function profileURL(value){
      try{const u=new URL(value),slug=decodeURIComponent(u.pathname.replace(/\/+$/,'').split('/')[2]||'').toLowerCase();
        if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port||!/(^|\.)linkedin\.com$/.test(u.hostname)||!/^\/in\/[^/]+\/*$/i.test(u.pathname)||!slug||/[\s/\\?#]/.test(slug))return '';
        return 'https://www.linkedin.com/in/'+encodeURIComponent(slug);
      }catch{return '';}
    }
    function validateLinkedIn(input){
      if(!plain(input)||input.app!=='chambers-hq-linkedin'||input.version!==1||!day(input.exportedOn)||!Array.isArray(input.contacts)||!input.contacts.length||input.contacts.length>20000)throw Error('Choose a prepared LinkedIn prospecting update.');
      if(Object.keys(input).some(k=>!['app','version','exportedOn','contacts'].includes(k)))throw Error('Unexpected LinkedIn update fields.');
      const urls=new Set(),uids=new Set(),fields=['uid','url','name','first','title','co','email','connectedOn','inboundCount','outboundCount','lastInboundAt','lastOutboundAt'];
      const contacts=input.contacts.map(c=>{
        if(!plain(c)||Object.keys(c).some(k=>!fields.includes(k))||!/^li-[a-f0-9]{24}$/.test(c.uid))throw Error('Invalid LinkedIn contact.');
        const url=profileURL(c.url);if(!url||urls.has(url)||uids.has(c.uid))throw Error('Duplicate or invalid LinkedIn profile.');urls.add(url);uids.add(c.uid);
        const out={uid:c.uid,url};
        for(const key of ['name','first','title','co','email']){if(typeof c[key]!=='string'||c[key].length>1000)throw Error('Invalid contact details.');out[key]=c[key].trim();}
        if(!out.name)throw Error('A LinkedIn contact needs a name.');
        if(c.connectedOn!==''&&(!day(c.connectedOn)||c.connectedOn>input.exportedOn))throw Error('Invalid connection date.');out.connectedOn=c.connectedOn;
        for(const dir of ['Inbound','Outbound']){
          const count=c[dir.toLowerCase()+'Count'],stamp=c['last'+dir+'At'];
          if(!Number.isInteger(count)||count<0||count>1000000||typeof stamp!=='string'||(stamp!==''&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(stamp)||!Number.isFinite(Date.parse(stamp))||!day(stamp.slice(0,10))||stamp.slice(0,10)>input.exportedOn))||Boolean(count)!==Boolean(stamp))throw Error('Invalid LinkedIn message metadata.');
          out[dir.toLowerCase()+'Count']=count;out['last'+dir+'At']=stamp;
        }return out;
      });return {app:input.app,version:1,exportedOn:input.exportedOn,contacts};
    }
    function mergeLinkedIn(input){
      const next=validateLinkedIn(input),previous=S.linkedin;
      if(previous&&previous.exportedOn>next.exportedOn)throw Error('This export is older than the update already saved.');
      const records=new Map((previous?.contacts||[]).map(c=>[c.url,c]));
      for(const c of next.contacts){const old=records.get(c.url);const merged={...c};if(old){merged.uid=old.uid;for(const k of ['name','first','title','co','email','connectedOn'])if(!merged[k])merged[k]=old[k];for(const dir of ['Inbound','Outbound']){const key='last'+dir+'At',count=dir.toLowerCase()+'Count';if(old[key]>merged[key])merged[key]=old[key];merged[count]=Math.max(old[count],merged[count]);}}records.set(c.url,merged);}
      return validateLinkedIn({...next,contacts:[...records.values()]});
    }
    function overlayContacts(dataset){
      const contacts=originalContacts.map(c=>({...c})),byURL=new Map(),byID=new Map(contacts.map(c=>[c.uid,c]));
      for(const c of contacts){const url=profileURL(c.url);if(url){if(!byURL.has(url))byURL.set(url,[]);byURL.get(url).push(c);}}
      for(const item of dataset?.contacts||[]){
        let matches=byURL.get(item.url);
        if(!matches){if(byID.has(item.uid))throw Error('A contact identifier conflicts with saved work.');const c={uid:item.uid,name:item.name,first:item.first,title:'',co:'',email:'',url:item.url,src:'cold',tier:null,score:null,intel:'',news:'',msg:'',lastmsg:'',theirs:false,peer:false,mq:null,senti:'mid',sentiRaw:'',lastDate:'',base:'pool'};contacts.push(c);matches=[c];byURL.set(item.url,matches);byID.set(c.uid,c);}
        // Existing duplicate rows retain their IDs and independent saved work.
        for(const c of matches){for(const key of ['name','first','title','co','email'])if(item[key])c[key]=item[key];c.linkedin=item;c.connectedOn=item.connectedOn;}
      }return contacts;
    }
    function applyLinkedIn(){
      if(appliedLinkedIn===S.linkedin)return;
      const contacts=overlayContacts(S.linkedin),current=new Map(CONTACTS.map(c=>[c.uid,c]));for(const c of contacts){if(own(current.get(c.uid)||{},'pitched'))c.pitched=current.get(c.uid).pitched;}CONTACTS.splice(0,CONTACTS.length,...contacts);
      for(const k of Object.keys(BYUID))delete BYUID[k];for(const k of Object.keys(URLIX))delete URLIX[k];
      for(const c of CONTACTS){BYUID[c.uid]=c;if(c.url)URLIX[normUrl(c.url)]=c.uid;}appliedLinkedIn=S.linkedin;
    }
    const lastActivity=c=>c.linkedin?Math.max(Date.parse(c.linkedin.lastInboundAt)||0,Date.parse(c.linkedin.lastOutboundAt)||0):0;
    function activityKind(c){const v=c.linkedin;if(!v)return '';if(!v.inboundCount&&!v.outboundCount)return 'none';return v.lastInboundAt>v.lastOutboundAt?'received':'sent';}
    function activityHTML(c){
      const v=c.linkedin;if(!v)return '';
      const recent=lastActivity(c),label=recent?(activityKind(c)==='received'?'Last message received':'Last message sent')+' · '+new Date(recent).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric',timeZone:'UTC'}):'No messages recorded in this export';
      return '<div class="prospecting-linkedin-activity"><span>'+esc(label)+'</span><details class="prospecting-linkedin-info"><summary aria-label="LinkedIn activity details">i</summary><p>'+esc((v.connectedOn?'Connected '+v.connectedOn+'. ':'')+v.inboundCount+' received · '+v.outboundCount+' sent. Activity from the LinkedIn export; this does not establish sales interest or change your pipeline stage.')+'</p></details></div>';
    }
    function validateState(input){
      if(!plain(input)||!['stage','note','fu','aum','log'].some(k=>own(input,k)))throw Error('This file does not contain prospecting progress.');
      const out={stage:{},note:{},fu:{},aum:{},log:[],set:{target:20,replyN:10,fuDays:7,peers:false}};
      for(const key of ['stage','note','fu','aum','tpl']){
        if(!own(input,key))continue;if(!plain(input[key]))throw Error('Invalid '+key+' records.');out[key]={};
        for(const [uid,v] of Object.entries(input[key])){
          if(!safeKey(uid))throw Error('Invalid record key.');
          const valid=key==='stage'?stages.includes(v):key==='fu'?(v===''||day(v)):key==='aum'?(typeof v==='number'&&Number.isFinite(v)&&v>=0):typeof v==='string';
          if(!valid)throw Error('Invalid '+key+' value.');out[key][uid]=v;
        }
      }
      if(own(input,'log')){
        if(!Array.isArray(input.log)||input.log.length>100000)throw Error('Invalid activity log.');
        out.log=input.log.map(a=>{
          if(!plain(a)||!safeKey(a.uid)||!['messaged','followup','replied','meeting','won','lost','park','parked','pool'].includes(a.to))throw Error('Invalid activity record.');
          const ts=typeof a.ts==='number'?a.ts:typeof a.ts==='string'?Date.parse(a.ts):NaN;
          if(!Number.isFinite(ts)||ts<0||!Number.isFinite(new Date(ts).getTime()))throw Error('Invalid activity date.');return {uid:a.uid,to:a.to,ts};
        });
      }
      if(own(input,'set')){
        if(!plain(input.set))throw Error('Invalid settings.');
        for(const key of ['target','replyN','fuDays'])if(own(input.set,key)){
          const n=input.set[key];if(!Number.isInteger(n)||n<1||n>10000)throw Error('Invalid '+key+' setting.');out.set[key]=Math.min(n,{target:100,replyN:50,fuDays:30}[key]);
        }
        if(own(input.set,'peers')){if(typeof input.set.peers!=='boolean')throw Error('Invalid peers setting.');out.set.peers=input.set.peers;}
      }
      if(own(input,'linkedin')){out.linkedin=validateLinkedIn(input.linkedin);overlayContacts(out.linkedin);}
      return out;
    }
    function validateBackup(input){
      if(!plain(input)||input.app!=='chambers-hq'||input.version!==1)throw Error('Choose a Chambers HQ version 1 backup.');return validateState(input.state);
    }
    const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
    const button=(text,fn)=>{const n=make('button',text,'btn ghost');n.type='button';n.addEventListener('click',fn);return n;};
    const boot=window.AtlasProspectingBoot;let unreadable=false,rawRecovery=null,unsaved=false,readBlocked=!!boot?.readError;
    const notice=make('div',null,'prospecting-notice');notice.id='prospecting-save-notice';notice.setAttribute('role','status');
    document.getElementById('main').before(notice);
    function download(text,name,type){const url=URL.createObjectURL(new Blob([text],{type})),a=make('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
    function exportRaw(){if(rawRecovery!==null)download(rawRecovery,'prospecting_saved_data_'+today()+'.json','application/json');}
    function paintNotice(){
      notice.hidden=!unreadable&&!unsaved&&!readBlocked;notice.replaceChildren();
      document.getElementById('main').inert=unreadable||readBlocked;
      const template=document.querySelector('[onclick="openTpl()"]');if(template)template.disabled=unreadable||readBlocked;
      if(notice.hidden)return;
      notice.appendChild(make('p',unreadable?'Saved progress could not be read. Editing is paused to protect it. Download the saved data or restore a valid backup.':readBlocked?'Saved progress cannot be accessed. Editing is paused until storage is available.':'Changes are in this page but have not saved on this device. Retry or download a backup before closing.'));
      notice.appendChild(button(unreadable||readBlocked?'Retry loading':'Retry saving',()=>{if(unreadable||readBlocked)retryLoad();else{save();paintRunNotice();}}));
      if(!readBlocked)notice.appendChild(button(unreadable?'Download saved data':'Download backup',()=>unreadable?exportRaw():exportBackup()));
      if(unreadable)notice.appendChild(button('Restore backup',()=>document.getElementById('impF').click()));
    }
    function retryLoad(){
      try{const raw=localStorage.getItem(KEY);if(raw!==null){S=validateState(JSON.parse(raw));}else{S=validateState({stage:{},note:{},fu:{},aum:{},log:[]});migrate();}unreadable=false;readBlocked=false;rawRecovery=null;unsaved=false;if(raw===null)save();paintNotice();render();toast(unsaved?'Progress loaded in this page. Saving needs a retry.':'Saved progress loaded.');}
      catch{toast('Saved progress still cannot be loaded.');}
    }
    save=function(){
      if(unreadable||readBlocked){paintNotice();return false;}
      for(const key of ['target','replyN','fuDays'])S.set[key]=Math.max(1,Math.min({target:100,replyN:50,fuDays:30}[key],Math.trunc(Number(S.set[key]))||{target:20,replyN:10,fuDays:7}[key]));
      try{const raw=JSON.stringify(S);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)throw Error('Write did not persist');unsaved=false;}
      catch{unsaved=true;}paintNotice();return !unsaved;
    };
    exportBackup=function(){
      try{if(unreadable){exportRaw();return;}if(readBlocked){toast('Restore storage access before exporting progress.');return;}download(JSON.stringify({app:'chambers-hq',version:1,exportedAt:new Date().toISOString(),state:S}),'chambers_hq_backup_'+today()+'.json','application/json');toast('Backup download started.');}catch{toast('Backup download failed. Please retry.');}
    };
    const restoreDialog=make('dialog');restoreDialog.id='prospecting-restore';restoreDialog.setAttribute('aria-label','Restore prospecting backup');document.body.appendChild(restoreDialog);
    const linkedInDialog=make('dialog');linkedInDialog.id='prospecting-linkedin-import';linkedInDialog.setAttribute('aria-label','Update LinkedIn contacts');document.body.appendChild(linkedInDialog);
    const linkedInInput=make('input');linkedInInput.type='file';linkedInInput.accept='.json,application/json';linkedInInput.hidden=true;linkedInInput.addEventListener('change',()=>importLinkedIn(linkedInInput));document.body.appendChild(linkedInInput);
    let importToken=0;
    function chooseLinkedIn(){if(unreadable||readBlocked||unsaved){toast('Save or recover your current progress before updating LinkedIn.');return;}linkedInInput.click();}
    async function importLinkedIn(input){
      const file=input.files?.[0];input.value='';if(!file)return;const token=++importToken;
      try{
        if(unreadable||readBlocked||unsaved)throw Error('Save or recover your current progress first.');
        if(file.size>8*1024*1024)throw Error('Choose a LinkedIn update smaller than 8 MB.');
        const payload=validateLinkedIn(JSON.parse(await file.text()));if(token!==importToken)return;
        const next=mergeLinkedIn(payload);overlayContacts(next);
        if(JSON.stringify(next)===JSON.stringify(S.linkedin)){toast('This LinkedIn update is already saved.');return;}
        const existing=new Set(CONTACTS.map(c=>profileURL(c.url)).filter(Boolean)),added=payload.contacts.filter(c=>!existing.has(c.url)).length;
        linkedInDialog.replaceChildren(make('h2','Update LinkedIn contacts'),make('p',payload.exportedOn+' · '+added.toLocaleString()+' new · '+(payload.contacts.length-added).toLocaleString()+' matched'));
        const info=make('details',null,'prospecting-linkedin-info'),summary=make('summary','i');summary.setAttribute('aria-label','What this update changes');info.append(summary,make('p','Refreshes profile details and one-to-one message counts and dates on this device. Notes, stages, follow-ups, saved activity, and existing contact IDs stay as they are. Matching uses profile URLs. Blank fields do not erase existing details. Re-importing does not duplicate contacts or messages. New contacts have no qualification score; review them in Database.'));
        linkedInDialog.append(info,button('Back up current progress',exportBackup),button('Cancel',()=>{importToken++;linkedInDialog.close();}));
        const error=make('p');error.setAttribute('role','alert');linkedInDialog.appendChild(error);
        linkedInDialog.appendChild(button('Apply update',()=>{
          if(token!==importToken)return;
          try{
            if(unreadable||readBlocked||unsaved)throw Error('Save or recover your current progress first.');
            const raw=localStorage.getItem(KEY);
            if(raw!==null&&JSON.stringify(validateState(JSON.parse(raw)))!==JSON.stringify(validateState(S)))throw Error('Progress changed in another tab. Reload this page before importing.');
            const merged=mergeLinkedIn(payload);overlayContacts(merged);const nextState={...S,linkedin:merged},encoded=JSON.stringify(nextState);
            localStorage.setItem(KEY,encoded);if(localStorage.getItem(KEY)!==encoded)throw Error('The update could not be confirmed. Reload and check before retrying.');
            importToken++;closeRun();S=nextState;lastUndo=null;tab='base';page=0;linkedInFilter='';applyLinkedIn();render(true);linkedInDialog.close();toast('LinkedIn updated · '+added.toLocaleString()+' new contacts.');
          }catch(e){error.textContent=e.message||'The update could not be saved. Free device storage and retry.';}
        }));if(!linkedInDialog.open)linkedInDialog.showModal();
      }catch(e){toast(e instanceof SyntaxError?'Choose the prepared LinkedIn JSON update.':e.message||'The LinkedIn update could not be read.');}
    }
    let restoreToken=0;
    importBackup=async function(input){
      const file=input.files?.[0];input.value='';if(!file)return;const token=++restoreToken;
      try{
        if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const next=validateBackup(JSON.parse(await file.text()));if(token!==restoreToken)return;
        restoreDialog.replaceChildren(make('h2','Restore this backup?'),make('p','This replaces the current stages, notes, follow-up dates, activity and templates on this device.'));
        if(!readBlocked)restoreDialog.appendChild(button(unreadable?'Download current saved data':'Back up current progress',()=>unreadable?exportRaw():exportBackup()));
        restoreDialog.appendChild(button('Cancel',()=>restoreDialog.close()));
        restoreDialog.appendChild(button('Restore backup',()=>{
          if(token!==restoreToken)return;restoreToken++;closeRun();S=next;unreadable=false;readBlocked=false;rawRecovery=null;lastUndo=null;save();render();restoreDialog.close();toast(unsaved?'Backup loaded in this page. Saving still needs a retry.':'Backup restored.');
        }));
        if(!restoreDialog.open)restoreDialog.showModal();
      }catch(error){toast(error instanceof SyntaxError?'This file is not valid JSON.':error.message||'Could not read this backup.');}
    };
    const cell=value=>{let s=String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    exportCSV=function(){
      if(unreadable||readBlocked){toast('Load valid progress before exporting CSV.');return;}
      const rows=[['Name','LinkedIn','Source','Tier','Score','Title','Company','Stage','FollowUp','Sentiment','Note','AUM','ConnectedOn','LinkedInReceived','LinkedInSent','LastLinkedInReceived','LastLinkedInSent']];
      CONTACTS.forEach(c=>rows.push([c.name,c.url,c.tier!==null?'warm':'cold',c.tier??'',c.score??'',c.title,c.co,stg(c),fu(c),c.sentiRaw,note(c),S.aum[c.uid]??'',c.linkedin?.connectedOn??'',c.linkedin?.inboundCount??'',c.linkedin?.outboundCount??'',c.linkedin?.lastInboundAt??'',c.linkedin?.lastOutboundAt??'']));
      try{download('\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n'),'chambers_hq_'+today()+'.csv','text/csv;charset=utf-8');toast('CSV download started.');}catch{toast('CSV download failed.');}
    };
    // Search updates only the result list, keeping the mobile field and caret intact.
    const normalize=value=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    function databaseMatches(){
      const words=normalize(q).trim().split(/\s+/).filter(Boolean);
      return CONTACTS.filter(c=>(!dbStage||stg(c)===dbStage)&&(!dbSrc||(dbSrc==='warm'?c.tier!==null:c.src==='cold'))&&(!linkedInFilter||(linkedInFilter==='imported'?!!c.linkedin:linkedInFilter==='new'?c.uid.startsWith('li-'):activityKind(c)===linkedInFilter))&&(S.set.peers||!c.peer||dbStage||words.length)&&words.every(w=>normalize([c.name,c.title,c.co,c.email,note(c)].join(' ')).includes(w))).sort((a,b)=>(linkedInFilter?lastActivity(b)-lastActivity(a):0)||rankOf(b)-rankOf(a));
    }
    function resultsHTML(list){
      const count=(page+1)*100,shown=list.slice(0,count);return '<div class="card">'+(shown.length?shown.map(c=>rowHTML(c,true)).join(''):'<p>No matching contacts. Try another word or clear the filters.</p>')+'</div>'+(list.length>count?'<button class="btn ghost" onclick="page++;ProspectingImprovements.refreshResults()">Show 100 more ('+(list.length-count)+' left)</button>':'');
    }
    pageBase=function(){
      const list=databaseMatches();return '<div class="prospecting-import-strip"><button class="btn ghost" onclick="ProspectingImprovements.chooseLinkedIn()">Update LinkedIn</button><span>'+(S.linkedin?'LinkedIn export · '+esc(S.linkedin.exportedOn):'')+'</span></div><div class="card prospecting-filters"><label>Find a prospect<input type="search" id="dbq" placeholder="Name, company, email, or note" value="'+esc(q)+'" oninput="dbSearch(this.value)"></label><label>Stage<select onchange="dbStage=this.value;page=0;ProspectingImprovements.refreshResults()"><option value="">All stages</option>'+stages.map(v=>'<option value="'+v+'"'+(dbStage===v?' selected':'')+'>'+v+'</option>').join('')+'</select></label><label>Source<select onchange="dbSrc=this.value;page=0;ProspectingImprovements.refreshResults()"><option value="">Warm + cold</option><option value="warm"'+(dbSrc==='warm'?' selected':'')+'>Warm only</option><option value="cold"'+(dbSrc==='cold'?' selected':'')+'>Cold only</option></select></label><label>LinkedIn activity<select onchange="ProspectingImprovements.filterLinkedIn(this.value)">'+[['','All contacts'],['imported','In LinkedIn export'],['new','Added from LinkedIn'],['received','Last message received'],['sent','Last message sent'],['none','No recorded messages']].map(([v,t])=>'<option value="'+v+'"'+(linkedInFilter===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label><button class="btn ghost" onclick="ProspectingImprovements.clearFilters()">Clear filters</button><span id="prospecting-result-count" role="status" aria-live="polite">'+list.length+' contacts</span></div><div id="prospecting-results">'+resultsHTML(list)+'</div>';
    };
    function refreshResults(){
      const host=document.getElementById('prospecting-results');if(tab!=='base'||!host)return;const list=databaseMatches();host.innerHTML=resultsHTML(list);document.getElementById('prospecting-result-count').textContent=list.length+' contacts';labelRows(host);
    }
    dbSearch=function(value){q=value;page=0;clearTimeout(_dq);_dq=setTimeout(refreshResults,160);};
    function clearFilters(){q='';dbStage='';dbSrc='';linkedInFilter='';page=0;render(true);document.getElementById('dbq')?.focus();}
    // A manual stage change gets the same follow-up defaults as a session action.
    setStage=function(uid,value){
      const c=BYUID[uid];if(!c||!stages.includes(value)||unreadable||readBlocked)return;const before=stg(c);if(before===value)return;
      S.stage[uid]=value;
      if(closed.has(value)||value==='pool'||value==='replied')S.fu[uid]='';
      else if(!day(S.fu[uid]))S.fu[uid]=plusDays(value==='meeting'?7:S.set.fuDays);
      if(['messaged','replied','meeting','won','lost'].includes(value))logAct(uid,value);
      if(value==='won'&&!S.aum[uid])S.aum[uid]=G.avgHH;save();render(true);
    };
    setFu=function(uid,value){if(!BYUID[uid]||unreadable||readBlocked)return;if(value!==''&&!day(value)){toast('Choose a valid follow-up date.');return;}S.fu[uid]=value;save();render(true);};
    fuDue=function(){return CONTACTS.filter(c=>(S.set.peers||!c.peer)&&['messaged','replied','meeting'].includes(stg(c))&&day(fu(c))&&fu(c)<=today()).sort((a,b)=>fu(a).localeCompare(fu(b))||a.name.localeCompare(b.name));};
    function dayQueue(){const remaining=Math.max(0,S.set.target-sendsToday()),seen=new Set();return [...fuDue(),...replyQueue().slice(0,S.set.replyN),...freshQueue().slice(0,remaining)].filter(c=>{if(seen.has(c.uid))return false;seen.add(c.uid);return true;});}
    let sessionId=0,sessionResults=[],actionAfter=0,copyBusy=false;
    function startQueue(kind,uid){
      if(unreadable||readBlocked)return;const queues={day:dayQueue,due:fuDue,replies:()=>replyQueue().slice(0,S.set.replyN),fresh:()=>freshQueue().slice(0,Math.max(0,S.set.target-sendsToday())),one:()=>BYUID[uid]?[BYUID[uid]]:[]};
      if(!queues[kind])return;rQ=queues[kind]();rI=0;lastUndo=null;runVarIdx=null;sessionId++;sessionResults=[];actionAfter=0;
      if(!rQ.length){toast(kind==='fresh'?'No eligible fresh prospects are queued.':'No contacts in this queue.');return;}
      document.getElementById('runner').classList.add('active');renderRun();
    }
    runDay=()=>startQueue('day');runOne=uid=>startQueue('one',uid);
    const originalRun=renderRun,originalAction=runAct,originalClose=closeRun;
    function paintRunNotice(){
      document.getElementById('prospecting-run-notice')?.remove();if(!unsaved)return;const n=make('div',null,'prospecting-notice');n.id='prospecting-run-notice';n.append(make('p','This session has changes that have not saved on this device.'),button('Retry saving',()=>{save();paintRunNotice();}),button('Download backup',exportBackup));document.getElementById('runCard').prepend(n);
    }
    renderRun=function(){
      if(rI>=rQ.length){
        const card=document.getElementById('runCard');card.replaceChildren(make('h2','Session complete'),make('p',sessionResults.filter(x=>x!=='skip').length+' updated · '+sessionResults.filter(x=>x==='skip').length+' skipped for this session.'));
        if(lastUndo)card.appendChild(button('Undo last',undoLast));card.appendChild(button('Done',closeRun));paintRunNotice();return;
      }
      originalRun();const card=document.getElementById('runCard');if(rQ[rI]?.linkedin){const activity=make('div');activity.innerHTML=activityHTML(rQ[rI]);card.prepend(activity);}const copy=card.querySelector('[onclick="runCopy()"]');if(copy)copy.textContent='Copy message';
      const guide=card.lastElementChild;if(guide?.classList.contains('mut'))guide.textContent='Copy the message, open the profile, and send it yourself. Return here to record the outcome. Skip leaves this person for a later session.';
      const skip=card.querySelector('[onclick="runAct(\'skip\')"]');if(skip)skip.textContent='Skip for now';
      const msg=document.getElementById('runMsg');if(msg)msg.setAttribute('aria-label','Message to copy and send manually');
      card.querySelectorAll('a[target="_blank"]').forEach(a=>a.rel='noopener noreferrer');paintRunNotice();
    };
    closeRun=function(){sessionId++;originalClose();};
    runAct=function(what){
      const c=rQ[rI];if(!c||unreadable||readBlocked||performance.now()<actionAfter)return;
      const allowed={sent:['pool'],followup:['messaged'],reply:['pool','messaged'],waiting:['replied'],meeting:['replied'],push:['meeting'],won:['meeting'],lost:['replied','meeting']};
      if(!['skip','park','pitched'].includes(what)&&!allowed[what]?.includes(stg(c)))return;
      actionAfter=performance.now()+350;
      const before={};for(const key of ['stage','fu','note','aum'])before[key]=S[key][c.uid];
      const priorLogs=new Set(S.log),undo={uid:c.uid,before,pitched:c.pitched,session:sessionId,queue:[...rQ],index:rI,results:[...sessionResults]};
      sessionResults.push(what);
      if(what==='skip'){rI++;runVarIdx=null;}else originalAction(what);
      const after={};for(const key of ['stage','fu','note','aum'])after[key]=S[key][c.uid];
      lastUndo={...undo,after,pitchedAfter:c.pitched,added:S.log.filter(a=>!priorLogs.has(a))};renderRun();
    };
    undoLast=function(){
      const last=lastUndo;if(!last||last.session!==sessionId||!BYUID[last.uid])return;lastUndo=null;const c=BYUID[last.uid];
      for(const key of ['stage','fu','note','aum'])if(S[key][last.uid]===last.after[key]){if(last.before[key]===undefined)delete S[key][last.uid];else S[key][last.uid]=last.before[key];}
      if(c.pitched===last.pitchedAfter){if(last.pitched===undefined)delete c.pitched;else c.pitched=last.pitched;}
      const added=new Set(last.added);S.log=S.log.filter(a=>!added.has(a));rQ=last.queue;rI=last.index;sessionResults=last.results;runVarIdx=null;actionAfter=0;save();renderRun();toast(unsaved?'Undone in this page. Saving needs a retry.':'Last action undone.');
    };
    runCopy=async function(){
      const c=rQ[rI],field=document.getElementById('runMsg');if(!c||!field||copyBusy)return;const text=field.value;if(!text.trim()){toast('Add a message before copying.');field.focus();return;}
      copyBusy=true;let copied=false;
      try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(text);copied=true;}}
      catch{/* Fall back to selecting the original field. */}
      if(!copied&&field.isConnected){field.focus();field.select();try{copied=document.execCommand('copy')===true;}catch{/* Manual copying remains available. */}}
      copyBusy=false;toast(copied?'Message copied. Open the profile to send it.':'Copy was unavailable. Select the message and use Copy.');
    };
    // Prevent held keys and native button activation from also advancing the session.
    document.addEventListener('keydown',e=>{
      if(!document.getElementById('runner').classList.contains('active'))return;
      if(e.target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(e.repeat){e.preventDefault();e.stopImmediatePropagation();return;}
      if(linkedInDialog.open||restoreDialog.open||document.getElementById('tplOv').style.display==='grid'||e.target?.closest('button,a[href]')||e.ctrlKey||e.metaKey||e.altKey){e.stopImmediatePropagation();return;}
      if(['Enter','Escape','c','s','x','p','z','r','m'].includes(e.key.toLowerCase())||e.key==='Enter'||e.key==='Escape')e.preventDefault();
    },true);
    function labelRows(host){
      host.querySelectorAll('.row').forEach(row=>{
        const name=row.querySelector('.who b')?.textContent||'contact';row.querySelectorAll('select').forEach(n=>n.setAttribute('aria-label','Stage for '+name));
        row.querySelectorAll('input[type="date"]').forEach(n=>n.setAttribute('aria-label','Follow-up date for '+name));row.querySelectorAll('input[type="text"]').forEach(n=>n.setAttribute('aria-label','Note for '+name));
      });
    }
    const originalRow=rowHTML;rowHTML=(c,showStage)=>{let html=originalRow(c,showStage).replace('</div></div>',activityHTML(c)+'</div></div>');if(c.uid.startsWith('li-'))html=html.replace('>COLD</span>',(stg(c)==='pool'?'>UNREVIEWED</span>':'>LINKEDIN</span>'));return html;};
    const originalFresh=freshQueue;freshQueue=()=>originalFresh().filter(c=>!lastActivity(c));
    const originalRender=render;
    render=function(keep){
      applyLinkedIn();originalRender(keep);const main=document.getElementById('main');labelRows(main);
      main.querySelectorAll('.qcard').forEach((n,i)=>n.setAttribute('onclick',"ProspectingImprovements.startQueue('"+['due','replies','fresh'][i]+"')"));
      const run=main.querySelector('[onclick="runDay()"]');if(run)run.textContent='Run my day ('+dayQueue().length+' contacts)';
      const plan=main.querySelector('.planstrip');if(plan)plan.textContent='Follow-ups first, then replies, then fresh outreach up to your daily send target.';
      const messages=['Contacts you marked as messaged, replied, or meeting, with a follow-up date due today or earlier.','Contacts marked replied, with no future follow-up date.','Eligible untouched contacts, up to the remaining daily send target.'];
      main.querySelectorAll('.qcard .qs').forEach((n,i)=>{n.textContent=messages[i];});
      const settingLabels=main.querySelectorAll('input[type="number"]');settingLabels.forEach(n=>{if((n.getAttribute('onchange')||'').includes('S.set.'))n.min='1';});paintNotice();
    };
    // Validate the pre-boot copy, so malformed data is not silently replaced by defaults.
    try{
      const raw=boot?boot.raw:localStorage.getItem(KEY);
      if(raw!==null){validateState(JSON.parse(raw));S=validateState(S);}
      else S=validateState(S);
    }catch{
      if(!readBlocked){unreadable=true;rawRecovery=boot?.raw??null;try{if(rawRecovery!==null)localStorage.setItem(KEY,rawRecovery);}catch{/* The pre-boot copy remains downloadable. */}}
      S=validateState({stage:{},note:{},fu:{},aum:{},log:[]});
    }
    window.ProspectingImprovements=Object.freeze({validateBackup,validateState,validateLinkedIn,mergeLinkedIn,overlayContacts,importLinkedIn,chooseLinkedIn,profileURL,activityKind,filterLinkedIn(value){linkedInFilter=['imported','new','received','sent','none'].includes(value)?value:'';page=0;refreshResults();},databaseMatches,refreshResults,clearFilters,dayQueue,startQueue,csvCell:cell,get unsaved(){return unsaved;},get blocked(){return unreadable||readBlocked;}});
    window.addEventListener('beforeunload',e=>{if(unsaved){e.preventDefault();e.returnValue='';}});
    render();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
