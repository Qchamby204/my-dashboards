export const STORAGE_KEY = 'atlas:activity:v1';
export const SCHEMA_VERSION = 1;
export const MAX_EVENT_AGE_DAYS = 120;

export const APP_CATALOG = [
  {id:'atlas-hub',label:'Atlas',group:'System',system:true},
  {id:'atlas-os',label:'Atlas Workspace',group:'System',system:true},
  {id:'review',label:'The Review',group:'System',system:true},
  {id:'life-map',label:'Life Map',group:'Life'},
  {id:'life-ledger',label:'Life Ledger',group:'Life'},
  {id:'workout-forge',label:'The Forge',group:'Life'},
  {id:'the-chef',label:'The Chef',group:'Life'},
  {id:'baby-brain',label:'Baby Brain',group:'Life'},
  {id:'the-hourglass',label:'The Hourglass',group:'Life'},
  {id:'the-herald',label:'The Herald',group:'Work'},
  {id:'prospecting-command-center',label:'Prospecting Command Center',group:'Work'},
  {id:'operations-cadence',label:'Operations Cadence',group:'Work'},
  {id:'the-aqueduct',label:'The Aqueduct',group:'Money'},
  {id:'courier',label:'The Courier',group:'Learning'},
  {id:'communication-trainer',label:'Master Communicator',group:'Learning'},
  {id:'crucible',label:'The Crucible',group:'Learning'},
  {id:'neural-map',label:'Neural Map',group:'Learning'},
  {id:'chambers-wealth-hq',label:'Chambers Wealth HQ',group:'Archive'},
];

const CATALOG = new Map(APP_CATALOG.map(app => [app.id, app]));
export const appLabel = id => CATALOG.get(id)?.label || String(id || 'Unknown app');
export const isSystemApp = id => !!CATALOG.get(id)?.system;

function finiteTime(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

function cleanEvent(event) {
  if (!event || typeof event !== 'object') return null;
  const at = finiteTime(event.at);
  const app = typeof event.app === 'string' && event.app.length <= 80 ? event.app : '';
  const type = typeof event.type === 'string' && event.type.length <= 80 ? event.type : '';
  if (!at || !app || !type) return null;
  const kind = event.kind === 'meaningful' ? 'meaningful' : 'usage';
  return {
    id: typeof event.id === 'string' ? event.id.slice(0,120) : `${at}-${app}-${type}`,
    at: new Date(at).toISOString(),
    app,
    type,
    kind,
    summary: typeof event.summary === 'string' ? event.summary.slice(0,300) : '',
    seconds: Number.isFinite(event.seconds) && event.seconds > 0 ? Math.min(86400, Math.round(event.seconds)) : 0,
    sourceApp: typeof event.sourceApp === 'string' ? event.sourceApp.slice(0,80) : '',
  };
}

export function parseActivity(raw) {
  let value = raw;
  if (typeof raw === 'string') {
    try { value = JSON.parse(raw); } catch { return {version:SCHEMA_VERSION,events:[]}; }
  }
  const rows = Array.isArray(value?.events) ? value.events : [];
  return {version:SCHEMA_VERSION, events:rows.map(cleanEvent).filter(Boolean)};
}

export function trimActivity(value, now = Date.now(), maxEvents = 2500) {
  const min = now - MAX_EVENT_AGE_DAYS * 86400000;
  const events = parseActivity(value).events
    .filter(event => Date.parse(event.at) >= min)
    .sort((a,b) => Date.parse(a.at) - Date.parse(b.at))
    .slice(-maxEvents);
  return {version:SCHEMA_VERSION, events};
}

function mondayMs(timestamp) {
  const date = new Date(timestamp);
  date.setHours(0,0,0,0);
  const delta = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - delta);
  return date.getTime();
}

function appRow(id) {
  const meta = CATALOG.get(id) || {id,label:appLabel(id),group:'Other'};
  return {
    id,
    label:meta.label,
    group:meta.group,
    system:!!meta.system,
    sessions:0,
    engaged:0,
    meaningful:0,
    activeSeconds:0,
    launches:0,
    lastAt:null,
  };
}

function usageEvents(events) {
  return events.filter(event => event.type === 'open' || event.type === 'launch');
}

function sequencePattern(events) {
  const ordered = usageEvents(events).slice().sort((a,b) => Date.parse(a.at)-Date.parse(b.at));
  const pairs = new Map();
  for (let i=1;i<ordered.length;i++) {
    const before = ordered[i-1], after = ordered[i];
    if (before.app === after.app) continue;
    if (Date.parse(after.at) - Date.parse(before.at) > 45 * 60000) continue;
    if (isSystemApp(before.app) || isSystemApp(after.app)) continue;
    const key = `${before.app}\u0000${after.app}`;
    pairs.set(key, (pairs.get(key) || 0) + 1);
  }
  const winner = [...pairs.entries()].sort((a,b)=>b[1]-a[1])[0];
  if (!winner || winner[1] < 2) return null;
  const [from,to] = winner[0].split('\u0000');
  return {from,to,count:winner[1]};
}

export function weeklyBuckets(events, weeks = 12, now = Date.now()) {
  const current = mondayMs(now);
  const buckets = [];
  for (let i=weeks-1;i>=0;i--) {
    const start = current - i * 7 * 86400000;
    const end = start + 7 * 86400000;
    const rows = events.filter(event => {
      const at = Date.parse(event.at);
      return at >= start && at < end;
    });
    const apps = new Set(usageEvents(rows).filter(event=>!isSystemApp(event.app)).map(event=>event.app));
    buckets.push({
      start:new Date(start).toISOString(),
      sessions:rows.filter(event=>event.type==='open'&&!isSystemApp(event.app)).length,
      meaningful:rows.filter(event=>event.kind==='meaningful'&&!isSystemApp(event.app)).length,
      apps:apps.size,
      activeSeconds:rows.filter(event=>!isSystemApp(event.app)).reduce((sum,event)=>sum+(event.seconds||0),0),
    });
  }
  return buckets;
}

