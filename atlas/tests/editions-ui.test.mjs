import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createEditionRefreshUI} from '../edition-refresh-ui.mjs';

test('closing a pending edition check discards its result; failed saves require a fresh acknowledged review',async()=>{
  const previous=globalThis.document,nodes=new Map(),calls=[];
  function node(id){if(!nodes.has(id))nodes.set(id,{open:false,disabled:false,checked:false,innerHTML:'',textContent:'',handlers:new Map(),addEventListener(type,fn){this.handlers.set(type,fn);},showModal(){this.open=true;},close(){this.open=false;this.handlers.get('close')?.();}});return nodes.get(id);}
  globalThis.document={querySelector:selector=>node(selector),addEventListener(){}};
  const api=(path,method,body)=>new Promise((resolve,reject)=>calls.push({path,method,body,resolve,reject}));
  const esc=value=>String(value).replaceAll('<','&lt;').replaceAll('>','&gt;');
  const plan={digest:'a'.repeat(64),revision:4,added:1,kept:0,retained:2,mode:'managed',published:{refresh:{checked_at:'2026-09-07T12:00:00Z',latest_edition:'2026-09-07',latest_lesson_edition:'2026-09-06',edition_count:2,lesson_count:1},editions:[{day:'2026-09-07',lessons:0},{day:'2026-09-06',lessons:1}]},rows:[{title:'A <clear> opening',day:'2026-09-06',track:'Communication',task:'Try a short opening.',drill:'',action:'Add'}]};
  try{
    const ui=createEditionRefreshUI({api,getPractice:()=>null,esc,formatDay:d=>d,dateTime:d=>d,load:async()=>{},toast(){},blocked:()=>false});
    let pending=ui.check();assert.equal(node('#edition-refresh-consent').disabled,true);node('#edition-refresh-dialog').close();calls[0].resolve(plan);await pending;
    node('#edition-refresh-consent').checked=true;node('#edition-refresh-consent').handlers.get('change')();assert.equal(node('#edition-refresh-confirm').disabled,true);
    pending=ui.check();calls[1].resolve(plan);await pending;
    assert.equal(node('#edition-refresh-consent').checked,false);assert.equal(node('#edition-refresh-consent').disabled,false);assert.equal(node('#edition-refresh-confirm').disabled,true);
    assert.match(node('#edition-refresh-preview').innerHTML,/A &lt;clear&gt; opening/);assert.match(node('#edition-refresh-preview').innerHTML,/No lessons in this edition/);
    node('#edition-refresh-consent').checked=true;node('#edition-refresh-consent').handlers.get('change')();assert.equal(node('#edition-refresh-confirm').disabled,false);
    pending=node('#edition-refresh-confirm').handlers.get('click')();assert.equal(ui.saving,true);assert.equal(node('#edition-refresh-retry').disabled,true);assert.deepEqual(calls[2].body,{digest:plan.digest,revision:4});
    let prevented=false;node('#edition-refresh-dialog').handlers.get('cancel')({preventDefault(){prevented=true;}});assert.equal(prevented,true);
    calls[2].reject(Error('Courier changed after review.'));await pending;
    assert.equal(ui.saving,false);assert.equal(node('#edition-refresh-confirm').disabled,true);assert.equal(node('#edition-refresh-retry').disabled,false);assert.match(node('#edition-refresh-error').textContent,/Check again/);
    node('#edition-refresh-consent').checked=true;node('#edition-refresh-consent').handlers.get('change')();assert.equal(node('#edition-refresh-confirm').disabled,true);
  }finally{globalThis.document=previous;}
});
