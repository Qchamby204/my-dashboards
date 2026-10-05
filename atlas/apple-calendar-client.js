/* Private connection is opened on a user gesture; Apple secrets never enter this app. */
(()=>{
'use strict';
const endpoint='https://atlas-os-quinton.qchambers123018.chatgpt.site',origin=new URL(endpoint).origin,key='lifemap:calendar-day-cache:v1';
let days={},pending=null,message='';
try{const raw=sessionStorage.getItem(key);if(raw&&raw.length<1200000)days=JSON.parse(raw);}catch{}
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v));
function normalize(raw){
 if(!raw||!date(raw.day)||typeof raw.zone!=='string'||!Array.isArray(raw.events)||raw.events.length>500||!Number.isFinite(Date.parse(raw.refreshedAt))||Date.parse(raw.refreshedAt)>Date.now()+60000)throw Error('Choose a valid calendar day exported from your private connection.');
 try{new Intl.DateTimeFormat('en',{timeZone:raw.zone}).format();}catch{throw Error('This calendar day has an invalid time zone.');}
 const events=raw.events.map(e=>{if(!e||typeof e.id!=='string'||e.id.length>1100||typeof e.title!=='string'||e.title.length>300||typeof e.calendar!=='string'||e.calendar.length>160||typeof e.calendarId!=='string'||e.calendarId.length>32||typeof e.taskId!=='string'||e.taskId.length>200||!Number.isFinite(Date.parse(e.start))||!Number.isFinite(Date.parse(e.end))||e.end<e.start)throw Error('This calendar day has an invalid event.');return {id:e.id,uid:String(e.uid||'').slice(0,512),title:e.title,calendar:e.calendar,calendarId:e.calendarId,taskId:e.taskId,start:e.start,end:e.end,allDay:!!e.allDay,busy:!!e.busy};});
 return {day:raw.day,zone:raw.zone,refreshedAt:raw.refreshedAt,events};
}
function update(snapshot,imported=false){const clean=normalize(snapshot);days[clean.day]=clean;const sorted=Object.values(days).sort((a,b)=>b.refreshedAt.localeCompare(a.refreshedAt)).slice(0,7);days=Object.fromEntries(sorted.map(s=>[s.day,s]));try{sessionStorage.setItem(key,JSON.stringify(days));}catch{}message='';window.dispatchEvent(new CustomEvent('lifemap-calendar-update',{detail:{day:clean.day,imported}}));}
function importLink(value){
 if(typeof value!=='string'||value.length>120000)throw Error('Choose Copy day link in the Apple Calendar screen.');
 let link;try{link=new URL(value);}catch{throw Error('Paste the full day link copied from Apple Calendar.');}
 if(link.origin!==location.origin||link.pathname!==location.pathname||!link.hash.startsWith('#calendar-day='))throw Error('Choose Copy day link in the Apple Calendar screen; the page address does not include your events.');
 const data=JSON.parse(decodeURIComponent(link.hash.slice(14)));
 if(data.app!=='lifemap-calendar-day'||data.version!==1)throw Error('This is not a Life Map calendar day link.');
 update(data,true);return data.day;
}
function receiveLink(){
 if(!location.hash.startsWith('#calendar-day='))return;
 let day='';try{day=importLink(location.href);}catch(e){message=e.message;window.dispatchEvent(new Event('lifemap-calendar-update'));}
 history.replaceState(null,'',location.pathname+location.search+'#board'+(day?'?day='+day:''));
}
receiveLink();window.addEventListener('hashchange',receiveLink);
function open(day,task){
 const nonce=crypto.randomUUID(),zone=Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Winnipeg',url=endpoint+'/apple-calendar?'+new URLSearchParams({day,zone,nonce});
 const popup=window.open(url+(task?'#task='+encodeURIComponent(JSON.stringify({id:task.id,title:task.task,day})):''),'lifemap-apple-calendar','popup,width=580,height=820');
 if(!popup){message='Allow the calendar screen to open, then try again.';window.dispatchEvent(new Event('lifemap-calendar-update'));return;}
 pending={nonce,popup,task:task?{id:task.id,title:task.task,day}:null};message='Calendar connection opened. Return here after refreshing your day.';window.dispatchEvent(new Event('lifemap-calendar-update'));
}
window.addEventListener('message',e=>{
 if(!pending||e.origin!==origin||e.source!==pending.popup||e.data?.nonce!==pending.nonce)return;
 if(e.data.type==='lifemap-calendar-ready'){e.source.postMessage({type:'lifemap-calendar-request',nonce:pending.nonce,task:pending.task},origin);return;}
 if(e.data.type==='lifemap-calendar-day'){try{update(e.data.snapshot,e.data.openBoard===true);}catch(err){message=err.message;window.dispatchEvent(new Event('lifemap-calendar-update'));}}
 if(e.data.type==='lifemap-calendar-scheduled'){window.dispatchEvent(new CustomEvent('lifemap-calendar-scheduled',{detail:e.data.scheduled}));}
 if(e.data.type==='lifemap-calendar-disconnected'){days={};try{sessionStorage.removeItem(key);}catch{}message='Apple Calendar disconnected.';window.dispatchEvent(new Event('lifemap-calendar-update'));}
});
function snapshot(day){try{return days[day]?normalize(days[day]):null;}catch{return null;}}
window.LifeMapCalendar=Object.freeze({open,snapshot,importLink,get message(){return message;},fresh(day){const s=snapshot(day);return !!s&&Date.now()-Date.parse(s.refreshedAt)<300000;},active(day){const s=snapshot(day);return s?s.events.filter(e=>!e.allDay&&e.busy&&Date.parse(e.start)<=Date.now()&&Date.parse(e.end)>Date.now()):[];},importDay:async file=>{if(file.size>1200000)throw Error('Choose a calendar day smaller than 1.2 MB.');const data=JSON.parse(await file.text());if(data.app!=='lifemap-calendar-day'||data.version!==1)throw Error('Choose a day exported from the Apple Calendar connection.');update(data,true);return data.day;}});
})();
