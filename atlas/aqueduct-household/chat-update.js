'use strict';

const ChatUpdate=(()=>{
  const E=Engine;
  const accountTypes=['Chequing','Savings','Credit card','Line of credit or loan','Other'];
  const recurrence=['Once','Weekly','Biweekly','Monthly','Quarterly','Annual'];
  const keyPattern=/^[a-z0-9][a-z0-9._-]{0,95}$/;
  const fail=message=>{throw new Error(message);};
  const object=(o,label)=>{
    if(!o||typeof o!=='object'||Array.isArray(o))fail(label+' must be an object.');
    return o;
  };
  const list=(value,label)=>{
    if(value===undefined)return [];
    if(!Array.isArray(value))fail(label+' must be a list.');
    return value;
  };
  const text=(value,label,max=180)=>{
    if(typeof value!=='string'||!value.trim()||value.length>max)fail('Check '+label+' in the chat update.');
    return value.trim();
  };
  const optionalText=(value,label,max)=>value===undefined||value===''?'':text(value,label,max);
  const key=(value,label)=>{
    if(typeof value!=='string'||!keyPattern.test(value))fail('Check '+label+' in the chat update.');
    return value;
  };
  const option=(value,allowed,label)=>{
    if(!allowed.includes(value))fail('Check '+label+' in the chat update.');
    return value;
  };
  const integer=(value,label,min=0,max=100_000_000_000_00)=>{
    if(!Number.isSafeInteger(value)||value<min||value>max)fail('Check '+label+' in the chat update.');
    return value;
  };
  const signed=(value,label)=>integer(value,label,-100_000_000_000_00);
  const optionalMoney=(value,label)=>value===undefined||value===null?null:integer(value,label);
  const rate=(value,label)=>{
    if(value===undefined||value===null)return null;
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>100)fail('Check '+label+' in the chat update.');
    return value;
  };
  const date=(value,label,optional=false)=>{
    if(optional&&(value===undefined||value===''))return '';
    if(typeof value!=='string'||!E.validDate(value))fail('Check '+label+' in the chat update.');
    return value;
  };
  const flag=(value,otherwise,label)=>{
    if(value===undefined)return otherwise;
    if(typeof value!=='boolean')fail('Check '+label+' in the chat update.');
    return value;
  };
  const lower=E.normal;
  const signature=(packet,account,day,amount,description)=>JSON.stringify([packet,account,day,amount,lower(description)]);
  function repairRows(state,update,accounts,projects,reviewed,touched) {
    const sourceKeys=new Map(state.imports.map(i=>[i.id,i.sourceKey]));
    const index=new Map(), patches=new Map(), candidates=new Set();
    for(const packet of list(update.statements,'statements')) {
      for(const row of list(packet.transactions,'statement transactions')) {
        candidates.add(signature(packet.key,packet.account,row.date,row.amount,row.description));
      }
    }
    for(const row of update.repair.rows) {
      object(row,'Statement repair row');
      const packet=key(row.packet,'original statement ID'), account=key(row.account,'repair account ID');
      const day=date(row.date,'original posting date'), amount=signed(row.amount,'original amount');
      const before=text(row.description,'original description',240), after=object(row.replacement,'Replacement transaction');
      const name=text(after.description,'replacement description',240);
      if(after.date!==day||after.amount!==amount||E.compoundDescription(after)||
        !candidates.has(signature(packet,account,day,amount,name)))fail('A statement repair does not match a row in the updated statement.');
      const external=optionalText(row.external,'transaction reference',140);
      flag(row.classificationTrusted,false,'statement classification trust');
      const savedAccount=accounts.get(account);
      if(!savedAccount)fail('A statement repair refers to an unknown account.');
      const id=signature(packet,savedAccount.id,day,amount,before);
      if(!patches.has(id))patches.set(id,[]);
      patches.get(id).push({...row,external});
    }
    for(const t of state.transactions) {
      const packet=sourceKeys.get(t.importId);
      for(const [day,description] of [[t.date,t.description],[t.sourceDate||t.date,t.sourceDescription],[t.priorSourceDate||t.date,t.priorSourceDescription]]) {
        if(!description)continue;
        const id=signature(packet,t.account,day,t.amount,description);
        if(!patches.has(id))continue;
        if(!index.has(id))index.set(id,new Set());
        index.get(id).add(t);
      }
    }
    const used=new Set();
    for(const [id,rows] of patches) {
      const matches=[...(index.get(id)||[])];
      if(matches.length>rows.length||(matches.length>0&&matches.length<rows.length&&rows.every(r=>!r.external)&&
        new Set(rows.map(r=>lower(r.replacement.description))).size>1))fail('A statement repair has ambiguous matches. The ledger was left intact.');
      for(const row of rows) {
        const t=matches.find(x=>!used.has(x.id)&&(!row.external||row.external===x.external));
        if(!t)continue;
        used.add(t.id);
        const wasCompound=E.compoundDescription(t);
        const wasEdited=lower(t.description)!==lower(row.description)&&!wasCompound;
        if(!wasEdited)t.description=row.replacement.description;
        t.priorSourceDescription=row.description;
        t.priorSourceDate=row.date;
        t.sourceDescription=row.replacement.description;
        t.sourceDate=row.date;
        const categoryUnchanged=t.kind===row.before?.kind&&(t.category||'')===(row.before?.category||'');
        if(!t.pair&&!t.allocations?.length&&(t.kind==='Review'||wasCompound&&categoryUnchanged)) {
          const project=row.replacement.project;
          const safe=row.classificationTrusted&&(!project||projects.has(project));
          if(safe)Object.assign(t,reviewed(row.replacement,t.amount),{note:t.note||row.replacement.note||''});
          else if(wasCompound)Object.assign(t,{kind:'Review',category:'',project:'',why:'Description corrected from the bank export. Confirm the category.',manual:false});
        }
        touched.add(t.id);
      }
    }
    return used.size;
  }
  function applyReviewPass(state,pass,accounts,reviewed,result,touched) {
    const sources=new Map(state.imports.map(i=>[i.id,i.sourceKey]));
    const index=new Map();
    for(const t of state.transactions) {
      const descriptions=[[t.date,t.description],[t.sourceDate||t.date,t.sourceDescription],[t.priorSourceDate||t.date,t.priorSourceDescription]];
      for(const [day,desc] of descriptions) {
        if(!desc)continue;
        const id=signature(sources.get(t.importId),t.account,day,t.amount,desc);
        if(!index.has(id))index.set(id,new Set());
        index.get(id).add(t);
      }
    }
    const locate=ref=>{
      object(ref,'Transaction reference');
      const packet=key(ref.source,'statement ID');
      const account=accounts.get(key(ref.account,'account ID'));
      const day=date(ref.date,'posting date'),amount=signed(ref.amount,'amount');
      const description=text(ref.description,'description',240),external=optionalText(ref.external,'bank reference',140);
      if(!account)return [];
      const id=signature(packet,account.id,day,amount,description);
      return [...(index.get(id)||[])].filter(t=>!external||t.external===external);
    };
    const eligible=(t,from)=>!t.pair&&!t.allocations?.length&&!E.compoundDescription(t)&&
      (t.kind==='Review'&&!t.manual||t.why==='Prepared in chat'&&from.some(x=>x.kind===t.kind&&x.category===(t.category||'')));
    const rows=list(pass.rows,'reviewed transactions');
    let matched=0;
    for(const entry of rows) {
      const matches=locate(entry);
      const count=integer(entry.count??1,'matching rows',1,1000);
      const from=list(entry.from,'previous classifications').map(x=>({
        kind:option(object(x,'Previous classification').kind,E.kinds,'previous type'),
        category:optionalText(x.category,'previous category',60)
      }));
      const values=reviewed(entry,entry.amount);
      if(matches.length!==count) {
        result.unmatched=(result.unmatched||0)+count;
        continue;
      }
      matched+=count;
      for(const t of matches) {
        if(!eligible(t,from)||t.kind===values.kind&&(t.category||'')===values.category&&(t.project||'')===values.project)continue;
        Object.assign(t,values,{note:t.note||values.note});
        touched.add(t.id);
        result.corrected++;
      }
    }
    if(rows.length&&!matched)fail('Apply the latest statement update before importing this transaction review.');
    for(const link of list(pass.links,'transfer matches')) {
      object(link,'Transfer match');
      const left=locate(link.out),right=locate(link.in);
      const label=text(link.label,'transfer label',60);
      if(left.length!==1||right.length!==1)continue;
      const [out]=left,[incoming]=right;
      if(out.pair===incoming.id&&incoming.pair===out.id)continue;
      const allowed=t=>eligible(t,[{kind:'Transfer',category:t.category||''},{kind:'Financing',category:t.category||''}])||
        touched.has(t.id)&&!t.pair&&['Transfer','Financing'].includes(t.kind)&&!t.allocations?.length;
      if(!allowed(out)||!allowed(incoming)||out.amount>=0||out.amount!==-incoming.amount||out.account===incoming.account||
        Math.abs(E.distance(out.date,incoming.date))>4)continue;
      for(const [t,other] of [[out,incoming],[incoming,out]]) {
        t.beforePair={kind:t.kind,category:t.category,project:t.project,why:t.why,manual:t.manual};
        Object.assign(t,{kind:'Transfer',category:label,project:'',pair:other.id,manual:true,why:'Matched to '+other.description});
        touched.add(t.id);
      }
      result.linked=(result.linked||0)+1;
    }
  }
  function read(serialized) {
    let update;
    try{update=JSON.parse(serialized);}catch{fail('Choose the Aqueduct update file prepared in chat.');}
    if(update?.format!=='aqueduct-chat-update'||![1,2].includes(update.version))fail('Choose an Aqueduct chat update. Bank statements and backups use separate import tools.');
    key(update.id,'update ID');
    if(update.baseUpdate!==undefined)key(update.baseUpdate,'base update ID');
    for(const name of ['accounts','projects','statements','loans','bills','goals','targets','excludedMonths','corrections'])list(update[name],name);
    if(update.repair!==undefined) {
      const repair=object(update.repair,'Statement repair');
      if(repair.version!==1||!Array.isArray(repair.rows))fail('Choose a supported statement repair file.');
    }
    if(update.version===2||update.reviewPass!==undefined) {
      const pass=object(update.reviewPass,'Transaction review');
      list(pass.rows,'reviewed transactions');
      list(pass.links,'transfer matches');
    }
    if(update.config!==undefined)object(update.config,'Allocation');
    return update;
  }
  function apply(state,update,today) {
    const updates=state.chatUpdates??[];
    if(updates.some(x=>x.id===update.id))return {already:true};
    if(update.repair) {
      const existing=(items,entry)=>items.find(x=>x.chatKey===entry.key||lower(x.name)===lower(entry.name));
      update={...update,
        loans:list(update.loans,'loans').filter(x=>{const old=existing(state.loans,x);return !old||old.chatKey===x.key&&x.asOf>old.asOf;}),
        bills:list(update.bills,'bills').filter(x=>!existing(state.bills,x)),
        projects:list(update.projects,'projects').map(x=>existing(state.projects,x)?{key:x.key,name:x.name}:x),
        config:undefined,excludedMonths:undefined};
    }
    if(!update.repair&&updates.some(x=>x.id===update.baseUpdate)) {
      update={id:update.id,corrections:list(update.corrections,'corrections').filter(entry=>entry.onlyReview===true)};
    }
    const result={added:0,duplicates:0,review:0,corrected:0,statements:0};
    const touched=new Set();
    function merge(group,label,fields,matchesEntry,updateExisting) {
      const known=new Map();
      for(const raw of list(update[group],label)){
        const entry=object(raw,label);
        const chatKey=key(entry.key,label+' ID');
        if(known.has(chatKey))fail('The chat update repeats '+label+' ID '+chatKey+'.');
        const data=fields(entry);
        let existing=state[group].find(v=>v.chatKey===chatKey);
        if(!existing){
          const matches=state[group].filter(v=>lower(v.name)===lower(data.name)&&matchesEntry(v,data));
          const available=matches.filter(v=>!v.chatKey);
          if(available.length>1)fail('More than one dashboard entry matches '+data.name+'.');
          if(group==='accounts'&&matches.some(v=>v.chatKey))fail('Use the existing chat account ID for '+data.name+'.');
          existing=available[0];
        }
        if(existing) {
          updateExisting(existing,data,entry);
          existing.chatKey=chatKey;
        } else {
          existing={id:E.id(),chatKey,...data};
          state[group].push(existing);
        }
        known.set(chatKey,existing);
      }
      for(const item of state[group])if(item.chatKey&&!known.has(item.chatKey))known.set(item.chatKey,item);
      return known;
    }
    const lookup=(map,value,label,optional=false)=>{
      if(optional&&(value===undefined||value===''))return '';
      const entry=map.get(key(value,label));
      if(!entry)fail('The chat update refers to an unknown '+label+'.');
      return entry.id;
    };
    const nickname=(x,label)=>text(x.name,label+' name',80);
    const accounts=merge('accounts','account',x=>{
      const type=option(x.type,accountTypes,'account type');
      const balance=x.balance===undefined||x.balance===null?null:signed(x.balance,'account balance');
      const balanceDate=balance===null?'':date(x.balanceDate,'balance date');
      const openDate=date(x.openDate,'account opening date',true),closeDate=date(x.closeDate,'account closing date',true);
      if(balanceDate>today||(openDate&&closeDate&&openDate>closeDate))fail('The chat update contains an invalid account date.');
      return {name:nickname(x,'account'),type,balance,balanceDate,openDate,closeDate,
        floor:optionalMoney(x.floor,'account buffer')??0,history:flag(x.history,true,'statement coverage'),
        forecast:['Chequing','Savings'].includes(type)&&flag(x.forecast,balance!==null&&type==='Chequing','cash forecast')};
    },(a,b)=>a.type===b.type,(saved,data)=>{
      if(saved.type!==data.type)fail(data.name+' has a different account type on the dashboard.');
      if(data.balance!==null&&(!saved.balanceDate||data.balanceDate>saved.balanceDate)){
        saved.balance=data.balance;saved.balanceDate=data.balanceDate;
      }
      if(!saved.openDate&&data.openDate)saved.openDate=data.openDate;
      if(!saved.closeDate&&data.closeDate)saved.closeDate=data.closeDate;
    });
    const loans=merge('loans','debt',x=>{
      const asOf=date(x.asOf,'debt balance date');
      const rateAfter=rate(x.rateAfter,'replacement interest rate'),rateDate=date(x.rateDate,'promo expiry or rate change date',true);
      if(asOf>today||(rateAfter!==null&&!rateDate))fail('The chat update contains an invalid debt date.');
      const type=option(x.type,['Mortgage','Credit card','Line of credit','Auto loan','Other'],'debt type');
      return {name:nickname(x,'debt'),type,asOf,balance:integer(x.balance,'debt balance'),rate:rate(x.rate,'annual interest rate'),
        rateType:option(x.rateType??'Fixed',['Fixed','Variable','Promotional'],'rate type'),
        method:option(x.method??'Monthly estimate',['Monthly estimate','Canadian mortgage'],'interest convention'),
        payment:optionalMoney(x.payment,'required debt payment'),frequency:option(x.frequency??'Monthly',[...recurrence.slice(1),'Semimonthly'],'debt payment frequency'),
        minimumPercent:rate(x.minimumPercent,'minimum percentage'),renewal:date(x.renewal,'renewal date',true),nextDue:date(x.nextDue,'next payment date',true),
        account:lookup(accounts,x.account,'funding account',true),rateAfter,rateDate,
        prepay:optionalMoney(x.prepay,'annual prepayment limit')??(type==='Mortgage'?0:null),
        source:optionalText(x.source,'debt source',120),note:optionalText(x.note,'debt note')};
    },(a,b)=>a.type===b.type,(saved,data,raw)=>{
      if(saved.type!==data.type)fail(data.name+' has a different debt type on the dashboard.');
      if(saved.asOf&&data.asOf<saved.asOf)return;
      const fields=['balance','asOf','rate','rateType','method','payment','frequency','minimumPercent','renewal','nextDue','account','rateAfter','rateDate','prepay','source','note'];
      for(const f of fields)if(Object.hasOwn(raw,f))saved[f]=data[f];
      if(!saved.rateDate&&saved.rateAfter!==null)fail('The updated debt terms need an effective date.');
    });
    const projects=merge('projects','project',x=>({name:nickname(x,'project'),
      status:option(x.status??'Active',['Active','Planned','Complete'],'project status'),
      unbilled:optionalMoney(x.unbilled,'unbilled project amount'),loan:lookup(loans,x.loan,'project debt',true),
      note:optionalText(x.note,'project note')}),()=>true,(saved,data,raw)=>{
      for(const field of ['status','unbilled','loan','note'])if(Object.hasOwn(raw,field))saved[field]=data[field];
    });
    merge('bills','bill or payday',x=>{
      const direction=option(x.direction,['Bill','Income','Transfer'],'bill type');
      const account=lookup(accounts,x.account,'funding account',true);
      const toAccount=direction==='Transfer'?lookup(accounts,x.toAccount,'destination account'):'';
      if(direction==='Transfer'&&(!account||account===toAccount))fail('A planned transfer needs two different accounts.');
      const start=date(x.start,'first payment date'),end=date(x.end,'final payment date',true);
      if(end&&end<start)fail('The end of a schedule must follow its start date.');
      return {name:nickname(x,'schedule'),direction,account,toAccount,start,end,
        frequency:option(x.frequency??'Monthly',recurrence,'schedule frequency'),amount:optionalMoney(x.amount,'scheduled payment'),
        mode:direction==='Income'?'Deposit':option(x.mode??'Manual',['Manual','Autopay'],'payment method'),
        variable:flag(x.variable,false,'variable payment'),project:direction==='Bill'?lookup(projects,x.project,'project',true):'',
        loan:direction==='Bill'?lookup(loans,x.loan,'scheduled debt',true):'',note:optionalText(x.note,'payment note')};
    },(a,b)=>a.account===b.account&&a.direction===b.direction,(saved,data,raw)=>{
      if(saved.direction!==data.direction)fail('The chat update changes the type of '+saved.name+'.');
      for(const field of ['account','toAccount','amount','frequency','start','end','mode','variable','project','loan','note'])if(Object.hasOwn(raw,field))saved[field]=data[field];
    });
    merge('goals','goal',x=>({name:nickname(x,'goal'),target:integer(x.target,'goal amount',1),saved:optionalMoney(x.saved,'saved amount')??0,
      deadline:date(x.deadline,'goal deadline',true),priority:integer(x.priority??1,'goal priority',1,99)}),
      ()=>true,(saved,data,raw)=>{
        for(const field of ['target','saved','deadline','priority'])if(Object.hasOwn(raw,field))saved[field]=data[field];
      });
    function classification(entry) {
      const kind=option(entry.kind??'Review',E.kinds,'transaction type');
      const project=kind==='Project'?lookup(projects,entry.project,'transaction project'):'';
      const category=['Spending','Reimbursement'].includes(kind)?text(entry.category,'category',60):optionalText(entry.category,'category',60);
      return {kind,category,project};
    }
    function reviewed(entry,amount){
      const base=classification(entry);
      let allocations;
      if(entry.allocations!==undefined) {
        if(!Array.isArray(entry.allocations)||entry.allocations.length!==2)fail('A split needs two amounts.');
        allocations=entry.allocations.map(a=>{
          object(a,'Transaction split');
          const amountPart=signed(a.amount,'split amount'),fields=classification(a);
          if(!amountPart||Math.sign(amountPart)!==Math.sign(amount)||!['Spending','Reimbursement','Project','Financing'].includes(fields.kind))fail('Check the parts of the split transaction.');
          return {amount:amountPart,...fields};
        });
        if(E.sum(allocations,a=>a.amount)!==amount)fail('A split does not match its original amount.');
        Object.assign(base,allocations[0]);
        delete base.amount;
      }
      return {...base,allocations,manual:base.kind!=='Review',
        why:optionalText(entry.question,'transaction question',240)||(base.kind==='Review'?'Confirm category or project in chat.':'Prepared in chat'),
        note:optionalText(entry.note,'transaction note')};
    }
    if(update.repair)result.corrected+=repairRows(state,update,accounts,projects,reviewed,touched);
    const packetKeys=new Set();
    const priorSources=new Set(state.imports.map(x=>x.sourceKey).filter(Boolean));
    for(const packet of list(update.statements,'statements')){
      object(packet,'Statement');
      const sourceKey=key(packet.key,'statement ID'),account=lookup(accounts,packet.account,'statement account');
      if(packetKeys.has(sourceKey))fail('The chat update repeats a statement ID.');
      packetKeys.add(sourceKey);
      const start=date(packet.start,'start of statement'),end=date(packet.end,'end of statement');
      if(end<start||end>today)fail('Check the date range for a statement.');
      const id=E.id(), name=text(packet.label,'statement label',120);
      const issues=integer(packet.issueCount??0,'unresolved rows',0,100_000);
      const coverageConfirmed=flag(packet.coverageConfirmed,false,'confirmed statement coverage')&&!issues;
      const rows=list(packet.transactions,'statement transactions').map(entry=>{
        object(entry,'Transaction');
        const day=date(entry.date,'transaction date');
        if(day<start||day>end)fail('A transaction falls outside its statement dates.');
        const amount=signed(entry.amount,'transaction amount');
        const description=text(entry.description,'transaction description',240);
        const external=optionalText(entry.external,'transaction reference',140);
        const t={id:E.id(),importId:id,account,date:day,amount,description,external,pair:'',...reviewed(entry,amount)};
        if(E.compoundDescription(t))Object.assign(t,E.classify(state,t),{manual:false,allocations:undefined});
        const rule=t.kind==='Review'&&!t.allocations?E.savedRule(state,t):null;
        if(rule&&rule.kind!=='Review'&&(rule.kind!=='Project'||state.projects.some(p=>p.id===rule.project))) {
          Object.assign(t,{kind:rule.kind,category:rule.category,project:rule.project,manual:true,why:'Saved rule'});
        }
        return {transaction:t};
      });
      E.duplicateReview(state.transactions,rows);
      const accepted=rows.filter(x=>!x.duplicate).map(x=>x.transaction);
      if(!accepted.length&&priorSources.has(sourceKey)){result.duplicates+=rows.length;continue;}
      for(const t of accepted){state.transactions.push(t);touched.add(t.id);}
      state.imports.push({id,account,name,start,end,coverageConfirmed,balanceCheck:packet.reconciled===true?'Balances tie':'Unverified',
        issueCount:issues,count:accepted.length,approved:today,sourceKey});
      result.added+=accepted.length;
      result.duplicates+=rows.length-accepted.length;
      result.statements++;
    }
    for(const entry of list(update.corrections,'corrections')) {
      object(entry,'Correction');
      const account=lookup(accounts,entry.account,'correction account');
      const d=date(entry.date,'correction date'),amount=signed(entry.amount,'correction amount');
      const description=text(entry.description,'description of the corrected transaction',240);
      const external=optionalText(entry.external,'correction reference',140);
      const matches=state.transactions.filter(t=>t.account===account&&t.amount===amount&&(!external||external===t.external)&&
        (t.date===d&&lower(t.description)===lower(description)||t.sourceDescription&&(t.sourceDate||t.date)===d&&lower(t.sourceDescription)===lower(description)));
      if(matches.length!==1)fail('A correction does not match one transaction in your ledger.');
      const t=matches[0];
      if(E.compoundDescription({description}))continue;
      if(flag(entry.onlyReview,false,'apply to unclassified rows only')&&(t.kind!=='Review'||t.allocations?.length))continue;
      if(t.pair)fail('A correction refers to a linked transfer. Unlink it in the dashboard before reclassifying it.');
      Object.assign(t,reviewed(entry,amount));
      touched.add(t.id);result.corrected++;
    }
    for(const match of E.matchTransfers(state.transactions,state.accounts)) {
      if(!touched.has(match.left.id)&&!touched.has(match.right.id))continue;
      for(const [t,other] of [[match.left,match.right],[match.right,match.left]]) {
        t.beforePair={kind:t.kind,category:t.category,project:t.project,why:t.why,manual:t.manual};
        Object.assign(t,{kind:'Transfer',category:match.label,project:'',pair:other.id,manual:true,why:'Matched to '+other.description});
      }
    }
    if(update.reviewPass)applyReviewPass(state,update.reviewPass,accounts,reviewed,result,touched);
    for(const t of list(update.targets,'targets')){
      object(t,'Category target');
      const category=text(t.category,'target category',60);
      if(['__proto__','constructor','prototype'].includes(category))fail('Check the target category.');
      const method=option(t.method,['Recent history','Fixed','Annual'],'target method');
      const amount=method==='Recent history'?null:integer(t.amount,'target amount');
      if(!Object.hasOwn(state.targets,category))state.targets[category]={method,amount,note:optionalText(t.note,'target reason',140)};
    }
    for(const m of list(update.excludedMonths,'baseline months')){
      if(typeof m!=='string'||!/^\d{4}-\d{2}$/.test(m)||!E.validDate(m+'-01'))fail('Check the excluded baseline month.');
      if(!state.excludedMonths.includes(m))state.excludedMonths.push(m);
    }
    if(update.config){
      const c=update.config;
      if(Object.hasOwn(c,'surplus'))state.config.surplus=integer(c.surplus,'monthly surplus');
      if(Object.hasOwn(c,'debtShare'))state.config.debtShare=integer(c.debtShare,'debt allocation',0,100);
      if(Object.hasOwn(c,'floor'))state.config.floor=integer(c.floor,'cash buffer');
      if(Object.hasOwn(c,'focus'))state.config.focus=option(c.focus,['Highest rate','Lowest balance'],'debt priority');
    }
    result.review=state.transactions.filter(t=>touched.has(t.id)&&t.kind==='Review').length;
    result.id=update.id;result.date=today;
    state.chatUpdates=[...updates,result];
    return result;
  }
  return {read,apply};
})();
