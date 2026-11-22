import {dayBounds,type CareEvent} from './care.ts';
export function pumpingSummary(items:CareEvent[],start:string,end:string){
 const sessions=items.filter(e=>e.kind==='pump'&&!e.deleted&&e.startedAt>=start&&e.startedAt<end).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
 const measured=sessions.filter(e=>e.amount!==null);const volume=measured.reduce((n,e)=>n+(e.amount||0),0);
 return {sessions,count:sessions.length,volume,average:measured.length?volume/measured.length:null,missing:sessions.length-measured.length};
}
export function pumpingDays(items:CareEvent[],days:string[]){return days.map(day=>({day,...pumpingSummary(items,...dayBounds(day))}));}
