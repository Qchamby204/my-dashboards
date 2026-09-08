import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../courier.html',import.meta.url),'utf8');
const script=html.split('<script>\n// ---------- constants ----------')[1].split('</script>')[0];
class Element extends EventTarget {
  constructor(){super();this.textContent='';this.innerHTML='';this.value='';this.disabled=false;this.attrs={};this.classList={add(){},remove(){}};}
  setAttribute(k,v){this.attrs[k]=v;}
}
class Audio extends Element {
  constructor(){super();this.currentTime=0;this.duration=NaN;this.paused=true;this.ended=false;this.playbackRate=1;this.requests=0;}
  set src(v){this.source=v;this.sourceChanges=(this.sourceChanges||0)+1;this.error=null;this.currentTime=0;this.duration=NaN;this.ended=false;this.paused=true;}
  get src(){return this.source;}
  play(){this.requests++;if(this.reject)return Promise.reject(this.reject);this.paused=false;this.ended=false;this.dispatchEvent(new Event('play'));return Promise.resolve();}
  pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}
  removeAttribute(){this.src='';}
  load(){}
  metadata(seconds){this.duration=seconds;this.dispatchEvent(new Event('loadedmetadata'));}
  finish(){this.currentTime=this.duration;this.ended=true;this.paused=true;this.dispatchEvent(new Event('ended'));}
}
function harness(saved){
  const nodes=new Map(),storage=new Map(saved?[['courier:state',JSON.stringify(saved)]]:[]),audio=new Audio();nodes.set('audio',audio);
  const media={handlers:{},setActionHandler(k,v){this.handlers[k]=v;},setPositionState(v){this.position=v;}};
  const node=id=>{if(!nodes.has(id))nodes.set(id,new Element());return nodes.get(id);};
  const context=vm.createContext({document:{getElementById:node,addEventListener(){},hidden:false},window:{addEventListener(){}},navigator:{mediaSession:media},MediaMetadata:class{constructor(data){Object.assign(this,data);}},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},URL,console,Event,setTimeout,clearTimeout});
  vm.runInContext(script,context);
  const run=code=>vm.runInContext(code,context);
  run(`manifest={days:[{date:'2026-09-07',blocks:[{id:'a',audio:'a.mp3',label:'A',title:'First',minutes:2},{id:'text',audio:'',label:'Text',title:'Read',minutes:9},{id:'b',audio:'b.mp3',label:'B',title:'Second',minutes:3},{id:'tail',audio:'',label:'Text',title:'Read',minutes:1}]}]};ui.day='2026-09-07';render=()=>updatePlayback();wireEvents();`);
  return {run,audio,node,storage,media};
}
test('a section play continues automatically, skips text-only blocks, and stops at the final audio',async()=>{
  const h=harness();h.run("play('a')");h.audio.metadata(120);h.audio.finish();
  assert.equal(h.run('ui.current'),'b');assert.equal(h.audio.currentTime,0);assert.equal(h.audio.paused,false);
  assert.deepEqual(JSON.parse(h.run('JSON.stringify(state.listened)')),{'2026-09-07':['a']});
  h.audio.metadata(180);h.audio.finish();assert.equal(h.run('ui.current'),'b');assert.equal(h.node('pNext').disabled,true);
  assert.match(h.node('pStatus').textContent,/End of this edition/);assert.equal(h.audio.requests,2);
});
test('turning off continuation stops at section end; Next still skips text-only content',()=>{
  const h=harness();h.node('pContinue').checked=false;h.node('pContinue').dispatchEvent(new Event('change'));
  h.run("play('a')");h.audio.metadata(120);h.audio.finish();assert.equal(h.run('ui.current'),'a');
  h.node('pNext').dispatchEvent(new Event('click'));assert.equal(h.run('ui.current'),'b');
});
test('live timing follows metadata, seeking, playback speed, and excludes text-only sections',()=>{
  const h=harness();h.run("play('a')");assert.equal(h.node('pSeek').disabled,true);assert.match(h.node('pQueueTime').textContent,/About 5:00/);
  h.audio.metadata(100);h.audio.currentTime=40;h.audio.dispatchEvent(new Event('timeupdate'));
  assert.equal(h.node('pTime').textContent,'0:40 elapsed / 1:40');assert.equal(h.node('pRemaining').textContent,'1:00 left');
  h.audio.playbackRate=2;h.audio.dispatchEvent(new Event('ratechange'));assert.equal(h.node('pRemaining').textContent,'0:30 left at 2×');
  assert.equal(h.node('pQueueTime').textContent,'About 2:00 left in edition at 2×');
  h.node('pSeek').value=500;h.node('pSeek').dispatchEvent(new Event('input'));assert.equal(h.audio.currentTime,50);
  assert.equal(h.node('pSeek').attrs['aria-valuetext'],'0:50 of 1:40');
});
test('rapid section changes cancel old resume handlers and preserve each position',()=>{
  const h=harness();h.run("state.positions={'2026-09-07/a':50,'2026-09-07/b':25};play('a');play('b')");
  h.audio.metadata(180);assert.equal(h.audio.currentTime,25);
  h.audio.currentTime=67;h.run("play('a')");h.audio.metadata(120);assert.equal(h.audio.currentTime,50);
  assert.equal(h.run("state.positions['2026-09-07/b']"),67);
  h.audio.currentTime=33;h.audio.pause();assert.equal(h.run("state.positions['2026-09-07/a']"),33);
});
test('blocked playback reports a manual resume action and stale failures cannot affect the next section',async()=>{
  const h=harness();h.audio.reject={name:'NotAllowedError'};h.run("play('a')");await new Promise(resolve=>setImmediate(resolve));
  assert.equal(h.node('pStatus').textContent,'Tap Play to continue listening.');
  h.audio.reject=null;h.run("play('a')");assert.equal(h.node('pStatus').textContent,'');
  h.audio.reject={name:'NotAllowedError'};h.run("play('b')");h.audio.reject=null;h.run("play('a')");
  await new Promise(resolve=>setImmediate(resolve));assert.equal(h.node('pStatus').textContent,'');
});
test('Play all restarts the first playable section and a day change clears pending resume',()=>{
  const h=harness();h.run("play('a')");h.audio.metadata(120);h.audio.currentTime=40;
  h.node('playAll').dispatchEvent(new Event('click'));h.audio.metadata(120);assert.equal(h.audio.currentTime,0);
  h.run("play('b')");h.node('day').value='2026-09-07';h.node('day').dispatchEvent(new Event('change'));
  assert.equal(h.run('ui.current'),null);assert.equal(h.run('resumeListener'),null);
});
test('retry reloads a failed resource and restores its position after metadata',()=>{
  const h=harness();h.run("play('a')");h.audio.metadata(120);h.audio.currentTime=48;h.audio.pause();
  h.audio.error={code:2};const before=h.audio.sourceChanges;h.run("play('a')");
  assert.equal(h.audio.sourceChanges,before+1);h.audio.metadata(120);assert.equal(h.audio.currentTime,48);
});
test('resume selection, actual durations and continuation survive reopening Courier',()=>{
  const h=harness();h.run("play('b')");h.audio.metadata(155);h.audio.currentTime=47;h.audio.pause();
  h.node('pContinue').checked=false;h.node('pContinue').dispatchEvent(new Event('change'));
  const reopened=harness(JSON.parse(h.storage.get('courier:state')));
  assert.equal(reopened.run('ui.queue'),false);assert.equal(reopened.run('resumeBlock().id'),'b');
  reopened.node('resumeListening').dispatchEvent(new Event('click'));reopened.audio.metadata(155);
  assert.equal(reopened.audio.currentTime,47);assert.equal(reopened.run('measuredDurations.size'),1);
  reopened.run("play('a')");reopened.audio.metadata(100);
  assert.equal(reopened.node('pQueueTime').textContent,'4:15 left in edition');
});
test('native media actions preserve play semantics, seek safely and clear on edition change',()=>{
  const h=harness();h.run("play('a')");h.audio.metadata(120);
  assert.equal(h.media.metadata.title,'A: First');assert.equal(h.media.playbackState,'playing');
  const requests=h.audio.requests;h.media.handlers.play();assert.equal(h.audio.requests,requests);
  h.media.handlers.seekto({seekTime:55});assert.equal(h.media.position.position,55);
  h.media.handlers.seekbackward({seekOffset:90});assert.equal(h.audio.currentTime,0);
  h.media.handlers.pause();assert.equal(h.audio.paused,true);assert.equal(h.media.playbackState,'paused');
  h.media.handlers.play();assert.equal(h.audio.paused,false);
  h.media.handlers.nexttrack();assert.equal(h.run('ui.current'),'b');assert.equal(h.media.position,undefined);
  h.node('day').value='2026-09-07';h.node('day').dispatchEvent(new Event('change'));
  assert.equal(h.media.metadata,null);assert.equal(h.media.playbackState,'none');
});
test('buffering status clears when playback actually resumes',()=>{
  const h=harness();h.run("play('a')");h.audio.dispatchEvent(new Event('waiting'));assert.match(h.node('pStatus').textContent,/Buffering/);
  h.audio.dispatchEvent(new Event('playing'));assert.equal(h.node('pStatus').textContent,'');
});
