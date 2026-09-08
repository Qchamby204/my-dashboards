import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const html=readFileSync(new URL('../../the-hourglass.html',import.meta.url),'utf8');
const script=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(match=>match[1]).join('\n');
const extension=readFileSync(new URL('../../shared/hourglass-enhancements.js',import.meta.url),'utf8');
const example=()=>({__v2:true,birth:'2000-01-01',healthyAge:90,retireAge:60,created:'2026-01-01',tab:'setup',fin:{currentAUM:'',pace:'',paceUnit:'month',growthPct:0,target:''},milestones:[{id:'one',label:'First milestone',emoji:'📌',date:'2026-09-08'},{id:'two',label:'Second milestone',emoji:'✨',date:'2026-09-09'}],companions:[{id:'bond',label:'A companion',emoji:'🐈',start:'2020-01-01',end:''}]});

function boot(saved=example()){
  const nodes=new Map(),events=new Map(),windowEvents=new Map(),fields=[],intervals=new Map();let intervalId=0,now=Date.parse('2026-09-08T12:00:00Z'),undoButton=null;
  class Element{
    constructor(tag='div'){this.tagName=tag.toUpperCase();this.dataset={};this.attrs={};this.style={};this.children=[];this.value='';this.hidden=false;this.classes=new Set();this.classList={add:(...names)=>names.forEach(x=>this.classes.add(x)),remove:name=>this.classes.delete(name)};}
    set id(id){this._id=id;nodes.set(id,this);}get id(){return this._id;}
    setAttribute(key,value){this.attrs[key]=String(value);if(key.startsWith('data-'))this.dataset[key.slice(5).replace(/-([a-z])/g,(_,x)=>x.toUpperCase())]=String(value);}
    getAttribute(key){return this.attrs[key];}removeAttribute(key){delete this.attrs[key];}
    set innerHTML(value){this._html=value;if(this.id==='app'){
      fields.length=0;
      for(const match of value.matchAll(/<(input|button|span|div)[^>]*>/g)){
        const el=new Element(match[1]);for(const attr of match[0].matchAll(/([\w-]+)="([^"]*)"/g)){el.setAttribute(attr[1],attr[2]);if(['id','type','value'].includes(attr[1]))el[attr[1]]=attr[2];}
        if(el.dataset.m||el.dataset.c){el.parentElement=new Element();el.parentElement.parentElement=new Element();}
        if(el.tagName==='INPUT'||el.tagName==='BUTTON')fields.push(el);
      }
    }}get innerHTML(){return this._html||'';}
    set textContent(value){this._text=value;this.children=[];}get textContent(){return (this._text||'')+this.children.map(c=>c.textContent).join('');}
    querySelectorAll(selector){return fields.filter(el=>selector.split(',').some(s=>{const m=s.match(/^\[([\w-]+)(?:="([^"]*)")?\]$/);return m&&Object.hasOwn(el.attrs,m[1])&&(m[2]===undefined||el.attrs[m[1]]===m[2]);}));}
    querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
    appendChild(el){this.children.push(el);el.parentNode=this;if(this.id==='toast'&&el.tagName==='BUTTON')undoButton=el;return el;}
    prepend(el){this.children.unshift(el);el.parentNode=this;}
    remove(){if(this.id)nodes.delete(this.id);this.parentNode=null;}
    focus(){this.focused=true;}scrollIntoView(){this.scrolled=true;}click(){this.onclick?.();}
    setCustomValidity(message){this.validation=message;}reportValidity(){this.reported=this.validation;}
  }
  const app=new Element();app.id='app';const body=new Element();const head=new Element();
  const storage=new Map([['hourglass:v1',JSON.stringify(saved)]]),localStorage={blocked:false,getItem:key=>storage.get(key)??null,setItem(key,value){if(this.blocked)throw Error('Quota');storage.set(key,String(value));}};
  const document={readyState:'complete',hidden:false,currentScript:{src:'https://example.test/shared/hourglass-enhancements.js'},documentElement:{dataset:{atlasApp:'the-hourglass'}},body,head,getElementById:id=>nodes.get(id)||null,createElement:tag=>new Element(tag),querySelector:()=>null,addEventListener:(name,fn)=>events.set(name,fn)};
  const window={addEventListener:(name,fn)=>windowEvents.set(name,fn),scrollTo(){}};
  class Clock extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const context=vm.createContext({document,window,localStorage,navigator:{},Date:Clock,URL,Blob,setTimeout:()=>1,clearTimeout(){},setInterval:fn=>{const id=++intervalId;intervals.set(id,fn);return id;},clearInterval:id=>intervals.delete(id)});
  vm.runInContext(script+'\n'+extension,context);
  const run=code=>vm.runInContext(code,context),field=(id,key)=>fields.find(el=>(el.dataset.m===id||el.dataset.c===id)&&el.dataset.k===key);
  return {run,field,node:id=>nodes.get(id),storage,localStorage,events,windowEvents,document,intervals,api:window.HourglassImprovements,setTime:value=>now=Date.parse(value),undo:()=>undoButton.click()};
}

test('milestone emoji and name edit their own fields, persist immediately and retain focus',()=>{
  const h=boot(),emoji=h.field('one','emoji'),label=h.field('one','label');
  emoji.value='🎓';emoji.oninput();assert.equal(h.run('S.milestones[0].emoji'),'🎓');assert.equal(h.run('S.milestones[0].label'),'First milestone');
  label.value='Graduation';label.oninput();label.onchange();assert.equal(h.field('one','label'),label);
  assert.equal(JSON.parse(h.storage.get('hourglass:v1')).milestones[0].label,'Graduation');
  assert.equal(emoji.attrs['aria-label'],'Milestone emoji');assert(emoji.parentElement.classes.has('hourglass-milestone-row'));
});
test('upcoming milestones retain today, sort dates and exclude invalid or past dates',()=>{
  const h=boot();h.run("S.milestones.push({id:'past',date:'2026-09-07'},{id:'bad',date:'2026-02-30'},{id:'later',date:'2026-10-01'})");
  const rows=h.api.upcoming('2026-09-08');assert.deepEqual(Array.from(rows,row=>[row.item.id,row.days]),[['one',0],['two',1],['later',23]]);
  assert.equal(h.api.calendarDay('2026-03-09')-h.api.calendarDay('2026-03-08'),1);
  assert.equal(h.api.calendarDay('2026-02-30'),null);
  assert.match(h.run('viewWeeks()'),/Coming up/);assert.match(h.run('viewWeeks()'),/Today/);
});
test('milestone and bond Undo restore only the removed record',()=>{
  const h=boot();h.api.removeRecord('milestones','one');h.api.updateRecord('milestones','two','label','Later edit');h.run("S.milestones.push({id:'new',label:'New record',date:''})");h.undo();
  assert.equal(h.run('S.milestones.length'),3);assert.equal(h.run("S.milestones.find(x=>x.id==='two').label"),'Later edit');
  h.api.removeRecord('companions','bond');h.run("S.companions.push({id:'new-bond',label:'Later companion'})");h.undo();assert.equal(h.run('S.companions.length'),2);
});
test('invalid date ranges preserve saved dates without rebuilding the mobile form',()=>{
  const h=boot(),end=h.field('bond','end');end.value='2019-01-01';end.onchange();assert.equal(h.run('S.companions[0].end'),'');assert.match(end.reported,/end date/);
  end.value='2030-01-01';end.onchange();assert.equal(h.run('S.companions[0].end'),'2030-01-01');assert.equal(h.field('bond','end'),end);
});
test('failed storage writes keep edits in memory, show recovery and succeed on retry',()=>{
  const h=boot();h.localStorage.blocked=true;h.api.updateRecord('milestones','one','label','Retain this edit');
  assert.equal(h.run('S.milestones[0].label'),'Retain this edit');assert.equal(h.node('hourglass-save-error').hidden,false);
  assert.equal(JSON.parse(h.storage.get('hourglass:v1')).milestones[0].label,'First milestone');
  h.localStorage.blocked=false;assert.equal(h.run('save()'),true);assert.equal(h.node('hourglass-save-error').hidden,true);
  assert.equal(JSON.parse(h.storage.get('hourglass:v1')).milestones[0].label,'Retain this edit');
});
test('countdown primes both values, stops hidden and catches up from the clock on return',()=>{
  const h=boot();h.run("S.tab='reckon';render()");const before=Number(h.node('tickDays').textContent.replaceAll(',',''));assert.equal(h.intervals.size,1);
  h.document.hidden=true;h.events.get('visibilitychange')();assert.equal(h.intervals.size,0);
  h.setTime('2026-09-10T12:00:00Z');h.document.hidden=false;h.events.get('visibilitychange')();
  assert.equal(Number(h.node('tickDays').textContent.replaceAll(',','')),before-2);assert.equal(h.intervals.size,1);
  h.windowEvents.get('pagehide')();assert.equal(h.intervals.size,0);
});
test('direct add and edit actions open and focus the matching existing setup field',()=>{
  const h=boot();h.events.get('click')({target:{closest:()=>({dataset:{hourglassAction:'edit',hourglassId:'two'}})}});
  assert.equal(h.field('two','label').focused,true);
  h.events.get('click')({target:{closest:()=>({dataset:{hourglassAction:'add'}})}});
  assert.equal(h.run('S.milestones.length'),3);const id=h.run('S.milestones[2].id');assert.equal(h.field(id,'label').focused,true);
});
