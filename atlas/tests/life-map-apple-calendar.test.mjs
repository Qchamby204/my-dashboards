import test from 'node:test';
import assert from 'node:assert/strict';
import {appleURL,responses,discover,dav,localInstant,dayRange,parseEvents,makeEvent,seal,unseal} from '../apple-calendar-core.mjs';
import {calendarAPI} from '../apple-calendar-api.mjs';
const calendar={id:'a'.repeat(32),name:'Home',url:'https://p01-caldav.icloud.com/123/calendars/home/',writable:true};
const c={account:'test@example.com',password:'aaaa-bbbb-cccc-dddd'};
const wrap=content=>'<d:multistatus xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:response><d:href>'+calendar.url+'</d:href><d:propstat><d:prop>'+content+'</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>';
const event=lines=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:test\r\nSUMMARY:Walk Hudson\r\n'+lines.join('\r\n')+'\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
test('Apple host allowlist rejects credential-bearing and third-party addresses',()=>{
 for(const url of ['http://caldav.icloud.com/','https://evil.com/','https://caldav.icloud.com.evil.test/','https://user@caldav.icloud.com/','https://caldav.icloud.com:443/a?bad=x','https://caldav.icloud.com/#x'])assert.throws(()=>appleURL(url));
 assert.equal(appleURL('/123/calendars/home/',calendar.url),calendar.url);
 assert.throws(()=>responses('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///etc/passwd">]><x/>'));
});
test('discovery resolves namespaced principal, calendar home, calendar privileges',async()=>{
 const bodies=[wrap('<d:current-user-principal><d:href>/123/principal/</d:href></d:current-user-principal>'),wrap('<c:calendar-home-set><d:href>https://p01-caldav.icloud.com/123/calendars/</d:href></c:calendar-home-set>'),wrap('<d:displayname>Home &amp; Family</d:displayname><d:resourcetype><d:collection/><c:calendar/></d:resourcetype><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set><d:current-user-privilege-set><d:privilege><d:read/></d:privilege></d:current-user-privilege-set>')];
 const calls=[];const found=await discover(c,async(url,options)=>{calls.push({url,options});return new Response(bodies.shift(),{status:207});});
 assert.equal(found[0].name,'Home & Family');assert.equal(found[0].writable,false);assert.equal(found[0].id.length,32);assert.equal(calls.length,3);assert.equal(calls[2].options.headers.Depth,'1');
});
test('safe Apple redirects work and external redirects never receive secrets',async()=>{
 let calls=0;await assert.rejects(dav(calendar.url,c,'PROPFIND','',{},async()=>{calls++;return new Response(null,{status:302,headers:{Location:'https://evil.test/'}});}));assert.equal(calls,1);
 calls=0;await dav(calendar.url,c,'PROPFIND','',{},async()=>{calls++;return calls===1?new Response(null,{status:301,headers:{Location:'https://p02-caldav.icloud.com/123/'}}):new Response('',{status:207});});assert.equal(calls,2);
});
test('Winnipeg times and DST day lengths match the real calendar',()=>{
 assert.equal(localInstant('2026-10-04','09:00','America/Winnipeg'),'2026-10-04T14:00:00.000Z');
 const spring=dayRange('2026-03-08','America/Winnipeg'),fall=dayRange('2026-11-01','America/Winnipeg');
 assert.equal((Date.parse(spring.end)-Date.parse(spring.start))/3600000,23);assert.equal((Date.parse(fall.end)-Date.parse(fall.start))/3600000,25);
 assert.throws(()=>localInstant('2026-03-08','02:30','America/Winnipeg'));assert.throws(()=>dayRange('2026-02-30','America/Winnipeg'));
});
test('expanded recurrence instances, all-day, cancellation, linked task and non-local timezone',()=>{
 const range=dayRange('2026-10-04','America/Winnipeg');
 const rows=parseEvents(event(['RECURRENCE-ID:20261004T140000Z','DTSTART:20261004T140000Z','DTEND:20261004T143000Z','X-LIFEMAP-TASK-ID:p1']),calendar,range,'America/Winnipeg');assert.equal(rows[0].taskId,'p1');assert.equal(rows[0].start,'2026-10-04T14:00:00.000Z');
 assert.equal(parseEvents(event(['DTSTART;VALUE=DATE:20261004','DTEND;VALUE=DATE:20261005']),calendar,range,'America/Winnipeg')[0].allDay,true);
 assert.equal(parseEvents(event(['DTSTART:20261004T140000Z','DTEND:20261004T143000Z','STATUS:CANCELLED']),calendar,range,'America/Winnipeg').length,0);
 assert.equal(parseEvents(event(['DTSTART;TZID=America/Toronto:20261004T090000','DTEND;TZID=America/Toronto:20261004T093000']),calendar,range,'America/Winnipeg')[0].start,'2026-10-04T13:00:00.000Z');
 assert.throws(()=>parseEvents(event(['DTSTART:20261004T140000Z','DTEND:20261004T143000Z','RRULE:FREQ=DAILY']),calendar,range,'America/Winnipeg'),/expand/);
});
test('calendar event generation escapes injection and round-trips a linked task',()=>{
 const source=makeEvent({title:'Meal prep\nATTENDEE:evil',taskId:'p1',uid:'abc@lifemap',start:'2026-10-04T14:00:00Z',end:'2026-10-04T14:30:00Z'},'2026-10-04T00:00:00.000Z');
 const rows=parseEvents(source,calendar,dayRange('2026-10-04','America/Winnipeg'),'America/Winnipeg');assert.equal(rows[0].title,'Meal prep\nATTENDEE:evil');assert.equal(rows[0].taskId,'p1');assert.ok(!source.includes('\r\nATTENDEE:'));
});
test('credentials are encrypted with owner binding; another owner cannot decrypt',async()=>{
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));const ciphertext=await seal(c,key,'owner1');assert.ok(!ciphertext.includes(c.password));assert.deepEqual(await unseal(ciphertext,key,'owner1'),c);await assert.rejects(unseal(ciphertext,key,'owner2'));
});
test('selected-calendar owner scope and duplicate-safe calendar writes',async()=>{
 const key=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),owner='owner1',row={credentials:await seal(c,key,owner),calendars_json:JSON.stringify([calendar]),selected_json:JSON.stringify([calendar.id])};
 const db={prepare(sql){assert.ok(sql.includes('WHERE owner=?'));return {bind(value){assert.equal(value,owner);return {first:async()=>row};}};}};
 const input={db,owner,env:{APPLE_CALENDAR_KEY:key},path:'/api/apple-calendar/schedule',method:'POST',now:'2026-10-04T00:00:00.000Z',b:{title:'Gym',taskId:'p1',calendarId:calendar.id,day:'2026-10-04',start:'09:00',end:'10:00',zone:'America/Winnipeg'}};
 let calls=0;const transport=async(url,o)=>{calls++;assert.equal(o.headers['If-None-Match'],'*');assert.equal(o.method,'PUT');assert.ok(o.body.includes('X-LIFEMAP-TASK-ID:p1'));return new Response(null,{status:201});};
 assert.equal((await calendarAPI({...input,transport})).saved,true);assert.equal(calls,1);
 await assert.rejects(calendarAPI({...input,b:{...input.b,calendarId:'other'},transport}));assert.equal(calls,1);
 await assert.rejects(calendarAPI({...input,transport:async()=>new Response(null,{status:412})}),/already has/);
});
