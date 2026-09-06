export const LEGACY_ORIGIN = 'https://qchamby204.github.io/my-dashboards/';
export const APPS = [
  { id:'life-map', name:'Life Map', detail:'Projects and life administration', group:'Direction', icon:'◈', file:'life-map.html' },
  { id:'the-hourglass', name:'The Hourglass', detail:'Time, perspective, and intention', group:'Direction', icon:'◷', file:'the-hourglass.html' },
  { id:'life-ledger', name:'Life Ledger', detail:'Habits and daily reflection', group:'Daily life', icon:'▤', file:'life-ledger.html' },
  { id:'workout-forge', name:'The Forge', detail:'Training and session history', group:'Daily life', icon:'⌁', file:'workout-forge.html' },
  { id:'baby-brain', name:'Baby Brain', detail:'Parenting knowledge and preparation', group:'Daily life', icon:'✳', file:'baby-brain.html' },
  { id:'the-aqueduct', name:'The Aqueduct', detail:'Book, cash flow, goals, and wealth', group:'Money', icon:'≋', file:'the-aqueduct.html' },
  { id:'prospecting-command-center', name:'Prospecting Command Center', detail:'Relationships and follow-through', group:'The practice', icon:'◎', file:'prospecting-command-center.html' },
  { id:'operations-cadence', name:'Operations Cadence', detail:'Recurring practice commitments', group:'The practice', icon:'↻', file:'operations-cadence.html' },
  { id:'the-herald', name:'The Herald', detail:'Content and publishing', group:'The practice', icon:'⚑', file:'the-herald.html' },
  { id:'communication-trainer', name:'Master Communicator', detail:'Speaking, rehearsal, and practice', group:'Learning', icon:'◇', file:'communication-trainer.html' },
  { id:'courier', name:'The Courier', detail:'Your briefing and daily lessons', group:'Learning', icon:'▱', file:'courier.html' },
  { id:'neural-map', name:'Neural Map', detail:'Your tools and reference library', group:'Learning', icon:'⌘', file:'neural-map.html' },
  { id:'chambers-wealth-hq', name:'Chambers Wealth HQ', detail:'Legacy workspace; current planning lives in The Aqueduct', group:'Archive', icon:'▥', file:'chambers-wealth-hq.html' },
];
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10) === value;
}
export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function addDays(day, count) {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate()+count);
  return date.toISOString().slice(0,10);
}
export function monday(day) {
  const date = new Date(day + 'T12:00:00Z');
  return addDays(day, -(date.getUTCDay()+6)%7);
}
export function textValue(value, max, required=false) {
  if (typeof value !== 'string' || value.length > max) throw new Error(`Use text of at most ${max} characters.`);
  const clean=value.trim(); if(required && !clean) throw new Error('Add a title first.'); return clean;
}
export function dateValue(value) {
  if(value===null || value==='') return null;
  if(!validDate(value)) throw new Error('Choose a valid date.');
  return value;
}
export function appValue(value) {
  if(!APPS.some(a=>a.id===value)) throw new Error('Choose an Atlas app.'); return value;
}
export function minutesValue(value) {
  if(!Number.isInteger(value) || value<5 || value>1440) throw new Error('Use 5 to 1,440 minutes.'); return value;
}
export function parseLifeMap(raw) {
  let data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  // Read only Life Map from a whole-suite backup. Other fields never leave the browser.
  if(data?.data?.lifemap_v1 !== undefined) data = typeof data.data.lifemap_v1==='string' ? JSON.parse(data.data.lifemap_v1) : data.data.lifemap_v1;
  else if(data?.lifemap_v1 !== undefined) data = typeof data.lifemap_v1==='string' ? JSON.parse(data.lifemap_v1) : data.lifemap_v1;
  if(!Array.isArray(data?.projects)) throw new Error('Choose a Life Map export or an Atlas backup containing Life Map.');
  if(data.projects.length>1000) throw new Error('Import up to 1,000 projects at a time.');
  const seen=new Set();
  return data.projects.map((p,i)=>{
    if(!p || typeof p!=='object') throw new Error(`Project ${i+1} is not valid.`);
    const sourceId=textValue(String(p.id ?? ''),200,true);
    if(seen.has(sourceId)) throw new Error('The file contains duplicate project IDs.'); seen.add(sourceId);
    return { source_id:sourceId, title:textValue(p.task,300,true), area:textValue(p.area||'General',120),
      status:p.status==='Done'?'done':'open', due_date:validDate(p.due)?p.due:null };
  });
}
