/* Goal records deliberately use a separate namespace from the regular split. */
(()=>{
  'use strict';
  const plans=window.ForgeGoalPlans;
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const blank=()=>({version:1,plans:{}});
  const fresh=()=>({week:0,day:'d1',base:'28:00',baseConfirmed:false,done:{},completed:{},draft:null});
  const seconds=t=>{const m=String(t).match(/^(\d{1,2}):([0-5]\d)$/);return m?Number(m[1])*60+Number(m[2]):null;};
  const format=t=>`${Math.floor(Math.round(t)/60)}:${String(Math.round(t)%60).padStart(2,'0')}`;
  const key=(week,day,exercise,set)=>`${week}-${day}-${exercise}-${set}`;
  function locate(id,k,base){
    const m=/^([0-7])-(d[12])-(\d+)-(\d+)$/.exec(k);if(!m)return null;
    const e=plans[id]?.build(base).weeks[+m[1]][m[2]][+m[3]];
    return e&&+m[4]<e.sets?{week:+m[1],day:m[2],exercise:+m[3],set:+m[4],e}:null;
  }
  function validate(v){
    if(!plain(v)||v.version!==1||!plain(v.plans))throw Error('This goal training backup is not readable.');
    for(const [id,p]of Object.entries(v.plans)){
      if(!Object.hasOwn(plans,id)||!plain(p)||!Number.isInteger(p.week)||p.week<0||p.week>7||!['d1','d2'].includes(p.day)||!plain(p.done)||!plain(p.completed)||seconds(p.base)<600||seconds(p.base)>3600||seconds(p.base)===null||typeof p.baseConfirmed!=='boolean')throw Error('Invalid goal plan records.');
      for(const [k,entry]of Object.entries(p.done)){
        const at=locate(id,k,p.base);
        if(!at||!plain(entry)||['w','r','e'].some(f=>entry[f]!==undefined&&typeof entry[f]!=='string')||typeof entry.at!=='string'||isNaN(Date.parse(entry.at)))throw Error('Invalid goal set.');
        validateEntry(id,at.e,entry);
      }
      for(const [k,date]of Object.entries(p.completed)){
        if(!/^[0-7]-d[12]$/.test(k)||typeof date!=='string'||isNaN(Date.parse(date))||!Object.keys(p.done).some(s=>s.startsWith(k+'-')))throw Error('Invalid goal session.');
      }
      if(p.draft!==null&&(!plain(p.draft)||!locate(id,p.draft.key,p.base)||!plain(p.draft.values)||Object.values(p.draft.values).some(x=>typeof x!=='string'||x.length>500)))throw Error('Invalid unfinished goal set.');
    }
    return v;
  }
  function validateEntry(id,e,v){
    if(id==='run'){if(!seconds(v.w))throw Error('Enter a time as mm:ss, such as 02:12.');if(e.n==='5k time trial'&&(seconds(v.w)<600||seconds(v.w)>3600))throw Error('Enter a 5K trial between 10:00 and 60:00.');}
    else if(e.reach){if(!Number.isFinite(Number(v.w))||Number(v.w)<=0||Number(v.w)>200)throw Error('Enter a touch height between 0 and 200 inches.');}
    else if(id!=='dunk'){
      if(v.w!==''&&(!Number.isFinite(Number(v.w))||Number(v.w)<0))throw Error('Enter a weight of zero or more.');
      if(!Number.isFinite(Number(v.r))||Number(v.r)<=0||(!e.rl&&!Number.isInteger(Number(v.r))))throw Error(`Enter ${e.rl?e.rl.toLowerCase():'whole repetitions'} greater than zero.`);
    }else if((v.w||'').length>500)throw Error('Keep notes under 500 characters.');
    if(v.e&&(!Number.isFinite(Number(v.e))||Number(v.e)<1||Number(v.e)>10))throw Error('RPE must be between 1 and 10.');
    return v;
  }
  function counts(id,p,week,day){
    let total=0,logged=0;
    plans[id].build(p.base).weeks[week][day].forEach((e,ei)=>{for(let s=0;s<e.sets;s++){total++;if(p.done[key(week,day,ei,s)])logged++;}});
    return {total,logged};
  }
  function next(p){for(let w=0;w<8;w++)for(const d of ['d1','d2'])if(!p.completed[`${w}-${d}`])return {week:w,day:d};return null;}
  function defaults(id,p,k){
    const at=locate(id,k,p.base);if(!at)return {};
    if(p.draft?.key===k)return clone(p.draft.values);
    if(p.done[k])return clone(p.done[k]);
    const e=at.e;
    if(id==='run'||id==='dunk')return {w:'',e:''};
    // Test warm-ups prescribe a different load for every set.
    let rx=e.rx;
    if(e.n==='Warm-up')rx=rx.split(',')[at.set]?.trim()||rx;
    let m=rx.match(/^(Bar|\d+(?:\.\d+)?) x (\d+)$/i);
    if(m)return {w:m[1].toLowerCase()==='bar'?'45':m[1],r:m[2],e:''};
    const load=rx.match(/@ ([\d.]+)/)?.[1]||'';
    const reps=rx.match(/x (\d+)/)?.[1]||(/^1 @/.test(rx)?'1':/^1 round/.test(rx)?'1':'');
    let previous='';
    if(!e.main)for(let w=0;w<=at.week;w++)for(const d of ['d1','d2']){
      if(w===at.week&&d>at.day)continue;
      plans[id].build(p.base).weeks[w][d].forEach((other,ei)=>{if(other.n===e.n)for(let s=0;s<other.sets;s++){
        if(w===at.week&&d===at.day&&(ei>at.exercise||ei===at.exercise&&s>=at.set))continue;
        if(p.done[key(w,d,ei,s)]?.w)previous=p.done[key(w,d,ei,s)].w;
      }});
    }
    return {w:load||previous,r:reps,e:''};
  }
  function metric(id,p){
    if(id==='run')return p.baseConfirmed?`${p.base} current 5K`:'Add your time trial';
    let best=null;
    for(const [k,v]of Object.entries(p.done)){
      const at=locate(id,k,p.base);if(!at)continue;
      if(id==='dunk'&&at.e.reach)best=Math.max(best||0,Number(v.w));
      if(id==='bench'&&/^Bench press|^Third attempt|^Second attempt|^Opener/.test(at.e.n)&&Number(v.r)>0)best=Math.max(best||0,Number(v.w));
      if(id==='deadlift'&&/^Deadlift|^Test set/.test(at.e.n)&&Number(v.r)>=5)best=Math.max(best||0,Number(v.w));
    }
    if(best===null)return 'No result logged yet';
    if(id==='dunk')return `${best} in · ${best<120?`${120-best} below rim`:`${best-120} above rim`}`;
    return `${best} lb${id==='deadlift'?' × 5+':''} best logged`;
  }
  window.ForgeGoalModel=Object.freeze({blank,fresh,clone,validate,validateEntry,seconds,format,key,locate,counts,next,defaults,metric});
})();
