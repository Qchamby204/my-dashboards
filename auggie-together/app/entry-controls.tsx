'use client';
import {type Dispatch,type SetStateAction} from 'react';
import {Plus,Minus,Clock3,ChevronRight,Moon} from 'lucide-react';
import {toInput,dayKey,clock,fromInput,prettyDay,durationText,type CareEvent} from '@/lib/care';
import { headLabels, headMovements } from '@/lib/tummy-observations';
import { ComfortChoices, ExerciseChecklist, PositionChoices } from './movement-controls';
import { isMovement, shortDuration } from '@/lib/movement';
import DiaperAmount from './diaper-amount';
import {type Draft} from '@/lib/entry';

type SliderProps={label:string;value:string;onChange:(v:string)=>void;unit:string;max:number;step?:number;increment?:number;presets:number[];format?:(v:number)=>string;min?:number};
export function AmountSlider({label,value,onChange,unit,max,step=unit==='mL'?5:1,increment=5,presets,format,min=0}:SliderProps){
 const num=value===''?min:Number(value);const limit=Math.max(max,Math.ceil(num/30)*30);const display=value===''?(unit==='min'?'Choose a duration':'Choose an amount'):format?format(num):`${num}`;
 return <fieldset className="amount-control"><legend>{label}</legend><div className={'amount-display '+(value===''?'unselected':'')}><button type="button" className="step-button" aria-label={`Decrease ${label.toLowerCase()} by ${increment} ${unit}`} onClick={()=>onChange(String(Math.max(min,num-increment)))}><Minus size={22}/></button><div aria-live="polite" aria-atomic="true"><strong>{display}</strong>{value!==''&&!format&&<span>{unit}</span>}</div><button type="button" className="step-button" aria-label={`Increase ${label.toLowerCase()} by ${increment} ${unit}`} onClick={()=>onChange(String(Math.min(limit,num+increment)))}><Plus size={22}/></button></div><input className="amount-range" aria-label={label} aria-valuetext={value===''?'No amount selected':`${num} ${unit}`} type="range" min={min} max={limit} step={step} value={num} onChange={e=>onChange(e.target.value)} onPointerUp={e=>{if(value==='')onChange(e.currentTarget.value);}}/><div className="range-ends"><span>{format?format(min):`${min} ${unit}`}</span><span>{format?format(limit):`${limit} ${unit}`}</span></div><div className="amount-presets">{presets.map(v=><button type="button" key={v} className={value!==''&&num===v?'chosen':''} aria-pressed={value!==''&&num===v} onClick={()=>onChange(String(v))}>{format?format(v):v}<span>{format?'':unit}</span></button>)}</div></fieldset>;
}
function EntryTime({draft,setDraft,editing,onEdit,onDone}:{
 draft:Draft;setDraft:Dispatch<SetStateAction<Draft|null>>;editing:boolean;onEdit:()=>void;onDone:()=>void;
}){
 const ended=draft.kind==='sleep';
 const field=ended?'end':'time';
 const today=dayKey();
 const value=draft[field]||toInput();
 const date=value.slice(0,10);
 const time=value.slice(11,16);
 function change(when:Draft['when'],value:string){
  setDraft(current=>current?.id===draft.id
   ? {...current,when,[field]:value,...(ended?{recalculateSleep:true}:{})}
   : current);
 }
 if(editing)return <div className="entry-time-editor">
  <div className="earlier-time-row">
   <label>Time<input type="time" required value={time} onInput={event=>change('custom',date+'T'+event.currentTarget.value)}/></label>
   <label>Date<input type="date" required max={today} value={date} onInput={event=>change('custom',event.currentTarget.value+'T'+time)}/></label>
  </div>
  <div className="entry-time-presets">
   {[15,30,60].map(minutes=><button className="outline-button" key={minutes} type="button" onClick={()=>{
    change('earlier',toInput(new Date(Date.now()-minutes*60000)));
    onDone();
   }}>{minutes===60?'1 hour ago':minutes+' min ago'}</button>)}
  </div>
  <button type="button" className="primary-button" disabled={!date||!time} onClick={onDone}>Done</button>
 </div>;
 let timeLabel='Now';
 if(draft.when!=='now'){
  try{timeLabel=(date===today?'':prettyDay(date,true)+' · ')+clock(fromInput(value));}
  catch{timeLabel='Choose a time';}
 }
 const label=ended?'Sleep ended':draft.kind==='bottle'?'Feed ended':isMovement(draft.kind)?'Session ended':'Time';
 return <div className="when-control compact-when">
  <span className="entry-time-label"><Clock3 size={17}/>{label}<strong>{timeLabel}</strong></span>
  <div className="when-buttons">
   {draft.when!=='now'&&<button type="button" onClick={()=>change('now',toInput())}>Use now</button>}
   <button type="button" onClick={onEdit}>{draft.when==='now'?'Earlier':'Change time'}<ChevronRight size={15}/></button>
  </div>
 </div>;
}
export function EntryFields({draft,setDraft,activeSleep,allowNursing=true,editingTime,onEditTime,onDoneTime}:{
 draft:Draft;setDraft:Dispatch<SetStateAction<Draft|null>>;activeSleep:CareEvent|null|undefined;
 allowNursing?:boolean;editingTime:boolean;onEditTime:()=>void;onDoneTime:()=>void;
}){
 const timeControl=<EntryTime draft={draft} setDraft={setDraft} editing={editingTime} onEdit={onEditTime} onDone={onDoneTime}/>;
 if(editingTime)return timeControl;
 if(isMovement(draft.kind)){
  if(draft.version&&!draft.originalEnd)return <p className="form-hint">This timer is running. Stop and save it from Play.</p>;
  const tummy=draft.kind==='tummy';
  if(tummy && draft.tummyObservation) return <>
    <fieldset className="movement-positions head-observation">
      <legend>What did you notice? <small>optional</small></legend>
      <div className="choice-row">{headMovements.map(id=>{
        const selected=draft.tummyObservation===id;
        return <button key={id} type="button" aria-pressed={selected} className={selected?'selected':''}
          onClick={()=>setDraft({...draft,tummyObservation:selected?'session':id})}>{headLabels[id]}</button>;
      })}</div>
    </fieldset>
    <fieldset className="movement-positions"><legend>How did he seem? <small>optional</small></legend>
      <ComfortChoices value={draft.tummyComfort??null} onChange={value=>setDraft({...draft,tummyComfort:value===draft.tummyComfort?null:value})}/>
    </fieldset>
    <details className="care-inline-details tummy-extra">
      <summary>Position &amp; note<ChevronRight size={16}/></summary>
      <div><PositionChoices value={draft.subtype} onChange={subtype=>setDraft({...draft,subtype})}/>
      <label>Anything else you noticed?<textarea rows={2} maxLength={4000} value={draft.notes}
        onChange={event=>setDraft({...draft,notes:event.target.value})}/></label></div>
    </details>
    {timeControl}
  </>;
  return <>
    <AmountSlider label="Session time" unit="sec" min={tummy?1:0} max={600} increment={15} value={draft.duration} presets={[30,60,90,180]} format={shortDuration} onChange={duration=>setDraft({...draft,duration})}/>
    {tummy?<><PositionChoices value={draft.subtype} onChange={subtype=>setDraft({...draft,subtype})}/><label>Head lifts <small>optional</small><input type="number" inputMode="numeric" min={0} max={1000} step={1} value={draft.amount} onChange={event=>setDraft({...draft,amount:event.target.value})}/></label><fieldset className="movement-positions"><legend>How did it go? <small>optional</small></legend><ComfortChoices value={draft.tummyComfort??null} onChange={tummyComfort=>setDraft({...draft,tummyComfort:draft.tummyComfort===tummyComfort?null:tummyComfort})}/></fieldset></>:<ExerciseChecklist value={draft.subtype} onChange={subtype=>setDraft({...draft,subtype})}/>}
    {timeControl}
  </>;
 }
 const set=(d:Draft)=>setDraft(d);const isBottle=draft.kind==='feed'&&draft.subtype!=='nursing';const isNursing=draft.kind==='feed'&&draft.subtype==='nursing';const active=draft.kind==='sleep'&&draft.id===activeSleep?.id&&!draft.end;
 return <>
 {draft.kind==='bottle'&&<p className="pump-timer-note"><Clock3 size={20}/><span><strong>2-hour leftover-bottle timer</strong><small>Counts from when the feed ended. An earlier warming or NICU limit still applies.</small></span></p>}
 {draft.kind==='bottle'&&<label>Earlier use-by time <small>optional</small><input type="datetime-local" value={draft.milkDeadlineInput??''} onInput={event=>{
  const value=event.currentTarget.value;
  setDraft(current=>current?.id===draft.id?{...current,milkDeadlineInput:value}:current);
 }}/></label>}
 {draft.kind==='feed'&&<fieldset className="feed-type"><legend>What kind of feed?</legend><div className="choice-row">{[{id:'milk',name:'Breast milk'},{id:'formula',name:'Formula'},{id:'nursing',name:'Breastfeeding'}].filter(type=>allowNursing||type.id!=='nursing').map(t=><button key={t.id} type="button" className={draft.subtype===t.id?'selected':''} aria-pressed={draft.subtype===t.id} onClick={()=>{if(t.id!==draft.subtype)set({...draft,subtype:t.id,amount:t.id==='nursing'?'':draft.amount,offered:t.id==='nursing'?'':draft.offered,duration:t.id==='nursing'?draft.duration:''});}}>{t.name}</button>)}</div></fieldset>}
 {isBottle&&<AmountSlider label="How much did baby drink?" unit="mL" value={draft.amount} max={240} increment={5} presets={[30,45,60,90]} onChange={amount=>set({...draft,amount,offered:draft.offered&&Number(amount)>Number(draft.offered)?'':draft.offered})}/>}
 {isNursing&&<><AmountSlider label="How long was the feed?" unit="min" value={draft.duration} min={1} max={60} increment={1} presets={[5,10,15,20]} format={v=>v+' min'} onChange={duration=>set({...draft,duration})}/><fieldset className="side-control"><legend>Which side?</legend><div className="choice-row">{['Left','Right','Both'].map(side=><button type="button" key={side} className={draft.notes.startsWith('['+side+']')?'selected':''} aria-pressed={draft.notes.startsWith('['+side+']')} onClick={()=>set({...draft,notes:'['+side+'] '+draft.notes.replace(/^\[(Left|Right|Both)\]\s*/,'')})}>{side}</button>)}</div></fieldset></>}

 {draft.kind==='pump'&&<p className="pump-timer-note"><Clock3 size={20}/><span><strong>3h 30m refrigeration reminder</strong><small>Room temperature is assumed. Saving starts the clock from the pumping time.</small></span></p>}
 {draft.kind==='pump'&&<AmountSlider label="How much did you pump?" unit="mL" value={draft.amount} max={360} increment={5} presets={[30,60,90,120]} onChange={amount=>set({...draft,amount})}/>}
 {draft.kind==='sleep'&&!active&&<AmountSlider label="How long did baby sleep?" unit="min" min={1} value={draft.duration} max={360} increment={5} presets={[30,60,120,180]} format={durationText} onChange={duration=>set({...draft,duration,recalculateSleep:true})}/>}
 {active&&<div className="active-sleep-note"><Moon size={28}/><strong>Sleep timer is running</strong><p>Close this panel and tap End sleep when baby wakes.</p></div>}
 {draft.kind==='diaper'&&<fieldset className="diaper-type"><legend>What was in the diaper?</legend><div className="choice-row">{['wet','dirty','both'].map(t=><button type="button" key={t} className={draft.subtype===t?'selected':''} aria-pressed={draft.subtype===t} onClick={()=>set({...draft,subtype:t,soiledSize:t==='wet'?null:draft.soiledSize,wetSize:t==='dirty'?null:draft.wetSize})}>{t==='both'?'Both':t[0].toUpperCase()+t.slice(1)}</button>)}</div></fieldset>}
 {draft.kind==='diaper'&&draft.subtype!=='dirty'&&<DiaperAmount label="Wet amount" value={draft.wetSize} onChange={wetSize=>set({...draft,wetSize})}/>}
 {draft.kind==='diaper'&&draft.subtype!=='wet'&&<DiaperAmount value={draft.soiledSize} onChange={soiledSize=>set({...draft,soiledSize})}/>}
 {draft.kind==='weight'&&<label className="weight-entry">Weight in grams<input data-dialog-autofocus required aria-label="Weight in grams" type="number" inputMode="decimal" min="100" max="30000" step="0.1" placeholder="e.g. 2200" value={draft.amount} onChange={e=>set({...draft,amount:e.target.value})}/><small>Use the exact reading from the scale.</small></label>}
 {['medicine','note'].includes(draft.kind)&&<label>{draft.kind==='medicine'?'What was given?':'What should you both know?'}<textarea autoFocus required maxLength={4000} rows={4} placeholder={draft.kind==='medicine'?'Name and exact dose, as prescribed.':'Anything helpful for your other half…'} value={draft.notes} onChange={e=>set({...draft,notes:e.target.value})}/></label>}
 {draft.kind==='weight'&&<label>Weighed on<input aria-label="Weighed on" required type="date" max={dayKey()} value={draft.time.slice(0,10)} onChange={e=>set({...draft,when:'custom',time:e.target.value+draft.time.slice(10)})}/></label>}
 {!active&&draft.kind!=='weight'&&timeControl}
 {active&&<label>Sleep started<input required type="datetime-local" max={toInput()} value={draft.time} onChange={e=>set({...draft,time:e.target.value})}/></label>}
 </>;
}
