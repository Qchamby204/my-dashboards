'use client';

import {useRef,useState,type FormEvent} from 'react';
import {Baby,CalendarDays,Check,ClipboardList,Droplets,Heart,Milk,Moon,NotebookPen,Pill,Scale,Settings2} from 'lucide-react';
import {dayKey,shiftDay,type CareEvent,type Plan} from '@/lib/care';
import {defaultTracking,trackingEnabled,type TrackingKey} from '@/lib/tracking';
import {ageInWeeks,DEFAULT_BIRTH_DATE,feedingRange,feedingSchedule,rangeLabel} from '@/lib/feeding-plan';

export type SettingsSection='tracking'|'goals'|'plan'|'details';
type Props={weights:CareEvent[];value:Plan&{version:number};onChange:(value:Plan&{version:number})=>void;section:SettingsSection;busy:boolean;error:string;onSubmit:(event:FormEvent)=>void;onClose:()=>void};
const choices:{key:TrackingKey;name:string;icon:typeof Milk}[]=[
 {key:'feed',name:'Feeds',icon:Milk},{key:'pump',name:'Pumping',icon:Heart},{key:'diaper',name:'Diapers',icon:Droplets},
 {key:'milkTimers',name:'Milk timers',icon:CalendarDays},{key:'tummy',name:'Tummy time',icon:Baby},{key:'exercise',name:'Exercises',icon:ClipboardList},
 {key:'sleep',name:'Sleep',icon:Moon},{key:'nursing',name:'Breastfeeding',icon:Heart},{key:'weight',name:'Growth / weight',icon:Scale},
 {key:'medicine',name:'Medicine',icon:Pill},{key:'note',name:'Care notes',icon:NotebookPen},
];
export default function CareSettings({weights,value,onChange,section,busy,error,onSubmit,onClose}:Props){
 const [tab,setTab]=useState(section);
 const pane=useRef<HTMLDivElement>(null);
 function selectTab(next:SettingsSection){
  setTab(next);
  if(pane.current)pane.current.scrollTop=0;
 }
 const mode=value.feedingGoalMode??'schedule';
 const birth=value.birthDate??DEFAULT_BIRTH_DATE;
 const today=dayKey();
 const week=ageInWeeks(today,birth);
 const target=feedingRange(value,today,weights);

 const set=(patch:Partial<Plan>)=>onChange({...value,...patch});
 return <form className="care-form care-settings" onSubmit={onSubmit}>
  <div className="settings-tabs" role="group" aria-label="Settings section">{[{id:'tracking',name:'Tracking'},{id:'goals',name:'Goals'},{id:'plan',name:'Feeding plan'},{id:'details',name:'Details'}].map(item=><button key={item.id} type="button" className={tab===item.id?'selected':''} aria-pressed={tab===item.id} onClick={()=>selectTab(item.id as SettingsSection)}>{item.name}</button>)}</div>
  <div className="settings-pane" ref={pane}>
  <fieldset disabled={busy} className="settings-content">
  {tab==='tracking'&&<><p className="form-hint">Choose what you both see in Log care, Play and Tracker. Hidden categories keep their saved entries.</p><div className="tracking-switches">{choices.map(item=><label className="tracking-switch" key={item.key}><item.icon size={21}/><span>{item.name}</span><input type="checkbox" role="switch" checked={trackingEnabled(value,item.key)} onChange={event=>set({tracking:{...defaultTracking,...value.tracking,[item.key]:event.target.checked}})}/></label>)}</div></>}
  {tab==='goals'&&<>
   {trackingEnabled(value,'feed')&&<section className="settings-section"><h3><Milk size={18}/>Feeding goal</h3><div className="choice-row">{[{id:'schedule',name:'Auto plan'},{id:'daily',name:'Daily mL'},{id:'weight',name:'mL/kg'}].map(item=><button type="button" key={item.id} className={mode===item.id?'selected':''} aria-pressed={mode===item.id} onClick={()=>set({feedingGoalMode:item.id as typeof mode,...(item.id==='daily'?{mlKgGoal:null}:item.id==='weight'?{dailyGoal:null}:{})})}>{item.name}</button>)}</div>
   {mode==='schedule'?<div className="settings-range"><strong>{rangeLabel(target.low,target.high)} mL/day</strong><span>{target.goalWeight!==null?`Based on his latest weigh-in (${target.goalWeight.toLocaleString('en-CA')} g)`:`Age-based range for week ${week} since birth`}</span><button className="text-link" type="button" onClick={()=>selectTab('plan')}>View the full plan</button></div>:<label>{mode==='daily'?'Daily milk goal (mL)':'Milk per kilogram (mL/kg/day)'}<input type="number" inputMode="decimal" min={1} max={mode==='daily'?4000:300} step={1} value={(mode==='daily'?value.dailyGoal:value.mlKgGoal)??''} onChange={event=>set(mode==='daily'?{dailyGoal:event.target.value?Number(event.target.value):null,mlKgGoal:null}:{mlKgGoal:event.target.value?Number(event.target.value):null,dailyGoal:null})}/></label>}
   <label>Planned feeds per day<input type="number" inputMode="numeric" min={1} max={48} step={1} value={Math.round(24/(value.interval??3))} onChange={event=>{if(event.target.value)set({interval:24/Number(event.target.value)});}}/></label></section>}
   {trackingEnabled(value,'pump')&&<section className="settings-section"><h3><Heart size={18}/>Pumping goal</h3><div className="choice-row">{[{id:'feeding',name:'Match feeding range'},{id:'custom',name:'Custom mL'}].map(item=><button type="button" key={item.id} className={(value.pumpGoalMode??(value.pumpGoal?'custom':'feeding'))===item.id?'selected':''} aria-pressed={(value.pumpGoalMode??(value.pumpGoal?'custom':'feeding'))===item.id} onClick={()=>set({pumpGoalMode:item.id as 'feeding'|'custom'})}>{item.name}</button>)}</div>
   {(value.pumpGoalMode??(value.pumpGoal?'custom':'feeding'))==='custom'?<label>Pumping goal (mL/day)<input type="number" inputMode="decimal" min={1} max={4000} step={1} value={value.pumpGoal??''} onChange={event=>set({pumpGoal:event.target.value?Number(event.target.value):null})}/></label>:<p className="settings-range"><strong>{rangeLabel(target.low,target.high)} mL/day</strong><span>Follows Auggie’s feeding plan.</span></p>}</section>}
   {trackingEnabled(value,'diaper')&&<label>Wet diaper target per day <small>optional</small><input type="number" inputMode="numeric" min={1} max={30} value={value.wetTarget??''} onChange={event=>set({wetTarget:event.target.value?Number(event.target.value):null})}/></label>}
   {trackingEnabled(value,'sleep')&&<label>Sleep logging goal (hours/day) <small>optional</small><input type="number" inputMode="decimal" min={.1} max={24} step={.5} value={value.sleepGoalHours??''} onChange={event=>set({sleepGoalHours:event.target.value?Number(event.target.value):null})}/></label>}
   {trackingEnabled(value,'tummy')&&<p className="settings-range"><strong>Tummy time check-ins</strong><span>Log a session after play. Add head movement, comfort or position when you want to remember it.</span></p>}
  </>}
  {tab==='plan'&&<>
   {target.goalWeight!==null&&<div className="settings-range">
    <span>Daily goal · {target.goalWeight.toLocaleString('en-CA')} g weigh-in</span>
    <strong>{rangeLabel(target.low,target.high)} mL/day</strong>
    <span>{rangeLabel(target.perFeedLow,target.perFeedHigh)} mL per feed across {Math.round(target.plannedFeeds)} feeds</span>
   </div>}
   <label>Date of birth<input type="date" value={birth} max={dayKey()} onChange={event=>set({birthDate:event.target.value})}/></label><p className="form-hint">The age-based table runs from three weeks through about five months since birth. The early weights illustrate 25 g/day gain. Per-feed amounts assume 8 feeds per day. Week 21–22 uses the broader 700–900 mL range.</p>
   <div className="schedule-scroll" tabIndex={0} aria-label="Feeding plan weeks three to twenty-two"><table><thead><tr><th scope="col">Age</th><th scope="col">Weight (kg)</th><th scope="col">mL/day</th><th scope="col">mL/feed</th></tr></thead><tbody>{feedingSchedule.map(row=><tr key={row.week} className={week===row.week?'guide-current':''}><th>Week {row.week}<small>{shiftDay(birth,row.week*7)}</small></th><td>{row.kg?.toFixed(2)??'Actual weight'}</td><td>{row.low}–{row.high}</td><td>{Math.round(row.low/8)}–{Math.round(row.high/8)}</td></tr>)}</tbody></table></div>
   <p className="small-note">Auto plan uses the latest logged weight before the expected due date. The age-based table supplies the range after that date or when a weigh-in is unavailable.</p></>}
  {tab==='details'&&<>
   <label>Baby’s name<input required maxLength={40} value={value.babyName} onChange={event=>set({babyName:event.target.value})}/></label>
   <label>For the next shift<textarea rows={3} maxLength={2000} value={value.handoff} onChange={event=>set({handoff:event.target.value})}/></label>
   <label>Care notes / feeding instructions<textarea rows={4} maxLength={4000} value={value.instructions} onChange={event=>set({instructions:event.target.value})}/></label>
   {trackingEnabled(value,'milkTimers')&&<label>Refrigerated milk limit (hours) <small>optional</small><input type="number" inputMode="decimal" min={1} max={48} value={value.fridgeMilkHours??''} onChange={event=>set({fridgeMilkHours:event.target.value?Number(event.target.value):null})}/></label>}
  </>}
  </fieldset>
  </div>
  {error&&<p role="alert" className="form-error">{error}</p>}
  <div className="form-actions"><button type="button" className="outline-button" onClick={onClose} disabled={busy}>Cancel</button><button type="submit" className="primary-button" disabled={busy}><Check size={18}/>{busy?'Saving…':'Save settings'}</button></div>
 </form>;
}
