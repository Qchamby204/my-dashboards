import {dayKey, type CareEvent, type Plan} from './care.ts';
import {feedingRange, pumpingRange, rangeLabel} from './feeding-plan.ts';
import {calendarDays, growthSummary} from './growth.ts';
import {trackingEnabled} from './tracking.ts';
import {metricSummary, type TrendDay} from './trends.ts';
import {headMovements} from './tummy-observations.ts';

type InsightKey = 'feed'|'weight'|'diaper'|'tummy'|'exercise'|'pump'|'sleep'|'nursing';
export type DayMark = {day: string; actual: number|null; low: number|null; high: number|null};
export type ObservationWeek = {all: number; lifts: number};
export type InsightVisual =
  | {kind:'days'; marks:DayMark[]; unit:string; reference:string}
  | {kind:'observations'; current:ObservationWeek; previous:ObservationWeek}
  | {kind:'weight'; measures:{day:string; grams:number}[]};
export type CareInsight = {key: InsightKey; title: string; value: string; unit:string; context:string; detail: string; visual:InsightVisual};
type Band = {low: number|null; high: number|null};

const number = (n: number) => n.toLocaleString('en-CA', {maximumFractionDigits: 1});
const plural = (n: number, label: string) => number(n) + ' ' + label + (n === 1 ? '' : 's');
const dateFormat = new Intl.DateTimeFormat('en-CA', {month:'short', day:'numeric', timeZone:'UTC'});
export const shortDate = (day: string) => dateFormat.format(new Date(day + 'T12:00:00Z'));

function compareVolume(marks: DayMark[]) {
  const matches = marks.filter((mark): mark is {day:string;actual:number;low:number;high:number} =>
    mark.actual !== null && mark.low !== null && mark.high !== null);
  const last = matches.at(-1);
  if (!last) return '';
  const target = rangeLabel(last.low, last.high) + ' mL';
  if (matches.every(m => m.low === m.high)) {
    const delta = matches.reduce((s, m) => s + m.actual - m.low, 0) / matches.length;
    const result = Math.abs(delta) < .05 ? 'matched the target' : `was ${number(Math.abs(delta))} mL ${delta > 0 ? 'above' : 'below'} target`;
    return `The average ${result} across ${plural(matches.length, 'day')} with a target. The ${shortDate(last.day)} target was ${target}.`;
  }
  const within = matches.filter(m => m.actual >= m.low && m.actual <= m.high).length;
  const below = matches.filter(m => m.actual < m.low).length;
  const above = matches.length - within - below;
  const parts = [[within, 'within'], [below, 'below'], [above, 'above']] as const;
  const breakdown = parts.filter(([n]) => n > 0).map(([n, label]) => plural(n,'day')+' '+label+' plan').join(', ');
  return `${breakdown}. The ${shortDate(last.day)} plan was ${target}.`;
}

