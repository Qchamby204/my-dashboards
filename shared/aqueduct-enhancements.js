/* Existing Aqueduct interface: drafts, honest saving, recoverable edits and scoped statement review. */
(() => {
  'use strict';
  const records=window.AqueductRecords, app=document.getElementById('app');
  const clone=o=>JSON.parse(JSON.stringify(o));
  const make=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
  const button=(text,fn)=>{const n=make('button',text,'btn line');n.type='button';n.onclick=fn;return n;};
  let importTicket=0,reviewPage=0,reviewQuery='',reviewMonth=S.audit?.ym||'',reviewBucket='all';
  const toolsBar=make('aside',null,'aqueduct-tools'),notice=make('p');notice.id='aqueduct-status';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
  const retry=button('Retry saving',()=>{save();status();}),reload=button('Reload saved data',()=>confirmAction('Reload saved data?','This discards changes that have not saved in this tab. Download a backup first to keep them.','Reload',()=>location.reload()));
  toolsBar.append(button('Backup',backup),button('Restore',pickBackup),retry,reload,notice);app.before(toolsBar);
  function status(){
    const blocked=records.blocked,unsaved=records.unsaved;
    notice.textContent=blocked?'Saved data could not be read. Editing is paused. Download the saved data for recovery, or restore a valid backup.':unsaved?'Changes have not saved. Retry saving or download a backup before closing. If another tab changed this dashboard, back up this tab, then reload saved data.':'Saved on this device';
    toolsBar.classList.toggle('aqueduct-warning',blocked||unsaved);toolsBar.classList.toggle('aqueduct-blocked',blocked);retry.hidden=blocked||!unsaved;reload.hidden=!blocked&&!unsaved;app.inert=blocked;
  }
  function download(value,name){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'})),a=make('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
  function payload(){return {app:'the-aqueduct',version:1,exportedAt:new Date().toISOString(),state:clone(S)};}
  function backup(){try{download(records.blocked?{app:'aqueduct-recovery',version:1,records:records.recovery()}:payload(),'aqueduct-'+iso(new Date())+(records.blocked?'-recovery':'')+'.json');toast('Backup prepared. Save it in Files or Downloads.');}catch{toast('Could not prepare the backup. Please retry.');}}
  function confirmAction(title,body,label,fn){
    const previous=document.activeElement,dialog=make('dialog',null,'aqueduct-dialog'),heading=make('h2',title),actions=make('div',null,'aqueduct-actions');heading.id='aqueduct-confirm-title';dialog.setAttribute('aria-labelledby',heading.id);
    actions.append(button('Cancel',()=>dialog.close()),button(label,()=>{dialog.close();fn();}));dialog.append(heading,make('p',body),actions);
    dialog.addEventListener('close',()=>{dialog.remove();if(previous?.isConnected)previous.focus();});document.body.append(dialog);dialog.showModal();
  }
  function parseBackup(pack){if(pack?.app!=='the-aqueduct'||pack.version!==1)throw Error('Choose an Aqueduct version 1 backup.');const value=records.validate(pack.state,true);return {...clone(DEF),...value,fi:{...clone(DEF.fi),...value.fi},book:{...clone(DEF.book),...value.book}};}
  async function importBackup(file){
    if(!file)return;const ticket=++importTicket;
    try{if(file.size>10*1024*1024)throw Error('Choose a backup smaller than 10 MB.');const next=parseBackup(JSON.parse(await file.text()));if(ticket!==importTicket)return;
      confirmAction('Restore Aqueduct?',`${next.expenses.length} expenses, ${next.goals.length} goals and ${next.hhs.length} household entries will replace the data on this device. The backup also replaces settings, accounts, reviews and unfinished entries. Use Backup first to keep your current data.`,'Restore backup',()=>{
        if(ticket!==importTicket)return;importTicket++;
        if(!records.persist(next,true)){status();toast('Restore could not be saved. Current data is still in this tab. Retry Restore.');return;}
        S=next;UNDO=[];LASTSIG=null;draftType=S._drafts?.householdType||'ext';resetReview();render();toast('Backup restored on this device.');
      });
    }catch(e){toast(e instanceof SyntaxError?'This file is not valid JSON.':e.message||'Could not read the backup.');}
  }
  function pickBackup(){const file=make('input');file.type='file';file.accept='.json,application/json';file.onchange=()=>importBackup(file.files?.[0]);file.click();}
  function drafts(){return S._drafts||(S._drafts={});}
  function saveScenario(){
    const name=document.getElementById('aq-scenario-name')?.value.trim();
    if(!name){toast('Name this comparison first.');document.getElementById('aq-scenario-name')?.focus();return;}
    const rows=S.scenarios||(S.scenarios=[]);
    if(rows.length>=8){toast('Delete a saved comparison before adding another. You can keep up to eight.');return;}
    const row={id:uid(),name:name.slice(0,60),savedAt:new Date().toISOString(),income:takeHomeMo(),bills:expensesMo(),debt:debtMo(),savings:savingsMo(),available:spendMo()};
    if(![row.income,row.bills,row.debt,row.savings,row.available].every(Number.isFinite)){toast('Check the plan amounts before saving a comparison.');return;}
    rows.push(row);save();render();toast('Comparison saved on this device.');
  }
  function resetReview(){reviewMonth=S.audit?.ym||'';reviewPage=0;reviewQuery='';reviewBucket='all';}
  function removeRecord(collection,id,label){
    const index=S[collection].findIndex(x=>x.id===id);if(index<0)return;const removed=clone(S[collection][index]);S[collection].splice(index,1);save();render();
    toast(label+' removed','Undo',()=>{if(S[collection].some(x=>x.id===id))return;S[collection].splice(Math.min(index,S[collection].length),0,removed);save();render();});
  }
  function clearHouseholds(){if(!S.hhs.length)return;confirmAction('Clear the household ledger?','This removes logged household entries. Settings and your unfinished entry stay.','Clear ledger',()=>{
    const removed=clone(S.hhs);S.hhs=[];save();render();toast('Ledger cleared','Undo',()=>{for(const row of removed)if(!S.hhs.some(x=>x.id===row.id))S.hhs.push(row);save();render();});
  });}
  function addHousehold(){
    const amount=toNum(document.getElementById('hhAmt')?.value),date=document.getElementById('hhDate')?.value;
    if(!Number.isFinite(amount)||amount<=0){toast('Enter a positive amount.');document.getElementById('hhAmt')?.focus();return;}
    if(!records.validDay(date)){toast('Choose a valid date.');document.getElementById('hhDate')?.focus();return;}
    S.hhs.push({id:uid(),d:date,amt:amount,type:draftType});drafts().householdAmount='';drafts().householdDate=iso(new Date());
    const ok=save();render();toast(ok?'Household added to the book.':'Household retained in this tab. Retry saving.');
  }
  function analyze(text){
    if(text.length>5*1024*1024){toast('Use a statement smaller than 5 MB.');return false;}
    const result=parseStatement(text),error=document.getElementById('audErr');
    if(result.err||result.txns.length>10000){if(error)error.textContent=result.err||'Use an export with no more than 10,000 transactions. No rows have been imported.';return false;}
    const counts=Object.create(null);for(const t of result.txns)counts[t.ym]=(counts[t.ym]||0)+1;
    const month=Object.keys(counts).filter(x=>x!=='?').sort((a,b)=>counts[b]-counts[a]||b.localeCompare(a))[0]||'?';
    S.audit={ym:month,txns:result.txns,skipped:result.skipped||0,importedAt:iso(new Date())};drafts().statement='';resetReview();const ok=save();render();
    toast(result.txns.length+' transactions read.'+(ok?'':' Retry saving to keep this review.'));return true;
  }
  async function importStatement(file){
    if(!file)return;const ticket=++importTicket;
    try{if(file.size>5*1024*1024)throw Error('Use a statement smaller than 5 MB.');const text=await file.text();if(ticket!==importTicket)return;
      drafts().statement=text;save();const field=document.getElementById('audText');if(field)field.value=text;analyze(text);
    }catch(e){toast(e.message||'Could not read the statement.');}
  }
  function monthRows(){if(!S.audit)return [];const months=[...new Set(S.audit.txns.map(x=>x.ym))];if(!months.includes(reviewMonth))reviewMonth=months.filter(m=>m!=='?').sort().reverse()[0]||'?';return S.audit.txns.filter(t=>t.ym===reviewMonth);}
  function matchingRows(){return monthRows().filter(t=>(reviewBucket==='all'||t.b===reviewBucket)&&t.desc.toLowerCase().includes(reviewQuery.trim().toLowerCase()));}
  function review(){
    let h='<section class="panel aqueduct-review"><div class="aqueduct-actions"><h2>Statement check</h2>'+(S.audit?'<button class="btn line" id="audClear">New check</button>':'')+'</div>';
    if(!S.audit)return h+'<label for="audText">Statement CSV</label><p>Paste a bank CSV export with its headers, or choose a file. Processing stays on this device. For an Amount column, negative values are spending and positive values are money in.</p><textarea id="audText" rows="6" placeholder="Date,Description,Debit,Credit">'+esc(drafts().statement||'')+'</textarea><div class="aqueduct-actions"><button class="btn" id="audRun">Check statement</button><button class="btn line" id="audPick">From file</button><input id="audFile" type="file" accept=".csv,.txt,text/csv" hidden></div><p id="audErr" role="alert"></p></section>';
    const all=S.audit.txns,rows=monthRows(),totals=auditTotals(rows),months=[...new Set(all.map(t=>t.ym))].sort().reverse();
    h+='<p>'+all.length+' transactions retained. Choose one month to review against your current plan.</p><label for="aq-month">Review month</label><select id="aq-month">'+months.map(m=>'<option value="'+esc(m)+'"'+(m===reviewMonth?' selected':'')+'>'+esc(m==='?'?'Undated transactions':m)+'</option>').join('')+'</select>';
    const undated=all.filter(t=>t.ym==='?').length;
    if(undated)h+='<p class="aqueduct-warning">'+undated+' transactions have no recognized date. Review them under Undated transactions; they are excluded from dated months. Numeric dates use month/day/year unless the first number exceeds 12.</p>';
    if(S.audit.skipped)h+='<p class="aqueduct-warning">'+S.audit.skipped+' rows were not recognized as transactions. Check the source export before relying on these totals.</p>';
    if(reviewMonth!=='?'&&setupDone())for(const [bucket,plan]of [['committed',expensesMo()],['debt',debtMo()],['forward',savingsMo()],['enjoy',Math.max(0,spendMo())]])h+='<div class="aqueduct-total"><span>'+BUCKET_META[bucket][0]+'</span><span>'+fmt(totals[bucket])+' / '+fmt(plan)+' planned</span></div>';
    h+='<p>Money in: '+fmt(totals.income)+'. '+rows.length+' transactions in this view.</p><div class="aqueduct-filters"><label>Find a transaction<input id="aq-search" type="search" value="'+esc(reviewQuery)+'" placeholder="Merchant or description"></label><label>Category<select id="aq-bucket"><option value="all">All categories</option>'+Object.entries(BUCKET_META).map(([k,v])=>'<option value="'+k+'"'+(reviewBucket===k?' selected':'')+'>'+v[0]+'</option>').join('')+'</select></label></div>';
    const matches=matchingRows();reviewPage=Math.min(reviewPage,Math.max(0,Math.ceil(matches.length/50)-1));
    h+='<p id="aq-results" role="status">'+matches.length+' matching transactions</p><div class="aqueduct-transactions">';
    for(const t of matches.slice(reviewPage*50,reviewPage*50+50))h+='<div class="aqueduct-transaction"><div><strong>'+esc(t.desc)+'</strong><span>'+esc(t.d||'Undated')+' · '+fmt(t.amt)+(t.inflow?' · money in':'')+'</span></div><label class="aqueduct-category">Category<select data-aq-tx="'+t.id+'" aria-label="Category for '+esc(t.desc)+'">'+Object.entries(BUCKET_META).map(([k,v])=>'<option value="'+k+'"'+(t.b===k?' selected':'')+'>'+v[0]+'</option>').join('')+'</select></label></div>';
    h+='</div>';if(matches.length>50)h+='<div class="aqueduct-actions"><button class="btn line" id="aq-prev"'+(!reviewPage?' disabled':'')+'>Previous</button><span>Page '+(reviewPage+1)+' of '+Math.ceil(matches.length/50)+'</span><button class="btn line" id="aq-next"'+((reviewPage+1)*50>=matches.length?' disabled':'')+'>Next</button></div>';
    const recurring=findRecurring(all);if(recurring.length){h+='<details><summary>Repeated charges to review</summary><p>Similar charges can be separate purchases. Review the frequency and monthly amount after adding one to the plan.</p>';for(const r of recurring)h+='<button class="btn line" data-addrec="'+esc(r.key)+'" data-recname="'+esc(r.desc.slice(0,60))+'" data-recamt="'+r.avg+'">Add expense: '+esc(r.desc.slice(0,40))+' · '+fmt(r.avg)+' per charge</button>';h+='</details>';}
    return h+'<p>Category changes apply to this transaction and future imports for the same merchant. '+Object.keys(S.rules).length+' saved rules.</p></section>';
  }
  const originalWire=wire,originalRender=render,originalToast=toast;
  toast=function(message,label,action){originalToast(message+(records.unsaved?' Changes are not saved yet.':''),label,action);};
  wire=function(){
    originalWire();
    const bind=(id,fn)=>{const n=document.getElementById(id);if(n)n.onclick=fn;};
    for(const n of app.querySelectorAll('[data-income-mode]')) n.onclick=()=>{S.incomeMode=n.dataset.incomeMode;save();render();document.getElementById('aq-income')?.focus();};
    const income=document.getElementById('aq-income');
    if(income) income.onchange=()=>{const amount=toNum(income.value);if(amount!==''&&Number.isFinite(amount)&&amount>=0){S.actualIncomeMo=amount;save();render();}else{toast('Enter a valid amount of zero or more.');income.value=S.actualIncomeMo??'';income.focus();}};
    bind('aq-save-scenario',saveScenario);
    for(const n of app.querySelectorAll('[data-delete-scenario]')) n.onclick=()=>removeRecord('scenarios',n.dataset.deleteScenario,'Comparison');
    for(const [id,key]of [['hhAmt','householdAmount'],['hhDate','householdDate']]){const n=document.getElementById(id);if(!n)continue;n.value=drafts()[key]??(id==='hhDate'?iso(new Date()):'');n.setAttribute('aria-label',id==='hhAmt'?'Household assets':'Date opened');n.addEventListener('input',()=>{drafts()[key]=n.value;save();});n.addEventListener('change',()=>{drafts()[key]=n.value;save();});}
    for(const [id,type]of [['segExt','ext'],['segRef','ref']]){bind(id,()=>{draftType=type;drafts().householdType=type;save();render();});document.getElementById(id)?.setAttribute('aria-pressed',String(type===draftType));}
    bind('hhAdd',addHousehold);bind('clearLedger',clearHouseholds);
    for(const [attr,collection,label]of [['dele','expenses','Expense'],['deld','debts','Debt'],['delg','goals','Goal'],['dela','accounts','Account'],['delhh','hhs','Household'],['delspend','spends','Spend']])for(const n of app.querySelectorAll('[data-'+attr+']')){const id=n.dataset[attr],item=S[collection].find(x=>x.id===id);n.setAttribute('aria-label','Delete '+(item?.name||label));n.onclick=()=>removeRecord(collection,id,label);}
    for(const n of app.querySelectorAll('[data-delcat]')){n.setAttribute('aria-label','Remove category '+n.dataset.delcat);n.onclick=()=>{const category=n.dataset.delcat;S.cats=cats().filter(c=>c!==category);if(!S.cats.length)S.cats=['Other'];save();render();toast('Category removed','Undo',()=>{if(!S.cats.includes(category))S.cats.push(category);save();render();});};}
    for(const n of app.querySelectorAll('[data-addrec]'))n.onclick=()=>{const id=uid();S.expenses.push({id,name:n.dataset.recname,cat:guessCat(n.dataset.recname),amt:+n.dataset.recamt,freq:'monthly'});S.tab='plan';save();render();toast('Expense added. Review its amount and frequency.','Undo',()=>{S.expenses=S.expenses.filter(x=>x.id!==id);save();render();});};
    const text=document.getElementById('audText');if(text)text.oninput=()=>{importTicket++;drafts().statement=text.value;save();};
    bind('audRun',()=>analyze(document.getElementById('audText')?.value||''));
    const file=document.getElementById('audFile');if(file)file.onchange=()=>{const selected=file.files?.[0];file.value='';importStatement(selected);};
    bind('audClear',()=>confirmAction('Start a new statement check?','The current check will be cleared. Your plan and category rules stay.','New check',()=>{const removed=clone(S.audit);S.audit=null;drafts().statement='';save();render();toast('Check cleared','Undo',()=>{if(S.audit){toast('A newer statement check is open. Back it up before restoring the earlier check.');return;}S.audit=removed;resetReview();save();render();});}));
    const month=document.getElementById('aq-month');if(month)month.onchange=()=>{reviewMonth=month.value;S.audit.ym=reviewMonth;reviewPage=0;save();render();document.getElementById('aq-month')?.focus();};
    const bucket=document.getElementById('aq-bucket');if(bucket)bucket.onchange=()=>{reviewBucket=bucket.value;reviewPage=0;render();document.getElementById('aq-bucket')?.focus();};
    const search=document.getElementById('aq-search');if(search)search.oninput=()=>{reviewQuery=search.value;const caret=search.selectionStart;reviewPage=0;render();const next=document.getElementById('aq-search');next.focus();next.setSelectionRange(caret,caret);};
    bind('aq-prev',()=>{reviewPage--;render();document.getElementById('aq-next')?.focus();});bind('aq-next',()=>{reviewPage++;render();document.getElementById('aq-prev')?.focus();});
    for(const select of app.querySelectorAll('[data-aq-tx]'))select.onchange=()=>{const tx=S.audit?.txns.find(t=>t.id===select.dataset.aqTx);if(!tx||!BUCKET_META[select.value])return;tx.b=select.value;S.rules[merchKey(tx.desc)]=tx.b;save();render();app.querySelector('[data-aq-tx="'+tx.id+'"]')?.focus();};
    for(const n of app.querySelectorAll('[data-tab]')){const action=n.onclick;n.onclick=()=>{importTicket++;const tab=n.dataset.tab;action();app.querySelector('.tabbar [data-tab="'+tab+'"]')?.focus();};if(n.tagName==='BUTTON')n.setAttribute('aria-current',n.dataset.tab===(S.tab||'pay')?'page':'false');}
    for(const n of app.querySelectorAll('[data-gotogoal],[data-open],[data-tab]'))if(n.tagName!=='BUTTON'){n.setAttribute('role','button');n.tabIndex=0;n.onkeydown=e=>{if(e.target!==n||!['Enter',' '].includes(e.key))return;e.preventDefault();n.click();};}
    for(const n of app.querySelectorAll('input,select,textarea'))if(!n.getAttribute('aria-label')&&!n.id&&!n.closest('label'))n.setAttribute('aria-label',(n.dataset.k||n.dataset.s||n.dataset.fi||n.dataset.b||n.placeholder||'Value').replace(/([A-Z])/g,' $1'));
    const nav=app.querySelector('.tabbar'),active=nav?.querySelector('[aria-current="page"]');if(nav&&active)nav.scrollLeft=Math.max(0,active.offsetLeft-(nav.clientWidth-active.offsetWidth)/2);
    const undo=document.getElementById('undoBtn');if(undo)undo.disabled=!UNDO.length;
  };
  render=function(){if(toolsBar.parentNode)toolsBar.remove();originalRender();const bar=app.querySelector('.appbar');if(bar)bar.after(toolsBar);else app.before(toolsBar);status();};
  window.AqueductUI=Object.freeze({status,backup,payload,parseBackup,importBackup,importStatement,analyze,review,monthRows,matchingRows,removeRecord,clearHouseholds,addHousehold});
  window.addEventListener('beforeunload',e=>{if(records.unsaved){e.preventDefault();e.returnValue='';}});
  save();render();
})();
