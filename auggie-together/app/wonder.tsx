'use client';
// The living layer: a lake that keeps real time and season, lantern mode for
// night feeds, the "while you were away" handoff, Auggie's sky and the
// optional water drop. Display only; nothing here writes care data.
import {useCallback,useEffect,useMemo,useState} from 'react';
import {clock,dayKey,eventDetail,eventTitle,shiftDay,toInput,type CareEvent} from '@/lib/care';

/* ---------- small preferences shared between the dialog and the app ---------- */
export type LanternMode='auto'|'on'|'off';
const PREF_EVENT='auggie-preference';
export const prefKeys={lantern:'auggie.lantern.v1',lanternSnooze:'auggie.lantern-snooze.v1',sound:'auggie.sound.v1',lastSeen:'auggie.last-seen.v1'};
function readPref(key:string){try{return localStorage.getItem(key);}catch{return null;}}
export function writePref(key:string,value:string|null){
  try{value===null?localStorage.removeItem(key):localStorage.setItem(key,value);}catch{/* keep for this page only */}
  window.dispatchEvent(new CustomEvent(PREF_EVENT,{detail:key}));
}
export function usePref(key:string,fallback:string){
  const [value,setValue]=useState(fallback);
  useEffect(()=>{
    const sync=()=>setValue(readPref(key)??fallback);
    sync();
    const onStorage=(e:StorageEvent)=>{if(e.key===key||e.key===null)sync();};
    window.addEventListener('storage',onStorage);window.addEventListener(PREF_EVENT,sync);
    return ()=>{window.removeEventListener('storage',onStorage);window.removeEventListener(PREF_EVENT,sync);};
  },[key,fallback]);
  return value;
}

/* ---------- the sun, the moon and the season over Winnipeg ---------- */
const LAT=49.9,LON=-97.14;
const minuteOf=(d:Date)=>{const [h,m]=toInput(d).slice(11).split(':').map(Number);return h*60+m;};
export function sunTimes(day:string){
  const n=Math.round((Date.parse(day+'T12:00:00Z')-Date.parse(day.slice(0,4)+'-01-01T00:00:00Z'))/86400000)+1;
  const decl=-23.44*Math.cos(2*Math.PI/365*(n+10))*Math.PI/180;
  const lat=LAT*Math.PI/180;
  const cos=(Math.sin(-0.833*Math.PI/180)-Math.sin(lat)*Math.sin(decl))/(Math.cos(lat)*Math.cos(decl));
  const half=Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI/15;
  const noonUtc=12-LON/15;
  const at=(hours:number)=>new Date(Date.parse(day+'T00:00:00Z')+hours*3600000);
  return {rise:minuteOf(at(noonUtc-half)),set:minuteOf(at(noonUtc+half))};
}
export type SkyPhase='night'|'dawn'|'day'|'golden'|'dusk';
export function skyAt(now:number){
  const date=new Date(now),day=dayKey(date),m=minuteOf(date);
  const {rise,set}=sunTimes(day);
  const phase:SkyPhase=m<rise-60||m>set+75?'night':m<rise+45?'dawn':m<set-75?'day':m<set?'golden':'dusk';
  const sun=Math.max(0,Math.min(1,(m-rise)/(set-rise)));
  const month=Number(day.slice(5,7));
  const season=month<=3||month>=11?'winter':month<=5?'spring':month<=8?'summer':'autumn';
  // Moon age from a known new moon (2000-01-06 18:14 UTC), synodic month 29.53 days.
  const age=(((now-Date.UTC(2000,0,6,18,14))/86400000)%29.530588+29.530588)%29.530588;
  return {phase,sun,season,moon:age/29.530588,rise,set};
}
function rand(seed:number){const x=Math.sin(seed*999.13)*43758.5453;return x-Math.floor(x);}

function Moon({phase}:{phase:number}){
  // phase 0 new, .5 full. Draw the lit part with an ellipse terminator.
  const lit=phase<.5?'right':'left';
  const k=Math.cos(phase*2*Math.PI);// 1 new, -1 full
  const rx=Math.abs(k)*10;
  const sweepOuter=lit==='right'?1:0;
  const sweepInner=k>0?(lit==='right'?0:1):(lit==='right'?1:0);
  const d=`M12 2 A10 10 0 0 ${sweepOuter} 12 22 A${rx.toFixed(2)} 10 0 0 ${sweepInner} 12 2Z`;
  return <svg className="sky-moon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" className="moon-dark"/><path d={d} className="moon-lit"/></svg>;
}

