'use client';

import {useMemo,useState} from 'react';
import {Baby, ClipboardList, Droplets, Heart, Milk, Moon, Scale, ChevronRight} from 'lucide-react';
import {type CareEvent, type Plan, shiftDay} from '@/lib/care';
import {buildCareInsights, developmentalAge, shortDate, type CareInsight} from '@/lib/care-insights';
import {DEFAULT_BIRTH_DATE} from '@/lib/feeding-plan';
import {trackingEnabled} from '@/lib/tracking';
import {InsightChart} from './insight-charts';
import {useTrendHistory} from './use-trend-history';

const icons = {feed:Milk, weight:Scale, diaper:Droplets, tummy:Baby, pump:Heart, sleep:Moon, nursing:Heart, exercise:ClipboardList};
function AgeContext({today, due}: {today:string; due:string}) {
  const calendarMonths = (Number(today.slice(0,4))-Number(due.slice(0,4)))*12
    + Number(today.slice(5,7))-Number(due.slice(5,7)) - Number(today.slice(8)<due.slice(8));
  if (calendarMonths >= 24) return null;
  const early = calendarMonths < 3;
  const checkpoint = early ? 2 : 4;
  const when = calendarMonths < checkpoint ? 'Looking ahead to' : 'At';
  const stage = early ? 'most babies can hold their head up during tummy time.' : 'most babies can push up onto their forearms during tummy time.';

  return <section className="insight-age">
    <h2>{developmentalAge(due,today)}</h2>
    <p>Developmental milestones use age counted from his due date. {calendarMonths < 5 && `${when} ${early?'two':'four'} months corrected, ${stage}`}</p>
    <div><a href="https://www.healthychildren.org/English/ages-stages/baby/preemie/pages/Corrected-Age-For-Preemies.aspx" target="_blank" rel="noreferrer">How corrected age works</a>
    {calendarMonths < 5 && <a href={early?'https://www.cdc.gov/act-early/milestones/2-months.html':'https://www.cdc.gov/act-early/milestones-in-action/4-months.html'} target="_blank" rel="noreferrer">{early?'2-month':'4-month'} checklist</a>}</div>
  </section>;
}

type Props = {today:string; plan:Plan; weights:CareEvent[]; revision:number; onTracker:(metric:string,end:string)=>void};
export default function CareInsights({today,plan,weights,revision,onTracker}:Props) {
  const {recent,completedEnd,failed,retry} = useTrendHistory(today,today,revision);
  const [offset,setOffset]=useState(0);
  const [metric,setMetric]=useState<CareInsight['key']>('feed');
  const end=shiftDay(completedEnd,-offset);
  const rows=useMemo(()=>buildCareInsights(recent.filter(day=>day.day<=end),plan,weights,end),[recent,plan,weights,end]);
  const lead=rows.find(row=>row.key===metric)??rows[0];
  const due = plan.expectedTermDate;
  const showAge = due && due > (plan.birthDate || DEFAULT_BIRTH_DATE) && trackingEnabled(plan,'tummy');
  return <div className="care-insights">
    {failed && <p className="form-error" role="alert">{recent.length?'Showing the last synced summary.':'Could not load your weekly summary.'} <button className="text-link" onClick={retry}>Retry</button></p>}
    {!recent.length && !failed && <p role="status">Loading the week’s entries…</p>}
    {recent.length>0 && <section className="insight-sheet">
      <header><div><h2>The week in brief</h2><p>{shortDate(shiftDay(end,-6))} – {shortDate(end)} · 7 completed days</p></div></header>
      <div className="journal-choices" aria-label="Comparison week">{[0,7].map(value=><button key={value} aria-pressed={offset===value} onClick={()=>setOffset(value)}>{value?'Previous 7 days':'Last 7 days'}</button>)}</div>
      {lead ? <>
        <div className="week-spread">{rows.map(row=>{
          const expanded=row.key===lead.key;
          const Icon=icons[row.key];
          const marks=row.visual.kind==='days'?row.visual.marks:[];
          const max=Math.max(1,...marks.map(mark=>mark.actual??0));
          return <section key={row.key} className={'week-row ins-'+row.key}>
            <button className="week-pick" aria-expanded={expanded} onClick={()=>setMetric(row.key)}>
              <Icon size={21}/><span><strong>{row.title}</strong><small>{row.context}</small></span>
              <span className="week-value">{marks.length>0&&<span className="seven-marks" aria-hidden="true">{marks.map(mark=><i key={mark.day} style={{height:mark.actual===null?2:Math.max(3,20*mark.actual/max)}}/>)}</span>}{row.value}<small>{row.unit}</small></span><ChevronRight size={16}/>
            </button>
            {expanded&&<div className="week-detail" key={end+row.key}><InsightChart row={row}/>
              {row.visual.kind==='observations'&&<p>{row.detail}</p>}
              <button className="curated-link" onClick={()=>onTracker(row.key,end)}>Explore {row.title.toLowerCase()} in Tracker<ChevronRight size={16}/></button>
            </div>}
          </section>;
        })}</div>
        <p className="insight-method">Daily averages use days with entries. A partly logged day can look low.</p>
      </> : <p>No entries to summarise for the tracked categories in this period. Today’s entries appear in Tracker.</p>}
    </section>}
    {showAge && <AgeContext today={today} due={due}/>}

  </div>;
}
