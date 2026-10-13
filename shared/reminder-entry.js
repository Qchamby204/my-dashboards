(()=>{
 const names={'life-map.html':'life-map','the-library.html':'library','life-ledger.html':'ledger','workout-forge.html':'forge','communication-trainer.html':'communicator','the-chef.html':'chef'};
 const file=location.pathname.split('/').pop(),app=names[file];if(!app)return;
 const link=document.createElement('a');link.href='reminders.html?app='+app;link.textContent='Reminders';link.setAttribute('aria-label','Manage reminders');
 const footer=document.createElement('div');footer.style.cssText='text-align:center;padding:24px 16px calc(130px + env(safe-area-inset-bottom));font:inherit;';link.style.cssText='display:inline-flex;align-items:center;min-height:44px;padding:10px 20px;border:1px solid currentColor;border-radius:999px;color:inherit;text-decoration:none;';footer.append(link);document.body.append(footer);
 if(['library','ledger'].includes(app)){
  const details=document.createElement('details');details.dataset.reminderCompletion='';details.style.cssText='text-align:left;max-width:600px;margin:18px auto 0;padding:16px;border:1px solid currentColor;border-radius:20px;overflow-wrap:anywhere;';footer.append(details);
  const script=document.createElement('script');script.src='shared/reminder-completion.js?v=45c16e32e795';document.head.append(script);
 }
})();
