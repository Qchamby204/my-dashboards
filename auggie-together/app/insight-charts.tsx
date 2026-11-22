'use client';

import {useState} from 'react';
import {shortDate, type CareInsight, type DayMark, type InsightVisual, type ObservationWeek} from '@/lib/care-insights';
import {calendarDays} from '@/lib/growth';

const fmt = (n:number) => n.toLocaleString('en-CA',{maximumFractionDigits:1});
const weekday = new Intl.DateTimeFormat('en-CA',{weekday:'short',timeZone:'UTC'});

function dailyLabel(mark:DayMark,unit:string,reference:string) {
  const actual = mark.actual === null ? 'No entry' : fmt(mark.actual)+' '+unit;
  const band = mark.low === null || mark.high === null ? '' :
    ' · '+reference+' '+fmt(mark.low)+(mark.low===mark.high?'':'–'+fmt(mark.high))+' '+unit;
  return shortDate(mark.day)+' · '+actual+band;
}
function axisTop(max:number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(2,max)));
  const step = magnitude / 2;
  return Math.ceil(Math.max(2,max)/step)*step;
}
function DailyChart({visual,detail,title}:{visual:Extract<InsightVisual,{kind:'days'}>;detail:string;title:string}) {
  const [selected,setSelected] = useState<string|null>(null);
  const {marks,unit,reference} = visual;
  const top = axisTop(Math.max(...marks.map(m=>Math.max(m.actual??0,m.high??0))));
  const mark = marks.find(m=>m.day===selected);
  const hasPlan = marks.some(m=>m.low!=null && m.high!=null);
  const hasMissing = marks.some(m=>m.actual===null);
  return <figure className="ins-daychart" aria-label={title+' by day'}>
    <div className="ins-legend"><span><i className="ins-key-bar"/>Logged{unit==='mL'?' mL':''}</span>
      {hasPlan&&<span><i className="ins-key-band"/>{reference}</span>}
      {hasMissing&&<span><i className="ins-key-missing"/>No entry</span>}
    </div>
    <div className="ins-plot">
      <div className="ins-y" aria-hidden="true"><span>{fmt(top)}</span><span>{fmt(top/2)}</span><span>0</span></div>
      <div className="ins-days" role="group" aria-label="Select a day for details">
        {marks.map(m=>{
          const active = mark?.day === m.day;
          const dayName = weekday.format(new Date(m.day+'T12:00:00Z'));
          return <button type="button" className="ins-day" key={m.day} aria-pressed={active}
            aria-label={dailyLabel(m,unit,reference)} onClick={()=>setSelected(active?null:m.day)}>
            <span className="ins-slot" aria-hidden="true">
              {m.actual===null ? <i className="ins-missing"/> : <i className={'ins-bar'+(m.actual===0?' ins-zero':'')} style={{height:m.actual/top*100+'%'}}/>}
              {m.low!==null && m.high!==null && <i className={'ins-band'+(m.low===m.high?' ins-line':'')} style={{bottom:m.low/top*100+'%',height:(m.high-m.low)/top*100+'%'}}/>}
            </span>
            <span className="ins-x" aria-hidden="true">{dayName.replace('.','')}</span>
          </button>;
        })}
      </div>
    </div>
    <figcaption aria-live="polite">{mark?dailyLabel(mark,unit,reference):detail}</figcaption>
  </figure>;
}

function ObservationChart({current,previous}:{current:ObservationWeek;previous:ObservationWeek}) {
  return <figure className="ins-observations" aria-label="Lifted or held his head, among sessions with a head observation">
    <figcaption>Lifted or held his head</figcaption>
    {([{label:'Selected week',value:current},{label:'Prior week',value:previous}]).map(({label,value})=>
      <div className="ins-week" key={label}>
        <div><span>{label}</span><strong>{value.all ? value.lifts+' of '+value.all : 'No observations'}</strong></div>
        <div aria-hidden="true" className={'ins-track'+(!value.all?' ins-no-observations':'')}><i style={{width:(value.all?value.lifts/value.all*100:0)+'%'}}/></div>
      </div>)}
    <p>Counts use sessions with a head observation.</p>
  </figure>;
}

function WeightChart({measures,detail}:{measures:Extract<InsightVisual,{kind:'weight'}>['measures'];detail:string}) {
  const first=measures[0],last=measures[measures.length-1];
  const values=measures.map(m=>m.grams);
  const low=Math.max(0,Math.floor((Math.min(...values)-25)/50)*50);
  const high=Math.ceil((Math.max(...values)+25)/50)*50;
  const span=calendarDays(first.day,last.day);
  const x=(day:string)=>span?45+244*calendarDays(first.day,day)/span:167;
  const y=(value:number)=>78-64*(value-low)/(high-low);
  return <figure className="ins-growth">
    <div className="ins-legend"><span><i className="ins-key-dot"/>Measured weight (g)</span></div>
    <svg viewBox="0 0 302 104" role="img" aria-label={measures.map(m=>shortDate(m.day)+', '+fmt(m.grams)+' grams').join('. ')}>
      {[low,high].map(value=><g key={value}><text x="34" y={y(value)+4} textAnchor="end">{fmt(value)}</text><line x1="43" x2="294" y1={y(value)} y2={y(value)} className="ins-gridline"/></g>)}
      {measures.length>1&&<polyline points={measures.map(m=>x(m.day)+','+y(m.grams)).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5"/>}
      {measures.map(m=><circle key={m.day} cx={x(m.day)} cy={y(m.grams)} r={4} fill="currentColor"><title>{shortDate(m.day)+' · '+fmt(m.grams)+' g'}</title></circle>)}
      <text x={x(first.day)} y="100" textAnchor={span?'start':'middle'}>{shortDate(first.day)}</text>
      {span>0&&<text x={x(last.day)} y="100" textAnchor="end">{shortDate(last.day)}</text>}
    </svg>
    <figcaption>{detail}</figcaption>
  </figure>;
}

export function InsightChart({row}:{row:CareInsight}) {
  const visual=row.visual;
  if (visual.kind==='observations') return <ObservationChart current={visual.current} previous={visual.previous}/>;
  if (visual.kind==='weight') return <WeightChart measures={visual.measures} detail={row.detail}/>;
  return <DailyChart visual={visual} detail={row.detail} title={row.title}/>;
}
