'use client';
import {useState,useEffect,useMemo,useLayoutEffect,useRef,useCallback, type FormEvent,type ReactNode} from 'react';
import {flushSync} from 'react-dom';
import {useCareDialog} from './use-care-dialog';
import {Moon,Sun,Plus,BarChart3,Droplets,Milk,Baby,ClipboardList,Heart,Scale,NotebookPen,Pill,ChevronRight,ChevronLeft,Settings2,Check,RefreshCw,ArrowUpRight,Clock3,X,Download,CloudCheck,CloudOff,Square,Play,LockKeyhole,Leaf,Trash2,CalendarDays,ArrowLeft,Info} from 'lucide-react';
import {createDraft,newEventId,entryPayload,entryReady,type Draft} from '@/lib/entry';
import {useLongPress} from './long-press';
import {EntryFields} from './entry-controls';
import {MovementLog} from './movement-controls';
import {isMovement,type MovementKind} from '@/lib/movement';
import {tummyProgress,type TummyComfort} from '@/lib/tummy-progress';
import {pumpingSummary} from '@/lib/pumping';
import {stepTrackerDay} from '@/lib/navigation';
import PlayJournal from './play-journal';
import DayRhythm from './day-rhythm';
import MilkDial from './milk-dial';
import {feedingRange,measuredFeeding,pumpingRange} from '@/lib/feeding-plan';
import {LivingSky,playDrop,AwayCard,useAway} from './wonder';
import {NatureRings,DaySundial,LakeSky,TimerRing,useRiseIn,useGrowth,span} from './nature';
import MilkBatches from './milk-batches';
import AppearanceControl from './appearance';
import CareSettings,{type SettingsSection} from './care-settings';
import CareTracker from './care-tracker';
import {trackingEnabled,visibleEvent} from '@/lib/tracking';
import {type CareEvent,type Kind,type MilkStorage,type Plan,DEFAULT_PLAN,dayKey,dayBounds,shiftDay,monday,toInput,fromInput,clock,prettyDay,elapsed,durationText,totals,eventTitle,eventDetail} from '@/lib/care';

