(()=>{
  'use strict';
  if(document.documentElement.dataset.atlasApp!=='life-ledger')return;
  const MARKER='lifeledger:migration:season-20260915:v1';
  const FROM={start:'2026-09-08',end:'2026-12-31'};
  const TO={start:'2026-09-15',end:'2026-12-31'};
  let attempts=0;
  const marked=()=>{try{return localStorage.getItem(MARKER)==='done';}catch{return false;}};
  const mark=()=>{try{localStorage.setItem(MARKER,'done');}catch{/* The season itself is still persisted by Life Ledger. */}};
  async function apply(){
    if(marked())return;
    const api=window.LedgerDays;
    if(!api){if(++attempts<200)setTimeout(apply,50);return;}
    const season=api.season;
    if(season?.start===FROM.start&&season?.end===FROM.end){
      try{if(await api.setSeason(TO))mark();}catch{/* Leave unmarked so the next open can retry. */}
      return;
    }
    // Respect any season the user already changed manually.
    mark();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',apply,{once:true});else apply();
  window.addEventListener('pageshow',apply);
})();
