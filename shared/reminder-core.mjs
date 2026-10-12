export const APPS = Object.freeze({
  'life-map': {name:'Life Map',file:'life-map.html'},
  library: {name:'Library',file:'the-library.html'},
  ledger: {name:'Life Ledger',file:'life-ledger.html'},
  forge: {name:'Forge',file:'workout-forge.html'},
  communicator: {name:'Communicator',file:'communication-trainer.html'},
  chef: {name:'Chef',file:'the-chef.html'}
});
export function defaults(){return {version:1,timezone:'America/Winnipeg',paused:false,quietStart:'21:30',quietEnd:'07:30',reminders:[
  {id:'morning',app:'life-map',title:'Choose what matters today',time:'08:00',days:[0,1,2,3,4,5,6],date:'',enabled:true},
  {id:'reading',app:'library',title:'Pick up your book',time:'20:30',days:[0,1,2,3,4,5,6],date:'',enabled:true},
  {id:'evening',app:'ledger',title:'Give today its credit',time:'21:00',days:[0,1,2,3,4,5,6],date:'',enabled:true}
]};}
export function validDate(v){return typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;}
export function minutes(s){if(typeof s!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(s))throw Error('Choose a valid time.');return +s.slice(0,2)*60 + +s.slice(3);}
export function validate(value){
  if(!value||value.version!==1||!Array.isArray(value.reminders)||value.reminders.length>30)throw Error('Use at most 30 reminders.');
  if(typeof value.timezone!=='string'||value.timezone.length>80)throw Error('Choose a time zone.');
  try{new Intl.DateTimeFormat('en',{timeZone:value.timezone}).format();}catch{throw Error('Choose a valid time zone.');}
  minutes(value.quietStart);minutes(value.quietEnd);
  const ids=new Set();
  const reminders=value.reminders.map(r=>{
    if(!r||typeof r.id!=='string'||! /^[a-zA-Z0-9_-]{1,64}$/.test(r.id)||ids.has(r.id))throw Error('Reminder IDs must be unique.');ids.add(r.id);
    if(!Object.hasOwn(APPS,r.app)||typeof r.title!=='string'||!r.title.trim()||r.title.length>120)throw Error('Choose a dashboard and a title up to 120 characters.');
    minutes(r.time);
    const date=r.date||'';if(date&&!validDate(date))throw Error('Choose a valid date.');
    if(!Array.isArray(r.days)||r.days.some(d=>!Number.isInteger(d)||d<0||d>6)||(!date&&!r.days.length))throw Error('Choose at least one day.');
    return {id:r.id,app:r.app,title:r.title.trim(),time:r.time,days:[...new Set(r.days)].sort(),date,enabled:r.enabled===true};
  });
  return {version:1,timezone:value.timezone,paused:value.paused===true,quietStart:value.quietStart,quietEnd:value.quietEnd,reminders};
}
export function localParts(now,timezone){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(x=>[x.type,x.value]));
  const date=`${p.year}-${p.month}-${p.day}`;return {date,time:`${p.hour}:${p.minute}`,day:new Date(date+'T12:00:00Z').getUTCDay()};
}
export function quietAt(time,p){const t=minutes(time),a=minutes(p.quietStart),b=minutes(p.quietEnd);return a===b?false:a<b?t>=a&&t<b:t>=a||t<b;}
// Work in real minutes so DST gaps are skipped and repeated wall-clock times share a key.
// Never replay a notification more than 10 minutes late after an outage.
export function dueOccurrences(p,now,createdAt=0){
  if(p.paused)return [];
  const current=localParts(now,p.timezone);if(quietAt(current.time,p))return [];
  const found=new Map();
  for(let ago=0;ago<=10;ago++){
    const at=Math.floor(now/60000)*60000-ago*60000;if(at<createdAt)continue;
    const part=localParts(at,p.timezone);
    if(quietAt(part.time,p))continue;
    for(const r of p.reminders)if(r.enabled&&r.time===part.time&&(r.date?r.date===part.date:r.days.includes(part.day))){
      const key=`${r.id}:${part.date}:${r.time}`;
      if(!found.has(key))found.set(key,{key,date:part.date,at,reminder:r});
    }
  }
  return [...found.values()];
}
