'use client';

import { useState } from 'react';
import { Baby, Check, ChevronDown, ClipboardList, Clock3, Play, Square } from 'lucide-react';
import { type TummyComfort, type tummyProgress } from '@/lib/tummy-progress';
import TummyTimer,{readHeadLifts,storeHeadLifts} from './tummy-timer';
import {trackingEnabled} from '@/lib/tracking';
import { clock, eventDetail, type CareEvent,type Plan } from '@/lib/care';
import { exercises, exerciseIds, movementSummary, shortDuration, tummyPositions, type MovementKind } from '@/lib/movement';

export function PositionChoices({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <fieldset className="movement-positions">
    <legend>Position <small>optional</small></legend>
    <div className="choice-row">
      {tummyPositions.map(position => <button key={position.id} type="button" className={value === position.id ? 'selected' : ''} aria-pressed={value === position.id} onClick={() => onChange(value === position.id ? '' : position.id)}>{position.label}</button>)}
    </div>
  </fieldset>;
}

export function ComfortChoices({ value, onChange }: { value: TummyComfort | null; onChange: (value: TummyComfort) => void }) {
  return <div className="choice-row comfort-choices">
    <button type="button" aria-pressed={value === 'comfortable'} className={value === 'comfortable' ? 'selected' : ''} onClick={() => onChange('comfortable')}>Comfortable</button>
    <button type="button" aria-pressed={value === 'break'} className={value === 'break' ? 'selected' : ''} onClick={() => onChange('break')}>Needed a break</button>
  </div>;
}

export function ExerciseChecklist({ value, onChange, onToggle, disabled=false }: { value: string; onChange?: (value: string) => void; onToggle?: (id:string,checked:boolean)=>void; disabled?:boolean }) {
  const checked = exerciseIds(value);
  const row = (item: typeof exercises[number]) => <label className="exercise-option" key={item.id}>
    <input type="checkbox" checked={checked.includes(item.id)} disabled={disabled} onChange={event=>{
      const selected=event.target.checked;
      if(onToggle)onToggle(item.id,selected);
      else onChange?.(exerciseIds(selected?[...checked,item.id].join(','):checked.filter(id=>id!==item.id).join(',')).join(','));
    }}/>
    <span><strong>{item.label}</strong>{'hint' in item && <small>{item.hint}</small>}</span>
  </label>;
  return <div className="exercise-checklist">
    <h3 className="exercise-group-title">Play &amp; movement</h3>
    {exercises.filter(item => !('group' in item)).map(row)}
    <h3 className="exercise-group-title">Gas &amp; colic comfort</h3>
    {exercises.filter(item => 'group' in item).map(row)}
    <p className="small-note">Use light touch and easy movement. Stop if he resists or seems uncomfortable.</p>
  </div>;
}

type MovementLogProps = {
  plan:Plan;
  active: CareEvent[];
  items: CareEvent[];
  now: number;
  disabled: boolean;
  progress: ReturnType<typeof tummyProgress>;
  onStart: (kind: MovementKind, position: string, cue: number | null) => Promise<CareEvent | null>;
  onStop: (entry: CareEvent, subtype: string, headLifts: number | null, endedAt?: string) => Promise<CareEvent | null>;
  onChecklist: (id:string,checked:boolean) => void;
  onRate: (entry: CareEvent, comfort: TummyComfort) => Promise<CareEvent | null>;
  onEarlier: (kind: MovementKind) => void;
  onLift: (entry:CareEvent,delta:-1|1,legacyCount:number) => void;
};

export function MovementLog({ plan,active, items, now, disabled, progress, onStart, onStop, onChecklist, onRate, onEarlier,onLift }: MovementLogProps) {
  const [expanded, setExpanded] = useState<MovementKind | null>(null);
  const [position, setPosition] = useState('');
  const [interval, setIntervalSeconds] = useState<number|null>(null);
  const [timerId, setTimerId] = useState<string|null>(null);
  const [toRate, setToRate] = useState<CareEvent | null>(null);
  const summary=movementSummary(items);
  const runningTummy=active.find(entry=>entry.kind==='tummy');
  const headLifts=runningTummy?(runningTummy.amount??readHeadLifts(runningTummy.id)):0;

  async function finishTummy(entry:CareEvent,endedAt:string){
    const saved=await onStop(entry,entry.subtype,headLifts,endedAt);
    if(!saved)return false;
    storeHeadLifts(entry.id,null);
    setTimerId(null);
    setIntervalSeconds(null);
    setToRate(saved);
    return true;
  }

  return <div className="movement-log">
    {(['tummy', 'exercise'] as const).filter(kind=>trackingEnabled(plan,kind)).map(kind => {
      const tummy = kind === 'tummy';
      const label = tummy ? 'Tummy time' : 'Daily exercise';
      const Icon = tummy ? Baby : ClipboardList;
      const running = active.find(entry => entry.kind === kind);
      const seconds = running ? Math.max(0, Math.floor((now - Date.parse(running.startedAt)) / 1000)) : 0;
      const open = expanded === kind || !!running || (tummy && !!toRate);
      const cue = running ? running.tummyCueSeconds ?? null : interval ?? progress.cue;
      const latest = summary.tummy[0];
      const detail = tummy
        ? (summary.tummy.length ? `${summary.tummy.length} ${summary.tummy.length === 1 ? 'session' : 'sessions'} logged today` : 'Log a session after you finish')
        : (summary.exercise.length ? `${summary.checked.length}/${exercises.length} completed today` : 'Tap to check off activities');
      return <section className={'movement-card '+(running ? 'movement-running' : '')} key={kind}>
        <button type="button" className="care-action" onClick={() => setExpanded(open ? null : kind)} disabled={!!running || (tummy && !!toRate)} aria-expanded={open} aria-controls={kind+'-controls'}>
          <span className={'care-action-icon '+(tummy ? 'sand' : 'sage')}><Icon size={28}/></span>
          <span className="care-action-label"><strong>{label}</strong><span>{running ? 'Shared timer running' : detail}</span></span>
          <span className="care-action-end">{running ? <Clock3 size={21}/> : <ChevronDown size={22} className={open ? 'movement-flip' : ''}/>}</span>
        </button>
        {open && <div className="movement-body" id={kind+'-controls'}>
          {tummy ? running ? <div className="movement-clock">
            <span role="timer" aria-label="Tummy time elapsed">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>
            <button type="button" className="primary-button" onClick={()=>setTimerId(running.id)}><Clock3 size={17}/>Open timer</button>
          </div> : !toRate && <>
            <button type="button" className="primary-button" disabled={disabled} onClick={()=>onEarlier('tummy')}><Check size={18}/>Log tummy time</button>
            {latest&&<p className="small-note">Last session · {clock(latest.startedAt)} · {eventDetail(latest)}</p>}
            <details className="care-inline-details tummy-extra">
              <summary><Clock3 size={16}/>Use a timer<ChevronDown size={16}/></summary>
              <div><PositionChoices value={position} onChange={setPosition}/>
              <div className="tummy-start">
                <label>Session length<select value={cue??progress.cue} onChange={event=>setIntervalSeconds(Number(event.target.value))}>
                  {[...new Set([15,30,45,60,75,90,105,120,135,150,165,180,240,300,progress.cue])].sort((a,b)=>a-b).map(value=><option key={value} value={value}>{shortDuration(value)}</option>)}
                </select></label>
                <button className="primary-button" type="button" disabled={disabled} onClick={async ()=>{
                  const entry=await onStart('tummy',position,cue);
                  if(entry)setTimerId(entry.id);
                }}><Play size={17}/>Start timer</button>
              </div></div>
            </details>
          </> : <div className="movement-clock">
            <span role="timer" aria-label="Exercise elapsed">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</span>
            {running ? <button className="primary-button" type="button" disabled={disabled} onClick={async ()=>{
              await onStop(running,running.subtype,null);
            }}><Square size={17}/>Stop &amp; save</button> : <button className="primary-button" type="button" disabled={disabled} onClick={()=>void onStart('exercise','',null)}><Play size={17}/>Start timer</button>}
          </div>}
          {tummy ? <>
            {toRate && !running ? <div className="tummy-rating">
              <strong>How did that session go?</strong>
              <div className="choice-row comfort-choices">
                <button type="button" disabled={disabled} onClick={async () => { if (await onRate(toRate, 'comfortable')) setToRate(null); }}>Comfortable</button>
                <button type="button" disabled={disabled} onClick={async () => { if (await onRate(toRate, 'break')) setToRate(null); }}>Needed a break</button>
              </div>
              <button className="exact-toggle" type="button" onClick={() => setToRate(null)}>Skip for now</button>
            </div> : null}
          </> : <>
            <ExerciseChecklist value={summary.checked.join(',')} onToggle={onChecklist} disabled={disabled}/>
          </>}
          {!running && !tummy && <button className="finished-sleep movement-earlier" type="button" disabled={disabled} onClick={() => onEarlier(kind)}><Clock3 size={16}/>Log an earlier session</button>}
        </div>}
      </section>;
    })}
    {runningTummy&&timerId===runningTummy.id&&<TummyTimer key={runningTummy.id} entry={runningTummy} headLifts={headLifts} disabled={disabled}
      onCount={value=>onLift(runningTummy,value>headLifts?1:-1,headLifts)}
      onClose={()=>setTimerId(null)} onSave={endedAt=>finishTummy(runningTummy,endedAt)}/>}
  </div>;
}
