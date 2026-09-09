(()=>{
  'use strict';
  if(window.ProspectingReview||!window.ProspectingImprovements)return;
  const api=window.ProspectingImprovements,R=window.ProspectingRecords,cloud=window.ProspectingSync;
  const PRIVATE='https://atlas-os-quinton.qchambers123018.chatgpt.site';
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const btn=(text,fn)=>{const n=make('button',text,'btn ghost');n.type='button';n.addEventListener('click',fn);return n;};
  const info=text=>{const n=make('details',null,'prospecting-linkedin-info'),s=make('summary','i');s.setAttribute('aria-label','More information');n.append(s,make('p',text));return n;};
  const dialog=make('dialog',null,'prospecting-review-dialog');dialog.setAttribute('aria-label','Review prospecting');document.body.appendChild(dialog);
  let busy=false,mode='new',offset=0,all=false;
  function open(title){dialog.replaceChildren(make('h2',title));if(!dialog.open)dialog.showModal();}
  function finish(){dialog.appendChild(btn('Done',()=>{if(!busy)dialog.close();}));}
  function error(e){let n=dialog.querySelector('[role="alert"]');if(!n){n=make('p');n.setAttribute('role','alert');dialog.appendChild(n);}n.textContent=e.message||'This change could not be saved. Retry when connected.';}
  async function apply(next,then){if(busy)return;busy=true;dialog.setAttribute('aria-busy','true');try{await api.applyState(next);busy=false;then?.();}catch(e){error(e);}finally{busy=false;dialog.removeAttribute('aria-busy');}}
  dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  const pending=()=>CONTACTS.filter(c=>c.uid.startsWith('li-')&&!S.review?.[c.uid]);
  const conversations=()=>CONTACTS.filter(c=>!['network','exclude'].includes(S.review?.[c.uid])&&R.conversationDue(S,c,today()));
  function paint(){
    const main=document.getElementById('main');if(!['today','base'].includes(tab)||document.getElementById('prospecting-review-strip'))return;
    const strip=make('div',null,'prospecting-import-strip');strip.id='prospecting-review-strip';
    strip.append(btn('Review contacts · '+pending().length,()=>showReview('new')),btn('Conversations · '+conversations().length,()=>showReview('conversation')),btn('Duplicates · '+R.duplicateGroups(CONTACTS,S).length,showDuplicates));
    if(cloud){strip.append(btn('Apply uploaded LinkedIn export',()=>api.uploadedLinkedIn()));}
    else{strip.append(btn('Connect devices',connectDevices));}
    main.prepend(strip);
  }
  function contactHead(c){const n=make('div');const a=make('a',c.name+' ↗');a.href=R.profileURL(c.url);a.target='_blank';a.rel='noopener noreferrer';n.append(a,make('p',[c.title,c.co].filter(Boolean).join(' · ')));return n;}
  function showReview(kind=mode,reset=true){
    if(busy)return;if(reset){mode=kind;offset=0;all=false;}
    const list=mode==='new'?(all?CONTACTS.filter(c=>c.uid.startsWith('li-')):pending()):(all?CONTACTS.filter(c=>c.linkedin?.lastInboundAt):conversations());
    open(mode==='new'?'Review new contacts':'Review conversations');
    dialog.append(info(mode==='new'?'Prospect makes this contact eligible for your outreach queue. Keep in network and Exclude keep their record but remove them from outreach. You can change a choice in Show all. No qualification score is inferred.':'This uses the dates in your LinkedIn export. Open the profile to read the conversation. Reply needed keeps it here; Follow up later waits until your chosen date; Resolved stays hidden until a newer incoming message. These choices do not change pipeline stages.'),btn(all?'Show pending':'Show all',()=>{all=!all;offset=0;showReview(mode,false);}));
    if(!list.length)dialog.appendChild(make('p','Nothing waiting for review.'));
    offset=Math.min(offset,Math.max(0,Math.floor((list.length-1)/20)*20));
    for(const c of list.slice(offset,offset+20)){
      const card=make('article',null,'prospecting-review-card');card.appendChild(contactHead(c));
      if(mode==='new'){
        const current=S.review?.[c.uid];card.appendChild(make('p',current?{prospect:'Prospect',network:'Kept in network',exclude:'Excluded'}[current]:'Not reviewed'));
        for(const [value,label] of [['prospect','Prospect'],['network','Keep in network'],['exclude','Exclude']])card.appendChild(btn(label,()=>apply({...api.getState(),review:{...S.review,[c.uid]:value}},()=>showReview(mode,false))));
      }else{
        const stamp=c.linkedin.lastInboundAt,v=S.conversation?.[c.uid];
        card.appendChild(make('p','Last incoming · '+stamp.slice(0,10)+(v?' · '+{reply:'Reply needed',later:'Follow up '+v.date,resolved:'Resolved'}[v.status]:'')));
        const set=(status,date='')=>apply({...api.getState(),conversation:{...S.conversation,[c.uid]:{status,date,seenThrough:stamp}}},()=>showReview(mode,false));
        const date=make('input');date.type='date';date.min=today();date.value=v?.status==='later'?v.date:plusDays(7);date.setAttribute('aria-label','Follow-up date for '+c.name);
        card.append(btn('Reply needed',()=>set('reply')),date,btn('Follow up later',()=>{if(!date.value||date.value<today()){date.focus();return;}set('later',date.value);}),btn('Resolved',()=>set('resolved')));
      }
      dialog.appendChild(card);
    }
    if(offset)dialog.appendChild(btn('Previous 20',()=>{offset-=20;showReview(mode,false);}));
    if(offset+20<list.length)dialog.appendChild(btn('Next 20',()=>{offset+=20;showReview(mode,false);}));finish();
  }
  const display=v=>v===undefined?'Not set':typeof v==='object'?(v.status?{reply:'Reply needed',later:'Follow up '+v.date,resolved:'Resolved'}[v.status]:'Saved merge details'):String(v);
  function select(label,options){const box=make('label',label),input=make('select');input.appendChild(make('option','Choose…'));input.firstChild.value='';for(const [value,text]of options){const o=make('option',text);o.value=value;input.appendChild(o);}box.appendChild(input);return {box,input};}
  function showDuplicates(){
    if(busy)return;open('Review duplicate profiles');
    dialog.appendChild(info('Only identical LinkedIn profile URLs are grouped. Choose the main record and resolve differing fields. Notes are combined and activity keeps its original identifiers. Every original record remains in your backup. Undo preserves edits you make after a merge.'));
    const groups=R.duplicateGroups(CONTACTS,S);
    for(const group of groups){const card=make('article',null,'prospecting-review-card');card.append(make('p',group[0].name+' · '+group.length+' records'),btn('Review merge',()=>previewDuplicate(group,group[0].uid)));dialog.appendChild(card);}
    for(const uid of Object.keys(S.mergeUndo||{})){const card=make('article',null,'prospecting-review-card');card.append(make('p','Merged · '+(BYUID[uid]?.name||uid)),btn('Undo merge',()=>apply(R.undoDuplicateMerge(S,uid),showDuplicates)));dialog.appendChild(card);}
    if(!groups.length&&!Object.keys(S.mergeUndo||{}).length)dialog.appendChild(make('p','No duplicate profile URLs.'));finish();
  }
  function previewDuplicate(group,primary){
    open('Choose the main record');const p=select('Main record',group.map(c=>[c.uid,c.name+' · '+c.uid]));p.input.value=primary;p.input.addEventListener('change',()=>{if(p.input.value)previewDuplicate(group,p.input.value);});dialog.appendChild(p.box);
    const choices={},inputs=[];
    for(const key of ['stage','fu','aum','review','conversation']){
      const options=group.filter(c=>S[key]?.[c.uid]!==undefined||key==='stage').map(c=>[c.uid,display(S[key]?.[c.uid]??c.base)+' · '+c.uid]);
      if(!options.length)continue;
      const choice=select({stage:'Pipeline stage',fu:'Follow-up date',aum:'Saved AUM',review:'Contact review',conversation:'Conversation review'}[key],options);
      const values=new Set(group.map(c=>JSON.stringify(S[key]?.[c.uid]??(key==='stage'?c.base:undefined))).filter(x=>x!==undefined));
      if(values.size===1){choice.input.value=options.find(([id])=>id===primary)?.[0]||options[0][0];}
      inputs.push([key,choice.input]);dialog.appendChild(choice.box);
    }
    const notes=[...new Set(group.map(c=>S.note[c.uid]).filter(Boolean))];dialog.appendChild(make('p',notes.length+' distinct notes will be kept. All activity and original records remain available.'));
    dialog.append(btn('Back',showDuplicates),btn('Merge records',()=>{for(const [key,input]of inputs){if(!input.value){input.focus();return;}choices[key]=input.value;}apply(R.mergeDuplicates(S,CONTACTS,primary,choices),showDuplicates);}));
  }
  function previewMerge(saved,incoming,{baseline=null,title='Review imported progress',onApply}={}){
    if(busy)return;const result=R.mergeProgress(saved,incoming,{baseline});open(title);
    dialog.appendChild(make('p',result.conflicts.length?result.conflicts.length+' fields need your choice.':'Your records can be combined without field conflicts.'));
    dialog.appendChild(info('Matching identifiers keep their history. Distinct notes and activity are combined. Profile metadata uses the newest export. Select each conflicting value before applying. Your other browser keeps its original copy.'));
    const inputs=[];
    for(const c of result.conflicts){const input=select((BYUID[c.uid]?.name||c.uid)+' · '+c.key,[['saved','Saved: '+display(c.saved)],['incoming','Incoming: '+display(c.value)]]);inputs.push([c.id,input.input]);dialog.appendChild(input.box);}
    dialog.append(btn('Cancel',()=>{if(!busy)dialog.close();}),btn('Apply reviewed progress',async()=>{
      if(busy)return;const choices={};for(const [id,input]of inputs){if(!input.value){input.focus();return;}choices[id]=input.value;}
      const next=R.mergeProgress(saved,incoming,{baseline,choices}).next;
      if(onApply){busy=true;try{await onApply(next);dialog.close();}catch(e){error(e);}finally{busy=false;}}
      else await apply(next,()=>{dialog.close();toast('Reviewed progress saved.');});
    }));
  }
  function previewTransfer(state){if(api.unsaved)throw Error('Wait for your current changes to save first.');previewMerge(api.getState(),R.validateState(state));}
  function connectDevices(){
    if(api.blocked||api.unsaved){toast('Save or recover this browser’s progress first.');return;}
    const nonce=crypto.randomUUID(),destination=window.open(PRIVATE+'/apps/prospecting?transfer='+encodeURIComponent(nonce),'prospecting-'+nonce);
    if(!destination){toast('Allow this page to open the private dashboard, then try again. You can also restore a backup there.');return;}
    const deadline=Date.now()+300000;
    const listener=e=>{if(e.origin!==PRIVATE||e.source!==destination||e.data?.type!=='prospecting-ready'||e.data.nonce!==nonce)return;
      window.removeEventListener('message',listener);if(Date.now()>deadline||api.unsaved||api.blocked)return;
      destination.postMessage({type:'prospecting-transfer',nonce,state:api.getState()},PRIVATE);
    };
    window.addEventListener('message',listener);setTimeout(()=>window.removeEventListener('message',listener),300000);
    toast('Sign in to private Prospecting, then review the transfer there. Keep this tab open.');
  }
  window.ProspectingReview={paint,showReview,showDuplicates,previewMerge,previewTransfer};paint();
})();
