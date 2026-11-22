'use client';

import GrowthCard from './growth-card';
import {useTrendHistory} from './use-trend-history';
import {useMemo,useState,type ReactNode} from 'react';
import {Baby,ClipboardList,Droplets,Heart,Milk,Moon,NotebookPen,Pill,Scale,Settings2,ChevronRight} from 'lucide-react';
import {clock,dayBounds,dayKey,durationText,prettyDay,totals,type CareEvent,type Plan} from '@/lib/care';
import {feedingRange,measuredFeeding,pumpingRange,rangeLabel} from '@/lib/feeding-plan';
import {trackingEnabled,visibleEvent} from '@/lib/tracking';
import {exercises} from '@/lib/movement';
import {headLabels,headMovements} from '@/lib/tummy-observations';
import {buildTrendDays,metricSummary,rollingAverage,volumePeriod,type TrendDay,type TrendMetric} from '@/lib/trends';

const num=(value:number)=>value.toLocaleString('en-CA',{maximumFractionDigits:1});
type Series={id:TrendMetric;label:string;color:string};
type Band={low:number|null;high:number|null};
const bandLabel=(target:Band)=>target.low===null||target.high===null?'Not set':target.low===target.high?num(target.low):num(target.low)+'–'+num(target.high);
function HistoryChart({all,days,series,band,onDay,minimumMax=1,label}:{all:TrendDay[];days:TrendDay[];series:Series[];band?:(day:string)=>Band;onDay:(day:string)=>void;minimumMax?:number;label?:string}){
 const max=Math.max(minimumMax,...days.flatMap(day=>series.flatMap(item=>{
  const index=all.findIndex(row=>row.day===day.day);
  return [day.values[item.id]??0,index<0?0:rollingAverage(all,item.id,index)??0];
 })),...days.map(day=>band?.(day.day).high??0));
 const y=(value:number)=>117-value/max*94;
 const slot=326/Math.max(1,days.length);
 const x=(index:number)=>34+(index+.5)*slot;
 return <div className="curated-chart"><p className="curated-chart-label">{label??(prettyDay(days[0].day,true)+' – '+prettyDay(days.at(-1)!.day,true))}</p><svg viewBox="0 0 370 140" role="group" aria-label={series.map(item=>item.label).join(' and ')+', daily bars with seven-day rolling averages'}>
  {[0,max/2,max].map((value,index)=><g key={index}><line x1={32} x2={365} y1={y(value)} y2={y(value)} stroke="var(--line)" strokeDasharray="3 4"/><text x={27} y={y(value)+3} textAnchor="end" fill="var(--muted)" fontSize={9}>{num(value)}</text></g>)}
  {days.map((day,index)=>{
   const target=band?.(day.day);
   const low=target?.low,high=target?.high;
   return <g key={day.day}>
    {low!=null&&high!=null&&<rect x={34+index*slot} width={slot} y={y(high)} height={Math.max(2,y(low)-y(high))} fill="var(--chart-goal)" opacity={.13}/>}
    {series.map((item,seriesIndex)=>{
     const value=day.values[item.id];
     if(value===null)return null;
     const width=Math.max(2,slot*.7/series.length);
     return <rect key={item.id} x={x(index)-slot*.35+seriesIndex*width} width={width} rx={2} y={y(value)} height={Math.max(0,117-y(value))} fill={item.color}/>;
    })}
   </g>;
  })}
  {series.map(item=>{
   const segments:string[][]=[[]];
   days.forEach((day,index)=>{
    const position=all.findIndex(row=>row.day===day.day);
    const average=position<0?null:rollingAverage(all,item.id,position);
    if(average===null){if(segments.at(-1)!.length)segments.push([]);}else segments.at(-1)!.push(x(index)+','+y(average));
   });
   return segments.map((segment,index)=><polyline key={item.id+index} points={segment.join(' ')} fill="none" stroke={item.color} strokeWidth={2.3} strokeDasharray="4 3"/>);
  })}
  {days.map((day,index)=>{
   const values=series.flatMap(item=>{
    const value=day.values[item.id];
    return value===null?[]:[`${item.label} ${num(value)}`];
   });
   if(!values.length)return null;
   const target=band?.(day.day);
   const description=`${prettyDay(day.day)} · ${values.join(' · ')}${target?.low!=null?' · Goal '+rangeLabel(target.low,target.high):''}`;
   return <rect key={day.day} className="chart-day-target" x={34+index*slot} y={12} width={slot} height={111}
    role="button" tabIndex={0} aria-label={`Open ${description}`} onClick={()=>onDay(day.day)} onKeyDown={event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();onDay(day.day);}
    }}><title>{description}</title></rect>;
  })}
 </svg><div className="trend-dates"><span>{prettyDay(days[0].day,true)}</span><span>{prettyDay(days.at(-1)!.day,true)}</span></div><p className="curated-legend">{series.map(item=><span key={item.id}><i style={{background:item.color}}/>{item.label}</span>)}<span>Dashed · 7-day average</span>{band&&<span>Shaded · goal range</span>}</p></div>;
}
function VolumeDayChart({items,day,kind,target,now}:{items:CareEvent[];day:string;kind:'feed'|'pump';target:Band;now:number}){
 const [picked,setPicked]=useState('');
 const [start,end]=dayBounds(day);
 let total=0;
 const records=items.filter(event=>event.kind===kind&&event.amount!==null&&(kind!=='feed'||event.subtype!=='nursing')&&event.startedAt>=start&&event.startedAt<end).sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
 const points=records.map(event=>{total+=event.amount??0;return {event,total};});
 const selected=points.find(p=>p.event.id===picked)??points.at(-1);
 const max=Math.max(1,total,target.high??0);
 const y=(value:number)=>125-value/max*104;
 const x=(date:string)=>34+Math.max(0,Math.min(1,(Date.parse(date)-Date.parse(start))/(Date.parse(end)-Date.parse(start))))*326;
 let prior=0;
 const steps=['34,125'];
 points.forEach(point=>{steps.push(x(point.event.startedAt)+','+y(prior),x(point.event.startedAt)+','+y(point.total));prior=point.total;});
 steps.push(x(new Date(Math.min(now,Date.parse(end))).toISOString())+','+y(prior));
 return <div className="curated-chart"><svg viewBox="0 0 370 145" role="img" aria-label={`Cumulative ${kind==='feed'?'intake':'pumping'} ${total} mL. Goal ${rangeLabel(target.low,target.high)} mL.`}>
  {[0,max/2,max].map((value,index)=><g key={index}><line x1={32} x2={365} y1={y(value)} y2={y(value)} stroke="var(--line)" strokeDasharray="3 4"/><text x={27} y={y(value)+3} textAnchor="end" fill="var(--muted)" fontSize={9}>{Math.round(value)}</text></g>)}
  {target.low!==null&&target.high!==null&&<><rect x={34} y={y(target.high)} width={326} height={Math.max(2,y(target.low)-y(target.high))} fill="var(--chart-goal)" opacity={.14}/><text x={358} y={Math.max(12,y(target.high)-5)} textAnchor="end" fontSize={10} fill="var(--chart-goal)">Goal {rangeLabel(target.low,target.high)} mL</text></>}
  <polyline points={steps.join(' ')} fill="none" stroke={kind==='feed'?'var(--chart-intake)':'var(--rose-text)'} strokeWidth={3}/>
  {points.map(point=><circle key={point.event.id} cx={x(point.event.startedAt)} cy={y(point.total)} r={point===selected?5:3} fill={kind==='feed'?'var(--chart-intake)':'var(--rose-text)'}><title>{clock(point.event.startedAt)} · {point.total} mL cumulative</title></circle>)}
 </svg><div className="trend-dates"><span>12 am</span><span>Cumulative mL</span><span>12 am</span></div>
 {selected&&<div className="reading-scrubber"><output><strong>{clock(selected.event.startedAt)}</strong> · {selected.event.amount} mL {kind==='feed'?'consumed':'pumped'} · {selected.total} mL total</output>
 {points.length>1&&<input aria-label="Explore recorded volumes" aria-valuetext={clock(selected.event.startedAt)+' · '+selected.total+' mL cumulative'} type="range" min={0} max={points.length-1} value={points.indexOf(selected)} onChange={e=>setPicked(points[Number(e.target.value)].event.id)}/>}</div>}
 </div>;
}
function RangeStatus({amount,target,period=false}:{amount:number|null;target:Band;period?:boolean}){
 if(amount===null||target.low===null||target.high===null)return null;
 const text=period
  ?amount<target.low?`Daily average is ${num(target.low-amount)} mL below the range`:amount<=target.high?'Daily average is within the goal range':`Daily average is ${num(amount-target.high)} mL above the range`
  :amount<target.low?`${num(target.low-amount)} mL to the lower end · ${num(target.high-amount)} mL to the upper end`:amount<=target.high?'Within the daily range':`${num(amount-target.high)} mL above the daily range`;
 return <p className="range-status">{text}</p>;
}
function TrendNote({history,metric,count,unit}:{history:TrendDay[];metric:TrendMetric;count:number;unit:string}){
 if(!history.length)return null;
 const current=metricSummary(history.slice(-count),metric);
 const prior=metricSummary(history.slice(-count*2,-count),metric);
 if(!current.recorded)return <p className="curated-trend-note">No {metric==='milk'?'bottle':metric} history in the last {count} completed days.</p>;
 const difference=current.average!==null&&prior.average!==null?current.average-prior.average:null;
 return <p className="curated-trend-note"><strong>Last {count} days · {num(current.average!)} {unit}/logged day</strong><span>{difference===null?'More history needed for comparison':`${difference>=0?'+':''}${num(difference)} vs previous ${count} days`} · {current.recorded}/{count} days logged</span></p>;
}

