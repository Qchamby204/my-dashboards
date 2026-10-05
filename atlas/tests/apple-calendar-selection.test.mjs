import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../apple-calendar-page.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function screen(checked){
 const nodes=new Map(),calls=[],buttons=[{disabled:false}];
 const node=()=>({value:'',hidden:false,textContent:'',listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},replaceChildren(){},append(){},scrollIntoView(){}});
 const get=selector=>{if(!nodes.has(selector))nodes.set(selector,node());return nodes.get(selector);};
 const document={querySelector:get,querySelectorAll:selector=>selector==='button'?buttons:selector==='#calendar-list input:checked'?checked.map(value=>({value})):[],createElement:node,createTextNode:value=>({textContent:value})};
 const calendars=[{id:'home',name:'Home',selected:false,writable:true},{id:'work',name:'Work',selected:false,writable:true}];
 const fetch=async(url,options)=>{calls.push({url,options});let data;if(url.endsWith('/select')){const ids=JSON.parse(options.body).ids;calendars.forEach(c=>c.selected=ids.includes(c.id));data={ok:true};}else if(url.endsWith('/status'))data={connected:true,calendars};else data={day:'2026-10-04',zone:'America/Winnipeg',events:[],refreshedAt:'2026-10-05T04:00:00Z'};return {ok:true,json:async()=>data};};
 vm.runInNewContext(source,{document,fetch,location:{search:'?day=2026-10-04&zone=America%2FWinnipeg',hash:'',origin:'https://private.example'},window:{opener:null,addEventListener(){}},URLSearchParams,Intl,Date,setTimeout,Blob,URL});
 await tick();get('#selection-form').listeners.submit({preventDefault(){}});await tick();
 return {nodes,calls,buttons};
}
for(const checked of [['home','work'],['work']])test('calendar selection submits every checked calendar: '+checked.join(', '),async()=>{
 const {nodes,calls,buttons}=await screen(checked);
 const selected=calls.filter(c=>c.url.endsWith('/select'));
 assert.equal(selected.length,1);assert.deepEqual(JSON.parse(selected[0].options.body).ids,checked);
 assert.equal(calls.filter(c=>c.url.includes('/events?')).length,1);
 assert.equal(nodes.get('#selection').hidden,true);assert.equal(nodes.get('#status').textContent,'Your day is up to date.');assert.equal(buttons[0].disabled,false);
});
test('empty calendar selection stays open and explains what to choose',async()=>{
 const {nodes,calls,buttons}=await screen([]);
 assert.equal(calls.some(c=>c.url.endsWith('/select')),false);assert.equal(nodes.get('#selection').hidden,false);
 assert.equal(nodes.get('#status').textContent,'Choose at least one calendar.');assert.equal(buttons[0].disabled,false);
});
