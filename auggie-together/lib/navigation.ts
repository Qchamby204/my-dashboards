import {shiftDay} from './care.ts';
export function stepTrackerDay(day:string,view:'daily'|'weekly',direction:-1|1,today:string){return [shiftDay(day,direction*(view==='weekly'?7:1)),today].sort()[0];}