function TummyObservations({days,span}:{days:TrendDay[];span:number}){
 const summarize=(rows:TrendDay[])=>{
  const heads=Object.fromEntries(headMovements.map(id=>[id,rows.reduce((total,row)=>total+(row.headMovements?.[id]??0),0)]));
  const comfortable=rows.reduce((total,row)=>total+row.tummyComfortable,0);
  const rated=comfortable+rows.reduce((total,row)=>total+row.tummyBreaks,0);
  return {heads,observed:Object.values(heads).reduce((sum,n)=>sum+n,0),comfortable,rated};
 };
 const current=summarize(days.slice(-span));
 const previous=summarize(days.slice(-2*span,-span));
 const visible=headMovements.filter(id=>current.heads[id]||previous.heads[id]);
 if(!visible.length&&!current.rated&&!previous.rated)return <p className="small-note">Add a head movement or comfort observation to a session to see it here.</p>;
 const of=(count:number,total:number)=>total?`${count} of ${total}`:'—';
 return <><table className="tummy-observations">
  <caption>What you noticed · through {prettyDay(days.at(-1)!.day,true)}</caption>
  <thead><tr><th scope="col">Observation</th><th scope="col">Last {span} days</th><th scope="col">Prior {span} days</th></tr></thead>
  <tbody>{visible.map(id=><tr key={id}><th scope="row">{headLabels[id]}</th>
   <td>{of(current.heads[id],current.observed)}</td><td>{of(previous.heads[id],previous.observed)}</td></tr>)}
   {(current.rated>0||previous.rated>0)&&<tr><th scope="row">Seemed comfortable</th>
    <td>{of(current.comfortable,current.rated)}</td><td>{of(previous.comfortable,previous.rated)}</td></tr>}
  </tbody>
 </table><p className="small-note">Each row counts sessions where you recorded that kind of observation.</p></>;
}

