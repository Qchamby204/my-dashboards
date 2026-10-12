import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../../reminders-sw.js',import.meta.url),'utf8');
function boot(){const events={},shown=[],opened=[];const self={location:{href:'https://qchamby204.github.io/my-dashboards/reminders-sw.js'},addEventListener:(name,fn)=>events[name]=fn,registration:{showNotification:(title,options)=>{shown.push({title,options});return Promise.resolve();}},clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};vm.runInNewContext(code,{self,URL});return {events,shown,opened};}
test('push shows a visible notification and only accepts dashboard destinations',async()=>{
 const h=boot();for(const url of ['https://evil.test/','https://qchamby204.github.io/other-app/','javascript:alert(1)','https://qchamby204.github.io/my-dashboards/life-map.html?token=secret']){let pending;h.events.push({data:{json:()=>({title:'Hello',body:'Reminder',url})},waitUntil:p=>pending=p});await pending;assert.equal(h.shown.at(-1).options.data.url,'https://qchamby204.github.io/my-dashboards/reminders.html');}
 let pending;h.events.push({data:{json:()=>({title:'Library',url:'https://qchamby204.github.io/my-dashboards/the-library.html'})},waitUntil:p=>pending=p});await pending;assert.equal(h.shown.at(-1).options.data.url,'https://qchamby204.github.io/my-dashboards/the-library.html');assert.equal(h.events.fetch,undefined,'push worker never intercepts dashboard data');
});
test('malformed push still displays a safe fallback; tapping opens its destination',async()=>{const h=boot();let pending;h.events.push({data:{json:()=>{throw Error();}},waitUntil:p=>pending=p});await pending;let closed=false;h.events.notificationclick({notification:{close:()=>closed=true,data:h.shown[0].options.data},waitUntil:p=>pending=p});await pending;assert(closed);assert.equal(h.opened[0],'https://qchamby204.github.io/my-dashboards/reminders.html');});
