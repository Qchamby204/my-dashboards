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
  const allViews=['Overview','Import & review','Spending','Bills','Debt & goals','Settings','Recommendations'];
  const storageMessage='Browser storage is unavailable or full. Changes are in this window. Download an encrypted backup before closing it.';
  const PAGE=32;
  const idleLimit=10*60_000;
  let S=null, session=null, lastStored=null, serialized=null, storageProblem=false, memoryOnly=false, sample=false, saving=false;
  let tab=allViews[0], toastTimer=0, lastActivity=0, staging=[], files=[], selectedFile='', postingWindow='', ledgerPage=0;
  let ledger={filter:'Review',account:'',month:'',category:'',project:'',search:''};
  let month=E.month(E.today()), settingsJump='', preview=null, lockAfterSave=false;
  let chatUpdate=null, chatRead=0;
  let spendingTab='Categories', cashMonth='', debtExtra=25000;
  let reviewView='Quick review', reviewType='All', reviewMonth='', reviewPicker='', quickUndo=null;
  const setAside=new Set();
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
    tab=allViews[0];
    reviewView='Quick review'; reviewType='All'; reviewMonth=''; reviewPicker=''; quickUndo=null; setAside.clear();
    spendingTab='Categories'; cashMonth=''; debtExtra=25000;
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
    if(result.review)details.push(result.review+' for review');
    return 'Chat update applied · '+details.join(' · ');
  }
  function go(view) {
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
    const views=[overview,imports,spending,bills,debt,settings,recommendations];
    const tabs=[['Home','Overview'],['Spending','Spending'],['Bills','Bills'],['Debt','Debt & goals'],['Review','Import & review'],['Recommendations','Recommendations']];
    root.innerHTML='<header class="top"><div class="top-inner"><div class="brand-row">'+brand+'<div class="actions"><span class="small">'+(sample?'Fictional demo':'Household')+'</span>'+
      atlasLink+'<button type="button" class="btn mini quiet settings-shortcut" data-act="nav" data-id="Settings" aria-label="Settings"'+(tab==='Settings'?' aria-current="page"':'')+'>'+icon(tabIcons.Settings)+'</button>'+
      (sample?btn('Exit demo','lock','','mini quiet'):btn('Lock','lock','','mini quiet'))+'</div></div><nav class="nav" aria-label="Dashboard">'+
      tabs.map(([label,v])=>'<button type="button" class="nav-tab" data-act="nav" data-id="'+H(v)+'"'+(v===tab?' aria-current="page"':'')+'>'+icon(tabIcons[label])+(v==='Recommendations'?'<span class="wide-label">Recommendations</span><span class="short-label" aria-hidden="true">Advice</span><span class="screen-reader compact-label">Recommendations</span>':'<span>'+H(label)+'</span>')+'</button>').join('')+'</nav></div></header><main id="main">'+
      (storageProblem?banner(H(storageMessage)+' '+link('Download encrypted backup','backup'),'warning'):'')+
      views[allViews.indexOf(tab)]()+'</main>';
    if(tab===allViews[0]) {
      drawChart();
      root.querySelector('[name=cash-month]')?.addEventListener('change',event=>{cashMonth=event.target.value;render();root.querySelector('[name=cash-month]')?.focus();});
    }
    if(tab===allViews[1]) bindImport();
    if(tab===allViews[2]) root.querySelector('[name=month-view]')?.addEventListener('change',event=>{if(/^\d{4}-\d{2}$/.test(event.target.value)){month=event.target.value;render();}});
    if(settingsJump) document.getElementById(settingsJump)?.scrollIntoView({block:'start'});
  }
  const piePalette=['#12664f','#a86636','#425a86','#6b7f47','#a14b5b','#3b7d8b','#746279'];
  const slicesFor=(rows,metric)=>rows.map(x=>({name:x.category,amount:x[metric]}))
    .filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount||a.name.localeCompare(b.name));
  function spendingPie(h,metric,period) {
    const positive=slicesFor(h.rows,metric);
    if(!positive.length)return no(metric==='average'?'An average will appear after complete statement months are available.':'No categorized spending to chart for this month.');
    const total=E.sum(positive,x=>x.amount);
    const chart=positive.slice(0,5);
    if(positive.length>5)chart.push({name:'All other categories',amount:E.sum(positive.slice(5),x=>x.amount),other:true});
    const negative=h.rows.some(x=>x[metric]<0);
    let angle=0;
    const segments=chart.map((x,i)=>{
      const end=i===chart.length-1?100:angle+x.amount/total*100;
      const segment=piePalette[i]+' '+angle.toFixed(5)+'% '+end.toFixed(5)+'%';
      angle=end;
      return segment;
    });
    const links=chart.map((x,i)=>{
      const clickable=!x.other&&metric==='actual';
      const share=x.amount/total*100;
      return '<li><span class="pie-dot" style="--swatch:'+piePalette[i]+'" aria-hidden="true"></span>'+
        (clickable?link(x.name,'chart-drill',JSON.stringify([period,x.name])):'<span>'+H(x.name)+'</span>')+
        '<strong class="money">'+money(x.amount)+'</strong><small>'+(share<1?'&lt;1%':Math.round(share)+'%')+'</small></li>';
    }).join('');
    return '<div class="pie-layout"><div class="pie-ring" aria-hidden="true" style="--slices:'+segments.join(',')+
      '"><div><strong class="money">'+money(total)+'</strong><small>'+(metric==='average'?'Per month':'In this chart')+'</small></div></div>'+
      '<ul class="pie-legend" aria-label="Category amounts and shares">'+links+'</ul></div>'+
      (negative?'<p class="small pie-note">Net refunds are included in your spending total.</p>':'');
  }
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
  function chartMonths(records) {
    const max=Math.max(1,...records.flatMap(r=>[r.inflow,r.outflow]));
    return '<ul class="cash-trend">'+records.map(r=>'<li class="'+(r.covered?'':'partial')+'">'+
      '<div class="trend-label"><button type="button" class="link-button" data-act="cash-period" data-id="'+H(r.period)+'">'+H(monthLabel(r.period))+'</button>'+
      '<small>'+(r.available?r.covered?'Complete':'Partial':'No data')+'</small></div>'+
      (r.available?'<div class="trend-pair"><div>'+bar(r.inflow,max,'in')+'<span class="money"><span class="screen-reader">Money in </span>'+money(r.inflow)+'</span></div>'+
      '<div>'+bar(r.outflow,max,'out')+'<span class="money"><span class="screen-reader">Money out </span>'+money(r.outflow)+'</span></div></div>'+
      '<strong class="money trend-net'+(r.net<0?' negative':'')+'"><span class="screen-reader">Net </span>'+signedMoney(r.net)+'</strong>':'')+'</li>').join('')+'</ul>';
  }
  function plannedSnapshot(p,now) {
    const pay=p.upcoming.find(e=>e.direction==='Income'&&/paycheque|payroll|draw|salary|payday/i.test(e.name));
    const cutoff=pay?.date||E.add(now,14);
    const open=p.overdue.concat(p.upcoming.filter(e=>e.date<=cutoff)).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.direction==='Income')-Number(b.direction==='Income'));
    const due=open.filter(e=>e.direction==='Bill');
    const incoming=open.filter(e=>e.direction==='Income');
    const outgoing=E.sum(due,e=>e.forecastAmount||0);
    const deposits=E.sum(incoming,e=>e.forecastAmount||0);
    const amountPending=due.filter(e=>e.forecastAmount===null).length;
    const before=p.points.filter(x=>x.date<=cutoff&&(!pay||x.date<pay.date||x.event?.direction!=='Income'));
    const beforePay=p.headroom===null||!pay||!before.length?null:Math.min(...before.map(x=>x.total));
    return {pay,cutoff,open,due,incoming,outgoing,deposits,amountPending,beforePay};
  }
  function forecastCard(p,now,plan) {
    const actionable=p.unassigned.filter(e=>!e.key.startsWith('flex/')).slice(0,4);
    const funded=p.headroom!==null;
    const warning=(!funded?'<div class="forecast-gap"><strong>Cash available is still unconfirmed</strong>'+
      '<p>Enter the missing balances, payment dates, or funding accounts below to see the projected low point.</p></div>':'')+
      (p.stale.length?'<p class="small">Cash balances last checked before today. Update them to account for any recent activity.</p>':'')+
      (p.shortfalls.length?'<p class="small cash-alert">'+p.shortfalls.length+' scheduled payment'+(p.shortfalls.length===1?' could':'s could')+' take a funding account below its buffer.</p>':'');
    const missing=[...p.missing.map(a=>link('Add balance for '+a.name,'account-edit',a.id)),
      ...actionable.map(e=>link(e.name+' · check amount or funding','occurrence',e.key)),
      ...p.missingLoanPayments.slice(0,4).map(l=>link(l.name+' · confirm payment schedule','loan-edit',l.id))];
    const tasks=missing.length?'<ul class="list forecast-tasks">'+missing.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'';
    const graph=funded?'<div class="cash-visual"><canvas id="cash-chart" role="img" aria-label="Projected cash. Starting '+H(money(p.opening))+', lowest '+H(money(p.low))+', ending '+H(money(p.ending))+'."></canvas>'+
      '<div class="chart-scale"><span>'+H(dateLabel(now))+'</span><span>Dashed line · cash buffer</span><span>'+H(dateLabel(p.end))+'</span></div></div>'+
      '<div class="cash-reading"><span>Lowest projected cash <strong class="money">'+money(p.low)+'</strong> · '+H(dateLabel(p.lowDate))+'</span>'+
      (plan.beforePay!==null?'<span>Low before payday <strong class="money">'+money(plan.beforePay)+'</strong></span>':'')+
      '<span>Lowest cash above your buffers <strong class="money">'+money(p.headroom)+'</strong></span></div>':'';
    const balances=p.verified.length?'<details class="subtle section-gap"><summary>Cash balances used</summary><ul class="list">'+p.verified.map(a=>
      '<li><div>'+link(a.name,'account-edit',a.id)+'<small class="small">Entered '+H(a.balanceDate)+'</small></div><strong class="money">'+money(p.starting[a.id])+'</strong></li>').join('')+'</ul></details>':'';
    return panel('Projected cash balance',graph+warning+tasks+balances,'Next '+S.config.window+' days · includes scheduled cash activity',btn('Balances','account-settings','','mini quiet'));
  }
  function overview() {
    const now=E.today(), projection=E.forecast(S,now), plan=plannedSnapshot(projection,now);
    const series=Array.from({length:13},(_,i)=>E.recordedCash(S,now,E.month(E.shiftMonth(now,-i))));
    const active=series.find(x=>x.period===cashMonth)||series.find(x=>x.available)||series[0];
    const trend=series.slice(series.indexOf(active),series.indexOf(active)+6).reverse();
    const latest=S.chatUpdates?.at(-1);
    const pending=S.transactions.filter(t=>t.kind==='Review').length;
    const coverageName=active.available?(active.period===E.month(now)?active.covered?'Month to date':'Month to date · partial':active.covered?'Complete month':'Partial statements'):'Awaiting statements';
    const dateNote=active.through?'Recorded through '+dateLabel(active.through):'Select an imported month';
    const scale=Math.max(1,active.inflow,active.outflow);
    const hero='<section class="cash-lead"><section class="hero spending-hero flow-hero"><h2>Net cash movement</h2>'+
      '<div class="hero-value money">'+(active.available?signedMoney(active.net):'—')+'</div><p>'+H(monthLabel(active.period)+' · '+coverageName)+'</p>'+
      '<div class="hero-baseline"><div><span>Recorded money in</span><strong class="money">'+money(active.available?active.inflow:null)+'</strong></div>'+
      '<div><span>Recorded money out</span><strong class="money">'+money(active.available?active.outflow:null)+'</strong></div></div></section>'+
      '<section class="panel timing-card"><div class="panel-title"><h2>'+(plan.pay?'Before next payday':'Next 14 days')+'</h2>'+btn('Bills & paydays','nav','Bills','mini quiet')+'</div>'+
      (plan.pay?'<p class="next-pay"><span>Next paycheque · '+H(dateLabel(plan.pay.date))+'</span><strong class="money">'+money(plan.pay.forecastAmount)+'</strong></p>':'')+
      '<ul class="amount-list">'+cashBar('Scheduled bills through '+dateLabel(plan.cutoff),plan.outgoing,Math.max(plan.deposits,plan.outgoing),'out')+
      cashBar('Expected deposits through '+dateLabel(plan.cutoff),plan.deposits,Math.max(plan.deposits,plan.outgoing),'in')+'</ul>'+
      '<p class="small">'+(plan.amountPending?plan.amountPending+' bill amounts pending. ':'')+'Includes expected deposits and recorded bill amounts through that date.</p>'+
      '<p class="small">'+(projection.headroom===null?'Cash balance forecast needs a few confirmations. ':plan.beforePay!==null?'Lowest cash before payday '+money(plan.beforePay)+'. ':'')+
      link('See forecast','cash-forecast')+'</p></section></section>';
    const accountCoverage=active.scope.length?'<details class="subtle section-gap"><summary>Statement coverage and what counts as cash flow</summary><ul class="list">'+active.scope.map(x=>
      '<li><span>'+H(x.account.name)+'</span><small>'+H(x.covered?'Covered for this period':x.through?'Partial · through '+dateLabel(x.through):'Statement needed')+'</small></li>').join('')+'</ul>'+
      '<p class="small">Chequing and savings activity only. Linked transfers between tracked cash accounts are excluded. Credit card payments count as cash leaving when paid. Purchase categories are under Spending.</p></details>':'';
    const cashActual=(active.available?'<p class="recognized-income"><span>Identified income</span><strong class="money">'+money(active.knownIncome)+'</strong></p>':'')+'<div class="home-grid">'+cashBuckets('Money in',active.sources,scale,'in',active.period)+cashBuckets('Money out',active.uses,scale,'out',active.period)+'</div>'+
      (active.uncertainty?'<p class="small section-gap">'+active.uncertainty+' uncategorized cash movement'+(active.uncertainty===1?' is':'s are')+' included above. '+link('Review this month','month-inbox',active.period)+'</p>':'')+accountCoverage;
    const h=E.history(S,now,active.period);
    const projects=S.projects.map(project=>{
      const total=E.sum(E.ledgerRows(S.transactions).filter(t=>t.kind==='Project'&&t.project===project.id),t=>-t.amount);
      return '<li>'+link(project.name,'project-drill',project.id)+'<strong class="money">'+money(total)+'</strong></li>';
    }).join('');
    return head('Household cash flow',dateNote,'<div class="actions">'+field('Cash flow month',select('cash-month',series.map(r=>[r.period,monthLabel(r.period)+(r.available?'':' · no data')]),active.period))+
      btn('Apply chat update','chat-update','','primary')+'</div>')+hero+
      panel('What moved your cash',cashActual,active.covered?monthLabel(active.period):'Based on available statements · '+monthLabel(active.period))+
      panel('Cash flow by month','<div class="chart-key"><span class="key-in">Money in</span><span class="key-out">Money out</span><span>Net at right</span></div>'+chartMonths(trend),
        'Partial months are marked and may understate activity.')+
      '<div id="cash-forecast" class="home-grid section-gap">'+forecastCard(projection,now,plan)+
      panel('Coming up',plan.open.length?'<ul class="list event-list">'+plan.open.slice(0,5).map(e=>eventItem(e,now,new Set(projection.shortfalls.map(x=>x.key)))).join('')+'</ul>':
        no('No open dates in this window.'),'Earliest items through '+dateLabel(plan.cutoff),btn('All dates','nav','Bills','mini quiet'))+'</div>'+
      '<div class="home-grid section-gap">'+panel('Everyday spending',spendingPie(h,'actual',active.period),
      monthLabel(active.period)+' purchases · includes card purchases',btn('Spending details','open-spending-month',active.period,'mini quiet'))+
      panel('One-time projects',projects?'<ul class="list">'+projects+'</ul>':no('No project costs recorded.'),'All recorded dates',btn('Projects','open-projects','','mini quiet'))+'</div>'+
      (pending?'<div class="review-strip"><strong>'+pending+' transactions to confirm</strong>'+btn('Open review','open-inbox','','mini')+'</div>':'')+
      (latest?'<details class="subtle section-gap"><summary>Last chat update</summary><p class="small">'+H(chatUpdateSummary(latest))+'</p></details>':'');
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
  function drawChart() {
    const el=document.getElementById('cash-chart'); if(!el) return;
    const p=E.forecast(S,E.today());
    const ratio=window.devicePixelRatio||1, w=el.clientWidth, h=el.clientHeight;
    el.width=w*ratio;el.height=h*ratio;
    const g=el.getContext('2d');g.scale(ratio,ratio);
    if(!p.verified.length) {
      g.setLineDash([5,5]);g.strokeStyle='#43876f';g.beginPath();g.moveTo(0,h/2);g.lineTo(w,h/2);g.stroke();
      return;
    }
    const upper=Math.max(...p.points.map(x=>x.total),S.config.floor), lower=Math.min(p.low,S.config.floor);
    const top=upper===lower?upper+10000:upper, bottom=lower;
    const left=64, right=Math.max(left+1,w-8);
    const y=value=>h-15-(value-bottom)/(top-bottom)*(h-30);
    const x=date=>left+(right-left)*E.distance(E.today(),date)/S.config.window;
    const compact=new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',notation:'compact',maximumFractionDigits:1});
    g.font='11px Figtree, sans-serif';g.textBaseline='middle';g.fillStyle='#475459';g.strokeStyle='#c8d9ce';g.lineWidth=1;
    for(const value of [bottom,(bottom+top)/2,top]) {
      g.fillText(compact.format(value/100),2,y(value));g.beginPath();g.moveTo(left,y(value));g.lineTo(right,y(value));g.stroke();
    }
    const points=[...p.points,{date:p.end,total:p.ending}];
    const path=()=>{
      g.beginPath();g.moveTo(x(points[0].date),y(points[0].total));
      for(let i=1;i<points.length;i++){g.lineTo(x(points[i].date),y(points[i-1].total));g.lineTo(x(points[i].date),y(points[i].total));}
    };
    path();g.lineTo(right,h-15);g.lineTo(left,h-15);g.closePath();
    const gradient=g.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,'#43876f35');gradient.addColorStop(1,'#43876f04');
    g.fillStyle=gradient;g.fill();
    g.strokeStyle='#276a54';g.lineWidth=2.5;path();g.stroke();
    g.setLineDash([5,4]);g.lineWidth=1;g.strokeStyle='#a86d37';g.beginPath();g.moveTo(left,y(S.config.floor));g.lineTo(right,y(S.config.floor));g.stroke();
  }
  window.addEventListener('resize',()=>{if(S&&tab===allViews[0])drawChart();});
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
    return head('Transactions','',btn('Apply chat update','chat-update','','primary'))+
      segments(['Quick review','Ledger'],reviewView,'review-view','Transactions view')+
      (reviewView==='Quick review'?quickReview():panel('Transaction ledger',ledgerView()))+
      '<details class="subtle section-gap manual-import"'+(files.length||staging.length?' open':'')+'><summary>Import bank exports manually</summary>'+upload+staged+'</details>'+historical;
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
    const question=!isPair&&(card.type==='compound'?'This statement line may combine purchases. Check it before categorizing.':
      isGroup?'This choice applies to all '+count+' matching charges.':t.why);
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
    const source=S.transactions.filter(t=>{
      const slices=t.allocations?.length?t.allocations:[t];
      return (!ledger.account||t.account===ledger.account)&&(!ledger.month||E.month(t.date)===ledger.month)&&
        (!ledger.search||E.normal(t.description+' '+t.note).includes(E.normal(ledger.search)))&&
        (!ledger.ids||ledger.ids.has(t.id))&&
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
      const label=t.allocations?.length?'Split':t.project?projectName(t.project):t.category||t.kind;
      return '<li><div><small>'+H(dateLabel(t.date))+' · '+H(alias(t.account))+'</small>'+
        link(t.description,'transaction',t.id)+'<small>'+H(t.kind==='Review'?t.why:label+(t.pair?' · Linked':''))+'</small></div>'+
        '<strong class="money">'+money(t.amount)+'</strong></li>';
    });
    const navigation=source.length>PAGE?'<div class="table-controls">'+btn('Previous','ledger-page','-1','mini',ledgerPage?'':' disabled')+
      '<small>Page '+(ledgerPage+1)+' of '+(max+1)+'</small>'+btn('Next','ledger-page','1','mini',ledgerPage<max?'':' disabled')+'</div>':'';
    return '<div class="stack">'+filters+'<p class="small">'+source.length+' matching transaction'+(source.length===1?'':'s')+'</p>'+
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
    if(t.pair) {
      const other=byId(S.transactions,t.pair);
      return confirmation('Linked payment','This '+money(t.amount)+' entry is linked to '+(other?.description||'another transaction')+' in '+alias(other?.account)+'.','Unlink payment',async()=>write(next=>unpair(next,id)));
    }
    const same=S.transactions.filter(x=>x.id!==t.id&&!x.manual&&!x.pair&&!x.allocations&&x.account===t.account&&Math.sign(x.amount)===Math.sign(t.amount)&&E.normal(x.description)===E.normal(t.description));
    const candidates=['Review','Transfer'].includes(t.kind)?S.transactions.filter(x=>x.id!==t.id&&!x.pair&&!x.allocations&&x.account!==t.account&&x.amount===-t.amount&&Math.abs(E.distance(x.date,t.date))<=7&&['Review','Transfer'].includes(x.kind)):[];
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
  function spendingComparison(history) {
    const compare=history.rows.filter(r=>r.actual>0||r.average>0||r.suggestion>0)
      .sort((a,b)=>Math.max(b.actual,b.average||0,b.suggestion||0)-Math.max(a.actual,a.average||0,a.suggestion||0)).slice(0,6);
    if(!compare.length)return no('The comparison appears once spending or monthly targets are recorded.');
    const max=Math.max(1,...compare.flatMap(r=>[r.actual,r.average||0,r.suggestion||0]));
    const rowBar=(label,value,tone)=>'<div class="compare-line"><span class="screen-reader">'+H(label)+' </span>'+
      (value===null?'':bar(value,max,tone))+'<span class="money">'+money(value)+'</span></div>';
    return '<div class="chart-key"><span class="key-in">Recorded</span><span class="key-out">Historical average</span><span class="key-rate">Target</span></div>'+
      '<ul class="spending-compare">'+compare.map(r=>'<li>'+link(r.category,'spending-drill',r.category)+
      '<div>'+rowBar('Recorded',history.current.length?r.actual:null,'in')+rowBar('Historical average',r.average,'out')+
      rowBar('Target',r.suggestion,'rate')+'</div></li>').join('')+'</ul>'+
      '<p class="small section-gap">Bars share one dollar scale. Historical averages and targets represent a full month. Negative net amounts are shown in the figures.</p>';
  }
  function spending() {
    const h=E.history(S,E.today(),month);
    const viewTabs=segments(['Categories','Recurring'],spendingTab,'spending-tab','Spending view');
    const summary=head('Spending & projects','',spendingTab==='Categories'?'<div class="actions">'+
      field('Viewing month',f('month-view',month,'month','max="'+E.month(E.today())+'"'))+btn('Monthly review','monthly-close')+'</div>':'');
    if(spendingTab==='Recurring')return summary+viewTabs+recurringView();
    const targetTotal=E.sum(h.rows,x=>x.suggestion||0);
    const configured=h.rows.filter(x=>x.suggestion!==null).length;
    const records=h.rows.filter(x=>x.actual||x.average||x.suggestion||Object.hasOwn(S.targets,x.category));
    const months=h.complete.slice().reverse().map(m=>monthLabel(m)).join(', ');
    const average=h.complete.length?E.sum(h.rows,x=>x.average):null;
    const totals='<div class="stat-grid spending-totals">'+stat('Recorded spending',h.current.length?h.total:null,h.current.length?'':'Awaiting statements')+
      stat('Monthly average',average,h.complete.length?h.complete.length+' complete months':'Awaiting coverage')+
      stat('Monthly target',configured?targetTotal:null)+'</div>';
    const sorted=records.sort((a,b)=>Math.max(b.actual,b.average||0,b.suggestion||0)-Math.max(a.actual,a.average||0,a.suggestion||0));
    const rows=sorted.map(x=>{
      return '<li class="category"><div class="category-title">'+link(x.category,'spending-drill',x.category)+
        btn('Set target','target-edit',x.category,'mini quiet',' aria-label="'+H('Set target for '+x.category)+'"')+'</div>'+
        '<div class="category-numbers"><div><small>Recorded</small><strong class="money">'+money(h.current.length?x.actual:null)+'</strong></div>'+
        '<div><small>Monthly avg.</small><strong class="money">'+money(x.average)+'</strong></div>'+
        '<div><small>Target</small><strong class="money">'+money(x.suggestion)+'</strong></div></div>'+
        (x.suggestion>0&&h.current.length?'<progress max="'+x.suggestion+'" value="'+Math.min(x.suggestion,Math.max(0,x.actual))+'" aria-label="'+H(x.category+' spending against target')+'"></progress>':'')+'</li>';
    });
    const cautions=[h.review.length?h.review.length+' transactions to confirm in this month':'',
      h.baselineReview?h.baselineReview+' in the months used for the average':''].filter(Boolean).join(' · ');
    const comparisons=totals+
      (cautions?'<div class="review-strip"><p>'+H(cautions)+'</p>'+
      (h.review.length?btn('Review month','month-inbox',month,'mini'):btn('Open review','open-inbox','','mini'))+'</div>':'')+
      panel('Largest spending categories',spendingComparison(h),monthLabel(month)+' compared with your historical average and target')+
      panel('Categories',rows.length?'<ul class="categories">'+rows.join('')+'</ul>':no('Categories will appear when reviewed statements are applied.'),
        'Tap a category to see its transactions.',btn('Add target','target-edit','','mini quiet'))+
      '<details class="subtle section-gap"><summary>How your targets are calculated</summary><p class="small">Average uses '+H(months||'complete statement months, once available')+
      '. Suggested targets use the latest three complete months when available. A fixed or annual target replaces that estimate for its category. Transfers, financing and projects are excluded.</p></details>';
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
    return summary+viewTabs+comparisons+
      '<div id="spending-projects" class="section-gap">'+panel('One-time projects',projects?'<ul class="list">'+projects+'</ul>':no('Add a project such as Basement, then tag its purchases in the transaction review.'),'Project totals use all imported dates. Financing stays in Debt & goals.',btn('Add project','project-edit','','mini primary'))+'</div>';
  }
  function segments(labels,active,action,name) {
    return '<div class="segments" role="group" aria-label="'+H(name)+'">'+labels.map(label=>
      btn(label,action,label,'',' aria-pressed="'+String(label===active)+'"')).join('')+'</div>';
  }
  function recurringView() {
    const h=E.recurringCharges(S);
    const rows=h.map(x=>{
      const t=x.transaction;
      return '<li><div><small>'+H(x.frequency)+' pattern · '+H(t.category)+'</small>'+
        link(t.description,'merchant-history',t.id)+'<small>'+H(alias(t.account))+' · Last seen '+H(t.date)+' · '+x.count+' matching charges</small></div>'+
        '<div class="recurring-amount"><strong class="money">'+money(x.amount)+'</strong><small>Typical charge</small></div></li>';
    });
    return panel('Recurring charges',rows.length?'<ul class="list event-list">'+rows.join('')+'</ul>':
      no('Recurring charges appear after at least three similar payments at regular intervals.'),
      'Detected in statement history. Tap a merchant to see its charges.');
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
    return head('Bills & paydays','Through '+dateLabel(end),'<div class="actions">'+btn('Add a date','bill-edit','','primary')+btn('Reminders','calendar')+'</div>')+
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
    const basis=target?H(target.name)+' has the highest eligible rate on file at <strong>'+H(target.currentRate)+'%</strong>. Once minimums and your cash buffer are covered, it is the first candidate for extra payments.':'Add or confirm current rates and terms to see a payoff priority.';
    const action=overdue.length?'<p class="debt-alert">'+link(overdue[0].name,'occurrence',overdue[0].key)+' is past its scheduled date and still marked open. Verify whether it cleared.</p>':'';
    const state=forecast.headroom===null||profile.missing.length?'Confirm the items below before choosing an extra amount.':
      forecast.headroom<=0?'The cash forecast has no room above your buffers. Start by checking the upcoming payments.':
      'Use your monthly surplus after required payments, regular expenses, and planned savings to set the extra amount.';
    return '<section class="debt-guide"><div><h2>Start with the highest-cost debt</h2><p>'+basis+'</p></div>'+
      '<div class="debt-steps"><ol><li><strong>Keep minimums current.</strong> Check past-due or upcoming payments across all accounts.</li>'+
      '<li><strong>Protect your cash buffer.</strong> '+H(state)+'</li>'+
      '<li><strong>Direct confirmed surplus to '+(target?H(target.name):'the first ranked debt')+'.</strong> Verify the latest rate, promotional terms, and any prepayment limits first.</li></ol>'+action+
      (openIssues.length?'<div class="actions">'+openIssues.join('')+'</div>':'')+'</div></section>';
  }
  function debtRanking(profile) {
    const max=Math.max(1,...profile.ranked.map(l=>l.currentRate));
    const ranked=profile.ranked.map(l=>'<li><div class="amount-caption">'+link(l.name,'loan-edit',l.id)+'<strong>'+H(l.currentRate)+'%</strong></div>'+
      bar(l.currentRate,max,l.id===profile.target?.id?'priority':'rate')+
      '<small>'+money(l.balance)+' balance · '+H(l.rateType||'Rate on file')+(l.asOf?' · as of '+H(l.asOf):'')+'</small></li>');
    const unranked=profile.active.filter(l=>!profile.ranked.some(r=>r.id===l.id));
    return panel('Interest rates, highest first',ranked.length?'<ul class="amount-list ranked-debt">'+ranked.join('')+'</ul>'+
      (unranked.length?'<p class="small">Rate needed for '+H(unranked.map(l=>l.name).join(', '))+'.</p>':''):
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
    return head('Debt & goals','Rates, next steps and repayment scenarios',btn('Edit allocation','config','plan','primary'))+
      debtGuidance(profile,forecast,now)+
      (profile.active.length?'<div class="stat-grid debt-stats">'+stat('Recorded debt',profile.balance,'Balances on file')+
        stat('Estimated monthly interest',profile.ranked.length?profile.monthlyCost:null,'For balances with an entered rate')+
        stat('Highest-rate balance',profile.target?.balance??null,profile.target?.name||'Confirm rates')+'</div>':'')+
      '<div class="home-grid section-gap">'+debtRanking(profile)+debtExample(profile.target,now)+'</div>'+
      '<div class="section-gap">'+panel('Balances & terms',loans.length?'<ul class="categories">'+loans.join('')+'</ul>':no('Add a mortgage, line of credit, credit card balance, or other loan.'),'',btn('Add debt','loan-edit','','mini quiet'))+'</div>'+
      panel('Priority goals',goalRows.length?'<ul class="list">'+goalRows.join('')+'</ul>':no('Add a cash reserve, savings goal, trip, or renovation contribution.'),'Extra goal dollars fund priority 1 first, then the next goal.',btn('Add goal','goal-edit','','mini quiet'))+
      '<section class="panel"><div class="panel-title"><div><h2>Monthly allocation</h2><p>'+money(S.config.surplus)+' per month after regular spending and required payments · '+H(S.config.focus)+' first within debt</p></div></div>'+missing+
      '<div class="plan-grid">'+cards+'</div><p class="small section-gap">Estimates start from your entered balances, assume no new borrowing, and run for up to 50 years. Required payments use monthly equivalents and accrue interest monthly. Canadian mortgage mode converts a nominal semi-annual rate to a monthly equivalent. Annual extra-payment limits reset every 12 model months. Rates stay at the last entered value beyond a renewal unless you enter a replacement rate. Freed payments and unused debt allocations flow to goals when they can’t be used for extra debt payments.</p></section>'+
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
  function recommendation(title, detail, label, action, id='') {
    return '<li><div><h3>'+H(title)+'</h3><p>'+H(detail)+'</p></div>'+
      btn(label,action,id,'mini quiet')+'</li>';
  }
  function adviceGroup(title, items, note='') {
    return items.length?panel(title,'<ol class="advice-list">'+items.join('')+'</ol>',note):'';
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
    const pending=S.transactions.filter(t=>t.kind==='Review').length;
    if(pending)monthly.push(recommendation('Clear the remaining transaction questions',
      pending+' transactions are waiting for confirmation. Start with repeat merchants to review several matching charges together.',
      'Open quick review','open-inbox'));
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
    const total=urgent.length+decisions.length+monthly.length;
    return head('Recommendations','Based on your current ledger · '+dateLabel(now))+
      '<div class="advice-overview"><div><strong>'+urgent.length+'</strong><span>Check first</span></div>'+
      '<div><strong>'+decisions.length+'</strong><span>Plan next</span></div><div><strong>'+monthly.length+'</strong><span>Monthly review</span></div></div>'+
      (total?adviceGroup('Check first',urgent,'Bills and balances that can affect your next payment')+
        adviceGroup('Plan next',decisions,'Income and debt decisions')+
        adviceGroup('Monthly review',monthly,'Transactions, spending, projects, and goals'):
        panel('You’re up to date',no('Check back after your next statement or when your payment dates change.')))+
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
    const back=E.monthStart(E.shiftMonth(now,-12)), last=E.add(E.monthStart(now),-1);
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
    Object.assign(state.config,{floor:125000,surplus:70000,flex:65000,flexAccount:cashId});
    enter({state},null,true);
  }

  function setLedger(patch) {
    reviewView='Ledger';
    ledger={filter:'All',account:'',month:'',category:'',project:'',search:'',...patch};
    ledgerPage=0;
    go('Import & review');
    document.getElementById('ledger-filters')?.scrollIntoView({block:'start'});
  }
  const actions={
    nav:go,lock:()=>lock(),
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
    'month-inbox':m=>{reviewView='Quick review';reviewMonth=m;reviewType='All';reviewPicker='';go('Import & review');},
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
    'spending-drill':category=>setLedger({month,category}),
    'open-cash-month':period=>{cashMonth=period;go('Overview');},
    'open-recurring':()=>{spendingTab='Recurring';go('Spending');},
    'mortgage-terms':()=>loanEdit('mortgage'),
    'income-schedule':()=>billEdit('income'),
    'cash-forecast':()=>document.getElementById('cash-forecast')?.scrollIntoView({block:'start'}),
    'cash-period':period=>{cashMonth=period;render();window.scrollTo(0,0);root.querySelector('[name=cash-month]')?.focus();},
    'cash-bucket':id=>{
      const [period,tone,name]=JSON.parse(id);
      const flow=E.recordedCash(S,E.today(),period);
      const group=(tone==='in'?flow.sources:flow.uses).find(r=>r.name===name);
      if(group)setLedger({month:period,ids:new Set(group.ids)});
    },
    'open-spending-month':period=>{month=period;spendingTab='Categories';go('Spending');},
    'chart-drill':id=>{const [selectedMonth,category]=JSON.parse(id);setLedger({month:selectedMonth,category});},
    'spending-tab':view=>{spendingTab=view;render();},
    'merchant-history':id=>{const t=byId(S.transactions,id);if(t)setLedger({account:t.account,merchant:E.normal(t.description),direction:Math.sign(t.amount),category:t.category});},
    'project-drill':project=>setLedger({project}),
    'open-projects':()=>{spendingTab='Categories';go('Spending');document.getElementById('spending-projects')?.scrollIntoView({block:'start'});},
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
