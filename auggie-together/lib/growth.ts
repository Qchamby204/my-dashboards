import {dayKey,shiftDay,type CareEvent} from './care.ts';
export function calendarDays(from:string,to:string){return (Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000;}
// Date-only weigh-ins are compared by calendar day, not invented times of day.
export function weightHistory(items:CareEvent[],asOf:string){
 const byDay=new Map<string,CareEvent>();
 for(const entry of [...items].sort((a,b)=>a.startedAt.localeCompare(b.startedAt)||a.updatedAt.localeCompare(b.updatedAt))){
  if(entry.kind!=='weight'||entry.deleted||entry.amount===null||entry.amount<=0)continue;
  const day=dayKey(entry.startedAt);if(day<=asOf)byDay.set(day,entry);
 }
 return [...byDay.values()].sort((a,b)=>a.startedAt.localeCompare(b.startedAt));
}
export function growthSummary(items:CareEvent[],asOf:string,range=1){
 const history=weightHistory(items,asOf),latest=history.at(-1)??null,previous=history.at(-2)??null;
 const interval=latest&&previous?calendarDays(dayKey(previous.startedAt),dayKey(latest.startedAt)):0;
 const gain=latest&&previous?latest.amount!-previous.amount!:null;
 const cutoff=shiftDay(asOf,-(range===1?30:range));
 const inWindow=history.filter(row=>dayKey(row.startedAt)>=cutoff);
 const baseline=history.filter(row=>dayKey(row.startedAt)<cutoff).at(-1);
 const points=baseline?[baseline,...inWindow]:inWindow;
 // Prefer a complete interval spanning the selected window; show its actual dates.
 const first=points[0]??null,last=points.at(-1)??null;
 const span=first&&last?calendarDays(dayKey(first.startedAt),dayKey(last.startedAt)):0;
 return {history,latest,previous,interval,gain,dailyGain:interval>0&&gain!==null?gain/interval:null,
  ageDays:latest?calendarDays(dayKey(latest.startedAt),asOf):null,points,
  trendStart:span>0?first:null,trendEnd:span>0?last:null,trendDays:span,
  trendGain:span>0?(last!.amount!-first!.amount!)/span:null};
}
export function weeklyGrowthProjection(summary:ReturnType<typeof growthSummary>,asOf:string){
 const {latest,dailyGain}=summary;
 const yearEnd=asOf.slice(0,4)+'-12-31';
 if(!latest||dailyGain===null||dailyGain<=0||asOf>=yearEnd)return [];

 const measuredDay=dayKey(latest.startedAt);
 const gramsAt=(day:string)=>Math.round(latest.amount!+calendarDays(measuredDay,day)*dailyGain);
 const rows:{day:string;grams:number}[]=[];
 for(let day=shiftDay(measuredDay,7);day<yearEnd;day=shiftDay(day,7)){
  if(day>asOf)rows.push({day,grams:gramsAt(day)});
 }
 return [...rows,{day:yearEnd,grams:gramsAt(yearEnd)}];
}

export function poundsOunces(grams:number){const ounces=grams/28.349523125;const pounds=Math.floor(ounces/16);return `${pounds} lb ${(ounces-pounds*16).toLocaleString('en-CA',{maximumFractionDigits:1})} oz`;}
