    const stages=['pool','messaged','replied','meeting','won','lost','parked'],closed=new Set(['won','lost','parked']);
    const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k),plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
    const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
    const safeKey=k=>typeof k==='string'&&/^[\w-]{1,100}$/.test(k)&&!['__proto__','prototype','constructor'].includes(k);
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
    function mergeLinkedIn(previous,input){
      const next=validateLinkedIn(input);
      if(previous&&previous.exportedOn>next.exportedOn)throw Error('This export is older than the update already saved.');
      const records=new Map((previous?.contacts||[]).map(c=>[c.url,c]));
      for(const c of next.contacts){const old=records.get(c.url);const merged={...c};if(old){merged.uid=old.uid;for(const k of ['name','first','title','co','email','connectedOn'])if(!merged[k])merged[k]=old[k];for(const dir of ['Inbound','Outbound']){const key='last'+dir+'At',count=dir.toLowerCase()+'Count';if(old[key]>merged[key])merged[key]=old[key];merged[count]=Math.max(old[count],merged[count]);}}records.set(c.url,merged);}
      return validateLinkedIn({...next,contacts:[...records.values()]});
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
      for(const key of ['review','conversation','merges','mergeUndo']){
        if(!own(input,key))continue;if(!plain(input[key])||Object.keys(input[key]).length>20000)throw Error('Invalid '+key+' records.');out[key]={};
        for(const [uid,value] of Object.entries(input[key])){
          if(!safeKey(uid))throw Error('Invalid review identifier.');
          if(key==='review'){if(!['prospect','network','exclude'].includes(value))throw Error('Invalid contact review.');out[key][uid]=value;}
          else if(key==='conversation')out[key][uid]=conversationValue(value);
          else if(key==='merges'){if(!safeKey(value)||uid===value)throw Error('Invalid duplicate link.');out[key][uid]=value;}
          else{
            if(!plain(value)||!Array.isArray(value.members)||value.members.length<2||value.members.length>100||value.members.some(x=>!safeKey(x))||!value.members.includes(uid))throw Error('Invalid duplicate recovery.');
            const clean=snap=>{if(!plain(snap)||Object.keys(snap).some(k=>!['stage','note','fu','aum','review','conversation'].includes(k)))throw Error('Invalid duplicate snapshot.');const r=validateState({stage:{},...snap});delete r.log;delete r.set;return r;};
            out[key][uid]={members:[...new Set(value.members)],before:clean(value.before),after:clean(value.after)};
          }
        }
      }
      for(const uid of Object.keys(out.merges||{})){const seen=new Set([uid]);let next=out.merges[uid];while(next){if(seen.has(next))throw Error('Duplicate links contain a cycle.');seen.add(next);next=out.merges[next];}}
      if(own(input,'linkedin'))out.linkedin=validateLinkedIn(input.linkedin);
      return out;
    }

function conversationValue(v){if(!plain(v)||!['reply','later','resolved'].includes(v.status)||typeof v.seenThrough!=='string'||!Number.isFinite(Date.parse(v.seenThrough))||v.status==='later'&&!day(v.date))throw Error('Invalid conversation review.');return {status:v.status,seenThrough:v.seenThrough,date:v.status==='later'?v.date:''};}
export {profileURL,validateLinkedIn,validateState,mergeLinkedIn};
export const emptyState=()=>validateState({stage:{},note:{},fu:{},aum:{},log:[]});



