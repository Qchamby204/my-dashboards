'use client';

import {useEffect,useState} from 'react';
import {useCareDialog} from './use-care-dialog';
import {Check,Minus,Plus,X} from 'lucide-react';
import type {CareEvent} from '@/lib/care';

export function readHeadLifts(id:string){
 try{return Math.max(0,Math.min(1000,Number(sessionStorage.getItem('tummy-lifts:'+id))||0));}
 catch{return 0;}
}

export function storeHeadLifts(id:string,count:number|null){
 try{
  const key='tummy-lifts:'+id;
  if(count===null)sessionStorage.removeItem(key);
  else sessionStorage.setItem(key,String(count));
 }catch{/* The counter still works when browser storage is unavailable. */}
}

function useScreenWakeLock(){
 useEffect(()=>{
  let active=true;
  let pending=false;
  let lock:WakeLockSentinel|undefined;
  async function keepAwake(){
   if(!active||pending||!navigator.wakeLock||document.visibilityState!=='visible'||(lock&&!lock.released))return;
   pending=true;
   try{
    const next=await navigator.wakeLock.request('screen');
    if(active&&document.visibilityState==='visible')lock=next;
    else await next.release();
   }catch{/* Some browsers and power modes decline screen wake locks. */}
   finally{pending=false;}
  }
  void keepAwake();
  document.addEventListener('visibilitychange',keepAwake);
  return ()=>{
   active=false;
   document.removeEventListener('visibilitychange',keepAwake);
   if(lock&&!lock.released)void lock.release().catch(()=>{});
  };
 },[]);
}

export default function TummyTimer({entry,headLifts,disabled,onCount,onClose,onSave}:{
 entry:CareEvent;headLifts:number;disabled:boolean;onCount:(count:number)=>void;
 onClose:()=>void;onSave:(endedAt:string)=>Promise<boolean>;
}){
 const dialog=useCareDialog();
 const [now,setNow]=useState(Date.now);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState(false);
 const start=Date.parse(entry.startedAt);
 const cue=entry.tummyCueSeconds??null;
 const elapsed=Math.max(0,now-start);
 const remaining=cue===null?null:Math.max(0,cue*1000-elapsed);
 const complete=remaining===0;
 const progress=cue===null?0:Math.min(100,elapsed/(cue*10));
 const seconds=remaining===null?Math.floor(elapsed/1000):Math.ceil(remaining/1000);
 useScreenWakeLock();
 useEffect(()=>{
  const timer=window.setInterval(()=>setNow(Date.now()),100);
  return ()=>window.clearInterval(timer);
 },[]);
 async function save(){
  setSaving(true);
  setError(false);
  const now=Date.now();
  const end=cue===null?now:Math.min(now,start+cue*1000);
  if(!await onSave(new Date(Math.max(start,end)).toISOString())){
   setSaving(false);
   setError(true);
  }
 }
 return <dialog ref={dialog} className="tummy-timer" aria-labelledby="tummy-timer-title" onCancel={event=>{event.preventDefault();if(!saving)onClose();}}>
  <header><h2 id="tummy-timer-title" data-dialog-heading tabIndex={-1}>Tummy time</h2><button type="button" className="icon-button" aria-label="Minimize tummy timer" disabled={saving} onClick={onClose}><X size={24}/></button></header>
  <div className="tummy-timer-face">
   <div className="tummy-timer-ring" style={{background:`conic-gradient(var(--sand-text) ${progress}%, var(--line) 0)`}}>
    <div className="tummy-timer-center">
     <strong role="timer" aria-label={cue===null?'Elapsed time':'Time remaining'}>{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong>
     <span>{complete?'Time complete':cue===null?'Elapsed':'Remaining'}</span>
    </div>
   </div>
  </div>
  <div className="tummy-timer-actions">
   <button className="primary-button lift-tap" type="button" disabled={disabled||saving||headLifts>=1000} onClick={()=>onCount(headLifts+1)}>
    <Plus size={25}/> Head lift <strong aria-live="polite">{headLifts}</strong>
   </button>
   <div className="tummy-timer-save">
    <button className="icon-button" type="button" disabled={disabled||saving||headLifts===0} aria-label="Remove a head lift" onClick={()=>onCount(headLifts-1)}><Minus size={20}/></button>
    <button className="outline-button" type="button" disabled={disabled||saving} onClick={()=>void save()}><Check size={18}/>{saving?'Saving…':complete||cue===null?'Save session':'Finish early & save'}</button>
   </div>
   {error&&<p role="alert" className="form-error">Couldn’t save the session. Try again when synced.</p>}
  </div>
 </dialog>;
}
