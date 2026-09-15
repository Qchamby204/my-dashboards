import {STORAGE_KEY,appLabel,parseActivity,summarizeActivity,narrative,patternNotes} from './atlas-activity-core.mjs';

const $=id=>document.getElementById(id);
let days=7;

function readActivity(){
  try{return parseActivity(localStorage.getItem(STORAGE_KEY));}catch{return {version:1,events:[]};}
}
function fmtTime(seconds){
  const s=Math.max(0,Math.round(Number(seconds)||0));
  if(!s)return '—';
  if(s<60)return '<1m';
  const mins=Math.round(s/60);if(mins<60)return `${mins}m`;
  const hours=Math.floor(mins/60),rest=mins%60;return rest?`${hours}h ${rest}m`:`${hours}h`;
}
function fmtMoment(iso){
  const d=new Date(iso);return new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit'}).format(d);
}
function fmtWeek(iso){
  const d=new Date(iso);return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(d);
}
function safe(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function stat(value,label){return `<div class="review-stat"><strong>${safe(value)}</strong><span>${safe(label)}</span></div>`;}

function renderUsage(summary){
  const host=$('usage');
  if(!summary.apps.length){host.innerHTML='<div class="review-empty">Usage will appear here as you move through the dashboard suite.</div>';return;}
  const max=Math.max(1,...summary.apps.map(app=>app.sessions+app.launches));
  host.innerHTML=`<div class="review-usage">${summary.apps.map(app=>{
    const visits=app.sessions+app.launches,pct=Math.max(5,Math.round(visits/max*100));
    const change=app.meaningful?` · ${app.meaningful} ${app.meaningful===1?'change':'changes'}`:'';
    const time=app.activeSeconds?` · ${fmtTime(app.activeSeconds)}`:'';
    return `<div class="review-app-row"><div class="review-app-name"><strong>${safe(app.label)}</strong><span>${safe(app.group)}</span></div><div class="review-bar" aria-label="${visits} tracked visits"><i style="--w:${pct}%"></i></div><div class="review-app-meta">${visits} ${visits===1?'visit':'visits'}${change}${time}</div></div>`;
  }).join('')}</div>`;
}

function renderChanges(summary){
  const host=$('changes'),rows=summary.changes.slice(0,14);
  if(!rows.length){host.innerHTML='<div class="review-empty">No meaningful state changes were recorded in this period. Reference-only use still appears in Usage.</div>';return;}
  host.innerHTML=`<div class="review-events">${rows.map(event=>`<div class="review-event"><time datetime="${safe(event.at)}">${safe(fmtMoment(event.at))}</time><div><strong>${safe(appLabel(event.app))}</strong><p>${safe(event.summary||'Recorded a meaningful change')}</p></div></div>`).join('')}</div>`;
}

function renderPatterns(summary){
  const host=$('patterns'),notes=patternNotes(summary);
  if(!notes.length){host.innerHTML='<div class="review-empty">Patterns need a little history. Keep using the suite normally and this section will fill itself in.</div>';return;}
  host.innerHTML=`<div class="review-patterns">${notes.map(note=>`<div class="review-pattern"><strong>${safe(note.title)}</strong><p>${safe(note.text)}</p></div>`).join('')}</div>`;
}

function renderTrend(summary){
  const count=days>=84?12:days>=28?4:Math.min(4,summary.weeks.length),weeks=summary.weeks.slice(-count);
  const max=Math.max(1,...weeks.flatMap(week=>[week.sessions,week.meaningful]));
  $('trend').style.setProperty('--weeks',String(weeks.length));
  $('trend').innerHTML=weeks.map(week=>{
    const sessions=Math.max(3,Math.round(week.sessions/max*100)),changes=week.meaningful?Math.max(3,Math.round(week.meaningful/max*100)):0;
    return `<div class="review-week"><div class="review-week-bars" title="${week.sessions} sessions · ${week.meaningful} changes"><i style="height:${sessions}%"></i>${changes?`<i class="change" style="height:${changes}%"></i>`:''}</div><small>${safe(fmtWeek(week.start))}<br>${week.apps} ${week.apps===1?'app':'apps'}</small></div>`;
  }).join('');
  $('trendTitle').textContent=days>=84?'12-week pattern':days>=28?'4-week pattern':'Recent weeks';
}

function render(){
  const summary=summarizeActivity(readActivity(),{days});
  $('narrative').textContent=narrative(summary);
  $('stats').innerHTML=[
    stat(summary.usedApps,'Apps used'),
    stat(summary.sessions,'Sessions'),
    stat(summary.meaningful,'Recorded changes'),
    stat(fmtTime(summary.activeSeconds),'Active time'),
  ].join('');
  renderUsage(summary);renderChanges(summary);renderPatterns(summary);renderTrend(summary);
  $('periodLabel').textContent=days===7?'This week':days===28?'Last four weeks':'Last twelve weeks';
  document.querySelectorAll('[data-days]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.days)===days)));
}

document.querySelector('.review-period')?.addEventListener('click',event=>{
  const button=event.target.closest('[data-days]');if(!button)return;days=Number(button.dataset.days)||7;render();
});
$('clearReview')?.addEventListener('click',()=>{
  if(!confirm('Clear Atlas Review activity history on this browser? Your dashboard records are not affected.'))return;
  try{localStorage.removeItem(STORAGE_KEY);}catch{}
  render();
});
window.addEventListener('atlas:activity',render);
window.addEventListener('storage',event=>{if(event.key===STORAGE_KEY)render();});
render();
