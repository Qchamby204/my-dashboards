'use strict';
const Engine = (() => {
  const categories = ['Groceries','Dining','Housing & utilities','Insurance','Transportation','Shopping','Health','Family','Pets','Subscriptions','Travel','Gifts','Home maintenance','Interest & fees','Other'];
  const kinds = ['Spending','Project','Income','Transfer','Financing','Savings','Reimbursement','Review'];
  const cad = new Intl.NumberFormat('en-CA', {style:'currency',currency:'CAD'});
  const dollars = cents => cad.format((cents || 0) / 100);
  const round = n => Math.round(n);
  const id = () => crypto.randomUUID ? crypto.randomUUID() : [...crypto.getRandomValues(new Uint8Array(16))].map(x => x.toString(16).padStart(2,'0')).join('');
  const today = () => {
    const date = new Date();
    return [date.getFullYear(), date.getMonth()+1, date.getDate()].map((n,i) => i ? String(n).padStart(2,'0') : n).join('-');
  };
  const day = date => Date.parse(date+'T00:00:00Z')/86400000;
  const iso = number => new Date(number*86400000).toISOString().slice(0,10);
  const add = (date, days) => iso(day(date)+days);
  const distance = (a,b) => day(b)-day(a);
  const month = date => date.slice(0,7);
  const shiftMonth = (date, months) => {
    const [y,m,d] = date.split('-').map(Number);
    const first = new Date(Date.UTC(y,m-1+months,1));
    const last = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
    first.setUTCDate(Math.min(d,last));
    return first.toISOString().slice(0,10);
  };
  const monthStart = date => month(date)+'-01';
  const monthEnd = date => add(shiftMonth(monthStart(date),1),-1);
  const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(day(value)) && iso(day(value))===value && Number(value.slice(0,4))>=1900;
  const clean = s => String(s ?? '').trim();
  const normal = s => clean(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const sum = (rows, getter) => rows.reduce((total,row) => total+getter(row),0);
  const empty = () => ({
    version:1, accounts:[], transactions:[], imports:[], rules:[], projects:[], bills:[], billStatus:{},
    loans:[], goals:[], targets:{}, excludedMonths:[], config:{window:45,floor:0,surplus:0,debtShare:70,flex:0,flexAccount:'',focus:'Highest rate'},
    updated:''
  });
  function money(value) {
    let number = clean(value).replace(/[\u00a0\u202f\s]/g,'').replace(/[−–]/g,'-').replace(/CAD|USD|CA\$/gi,'').replace(/[$']/g,'');
    if (!number || /^[-—]$/.test(number)) return null;
    let polarity = 1;
    if (/^\(.*\)$/.test(number)) { polarity = -1; number = number.slice(1,-1); }
    if (/\s*DR$/i.test(number)) { polarity = -1; number = number.replace(/DR$/i,''); }
    if (/\s*CR$/i.test(number)) number = number.replace(/CR$/i,'');
    if (number.endsWith('-')) { polarity = -1; number = number.slice(0,-1); }
    if (number.includes(',') && /,\d{1,2}$/.test(number) && !/\.\d{1,2}$/.test(number)) number=number.replace(/\./g,'').replace(',','.');
    else number=number.replace(/,/g,'');
    if (!/^[+-]?(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(number)) return null;
    const cents=round(Number(number)*100*polarity);
    return Number.isSafeInteger(cents) ? cents : null;
  }
  function dateValue(raw, order) {
    const value = clean(raw);
    const period = value.match(/^(\d{4})[\/.-](\d{1,2})[\/.-](\d{1,2})(?:[T ].*)?$/);
    const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    const numeric = value.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2}|\d{4})$/);
    let y,m,d;
    if (period || compact) [,y,m,d]=period || compact;
    else if (numeric) {
      y=numeric[3].length===2 ? String(2000+Number(numeric[3])) : numeric[3];
      [m,d]=order==='DMY' ? [numeric[2],numeric[1]] : [numeric[1],numeric[2]];
    } else if (/\b[a-z]{3,}\b/i.test(value) && /\b\d{4}\b/.test(value)) {
      const time=Date.parse(value+' UTC');
      if (Number.isFinite(time)) return new Date(time).toISOString().slice(0,10);
    }
    if (!y) return null;
    const result=y+'-'+m.padStart(2,'0')+'-'+d.padStart(2,'0');
    return validDate(result) ? result : null;
  }
  function parseDelimited(input, delimiter) {
    const text=input.replace(/^\uFEFF/,'');
    const rows=[];
    let row=[], field='', quoted=false;
    for (let index=0; index<text.length; index++) {
      const c=text[index];
      if (c==='"') {
        if (quoted && text[index+1]==='"') { field+='"'; index++; }
        else if (quoted || field==='') quoted=!quoted;
        else field+=c;
      } else if (!quoted && c===delimiter) { row.push(field); field=''; }
      else if (!quoted && (c==='\n'||c==='\r')) {
        if (c==='\r' && text[index+1]==='\n') index++;
        row.push(field);
        if (row.some(x => clean(x))) rows.push(row);
        row=[]; field='';
      } else field+=c;
    }
    if (quoted) throw new Error('An opening quote has no matching closing quote.');
    if (row.length||field) { row.push(field); if (row.some(x=>clean(x))) rows.push(row); }
    return rows;
  }
  const headers = {
    date:/^(?:(?:transaction|posting|posted|post|purchase|activity|operation|value) )?date$|^date (?:of transaction|de transaction|de l operation|d operation|posted)$/,
    description:/^(?:(?:transaction|merchant|payee|payment) )?description\b|^(?:memo|details?|merchant(?:(?: name)|(?: description))?|name|payee|transaction details|libelle|reference)$/,
    amount:/^(?:(?:transaction|signed|cad|net|posted) )?amount(?: (?:cad|cad dollars|in cad|canadian dollars))?$|^montant(?: cad)?$/,
    debit:/^(?:debit|withdrawals?|money out|outflow|charges|spent)(?: (?:amount|cad))?$/,
    credit:/^(?:credit|deposits?|money in|inflow|payments|received)(?: (?:amount|cad))?$/,
    external:/^(?:transaction (?:id|number)|reference (?:id|number)|fitid|reference no)$/
  };
  function autoMap(row) {
    const map={};
    for (const [key,pattern] of Object.entries(headers)) map[key]=row.findIndex(cell => pattern.test(normal(cell)));
    return map;
  }
  function sniff(text) {
    const options=[',','\t',';'].map(delimiter => {
      let rows; try { rows=parseDelimited(text,delimiter); } catch { return {delimiter,rows:[],candidate:-1,score:-1}; }
      const candidate=rows.slice(0,12).findIndex(row => {
        const map=autoMap(row);
        return map.date>=0 && map.description>=0 && (map.amount>=0 || map.debit>=0 || map.credit>=0);
      });
      const counts={};
      rows.slice(0,20).forEach(row => { if(row.length>1) counts[row.length]=(counts[row.length]||0)+1; });
      const score=(candidate>=0?1000:0)+Math.max(0,...Object.values(counts));
      return {delimiter, rows, candidate, score};
    }).sort((a,b)=>b.score-a.score);
    const best=options[0];
    if(best.score<0) throw new Error("This export has an unmatched quote.");
    const probe=best.rows[best.candidate>=0?best.candidate:0] || [];
    const map=autoMap(probe);
    if(best.candidate<0 && probe.length>=3) {
      Object.assign(map,{date:0,description:probe.length===4?1:probe.length-2,amount:probe.length-1,debit:-1,credit:-1});
    }
    return {...best, map, header:best.candidate>=0, skip:Math.max(0,best.candidate)};
  }
  const likelyTransfer = value => /\b(transfer|tfr|xfer|autopay payment|pmt received|payment received|visa payment|mc payment|mastercard payment|credit card payment|amex payment|online banking payment|thank you payment|payment thank you|paiement recu|paiement merci|payment to)\b/.test(normal(value));
  const transferPairHint = value => likelyTransfer(value) || /\b(payment|pmt|paiement)\b/.test(normal(value));
  const generalPatterns = [
    [/\b(payroll|pay deposit|salary|paycheque|direct deposit payroll|paye)\b/,'Income','Paycheque',1],
    [/\b(interest charge|interest charged|annual fee|bank fee|overdraft fee|service charge|cash advance fee|interet)\b/,'Spending','Interest & fees',-1],
    [/\b(superstore|sobeys|safeway|loblaws|save on foods|no frills|freshco|food fare|whole foods|metro grocery|iga)\b/,'Spending','Groceries',0],
    [/\b(tim hortons|starbucks|doordash|skip the dishes|skipthedishes|uber eats|restaurant|pizzeria|mcdonald|pizza pizza|a w|cafe|coffee shop)\b/,'Spending','Dining',0],
    [/\b(manitoba hydro|city of winnipeg utility|wpg water|shaw|rogers|bell mts|telus|enbridge)\b/,'Spending','Housing & utilities',0],
    [/\b(wawanesa|manitoba public insurance|mpi insurance|intact insurance|insurance premium)\b/,'Spending','Insurance',0],
    [/\b(esso|shell|petro canada|co op gas|winnipeg transit|parkmobile|indigo parking)\b/,'Spending','Transportation',0],
    [/\b(pharmacy|dental|physio|optometry|shoppers drug mart)\b/,'Spending','Health',0],
    [/\b(daycare|childcare|montessori)\b/,'Spending','Family',0],
    [/\b(veterinary|petsmart|pet valu|chewy)\b/,'Spending','Pets',0],
    [/\b(netflix|spotify|apple com bill|disney plus|crave|youtube premium)\b/,'Spending','Subscriptions',0],
    [/\b(air canada|westjet|airbnb|holiday inn|porter airlines)\b/,'Spending','Travel',0]
  ];
  function classify(state,row) {
    const key=normal(row.description), direction=Math.sign(row.amount);
    const rule=[...state.rules].reverse().find(r=>r.merchant===key && r.direction===direction && (!r.account||r.account===row.account));
    if (rule) return {kind:rule.kind,category:rule.category,project:rule.project,why:'Saved rule'};
    if (likelyTransfer(key) || /\b(e transfer|etransfer|interac|e trf|cash withdrawal|atm|home depot|rona|costco|walmart|amazon|amzn|canadian tire)\b/.test(key)) {
      return {kind:'Review',category:'',project:'',why: transferPairHint(key) ? 'Transfer, payment, income or reimbursement?' : 'Which category or project does this belong to?'};
    }
    const match=generalPatterns.find(([pattern,, ,sign])=>pattern.test(key) && (!sign||sign===direction));
    if (!match) return {kind:'Review',category:'',project:'',why:direction>0?'Income, transfer, refund or reimbursement?':'What was this purchase for?'};
    return {kind:match[1],category:match[2],project:'',why:direction>0&&match[1]==='Spending'?'Possible merchant refund':'Merchant match'};
  }
  function fingerprint(row) {
    return row.external ? 'id|'+row.external : [row.date,normal(row.description),row.amount].join('|');
  }
  function extract(rows,map,options,state,account) {
    const result=[], issues=[];
    const start=options.skip+(options.header?1:0);
    const at=(row, col)=>col>=0?clean(row[col]):'';
    const recognized=rows.slice(start);
    if (map.date<0||map.description<0||(map.amount<0&&map.debit<0&&map.credit<0)) throw new Error('Map a date, a description and at least one amount column.');
    recognized.forEach((row,index) => {
      const rawDate=at(row,map.date), description=at(row,map.description);
      const date=dateValue(rawDate, options.order);
      let amount=null;
      if (map.amount>=0) amount=money(at(row,map.amount));
      else {
        const debitRaw=at(row,map.debit),creditRaw=at(row,map.credit);
        const debit=money(debitRaw), credit=money(creditRaw);
        if ((!debitRaw||debit!==null) && (!creditRaw||credit!==null) && (debit!==null||credit!==null)) {
          amount=Math.abs(credit||0)-Math.abs(debit||0);
        }
      }
      if (!date || !description || amount===null) {
        issues.push({row:start+index+1, reason:!date?'Invalid date':!description?'Empty description':'Invalid amount', sample:row.slice(0,7).join(' | ').slice(0,180)});
        return;
      }
      if (options.reverse) amount=-amount;
      const transaction={id:id(),account,date,description,amount,external:at(row,map.external),pair:'',manual:false, note:''};
      Object.assign(transaction,classify(state,transaction));
      transaction.fingerprint=fingerprint(transaction);
      result.push(transaction);
    });
    return {result,issues};
  }
  function duplicateReview(existing, staging) {
    const exact = new Map(), fuzzy = new Map(), baseSeen=new Map(), idSeen=new Set();
    const fallback=t=>[t.account,t.date,normal(t.description),t.amount].join('|');
    const withId=t=>t.account+'|'+t.external;
    for (const t of existing) {
      if (t.external) exact.set(withId(t),t);
      const key=fallback(t);
      if (!fuzzy.has(key)) fuzzy.set(key,[]);
      fuzzy.get(key).push(t);
    }
    for (const item of staging) {
      const row=item.transaction;
      const fallbackKey=fallback(row);
      const ordinal=baseSeen.get(fallbackKey)||0;
      baseSeen.set(fallbackKey,ordinal+1);
      const previous=(fuzzy.get(fallbackKey)||[])[ordinal];
      if (row.external) {
        const matched=exact.get(withId(row));
        if (matched || idSeen.has(withId(row))) item.duplicate='Existing transaction ID';
        else if (previous && !previous.external) item.duplicate='Matches an existing row without an ID';
        idSeen.add(withId(row));
      } else if (previous) item.duplicate='Matching date, description and amount';
    }
  }
  function matchTransfers(rows, accounts) {
    const available=rows.filter(t=>t.amount && !t.pair && !t.allocations && (!t.manual||t.kind==='Transfer') &&
      (t.kind==='Review'||t.kind==='Transfer'));
    const byAmount=new Map();
    const accountTypes=new Map(accounts.map(a=>[a.id,a.type]));
    available.forEach(t => {
      if (!byAmount.has(t.amount)) byAmount.set(t.amount,[]);
      byAmount.get(t.amount).push(t);
    });
    const candidates=t=>(byAmount.get(-t.amount)||[]).filter(other=>{
      if (other.account===t.account || Math.abs(distance(t.date,other.date))>4) return false;
      if (t.kind==='Transfer' && other.kind==='Transfer') return true;
      const positive=t.amount>0?t:other, negative=t.amount<0?t:other;
      const card=accountTypes.get(positive.account)==='Credit card' && ['Chequing','Savings'].includes(accountTypes.get(negative.account));
      return card ? transferPairHint(positive.description)&&transferPairHint(negative.description) :
        likelyTransfer(t.description)&&likelyTransfer(other.description);
    });
    return available.filter(t=>t.amount<0).flatMap(t=>{
      const options=candidates(t);
      if (options.length!==1 || candidates(options[0]).length!==1) return [];
      const other=options[0];
      const label=accountTypes.get(other.account)==='Credit card'?'Credit card payment':'Between accounts';
      return [{left:t,right:other,label}];
    });
  }
  function coverage(state, account, start, end) {
    const spans=state.imports.filter(x=>x.account===account && x.coverageConfirmed && x.start<=end&&x.end>=start).sort((a,b)=>a.start.localeCompare(b.start));
    let next=start;
    for (const span of spans) {
      if (span.start>next) break;
      if (span.end>=next) next=add(span.end,1);
      if (next>end) return true;
    }
    return false;
  }
  function ledgerRows(rows) {
    return rows.flatMap(t=>t.allocations?.length?t.allocations.map(a=>({...t,...a})):t);
  }
  function history(state, now, targetMonth=month(now)) {
    const target=targetMonth+'-01';
    const spendingAccounts=state.accounts.filter(a=>a.history);
    const complete=[];
    for (let i=1;i<=12;i++) {
      const date=shiftMonth(monthStart(now),-i);
      if (date>=target || state.excludedMonths.includes(month(date))) continue;
      if (spendingAccounts.length && spendingAccounts.every(a=>{
        const start=a.openDate&&a.openDate>date?a.openDate:date;
        const end=a.closeDate&&a.closeDate<monthEnd(date)?a.closeDate:monthEnd(date);
        return start>end||coverage(state,a.id,start,end);
      })) {
        complete.push(month(date));
      }
    }
    const accounted=new Set(spendingAccounts.map(a=>a.id));
    const transactions=ledgerRows(state.transactions.filter(t=>accounted.has(t.account)));
    const spent=(rows,category)=>sum(rows.filter(t=>(t.kind==='Spending'||t.kind==='Reimbursement')&&(!category||t.category===category)),t=>-t.amount);
    const current=transactions.filter(t=>month(t.date)===targetMonth);
    const past=transactions.filter(t=>complete.includes(month(t.date)));
    const baselineReview=past.filter(t=>t.kind==='Review').length;
    const recent=past.filter(t=>complete.slice(0,3).includes(month(t.date)));
    const names=[...new Set([...categories,...Object.keys(state.targets),...transactions.filter(t=>t.kind==='Spending'||t.kind==='Reimbursement').map(t=>t.category)])].filter(Boolean);
    const rows=names.map(category=>{
      const targetSettings=state.targets[category];
      const baseline=complete.length ? round(spent(recent,category)/Math.min(3,complete.length)) : null;
      let suggestion=baseline===null?null:Math.max(0,baseline);
      let rationale=complete.length?'Recent complete months':'Awaiting complete statement coverage';
      if (targetSettings?.method==='Fixed') { suggestion=targetSettings.amount; rationale=targetSettings.note||'Current planned monthly amount'; }
      if (targetSettings?.method==='Annual') { suggestion=round(targetSettings.amount/12); rationale=targetSettings.note||'Annual plan divided by twelve'; }
      return {category,actual:spent(current,category),average:complete.length?round(spent(past,category)/complete.length):null,suggestion,rationale};
    });
    return {complete,baselineReview,rows,current,total:spent(current),projects:sum(current.filter(t=>t.kind==='Project'),t=>-t.amount),review:current.filter(t=>t.kind==='Review'),income:sum(current.filter(t=>t.kind==='Income'),t=>t.amount)};
  }
  function appointments(item,start,end) {
    if (!validDate(item.start) || item.start>end || (item.end&&item.end<start)) return [];
    const step={Weekly:7,Biweekly:14}[item.frequency];
    const interval={Monthly:1,Quarterly:3,Annual:12}[item.frequency];
    if (!step&&!interval) return item.start>=start&&(!item.end||item.start<=item.end)?[item.start]:[];
    let i=0;
    let date=item.start;
    if (step&&item.start<start) {
      i=Math.max(0,Math.ceil(distance(item.start,start)/step));
      date=add(item.start,step*i);
    } else if(interval&&item.start<start) {
      const gap=(Number(start.slice(0,4))-Number(item.start.slice(0,4)))*12+Number(start.slice(5,7))-Number(item.start.slice(5,7));
      i=Math.max(0,Math.floor(gap/interval));
      date=shiftMonth(item.start,interval*i);
    }
    const dates=[];
    while (date<=end && (!item.end||date<=item.end)) {
      if(date>=start) dates.push(date);
      i++;
      date=step?add(item.start,step*i):shiftMonth(item.start,interval*i);
    }
    return dates;
  }
  const billKey=(item,date)=>item.id+'/'+date;
  function events(state, start,end) {
    return state.bills.flatMap(item=>appointments(item,start,end).map(date=>{
      const key=billKey(item,date);
      const occurrence=state.billStatus[key] || {};
      return {...item,key,date,status:occurrence.status||'Open',forecastAmount:occurrence.amount??item.amount,actualAmount:occurrence.amount};
    })).sort((a,b)=>a.date.localeCompare(b.date)||a.name.localeCompare(b.name));
  }
  function paymentWindow(state,now,end) {
    const start=add(now,-30);
    const old=state.bills.filter(b=>b.frequency==='Once'&&b.direction!=='Income'&&b.start<start);
    const past=events({...state,bills:old},'1900-01-01',add(start,-1)).filter(e=>!['Paid','Skipped'].includes(e.status));
    return [...past,...events(state,start,end)];
  }
  function forecast(state, now) {
    const end=add(now,state.config.window);
    const verified=state.accounts.filter(a=>a.forecast&&['Chequing','Savings'].includes(a.type)&&Number.isSafeInteger(a.balance)&&validDate(a.balanceDate)&&a.balanceDate<=now);
    const starting=Object.fromEntries(verified.map(a=>[a.id,a.balance+sum(state.transactions.filter(t=>t.account===a.id&&t.date>a.balanceDate&&t.date<=now),t=>t.amount)]));
    const all=paymentWindow(state,now,end);
    const unsettled=all.filter(e=>!['Paid','Skipped'].includes(e.status));
    const upcoming=unsettled.filter(e=>e.date>=now);
    const overdue=unsettled.filter(e=>e.date<now&&e.direction!=='Income');
    const list=[...upcoming,...overdue.map(e=>({...e,date:now,originalDate:e.date}))];
    const flex=state.config.flex;
    if(flex>0&&state.config.flexAccount) {
      for(let d=add(now,7);d<=end;d=add(d,7)) list.push({key:'flex/'+d,date:d,name:'Flexible spending allowance',account:state.config.flexAccount,direction:'Bill',forecastAmount:round(flex*12/52)});
    }
    const opening=sum(Object.values(starting),v=>v);
    const balances={...starting}, lows={...starting};
    const shortfalls=[];
    let low=opening, lowDate=now;
    const usableEvent=e=>Object.hasOwn(balances,e.account)&&Number.isSafeInteger(e.forecastAmount)&&
      (e.direction!=='Transfer'||Object.hasOwn(balances,e.toAccount));
    const unassigned=list.filter(e=>!usableEvent(e));
    const order={Transfer:0,Bill:1,Income:2};
    const usable=list.filter(usableEvent).sort((a,b)=>a.date.localeCompare(b.date)||order[a.direction]-order[b.direction]);
    // Transfers clear first. Other same-day debits precede deposits with unknown timing.
    const points=[{date:now,total:opening,balances:{...balances}}];
    for(const e of usable) {
      const change=e.direction==='Income'?e.forecastAmount:-e.forecastAmount;
      balances[e.account]+=change;
      if(e.direction==='Transfer')balances[e.toAccount]-=change;
      const total=sum(Object.values(balances),v=>v);
      if (total<low) { low=total; lowDate=e.date; }
      lows[e.account]=Math.min(lows[e.account],balances[e.account]);
      if (change<0 && balances[e.account]<(verified.find(a=>a.id===e.account).floor||0)) shortfalls.push({...e,balanceAfter:balances[e.account]});
      points.push({date:e.date,total,balances:{...balances},event:e});
    }
    const missing=state.accounts.filter(a=>a.forecast&&!Object.hasOwn(starting,a.id));
    const stale=verified.filter(a=>a.balanceDate!==now);
    const missingLoanPayments=state.loans.filter(l=>l.balance>0&&!state.bills.some(b=>b.loan===l.id&&b.direction==='Bill'&&(!b.end||b.end>=now)&&
      (b.frequency!=='Once'||b.start>=now||!['Paid','Skipped'].includes(state.billStatus[billKey(b,b.start)]?.status))));
    const usableCalculate=verified.length>0&&!missing.length&&!unassigned.length&&!missingLoanPayments.length;
    const belowAccountBuffer=verified.some(a=>lows[a.id]<(a.floor||0));
    const headroom=usableCalculate?(belowAccountBuffer?0:Math.max(0,Math.min(low-state.config.floor,sum(verified,a=>Math.max(0,lows[a.id]-(a.floor||0)))))):null;
    return {end,starting,opening,ending:sum(Object.values(balances),v=>v),lows,low,lowDate,headroom,missing,missingLoanPayments,stale,shortfalls,unassigned,verified,points,upcoming,overdue,all};
  }
  const monthlyFactor = frequency => ({Weekly:52/12,Biweekly:26/12,Semimonthly:2,Monthly:1,Quarterly:1/3,Annual:1/12}[frequency] || 1);
  const periodicRate = (annual,method) => method==='Canadian mortgage' ? (1+annual/200)**(1/6)-1 : annual/1200;
  const rateAt = (loan,date) => loan.rateAfter!==null && loan.rateDate && date>=loan.rateDate ? loan.rateAfter : loan.rate;
  function makePlan(state, now, debtShare) {
    const loans=state.loans.filter(l=>l.balance>0);
    const missing=loans.filter(l=>l.rate===null||(!l.payment&&!l.minimumPercent)||!validDate(l.asOf));
    const goals=state.goals.filter(g=>g.target>g.saved).sort((a,b)=>a.priority-b.priority||(a.deadline||'9999').localeCompare(b.deadline||'9999')||a.name.localeCompare(b.name));
    const available=state.config.surplus;
    const items=loans.map(l=>({...l,left:l.balance,interest:0,clear:'',prepaid:0,fees:0}));
    const goalItems=goals.map(g=>({...g,left:g.target-g.saved,funded:''}));
    const extraDebt=round(available*debtShare/100), extraGoals=available-extraDebt;
    if (missing.length) return {missing,items,goalItems,extraDebt,extraGoals,interest:null,end:'',incomplete:true};
    const totalMinimum=sum(loans,l=>Math.max(round((l.payment||0)*monthlyFactor(l.frequency)),l.minimumPercent?round(l.balance*l.minimumPercent/100):0));
    let index=0;
    for(;index<600&&(items.some(l=>l.left>0)||goalItems.some(g=>g.left>0));index++) {
      const date=shiftMonth(now,index+1);
      let required=0;
      for (const l of items) {
        if (!l.left) continue;
        if (index%12===0) l.prepaid=0;
        const interest=round(l.left*periodicRate(rateAt(l,date),l.method));
        l.left+=interest; l.interest+=interest;
        const payment=Math.min(l.left,Math.max(round((l.payment||0)*monthlyFactor(l.frequency)), l.minimumPercent?round(l.left*l.minimumPercent/100):0));
        l.left-=payment; required+=payment;
        if(!l.left) l.clear=date;
      }
      let debtPool=Math.max(0,extraDebt+totalMinimum-required);
      let goalPool=Math.max(0,extraGoals-Math.max(0,required-totalMinimum-extraDebt));
      const open=items.filter(l=>l.left>0);
      open.sort((a,b)=>state.config.focus==='Lowest balance' ? a.left-b.left ||rateAt(b,date)-rateAt(a,date) : rateAt(b,date)-rateAt(a,date)||a.left-b.left);
      for (const l of open) {
        const limit=l.prepay===null?Infinity:Math.max(0,l.prepay-l.prepaid);
        const payment=Math.min(l.left,debtPool,limit);
        l.left-=payment; debtPool-=payment; l.prepaid+=payment;
        if (!l.left) l.clear=date;
      }
      goalPool+=debtPool;
      let availableForGoals=goalPool;
      for (const g of goalItems) {
        if (!g.left) continue;
        const applied=Math.min(availableForGoals,g.left);
        availableForGoals-=applied; g.left-=applied;
        if (!g.left) g.funded=date;
      }
    }
    const incomplete=items.some(l=>l.left>0);
    const end=items.length&&!incomplete?items.map(l=>l.clear).sort().at(-1):'';
    return {missing,items,goalItems,extraDebt,extraGoals,totalMinimum,interest:incomplete?null:sum(items,l=>l.interest),end,incomplete};
  }
  return {categories,kinds,dollars,round,id,today,day,iso,add,distance,month,shiftMonth,monthStart,monthEnd,validDate,clean,normal,sum,empty,money,dateValue,parseDelimited,autoMap,sniff,classify,extract,duplicateReview,matchTransfers,coverage,ledgerRows,history,appointments,billKey,events,paymentWindow,forecast,makePlan};
})();