type Page='log'|'play'|'tracker';
const navigation=[{id:'log',label:'Log care',icon:Plus},{id:'play',label:'Play',icon:Baby},{id:'tracker',label:'Tracker',icon:BarChart3}] as const;
const initialTummyProgress=tummyProgress([]);
type State={recentObservations?:CareEvent[];tummyProgress?:ReturnType<typeof tummyProgress>;activeMovement:CareEvent[];milkBatches:CareEvent[];items:CareEvent[];lastFeed:CareEvent|null;lastBottleFeed?:CareEvent|null;lastChange?:CareEvent|null;lastWet:CareEvent|null;activeSleep:CareEvent|null;weights:CareEvent[];plan:Plan&{version:number};user:{id:string;name:string};day:string};
const icons={feed:Milk,bottle:Milk,diaper:Droplets,sleep:Moon,pump:Heart,weight:Scale,medicine:Pill,note:NotebookPen,tummy:Baby,exercise:ClipboardList};
const colors={feed:'sage',bottle:'blue',diaper:'blue',sleep:'lavender',pump:'rose',weight:'sand',medicine:'sand',note:'sand',tummy:'sand',exercise:'sage'};
function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}){
 const ref=useCareDialog();
 const heading=useRef<HTMLHeadingElement>(null);
 const previousTitle=useRef(title);

 useLayoutEffect(()=>{
  if(previousTitle.current===title)return;
  previousTitle.current=title;
  heading.current?.focus({preventScroll:true});
 },[title]);

 return <dialog ref={ref} className={'modal '+(wide?'wide':'')} onCancel={e=>{e.preventDefault();onClose();}} aria-labelledby="dialog-title">
  <div className="modal-head">
   <h2 id="dialog-title" ref={heading} data-dialog-heading tabIndex={-1}>{title}</h2>
   <button type="button" className="icon-button" aria-label="Close panel" onClick={onClose}><X size={20}/></button>
  </div>
  {children}
 </dialog>;
}
function EventRow({entry,onClick}:{entry:CareEvent;onClick:(e:CareEvent)=>void}){const Icon=icons[entry.kind];return <button className="event-row" onClick={()=>onClick(entry)}><time dateTime={entry.startedAt}>{clock(entry.startedAt)}</time><span className={'event-icon '+colors[entry.kind]}><Icon size={18}/></span><span className="event-copy"><strong>{eventTitle(entry)}</strong><span>{eventDetail(entry)}</span></span><span className="event-actor">{entry.actor}</span><ChevronRight size={16}/></button>;}
function SwipeEntry({entry, onEdit, onDelete, disabled}:{
 entry:CareEvent; onEdit:(entry:CareEvent)=>void; onDelete:(entry:CareEvent)=>void; disabled:boolean;
}){
 const [revealed,setRevealed]=useState(false);
 const start=useRef<{x:number;y:number}|null>(null);
 const swiped=useRef(false);
 return <div className="swipe-entry" onKeyDown={event=>{if(event.key==='Escape')setRevealed(false);}}>
  {revealed&&<button type="button" className="swipe-delete" disabled={disabled} onClick={()=>onDelete(entry)}><Trash2 size={18}/>Delete</button>}
  <div className="swipe-content" onTouchStart={event=>{
   swiped.current=false;
   const touch=event.touches[0];
   start.current=event.touches.length===1?{x:touch.clientX,y:touch.clientY}:null;
  }} onTouchCancel={()=>{start.current=null;}} onTouchEnd={event=>{
   const origin=start.current;
   start.current=null;
   if(!origin||event.touches.length)return;
   const touch=event.changedTouches[0];
   const dx=touch.clientX-origin.x,dy=touch.clientY-origin.y;
   if(Math.abs(dx)<48||Math.abs(dx)<1.5*Math.abs(dy))return;
   swiped.current=true;
   setRevealed(dx>0);
  }}>
   <EventRow entry={entry} onClick={item=>{
    if(swiped.current){swiped.current=false;return;}
    if(revealed)setRevealed(false);else onEdit(item);
   }}/>
  </div>
 </div>;
}
export default function CareApp(){
 const [trendRevision,setTrendRevision]=useState(0);
 const [trackerFocus,setTrackerFocus]=useState('feed');
 const [trackerRange,setTrackerRange]=useState(1);
 const [settingsSection,setSettingsSection]=useState<SettingsSection>('tracking');
 const [moreCare,setMoreCare]=useState(false);
 const [page,setPage]=useState<Page>('log');const [day,setDay]=useState(dayKey());
 const [state,setState]=useState<State|null>(null);const [connected,setConnected]=useState(false);const [loadFailed,setLoadFailed]=useState(false);const [authError,setAuthError]=useState(false);const [now,setNow]=useState(Date.now());const [lastSync,setLastSync]=useState(0);const [busy,setBusy]=useState(false);const [toast,setToast]=useState('');const [toastError,setToastError]=useState(false);const [formError,setFormError]=useState('');
 const [savedEntry,setSavedEntry]=useState<{entry:CareEvent;canUndo:boolean}|null>(null);
 const [editingTime,setEditingTime]=useState(false);
 const [draft,setDraft]=useState<Draft|null>(null);const [deleteRequested,setDeleteRequested]=useState(false);const [planDraft,setPlanDraft]=useState<(Plan&{version:number})|null>(null);const [showHelp,setShowHelp]=useState(false);
 const requestId=useRef(0);const quickIds=useRef<Record<string,string>>({});const today=dayKey(new Date(now));const selectedDay=page==='tracker'?day:today;
 const refresh=useCallback(async()=>{const seq=++requestId.current;try{const r=await fetch('/api/state?day='+selectedDay,{cache:'no-store'});if(r.status===401){setAuthError(true);throw new Error('Sign in');}if(!r.ok)throw new Error('Load failed');const data=await r.json() as Omit<State,'day'>;if(seq!==requestId.current)return;setState({...data,day:selectedDay});setLastSync(Date.now());setConnected(true);setLoadFailed(false);setAuthError(false);}catch{if(seq===requestId.current){setConnected(false);setLoadFailed(true);}}},[selectedDay]);
 useEffect(()=>{refresh();const id=setInterval(()=>{if(document.visibilityState==='visible')refresh();},4000);const onFocus=()=>refresh();window.addEventListener('online',onFocus);window.addEventListener('focus',onFocus);document.addEventListener('visibilitychange',onFocus);return()=>{clearInterval(id);window.removeEventListener('online',onFocus);window.removeEventListener('focus',onFocus);document.removeEventListener('visibilitychange',onFocus);};},[refresh]);
 useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 useEffect(()=>{if(!toast)return;const id=setTimeout(()=>setToast(''),toastError?8000:savedEntry?10000:4000);return()=>clearTimeout(id);},[toast,toastError,savedEntry]);
 const plan=state?.plan||{...DEFAULT_PLAN,version:1};const items=state?.day===selectedDay?state.items:[];const bounds=dayBounds(selectedDay);const dayItems=items.filter(e=>e.startedAt>=bounds[0]&&e.startedAt<bounds[1]);const pumpedToday=pumpingSummary(items,...bounds);
 const bottlesToday=useMemo(()=>measuredFeeding(state?.items??[],today),[state?.items,today]);
 const careToday=useMemo(()=>{const live=dayItems.filter(e=>!e.deleted&&visibleEvent(plan,e));return {live,...totals(live,bounds[0],bounds[1],now)};},[dayItems,plan,bounds[0],bounds[1],Math.floor(now/60000)]);// eslint-disable-line react-hooks/exhaustive-deps
 const goal=useMemo(()=>feedingRange(plan,today,state?.weights??[]),[plan,today,state?.weights]);
 const onToday=state?.day===today&&selectedDay===today;
 const feedPulse=useGrowth(onToday?bottlesToday.volume:null,today);
 const diaperPulse=useGrowth(onToday?careToday.wet+careToday.dirty:null,today);
 const goalFlare=useGrowth(onToday&&goal.low!==null?(bottlesToday.volume>=goal.low?1:0):null,today);
 const [sweep,setSweep]=useState({n:0,dir:'right'});
 const press=useLongPress((id:string)=>open('diaper',id),(id:string)=>{void quickDiaper(id);});
 const recentFeeds=useMemo(()=>{const list=(state?.items??[]).filter(e=>!e.deleted&&e.kind==='feed'&&e.subtype!=='nursing'&&e.amount!==null).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));if(!list.length&&state?.lastBottleFeed)list.push(state.lastBottleFeed);return list.slice(0,5);},[state?.items,state?.lastBottleFeed]);
 const halfTiles=(['weight','sleep'] as const).filter(k=>trackingEnabled(plan,k));
 const wideTile=halfTiles.length%2?halfTiles.at(-1):null;
 const pumpGoal=useMemo(()=>pumpingRange(plan,today,state?.weights??[]),[plan,today,state?.weights]);
 const isVisible=useCallback((e:CareEvent)=>visibleEvent(plan,e),[plan]);
 const {away,dismiss:dismissAway}=useAway({ready:onToday,today,items:state?.items??[],visible:isVisible});
 useRiseIn(page==='log'?'':'main .curated-card,main .field-note,main .care-summary-card,main .insight-card',page);
 const latestCare=dayItems.find(entry=>!isMovement(entry.kind)&&visibleEvent(plan,entry));
 const synced=connected&&now-lastSync<15000;const canSave=!!state&&!busy&&synced;const feedInterval=plan.interval??3;const lastFeed=trackingEnabled(plan,'nursing')?state?.lastFeed:state?.lastBottleFeed??(state?.lastFeed?.subtype!=='nursing'?state?.lastFeed:null);const nextFeed=lastFeed?new Date(Date.parse(lastFeed.startedAt)+feedInterval*3600000):null;
 const announce=(message:string,error=false,entry?:{entry:CareEvent;canUndo:boolean})=>{
  setSavedEntry(entry??null);
  setToastError(error);
  setToast(message);
  if(!error)playDrop();
 };
 const open=(kind:Kind,subtype='',entry?:CareEvent)=>{
  setFormError('');
  setDeleteRequested(false);
  setEditingTime(false);
  setDraft(createDraft(kind,subtype,entry));
 };
 async function send(path:string,method:string,body:unknown){const r=await fetch(path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});let data:{error?:string;event?:CareEvent};try{data=await r.json() as typeof data;}catch{throw new Error('Could not confirm the save. Your form is still here. Reconnect and try again.');}if(!r.ok)throw new Error(data.error||'Could not save. Please try again.');setTrendRevision(value=>value+1);return data;}
 async function sleepToggle(){if(!canSave)return;setBusy(true);try{const e=state?.activeSleep;if(e){await send('/api/events','PATCH',{...e,endedAt:new Date().toISOString()});announce('Sleep saved');}else{const id=quickIds.current.sleep||newEventId();quickIds.current.sleep=id;await send('/api/events','POST',{id,kind:'sleep',startedAt:new Date().toISOString()});delete quickIds.current.sleep;announce('Shared sleep timer started');}await refresh();}catch(e){announce((e as Error).message,true);await refresh();}finally{setBusy(false);}}
 async function toggleExercise(exercise:string,checked:boolean){
  if(!canSave)return;
  setBusy(true);
  try{
   await send('/api/exercises','POST',{exercise,checked,day:today});
   await refresh();
  }catch(error){announce((error as Error).message,true);}
  finally{setBusy(false);}
 }
 async function countLift(entry:CareEvent,delta:-1|1,legacyCount:number){
  if(!canSave)return;
  setBusy(true);
  try{await send('/api/tummy-lifts','POST',{id:entry.id,delta,legacyCount});}
  catch(error){announce((error as Error).message,true);}
  finally{await refresh();setBusy(false);}
 }
 async function undoSavedEntry(){
  if(!canSave||!savedEntry?.canUndo)return;
  const {entry}=savedEntry;
  setBusy(true);
  try{
   await send('/api/events','DELETE',{id:entry.id,version:entry.version});
   announce('Entry undone');
  }catch(error){announce((error as Error).message,true);}
  finally{await refresh();setBusy(false);}
 }
 async function saveMovement(key:string,kind:MovementKind,subtype:string,entry?:CareEvent,headLifts:number|null=null,cue:number|null=null,endedAt?:string){
  if(!canSave)return null;
  const stamp=new Date().toISOString();
  const id=entry?.id||quickIds.current[key]||newEventId();
  if(!entry)quickIds.current[key]=id;
  setBusy(true);
  try{
   const result=await send('/api/events',entry?'PATCH':'POST',{id,kind,subtype,startedAt:entry?.startedAt||stamp,endedAt:entry?(endedAt??stamp):null,amount:headLifts,tummyCueSeconds:entry?.tummyCueSeconds??cue,version:entry?.version});
   delete quickIds.current[key];
   announce(entry?(kind==='tummy'?'Tummy time saved':'Exercise saved'):'Shared timer started');
   await refresh();
   return result.event??null;
  }catch(e){announce((e as Error).message,true);await refresh();return null;}
  finally{setBusy(false);}
 }
 async function rateTummy(entry:CareEvent,tummyComfort:TummyComfort){
  if(!canSave)return null;
  setBusy(true);
  try{
   const result=await send('/api/events','PATCH',{...entry,tummyComfort});
   announce('Session feedback saved');
   await refresh();
   return result.event??null;
  }catch(e){announce((e as Error).message,true);await refresh();return null;}
  finally{setBusy(false);}
 }
 async function saveEntry(e:FormEvent){
  e.preventDefault();
  if(!draft||editingTime||busy||deleteRequested||!entryReady(draft))return;
  setBusy(true);
  setFormError('');
  try{
   const saved=await send('/api/events',draft.version?'PATCH':'POST',entryPayload(draft));
   if(draft.kind==='pump'||draft.kind==='bottle'){
    // Unlock the page before scrolling to the milk timers.
    flushSync(()=>setDraft(null));
    window.scrollTo({top:0,behavior:'instant'});
   }else{
    setDraft(null);
   }
   announce(draft.kind==='bottle'&&!draft.version?'Leftover bottle · timer started':draft.kind==='pump'&&!draft.version?'Pumping saved · reminder started':'Entry saved to your shared log',false,saved.event?{entry:saved.event,canUndo:!draft.version}:undefined);
   await refresh();
  }catch(e){setFormError((e as Error).message);}
  finally{setBusy(false);}
 }
 async function deleteEntry(){if(!draft?.version||busy||!deleteRequested)return;setBusy(true);setFormError('');try{await send('/api/events','DELETE',{id:draft.id,version:draft.version});setDraft(null);setDeleteRequested(false);announce('Entry deleted');await refresh();}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 async function deleteLogEntry(entry:CareEvent){
  if(!canSave)return;
  setBusy(true);
  try{
   await send('/api/events','DELETE',{id:entry.id,version:entry.version});
   announce('Entry deleted');
  }catch(error){announce((error as Error).message,true);}
  finally{await refresh();setBusy(false);}
 }
 async function quickDiaper(subtype:string){
  if(!canSave)return;
  setBusy(true);
  try{
   const saved=await send('/api/events','POST',entryPayload(createDraft('diaper',subtype)));
   announce((subtype==='both'?'Wet and dirty':subtype==='wet'?'Wet':'Dirty')+' diaper saved',false,saved.event?{entry:saved.event,canUndo:true}:undefined);
   await refresh();
  }catch(e){announce((e as Error).message,true);await refresh();}
  finally{setBusy(false);}
 }
 async function updateMilk(entry:CareEvent,milkStorage:MilkStorage){if(!canSave)return;setBusy(true);try{await send('/api/events','PATCH',{...entry,milkStorage});announce(milkStorage==='fridge'?'Milk marked refrigerated':milkStorage==='discarded'?'Milk marked discarded':'Milk marked used');await refresh();}catch(e){announce((e as Error).message,true);await refresh();}finally{setBusy(false);}}
 async function savePlan(e:FormEvent){e.preventDefault();if(!planDraft||busy)return;setBusy(true);setFormError('');try{await send('/api/settings','PATCH',{...planDraft,mlKgGoal:planDraft.mlKgGoal||null});setPlanDraft(null);announce('Care settings saved');await refresh();}catch(e){setFormError((e as Error).message);}finally{setBusy(false);}}
 const openSettings=(section:SettingsSection='tracking')=>{setFormError('');setSettingsSection(section);setPlanDraft({...plan});};
 const availableNavigation=navigation.filter(item=>item.id!=='play'||trackingEnabled(plan,'tummy')||trackingEnabled(plan,'exercise'));
 useEffect(()=>{if(page==='play'&&!trackingEnabled(plan,'tummy')&&!trackingEnabled(plan,'exercise'))setPage('log');},[page,plan.tracking]);
 const changePage=(p:Page)=>{if(p!==page){const order=availableNavigation.map(n=>n.id as string);setSweep(v=>({n:v.n+1,dir:order.indexOf(p)>order.indexOf(page)?'right':'left'}));}setPage(p);if(p==='tracker'&&page!=='tracker')setDay(dayKey());window.scrollTo({top:0,behavior:'instant'});};
 const selectTrackerDay=(d:string)=>{setDay(d);setTrackerRange(1);window.scrollTo({top:0,behavior:'instant'});};
 return <div className={"app-shell journal-shell view-"+page}><aside className="sidebar"><a className="brand" href="/" aria-label="Auggie Together home"><span className="brand-mark"><img src="/auggie-suite-64.png" alt="" width={44} height={44}/></span><span>auggie<span className="brand-sub">TOGETHER</span></span></a><div className="sidebar-label">A LITTLE CARE, SHARED</div><nav>{availableNavigation.map(n=><button key={n.id} className={page===n.id?'nav-item active':'nav-item'} onClick={()=>changePage(n.id)} aria-current={page===n.id?'page':undefined}><n.icon size={20}/>{n.label}<ChevronRight size={15}/></button>)}</nav><div className="sidebar-bottom"><div className="family-stamp"><span className="avatar">Q</span><span className="avatar second">J</span><div><strong>One little team</strong><span>Caregivers</span></div></div><p>For the little moments.<br/>And the middle-of-the-night ones.</p><button className="quiet-button" onClick={()=>setShowHelp(true)}><LockKeyhole size={15}/>Sharing & privacy</button></div></aside>
 <div className="main-wrap">{sweep.n>0&&<i key={sweep.n} className={'page-sweep '+sweep.dir} aria-hidden="true"/>}<div className="site-header"><header className="topbar"><span className="mobile-brand"><img src="/auggie-suite-64.png" alt="" width={32} height={32}/>auggie<span>TOGETHER</span></span><span className="breadcrumb">Our little world <span>/</span> {page==='log'?'Daily care':page==='play'?'Tummy time & exercise':'Care tracker'}</span><div className="top-actions"><button className={'sync '+(!synced?'offline':'')} onClick={()=>refresh()} title="Refresh shared log">{synced?<CloudCheck size={16}/>:<CloudOff size={16}/>}<span>{synced?'Synced':state?'Reconnecting':loadFailed?'Not connected':'Connecting'}</span></button><AppearanceControl/><button className="icon-button" aria-label="Care settings" onClick={()=>openSettings('tracking')} disabled={!state}><Settings2 size={20}/></button><span className="profile" title={state?.user.name||'Your account'}>{state?.user.name?.slice(0,1)||'Q'}</span></div></header></div>
 <nav className="mobile-nav" aria-label="Main navigation" style={{"--tab-count":availableNavigation.length,"--tab-index":availableNavigation.findIndex(n=>n.id===page)} as React.CSSProperties}>
  {availableNavigation.map(n=><button key={n.id} type="button" aria-current={page===n.id?'page':undefined} onClick={()=>changePage(n.id)}>
   <n.icon size={21} aria-hidden="true"/><span>{n.id==='log'?'Log':n.label}</span>
  </button>)}
 </nav>
 <main>{page!=='log'&&<div className="page-heading"><div><p className="eyebrow">{page==='tracker'?prettyDay(day):prettyDay(today)}</p><h1>{page==='play'?'Play journal':'Care tracker'}</h1><p className="subtitle">{page==='play'?'Tummy time observations and daily exercises.':'Explore a day or compare a longer stretch.'}</p></div>{page==='tracker'&&<button className="outline-button desktop-export" onClick={()=>setShowHelp(true)}><Download size={16}/>Export & sharing</button>}</div>}
 {authError&&<div className="notice error"><p>Sign in to open your private care journal.</p><a href="/signin-with-chatgpt?return_to=/" target="_top">Sign in with ChatGPT <ArrowUpRight size={16}/></a></div>}
 {loadFailed&&!authError&&<div className="notice error"><CloudOff size={18}/><span>{state?'Connection lost. Displaying the last synced log. Entries need a connection to save.':'Could not connect to your shared journal. Check your connection and try again.'}</span><button onClick={()=>refresh()}>Retry</button></div>}
 <section className="easy-log play-page" hidden={page!=='play'} aria-label="Play activities">
 {page==='play'&&trackingEnabled(plan,'tummy')&&<PlayJournal key={state?.recentObservations?.[0]?.id??'empty'} entries={state?.recentObservations??[]} ready={!!state} disabled={!canSave} onAdd={observation=>{open('tummy');if(observation)setDraft(d=>d?{...d,tummyObservation:observation}:d);}} onEdit={e=>open(e.kind,e.subtype,e)}/>}
 <MovementLog plan={plan} active={state?.activeMovement??[]} items={dayItems} now={now} disabled={!canSave} progress={state?.tummyProgress??initialTummyProgress}
  onStart={(kind,position,cue)=>saveMovement(kind,kind,position,undefined,null,cue)}
  onStop={(entry,subtype,headLifts,endedAt)=>saveMovement(entry.kind,entry.kind as MovementKind,subtype,entry,headLifts,null,endedAt)}
  onChecklist={toggleExercise}
  onLift={countLift}
  onRate={rateTummy}
  onEarlier={kind=>open(kind)}/>
 <button className="see-tracker" onClick={()=>changePage('tracker')}><BarChart3 size={20}/>See your tracker<ChevronRight size={18}/></button>
 </section>
 {page==='log'?<>
 <div className="easy-log journal-log">
 <section className="journal-scene"><LakeSky flare={goalFlare}/><LivingSky now={now}/><header><p>{prettyDay(today)}</p><h1>Auggie’s day</h1>
  <p className="scene-telemetry" aria-label={(synced?'Synced':'Not synced')+(latestCare?'. Latest entry by '+latestCare.actor+' at '+clock(latestCare.startedAt):'')}><span className={'telemetry-dot'+(synced?'':' is-off')} aria-hidden="true"/><span aria-hidden="true" suppressHydrationWarning>{clock(new Date(now).toISOString())}</span><span aria-hidden="true">{synced?'In sync':'Reconnecting'}</span>{latestCare&&<span aria-hidden="true">Last by {latestCare.actor}</span>}</p>
 </header>
 {trackingEnabled(plan,'feed')&&<MilkDial key={today} volume={state?.day===today?bottlesToday.volume:null} count={bottlesToday.count} disabled={!canSave} onOpen={()=>open('feed',lastFeed?.subtype||'milk')}
  ringsLabel={goal.low!==null&&goal.high!==null?`Goal ${goal.low===goal.high?goal.low:goal.low+' to '+goal.high} millilitres`:undefined}
  rings={scale=><NatureRings volume={onToday?bottlesToday.volume:null} low={goal.low} high={goal.high} scale={scale} wet={trackingEnabled(plan,'diaper')?careToday.wet:0} dirty={trackingEnabled(plan,'diaper')?careToday.dirty:0} sleep={trackingEnabled(plan,'sleep')?careToday.sleep:0} pulse={feedPulse}/>}/>}
 {trackingEnabled(plan,'feed')&&onToday&&<ul className="nature-legend" aria-label="Today at a glance">
  <li className="intake">{goal.high?`${Math.round(bottlesToday.volume/goal.high*100)}% of ${goal.low===goal.high?goal.high:goal.low+'–'+goal.high} mL`:`${bottlesToday.count} ${bottlesToday.count===1?'bottle':'bottles'}`}</li>
  {trackingEnabled(plan,'diaper')&&<li className="pearls">{careToday.wet} wet · {careToday.dirty} dirty</li>}
  {trackingEnabled(plan,'sleep')&&<li className="sleep">{span(careToday.sleep)} sleep</li>}
 </ul>}
 {trackingEnabled(plan,'pump')&&<button type="button" className="pump-log" onClick={()=>open('pump')} disabled={!canSave}>
  <span className="pump-emblem" aria-hidden="true"><Heart size={21}/>{onToday&&pumpGoal.low?<TimerRing size={50} tone="pump" fraction={pumpedToday.volume/pumpGoal.low}/>:null}</span>
  <span className="pump-copy"><strong>Log a pump</strong><small>{onToday?`${pumpedToday.volume} mL today · ${pumpedToday.count} ${pumpedToday.count===1?'session':'sessions'}`:loadFailed?'Reconnect to load today':'Loading today…'}</small></span>
  <Plus className="pump-add" size={24} aria-hidden="true"/>
 </button>}
 {trackingEnabled(plan,'diaper')&&<section className="journal-diaper" aria-label="Log a diaper">

  <div className="journal-shortcuts">{diaperPulse>0&&<i key={diaperPulse} className="pond-ripple" aria-hidden="true"/>}
   {[{id:'wet',label:'Wet',icon:Droplets},{id:'dirty',label:'Dirty',icon:Baby},{id:'both',label:'Both',icon:Check}].map(type=>
    <button key={type.id} {...press(type.id)} disabled={!canSave} aria-label={type.label+' diaper. Tap to save now, or press and hold to add details'}><type.icon size={24}/><strong>{type.label}</strong></button>
   )}
  </div>
  <p className="diaper-hint">Tap to save · hold for size and notes <button type="button" onClick={()=>open('diaper')} disabled={!canSave}>Add details</button></p>
 </section>}
 </section>
 {away&&<AwayCard away={away} now={now} onDismiss={dismissAway} onOpen={e=>open(e.kind,e.subtype,e)}/>}
 {(trackingEnabled(plan,'feed')||trackingEnabled(plan,'diaper'))&&<section className="feed-glance care-glance" aria-label="Care handoff">
  {trackingEnabled(plan,'feed')&&<>
   <div><span>Last feed{lastFeed&&dayKey(lastFeed.startedAt)!==today?' · '+prettyDay(dayKey(lastFeed.startedAt),true):''}</span>
    <strong>{lastFeed?clock(lastFeed.startedAt):'None logged'}</strong>
    {lastFeed&&<small>{eventDetail(lastFeed)} · {lastFeed.actor}</small>}
    {lastFeed&&<small className="glance-live">{elapsed(lastFeed.startedAt,now)}</small>}
   </div>
  </>}
  {trackingEnabled(plan,'diaper')&&<div><span>Last change{state?.lastChange&&dayKey(state.lastChange.startedAt)!==today?' · '+prettyDay(dayKey(state.lastChange.startedAt),true):''}</span>
   <strong>{state?.lastChange?clock(state.lastChange.startedAt):'None logged'}</strong>
   {state?.lastChange&&<small>{eventTitle(state.lastChange)} · {state.lastChange.actor}</small>}
   {state?.lastChange&&<small className="glance-live">{elapsed(state.lastChange.startedAt,now)}</small>}
   {state?.lastWet&&state.lastChange&&state.lastWet.id!==state.lastChange.id&&<small>Last wet · {dayKey(state.lastWet.startedAt)!==today?prettyDay(dayKey(state.lastWet.startedAt),true)+' · ':''}{clock(state.lastWet.startedAt)}</small>}
  </div>}
  {trackingEnabled(plan,'feed')&&<div className="glance-next">{nextFeed&&<TimerRing size={34} fraction={(nextFeed.getTime()-now)/(feedInterval*3600000)} tone={nextFeed.getTime()<=now?'reached':'calm'}/>}<span>Next planned feed</span><strong>{nextFeed?clock(nextFeed):'—'}</strong>
    {nextFeed&&<small>{dayKey(nextFeed)!==today?prettyDay(dayKey(nextFeed),true)+' · ':''}{nextFeed.getTime()<=now?'Plan time reached':'By your care plan'}</small>}
    {nextFeed&&nextFeed.getTime()>now&&<small className="glance-live">in {span((nextFeed.getTime()-now)/60000)}</small>}
   </div>}
 </section>}
 <section className="journal-rhythm"><header><h2>Today’s rhythm</h2><span>{state?.day===today?dayItems.filter(e=>!e.deleted&&visibleEvent(plan,e)).length+' logged':'Loading…'}</span></header>
 <div className="sundial-row"><DaySundial entries={state?.day===today?careToday.live:[]} now={now} isToday/>
  <dl className="sundial-stats"><div className="feed"><dt>Feeds</dt><dd>{careToday.feeds}</dd></div><div className="change"><dt>Changes</dt><dd>{careToday.live.filter(e=>e.kind==='diaper').length}</dd></div>{trackingEnabled(plan,'sleep')&&<div className="sleep"><dt>Sleep</dt><dd>{span(careToday.sleep)}</dd></div>}<div className="since"><dt>Since last feed</dt><dd>{lastFeed?elapsed(lastFeed.startedAt,now).replace(' ago',''):'None yet'}</dd></div></dl></div>
 <DayRhythm renderEntry={entry=><EventRow entry={entry} onClick={e=>open(e.kind,e.subtype,e)}/>} key={today} ready={state?.day===today} entries={dayItems.filter(e=>!e.deleted&&visibleEvent(plan,e))}/>
 {latestCare&&<div className="last-saved"><span>Latest entry · tap to edit</span><EventRow entry={latestCare} onClick={e=>open(e.kind,e.subtype,e)}/></div>}
 {plan.handoff&&<section className="easy-handoff"><NotebookPen size={20}/><div><h2>For your other half</h2><p>{plan.handoff}</p></div></section>}
 </section>
 <section className="easy-actions" aria-label="Quick care logging">

 {trackingEnabled(plan,'milkTimers')&&<MilkBatches batches={state?.milkBatches||[]} now={now} busy={!canSave} loading={!state} onUpdate={updateMilk} onEdit={e=>open(e.kind,e.subtype,e)} onBottle={()=>open('bottle')}/>}
 {trackingEnabled(plan,'weight')&&<button className={"care-action weight-action"+(wideTile==='weight'?' tile-wide':'')} onClick={()=>open('weight')} disabled={!canSave}><span className="care-action-icon sand"><Scale size={28}/></span><span className="care-action-label"><strong>Weight</strong><span>{state?.weights[0]?.amount?`${state.weights[0].amount.toLocaleString()} g · ${prettyDay(dayKey(state.weights[0].startedAt),true)}`:'Add a measured weigh-in'}</span></span><span className="care-action-end"><Plus size={25}/></span></button>}
 {trackingEnabled(plan,'sleep')&&<section className={'easy-sleep '+(state?.activeSleep?'is-sleeping':'')+(wideTile==='sleep'?' tile-wide':'')}><button className="care-action" onClick={sleepToggle} disabled={!canSave}><span className="care-action-icon lavender"><Moon size={29}/>{state?.activeSleep&&<TimerRing size={66} tone="sleep" fraction={(now-Date.parse(state.activeSleep.startedAt))/(feedInterval*3600000)}/>}</span><span className="care-action-label"><strong>{state?.activeSleep?'End sleep':'Start sleep'}</strong><span>{state?.activeSleep?`${durationText((now-Date.parse(state.activeSleep.startedAt))/60000)} · started ${clock(state.activeSleep.startedAt)}`:'A timer you can both use'}</span></span><span className="care-action-end">{state?.activeSleep?<Square size={22}/>:<Play size={24}/>}</span></button><button className="finished-sleep" onClick={()=>open('sleep')} disabled={!canSave}>Log a sleep that already ended <ChevronRight size={16}/></button></section>}
 </section>
 <button className="more-care-toggle" onClick={()=>setMoreCare(!moreCare)} aria-expanded={moreCare}>{moreCare?'Fewer options':'More care options'}<ChevronRight size={20} className={moreCare?'turned':''}/></button>
 {moreCare&&<div className="easy-more">{[{kind:'medicine',label:'Medicine',icon:Pill},{kind:'note',label:'Care note',icon:NotebookPen}].filter(a=>trackingEnabled(plan,a.kind as 'weight'|'medicine'|'note')).map(a=><button key={a.kind} onClick={()=>open(a.kind as Kind)} disabled={!canSave}><a.icon size={24}/><span>{a.label}</span><Plus size={20}/></button>)}<button onClick={()=>openSettings('details')} disabled={!state}><Settings2 size={24}/><span>Care plan & handoff</span><ChevronRight size={20}/></button></div>}
 <button className="see-tracker" onClick={()=>changePage('tracker')}><BarChart3 size={20}/>See today’s tracker<ChevronRight size={18}/></button>
 </div>
 </>:page==='tracker'&&<>
 <div className="tracker-controls curated-date-controls"><div className="date-controls"><button className="icon-button" aria-label="Previous tracker day" onClick={()=>setDay(stepTrackerDay(day,'daily',-1,today))}><ChevronLeft size={19}/></button><label className="date-display"><CalendarDays size={16}/><span>{prettyDay(day,true)}</span><input aria-label="Choose tracker date" type="date" value={day} max={today} onChange={event=>{if(event.target.value)setDay(event.target.value>today?today:event.target.value);}}/></label><button className="icon-button" aria-label="Next tracker day" disabled={day>=today} onClick={()=>setDay(stepTrackerDay(day,'daily',1,today))}><ChevronRight size={19}/></button><button className="today-button" onClick={()=>setDay(today)}>Today</button></div><button className="outline-button" disabled={!state} onClick={()=>openSettings('tracking')}><Settings2 size={16}/>Customize</button></div>
 {state?.day!==selectedDay?<div className="loading-panel"><RefreshCw size={20}/><p>Loading the shared log…</p><button className="text-link" onClick={()=>refresh()}>Try again</button></div>:<CareTracker focus={trackerFocus} onFocus={setTrackerFocus} range={trackerRange} onRangeChange={setTrackerRange} items={items} weights={state.weights} plan={plan} day={day} now={now} revision={plan.version+trendRevision} onWeight={()=>open('weight')} onEditWeight={entry=>open('weight','',entry)} onSettings={()=>openSettings('goals')} onPlan={()=>openSettings('plan')} onPlay={()=>changePage('play')} onDay={selectTrackerDay} renderEntry={entry=><SwipeEntry entry={entry} disabled={!canSave} onEdit={event=>open(event.kind,event.subtype,event)} onDelete={deleteLogEntry}/>}/>}
 </>}
 <footer className="footer"><span><Heart size={13}/>Made for your little team.</span><button onClick={()=>setShowHelp(true)}><Info size={14}/>Help & sharing</button></footer>
 </main></div>

 {toast&&<div className={'toast '+(toastError?'toast-error':'')} role={toastError?'alert':'status'}>{toastError?<Info size={18}/>:<Check size={18}/>}{toast}{savedEntry&&<span className="save-toast-actions">
   <button type="button" disabled={busy||!!draft} onClick={()=>{const entry=savedEntry.entry;setToast('');open(entry.kind,entry.subtype,entry);}}>Edit</button>
   {savedEntry.canUndo&&<button type="button" disabled={!canSave||!!draft} onClick={()=>void undoSavedEntry()}>Undo</button>}
  </span>}<button aria-label="Dismiss message"  onClick={()=>setToast('')}><X size={16}/></button></div>}
 {draft&&<Modal title={editingTime?'Set time':draft.version?'Edit '+eventTitle({kind:draft.kind,subtype:draft.subtype}).toLowerCase():'Log '+({bottle:'a leftover bottle',feed:'a feed',diaper:'a diaper',sleep:'a finished sleep',pump:'pumping',weight:'weight',medicine:'medicine or supplement',note:'a care note',tummy:'tummy time',exercise:'exercise'}[draft.kind])} onClose={()=>{if(busy)return;if(editingTime)setEditingTime(false);else setDraft(null);}}><form onSubmit={saveEntry} className={'care-form '+(['pump','bottle'].includes(draft.kind)?'pump-form':'')}>
 <EntryFields recentFeeds={recentFeeds} editingTime={editingTime} onEditTime={()=>setEditingTime(true)} onDoneTime={()=>setEditingTime(false)} allowNursing={trackingEnabled(plan,'nursing')} key={draft.id} draft={draft} setDraft={setDraft} activeSleep={state?.activeSleep}/>
 {!editingTime&&<>{formError&&<p className="form-error" role="alert">{formError}</p>}<div className="easy-save">{deleteRequested?<div className="delete-confirmation" role="group" aria-labelledby="delete-entry-title"><h3 id="delete-entry-title">Delete this entry?</h3><p>It will be removed from your shared log and totals on both phones.</p><button type="button" className="delete-confirm-button" onClick={deleteEntry} disabled={busy}>{busy?<RefreshCw size={20}/>:<Trash2 size={20}/>} {busy?'Deleting…':'Delete entry'}</button><button type="button" className="keep-entry-button" autoFocus disabled={busy} onClick={()=>{setDeleteRequested(false);setFormError('');}}>Keep entry</button></div>:<><button type="submit" className="primary-button" disabled={busy||!entryReady(draft)}>{busy?<RefreshCw size={19}/>:<Check size={21}/>} {busy?'Saving…':draft.kind==='bottle'?(draft.version?'Save bottle':'Start 2-hour timer'):draft.kind==='feed'&&draft.subtype!=='nursing'&&draft.amount!==''?`Save ${draft.amount} mL feed`:draft.kind==='feed'&&draft.subtype==='nursing'&&draft.duration?`Save ${draft.duration} min feed`:draft.kind==='pump'&&draft.amount!==''?`Save ${draft.amount} mL${draft.version?'':' & start timer'}`:draft.kind==='sleep'&&draft.duration?`Save ${durationText(Number(draft.duration))} sleep`:draft.kind==='weight'?'Save weight & update growth':draft.kind==='diaper'?'Save diaper':draft.kind==='tummy'?'Save session':'Save entry'}</button>{!entryReady(draft)&&<p>{['feed','pump','sleep'].includes(draft.kind)?(draft.kind==='sleep'||draft.subtype==='nursing'?'Choose a duration above to continue.':'Choose an amount above to continue.'):'Add the details above to continue.'}</p>}{draft.version&&<button type="button" className="danger-button" onClick={()=>{setFormError('');setDeleteRequested(true);}} disabled={busy}><Trash2 size={17}/>Delete this entry</button>}</>}</div></>}</form></Modal>}
 {planDraft&&<Modal title="Care settings" onClose={()=>{if(!busy)setPlanDraft(null);}} wide><CareSettings key={settingsSection} weights={state?.weights??[]} value={planDraft} onChange={setPlanDraft} section={settingsSection} busy={busy} error={formError} onSubmit={savePlan} onClose={()=>setPlanDraft(null)}/></Modal>}
 {showHelp&&<Modal title="Your little team" onClose={()=>setShowHelp(false)}><div className="help-content"><span className="help-icon"><LockKeyhole size={27}/></span><h3>A private, shared care journal.</h3><p>Your entries are stored together online, rather than on one phone. Authorized visitors to this site share the same journal and can add, edit, and delete entries. Each entry records the signed-in caregiver.</p><div className="help-box"><strong>One journal for both of you</strong><p>Sign in using the account that has access. You and Sam can use the same link on your phones.</p></div><p>Both phones refresh every four seconds while open. Shared timers continue while the page is closed. Entries require an internet connection, and failed saves stay in their form.</p><details className="care-inline-details help-timing"><summary><Milk size={17}/>Feeding chart references<ChevronRight size={16}/></summary><div><p>Auto plan uses the latest logged weight before the expected due date, starting November 17. The age-based table covers weeks 3 through 22 and uses illustrative weights.</p><p>You can switch to a custom daily or weight-based goal in settings. Pumping follows the feeding range unless you set a custom pumping goal. Measured bottle amounts determine intake totals.</p><a className="source-link" href="https://doi.org/10.1097/MPG.0000000000003642" target="_blank" rel="noreferrer">ESPGHAN: enteral nutrition in preterm infants</a></div></details><details className="care-inline-details help-timing"><summary><Clock3 size={17}/>Milk timing guide<ChevronRight size={16}/></summary><div><p>The fresh-milk clock is your 3h 30m refrigeration reminder, not a safety limit. For premature babies, refrigerate immediately and follow the NICU plan.</p><p>The leftover-bottle clock counts up to two hours from the end of a breast-milk feed. Any earlier warming or NICU limit wins. Refrigeration does not restart it. Formula has different rules.</p><p>Used and Discard close the timer and record what happened to the milk. Timers update while the page is open; there are no background alarms.</p></div></details><details className="care-inline-details help-timing"><summary><Baby size={17}/>Tummy time &amp; play<ChevronRight size={16}/></summary><div><p>Try short sessions when he is awake and settled, with you watching closely. Build time gradually as he tolerates it. Afterwards, either of you can save a session and add what you noticed. The tracker compares those observations over time. Use the optional timer whenever you want to record a duration.</p><a className="source-link" href="https://cahs.health.wa.gov.au/~/media/HSPs/CAHS/Documents/Neonatology/Developmental-physio-for-going-home-from-NICU.pdf" target="_blank" rel="noreferrer">NICU developmental physiotherapy guide <ArrowUpRight size={13}/></a></div></details><div className="export-options"><a className="outline-button" href="/api/export?format=csv" download><Download size={16}/>Export all entries · CSV</a><a className="outline-button" href="/api/export" download><Download size={16}/>Export full journal · JSON</a></div><p className="small-note">Exports include the complete saved history. This journal supports your care routine; follow the NICU team’s instructions for feeding and monitoring.</p><button className="primary-button" onClick={()=>setShowHelp(false)}>Got it</button></div></Modal>}
 </div>;
}