export function LivingSky({now,lantern}:{now:number;lantern:boolean}){
  const [mounted,setMounted]=useState(false);
  useEffect(()=>setMounted(true),[]);
  const minute=Math.floor(now/60000);
  const sky=useMemo(()=>skyAt(minute*60000),[minute]);
  const stars=useMemo(()=>Array.from({length:34},(_,i)=>({x:rand(i+1)*100,y:rand(i+40)*46,s:rand(i+80)>.82?2:1,d:rand(i+120)*4})),[]);
  const flakes=useMemo(()=>Array.from({length:42},(_,i)=>({x:rand(i+7)*100,s:2+rand(i+17)*3.5,d:7+rand(i+27)*9,delay:-rand(i+37)*16,drift:(rand(i+47)-.5)*40})),[]);
  const leaves=useMemo(()=>Array.from({length:9},(_,i)=>({x:rand(i+70)*100,d:9+rand(i+71)*7,delay:-rand(i+72)*14,hue:rand(i+73)})),[]);
  const sunX=8+sky.sun*84,sunY=48-Math.sin(sky.sun*Math.PI)*30;
  if(!mounted)return null;
  return <div className={`living-sky phase-${sky.phase} season-${sky.season}`} aria-hidden="true" data-phase={sky.phase}>
    <i className="sky-tint"/>
    {(sky.phase==='dawn'||sky.phase==='day'||sky.phase==='golden')&&<i className="sky-sun" style={{left:sunX+'%',top:sunY+'%'}}/>}
    {(sky.phase==='night'||sky.phase==='dusk')&&<div className="sky-stars">{stars.map((s,i)=><b key={i} style={{left:s.x+'%',top:s.y+'%',width:s.s,height:s.s,animationDelay:-s.d+'s'}}/>)}</div>}
    {sky.phase==='night'&&sky.moon>.04&&sky.moon<.96&&<Moon phase={sky.moon}/>}
    {sky.season==='winter'&&<div className="sky-snow">{flakes.map((f,i)=><b key={i} style={{left:f.x+'%',width:f.s,height:f.s,animationDuration:f.d+'s',animationDelay:f.delay+'s','--drift':f.drift+'px'} as React.CSSProperties}/>)}</div>}
    {sky.season==='winter'&&<i className="sky-frost"/>}
    {sky.season==='autumn'&&<div className="sky-leaves">{leaves.map((l,i)=><b key={i} style={{left:l.x+'%',animationDuration:l.d+'s',animationDelay:l.delay+'s',filter:`hue-rotate(${Math.round(l.hue*35-15)}deg)`}}/>)}</div>}
    {lantern&&<i className="dock-lantern"><i/></i>}
  </div>;
}

/* ---------- lantern mode ---------- */
const nightHour=(now:number)=>{const h=Number(toInput(new Date(now)).slice(11,13));return h>=22||h<6;};
export function useLantern(now:number){
  const mode=usePref(prefKeys.lantern,'auto') as LanternMode;
  const snooze=Number(usePref(prefKeys.lanternSnooze,'0'))||0;
  const minute=Math.floor(now/60000);
  const active=mode==='on'||(mode==='auto'&&nightHour(minute*60000)&&minute*60000>snooze);
  useEffect(()=>{
    const root=document.documentElement;
    if(active){
      if(!root.dataset.lantern){root.dataset.lanternTheme=root.dataset.atlasTheme??'';}
      root.dataset.lantern='1';root.dataset.atlasTheme='dark';
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m=>{m.content='#120b05';});
    }else if(root.dataset.lantern){
      delete root.dataset.lantern;
      const pref=root.dataset.atlasAppearance;
      root.dataset.atlasTheme=pref==='light'||pref==='dark'?pref:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');
      delete root.dataset.lanternTheme;
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m=>{m.content=root.dataset.atlasTheme==='dark'?'#1c1a2b':'#efeae3';});
    }
  },[active]);
  const dim=useCallback(()=>{
    // Off until 6 a.m., then auto again.
    const d=new Date(),[h,m]=toInput(d).slice(11).split(':').map(Number);
    writePref(prefKeys.lanternSnooze,String(d.getTime()+(((6-h+24)%24||24)*60-m)*60000));
  },[]);
  return {active,mode,snoozeTonight:dim};
}

/* ---------- the water drop ---------- */
let audio:AudioContext|null=null;
export function playDrop(){
  if(readPref(prefKeys.sound)!=='on')return;
  try{
    audio??=new (window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext)();
    const t=audio.currentTime;
    const pluck=(start:number,from:number,to:number,peak:number)=>{
      const o=audio!.createOscillator(),g=audio!.createGain();
      o.type='sine';o.frequency.setValueAtTime(from,t+start);o.frequency.exponentialRampToValueAtTime(to,t+start+.16);
      g.gain.setValueAtTime(0,t+start);g.gain.linearRampToValueAtTime(peak,t+start+.012);g.gain.exponentialRampToValueAtTime(.0001,t+start+.32);
      o.connect(g).connect(audio!.destination);o.start(t+start);o.stop(t+start+.35);
    };
    pluck(0,1150,420,.16);pluck(.09,1600,900,.05);
  }catch{/* sound is optional */}
}

