'use strict';
(() => {
  const E=Engine;
  const root=document.getElementById('app');
  const dialog=document.getElementById('dialog');
  const notice=document.getElementById('toast');
  const chatFile=document.getElementById('chat-update-file');
  const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=n=>n===null||n===undefined?'—':E.dollars(n);
  const inputMoney=n=>n===null||n===undefined?'':(n/100).toFixed(2);
  const isoMonth=new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'short',timeZone:'UTC'});
  const isoDay=new Intl.DateTimeFormat('en-CA',{month:'short',day:'numeric',timeZone:'UTC'});
  const monthShort=new Intl.DateTimeFormat('en-CA',{month:'short',timeZone:'UTC'});
  const dateLabel=d=>d&&E.validDate(d)?isoDay.format(new Date(d+'T00:00:00Z')):'—';
  const monthLabel=d=>d&&E.validDate(d.slice(0,7)+'-01')?isoMonth.format(new Date(d.slice(0,7)+'-01T00:00:00Z')):'—';
  const pick=(x,...keys)=>Object.fromEntries(keys.map(k=>[k,x[k]]));
  const byId=(items,id)=>items.find(x=>x.id===id);
  const listTypes=['Chequing','Savings','Credit card','Line of credit or loan','Other'];
  const frequency=['Once','Weekly','Biweekly','Monthly','Quarterly','Annual'];
  const allViews=['Overview','Import & review','Spending','Bills','Debt & goals','Settings','Recommendations','Cash plan','Monthly snapshot','Cash history','Monthly changes','Change driver','Monthly costs'];
  const storageMessage='Browser storage is unavailable or full. Changes are in this window. Download an encrypted backup before closing it.';
  const PAGE=32;
  const idleLimit=10*60_000;
  let S=null, session=null, lastStored=null, serialized=null, storageProblem=false, memoryOnly=false, sample=false, saving=false;
  let tab=allViews[0], toastTimer=0, lastActivity=0, staging=[], files=[], selectedFile='', postingWindow='', ledgerPage=0;
  let ledger={filter:'Review',account:'',month:'',category:'',project:'',search:''};
  let month=E.month(E.today()), settingsJump='', preview=null, lockAfterSave=false;
  let chatUpdate=null, chatRead=0;
  let spendingTab='Categories', cashMonth='', debtExtra=25000;
  let categoryDetail='', categoryPeriod='', categoryPage=0, scenarioDraft={}, changesMonth='', changeSelection=null;
  let reviewView='Quick review', reviewType='All', reviewMonth='', reviewPicker='', quickUndo=null;
  const setAside=new Set();
  let repaymentMode='Debt first', cashPlanFromDebt=false;
  let cashScenario={incomeCut:15,incomeDelay:7,account:'',covered:false};
  const canonical='https://qchamby204.github.io/my-dashboards/aqueduct-household.html';
  const hosted=location.origin+location.pathname===canonical;
  const localFile=window.top===window && (hosted || location.protocol==='file:' ||
    (['http:','https:'].includes(location.protocol)&&['localhost','127.0.0.1','[::1]'].includes(location.hostname)));
  const tabIcons={
    Home:'M2 10 12 2l10 8M5 9v12h14V9M10 21v-6h4v6',
    Spending:'M12 3a9 9 0 1 0 9 9h-9zm3-1v7h7a8 8 0 0 0-7-7z',
    Bills:'M4 7h16v14H4zM4 11h16M8 4v5m8-5v5M8 15h3m2 0h3m-8 3h3',
    Debt:'M3 19h18M5 15l5-5 4 2 5-6m-5 0h5v5',
    Review:'M9 5H5v15h14V5h-4M9 3h6v4H9zm-1 11 3 3 5-6',
    Recommendations:'M12 2l1.9 5.5L19 10l-5.1 2.4L12 18l-1.9-5.6L5 10l5.1-2.5L12 2zM19 15v6m-3-3h6M4 4v4M2 6h4',
    Settings:'M4 6h16M4 12h16M4 18h16M8 4v4m8 2v4m-6 2v4'
  };
  const icon=path=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+path+'"/></svg>';
  const atlasLink=hosted?'<a class="atlas-return" href="./">Atlas</a>':'';
  const brand='<div class="brand"><span class="brand-mark" aria-hidden="true"></span>Aqueduct</div>';
  const val=(form,key)=>String(form.get(key)??'').trim();
  const dollarsField=(form,key,{optional=false,min=0}={})=>{
    const raw=val(form,key);
    if(optional&&!raw) return null;
    const n=E.money(raw);
    if(n===null||n<min) throw new Error('Check the '+key.toLowerCase().replace(/_/g,' ')+' amount.');
    return n;
  };
  const numberField=(form,key,min,max,optional=false)=>{
    const raw=val(form,key);
    if(optional&&!raw) return null;
    const n=Number(raw);
    if(!raw||!Number.isFinite(n)||n<min||n>max) throw new Error('Check '+key.toLowerCase().replace(/_/g,' ')+'.');
    return n;
  };
  const dateField=(form,key,optional=false)=>{
    const d=val(form,key);
    if(optional&&!d) return '';
    if(!E.validDate(d)) throw new Error('Check the '+key.toLowerCase().replace(/_/g,' ')+'.');
    return d;
  };
  const titleField=(form,key='name')=>{
    const result=val(form,key);
    if(!result) throw new Error('Enter '+key.replace(/_/g,' ')+'.');
    return result;
  };
  const alias=(id)=>byId(S.accounts,id)?.name||'Unassigned';
  const projectName=(id)=>byId(S.projects,id)?.name||'Unassigned project';
  const billKind=b=>b.direction!=='Bill'?b.direction:b.variable?'Variable estimate':'Bill';
  const readFile=async file=>{
    const bytes=new Uint8Array(await file.arrayBuffer());
    if(bytes[0]===0xff&&bytes[1]===0xfe) return new TextDecoder('utf-16le').decode(bytes);
    if(bytes[0]===0xfe&&bytes[1]===0xff) return new TextDecoder('utf-16be').decode(bytes);
    try { return new TextDecoder('utf-8',{fatal:true}).decode(bytes); }
    catch { return new TextDecoder('windows-1252').decode(bytes); }
  };
  const f=(name,value='',type='text',extra='')=>'<input name="'+H(name)+'" type="'+H(type)+'" value="'+H(value)+'" '+extra+'>';
  const opts=(values,selected='')=>values.map(option=>{
    const [value,label]=Array.isArray(option)?option:[option,option];
    return '<option value="'+H(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+H(label)+'</option>';
  }).join('');
  const select=(name,values,selected='',extra='')=>'<select name="'+H(name)+'" '+extra+'>'+opts(values,selected)+'</select>';
  const field=(label,control,hint='',wide=false)=>'<label class="field'+(wide?' wide':'')+'"><span>'+H(label)+'</span>'+control+(hint?'<small>'+H(hint)+'</small>':'')+'</label>';
  const check=(label,name,on=false)=>'<label class="check"><input type="checkbox" name="'+H(name)+'"'+(on?' checked':'')+'>'+H(label)+'</label>';
  const btn=(label,action,id='',cls='',aria='')=>'<button type="button" class="btn '+cls+'" data-act="'+H(action)+'"'+(id?' data-id="'+H(id)+'"':'')+aria+'>'+H(label)+'</button>';
  const link=(label,action,id='')=>'<button type="button" class="link-button" data-act="'+H(action)+'" data-id="'+H(id)+'">'+H(label)+'</button>';
  const pill=(v,type='')=>'<span class="pill '+type+'">'+H(v)+'</span>';
  const panel=(title,body,caption='',actions='')=>'<section class="panel"><div class="panel-title"><div><h2>'+H(title)+'</h2>'+(caption?'<p>'+H(caption)+'</p>':'')+'</div>'+actions+'</div>'+body+'</section>';
  const head=(title,caption,actions='')=>'<header class="page-head"><div><h1>'+H(title)+'</h1><p>'+H(caption)+'</p></div>'+actions+'</header>';
  const banner=(body,style='')=>'<div class="banner '+style+'"><p>'+body+'</p></div>';
  const no=(text)=>'<div class="empty">'+H(text)+'</div>';
  const table=(headers,rows)=>'<div class="table-wrap"><table><thead><tr>'+headers.map(x=>'<th scope="col"'+(x.startsWith('$')?' class="money"':'')+'>'+H(x.replace(/^\$/,''))+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
  const cell=(body,cls='')=>'<td'+(cls?' class="'+cls+'"':'')+'>'+body+'</td>';
  const dateCell=d=>cell(H(d),'numeral');
  const amountCell=(n,negative=false)=>cell(H(money(n)), 'money'+(negative&&n<0?' negative':''));
  const row=(...cells)=>'<tr>'+cells.join('')+'</tr>';
  const accountOptions=(predicate=()=>true,blank='Select an account')=>[['',blank],...S.accounts.filter(predicate).map(a=>[a.id,a.name])];
  const projectOptions=()=>[['','Choose a project'],...S.projects.map(p=>[p.id,p.name])];
  const categoryOptions=()=>[...new Set([...E.categories,...Object.keys(S.targets),...E.ledgerRows(S.transactions).filter(t=>['Spending','Reimbursement','Income','Financing','Savings'].includes(t.kind)).map(t=>t.category)])].filter(Boolean);
  const cash=a=>['Chequing','Savings'].includes(a.type);
  const note=(text,err=false)=>{
    clearTimeout(toastTimer);
    notice.textContent=text;
    notice.className='toast'+(err?' error':'');
    notice.hidden=false;
    toastTimer=setTimeout(()=>{notice.hidden=true;},err?9500:5200);
  };
  const download=(text,name,mime)=>{
    const url=URL.createObjectURL(new Blob([text],{type:mime}));
    const a=document.createElement('a');
    a.href=url; a.download=name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1800);
  };
  function shareFile(text,name,mime){
    if(typeof File!=='function'||typeof navigator.share!=='function'||typeof navigator.canShare!=='function')return null;
    try {
      const file=new File([text],name,{type:mime});
      return navigator.canShare({files:[file]})?file:null;
    } catch { return null; }
  }
  function openDialog(title,body,submit,saveLabel='Save',additional='') {
    dialog.innerHTML='<div class="dialog-title"><h2 id="dialog-title">'+H(title)+'</h2>'+btn('Close','dialog-close','','mini')+'</div><form class="stack" autocomplete="off">'+body+'<div class="form-error" role="alert" hidden></div><div class="actions end">'+additional+btn('Cancel','dialog-close','')+'<button class="btn primary" type="submit">'+H(saveLabel)+'</button></div></form>';
    const form=dialog.querySelector('form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();
      const message=form.querySelector('.form-error');
      const button=form.querySelector('[type=submit]');
      message.hidden=true; button.disabled=true;
      try {
        await submit(new FormData(form),form);
        dialog.close();
      } catch(error) {
        message.textContent=error.message;
        message.hidden=false;
      } finally {
        button.disabled=false;
      }
    });
    if(!dialog.open) dialog.showModal();
    return form;
  }
  function confirmation(title,detail,label,run) {
    return openDialog(title,'<p>'+H(detail)+'</p>',run,label);
  }
  function welcome() {
    const stored=Vault.get();
    const blocked=!localFile||!crypto.subtle;
    const pass=f('password','','password','required autocomplete="'+(stored?'current-password':'new-password')+'"');
    const chatAction=blocked?'':chatUpdate?
      banner('Chat update ready. '+(stored?'Unlock':'Create')+' your ledger to apply it.') :
      '<div class="chat-start"><p>Drop statements into chat. Apply the prepared update here.</p>'+btn('Apply chat update','chat-update','','primary')+'</div>';
    root.innerHTML='<main class="welcome"><section class="panel">'+brand+'<h1>'+ (stored?'Unlock your ledger':'Household cash flow')+'</h1>'+
      (blocked?banner('Open Aqueduct directly from Atlas in a browser with encryption enabled.', 'warning'):'')+
      chatAction+'<form id="vault-form" class="stack" autocomplete="off">'+field('Passphrase',pass,stored?'':'Keep this passphrase somewhere safe. Use at least 12 characters.')+
      (stored?'':field('Confirm passphrase',f('confirm','','password','required autocomplete="new-password"')))+
      '<div class="form-error" role="alert" hidden></div><div class="actions"><button class="btn'+(chatUpdate?' primary':'')+'" type="submit"'+(blocked?' disabled':'')+'>'+(stored?'Unlock':'Create encrypted ledger')+'</button>'+
      (chatUpdate?btn('Cancel update','cancel-chat-update'):'')+'</div></form>'+
      '<details class="subtle section-gap"><summary>Other options</summary><div class="actions">'+
      (blocked?'':btn('Open encrypted backup','restore'))+btn('Try fictional data','demo')+btn('Check this device','device-check')+'</div></details>'+
      '<p class="small section-gap">The encrypted ledger stays on this device.'+(hosted?' '+atlasLink:'')+'</p></section></main>';
    root.querySelector('#vault-form').addEventListener('submit',async event=>{
      event.preventDefault();
      if(blocked)return;
      const form=event.target;
      const data=new FormData(form);
      const error=form.querySelector('.form-error');
      const button=form.querySelector('[type=submit]');
      button.disabled=true; error.hidden=true;
      try {
        const password=data.get('password');
        if(stored) enter(await Vault.open(stored,password),stored,false);
        else {
          if(password.length<12||password!==data.get('confirm')) throw new Error('Use a matching passphrase of at least 12 characters.');
          if(Vault.get()) throw new Error('A ledger was created in another window. Reload and unlock it.');
          const unlocked=await Vault.create(E.empty(),password);
          const blob=await Vault.seal(unlocked.state,unlocked.secret,unlocked.salt);
          saveToBrowser(blob,null);
          enter(unlocked,blob,false);
          if(!chatUpdate)note(storageProblem?storageMessage:'Ledger created.',storageProblem);
        }
        await applyChatUpdate();
      } catch(e){error.textContent=e.message;error.hidden=false;}
      finally {button.disabled=false;}
    });
  }
  function deviceCheck() {
    const storageTest='aqueduct-check-'+E.id();
    let hasStorage=false;
    if(localFile) {
      try {
        localStorage.setItem(storageTest,'ok');
        hasStorage=localStorage.getItem(storageTest)==='ok';
      } catch {}
      finally {try{localStorage.removeItem(storageTest);}catch{}}
    }
    const encryption=localFile&&Boolean(crypto.subtle);
    const checks=[
      ['Supported browser address',localFile?'Available':'Open the dashboard directly from Atlas'],
      ['Device encryption support',encryption?'Available':'Unavailable in this viewer'],
      ['Encrypted ledger storage',hasStorage?'Available':'Use encrypted backups to keep changes between sessions']
    ];
    return openDialog('Check this device',
      '<ul class="list">'+checks.map(([label,status])=>'<li><div>'+H(label)+'</div><strong>'+H(status)+'</strong></li>').join('')+'</ul>'+
      (encryption&&hasStorage?'<p>Try the fictional demo. You can also check that your browser can save a test file.</p>':
        '<p>Open Aqueduct directly from Atlas in Safari or Chrome. Encrypted backups can preserve your work if browser storage is unavailable.</p>'),
      ()=>{},'Done',encryption?btn('Test file download','test-download','',''):'');
  }
  function testDownload() {
    download('Aqueduct download check\nNo household data is in this file.\n','Aqueduct-Download-Check.txt','text/plain;charset=utf-8');
    note('Check your Downloads for the test file.');
  }
  function enter(unlocked,blob,demo,memory=false) {
    S=unlocked.state;
    session=unlocked;
    sample=demo;
    memoryOnly=memory;
    serialized=blob;
    lastStored=demo||memory?null:Vault.get();
    storageProblem=Boolean(memory||(!demo&&lastStored!==serialized));
    lastActivity=Date.now();
    categoryDetail='';categoryPeriod='';scenarioDraft={};repaymentMode='Debt first';changesMonth='';changeSelection=null;
    cashScenario={incomeCut:15,incomeDelay:7,account:'',covered:false};
    tab=allViews[0];
    reviewView='Quick review'; reviewType='All'; reviewMonth=''; reviewPicker=''; quickUndo=null; setAside.clear();
    spendingTab='Categories'; cashMonth=''; debtExtra=25000;
    cashScenario={incomeCut:15,incomeDelay:7,account:'',covered:false};
    repaymentMode='Debt first';
    month=E.month(E.today());
    render();
    window.scrollTo(0,0);
  }
  function lock(force=false) {
    if(saving&&!force){lockAfterSave=true;return;}
    if(!force&&!sample&&(staging.length||files.length||storageProblem)) {
      confirmation('Lock ledger?',(storageProblem?'Download an encrypted backup before locking if you need to keep your changes.':'Files and staged rows that haven’t been approved will be cleared.'),'Lock',()=>lock(true));
      return;
    }
    S=null; session=null; serialized=null; lastStored=null; sample=false; memoryOnly=false; preview=null; files=[]; staging=[];
    chatUpdate=null; chatRead++;
    quickUndo=null; reviewPicker=''; setAside.clear();
    ledger={filter:'Review',account:'',month:'',category:'',project:'',search:''}; ledgerPage=0; postingWindow='';
    if(dialog.open) dialog.close();
    clearTimeout(toastTimer); notice.hidden=true;
    welcome();
  }
  function saveToBrowser(blob,expected) {
    if(Vault.get()!==expected) throw new Error('This ledger changed in another window. Download a backup if needed, then reload before making further changes.');
    try {
      Vault.put(blob);
      if(Vault.get()!==blob) throw new Error('Storage could not be verified.');
      storageProblem=false;
    } catch {
      storageProblem=true;
    }
  }
  async function write(change) {
    if(saving) throw new Error('A save is already in progress. Try again in a moment.');
    if(!S) throw new Error('Unlock the ledger before saving.');
    saving=true;
    try {
      const next=structuredClone(S);
      change(next);
      next.updated=new Date().toISOString();
      if(!sample) {
        const blob=await Vault.seal(next,session.secret,session.salt);
        if(!memoryOnly) {
          saveToBrowser(blob,lastStored);
          if(!storageProblem) lastStored=blob;
        }
        serialized=blob;
      }
      S=next;
      render();
      if(storageProblem) note(storageMessage,true);
    } finally {
      saving=false;
      if(lockAfterSave) {lockAfterSave=false;lock(true);}
    }
  }
  function chooseChatUpdate() {
    if(!localFile||!crypto.subtle)return;
    if(sample)return note('Exit the fictional demo before applying your chat update.');
    chatFile.value='';
    chatFile.click();
  }
  chatFile.addEventListener('change',async()=>{
    const selected=chatFile.files?.[0];
    if(!selected||!localFile||!crypto.subtle||sample)return;
    const current=++chatRead;
    try{
      if(selected.size>30*1024*1024)throw new Error('Ask for a smaller Aqueduct update in chat.');
      const update=ChatUpdate.read(await selected.text());
      if(current!==chatRead)return;
      chatUpdate=update;
      if(S)await applyChatUpdate();
      else welcome();
    }catch(error){
      if(current===chatRead)note(error.message,true);
    }
  });
  async function applyChatUpdate() {
    if(!chatUpdate||!S||sample)return;
    const update=chatUpdate;
    if(S.chatUpdates?.some(x=>x.id===update.id)){
      chatUpdate=null;
      note('This chat update is already in your ledger.');
      return;
    }
    let result;
    try{
      await write(next=>{result=ChatUpdate.apply(next,update,E.today());});
      if(chatUpdate===update)chatUpdate=null;
      if(S){
        go(allViews[0]);
        note(storageProblem?storageMessage:chatUpdateSummary(result),storageProblem);
      }
    }catch(error){
      if(chatUpdate===update)chatUpdate=null;
      note(error.message,true);
    }
  }
  function chatUpdateSummary(result) {
    const details=[result.added+' transaction'+(result.added===1?'':'s')+' added'];
    if(result.duplicates)details.push(result.duplicates+' duplicate'+(result.duplicates===1?'':'s')+' skipped');
    if(result.corrected)details.push(result.corrected+' corrected');
    if(result.linked)details.push(result.linked+' transfers linked');
    if(result.unmatched)details.push(result.unmatched+' rows had no unique source match');
    if(result.review)details.push(result.review+' for review');
    return 'Chat update applied · '+details.join(' · ');
  }
  function go(view) {
    if(view!=='Cash plan')cashPlanFromDebt=false;
    tab=view; settingsJump='';
    render();
    window.scrollTo(0,0);
  }
  window.addEventListener('storage',event=>{
    if(event.key===Vault.storageKey&&S&&!sample&&!memoryOnly&&event.newValue!==lastStored) note('The saved ledger changed in another window. Reload this page before editing.',true);
  });
  document.addEventListener('pointerdown',()=>{lastActivity=Date.now();});
  document.addEventListener('keydown',()=>{lastActivity=Date.now();});
  setInterval(()=>{
    if(S&&!sample&&!storageProblem&&Date.now()-lastActivity>idleLimit) lock(true);
  },20_000);
  document.addEventListener('visibilitychange',()=>{
    if(!document.hidden&&S&&!sample&&!storageProblem&&Date.now()-lastActivity>idleLimit) lock(true);
  });
  window.addEventListener('beforeunload',event=>{
    if(S&&!sample&&(storageProblem||staging.length||files.length)) {event.preventDefault();event.returnValue='';}
  });

  function render() {
    if(!S){welcome();return;}
    const views=[overview,imports,spending,bills,debt,settings,recommendations,cashPlan,monthlySnapshot,cashHistory,monthlyChanges,changeDriver,monthCostsView];
    const tabs=[['Home','Overview'],['Spending','Spending'],['Bills','Bills'],['Debt','Debt & goals'],['Review','Import & review'],['Recommendations','Recommendations']];
    const homeDetail=['Cash plan','Cash history','Monthly changes','Change driver','Monthly costs'].includes(tab);
    const active=tab==='Monthly snapshot'?'Debt & goals':homeDetail?'Overview':tab;
    root.innerHTML='<header class="top"><div class="top-inner"><div class="brand-row">'+brand+'<div class="actions"><span class="small">'+(sample?'Fictional demo':'Household')+'</span>'+
      atlasLink+'<button type="button" class="btn mini quiet settings-shortcut" data-act="nav" data-id="Settings" aria-label="Settings"'+(tab==='Settings'?' aria-current="page"':'')+'>'+icon(tabIcons.Settings)+'</button>'+
      (sample?btn('Exit demo','lock','','mini quiet'):btn('Lock','lock','','mini quiet'))+'</div></div><nav class="nav" aria-label="Dashboard">'+
      tabs.map(([label,v])=>'<button type="button" class="nav-tab" data-act="nav" data-id="'+H(v)+'"'+(v===active?' aria-current="page"':'')+'>'+icon(tabIcons[label])+(v==='Recommendations'?'<span class="wide-label">Recommendations</span><span class="short-label" aria-hidden="true">Advice</span><span class="screen-reader compact-label">Recommendations</span>':'<span>'+H(label)+'</span>')+'</button>').join('')+'</nav></div></header><main id="main">'+
      (storageProblem?banner(H(storageMessage)+' '+link('Download encrypted backup','backup'),'warning'):'')+
      views[allViews.indexOf(tab)]()+'</main>';
    if(tab==='Monthly snapshot')bindMonthlyScenario();
    if(tab==='Monthly changes')root.querySelector('[name=changes-month]')?.addEventListener('change',event=>{changesMonth=event.target.value;render();root.querySelector('[name=changes-month]')?.focus();});
    if(tab==='Cash history') {
      root.querySelector('[name=cash-month]')?.addEventListener('change',event=>{cashMonth=event.target.value;render();root.querySelector('[name=cash-month]')?.focus();});
    }
    if(tab===allViews[1]) bindImport();
    if(tab===allViews[2]||tab==='Monthly costs') root.querySelector('[name=month-view]')?.addEventListener('change',event=>{if(/^\d{4}-\d{2}$/.test(event.target.value)){month=event.target.value;render();root.querySelector('[name=month-view]')?.focus({preventScroll:true});}});
    if(tab==='Cash plan') {
      const form=root.querySelector('#cash-scenario');
      form?.addEventListener('submit',event=>{
        event.preventDefault();
        try {
          const data=new FormData(form);
          cashScenario={incomeCut:numberField(data,'income_cut',0,100),incomeDelay:numberField(data,'income_delay',0,45),
            account:val(data,'source_account'),covered:data.has('costs_covered')?cashCheckKey(E.paydayPosition(S,E.today()),E.today()):''};
          render();
          const result=document.getElementById('cash-scenario-result');
          result?.focus();
          result?.scrollIntoView({block:'start'});
        } catch(error) {note(error.message,true);}
      });
      drawRunway();
    }
    if(settingsJump) document.getElementById(settingsJump)?.scrollIntoView({block:'start'});
  }
  function spendingPie(report) {
    const groups=operatingCostKeys.map((key,i)=>({key,amount:report.totals[key],colour:['#597694','#9a6a35','#6f9586'][i]}));
    if(!report.available||report.ordinary<=0||groups.some(x=>x.amount<0))
      return no('See category amounts for the recorded costs and net credits.');
    let angle=0;
    const slices=groups.map(x=>{
      const end=angle+x.amount/report.ordinary*100;
      const slice=x.colour+' '+angle+'% '+end+'%';
      angle=end;
      return slice;
    });
    return `<div class="pie-layout"><div class="pie-ring" aria-hidden="true" style="--slices:${slices.join(',')}">
      <div><strong class="money">${money(report.ordinary)}</strong><small>Operating costs</small></div></div>
      <ul class="pie-legend">${groups.map(x=>`<li><span class="pie-dot" aria-hidden="true" style="--swatch:${x.colour}"></span>
        ${link(monthCostLabels[x.key],'month-cost-drill',x.key)}<strong class="money">${money(x.amount)}</strong>
        <small>${Math.round(x.amount/report.ordinary*100)}%</small></li>`).join('')}</ul></div>`;
  }
  const compactCAD=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',notation:'compact',maximumFractionDigits:1});
  const chartMoney=value=>compactCAD.format(value/100);
  const signedMoney=value=>value>0?'+'+money(value):money(value);
  const bar=(amount,max,tone)=>'<span class="amount-track" aria-hidden="true"><span class="'+tone+'" style="width:'+Math.min(100,Math.max(0,amount/Math.max(max,1)*100))+'%"></span></span>';
  function cashBar(label,amount,max,tone,action='',id='') {
    return '<li><div class="amount-caption">'+(action?link(label,action,id):'<span>'+H(label)+'</span>')+
      '<strong class="money">'+money(amount)+'</strong></div>'+bar(amount,max,tone)+'</li>';
  }
  function cashBuckets(label,rows,max,tone,period) {
    return '<div class="flow-bucket"><h3>'+H(label)+'</h3>'+
      (rows.length?'<ul class="amount-list">'+rows.map(r=>cashBar(r.name,r.amount,max,tone,'cash-bucket',JSON.stringify([period,tone,r.name]))).join('')+
      '':
      no('No recorded '+(tone==='in'?'deposits':'withdrawals')+'.'))+'</div>';
  }
  function chartMonths(records,selected) {
    const max=Math.max(1,...records.flatMap(r=>[r.inflow,r.outflow]));
    return `<div class="chart-key"><span class="key-in">Money in</span><span class="key-out">Money out</span></div>
      <div class="flow-columns">
        ${records.map(r=>{
          const label=monthShort.format(new Date(r.period+'-01T00:00:00Z'));
          const caption=monthLabel(r.period)+': '+(r.available?money(r.inflow)+' in, '+money(r.outflow)+' out'+(r.covered?'':', partial coverage'):'no data');
          return `<button type="button" class="flow-month${r.covered?'':' partial'}" data-act="cash-period" data-id="${r.period}"
            aria-pressed="${selected===r.period}" aria-label="${H(caption)}" title="${H(caption)}">
            <span class="flow-columns-pair" aria-hidden="true">
              <i style="--size:${r.available?r.inflow/max*100:0}%"></i>
              <i style="--size:${r.available?r.outflow/max*100:0}%"></i>
            </span><span>${H(label)}</span></button>`;
        }).join('')}
      </div><p class="small chart-caption">Striped bars indicate partial statements.</p>`;
  }
  const arrow='<span class="chart-arrow" aria-hidden="true">›</span>';
  const jump=(title,value,action,id,detail='',unit='')=>`<button type="button" class="dashboard-jump" data-act="${action}" data-id="${H(id)}">
    <span><strong>${H(title)}</strong>${detail?`<small>${H(detail)}</small>`:''}</span><b>${H(value)}${unit?`<small>${H(unit)}</small>`:''}</b>${arrow}</button>`;
  function plannedSnapshot(p,now) {
    const pay=p.upcoming.find(E.isPaycheque);
    const cutoff=pay?.date||E.add(now,14);
    const open=p.overdue.concat(p.upcoming.filter(e=>e.date<=cutoff)).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.direction==='Income')-Number(b.direction==='Income'));
    const due=open.filter(e=>e.direction==='Bill');
    const outgoing=E.sum(due,e=>e.forecastAmount||0);
    const amountPending=due.filter(e=>e.forecastAmount===null).length;
    return {pay,cutoff,open,due,outgoing,amountPending};
  }
  function forecastCard(p,now) {
    const actionable=p.unassigned.filter(e=>!e.key.startsWith('flex/')).slice(0,4);
    const funded=p.headroom!==null;
    const warning=(!funded?'<div class="forecast-gap"><strong>Cash available is still unconfirmed</strong>'+
      '<p>Enter the missing balances, payment dates, or funding accounts below to see the projected low point.</p></div>':'')+
      (p.stale.length?'<p class="small">Cash balances last checked before today. Update them to account for any recent activity.</p>':'')+
      (p.shortfalls.length?'<p class="small cash-alert">'+p.shortfalls.length+' scheduled payment'+(p.shortfalls.length===1?' could':'s could')+' take a funding account below its buffer.</p>':'');
    const missing=[...p.missing.map(a=>link('Add balance for '+a.name,'account-edit',a.id)),
      ...(p.unassigned.some(e=>e.key.startsWith('flex/'))?[link('Choose a forecast account for the spending allowance','config','cash')]:[]),
      ...actionable.map(e=>link(e.name+' · check amount or funding','occurrence',e.key)),
      ...p.missingLoanPayments.slice(0,4).map(l=>link(l.name+' · confirm payment schedule','loan-edit',l.id))];
    const tasks=missing.length?'<ul class="list forecast-tasks">'+missing.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'';
    const balances=p.verified.length?'<details class="subtle section-gap"><summary>Cash balances used</summary><ul class="list">'+p.verified.map(a=>
      '<li><div>'+link(a.name,'account-edit',a.id)+'<small class="small">Entered '+H(a.balanceDate)+'</small></div><strong class="money">'+money(p.starting[a.id])+'</strong></li>').join('')+'</ul></details>':'';
    return panel('Forecast inputs',warning+tasks+balances,'Next '+S.config.window+' days · includes scheduled cash activity',btn('Balances','account-settings','','mini quiet'));
  }
  function timingAction(position) {
    const {plan,buffer,pay}=position;
    const account=plan.missing[0]||plan.stale[0];
    const funding=plan.unassigned.find(e=>!e.key.startsWith('flex/'));
    if(account)return {label:'Update cash balance',action:'account-edit',id:account.id,why:'Refresh '+account.name+' to use today’s cash.'};
    if(!plan.verified.length)return {label:'Set up cash accounts',action:'account-settings',id:'',why:'Choose which accounts pay your bills.'};
    if(funding)return {label:'Check upcoming payment',action:'occurrence',id:funding.key,why:funding.name+' needs an amount or funding account.'};
    if(plan.missingLoanPayments.length){const loan=plan.missingLoanPayments[0];return {label:'Add debt payment date',action:'loan-bill',id:loan.id,why:loan.name+' is missing a payment schedule.'};}
    if(!buffer||plan.unassigned.some(e=>e.key.startsWith('flex/')))return {label:'Set cash assumptions',action:'config',id:'cash',why:!buffer?'Enter a cash buffer to measure what’s available.':'Choose an account for everyday spending.'};
    if(!pay)return {label:'Open payday plan',action:'nav',id:'Cash plan',why:'Add a paycheque date to plan through payday.'};
    if(position.gap||position.accountGap)return {label:'Open payday plan',action:'nav',id:'Cash plan',why:position.gap?
      money(position.gap)+' below the household buffer.':'A bill account falls below its own buffer.'};
    return {label:'Open payday plan',action:'nav',id:'Cash plan',why:confirmedCashCosts(position)?'':plan.livingReserve?'Confirm everyday costs before using this estimate.':'Confirm remaining everyday costs.'};
  }
  function paydayTimeline(position) {
    const {plan,pay,cutoff,buffer}=position;
    const start=plan.points[0].date;
    const range=Math.max(1,E.distance(start,cutoff));
    const span=573;
    const x=date=>12+E.distance(start,date)/range*span;
    const min=Math.min(buffer,plan.low), max=Math.max(buffer,...plan.points.map(point=>point.total));
    const y=total=>108-(total-min)/Math.max(1,max-min)*89;
    const drawn=plan.points.map((point,i)=>i?`H${x(point.date)}V${y(point.total)}`:`M${x(point.date)} ${y(point.total)}`).join('');
    const path=drawn+'H'+(12+span);
    const billPoints=plan.points.filter(p=>p.event?.direction==='Bill'&&!p.event.key.startsWith('flex/'))
      .sort((a,b)=>b.event.forecastAmount-a.event.forecastAmount).slice(0,2).sort((a,b)=>a.date.localeCompare(b.date));
    const paydayLabel=pay?'Payday':'Window ends';
    return `<figure class="cash-timeline">
      <div class="cash-timeline-values">
        <span>Projected low <b>${money(plan.low)}</b> <small>${H(dateLabel(plan.lowDate))}</small></span>
        <span>Buffer <b>${money(buffer)}</b></span>
      </div>
      <svg viewBox="0 0 600 122" preserveAspectRatio="none" aria-hidden="true">
        <path class="cash-floor-line" d="M12 ${y(buffer)}H${12+span}"/>
        <path class="cash-forecast-line" d="${path}"/>
        ${billPoints.map(p=>`<path class="cash-bill-mark" d="M${x(p.date)-4} ${y(p.total)}h8 M${x(p.date)} ${y(p.total)-4}v8"/>`).join('')}
        <path class="cash-low-mark" d="M${x(plan.lowDate)-5} ${y(plan.low)-5}h10v10h-10Z"/>
      </svg>
      <figcaption><span>Today · ${H(dateLabel(start))}</span><span>${paydayLabel} · ${H(dateLabel(cutoff))}</span></figcaption>
      ${billPoints.length?`<ul class="cash-timeline-bills" aria-label="Major bills in this window">${billPoints.map(({date,event})=>
        `<li><span>${H(dateLabel(date))} · ${link(event.name,'occurrence',event.key)}</span><b class="money">${money(event.forecastAmount)}</b></li>`).join('')}</ul>`:''}
    </figure>`;
  }
  function cashPositionCard(position,showTimeline=false) {
    const {plan,room,bills,buffer,cutoff,pay,unknownBills}=position;
    const next=timingAction(position);
    const heading=pay?'Before payday':'Next 14 days';
    const hasCosts=plan.livingReserve>0||confirmedCashCosts(position);
    const opening=Math.max(1,plan.opening);
    const components=[[bills,'due'],[plan.livingReserve,'everyday'],[buffer,'buffer'],[room,'available']];
    let remaining=100;
    const meter=room!==null&&plan.opening>0?`<div class="cash-position-meter" aria-hidden="true">${components.map(([amount,tone])=>{
      const width=Math.max(0,Math.min(remaining,amount/opening*100));
      remaining-=width;
      return `<i class="${tone}" style="width:${width}%"></i>`;
    }).join('')}</div>`:'';
    const title=room===null?'Cash room pending':hasCosts?'Estimated cash available':'Cash available before everyday costs';
    const why=next.why?`<p class="cash-next-note">${H(next.why)}</p>`:'';
    const action=tab==='Cash plan'&&next.id==='Cash plan'?{label:'Check funding',action:'cash-controls',id:''}:next;
    return `<section class="cash-position" aria-label="${heading}">
      <div class="cash-position-top"><h2>${heading}</h2><span>Through ${H(dateLabel(cutoff))}</span></div>
      <div class="cash-position-main"><span>${title}</span><strong class="money">${money(room)}</strong></div>
      ${showTimeline&&room!==null?paydayTimeline(position):meter}<dl class="cash-position-facts">
        <div><dt>${plan.stale.length||plan.missing.length?'Cash on file':'Cash on hand'}</dt><dd>${money(plan.verified.length?plan.opening:null)}</dd></div>
        <div><dt>${unknownBills?'Known bills due':'Bills due'}</dt><dd>${money(bills)}</dd></div>
        <div><dt>Everyday costs</dt><dd>${money(plan.livingReserve||null)}</dd></div>
        <div><dt>Cash buffer</dt><dd>${money(buffer||null)}</dd></div>
      </dl>
      ${why}<div class="cash-position-actions">${btn(action.label,action.action,action.id,'position-primary')}
        ${tab==='Cash plan'||next.id==='Cash plan'?'':btn('Open payday plan','nav','Cash plan','position-secondary')}</div>
    </section>`;
  }
  function changesSummary(changes) {
    if(!changes.purchasesComparable&&changes.cashComparable) {
      const outgoing=changes.moneyOut[0], incoming=changes.moneyIn[0];
      const driver=outgoing||incoming;
      const delta=outgoing?changes.cash.outflow-changes.priorCash.outflow:changes.cash.inflow-changes.priorCash.inflow;
      const label=outgoing?'Withdrawals':'Deposits';
      return {value:signedMoney(delta),detail:driver?label+' · '+driver.name+' '+(driver.delta>0?'rose ':'fell ')+money(Math.abs(driver.delta)):'Cash movement was steady'};
    }
    const top=changes.spending[0];
    if(!top)return {value:changes.purchasesComparable?money(changes.purchaseTotal):'—',detail:changes.purchasesComparable?
      'Categorized purchases were steady':changes.cash.available?'See recorded cash activity':'Add statements to see what changed'};
    if(!changes.purchasesComparable)return {value:money(top.recent),detail:categoryName(top.name||'Unassigned')+' led recorded spending'};
    const change=changes.purchaseTotal-changes.priorPurchases;
    return {value:signedMoney(change),detail:'Purchases · '+categoryName(top.name||'Unassigned')+' '+(top.delta>0?'rose ':'fell ')+money(Math.abs(top.delta))};
  }
  function debtSummary(b,now) {
    if(!b.debtLoans.length)return {value:'—',detail:'Add a card or line of credit to model repayment'};
    if(b.missingOperating)return {value:'—',detail:'Confirm monthly costs to compare payments'};
    if(b.room<0)return {value:'−'+money(-b.room),unit:'per month',detail:'Gap before extra payments'};
    const target=E.debtProfile(S,now).target;
    return {value:money(Math.min(b.room,b.targetExtra)),unit:'per month',detail:b.assumptions.length?'Verify lender payments before committing':
      target?'First candidate · '+target.name:'Monthly room for extra payments'};
  }
  function homeCashFlow(now,period) {
    const cash=E.recordedCash(S,now,period);
    const rows=[['Money in',cash.inflow],['Money out',cash.outflow],['Net cash',cash.net]];
    return `<section class="panel home-cash-month"><div class="panel-title"><div><h2>${H(monthLabel(period))} cash flow</h2>
      <p>${cash.available?`Through ${H(dateLabel(cash.through))}${cash.covered?'':' · partial statements'}`:'Awaiting cash statements'}</p>
      </div>${btn('Cash history','open-cash-month',period,'mini quiet')}</div>
      <dl>${rows.map(([label,value])=>`<div><dt>${label}</dt>
        <dd class="money${label==='Net cash'&&cash.available&&value<0?' negative':''}">${cash.available?(label==='Net cash'?signedMoney(value):money(value)):'—'}</dd></div>`).join('')}</dl>
    </section>`;
  }
  function overview() {
    const now=E.today(), position=E.paydayPosition(S,now);
    const changes=E.monthChanges(S,now);
    const spending=changesSummary(changes), debt=debtSummary(E.monthlySnapshot(S,now),now);
    const pending=E.reviewPending(S).length, fixes=E.statementFixes(S).length;
    const latest=S.chatUpdates?.at(-1);
    return head('Today','',btn('Apply chat update','chat-update','','quiet'))+
      `<div class="decision-layout">
        ${cashPositionCard(position,true)}
        <div class="decision-list">
          ${homeCashFlow(now,changes.period)}
          ${jump('Monthly costs','','open-month-costs',changes.period,'Fixed bills, recurring charges and flexible spending')}
          ${jump('What changed this month',spending.value,'open-changes',changes.period,spending.detail)}
          ${jump('Pay down debt faster',debt.value,'nav','Monthly snapshot',debt.detail,debt.unit)}
          ${pending?jump('Quick Review',String(pending),'open-inbox','','Transactions to categorize or link'):''}
          ${fixes?jump('Statement fixes',String(fixes),'open-statement-fixes','','Rows to verify against a statement'):''}
        </div>
      </div>
      <div class="decision-tools">${link('All bills and paydays','nav','Bills')}${link('Recommendations','nav','Recommendations')}</div>`+
      (latest?`<details class="subtle section-gap"><summary>Last chat update</summary><p class="small">${H(chatUpdateSummary(latest))}</p></details>`:'');
  }
  function monthlyChanges() {
    const now=E.today();
    const periods=Array.from({length:13},(_,i)=>E.month(E.shiftMonth(now,-i)));
    const changes=E.monthChanges(S,now,changesMonth||periods[0]);
    const compare=changes.purchasesComparable;
    const label=compare?dateLabel(changes.end)+' vs '+dateLabel(changes.priorEnd):'Through '+dateLabel(changes.end);
    const summary=`<div class="month-movement"><div><span>${compare?'Change in categorized purchases':'Recorded purchases'}</span>
      <strong class="money">${compare?signedMoney(changes.purchaseTotal-changes.priorPurchases):money(changes.purchasesAvailable?changes.purchaseTotal:null)}</strong>
      <small>${label}</small></div><div><span>One-time projects</span><strong class="money">${money(changes.purchasesAvailable?changes.projectTotal:null)}</strong>
      ${link('See project charges','change-driver',JSON.stringify([changes.period,'project','']))}</div></div>`;
    const driverRows=(rows,tone)=>{
      const scale=Math.max(1,...rows.map(x=>Math.abs(x.delta??x.recent)));
      return `<ul class="driver-list">${rows.map(x=>{
        const title=tone==='purchase'?categoryName(x.name||'Unassigned spend'):x.name;
        const amount=x.delta===null?money(x.recent):signedMoney(x.delta);
        const basis=x.former===null?'':money(x.former)+' → '+money(x.recent);
        const id=JSON.stringify([changes.period,tone,x.name]);
        return `<li><button type="button" class="driver-row" data-act="change-driver" data-id="${H(id)}">
          <span class="driver-title"><strong>${H(title)}</strong><b class="money">${amount}</b>${arrow}</span>
          ${bar(Math.abs(x.delta??x.recent),scale,tone==='in'?(x.delta===null||x.delta>0?'in':'out'):(x.delta===null||x.delta>0?'out':'in'))}
          ${basis?`<small>${basis}</small>`:''}</button></li>`;
      }).join('')}</ul>`;
    };
    const warning=changes.reviewCurrent||changes.reviewPrior?`<div class="change-review">Some transactions still need a category.
      ${changes.reviewCurrent?link('Review '+monthLabel(changes.period),'month-inbox',changes.period):''}
      ${changes.reviewPrior?link('Review '+monthLabel(changes.prior),'month-inbox',changes.prior):''}</div>`:'';
    const cash=changes.cash;
    const cashDetail=changes.cashComparable?'Matching dates through '+dateLabel(changes.cashEnd)+' and '+dateLabel(changes.priorCashEnd):
      'Showing recorded activity. A comparison needs matching cash-account coverage.';
    const purchases=panel(compare?'What moved spending':'Largest recorded categories',changes.spending.length?driverRows(changes.spending.slice(0,6),'purchase'):
      no(compare?'No category changed in the dates shown.':'No categorized purchases in this period.'),
      compare?'Same number of days in each month.':'A comparison needs matching statement coverage.');
    const cashPanel=panel('Cash in and out',`<dl class="change-cash-totals">
        <div><dt>Money in</dt><dd>${money(cash.available?cash.inflow:null)}</dd></div>
        <div><dt>Money out</dt><dd>${money(cash.available?cash.outflow:null)}</dd></div></dl>
        ${changes.moneyOut.length?`<h3>${changes.cashComparable?'Biggest withdrawal changes':'Largest withdrawals'}</h3>${driverRows(changes.moneyOut.slice(0,3),'out')}`:''}
        ${changes.moneyIn.length?`<h3>${changes.cashComparable?'Biggest deposit changes':'Largest deposits'}</h3>${driverRows(changes.moneyIn.slice(0,3),'in')}`:''}`,cashDetail);
    return head('What changed','',btn('Today','nav','Overview','quiet'))+
      `<div class="change-date">${field('Statement month',select('changes-month',periods.map(m=>[m,monthLabel(m)]),changes.period))}</div>`+
      summary+warning+
      `<div class="change-layout">${!compare&&changes.cashComparable?cashPanel+purchases:purchases+cashPanel}</div>`+
      `<div class="decision-tools">${link('Cash history','open-cash-month',changes.period)}${link('All spending categories','open-spending-period',changes.period)}</div>`;
  }
  function changeDriver() {
    const {period,tone,name,side}=changeSelection;
    const change=E.monthChanges(S,E.today(),period);
    const purchase=tone==='purchase', project=tone==='project', categorized=purchase||project;
    const comparable=categorized?change.purchasesComparable:change.cashComparable;
    const prior=side==='Prior period'&&comparable;
    const cash=prior?change.priorCash:change.cash;
    const through=categorized?(prior?change.priorEnd:change.end):(prior?change.priorCashEnd:change.cashEnd);
    const group=categorized?null:(tone==='in'?cash.sources:cash.uses).find(x=>x.name===name);
    const relevant=categorized?(prior?change.previous:change.current).filter(t=>project?t.kind==='Project':E.isSpending(t)&&t.category===name):
      S.transactions.filter(t=>group?.amounts.has(t.id)).map(t=>({...t,amount:group.amounts.get(t.id)}));
    relevant.sort((a,b)=>b.date.localeCompare(a.date)||a.description.localeCompare(b.description));
    const total=categorized?E.spendingTotal(relevant):group?.amount??0;
    const pageMax=Math.max(0,Math.ceil(relevant.length/PAGE)-1);
    categoryPage=Math.min(pageMax,categoryPage);
    const list=relevant.slice(PAGE*categoryPage,PAGE*(categoryPage+1)).map(t=>`<li>
      <div><small>${H(dateLabel(t.date))} · ${H(alias(t.account))}</small>${link(t.description,'transaction',t.id)}</div>
      <strong class="money">${categorized&&t.amount>0?signedMoney(t.amount):money(categorized?-t.amount:t.amount)}</strong></li>`).join('');
    const pagination=pageMax?`<div class="table-controls">${btn('Previous','category-page','-1','mini',categoryPage?'':' disabled')}
      <small>Page ${categoryPage+1} of ${pageMax+1}</small>${btn('Next','category-page','1','mini',categoryPage<pageMax?'':' disabled')}</div>`:'';
    return head(project?'One-time project charges':purchase?categoryName(name||'Unassigned spend'):name,'',btn('‹ What changed','open-changes',period,'quiet'))+
      (comparable?segments(['This period','Prior period'],side,'change-side','Comparison period'):'')+
      `<div class="category-total"><div><h2>${H(monthLabel(prior?change.prior:period))}</h2><strong class="money">${money(total)}</strong></div>
        <p>Through ${H(dateLabel(through))}</p></div>`+
      panel('Transactions included',list?`<ul class="list event-list category-transactions">${list}</ul>${pagination}`:no('No transactions in these dates.'),'',purchase&&name?btn('Category history','chart-drill',JSON.stringify([period,name]),'mini quiet'):'');
  }
  function cashHistory() {
    const now=E.today();
    const series=Array.from({length:13},(_,i)=>E.recordedCash(S,now,E.month(E.shiftMonth(now,-i))));
    const active=series.find(x=>x.period===cashMonth)||series.find(x=>x.available)||series[0];
    const trendStart=Math.min(series.indexOf(active),series.length-6);
    const trend=series.slice(trendStart,trendStart+6).reverse();
    const coverage=active.available?(active.covered?'Covered':'Partial statements'):'No statements';
    const cutoff=active.through?'Through '+dateLabel(active.through):'';
    const scale=Math.max(1,active.inflow,active.outflow);
    const hero=`<section class="cash-board" aria-label="Recorded cash flow">
      <div class="cash-board-head">
        <div><h2>Net cash movement</h2>
          <strong class="cash-number money">${active.available?signedMoney(active.net):'—'}</strong>
          <p>${H([coverage,cutoff].filter(Boolean).join(' · '))}</p></div>
        ${field('Cash flow month',select('cash-month',series.map(r=>[r.period,monthLabel(r.period)]),active.period))}
      </div>
      <ul class="cash-board-bars amount-list">
        ${cashBar('Money in',active.available?active.inflow:null,scale,'in')}
        ${cashBar('Money out',active.available?active.outflow:null,scale,'out')}
      </ul>
      <div class="cash-board-foot"><span>Identified income</span><b class="money">${money(active.available?active.knownIncome:null)}</b></div>
    </section>`;
    const accountCoverage=active.scope.length?`<details class="subtle section-gap"><summary>Statement coverage and method</summary>
      <ul class="list">${active.scope.map(x=>`<li><span>${H(x.account.name)}</span>
      <small>${H(x.covered?'Covered':x.through?'Through '+dateLabel(x.through):'Statement needed')}</small></li>`).join('')}</ul>
      <p class="small">Chequing and savings only. Linked transfers between those accounts cancel out. Card payments count when paid. Card purchases are under Spending.</p></details>`:'';
    const detail=`<details class="panel home-disclosure" open><summary>Where the cash went</summary>
      <div class="home-grid">${cashBuckets('Money in',active.sources,scale,'in',active.period)}
      ${cashBuckets('Money out',active.uses,scale,'out',active.period)}</div>
      ${active.uncertainty?`<p class="small section-gap">${active.uncertainty} cash movements in review. ${link('Review this month','month-inbox',active.period)}</p>`:''}
      ${accountCoverage}</details>`;
    return head('Cash history','',btn('Today','nav','Overview','quiet'))+
      '<div class="insight-overview">'+hero+panel('Recent cash flow',chartMonths(trend,active.period))+'</div>'+detail;
  }
  function eventItem(e,now,alerts=new Set()) {
    const status=e.date<now&&e.direction!=='Income'&&!['Paid','Skipped'].includes(e.status)?'Overdue':
      alerts.has(e.key)?'Below buffer':e.status!=='Open'?e.status:e.direction==='Income'?'Expected deposit':billKind(e);
    const incoming=e.direction==='Income'&&e.forecastAmount!==null?'+':'';
    const stamp=E.validDate(e.date)?'<span class="date-tile" aria-hidden="true"><small>'+H(monthShort.format(new Date(e.date+'T00:00:00Z')))+'</small><b>'+H(Number(e.date.slice(8)))+'</b></span>':'';
    return '<li class="date-event">'+stamp+'<div><small><span class="screen-reader">'+H(dateLabel(e.date))+' · </span>'+H(status)+'</small>'+link(e.name,'occurrence',e.key)+
      '<small>'+H(alias(e.account))+(e.direction==='Transfer'?' → '+H(alias(e.toAccount)):'')+'</small></div>'+
      '<strong class="money'+(incoming?' deposit':'')+'">'+incoming+(e.forecastAmount===null?'Amount pending':money(e.forecastAmount))+'</strong></li>';
  }
  function stat(label,value,detail='') {
    return '<div class="stat"><h3>'+H(label)+'</h3><div class="value money">'+money(value)+'</div>'+(detail?'<small>'+H(detail)+'</small>':'')+'</div>';
  }
  window.addEventListener('resize',()=>{if(S&&tab==='Cash plan')drawRunway();});
  function imports() {
    const pending=files.find(file=>file.id===selectedFile);
    const queue=files.length ? '<div class="actions">'+files.map(file=>btn(file.name,'select-file',file.id,'mini',file.id===selectedFile?' aria-pressed="true"':'')).join('')+'</div>':'';
    const accountSetup=S.accounts.length?'':banner('Add an account before importing its transactions. '+link('Add account','account-edit'),'warning');
    const upload='<div class="stack">'+accountSetup+
      field('Choose bank exports','<input id="csv-files" type="file" multiple accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"'+(localFile?'':' disabled')+'>','CSV or TSV. Map each file to the account it came from. Amounts should be posted in CAD.')+
      queue+(pending?mapping(pending):'')+'</div>';
    const staged=staging.length?batchView():'';
    const historical=S.imports.length?'<details class="subtle section-gap"><summary>Import history ('+S.imports.length+')</summary>'+
      table(['Statement','Account','Coverage','Rows',''],[...S.imports].reverse().map(i=>row(cell(H(i.name),'desc'),cell(H(alias(i.account))),cell(H(i.start+' to '+i.end)+(i.coverageConfirmed?'':' <small>unconfirmed</small>')),cell(H(i.count)+' accepted'+(i.issueCount?' · '+H(i.issueCount)+' skipped':'')),cell(btn('Remove','remove-import',i.id,'mini danger')))))+'</details>':'';
    const fixes=E.statementFixes(S);
    return head('Transactions','',btn('Apply chat update','chat-update','','primary'))+
      segments(['Quick review','Statement fixes','Ledger'],reviewView,'review-view','Transactions view')+
      (reviewView==='Statement fixes'?statementFixes(fixes):reviewView==='Quick review'?
        (fixes.length?'<div class="review-strip"><strong>'+fixes.length+' rows need statement verification</strong>'+
        btn('Open statement fixes','review-view','Statement fixes','mini')+'</div>':'')+quickReview():panel('Transaction ledger',ledgerView()))+
      '<details class="subtle section-gap manual-import"'+(files.length||staging.length?' open':'')+'><summary>Import bank exports manually</summary>'+upload+staged+'</details>'+historical;
  }
  function statementFixes(rows) {
    if(!rows.length)return panel('Statement fixes',no('There are no combined descriptions to verify.'));
    const byStatement=new Map();
    for(const t of rows) {
      const key=t.importId||t.account;
      if(!byStatement.has(key))byStatement.set(key,[]);
      byStatement.get(key).push(t);
    }
    const statements=[...byStatement.values()].sort((a,b)=>(byId(S.imports,b[0].importId)?.end||b[0].date).localeCompare(byId(S.imports,a[0].importId)?.end||a[0].date));
    return panel('Statement fixes',statements.map(entries=>{
      const imported=byId(S.imports,entries[0].importId);
      const label=imported?.name||alias(entries[0].account);
      const byDescription=new Map();
      for(const t of entries) {
        if(!byDescription.has(t.description))byDescription.set(t.description,[]);
        byDescription.get(t.description).push(t);
      }
      return '<details class="subtle section-gap"><summary>'+H(label)+' · '+entries.length+' to verify</summary>'+
        [...byDescription].map(([description,group])=>'<div class="statement-fix-group"><p class="small">'+H(description)+'</p><ul class="list">'+
        group.map(t=>'<li><div><strong>'+money(t.amount)+'</strong><small class="small">'+H(t.date)+'</small></div>'+
        btn('Fix this row','fix-statement-row',t.id,'mini quiet')+'</li>').join('')+'</ul></div>').join('')+'</details>';
    }).join(''),'Compare each row to the original statement. These amounts stay in the ledger while their categories are in review.');
  }
  function fixStatementRow(id) {
    const t=byId(S.transactions,id);
    if(!t||!E.compoundDescription(t))throw new Error('This row has already been corrected.');
    const imported=byId(S.imports,t.importId);
    return openDialog('Fix statement row',
      '<p><strong>'+money(t.amount)+'</strong> · '+H(alias(t.account))+'</p>'+
      (imported?'<p class="small">'+H(imported.name)+'</p>':'')+
      field('Merchant or description on the statement',f('description','','text','required maxlength="240"'))+
      field('Posting date',f('date',t.date,'date','required'))+
      '<details class="subtle"><summary>Combined text from import</summary><p class="small">'+H(t.description)+'</p></details>',
      async data=>{
        const description=titleField(data,'description'), date=dateField(data,'date');
        if(E.compoundDescription({description}))throw new Error('Enter only the description for this amount.');
        if(date>E.today()||imported&&(date<imported.start||date>imported.end))throw new Error('Use a posting date in the statement period.');
        await write(next=>{
          const transaction=byId(next.transactions,id);
          if(!transaction||!E.compoundDescription(transaction))throw new Error('This row has already been corrected.');
          if(transaction.pair)unpair(next,id);
          Object.assign(transaction,{sourceDescription:transaction.sourceDescription||transaction.description,sourceDate:transaction.sourceDate||transaction.date,
            description,date,kind:'Review',category:'',project:'',manual:false,why:'Statement description corrected. Confirm the category.'});
          delete transaction.allocations;
        });
      },'Save for review');
  }
  const moneyReviewCard=card=>['movement','pair'].includes(card.type);
  function quickReview() {
    const queue=E.reviewGroups(S,reviewMonth);
    const types=['All','Repeat merchants','Money movement'];
    const visible=queue.cards.filter(card=>reviewType==='All'||(reviewType==='Repeat merchants'?card.type==='repeat':moneyReviewCard(card)));
    const card=visible.find(x=>!setAside.has(x.id));
    const monthCaption=reviewMonth?' · '+monthLabel(reviewMonth):'';
    const undo=quickUndo?.state===S?btn('Undo last review','review-undo','','mini quiet'):'';
    const allMonths=reviewMonth?btn('Show all months','review-all-months','','mini quiet'):'';
    const tools='<div class="review-toolbar">'+segments(types,reviewType,'review-type','Review items')+'<div class="actions">'+allMonths+undo+'</div></div>';
    if(!card) {
      return panel(queue.count?queue.count+' to review'+monthCaption:'Review complete',
        queue.count?tools+(visible.length?no('You’ve set these items aside.')+btn('See them again','review-reset','','section-gap'):
          no('There are no items in this view.')):no('No transactions need a category or confirmation.'),'',!queue.count?allMonths+undo:'');
    }
    const t=card.rows[0], isPair=card.type==='pair', count=card.rows.length;
    const isGroup=count>1&&!isPair;
    const label=isPair?card.label:t.description;
    const amount=isPair?Math.abs(t.amount):E.sum(card.rows,x=>x.amount);
    const subtitle=isPair?'Check the two sides of this transfer.':isGroup?count+' charges · '+alias(t.account):
      t.date+' · '+alias(t.account);
    const rowDetails=card.rows.map(row=>'<li><div>'+link(row.description,'transaction',row.id)+
      '<small class="small">'+H(row.date)+' · '+H(alias(row.account))+'</small></div><strong class="money">'+money(row.amount)+'</strong></li>').join('');
    const details=isPair?'<ul class="list review-matches">'+rowDetails+'</ul>':
      isGroup?'<details class="subtle review-matches"><summary>See '+count+' charges or review one at a time</summary><ul class="list">'+rowDetails+'</ul></details>':'';
    const showPicker=reviewPicker===card.id;
    const remember=card.eligible?'<label class="check review-remember"><input id="quick-remember" type="checkbox">Remember this exact merchant on '+H(alias(t.account))+'</label>':'';
    const reviewCategoryLabel=category=>category==='Other'?'Miscellaneous':category;
    const suggest=card.suggestion?btn('Use '+reviewCategoryLabel(card.suggestion),'review-category',JSON.stringify([card.id,card.suggestion]),'primary'):'';
    const pickCategories=card.eligible||card.type==='single'&&t.amount<0;
    const canChoose=pickCategories||card.type==='movement'||card.type==='single'&&t.amount>0;
    const popular=categoryOptions().sort((a,b)=>a.localeCompare(b));
    const movementChoices=t.amount>0?[['Income','Income'],['Transfer','Transfer between accounts']]:
      [['Transfer','Transfer between accounts'],['Financing','Debt payment'],['Savings','Savings']];
    const choices=pickCategories?['Groceries','Dining','Shopping','Transportation','Home maintenance','Subscriptions','Other'].map(category=>
      btn(reviewCategoryLabel(category),'review-category',JSON.stringify([card.id,category]),'mini quick-choice')):
      movementChoices.map(([kind,description])=>btn(description,'review-confirm-type',JSON.stringify([card.id,kind]),'mini quick-choice'));
    if(pickCategories&&S.projects.length===1)choices.push(btn(S.projects[0].name,'review-project',JSON.stringify([card.id,S.projects[0].id]),'mini quick-choice'));
    const form=!isPair&&canChoose&&showPicker?'<div class="quick-picks"><p class="small">'+
      (isGroup?'Apply to all '+count+' charges':pickCategories?'Choose a spending category':'Confirm the type')+'</p>'+
      '<div class="actions">'+choices.join('')+'</div></div>'+
      (pickCategories?'<form id="quick-category" class="quick-category" data-id="'+H(card.id)+'">'+
      field('All spending categories',select('category',[['','Choose category'],...popular.map(category=>[category,reviewCategoryLabel(category)])],card.suggestion,'required'))+
      '<button class="btn primary" type="submit">'+(isGroup?'Apply to '+count+' charges':'Confirm')+'</button></form>':''):'';
    const buttons=isPair?btn('Link both','review-pair',card.id,'primary'):
      showPicker?'':suggest+(canChoose?btn(card.suggestion?'Change category':pickCategories?'Choose category':'Choose type','review-picker',card.id,card.suggestion?'quiet':'primary'):'');
    const extras=(!isPair?btn(isGroup?'Review one':'More options','transaction',t.id,'quiet'):'')+
      btn('Later','review-later',card.id,'quiet');
    const chosen=card.frequency?card.frequency+' pattern':isGroup?'Repeat merchant':isPair?'Suggested match':card.type==='movement'?'Money movement':'';
    const question=!isPair&&(isGroup?'This choice applies to all '+count+' matching charges.':t.why);
    return '<section class="panel review-panel"><div class="panel-title"><h2>'+queue.count+' to review'+H(monthCaption)+'</h2></div>'+tools+
      '<article class="quick-card"><header class="quick-header"><div>'+(chosen?'<p class="quick-label">'+H(chosen)+'</p>':'')+
      '<h3 id="quick-current" tabindex="-1">'+H(label)+'</h3><p>'+H(subtitle)+'</p></div>'+
      '<div class="quick-amount money">'+money(amount)+(isGroup?'<small>Total</small>':'')+'</div></header>'+
      (question?'<p class="quick-question">'+H(question)+'</p>':'')+details+(canChoose?remember:'')+form+
      '<div class="actions review-actions">'+buttons+extras+'</div></article></section>';
  }
  function currentReview(id) {
    const card=E.reviewGroups(S,reviewMonth).cards.find(x=>x.id===id);
    if(!card)throw new Error('This item has changed. Reopen it to review.');
    return card;
  }
  async function saveQuick(id,classification) {
    const card=currentReview(id);
    const remember=classification?.kind==='Spending'&&card.eligible&&root.querySelector('#quick-remember')?.checked;
    const previous=card.rows.map(t=>structuredClone(t));
    let previousRules=null;
    await write(next=>{
      if(card.type==='pair') {
        applyPair(next,card.rows[0].id,card.rows[1].id,card.label);
        return;
      }
      for(const t of card.rows)Object.assign(byId(next.transactions,t.id),classification,{manual:true,why:'Confirmed in quick review'});
      if(remember) {
        const t=card.rows[0], merchant=E.normal(t.description), direction=Math.sign(t.amount);
        previousRules=structuredClone(next.rules);
        next.rules=next.rules.filter(r=>r.account!==t.account||r.merchant!==merchant||r.direction!==direction);
        next.rules.push({...classification,account:t.account,merchant,direction});
      }
    });
    if(!S)return;
    quickUndo={state:S,previous,previousRules};
    reviewPicker='';
    render();
    root.querySelector('#quick-current')?.focus({preventScroll:true});
    note(card.type==='pair'?'Transfer linked.':card.rows.length===1?'Transaction confirmed.':card.rows.length+' transactions confirmed.');
  }
  async function undoQuick() {
    if(quickUndo?.state!==S||!quickUndo)return;
    const {previous,previousRules}=quickUndo;
    await write(next=>{
      previous.forEach(t=>replace(next.transactions,t));
      if(previousRules) next.rules=previousRules;
    });
    quickUndo=null;
    render();
    note('Last review undone.');
  }
  function mapping(file) {
    const probe=file.rows[file.skip]||[];
    const cols=Math.min(160,Math.max(probe.length,...file.rows.slice(file.skip,file.skip+6).map(r=>r.length)));
    const columns=[[-1,'Unused'],...Array.from({length:cols},(_,i)=>[i,'Column '+(i+1)+(probe[i]?' · '+probe[i].slice(0,44):'')])];
    const map=file.map;
    return '<form id="map-form" class="stack" autocomplete="off"><div class="form-grid cols-3">'+
      field('Account',select('account',accountOptions(),file.account,'required'))+
      field('Date order for 04/11/2025',select('order',[['MDY','Month / day / year'],['DMY','Day / month / year']],file.order))+
      field('Rows before header or data',f('skip',file.skip,'number','min="0" step="1" required'))+
      '</div><div class="actions">'+check('Column names on first remaining row','header',file.header)+check('Reverse signs','reverse',file.reverse)+'</div>'+
      '<div class="form-grid cols-3">'+field('Date column',select('date',columns,map.date))+
      field('Description column',select('description',columns,map.description))+
      field('Signed amount',select('amount',columns,map.amount),'Choose Unused if separate debits and credits.')+
      field('Debit column',select('debit',columns,map.debit))+field('Credit column',select('credit',columns,map.credit))+
      field('Transaction ID',select('external',columns,map.external),'Optional. Useful for overlapping exports.')+'</div>'+
      '<div class="actions"><button type="submit" class="btn">'+(preview?.file===file.id?'Refresh preview':'Preview statement')+'</button>'+
      btn('Remove file','drop-file',file.id,'mini danger')+'</div></form>'+(preview?.file===file.id?previewView(preview):'');
  }
  function previewView(p) {
    const inflow=E.sum(p.result,t=>Math.max(0,t.amount)),out=E.sum(p.result,t=>Math.max(0,-t.amount));
    const seen=p.result.map(t=>t.date).sort();
    const span=p.start||seen[0]||'', last=p.end||seen.at(-1)||'';
    return '<hr><div class="stack"><h3>Check '+H(p.name)+'</h3><p>'+p.result.length+' rows · Money in '+money(inflow)+' · Money out '+money(out)+' · Net '+money(inflow-out)+'</p>'+
      (p.issues.length?'<details class="subtle" open><summary>'+p.issues.length+' unreadable row'+(p.issues.length===1?'':'s')+'</summary>'+
       table(['Row','Issue','Extract'],p.issues.map(i=>row(cell(i.row),cell(H(i.reason)),cell(H(i.sample),'desc'))))+'</details>':'')+
      table(['Date','Description','$Amount','Suggestion'],p.result.slice(0,8).map(t=>row(dateCell(t.date),cell(H(t.description),'desc'),amountCell(t.amount,true),cell(H(t.kind==='Review'?'Review':t.category||t.kind)))))+
      '<form id="stage-form" class="stack" autocomplete="off"><div class="form-grid">'+
      field('Period starts',f('period_start',span,'date','required'),'Use the actual first date covered by this export.')+
      field('Period ends',f('period_end',last,'date','required'),'Use the actual last date covered, even if there were no transactions on it.')+
      field('Opening balance',f('opening','','text','inputmode="decimal"'),'Optional. Enter credit balances owed as positive.')+
      field('Closing balance',f('closing','','text','inputmode="decimal"'),'Use both balances to check the statement totals.')+
      '</div>'+check('Confirm this file covers the entire date range','coverage')+
      (p.issues.length?check('I reviewed the unreadable rows and want to skip them','allow_skips'):'')+
      '<div class="actions"><button type="submit" class="btn primary">Stage statement</button></div></form></div>';
  }
  function bindImport() {
    root.querySelector('#quick-category')?.addEventListener('submit',async event=>{
      event.preventDefault();
      const form=event.currentTarget, data=new FormData(form), category=val(data,'category');
      if(!category)return;
      try {
        await saveQuick(form.dataset.id,{kind:'Spending',category,project:''});
      } catch(error) {note(error.message,true);}
    });
    root.querySelector('#csv-files')?.addEventListener('change',async event=>{
      if(!localFile)return;
      const active=S, chosen=[...event.target.files];
      let count=0;
      for (const file of chosen) {
        try {
          if(file.size>30*1024*1024) throw new Error('Split this export into smaller date ranges.');
          const result=E.sniff(await readFile(file));
          if(S!==active) return;
          if(!result.rows.length||result.rows[0].length<2&&!result.header) throw new Error('Export as CSV or TSV. For PDF statements, use your bank’s transaction export.');
          files.push({...result,id:E.id(),name:file.name,order:'MDY',reverse:false,account:S.accounts.length===1?S.accounts[0].id:''});
          count++;
        } catch(error) {note(file.name+' · '+error.message,true);}
      }
      if(count&&!selectedFile) selectedFile=files[0].id;
      if(S===active&&tab==='Import & review') render();
    });
    root.querySelector('#map-form')?.addEventListener('change',event=>{
      const data=new FormData(event.currentTarget), file=byId(files,selectedFile);
      readMap(data,file);
      if(event.target.name==='skip'||event.target.name==='header') render();
      else if(preview?.file===selectedFile) {
        preview=null;
        root.querySelector('#stage-form')?.remove();
        note('Mapping changed. Refresh the preview before staging.');
      }
    });
    root.querySelector('#map-form')?.addEventListener('submit',event=>{
      event.preventDefault();
      try {
        const data=new FormData(event.currentTarget), file=byId(files,selectedFile);
        readMap(data,file);
        if(!file.account||!byId(S.accounts,file.account)) throw new Error('Choose the account this export came from.');
        const result=E.extract(file.rows,file.map,file,S,file.account);
        preview={...result,file:file.id,name:file.name,account:file.account};
        render();
      } catch(error){note(error.message,true);}
    });
    root.querySelector('#stage-form')?.addEventListener('submit',event=>{
      event.preventDefault();
      try {stageFile(new FormData(event.currentTarget));} catch(error){note(error.message,true);}
    });
    root.querySelector('#ledger-filters')?.addEventListener('submit',event=>{
      event.preventDefault();
      const data=new FormData(event.currentTarget);
      ledger=Object.fromEntries([...data].map(([k,v])=>[k,String(v)]));
      ledgerPage=0; render();
      document.getElementById('ledger-filters')?.scrollIntoView({block:'nearest'});
    });
  }
  function readMap(form,file) {
    Object.assign(file,{account:val(form,'account'),order:val(form,'order'),header:form.has('header'),reverse:form.has('reverse'),skip:Number(val(form,'skip'))||0});
    for(const key of ['date','description','amount','debit','credit','external']) file.map[key]=Number(val(form,key));
  }
  function stageFile(form) {
    const p=preview;
    if(!p || p.file!==selectedFile) throw new Error('Preview the file first.');
    const start=dateField(form,'period_start'),end=dateField(form,'period_end');
    if(end<start || p.result.some(t=>t.date<start||t.date>end)) throw new Error('The date range must include every parsed row. Check the date order and statement period.');
    if(!p.result.length&&!form.has('coverage')) throw new Error('There are no transactions. Confirm coverage if this is a zero-activity statement.');
    if(p.issues.length&&!form.has('allow_skips')) throw new Error('Review the unreadable rows before staging.');
    const opening=val(form,'opening'),closing=val(form,'closing');
    let balanceCheck='Unverified';
    if(opening||closing) {
      const o=E.money(opening),c=E.money(closing);
      if(o===null||c===null) throw new Error('Enter both a valid opening and closing balance.');
      const account=byId(S.accounts,p.account);
      const delta=(c-o)*(['Credit card','Line of credit or loan'].includes(account.type)?-1:1);
      const net=E.sum(p.result,t=>t.amount);
      if(net!==delta) throw new Error('Statement differs from the parsed rows by '+money(net-delta)+'. Check the signs, columns, or balances.');
      balanceCheck='Balances tie';
    }
    const id=E.id();
    staging.push({id,account:p.account,name:p.name,start,end,balanceCheck,issueCount:p.issues.length,coverageConfirmed:form.has('coverage')&&!p.issues.length,
      items:p.result.map(transaction=>({transaction:{...transaction,importId:id},force:false}))});
    files=files.filter(file=>file.id!==p.file);selectedFile=files[0]?.id||'';preview=null;
    render();
    note(p.issues.length?'Statement staged. Skipped rows leave this coverage unconfirmed.':'Statement staged. Approve the batch when ready.');
  }
  function buildBatch() {
    const existing=structuredClone(S.transactions), stagedRows=[];
    for(const packet of staging) {
      packet.items.forEach(item=>{item.duplicate='';});
      E.duplicateReview(existing,packet.items);
      for(const item of packet.items) {
        if(!item.duplicate||item.force) {
          existing.push(structuredClone(item.transaction));
          stagedRows.push(item.transaction);
        }
      }
    }
    const changed=new Set(stagedRows.map(t=>t.id));
    const pairs=E.matchTransfers(existing,S.accounts).filter(p=>changed.has(p.left.id)||changed.has(p.right.id));
    return {existing,stagedRows,pairs};
  }
  function batchView() {
    const {stagedRows,pairs}=buildBatch();
    const flagged=staging.flatMap(p=>p.items.filter(x=>x.duplicate));
    const suggested=pairs.length?'<details class="subtle"><summary>'+pairs.length+' suggested transfer match'+(pairs.length===1?'':'es')+'</summary>'+
      '<p class="small">Both sides have matching amounts and nearby dates. Clear the checkbox below if you want to review the matches individually later.</p>'+
      table(['Date','From','To','$Amount'],pairs.map(p=>row(dateCell(p.left.date),cell(H(alias(p.left.account))),cell(H(alias(p.right.account))),amountCell(-p.left.amount))))+'</details>':'';
    return panel('Staged statements','<div class="stack">'+table(['File','Checks','Rows',''],staging.map(p=>row(cell(H(p.name),'desc'),cell(H(p.balanceCheck)+' · '+H(p.coverageConfirmed?'Coverage confirmed':'Coverage unconfirmed')),cell(p.items.length+' parsed'),cell(btn('Remove','unstage',p.id,'mini danger')))))+
      (flagged.length?'<details class="subtle"><summary>'+flagged.length+' possible duplicate'+(flagged.length===1?'':'s')+'</summary>'+table(['Date','Description','$Amount','Decision'],
        flagged.map(x=>row(dateCell(x.transaction.date),cell(H(x.transaction.description)+'<br><small>'+H(x.duplicate)+'</small>','desc'),amountCell(x.transaction.amount,true),cell(btn(x.force?'Keep this row':'Skip this row','toggle-duplicate',x.transaction.id,'mini',' aria-pressed="'+x.force+'"')))))+'</details>':'')+
      suggested+(pairs.length?'<label class="check"><input type="checkbox" id="include-pairs" checked>Apply suggested transfer matches</label>':'')+
      '<div class="actions">'+btn('Approve '+stagedRows.length+' transaction'+(stagedRows.length===1?'':'s'),'approve','','primary')+'</div></div>','Only approval writes to the ledger. Duplicate rows are skipped by default.');
  }
  async function approve() {
    const pair=Boolean(root.querySelector('#include-pairs')?.checked);
    const {stagedRows,pairs}=buildBatch();
    await write(next=>{
      next.transactions.push(...stagedRows.map(t=>structuredClone(t)));
      for(const packet of staging) {
        const count=stagedRows.filter(t=>t.importId===packet.id).length;
        const {items,...info}=packet;
        next.imports.push({...info,count,approved:E.today()});
      }
      if(pair) pairs.forEach(match=>applyPair(next,match.left.id,match.right.id,match.label));
    });
    staging=[];
    ledger={filter:'Review',account:'',month:'',category:'',project:'',search:''};
    ledgerPage=0;
    render();
    note(stagedRows.length+' transactions approved. Review the remaining questions below.');
  }
  function applyPair(next,left,right,label) {
    const a=byId(next.transactions,left),b=byId(next.transactions,right);
    if(!a||!b||a.pair||b.pair||a.account===b.account||a.amount!==-b.amount||a.allocations||b.allocations) throw new Error('The pair no longer matches.');
    for(const [entry,other] of [[a,b],[b,a]]) {
      entry.beforePair=pick(entry,'kind','category','project','why','manual');
      entry.kind='Transfer';entry.category=label;entry.project='';entry.pair=other.id;entry.why='Matched to '+other.description;entry.manual=true;
    }
  }
  function unpair(next,id) {
    const t=byId(next.transactions,id);
    if(!t?.pair) return;
    const other=byId(next.transactions,t.pair);
    for(const entry of [t,other].filter(Boolean)) {
      Object.assign(entry,entry.beforePair||{kind:'Review',category:'',project:'',why:'Previously linked transfer',manual:false});
      delete entry.beforePair;entry.pair='';
    }
  }
  function ledgerView() {
    let amounts=null;
    if(ledger.costBucket) {
      const report=E.monthlyCosts(S,E.today(),ledger.month);
      const rows=ledger.costBucket==='projects'?report.projects:report.posted[ledger.costBucket]||[];
      amounts=new Map();
      for(const t of rows)amounts.set(t.id,(amounts.get(t.id)||0)+t.amount);
    } else if(ledger.cashGroup) {
      const {tone,name}=ledger.cashGroup, flow=E.recordedCash(S,E.today(),ledger.month);
      amounts=(tone==='in'?flow.sources:flow.uses).find(x=>x.name===name)?.amounts||new Map();
    } else if(ledger.project&&ledger.label) {
      amounts=new Map();
      for(const t of E.ledgerRows(S.transactions)){
        if(t.kind==='Project'&&t.project===ledger.project)amounts.set(t.id,(amounts.get(t.id)||0)+t.amount);
      }
    }
    const source=S.transactions.filter(t=>{
      const slices=E.ledgerRows([t]);
      return (!ledger.account||t.account===ledger.account)&&(!ledger.month||E.month(t.date)===ledger.month)&&
        (!ledger.search||E.normal(t.description+' '+t.note).includes(E.normal(ledger.search)))&&
        (!amounts||amounts.has(t.id))&&(!ledger.through||t.date<=ledger.through)&&
        (!ledger.merchant||(E.normal(t.description)===ledger.merchant&&Math.sign(t.amount)===ledger.direction))&&
        slices.some(x=>(ledger.filter==='All'||x.kind===ledger.filter)&&(!ledger.category||x.category===ledger.category)&&(!ledger.project||x.project===ledger.project));
    }).sort((a,b)=>b.date.localeCompare(a.date)||a.description.localeCompare(b.description));
    const max=Math.max(0,Math.ceil(source.length/PAGE)-1);
    ledgerPage=Math.min(ledgerPage,max);
    const found=source.slice(ledgerPage*PAGE,(ledgerPage+1)*PAGE);
    const filters=(ledger.merchant?'<p class="small">Merchant history · '+H(ledger.merchant)+'</p>':'')+'<form id="ledger-filters" class="stack" autocomplete="off"><div class="form-grid cols-3">'+
      field('Type',select('filter',['All',...E.kinds],ledger.filter))+
      field('Account',select('account',accountOptions(()=>true,'All accounts'),ledger.account))+
      field('Month',f('month',ledger.month,'month'))+
      field('Category',select('category',[['','All categories'],...categoryOptions()],ledger.category))+
      field('Project',select('project',[['','All projects'],...projectOptions().slice(1)],ledger.project))+
      field('Find a merchant',f('search',ledger.search,'search','placeholder="Search descriptions or notes"'))+'</div>'+
      '<div class="actions"><button type="submit" class="btn">Apply filters</button>'+btn('Review queue','open-inbox','','mini')+btn('Add transaction','manual-transaction','','mini')+'</div></form>';
    const rows=found.map(t=>{
      const label=E.compoundDescription(t)?'Needs statement verification':t.allocations?.length?'Split':t.project?projectName(t.project):t.category||t.kind;
      const amount=amounts?.get(t.id)??t.amount;
      return '<li><div><small>'+H(dateLabel(t.date))+' · '+H(alias(t.account))+'</small>'+
        link(t.description,'transaction',t.id)+'<small>'+H(E.compoundDescription(t)?label:t.kind==='Review'?t.why:label+(t.pair?' · Linked':''))+'</small></div>'+
        '<strong class="money">'+money(amount)+'</strong></li>';
    });
    const navigation=source.length>PAGE?'<div class="table-controls">'+btn('Previous','ledger-page','-1','mini',ledgerPage?'':' disabled')+
      '<small>Page '+(ledgerPage+1)+' of '+(max+1)+'</small>'+btn('Next','ledger-page','1','mini',ledgerPage<max?'':' disabled')+'</div>':'';
    const total=amounts?E.sum(source,t=>amounts.get(t.id)):0;
    const drill=ledger.label?`${ledger.costBucket?btn('‹ Monthly costs','open-month-costs',ledger.month,'quiet'):''}<div class="category-total"><div><h3>${H(ledger.label)}</h3>
      <strong class="money">${money(ledger.project||ledger.costBucket?-total:Math.abs(total))}</strong></div>
      <p>${ledger.month?H(monthLabel(ledger.month)):'All recorded dates'}</p></div>`:'';
    const controls=drill?`<details class="subtle"><summary>Change ledger filters</summary>${filters}</details>`:filters;
    return '<div class="stack">'+drill+controls+'<p class="small">'+source.length+' matching transaction'+(source.length===1?'':'s')+'</p>'+
      (rows.length?'<ul class="list event-list transaction-list">'+rows.join('')+'</ul>'+navigation:no('No transactions match these filters.'))+'</div>';
  }
  function txTypeFields(t,suffix='') {
    const category=t?.category||'';
    const list=[['','Choose a category'],...categoryOptions(),['__other','Enter a new category']];
    if(category&&!list.some(x=>x===category)) list.splice(1,0,category);
    return field('Type',select('kind'+suffix,E.kinds,t?.kind||'Spending','data-type="'+suffix+'"'))+
      field('Category',select('category'+suffix,list,category,'data-cat="'+suffix+'"'))+
      field('New category',f('new_category'+suffix,'','text','maxlength="60"'),'Used when you choose Enter a new category.')+
      field('Project',select('project'+suffix,projectOptions(),t?.project||''));
  }
  function bindTypes(form) {
    for(const suffix of ['', '2']) {
      const kind=form.querySelector('[name="kind'+suffix+'"]');
      if(!kind)continue;
      const category=form.querySelector('[name="category'+suffix+'"]');
      const project=form.querySelector('[name="project'+suffix+'"]');
      const custom=form.querySelector('[name="new_category'+suffix+'"]');
      const update=()=>{
        const hasCategory=['Spending','Reimbursement','Income','Financing','Savings'].includes(kind.value);
        category.closest('label').hidden=!hasCategory;
        custom.closest('label').hidden=!hasCategory||category.value!=='__other';
        project.closest('label').hidden=kind.value!=='Project';
      };
      kind.addEventListener('change',update);
      category.addEventListener('change',update);
      update();
    }
  }
  function readType(form,suffix='') {
    const kind=val(form,'kind'+suffix), project=val(form,'project'+suffix);
    const chosen=val(form,'category'+suffix);
    const category=chosen==='__other'?val(form,'new_category'+suffix):chosen;
    if(!E.kinds.includes(kind)) throw new Error('Select a valid transaction type.');
    if(kind==='Project'&&!byId(S.projects,project)) throw new Error('Choose a project. You can add one in Spending.');
    if(['Spending','Reimbursement'].includes(kind)&&!category) throw new Error('Choose a spending category.');
    return {kind,category:kind==='Project'?'':category,project:kind==='Project'?project:''};
  }
  function transaction(id) {
    const t=byId(S.transactions,id);
    if(!t) return;
    if(E.compoundDescription(t))return fixStatementRow(id);
    if(t.pair) {
      const other=byId(S.transactions,t.pair);
      return confirmation('Linked payment','This '+money(t.amount)+' entry is linked to '+(other?.description||'another transaction')+' in '+alias(other?.account)+'.','Unlink payment',async()=>write(next=>unpair(next,id)));
    }
    const same=S.transactions.filter(x=>x.id!==t.id&&!x.manual&&!x.pair&&!x.allocations&&x.account===t.account&&Math.sign(x.amount)===Math.sign(t.amount)&&E.normal(x.description)===E.normal(t.description));
    const candidates=['Review','Transfer'].includes(t.kind)?S.transactions.filter(x=>x.id!==t.id&&!E.compoundDescription(x)&&!x.pair&&!x.allocations&&x.account!==t.account&&x.amount===-t.amount&&Math.abs(E.distance(x.date,t.date))<=7&&['Review','Transfer'].includes(x.kind)):[];
    const second=t.allocations?.[1];
    const form=openDialog('Review transaction','<p><strong>'+H(t.description)+'</strong> · '+money(t.amount)+' · '+H(t.date)+' · '+H(alias(t.account))+'</p>'+
      (t.why?'<p class="small">'+H(t.why)+'</p>':'')+
      (candidates.length?field('Link another side',select('other',[['','Keep unlinked'],...candidates.map(x=>[x.id,x.date+' · '+alias(x.account)+' · '+x.description])]),'Use for a transfer or credit card payment.'):'')+
      '<div class="form-grid">'+txTypeFields(t.allocations?.[0]||t)+'</div>'+
      '<details class="subtle"'+(second?' open':'')+'><summary>Split across two uses</summary><div class="form-grid">'+
      field('Amount for second use',f('split_amount',second?inputMoney(Math.abs(second.amount)):'','text','inputmode="decimal"'),'Enter a positive amount smaller than the full transaction.')+txTypeFields(second,'2')+'</div></details>'+
      field('Note',f('note',t.note,'text','maxlength="180"'))+
      check('Remember this exact description and direction for this account','remember')+
      (same.length?check('Apply to '+same.length+' other unreviewed row'+(same.length===1?'':'s')+' with the same description','repeat'):''),
      async data=>{
        const other=val(data,'other');
        if(other)return write(next=>applyPair(next,id,other,'Linked transfer or payment'));
        const main=readType(data);
        const split=dollarsField(data,'split_amount',{optional:true});
        let allocations;
        if(split!==null) {
          const next=readType(data,'2');
          if(split<=0||split>=Math.abs(t.amount)) throw new Error('The split must be smaller than the full transaction.');
          if([main,next].some(x=>!['Spending','Project','Reimbursement','Financing'].includes(x.kind))) throw new Error('Splits support spending, projects, reimbursements and financing.');
          if(data.has('repeat')||data.has('remember')) throw new Error('Save this split without a merchant rule or applying it to other rows.');
          const sign=Math.sign(t.amount);
          allocations=[{...main,amount:t.amount-sign*split},{...next,amount:sign*split}];
        }
        await write(next=>{
          Object.assign(byId(next.transactions,id),main,{manual:true,why:'Reviewed',note:val(data,'note'),allocations});
          if(data.has('repeat')) same.forEach(x=>Object.assign(byId(next.transactions,x.id),main,{manual:true,why:'Reviewed with matching merchant'}));
          if(data.has('remember')) next.rules.push({...main,account:t.account,merchant:E.normal(t.description),direction:Math.sign(t.amount)});
        });
      },'Save review');
    bindTypes(form);
    form.querySelector('[name=other]')?.addEventListener('change',event=>{
      if(event.target.value) {
        const kind=form.querySelector('[name=kind]');
        kind.value='Transfer';
        kind.dispatchEvent(new Event('change'));
      }
    });
  }
  function manualTransaction() {
    if(!localFile)return note('Open Aqueduct directly from Atlas before entering real transactions.',true);
    const form=openDialog('Add transaction','<div class="form-grid">'+field('Account',select('account',accountOptions(),'','required'))+
      field('Date',f('transaction_date',E.today(),'date','required'))+
      field('Description',f('description','','text','required maxlength="170"'))+
      field('Signed amount',f('amount','','text','inputmode="decimal" required'),'Negative money out. Positive money in.')+
      txTypeFields({kind:'Review'})+'</div>',
      async data=>{
        const account=val(data,'account');
        if(!byId(S.accounts,account)) throw new Error('Add or choose an account.');
        const amount=E.money(val(data,'amount'));
        if(amount===null||!amount) throw new Error('Enter a non-zero transaction amount.');
        const t={id:E.id(),account,date:dateField(data,'transaction_date'),description:titleField(data,'description'),amount,pair:'',manual:true,note:'',why:'Entered manually',...readType(data)};
        t.fingerprint=[t.date,E.normal(t.description),t.amount].join('|');
        await write(next=>next.transactions.push(t));
      });
    bindTypes(form);
  }
  const categoryName=category=>category==='Other'?'Miscellaneous':category;
  function spending() {
    if(categoryDetail&&spendingTab==='Categories')return spendingCategory();
    const viewTabs=segments(['Categories','Recurring','Projects'],spendingTab,'spending-tab','Spending view');
    const title=head('Spending',spendingTab==='Categories'?'Posted purchases and expenses by calendar month':'',monthCostLink());
    if(spendingTab==='Recurring')return title+viewTabs+field('Calendar month',f('month-view',month,'month','max="'+E.month(E.today())+'"'))+recurringView();
    if(spendingTab==='Projects')return title+viewTabs+spendingProjects();
    const now=E.today(), h=E.history(S,now,month);
    const report=E.monthlyCosts(S,now,month,h);
    const actualByCategory=new Map();
    for(const k of operatingCostKeys)for(const t of report.posted[k]){
      actualByCategory.set(t.category,(actualByCategory.get(t.category)||0)-t.amount);
    }
    const records=h.rows.map(x=>({...x,actual:actualByCategory.get(x.category)||0}))
      .filter(x=>x.actual||x.average||x.suggestion||Object.hasOwn(S.targets,x.category))
      .sort((a,b)=>Math.abs(b.actual)-Math.abs(a.actual)||(b.suggestion||0)-(a.suggestion||0)||a.category.localeCompare(b.category));
    const average=h.complete.length?E.sum(h.rows,x=>x.average):null;
    const selected=field('Viewing month',f('month-view',month,'month','max="'+E.month(now)+'"'));
    const low=Math.min(0,...records.map(x=>x.actual));
    const high=Math.max(0,...records.flatMap(x=>[x.actual,x.suggestion||0]));
    const axis=value=>(value-low)/Math.max(1,high-low)*100;
    const rows=records.map(x=>{
      const above=report.available&&x.suggestion!==null&&x.actual>x.suggestion;
      return `<li><button type="button" class="category-link" data-act="spending-drill" data-id="${H(x.category)}">
        <span class="category-line"><strong>${H(categoryName(x.category))}</strong>
        <b class="money">${money(report.available?x.actual:null)}</b>${arrow}</span>
        <span class="category-track" aria-hidden="true" style="--zero:${axis(0)}%">
          ${report.available?`<i class="category-actual${x.actual<0?' category-credit':''}" style="left:${axis(Math.min(0,x.actual))}%;width:${Math.abs(axis(x.actual)-axis(0))}%"></i>`:''}
          ${x.suggestion!==null?`<i class="category-marker" style="left:${axis(x.suggestion)}%"></i>`:''}</span>
        <span class="category-reference"><span>Target <b>${money(x.suggestion)}</b></span>
          ${above?`<b class="negative">${money(x.actual-x.suggestion)} over</b>`:x.actual<0?'<span>Net credit</span>':''}</span>
      </button></li>`;
    }).join('');
    const totals=`<section class="spend-board"><div class="spend-board-top">
      <div><h2>Recorded spending</h2><strong class="cash-number money">${money(report.available?report.ordinary:null)}</strong></div>${selected}</div>
      <div class="spend-board-compare"><div><span>Monthly average</span><b>${money(average)}</b></div>
      <div><span>Full-month target</span><b>${money(h.rows.some(x=>x.suggestion!==null)?E.sum(h.rows,x=>x.suggestion||0):null)}</b></div></div></section>`;
    const alerts=`<div class="spending-alerts">
      ${h.review.length?link(h.review.length+' uncategorized this month','month-inbox',month):''}
      ${h.baselineReview?'<span>'+h.baselineReview+' uncategorized in baseline months</span>':''}</div>`;
    return title+viewTabs+totals+(h.review.length||h.baselineReview?alerts:'')+
      `<div class="spending-layout">
        ${panel('Categories',rows?`<div class="chart-key"><span class="key-in">Recorded</span><span class="key-average">Target marker</span></div>
          <ul class="category-links">${rows}</ul>`:no('No spending categories are available for this period.'),'',btn('Add target','target-edit','','mini quiet'))}
        <div class="spending-rail">
          ${panel('Cost mix',spendingPie(report),'Fixed bills, recurring charges and flexible spending')}
          ${btn('Monthly review','monthly-close','','quiet')}
        </div>
      </div>`;
  }
  function spendingCategory() {
    const now=E.today(), h=E.history(S,now,month);
    const category=categoryDetail, name=categoryName(category);
    const totals=h.rows.find(x=>x.category===category);
    const relevant=rows=>rows.filter(t=>E.isSpending(t)&&t.category===category);
    const actual=relevant(h.current).filter(t=>t.date<=now), historical=relevant(h.past);
    const settings=S.targets[category];
    const isActual=categoryPeriod==='Recorded';
    const basis=settings?.method==='Fixed'||settings?.method==='Annual';
    const usedMonths=isActual||categoryPeriod==='Target'&&basis?[]:categoryPeriod==='Target'?h.complete.slice(0,3):h.complete;
    const included=historical.filter(t=>usedMonths.includes(E.month(t.date)));
    const source=(isActual?actual:included).sort((a,b)=>b.date.localeCompare(a.date)||a.description.localeCompare(b.description));
    const pageMax=Math.max(0,Math.ceil(source.length/PAGE)-1);
    categoryPage=Math.min(pageMax,categoryPage);
    const actualTotal=E.monthlyCosts(S,now,month,h).available?E.spendingTotal(actual):null;
    const selectedTotal=isActual?actualTotal:categoryPeriod==='Average'?totals?.average:totals?.suggestion;
    const basisLabel=categoryPeriod==='Target'&&basis?
      (settings.method==='Annual'?money(settings.amount)+' annual plan ÷ 12':'Fixed amount you set'):
      isActual?monthLabel(month):usedMonths.length?usedMonths.length+' complete months':'No complete months yet';
    const monthRows=usedMonths.map(period=>`<li><span>${H(monthLabel(period))}</span>
      <strong class="money">${money(E.spendingTotal(included.filter(t=>E.month(t.date)===period)))}</strong></li>`).join('');
    const transactionRows=source.slice(categoryPage*PAGE,(categoryPage+1)*PAGE).map(t=>`<li>
      <div><small>${H(dateLabel(t.date))} · ${H(alias(t.account))}</small>
      ${link(t.description,'transaction',t.id)}</div>
      <strong class="money">${t.amount>0?signedMoney(t.amount):money(-t.amount)}</strong></li>`).join('');
    const navigation=source.length>PAGE?`<div class="table-controls">
      ${btn('Previous','category-page','-1','mini',categoryPage?'':' disabled')}
      <small>Page ${categoryPage+1} of ${pageMax+1}</small>
      ${btn('Next','category-page','1','mini',categoryPage<pageMax?'':' disabled')}</div>`:'';
    return `<div class="category-back">${btn('‹ All categories','category-back','','quiet')}</div>
      ${head(name,monthLabel(month),btn('Edit target','target-edit',category,'quiet'))}
      ${segments(['Recorded','Average','Target'],categoryPeriod,'category-period','Category amount to explain')}
      <section class="category-total"><div><h2>${H(categoryPeriod)}</h2><strong class="money">${money(selectedTotal)}</strong></div>
      <p>${H(basisLabel)}</p></section>
      ${monthRows?`<details class="subtle category-months"><summary>Months used</summary><ul class="list">${monthRows}</ul></details>`:''}
      ${categoryPeriod==='Target'&&basis?
        panel('Target basis',`<p>${H(totals?.rationale||basisLabel)}</p>`):
        panel('Transactions included',transactionRows?`<ul class="list event-list category-transactions">${transactionRows}</ul>${navigation}`:
          no('No matching purchases or refunds for this selection.'),source.length?source.length+' entries · Refunds reduce the total':'')}
    `;
  }
  function openCategory(category,period=month,basis='Recorded') {
    categoryDetail=category;categoryPeriod=basis;categoryPage=0;month=period;spendingTab='Categories';
    go('Spending');
    root.querySelector('h1')?.setAttribute('tabindex','-1');
    root.querySelector('h1')?.focus({preventScroll:true});
  }
  function spendingProjects() {
    const tx=E.ledgerRows(S.transactions);
    const projects=S.projects.length?S.projects.map(p=>{
      const spent=E.sum(tx.filter(t=>t.kind==='Project'&&t.project===p.id),t=>-t.amount);
      const future=E.paymentWindow(S,E.today(),E.add(E.today(),730)).filter(b=>b.direction==='Bill'&&b.project===p.id&&!['Paid','Skipped'].includes(b.status));
      const outstanding=E.sum(future,b=>b.forecastAmount||0);
      const unknown=future.filter(b=>b.forecastAmount===null).length;
      const financed=byId(S.loans,p.loan);
      return '<li><div>'+link(p.name,'project-drill',p.id)+' '+pill(p.status,p.status==='Complete'?'dim':'')+
        '<small class="small">Open scheduled invoices '+money(outstanding)+(unknown?' + '+unknown+' with amount unknown':'')+' · unbilled estimate '+money(p.unbilled)+'</small>'+
        (financed?'<small class="small">Linked debt '+H(financed.name)+' · account balance '+money(financed.balance)+'</small>':'')+
        (p.note?'<small class="small">'+H(p.note)+'</small>':'')+'</div><div class="row-actions"><strong class="money">'+money(spent)+'</strong>'+btn('Edit','project-edit',p.id,'mini')+'</div></li>';
    }).join(''):'';
    return '<div id="spending-projects" class="section-gap">'+panel('One-time projects',projects?'<ul class="list">'+projects+'</ul>':no('Add a project such as Basement, then tag its purchases in the transaction review.'),'Project totals use all imported dates. Financing stays in Debt & goals.',btn('Add project','project-edit','','mini primary'))+'</div>';
  }
  function segments(labels,active,action,name) {
    return '<div class="segments" role="group" aria-label="'+H(name)+'">'+labels.map(label=>
      btn(label,action,label,'',' aria-pressed="'+String(label===active)+'"')).join('')+'</div>';
  }
  const monthCostLabels={fixed:'Fixed bills',recurring:'Recurring charges',flexible:'Flexible spending',projects:'One-time projects'};
  const operatingCostKeys=['fixed','recurring','flexible'];
  function monthCostLink(period=month) {
    return btn('Monthly costs','open-month-costs',period,'quiet');
  }
  function monthCostChart(comparison) {
    const {actual,reference,through,priorEnd,basis}=comparison;
    if(!actual)return no('Add statements for this month to see recorded costs.');
    const amounts=[...Object.values(actual),...Object.values(reference||{})];
    const min=Math.min(0,...amounts), max=Math.max(0,...amounts);
    const axis=value=>(value-min)/Math.max(1,max-min)*100;
    const referenceLabel=basis==='plan'?'Plan':'Prior';
    const series=(label,amount,tone)=>`<div class="cost-series">
      <span>${label}</span><span class="cost-series-track" aria-hidden="true" style="--zero:${axis(0)}%">
        <i class="${tone}" style="left:${axis(Math.min(0,amount))}%;width:${Math.abs(axis(amount)-axis(0))}%"></i>
      </span><b class="money">${money(amount)}</b></div>`;
    const caption=basis==='plan'?'Full month · compared with the current plan':
      basis==='prior'?'Days 1–'+Number(through.slice(8))+' · '+dateLabel(through)+' vs '+dateLabel(priorEnd):
      'Posted through '+dateLabel(through)+' · comparison unavailable';
    const rows=operatingCostKeys.map(k=>{
      const delta=reference?actual[k]-reference[k]:null;
      const deltaLabel=delta===0?'On par':delta===null?'':money(Math.abs(delta))+(delta>0?' higher':' lower');
      return `<li><div class="cost-row-title">
        ${link(monthCostLabels[k],'month-cost-drill',JSON.stringify([k,through]))}
        ${deltaLabel?`<span class="cost-delta${delta>0?' cost-over':''}">${deltaLabel}</span>`:''}
        </div>${series('Actual',actual[k],'cost-actual')}${reference?series(referenceLabel,reference[k],'cost-reference'):''}</li>`;
    }).join('');
    const scale=max!==min?`<div class="cost-axis" aria-hidden="true"><span></span><div><span>${chartMoney(min)}</span>${min<0&&max>0?`<span class="cost-axis-zero" style="left:${axis(0)}%">${chartMoney(0)}</span>`:''}<span>${chartMoney(max)}</span></div><span></span></div>`:'';
    return panel(basis==='plan'?'Actual vs plan':basis==='prior'?'Spending pace':'Operating costs',
      `<ul class="cost-comparison">${rows}</ul>${scale}`,caption);
  }
  function monthCostsView() {
    const now=E.today(), report=E.monthlyCosts(S,now,month), plan=E.monthlySnapshot(S,now);
    const picker=field('Calendar month',f('month-view',month,'month','max="'+E.month(now)+'"'));
    const comparison=E.monthlyCostComparison(S,report,plan);
    const planTotal=plan.fixed+plan.recurring+plan.variable+plan.minimums;
    const isShorter=comparison.through<report.through;
    const planRows=[...operatingCostKeys.map(k=>[monthCostLabels[k],k==='flexible'?plan.variable:plan[k]]),['Debt minimums',plan.minimums]];
    const chart=monthCostChart(comparison);
    const opening=`<section class="cost-opening">
      <div class="cost-lead"><h2>Recorded costs</h2><strong class="money">${money(report.available?report.total:null)}</strong>
        <p>${report.available?'Posted through '+H(dateLabel(report.through)):'Awaiting statements'}${report.gaps.length?' · '+report.gaps.length+' account gaps':''}</p></div>
      <div class="cost-plan"><h2>Full-month plan</h2><b class="money">${money(plan.missingOperating?null:planTotal)}</b>
        <p>${plan.missingOperating?'Budget inputs missing':'Includes debt minimums'}</p>
        ${plan.missingOperating?'':`<details><summary>Plan breakdown</summary><dl>${planRows.map(([name,value])=>
          `<div><dt>${name}</dt><dd class="money">${money(value)}</dd></div>`).join('')}</dl>
          ${plan.needsMatch.length?`<p>${plan.needsMatch.length} bill schedules need matching.</p>`:''}
          ${link('Debt repayment plan','nav','Monthly snapshot')}</details>`}
      </div></section>`;
    const projectLine=`<div class="cost-separate">
      <div>${link(monthCostLabels.projects,'month-cost-drill','projects')}<small>Included in recorded costs · outside the monthly plan</small></div>
      <strong class="money">${money(report.available?report.projectTotal:null)}</strong>
    </div>`;
    const status=isShorter||report.review?`<div class="cost-status">
      ${isShorter?`<p>Comparison stops at ${H(dateLabel(comparison.through))}, the latest date with matching coverage.</p>`:''}
      ${report.review?link(report.review+' transactions in Review','month-inbox',month):''}</div>`:'';
    const lines=report.billRows.map(({event:e,matched,paymentOnly})=>`<li><div>
      <small>${H(dateLabel(e.date))} · ${H(e.status==='Paid'?'Marked paid':matched?'Matched to a posted charge':paymentOnly?'Debt or card payment':e.variable?'Estimated':'Scheduled')}</small>
      ${link(e.name,'occurrence',e.key)}
      ${matched?`<small>${link('View posted charge','transaction',matched.id)}</small>`:''}
      </div><b class="money">${money(e.forecastAmount)}</b></li>`).join('');
    const timing=`<details class="panel home-disclosure"><summary>Bill schedule for ${H(monthLabel(month))} · ${report.billRows.length}</summary>
      ${lines?`<ul class="list event-list">${lines}</ul>`:no('There are no scheduled bills for this calendar month.')}
      ${link('Open upcoming Bills','nav','Bills')}</details>`;
    return head('Monthly costs','',picker)+opening+chart+projectLine+status+
      `<div class="decision-tools">${link('Recurring charge audit','open-recurring')}${link('Spending categories','open-spending-period',month)}${link('Upcoming Bills','nav','Bills')}</div>`+
      timing+
      `<details class="subtle section-gap"><summary>How the totals reconcile</summary><p class="small">Fixed bills are commitments such as the mortgage, utilities and insurance. Their amounts can vary. Subscriptions and memberships show under recurring charges. Flexible purchases include groceries, dining and shopping. The recorded total also includes projects and subtracts refunds. The Bills schedule shows when to fund payments. Credit card purchases enter recorded costs when posted. Their repayments appear in the Bills schedule. The planning baseline includes required debt payments separately.</p></details>`;
  }
  function recurringView() {
    const now=E.today(), report=E.monthlyCosts(S,now,month);
    const audit=report.audit.rows;
    const stats=`<section class="recurring-summary">
      <div><span>Recorded recurring charges</span><strong class="money">${money(report.available?report.totals.recurring:null)}</strong></div>
      <div><span>Pattern-based monthly estimate</span><b class="money">${money(E.sum(audit.filter(x=>!x.householdBill),x=>x.monthly))}</b></div>
    </section>`;
    const group=(item)=>{
      const t=item.transaction;
      const recent=item.rows.slice().sort((a,b)=>b.date.localeCompare(a.date));
      const rows=recent.filter(x=>E.month(x.date)===month);
      const older=recent.filter(x=>E.month(x.date)!==month);
      const frequencies=[...new Set(item.patterns.map(p=>p.frequency))];
      const cadenceLabel=frequencies.length>1?'Multiple frequencies':frequencies[0]||'Frequency unconfirmed';
      const status=item.status==='Pattern found'?'':item.status;
      const recentPrices=[...new Set(recent.filter(x=>x.amount<0).slice(0,6).map(x=>-x.amount))];
      const prices=recentPrices.length>1?`<p class="recurring-prices"><b>Recent posted prices</b>
        <span>${recentPrices.map(money).join(' · ')}</span></p>`:'';
      const list=entries=>`<ul class="list event-list">${entries.map(x=>`<li><div><small>${H(dateLabel(x.date))} · ${H(alias(x.account))}</small>
        ${link(x.description,'transaction',x.id)}</div><b class="money">${x.amount>0?signedMoney(x.amount):money(-x.amount)}</b></li>`).join('')}</ul>`;
      const patterns=item.patterns.map(p=>`<li><span>${H(p.frequency)} · ${money(p.amount)}</span><small>${H(p.status)} · ${H(dateLabel(p.last))}</small></li>`).join('');
      return `<details class="subtle recurring-group"><summary><span><strong>${H(t.description)}</strong>
        <small>${H(cadenceLabel)}${status?' · '+H(status):''}</small>
        <small>Last charge · ${H(dateLabel(t.date))} · ${money(-t.amount)}</small></span>
        <span class="renewal-amount"><b class="money">${item.monthly>0?money(item.monthly):'—'}</b><small>Monthly equiv.</small></span></summary>
        <div class="recurring-expanded"><p class="small">${H(alias(t.account))} · ${money(item.recorded)} posted in ${H(monthLabel(month))}</p>
        ${prices}${patterns?`<ul class="list recurring-patterns">${patterns}</ul>`:''}
        ${rows.length?list(rows):'<p class="small">No charges posted in this month.</p>'}
        ${older.length?`<details class="subtle"><summary>Earlier posted charges</summary>${list(older.slice(0,6))}</details>`:''}</div></details>`;
    };
    const charges=audit.filter(x=>!x.householdBill).sort((a,b)=>b.monthly-a.monthly||b.recorded-a.recorded);
    const fixed=audit.filter(x=>x.householdBill);
    const chargeList=charges.length?charges.map(group).join(''):no('Recurring charges appear when statement activity identifies a subscription or a payment pattern.');
    return stats+panel('Recurring charge audit',chargeList+link('View all posted charges','month-cost-drill','recurring'))+
      (fixed.length?`<details class="panel home-disclosure"><summary>Recurring fixed bills · ${fixed.length}</summary>${fixed.map(group).join('')}</details>`:'')+
      `<details class="subtle section-gap"><summary>How the run rate is estimated</summary><p class="small">Charges at separate prices are checked for their own pattern. The run rate uses patterns with recent evidence and a regular interval. Check renewal dates for merchants with irregular amounts, incomplete statements or older activity. The recorded figure uses posted transactions for the selected month, including subscription charges awaiting confirmation.</p></details>`;
  }
  function monthlyClose() {
    const now=E.today(), start=month+'-01', end=E.monthEnd(start), history=E.history(S,now,month);
    const included=S.accounts.filter(a=>a.history && (!a.openDate||a.openDate<=end) && (!a.closeDate||a.closeDate>=start));
    const gaps=included.filter(a=>{
      const from=a.openDate&&a.openDate>start?a.openDate:start;
      const until=a.closeDate&&a.closeDate<end?a.closeDate:end;
      return !E.coverage(S,a.id,from,until);
    });
    const open=E.events(S,start,end).filter(e=>e.direction!=='Income'&&e.date<=now&&!['Paid','Skipped'].includes(e.status));
    const variances=history.rows.filter(r=>r.suggestion!==null&&r.actual!==r.suggestion).sort((a,b)=>Math.abs(b.actual-b.suggestion)-Math.abs(a.actual-a.suggestion)).slice(0,5);
    const details='<ul class="list"><li>Statement coverage <strong>'+(!included.length?'No accounts in scope':gaps.length?H(gaps.length)+' account gaps':'Confirmed')+'</strong></li>'+
      '<li>Transaction questions <strong>'+history.review.length+'</strong></li><li>Due dates still open <strong>'+open.length+'</strong></li>'+
      '<li>One-time project costs <strong class="money">'+money(history.projects)+'</strong></li></ul>';
    return openDialog(monthLabel(month)+' monthly review',
      (end>now?banner('This month is still in progress.'):'')+details+
      (gaps.length?'<p class="small">Check coverage for '+H(gaps.map(a=>a.name).join(', '))+'.</p>':'')+
      (variances.length?table(['Largest differences','$Actual','$Target','$Over / under'],variances.map(r=>row(cell(H(r.category)),amountCell(r.actual),amountCell(r.suggestion),amountCell(r.actual-r.suggestion)))):'')+
      '<p class="small">Resolve questions, review upcoming obligations, and save an encrypted backup when the month is ready.</p>',()=>{},'Done');
  }
  function targetEdit(category) {
    const t=S.targets[category]||{};
    return openDialog('Category target','<div class="form-grid">'+
      field('Category',f('category',category,'text','required maxlength="60"'))+
      field('Approach',select('method',['Recent history','Fixed','Annual'],t.method||'Recent history'))+
      field('Amount',f('amount',inputMoney(t.amount),'text','inputmode="decimal"'),'Enter the monthly amount for Fixed or the full-year amount for Annual.')+
      field('Reason',f('note',t.note,'text','maxlength="140"'))+'</div>',
      async data=>{
        const name=titleField(data,'category'), method=val(data,'method');
        if(['__proto__','prototype','constructor','__other'].includes(name)) throw new Error('Choose a different category name.');
        if(category&&name!==category) throw new Error('Use the original category name or add a new target.');
        const amount=method==='Recent history'?null:dollarsField(data,'amount');
        await write(next=>Object.defineProperty(next.targets,name,{value:{method,amount,note:val(data,'note')},enumerable:true,configurable:true,writable:true}));
      });
  }
  function projectEdit(id) {
    const p=byId(S.projects,id)||{};
    return openDialog(p.id?'Edit project':'Add project','<div class="form-grid">'+field('Project name',f('name',p.name,'text','required maxlength="80"'))+
      field('Status',select('status',['Active','Planned','Complete'],p.status||'Active'))+
      field('Unbilled cost to finish',f('unbilled',inputMoney(p.unbilled),'text','inputmode="decimal"'),'Enter an estimate for work outside invoices already scheduled in Bills.')+
      field('Linked debt account',select('loan',[['','No linked debt'],...S.loans.map(x=>[x.id,x.name])],p.loan))+
      field('Note',f('note',p.note,'text','maxlength="150"'),'',true)+'</div>',
      async data=>{
        const value={id:p.id||E.id(),name:titleField(data),status:val(data,'status'),unbilled:dollarsField(data,'unbilled',{optional:true}),loan:val(data,'loan'),note:val(data,'note')};
        await write(next=>replace(next.projects,value));
      });
  }
  function scheduleSummary(open,now,end) {
    const dated=open.filter(e=>e.date>=now);
    const income=dated.filter(e=>e.direction==='Income');
    const bills=open.filter(e=>e.direction==='Bill');
    const inTotal=E.sum(income,e=>e.forecastAmount||0), outTotal=E.sum(bills,e=>e.forecastAmount||0);
    const scale=Math.max(inTotal,outTotal,1);
    const unknown=income.concat(bills).filter(e=>e.forecastAmount===null).length;
    const nextStart=E.shiftMonth(E.monthStart(now),1), nextEnd=E.monthEnd(nextStart);
    const monthIncome=E.events(S,nextStart,nextEnd).filter(e=>e.direction==='Income'&&!['Paid','Skipped'].includes(e.status));
    const monthTotal=E.sum(monthIncome,e=>e.forecastAmount||0);
    const next=monthIncome.length?monthIncome:income.slice(0,3);
    return '<div class="home-grid bill-overview">'+panel('Scheduled money in and out',
      '<ul class="amount-list">'+cashBar('Expected deposits',inTotal,scale,'in')+cashBar('Open bills and debt payments',outTotal,scale,'out')+'</ul>'+
      '<p class="small section-gap">'+(unknown?unknown+' amounts pending. ':'')+'Includes overdue open bills and estimated amounts. Internal transfers are listed separately below.</p>',
      'Through '+dateLabel(end))+
      panel(monthIncome.length?'Expected income · '+monthLabel(nextStart):'Next income sources',
        (monthIncome.length?'<p class="next-pay"><span>Known deposits</span><strong class="money">'+money(monthTotal)+'</strong></p>':'')+
        (next.length?'<ul class="list event-list">'+next.map(e=>eventItem(e,now)).join('')+'</ul>':
        no('Add paycheques and household deposits to see the next amounts and dates.')),'Scheduled estimates')+'</div>';
  }
  function bills() {
    const now=E.today(), end=postingWindow||E.add(now,S.config.window), p=E.forecast(S,now);
    const all=E.paymentWindow(S,now,end);
    const open=all.filter(x=>!['Paid','Skipped'].includes(x.status));
    const closed=all.filter(x=>['Paid','Skipped'].includes(x.status));
    const transfers=open.filter(x=>x.direction==='Transfer');
    const alerts=new Set(p.shortfalls.map(x=>x.key));
    const section=(title,items,empty)=>panel(title,items.length?'<ul class="list event-list">'+items.map(x=>eventItem(x,now,alerts)).join('')+'</ul>':no(empty));
    const plans=S.bills.map(x=>'<li><div>'+link(x.name,'bill-edit',x.id)+'<small class="small">'+H(x.frequency)+' · '+H(alias(x.account))+'</small></div><strong class="money">'+money(x.amount)+'</strong></li>');
    return head('Bills & paydays','Payment calendar through '+dateLabel(end),'<div class="actions">'+monthCostLink()+btn('Add a date','bill-edit','','primary')+btn('Reminders','calendar')+'</div>')+
      scheduleSummary(open,now,end)+
      '<div class="actions section-tools">'+btn(postingWindow?'Show standard window':'Show 90 days','bill-window','','mini quiet')+'</div>'+
      '<div class="home-grid">'+section('Bills & debt payments',open.filter(x=>x.direction==='Bill'),'No open payments in this window.')+
      section('Paydays and deposits',open.filter(x=>x.direction==='Income'&&x.date>=now),'No upcoming deposits in this window.')+'</div>'+
      (transfers.length?'<details class="subtle section-gap"><summary>Internal transfers ('+transfers.length+')</summary><ul class="list event-list">'+transfers.map(x=>eventItem(x,now,alerts)).join('')+'</ul></details>':'')+
      (closed.length?'<details class="subtle section-gap"><summary>Paid and skipped ('+closed.length+')</summary><ul class="list event-list">'+closed.map(x=>eventItem(x,now)).join('')+'</ul></details>':'')+
      '<details class="subtle section-gap"><summary>Manage schedules ('+plans.length+')</summary>'+
      (plans.length?'<ul class="list">'+plans.join('')+'</ul>':no('No schedules yet.'))+'</details>';
  }
  function billEdit(id,loan) {
    const b=byId(S.bills,id)||(id==='income'?{direction:'Income'}:{...(loan?{name:loan.name,amount:loan.payment,frequency:frequency.includes(loan.frequency)?loan.frequency:'Monthly',loan:loan.id,account:loan.account,start:loan.nextDue}:null)});
    return openDialog(b.id?'Edit schedule':'Add bill or paycheque','<div class="form-grid">'+
      field('Name',f('name',b.name,'text','required maxlength="80"'))+
      field('Type',select('direction',['Bill','Income','Transfer'],b.direction||'Bill'))+
      field('Funding or receiving account',select('account',accountOptions(cash),b.account))+
      field('Transfer destination',select('to_account',accountOptions(cash,'Only for transfers'),b.toAccount))+
      field('Typical amount',f('amount',inputMoney(b.amount),'text','inputmode="decimal"'),'Leave blank if unknown. Record the confirmed amount on the occurrence.')+
      field('First due or deposit date',f('start',b.start||E.today(),'date','required'))+
      field('Frequency',select('frequency',frequency,b.frequency||'Monthly'),'Enter two monthly schedules for semimonthly bills or pay.')+
      field('End date',f('end',b.end,'date'))+
      field('Payment method',select('mode',['Manual','Autopay','Deposit'],b.mode||'Manual'))+
      field('Project invoice',select('project',projectOptions(),b.project))+
      field('Related debt',select('loan',[['','No linked debt'],...S.loans.map(x=>[x.id,x.name])],b.loan))+
      '</div>'+check('Amount varies. Treat the typical amount as an estimate.','variable',b.variable)+
      field('Note',f('note',b.note,'text','maxlength="180"')),
      async data=>{
        const start=dateField(data,'start'), end=dateField(data,'end',true);
        if(end&&end<start) throw new Error('End date must be on or after the first date.');
        const direction=val(data,'direction');
        const value={id:b.id||E.id(),...Object.fromEntries(['name','account','frequency','project','loan','note'].map(k=>[k,val(data,k)])),
          direction,mode:direction==='Income'?'Deposit':val(data,'mode')==='Autopay'?'Autopay':'Manual',amount:dollarsField(data,'amount',{optional:true}),start,end,variable:data.has('variable')};
        if(!value.name) throw new Error('Enter a schedule name.');
        value.toAccount=direction==='Transfer'?val(data,'to_account'):'';
        if(direction==='Transfer'&&(!value.account||!value.toAccount||value.account===value.toAccount)) throw new Error('Choose two different cash accounts for the transfer.');
        if(direction!=='Bill'){value.project='';value.loan='';}
        await write(next=>replace(next.bills,value));
      },'Save schedule',b.id?btn('Remove schedule','delete-bill',b.id,'danger'):'');
  }
  function occurrence(key) {
    const [id,date]=key.split('/');
    const b=byId(S.bills,id);
    if(!b||!E.validDate(date)) return;
    const status=S.billStatus[key]||{};
    const matches=S.transactions.filter(t=>t.account===b.account&&Math.abs(E.distance(t.date,date))<=4&&b.amount!==null&&
      t.amount===(b.direction==='Bill'?-1:1)*(status.amount??b.amount));
    return openDialog('Review due date','<p><strong>'+H(b.name)+'</strong> · '+H(date)+' · '+H(alias(b.account))+'</p>'+
      (b.note?'<p class="small">'+H(b.note)+'</p>':'')+
      '<div class="form-grid">'+field('Payment status',select('status',['Open','Paid','Skipped'],status.status||'Open'))+
      field('Amount for this occurrence',f('amount',inputMoney(status.amount),'text','inputmode="decimal"'),'Leave blank to use the usual amount '+money(b.amount)+'.')+'</div>'+
      (matches.length?'<p class="small">Possible matching activity: '+matches.slice(0,6).map(t=>H(t.date)+' '+H(t.description)).join(' · ')+'</p>':'')+
      '<p class="small">Choose Paid once it clears the funding account. If a due date moves, skip this occurrence and add a one-time schedule for the new date.</p>',
      async data=>write(next=>{next.billStatus[key]={status:val(data,'status'),amount:dollarsField(data,'amount',{optional:true})};}),
      'Save status',btn('Edit schedule','bill-edit',id,''));
  }
  function calendar() {
    return openDialog('Calendar reminders','<p>Export upcoming manual bills and available rate or renewal dates to a separate calendar on your Mac. Use an On My Mac calendar if you want events to stay on that device. Enable alerts for that calendar.</p>'+
      '<div class="form-grid">'+field('Days to export',select('window',['30','60','90','180','365'],'90'))+
      field('Business days before a bill',select('lead',['1','2','3','5'],'2'))+'</div>'+
      check('Use bill and loan nicknames as event titles','names')+
      check('Include autopay dates with a projected shortfall','autopay',true)+
      '<p class="small">Exports are snapshots. After major changes, replace the dedicated calendar’s events with a fresh export. Reminder lead time counts weekdays. Statutory holidays may affect actual processing.</p>',
      data=>{
        const days=Number(val(data,'window')), lead=Number(val(data,'lead'));
        const now=E.today(), end=E.add(now,days);
        const short=new Set(E.forecast(S,now).shortfalls.filter(x=>!x.originalDate).map(x=>x.key));
        const records=E.events(S,now,end).filter(x=>x.direction!=='Income'&&['Open'].includes(x.status)&&
          (x.mode==='Manual'||data.has('autopay')&&short.has(x.key))).map(x=>({
            key:x.key,date:x.date,name:data.has('names')?x.name:x.direction==='Transfer'?'Household transfer due':x.mode==='Manual'?'Household bill due':'Check funds for automatic payment',
            lead:Math.min(E.distance(now,x.date),businessLead(x.date,lead))
          }));
        for(const loan of S.loans) {
          const dates=[['renewal',loan.renewal],['rate',loan.rateDate]].filter(([,d])=>d&&d>=now&&d<=end);
          const unique=new Set();
          for(const [kind,d] of dates) {
            if(unique.has(d))continue;
            unique.add(d);
            records.push({key:loan.id+'/'+kind,date:d,name:data.has('names')?loan.name+' term review':'Review household borrowing terms',
              lead:Math.min(14,E.distance(now,d))});
          }
        }
        if(!records.length) throw new Error('No upcoming events match the export settings.');
        download(calendarFile(records),'Aqueduct-Reminders.ics','text/calendar;charset=utf-8');
        note(records.length+' reminder'+(records.length===1?'':'s')+' downloaded.');
      },'Download calendar');
  }
  function businessLead(date,n) {
    let back=0, counted=0;
    while(counted<n) {
      back++;
      const day=new Date(E.add(date,-back)+'T00:00:00Z').getUTCDay();
      if(day>0&&day<6)counted++;
    }
    return back;
  }
  function calendarFile(records) {
    const escape=s=>String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/[,;]/g,m=>'\\'+m);
    const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
    const fold=line=>{
      const out=[]; let text='',length=0;
      const encoder=new TextEncoder();
      for(const c of line) {
        const size=encoder.encode(c).length;
        if(length+size>75){out.push(text);text=' ';length=1;}
        text+=c; length+=size;
      }
      out.push(text);return out.join('\r\n');
    };
    const entries=records.flatMap(x=>['BEGIN:VEVENT','UID:'+x.key.replace(/[^A-Za-z0-9-]/g,'-')+'@aqueduct.local',
      'DTSTAMP:'+stamp,'DTSTART:'+x.date.replaceAll('-','')+'T090000','DURATION:PT15M','SUMMARY:'+escape(x.name),'CLASS:PRIVATE','TRANSP:TRANSPARENT',
      'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:'+(x.lead?'-P'+x.lead+'D':'-PT0M'),'DESCRIPTION:'+escape(x.name),'END:VALARM','END:VEVENT']);
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Aqueduct//Offline Reminders//EN','CALSCALE:GREGORIAN',...entries,'END:VCALENDAR'].map(fold).join('\r\n')+'\r\n';
  }
  function debtGuidance(profile,forecast,now) {
    const target=profile.target;
    const overdue=forecast.overdue.filter(x=>x.loan||/minimum|mortgage|loan|credit card/i.test(x.name));
    const billsWithoutDebt=S.bills.filter(b=>b.direction==='Bill'&&/mortgage/i.test(b.name)&&!b.loan&&(!b.end||b.end>=now));
    const openIssues=[];
    if(forecast.stale.length||forecast.missing.length)openIssues.push(btn('Verify cash balances','account-settings','','mini quiet'));
    const unfunded=forecast.unassigned.find(e=>e.loan);
    if(unfunded)openIssues.push(btn('Review '+unfunded.name,'occurrence',unfunded.key,'mini quiet'));
    for(const l of profile.missing.slice(0,2))openIssues.push(btn('Confirm terms · '+l.name,'loan-edit',l.id,'mini quiet'));
    if(billsWithoutDebt.length&&!S.loans.some(l=>l.type==='Mortgage'))openIssues.push(btn('Add mortgage terms','loan-edit','','mini quiet'));
    const detail=target?`<p>${H(target.currentRate+'% on file')} · Highest eligible rate</p>`:'';
    return `<section class="debt-lead">
      <div><h2>First candidate for extra payments</h2><strong>${H(target?.name||'Confirm your rates')}</strong>${detail}</div>
      <div>
        ${overdue.length?`<p>${link(overdue[0].name,'occurrence',overdue[0].key)} is still marked overdue.</p>`:''}
        <div class="actions">${btn('Compare repayment scenarios','nav','Monthly snapshot')}${btn('Check cash timing','nav','Cash plan','quiet')}</div>
      </div></section>`+(openIssues.length?`<details class="subtle section-gap"><summary>Before committing an extra payment</summary>
        <div class="actions">${openIssues.join('')}</div></details>`:'');
  }
  function debtRanking(profile) {
    const max=Math.max(1,...profile.ranked.map(l=>l.currentRate));
    const ranked=profile.ranked.map(l=>'<li><div class="amount-caption">'+link(l.name,'loan-edit',l.id)+'<strong>'+H(l.currentRate)+'%</strong></div>'+
      bar(l.currentRate,max,l.id===profile.target?.id?'priority':'rate')+
      '<small>'+money(l.balance)+' balance · '+H(l.rateType||'Rate on file')+(l.asOf?' · as of '+H(l.asOf):'')+'</small></li>');
    const unranked=profile.active.filter(l=>!profile.ranked.some(r=>r.id===l.id));
    const thin=profile.underInterest.length?'<div class="interest-gap"><h3>Payment amounts to verify</h3><ul class="list">'+profile.underInterest.map(l=>
      '<li><div>'+link(l.name,'loan-edit',l.id)+'<small class="small">'+money(l.required)+' monthly payment on file · '+money(l.monthlyInterest)+
      ' estimated monthly interest</small></div></li>').join('')+'</ul><p class="small">These payments may cover little or none of the principal. Check whether the amount on file reflects a one-time statement minimum.</p></div>':'';

    return panel('Interest rates, highest first',ranked.length?'<ul class="amount-list ranked-debt">'+ranked.join('')+'</ul>'+
      (unranked.length?'<p class="small">Rate needed for '+H(unranked.map(l=>l.name).join(', '))+'.</p>':'')+thin:
      no('Enter a debt and its interest rate to compare the cost.'),'Rates and balances as last entered');
  }
  function debtExample(loan,now) {
    if(!loan)return '';
    const standard=E.singlePayoff(loan,now,0), extra=E.singlePayoff(loan,now,debtExtra);
    const amounts=[10000,25000,50000];
    const options='<div class="segments" role="group" aria-label="Example extra amount">'+amounts.map(amount=>
      btn(money(amount),'debt-extra',String(amount),'',' aria-pressed="'+String(amount===debtExtra)+'"')).join('')+'</div>';
    const results=standard&&extra?(()=>{
      const max=Math.max(standard.interest,extra.interest);
      return '<ul class="amount-list">'+cashBar('Estimated interest · required only',standard.interest,max,'out')+
        cashBar('Estimated interest · with extra',extra.interest,max,'in')+'</ul>'+
        '<div class="debt-result"><div><small>Interest difference</small><strong class="money">'+money(Math.max(0,standard.interest-extra.interest))+'</strong></div>'+
        '<div><small>Time to clear</small><strong>'+extra.months+' months</strong><small>'+standard.months+' months with required payments</small></div></div>';
    })():extra?'<p class="secondary-value">Estimated payoff in '+extra.months+' months with this extra amount</p>'+
      '<p class="small">The required-payment scenario does not reach payoff within the model window.</p>':
      no('A payoff comparison needs a verified required payment and a balance that the payment can reduce.');
    return panel('What an extra payment could change',options+results+
      '<p class="small section-gap">Illustration for this account only, using entered terms, monthly estimates and zero new charges. The amounts above are examples. Actual lender interest, minimums, and fees may differ.</p>',
      loan.name+' · choose an example monthly amount');
  }
  function debt() {
    const now=E.today();
    const current=E.makePlan(S,now,S.config.debtShare);
    const profile=E.debtProfile(S,now), forecast=E.forecast(S,now);
    const loans=S.loans.map(l=>{
      const flags=[];
      if(l.rate===null||(!l.payment&&!l.minimumPercent))flags.push('Terms incomplete');
      if(E.distance(l.asOf,now)>35)flags.push('Refresh balance');
      if(l.renewal&&l.renewal>=now&&E.distance(now,l.renewal)<=90)flags.push('Renewal ahead');
      if(l.rateDate&&l.rateDate>=now&&E.distance(now,l.rateDate)<=90)flags.push('Rate review ahead');
      const linked=S.bills.some(b=>b.loan===l.id&&(!b.end||b.end>=now));
      return '<li class="debt-card"><div class="category-title">'+link(l.name,'loan-edit',l.id)+
        '<strong class="money">'+money(l.balance)+'</strong></div><p class="small">Balance dated '+H(l.asOf)+'</p>'+
        '<dl class="debt-terms"><div><dt>Interest rate</dt><dd>'+(l.rate===null?'Pending':H(l.rate+'% '+l.rateType))+
        (l.rateAfter!==null?'<small>'+H(l.rateAfter+'% from '+l.rateDate)+'</small>':'')+'</dd></div>'+
        '<div><dt>Required payment</dt><dd>'+(l.payment===null?(l.minimumPercent?H(l.minimumPercent+'% minimum'):'Pending'):money(l.payment)+' '+H(l.frequency.toLowerCase()))+'</dd></div>'+
        (l.renewal?'<div><dt>Renewal</dt><dd>'+H(l.renewal)+'</dd></div>':'')+'</dl>'+
        '<div class="actions">'+flags.map(x=>pill(x,'warn')).join(' ')+
        (linked?'':btn('Schedule payment','loan-bill',l.id,'mini quiet'))+'</div></li>';
    });
    const goals=S.goals.slice().sort((a,b)=>a.priority-b.priority);
    const goalRows=goals.map(g=>'<li><div>'+link(g.name,'goal-edit',g.id)+'<small class="small">'+
      (g.deadline?'Due '+H(g.deadline):'Flexible date')+' · Priority '+H(g.priority)+'</small></div>'+
      '<strong class="money">'+money(g.saved)+' / '+money(g.target)+'</strong></li>');
    const cards=[['Debt first',100],['Your plan',S.config.debtShare],['Goals first',0]].map(([label,share])=>planCard(label,share,E.makePlan(S,now,share),label==='Your plan')).join('');
    const missing=current.missing.length?banner('Fill in required payments and rates for '+H(current.missing.map(l=>l.name).join(', '))+' to compare payoff dates and costs.','warning'):'';
    return head('Debt & goals','',btn('Edit allocation','config','plan','quiet'))+
      debtGuidance(profile,forecast,now)+
      (profile.active.length?'<div class="stat-grid debt-stats">'+stat('Recorded debt',profile.balance,'Balances on file')+
        stat('Estimated monthly interest',profile.ranked.length?profile.monthlyCost:null,'For balances with an entered rate')+
        stat('Highest-rate balance',profile.target?.balance??null,profile.target?.name||'Confirm rates')+'</div>':'')+
      '<div class="home-grid section-gap">'+debtRanking(profile)+debtExample(profile.target,now)+'</div>'+
      '<div class="section-gap">'+panel('Balances & terms',loans.length?'<ul class="categories">'+loans.join('')+'</ul>':no('Add a mortgage, line of credit, credit card balance, or other loan.'),'',btn('Add debt','loan-edit','','mini quiet'))+'</div>'+
      panel('Priority goals',goalRows.length?'<ul class="list">'+goalRows.join('')+'</ul>':no('Add a cash reserve, savings goal, trip, or renovation contribution.'),'Extra goal dollars fund priority 1 first, then the next goal.',btn('Add goal','goal-edit','','mini quiet'))+
      '<details class="panel home-disclosure"><summary>Saved debt and goals allocation</summary><p class="small">'+money(S.config.surplus)+' per month · '+H(S.config.focus)+' first within debt</p>'+missing+
      '<div class="plan-grid section-gap">'+cards+'</div>'+
      '<details class="subtle section-gap"><summary>How this estimate works</summary><p class="small">Uses entered rates, required payments and prepayment limits. Assumes zero new borrowing. Unused debt allocations flow to goals.</p></details></details>'+
      '<details class="subtle section-gap"><summary>Repayment and cash reserve guidance</summary><p class="small">The Financial Consumer Agency of Canada explains how to prioritize repayments, set aside cash, and check mortgage prepayment limits.</p>'+
      '<div class="actions"><a href="https://www.canada.ca/en/financial-consumer-agency/services/debt/paying-debt.html">Paying back debt</a>'+
      '<a href="https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html">Emergency funds</a>'+
      '<a href="https://www.canada.ca/en/financial-consumer-agency/services/mortgages/reduce-prepayment-penalties.html">Mortgage prepayment rules</a></div></details>';
  }
  function planCard(label,share,plan,selected) {
    const details=plan.missing.length?'':plan.items.map(l=>'<li><div>'+H(l.name)+'<small class="small">'+(l.clear?H(monthLabel(l.clear)):'Open at end of estimate')+'</small></div><span class="money">'+(l.clear?money(l.interest)+' interest':money(l.left)+' left')+'</span></li>').join('');
    const goals=plan.missing.length?'':plan.goalItems.map(g=>{
      const late=g.deadline&&(!g.funded||g.funded>g.deadline);
      return '<li><div>'+H(g.name)+'<small class="small">'+(g.funded?H(monthLabel(g.funded)):'Open at end of estimate')+(g.deadline?' · due '+H(monthLabel(g.deadline)):'')+'</small></div>'+
        (late?pill('Behind target','warn'):g.funded?pill('Funded','dim'):'')+'</li>';
    }).join('');
    return '<div class="plan'+(selected?' selected':'')+'"><h3>'+H(label)+'</h3><p class="small">Extra debt '+money(plan.extraDebt)+' · goals '+money(plan.extraGoals)+'</p>'+
      '<p class="section-gap"><strong>'+(!plan.items.length?'No debt entered':plan.missing.length?'Add required terms':plan.end?'Debt clear '+H(monthLabel(plan.end)):'Debt remains at model limit')+'</strong></p>'+
      (plan.interest!==null&&plan.items.length?'<p class="small">Estimated interest '+money(plan.interest)+'</p>':'')+
      (details||goals?'<ul class="list">'+details+goals+'</ul>':'')+'</div>';
  }
  function loanEdit(id) {
    const loan=byId(S.loans,id)||(id==='mortgage'?{type:'Mortgage',method:'Canadian mortgage'}:{});
    return openDialog(loan.id?'Edit debt':'Add debt','<div class="form-grid">'+
      field('Debt nickname',f('name',loan.name,'text','required maxlength="80"'))+
      field('Type',select('type',['Mortgage','Credit card','Line of credit','Auto loan','Other'],loan.type||'Line of credit'))+
      field('Balance owed',f('balance',inputMoney(loan.balance),'text','inputmode="decimal" required'))+
      field('Balance as of',f('as_of',loan.asOf||E.today(),'date','required'))+
      field('Annual interest rate (%)',f('rate',loan.rate,'number','min="0" max="100" step="0.001"'),'Blank if you still need to verify it.')+
      field('Rate type',select('rate_type',['Fixed','Variable','Promotional'],loan.rateType||'Fixed'))+
      field('Interest convention',select('method',['Monthly estimate','Canadian mortgage'],loan.method||'Monthly estimate'))+
      field('Scheduled / minimum payment',f('payment',inputMoney(loan.payment),'text','inputmode="decimal"'),'For a balance-based minimum, enter its floor here and set the percentage below.')+
      field('Payment frequency',select('frequency',frequency.filter(v=>v!=='Once').concat(['Semimonthly']),loan.frequency||'Monthly'))+
      field('Monthly minimum (% of balance)',f('minimum_percent',loan.minimumPercent||'','number','min="0" max="100" step="0.01"'),'Optional. The estimate uses the higher of this amount and the payment entered.')+
      field('Next due date',f('next_due',loan.nextDue,'date'))+
      field('Funding account',select('account',accountOptions(cash),loan.account))+
      field('Renewal / maturity',f('renewal',loan.renewal,'date'))+
      field('Projected new rate (%)',f('rate_after',loan.rateAfter,'number','min="0" max="100" step="0.001"'),'Optional. Use for a known promo expiry or a renewal scenario.')+
      field('Rate change / promo expiry date',f('rate_date',loan.rateDate,'date'))+
      field('Annual extra-payment limit',f('prepay',inputMoney(loan.prepay),'text','inputmode="decimal"'),'Blank allows extra payments on non-mortgage debt. For mortgages, blank or 0 models required payments only.')+
      field('Terms source / verified on',f('source',loan.source,'text','maxlength="120"'),'For example, lender statement, Nov 10.')+
      field('Term notes',f('note',loan.note,'text','maxlength="180"'),'Use for prepayment penalties, prime spread, fees, or other lender terms.')+'</div>',
      async data=>{
        const asOf=dateField(data,'as_of'), rateAfter=numberField(data,'rate_after',0,100,true), rateDate=dateField(data,'rate_date',true);
        if(asOf>E.today()) throw new Error('Use a balance as of today or earlier.');
        if(rateAfter!==null&&!rateDate) throw new Error('Enter the effective date of the new rate.');
        const type=val(data,'type');
        let prepay=dollarsField(data,'prepay',{optional:true});
        if(prepay===null&&type==='Mortgage') prepay=0;
        const value={id:loan.id||E.id(),name:titleField(data),type,asOf,
          balance:dollarsField(data,'balance'),rate:numberField(data,'rate',0,100,true),rateType:val(data,'rate_type'),
          payment:dollarsField(data,'payment',{optional:true}),frequency:val(data,'frequency'),method:val(data,'method'),
          minimumPercent:numberField(data,'minimum_percent',0,100,true),renewal:dateField(data,'renewal',true),
          nextDue:dateField(data,'next_due',true),account:val(data,'account'),rateAfter,rateDate,prepay,source:val(data,'source'),note:val(data,'note')};
        await write(next=>replace(next.loans,value));
      },'Save debt');
  }
  function goalEdit(id) {
    const g=byId(S.goals,id)||{};
    return openDialog(g.id?'Edit goal':'Add goal','<div class="form-grid">'+
      field('Goal name',f('name',g.name,'text','required maxlength="80"'))+
      field('Target amount',f('target',inputMoney(g.target),'text','inputmode="decimal" required'))+
      field('Already saved',f('saved',inputMoney(g.saved??0),'text','inputmode="decimal" required'))+
      field('Deadline',f('deadline',g.deadline,'date'))+
      field('Priority',f('priority',g.priority||1,'number','min="1" max="99" step="1" required'),'1 is highest priority.')+'</div>',
      async data=>{
        const value={id:g.id||E.id(),name:titleField(data),target:dollarsField(data,'target',{min:1}),
          saved:dollarsField(data,'saved'),deadline:dateField(data,'deadline',true),
          priority:Math.round(numberField(data,'priority',1,99))};
        await write(next=>replace(next.goals,value));
      },'Save goal');
  }
  function replace(items,item) {
    const index=items.findIndex(x=>x.id===item.id);
    if(index<0) items.push(item);
    else items[index]=item;
  }
  function scenarioValues(b) {
    const values={variablePay:b.variablePay,variable:b.variable,recurring:b.recurring,reserve:b.reserve,
      targetExtra:b.targetExtra,share:S.config.debtShare,...scenarioDraft};
    if(values.allAvailable)values.targetExtra=Math.max(0,E.repaymentBudget(b,values,100).room);
    return values;
  }
  const scenarioFields=[
    ['variablePay','Second pay',300000,10000],
    ['variable','Flexible spending',300000,5000],
    ['recurring','Recurring charges',100000,2500],
    ['reserve','Monthly set-aside',200000,2500],
    ['targetExtra','Extra monthly budget',0,1],
    ['share','Share of extra cash to debt',100,1]
  ];
  const scenarioFormat=(key,value)=>key==='share'?value+'%':money(value);
  function sliderState([key,,limit,step],v,b,calculation) {
    if(key==='share')return {value:v.share,max:100,disabled:!calculation.extra};
    if(key==='targetExtra'){
      const available=b.missingOperating?0:Math.max(0,calculation.room);
      return {value:calculation.extra,max:Math.max(1,available),
        disabled:!available||repaymentMode==='Minimums only'||!b.debtLoans.length||v.allAvailable};
    }
    return {value:v[key],max:Math.max(limit,v[key],Math.ceil(b[key]*1.55/step)*step),disabled:false};
  }
  function scenarioSlider(info,v,b,calculation) {
    const [key,label]=info, state=sliderState(info,v,b,calculation);
    return `<label class="scenario-control" for="scenario-${key}"><span>${H(label)}</span>
      <output id="scenario-${key}-value" for="scenario-${key}">${scenarioFormat(key,state.value)}</output>
      <input id="scenario-${key}" type="range" min="0" max="${state.max}" step="${key==='share'?1:'any'}" value="${state.value}"
        data-scenario="${key}" aria-valuetext="${H(scenarioFormat(key,state.value))}"${state.disabled?' disabled':''}>
    </label>`;
  }
  function allocationNote(b,v,calculation) {
    if(repaymentMode==='Minimums only'||!b.debtLoans.length)return 'Extra payments are off in this strategy.';
    if(b.missingOperating)return 'Confirm monthly costs to calculate the limit.';
    const available=Math.max(0,calculation.room);
    if(v.allAvailable)return money(available)+' available. Extra budget follows the room left.';
    if(v.targetExtra>available)return 'Requested '+money(v.targetExtra)+' · limited to '+money(available)+'.';
    return money(available)+' available for extra debt payments and goals.';
  }
  function selectedDebtShare(b,v) {
    return !b.debtLoans.length||repaymentMode==='Minimums only'?null:repaymentMode==='Debt first'?100:v.share;
  }
  function monthlySnapshot() {
    const now=E.today(), b=E.monthlySnapshot(S,now);
    const v=scenarioValues(b);

    const assumptions=b.assumptions.length?`<details class="subtle scenario-help"><summary>${b.assumptions.length} lender payments to verify</summary>
      <ul class="list">${b.assumptions.map(x=>`<li><div>${link(x.name,'loan-edit',x.id)}
      <small class="small">${money(x.recorded)} on file · ${money(x.interest)} estimated interest</small></div>
      <strong>${money(x.assumed)}<small class="small">Model placeholder</small></strong></li>`).join('')}</ul></details>`:'';
    const costRows=rows=>rows.map(x=>`<li><div>${x.bill?link(x.name,'bill-edit',x.bill):x.source==='Payment schedule or loan terms'?link(x.name,'nav','Bills'):
      b.historyView.rows.some(r=>r.category===x.name)?link(categoryName(x.name),'planning-category',JSON.stringify([x.name,x.source])):H(x.name)}<small class="small">${H(x.source)}</small></div><strong class="money">${money(x.amount)}</strong></li>`).join('');
    const result=scenarioResult(b,now,v,runwayData());
    return head('Monthly Snapshot',monthLabel(b.start)+' plan','<div class="actions">'+monthCostLink(E.month(now))+btn('Edit saved assumptions','month-plan-edit','','quiet')+'</div>')+
      `<div class="scenario-layout"><div class="scenario-left">
        <section class="panel scenario-panel"><div class="panel-title"><div><h2>Try a scenario</h2><p>Changes here are temporary.</p></div>
          ${btn('Reset','scenario-reset','','mini quiet')}</div>
          <div class="scenario-live" id="scenario-live">${result.live}</div>
          <div class="scenario-all"><span id="allocation-note">${H(allocationNote(b,v,result.calculation))}</span>
          ${b.debtLoans.length&&repaymentMode!=='Minimums only'?btn('Use all available','scenario-auto','','mini quiet',' aria-pressed="'+Boolean(v.allAvailable)+'"'):''}</div>
          <div id="scenario-controls">${scenarioFields.filter(x=>x[0]!=='share'||repaymentMode==='Debt + goals')
            .map(info=>scenarioSlider(info,v,b,result.calculation)).join('')}</div>

        </section>
        </div><div class="scenario-right">
        <div class="scenario-output" id="monthly-payoff-result">${result.timeline}</div>
      </div></div>
      <div class="scenario-layout scenario-secondary">
        <div class="scenario-output decision-funding" id="monthly-funding-result">${result.funding}</div>
        <div class="scenario-output" id="monthly-budget-result">${result.budget}</div>
      </div>
      <details class="panel home-disclosure"><summary>Monthly budget breakdown</summary>
        <div class="home-grid">
          ${panel('Fixed household costs',b.fixedRows.length?`<ul class="list">${costRows(b.fixedRows)}</ul>`:no('No fixed categories or mortgage schedule on file.'),b.stored.fixed!=null?'Saved total overrides these source amounts':'')}
          ${panel('Flexible spending',b.variableRows.length?`<ul class="list">${costRows(b.variableRows)}</ul>`:no('No flexible category averages or targets on file.'),b.stored.variable!=null?'Saved total includes its share of recurring charges':'')}
          ${panel('Recurring charges',b.recurringRows.length?`<ul class="list">${costRows(b.recurringRows)}</ul>`:no('No recurring charges identified.'),'Subscriptions, memberships and other repeated discretionary bills',btn('Audit charges','open-recurring','','mini quiet'))}
        </div>
        <p class="small section-gap">${b.historyView.complete.length} complete months in the baseline. Fixed costs include the mortgage. One-time projects are separate.</p>
      </details>
      ${assumptions}
      <details class="subtle section-gap"><summary>Payoff estimate assumptions</summary>
        <p class="small">Models non-mortgage debt from next month using the balances and rates on file. New charges are assumed paid from the living-expense budget. The debt-first and debt-plus-goals modes roll freed payments to the remaining eligible debt. Use the ${link('payday plan','nav','Cash plan')} to check when cash is available.</p>
      </details>`;
  }
  function bindMonthlyScenario() {
    const controls=root.querySelector('#scenario-controls');
    if(!controls)return;
    const now=E.today(), baseline=E.monthlySnapshot(S,now), cash=runwayData();
    const budgetOutput=root.querySelector('#monthly-budget-result'), payoffOutput=root.querySelector('#monthly-payoff-result');
    const live=root.querySelector('#scenario-live');
    const funding=root.querySelector('#monthly-funding-result');
    const noteElement=root.querySelector('#allocation-note');
    controls.addEventListener('input',event=>{
      const input=event.target, key=input.dataset.scenario, value=Number(input.value);
      if(!key||!Number.isFinite(value))return;
      scenarioDraft[key]=Math.round(value);
      const values=scenarioValues(baseline);
      const result=scenarioResult(baseline,now,values,cash);
      for(const info of scenarioFields){
        const [field]=info,range=controls.querySelector('#scenario-'+field);
        if(!range)continue;
        const next=sliderState(info,values,baseline,result.calculation);
        if(field==='targetExtra')range.max=next.max;
        range.value=next.value;
        range.disabled=next.disabled;
        const text=scenarioFormat(field,next.value);
        range.setAttribute('aria-valuetext',text);
        controls.querySelector('#scenario-'+field+'-value').textContent=text;
      }
      noteElement.textContent=allocationNote(baseline,values,result.calculation);
      funding.innerHTML=result.funding;
      budgetOutput.innerHTML=result.budget;
      payoffOutput.innerHTML=result.timeline;
      live.innerHTML=result.live;
    });
  }
  function cashCheckKey(position,now) {
    return JSON.stringify([now,position.cutoff,S.config.floor,S.config.flex,S.config.flexAccount]);
  }
  function confirmedCashCosts(position,now=E.today()) {
    return cashScenario.covered===cashCheckKey(position,now);
  }
  function selectedCashSource(position) {
    return position.plan.verified.find(a=>a.id===cashScenario.account)||
      (position.plan.verified.length===1?position.plan.verified[0]:null);
  }
  function fundingPlan(b,now,v,calculation,cash) {
    const {room,toDebt,toGoals,unallocated}=calculation;
    const {position,account:source,checked,limit,base}=cash;
    const near=checked&&source?E.accountRoom(position,source.id):null;
    const priority=E.debtProfile(S,now).target;
    const nextGoal=S.goals.filter(g=>g.target>g.saved).sort((a,b)=>a.priority-b.priority)[0];
    let timing='Check your cash before making an extra payment.';
    if(near!==null&&toDebt>0) {
      const stressIsLower=limit.stress!==null&&limit.stress<near;
      const available=stressIsLower?limit.stress:near;
      const through=stressIsLower?base.end:position.cutoff;
      timing=(available<toDebt?money(toDebt-available)+' short of the extra payment':
        money(available)+' estimated above buffers')+' in '+source.name+' through '+dateLabel(through)+'.';
      if(stressIsLower)timing+=' Uses the lower-or-later pay scenario.';
      else if(limit.stress===null)timing+=' Check later bills before committing.';
    } else if(!toDebt)timing='This scenario budgets no extra payment.';
    const flags=[
      b.assumptions.length?'Some lender payments are estimates.':'',
      b.needsMatch.length?b.needsMatch.length+' bill schedules need reconciliation.':'',
      b.historyView.baselineReview&&(b.stored.fixed==null||b.stored.variable==null)?'Some purchases in the budget baseline are still in Review.':''
    ].filter(Boolean);
    const result=`<div class="funding-grid">
      <div><span>Extra to debt</span><b class="money">${money(toDebt)}</b>${toDebt&&priority?`<small>${H(priority.name)} first · ${H(priority.currentRate)}%</small>`:''}</div>
      <div><span>Set aside and goals</span><b class="money">${money(v.reserve+toGoals)}</b>${toGoals&&nextGoal?`<small>${H(nextGoal.name)} first</small>`:''}</div>
      <div><span>${room<0?'Still to cover':'Left unallocated'}</span><b class="money${room<0?' negative':''}">${money(room<0?-room:unallocated)}</b></div></div>`;
    return panel('Where the payment comes from', result+
      `<div class="funding-check"><p>${H(timing)}</p>${toDebt?btn('Check before payday','cash-controls','','mini quiet'):''}</div>`+
      (flags.length?`<p class="small funding-flags">${H(flags.join(' '))}</p>`:''),
      'Per month after regular costs and debt minimums');
  }
  function repaymentOptions(b,now,v,selected,base) {
    if(!b.debtLoans.length||b.missingOperating)return '';
    const entries=[['Minimums only',null],['Debt + goals',v.share],['Debt first',100]];
    return `<div class="decision-options" role="group" aria-label="Repayment strategy">
      ${entries.map(([label,share])=>{
        const budget=E.repaymentBudget(b,v,share);
        const model=label===repaymentMode?selected:share===null?base:E.monthlyDebtPlan(S,now,b,budget.extra,share);
        const caption=model.missing.length?'Terms needed':model.end?monthLabel(model.end)+' payoff':'Payoff beyond estimate';
        return `<button class="repayment-option" type="button" data-act="monthly-repayment" data-id="${H(label)}" aria-pressed="${label===repaymentMode}">
          <span><strong>${H(label)}</strong><small>${money(budget.toDebt)} extra to debt${budget.toGoals?' · '+money(budget.toGoals)+' for goals':''}</small></span>
          <b>${H(caption)}</b>${arrow}</button>`;
      }).join('')}</div>`;
  }
  function scenarioResult(b,now,v,cash) {
    const share=selectedDebtShare(b,v);
    const calculation=E.repaymentBudget(b,v,share);
    const {income,costs,committed,room,extra,targetGap,variableLimit}=calculation;
    const rows=[['Fixed bills',b.fixed,'rate'],['Recurring charges',v.recurring,'recurring'],['Flexible spending',v.variable,'out'],
      ['Debt minimums',b.minimums,'priority'],['Set-aside',v.reserve,'reserve']].filter((x,i)=>x[1]||i<4);
    const scale=Math.max(income,committed,1);
    const budget=`<section class="panel budget-result"><div class="budget-result-head"><div>
      <h2>${room<0&&!b.missingOperating?'Monthly shortfall':'Left after monthly costs'}</h2>
      <strong class="cash-number money${room<0&&!b.missingOperating?' negative':''}">${b.missingOperating?'—':money(Math.abs(room))}</strong>
      ${b.missingOperating?'<p class="small">Confirm fixed and variable costs to calculate monthly room.</p>':''}
      </div><div class="budget-income"><span>Income</span><b class="money">${money(income)}</b></div></div>
      <div class="budget-sources"><span>First pay <b>${money(b.draw)}</b></span><span>Second pay <b>${money(v.variablePay)}</b></span>
        <span>Household <b>${money(b.household)}</b></span></div>
      <div class="budget-stack" aria-hidden="true">${rows.filter(x=>x[1]>0).map(x=>`<i class="${x[2]}" style="width:${x[1]/scale*100}%"></i>`).join('')}
        ${room>0&&!b.missingOperating?`<i class="room" style="width:${room/scale*100}%"></i>`:''}</div>
      <p class="budget-monthly-total"><span>Monthly costs before set-aside</span><strong class="money">${money(b.missingOperating?null:costs)}</strong></p>
      <ul class="budget-costs">${rows.map(([label,amount,tone])=>`<li><i class="${tone}" aria-hidden="true"></i><span>${label}</span><b>${money(amount)}</b></li>`).join('')}</ul>
      ${!b.missingOperating&&share>0&&targetGap>0?`<div class="budget-gap"><div><strong>${money(targetGap)} gap to the extra monthly budget</strong>
        <small>${variableLimit>=0?'Variable costs would need to be '+money(variableLimit)+' or less.':'Fixed commitments alone leave too little for this target.'}</small></div>
        ${variableLimit>=0?btn('Try that limit','scenario-fit',String(variableLimit),'mini quiet'):''}</div>`:''}</section>`;
    const model=E.monthlyDebtPlan(S,now,b,extra,share??0,share!==null,true);
    const base=share===null?model:E.monthlyDebtPlan(S,now,b,0,0,false,true);
    const timeline=b.missingOperating?panel('Debt repayment timeline',no('Confirm monthly costs to compare payoff dates.')):
      repaymentTimeline(b,now,model,base,room);
    const options=repaymentOptions(b,now,v,model,base);
    const funding=b.missingOperating?panel('Plan extra payments',no('Confirm your monthly costs first.'),'',btn('Edit assumptions','month-plan-edit','','mini quiet')):
      fundingPlan(b,now,v,calculation,cash);
    const interestSaved=base.interest!==null&&model.interest!==null?base.interest-model.interest:null;
    const metrics=[
      ['Extra to debt',b.missingOperating?'—':money(calculation.toDebt)],
      ['Payoff estimate',!b.missingOperating&&model.end?monthLabel(model.end):'—'],
      ['Interest saved',b.missingOperating?'—':money(interestSaved)]
    ];
    const live=metrics.map(([label,value])=>`<div><span>${label}</span><b class="money">${H(value)}</b></div>`).join('');
    return {budget,timeline,live,calculation,funding:funding+(options?panel('Compare repayment options',options,'Estimated payoff dates for non-mortgage debt'):'')};
  }
  function payoffPlot(model,baseline,now) {
    if(!model.balances?.length||!baseline.balances?.length)return '';
    const periods=Math.min(60,Math.max(12,baseline.balances.length-1));
    const max=Math.max(1,...baseline.balances.slice(0,periods+1));
    const x=i=>12+i/periods*576;
    const y=amount=>144-amount/max*120;
    const entries=[['Minimums only',baseline,'base'],['Your scenario',model,'live']].map(([label,plan,tone])=>{
      const paid=plan.balances.indexOf(0);
      const end=paid>=0&&paid<=periods?paid:periods;
      const balance=plan.balances[Math.min(end,plan.balances.length-1)];
      const points=plan.balances.slice(0,end+1).map((amount,i)=>`${x(i)},${y(amount)}`).join(' ');
      return {label,plan,tone,points,end,balance};
    });
    const [minimum,current]=entries;
    const sameEndpoint=minimum.end===current.end&&minimum.balance===current.balance;
    const markers=sameEndpoint?[{...current,label:'Both scenarios'}]:[current,minimum];
    const closeEndpoints=markers.length>1&&Math.abs(minimum.end-current.end)/periods<.42;
    const annotations=markers.map((p,i)=>{
      const outcome=p.balance===0?'$0 · '+monthLabel(p.plan.end):
        money(p.balance)+' at '+monthLabel(E.shiftMonth(now,p.end));
      return `<div class="payoff-end-${p.tone}" style="--point:${x(p.end)/6}%;--label-row:${closeEndpoints?i:0}">
        <span>${p.label}</span><b class="money">${H(outcome)}</b></div>`;
    }).join('');
    return `<figure class="payoff-plot" data-horizon="${periods}">
      <div class="payoff-axis-label"><span>Non-mortgage balance</span><b>${chartMoney(max)}</b></div>
      <svg viewBox="0 0 600 158" preserveAspectRatio="none" aria-hidden="true">
        <path class="plot-grid" d="M12 24H588 M12 84H588 M12 144H588"/>
        ${entries.map(p=>`<polyline class="payoff-${p.tone}" points="${p.points}"/>`).join('')}
        ${(sameEndpoint?[current]:entries).map(p=>`<path class="payoff-point payoff-${p.tone}" d="M${x(p.end)-6} ${y(p.balance)}h12 m-6 -4v8"/>`).join('')}
      </svg>
      <figcaption class="payoff-endpoints${closeEndpoints?' payoff-endpoints-stagger':''}">${annotations}</figcaption>
      <div class="payoff-axis-label payoff-axis-floor"><span>${H(monthLabel(now))}</span>
        <span>${H(monthLabel(E.shiftMonth(now,periods)))}</span></div>
      ${baseline.balances.length-1>periods?'<p class="small">First five years shown.</p>':''}
    </figure>`;
  }
  function repaymentTimeline(b,now,model,baseline,room) {
    if(!model.items.length)return panel('Debt repayment timeline',no('Add a card or line of credit to see a payoff timeline.'),'',btn('Open debt','nav','Debt & goals','mini quiet'));
    if(model.missing.length)return panel('Debt repayment timeline',`<p>Confirm terms for ${H(model.missing.map(x=>x.name).join(', '))}.</p>`,'',btn('Open debt','nav','Debt & goals','mini quiet'));
    const months=model.end&&baseline.end?baseline.balances.length-model.balances.length:null;
    const interest=model.interest!==null&&baseline.interest!==null?baseline.interest-model.interest:null;
    const sorted=model.items.slice().sort((a,b)=>(a.clear||'9999').localeCompare(b.clear||'9999')||a.name.localeCompare(b.name));
    const sortedRows=sorted.map(l=>`<li>${link(l.name,'loan-edit',l.id)}<b>${H(l.clear?monthLabel(l.clear):'Beyond estimate')}</b></li>`).join('');
    const summary=`<div class="payoff-stats"><div><span>Debt-free*</span><strong>${H(model.end?monthLabel(model.end):'Beyond estimate')}</strong>
      ${months>0?`<small>${months} months sooner</small>`:''}</div>
      <div><span>Estimated interest</span><strong>${money(model.interest)}</strong>
      ${interest>0?`<small>${money(interest)} less</small>`:''}</div></div>`;
    const detail=room<0?'Budget shortfall. Timeline assumes modeled payments can still be made.':
      money(model.extraDebt)+' extra to debt'+(model.extraGoals?' · '+money(model.extraGoals)+' for goals':'')+' per month';
    return panel('Debt repayment timeline',summary+payoffPlot(model,baseline,now)+
      `<details class="subtle"><summary>Payoff by account</summary><ul class="list">${sortedRows}</ul></details>
      <p class="small section-gap">*Non-mortgage debt.${b.assumptions.length?' Includes unconfirmed payment placeholders.':''}</p>`,detail);
  }
  function editMonthlySnapshot() {
    const b=E.monthlySnapshot(S,E.today());
    const amount=(label,name,value,hint='')=>field(label,f(name,inputMoney(value),'text','inputmode="decimal"'),hint);
    return openDialog('Monthly Snapshot assumptions','<div class="form-grid">'+
      amount('First pay','draw',b.draw,'Blank uses your scheduled fixed pay.')+
      amount('Second pay','variable_pay',b.variablePay,'Blank rounds the scheduled variable estimate down to a whole $1,000.')+
      amount('Household contribution','household',b.household,'Blank uses the scheduled household contribution.')+
      amount('Fixed household costs','fixed',b.stored.fixed,'Blank uses the mortgage schedule and fixed categories shown in the budget.')+
      amount('Variable living expenses','variable',b.stored.variable,'Blank uses your statement averages and saved targets.')+
      amount('Monthly set-aside','reserve',b.reserve,'Optional savings or known irregular costs.')+
      amount('Extra repayment target','target_extra',b.targetExtra,'Used to calculate the what-if spending limit.')+'</div>',async data=>{
        const keys={draw:'draw',variable_pay:'variablePay',household:'household',fixed:'fixed',variable:'variable',reserve:'reserve',target_extra:'targetExtra'};
        const values=Object.fromEntries(Object.entries(keys).map(([name,key])=>[key,dollarsField(data,name,{optional:true})]));
        await write(next=>{next.config.monthlySnapshot=values;});
        scenarioDraft={};render();
      });
  }
  function runwayData() {
    const now=E.today(), base=E.forecast(S,now), stress=E.forecast(S,now,cashScenario);
    const position=E.paydayPosition(S,now);
    const account=selectedCashSource(position), checked=confirmedCashCosts(position,now);
    const limit=E.commitmentRange(S,base,stress,account?.id,checked);
    return {now,base,stress,account,limit,position,checked};
  }
  function cashPlan() {
    const {now,base,stress,account,limit,position,checked}=runwayData();
    const first=stress.shortfalls[0];
    const weakest=stress.verified.map(a=>({a,margin:stress.lows[a.id]-(a.floor||0)})).sort((a,b)=>a.margin-b.margin)[0];
    const incomplete=base.headroom===null||stress.headroom===null;
    const chartStatus=incomplete?'Known scheduled activity only':base.stale.length?'Uses balances last entered':'Scheduled cash activity';
    const graphScope=account?account.name:'Combined forecast accounts';
    const baseLow=account?base.lows[account.id]:base.low, stressLow=account?stress.lows[account.id]:stress.low;
    const reason=[];
    if(incomplete)reason.push('complete the forecast gaps below');
    if(base.stale.length)reason.push('refresh the cash balances');
    if(S.config.floor<=0)reason.push('set a household cash buffer');
    if(!account)reason.push('choose the account that would fund the payment');
    if(!checked)reason.push('confirm all regular living costs are included');
    const comparison=base.verified.length?'<section class="panel runway-plot" aria-label="Projected balance comparison">'+
      '<div class="panel-title"><div><h2>Where cash runs lowest</h2><p>'+H(graphScope+' · '+chartStatus)+'</p></div></div>'+
      '<div class="runway-readout"><div><small>As scheduled</small><strong class="money">'+money(baseLow)+'</strong></div>'+
      '<div><small>Lower or later pay</small><strong class="money">'+money(stressLow)+'</strong></div></div>'+
      '<div class="chart-key"><span class="key-in">As scheduled</span><span class="key-out">Lower or later pay</span><span class="key-rate">Cash buffer</span></div>'+
      '<canvas id="runway-chart" role="img" aria-label="'+H(graphScope+'. As scheduled low '+money(baseLow)+'; lower or later pay low '+money(stressLow)+'.')+'"></canvas>'+
      '<div class="chart-scale"><span>'+H(dateLabel(now))+'</span><span>'+H(dateLabel(base.end))+'</span></div></section>':'';
    const affected=stress.affected.slice(0,4).map(e=>{
      const after=stress.changed.get(e.key);
      return '<li><div>'+H(e.name)+'<small class="small">'+H(dateLabel(e.date))+' · '+money(e.forecastAmount)+'</small></div>'+
        '<div class="stress-deposit"><strong>'+money(after.forecastAmount)+'</strong><small class="small">'+H(dateLabel(after.date))+
        (after.date>base.end?' · beyond window':'')+'</small></div></li>';
    });
    const changed=affected.length?'<ul class="list">'+affected.join('')+'</ul>':no('No variable deposits with estimated amounts are scheduled in this window.');
    const controls='<form id="cash-scenario" class="stack" autocomplete="off"><div class="form-grid">'+
      field('Variable pay reduction (%)',f('income_cut',cashScenario.incomeCut,'number','required min="0" max="100" step="1"'))+
      field('Variable pay delay (days)',f('income_delay',cashScenario.incomeDelay,'number','required min="0" max="45" step="1"'))+
      field('Account for optional payment',select('source_account',[['','Choose a funding account'],...base.verified.map(a=>[a.id,a.name])],account?.id||''),'Choose the account that would fund the payment.',true)+'</div>'+
      check('Bills and the spending allowance cover the living costs I expect through '+dateLabel(base.end),'costs_covered',checked)+
      '<button class="btn primary" type="submit">Run comparison</button></form>';
    const coverage=forecastCard(base,now);
    const timing=panel('Bills through '+dateLabel(position.cutoff),
      position.due.length?'<ul class="list event-list">'+position.due.map(e=>eventItem(e,now)).join('')+'</ul>':
        no('There are no open bills scheduled in this window.'),
      'Based on the original schedule. Includes bills still marked open.',
      btn('All bills','nav','Bills','mini quiet'));
    const perAccount=base.verified.length?panel('Cash by account','<ul class="runway-accounts">'+base.verified.map(a=>{
      const margin=stress.lows[a.id]-(a.floor||0);
      return '<li><div><h3>'+H(a.name)+'</h3><p class="small">Account buffer '+money(a.floor||0)+' · balance dated '+H(a.balanceDate)+'</p></div>'+
        '<div class="account-lows"><span><small>As scheduled low</small><strong>'+money(base.lows[a.id])+'</strong></span>'+
        '<span><small>Lower or later pay low</small><strong class="'+(margin<0?'negative':'')+'">'+money(stress.lows[a.id])+'</strong></span></div></li>';
    }).join('')+'</ul>','Check the account that pays the bill. A household total can hide a shortfall in one account.'):'';
    const amount=limit.stress===null?'—':money(limit.stress);
    const result='<section class="runway-result" id="cash-scenario-result" tabindex="-1"><div><h2>Room for an optional payment today</h2>'+
      '<strong class="money">'+amount+'</strong></div><div><p>'+
      (limit.stress!==null?'From '+H(account.name)+' under the lower-or-later scenario. As scheduled, the estimate is '+money(limit.base)+
        '. This is a one-time estimate through '+H(dateLabel(base.end))+'.':
        'To estimate a one-time amount, '+H(reason.join('; '))+'.')+'</p>'+
      (first?'<p class="runway-alert">'+H(first.name)+' could take '+H(alias(first.account))+' below its buffer on '+H(dateLabel(first.date))+'.</p>':
        weakest&&weakest.margin<0?'<p class="runway-alert">'+H(weakest.a.name)+' is projected below its buffer.</p>':'')+'</div></section>';
    return head('Payday plan','',cashPlanFromDebt?btn('‹ Repayment plan','nav','Monthly snapshot','quiet'):btn('Today','nav','Overview','quiet'))+
      '<div class="home-grid decision-payday">'+cashPositionCard(position)+timing+'</div>'+
      '<details class="subtle section-gap"><summary>How the payday estimate works</summary><p class="small">Uses cash on hand. Bills due on payday are included. The everyday allowance is reserved up front for these dates. Each bill account and the household have their own buffer.</p></details>'+
      '<div class="section-gap">'+result+'</div>'+comparison+'<div class="home-grid section-gap">'+panel('Try a lower or later paycheque',controls,
      'This example adjusts deposits marked variable that still use estimated amounts.')+
      panel('Variable deposits in this comparison',changed,'Original schedule on the left · scenario on the right')+'</div>'+
      (perAccount?'<div class="section-gap">'+perAccount+'</div>':'')+
      '<div class="section-gap">'+coverage+'</div>'+
      '<p class="small section-gap">Choose the cash buffer in '+link('forecast settings','config','cash')+
      '. Use confirmed surplus and current lender terms for ongoing commitments. '+link('Compare debt and savings','nav','Debt & goals')+'.</p>';
  }
  function drawRunway() {
    const canvas=document.getElementById('runway-chart');
    if(!canvas||canvas.tagName!=='CANVAS')return;
    const {now,base,stress,account}=runwayData();
    const width=canvas.clientWidth,height=canvas.clientHeight,ratio=window.devicePixelRatio||1;
    if(!width||!height)return;
    canvas.width=width*ratio; canvas.height=height*ratio;
    const g=canvas.getContext('2d');
    g.scale(ratio,ratio);
    const value=p=>account?p.balances[account.id]:p.total;
    const floor=account?(account.floor||0):S.config.floor;
    const values=base.points.concat(stress.points).map(value).concat(floor);
    const bottom=Math.min(...values),top=Math.max(bottom+10000,...values);
    const left=58,right=width-10;
    const x=d=>left+(right-left)*E.distance(now,d)/Math.max(1,E.distance(now,base.end));
    const y=n=>height-13-(height-26)*(n-bottom)/(top-bottom);
    const compact=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',notation:'compact',maximumFractionDigits:1});
    g.font='11px Figtree,sans-serif'; g.textBaseline='middle'; g.fillStyle='#454d58';
    function line(n,color,dashes) {
      g.strokeStyle=color;g.setLineDash(dashes);g.lineWidth=1;g.beginPath();
      g.moveTo(left,y(n));g.lineTo(right,y(n));g.stroke();
    }
    for(const n of [top,(bottom+top)/2,bottom]){line(n,'#ddd7ca',[]);g.fillText(compact.format(n/100),2,y(n));}
    line(floor,'#667398',[3,3]);
    for(const [forecast,color,dashes] of [[base,'#28715b',[]],[stress,'#a76543',[6,4]]]) {
      const points=forecast.points;
      g.strokeStyle=color;g.lineWidth=2.5;g.setLineDash(dashes);g.beginPath();
      g.moveTo(x(points[0].date),y(value(points[0])));
      for(let i=1;i<points.length;i++){
        g.lineTo(x(points[i].date),y(value(points[i-1])));
        g.lineTo(x(points[i].date),y(value(points[i])));
      }
      g.lineTo(right,y(value(points.at(-1))));g.stroke();
    }
  }
  function recommendation(title, detail, label, action, id='') {
    return '<li><div><h3>'+H(title)+'</h3><p>'+H(detail)+'</p></div>'+
      btn(label,action,id,'mini quiet')+'</li>';
  }
  function adviceGroup(title,items) {
    if(!items.length)return '';
    const more=items.length>1?`<details class="subtle advice-more"><summary>${items.length-1} more</summary>
      <ol class="advice-list">${items.slice(1).join('')}</ol></details>`:'';
    return panel(title,`<ol class="advice-list">${items[0]}</ol>`+more);
  }
  function recommendations() {
    const now=E.today();
    if(!S.accounts.length&&!S.loans.length&&!S.bills.length) {
      return head('Recommendations','')+panel('Start with your statements',
        '<p>Aqueduct uses your balances, transactions, and upcoming dates to suggest what to do first.</p>',
        '',btn('Apply chat update','chat-update','','primary'));
    }
    const forecast=E.forecast(S,now), plan=plannedSnapshot(forecast,now), debt=E.debtProfile(S,now);
    const urgent=[], decisions=[], monthly=[];
    const overdue=forecast.overdue[0];
    if(overdue)urgent.push(recommendation('Verify open past-due bills',
      forecast.overdue.length+' still marked open. '+overdue.name+' was scheduled for '+dateLabel(overdue.originalDate||overdue.date)+'. Check whether it cleared and update the status.',
      'Check first bill','occurrence',overdue.key));
    const shortfall=forecast.shortfalls[0];
    if(shortfall)urgent.push(recommendation('Check the funding account for '+shortfall.name,
      'The scheduled payment could take '+alias(shortfall.account)+' below its cash buffer on '+dateLabel(shortfall.date)+'. Confirm the payment and the available balance.',
      'Check payment','occurrence',shortfall.key));
    if(!overdue&&!shortfall&&plan.due.length)urgent.push(recommendation(plan.pay?'Check bills due by your next paycheque':'Check upcoming bills',
      money(plan.outgoing)+' in known bills through '+dateLabel(plan.cutoff)+'.'+
      (plan.pay?' The next paycheque is scheduled for '+dateLabel(plan.pay.date)+' at '+money(plan.pay.forecastAmount)+'.':'')+
      (plan.amountPending?' Some bill amounts still need confirmation.':''),'Open bills','nav','Bills'));
    const balances=[...new Set(forecast.missing.concat(forecast.stale))];
    if(balances.length)urgent.push(recommendation('Refresh the cash forecast balances',
      balances.map(a=>a.name).join(', ')+'. Use the latest available balances to check what can clear before payday.',
      'Update balances','account-settings'));
    else if(!forecast.verified.length)urgent.push(recommendation('Set up your cash forecast',
      'Add the chequing or savings accounts you use for bills and enter a current balance.','Open accounts','account-settings'));
    const unassigned=forecast.unassigned.filter(e=>!e.key.startsWith('flex/'));
    if(unassigned.length)urgent.push(recommendation('Confirm funding and amounts for open payments',
      unassigned.slice(0,3).map(e=>e.name).join(', ')+(unassigned.length>3?' and '+(unassigned.length-3)+' more':'')+
      '. Open the date, then edit its schedule to select the funding account.',
      'Check first payment','occurrence',unassigned[0].key));
    const debtGaps=[...new Map(debt.missing.concat(forecast.missingLoanPayments).map(l=>[l.id,l])).values()];
    if(debtGaps.length)urgent.push(recommendation('Complete the debt payment details',
      debtGaps.map(l=>l.name).join(', ')+'. Confirm the rate, required payment, and next date from the lender before committing extra cash.',
      'Open debt terms','loan-edit',debtGaps[0].id));
    if(S.bills.some(b=>b.direction==='Bill'&&/mortgage/i.test(b.name)&&!b.loan&&(!b.end||b.end>=now))&&!S.loans.some(l=>l.type==='Mortgage')) {
      decisions.push(recommendation('Add the mortgage terms',
        'A mortgage payment is scheduled. Add the mortgage balance, rate, renewal, and prepayment limits so Debt can show the full picture.',
        'Add mortgage terms','mortgage-terms'));
    }
    const target=debt.target;
    if(target) {
      const next=debt.ranked.find(l=>l.id!==target.id&&l.type!=='Mortgage'&&l.currentRate>0&&(l.prepay==null||l.prepay>0));
      decisions.unshift(recommendation('Use '+target.name+' as the first candidate for extra payments',
        'At '+target.currentRate+'% it has the highest eligible rate on file.'+(next?' '+next.name+' is next at '+next.currentRate+'%.':'')+
        ' Verify the latest terms, cover minimums, and keep a cash buffer before directing a confirmed surplus here.',
        'Compare payoff options','nav','Debt & goals'));
    } else if(debt.active.length)decisions.unshift(recommendation('Confirm which debt to pay down first',
      'Add current rates and payment terms so you can compare the accounts.','Open debt','nav','Debt & goals'));
    if(debt.underInterest.length) {
      const risk=debt.underInterest[0];
      decisions.push(recommendation('Verify the payment on '+risk.name,
        money(risk.required)+' is on file per month against '+money(risk.monthlyInterest)+' in estimated monthly interest. Confirm the current lender minimum and how much would go to principal.',
        'Check debt terms','loan-edit',risk.id));
    }
    if(S.config.floor<=0&&forecast.verified.length)decisions.push(recommendation('Set a cash buffer for bills',
      'Choose how much to keep available in your operating accounts before increasing debt payments or funding optional goals.',
      'Set cash buffer','config','cash'));
    const nextMonth=E.shiftMonth(E.monthStart(now),1);
    const deposits=E.events(S,nextMonth,E.monthEnd(nextMonth)).filter(e=>e.direction==='Income'&&!['Paid','Skipped'].includes(e.status));
    const expected=E.sum(deposits,e=>e.forecastAmount||0);
    if(deposits.length)decisions.push(recommendation('Plan around dated income',
      monthLabel(nextMonth)+' has '+money(expected)+' in scheduled deposits with amounts entered. Match bills to each deposit date and check estimates when pay is confirmed.',
      'See paydays','nav','Bills'));
    else decisions.push(recommendation('Add the next paycheques and household deposits',
      'Enter expected dates and amounts so you can see what is due before the money arrives.','Add a deposit','income-schedule'));
    const recent=Array.from({length:13},(_,i)=>E.recordedCash(S,now,E.month(E.shiftMonth(now,-i)))).find(r=>r.available);
    if(recent) {
      const unknown=recent.sources.find(r=>r.name==='Needs review');
      if(unknown)decisions.push(recommendation('Identify the deposits still in review',
        money(unknown.amount)+' of '+monthLabel(recent.period)+' deposits are awaiting classification. '+money(recent.knownIncome)+
        ' was identified as income. Confirm whether the remaining deposits are income, transfers, or refunds.',
        'Review deposits','cash-bucket',JSON.stringify([recent.period,'in','Needs review'])));
      if(!recent.covered)monthly.push(recommendation('Complete statement coverage for '+monthLabel(recent.period),
        'Missing coverage for '+recent.scope.filter(x=>!x.covered).map(x=>x.account.name).join(', ')+'. Use the existing chat workflow to add the missing dates.',
        'See cash flow','open-cash-month',recent.period));
    }
    const pending=E.reviewPending(S).length, fixes=E.statementFixes(S).length;
    if(pending)monthly.push(recommendation('Clear the remaining transaction questions',
      pending+' transactions are waiting for confirmation. Start with repeat merchants to review several matching charges together.',
      'Open quick review','open-inbox'));
    if(fixes)monthly.push(recommendation('Verify combined statement rows',
      fixes+' rows need a merchant checked against the original statement.',
      'Open statement fixes','open-statement-fixes'));
    const recurring=E.recurringCharges(S).filter(x=>E.distance(x.transaction.date,now)<=60);
    if(recurring.length)monthly.push(recommendation('Check recurring charges',
      recurring.length+' regular patterns were seen in the last 60 days. Open Recurring to check which charges you still expect and what they typically cost.',
      'See recurring charges','open-recurring'));
    const history=E.history(S,now);
    const targetGaps=history.rows.filter(row=>row.average>0&&Object.hasOwn(S.targets,row.category)&&row.suggestion!==null&&row.average>row.suggestion)
      .sort((a,b)=>(b.average-b.suggestion)-(a.average-a.suggestion));
    if(targetGaps.length) {
      const gap=targetGaps[0];
      monthly.push(recommendation('Check the target for '+gap.category,
        'The historical monthly average is '+money(gap.average)+' against a '+money(gap.suggestion)+' target.'+
        (history.baselineReview?' The average is provisional while transactions are in review.':'')+
        ' Check whether the target or the spending needs adjusting.',
        'Review target','target-edit',gap.category));
    }
    const projects=E.ledgerRows(S.transactions).filter(t=>t.kind==='Project');
    if(projects.length)monthly.push(recommendation('Keep one-time projects visible separately',
      money(E.sum(projects,t=>-t.amount))+' in net project activity is recorded across all dates. Review any open project commitments alongside their own timeline.',
      'See projects','open-projects'));
    const topGoal=S.goals.filter(g=>g.saved<g.target).sort((a,b)=>a.priority-b.priority)[0];
    if(topGoal)monthly.push(recommendation('Review your priority goal · '+topGoal.name,
      money(topGoal.target-topGoal.saved)+' remains'+(topGoal.deadline?' by '+topGoal.deadline:'')+
      '. Use the allocation view to compare how much monthly surplus goes toward this goal and to debt.',
      'Compare allocations','nav','Debt & goals'));
    else if(!S.goals.length)monthly.push(recommendation('Choose what surplus should fund',
      'Add a cash reserve, savings, travel, or renovation goal. Give each a priority so you can compare it with debt in your allocation plan.',
      'Add a goal','goal-edit'));
    return head('Recommendations','',btn('Test monthly scenarios','nav','Monthly snapshot','quiet'))+
      `<div class="advice-layout">${adviceGroup('Check first',urgent)}
        ${adviceGroup('Plan next',decisions)}${adviceGroup('Monthly review',monthly)}</div>`+
      (urgent.length||decisions.length||monthly.length?'':panel('You’re up to date',no('Check back after your next statement.')))+
      '<details class="subtle section-gap"><summary>How the recommendations are ordered</summary>'+
      '<p class="small">Open payments and missing cash information come first. Debt uses the latest rates in your ledger and assumes you keep required payments current. Check rates, balances, and payment terms against your latest lender statements.</p>'+
      '<p class="small section-gap"><a href="https://www.canada.ca/en/financial-consumer-agency/services/debt/paying-debt.html">FCAC repayment guidance</a> · '+
      '<a href="https://www.canada.ca/en/financial-consumer-agency/services/savings-investments/setting-up-emergency-funds.html">FCAC emergency fund guidance</a></p></details>';
  }
  function settings() {
    const accountRows=S.accounts.map(a=>row(cell(link(a.name,'account-edit',a.id),'desc'),cell(H(a.type)),amountCell(a.balance),cell(H(a.balanceDate||'—')),
      cell((a.history?pill('History','dim'):'')+' '+(a.forecast?pill('Forecast','dim'):''))));
    const organized=panel('Accounts',accountRows.length?table(['Account','Type','$Entered balance','Balance date','Used in'],accountRows):no('Start with one chequing account and add each card used for household spending.'),
      'Use nicknames such as Joint chequing or Card A. Include all spending accounts when calculating a historical average.',btn('Add account','account-edit','','mini primary'));
    const c=S.config;
    const rules=S.rules.map((r,i)=>row(cell(H(r.merchant),'desc'),cell(H(alias(r.account))),cell(H(r.project?projectName(r.project):r.category||r.kind)),cell(btn('Remove','rule-remove',String(i),'mini danger'))));
    const rulesSection=panel('Saved merchant rules',rules.length?table(['Normalized description','Account','Category or project',''],rules):no('When reviewing a purchase, choose to remember its category for future matching descriptions.'));
    const exclusions=S.excludedMonths.map(m=>btn(monthLabel(m)+' ×','include-month',m,'mini'));
    return head('Settings','Manage account coverage, forecast assumptions, and backups.')+
      '<div id="settings-accounts">'+organized+'</div>'+
      '<div class="grid-2 section-gap">'+panel('Cash forecast','<ul class="list"><li><div>Forecast window</div><strong>'+c.window+' days</strong></li><li><div>Household cash buffer</div><strong>'+money(c.floor)+'</strong></li><li><div>Flexible spending allowance</div><strong>'+money(c.flex)+' / month</strong></li></ul>','',btn('Edit cash settings','config','cash','mini'))+
      panel('Baseline months','<div class="actions">'+(exclusions.length?exclusions.join(''):no('All fully covered months are eligible.'))+'</div>','Exclude move-in or unusually incomplete months from your average. Their transactions stay in history.',btn('Exclude a month','exclude-month','','mini'))+'</div>'+
      '<div class="grid-2 section-gap">'+panel('Encrypted backups','<p>Keep a backup outside cloud-synced folders. The same passphrase unlocks the backup. Browser data can disappear when you clear website data or change browser profiles. Each device has its own ledger.</p><div class="actions section-gap">'+
      btn('Download encrypted backup','backup','','primary')+(sample?'':btn('Share encrypted backup','share-backup'))+btn('Open backup','restore')+'</div>')+
      panel('Review with an adviser','<p>Create a small summary showing amounts by category and month. You can review the text and decide what to copy.</p><div class="actions section-gap">'+btn('Preview spending summary','summary')+'</div>')+'</div>'+
      '<div class="section-gap">'+rulesSection+'</div>'+
      panel('Getting started','<div class="stack"><details class="subtle"><summary>1. Set up accounts and your starting cash</summary><p>Add every account that contributed to the year of spending. For the forecast, enter balances you have verified for the accounts that actually pay bills. Keep an emergency reserve out of the forecast unless you intend to fund bills from it.</p></details>'+
      '<details class="subtle"><summary>2. Import statements and review the questions</summary><p>Export CAD transactions as CSV or TSV. Enter the real coverage dates, choose the right sign and date mapping, and compare the totals. Use the review queue to resolve transfers and mixed merchants. For example, add Basement as a project and tag its charges and refunds there.</p></details>'+
      '<details class="subtle"><summary>3. Add bills, paycheques, and debt terms</summary><p>Take amounts, due dates, interest rates, promo ends, and renewal dates from your latest statements. Enter the terms into this app. Use manual occurrences for variable bills and one-time project invoices. Choose a monthly extra amount after required payments and compare where to allocate it.</p></details>'+
      '<details class="subtle"><summary>4. Set up reminders and a monthly close</summary><p>Import the reminder file into a dedicated local calendar. Review pending transactions, refresh balances and bill dates, and download an encrypted backup after each close.</p></details></div>');
  }
  function accountEdit(id) {
    const a=byId(S.accounts,id)||{};
    return openDialog(a.id?'Edit account':'Add account','<div class="form-grid">'+
      field('Account nickname',f('name',a.name,'text','required maxlength="80"'))+
      field('Type',select('type',listTypes,a.type||'Chequing'))+
      field('Current balance',f('balance',inputMoney(a.balance),'text','inputmode="decimal"'),'Enter the amount owed as positive for cards and loans.')+
      field('Balance as of',f('balance_date',a.balanceDate||E.today(),'date'),'Use the date this balance was verified.')+
      field('Account-specific cash buffer',f('floor',inputMoney(a.floor??0),'text','inputmode="decimal"'))+
      field('Date opened',f('open_date',a.openDate,'date'),'Optional. Helps calculate your coverage if the account is new.')+
      field('Date closed',f('close_date',a.closeDate,'date'),'Optional. Leave blank for an active account.')+
      '</div>'+check('Include in historical household spending','history',a.id?a.history:true)+
      check('Use to fund the cash forecast','forecast',a.id?a.forecast:S.accounts.length===0),
      async data=>{
        const type=val(data,'type');
        const balance=dollarsField(data,'balance',{optional:true,min:Number.MIN_SAFE_INTEGER});
        const balanceDate=balance===null?'':dateField(data,'balance_date');
        const openDate=dateField(data,'open_date',true),closeDate=dateField(data,'close_date',true);
        if(balanceDate>E.today()||(closeDate&&openDate&&closeDate<openDate)) throw new Error('Check the account and balance dates.');
        const forecast=data.has('forecast')&&['Chequing','Savings'].includes(type);
        const value={id:a.id||E.id(),name:titleField(data),type,balance,balanceDate,openDate,closeDate,floor:dollarsField(data,'floor',{optional:true})||0,history:data.has('history'),forecast};
        await write(next=>replace(next.accounts,value));
        if(tab==='Import & review'&&files.length&&selectedFile&&!byId(files,selectedFile)?.account) byId(files,selectedFile).account=value.id;
        if(tab==='Import & review')render();
      },'Save account');
  }
  function config(which) {
    const c=S.config;
    const body=which==='plan'?'<div class="form-grid">'+
      field('Monthly amount available after required payments',f('surplus',inputMoney(c.surplus),'text','inputmode="decimal" required'),'Exclude bills, regular spending, required payments, and any commitments you already accounted for.')+
      field('Percent of extra cash toward debt',f('debt_share',c.debtShare,'number','min="0" max="100" step="1" required'),'The remainder funds your goals.')+
      field('Allocate extra debt dollars by',select('focus',['Highest rate','Lowest balance'],c.focus))+'</div>':
      '<div class="form-grid">'+field('Days to project',select('window',['30','45','60','90'],String(c.window)))+
      field('Combined cash buffer',f('floor',inputMoney(c.floor),'text','inputmode="decimal" required'))+
      field('Monthly flexible spending allowance',f('flex',inputMoney(c.flex),'text','inputmode="decimal" required'),'Optional forecast reserve for spending not already included in scheduled bills or card payments.')+
      field('Flexible spending cash account',select('flex_account',accountOptions(a=>cash(a)&&a.forecast),c.flexAccount))+'</div>';
    return openDialog(which==='plan'?'Edit priority allocation':'Edit cash assumptions',body,
      async data=>write(next=>{
        if(which==='plan') Object.assign(next.config,{surplus:dollarsField(data,'surplus'),debtShare:Math.round(numberField(data,'debt_share',0,100)),focus:val(data,'focus')});
        else {
          const flex=dollarsField(data,'flex'), flexAccount=val(data,'flex_account');
          if(flex&&!flexAccount) throw new Error('Choose the account for flexible spending.');
          Object.assign(next.config,{window:Number(val(data,'window')),floor:dollarsField(data,'floor'),flex,flexAccount});
        }
      }));
  }
  function excludeMonth() {
    return openDialog('Exclude baseline month',field('Month',f('month','2025-10','month','required'))+
      '<p class="small">The actual spending and transaction history for this month remain available.</p>',async data=>{
      const m=val(data,'month');
      if(!E.validDate(m+'-01')) throw new Error('Choose a valid month.');
      await write(next=>{if(!next.excludedMonths.includes(m))next.excludedMonths.push(m);});
    });
  }
  function summary() {
    const h=E.history(S,E.today(),month);
    const values=h.rows.filter(r=>r.actual||r.average||r.suggestion);
    const summary=['Month: '+monthLabel(month),'Complete comparison months: '+h.complete.length,'Everyday spending: '+money(h.total),
      'Project spending: '+money(h.projects),'Pending classifications: '+h.review.length,'',...values.map(r=>r.category+' | actual '+money(r.actual)+' | average '+money(r.average)+' | target '+money(r.suggestion))].join('\n');
    const form=openDialog('Review the summary','<p>Check the category names and totals before sharing.</p>'+field('Spending summary','<textarea rows="12" readonly>'+H(summary)+'</textarea>'),()=>{},'Done');
    form.querySelector('textarea').addEventListener('focus',event=>event.target.select());
  }
  function backup() {
    if(sample||!serialized) return note('Open your own encrypted ledger to download a backup.',true);
    download(serialized,'Aqueduct-Backup-'+E.today()+'.aqueduct','application/octet-stream');
    note('Encrypted backup downloaded.');
  }
  async function shareBackup() {
    if(sample||!serialized)return note('Open your own encrypted ledger first.',true);
    const name='Aqueduct-Backup-'+E.today()+'.aqueduct';
    const file=typeof navigator==='undefined'?null:shareFile(serialized,name,'application/octet-stream');
    if(!file) {
      return openDialog('Save encrypted backup',
        '<p>This viewer cannot share files directly. Use Download encrypted backup, or save this encrypted text as a plain-text file with the .aqueduct extension.</p>'+
        field('Encrypted backup text','<textarea rows="9" readonly>'+H(serialized)+'</textarea>'),()=>{},'Done',btn('Download backup','backup','',''));
    }
    try { await navigator.share({files:[file]}); }
    catch(error) { if(error.name!=='AbortError')throw error; }
  }
  function restore() {
    if(!localFile||!crypto.subtle)return note('Open Aqueduct directly from Atlas to restore a backup.',true);
    const existing=Vault.get();
    return openDialog('Open encrypted backup',field('Backup file','<input type="file" name="backup" accept=".aqueduct,.json" required>')+
      field('Backup passphrase',f('password','','password','required autocomplete="current-password"'))+
      (existing?check('Replace the saved ledger in this browser','replace'):'')+
      '<p class="small">'+(existing?'Leave Replace unchecked to review the backup in this window. Download a fresh backup before closing if you edit it.':'The restored ledger will be saved in this browser if local storage is available.')+'</p>',
      async data=>{
        const file=data.get('backup');
        if(!file?.size||file.size>100_000_000) throw new Error('Choose an Aqueduct backup file under 100 MB.');
        const content=await file.text();
        const unlocked=await Vault.open(content,data.get('password'));
        const temporary=Boolean(existing&&!data.has('replace'));
        if(!temporary)saveToBrowser(content,existing);
        files=[];staging=[];preview=null;
        enter(unlocked,content,false,temporary);
        note(temporary?'Backup opened for this window.':storageProblem?storageMessage:'Backup restored.',storageProblem&&!temporary);
        await applyChatUpdate();
      },'Unlock backup');
  }
  function demo() {
    const state=E.empty();
    const now=E.today();
    const cashId=E.id(), card=E.id(), savings=E.id(), basement=E.id(), loanId=E.id();
    const back=E.monthStart(E.shiftMonth(now,-12)), last=now;
    const account=(id,name,type,balance,forecast,history,floor)=>({id,name,type,balance,balanceDate:now,forecast,history,floor,openDate:'',closeDate:''});
    state.accounts.push(account(cashId,'Joint chequing','Chequing',634800,true,true,100000),
      account(card,'Household card','Credit card',190400,false,true,0),
      account(savings,'Emergency savings','Savings',1200000,false,false,0));
    const addTx=(account,date,description,amount,kind,category='',project='')=>{
      const t={id:E.id(),account,date,description,amount,kind,category,project,external:'',pair:'',note:'',why:kind==='Review'?'Which category or project does this belong to?':'Fictional statement',manual:kind!=='Review'};
      t.fingerprint=[t.date,E.normal(t.description),t.amount].join('|');
      state.transactions.push(t);
    };
    const historyNames=['Joint-chequing-history.csv','Card-history.csv'];
    [cashId,card].forEach((a,index)=>state.imports.push({id:E.id(),account:a,name:historyNames[index],start:back,end:last,count:0,
      balanceCheck:'Balances tie',coverageConfirmed:true,issueCount:0,approved:now}));
    for(let i=0;i<=12;i++) {
      const m=E.shiftMonth(back,i);
      const items=[
        [cashId,0,'Mortgage interest portion',-95600,'Spending','Interest & fees'],
        [cashId,0,'Mortgage principal portion',-94900,'Financing','Mortgage'],
        [card,0,'Superstore',-17400-i*690,'Spending','Groceries'],
        [card,0,'Cafe Cedar',-6150-i*245,'Spending','Dining'],
        [card,0,'Shell',-9100-i*268,'Spending','Transportation'],
        [cashId,0,'Manitoba Hydro',-15100-((i*37)%110)*100,'Spending','Housing & utilities'],
        [cashId,0,'Payroll',281000,'Income','Paycheque'],
        [cashId,3,'Home insurance',-15300,'Spending','Insurance'],
        [card,5,'Superstore',-31100+i*325,'Spending','Groceries'],
        [cashId,7,'Payroll',282000,'Income','Paycheque'],
        [card,8,'Dining',-14600-i*107,'Spending','Dining'],
        [card,9,'Apple.com/bill',-2100,'Spending','Subscriptions'],
        [card,11,'Oak Room Renovations',i<5?-163800:0,'Project','',basement],
        [card,13,'Pet Valu',-5800,'Spending','Pets'],
        [card,15,'Clinic North',-7100,'Spending','Health']
      ];
      for(const [a,offset,description,amount,kind,category,project] of items) {
        const date=E.add(m,offset);
        if(date<=now&&amount)addTx(a,date,description,amount,kind,category,project);
      }
    }
    state.imports.forEach(entry=>{
      const matching=state.transactions.filter(t=>t.account===entry.account&&t.date<=last);
      matching.forEach(t=>{t.importId=entry.id;});
      entry.count=matching.length;
    });
    addTx(card,now,'Oak Room Renovations',-28500,'Project','',basement);
    addTx(card,now,'Home Depot CA',-12829,'Review');
    addTx(card,now,'Marketplace order',-5636,'Review');
    addTx(cashId,now,'Interac e-transfer received',18000,'Review');
    addTx(card,now,'Superstore',-4235,'Review');
    addTx(card,E.add(now,-1),'Superstore',-6850,'Review');
    addTx(cashId,now,'Online banking payment',-31025,'Review');
    addTx(card,now,'Payment received',31025,'Review');
    state.projects.push({id:basement,name:'Basement renovation',status:'Active',unbilled:85000,loan:loanId,note:'Demo project labour and materials.'});
    const schedule=(name,amount,offset,frequency,mode,direction='Bill',project='',loan='')=>({id:E.id(),name,amount,start:E.add(now,offset),end:'',frequency,mode,direction,project,loan,note:'',account:cashId,variable:name.includes('Hydro')});
    state.bills.push(schedule('Household credit card',190400,3,'Monthly','Manual'),schedule('Paycheque',285000,6,'Biweekly','Deposit','Income'),
      schedule('Mortgage',190500,10,'Monthly','Autopay','Bill','',loanId),schedule('Manitoba Hydro',16620,15,'Monthly','Autopay'),
      schedule('Basement final invoice',47500,22,'Once','Manual','Bill',basement),schedule('Home internet',9400,12,'Monthly','Autopay'));
    state.bills.find(b=>b.direction==='Income').variable=true;
    state.loans.push({id:loanId,name:'Mortgage',type:'Mortgage',balance:28700000,rate:4.49,rateType:'Fixed',method:'Canadian mortgage',
      payment:190500,frequency:'Monthly',renewal:E.add(now,85),rateDate:'',rateAfter:null,prepay:1450000,minimumPercent:null,
      asOf:now,source:'Fictional term sheet',nextDue:E.add(now,10),account:cashId,note:''},
      {id:E.id(),name:'Line of credit',type:'Line of credit',balance:520000,rate:8.2,rateType:'Variable',method:'Monthly estimate',
        payment:18500,frequency:'Monthly',renewal:'',rateDate:'',rateAfter:null,prepay:null,minimumPercent:null,
        asOf:now,source:'Fictional statement',nextDue:E.add(now,20),account:cashId,note:''});
    state.bills.push(schedule('Line of credit',18500,20,'Monthly','Manual','Bill','',state.loans[1].id));
    state.goals.push({id:E.id(),name:'Cash reserve top-up',target:350000,saved:100000,deadline:E.add(now,225),priority:1},
      {id:E.id(),name:'Travel',target:420000,saved:80000,deadline:E.add(now,360),priority:2});
    state.targets['Housing & utilities']={method:'Annual',amount:222000,note:'Hydro set-aside from annual estimate'};
    state.targets['Insurance']={method:'Fixed',amount:15300,note:'Current home insurance'};
    Object.assign(state.config,{floor:125000,surplus:70000,flex:65000,flexAccount:cashId,monthlySnapshot:{draw:120000,variablePay:450000,household:240000,variable:520000}});
    enter({state},null,true);
  }

  function setLedger(patch) {
    reviewView='Ledger';
    ledger={filter:'All',account:'',month:'',category:'',project:'',search:'',...patch};
    ledgerPage=0;
    go('Import & review');
    if(!ledger.label)document.getElementById('ledger-filters')?.scrollIntoView({block:'start'});
  }
  const actions={
    nav:view=>{if(view==='Spending')categoryDetail='';go(view);},lock:()=>lock(),
    'dialog-close':()=>dialog.close(),demo,restore,backup,summary,
    'chat-update':chooseChatUpdate,'cancel-chat-update':()=>{chatUpdate=null;chatRead++;welcome();},'device-check':deviceCheck,'test-download':testDownload,'share-backup':shareBackup,
    'account-settings':()=>{tab='Settings';settingsJump='settings-accounts';render();settingsJump='';},
    'account-edit':accountEdit,config,'exclude-month':excludeMonth,
    'include-month':id=>write(next=>{next.excludedMonths=next.excludedMonths.filter(m=>m!==id);}),
    'rule-remove':i=>write(next=>{next.rules.splice(Number(i),1);}),
    'select-file':id=>{selectedFile=id;preview=null;render();},
    'drop-file':id=>{files=files.filter(x=>x.id!==id);selectedFile=files[0]?.id||'';preview=null;render();},
    unstage:id=>{staging=staging.filter(x=>x.id!==id);render();},
    'toggle-duplicate':(id)=>{
      const target=staging.flatMap(p=>p.items).find(x=>x.transaction.id===id);
      target.force=!target.force;render();
      const duplicateButton=[...document.querySelectorAll('[data-act="toggle-duplicate"]')].find(x=>x.dataset.id===id);
      if(duplicateButton){duplicateButton.closest('details').open=true;duplicateButton.focus();}
    },
    approve,
    'remove-import':id=>confirmation('Remove statement import?','Transactions that came from this import will be removed, even if reviewed. Any linked payment in another statement will be unlinked.','Remove import',async()=>write(next=>{
      const deleting=next.transactions.filter(t=>t.importId===id);
      deleting.forEach(t=>unpair(next,t.id));
      next.transactions=next.transactions.filter(t=>t.importId!==id);
      next.imports=next.imports.filter(i=>i.id!==id);
    })),
    'open-inbox':()=>{reviewView='Quick review';reviewMonth='';reviewType='All';reviewPicker='';go('Import & review');},
    'open-statement-fixes':()=>{reviewView='Statement fixes';go('Import & review');},
    'month-inbox':m=>{reviewView='Quick review';reviewMonth=m;reviewType='All';reviewPicker='';go('Import & review');},
    'fix-statement-row':fixStatementRow,
    'review-view':view=>{reviewView=view;if(view==='Ledger')ledger={filter:'All',account:'',month:'',category:'',project:'',search:''};ledgerPage=0;render();},
    'review-type':type=>{reviewType=type;reviewPicker='';render();},
    'review-all-months':()=>{reviewMonth='';reviewPicker='';render();},
    'review-category':id=>{const [card,category]=JSON.parse(id);return saveQuick(card,{kind:'Spending',category,project:''});},
    'review-confirm-type':id=>{const [card,kind]=JSON.parse(id);return saveQuick(card,{kind,category:kind==='Financing'?'Debt payment':'',project:''});},
    'review-project':id=>{const [card,project]=JSON.parse(id);if(!byId(S.projects,project))throw new Error('That project is no longer available.');return saveQuick(card,{kind:'Project',category:'',project});},
    'review-pair':id=>saveQuick(id),
    'review-picker':id=>{const remember=root.querySelector('#quick-remember')?.checked;reviewPicker=id;render();if(remember)root.querySelector('#quick-remember').checked=true;root.querySelector('.quick-choice')?.focus();},
    'review-later':id=>{setAside.add(id);reviewPicker='';render();root.querySelector('#quick-current')?.focus({preventScroll:true});},
    'review-reset':()=>{setAside.clear();render();},
    'review-undo':undoQuick,
    'spending-drill':openCategory,
    'category-back':()=>{const previous=categoryDetail;categoryDetail='';go('Spending');[...root.querySelectorAll('[data-act=spending-drill]')].find(x=>x.dataset.id===previous)?.focus();},
    'category-period':period=>{categoryPeriod=period;categoryPage=0;render();root.querySelector('[data-act=category-period][aria-pressed=true]')?.focus();},
    'category-page':step=>{categoryPage=Math.max(0,categoryPage+Number(step));render();root.querySelector('.category-transactions')?.scrollIntoView({block:'start'});},
    'month-plan-edit':editMonthlySnapshot,
    'planning-category':id=>{const [category,source]=JSON.parse(id);openCategory(category,E.month(E.today()),source==='Saved target'?'Target':'Average');},
    'scenario-auto':()=>{scenarioDraft.allAvailable=!scenarioDraft.allAvailable;render();root.querySelector('[data-act=scenario-auto]')?.focus({preventScroll:true});},
    'scenario-reset':()=>{scenarioDraft={};repaymentMode='Debt first';render();root.querySelector('[data-act=scenario-reset]')?.focus();},
    'scenario-fit':amount=>{scenarioDraft.variable=Math.max(0,Number(amount));render();root.querySelector('#scenario-variable')?.focus();},
    'monthly-repayment':mode=>{repaymentMode=mode;render();root.querySelector('[data-act=monthly-repayment][aria-pressed=true]')?.focus({preventScroll:true});},
    'open-cash-month':period=>{cashMonth=period;go('Cash history');},
    'open-changes':period=>{changesMonth=period;go('Monthly changes');},
    'change-driver':id=>{const [period,tone,name]=JSON.parse(id);changeSelection={period,tone,name,side:'This period'};categoryPage=0;go('Change driver');},
    'change-side':side=>{changeSelection.side=side;categoryPage=0;render();root.querySelector('[data-act=change-side][aria-pressed=true]')?.focus();},
    'open-spending-period':period=>{month=period;categoryDetail='';spendingTab='Categories';go('Spending');},
    'open-month-costs':period=>{if(period)month=period;go('Monthly costs');},
    'month-cost-drill':id=>{
      const [bucket,through]=id.startsWith('[')?JSON.parse(id):[id,''];
      setLedger({month,through,costBucket:bucket,label:monthCostLabels[bucket]+(through?' · through '+dateLabel(through):'')});
    },
    'open-recurring':()=>{spendingTab='Recurring';categoryDetail='';go('Spending');},
    'mortgage-terms':()=>loanEdit('mortgage'),
    'income-schedule':()=>billEdit('income'),
    'cash-forecast':()=>go('Cash plan'),
    'cash-controls':()=>{if(tab==='Monthly snapshot')cashPlanFromDebt=true;if(tab!=='Cash plan')go('Cash plan');root.querySelector('#cash-scenario [name=source_account]')?.focus();document.getElementById('cash-scenario')?.scrollIntoView({block:'center'});},
    'cash-period':period=>{cashMonth=period;render();window.scrollTo(0,0);root.querySelector('[name=cash-month]')?.focus();},
    'cash-bucket':id=>{
      const [period,tone,name]=JSON.parse(id);
      setLedger({month:period,cashGroup:{tone,name},label:name});
    },
    'chart-drill':id=>{const [selectedMonth,category]=JSON.parse(id);openCategory(category,selectedMonth);},
    'spending-tab':view=>{categoryDetail='';spendingTab=view;render();root.querySelector('[data-act=spending-tab][aria-pressed=true]')?.focus();},
    'merchant-history':id=>{const t=byId(S.transactions,id);if(t)setLedger({account:t.account,merchant:E.normal(t.description),direction:Math.sign(t.amount),category:t.category});},
    'project-drill':project=>setLedger({project,label:projectName(project)}),
    'open-projects':()=>{categoryDetail='';spendingTab='Projects';go('Spending');},
    'ledger-page':n=>{ledgerPage=Math.max(0,ledgerPage+Number(n));render();document.getElementById('ledger-filters')?.scrollIntoView({block:'nearest'});},
    transaction,'manual-transaction':manualTransaction,'monthly-close':monthlyClose,'target-edit':targetEdit,'project-edit':projectEdit,
    'bill-edit':billEdit, occurrence, calendar,
    'bill-window':()=>{postingWindow=postingWindow?'':E.add(E.today(),90);render();},
    'delete-bill':id=>confirmation('Remove schedule?','Future dates and saved occurrence statuses for this schedule will be removed. Imported transactions stay in your history.','Remove schedule',async()=>write(next=>{
      next.bills=next.bills.filter(b=>b.id!==id);
      for(const key of Object.keys(next.billStatus))if(key.startsWith(id+'/'))delete next.billStatus[key];
    })),
    'debt-extra':amount=>{debtExtra=Number(amount);render();root.querySelector('[data-act=debt-extra][aria-pressed=true]')?.focus({preventScroll:true});},
    'loan-edit':loanEdit,'loan-bill':id=>billEdit('',byId(S.loans,id)),'goal-edit':goalEdit
  };
  document.addEventListener('click',async event=>{
    const button=event.target.closest('button[data-act]');
    if(!button||button.disabled) return;
    const run=actions[button.dataset.act];
    if(!run)return;
    try { await run(button.dataset.id||''); } catch(error){note(error.message,true);}
  });
  welcome();
  if(hosted&&localFile&&'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./aqueduct-household-sw.js',{scope:'./aqueduct-household.html'})
      .catch(()=>{ /* The ledger can still open over HTTPS if offline caching is unavailable. */ });
  }
})();
