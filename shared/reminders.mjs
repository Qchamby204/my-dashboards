import {APPS,defaults,validate,quietAt} from './reminder-core.mjs';
const $=id=>document.getElementById(id),KEY='atlas.reminders.v1',AUTH='atlas.reminders.device.v1';
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let prefs=defaults(),connection=null,revision=0,busy=false,healthy=false,blocked=false;
function tell(s){$('feedback').textContent=s;}
function saveLocal(key,value){const raw=JSON.stringify(value);localStorage.setItem(key,raw);if(localStorage.getItem(key)!==raw)throw Error('This device could not save your settings.');}
try{const raw=localStorage.getItem(KEY);if(raw)prefs=validate(JSON.parse(raw));const auth=localStorage.getItem(AUTH);if(auth){const a=JSON.parse(auth);if(typeof a.token!=='string'||!/^https:\/\//.test(a.endpoint))throw Error();connection=a;}}
catch{blocked=true;tell('Saved settings could not be read. No changes will overwrite them. Check this browser’s storage before continuing.');}
function address(raw){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/')throw Error('Use the HTTPS service address without a path.');return u.origin;}
async function call(path,method='GET',data,auth=connection){
 if(!auth?.endpoint)throw Error('Connect the delivery service first.');
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
 try{const res=await fetch(auth.endpoint+path,{method,mode:'cors',credentials:'omit',headers:{...(data?{'Content-Type':'application/json'}:{}),...(auth.token?{Authorization:'Bearer '+auth.token}:{})},body:data?JSON.stringify(data):undefined,signal:controller.signal});const body=await res.json();if(!res.ok)throw Error(body.error||'Delivery service unavailable.');return body;}
 finally{clearTimeout(timer);}
}
function showConnection(){
 $('status').textContent=connection?(healthy?'Push connected':'Connection needs attention'):'Not connected';
 $('connection-note').textContent=connection?(healthy?'Schedules are saved with your delivery service. This device receives reminders even when the page is closed.':'The saved connection has not been verified. Reload or pair again to check it.'):'Schedules can be prepared here. Push delivery is not active until the service is deployed and this device is paired.';
 $('test').hidden=!connection;$('disconnect').hidden=!connection;$('connect').textContent=connection?'Pair again':'Enable notifications';
 if(connection)$('endpoint').value=connection.endpoint;
}
function draw(){
 $('list').innerHTML=prefs.reminders.map(r=>`<article class="reminder" data-id="${r.id}"><div class="heading"><h3>${escape(APPS[r.app].name)}</h3><label class="toggle"><input data-field="enabled" type="checkbox" ${r.enabled?'checked':''}>On</label></div><p class="reminder-title">${escape(r.title)}</p><p class="reminder-time">${r.time} · ${r.date?escape(r.date):r.days.length===7?'Every day':r.days.map(d=>['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d]).join(', ')}</p><details class="reminder-editor"><summary>Edit reminder</summary><label>Reminder<input data-field="title" maxlength="120" value="${escape(r.title)}" required></label><div class="two"><label>Dashboard<select data-field="app">${Object.entries(APPS).map(([id,a])=>`<option value="${id}" ${id===r.app?'selected':''}>${a.name}</option>`).join('')}</select></label><label>Time<input data-field="time" type="time" value="${r.time}" required></label></div><label>Repeat<select data-field="repeat"><option value="weekly" ${!r.date?'selected':''}>On chosen days</option><option value="once" ${r.date?'selected':''}>Once, on a date</option></select></label><label data-date ${!r.date?'hidden':''}>Date<input data-field="date" type="date" value="${r.date}"></label><fieldset class="days" ${r.date?'hidden':''}><legend>Days</legend>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,i)=>`<label><input data-day="${i}" type="checkbox" ${r.days.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset></details><small>${quietAt(r.time,prefs)?'This time falls within quiet hours and will be skipped.':'Opens '+APPS[r.app].name+'.'}</small><div class="actions"><button data-action="skip" type="button" ${!connection?'hidden':''}>Skip today</button><button data-action="remove" type="button">Remove</button></div></article>`).join('')||'<p>No reminders. Add one when you need it.</p>';
 $('paused').checked=prefs.paused;$('quiet-start').value=prefs.quietStart;$('quiet-end').value=prefs.quietEnd;$('timezone').value=prefs.timezone;
}
function collect(){
 return validate({...prefs,paused:$('paused').checked,quietStart:$('quiet-start').value,quietEnd:$('quiet-end').value,timezone:$('timezone').value,reminders:[...$('list').querySelectorAll('[data-id]')].map(card=>{
 const val=f=>card.querySelector('[data-field="'+f+'"]').value;
 if(val('repeat')==='once'&&!val('date'))throw Error('Choose a date for the one-time reminder.');
 return {id:card.dataset.id,app:val('app'),title:val('title'),time:val('time'),enabled:card.querySelector('[data-field="enabled"]').checked,date:val('repeat')==='once'?val('date'):'',days:[...card.querySelectorAll('[data-day]:checked')].map(el=>+el.dataset.day)};
 })});
}
function history(rows=[]){$('history').innerHTML=rows.length?rows.map(r=>`<div class="history-row"><strong>${escape(r.status)}</strong> · ${escape(new Date(r.at).toLocaleString())}</div>`).join(''):'No delivery attempts yet.';}
async function action(fn){if(busy||blocked)return;busy=true;document.querySelectorAll('main button, main input, main select').forEach(b=>b.disabled=true);try{await fn();}catch(e){tell(e.name==='AbortError'?'The service did not respond. Your edits are still here; check connection before trying again.':e.message||'Could not connect. Your edits are still here.');}finally{busy=false;document.querySelectorAll('main button, main input, main select').forEach(b=>b.disabled=blocked);showConnection();}}
const zones=[...new Set([prefs.timezone,'America/Winnipeg',Intl.DateTimeFormat().resolvedOptions().timeZone,...(Intl.supportedValuesOf?.('timeZone')||[])])].sort();
for(const zone of zones){const o=document.createElement('option');o.value=zone;o.textContent=zone.replaceAll('_',' ');$('timezone').append(o);}
draw();showConnection();
if(blocked)document.querySelectorAll('main button, main input, main select').forEach(b=>b.disabled=true);
$('list').addEventListener('change',e=>{const card=e.target.closest('[data-id]');if(!card)return;if(e.target.dataset.field==='repeat'){const once=e.target.value==='once';card.querySelector('[data-date]').hidden=!once;card.querySelector('.days').hidden=once;}tell('Unsaved changes. Save schedules when ready.');});
$('add').onclick=()=>{try{prefs=collect();if(prefs.reminders.length>=30)throw Error('Use at most 30 reminders.');const app=new URL(location.href).searchParams.get('app');prefs.reminders.push({id:crypto.randomUUID(),app:Object.hasOwn(APPS,app)?app:'life-map',title:'Make a little progress',time:'18:00',days:[1,2,3,4,5],date:'',enabled:true});draw();$('list').lastElementChild.querySelector('details').open=true;$('list').lastElementChild.querySelector('input[data-field="title"]').focus();tell('New reminder added. Save schedules when ready.');}catch(e){tell(e.message);}};
$('list').addEventListener('click',e=>{const button=e.target.closest('[data-action]'),card=button?.closest('[data-id]');if(!card)return;if(button.dataset.action==='remove'){card.remove();tell('Reminder removed from this draft. Save schedules to apply.');}else action(async()=>{await call('/skip','POST',{id:card.dataset.id});tell('Skipped for today. Future occurrences stay scheduled.');});});
$('save').onclick=()=>action(async()=>{
 const next=collect();
 if(connection){const result=await call('/device','PUT',{prefs:next,revision});revision=result.revision;healthy=result.active;prefs=result.prefs;try{saveLocal(KEY,prefs);}catch{draw();tell('Saved on the delivery service, but this device could not keep a local copy.');return;}history(result.history);tell(prefs.paused?'All reminders paused on this device.':'Schedules saved to the delivery service.');}
 else {saveLocal(KEY,next);prefs=next;tell('Schedules saved on this device. Push is not connected yet.');}
 draw();
});
$('connect').onclick=()=>action(async()=>{
 if(!('serviceWorker' in navigator)||!('PushManager' in window)||!('Notification' in window)){$('setup').open=true;throw Error('Open the Home Screen version on iPhone to enable notifications.');}
 if(/iPhone|iPad|iPod/.test(navigator.userAgent)&&!navigator.standalone&&!matchMedia('(display-mode: standalone)').matches){$('setup').open=true;throw Error('Add this Reminders page to your Home Screen, then open that icon.');}
 let endpoint;try{endpoint=address($('endpoint').value.trim());}catch{$('setup').open=true;throw Error('Delivery needs a deployed service address. Open Connection setup to enter it.');}
 if(connection&&endpoint!==connection.endpoint)throw Error('Disconnect this device before changing delivery services.');
 const pairingToken=$('pairing').value;if(pairingToken.length<32){$('setup').open=true;throw Error('Enter the private pairing code from your delivery service.');}
 const next=collect();saveLocal(KEY,next);
 // Request on the explicit click before network awaits, as required by iOS.
 const permission=await Notification.requestPermission();if(permission!=='granted')throw Error('Notifications are not allowed. You can change this in your phone’s notification settings.');
 const config=await call('/config','GET',undefined,{endpoint});
 const reg=await navigator.serviceWorker.register('reminders-sw.js',{scope:'./',updateViaCache:'none'});await navigator.serviceWorker.ready;
 const key=Uint8Array.from(atob(config.publicKey.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
 let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:key});
 const result=await call('/devices','POST',{pairingToken,subscription:sub.toJSON(),prefs:next},{endpoint});
 const auth={endpoint,token:result.token};
 try{saveLocal(AUTH,auth);}catch(e){try{await call('/device','DELETE',undefined,auth);}catch{}throw e;}
 connection=auth;revision=result.revision;healthy=result.active;prefs=result.prefs;$('pairing').value='';$('setup').open=false;history(result.history);draw();tell('Push connected. Send a test to check your phone’s delivery.');
});
$('test').onclick=()=>action(async()=>{await call('/test','POST',{});tell('Test accepted by the push provider. Check your phone’s notifications.');const result=await call('/device');history(result.history);});
$('disconnect').onclick=()=>action(async()=>{
 await call('/device','DELETE');localStorage.removeItem(AUTH);connection=null;healthy=false;revision=0;
 try{const reg=await navigator.serviceWorker.getRegistration('reminders-sw.js');const sub=await reg?.pushManager.getSubscription();await sub?.unsubscribe();}catch{}
 draw();history();tell('Delivery disconnected for this device. Your draft schedules remain here.');
});
if(connection&&!blocked)action(async()=>{const result=await call('/device');prefs=validate(result.prefs);revision=result.revision;healthy=result.active;draw();history(result.history);if(!healthy)tell('Your push subscription expired. Pair again to resume.');});
