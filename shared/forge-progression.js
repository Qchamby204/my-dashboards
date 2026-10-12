/* Reviewed suggestions for regular workouts; never writes records or alters goal plans. */
(function(root){
  'use strict';
  const feedbacks=['smooth','hard','missed','pain'];
  const number=v=>typeof v==='number'?v:(typeof v==='string'&&/^\d+(?:\.\d+)?$/.test(v.trim())?Number(v):NaN);
  function range(value){const m=String(value||'').match(/^(\d+)(?:[–-](\d+))?(?:\/(?:side|leg))?$/);if(!m)return null;const lo=+m[1],hi=+(m[2]||m[1]);return lo>0&&hi>=lo&&hi<=50?{lo,hi}:null;}
  function defaultStep(name){return /dumbbell|\bdb\b/i.test(name)?2.5:5;}
  function setting(value,name){const n=number(value);return [1,2.5,5,10].includes(n)?n:defaultStep(name);}
  function dateDay(v){if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return NaN;const n=Date.parse(v+'T12:00:00Z');return Number.isFinite(n)&&new Date(n).toISOString().slice(0,10)===v?n/86400000:NaN;}
  function suggest({item,id,name,sessions=[],today,step}){
    const rr=range(item.reps),count=item.sets,inc=setting(step,name);
    const result=(kind,title,reason,load=null)=>({kind,title,reason,load,reps:rr?.lo,sets:count,step:inc});
    if(item.track!=='load'||!rr||!Number.isInteger(count)||count<1||count>10)return result('manual','Follow the prescription','This exercise does not use a comparable weight-and-rep target.');
    const power=/max power/i.test(item.rpe)||/jump|swing|chest pass|explosive|speed bench/i.test(name);
    const body=/pull-up|pullup|assisted|push-up|dip|rollout|leg raise|reverse crunch|plank|hold/i.test(name);
    const now=dateDay(today);
    const records=sessions.map((s,index)=>({date:s.date,index,entry:s.items?.[id]})).filter(s=>s.entry&&Number.isFinite(dateDay(s.date))&&dateDay(s.date)<=now).sort((a,b)=>b.date.localeCompare(a.date)||b.index-a.index);
    const last=records[0];
    if(last?.entry.feedback==='pain')return result('pause','Pause this exercise','Pain was recorded last time. Do not use a load target until you have reviewed the movement.');
    if(power||body)return result('manual',power?'Keep the movement crisp':'Progress this movement manually',power?'Judge speed and technique; rep counts alone do not justify more load.':'Bodyweight, assistance and external load are not interchangeable.');
    if(!last)return result('baseline','Establish a baseline','Log all working sets and how they felt. No starting weight is inferred.');
    if(now-dateDay(last.date)>21)return result('review','Review after the break','Your last entry is over three weeks old. Choose an appropriate return load before progressing.');
    function comparable(record){
      if(!record||!Array.isArray(record.entry.sets)||record.entry.sets.length!==count)return null;
      const prescription=record.entry.prescription;
      if(prescription&&(prescription.sets!==count||prescription.reps!==item.reps||prescription.name!==name))return null;
      if(record.entry.name&&record.entry.name!==name)return null;
      const sets=record.entry.sets.map(s=>({w:number(s.w),r:number(s.r)}));
      if(sets.some(s=>!Number.isFinite(s.w)||s.w<=0||s.w>2000||!Number.isInteger(s.r)||s.r<1||s.r>100))return null;
      if(sets.some(s=>s.w!==sets[0].w))return null;
      return {load:sets[0].w,top:sets.every(s=>s.r>=rr.hi),below:sets.some(s=>s.r<rr.lo),feedback:record.entry.feedback};
    }
    const a=comparable(last),previous=records[1],b=comparable(previous);
    if(!a)return result('review','Keep logging comparable sets','Use all prescribed working sets at one load. Partial or mixed-load entries do not produce a weight target.');
    const pair=b&&previous.date!==last.date&&dateDay(last.date)-dateDay(previous.date)<=21&&a.load===b.load;
    if(pair&&a.below&&b.below&&a.feedback==='missed'&&b.feedback==='missed'){
      const reduced=Math.floor((a.load*.95+1e-8)/inc)*inc;
      if(reduced>0&&reduced>=a.load*.9&&reduced<a.load)return result('reduce','Try a lighter load','Two separate sessions missed the minimum reps at this load. This suggests a 5–10% reduction for this lift, not a whole-program deload.',+reduced.toFixed(2));
      return result('review','Review the load','Two sessions missed the minimum reps. Your equipment increment is too large for a small reduction.');
    }
    if(a.feedback==='hard'||a.feedback==='missed'||a.below)return result('hold','Hold the load','Repeat the load and work toward clean prescribed reps before increasing.',a.load);
    if(pair&&a.top&&b.top&&a.feedback==='smooth'&&b.feedback==='smooth'){
      if(inc/a.load>.1)return result('hold','Build reps at this load','Your selected increment exceeds 10%. Use a smaller available increment before adding weight.',a.load);
      return result('increase','Ready for a small increase','All sets reached the top of the range with clean reps and reserve on two separate sessions at this load.',+(a.load+inc).toFixed(2));
    }
    return result('hold','Build reps at this load',a.feedback==='smooth'?'Repeat the top of the range with clean reps and reserve on a second session before increasing.':'Past effort is unknown. Record how this session felt before Forge suggests an increase.',a.load);
  }
  root.ForgeProgression={suggest,range,setting,defaultStep,feedbacks};
})(typeof window==='undefined'?globalThis:window);
