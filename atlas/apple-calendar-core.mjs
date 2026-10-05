/* iCloud CalDAV transport. Credentials and raw responses never reach Life Map. */
import {ICAL,XMLParser,XMLValidator} from './vendor/apple-calendar-parsers.mjs';
const parser=new XMLParser({removeNSPrefix:true,ignoreAttributes:false,parseTagValue:false,trimValues:false,processEntities:true});
export class CalendarError extends Error {constructor(message,status=400){super(message);this.status=status;}}
const arr=v=>v==null?[]:Array.isArray(v)?v:[v];
const txt=v=>typeof v==='string'?v:typeof v==='number'?String(v):v?.['#text']||'';
const xml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function appleURL(value,base='https://caldav.icloud.com/'){
  let u;try{u=new URL(value,base);}catch{throw new CalendarError('Apple returned an invalid calendar address.',502);}
  if(u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.search||!(/^(?:caldav|p\d+-caldav)\.icloud\.com$/.test(u.hostname)))throw new CalendarError('Apple returned an unsupported calendar address.',502);
  return u.href;
}
export function responses(source){
  if(source.length>4000000||/<!DOCTYPE|<!ENTITY/i.test(source)||XMLValidator.validate(source)!==true)throw new CalendarError('Apple returned an unreadable calendar response.',502);
  return arr(parser.parse(source)?.multistatus?.response).map(r=>({href:txt(r.href),props:Object.assign({},...arr(r.propstat).filter(p=>/\s200\s/.test(txt(p.status))).map(p=>p.prop||{}))}));
}
function auth(c){return 'Basic '+btoa(String.fromCharCode(...new TextEncoder().encode(c.account+':'+c.password)));}
export async function dav(url,c,method,body,options={},transport=fetch){
  let response;try{let target=appleURL(url);for(let redirects=0;redirects<4;redirects++){response=await transport(target,{method,redirect:'manual',headers:{Authorization:auth(c),'Content-Type':method==='PUT'?'text/calendar; charset=utf-8':'application/xml; charset=utf-8',...options},body,signal:AbortSignal.timeout(18000)});if(![301,302,307,308].includes(response.status))break;if(redirects===3)throw Error();target=appleURL(response.headers.get('location'),target);}}catch{throw new CalendarError('Apple Calendar is not responding. Try again.',502);}
  // Redirects are followed only after the target passes the strict Apple host allowlist.
  if(response.status===401||response.status===403)throw new CalendarError('Apple did not accept this connection. Check your Apple Account and app-specific password.',401);
  if(response.status===412)throw new CalendarError('This task already has a calendar event. Refresh the day to find it.',409);
  if(!response.ok)throw new CalendarError('Apple Calendar could not complete this request. Try again.',502);
  if(response.headers.get('content-length')&&Number(response.headers.get('content-length'))>4000000)throw new CalendarError('This calendar response is too large. Choose fewer calendars.',413);
  const reader=response.body?.getReader();if(!reader)return '';
  const chunks=[];let size=0;for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>4000000){await reader.cancel();throw new CalendarError('This calendar response is too large. Choose fewer calendars.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}return new TextDecoder().decode(bytes);
}
const props=content=>'<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>'+content+'</d:prop></d:propfind>';
export async function discover(c,transport=fetch){
  const root='https://caldav.icloud.com/';
  const p=responses(await dav(root,c,'PROPFIND',props('<d:current-user-principal/>'),{Depth:'0'},transport));
  const principal=p.map(r=>txt(r.props['current-user-principal']?.href)).find(Boolean);if(!principal)throw new CalendarError('Apple could not find your calendar account.',502);
  const principalURL=appleURL(principal,root);
  const h=responses(await dav(principalURL,c,'PROPFIND',props('<c:calendar-home-set/>'),{Depth:'0'},transport));
  const home=h.map(r=>txt(r.props['calendar-home-set']?.href)).find(Boolean);if(!home)throw new CalendarError('Apple could not find your iCloud calendars.',502);
  const homeURL=appleURL(home,principalURL);
  const rows=responses(await dav(homeURL,c,'PROPFIND',props('<d:displayname/><d:resourcetype/><d:current-user-privilege-set/><c:supported-calendar-component-set/>'),{Depth:'1'},transport));
  const calendars=[];
  for(const row of rows){
    if(!Object.hasOwn(row.props.resourcetype||{},'calendar'))continue;
    const components=arr(row.props['supported-calendar-component-set']?.comp);
    if(components.length&&!components.some(v=>v['@_name']==='VEVENT'))continue;
    const url=appleURL(row.href,homeURL),hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(url));
    const privileges=arr(row.props['current-user-privilege-set']?.privilege);
    const writable=!privileges.length||privileges.some(v=>['all','write','write-content','bind'].some(k=>Object.hasOwn(v,k)));
    calendars.push({id:Array.from(new Uint8Array(hash)).map(v=>v.toString(16).padStart(2,'0')).join('').slice(0,32),name:txt(row.props.displayname).trim().slice(0,160)||'Calendar',url,writable});
  }
  if(!calendars.length)throw new CalendarError('No iCloud event calendars were found. Calendars from Gmail or Outlook are separate accounts.');
  if(calendars.length>100)throw new CalendarError('Too many calendars were returned.',413);return calendars;
}
export function validDay(day){return typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&!isNaN(Date.parse(day))&&new Date(day+'T00:00:00Z').toISOString().slice(0,10)===day;}
export function validZone(zone){try{if(typeof zone!=='string'||zone.length>100)throw Error();new Intl.DateTimeFormat('en',{timeZone:zone}).format();return zone;}catch{throw new CalendarError('Choose a valid time zone.');}}
export function localInstant(day,time,zone){
  validZone(zone);if(!validDay(day)||!/^\d{2}:\d{2}$/.test(time)||Number(time.slice(0,2))>23||Number(time.slice(3))>59)throw new CalendarError('Choose a valid date and time.');
  const target=Date.parse(day+'T'+time+':00Z'),fmt=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  let value=target;
  for(let i=0;i<4;i++){const p=Object.fromEntries(fmt.formatToParts(new Date(value)).map(p=>[p.type,p.value]));const represented=Date.parse(p.year+'-'+p.month+'-'+p.day+'T'+p.hour+':'+p.minute+':'+p.second+'Z');const offset=target-represented;if(!offset)return new Date(value).toISOString();value+=offset;}
  throw new CalendarError('That time does not exist because the clocks change. Choose another time.');
}
export function dayRange(day,zone){if(!validDay(day))throw new CalendarError('Choose a valid day.');const next=new Date(Date.parse(day+'T12:00:00Z')+86400000).toISOString().slice(0,10);return {start:localInstant(day,'00:00',zone),end:localInstant(next,'00:00',zone)};}
const compact=s=>s.replace(/[-:]/g,'').replace('.000','');
function instant(t,zone,prop){
  if(t.zone===ICAL.Timezone.localTimezone&&prop?.getParameter('tzid'))zone=validZone(prop.getParameter('tzid'));
  if(t.isDate||t.zone===ICAL.Timezone.localTimezone)return localInstant(t.toString().slice(0,10),t.isDate?'00:00':t.toString().slice(11,16),zone);
  return new Date(t.toUnixTime()*1000).toISOString();
}
export function parseEvents(source,calendar,range,zone){
  try{
    const comp=new ICAL.Component(ICAL.parse(source)),rows=[];
    for(const item of comp.getAllSubcomponents('vevent')){
      // Servers must expand recurrence in the requested day. Never silently use its master.
      if(item.hasProperty('rrule')||item.hasProperty('rdate'))throw new CalendarError('Apple did not expand a repeating event. This day could not be refreshed.',502);
      if(item.getFirstPropertyValue('status')==='CANCELLED')continue;
      const event=new ICAL.Event(item,{exceptions:[]});if(!event.startDate)throw Error();
      const start=instant(event.startDate,zone,item.getFirstProperty('dtstart')),end=instant(event.endDate,zone,item.getFirstProperty('dtend'));
      if(end<=range.start||start>=range.end)continue;
      const uid=String(event.uid||'').slice(0,512),rid=String(event.recurrenceId||event.startDate);
      rows.push({id:calendar.id+':'+uid+':'+rid,uid,calendarId:calendar.id,calendar:calendar.name,title:String(event.summary||'Untitled event').slice(0,300),start,end,allDay:event.startDate.isDate,taskId:String(item.getFirstPropertyValue('x-lifemap-task-id')||'').slice(0,200),busy:item.getFirstPropertyValue('transp')!=='TRANSPARENT'});
      if(rows.length>500)throw new CalendarError('Too many events for one day.',413);
    }return rows;
  }catch(e){if(e instanceof CalendarError)throw e;throw new CalendarError('An Apple Calendar event could not be read. This day was not refreshed.',502);}
}
export async function eventsForDay(c,calendars,day,zone,transport=fetch){
  const range=dayRange(day,zone),start=compact(range.start),end=compact(range.end);
  const body='<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data><c:expand start="'+start+'" end="'+end+'"/></c:calendar-data></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"><c:time-range start="'+start+'" end="'+end+'"/></c:comp-filter></c:comp-filter></c:filter></c:calendar-query>';
  const result=[];for(const calendar of calendars){for(const r of responses(await dav(calendar.url,c,'REPORT',body,{Depth:'1'},transport))){const data=txt(r.props['calendar-data']);if(data)result.push(...parseEvents(data,calendar,range,zone));}if(result.length>500)throw new CalendarError('Too many events for one day.',413);}
  return result.sort((a,b)=>a.start.localeCompare(b.start)||a.title.localeCompare(b.title));
}
function icalText(v){return String(v).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
function fold(line){let out='',part='',size=0;for(const c of line){const bytes=new TextEncoder().encode(c).length;if(size+bytes>74){out+=part+'\r\n ';part='';size=1;}part+=c;size+=bytes;}return out+part;}
export function makeEvent({title,taskId,start,end,uid},now=new Date().toISOString()){
  if(typeof title!=='string'||!title.trim()||title.length>300||typeof taskId!=='string'||!taskId||taskId.length>200||typeof uid!=='string'||!/^[a-f0-9-]+@lifemap$/.test(uid))throw new CalendarError('This task could not be scheduled.');
  if(!Number.isFinite(Date.parse(start))||!Number.isFinite(Date.parse(end))||Date.parse(end)<=Date.parse(start)||Date.parse(end)-Date.parse(start)>86400000)throw new CalendarError('Choose an end time after the start, within 24 hours.');
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Life Map//Apple Calendar//EN','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+compact(now),'DTSTART:'+compact(new Date(start).toISOString()),'DTEND:'+compact(new Date(end).toISOString()),'SUMMARY:'+icalText(title.trim()),'X-LIFEMAP-TASK-ID:'+icalText(taskId),'END:VEVENT','END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
}
export async function seal(value,key,owner){
  const iv=crypto.getRandomValues(new Uint8Array(12)),k=await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),'AES-GCM',false,['encrypt']);
  const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode(owner)},k,new TextEncoder().encode(JSON.stringify(value)));
  return JSON.stringify({iv:btoa(String.fromCharCode(...iv)),data:btoa(String.fromCharCode(...new Uint8Array(encrypted)))});
}
export async function unseal(value,key,owner){
  const v=JSON.parse(value),k=await crypto.subtle.importKey('raw',Uint8Array.from(atob(key),c=>c.charCodeAt(0)),'AES-GCM',false,['decrypt']);
  return JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:Uint8Array.from(atob(v.iv),c=>c.charCodeAt(0)),additionalData:new TextEncoder().encode(owner)},k,Uint8Array.from(atob(v.data),c=>c.charCodeAt(0)))));
}
