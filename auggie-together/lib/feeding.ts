import {dayBounds, type CareEvent,type Plan} from './care.ts';
export function feedingDay(items:CareEvent[],weights:CareEvent[],plan:Plan,day:string){
 const [start,end]=dayBounds(day);const feeds=items.filter(e=>e.kind==='feed'&&e.startedAt>=start&&e.startedAt<end);const bottles=feeds.filter(e=>e.subtype!=='nursing'&&e.amount!==null);const milk=bottles.reduce((n,e)=>n+(e.amount||0),0);
 const weight=weights.filter(e=>e.startedAt<end&&e.amount!==null).sort((a,b)=>b.startedAt.localeCompare(a.startedAt))[0];const grams=weight?.amount??null;
 const history=plan.goalHistory||[];const h=history.filter(h=>h.from<=day).sort((a,b)=>b.from.localeCompare(a.from))[0];const target=h||(history.length?null:plan);
 const goal=target?.dailyGoal??(target?.mlKgGoal&&grams?Math.round(target.mlKgGoal*grams/1000):null);const perFeed=goal&&target?.interval?goal/(24/target.interval):target?.feedTarget??null;
 return {referenceAvailable:day<(plan.expectedTermDate??'2026-07-21'),needsWeight:!!target?.mlKgGoal&&!grams,milk,bottles:bottles.length,nursing:feeds.length-bottles.length,average:bottles.length?milk/bottles.length:null,goal,perFeed,grams,referenceLow:(grams??1900)*.15,referenceHigh:(grams??1900)*.18};
}
export function countdown(deadline:string,now:number){const seconds=Math.ceil((Date.parse(deadline)-now)/1000);if(seconds<=0)return 'Limit reached';const h=Math.floor(seconds/3600),m=Math.floor(seconds%3600/60),s=seconds%60;return `${h}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;}

// A caregiver's refrigeration reminder, separate from a clinical use-by deadline.
export const REFRIGERATION_REMINDER_MINUTES=210;
export function milkReminder(startedAt:string){return new Date(Date.parse(startedAt)+REFRIGERATION_REMINDER_MINUTES*60000).toISOString();}

export function leftoverDeadline(feedEndedAt:string,earlierLimit?:string|null){const twoHours=Date.parse(feedEndedAt)+120*60000;return new Date(earlierLimit?Math.min(twoHours,Date.parse(earlierLimit)):twoHours).toISOString();}