export function summarizeActivity(value, {days=7, now=Date.now()} = {}) {
  const all = parseActivity(value).events;
  const since = now - days * 86400000;
  const recent = all.filter(event => {
    const at = Date.parse(event.at);
    return at >= since && at <= now + 60000;
  });
  const map = new Map();
  for (const event of recent) {
    const row = map.get(event.app) || appRow(event.app);
    if (event.type === 'open') row.sessions += 1;
    if (event.type === 'engaged') row.engaged += 1;
    if (event.type === 'launch') row.launches += 1;
    if (event.kind === 'meaningful') row.meaningful += 1;
    if (event.type === 'session') row.activeSeconds += event.seconds || 0;
    if (!row.lastAt || event.at > row.lastAt) row.lastAt = event.at;
    map.set(event.app,row);
  }
  const apps = [...map.values()].sort((a,b)=>(b.sessions+b.launches)-(a.sessions+a.launches)||b.meaningful-a.meaningful||a.label.localeCompare(b.label));
  const valueApps = apps.filter(app => !app.system && (app.sessions || app.launches || app.meaningful));
  const systemApps = apps.filter(app => app.system && (app.sessions || app.launches || app.meaningful));
  const changes = recent.filter(event => event.kind === 'meaningful' && !isSystemApp(event.app))
    .sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
  const sessions = valueApps.reduce((sum,app)=>sum+app.sessions,0);
  const meaningful = changes.length;
  const activeSeconds = valueApps.reduce((sum,app)=>sum+app.activeSeconds,0);
  const topUsage = valueApps.slice().sort((a,b)=>(b.sessions+b.launches)-(a.sessions+a.launches))[0] || null;
  const topPayoff = valueApps.slice().sort((a,b)=>b.meaningful-a.meaningful||(b.sessions+b.launches)-(a.sessions+a.launches))[0] || null;
  const usedNoChange = valueApps.filter(app => (app.sessions+app.launches) >= 2 && app.meaningful === 0);
  const prior = all.filter(event => Date.parse(event.at) < since && !isSystemApp(event.app));
  const priorApps = new Set(usageEvents(prior).map(event=>event.app));
  const recentApps = new Set(valueApps.map(app=>app.id));
  const dormant = [...priorApps].filter(id=>!recentApps.has(id)).map(id=>({id,label:appLabel(id)}));
  const sequence = sequencePattern(recent);
  const topThreeMeaningful = valueApps.slice().sort((a,b)=>b.meaningful-a.meaningful).slice(0,3).reduce((sum,app)=>sum+app.meaningful,0);
  const concentration = meaningful ? topThreeMeaningful / meaningful : 0;
  return {
    days,
    since:new Date(since).toISOString(),
    recent,
    apps:valueApps,
    systemApps,
    changes,
    sessions,
    meaningful,
    activeSeconds,
    usedApps:valueApps.length,
    topUsage,
    topPayoff:topPayoff?.meaningful ? topPayoff : null,
    usedNoChange,
    dormant,
    sequence,
    concentration,
    weeks:weeklyBuckets(all,12,now),
  };
}

export function narrative(summary) {
  if (!summary.usedApps) return 'No dashboard activity has been recorded in this period yet.';
  const parts = [`You used ${summary.usedApps} ${summary.usedApps===1?'app':'apps'} across ${summary.sessions} tracked ${summary.sessions===1?'session':'sessions'}.`];
  if (summary.meaningful) parts.push(`${summary.meaningful} meaningful ${summary.meaningful===1?'change was':'changes were'} recorded.`);
  if (summary.topUsage) parts.push(`${summary.topUsage.label} led usage.`);
  if (summary.topPayoff && summary.topPayoff.id !== summary.topUsage?.id) parts.push(`${summary.topPayoff.label} produced the most recorded changes.`);
  return parts.join(' ');
}

export function patternNotes(summary) {
  const notes = [];
  if (summary.topUsage) notes.push({title:'Most used',text:`${summary.topUsage.label} led the period with ${summary.topUsage.sessions + summary.topUsage.launches} tracked visits.`});
  if (summary.topPayoff) notes.push({title:'Most payoff',text:`${summary.topPayoff.label} produced ${summary.topPayoff.meaningful} recorded ${summary.topPayoff.meaningful===1?'change':'changes'}.`});
  if (summary.sequence) notes.push({title:'Common flow',text:`${appLabel(summary.sequence.from)} → ${appLabel(summary.sequence.to)} appeared ${summary.sequence.count} times within 45 minutes.`});
  if (summary.usedNoChange[0]) notes.push({title:'Mostly reference use',text:`${summary.usedNoChange[0].label} was used ${summary.usedNoChange[0].sessions + summary.usedNoChange[0].launches} times without a recorded state change. That can be healthy for a reference tool.`});
  if (summary.dormant[0]) notes.push({title:'Gone quiet',text:`${summary.dormant[0].label} had prior activity but none in this period.`});
  if (summary.meaningful >= 4 && summary.concentration >= .75) notes.push({title:'Concentrated payoff',text:`${Math.round(summary.concentration*100)}% of recorded changes came from your three highest-payoff apps.`});
  return notes.slice(0,5);
}