/* ---------- while you were away ---------- */
export type Away={since:number;entries:CareEvent[]};
export function AwayCard({away,now,onDismiss,onOpen}:{away:Away;now:number;onDismiss:()=>void;onOpen:(e:CareEvent)=>void}){
  const feeds=away.entries.filter(e=>e.kind==='feed'),changes=away.entries.filter(e=>e.kind==='diaper');
  const milk=feeds.reduce((n,e)=>n+(e.subtype!=='nursing'?e.amount??0:0),0);
  const sleepMin=away.entries.filter(e=>e.kind==='sleep').reduce((n,e)=>n+Math.max(0,((e.endedAt?Date.parse(e.endedAt):now)-Date.parse(e.startedAt))/60000),0);
  const gone=Math.round((now-away.since)/60000);
  const shown=away.entries.slice(-8);
  return <section className="away-card" aria-label="While you were away">
    <header><div><p>While you were away</p><h2>Since {clock(new Date(away.since).toISOString())} · {gone>=60?`${Math.floor(gone/60)}h ${String(gone%60).padStart(2,'0')}m`:`${gone}m`}</h2></div>
      <button type="button" onClick={onDismiss}>Got it</button></header>
    <ul className="away-chips">
      {feeds.length>0&&<li className="feed">{feeds.length} {feeds.length===1?'feed':'feeds'}{milk?` · ${milk} mL`:''}</li>}
      {changes.length>0&&<li className="change">{changes.length} {changes.length===1?'change':'changes'}</li>}
      {sleepMin>0&&<li className="sleep">{sleepMin>=60?`${Math.floor(sleepMin/60)}h ${String(Math.round(sleepMin%60)).padStart(2,'0')}m`:`${Math.round(sleepMin)}m`} sleep</li>}
    </ul>
    <ol className="away-trail">{shown.map((e,i)=><li key={e.id} style={{'--i':i} as React.CSSProperties}><button type="button" onClick={()=>onOpen(e)}>
      <time>{clock(e.startedAt)}</time><span><strong>{eventTitle(e)}</strong><small>{eventDetail(e)}</small></span><em>{e.actor}</em></button></li>)}</ol>
    {away.entries.length>shown.length&&<p className="away-more">Plus {away.entries.length-shown.length} earlier, in Today’s rhythm.</p>}
  </section>;
}
export function useAway({ready,today,items,visible}:{ready:boolean;today:string;items:CareEvent[];visible:(e:CareEvent)=>boolean}){
  const [away,setAway]=useState<Away|null>(null);
  const [checked,setChecked]=useState(false);
  useEffect(()=>{
    if(!ready||checked)return;
    setChecked(true);
    const last=Number(readPref(prefKeys.lastSeen))||0;
    const now=Date.now();
    writePref(prefKeys.lastSeen,String(now));
    if(!last||now-last<2*3600000)return;
    const since=new Date(last).toISOString();
    const pick=(list:CareEvent[])=>list.filter(e=>!e.deleted&&e.startedAt>since&&visible(e));
    const finish=(list:CareEvent[])=>{const seen=new Set<string>();const all=list.filter(e=>!seen.has(e.id)&&seen.add(e.id)).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));if(all.length)setAway({since:last,entries:all});};
    if(dayKey(new Date(last))<today){
      fetch('/api/state?day='+shiftDay(today,-1),{cache:'no-store'}).then(r=>(r.ok?r.json():{items:[]}) as Promise<{items?:CareEvent[]}>).then((d:{items?:CareEvent[]})=>finish([...pick(d.items??[]),...pick(items)])).catch(()=>finish(pick(items)));
    }else finish(pick(items));
  },[ready,checked,today,items,visible]);
  useEffect(()=>{
    const stamp=()=>writePref(prefKeys.lastSeen,String(Date.now()));
    const onVis=()=>{if(document.visibilityState==='hidden')stamp();else{const last=Number(readPref(prefKeys.lastSeen))||0;if(last&&Date.now()-last>=2*3600000)setChecked(false);}};
    const id=setInterval(()=>{if(document.visibilityState==='visible')stamp();},60000);
    document.addEventListener('visibilitychange',onVis);window.addEventListener('pagehide',stamp);
    return ()=>{clearInterval(id);document.removeEventListener('visibilitychange',onVis);window.removeEventListener('pagehide',stamp);};
  },[]);
  return {away,dismiss:()=>setAway(null)};
}

