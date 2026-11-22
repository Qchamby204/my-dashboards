'use client';
import {memo,useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Plus} from 'lucide-react';

const graduations = Array.from({length:60},(_,i)=>{
  const a=i*Math.PI/30, outer=i%5===0?69:66.5;
  return <line key={i} x1={75+63*Math.sin(a)} y1={75-63*Math.cos(a)}
    x2={75+outer*Math.sin(a)} y2={75-outer*Math.cos(a)}
    stroke={i%5===0?'#e8c38e':'#8eaa95'} strokeWidth={i%5===0?1.5:.8}/>;
});
const format = (v:number) => v.toLocaleString('en-CA',{maximumFractionDigits:1});

function Glass({fraction,rock,tilt=0,pour=0}:{fraction:number;rock:number;tilt?:number;pour?:number}) {
  const id=useId();
  const url=(name:string)=>`url(#${id}-${name})`;
  const y=132-114*fraction;
  const surface=`M10 ${y-rock-tilt} Q45 ${y+rock*1.8-tilt*.5} 75 ${y} T140 ${y+rock+tilt}`;
  return <svg className="milk-dial-glass" viewBox="0 0 150 150" aria-hidden="true">
    <defs>
      <clipPath id={id+'-well'}><circle cx="75" cy="75" r="57"/></clipPath>
      <radialGradient id={id+'-face'} cx=".35" cy=".2" r=".95"><stop stopColor="#597569"/><stop offset=".55" stopColor="#314e45"/><stop offset="1" stopColor="#152f29"/></radialGradient>
      <linearGradient id={id+'-milk'} x2=".85" y2="1"><stop stopColor="#fff2cf"/><stop offset=".55" stopColor="#dfcda6"/><stop offset="1" stopColor="#bea881"/></linearGradient>
      <linearGradient id={id+'-rim'} x2=".8" y2="1"><stop stopColor="#f1dfb8"/><stop offset=".32" stopColor="#849789"/><stop offset=".63" stopColor="#4f685e"/><stop offset="1" stopColor="#bdb48e"/></linearGradient>
    </defs>
    {graduations}
    <circle cx="75" cy="76" r="60" fill="#142d27"/>
    <circle cx="75" cy="75" r="59" fill={url('face')} stroke={url('rim')} strokeWidth="2"/>
    <g clipPath={url('well')}>
      <path d={surface+' V145 H10 Z'} fill={url('milk')}/>
      {fraction>0&&fraction<1&&<path d={surface} fill="none" stroke="#f2f8dc" strokeWidth="1.4"/>}
      {pour>0&&<g className="milk-pour" opacity={Math.min(1,pour*1.6)}>
        <rect x={75-1.6*pour} y="14" width={3.2*pour} height={Math.max(0,y-14)} rx="1.6" fill={url('milk')}/>
        <circle cx={70} cy={y-3-4*pour} r={1.4*pour} fill="#fff4d8"/><circle cx={81} cy={y-2-6*pour} r={1.1*pour} fill="#fff4d8"/>
        <ellipse cx="75" cy={y+1} rx={10+8*(1-pour)} ry="1.6" fill="none" stroke="#fff6de" strokeWidth=".8" opacity={pour}/>
      </g>}
    </g>
    <path d="M28 59 A50 50 0 0 1 69 25" fill="none" stroke="#eff4db" opacity=".46" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>;
}

