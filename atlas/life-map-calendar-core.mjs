/* Calendar projections read existing records; dates change only through a saved edit. */
export function createLifeMapCalendarModel(){
  const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
  const iso=d=>d.toISOString().slice(0,10);
  const plus=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return iso(x);};
  const shiftMonth=(month,n)=>{const x=new Date(month+'-01T12:00:00Z');x.setUTCMonth(x.getUTCMonth()+n);return iso(x).slice(0,7);};
  const monthEnd=month=>plus(shiftMonth(month,1)+'-01',-1);
  const distance=(a,b)=>Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);
  const taskDates=t=>[t.plan,t.planWeek,t.due,t.followUp,t.showAfter,t.park?t.park+'-01':''].filter(valid);
  function projectRange(state,group){
    const dates=(state.projects||[]).filter(t=>!t.archived&&t.parentId===group.id).flatMap(taskDates).sort();
    const start=group.startDate||dates[0]||group.endDate||'',end=group.endDate||dates.at(-1)||start;
    return start?{start,end:end<start?start:end,derived:!group.startDate&&!group.endDate}:null;
  }
  function projects(state){return (state.groups||[]).filter(g=>!g.archived).map(g=>({group:g,range:projectRange(state,g),tasks:(state.projects||[]).filter(t=>!t.archived&&t.parentId===g.id)}));}
  const inMonth=(range,month)=>!!range&&range.start<=monthEnd(month)&&range.end>=month+'-01';
  function events(state,month){
    const out=[];
    for(const t of state.projects||[]){if(t.archived)continue;const seen=new Set();for(const [key,label]of [['plan','Planned'],['due','Deadline'],['planWeek','Planned week'],['followUp','Follow up'],['showAfter','Returns']]){const date=t[key];if(valid(date)&&date.startsWith(month)&&!seen.has(date)){out.push({date,label,task:t});seen.add(date);}}
      if(!t.showAfter&&t.park&&valid(t.park+'-01')&&t.park===month)out.push({date:t.park+'-01',label:'Parked month',task:t});
    }
    return out.sort((a,b)=>a.date.localeCompare(b.date)||a.task.task.localeCompare(b.task.task));
  }
  function bar(range,month){const first=month+'-01',last=monthEnd(month),start=range.start<first?first:range.start,end=range.end>last?last:range.end,days=Number(last.slice(8));return {left:distance(first,start)/days*100,width:(distance(start,end)+1)/days*100};}
  return Object.freeze({valid,plus,shiftMonth,monthEnd,distance,projectRange,projects,inMonth,events,bar});
}
