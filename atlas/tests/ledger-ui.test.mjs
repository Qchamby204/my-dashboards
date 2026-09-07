import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createLedgerUI} from '../ledger-ui.mjs';
import {localDay} from '../model.mjs';

test('an in-flight or rejected Ledger save keeps its date, revision and draft; explicit discard reloads it',async()=>{
  const previous=globalThis.document,nodes=new Map(),listeners=new Map();
  function node(id){if(!nodes.has(id))nodes.set(id,{id,open:false,disabled:false,value:'',textContent:'',handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;}});return nodes.get(id);}
  globalThis.document={querySelector:selector=>node(selector.slice(1)),addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);}};
  const form=node('ledger-day-form'),button=node('submit'),note=node('note'),tomorrow=node('tomorrow'),check=node('check');check.value='atlas:read';
  form.elements={note,tomorrow};form.querySelector=()=>button;form.querySelectorAll=selector=>selector.includes(':checked')?[check]:[note,tomorrow,check,button];
  const data={ledger:{habits:[{id:'atlas:read',title:'Read <something>',archived:false}],days:[],revision:7}};
  let rejectSave,request,loads=0,download,errorText='';
  const api=(path,method,body)=>{request={path,method,body};return new Promise((_,reject)=>{rejectSave=reject;});};
  let ui;
  const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const fire=async(type,target)=>{for(const fn of listeners.get(type)||[])await fn({target,preventDefault(){}});};
  const target=(key,value='')=>({dataset:{[key]:value},hasAttribute:name=>name==='data-'+key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()),closest(){return this;}});
  try{
    ui=createLedgerUI({api,getData:()=>data,load:async()=>{loads++;},render:()=>ui.daily(),error:message=>{errorText=message;},toast(){},esc:escape,downloadJSON:value=>{download=value;},blocked:()=>ui.dirty||ui.saving});
    assert.ok(ui.daily().includes('Read &lt;something&gt;'));
    note.value='Keep this <note>';tomorrow.value='A quiet start';await fire('input',{closest:()=>form});assert.equal(ui.dirty,true);
    data.ledger.revision=8;assert.ok(ui.daily().includes('Keep this &lt;note&gt;'));
    const pending=fire('submit',form);assert.equal(ui.saving,true);assert.equal(note.disabled,true);
    assert.equal(request.body.revision,7);assert.equal(request.body.day.date,localDay());
    await fire('click',target('ledgerDate','2025-01-01'));assert.match(errorText,/draft/);
    rejectSave(Error('Another device saved first.'));await pending;
    assert.equal(ui.dirty,true);assert.equal(ui.saving,false);assert.equal(note.disabled,false);assert.match(node('ledger-save-error').textContent,/Another device/);
    await fire('click',target('ledgerDownload'));assert.equal(download.day.note,'Keep this <note>');assert.equal(download.day.revision,7);
    await fire('click',target('ledgerReload'));assert.equal(ui.dirty,false);assert.equal(loads,1);
  }finally{globalThis.document=previous;}
});
