/* Life Ledger simplification: binary daily habits, calibrated goals, and a quieter dashboard. */
(()=>{
  'use strict';
  if(document.documentElement.dataset.atlasApp!=='life-ledger'||window.LedgerSimplify20260916)return;

  const MARKER='lifeledger:migration:tap-habits-20260916:v1';
  const DRAFTKEY='lifeledger:drafts:v1';
  const TAP_CONFIG={
    'Run / Work Out':{
      unit:'days',kind:'count',step:1,def:1,goal:60,chunk:5,noun:'training week',
      outcome:'60 training days (about 4 a week)',
      crit:'Tap once after completing a workout in The Forge. One completed training day counts, regardless of how many sessions or exercises you did.'
    },
    'YouTube Strategy':{
      unit:'days',kind:'count',step:1,def:1,goal:75,chunk:5,noun:'YouTube week',
      outcome:'75 YouTube strategy days (about 5 a week)',
      crit:'Tap once when you meaningfully completed the YouTube strategy for the day: publishing, filming, scripting, editing, or materially advancing the next video. One completion max per day.'
    },
    'LinkedIn Strategy':{
      unit:'days',kind:'count',step:1,def:1,goal:75,chunk:5,noun:'LinkedIn week',
      outcome:'75 LinkedIn strategy days (about 5 a week)',
      crit:'Tap once when you completed the LinkedIn strategy for the day: meaningful comments, connections, posting, direct-message follow-up, or a relationship-building coffee chat. One completion max per day.'
    },
    'Household Chore':{
      unit:'days',kind:'count',step:1,def:1,goal:75,chunk:5,noun:'household week',
      outcome:'75 household-care days (about 5 a week)',
      crit:'Tap once after completing at least one meaningful household chore or home-maintenance task. One completion max per day.'
    },
    'Walk Hud':{
      unit:'days',kind:'count',step:1,def:1,goal:75,chunk:5,noun:'week walking Hudson',
      outcome:'75 Hudson walk days (about 5 a week)',
      crit:'Tap once after a purposeful walk with Hudson. Distance no longer affects the score; the day either counts or it does not.'
    }
  };
  const TAP_HABITS=Object.keys(TAP_CONFIG);
  const HIDDEN_SECTIONS=['forecast','pace','oracle','outcomes'];
  let attempts=0;

  const marked=()=>{try{return localStorage.getItem(MARKER)==='done';}catch{return false;}};
  const mark=()=>{try{localStorage.setItem(MARKER,'done');}catch{/* The Ledger records themselves remain authoritative. */}};
  const hasOwn=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

  function normalizeUnits(units){
    if(!units||typeof units!=='object')return false;
    let changed=false;
    for(const key of TAP_HABITS){
      if(!hasOwn(units,key))continue;
      const next=Number(units[key])>0?1:0;
      if(units[key]!==next){units[key]=next;changed=true;}
    }
    return changed;
  }

  function patchConfig(){
    for(const [key,cfg] of Object.entries(TAP_CONFIG)){
      if(DEFAULT_HCFG[key])Object.assign(DEFAULT_HCFG[key],cfg);
    }
    rebuildModel();
  }

  function reviseAchievement(name,desc,test){
    const achievement=ACHV.find(item=>item.name===name);
    if(!achievement)return;
    achievement.desc=desc;
    achievement.test=test;
  }

  function patchAchievements(){
    reviseAchievement('On the Record','Complete 10 YouTube strategy days',d=>(d.habit['YouTube Strategy']?.total||0)>=10);
    reviseAchievement('Content Engine','Complete 40 YouTube strategy days',d=>(d.habit['YouTube Strategy']?.total||0)>=40);
    reviseAchievement('Ten Sessions In','Complete 10 training days',d=>(d.habit['Run / Work Out']?.total||0)>=10);
    reviseAchievement('Iron Forged','Complete 50 training days',d=>(d.habit['Run / Work Out']?.total||0)>=50);
    reviseAchievement('Rainmaker','Complete 10 LinkedIn strategy days',d=>(d.habit['LinkedIn Strategy']?.total||0)>=10);
    reviseAchievement('Pipeline Full','Complete 30 LinkedIn strategy days',d=>(d.habit['LinkedIn Strategy']?.total||0)>=30);
    reviseAchievement('Momentum','Complete 50 LinkedIn strategy days',d=>(d.habit['LinkedIn Strategy']?.total||0)>=50);
    reviseAchievement('Relentless','Complete 70 LinkedIn strategy days',d=>(d.habit['LinkedIn Strategy']?.total||0)>=70);
    reviseAchievement('House in Order','Complete 50 household-care days',d=>(d.habit['Household Chore']?.total||0)>=50);
    reviseAchievement('With Hudson','Walk Hudson on 25 days',d=>(d.habit['Walk Hud']?.total||0)>=25);
  }

  function stripClutter(){
    if(typeof app==='undefined'||!app)return;
    for(const key of HIDDEN_SECTIONS){
      const trigger=app.querySelector('[data-act="section"][data-key="'+key+'"]');
      trigger?.closest('.panel')?.remove();
      if(typeof state!=='undefined'&&state.openSections)delete state.openSections[key];
    }
  }

  async function migrateStoredValues(){
    if(marked())return;
    let daysChanged=false,goalsChanged=false,draftsChanged=false;
    for(const day of state.days||[])daysChanged=normalizeUnits(day.units)||daysChanged;
    normalizeUnits(state.draft);

    for(const key of TAP_HABITS){
      if(state.goals&&hasOwn(state.goals,key)){delete state.goals[key];goalsChanged=true;}
    }

    const savedDrafts=window.LedgerDays?.drafts;
    if(savedDrafts?.days){
      for(const draft of Object.values(savedDrafts.days))draftsChanged=normalizeUnits(draft?.units)||draftsChanged;
    }

    const writes=[];
    if(daysChanged)writes.push(Promise.resolve(store.set(KEY,JSON.stringify(state.days))));
    if(goalsChanged)writes.push(Promise.resolve(store.set(GOALKEY,JSON.stringify(state.goals))));
    if(draftsChanged)writes.push(Promise.resolve(store.set(DRAFTKEY,JSON.stringify(savedDrafts))));
    try{
      const results=await Promise.all(writes);
      if(results.every(result=>result!==false))mark();
    }catch{/* Leave unmarked so the next open retries. */}
  }

  function install(){
    if(window.LedgerSimplify20260916)return;
    if(!window.LedgerDays||typeof state==='undefined'||typeof DEFAULT_HCFG==='undefined'||typeof rebuildModel!=='function'||typeof compute!=='function'||typeof render!=='function'||typeof ACHV==='undefined'||typeof store==='undefined'){
      if(++attempts<240)setTimeout(install,50);
      return;
    }

    patchConfig();
    patchAchievements();

    // Count habits are binary by definition. Normalize copies before scoring so an old
    // backup containing quantities can never inflate the new daily-completion goals.
    const baseCompute=compute;
    compute=function(allDays,goals){
      const normalized=(allDays||[]).map(day=>{
        const copy={...day,units:{...(day.units||{})}};
        normalizeUnits(copy.units);
        return copy;
      });
      return baseCompute(normalized,goals);
    };

    // Any draft loaded from old history is converted before it can be shown or saved.
    const baseRender=render;
    render=function(){
      normalizeUnits(state.draft);
      const result=baseRender.apply(this,arguments);
      stripClutter();
      return result;
    };

    window.LedgerSimplify20260916=Object.freeze({
      habits:[...TAP_HABITS],
      goals:Object.fromEntries(Object.entries(TAP_CONFIG).map(([key,cfg])=>[key,cfg.goal])),
      hiddenSections:[...HIDDEN_SECTIONS]
    });

    normalizeUnits(state.draft);
    for(const key of TAP_HABITS)if(state.goals&&hasOwn(state.goals,key))delete state.goals[key];
    render();
    migrateStoredValues();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
  window.addEventListener('pageshow',()=>{if(!window.LedgerSimplify20260916)install();else stripClutter();});
})();
