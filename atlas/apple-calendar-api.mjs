import {CalendarError,discover,eventsForDay,seal,unseal,localInstant,makeEvent,dav,validDay,validZone} from './apple-calendar-core.mjs';
export async function calendarAPI({db,owner,env,path,method,b,url,now,transport=fetch}){
  if(!env.APPLE_CALENDAR_KEY)throw new CalendarError('Apple Calendar setup is temporarily unavailable.',503);
  const row=await db.prepare('SELECT * FROM atlas_apple_calendar WHERE owner=?').bind(owner).first();
  const calendars=row?JSON.parse(row.calendars_json):[],selected=row?JSON.parse(row.selected_json):[];
  const publicList=()=>calendars.map(({id,name,writable})=>({id,name,writable,selected:selected.includes(id)}));
  if(path==='/api/apple-calendar/status'&&method==='GET')return {connected:!!row,calendars:publicList()};
  if(path==='/api/apple-calendar/connect'&&method==='POST'){
    const account=String(b.account||'').trim(),password=String(b.password||'').trim();
    if(!/^[^\s:@]+@[^\s:@]+\.[^\s:@]+$/.test(account)||account.length>254)throw new CalendarError('Enter your Apple Account email address.');
    if(!/^[a-z]{4}(?:-[a-z]{4}){3}$/i.test(password))throw new CalendarError('Enter an Apple app-specific password in xxxx-xxxx-xxxx-xxxx format.');
    const c={account,password},found=await discover(c,transport),secret=await seal(c,env.APPLE_CALENDAR_KEY,owner);
    // Require a calendar selection before any event is read or sent to Life Map.
    await db.prepare('INSERT INTO atlas_apple_calendar (owner,credentials,calendars_json,selected_json,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(owner) DO UPDATE SET credentials=excluded.credentials,calendars_json=excluded.calendars_json,selected_json=excluded.selected_json,updated_at=excluded.updated_at').bind(owner,secret,JSON.stringify(found),'[]',now).run();
    return {connected:true,calendars:found.map(({id,name,writable})=>({id,name,writable,selected:false}))};
  }
  if(path==='/api/apple-calendar/disconnect'&&method==='POST'){
    await db.prepare('DELETE FROM atlas_apple_calendar WHERE owner=?').bind(owner).run();return {connected:false};
  }
  if(!row)throw new CalendarError('Connect Apple Calendar first.',409);
  if(path==='/api/apple-calendar/select'&&method==='POST'){
    if(!Array.isArray(b.ids)||!b.ids.length||b.ids.length>8||new Set(b.ids).size!==b.ids.length||b.ids.some(id=>!calendars.some(c=>c.id===id)))throw new CalendarError('Choose between one and eight of your calendars.');
    const result=await db.prepare('UPDATE atlas_apple_calendar SET selected_json=?,updated_at=? WHERE owner=? AND updated_at=?').bind(JSON.stringify(b.ids),now,owner,row.updated_at).run();if(!result.meta?.changes)throw new CalendarError('The connection changed in another screen. Reload before selecting calendars.',409);return {saved:true};
  }
  if(!selected.length)throw new CalendarError('Choose which calendars to show in Life Map.',409);
  let c;try{c=await unseal(row.credentials,env.APPLE_CALENDAR_KEY,owner);}catch{throw new CalendarError('Reconnect Apple Calendar to continue.',409);}
  if(path==='/api/apple-calendar/events'&&method==='GET'){
    const day=url.searchParams.get('day'),zone=validZone(url.searchParams.get('zone')||'America/Winnipeg');
    return {day,zone,events:await eventsForDay(c,calendars.filter(c=>selected.includes(c.id)),day,zone,transport),refreshedAt:now};
  }
  if(path==='/api/apple-calendar/schedule'&&method==='POST'){
    const calendar=calendars.find(c=>c.id===b.calendarId&&selected.includes(c.id)&&c.writable);if(!calendar)throw new CalendarError('Choose a selected calendar you can edit.');
    if(!validDay(b.day))throw new CalendarError('Choose a valid day.');
    const zone=validZone(b.zone||'America/Winnipeg'),start=localInstant(b.day,b.start,zone),end=localInstant(b.day,b.end,zone);
    // A stable task UID makes retry safe. We never overwrite an existing Apple event.
    const uid=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(owner+':'+b.taskId)))).map(v=>v.toString(16).padStart(2,'0')).join('')+'@lifemap';
    const event=makeEvent({title:b.title,taskId:b.taskId,start,end,uid},now),eventURL=calendar.url.replace(/\/?$/,'/')+uid.replace('@','-')+'.ics';
    await dav(eventURL,c,'PUT',event,{'If-None-Match':'*'},transport);
    return {saved:true,taskId:b.taskId,day:b.day,uid};
  }
  throw new CalendarError('This calendar action was not found.',404);
}
