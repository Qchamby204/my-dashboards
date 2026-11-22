import { dayBounds, dayKey, shiftDay, sleepMinutes, type CareEvent } from './care.ts';
import { countHeadMovements } from './tummy-observations.ts';
import { exerciseIds } from './movement.ts';

export type TrendMetric = 'milk' | 'nursing' | 'pumping' | 'wet' | 'dirty' | 'diapers' | 'sleep' | 'tummy' | 'lifts' | 'exercise' | 'weight' | 'medicine' | 'notes';
export type TrendDay = {
  day: string;
  values: Record<TrendMetric, number | null>;
  feedCount: number;
  bottleCount: number;
  nursingCount: number;
  pumpCount: number;
  checked: number;
  headMovements: ReturnType<typeof countHeadMovements>;
  tummyComfortable: number;
  tummyBreaks: number;
};
export function buildTrendDays(events: CareEvent[], endDay: string, count = 66, now = Date.now()): TrendDay[] {
  const live = events.filter(event => !event.deleted);
  return Array.from({ length: count }, (_, index) => {
    const day = shiftDay(endDay, index - count + 1);
    const [start, end] = dayBounds(day);
    const items = live.filter(event => event.startedAt >= start && event.startedAt < end);
    const feeds = items.filter(event => event.kind === 'feed');
    const bottles = feeds.filter(event => event.subtype !== 'nursing' && event.amount !== null);
    const nursing = feeds.filter(event => event.subtype === 'nursing');
    const pumps = items.filter(event => event.kind === 'pump' && event.amount !== null);
    const diapers = items.filter(event => event.kind === 'diaper');
    const tummy = items.filter(event => event.kind === 'tummy' && event.endedAt);
    const measuredLifts = tummy.filter(event => event.amount !== null);
    const exercise = items.filter(event => event.kind === 'exercise' && event.endedAt);
    const weights = items.filter(event => event.kind === 'weight' && event.amount !== null).sort((a,b)=>b.startedAt.localeCompare(a.startedAt));
    const meds = items.filter(event => event.kind === 'medicine');
    const notes = items.filter(event => event.kind === 'note');
    const sleep = sleepMinutes(live, start, end, now);
    const sumAmount = (entries: CareEvent[]) => entries.reduce((sum, entry) => sum + (entry.amount ?? 0), 0);
    return {
      day,
      values: {
        milk: bottles.length ? sumAmount(bottles) : null,
        nursing: nursing.length ? nursing.reduce((sum, event) => sum + (event.duration ?? 0), 0) : null,
        pumping: pumps.length ? sumAmount(pumps) : null,
        wet: diapers.length ? diapers.filter(event => event.subtype !== 'dirty').length : null,
        dirty: diapers.length ? diapers.filter(event => event.subtype !== 'wet').length : null,
        diapers: diapers.length || null,
        sleep: sleep > 0 ? sleep / 60 : null,
        tummy: tummy.length || null,
        lifts: measuredLifts.length ? sumAmount(measuredLifts) : null,
        exercise: exercise.length ? exerciseIds(exercise.map(event=>event.subtype).join(',')).length : null,
        weight: weights[0]?.amount ?? null,
        medicine: meds.length || null,
        notes: notes.length || null,
      },
      feedCount: feeds.length,
      bottleCount: bottles.length,
      nursingCount: nursing.length,
      pumpCount: pumps.length,
      headMovements:countHeadMovements(tummy),
      tummyComfortable:tummy.filter(event=>event.tummyComfort==='comfortable').length,
      tummyBreaks:tummy.filter(event=>event.tummyComfort==='break').length,
      checked: exerciseIds(exercise.map(event => event.subtype).join(',')).length,
    };
  });
}

export function metricSummary(days: TrendDay[], metric: TrendMetric) {
  const values = days.flatMap(day => day.values[metric] === null ? [] : [day.values[metric]!]);
  const total = values.reduce((sum, value) => sum + value, 0);
  return { total, recorded: values.length, average: values.length ? total / values.length : null };
}

export function rollingAverage(days: TrendDay[], metric: TrendMetric, index: number) {
  return metricSummary(days.slice(Math.max(0, index - 6), index + 1), metric).average;
}

export function completedTrendEnd(selectedDay: string, today = dayKey()) {
  return selectedDay < today ? selectedDay : shiftDay(today, -1);
}

type DailyTarget = {low:number|null;high:number|null};
export function volumePeriod(days:TrendDay[],metric:'milk'|'pumping',targetForDay:(day:string)=>DailyTarget){
 const summary=metricSummary(days,metric);
 const recorded=days.filter(day=>day.values[metric]!==null);
 const sessions=recorded.reduce((total,day)=>total+(metric==='milk'?day.bottleCount:day.pumpCount),0);
 const targets=recorded.map(day=>targetForDay(day.day)).filter((target):target is {low:number;high:number}=>target.low!==null&&target.high!==null);
 return {
  ...summary,
  sessions,
  sessionsPerDay:recorded.length?sessions/recorded.length:null,
  perSession:sessions?summary.total/sessions:null,
  goalDays:targets.length,
  goal:{
   low:targets.length?targets.reduce((total,target)=>total+target.low,0)/targets.length:null,
   high:targets.length?targets.reduce((total,target)=>total+target.high,0)/targets.length:null,
  },
 };
}
