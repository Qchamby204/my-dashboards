import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
process.env.TZ='America/Winnipeg';
const html=readFileSync(new URL('../../communication-trainer.html',import.meta.url),'utf8');
const original=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
const extension=readFileSync(new URL('../../shared/communication-enhancements.js',import.meta.url),'utf8');

let uuidSerial=0;
function boot({speech=true,records={}}={}){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),intervals=new Map(),timeouts=new Map(),engines=[];let now=Date.parse('2026-09-08T12:00:00Z'),nextId=0;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.style={};this.attrs={};this.children=[];this.dataset={};this.value='';this.innerHTML='';this.hidden=false;this.classes=new Set();this.classList={add:(...keys)=>keys.forEach(k=>this.classes.add(k)),remove:key=>this.classes.delete(key),toggle:(key,on)=>{if(on)this.classes.add(key);else this.classes.delete(key);}};}
    set id(value){this._id=value;nodes.set(value,this);}get id(){return this._id;}
    set textContent(value){this._text=value;this.children=[];}get textContent(){return this._text||'';}
    setAttribute(key,value){this.attrs[key]=String(value);}removeAttribute(key){delete this.attrs[key];}
    appendChild(el){this.children.push(el);el.parentNode=this;return el;}before(el){el.parentNode=this;}
    remove(){this.parentNode=null;}focus(){this.focused=true;}select(){}click(){this.onclick?.();}
    querySelectorAll(){return [];}querySelector(){return null;}addEventListener(){}
    getContext(){return new Proxy({},{get:(obj,key)=>obj[key]??(()=>{}),set:(obj,key,value)=>(obj[key]=value,true)});}
  }
  const node=id=>{if(!nodes.has(id)){const n=new Element();n.id=id;}return nodes.get(id);};
  const on=(map,key,fn)=>{if(!map.has(key))map.set(key,[]);map.get(key).push(fn);};
  const storage=new Map([['mc_catsEnabled','[]'],['mc_customTopics',JSON.stringify([{cat:'custom',text:'Explain a familiar hobby'}])],['mc_proCatsAdded','true']]);
  for(const [key,value]of Object.entries(records))storage.set(key,value);
  const localStorage={blocked:false,blockedKey:null,getItem:key=>storage.get(key)??null,removeItem:key=>storage.delete(key),setItem(key,value){if(this.blocked||this.blockedKey===key)throw Error('Quota');storage.set(key,String(value));}};
  const document={readyState:'complete',hidden:false,currentScript:{src:'https://example.test/shared/communication-enhancements.js'},documentElement:{dataset:{atlasApp:'communication-trainer'}},getElementById:node,createElement:tag=>new Element(tag),head:new Element(),body:new Element(),addEventListener:(key,fn)=>on(events,key,fn),execCommand:()=>false};
  class Recognition{constructor(){engines.push(this);}start(){this.started=(this.started||0)+1;}abort(){this.aborted=true;}stop(){this.stopped=true;}}
  const window={scrollX:0,scrollY:0,addEventListener:(key,fn)=>on(windowEvents,key,fn),scrollTo(x,y){this.scrollX=x;this.scrollY=y;}};if(speech)window.SpeechRecognition=Recognition;
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({document,window,localStorage,navigator:{},crypto:{randomUUID:()=> 'practice-'+(++uuidSerial)},Date:Clock,URL,Blob,console,
    setInterval:fn=>{const id=++nextId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id),
    setTimeout:fn=>{const id=++nextId;timeouts.set(id,fn);return id;},clearTimeout:id=>timeouts.delete(id)});
  vm.runInContext(original+"\nDRILLS.push({id:'synthetic',name:'Explain clearly',skill:SKILLS[0].id,time:90,steps:()=>['Speak about a familiar topic.'],rubric:['Clear point','Useful example','Clear ending']});\n"+extension,context);
  const run=code=>vm.runInContext(code,context);
  run("uiConfirm=(title,body,label,action)=>{globalThis.importConfirm=action;};uiNote=message=>{globalThis.importMessage=message;};");
  const begin=()=>run("launchDrill(DRILLS.find(d=>d.id==='synthetic'))");
  const fire=(map,name)=>{for(const fn of map.get(name)||[])fn();};
  return {run,node,begin,storage,localStorage,window,document,engines,api:window.CommunicationImprovements,context,intervals,timeouts,
    advance(ms,fireTimers=true){now+=ms;if(fireTimers)for(const [id,fn]of [...intervals])if(intervals.has(id))fn();},
    hidden(value){document.hidden=value;fire(events,'visibilitychange');},pagehide(){fire(windowEvents,'pagehide');},
    undo(){node('undoToast').children.find(child=>child.tagName==='BUTTON').click();}};
}
function result(text,isFinal=true){const entry=[{transcript:text}];entry.isFinal=isFinal;return {resultIndex:0,results:[entry]};}