/* The surface follows how the phone is held, with a little slosh. */
function useTilt(){
  const [tilt,setTilt]=useState(0);
  useEffect(()=>{
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let target=0,pos=0,vel=0,raf=0;
    const step=()=>{vel=(vel+(target-pos)*.06)*.88;pos+=vel;setTilt(Math.round(pos*10)/10);
      raf=Math.abs(vel)>.02||Math.abs(target-pos)>.05?requestAnimationFrame(step):0;};
    const aim=(t:number)=>{target=Math.max(-13,Math.min(13,t));if(!raf)raf=requestAnimationFrame(step);};
    const onOrient=(e:DeviceOrientationEvent)=>{if(e.gamma!==null)aim(e.gamma/3);};
    const onPointer=(e:PointerEvent)=>{if(e.pointerType!=='mouse')return;aim((e.clientX/window.innerWidth-.5)*7);};
    type Gate={requestPermission?:()=>Promise<string>};
    const gate=(window.DeviceOrientationEvent as unknown as Gate|undefined)?.requestPermission;
    const ask=()=>{gate?.().then(r=>{if(r==='granted')window.addEventListener('deviceorientation',onOrient);}).catch(()=>{});};
    if(gate)document.addEventListener('touchend',ask,{once:true});
    else window.addEventListener('deviceorientation',onOrient);
    window.addEventListener('pointermove',onPointer);
    return ()=>{cancelAnimationFrame(raf);window.removeEventListener('deviceorientation',onOrient);window.removeEventListener('pointermove',onPointer);document.removeEventListener('touchend',ask);};
  },[]);
  return tilt;
}
function LiveGlass(props:{fraction:number;rock:number;pour:number}){const tilt=useTilt();return <Glass {...props} tilt={tilt}/>;}

type Props={volume:number|null;count:number;disabled:boolean;onOpen:()=>void;rings?:(scale:number)=>ReactNode;ringsLabel?:string};
export default function MilkDial({volume,count,disabled,onOpen,rings,ringsLabel}:Props) {
  const scale=Math.max(500,Math.ceil((volume??0)/500)*500);
  return <button className="milk-dial-card" type="button" disabled={disabled} onClick={onOpen}
    aria-label={'Log a feed. Bottle intake today: '+(volume===null?'unavailable':format(volume)+' millilitres across '+count+(count===1?' feed':' feeds'))+(ringsLabel?'. '+ringsLabel:'')}>
    <span className="milk-dial-copy"><span className="milk-dial-title">Bottle intake today</span>
      <DialReading volume={volume} scale={scale} rings={rings?.(scale)}/>
      <span className="milk-dial-action"><Plus size={16}/>Log a feed</span>
    </span>
  </button>;
}

const DialReading=memo(function DialReading({volume,scale,rings}:{volume:number|null;scale:number;rings?:ReactNode}){
  const latest=useRef(volume);
  const [frame,setFrame]=useState({amount:volume,rock:0,pour:0});
  useEffect(()=>{
    const start=latest.current;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0;
    const settle=()=>{
      cancelAnimationFrame(raf);
      latest.current=volume;
      setFrame({amount:volume,rock:0,pour:0});
    };
    if(start===null||volume===null||start===volume||preference.matches){settle();return;}
    const since=performance.now();
    const tick=(now:number)=>{
      const t=Math.min(1,(now-since)/1300);
      if(t>=1){settle();return;}
      const amount=start+(volume-start)*(1-(1-t)**3);
      latest.current=amount;
      setFrame({amount,rock:5*Math.sin(t*2*Math.PI)*Math.sin(t*Math.PI)*(1-t),pour:volume>start?Math.max(0,Math.min(1,(.78-t)*4,t*8)):0});
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const onPreference=()=>{if(preference.matches)settle();};
    preference.addEventListener('change',onPreference);
    return ()=>{cancelAnimationFrame(raf);preference.removeEventListener('change',onPreference);};
  },[volume]);
  const amount=frame.amount;
  return <><span className="milk-dial-volume" aria-hidden="true"><b>{amount===null?'—':format(amount===volume?amount:Math.round(amount))}</b> mL</span>
    <span className="milk-dial-instrument" aria-hidden="true"><span className="milk-dial-well"><LiveGlass fraction={Math.min(1,(amount??0)/scale)} rock={frame.rock} pour={frame.pour}/>{rings}</span>
      <span>{amount===null?'Awaiting intake':`0–${format(scale)} mL`}</span></span></>;
});
