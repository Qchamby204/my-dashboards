/* Pure Life Map workflow rules. No storage, network, seeding, or migrations. */
export function createLifeMapWorkflow(){
  const DAY=86400000,clone=x=>JSON.parse(JSON.stringify(x));
  const validDate=s=>typeof s==='string'&&/^\d{4}-\d\d-\d\d$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
  const stamp=s=>Date.parse(s+'T12:00:00Z'),iso=t=>new Date(t).toISOString().slice(0,10);
  const plus=(s,n)=>iso(stamp(s)+n*DAY);
  const week=s=>plus(s,-((new Date(stamp(s)).getUTCDay()+6)%7));
  const days=(a,b)=>Math.round((stamp(b)-stamp(a))/DAY);
  function addPeriod(date,unit,n=1){
    if(!validDate(date)||!Number.isInteger(n)||n<1)throw Error('Choose a valid repeat interval.');
    if(unit==='day'||unit==='week')return plus(date,n*(unit==='week'?7:1));
    const d=new Date(stamp(date)),day=d.getUTCDate();d.setUTCDate(1);
    if(unit==='month')d.setUTCMonth(d.getUTCMonth()+n);else if(unit==='year')d.setUTCFullYear(d.getUTCFullYear()+n);else throw Error('Choose days, weeks, months, or years.');
    const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return iso(d.getTime());
  }
  function resolveDate(text,today){
    const t=text.trim().toLowerCase();if(t==='today')return today;if(t==='tomorrow')return plus(today,1);if(validDate(t))return t;
    const weekdays=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
    const target=weekdays.indexOf(t.replace(/^next /,''));
    if(target>=0){const delta=(target-new Date(stamp(today)).getUTCDay()+7)%7;return plus(today,delta||7);}
    const months=['january','february','march','april','may','june','july','august','september','october','november','december'];
    const m=t.match(/^([a-z]+)\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
    if(m){const mon=months.findIndex(x=>x===m[1]||x.slice(0,3)===m[1]);if(mon<0)return '';
      let year=+(m[3]||today.slice(0,4));let value=`${year}-${String(mon+1).padStart(2,'0')}-${m[2].padStart(2,'0')}`;
      if(!m[3]&&validDate(value)&&value<today)value=`${year+1}${value.slice(4)}`;
      return validDate(value)?value:'';
    }return '';
  }
  function parseCapture(text,today){
    let title=String(text||'').trim(),plan='',planWeek='',due='';
    const expressions='today|tomorrow|(?:next )?(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)|\\d{4}-\\d{2}-\\d{2}|(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?) \\d{1,2}(?:,? \\d{4})?';
    const deadline=new RegExp('(?:\\s+[—–-]\\s*|\\s+)due\\s+('+expressions+')$','i');
    const dm=title.match(deadline);if(dm){due=resolveDate(dm[1],today);if(due)title=title.slice(0,dm.index).trim();}
    const wm=title.match(/\s+(this week|next week)$/i);
    if(wm){planWeek=wm[1].toLowerCase()==='this week'?week(today):plus(week(today),7);title=title.slice(0,wm.index).trim();}
    else {const pm=title.match(new RegExp('\\s+('+expressions+')$','i'));if(pm){plan=resolveDate(pm[1],today);if(plan)title=title.slice(0,pm.index).trim();}}
    if(!title)return {title:String(text||'').trim(),plan:'',planWeek:'',due:''};
    return {title,plan,planWeek,due};
  }
  function setPlan(task,when,today){
    task.plan='';task.planWeek='';task.showAfter='';task.park='';task.someday=false;
    if(when==='inbox'){task.inbox=true;return task;}
    task.inbox=false;
    if(when==='today')task.plan=today;
    else if(when==='tomorrow')task.plan=plus(today,1);
    else if(when==='wk')task.planWeek=week(today);
    else if(when==='someday')task.someday=true;
    else if(validDate(when))task.plan=when;
    else if(/^\d{4}-\d\d$/.test(when)&&validDate(when+'-01'))task.showAfter=when+'-01';
    return task;
  }
  function capture(text,options,today,id){
    const raw=String(text||'').split(/\r?\n/).map(x=>x.replace(/^\s*(?:[-*•]\s+|\d+[.)]\s+)/,'').trim()).filter(Boolean);
    if(!raw.length)throw Error('Type a task first.');if(raw.length>50)throw Error('Add up to 50 tasks at a time.');
    return raw.map(line=>{const parsed=options.parse===false?{title:line,plan:'',planWeek:'',due:''}:parseCapture(line,today);
      if(parsed.title.length>300)throw Error('Keep each task title under 301 characters.');
      let p={id:id(),task:parsed.title,area:options.area||'',sub:'',pri:'Med',status:'Not started',due:parsed.due,notes:'',park:'',plan:parsed.plan,planWeek:parsed.planWeek,inbox:!options.area&&!options.parentId&&!parsed.plan&&!parsed.planWeek&&!parsed.due,createdAt:today,updatedAt:today};
      if(options.parentId)p.parentId=options.parentId;
      if(options.when)setPlan(p,options.when,today);
      if(options.due)p.due=options.due;
      return p;
    });
  }
  function parked(p,today){
    if(p.status==='Done'||p.archived)return false;
    if(p.due&&p.due<=plus(today,14))return false;
    if(p.someday)return true;
    if(p.showAfter)return p.showAfter>today;
    return !!p.park&&validDate(p.park+'-01')&&today<plus(p.park+'-01',-21);
  }
  const open=p=>p.status!=='Done'&&!p.archived;
  const actionable=(p,today)=>open(p)&&!p.inbox&&p.status!=='Waiting'&&!parked(p,today)&&(!p.plan||p.plan<=today)&&(!p.planWeek||p.planWeek<=week(today));
  function classify(p,today){
    if(p.archived)return 'Archived';if(p.status==='Done')return 'Done';
    if(p.status==='Waiting')return 'Waiting'+(p.waitingFor?' · '+p.waitingFor:'');
    if(parked(p,today))return p.someday?'Someday':'Deferred';
    if(p.plan===today)return 'Today';if(p.plan&&p.plan<today)return 'Previous plan';if(p.plan)return 'Planned '+p.plan;
    if(p.planWeek===week(today))return 'This week';if(p.inbox)return 'Inbox';return 'Next';
  }
  function todayTasks(tasks,today){
    const all=(tasks||[]).filter(open);
    const due=all.filter(p=>p.due&&p.due<=today);
    const dueIds=new Set(due.map(p=>p.id));
    const chosen=all.filter(p=>p.plan===today&&!dueIds.has(p.id));
    const included=new Set([...due,...chosen].map(p=>p.id));
    const waiting=all.filter(p=>p.status==='Waiting'&&p.followUp&&p.followUp<=today&&!included.has(p.id));
    const rollover=all.filter(p=>p.status!=='Waiting'&&(p.plan&&p.plan<today||!p.plan&&p.planWeek&&p.planWeek<week(today))&&!dueIds.has(p.id)&&!parked(p,today));
    return {due:sortTasks(due,today),chosen:sortTasks(chosen,today),waiting,rollover};
  }
  function sortTasks(tasks,today){return tasks.slice().sort((a,b)=>{
    const over=p=>!!p.due&&p.due<today; if(over(a)!==over(b))return over(a)?-1:1;
    if((a.due||'9999')!==(b.due||'9999'))return (a.due||'9999').localeCompare(b.due||'9999');
    const rank={High:0,Med:1,Low:2};return (rank[a.pri]??1)-(rank[b.pri]??1)||(a.createdAt||'').localeCompare(b.createdAt||'')||a.task.localeCompare(b.task);
  });}
  function groupTasks(tasks,today){
    const groups=new Map();for(const p of sortTasks(tasks,today)){const area=p.area||'Inbox / unfiled';if(!groups.has(area))groups.set(area,[]);groups.get(area).push(p);}return [...groups];
  }
  function projectProgress(state,group,today){
    const tasks=(state.projects||[]).filter(p=>p.parentId===group.id&&!p.archived),done=tasks.filter(p=>p.status==='Done').length;
    return {tasks,done,total:tasks.length,percent:tasks.length?Math.round(done/tasks.length*100):0,next:sortTasks(tasks.filter(p=>actionable(p,today)),today)[0]||null};
  }
  function search(state,query,{archive=false}={}){
    const q=query.trim().toLowerCase();if(!q)return [];
    const found=[];
    for(const [kind,rows]of [['task',state.projects||[]],['project',state.groups||[]],['chore',state.chores||[]]])for(const item of rows){
      if(!archive&&(item.archived||item.status==='Done'))continue;
      const text=[item.task,item.title,item.chore,item.notes,item.area,item.sub,item.waitingFor,item.zone,item.who,...(item.tags||[]),...(item.checklist||[]).map(x=>x.text)].filter(Boolean).join(' ').toLowerCase();
      if(text.includes(q))found.push({kind,item});
    }return found;
  }
  function nextFixed(repeat,after){
    const anchor=repeat.anchor,unit=repeat.unit,n=repeat.every||1;if(!validDate(anchor))throw Error('Choose a repeat start date.');
    if(anchor>after)return anchor;
    if(unit==='day'||unit==='week'){const interval=n*(unit==='week'?7:1);return plus(anchor,(Math.floor(days(anchor,after)/interval)+1)*interval);}
    // Always calculate from the original anchor, so Jan 31 -> Feb 28 -> Mar 31.
    for(let i=1;i<=2500;i++){const candidate=addPeriod(anchor,unit,n*i);if(candidate>after)return candidate;}
    throw Error('This repeat schedule is too far in the past.');
  }
  function choreDue(c,today){return c.nextDue||c.repeat?.anchor||today;}
  function advanceChore(c,today){
    const r=c.repeat;if(!r)return '';
    return r.mode==='after'?addPeriod(today,r.unit,r.every||1):nextFixed(r,today);
  }
  function taskTemplate(state,group){
    return {title:group.title,area:group.area||'',notes:group.notes||'',tasks:(state.projects||[]).filter(p=>p.parentId===group.id&&!p.archived).map(p=>({task:p.task,notes:p.notes||'',pri:p.pri||'Med',tags:p.tags||[],links:p.links||[],checklist:(p.checklist||[]).map(x=>({text:x.text}))}))};
  }
  function fromTemplate(t,today,id){
    const group={id:id(),title:t.title,area:t.area||'',notes:t.notes||'',createdAt:today};
    const tasks=t.tasks.map(p=>({...clone(p),id:id(),area:group.area,parentId:group.id,status:'Not started',due:'',park:'',plan:'',inbox:false,createdAt:today,checklist:(p.checklist||[]).map(x=>({id:id(),text:x.text,done:false}))}));return {group,tasks};
  }
  function calendarReminder({id,title,date,time='09:00',note=''}){
    if(!validDate(date)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Choose a valid reminder date and time.');
    const escape=s=>String(s||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\r/g,'');
    const at=date.replace(/-/g,'')+'T'+time.replace(':','')+'00';
    const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Atlas OS//Life Map//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+escape(id)+'@life-map.atlas','DTSTAMP:'+new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,''),'DTSTART:'+at,'DURATION:PT15M','SUMMARY:'+escape(title),'DESCRIPTION:'+escape(note),'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:PT0M','DESCRIPTION:'+escape(title),'END:VALARM','END:VEVENT','END:VCALENDAR'];
    // RFC 5545 folding is in UTF-8 octets, never split a Unicode code point.
    return lines.map(line=>{let out='',count=0;for(const ch of line){const len=new TextEncoder().encode(ch).length;if(count+len>73){out+='\r\n ';count=1;}out+=ch;count+=len;}return out;}).join('\r\n')+'\r\n';
  }
  return Object.freeze({clone,validDate,plus,week,days,addPeriod,resolveDate,parseCapture,setPlan,capture,parked,open,actionable,classify,todayTasks,sortTasks,groupTasks,projectProgress,search,nextFixed,choreDue,advanceChore,taskTemplate,fromTemplate,calendarReminder});
}
