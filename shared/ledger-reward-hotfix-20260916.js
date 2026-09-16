/* Life Ledger reward hotfix: keep Level Up / Achievement cards visible until dismissed. */
(()=>{
  'use strict';
  const root=document.documentElement,source=document.currentScript?.src;
  if(root.dataset.atlasApp!=='life-ledger')return;

  // One-time requested season reset. This stays separate from the reward logic,
  // but loading it here lets existing Life Ledger pages pick up the migration
  // without rewriting the large original dashboard file.
  if(source){
    const seasonReset=document.createElement('script');
    seasonReset.src=new URL('ledger-season-reset-20260915.js?v=1',source).href;
    seasonReset.defer=true;
    document.head.appendChild(seasonReset);
  }

  const style=document.createElement('style');
  style.id='ledger-reward-hotfix-20260916';
  style.textContent=`
    @keyframes ledgerRewardStable{
      0%{opacity:0;transform:scale(.88)}
      45%{opacity:1;transform:scale(1.025)}
      100%{opacity:1;transform:scale(1)}
    }
    html[data-atlas-app="life-ledger"] .levelup{
      animation:ledgerRewardStable .45s cubic-bezier(.2,.8,.2,1) both!important;
      opacity:1;
    }
  `;
  document.head.appendChild(style);

  const protect=card=>{
    if(!card||card.dataset.rewardStable==='1')return;
    card.dataset.rewardStable='1';
    // iOS can retain the final frame of the legacy animation. After the entrance
    // has played, remove animation state entirely and pin the card visible.
    setTimeout(()=>{
      if(!card.isConnected)return;
      card.style.setProperty('animation','none','important');
      card.style.setProperty('opacity','1','important');
      card.style.setProperty('transform','scale(1)','important');
    },600);
  };

  const scan=()=>document.querySelectorAll('.levelup').forEach(protect);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',scan,{once:true});else scan();
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
})();
