export function budgetMinutes(raw){
  if(typeof raw!=='string'||!raw.trim())throw Error('Enter the hours available. Use 0 if you want no planned time.');
  const hours=Number(raw),minutes=hours*60,rounded=Math.round(minutes);
  if(!Number.isFinite(hours)||hours<0||hours>168)throw Error('Choose between 0 and 168 hours for this week.');
  if(Math.abs(minutes-rounded)>0.00000001)throw Error('Choose a budget in whole minutes, such as 2 or 2.5 hours.');
  return rounded;
}
export function createBudgetUI({api,getData,getWeek,load,blocked,error,toast,esc,duration}){
  const $=s=>document.querySelector(s);let draft=null,saving=false;
  function baseline(){const w=getData().week;return {week_start:getWeek(),revision:w?.revision??0,worked:w?.worked||'',change:w?.change||'',hours:String((w?.capacity??600)/60)};}
  function freeze(){for(const id of ['#capacity','#save-capacity','#discard-capacity'])if($(id))$(id).disabled=saving;}
  function panel(minutes){
    const saved=getData().week,capacity=saved?.capacity??600,hours=draft?.hours??String(capacity/60);
    return `<div class="budget"><div><strong>${duration(minutes)} planned <span class="muted">/ ${duration(capacity)} ${saved?'saved':'default'} budget</span></strong><p>${minutes>capacity?`${duration(minutes-capacity)} over this budget. Move or resize a commitment.`:'Keep space for the parts of your week that are not on this list.'}</p><progress value="${Math.min(minutes,Math.max(capacity,1))}" max="${Math.max(capacity,1)}" aria-label="Planned time against saved weekly budget"></progress></div><label>Hours available<input id="capacity" type="number" min="0" max="168" step="any" value="${esc(hours)}" aria-describedby="budget-draft-state budget-error"${saving?' disabled':''}></label><button type="button" class="secondary" id="save-capacity"${saving?' disabled':''}>Save budget</button></div><div class="budget-draft-actions"><span id="budget-draft-state" class="small" role="status">${saving?'Saving or refreshing…':draft?'Unsaved budget':saved?'Saved budget':'Default budget · Save to keep it'}</span><button type="button" class="text-button" id="discard-capacity"${saving?' disabled':''}>Discard & reload budget</button></div><p id="budget-error" class="form-error" role="alert"></p>`;
  }
  document.addEventListener('input',e=>{
    if(e.target.id!=='capacity'||saving)return;
    draft={...(draft||baseline()),hours:e.target.value};$('#budget-draft-state').textContent='Unsaved budget';$('#budget-error').textContent='';
  });
  document.addEventListener('click',async e=>{
    const target=e.target.closest('#save-capacity,#discard-capacity');if(!target)return;
    if(saving)return;
    if(blocked()){error('Finish or close your other editor before changing the weekly budget.');return;}
    if(target.id==='discard-capacity'){
      draft=null;saving=true;freeze();$('#budget-error').textContent='';$('#budget-draft-state').textContent='Loading saved budget…';
      try{const refreshed=await load();$('#capacity').value=String((getData().week?.capacity??600)/60);$('#budget-draft-state').textContent=refreshed?(getData().week?'Saved budget':'Default budget · Save to keep it'):'Last loaded budget';if(!refreshed)$('#budget-error').textContent='Refresh failed. Showing the last loaded budget. Try Discard & reload again when connected.';}
      catch(err){$('#capacity').value=String((getData().week?.capacity??600)/60);$('#budget-draft-state').textContent='Last loaded budget';$('#budget-error').textContent=err.message;}
      finally{saving=false;freeze();}return;
    }
    draft=draft||{...baseline(),hours:$('#capacity').value};
    let capacity;try{capacity=budgetMinutes(draft.hours);if(draft.week_start!==getWeek())throw Error('Return to the original week or discard this budget before saving.');}
    catch(err){$('#budget-error').textContent=err.message;$('#budget-draft-state').textContent='Unsaved budget';return;}
    const {hours,...snapshot}=draft;saving=true;freeze();$('#budget-error').textContent='';$('#budget-draft-state').textContent='Saving budget…';
    let saved=false;
    try{
      await api('/api/week','PUT',{...snapshot,capacity});draft=null;saved=true;
      const refreshed=await load();$('#budget-draft-state').textContent=refreshed?'Saved budget':'Budget saved · Refresh needed';
      if(!refreshed)$('#budget-error').textContent='The budget was saved, but the latest workspace could not load. Use Discard & reload to refresh it.';
      toast('Weekly time budget saved.');
    }catch(err){$('#budget-error').textContent=saved?'The budget was saved, but refreshing failed. Use Discard & reload to load the latest workspace.':err.message+' Your budget draft is kept.';$('#budget-draft-state').textContent=saved?'Budget saved · Refresh needed':'Unsaved budget';}
    finally{saving=false;freeze();}
  });
  return {panel,get dirty(){return !!draft;},get saving(){return saving;}};
}
