import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {dayBounds,dayKey} from '@/lib/care';
import {exercises} from '@/lib/movement';
import {ApiError,checkOrigin,failure,identity,json} from '@/lib/server';

const change=z.object({exercise:z.string(),checked:z.boolean(),day:z.string()});

export async function POST(req:Request){
 try{
  checkOrigin(req);
  const user=await identity();
  const result=change.safeParse(await req.json());
  if(!result.success||!exercises.some(item=>item.id===result.data.exercise))throw new ApiError('Choose a checklist activity.');
  const {exercise,checked,day}=result.data;
  const stamp=new Date().toISOString();
  if(day!==dayKey(stamp))throw new ApiError('The day changed. Open Play again to log today’s checklist.',409);
  const [start,end]=dayBounds(day);
  const db=env.DB;
  if(!db)throw new Error('Shared database unavailable.');
  const hasExercise="kind='exercise' AND deleted=0 AND ended_at IS NOT NULL AND started_at>=? AND started_at<? AND instr(',' || subtype || ',', ?) > 0";
  const token=','+exercise+',';
  if(checked){
   await db.prepare(`INSERT INTO care_events
    (id,kind,subtype,started_at,ended_at,actor,creator_id,updated_by,created_at,updated_at)
    SELECT ?,'exercise',?,?,?,?,?,?,?,?
    WHERE NOT EXISTS(SELECT 1 FROM care_events WHERE ${hasExercise})`)
    .bind(crypto.randomUUID(),exercise,stamp,stamp,user.name,user.id,user.name,stamp,stamp,start,end,token).run();
  }else{
   // Keep timed exercise sessions and other activities when undoing a check.
   await db.prepare(`UPDATE care_events
    SET subtype=trim(replace(',' || subtype || ',', ?, ','), ','),
        deleted=CASE WHEN subtype=? AND started_at=ended_at THEN 1 ELSE deleted END,
        version=version+1, updated_by=?, updated_at=?
    WHERE ${hasExercise}`)
    .bind(token,exercise,user.name,stamp,start,end,token).run();
  }
  return json({ok:true});
 }catch(error){return failure(error);}
}
