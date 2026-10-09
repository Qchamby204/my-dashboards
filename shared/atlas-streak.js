/* Saved local days only. One missed day in any rolling seven-day window. */
(()=>{
  const KEY='atlas.streaks.hidden.v1',DAY=86400000;
  function localDay(date=new Date()){return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');}
  function dayNumber(day){if(typeof day!=='string'||!/^\d{4}-\d\d-\d\d$/.test(day))return null;const [y,m,d]=day.split('-').map(Number),n=Date.UTC(y,m-1,d)/DAY;return new Date(n*DAY).toISOString().slice(0,10)===day?n:null;}
  function compute(savedDays,today=localDay()){
    const now=dayNumber(today);if(now===null)return {current:0,longest:0,forgiven:0};
    const days=[...new Set((savedDays||[]).map(dayNumber).filter(n=>n!==null&&n<=now))].sort((a,b)=>a-b);
    let count=0,longest=0,last=null,lastMiss=null,forgiven=0;
    for(const day of days){const gap=last===null?0:day-last;
      if(last===null||gap>2||gap===2&&lastMiss!==null&&day-1-lastMiss<7){count=1;lastMiss=null;forgiven=0;}
      else{count++;if(gap===2){lastMiss=day-1;forgiven++;}}
      last=day;longest=Math.max(longest,count);
    }
    // Today remains open. Yesterday may use grace, but opening a page earns no day.
    const trailing=last===null?Infinity:now-last;
    const current=trailing<=1||trailing===2&&(lastMiss===null||now-1-lastMiss>=7)?count:0;
    return {current,longest,forgiven:current?forgiven+(trailing===2?1:0):0};
  }
  function hidden(){try{return localStorage.getItem(KEY)==='true';}catch{return false;}}
  function apply(){if(typeof document!=='undefined'&&document.documentElement?.dataset)document.documentElement.dataset.atlasStreaks=hidden()?'hidden':'visible';}
  function setHidden(value){try{const raw=String(!!value);localStorage.setItem(KEY,raw);if(localStorage.getItem(KEY)!==raw)return false;}catch{return false;}apply();if(typeof window!=='undefined')window.dispatchEvent(new Event('atlas-streak-preference'));return true;}
  const rule='A saved completion counts for its local day; one missed day in any seven-day window is forgiven, and forgiven days do not add to the count.';
  const badge=(count,label='Saved days')=>'<span class="atlas-streak"><span class="atlas-streak-value">◷ '+count+'</span><span class="atlas-streak-label">'+label+'</span><details class="atlas-streak-info"><summary aria-label="Streak rule">i</summary><p>'+rule+'</p></details></span>';
  globalThis.AtlasStreak=Object.freeze({KEY,compute,hidden,setHidden,apply,rule,badge,localDay});if(typeof window!=='undefined')window.AtlasStreak=globalThis.AtlasStreak;apply();
  if(typeof window!=='undefined')window.addEventListener?.('storage',e=>{if(e.key===KEY||e.key===null)apply();});
})();
