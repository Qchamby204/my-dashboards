import type {CareEvent,Plan} from './care.ts';

export const trackingKeys=['feed','pump','diaper','milkTimers','tummy','exercise','sleep','nursing','weight','medicine','note'] as const;
export type TrackingKey=typeof trackingKeys[number];
export const defaultTracking:Record<TrackingKey,boolean>={
 feed:true,pump:true,diaper:true,milkTimers:true,tummy:true,exercise:true,
 sleep:false,nursing:false,weight:false,medicine:true,note:true,
};
export function trackingEnabled(plan:Plan,key:TrackingKey){
 return plan.tracking?.[key]??defaultTracking[key];
}
export function visibleEvent(plan:Plan,event:CareEvent){
 if(event.kind==='bottle')return trackingEnabled(plan,'milkTimers');
 if(event.kind==='feed'&&event.subtype==='nursing')return trackingEnabled(plan,'feed')&&trackingEnabled(plan,'nursing');
 return trackingEnabled(plan,event.kind);
}