test('timer uses elapsed time, preserves fractional pause time and stays accurate through renders',()=>{
  const h=boot();h.begin();h.run('toggleTimer()');h.advance(10400);assert.equal(h.run('timerLeft'),80);
  h.run('togglePrep()');assert.equal(h.node('tbtn').textContent,'Pause');h.run('toggleTimer()');
  h.advance(3600000);assert.equal(h.run('timerLeft'),80);assert.equal(h.node('tbtn').textContent,'Resume');
  h.run('toggleTimer()');h.advance(79600);assert.equal(h.run('timerLeft'),0);assert.equal(h.run('timerInt'),null);
  assert.equal(h.node('tbtn').disabled,true);h.run('toggleTimer()');assert.equal(h.run('timerLeft'),0);
});
test('leaving the app or Train pauses controls and never silently restarts the microphone',()=>{
  const h=boot();h.begin();h.run('recToggle()');h.engines[0].onstart();h.advance(10000);h.hidden(true);
  assert.equal(h.run('recOn'),false);assert.equal(h.run('timerInt'),null);assert.equal(h.engines[0].aborted,true);
  h.advance(50000);h.hidden(false);assert.equal(h.run('timerLeft'),80);assert.equal(h.run('recOn'),false);
  h.run("recToggle()");h.engines[1].onstart();h.run("nav('learn')");assert.equal(h.run('recOn'),false);assert.equal(h.run('timerInt'),null);
});
test('late speech results, endings and errors cannot modify or stop a newer rep',()=>{
  const h=boot();h.begin();h.run('recToggle()');const first=h.engines[0];first.onstart();first.onresult(result('Old transcript',false));
  const late={result:first.onresult,end:first.onend,error:first.onerror};h.begin();h.run('importConfirm()');h.run('recToggle()');h.engines[1].onstart();
  late.result(result('Late old words'));late.end();late.error({error:'not-allowed'});
  assert.equal(h.run("curDrill.tx||''"),'');assert.equal(h.run('recOn'),true);assert.equal(h.engines[1].aborted,undefined);
  h.engines[1].onresult(result('New words'));assert.equal(h.run('curDrill.tx'),'New words');
});
test('dictation keeps displayed interim words when stopped and stops when time expires',()=>{
  const h=boot();h.begin();h.run('recToggle()');const engine=h.engines[0];engine.onstart();engine.onresult(result('A useful thought',false));
  h.advance(90000);assert.equal(h.run('recOn'),false);assert.equal(engine.aborted,true);assert.equal(h.run('curDrill.tx'),'A useful thought');
  assert.equal(h.run('curDrill.recSecs'),90);assert.equal(h.run('S.reps.length'),0);
});
test('unsupported or denied dictation leaves typing available and does not start a timer',()=>{
  const missing=boot({speech:false});missing.begin();missing.run('recToggle()');assert.equal(missing.node('txBox').focused,true);assert.equal(missing.run('recOn'),false);
  const denied=boot();denied.begin();denied.run('recToggle()');assert.equal(denied.run('timerInt'),null);denied.engines[0].onerror({error:'not-allowed'});
  assert.equal(denied.run('recOn'),false);assert.equal(denied.run('timerInt'),null);assert.equal(denied.node('recBtn').textContent,'Start dictation');
});
test('restart Undo cannot put an old transcript into a new rep or overwrite newer typing',()=>{
  const h=boot();h.begin();h.run("curDrill.tx='Previous words';resetRep()");h.begin();if(h.run('typeof importConfirm')==='function')h.run('importConfirm()');h.run("curDrill.tx='New work'");h.undo();assert.equal(h.run('curDrill.tx'),'New work');
  h.run('resetRep()');h.undo();assert.equal(h.run('curDrill.tx'),'New work');
  h.run("resetRep();curDrill.tx='Typed after reset'");h.undo();assert.equal(h.run('curDrill.tx'),'Typed after reset');
});
test('progress export includes saved grades, pending feedback and unsaved in-memory changes',()=>{
  const h=boot();h.run("S.grades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'A hobby',overall:70,scores:{clarity:7}}];S.pendingGrades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'Another hobby'}];save()");
  assert.equal(h.run('Store.dump().grades.length'),1);assert.equal(h.run('Store.dump().pendingGrades.length'),1);
  h.localStorage.blocked=true;h.run("S.prepNotes['A hobby']='Unsaved preparation';save()");assert(h.api.unsaved>0);assert.equal(h.node('communication-save-error').hidden,false);
  assert.equal(h.run("Store.dump().prepNotes['A hobby']"),'Unsaved preparation');assert.equal(h.run("Store.get('prepNotes',{})['A hobby']"),'Unsaved preparation');
  h.localStorage.blocked=false;h.run('save()');assert.equal(h.api.unsaved,0);assert.equal(JSON.parse(h.storage.get('mc_prepNotes'))['A hobby'],'Unsaved preparation');
});
test('invalid backups are rejected before writes, while older backups preserve omitted grades',async()=>{
  const h=boot(),before=h.storage.get('mc_catsEnabled');
  assert.throws(()=>h.api.validateBackup({reps:[{date:'invalid'}],catsEnabled:['changed']}));assert.equal(h.storage.get('mc_catsEnabled'),before);
  assert.throws(()=>h.api.validateBackup({reps:[],customTopics:[null]}));assert.throws(()=>h.api.validateBackup({assessments:[{date:'2026-09-08',scores:[]}]}));
  h.run("S.grades=[{date:'2026-09-08T12:00:00Z',drill:'Explain clearly',topic:'A hobby',overall:70,scores:{clarity:7}}];save()");
  h.context.fileInput={files:[{size:50,text:async()=>JSON.stringify({reps:[],city:'A place'})}],value:'selected'};
  await h.run('importData(fileInput)');assert.equal(h.run('S.city'),'');h.run('importConfirm()');
  assert.equal(h.run('S.city'),'A place');assert.equal(h.run('S.grades.length'),1);assert.equal(h.context.fileInput.value,'');
});
test('a rejected clipboard fallback never reports success',()=>{
  const h=boot();h.run("globalThis.copySucceeded=false;fallbackCopy('Test',()=>{globalThis.copySucceeded=true})");assert.equal(h.run('copySucceeded'),false);
});
test('practice keeps transcript and saving visible while optional external grading starts collapsed',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='Keep this transcript'");const html=h.run('drillView()');
 const details=html.match(/<details class="communication-feedback">([\s\S]*?)<\/details>\s*<\/div>\s*<div class="card rubric">/);
 assert(details);assert.match(details[1],/id="gradeBox"/);assert.match(details[1],/copyGradePrompt/);assert(!details[1].includes('id="txBox"'));
 assert.match(html,/aria-label="About dictation and feedback"/);assert.match(html,/Save practice/);assert.match(html,/Keep this transcript/);assert.equal((html.match(/<details\b/g)||[]).length,(html.match(/<\/details>/g)||[]).length);
});