export function buildCareInsights(history: TrendDay[], plan: Plan, weights: CareEvent[], end: string): CareInsight[] {
  const week = history.slice(-7);
  const previous = history.slice(-14,-7);
  const rows: CareInsight[] = [];
  function daily(metric:keyof TrendDay['values'],unit:string,reference:string,bandOn?:(date:string)=>Band):Extract<InsightVisual,{kind:'days'}> {
    return {kind:'days',unit,reference,marks:week.map(day => ({
      day:day.day, actual:day.values[metric], ...(bandOn?.(day.day) ?? {low:null,high:null}),
    }))};
  }
  const flatBand = (value:number|null) => ({low:value,high:value});

  function volume(key: 'feed'|'pump', metric: 'milk'|'pumping', title: string, bandOn: (day:string) => Band) {
    const current = metricSummary(week, metric);
    if (!trackingEnabled(plan,key) || current.average === null) return;
    const prior = metricSummary(previous,metric);
    const visual = daily(metric,'mL','Daily plan',bandOn);
    const comparison = compareVolume(visual.marks);
    rows.push({key, title, value:number(current.average),unit:'mL/day',context:plural(current.recorded,'logged day'),visual,
      detail:comparison || (prior.average === null ? 'No daily target available for these entries.' : `Previous week averaged ${number(prior.average)} mL/day across ${plural(prior.recorded,'logged day')}.`)});
  }
  volume('feed','milk','Bottle feeds',day => feedingRange(plan,day,weights));

  if (trackingEnabled(plan,'weight')) {
    const {latest, history:measured, dailyGain, interval} = growthSummary(weights,end);
    if (latest) rows.push({key:'weight',title:'Weight',value:number(latest.amount!),unit:'g',context:'Measured '+shortDate(dayKey(latest.startedAt)),
      visual:{kind:'weight',measures:measured.slice(-7).map(entry=>({day:dayKey(entry.startedAt),grams:entry.amount!}))},
      detail:dailyGain === null ? 'One weigh-in so far.' : `${dailyGain === 0 ? 'No weight change' : number(Math.abs(dailyGain))+' g/day '+(dailyGain > 0 ? 'gained' : 'lost')} across the ${plural(interval,'day')} between weigh-ins.`});
  }

  const wet = metricSummary(week,'wet');
  if (trackingEnabled(plan,'diaper') && wet.average !== null) {
    const prior = metricSummary(previous,'wet');
    const currentTarget = plan.wetTarget;
    const atTarget = week.filter(day => day.values.wet !== null && currentTarget != null && day.values.wet >= currentTarget).length;
    rows.push({key:'diaper',title:'Wet diapers',value:number(wet.average),unit:'/ day',context:plural(wet.recorded,'logged day'),
      visual:daily('wet','wet diapers',currentTarget != null?'Current target':'Prior week avg.',()=>flatBand(currentTarget ?? prior.average)),
      detail:currentTarget != null ? `At least ${currentTarget} logged on ${atTarget} of ${plural(wet.recorded,'logged day')}. Your current target is ${currentTarget}/day.` :
        prior.average !== null ? `Previous week averaged ${number(prior.average)} per day across ${plural(prior.recorded,'logged day')}.` : 'No earlier logged days to compare.'});
  }

  const practice = metricSummary(week,'tummy');
  if (trackingEnabled(plan,'tummy') && practice.recorded) {
    const observed = (days: TrendDay[]) => ({
      all: days.reduce((sum,day) => sum + headMovements.reduce((n,key) => n + day.headMovements[key],0),0),
      lifts: days.reduce((sum,day) => sum + day.headMovements.lifted + day.headMovements.held,0),
    });
    const current = observed(week), prior = observed(previous);
    const priorSessions = metricSummary(previous,'tummy');
    const detail = current.all
      ? `You saw him lift or hold his head in ${current.lifts} of ${plural(current.all,'session')} with a head observation${prior.all ? `, compared with ${prior.lifts} of ${prior.all} the week before` : ''}.`
      : priorSessions.recorded ? `The previous week had ${plural(priorSessions.total,'logged session')}. No head movements recorded this week.` : 'No head movements recorded this week.';
    rows.push({key:'tummy',title:'Tummy time',value:number(practice.total),unit:practice.total===1?'session':'sessions',context:plural(practice.recorded,'practice day'),detail,
      visual:current.all || prior.all ? {kind:'observations',current,previous:prior} : daily('tummy','sessions','')});
  }
  volume('pump','pumping','Pumping',day => pumpingRange(plan,day,weights));

  for (const [key,title,unit] of [['sleep','Sleep','hours'],['nursing','Breastfeeding','minutes'],['exercise','Exercises','activities']] as const) {
    if (!trackingEnabled(plan,key) || (key === 'nursing' && !trackingEnabled(plan,'feed'))) continue;
    const current = metricSummary(week,key);
    if (current.average === null) continue;
    const prior = metricSummary(previous,key);
    const detail = key === 'sleep' && plan.sleepGoalHours != null ? `Your current logging goal is ${number(plan.sleepGoalHours)} hours/day.` :
      prior.average !== null ? `Previous week averaged ${number(prior.average)} ${unit}/day across ${plural(prior.recorded,'logged day')}.` : 'No earlier logged days to compare.';
    const useGoal = key === 'sleep' && plan.sleepGoalHours != null;
    rows.push({key,title,value:number(current.average),unit:unit+'/day',context:plural(current.recorded,'logged day'),detail,
      visual:daily(key,unit,useGoal?'Current goal':'Prior week avg.',()=>flatBand(useGoal?plan.sleepGoalHours!:prior.average))});
  }
  return rows;
}

export function developmentalAge(due: string, today: string) {
  const days = calendarDays(due,today);
  if (days < 0) return plural(-days,'day') + ' until his due date';
  if (days === 0) return 'Today is his due date';
  const weeks = Math.floor(days/7);
  const label = weeks ? [plural(weeks,'week'), days%7 ? plural(days%7,'day') : ''].filter(Boolean).join(', ') : plural(days,'day');
  return label + ' corrected age';
}
