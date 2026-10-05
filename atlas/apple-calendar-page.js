(()=>{
'use strict';
const $=s=>document.querySelector(s),params=new URLSearchParams(location.search),nonce=params.get('nonce'),publicOrigin='https://qchamby204.github.io',allowed=[publicOrigin,location.origin];
let connected=false,calendars=[],snapshot=null,task=null,busy=false;
const localDay=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const zone=params.get('zone')||Intl.DateTimeFormat().resolvedOptions().timeZone||'America/Winnipeg';
$('#day').value=params.get('day')||localDay();$('#zone-label').textContent='Times in '+zone;
const status=s=>{$('#status').textContent=s;};
async function api(path,method='GET',body){let response;try{response=await fetch('/api/apple-calendar/'+path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});}catch{throw Error('Connection lost. Try again.');}let data;try{data=await response.json();}catch{throw Error('Sign in to your private Atlas workspace and try again.');}if(!response.ok)throw Error(data.error||'The calendar request could not be completed.');return data;}
async function run(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){status(e.message);}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
function render(){
 $('#connect').hidden=connected;$('#selection').hidden=!connected||calendars.some(c=>c.selected);$('#manage').hidden=!connected;$('#day-panel').hidden=!connected||!calendars.some(c=>c.selected);$('#schedule-panel').hidden=!task||!connected||!calendars.some(c=>c.selected&&c.writable);
 $('#calendar-list').replaceChildren();$('#target-calendar').replaceChildren();
 for(const c of calendars){const label=document.createElement('label');label.className='calendar-option';const input=document.createElement('input');input.type='checkbox';input.value=c.id;input.checked=c.selected;label.append(input,document.createTextNode(c.name+(c.writable?'':' (read only)')));$('#calendar-list').append(label);if(c.selected&&c.writable){const option=document.createElement('option');option.value=c.id;option.textContent=c.name;$('#target-calendar').append(option);}}
 if(task){$('#task-title').value=task.title;$('#task-day').value=task.day||$('#day').value;}
}
function acceptTask(value){if(value&&typeof value.title==='string'&&value.title.length<=300&&typeof value.id==='string'&&value.id.length<=200){task=value;render();}}
try{if(location.hash.startsWith('#task='))acceptTask(JSON.parse(decodeURIComponent(location.hash.slice(6))));}catch{}
window.addEventListener('message',e=>{if(!window.opener||e.source!==window.opener||!allowed.includes(e.origin)||e.data?.nonce!==nonce)return;if(e.data?.type==='lifemap-calendar-request')acceptTask(e.data.task);});
if(nonce&&window.opener)for(const origin of allowed){window.opener.postMessage({type:'lifemap-calendar-ready',nonce},origin);}
async function loadStatus(){const data=await api('status');connected=data.connected;calendars=data.calendars||[];render();status(connected?(calendars.some(c=>c.selected)?'Connected to Apple Calendar.':'Choose the calendars you want in Life Map.'):'Connect your iCloud Home and Work calendars.');}
function showEvents(){
 $('#events').replaceChildren();const fmt=new Intl.DateTimeFormat(undefined,{timeZone:zone,hour:'numeric',minute:'2-digit'});
 for(const e of snapshot.events){const row=document.createElement('article');row.className='event';const title=document.createElement('strong');title.textContent=e.title;const detail=document.createElement('p');detail.textContent=(e.allDay?'All day':fmt.format(new Date(e.start))+' – '+fmt.format(new Date(e.end)))+' · '+e.calendar;row.append(title,detail);$('#events').append(row);}
 if(!snapshot.events.length){const p=document.createElement('p');p.textContent='No events in your selected calendars for this day.';$('#events').append(p);}
 $('#refresh-status').textContent='Refreshed '+new Date(snapshot.refreshedAt).toLocaleTimeString();$('#send').hidden=!window.opener||!nonce;$('#download').hidden=false;$('#download-help').hidden=!!window.opener;
}
function returnDay(){if(!snapshot||!window.opener||!nonce)return;for(const origin of allowed)window.opener.postMessage({type:'lifemap-calendar-day',nonce,snapshot},origin);status('Events sent to Life Map. You can close this screen.');}
async function refresh(){snapshot=await api('events?'+new URLSearchParams({day:$('#day').value,zone}));showEvents();status('Your day is up to date.');returnDay();}
$('#connect-form').addEventListener('submit',e=>{e.preventDefault();const account=$('#account').value,password=$('#password').value;$('#password').value='';run(async()=>{status('Connecting to Apple…');const data=await api('connect','POST',{account,password});connected=data.connected;calendars=data.calendars;render();status('Connected. Choose Home, Work, or any other calendars you want to show.');});});
$('#selection-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{const ids=[...$('#calendar-list input:checked')].map(i=>i.value);await api('select','POST',{ids});await loadStatus();await refresh();});});
$('#day-form').addEventListener('submit',e=>{e.preventDefault();run(refresh);});
$('#send').addEventListener('click',returnDay);
$('#download').addEventListener('click',()=>{if(!snapshot)return;const blob=new Blob([JSON.stringify({app:'lifemap-calendar-day',version:1,...snapshot})],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='life-map-calendar-'+snapshot.day+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
$('#change-calendars').addEventListener('click',()=>{$('#selection').hidden=false;$('#selection').scrollIntoView({block:'start'});});
$('#disconnect').addEventListener('click',()=>run(async()=>{await api('disconnect','POST',{});connected=false;calendars=[];snapshot=null;render();$('#events').replaceChildren();$('#send').hidden=true;$('#download').hidden=true;status('Disconnected. Revoke the Life Map password at Apple if you no longer need it.');if(nonce&&window.opener)for(const origin of allowed)window.opener.postMessage({type:'lifemap-calendar-disconnected',nonce},origin);}));
$('#schedule-form').addEventListener('submit',e=>{e.preventDefault();if(!task)return;run(async()=>{await api('schedule','POST',{taskId:task.id,title:task.title,day:$('#task-day').value,calendarId:$('#target-calendar').value,start:$('#start').value,end:$('#end').value,zone});if(nonce&&window.opener)for(const origin of allowed)window.opener.postMessage({type:'lifemap-calendar-scheduled',nonce,scheduled:{taskId:task.id,day:$('#task-day').value}},origin);task=null;render();status('Saved in Apple Calendar.');$('#day').value=$('#task-day').value;await refresh();});});
run(async()=>{await loadStatus();if(connected&&calendars.some(c=>c.selected))await refresh();});
})();