/* ---------- Auggie's sky ---------- */
export function AuggieSky({birthDate,today,milkByDay,goalFor,onDay}:{birthDate:string;today:string;milkByDay:Map<string,number|null>;goalFor:(day:string)=>number|null;onDay:(day:string)=>void}){
  const days=useMemo(()=>{
    const count=Math.max(1,Math.round((Date.parse(today+'T12:00:00Z')-Date.parse(birthDate+'T12:00:00Z'))/86400000)+1);
    return Array.from({length:count},(_,i)=>shiftDay(birthDate,i));
  },[birthDate,today]);
  const weeks:string[][]=[];days.forEach((d,i)=>{(weeks[Math.floor(i/7)]??=[]).push(d);});
  const shownWeeks=weeks.slice(-12),firstWeek=weeks.length-shownWeeks.length;
  const W=360,H=150,colW=(W-24)/Math.max(shownWeeks.length,5);
  const stars=shownWeeks.flatMap((week,wi)=>week.map((day,di)=>{
    const milk=milkByDay.get(day)??null,goal=goalFor(day);
    const ratio=milk===null?null:goal?Math.min(1,milk/goal):Math.min(1,milk/400);
    const cx=12+colW*wi+colW*(.22+.56*rand(wi*7+di+3)),cy=28+86*(.08+.84*((di+rand(wi*11+di)*.9)/7.4));
    return {day,ratio,met:ratio!==null&&ratio>=1,cx,cy,week:firstWeek+wi};
  }));
  const met=stars.filter(s=>s.met).length,logged=stars.filter(s=>s.ratio!==null).length;
  const bg=useMemo(()=>Array.from({length:60},(_,i)=>({x:rand(i+300)*W,y:rand(i+400)*H,r:rand(i+500)*.7+.2})),[]);
  return <section className="auggie-sky" aria-label="Auggie’s sky">
    <header><div><p>Auggie’s sky</p><h2>{days.length} {days.length===1?'day':'days'} so far</h2></div><span>{met} of {logged} logged days reached the feeding goal</span></header>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`One star for each day since birth. ${met} of ${logged} logged days reached the feeding goal.`}>
      <defs><linearGradient id="aurora" x1="0" x2="1"><stop offset="0" stopColor="#5fd3a8" stopOpacity="0"/><stop offset=".35" stopColor="#5fd3a8" stopOpacity=".32"/><stop offset=".7" stopColor="#7fb7d8" stopOpacity=".22"/><stop offset="1" stopColor="#b48ad8" stopOpacity="0"/></linearGradient>
        <radialGradient id="star-glow"><stop offset="0" stopColor="#fff6dc"/><stop offset=".4" stopColor="#f6d9a0" stopOpacity=".55"/><stop offset="1" stopColor="#f6d9a0" stopOpacity="0"/></radialGradient></defs>
      <path className="sky-aurora" d={`M-10 48 C 70 18, 140 70, 200 34 S 320 20, 380 44 L380 70 C 300 52, 240 86, 180 64 S 60 70,-10 84Z`} fill="url(#aurora)"/>
      {bg.map((s,i)=><circle key={i} cx={s.x} cy={s.y} r={s.r} className="sky-dust"/>)}
      {shownWeeks.map((week,wi)=>{const pts=stars.filter(s=>s.week===firstWeek+wi);return <g key={wi}>
        <polyline className="sky-line" points={pts.filter(s=>s.ratio!==null).map(s=>`${s.cx.toFixed(1)},${s.cy.toFixed(1)}`).join(' ')}/>
        <text className="sky-week" x={12+colW*wi+colW/2} y={H-6}>wk {firstWeek+wi}</text></g>;})}
      {stars.map(s=><g key={s.day} className={'sky-star'+(s.met?' is-met':'')+(s.ratio===null?' is-empty':'')+(s.day===today?' is-today':'')} onClick={()=>onDay(s.day)}>
        {s.met&&<circle cx={s.cx} cy={s.cy} r="7" fill="url(#star-glow)"/>}
        <circle cx={s.cx} cy={s.cy} r={s.ratio===null?1.3:1.5+2*s.ratio} style={{opacity:s.ratio===null?.5:.5+.5*s.ratio}}><title>{s.day}{s.ratio===null?' · nothing logged':` · ${Math.round(s.ratio*100)}% of goal`}</title></circle>
      </g>)}
    </svg>
    <p className="sky-key">Each star is a day. The brighter it shines, the closer that day came to the feeding goal. Tap one to open it.</p>
  </section>;
}
