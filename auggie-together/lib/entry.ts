import type { TummyComfort } from './tummy-progress.ts';
import { isMovement, movementSeconds } from './movement.ts';
import {toInput,fromInput,type CareEvent,type Kind,type MilkStorage,type SoiledSize} from './care.ts';
export type Draft={tummyObservation?:CareEvent['tummyObservation'];tummyComfort?:TummyComfort|null;id:string;milkDeadlineInput?:string;originalMilkDeadline?:string|null;kind:Kind;subtype:string;soiledSize:SoiledSize|null;wetSize:SoiledSize|null;milkStorage:MilkStorage|null;time:string;end:string;amount:string;offered:string;duration:string;notes:string;when:'now'|'earlier'|'custom';originalStart?:string;originalEnd?:string|null;recalculateSleep?:boolean;version?:number};
export function newEventId(){if(typeof crypto.randomUUID==='function')return crypto.randomUUID();const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const h=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
export function createDraft(kind:Kind,subtype='',entry?:CareEvent,now=Date.now()):Draft{
 if(entry&&isMovement(entry.kind))return {...createDraft(entry.kind,entry.subtype,undefined,now),id:entry.id,tummyObservation:entry.tummyObservation??null,tummyComfort:entry.tummyComfort,amount:entry.amount?.toString()??'',duration:entry.endedAt?String(movementSeconds(entry)):'',time:toInput(entry.endedAt||entry.startedAt),notes:entry.notes,when:'custom',originalStart:entry.startedAt,originalEnd:entry.endedAt,version:entry.version};
 if(entry)return {id:entry.id,originalMilkDeadline:entry.milkDeadline,milkDeadlineInput:entry.kind==='bottle'&&entry.milkDeadline?toInput(entry.milkDeadline):'',kind:entry.kind,subtype:entry.subtype,soiledSize:entry.soiledSize??null,wetSize:entry.wetSize??null,milkStorage:entry.milkStorage??null,time:toInput(entry.startedAt),end:entry.endedAt?toInput(entry.endedAt):'',amount:entry.amount?.toString()??'',offered:entry.offered?.toString()??'',duration:entry.kind==='sleep'?(entry.endedAt?String((Date.parse(entry.endedAt)-Date.parse(entry.startedAt))/60000):''):entry.duration?.toString()??'',notes:entry.notes,when:'custom',originalStart:entry.startedAt,originalEnd:entry.endedAt,version:entry.version};
 return {id:newEventId(),kind,subtype,tummyObservation:kind==='tummy'?'session':undefined,soiledSize:null,wetSize:null,milkStorage:kind==='pump'?'fresh':null,time:toInput(new Date(now)),end:kind==='sleep'?toInput(new Date(now)):'',amount:'',offered:'',duration:'',notes:'',when:'now',recalculateSleep:kind==='sleep'};
}
export function entryReady(d:Draft){if(d.kind==='tummy'&&d.tummyObservation)return true;if(isMovement(d.kind))return !(d.version&&!d.originalEnd)&&(Number(d.duration)>0||d.kind==='exercise'&&!!d.subtype);if(d.kind==='bottle')return true;if(d.kind==='feed')return d.subtype==='nursing'?Number(d.duration)>0:d.amount!=='';if(d.kind==='pump'||d.kind==='weight')return d.amount!=='';if(d.kind==='medicine'||d.kind==='note')return !!d.notes.trim();if(d.kind==='sleep')return !!d.version&&!d.originalEnd&&!d.end||Number(d.duration)>0;return !!d.subtype;}
export function entryPayload(d:Draft,now=Date.now()){
 const stamp=new Date(now).toISOString();
 let startedAt=d.when==='now'?stamp:d.originalStart&&toInput(d.originalStart)===d.time?d.originalStart:fromInput(d.time);
 let endedAt:string|null=null;
 if(d.kind==='sleep'){
  if(d.recalculateSleep||!d.version){
   if(!d.duration||Number(d.duration)<=0)throw new Error('Choose how long the sleep lasted.');
   endedAt=d.when==='now'?stamp:d.originalEnd&&toInput(d.originalEnd)===d.end?d.originalEnd:fromInput(d.end);
   startedAt=new Date(Date.parse(endedAt)-Number(d.duration)*60000).toISOString();
  }else{
   startedAt=d.originalStart&&toInput(d.originalStart)===d.time?d.originalStart:fromInput(d.time);
   endedAt=d.end?(d.originalEnd&&toInput(d.originalEnd)===d.end?d.originalEnd:fromInput(d.end)):null;
  }
 }
 if(d.kind==='tummy'&&d.tummyObservation){
  endedAt=startedAt;
 }else if(isMovement(d.kind)){
  endedAt=d.originalEnd&&toInput(d.originalEnd)===d.time&&d.when!=='now'?d.originalEnd:startedAt;
  const seconds=Number(d.duration);
  startedAt=d.originalStart&&endedAt===d.originalEnd&&seconds===movementSeconds({startedAt:d.originalStart,endedAt:d.originalEnd??null})?d.originalStart:new Date(Date.parse(endedAt)-seconds*1000).toISOString();
 }
 return {id:d.id,kind:d.kind,subtype:d.subtype,tummyObservation:d.kind==='tummy'?d.tummyObservation:undefined,tummyComfort:d.kind==='tummy'?d.tummyComfort:undefined,milkDeadline:d.kind==='bottle'&&d.milkDeadlineInput?(d.originalMilkDeadline&&toInput(d.originalMilkDeadline)===d.milkDeadlineInput?d.originalMilkDeadline:fromInput(d.milkDeadlineInput)):null,milkStorage:['pump','bottle'].includes(d.kind)?d.milkStorage:null,soiledSize:d.kind==='diaper'&&d.subtype!=='wet'?d.soiledSize:null,wetSize:d.kind==='diaper'&&d.subtype!=='dirty'?d.wetSize:null,startedAt,endedAt,amount:d.amount===''?null:Number(d.amount),offered:d.offered===''?null:Number(d.offered),duration:d.kind==='sleep'||isMovement(d.kind)?null:d.duration===''?null:Number(d.duration),notes:d.notes,version:d.version};
}
