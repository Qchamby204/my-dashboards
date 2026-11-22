import {Fragment,useEffect,useRef,useState,type ReactNode} from 'react';
import {clock,eventTitle,toInput,type CareEvent} from '@/lib/care';

const lanes=['Feeds','Changes','Other care'];
export default function DayRhythm({entries,ready,renderEntry}:{entries:CareEvent[];ready:boolean;renderEntry:(entry:CareEvent)=>ReactNode}){
  const [lane,setLane]=useState<number|null>(null);
  const category=(e:CareEvent)=>e.kind==='feed'?0:e.kind==='diaper'?1:2;
  const known=useRef<Set<string>|null>(null);
  const previous=known.current;
  useEffect(()=>{
    if(ready)known.current=new Set(entries.map(e=>e.id));
  },[entries,ready]);
  return <><div className="day-rhythm" role="group" aria-label={ready?
    'Today’s rhythm. '+(entries.map(e=>eventTitle(e)+' at '+clock(e.startedAt)).join(', ')||'No entries yet.'):'Loading today’s timeline'}>
    {lanes.map((label,i)=><Fragment key={label}><button className="rhythm-label" type="button" aria-pressed={lane===i} onClick={()=>setLane(lane===i?null:i)}>{label}</button><button type="button" aria-label={['Show feed entries','Show diaper changes','Show other care entries'][i]} aria-pressed={lane===i} onClick={()=>setLane(lane===i?null:i)} className={'rhythm-lane lane-'+i}>
      {entries.filter(e=>category(e)===i).map(e=>{
        const [hour,minute]=toInput(e.startedAt).slice(11).split(':').map(Number);
        return <i key={e.id} title={eventTitle(e)+' · '+clock(e.startedAt)}
          className={previous&&!previous.has(e.id)?'rhythm-added':''} style={{left:((hour*60+minute)/1440*100)+'%'}}/>;
      })}</button></Fragment>)}
    <div className="rhythm-scale">{['12 am','6 am','Noon','6 pm','12 am'].map((t,i)=><span key={i}>{t}</span>)}</div>
  </div>{lane!==null&&<section className="rhythm-list"><header><h3>{lanes[lane]} today</h3><button onClick={()=>setLane(null)}>Close</button></header>
    {entries.some(e=>category(e)===lane)?entries.filter(e=>category(e)===lane).map(e=><div key={e.id}>{renderEntry(e)}</div>):<p>{ready?'No entries in this category today.':'Loading entries…'}</p>}
  </section>}</>;
}