const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function primaryID(state,uid){const seen=new Set();while(state.merges?.[uid]&&!seen.has(uid)){seen.add(uid);uid=state.merges[uid];}return uid;}
export function conversationDue(state,c,today){
  const activity=c.linkedin;if(!activity||activity.lastInboundAt<=activity.lastOutboundAt)return false;
  const review=state.conversation?.[c.uid];
  if(!review||review.seenThrough<activity.lastInboundAt)return true;
  return review.status==='reply'||review.status==='later'&&review.date<=today;
}
export function duplicateGroups(contacts,state){const groups=new Map();for(const c of contacts){const url=profileURL(c.url);if(!url||primaryID(state,c.uid)!==c.uid)continue;if(!groups.has(url))groups.set(url,[]);groups.get(url).push(c);}return [...groups.values()].filter(g=>g.length>1);}
export function mergeProgress(current,incoming,{baseline=null,choices={}}={}){
  current=validateState(current);incoming=validateState(incoming);if(baseline)baseline=validateState(baseline);
  const next=structuredClone(current),conflicts=[];
  for(const key of ['stage','note','fu','aum','review','conversation','merges','mergeUndo','tpl','set']){
    const incomingMap=incoming[key]||{},currentMap=current[key]||{},baseMap=baseline?.[key]||{};
    for(const uid of new Set([...Object.keys(incomingMap),...(baseline?Object.keys(baseMap):[])])){
      const value=incomingMap[uid],saved=currentMap[uid],before=baseMap[uid];
      if(baseline&&same(value,before)||same(value,saved))continue;
      const assign=v=>{next[key]??={};if(v===undefined)delete next[key][uid];else next[key][uid]=structuredClone(v);};
      if(!baseline&&saved===undefined||baseline&&same(saved,before)){assign(value);continue;}
      if(key==='note'&&typeof value==='string'&&value&&saved){assign(saved.includes(value)?saved:value.includes(saved)?value:saved+'\n\n[From another saved record]\n'+value);continue;}
      const id=key+':'+uid;conflicts.push({id,key,uid,saved,value});if(choices[id]==='incoming')assign(value);
    }
  }
  const logs=new Map(current.log.map(a=>[JSON.stringify(a),a]));if(baseline){const incomingLogs=new Set(incoming.log.map(a=>JSON.stringify(a)));for(const a of baseline.log)if(!incomingLogs.has(JSON.stringify(a)))logs.delete(JSON.stringify(a));}for(const a of incoming.log)logs.set(JSON.stringify(a),a);next.log=[...logs.values()].sort((a,b)=>a.ts-b.ts);
  if(incoming.linkedin){const a=current.linkedin,b=incoming.linkedin;next.linkedin=a&&a.exportedOn>b.exportedOn?mergeLinkedIn(b,a):mergeLinkedIn(a,b);}
  return {next:validateState(next),conflicts};
}
export function mergeDuplicates(state,contacts,primary,choices={}){
  const group=duplicateGroups(contacts,state).find(g=>g.some(c=>c.uid===primary));if(!group)throw Error('This duplicate group changed. Review it again.');
  const next=structuredClone(state),keys=['stage','note','fu','aum','review','conversation'];const members=group.map(c=>c.uid);
  const snapshot=()=>Object.fromEntries(keys.map(k=>[k,Object.fromEntries(members.filter(id=>own(next[k]||{},id)).map(id=>[id,structuredClone(next[k][id])]))]));
  const before=snapshot();
  for(const k of keys){next[k]??={};const source=choices[k]||primary;if(!members.includes(source))throw Error('Choose a record from this duplicate group.');
    if(k==='note'){const notes=[...new Set(members.map(id=>next.note[id]).filter(Boolean))];if(notes.length)next.note[primary]=notes.join('\n\n[Combined contact note]\n');}
    else{const value=next[k][source]??(k==='stage'?group.find(c=>c.uid===source).base:undefined);if(value!==undefined)next[k][primary]=structuredClone(value);}
  }
  next.merges??={};for(const uid of members)if(uid!==primary)next.merges[uid]=primary;
  next.mergeUndo??={};next.mergeUndo[primary]={members,before,after:snapshot()};return validateState(next);
}
export function undoDuplicateMerge(state,primary){
  const next=structuredClone(state),undo=next.mergeUndo?.[primary];if(!undo)throw Error('This duplicate merge is unavailable.');
  for(const uid of undo.members)if(next.merges?.[uid]===primary)delete next.merges[uid];
  for(const key of Object.keys(undo.before)){next[key]??={};for(const uid of undo.members)if(same(next[key][uid],undo.after[key]?.[uid])){if(own(undo.before[key],uid))next[key][uid]=undo.before[key][uid];else delete next[key][uid];}}
  delete next.mergeUndo[primary];return validateState(next);
}
if(typeof window!=='undefined')window.ProspectingRecords={profileURL,validateLinkedIn,validateState,mergeLinkedIn,emptyState,primaryID,conversationDue,duplicateGroups,mergeProgress,mergeDuplicates,undoDuplicateMerge};
