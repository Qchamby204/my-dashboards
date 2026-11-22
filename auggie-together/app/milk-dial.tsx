'use client';
import {memo,useEffect,useId,useRef,useState} from 'react';
import {Plus} from 'lucide-react';

const graduations = Array.from({length:60},(_,i)=>{
  const a=i*Math.PI/30, outer=i%5===0?69:66.5;
  return <line key={i} x1={75+63*Math.sin(a)} y1={75-63*Math.cos(a)}
    x2={75+outer*Math.sin(a)} y2={75-outer*Math.cos(a)}
    stroke={i%5===0?'#e8c38e':'#8eaa95'} strokeWidth={i%5===0?1.5:.8}/>;
});
const format = (v:number) => v.toLocaleString('en-CA',{maximumFractionDigits:1});

function Glass({fraction,rock}:{fraction:number;rock:number}) {
  const id=useId();
  const url=(name:string)=>`url(#${id}-${name})`;
  const y=132-114*fraction;
  const surface=`M10 ${y-rock} Q45 ${y+rock*1.8} 75 ${y} T140 ${y+rock}`;
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
    </g>
    <path d="M28 59 A50 50 0 0 1 69 25" fill="none" stroke="#eff4db" opacity=".46" strokeWidth="1.4" strokeLinecap="round"/>
  </svg>;
}

type Props={volume:number|null;count:number;disabled:boolean;onOpen:()=>void};
export default function MilkDial({volume,count,disabled,onOpen}:Props) {
  const scale=Math.max(500,Math.ceil((volume??0)/500)*500);
  return <button className="milk-dial-card" type="button" disabled={disabled} onClick={onOpen}
    aria-label={'Log a feed. Bottle intake today: '+(volume===null?'unavailable':format(volume)+' millilitres across '+count+(count===1?' feed':' feeds'))}>
    <span className="milk-dial-copy"><span className="milk-dial-title">Bottle intake today</span>
      <DialReading volume={volume} scale={scale}/>
      <span className="milk-dial-action"><Plus size={16}/>Log a feed</span>
    </span>
  </button>;
}

const DialReading=memo(function DialReading({volume,scale}:{volume:number|null;scale:number}){
  const latest=useRef(volume);
  const [frame,setFrame]=useState({amount:volume,rock:0});
  useEffect(()=>{
    const start=latest.current;
    const preference=window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf=0;
    const settle=()=>{
      cancelAnimationFrame(raf);
      latest.current=volume;
      setFrame({amount:volume,rock:0});
    };
    if(start===null||volume===null||start===volume||preference.matches){settle();return;}
    const since=performance.now();
    const tick=(now:number)=>{
      const t=Math.min(1,(now-since)/850);
      if(t>=1){settle();return;}
      const amount=start+(volume-start)*(1-(1-t)**3);
      latest.current=amount;
      setFrame({amount,rock:5*Math.sin(t*2*Math.PI)*Math.sin(t*Math.PI)*(1-t)});
      raf=requestAnimationFrame(tick);
    };
    raf=requestAnimationFrame(tick);
    const onPreference=()=>{if(preference.matches)settle();};
    preference.addEventListener('change',onPreference);
    return ()=>{cancelAnimationFrame(raf);preference.removeEventListener('change',onPreference);};
  },[volume]);
  const amount=frame.amount;
  return <><span className="milk-dial-volume" aria-hidden="true"><b>{amount===null?'—':format(amount===volume?amount:Math.round(amount))}</b> mL</span>
    <span className="milk-dial-instrument" aria-hidden="true"><Glass fraction={Math.min(1,(amount??0)/scale)} rock={frame.rock}/>
      <span>{amount===null?'Awaiting intake':`0–${format(scale)} mL`}</span></span></>;
});
