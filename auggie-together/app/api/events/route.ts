import { tummyObservations } from '@/lib/tummy-observations';
import { tummyComfortOptions } from '@/lib/tummy-progress';
import { exerciseIds, isMovement, movementKinds, tummyPositions } from '@/lib/movement';
import {leftoverDeadline} from '@/lib/feeding';
import { getDb } from '@/db';import { events } from '@/db/schema';import { and,eq } from 'drizzle-orm';import { z } from 'zod';import { identity,checkOrigin,json,failure,ApiError,getPlan } from '@/lib/server';
const draft=z.object({tummyObservation:z.enum(tummyObservations).nullable().optional(),tummyCueSeconds:z.number().int().min(1).max(3600).nullable().optional(),tummyComfort:z.enum(tummyComfortOptions).nullable().optional(),milkDeadline:z.string().datetime().nullable().default(null),milkStorage:z.enum(['fresh','fridge','used','discarded']).nullable().default(null),id:z.string().uuid(),kind:z.enum(['feed','bottle','diaper','sleep','pump','weight','medicine','note',...movementKinds]),subtype:z.string().max(80).default(''),soiledSize:z.enum(['small','medium','large']).nullable().default(null),wetSize:z.enum(['small','medium','large']).nullable().default(null),startedAt:z.string().datetime(),endedAt:z.string().datetime().nullable().default(null),amount:z.number().min(0).max(30000).nullable().default(null),offered:z.number().min(0).max(2000).nullable().default(null),duration:z.number().min(0).max(1440).nullable().default(null),notes:z.string().max(4000).default('')});
function closedMilk(value:unknown){return value==='used'||value==='discarded';}
function validate(raw:unknown){const r=draft.safeParse(raw);if(!r.success)throw new ApiError('Check the date, amount, and required fields.');const d=r.data;if(Date.parse(d.startedAt)>Date.now()+60000)throw new ApiError('Entries cannot be in the future.');if(d.endedAt&&(d.endedAt<d.startedAt||Date.parse(d.endedAt)>Date.now()+60000))throw new ApiError('The end must be after the start and no later than now.');
if(d.kind==='feed'){if(!['milk','formula','nursing'].includes(d.subtype))throw new ApiError('Choose a feed type.');if(d.subtype==='nursing'&&(!d.duration||d.duration>240))throw new ApiError('Enter breastfeeding minutes (up to 240).');if(d.subtype!=='nursing'&&(d.amount===null||d.amount>2000))throw new ApiError('Enter the consumed amount in mL (up to 2,000).');if(d.offered!==null&&d.amount!==null&&d.amount>d.offered)throw new ApiError('Consumed milk cannot exceed the amount offered.');}if(d.kind==='diaper'&&!['wet','dirty','both'].includes(d.subtype))throw new ApiError('Choose wet, dirty, or both.');if(d.kind==='weight'&&(d.amount===null||d.amount<100||d.amount>30000))throw new ApiError('Enter weight in grams (100–30,000).');if(d.kind==='pump'&&(d.amount===null||d.amount>2000))throw new ApiError('Enter pumped volume in mL (up to 2,000).');if(['note','medicine'].includes(d.kind)&&!d.notes.trim())throw new ApiError('Add the note or medicine details.');if(d.kind==='bottle'&&((d.amount!==null&&d.amount>2000)||(d.milkStorage!==null&&!closedMilk(d.milkStorage))))throw new ApiError('Leftover bottles can only be marked finished or discarded. Refrigeration does not restart their clock.');if(!['pump','bottle'].includes(d.kind))d.milkStorage=null;if(d.kind!=='tummy'){d.tummyObservation=null;d.tummyCueSeconds=null;d.tummyComfort=null;}if(isMovement(d.kind))validateMovement(d);else if(d.kind!=='sleep')d.endedAt=null;if(d.kind!=='diaper'||d.subtype==='wet')d.soiledSize=null;if(d.kind!=='diaper'||d.subtype==='dirty')d.wetSize=null;return d;}
function validateMovement(d:z.infer<typeof draft>){
 if(d.kind==='tummy'){
  if(d.tummyObservation && (d.endedAt!==d.startedAt || d.amount!==null || d.tummyCueSeconds!=null))
   throw new ApiError('An untimed check-in uses one session time and no measurements.');
  if(d.tummyComfort&&!d.endedAt)throw new ApiError('Stop the timer before marking how the session went.');
  if(d.subtype&&!tummyPositions.some(position=>position.id===d.subtype))throw new ApiError('Choose a tummy-time position.');
  if(d.amount!==null&&(!Number.isInteger(d.amount)||d.amount>1000))throw new ApiError('Enter a whole number of head lifts (0–1,000).');
 }else{
  const ids=exerciseIds(d.subtype);
  if(d.subtype&&ids.length!==d.subtype.split(',').length)throw new ApiError('Check the exercise selections.');
  if(d.endedAt===d.startedAt&&!ids.length)throw new ApiError('Check an activity or record exercise time.');
  d.subtype=ids.join(',');
  d.amount=null;
 }
 d.duration=null;
 d.offered=null;
}
async function deadline(d:ReturnType<typeof validate>){if(d.kind==='bottle')return leftoverDeadline(d.startedAt,d.milkDeadline);if(d.kind!=='pump'||!d.milkStorage||closedMilk(d.milkStorage)||d.milkStorage==='fresh')return null;const p=await getPlan();const minutes=p.fridgeMilkHours===null?null:p.fridgeMilkHours*60;return minutes?new Date(Date.parse(d.startedAt)+minutes*60000).toISOString():null;}
export async function POST(req:Request){try{checkOrigin(req);const user=await identity();const d=validate(await req.json());if(d.kind==='pump'&&!d.milkStorage)d.milkStorage='fresh';const milkDeadline=await deadline(d);const db=getDb();const stamp=new Date().toISOString();try{await db.insert(events).values({...d,milkDeadline,actor:user.name,creatorId:user.id,updatedBy:user.name,createdAt:stamp,updatedAt:stamp}).onConflictDoNothing({target:events.id});}catch(e){if(d.kind==='sleep'&&!d.endedAt)throw new ApiError('A sleep timer is already running. Refresh to see it.',409);if(isMovement(d.kind)&&!d.endedAt&&e instanceof Error&&String(e.cause??e).includes('UNIQUE constraint failed: care_events.kind'))throw new ApiError('That timer is already running. Refresh to see it.',409);throw e;}const [row]=await db.select().from(events).where(eq(events.id,d.id));return json({event:row});}catch(e){return failure(e);}}
export async function PATCH(req:Request){try{checkOrigin(req);const user=await identity();const input=await req.json();const parsed=draft.extend({version:z.number().int()}).safeParse(input);if(!parsed.success)throw new ApiError('Refresh this entry before editing.');const raw=parsed.data;const d=validate(raw);const db=getDb();const [old]=await db.select().from(events).where(eq(events.id,d.id));
if(d.kind==='pump'&&!Object.prototype.hasOwnProperty.call(input,'milkStorage'))d.milkStorage=old?.milkStorage as typeof d.milkStorage??null;
if(d.kind==='tummy'&&old?.kind==='tummy'){
 if(old.tummyObservation && !d.tummyObservation) d.tummyObservation=old.tummyObservation;
 if(Boolean(d.tummyObservation)!==Boolean(old.tummyObservation))throw new ApiError('Reopen this session to edit it in its original format.');
 d.tummyCueSeconds=old.tummyCueSeconds;
 validateMovement(d);
 if(!old.endedAt&&d.endedAt&&old.amount!==null)d.amount=old.amount;
}
if(old&&isMovement(old.kind)&&(old.kind!==d.kind||old.endedAt&&!d.endedAt))throw new ApiError('A saved activity cannot be restarted or changed to a different type.');
let milkDeadline=old?.milkDeadline??null;
if(old?.kind==='bottle'&&d.kind!=='bottle')throw new ApiError('A leftover bottle cannot be changed to another entry type.');
if(d.kind==='bottle'){if(closedMilk(old?.milkStorage)&&!closedMilk(d.milkStorage))throw new ApiError('Finished bottles cannot be restarted.');milkDeadline=leftoverDeadline(d.startedAt,d.milkDeadline);if(old?.milkDeadline&&old.milkDeadline<milkDeadline)milkDeadline=old.milkDeadline;}
else if(d.kind!=='pump')milkDeadline=null;
else if(!old||!old.milkDeadline||old.startedAt!==d.startedAt||old.kind!=='pump'||old.milkStorage!==d.milkStorage){
 if(closedMilk(old?.milkStorage)&&!closedMilk(d.milkStorage))throw new ApiError('Finished batches cannot be put back into storage. Log a new pumping session for new milk.');

 milkDeadline=await deadline(d);
 if(old?.milkStorage==='fresh'&&d.milkStorage==='fridge'&&old.milkDeadline&&Date.parse(old.milkDeadline)<=Date.now())milkDeadline=old.milkDeadline;
}
const changes:Partial<typeof events.$inferInsert>={...d,milkDeadline};if(d.kind==='diaper'&&d.subtype!=='wet'&&typeof input==='object'&&input!==null&&!Object.prototype.hasOwnProperty.call(input,'soiledSize'))delete changes.soiledSize;if(d.kind==='diaper'&&d.subtype!=='dirty'&&typeof input==='object'&&input!==null&&!Object.prototype.hasOwnProperty.call(input,'wetSize'))delete changes.wetSize;const rows=await getDb().update(events).set({...changes,version:raw.version+1,updatedAt:new Date().toISOString(),updatedBy:user.name}).where(and(eq(events.id,d.id),eq(events.version,raw.version),eq(events.deleted,0))).returning();if(!rows.length)throw new ApiError('This entry changed on another phone. Close it and reopen the latest version.',409);return json({event:rows[0]});}catch(e){return failure(e);}}
export async function DELETE(req:Request){try{checkOrigin(req);const user=await identity();const parsed=z.object({id:z.string().uuid(),version:z.number().int()}).safeParse(await req.json());if(!parsed.success)throw new ApiError('Invalid entry.');const raw=parsed.data;const rows=await getDb().update(events).set({deleted:1,version:raw.version+1,updatedAt:new Date().toISOString(),updatedBy:user.name}).where(and(eq(events.id,raw.id),eq(events.version,raw.version),eq(events.deleted,0))).returning();if(!rows.length)throw new ApiError('This entry changed. Refresh and try again.',409);return json({ok:true});}catch(e){return failure(e);}}
