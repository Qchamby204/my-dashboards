/* Presentation helpers. Completion callers invoke feedback after a verified save. */
(()=>{
  if(window.AtlasExperience)return;
  const mark='<svg class="atlas-mark" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="currentColor"/><path d="M12 29 Q24 21 36 29" fill="none" stroke="var(--neo-surface,#efeae3)" stroke-width="3" stroke-linecap="round"/></svg>';
  function complete(control){if(!control)return;control.classList.add('atlas-completed');control.dataset.atlasCompletion='saved';control.setAttribute('aria-live','polite');
    if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return;
    const badge=document.createElement('span');badge.className='atlas-completion-mark';badge.innerHTML=mark;control.append(badge);setTimeout(()=>badge.remove(),900);
  }
  window.AtlasExperience=Object.freeze({mark,complete});
  function decorate(){
    document.querySelectorAll('.workflow-empty,.empty,.empty-state,.quiet-message').forEach(n=>{if(!n.querySelector('.atlas-mark'))n.insertAdjacentHTML('afterbegin',mark);});
    const app=document.documentElement.dataset.atlasApp;
    const selector={'life-ledger':'.ledger-save-row','workout-forge':'.fg-detail-title,.fg-card','courier':'#player','atlas-os':'.today-work','library':'.focus-card','communication-trainer':'.atlas-goal-question'}[app];
    if(selector){const panels=[...document.querySelectorAll(selector)].filter(n=>n.getClientRects().length);document.querySelectorAll('.atlas-signature').forEach(n=>{if(n!==panels[0])n.classList.remove('atlas-signature');});panels[0]?.classList.add('atlas-signature');}
  }
  function ready(){decorate();let pending=false;new MutationObserver(()=>{if(pending)return;pending=true;requestAnimationFrame(()=>{pending=false;decorate();});}).observe(document.body,{childList:true,subtree:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