test('failed practice saves keep the drill and transcript without granting XP',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='A useful explanation'");h.localStorage.blockedKey='mc_reps';h.run('finishDrill()');
 assert.equal(h.run('S.reps.length'),0);assert.equal(h.run('xp()'),0);assert.equal(h.run('curDrill.tx'),'A useful explanation');
});
test('refresh restores an unfinished transcript, scores and paused timer',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='Keep my practice';curDrill.scores=[4,3,5];toggleTimer()");h.advance(12500);h.pagehide();
 const again=boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('curDrill?.tx'),'Keep my practice');assert.equal(again.run('curDrill.scores[0]'),4);assert.equal(again.run('timerLeft'),78);assert.equal(again.run('recOn'),false);assert.equal(again.run('timerInt'),null);
});

test('successful practice saves transcript and rubric once, then updates XP and history',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='A clear explanation <literal>';curDrill.scores=[4,4,4]");assert.equal(h.run('finishDrill()'),true);h.run('finishDrill()');
 assert.equal(h.run('S.reps.length'),1);assert.equal(h.run('xp()'),10);assert.equal(h.run('S.reps[0].score'),80);assert.equal(JSON.parse(h.storage.get('mc_reps'))[0].transcript,'A clear explanation <literal>');assert.equal(JSON.parse(h.storage.get('mc_practiceDraft')),null);
 const html=h.run('pageProgress()');assert.match(html,/Practice saved/);assert.match(html,/Recent practice/);assert.match(html,/A clear explanation &lt;literal&gt;/);assert.doesNotMatch(html,/<h2>Recent reps/);
});
test('retry preserves the same practice ID and adds one record after a failed save',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='A clear explanation'");const id=h.run('curDrill.id');h.localStorage.blockedKey='mc_reps';h.run('finishDrill()');h.localStorage.blockedKey=null;h.run('save()');assert.equal(h.run('S.reps.length'),0);h.run('finishDrill()');assert.equal(h.run('S.reps.length'),1);assert.equal(h.run('S.reps[0].id'),id);assert.equal(h.run('xp()'),10);
});
test('a saved rep with interrupted draft cleanup cannot be logged again after reload',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='A retained transcript'");h.api.rememberPractice();h.localStorage.blockedKey='mc_practiceDraft';h.run('finishDrill()');assert.equal(h.run('S.reps.length'),1);
 const again=boot({records:Object.fromEntries(h.storage)});assert.equal(again.run('curDrill'),null);assert.equal(again.run('xp()'),10);assert.doesNotMatch(again.run('pageDash()'),/Resume practice/);again.begin();again.run('finishDrill()');assert.equal(again.run('S.reps.length'),2);
});
test('Back keeps an unfinished draft and resuming does not start dictation',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='Finish this later';curDrill.gradePaste='Unsubmitted feedback'");h.api.leavePractice();assert.equal(h.run('curDrill'),null);assert.match(h.run('pageTrain()'),/Resume practice/);h.api.resumePractice();assert.equal(h.run('curDrill.tx'),'Finish this later');assert.equal(h.run('recOn'),false);assert.match(h.run('drillView()'),/Unsubmitted feedback/);
});
test('starting over and discarding require confirmation before replacing the draft',()=>{
 const h=boot();h.begin();h.run("curDrill.tx='Keep this draft'");h.api.rememberPractice();const id=h.run('curDrill.id');h.begin();assert.equal(h.run('curDrill.id'),id);assert.equal(JSON.parse(h.storage.get('mc_practiceDraft')).tx,'Keep this draft');h.run('importConfirm()');assert.notEqual(h.run('curDrill.id'),id);
 h.api.discardPractice();assert(h.run('curDrill'));h.run('importConfirm()');assert.equal(h.run('curDrill'),null);assert.equal(JSON.parse(h.storage.get('mc_practiceDraft')),null);
});
test('export and import round-trip unfinished practice; older backups retain it',async()=>{
 const h=boot();h.begin();h.run("curDrill.tx='Draft in backup';curDrill.scores=[5,3,4]");h.api.rememberPractice();const data=JSON.parse(h.run('JSON.stringify(Store.dump())'));assert.equal(data.practiceDraft.tx,'Draft in backup');
 const target=boot();target.context.fileInput={files:[{size:100,text:async()=>JSON.stringify(data)}],value:'selected'};await target.run('importData(fileInput)');target.run('importConfirm()');assert.equal(target.run('curDrill.tx'),'Draft in backup');assert.equal(target.run('curDrill.scores[0]'),5);
 target.context.fileInput={files:[{size:100,text:async()=>JSON.stringify({reps:[]})}],value:'selected'};await target.run('importData(fileInput)');target.run('importConfirm()');assert.equal(target.run('curDrill.tx'),'Draft in backup');
});
test('invalid unfinished records are preserved and exportable until confirmed discard',()=>{
 const bytes='{not valid',h=boot({records:{mc_practiceDraft:bytes}});assert.equal(h.storage.get('mc_practiceDraft'),bytes);h.begin();assert.equal(h.storage.get('mc_practiceDraft'),bytes);assert.equal(h.run('Store.dump().unreadablePracticeDraft'),bytes);assert.match(h.run('pageDash()'),/Export recovery backup/);h.api.discardPractice();h.run('importConfirm()');assert.equal(JSON.parse(h.storage.get('mc_practiceDraft')),null);
});
test('streaks and recent history use Winnipeg dates across UTC midnight',()=>{
 const h=boot();h.advance(14*3600000,false);h.run("S.reps=[{date:'2026-09-08T02:00:00Z',drill:'Explain clearly',skill:SKILLS[0].id,topic:'One',score:60},{date:'2026-09-09T02:00:00Z',drill:'Explain clearly',skill:SKILLS[0].id,topic:'Two',score:80}]");assert.equal(h.run('streak()'),2);assert.equal(h.run('activeDays()'),2);assert.equal(h.run('bestByDrill()["Explain clearly"].date'),'2026-09-08');assert.match(h.run('pageProgress()'),/80\/100 · 2026-09-08/);
});
test('assessment order is chronological without modifying the imported records',()=>{
 const h=boot();h.run("S.assessments=[{date:'2026-09-08T10:00:00Z',scores:Object.fromEntries(SKILLS.map(s=>[s.id,80]))},{date:'2026-09-01T10:00:00Z',scores:Object.fromEntries(SKILLS.map(s=>[s.id,60]))}]");const before=h.run('JSON.stringify(S.assessments)');assert.equal(h.run('latestScores()[SKILLS[0].id]'),80);assert.equal(h.run('firstScores()[SKILLS[0].id]'),60);h.run('pageProgress()');assert.equal(h.run('JSON.stringify(S.assessments)'),before);
});
test('assessment and lesson failures keep progress unchanged until verified saves',()=>{
 const h=boot();h.run('ASSESS.forEach((q,i)=>curAnswers[i]=4)');h.localStorage.blockedKey='mc_assessments';h.run('submitAssess()');assert.equal(h.run('S.assessments.length'),0);assert.equal(h.run('Object.keys(curAnswers).length'),h.run('ASSESS.length'));h.localStorage.blockedKey=null;h.run('submitAssess()');assert.equal(h.run('xp()'),25);
 const lesson=h.run('CURRICULUM[0].lessons[0].id');h.localStorage.blockedKey='mc_lessonsDone';h.run('doneLesson('+JSON.stringify(lesson)+')');assert.equal(h.run('xp()'),25);h.localStorage.blockedKey=null;h.run('doneLesson('+JSON.stringify(lesson)+')');assert.equal(h.run('xp()'),40);h.run('doneLesson('+JSON.stringify(lesson)+')');assert.equal(h.run('xp()'),25);
});
