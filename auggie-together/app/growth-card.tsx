'use client';
import {Plus,Scale} from 'lucide-react';
import {dayKey,prettyDay,type CareEvent} from '@/lib/care';
import {calendarDays,growthSummary,poundsOunces,weeklyGrowthProjection} from '@/lib/growth';
const number=(value:number)=>value.toLocaleString('en-CA',{maximumFractionDigits:1});
const signed=(value:number)=>(value>0?'+':'')+number(value);
export default function GrowthCard({weights,day,today,range,onAdd,onEdit}:{weights:CareEvent[];day:string;today:string;range:number;onAdd:()=>void;onEdit:(entry:CareEvent)=>void}){
 const s=growthSummary(weights,day,range),latest=s.latest;
 const projection=day===today?weeklyGrowthProjection(s,today):[];
 const points=s.points,values=points.map(row=>row.amount!);
 const low=Math.min(...values)-50,high=Math.max(...values)+50;
 const first=points[0],last=points.at(-1);
 const span=first&&last?Math.max(1,calendarDays(dayKey(first.startedAt),dayKey(last.startedAt))):1;
 const x=(row:CareEvent)=>40+calendarDays(dayKey(first.startedAt),dayKey(row.startedAt))/span*306;
 const y=(row:CareEvent)=>120-(row.amount!-low)/(high-low)*90;
 return <section className="curated-card growth-card" aria-label="Growth">
  <header><span className="care-action-icon sand"><Scale size={24}/></span><div><h2>Growth</h2><p>Measured weights · daily gain</p></div><button className="curated-goal-edit" onClick={onAdd}><Plus size={16}/>Add weight</button></header>
  {latest?<>
   <div className="curated-volume"><div><strong>{number(latest.amount!)}</strong><span>grams · {poundsOunces(latest.amount!)}</span></div><div><span>Last measured</span><strong className="growth-measured-date">{prettyDay(dayKey(latest.startedAt),true)}</strong><small>{s.ageDays===0?(day===today?'Measured today':'Measured on selected date'):`${s.ageDays} ${s.ageDays===1?'day':'days'} before selected date`}</small></div></div>
   <div className="curated-facts"><div><span>Average daily gain</span><strong>{s.dailyGain===null?'—':signed(s.dailyGain)+' g/day'}</strong><small>{s.previous?`${prettyDay(dayKey(s.previous.startedAt),true)} – ${prettyDay(dayKey(latest.startedAt),true)}`:'Add another weigh-in to see gain'}</small></div><div><span>Since previous weigh-in</span><strong>{s.gain===null?'—':signed(s.gain)+' g'}</strong><small>{s.interval?`Across ${s.interval} days`:'No daily weighing needed'}</small></div></div>
   {range>1&&<p className="curated-today-line">{s.trendGain===null?'Two dated weigh-ins are needed for a trend.':`Period growth pace · ${signed(s.trendGain)} g/day across ${s.trendDays} days`}</p>}
   {points.length>0&&<div className="curated-chart growth-chart"><p className="curated-chart-label">{range===1?'Recent weigh-ins':`Last ${range} days + preceding weigh-in`}</p><svg viewBox="0 0 370 145" role="img" aria-label="Measured weight in grams by date. Each dot is a real weigh-in.">
    {[low,(low+high)/2,high].map(value=><g key={value}><line x1="38" x2="355" y1={120-(value-low)/(high-low)*90} y2={120-(value-low)/(high-low)*90} stroke="var(--line)" strokeDasharray="3 4"/><text x="33" y={123-(value-low)/(high-low)*90} textAnchor="end" fontSize="9" fill="var(--muted)">{Math.round(value)}</text></g>)}
    <polyline points={points.map(row=>`${x(row)},${y(row)}`).join(' ')} stroke="var(--sand-text)" strokeWidth="2" fill="none"/>
    {points.map(row=><circle key={row.id} cx={x(row)} cy={y(row)} r="5" fill="var(--sand-text)" role="button" tabIndex={0} aria-label={`Edit weight ${number(row.amount!)} grams, ${prettyDay(dayKey(row.startedAt))}`} onClick={()=>onEdit(row)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onEdit(row);}}}><title>{prettyDay(dayKey(row.startedAt),true)} · {number(row.amount!)} g</title></circle>)}
   </svg><div className="trend-dates"><span>{prettyDay(dayKey(first.startedAt),true)}</span><span>{prettyDay(dayKey(last!.startedAt),true)}</span></div><p className="curated-legend">Dots · measured weights</p></div>}
   <p className="small-note">Daily gain is averaged across the days between weigh-ins.</p>
   {projection.length>0&&<details className="care-inline-details">
    <summary>Year-end projection <span>{signed(s.dailyGain!)} g/day</span></summary>
    <div>
     <p className="small-note">Estimates assume the pace between the two latest weigh-ins continues. New weigh-ins update the projection.</p>
     <table className="growth-projection" aria-label="Projected weekly weights">
      <thead><tr><th scope="col">Date</th><th scope="col">Grams</th><th scope="col">Pounds</th></tr></thead>
      <tbody>{projection.map(row=><tr key={row.day}>
       <th scope="row">{prettyDay(row.day,true)}</th>
       <td>{number(row.grams)}</td><td>{poundsOunces(row.grams)}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </details>}
   <details className="care-inline-details"><summary>Weigh-in history <span>{s.history.length} measurements</span></summary><div className="growth-history">{[...s.history].reverse().map(row=><button key={row.id} type="button" onClick={()=>onEdit(row)}><span>{prettyDay(dayKey(row.startedAt),true)}</span><strong>{number(row.amount!)} g</strong></button>)}</div></details>
  </>:<p className="small-note">Add his latest measured weight to start tracking daily gain.</p>}
 </section>;
}
