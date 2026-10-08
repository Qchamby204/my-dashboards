/* Pure record calculations for ongoing Life Ledger progress. */
(() => {
  'use strict';
  const REMOVED='LinkedIn Strategy',SCREEN='Screen Discipline';
  const binary=new Set(['Run / Work Out','YouTube Strategy',REMOVED,'Household Chore','Walk Hud']);
  const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  const addDays=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
  const weekStart=date=>addDays(date,-((new Date(date+'T12:00:00Z').getUTCDay()+6)%7));
  const number=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
  const plain=v=>!!v&&typeof v==='object'&&!Array.isArray(v);
  const defaults={'Read':[4,2],'Run / Work Out':[3,1],'Communication Drill':[3,1],'YouTube Strategy':[5,2],'Screen Discipline':[7,7],'Supplements':[7,7],'Sleep':[7,7],'Chambers Wealth':[5,3],'Prep For Next Day':[5,2],'Household Chore':[5,2],'Money Check-In':[5,2],'Board Work':[1,1],'Walk Hud':[5,3]};
  function goal(h,cfg,prefs){const pair=defaults[h]||[3,1];return {type:'practice',normal:pair[0],reduced:pair[1],mode:'sessions',target:cfg.chunk||1,baseline:0,due:'',...(prefs?.goals?.[h]||{})};}
  function focus(habits,prefs){return (prefs?.focus||['Run / Work Out','Read',SCREEN]).filter(h=>h!==REMOVED&&habits.includes(h)).slice(0,3);}
  function value(entry,h,cfg){
    if(h===SCREEN){const l=entry?.leisure;if((l?.screenMinutes??l?.gamingMinutes??0)>=60)return 0;if(l?.screenConfirmed)return 1;}
    const v=entry?.units?.[h]||0;return cfg?.kind==='count'||binary.has(h)?(v>0?1:0):v;
  }
  function validate(p){
    if(!plain(p))throw Error('Invalid weekly settings.');
    if(p.focus!==undefined&&(!Array.isArray(p.focus)||p.focus.length>3||new Set(p.focus).size!==p.focus.length||p.focus.some(h=>typeof h!=='string'||h===REMOVED)))throw Error('Choose up to three focus habits.');
    if(p.goals!==undefined){if(!plain(p.goals))throw Error('Invalid goal settings.');for(const g of Object.values(p.goals)){
      if(!plain(g)||!['practice','milestone','deadline'].includes(g.type)||!['sessions','amount'].includes(g.mode)||!number(g.normal)||g.normal<=0||!number(g.reduced)||g.reduced<=0||g.reduced>g.normal||!number(g.target)||g.target<=0||!number(g.baseline)||g.due!==''&&!validDate(g.due)||g.type==='deadline'&&!validDate(g.due)||g.mode==='sessions'&&(g.normal>7||g.reduced>7||!Number.isInteger(g.normal)||!Number.isInteger(g.reduced)))throw Error('Use valid targets, a smaller-week target no higher than the normal target, and a date for a deadline.');
    }}
    if(p.weeks!==undefined&&(!plain(p.weeks)||Object.entries(p.weeks).some(([date,mode])=>!validDate(date)||weekStart(date)!==date||!['normal','reduced'].includes(mode))))throw Error('Invalid week choice.');
    if(p.catchups!==undefined){if(!plain(p.catchups)||Object.keys(p.catchups).length>520)throw Error('Invalid weekly catch-up.');for(const [date,rows]of Object.entries(p.catchups)){
      if(!validDate(date)||weekStart(date)!==date||!plain(rows)||Object.keys(rows).length>100)throw Error('Invalid catch-up week.');
      for(const row of Object.values(rows))if(!plain(row)||!number(row.amount)||!Number.isInteger(row.sessions)||row.sessions<0||row.sessions>7)throw Error('Use non-negative amounts and up to seven completed days.');
    }}
    if(p.earned!==undefined&&(!Array.isArray(p.earned)||p.earned.length>1000||p.earned.some(x=>typeof x!=='string')))throw Error('Invalid saved achievements.');
    return p;
  }
  function weekly(rows,h,cfg,prefs,week,today){
    const end=addDays(week,6),cut=end<today?end:today,days=rows.filter(d=>validDate(d.date)&&d.date>=week&&d.date<=cut);
    const amount=days.reduce((s,d)=>s+value(d,h,cfg),0),sessions=days.filter(d=>value(d,h,cfg)>0).length;
    const known=days.filter(d=>value(d,h,cfg)>0||d.missed?.includes(h)||h===SCREEN&&d.leisure?.screenConfirmed).length;
    const report=prefs?.catchups?.[week]?.[h],reportedSessions=Math.max(sessions,report?.sessions||0);
    const span=week>today?0:Math.min(7,Math.round((Date.parse(cut)-Date.parse(week))/86400000)+1);
    return {week,amount:Math.max(amount,report?.amount||0),sessions:reportedSessions,datedAmount:amount,datedSessions:sessions,unlogged:Math.max(0,span-known),reported:!!report};
  }
  function total(rows,h,cfg,prefs,today){
    // Undated legacy entries count toward lasting progress, never a recent week.
    let n=rows.filter(d=>!d.date||validDate(d.date)&&d.date<=today).reduce((s,d)=>s+value(d,h,cfg),0);
    for(const week of Object.keys(prefs?.catchups||{}))if(week<=today){const w=weekly(rows,h,cfg,prefs,week,today);n+=w.amount-w.datedAmount;}
    return n;
  }
  function milestone(rows,h,cfg,prefs,today){const g=goal(h,cfg,prefs),amount=Math.max(0,total(rows,h,cfg,prefs,today)-g.baseline);return {goal:g,amount,complete:amount>=g.target,fraction:Math.min(1,amount/g.target)};}
  // XP measures recorded activity, independently of goals, dates and weekly mode.
  function xpUnit(cfg){return cfg.kind==='count'?1:(cfg.def>0?cfg.def:cfg.step>0?cfg.step:1);}
  function levelProgress(xp){
    xp=Math.max(0,Math.round(xp*100)/100);
    const cost=1000,level=Math.floor(xp/cost),into=xp-level*cost;
    return {xp,level,exact:xp/cost,into,cost,remaining:cost-into,fraction:into/cost};
  }
  function experience(amount,cfg){return levelProgress(amount/xpUnit(cfg)*100);}
  window.LedgerRhythm=Object.freeze({REMOVED,SCREEN,validDate,addDays,weekStart,goal,focus,value,validate,weekly,total,milestone,xpUnit,levelProgress,experience});
})();
