/* Life Ledger reward hotfix: keep Level Up / Achievement cards visible until dismissed. */
(()=>{
  'use strict';
  const root=document.documentElement;
  if(root.dataset.atlasApp!=='life-ledger')return;

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
