import {env} from 'cloudflare:workers';
import {z} from 'zod';
import {ApiError,checkOrigin,failure,identity,json} from '@/lib/server';

const tap=z.object({
 id:z.string().uuid(),
 delta:z.union([z.literal(-1),z.literal(1)]),
 legacyCount:z.number().int().min(0).max(1000).default(0),
});

export async function POST(req:Request){
 try{
  checkOrigin(req);
  const user=await identity();
  const input=tap.safeParse(await req.json());
  if(!input.success)throw new ApiError('Open the active tummy timer.');
  const db=env.DB;
  if(!db)throw new Error('Shared database unavailable.');
  const {id,delta,legacyCount}=input.data;
  const event=await db.prepare(`UPDATE care_events
   SET amount=max(0,min(1000,coalesce(amount,?)+?)),updated_by=?,updated_at=?,version=version+1
   WHERE id=? AND kind='tummy' AND deleted=0 AND ended_at IS NULL RETURNING id`)
   .bind(legacyCount,delta,user.name,new Date().toISOString(),id).first();
  if(!event)throw new ApiError('This session has already ended. Refresh the journal.',409);
  return json({ok:true});
 }catch(error){return failure(error);}
}
