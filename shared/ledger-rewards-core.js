/* Personal milestones use existing saved Life XP. No record writes or bonus XP. */
(function(root){
 'use strict';
 const date=v=>typeof v==='string'&&Number.isFinite(Date.parse(v));
 function validate(rows){
  if(!Array.isArray(rows)||rows.length>50)throw Error('Keep at most 50 personal rewards.');
  const ids=new Set();
  for(const r of rows){if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id||r.id.length>120||ids.has(r.id)||typeof r.title!=='string'||!r.title.trim()||r.title.length>120||!Number.isInteger(r.target)||r.target<1||r.target>10000||typeof r.startXP!=='number'||!Number.isFinite(r.startXP)||r.startXP<0||!date(r.createdAt)||r.claimedAt!==undefined&&!date(r.claimedAt))throw Error('Invalid personal reward.');ids.add(r.id);}
  return rows;
 }
 function plan(input,life,now,id,existing){
  const title=String(input.title||'').trim(),target=Number(input.target);
  if(existing&&(existing.claimedAt||life.level>=existing.target))throw Error('An earned reward stays as recorded. Plan another reward for a future level.');
  if(!Number.isInteger(target)||target<=life.level)throw Error('Choose a Life Level above your saved current level.');
  const reward={id:existing?.id||id,title,target,startXP:existing?.startXP??life.xp,createdAt:existing?.createdAt||now};validate([reward]);return reward;
 }
 function view(rows,life,cost){
  validate(rows);const sorted=rows.slice().sort((a,b)=>a.target-b.target||a.createdAt.localeCompare(b.createdAt));
  const pending=sorted.filter(r=>!r.claimedAt).map(r=>{const targetXP=r.target*cost,span=Math.max(1,targetXP-r.startXP);return {...r,ready:life.level>=r.target,remaining:Math.max(0,Math.ceil(targetXP-life.xp)),progress:Math.min(1,Math.max(0,(life.xp-r.startXP)/span))};});
  return {pending,enjoyed:sorted.filter(r=>r.claimedAt),next:pending.find(r=>r.ready)||pending[0]||null};
 }
 function enjoy(rows,id,life,now){validate(rows);const r=rows.find(r=>r.id===id);if(!r)throw Error('This reward could not be found.');if(r.claimedAt)throw Error('This reward is already recorded as enjoyed.');if(life.level<r.target)throw Error('Save enough progress to reach this reward first.');if(!date(now))throw Error('Invalid reward date.');return rows.map(r=>r.id===id?{...r,claimedAt:now}:{...r});}
 root.LedgerRewards=Object.freeze({validate,plan,view,enjoy});
})(typeof window==='undefined'?globalThis:window);
