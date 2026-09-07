import { validDate, textValue, addDays } from './model.mjs';

const fail=message=>{throw new Error(message);};
const list=(v,max,label)=>Array.isArray(v)&&v.length<=max?v:fail(`Use up to ${max.toLocaleString()} ${label}.`);
const stamp=v=>v===null?null:typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():fail('A Life Ledger timestamp is invalid.');
const day=v=>validDate(v)?v:fail('A Life Ledger date is invalid.');
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
function unique(rows,key,label){if(new Set(rows.map(r=>r[key])).size!==rows.length)fail(`The file has duplicate ${label}.`);return rows;}

export function ledgerContent(raw){
  if(!object(raw))fail('Choose a Life Ledger record.');
  const habits=unique(list(raw.habits,100,'habits').map(h=>({
    id:textValue(h?.id,240,true),title:textValue(h?.title,160,true),
    archived:typeof h?.archived==='boolean'?h.archived:fail('A habit archive choice is invalid.'),
  })),'id','habit IDs').sort((a,b)=>a.id.localeCompare(b.id));
  const ids=new Set(habits.map(h=>h.id));
  const days=unique(list(raw.days,5000,'saved days').map(d=>{
    const checked=list(d?.checked,100,'daily check-ins').map(id=>textValue(id,240,true));
    if(new Set(checked).size!==checked.length||checked.some(id=>!ids.has(id)))fail('A daily check-in refers to an unknown or repeated habit.');
    return {date:day(d.date),checked:checked.sort(),note:textValue(d.note,4000),tomorrow:textValue(d.tomorrow,4000)};
  }),'date','dates').sort((a,b)=>a.date.localeCompare(b.date));
  const out={habits,days};
  if(new TextEncoder().encode(JSON.stringify(out)).length>1500000)fail('Life Ledger holds up to 1.5 MB of check-ins and reflection. Download a backup before reducing older notes.');
  return out;
}

export function ledgerRecord(raw){
  if(!Number.isSafeInteger(raw?.revision)||raw.revision<1||raw.revision>Number.MAX_SAFE_INTEGER-100000)fail('A Life Ledger revision is invalid.');
  return {...ledgerContent(raw),revision:raw.revision,updated_at:stamp(raw.updated_at)||fail('The Life Ledger save date is missing.'),imported_at:stamp(raw.imported_at),source_exported_at:stamp(raw.source_exported_at)};
}

// Only check-ins and reflection cross from the legacy app. No targets, criteria,
// body metrics, achievements, mood ratings, or supplement routines are carried over.
const LEGACY_HABITS=['Read','YouTube Strategy','Communication Drill','Run / Work Out','Sleep','Chambers Wealth','LinkedIn Strategy','Prep For Next Day','Household Chore','Money Check-In','Screen Discipline','Board Work','Walk Hud'];
export function parseLedgerTransfer(raw){
  const b=typeof raw==='string'?JSON.parse(raw):raw;
  if(b?.app==='atlas-ledger-transfer'&&b.version===1){
    const out={app:b.app,version:1,exportedAt:stamp(b.exportedAt),...ledgerContent(b),omitted:list(b.omitted??[],100,'omitted habit names').map(x=>textValue(x,160,true))};
    return out;
  }
  if(b?.app!=='life-ledger'||![1,2].includes(b.version)||!Array.isArray(b.days))fail('Choose Export Backup from the original Life Ledger, or an Atlas Life Ledger transfer.');
  const model=object(b.model)?b.model:{},added=list(model.added??[],100,'custom habits');
  const names=new Map(LEGACY_HABITS.map(key=>[key,key]));
  for(const h of added){const key=textValue(h?.key,200,true);if(names.has(key)||key==='Supplements')fail('The legacy file has conflicting habit IDs.');names.set(key,textValue(h.label||key,160,true));}
  const dates=list(b.days,5000,'saved days'),omitted=new Set();
  for(const d of dates){
    if(!object(d?.units))fail('A legacy day is missing its check-ins.');
    for(const [key,value] of Object.entries(d.units)){
      if(typeof value!=='number'||!Number.isFinite(value)||value<0)fail('A legacy check-in amount is invalid.');
      if(!names.has(key))omitted.add(textValue(key,160,true));
    }
  }
  const habits=[...names].map(([key,label])=>({id:'legacy:'+key,title:textValue(model.renames?.[key]||label,160,true),archived:!!model.hidden?.[key]}));
  const days=dates.map(d=>({date:d.date,checked:[...names.keys()].filter(key=>d.units[key]>0).map(key=>'legacy:'+key),note:d.note??'',tomorrow:''}));
  return {app:'atlas-ledger-transfer',version:1,exportedAt:stamp(b.exportedAt??null),...ledgerContent({habits,days}),omitted:[...omitted].sort()};
}

export function ledgerImportPlan(current,pack){
  const before=current||{habits:[],days:[]},habits=new Map(before.habits.map(h=>[h.id,h])),days=new Map(before.days.map(d=>[d.date,d])),rows=[];
  for(const h of pack.habits){const keep=habits.has(h.id);rows.push({kind:'Habit',title:h.title,action:keep?'Keep':'Add'});if(!keep)habits.set(h.id,h);}
  // A saved date is a durable choice, including an intentionally empty day.
  // Later imports never merge into it or revive a cleared check-in or note.
  for(const d of pack.days){const keep=days.has(d.date);rows.push({kind:'Day',title:d.date,action:keep?'Keep':'Add'});if(!keep)days.set(d.date,d);}
  const next=ledgerContent({habits:[...habits.values()],days:[...days.values()]});
  return {next,rows,added:rows.filter(r=>r.action==='Add').length,kept:rows.filter(r=>r.action==='Keep').length};
}

export function ledgerWeek(ledger,week){return (ledger?.days||[]).filter(d=>d.date>=week&&d.date<=addDays(week,6));}
