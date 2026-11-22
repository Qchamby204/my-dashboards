import {dayBounds,type CareEvent,type Plan} from './care.ts';
import {feedingDay} from './feeding.ts';

export const feedingSchedule=[
 {week:3,kg:1.92,low:290,high:345},
 {week:4,kg:2.10,low:315,high:375},
 {week:5,kg:2.27,low:340,high:410},
 {week:6,kg:2.45,low:365,high:440},
 {week:7,kg:2.62,low:395,high:470},
 {week:8,kg:2.80,low:420,high:505},
 {week:9,kg:2.97,low:445,high:535},
 {week:10,kg:3.15,low:470,high:565},
 {week:11,kg:3.32,low:500,high:600},
 {week:12,kg:3.50,low:525,high:630},
 {week:13,kg:3.67,low:550,high:660},
 {week:14,kg:3.85,low:575,high:690},
 {week:15,kg:4.02,low:605,high:725},
 {week:16,kg:4.20,low:630,high:755},
 {week:17,kg:4.37,low:655,high:785},
 {week:18,kg:4.55,low:680,high:820},
 {week:19,kg:4.72,low:710,high:850},
 {week:20,kg:4.90,low:735,high:880},
 {week:21,kg:null,low:700,high:900},
 {week:22,kg:null,low:700,high:900},
];
export const DEFAULT_BIRTH_DATE='2026-05-28';
// Example effective date for switching to a measured-weight reference.
const MEASURED_GOAL_START='2026-06-30';
export function ageInWeeks(day:string,birthDate=DEFAULT_BIRTH_DATE){
 return Math.floor((Date.parse(day+'T12:00:00Z')-Date.parse(birthDate+'T12:00:00Z'))/604800000);
}
export function goalSnapshot(plan:Plan,day:string){
 return (plan.goalHistory??[]).filter(row=>row.from<=day).sort((a,b)=>b.from.localeCompare(a.from))[0];
}
export function feedingRange(plan:Plan,day:string,weights:CareEvent[]=[]){
 const snapshot=goalSnapshot(plan,day);
 const week=ageInWeeks(day,snapshot?.birthDate??plan.birthDate??DEFAULT_BIRTH_DATE);
 const scheduled=feedingSchedule.find(row=>row.week===week);
 const interval=(snapshot?snapshot.interval:plan.interval)??3;
 const plannedFeeds=24/interval;
 const effectiveMode=snapshot
  ? snapshot.feedingGoalMode??(snapshot.mlKgGoal?'weight':snapshot.dailyGoal?'daily':'schedule')
  : plan.goalHistory?.length?'schedule':plan.feedingGoalMode??'schedule';
 const measuredGoal=effectiveMode==='schedule'&&day>=MEASURED_GOAL_START
  ? measuredWeightReference(plan,day,weights)
  : null;
 let low:number|null=null,high:number|null=null;
 if(effectiveMode==='schedule'){
  low=measuredGoal?.low??scheduled?.low??null;
  high=measuredGoal?.high??scheduled?.high??null;
 }else{
  const daily=feedingDay([],weights,plan,day);
  const goal=snapshot??plan;
  const target=effectiveMode==='weight'
   ? daily.grams&&goal.mlKgGoal?Math.round(daily.grams*goal.mlKgGoal/1000):null
   : goal.dailyGoal??null;
  low=target;
  high=target;
 }
 return {week,low,high,interval,plannedFeeds,perFeedLow:low===null?null:Math.round(low/plannedFeeds),perFeedHigh:high===null?null:Math.round(high/plannedFeeds),scheduled,goalWeight:measuredGoal?.grams??null};
}
function measuredWeightReference(plan:Plan,day:string,weights:CareEvent[]){
 const reference=feedingDay([],weights.filter(weight=>!weight.deleted),plan,day);
 if(!reference.referenceAvailable||reference.grams===null||reference.grams<=0)return null;
 return {grams:reference.grams,low:Math.round(reference.referenceLow),high:Math.round(reference.referenceHigh)};
}
export function pumpingRange(plan:Plan,day:string,weights:CareEvent[]=[]){
 const milk=feedingRange(plan,day,weights);
 const history=(plan.goalHistory??[]).filter(row=>row.pumpGoalMode!==undefined||row.pumpGoal!==undefined);
 const snapshot=goalSnapshot({...plan,goalHistory:history},day);
 const goal=snapshot??(history.length?{}:plan);
 const custom=goal.pumpGoalMode==='custom'||(!goal.pumpGoalMode&&!!goal.pumpGoal);
 return {low:custom?goal.pumpGoal??null:milk.low,high:custom?goal.pumpGoal??null:milk.high,followsFeeding:!custom};
}
export function rangeLabel(low:number|null,high:number|null){
 if(low===null||high===null)return 'Not set';
 return low===high?String(low):low+'–'+high;
}
export function measuredFeeding(items:CareEvent[],day:string){
 const [start,end]=dayBounds(day);
 const bottles=items.filter(event=>!event.deleted&&event.kind==='feed'&&event.subtype!=='nursing'&&event.startedAt>=start&&event.startedAt<end&&event.amount!==null);
 const volume=bottles.reduce((total,event)=>total+(event.amount??0),0);
 return {volume,count:bottles.length,average:bottles.length?volume/bottles.length:null};
}