type Props={
 focus:string;onFocus:(key:string)=>void;
 items:CareEvent[];weights:CareEvent[];plan:Plan;day:string;now:number;revision:number;
 range:number;onRangeChange:(range:number)=>void;
 onWeight:()=>void;onEditWeight:(entry:CareEvent)=>void;onSettings:()=>void;onPlan:()=>void;onPlay:()=>void;onDay:(day:string)=>void;renderEntry:(entry:CareEvent)=>ReactNode;
};
export default function CareTracker({focus,onFocus,items,weights,plan,day,now,revision,onWeight,onEditWeight,onSettings,onPlan,onPlay,onDay,renderEntry,range,onRangeChange}:Props){
 const [filter,setFilter]=useState('all');
 const today=dayKey(new Date(now));
 const {recent,completedEnd,failed,retry}=useTrendHistory(day,today,revision);
 const chartDays=recent.slice(-range);
 const period=range>1;
 const periodLabel=recent.length?`${prettyDay(chartDays[0].day,true)} – ${prettyDay(completedEnd,true)}`:`Last ${range} completed days`;
 const averageDays=range===1?7:range;
 const feedingTargets=new Map(chartDays.map(row=>[row.day,feedingRange(plan,row.day,weights)]));
 const periodMilk=volumePeriod(chartDays,'milk',date=>feedingTargets.get(date)!);
 const periodFeedPlan=volumePeriod(chartDays,'milk',date=>{
  const goal=feedingTargets.get(date)!;
  return {low:goal.perFeedLow,high:goal.perFeedHigh};
 }).goal;
 const periodPump=volumePeriod(chartDays,'pumping',date=>pumpingRange(plan,date,weights));
 const periodDiapers=metricSummary(chartDays,'diapers');
 const periodLifts=metricSummary(chartDays,'lifts');
 const periodWet=metricSummary(chartDays,'wet'),periodDirty=metricSummary(chartDays,'dirty');
 const periodTummy=metricSummary(chartDays,'tummy');
 const periodSleep=metricSummary(chartDays,'sleep'),periodNursing=metricSummary(chartDays,'nursing');
 const nursingDays=chartDays.filter(row=>row.values.nursing!==null);
 const nursingPerDay=nursingDays.length?nursingDays.reduce((sum,row)=>sum+row.nursingCount,0)/nursingDays.length:null;
 const periodValue=(value:number|null)=>recent.length&&value!==null?num(value):'—';
 const [start,end]=dayBounds(day);
 const entries=items.filter(event=>event.startedAt>=start&&event.startedAt<end&&visibleEvent(plan,event));
 const milk=measuredFeeding(items,day);
 const dailyTarget=feedingRange(plan,day,weights);
 const target=period?periodMilk.goal:dailyTarget;
 const milkValue=period?periodMilk.average:milk.volume;
 const milkPerFeed=period?periodMilk.perSession:milk.average;
 const milkCount=period?periodMilk.sessionsPerDay:milk.count;
 const dailyPumpTarget=pumpingRange(plan,day,weights);
 const pumpTarget=period?periodPump.goal:dailyPumpTarget;
 const pumps=entries.filter(event=>event.kind==='pump');
 const pumped=pumps.reduce((sum,event)=>sum+(event.amount??0),0);
 const pumpValue=period?periodPump.average:pumped;
 const pumpCount=period?periodPump.sessionsPerDay:pumps.length;
 const measuredPumps=pumps.filter(event=>event.amount!==null).length;
 const perPump=period?periodPump.perSession:measuredPumps?pumped/measuredPumps:null;
 const diaper=entries.filter(event=>event.kind==='diaper');
 const wetChanges=diaper.filter(event=>event.subtype!=='dirty');
 const dirtyChanges=diaper.filter(event=>event.subtype!=='wet');
 const lastWet=wetChanges[0],lastDirty=dirtyChanges[0];
 const wet=period?periodWet.average:wetChanges.length;
 const dirty=period?periodDirty.average:dirtyChanges.length;
 const tummy=entries.filter(event=>event.kind==='tummy'&&event.endedAt);
 const countedLifts=tummy.filter(event=>event.amount!==null);
 const liftTotal=countedLifts.reduce((sum,event)=>sum+(event.amount??0),0);
 const selectedExerciseDay=useMemo(()=>buildTrendDays(items,day,1)[0],[items,day]);
 const exerciseRows=day===today?[...recent,selectedExerciseDay]:recent;
 const exerciseHistory=exerciseRows.slice(-(period?range:7));
 const exerciseAverage=metricSummary(exerciseHistory,'exercise');
 const checked=selectedExerciseDay.checked;
 const exerciseDates=exerciseHistory.length
  ? `${prettyDay(exerciseHistory[0].day,true)} – ${prettyDay(day,true)}`
  : prettyDay(day,true);
 const chart=(series:Series[],band?:((date:string)=>Band))=>recent.length?<HistoryChart all={recent} days={range===1?recent.slice(-7):chartDays} series={series} band={band} onDay={onDay}/>:<p className="small-note">{failed?'Recent history unavailable.':'Loading recent history…'}</p>;
 const title=day===today?'Today':prettyDay(day,true);
 const categories=[...new Set(entries.map(event=>event.kind))];
 const activeFilter=categories.includes(filter as CareEvent['kind'])?filter:'all';
 const exerciseEntries=entries.filter(entry=>entry.kind==='exercise');
 const logRows=entries.filter(entry=>entry.kind!=='exercise'||entry===exerciseEntries[0]);
 const timedSessions=exerciseEntries.filter(entry=>entry.endedAt&&entry.endedAt>entry.startedAt).length;
 const exerciseLogSummary=[
  `${checked}/${exercises.length} completed`,
  timedSessions>0&&`${timedSessions} timed ${timedSessions===1?'session':'sessions'}`,
  exerciseEntries.some(entry=>!entry.endedAt)&&'Timer running',
 ].filter(Boolean).join(' · ');
 const subjects=([
  ['feed','Feeding'],['pump','Pumping'],['diaper','Diapers'],['weight','Growth'],['tummy','Tummy time'],
  ['exercise','Exercises'],['sleep','Sleep'],['nursing','Nursing'],['medicine','Medicine'],['note','Notes']
 ] as const).filter(([key])=>trackingEnabled(plan,key)&&(key!=='nursing'||trackingEnabled(plan,'feed')));
 const active=subjects.some(([key])=>key===focus)||focus==='log'||focus==='all'?focus:subjects[0]?.[0]??'log';
 const combinedLog=active==='all'||active==='log';
 const logKind=combinedLog?activeFilter:active;
 const visibleRows=logRows.filter(entry=>{
  if(logKind==='nursing')return entry.kind==='feed'&&entry.subtype==='nursing';
  if(!combinedLog&&logKind==='feed')return entry.kind==='feed'&&entry.subtype!=='nursing';
  return logKind==='all'||entry.kind===logKind;
 });
 const shows=(key:string)=>active==='all'||active===key;
 return <div className="curated-tracker">
  <nav className="metric-index" aria-label="Tracker focus">
    {[...subjects,['log','Daily log'],['all','All metrics']].map(([key,title])=><button type="button" key={key} aria-pressed={active===key} onClick={()=>onFocus(key)}>{title}</button>)}
  </nav>
  <div className="curated-controls"><div><strong>{active==='log'?'Daily entries':period?`Last ${range} days · daily averages`:`${title} at a glance`}</strong><span>{active==='log'?prettyDay(day,true):period?(day===today&&recent.length?periodLabel+' · completed days':periodLabel):prettyDay(day)}</span></div><div hidden={active==='log'} className="insight-period" role="group" aria-label="Chart period">{[{value:1,label:'Day'},{value:7,label:'7 days'},{value:14,label:'14 days'},{value:30,label:'30 days'}].map(option=><button key={option.value} type="button" className={range===option.value?'selected':''} aria-pressed={range===option.value} onClick={()=>onRangeChange(option.value)}>{option.label}</button>)}</div></div>
  <section className="panel full-log curated-daily-log" aria-label="Daily log">
   <div className="panel-heading"><div><h2>Daily log <span className="count-badge">{visibleRows.length}</span></h2><p>{prettyDay(day)}</p></div>{combinedLog&&<select aria-label="Filter daily log" value={activeFilter} onChange={event=>setFilter(event.target.value)}><option value="all">All tracked</option>{categories.map(kind=><option key={kind} value={kind}>{({feed:'Feeds',pump:'Pumping',diaper:'Diapers',tummy:'Tummy time',exercise:'Exercises',sleep:'Sleep',weight:'Weight',bottle:'Milk timers',medicine:'Medicine',note:'Notes'})[kind]}</option>)}</select>}</div>
   {visibleRows.length?visibleRows.map(entry=>entry.kind==='exercise'?
    <details className="exercise-log" key={`exercises-${day}`}>
     <summary className="event-row">
      <span className="event-icon sage"><ClipboardList size={18}/></span>
      <span className="event-copy"><strong>Exercises</strong><span>{exerciseLogSummary}</span></span>
      <ChevronRight size={16}/>
     </summary>
     <div className="exercise-log-entries">{exerciseEntries.map(activity=><div key={activity.id}>{renderEntry(activity)}</div>)}</div>
    </details>:<div key={entry.id}>{renderEntry(entry)}</div>
   ):<div className="empty-state"><NotebookPen size={26}/><p>{combinedLog?'No entries for this day.':'No entries in this category for this day.'}</p></div>}
  </section>
  {failed&&<p className="form-error" role="alert">Recent charts could not refresh. <button className="text-link" onClick={retry}>Retry</button></p>}
  {shows('feed')&&trackingEnabled(plan,'feed')&&<section className="curated-card feeding-priority" aria-label="Feeding">
   <header><span className="care-action-icon sage"><Milk size={27}/></span><div><h2>Feeding</h2><p>{period?periodLabel:`${title} · week ${dailyTarget.week} since birth`}</p></div><button className="curated-goal-edit" aria-label="Feeding goals" onClick={onSettings}><Settings2 size={16}/>Goals</button></header>
   <div className="curated-volume"><div><strong>{milkValue===null?'—':num(milkValue)}</strong><span>{period?'mL / day average':'mL consumed'}</span></div><div><span>{period?'Average daily goal':'Daily goal'}</span><strong>{period&&periodMilk.goalDays===0?'—':bandLabel(target)}<small> mL</small></strong></div></div>
   {range===1?<VolumeDayChart items={items} day={day} kind="feed" target={target} now={now}/>:chart([{id:'milk',label:'Consumed mL',color:'var(--chart-intake)'}],date=>feedingRange(plan,date,weights))}
   {!period||periodMilk.recorded>0&&periodMilk.goalDays===periodMilk.recorded?<RangeStatus amount={milkValue} target={target} period={period}/>:null}
   {period&&recent.length>0&&<p className="period-coverage">{periodMilk.recorded}/{range} days logged{periodMilk.goalDays<periodMilk.recorded?` · Goals available for ${periodMilk.goalDays} logged days`:''}</p>}
   <div className="curated-facts"><div><span>Average / feed</span><strong>{milkPerFeed===null?'—':num(milkPerFeed)} mL</strong><small>Plan {period?(target.low===null||target.high===null?'not set':`${bandLabel(periodFeedPlan)} mL`):`${rangeLabel(dailyTarget.perFeedLow,dailyTarget.perFeedHigh)} mL`}</small></div><div><span>{period?'Feeds / day':'Feeds logged'}</span><strong>{milkCount===null?'—':num(milkCount)}</strong><small>{num(dailyTarget.plannedFeeds)} planned / day</small></div></div>
   {!period&&dailyTarget.goalWeight!==null&&<p className="period-coverage">Goal based on latest weigh-in as of this day ({num(dailyTarget.goalWeight)} g).</p>}

   <TrendNote history={recent} metric="milk" count={averageDays} unit="mL"/>
   <button className="curated-link" onClick={onPlan}>View feeding plan · weeks 3–22<ChevronRight size={15}/></button>
  </section>}
  <div className="curated-secondary">
  {shows('pump')&&trackingEnabled(plan,'pump')&&<section className="curated-card" aria-label="Pumping">
   <header><span className="care-action-icon rose"><Heart size={24}/></span><div><h2>Pumping</h2><p>{period?periodLabel:dailyPumpTarget.followsFeeding?'Goal follows feeding range':'Custom pumping goal'}</p></div><button className="curated-goal-edit" aria-label="Pumping goal" onClick={onSettings}><Settings2 size={16}/>Goal</button></header>
   <div className="curated-volume"><div><strong>{pumpValue===null?'—':num(pumpValue)}</strong><span>{period?'mL / day average':'mL pumped'}</span></div><div><span>{period?'Average daily goal':'Daily goal'}</span><strong>{period&&periodPump.goalDays===0?'—':bandLabel(pumpTarget)}<small> mL</small></strong></div></div>
   {range===1?<VolumeDayChart items={items} day={day} kind="pump" target={pumpTarget} now={now}/>:chart([{id:'pumping',label:'Pumped mL',color:'var(--rose-text)'}],date=>pumpingRange(plan,date,weights))}
   {!period||periodPump.recorded>0&&periodPump.goalDays===periodPump.recorded?<RangeStatus amount={pumpValue} target={pumpTarget} period={period}/>:null}
   {period&&recent.length>0&&<p className="period-coverage">{periodPump.recorded}/{range} days logged{periodPump.goalDays<periodPump.recorded?` · Goals available for ${periodPump.goalDays} logged days`:''}</p>}
   <div className="curated-facts"><div><span>{period?'Pumps / day':'Pumps logged'}</span><strong>{pumpCount===null?'—':num(pumpCount)}</strong></div><div><span>Average / pump</span><strong>{perPump===null?'—':num(perPump)} mL</strong></div></div>

   <TrendNote history={recent} metric="pumping" count={averageDays} unit="mL"/>
  </section>}
  {shows('diaper')&&trackingEnabled(plan,'diaper')&&<section className="curated-card" aria-label="Diapers">
   <header><span className="care-action-icon blue"><Droplets size={24}/></span><div><h2>Diapers</h2><p>{period?periodLabel:`${title}’s changes`}</p></div></header>
   <div className="exercise-count">
    <strong>{period?periodValue(periodDiapers.average):diaper.length}</strong>
    <span>{period?'changes / logged day':'total changes'}</span>
   </div>
   {period&&recent.length>0&&<p className="period-coverage">{periodDiapers.total} changes · {periodDiapers.recorded}/{range} days logged</p>}
   <div className="diaper-breakdown">
    <div className="diaper-stat wet-stat">
     <span>Wet{period?' / day':''}</span><strong>{wet===null?'—':num(wet)}</strong>
     <small>{period?`${periodWet.total} wet in period`:lastWet?`Last at ${clock(lastWet.startedAt)}${lastWet.wetSize?' · '+lastWet.wetSize:''}`:'None logged'}</small>
    </div>
    <div className="diaper-stat dirty-stat">
     <span>Dirty{period?' / day':''}</span><strong>{dirty===null?'—':num(dirty)}</strong>
     <small>{period?`${periodDirty.total} dirty in period`:lastDirty?`Last at ${clock(lastDirty.startedAt)}${lastDirty.soiledSize?' · '+lastDirty.soiledSize:''}`:'None logged'}</small>
    </div>
   </div>
   <p className="small-note">Mixed diapers appear in both counts and count as one change.</p>
   {plan.wetTarget!==null&&<p className="small-note">Wet diaper goal · {plan.wetTarget} per day</p>}
   {(period?chartDays:recent.slice(-7)).some(row=>row.values.diapers!==null)&&chart([
    {id:'wet',label:'Wet',color:'var(--blue-text)'},{id:'dirty',label:'Dirty',color:'var(--sand-text)'},
   ])}
  </section>}
  </div>
  {shows('weight')&&trackingEnabled(plan,'weight')&&<GrowthCard weights={weights} day={day} today={today} range={range} onAdd={onWeight} onEdit={onEditWeight}/>}
  <div className="curated-secondary">
  {shows('tummy')&&trackingEnabled(plan,'tummy')&&<section className="curated-card" aria-label="Tummy time">
   <header><span className="care-action-icon sand"><Baby size={24}/></span><div><h2>Tummy time</h2><p>{period?periodLabel:title}</p></div><button className="icon-button" aria-label="Open tummy time" onClick={onPlay}><ChevronRight size={18}/></button></header>
   <div className="exercise-count"><strong>{period?periodValue(periodTummy.total):tummy.length}</strong><span>sessions logged</span></div>
   {period&&recent.length>0&&<p className="period-coverage">Practised on {periodTummy.recorded} of {range} days</p>}
   {recent.length>0?<TummyObservations days={period?recent:exerciseRows} span={period?range:7}/>:<p className="small-note">{failed?'Observation history unavailable.':'Loading observations…'}</p>}
   {(period?chartDays:recent.slice(-7)).some(row=>row.values.tummy!==null)&&chart([{id:'tummy',label:'Sessions logged',color:'var(--sand-text)'}])}
   {(period?periodLifts.recorded>0:countedLifts.length>0)&&<details className="care-inline-details">
    <summary>Head lifts counted · {period?periodLifts.total:liftTotal}<ChevronRight size={16}/></summary>
    {chart([{id:'lifts',label:'Counted head lifts',color:'var(--chart-intake)'}])}
   </details>}
  </section>}
  {shows('exercise')&&trackingEnabled(plan,'exercise')&&<section className="curated-card" aria-label="Exercise completion">
   <header><span className="care-action-icon sage"><ClipboardList size={24}/></span><div><h2>Exercises</h2><p>{period?exerciseDates:`${title}’s checklist`}</p></div><button className="icon-button" aria-label="Open exercises" onClick={onPlay}><ChevronRight size={18}/></button></header>
   <div className="exercise-count"><strong>{period?periodValue(exerciseAverage.average):checked}/{exercises.length}</strong><span>{period?'completed per logged day':'completed'}</span></div>
   {!period&&<progress className="exercise-progress" value={checked} max={exercises.length} aria-label="Exercises completed"/>}
   {recent.length>0&&<p className="period-coverage">
    {!period&&exerciseAverage.average!==null&&`7-day average: ${num(exerciseAverage.average)}/${exercises.length} · `}
    {exerciseAverage.recorded}/{period?range:7} days logged
   </p>}
   {recent.length>0&&exerciseAverage.recorded>0&&<HistoryChart all={exerciseRows} days={exerciseHistory}
    series={[{id:'exercise',label:'Exercises completed',color:'var(--chart-intake)'}]}
    minimumMax={exercises.length} label={exerciseDates+(day===today?' · includes today so far':'')} onDay={onDay}/>}
  </section>}
  </div>
  {(['sleep','nursing','medicine','note'] as const).filter(key=>trackingEnabled(plan,key)&&(key!=='nursing'||trackingEnabled(plan,'feed'))).length>0&&<div className="curated-secondary optional-insights">
   {shows('sleep')&&trackingEnabled(plan,'sleep')&&<section className="curated-card" aria-label="Sleep"><header><Moon size={21}/><h2>Sleep</h2></header><div className="exercise-count"><strong>{period?periodValue(periodSleep.average):durationText(totals(items,start,end,now).sleep)}</strong><span>{period?'hours / day average':`logged ${title.toLowerCase()}`}</span></div>{chart([{id:'sleep',label:'Hours slept',color:'var(--lavender-text)'}])}</section>}
   {shows('nursing')&&trackingEnabled(plan,'nursing')&&trackingEnabled(plan,'feed')&&<section className="curated-card" aria-label="Breastfeeding"><header><Heart size={21}/><h2>Breastfeeding</h2></header><p>{period?`${periodValue(nursingPerDay)} feeds/day · ${periodValue(periodNursing.average)} minutes/day average`:`${entries.filter(event=>event.kind==='feed'&&event.subtype==='nursing').length} feeds · ${entries.filter(event=>event.kind==='feed'&&event.subtype==='nursing').reduce((sum,event)=>sum+(event.duration??0),0)} minutes`}</p>{chart([{id:'nursing',label:'Minutes nursing',color:'var(--rose-text)'}])}</section>}

   {([{key:'medicine',id:'medicine',label:'Medicine',icon:Pill},{key:'note',id:'notes',label:'Care notes',icon:NotebookPen}] as const).filter(item=>shows(item.key)&&trackingEnabled(plan,item.key)&&(period?chartDays.some(row=>row.values[item.id]!==null):entries.some(event=>event.kind===item.key))).map(item=><section className="curated-card" key={item.id}><header><item.icon size={21}/><h2>{item.label}</h2></header><p>{period?`${periodValue(metricSummary(chartDays,item.id).average)} entries/day average`:`${entries.filter(event=>event.kind===item.key).length} entries ${title.toLowerCase()}`}</p></section>)}
  </div>}
  {active!=='log'&&recent.length>0&&<p className="curated-method">Exercise history and the daily tummy-time observation table include the selected date. Other daily trends use completed days through {prettyDay(completedEnd,true)}. Averages use logged days.</p>}

 </div>;
}
