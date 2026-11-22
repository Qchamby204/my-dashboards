'use client';
// The natural instrument layer: rings, the day sundial, the lake atmosphere and
// small moments. Everything here is decorative or mirrors data already shown in
// text, so none of it changes what is logged.
import {useEffect,useRef,useState} from 'react';
import {clock,eventTitle,toInput,type CareEvent} from '@/lib/care';

const TAU=Math.PI*2;
const polar=(c:number,r:number,turn:number)=>[c+r*Math.sin(turn*TAU),c-r*Math.cos(turn*TAU)] as const;
const minuteOfDay=(value:string|Date)=>{const [h,m]=toInput(value).slice(11).split(':').map(Number);return h*60+m;};
export const span=(minutes:number)=>{const m=Math.max(0,Math.round(minutes));return m<60?`${m}m`:`${Math.floor(m/60)}h ${String(m%60).padStart(2,'0')}m`;};
function arc(c:number,r:number,from:number,to:number){
  const [x1,y1]=polar(c,r,from),[x2,y2]=polar(c,r,to);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${to-from>.5?1:0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

/* Growth rings around the milk glass. Drawn on a 180 box whose centre matches
   the glass, so radius 69 is the glass's outer graduation. */
export function NatureRings({volume,low,high,scale,wet,dirty,sleep,pulse}:{volume:number|null;low:number|null;high:number|null;scale:number;wet:number;dirty:number;sleep:number;pulse:number}){
  const target=high??scale;
  const fill=volume===null?0:Math.min(1,volume/target);
  const pearls=[...Array(Math.min(wet,14)).fill('wet'),...Array(Math.min(dirty,14)).fill('dirty')].slice(0,24);
  return <svg className="nature-rings" viewBox="0 0 180 180" aria-hidden="true">
    <circle className="ring-track" cx="90" cy="90" r="79"/>
    {low!==null&&high!==null&&low<high&&<path className="ring-goal" d={arc(90,79,low/high,.999)}/>}
    <circle className={'ring-intake'+(fill>=1||(low!==null&&volume!==null&&volume>=low)?' is-met':'')} cx="90" cy="90" r="79" pathLength={100}
      strokeDasharray={`${(fill*100).toFixed(2)} 100`} transform="rotate(-90 90 90)"/>
    {fill>0&&fill<1&&(()=>{const [x,y]=polar(90,79,fill);return <circle className="ring-tip" cx={x} cy={y} r="2.6"/>;})()}
    <circle className="ring-sleep-track" cx="90" cy="90" r="73"/>
    {sleep>0&&<circle className="ring-sleep" cx="90" cy="90" r="73" pathLength={100} strokeDasharray={`${Math.min(100,sleep/1440*100).toFixed(2)} 100`} transform="rotate(-90 90 90)"/>}
    {pearls.map((kind,i)=>{const [x,y]=polar(90,86.5,i/30);return <circle key={i} className={'ring-pearl '+kind} cx={x} cy={y} r="2.3"/>;})}
    {pulse>0&&<g key={pulse} className="ring-ripple"><circle cx="90" cy="90" r="70"/><circle cx="90" cy="90" r="70"/></g>}
  </svg>;
}

/* A 24 hour sundial for Today's rhythm. */
export function DaySundial({entries,now,isToday}:{entries:CareEvent[];now:number;isToday:boolean}){
  const c=90;
  const feeds=entries.filter(e=>e.kind==='feed'),changes=entries.filter(e=>e.kind==='diaper');
  const other=entries.filter(e=>e.kind!=='feed'&&e.kind!=='diaper'&&e.kind!=='sleep');
  const sleeps=entries.filter(e=>e.kind==='sleep').map(e=>{
    const a=minuteOfDay(e.startedAt)/1440;
    const endMs=e.endedAt?Date.parse(e.endedAt):now;
    const b=Math.min(1,a+Math.max(0,endMs-Date.parse(e.startedAt))/86400000);
    return {id:e.id,a,b:Math.max(a+.004,b)};
  });
  const hand=minuteOfDay(new Date(now))/1440;
  const time=clock(new Date(now).toISOString()).split(/\s+/);
  const [hx,hy]=polar(c,74,hand);
  const label=entries.length?`${feeds.length} feeds, ${changes.length} changes and ${sleeps.length} sleeps placed around a 24 hour dial`:'No entries yet on the 24 hour dial';
  return <svg className="day-sundial" viewBox="0 0 180 180" role="img" aria-label={label}>
    <circle className="sundial-face" cx={c} cy={c} r="84"/>
    <path className="sundial-daylight" d={arc(c,78,6/24,18/24)}/>
    <path className="sundial-night" d={arc(c,78,18/24,1)}/><path className="sundial-night" d={arc(c,78,0,6/24)}/>
    {Array.from({length:24},(_,h)=>{const [x1,y1]=polar(c,h%6?80.5:79,h/24),[x2,y2]=polar(c,84,h/24);return <line key={h} className={h%6?'tick':'tick major'} x1={x1} y1={y1} x2={x2} y2={y2}/>;})}
    {sleeps.map(s=><path key={s.id} className="sundial-sleep" d={arc(c,52,s.a,s.b)}><title>Sleep</title></path>)}
    {other.map(e=>{const [x,y]=polar(c,52,minuteOfDay(e.startedAt)/1440);return <rect key={e.id} className="sundial-other" x={x-2.4} y={y-2.4} width="4.8" height="4.8" transform={`rotate(45 ${x} ${y})`}><title>{eventTitle(e)+' · '+clock(e.startedAt)}</title></rect>;})}
    {changes.map(e=>{const [x,y]=polar(c,62,minuteOfDay(e.startedAt)/1440);return <rect key={e.id} className="sundial-change" x={x-2.6} y={y-2.6} width="5.2" height="5.2" rx="1.2"><title>{eventTitle(e)+' · '+clock(e.startedAt)}</title></rect>;})}
    {feeds.map(e=>{const [x,y]=polar(c,71,minuteOfDay(e.startedAt)/1440);return <circle key={e.id} className="sundial-feed" cx={x} cy={y} r="3.5"><title>{eventTitle(e)+' · '+clock(e.startedAt)}</title></circle>;})}
    {isToday&&<g className="sundial-hand"><line x1={c} y1={c} x2={hx} y2={hy}/><circle cx={hx} cy={hy} r="4.4"/><circle className="sun-core" cx={hx} cy={hy} r="2"/></g>}
    <circle className="sundial-hub" cx={c} cy={c} r="31"/>
    <text className="sundial-time" x={c} y={c+2}>{isToday?time[0]:'Day'}</text>
    <text className="sundial-sub" x={c} y={c+15}>{isToday?time.slice(1).join(' '):'complete'}</text>
    {['12a','6a','12p','6p'].map((t,i)=>{const [x,y]=polar(c,41,i/4);return <text key={t} className="sundial-hour" x={x} y={y+2.6}>{t}</text>;})}
  </svg>;
}

/* Lake atmosphere: morning mist on the first open, a shimmer on the water and,
   in the dark theme, fireflies and a dusk glow. */
export function LakeSky({flare}:{flare:number}){
  useEffect(()=>{
    const root=document.documentElement;
    if(root.dataset.misted)return;
    const id=setTimeout(()=>{root.dataset.misted='1';},2600);
    return ()=>clearTimeout(id);
  },[]);
  return <div className="lake-sky" aria-hidden="true">
    <i className="lake-glow"/><i className="lake-shimmer"/>
    {Array.from({length:9},(_,i)=><b key={i} className={'firefly f'+i}/>)}
    <i className="lake-mist"/>
    {flare>0&&<i key={flare} className="lake-dawn"/>}
  </div>;
}

/* A small ring that closes as a timer runs down. */
export function TimerRing({fraction,size=30,tone}:{fraction:number;size?:number;tone?:string}){
  const f=Math.max(0,Math.min(1,fraction));
  const t=tone??(f>.5?'calm':f>.2?'soon':'late');
  return <svg className={'timer-ring '+t} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
    <circle cx="18" cy="18" r="14.5" className="timer-ring-track"/>
    <circle cx="18" cy="18" r="14.5" className="timer-ring-fill" pathLength={100} strokeDasharray={`${(f*100).toFixed(2)} 100`} transform="rotate(-90 18 18)"/>
  </svg>;
}

/* Cards rise in as they come into view, the way the rest of the suite does. */
export function useRiseIn(selector:string,key:unknown){
  useEffect(()=>{
    if(!selector||typeof IntersectionObserver==='undefined'||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const seen=new WeakSet<Element>();
    const io=new IntersectionObserver(rows=>rows.forEach(row=>{if(row.isIntersecting){row.target.classList.add('is-risen');io.unobserve(row.target);}}),{rootMargin:'0px 0px -6% 0px'});
    const scan=()=>document.querySelectorAll(selector).forEach((el,i)=>{if(seen.has(el))return;seen.add(el);el.classList.add('will-rise');(el as HTMLElement).style.setProperty('--rise-i',String(i%6));io.observe(el);});
    scan();
    const mo=new MutationObserver(scan);
    const main=document.querySelector('main');if(main)mo.observe(main,{childList:true,subtree:true});
    return ()=>{io.disconnect();mo.disconnect();};
  },[selector,key]);
}

/* Fires a counter whenever a value grows, ignoring the first reading. */
export function useGrowth(value:number|null,scope:string){
  const last=useRef<{scope:string;value:number|null}>({scope,value:null});
  const [count,setCount]=useState(0);
  useEffect(()=>{
    const prev=last.current;
    last.current={scope,value};
    if(prev.scope!==scope||prev.value===null||value===null)return;
    if(value>prev.value)setCount(n=>n+1);
  },[value,scope]);
  return count;
}
