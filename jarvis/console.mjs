import {parseActivity, STORAGE_KEY, appLabel} from '../shared/atlas-activity-core.mjs';
import {dailySummary, localDay, validDay} from '../shared/atlas-workflow-core.mjs';

const areas = [
  {id:'life', name:'Life and home', agent:'Friday', tone:'#85d9e9', icon:'M3 11l9-8 9 8M6 10v10h12V10M10 20v-6h4v6'},
  {id:'work', name:'Work', agent:'Appian', tone:'#edb67d', icon:'M3 8h18v12H3zM8 8V5h8v3M3 12q9 6 18 0M12 13v3'},
  {id:'learning', name:'Learning and reference', agent:'Neura', tone:'#b6a4e9', icon:'M12 6Q6 2 2 5v13q5-2 10 1 5-3 10-1V5q-4-3-10 1Zm0 0v13'},
  {id:'system', name:'System', agent:'Sentinel', tone:'#86cba7', icon:'M12 2 4 5v6q0 6 8 11 8-5 8-11V5zM8 12l3 3 5-6'},
];
const $ = id => document.getElementById(id);
const make = (tag, text, className) => {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
};
const link = (label, url, className) => {
  const node = make('a', label, className);
  node.href = url;
  return node;
};
const icon = path => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
  const line = document.createElementNS(svg.namespaceURI,'path');
  svg.setAttribute('viewBox','0 0 24 24');
  svg.setAttribute('aria-hidden','true');
  line.setAttribute('d',path);
  svg.append(line);
  return svg;
};
const normal = value => value.toLowerCase().normalize('NFKD').replace(/[’']/g,'').replace(/[^a-z0-9]+/g,' ').trim();
const shortName = value => normal(value).replace(/^the /,'');
let apps = [], catalogue = 'loading', editions = 'loading', latest = null, area = '', summary, rawLedger, events = [], activityState;
let requestNumber = 0, answerQuery = '', currentView = '', bootTimer, bootVoice = false, speech = null;

const connectionKey = 'atlas:jarvis:shortcuts:v1';
let hubApps = [], extras = [], incoming = [];
function cleanShortcut(value) {
  try {
    const url = new URL(value.url), name = value.name.trim();
    if (url.protocol !== 'https:' || url.username || url.password || url.href.length>2000 ||
        !name || name.length>80 || !areas.some(group=>group.id===value.area)) return null;
    return {name, url:url.href, area:value.area, id:'shortcut-'+url.href, about:url.host, personal:true};
  } catch { return null; }
}
function readShortcuts() {
  try {
    const data=JSON.parse(localStorage.getItem(connectionKey) || '[]');
    return Array.isArray(data)?data.map(cleanShortcut).filter(Boolean):[];
  } catch { return []; }
}
function combineApps() {
  const urls=new Set(hubApps.map(app=>app.url));
  apps=[...hubApps,...extras.filter(app=>!urls.has(app.url))];
}
function saveShortcuts(next) {
  try {
    localStorage.setItem(connectionKey,JSON.stringify(next.map(({name,url,area})=>({name,url,area}))));
    extras=next; combineApps(); paint(); return true;
  } catch { $('notice').textContent='This browser could not save your shortcuts.'; return false; }
}
function addShortcuts(items) {
  const next=readShortcuts();
  for(const item of items) if(!next.some(app=>app.url===item.url) && !hubApps.some(app=>app.url===item.url)) next.push(item);
  return saveShortcuts(next);
}
function connectFromLink() {
  if(!location.hash.startsWith('#connect=')) return;
  try {
    const records=JSON.parse(decodeURIComponent(location.hash.slice(9)));
    if(!Array.isArray(records)||records.length>20) throw Error();
    incoming=records.map(cleanShortcut).filter(Boolean);
    if(!incoming.length || incoming.length!==records.length) throw Error();
    $('incoming-links').replaceChildren(...incoming.map(item=>make('li',item.name+' · '+new URL(item.url).host)));
    $('connect-dialog').showModal();
  } catch { $('notice').textContent='This shortcut link could not be read.'; }
  history.replaceState(null,'',location.pathname+location.search+'#directory');
}
function personalSettings() {
  $('saved-links').replaceChildren(...extras.map(item=>{
    const row=make('div',undefined,'saved'), remove=make('button','Remove','quiet-btn');
    remove.type='button'; remove.setAttribute('aria-label','Remove shortcut for '+item.name);
    remove.onclick=()=>{if(saveShortcuts(readShortcuts().filter(app=>app.url!==item.url))) $('notice').textContent='Shortcut removed.';};
    row.append(make('span',item.name),remove); return row;
  }));
}
async function loadCatalogue() {
  const response = await fetch('../index.html', {cache:'no-cache'});
  if (!response.ok) throw Error();
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const found = [];
  for (const group of areas) {
    for (const card of doc.querySelectorAll('section[data-area="'+group.id+'"] .hub-card[href]')) {
      const url = new URL(card.getAttribute('href'), response.url || location.href);
      const name = card.querySelector('h3')?.textContent.trim();
      if (!name || !['https:','http:'].includes(url.protocol)) continue;
      found.push({id:card.dataset.hubId || url.pathname.split('/').filter(Boolean).at(-1)?.replace(/\.html$/,''),
        name, area:group.id, url:url.href, about:card.querySelector('p')?.textContent.trim() || '',
        privateSite:!!card.querySelector('.hub-private')});
    }
  }
  if (!found.length) throw Error();
  return found;
}
async function loadEditions() {
  const response = await fetch('../courier/manifest.json', {cache:'no-cache'});
  if (!response.ok) throw Error();
  const data = await response.json();
  if (!Array.isArray(data.days)) throw Error();
  const today = localDay();
  return data.days.map(day=>day?.date).filter(day=>validDay(day) && day<=today).sort().at(-1) || null;
}
function refreshRecords() {
  // Request only the two records used by the briefing from the suite's shared projection.
  const values = new Map();
  for (const key of ['lifemap_v1','lifeledger:v2']) {
    try { values.set(key, localStorage.getItem(key)); }
    catch { values.set(key, undefined); }
  }
  rawLedger = values.get('lifeledger:v2');
  summary = dailySummary({getItem:key=>{
    if (values.has(key) && values.get(key) === undefined) throw Error();
    return values.get(key) ?? null;
  }}, null);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw !== null && !Array.isArray(JSON.parse(raw)?.events)) throw Error();
    events = parseActivity(raw).events.filter(event => Date.parse(event.at)<=Date.now() &&
      (event.kind==='meaningful' || ['open','launch'].includes(event.type))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    activityState = 'ready';
  } catch { events = []; activityState = 'failed'; }
  $('date').textContent = new Intl.DateTimeFormat('en-CA',{weekday:'long',month:'long',day:'numeric'}).format(new Date());
}
const dateLabel = day => new Date(day+'T12:00:00').toLocaleDateString('en-CA',{month:'short',day:'numeric'});
function rows() {
  const overdue = summary.due.filter(item=>item.due<summary.today).length;
  const dueToday = summary.due.filter(item=>item.due===summary.today).length;
  const next = summary.due[0];
  const map = summary.issues.includes('Life Map') ? 'Records unavailable' : !summary.mapPresent ? 'No local plan' :
    overdue ? overdue+' overdue' : dueToday ? dueToday+' due today' : next ? 'Next due '+dateLabel(next.due) : 'Nothing due in 7 days';
  const ledger = summary.issues.includes('Life Ledger') ? 'Records unavailable' : rawLedger==null ? 'No local check-ins' : summary.ledgerSaved ? 'Checked in today' : 'No check-in today';
  const courier = editions==='loading' ? 'Reading editions…' : editions==='failed' ? 'Editions unavailable' : latest ? dateLabel(latest)+' edition' : 'No published edition';
  return [['Life Map',map,'life-map'],['Life Ledger',ledger,'life-ledger'],['The Courier',courier,'courier']];
}
function appFor(id) { return apps.find(app=>app.id===id); }
function briefing() {
  const host = $('brief-rows');
  host.replaceChildren();
  for (const [name, status, id] of rows()) {
    const row = make('div',undefined,'brief-row');
    const app = appFor(id);
    const title = make('strong',name);
    if (app) {
      const url = new URL(app.url);
      if (id==='courier' && latest) url.searchParams.set('day',latest);
      title.replaceChildren(link(name,url.href));
    }
    row.append(title,make('span',status)); host.append(row);
  }
  $('core-state').textContent = catalogue==='ready' ? apps.length+' DASHBOARDS' : catalogue==='loading' ? 'READING DIRECTORY' : 'DIRECTORY UNAVAILABLE';
}
function channels() {
  $('channels').replaceChildren(...areas.map(group=>{
    const card = link('', '#directory/'+group.id, 'channel');
    card.style.setProperty('--tone',group.tone);
    const top = make('span',undefined,'channel-top'), glyph = make('span',undefined,'channel-icon');
    glyph.append(icon(group.icon)); top.append(glyph,make('span','↗','channel-arrow'));
    const count = apps.filter(app=>app.area===group.id).length;
    card.append(top,make('span',group.agent.toUpperCase(),'agent-label'),make('strong',group.name),
      make('small',catalogue==='ready' ? count+' dashboard'+(count===1?'':'s') : catalogue==='loading'?'Loading directory…':'Directory unavailable'));
    return card;
  }));
}
function retry(host, message) {
  const box=make('div',message,'empty'), button=make('button','Retry','quiet-btn');
  button.type='button'; button.onclick=loadSources; box.append(button); host.append(box);
}
function renderDirectory() {
  personalSettings();
  const query=normal($('filter').value);
  $('areas').replaceChildren(...[{id:'',name:'All'},...areas].map(group=>{
    const button=make('button',group.name.replace(' and reference','')); button.type='button';
    button.setAttribute('aria-pressed',String(area===group.id));
    button.onclick=()=>{location.hash='directory'+(group.id?'/'+group.id:'');};
    return button;
  }));
  const list=$('app-list'); list.replaceChildren();
  const found=apps.filter(app=>(!area||app.area===area)&&normal(app.name+' '+app.about).includes(query));
  $('directory-count').textContent=catalogue==='loading'?'Reading Atlas…':catalogue==='failed'?'Directory unavailable':found.length+' dashboard'+(found.length===1?'':'s');
  if(catalogue==='failed') retry(list,'The Atlas directory could not be loaded.');
  if(catalogue==='ready'&&!found.length) list.append(make('p','No dashboard matches this search.','empty'));
  for(const app of found) {
    const card=link('',app.url,'app');
    card.append(make('span',areas.find(group=>group.id===app.area).name.toUpperCase(),'app-area'),make('strong',app.name),make('p',app.about));
    if(app.personal) card.append(make('small','Browser shortcut ↗'));
    if(app.privateSite) card.append(make('small','Private site ↗'));
    list.append(card);
  }
}
function renderActivity(host, limit=30) {
  host.replaceChildren();
  if(activityState==='failed') { host.append(make('p','The activity log could not be read in this browser.','empty')); return; }
  if(!events.length) { host.append(make('p','No dashboard activity recorded in this browser yet. Open a dashboard to get started.','empty')); return; }
  for(const event of events.slice(0,limit)) {
    const row=make('div',undefined,'event'), body=make('div'), app=appFor(event.app);
    body.append(app?link(app.name,app.url):make('strong',appLabel(event.app)));
    body.append(make('p',event.summary || (event.kind==='meaningful'?'Saved change':'Opened dashboard')));
    const time=make('time',new Date(event.at).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',hour12:true}));
    time.dateTime=event.at; row.append(body,time); host.append(row);
  }
}
function answer(title) {
  $('answer-title').textContent=title; $('answer-body').replaceChildren(); $('answer').hidden=false;
  return $('answer-body');
}
function matches(query) {
  const name=shortName(query);
  if(!name) return [];
  const exact=apps.filter(app=>shortName(app.name)===name || shortName(app.id||'')===name);
  if(exact.length) return exact;
  return apps.filter(app=>name.split(' ').every(word=>normal(app.name+' '+(app.id||'')).split(' ').some(token=>token.startsWith(word))));
}
function execute(raw, {navigate=true, focus=true}={}) {
  const q=normal(raw), intent=q.replace(/^(?:please )?(?:open|launch|go to|find|show me|search for) /,'');
  answerQuery=raw;
  if(/\b(due|overdue|deadlines?|priorit(?:y|ies)|tasks?)\b/.test(q) && !/^(open|launch) /.test(q)) {
    const priorities=/priorit/.test(q), onlyOverdue=/overdue/.test(q), onlyToday=/today/.test(q);
    const data=priorities?summary.priorities:summary.due.filter(item=>onlyOverdue?item.due<summary.today:onlyToday?item.due===summary.today:true);
    const host=answer(priorities?'Today’s Life Map priorities':onlyOverdue?'Overdue in Life Map':onlyToday?'Due today in Life Map':'Overdue and due in the next seven days');
    if(summary.issues.includes('Life Map')) host.append(make('p','Life Map records could not be read.'));
    else if(!summary.mapPresent) host.append(make('p','There is no Life Map plan saved on this browser and site.'));
    else if(!data.length) host.append(make('p',priorities?'No priorities planned for today.':'No matching deadlines.'));
    else { const list=make('ul'); for(const item of data) list.append(make('li',item.title+(item.due?' · '+dateLabel(item.due)+' · '+item.reason:''))); host.append(list); }
    if(appFor('life-map')) host.append(link('Open Life Map ↗',appFor('life-map').url));
  } else if(/\b(activity|recent|recently|history)\b/.test(q) && !/^(open|launch) /.test(q)) {
    const host=answer('Recent dashboard activity'); renderActivity(host,5); host.append(link('View activity ↗','#activity'));
  } else if(/\b(brief|briefing|status|check in|checkin)\b/.test(q) && !/^(open|launch) /.test(q)) {
    const host=answer('Today’s briefing'); const list=make('ul'); for(const [name,status] of rows()) list.append(make('li',name+' · '+status)); host.append(list);
  } else if(q==='help'||q===''||/^what can you do/.test(q)) {
    answer('Commands').append(make('p','Ask for today’s briefing, due dates, priorities or recent activity. To launch a dashboard, type its name or “Open” followed by its name.'));
  } else if(catalogue!=='ready' && !matches(intent).length) {
    const host=answer('Dashboard directory');
    if(catalogue==='failed') retry(host,'The Atlas directory could not be loaded.'); else host.append(make('p','Reading the dashboard directory…'));
  } else {
    const group=areas.find(g=>[g.id,normal(g.name),g.agent.toLowerCase()].includes(intent));
    if(group && navigate) { location.hash='directory/'+group.id; return; }
    const found=matches(intent);
    if(found.length===1 && navigate && /^(?:please )?(open|launch|go to) /.test(q)) { location.assign(found[0].url); return; }
    const host=answer(found.length?'Matching dashboards':'No matching command');
    if(!found.length) host.append(make('p','Try a dashboard name, “What’s due?” or “Recent activity”.'),link('Browse the directory ↗','#directory'));
    else { const links=make('div',undefined,'results'); for(const app of found) links.append(link('Open '+app.name+' ↗',app.url)); host.append(links); }
  }
  if(focus) $('answer').focus();
}
function showView(moveFocus=false) {
  const [name,group]=location.hash.slice(1).split('/');
  const view=['directory','activity'].includes(name)?name:'console';
  area=areas.some(a=>a.id===group)?group:'';
  if(view==='directory' && currentView!==view) $('filter').value='';
  for(const id of ['console','directory','activity']) $(id).hidden=id!==view;
  for(const anchor of document.querySelectorAll('[data-view]')) {
    if(anchor.dataset.view===view) anchor.setAttribute('aria-current','page'); else anchor.removeAttribute('aria-current');
  }
  if(view==='directory') renderDirectory();
  if(view==='activity') renderActivity($('activity-list'));
  if(moveFocus && (currentView!==view || view==='directory')) {
    $('main').focus({preventScroll:true}); window.scrollTo(0,0);
  }
  currentView=view;
}
function paint() {
  briefing(); channels(); showView();
  if(answerQuery && !$('answer').hidden) execute(answerQuery,{navigate:false,focus:false});
}
async function loadSources() {
  const request=++requestNumber;
  catalogue='loading'; editions='loading'; paint();
  await Promise.allSettled([
    loadCatalogue().then(result=>{if(request===requestNumber){hubApps=result;combineApps();catalogue='ready';}}).catch(()=>{if(request===requestNumber){hubApps=[];combineApps();catalogue='failed';}}).finally(()=>{if(request===requestNumber) paint();}),
    loadEditions().then(result=>{if(request===requestNumber){latest=result;editions='ready';}}).catch(()=>{if(request===requestNumber){latest=null;editions='failed';}}).finally(()=>{if(request===requestNumber) paint();}),
  ]);
}
function say(text, finished=()=>{}) {
  if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) return;
  window.speechSynthesis.cancel();
  speech = new SpeechSynthesisUtterance(text); speech.lang='en-CA'; speech.rate=1;
  speech.onend=finished;
  speech.onerror=event=>{ if(!['canceled','interrupted'].includes(event.error)) $('notice').textContent='Voice playback is unavailable.'; finished(); };
  window.speechSynthesis.speak(speech);
}
function stopVoice() {
  if('speechSynthesis' in window) window.speechSynthesis.cancel();
  $('speak').setAttribute('aria-label','Read briefing aloud'); $('speak').title='Read briefing aloud';
}
function startBoot() {
  clearTimeout(bootTimer); stopVoice();
  const dialog=$('boot'), list=$('boot-lines');
  const steps=areas.map(group=>catalogue==='ready'?group.agent+' · '+apps.filter(a=>a.area===group.id).length+' dashboards':group.agent+' · directory '+(catalogue==='loading'?'loading':'unavailable'));
  list.replaceChildren(); dialog.showModal();
  let index=0;
  function next() {
    if(!dialog.open) return;
    const line=steps[index++]; list.append(make('li',line));
    if(bootVoice) say(line);
    if(index<steps.length) bootTimer=setTimeout(next,bootVoice?2350:420);
  }
  if(matchMedia('(prefers-reduced-motion: reduce)').matches) list.replaceChildren(...steps.map(s=>make('li',s))); else next();
}
$('startup').onclick=startBoot;
$('boot-close').onclick=()=>$('boot').close();
$('boot').addEventListener('close',()=>{clearTimeout(bootTimer);stopVoice();});
$('boot-voice').onclick=()=>{
  bootVoice=!bootVoice; $('boot-voice').textContent=bootVoice?'Voice on':'Voice off'; $('boot-voice').setAttribute('aria-pressed',String(bootVoice));
  if(bootVoice) say($('boot-lines').textContent ? Array.from($('boot-lines').children).map(n=>n.textContent).join('. '):'JARVIS startup'); else stopVoice();
};
$('speak').onclick=()=>{
  if($('speak').getAttribute('aria-label')==='Stop reading') {stopVoice();return;}
  $('notice').textContent=''; $('speak').setAttribute('aria-label','Stop reading'); $('speak').title='Stop reading';
  say(rows().map(([name,status])=>name+'. '+status).join('. '),()=>{ $('speak').setAttribute('aria-label','Read briefing aloud'); $('speak').title='Read briefing aloud'; });
};
if(!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) {
  $('speak').hidden=true; $('boot-voice').hidden=true;
}
$('command-form').onsubmit=e=>{e.preventDefault();refreshRecords();execute($('command').value);};
for(const button of document.querySelectorAll('[data-query]')) button.onclick=()=>{$('command').value=button.dataset.query;$('command-form').requestSubmit();};
$('filter').oninput=renderDirectory;
$('clear').onclick=()=>{answerQuery='';$('answer').hidden=true;$('command').focus();};
$('connect-form').onsubmit=e=>{
  e.preventDefault();
  const item=cleanShortcut({name:$('connect-name').value,url:$('connect-url').value,area:$('connect-area').value});
  if(!item){$('notice').textContent='Enter a name and a valid HTTPS dashboard address.';return;}
  if(addShortcuts([item])) { $('connect-form').reset(); $('notice').textContent='Dashboard connected.'; }
};
$('save-links').onclick=()=>{ if(addShortcuts(incoming)) { $('connect-dialog').close(); $('notice').textContent='Your dashboards are connected.'; } };
$('skip-links').onclick=()=>$('connect-dialog').close();
window.addEventListener('hashchange',()=>{connectFromLink();showView(true);});
window.addEventListener('storage',event=>{if(!event.key||event.key===connectionKey){extras=readShortcuts();combineApps();} if(!event.key||[connectionKey,STORAGE_KEY,'lifemap_v1','lifeledger:v2'].includes(event.key)){refreshRecords();paint();}});
window.addEventListener('pageshow',()=>{refreshRecords();paint();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshRecords();paint();}});
setInterval(()=>{if(!document.hidden && summary.today!==localDay()){refreshRecords();loadSources();}},30000);
extras=readShortcuts(); combineApps(); refreshRecords(); connectFromLink(); showView(); loadSources();
