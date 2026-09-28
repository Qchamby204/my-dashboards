
/* The Library — self-contained Atlas OS reading dashboard.
   Static Atlas assets only; no analytics, AI requests, or third-party libraries.
   Records: atlas.library.v1. Appearance: atlas.appearance.v1 (shared Atlas preference).
   Progress is empty on first use; the seed contains catalogue metadata only. */
(() => {
'use strict';
const seed = window.ATLAS_LIBRARY_CATALOG;
const Reading=window.LibraryReading, pageReferences=window.ATLAS_LIBRARY_PAGES||{};
let TOPICS = JSON.parse(JSON.stringify(seed.topics));
const KEY = 'atlas.library.v1';
const THEME_KEY = 'atlas.appearance.v1';
const APP = 'atlas-library';
const STATUS = {unread:'Not started',reading:'Reading',done:'Completed',skipped:'Skipped'};
const NOTE_FIELDS = [
 ['takeaway','In one sentence'],['notes','Notes & useful ideas'],
 ['questions','What I question'],['application','What I will use']
];
const SYN_FIELDS = ['question','patterns','tensions','application','summary'];
const ICONS = {
 book:'<path d="M3 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-3H3z"/><path d="M21 4h-6a3 3 0 0 0-3 3v14a4 4 0 0 1 4-3h5z"/>',
 grid:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
 shelves:'<path d="M4 3v18M20 3v18M4 11h16M4 20h16M7 5v6M11 4v7M15 5l2 6M8 14v6M12 14v6M16 14v6"/>',
 note:'<path d="M13 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-8M16 3l5 5M10 14l-1 4 4-1L22 8a2 2 0 0 0-5-5z"/>',
 leaf:'<path d="M20 3c-8-1-15 3-15 10a6 6 0 0 0 12 0c0-4 3-7 3-10zM4 21l11-12"/>',
 arrow:'<path d="M4 12h16M14 6l6 6-6 6"/>',
 back:'<path d="M20 12H4M10 6l-6 6 6 6"/>',
 down:'<path d="M6 9l6 6 6-6"/>',
 check:'<path d="M5 12l4 4L19 6"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M16 16l5 5"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 close:'<path d="M6 6l12 12M18 6L6 18"/>',
 settings:'<path d="M5 3v4M5 11v10M12 3v10M12 17v4M19 3v3M19 10v11"/><circle cx="5" cy="9" r="2"/><circle cx="12" cy="15" r="2"/><circle cx="19" cy="8" r="2"/>',
 archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>',
 download:'<path d="M12 3v12M7 10l5 5 5-5M4 16v5h16v-5"/>',
 copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v.2"/>',
 focus:'<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
 upload:'<path d="M12 15V3M7 8l5-5 5 5M4 16v5h16v-5"/>',
 print:'<path d="M6 8V3h12v5M6 17H3V8h18v9h-3M6 13h12v8H6z"/>'
};
const icon = (name,cls='') => `<svg ${cls?`class="${cls}"`:''} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.book}</svg>`;
const $ = s => document.querySelector(s);
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => new Date().toISOString();
const words = s => String(s||'').trim().split(/\s+/).filter(Boolean).length;
const localDate = () => {const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const prettyDate = d => { if(!d)return ''; const x=/^\d{4}-\d{2}-\d{2}$/.test(d)?new Date(Number(d.slice(0,4)),Number(d.slice(5,7))-1,Number(d.slice(8,10)),12):new Date(d); return Number.isNaN(x.getTime())?'':x.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}); };
const clone = v => JSON.parse(JSON.stringify(v));
const topicById = id => TOPICS.find(t=>t.id===id);
const subById = (tid,sid) => topicById(tid)?.subtopics.find(s=>s.id===sid);
const scopeKey = (tid,sid='all') => `${tid}:${sid}`;
const validScope = k => { const [t,s,...rest]=String(k).split(':'); return !rest.length && !!topicById(t) && (s==='all'||!!subById(t,s)); };
const text = (v,max=Infinity) => typeof v==='string'?v.slice(0,max):'';
const defaultState = () => ({schemaVersion:1,catalog:clone(seed.books),progress:{},syntheses:{},focus:null,customSubtopics:[],topicOrder:seed.topics.map(t=>t.id),reading:Reading.empty(),createdAt:now(),updatedAt:'',lastBackupAt:''});
let storageError='',blocked=false,rawAtBoot='',conflict=false;
function withCustomTopics(extras=[]){
 if(!Array.isArray(extras)||extras.length>500)throw new Error('Invalid custom subtopic list. Nothing has been replaced.');
 const topics=clone(seed.topics),seen=new Set(topics.flatMap(t=>t.subtopics.map(sub=>sub.id)));
 for(const item of extras){
  const t=topics.find(t=>t.id===item?.topic);
  if(!t||typeof item.id!=='string'||!/^\d{1,2}X[a-zA-Z0-9_-]{1,70}$/.test(item.id)||seen.has(item.id)||typeof item.title!=='string'||!item.title.trim()||item.title.length>160)throw new Error('Invalid custom subtopic. Nothing has been replaced.');
  seen.add(item.id);t.subtopics.push({id:item.id,title:item.title.trim()});
 }
 return topics;
}
function normalizeState(raw){
 if(!raw||raw.schemaVersion!==1||!Array.isArray(raw.catalog)||raw.catalog.length<1||raw.catalog.length>5000)throw new Error('This is not a supported Library backup. Choose a JSON backup exported by this dashboard.');
 const customSubtopics=raw.customSubtopics||[],topics=withCustomTopics(customSubtopics);
 const lookupTopic=id=>topics.find(t=>t.id===id),lookupSub=(tid,sid)=>lookupTopic(tid)?.subtopics.find(s=>s.id===sid);
 const scopeValid=k=>{const [t,sub,...rest]=String(k).split(':');return !rest.length&&!!lookupTopic(t)&&(sub==='all'||!!lookupSub(t,sub));};
 const ids=new Set();
 const catalog=raw.catalog.map(b=>{
  if(!b||typeof b.id!=='string'||!/^(b-|custom-)[a-zA-Z0-9:_-]{1,110}$/.test(b.id)||ids.has(b.id)||typeof b.title!=='string'||!b.title.trim())throw new Error('The backup contains an invalid or duplicate book. Nothing has been replaced.');
  ids.add(b.id);
  const tid=String(b.topic), sid=String(b.subtopic);
  if(!((lookupTopic(tid)&&lookupSub(tid,sid))||(['reference','unassigned'].includes(tid)&&sid===tid)))throw new Error('A book in this backup has an unknown topic. Nothing has been replaced.');
  return {id:b.id,title:text(b.title,400),author:text(b.author,400),topic:tid,subtopic:sid};
 });
 const progress={};
 for(const b of catalog){
  const p=raw.progress?.[b.id]; if(!p||typeof p!=='object')continue;
  const out={status:Object.hasOwn(STATUS,p.status)?p.status:'unread',updatedAt:text(p.updatedAt,50),startedAt:text(p.startedAt,50),completedAt:text(p.completedAt,50),beforeComplete:['reading','skipped'].includes(p.beforeComplete)?p.beforeComplete:'unread'};
  for(const [field] of NOTE_FIELDS)out[field]=text(p[field]);
  progress[b.id]=out;
 }
 const syntheses={};
 const normalizeSnapshot=v=>v&&typeof v.text==='string'&&v.text.trim()?{text:text(v.text),at:text(v.at,50)}:null;
 for(const [k,s] of Object.entries(raw.syntheses||{})){
  if(!scopeValid(k)||!s||typeof s!=='object')continue;
  const out={updatedAt:text(s.updatedAt,50),published:normalizeSnapshot(s.published),history:Array.isArray(s.history)?s.history.map(normalizeSnapshot).filter(Boolean).slice(-10):[]};
  for(const field of SYN_FIELDS)out[field]=text(s[field]);
  syntheses[k]=out;
 }
 const focus=raw.focus&&scopeValid(scopeKey(String(raw.focus.topic),String(raw.focus.subtopic)))?{topic:String(raw.focus.topic),subtopic:String(raw.focus.subtopic)}:null;
 return {schemaVersion:1,catalog,progress,syntheses,focus,customSubtopics:clone(customSubtopics),topicOrder:Reading.normalizeOrder(raw.topicOrder,seed.topics.map(t=>t.id)),reading:Reading.normalize(raw.reading,catalog,scopeValid),createdAt:text(raw.createdAt,50)||now(),updatedAt:text(raw.updatedAt,50),lastBackupAt:text(raw.lastBackupAt,50)};
}
let state=defaultState();
try{rawAtBoot=localStorage.getItem(KEY)||'';if(rawAtBoot)state=normalizeState(JSON.parse(rawAtBoot));}catch(e){storageError=rawAtBoot?'Saved records could not be read. The original data has not been overwritten. Open Backup & settings to download a recovery copy or restore a backup.':'Browser storage is unavailable. Changes will remain in this open tab only. Export a backup before closing.';blocked=!!rawAtBoot;}
TOPICS=withCustomTopics(state.customSubtopics);
const ui={q:'',status:'all',topic:'all',understandingQ:'',understandingTopic:'all'};
let route={view:'home'},toastTimer=null,modalContext=null,pendingImport=null,modalReturnFocus=null;
function getBook(id){return state.catalog.find(b=>b.id===id);}
function progress(id){return state.progress[id]||{status:'unread',takeaway:'',notes:'',questions:'',application:'',updatedAt:''};}
function hasNotes(id){const p=progress(id);return NOTE_FIELDS.some(([f])=>!!p[f]?.trim());}
// Suggestions affect presentation only. Renamed, moved and custom records stay unranked.
function learningBookRank(b){
 const original=seed.books.find(x=>x.id===b.id);
 if(!original||['title','author','topic','subtopic'].some(k=>original[k]!==b[k]))return Infinity;
 const order=seed.bookOrder[b.subtopic]||seed.books.filter(x=>x.subtopic===b.subtopic).map(x=>x.id);
 const rank=order.indexOf(b.id);return rank<0?Infinity:rank;
}
function learningSubs(t){
 const ids=seed.learning[t.id].steps.map(x=>x.id);
 return [...t.subtopics].sort((a,b)=>(ids.includes(a.id)?ids.indexOf(a.id):Infinity)-(ids.includes(b.id)?ids.indexOf(b.id):Infinity));
}
function booksIn(tid,sid='all'){return state.catalog.filter(b=>b.topic===tid&&(sid==='all'||b.subtopic===sid)).sort((a,b)=>learningBookRank(a)-learningBookRank(b));}
function learningGuide(t){return `<h2 class="learning-heading">Suggested learning path</h2><details class="details-block learning-guide"><summary>${icon('info')} About this learning path</summary><p>${esc(seed.learning[t.id].overview)}</p><p>Suggested reading order, not a prerequisite or a test of mastery. Skip familiar material and use the reflection prompts to check understanding. Your section priorities remain separate. Added, moved or renamed books appear after the suggested titles without an assigned level.</p></details>`;}
function learningStep(t,sub){
 const steps=seed.learning[t.id].steps,index=steps.findIndex(x=>x.id===sub.id),step=steps[index];
 if(!step)return '<p class="learning-label">Your own subsection · choose your reading order</p>';
 const branch=/branch/i.test(step.label);
 const label=branch?step.label:`Step ${steps.slice(0,index+1).filter(x=>!/branch/i.test(x.label)).length} · ${step.label}`;
 return `<div class="learning-label">${esc(label)}</div><details class="details-block learning-reason"><summary>${icon('info')} Why this comes here & reflection</summary><p>${esc(step.why)}</p><p><strong>Reflect:</strong> ${esc(step.checkpoint)}</p></details>`;
}
function synthesis(k){return state.syntheses[k]||{question:'',patterns:'',tensions:'',application:'',summary:'',published:null,history:[],updatedAt:''};}
function ensureProgress(id){return state.progress[id]||(state.progress[id]={status:'unread',takeaway:'',notes:'',questions:'',application:'',startedAt:'',completedAt:'',beforeComplete:'unread',updatedAt:''});}
function ensureSynthesis(k){return state.syntheses[k]||(state.syntheses[k]={question:'',patterns:'',tensions:'',application:'',summary:'',published:null,history:[],updatedAt:''});}
function stats(books){return {total:books.length,done:books.filter(b=>progress(b.id).status==='done').length,reading:books.filter(b=>progress(b.id).status==='reading').length,notes:books.filter(b=>hasNotes(b.id)).length};}
function snapshots(){return Object.entries(state.syntheses).filter(([,s])=>s.published?.text?.trim()).sort((a,b)=>(b[1].published.at||'').localeCompare(a[1].published.at||''));}
const orderedTopics=()=>state.topicOrder.map(topicById);
const topicRank=id=>state.topicOrder.indexOf(id)+1;
function topicOptions(selected='all',allLabel='All topics',extras=true){return `${allLabel!==null?`<option value="all">${esc(allLabel)}</option>`:''}${orderedTopics().map(t=>`<option value="${t.id}" ${selected===t.id?'selected':''}>${String(topicRank(t.id)).padStart(2,'0')} · ${esc(t.short)}</option>`).join('')}${extras?`<option value="reference" ${selected==='reference'?'selected':''}>Reference</option><option value="unassigned" ${selected==='unassigned'?'selected':''}>To place</option>`:''}`;}
function scopeTitle(tid,sid='all'){return sid==='all'?topicById(tid)?.title:subById(tid,sid)?.title;}
function scopeRoute(tid,sid='all',tab='books'){return `#topic/${tid}/${sid}/${tab}`;}
function replaceIcons(el=document){el.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);node.removeAttribute('data-icon');});}
function saveFeedback(){
 const error=storageError||conflict;
 $('#save-indicator').textContent=error?'Not saved · export backup':'Saved on this browser';
 $('.dot').style.background=error?'var(--danger)':'var(--green)';
 document.querySelectorAll('.save-state').forEach(n=>n.textContent=error?'Not saved — export a backup':'All changes saved on this browser');
 const banner=$('#storage-banner');
 if(error){banner.hidden=false;banner.innerHTML=`${esc(storageError||'Another tab changed these records. To avoid overwriting its work, saving in this tab is paused. Export this tab’s work before refreshing.')} <button data-action="settings">Backup & settings</button>`;}else{banner.hidden=true;banner.textContent='';}
}
function persist(){
 state.updatedAt=now();
 if(blocked||conflict){saveFeedback();return false;}
 try{localStorage.setItem(KEY,JSON.stringify(state));storageError='';saveFeedback();return true;}
 catch(e){storageError='Your browser could not save these changes. They are still available in this open tab. Export a backup now; do not close or refresh until you do.';saveFeedback();return false;}
}
function toast(msg){$('#toast').textContent=msg;$('#toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3300);}
function setStatus(id,status){
 const b=getBook(id);if(!b||!Object.hasOwn(STATUS,status))return;
 const p=ensureProgress(id), old=p.status;
 if(old===status)return;
 if(status==='done'){p.beforeComplete=['reading','skipped'].includes(old)?old:'unread';p.completedAt=localDate();}
 else p.completedAt='';
 if(status==='reading'&&!p.startedAt)p.startedAt=now();
 p.status=status;p.updatedAt=now();persist();
}
function readRoute(){
 const parts=location.hash.replace(/^#/,'').split('/');
 if(parts[0]==='topic'&&topicById(parts[1]))return {view:'topic',topic:parts[1],subtopic:parts[2]==='all'||subById(parts[1],parts[2])?parts[2]:'all',tab:parts[3]==='distill'?'distill':'books'};
 return {view:['home','books','understanding'].includes(parts[0])?parts[0]:'home'};
}
function navigate(hash){if(location.hash===hash){render();window.scrollTo(0,0);}else location.hash=hash;}
function navHTML(){const view=route.view==='topic'?'home':route.view;return [['home','grid','Topics'],['books','shelves','All books'],['understanding','leaf','My understanding']].map(([v,i,label])=>`<a href="#${v}" class="${view===v?'active':''}" ${view===v?'aria-current="page"':''}>${icon(i)}<span>${label}</span></a>`).join('');}
function renderSidebar(){
 $('#desktop-nav').innerHTML=navHTML();$('#mobile-nav').innerHTML=navHTML();
 const f=state.focus;
 $('#sidebar-focus').innerHTML=f?`<div class="eyebrow">Current focus</div><p><strong>${esc(scopeTitle(f.topic,f.subtopic))}</strong></p><a class="btn quiet" style="padding-left:0;font-size:11px" href="${scopeRoute(f.topic,f.subtopic)}">Continue learning ${icon('arrow')}</a>`:`<div class="eyebrow">One topic at a time</div><p>Choose a question. Read deeply. Bring the ideas together in your own words.</p>`;
 $('#crumb-label').textContent=route.view==='topic'?topicById(route.topic).short:({home:'The Library',books:'All books',understanding:'My understanding'}[route.view]);
}
function footer(){return `<footer class="app-footer"><a class="subtle-link" href="./">← Back to Atlas</a><span>One book, one home. Your notes become your understanding.</span><button data-action="settings">Local saving · Backup & settings</button></footer>`;}
function readingSummary(books,deadline=''){return Reading.summary(books,state.progress,state.reading,pageReferences,seed.books,deadline,localDate());}
function pageInfo(b){return Reading.pageInfo(b,state.reading,pageReferences,seed.books);}
const number=n=>n.toLocaleString();
function goalOutput(books,deadline){
 const r=readingSummary(books,deadline),provisional=r.unknownRemaining>0;
 let target=!books.length?'No books in this section':!r.included?'No books in your reading plan':r.complete?'Section complete':!deadline?'Choose your finish date':r.overdue?'Choose a new finish date':r.daily===null?'Choose a valid date':provisional&&r.remaining===0?'Add page counts first':`${number(r.daily)} <span>pages / day${provisional?' · provisional':''}</span>`;
 return `${deadline?`<p class="reading-caption reading-saved-deadline">Finish by ${esc(prettyDate(deadline))}</p>`:''}<div class="reading-target" aria-live="polite">${target}</div><div class="reading-metrics"><span><b>${number(r.total)}</b> ${r.unknown?'known ':''}pages total</span><span><b>${number(r.remaining)}</b> ${provisional?'known ':''}pages left</span>${r.days!==null&&r.days>0?`<span><b>${number(r.days)}</b> days left</span>`:''}</div>${r.overdue?'<p class="reading-warning">Your deadline has passed. Your progress is kept; choose a new date to recalculate.</p>':''}${provisional?`<p class="reading-warning">${r.unknownRemaining} unfinished ${r.unknownRemaining===1?'book needs':'books need'} a page count. This target only covers known pages.</p>`:''}${r.skipped?`<p class="reading-caption">${r.skipped} skipped · excluded from the target. Notes and page progress are kept.</p>`:''}${r.estimated?`<p class="reading-caption">${r.estimated} ${r.estimated===1?'count uses':'counts use'} a reference edition. Adjust each to your copy.</p>`:''}`;
}
function readingPlanner(tid,sid){
 const key=scopeKey(tid,sid),date=state.reading.goals[key]||'',books=booksIn(tid,sid);
 return `<section class="reading-planner panel" aria-labelledby="reading-plan-title"><div class="reading-plan-heading"><div><p class="eyebrow">Your reading pace</p><h2 id="reading-plan-title">Turn this section into a daily target.</h2></div><details class="reading-info"><summary aria-label="How the reading target is calculated">i</summary><p>Remaining pages ÷ calendar days, rounded up. Today and your finish date both count. Your finish date stays fixed when books change. Skipped books are excluded; completed books contribute no remaining pages; enter your current page for books in progress. Whole-topic and subtopic goals are separate views of the same books, not extra quotas. Reference editions may differ from your copies. Unknown counts are excluded and flagged. Goals and page progress are included in JSON backups.</p></details></div><form id="reading-goal-form" data-key="${key}"><label for="reading-deadline">Finish this ${sid==='all'?'topic':'subtopic'} by</label><div class="reading-date-row"><input id="reading-deadline" name="deadline" type="date" min="${localDate()}" value="${date}" required><button class="btn primary" type="submit">Save goal</button><button class="btn quiet" type="button" data-action="clear-reading-goal" data-key="${key}" ${date?'':'hidden'}>Clear goal</button></div><p id="reading-goal-status" class="reading-caption">${date?'Goal saved. Your target adjusts as your reading plan changes.':'Choose a finish date. Valid date changes save automatically.'}</p></form><div id="reading-goal-output">${goalOutput(books,date)}</div></section>`;
}
// Store a complete date on input as well as change: native date pickers can delay
// change, and a progress save replaces the date control when the section redraws.
function captureGoalDate(field){
 const key=field?.closest('form')?.dataset.key,date=field?.value;
 if(!validScope(key)||Reading.dayNumber(date)===null||date<localDate())return false;
 if(state.reading.goals[key]===date)return false;
 state.reading.goals[key]=date;return true;
}
function saveGoalDate(field){
 const changed=captureGoalDate(field),saved=changed?persist():!(storageError||blocked||conflict);
 refreshGoalPreview();
 const clear=$('[data-action="clear-reading-goal"]');if(clear)clear.hidden=!state.reading.goals[field.closest('form')?.dataset.key];
 if(changed)$('#reading-goal-status').textContent=saved?'Goal saved automatically. Your target adjusts as your reading plan changes.':'Not saved — export a backup before closing.';
}
function readingFields(b){
 const info=pageInfo(b),done=progress(b.id).status==='done',current=done?(info.pages||0):(state.reading.pagesRead[b.id]||0),ref=info.reference;
 return `<form id="reading-progress-form" data-id="${b.id}" class="reading-book-fields"><div class="row between wrap"><h3>Reading progress</h3><span class="pill">${info.confirmed?'Your page count':info.pages?'Reference edition':'Count needed'}</span></div><div class="form-grid"><div class="field"><label for="reading-total">Total pages in my copy</label><input id="reading-total" name="pages" type="number" inputmode="numeric" min="1" max="100000" step="1" value="${info.pages||''}" placeholder="e.g. 320"></div><div class="field"><label for="reading-current">Pages read so far</label><input id="reading-current" name="current" type="number" inputmode="numeric" min="0" max="${info.pages||100000}" step="1" value="${current}" ${done?'disabled':''}></div></div><p class="reading-caption">${progress(b.id).status==='skipped'?'Skipped: excluded from reading goals. Your page progress and notes are kept.':done?'Marked completed: all pages count as read. Change reading status to log partial progress.':'Use the last numbered page you finished. Saving pages does not mark the book completed.'}</p>${ref?`<details class="reading-source"><summary>Reference edition · confirm against your copy</summary><p>${esc([ref.editionTitle,ref.publisher,ref.year,ref.isbn?'ISBN '+ref.isbn:''].filter(Boolean).join(' · '))}<br><a class="subtle-link" href="${esc(ref.source)}" target="_blank" rel="noopener noreferrer">Page-count source ↗</a>. This edition has ${info.pages} pages. Save to use this count for your copy, or enter a different count.</p></details>`:!info.pages?'<p class="reading-caption">No reliable matching count is available yet. Enter the page count from your copy.</p>':''}<button class="btn accent" type="submit">Save pages</button><span id="reading-pages-status" class="reading-caption" role="status"></span></form>`;
}
function refreshGoalPreview(){
 const form=$('#reading-goal-form'),field=$('#reading-deadline'),output=$('#reading-goal-output');
 if(!form||!field||!output)return;
 const key=form.dataset.key;if(!validScope(key))return;
 const [tid,sid]=key.split(':'),date=state.reading.goals[key]||'';
 // The saved deadline is authoritative. An empty or partially edited control
 // must never erase the displayed target, including after app resume.
 output.innerHTML=goalOutput(booksIn(tid,sid),date);
 const label=$('#reading-goal-status');
 if(label)label.textContent=storageError||blocked||conflict?'Not saved — export a backup before closing.':date?(field.value===date?'Goal saved. Your target adjusts as your reading plan changes.':'Your saved deadline is kept. Choose a complete valid date to change it.'):'Choose a finish date. Valid date changes save automatically.';
}
function progressEditor(b,place='row'){
 const info=pageInfo(b),total=info.pages,done=progress(b.id).status==='done',current=done?(total||0):Math.min(total||100000,state.reading.pagesRead[b.id]||0),key=place+'-'+b.id;
 if(!total)return `<div class="quick-progress unknown-progress"><p class="reading-caption">Add the page count to track this book.</p><button class="btn" data-action="page-progress" data-id="${b.id}">Set page count</button></div>`;
 if(done)return `<div class="quick-progress"><div class="progress-numbers"><span>Completed</span><span>${number(total)} / ${number(total)} pages</span></div><progress class="page-progress-track" max="${total}" value="${total}" aria-label="Pages read in ${esc(b.title)}"></progress></div>`;
 return `<form class="quick-progress" data-progress-form="${b.id}" data-place="${place}"><div class="progress-numbers"><label for="slider-${key}">Reading progress</label><output data-progress-label>${number(current)} / ${number(total)} · ${Math.round(current/total*100)}%</output></div><input id="slider-${key}" class="page-slider" type="range" min="0" max="${total}" step="1" value="${current}" name="slider" data-progress-slider aria-label="Pages read in ${esc(b.title)}" aria-valuetext="${current} of ${total} pages" style="--read:${current/total*100}%"><div class="progress-entry"><label for="page-${key}">Page reached</label><input id="page-${key}" name="current" type="number" inputmode="numeric" min="0" max="${total}" step="1" required value="${current}" data-progress-page><button class="btn quiet" type="button" data-action="add-pages" data-pages="10">+10</button><button id="save-${key}" class="btn accent" type="submit">Save</button></div><p class="progress-feedback" data-progress-feedback role="status">${info.confirmed?'Your copy':'Reference edition'} · drag the bar or enter a page.</p></form>`;
}
function previewProgress(form,value){
 const slider=form.querySelector('[data-progress-slider]'),field=form.querySelector('[data-progress-page]');
 const n=Number(value),max=Number(slider.max);if(!Number.isInteger(n)||n<0||n>max){form.querySelector('[data-progress-feedback]').textContent='Enter a page between 0 and '+number(max)+'.';return;}
 slider.value=n;field.value=n;slider.style.setProperty('--read',n/max*100+'%');slider.setAttribute('aria-valuetext',n+' of '+max+' pages');
 form.querySelector('[data-progress-label]').textContent=number(n)+' / '+number(max)+' · '+Math.round(n/max*100)+'%';form.querySelector('[data-progress-feedback]').textContent='Preview · tap Save to keep this progress.';
}
function focusProgress(tid,sid){
 const books=booksIn(tid,sid),r=readingSummary(books,state.reading.goals[scopeKey(tid,sid)]||''),pct=r.total?Math.round(r.read/r.total*100):0;
 return `<div class="focus-progress"><div class="progress-numbers"><span>${number(r.read)} / ${number(r.total)} ${r.unknown?'known ':''}pages</span><strong>${pct}%</strong></div><progress class="page-progress-track" max="${r.total||1}" value="${r.read}" aria-label="Pages read in your focus section"></progress>${r.unknown?`<span class="reading-caption">${r.unknown} page ${r.unknown===1?'count':'counts'} needed</span>`:''}<button class="btn accent" data-action="log-focus-progress" data-topic="${tid}" data-subtopic="${sid}" ${books.length?'':'disabled'}>Update reading progress ${icon('arrow')}</button></div>`;
}
function openFocusProgress(tid,sid,id){
 const books=booksIn(tid,sid);if(!books.length)return;
 const b=books.find(b=>b.id===id)||books.find(b=>progress(b.id).status==='reading')||books.find(b=>progress(b.id).status!=='done')||books[0];
 showModal(`${modalHeader('Daily reading',scopeTitle(tid,sid),'Update the last page you finished. Your section goal adjusts automatically.')}<div class="dialog-body"><div class="field"><label for="progress-book-select">Book</label><select id="progress-book-select" data-topic="${tid}" data-subtopic="${sid}">${books.map(x=>`<option value="${x.id}" ${x.id===b.id?'selected':''}>${esc(x.title)}</option>`).join('')}</select></div>${progressEditor(b,'focus')}<div class="dialog-bottom"><button class="btn quiet" data-action="notes" data-id="${b.id}">Open book notes</button><button class="btn primary" data-action="close-modal">Done</button></div></div>`,{type:'quick-progress',topic:tid,subtopic:sid,id:b.id});
}
function priorityRows(order){
 return order.map((id,i)=>`<div class="priority-row"><span class="priority-number">${String(i+1).padStart(2,'0')}</span><label for="priority-${id}">${esc(topicById(id).title)}</label><select id="priority-${id}" data-priority-topic="${id}" aria-label="Priority for ${esc(topicById(id).title)}">${order.map((_,rank)=>`<option value="${rank+1}" ${rank===i?'selected':''}>${rank+1}</option>`).join('')}</select></div>`).join('');
}
function openPriorities(){
 const order=[...state.topicOrder];
 showModal(`${modalHeader('Your reading priorities','Put first things first.','1 is your highest priority. Choose a rank; the other sections shift automatically.')}<div class="dialog-body"><form id="priority-form"><div id="priority-list">${priorityRows(order)}</div><p id="priority-feedback" class="reading-caption" role="status">Your current order. Changes apply when you save.</p><div class="dialog-bottom priority-footer"><button class="btn quiet" type="button" data-action="reset-priorities">Original order</button><div class="row wrap"><button class="btn quiet" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save priorities</button></div></div></form></div>`,{type:'priorities',order});
}
function topicCard(t){
 const s=stats(booksIn(t.id)),pct=s.total?100*s.done/s.total:0,f=state.focus?.topic===t.id,c=snapshots().filter(([key])=>key.split(':')[0]===t.id).length;
 const date=state.reading.goals[scopeKey(t.id)]||'',r=readingSummary(booksIn(t.id),date);
 return `<a class="topic-card panel ${f?'focused':''}" href="${scopeRoute(t.id)}">${window.LibraryArt.svg(t.id)}<div class="topic-top"><span class="topic-index">Priority ${String(topicRank(t.id)).padStart(2,'0')}</span>${f?'<span class="pill focus">In focus</span>':c?`<span class="pill distilled">${icon('leaf')} ${c}</span>`:icon('arrow')}</div><h3>${esc(t.title)}</h3><div class="topic-meta">${s.done} / ${s.total} books completed<br>${number(r.total)} ${r.unknown?'known ':''}pages · ${number(r.remaining)} left${r.unknown?` · ${r.unknown} counts missing`:''}</div>${date?`<span class="reading-card-goal">${!r.included?'No books in plan':r.complete?'Goal complete':r.overdue?'Deadline passed':r.unknownRemaining&&r.remaining===0?'Add page counts':`${number(r.daily||0)} pages/day${r.unknownRemaining?' · provisional':''}`} · ${esc(prettyDate(date))}</span>`:''}<div class="progress-track" role="progressbar" aria-label="${esc(t.short)} reading progress" aria-valuenow="${s.done}" aria-valuemin="0" aria-valuemax="${s.total}"><div class="progress-fill" style="width:${pct}%"></div></div></a>`;
}
function homeView(){
 const s=stats(state.catalog), saved=snapshots(), f=state.focus;
 let focus;
 if(f){const fs=stats(booksIn(f.topic,f.subtopic));focus=`<span class="eyebrow">Your current focus · ${f.subtopic==='all'?'Priority '+topicRank(f.topic):f.subtopic}</span><h3>${esc(scopeTitle(f.topic,f.subtopic))}</h3><p>${fs.done} of ${fs.total} books completed · ${fs.notes} with notes</p><a class="btn" href="${scopeRoute(f.topic,f.subtopic)}">Continue reading ${icon('arrow')}</a>${focusProgress(f.topic,f.subtopic)}`;}
 else focus=`<span class="eyebrow">A place to begin</span><h3>Choose one topic.<br>Make it your own.</h3><p>Start with a question, not a reading quota.</p><button class="btn" data-action="browse-topics">Explore your topics ${icon('arrow')}</button>`;
 const reading=state.catalog.filter(b=>progress(b.id).status==='reading').sort((a,b)=>(progress(b.id).updatedAt||'').localeCompare(progress(a.id).updatedAt||''));
 return `<section class="intro"><div><div class="eyebrow">Your personal learning library</div><h1>Read deeply.<br>Think clearly.</h1><p>A home for the books you read, the ideas you keep, and the understanding you build.</p><button class="btn accent" style="margin-top:20px" data-action="new-book">${icon('plus')}Add book</button></div><div class="focus-card">${focus}${icon('book','folio')}</div></section><section class="stats" aria-label="Library progress"><div class="stat"><div class="stat-number">${s.done}<span>/ ${s.total}</span></div><div class="stat-label">Books completed</div></div><div class="stat"><div class="stat-number">${s.notes}</div><div class="stat-label">Books with notes</div></div><div class="stat"><div class="stat-number">${saved.length}</div><div class="stat-label">Understandings saved</div></div></section>
 ${reading.length?`<section style="margin-bottom:23px"><div class="section-head"><h2>Continue reading</h2><span class="small muted">${reading.length} in progress</span></div><div class="continue-strip">${reading.map(b=>`<article class="continue-book"><span class="eyebrow">${esc(topicById(b.topic)?.short||'Reference')}</span><button class="book-title" data-action="notes" data-id="${b.id}">${esc(b.title)}</button>${progressEditor(b,'desk')}<div class="reading-card-actions"><button class="btn quiet" data-action="notes" data-id="${b.id}">Open notes</button><button class="btn quiet" data-action="stop-reading" data-id="${b.id}">Stop reading</button></div></article>`).join('')}</div></section>`:''}
 <section id="topic-grid-section"><div class="section-head"><div><h2>Explore your topics</h2><p>14 topics. Open a section to set your reading pace. Page totals use editable reference editions.</p></div><div class="row wrap"><button class="btn" data-action="edit-priorities">Set priorities</button><a class="btn quiet" href="#books">All books ${icon('arrow')}</a></div></div><div class="topic-grid">${orderedTopics().map(topicCard).join('')}</div></section>
 <div class="callout section-gap">${icon('info')}<div><strong>Read → reflect → distill.</strong><p>Check off a book as you finish. Keep your notes with it. Then open “Distill understanding” to see those notes together and write a short synthesis. You do not need to finish every book first.</p></div></div>${footer()}`;
}
function bookRow(b,{showTopic=false,learning=false}={}){
 const p=progress(b.id),has=hasNotes(b.id),status=p.status||'unread',pages=pageInfo(b).pages,read=status==='done'?pages:(state.reading.pagesRead[b.id]||0);
 return `<div class="book-row" data-book-row="${b.id}"><label class="book-check"><input type="checkbox" data-complete="${b.id}" ${status==='done'?'checked':''} aria-label="Mark ${esc(b.title)} as completed">${icon('check')}</label><div class="grow">${learning?`<div class="learning-book-order">${Number.isFinite(learningBookRank(b))?`Suggested read ${learningBookRank(b)+1}`:'Unsequenced title'}</div>`:''}${showTopic?`<div class="book-topline"><span class="eyebrow" style="font-size:9px">${esc(b.subtopic==='reference'?'Reference':b.subtopic==='unassigned'?'To place':b.subtopic+' · '+topicById(b.topic)?.short)}</span></div>`:''}<button class="book-title" data-action="notes" data-id="${b.id}">${esc(b.title)}</button>${b.author?`<div class="book-author">${esc(b.author)}</div>`:''}<button class="book-page-count" data-action="page-progress" data-id="${b.id}" aria-label="Edit pages for ${esc(b.title)}">${pages?`${number(pages)} pages${read?` · ${number(Math.min(read,pages))} read`:''}${pageInfo(b).confirmed?'':' · reference'}`:'Add page count'} ↗</button>${status!=='skipped'&&(status==='reading'||read>0)?progressEditor(b,'row'):''}${p.takeaway?.trim()?`<div class="book-excerpt">${esc(p.takeaway)}</div>`:''}</div><div class="book-controls"><span class="book-state"><span class="pill ${status}">${status==='done'?icon('check'):status==='reading'?icon('clock'):''}${STATUS[status]}</span></span>${status==='unread'?`<button class="btn quiet reading-status-button" data-action="start-reading" data-id="${b.id}">${read>0?'Resume reading':'Start reading'}</button>`:status==='reading'?`<button class="btn quiet reading-status-button" data-action="stop-reading" data-id="${b.id}">Stop reading</button>`:''}${status!=='done'?`<button class="btn quiet" data-action="${status==='skipped'?'include-book':'skip-book'}" data-id="${b.id}">${status==='skipped'?'Include in goal':'Skip book'}</button>`:''}<button class="btn ${has?'accent':''}" data-action="notes" data-id="${b.id}">${icon('note')}${has?'View notes':'Add notes'}</button></div></div>`;
}
function emptyHTML(title,body,action=''){return `<div class="empty"><div class="empty-icon">${icon('book')}</div><h3>${esc(title)}</h3><p>${esc(body)}</p>${action}</div>`;}
function topicView(){
 const t=topicById(route.topic),sid=route.subtopic,books=booksIn(t.id,sid),s=stats(books),k=scopeKey(t.id,sid),syn=synthesis(k),isFocus=state.focus?.topic===t.id&&state.focus?.subtopic===sid;
 const subOptions=`<option value="all" ${sid==='all'?'selected':''}>Whole topic · ${esc(t.short)}</option>`+learningSubs(t).map(sub=>`<option value="${sub.id}" ${sid===sub.id?'selected':''}>${sub.id} · ${esc(sub.title)}</option>`).join('');
 const tabs=`<div class="segmented" aria-label="Topic workspace"><a class="${route.tab==='books'?'active':''}" href="${scopeRoute(t.id,sid,'books')}" ${route.tab==='books'?'aria-current="page"':''}>${icon('book')}Books & notes</a><a class="${route.tab==='distill'?'active':''}" href="${scopeRoute(t.id,sid,'distill')}" ${route.tab==='distill'?'aria-current="page"':''}>${icon('leaf')}Distill understanding</a></div>`;
 let content;
 if(route.tab==='books'){
  const grouped=learningSubs(t).filter(x=>sid==='all'||x.id===sid);
  content=learningGuide(t)+`<div class="scope-stats"><span>${icon('check')}${s.done} / ${s.total} completed</span><span>${icon('note')}${s.notes} with notes</span>${syn.published?`<span>${icon('leaf')}Understanding saved</span>`:''}</div>`+grouped.map(sub=>{const list=books.filter(b=>b.subtopic===sub.id),bs=stats(list);return `<section class="book-group" data-learning-sub="${sub.id}">${learningStep(t,sub)}<div class="book-group-head"><h3><span class="muted">${sub.id}</span> &nbsp; ${esc(sub.title)}</h3><small>${bs.done} / ${bs.total}</small></div>${list.length?`<div class="book-list">${list.map(b=>bookRow(b,{learning:true})).join('')}</div>`:emptyHTML('No books here yet','Add a book and place it in this subtopic.')} ${sid==='all'?`<a class="back-link" style="font-size:11px;margin:5px 0 0" href="${scopeRoute(t.id,sub.id)}">Study this subtopic ${icon('arrow')}</a>`:''}</section>`;}).join('')+`<div class="callout">${icon('leaf')}<div class="grow"><strong>What do these books add up to?</strong><p>Bring together the ideas you keep, the points you question, and the conclusions you can explain.</p><a class="btn accent" style="margin-top:12px" href="${scopeRoute(t.id,sid,'distill')}">Distill my understanding ${icon('arrow')}</a></div></div>`;
 }else content=synthesisView(t.id,sid);
 return `<a class="back-link" href="#home">${icon('back')}All topics</a><header class="page-head reading-topic-head">${window.LibraryArt.svg(t.id)}<div class="eyebrow">Priority ${String(topicRank(t.id)).padStart(2,'0')}</div><h1>${esc(t.title)}</h1><p>${esc(t.question)}</p><details class="details-block" style="margin:12px 0 0;border:0"><summary style="padding:0;min-height:36px;font-size:11px">What belongs in this topic?</summary><p>${esc(t.boundary)}</p></details></header><div class="topic-toolbar"><div class="select-wrap"><label for="scope-select">Learning scope</label><select id="scope-select" data-scope-select>${subOptions}</select></div><div class="topic-actions"><button class="btn ${isFocus?'accent':'primary'}" data-action="set-focus" data-topic="${t.id}" data-subtopic="${sid}">${icon('focus')}${isFocus?'Your current focus':'Make this my focus'}</button><button class="btn" data-action="new-book" data-topic="${t.id}" data-subtopic="${sid}">${icon('plus')}Add book</button></div></div>${route.tab==='books'?readingPlanner(t.id,sid):''}${tabs}${content}${footer()}`;
}
function filteredBooks(){const q=ui.q.toLocaleLowerCase().trim();return state.catalog.filter(b=>{const p=progress(b.id);return (ui.topic==='all'||b.topic===ui.topic)&&(ui.status==='all'||(ui.status==='notes'?hasNotes(b.id):p.status===ui.status))&&(!q||[b.title,b.author,topicById(b.topic)?.title,subById(b.topic,b.subtopic)?.title,...NOTE_FIELDS.map(([f])=>p[f])].filter(Boolean).join(' ').toLocaleLowerCase().includes(q));});}
function bookResults(){const list=filteredBooks();return `<div class="results-label" aria-live="polite">${list.length} ${list.length===1?'book':'books'}${ui.topic==='unassigned'?' · Subject unconfirmed. Use “Edit title or placement” in a book’s notes to move it.':''}</div>${list.length?`<div class="book-list">${list.map(b=>bookRow(b,{showTopic:true})).join('')}</div>`:emptyHTML('No books match','Try a different title, author, note, or filter.','<button class="btn" data-action="reset-filters">Clear filters</button>')}`;}
function booksView(){return `<header class="page-head row between wrap"><div><div class="eyebrow">Your complete collection</div><h1>All books</h1><p>Find a title, follow an idea, or pick up where you left off.</p></div><button class="btn primary" data-action="new-book">${icon('plus')}Add book</button></header><div class="filter-bar"><label class="search-box">${icon('search')}<input id="library-search" type="search" class="input" placeholder="Search books, authors, or your notes" value="${esc(ui.q)}" aria-label="Search books, authors, or notes"></label><select id="library-topic-filter" aria-label="Filter by topic">${topicOptions(ui.topic)}</select><select id="library-status-filter" aria-label="Filter by reading status">${[['all','Any status'],['unread','Not started'],['reading','Reading'],['done','Completed'],['skipped','Skipped'],['notes','With notes']].map(([v,l])=>`<option value="${v}" ${ui.status===v?'selected':''}>${l}</option>`).join('')}</select></div><div id="book-results">${bookResults()}</div>${footer()}`;}
function sourceMaterial(tid,sid){
 const list=booksIn(tid,sid).filter(b=>hasNotes(b.id));
 const children=sid==='all'?snapshots().filter(([k])=>k.startsWith(tid+':')&&!k.endsWith(':all')):[];
 let html='';
 if(children.length)html+=`<div class="eyebrow" style="margin:20px 0 9px">Your subtopic understandings</div>`+children.map(([k,s])=>`<details class="source-book"><summary>${esc(scopeTitle(...k.split(':')))}</summary><div class="source-note">${esc(s.published.text)}</div><a class="back-link" href="${scopeRoute(...k.split(':'),'distill')}">Open synthesis ${icon('arrow')}</a></details>`).join('');
 if(list.length){html+=`<div class="source-cards-list">${list.map(b=>{const p=progress(b.id);return `<details class="source-book" ${list.length===1?'open':''}><summary>${esc(b.title)}</summary><span class="pill ${p.status}">${STATUS[p.status]}</span>${NOTE_FIELDS.filter(([f])=>p[f]?.trim()).map(([f,label])=>`<div class="source-note"><b>${esc(label)}</b>${esc(p[f])}</div>`).join('')}<button class="btn quiet" data-action="notes" data-id="${b.id}">${icon('note')}Edit notes</button></details>`;}).join('')}</div>`;}
 else html+=`<div class="callout" style="margin-top:17px;padding:15px"><div><strong>No book notes yet.</strong><p>Add a takeaway or notes to a book and they will appear here. You can also begin your synthesis from your existing understanding.</p><a class="back-link" href="${scopeRoute(tid,sid)}">${icon('back')}Open books</a></div></div>`;
 return html;
}
function synthesisView(tid,sid){
 const k=scopeKey(tid,sid),s=synthesis(k),n=words(s.summary),saved=!!s.published&&s.published.text===s.summary;
 const field=(name,label,placeholder,rows=3)=>`<div class="field"><label for="syn-${name}">${label}</label><textarea id="syn-${name}" data-syn="${k}" data-field="${name}" rows="${rows}" placeholder="${esc(placeholder)}">${esc(s[name])}</textarea></div>`;
 return `<div class="synthesis-layout"><section class="panel synthesis-editor"><div class="row between wrap" style="margin-bottom:12px"><span class="eyebrow">${sid==='all'?'Whole-topic synthesis':sid+' · Subtopic synthesis'}</span><span id="synthesis-badge" class="pill ${saved?'distilled':''}">${saved?'Saved understanding':'Working draft'}</span></div><h3>${esc(scopeTitle(tid,sid))}</h3><p class="lead">Use the notes gathered here to explain what you now understand. Every field saves automatically; save your final synthesis to “My understanding.”</p><div class="field"><label for="syn-question">The question I’m exploring</label><textarea id="syn-question" data-syn="${k}" data-field="question" rows="2" style="min-height:83px" placeholder="${esc(topicById(tid).question)}">${esc(s.question)}</textarea></div><details class="details-block" ${s.patterns||s.tensions||s.application?'open':''}><summary>Work through the ideas <span class="muted">· optional</span></summary>${field('patterns','What keeps showing up?','Recurring ideas, principles, or themes across the books.')}${field('tensions','Where do the ideas clash—or stop working?','Disagreements, weak evidence, missing perspectives, and limits.')}${field('application','What changes for me?','How this affects a decision, a habit, an explanation, or my perspective.')}</details><div class="field"><div class="field-head"><label class="field-label" for="syn-summary">My understanding, in my own words</label><span class="word-count ${n>150?'over':''}" id="summary-word-count">${n} words · aim for 150</span></div><textarea id="syn-summary" class="final" rows="7" data-syn="${k}" data-field="summary" placeholder="My current understanding is…&#10;&#10;The central idea is… It matters because… The important limitation is…">${esc(s.summary)}</textarea><span class="hint">A short explanation, not a list of book summaries. Keep uncertainty where it belongs. The word target is a guide, not a limit.</span></div><div class="row wrap synthesis-actions"><button class="btn primary" data-action="publish-synthesis" data-key="${k}">${icon('leaf')}Save to My understanding</button><button class="btn" data-action="copy-prompt" data-key="${k}">${icon('copy')}Copy synthesis prompt</button></div><p class="save-state" style="margin-top:13px">All changes saved on this browser</p><details class="details-block" style="margin-top:17px;margin-bottom:0"><summary>How does the synthesis prompt work?</summary><p>It copies your question, notes, and working ideas into a prompt you can paste into ChatGPT. No AI service is connected to this dashboard. No notes are sent automatically. Bring the resulting draft back here and edit it in your own words.</p></details><div id="synthesis-history">${historyHTML(k)}</div></section><aside class="panel synthesis-source"><div class="row between"><h3>Your source notes</h3>${icon('note')}</div><p class="small muted" style="margin-top:9px">${sid==='all'?'Notes from this topic, plus any saved subtopic understandings.':'Only notes from this subtopic. Other topics stay out of the way.'}</p>${sourceMaterial(tid,sid)}<div class="rule"></div><button class="btn" data-action="export-topic" data-key="${k}">${icon('download')}Export this topic</button></aside></div>`;
}
function historyHTML(k){const s=synthesis(k);if(!s.published)return '';return `<details class="details-block" style="margin-top:16px"><summary>Saved versions (${1+(s.history?.length||0)})</summary><div class="history-item"><div class="eyebrow">Latest saved · ${esc(prettyDate(s.published.at))}</div><p>${esc(s.published.text)}</p>${s.summary!==s.published.text?`<button class="btn" data-action="restore-version" data-key="${k}" data-version="latest">Use this as my draft</button>`:''}</div>${[...(s.history||[])].reverse().map((h,i)=>`<div class="history-item"><div class="eyebrow">${esc(prettyDate(h.at))}</div><p>${esc(h.text)}</p><button class="btn" data-action="restore-version" data-key="${k}" data-version="${s.history.length-1-i}">Use this as my draft</button></div>`).join('')}</details>`;}
function understandingResults(){
 const q=ui.understandingQ.toLowerCase().trim();
 const list=snapshots().filter(([k,s])=>{const [tid,sid]=k.split(':');return (ui.understandingTopic==='all'||tid===ui.understandingTopic)&&(!q||[topicById(tid).title,scopeTitle(tid,sid),s.published.text].join(' ').toLowerCase().includes(q));});
 if(!list.length)return emptyHTML(snapshots().length?'No understandings match':'Your understanding belongs here',snapshots().length?'Try another search or topic.':'Choose a topic, gather your book notes, then save a short synthesis. This becomes a collection of ideas you can explain—not just books you have finished.','<a class="btn primary" href="#home">Explore topics '+icon('arrow')+'</a>');
 return `<div class="results-label" aria-live="polite">${list.length} saved ${list.length===1?'understanding':'understandings'} · Your latest saved versions</div><div class="understanding-grid">${list.map(([k,s])=>{const [tid,sid]=k.split(':');const st=stats(booksIn(tid,sid));const draft=s.summary!==s.published.text;return `<article class="panel understanding-card"><div class="row between wrap"><span class="eyebrow">${sid==='all'?'Topic '+tid:sid} · ${esc(topicById(tid).short)}</span><span class="pill distilled">${icon('leaf')}Distilled</span></div><h3>${esc(scopeTitle(tid,sid))}</h3><div class="understanding-text">${esc(s.published.text)}</div><footer><span>${esc(prettyDate(s.published.at))}<br>${st.notes} ${st.notes===1?'book':'books'} with notes${draft?' · Newer draft':''}</span><a class="btn quiet" href="${scopeRoute(tid,sid,'distill')}">Revisit ${icon('arrow')}</a></footer></article>`;}).join('')}</div>`;
}
function understandingView(){return `<header class="page-head"><div class="eyebrow">The ideas you’ve made your own</div><h1>My understanding</h1><p>Your library, distilled into explanations you can return to, question, and refine.</p></header><div class="filter-bar"><label class="search-box">${icon('search')}<input id="understanding-search" type="search" class="input" aria-label="Search your understandings" placeholder="Search an idea or topic" value="${esc(ui.understandingQ)}"></label><select id="understanding-topic-filter" aria-label="Filter understandings by topic">${topicOptions(ui.understandingTopic,'All topics',false)}</select><button class="btn" data-action="export-understandings">${icon('download')}Export</button><button class="icon-btn" data-action="print" aria-label="Print your understandings">${icon('print')}</button></div><div id="understanding-results">${understandingResults()}</div>${footer()}`;}
function render(){
 route=readRoute();renderSidebar();
 $('#main-content').innerHTML=route.view==='home'?homeView():route.view==='topic'?topicView():route.view==='books'?booksView():understandingView();
 document.title=(route.view==='topic'?scopeTitle(route.topic,route.subtopic):route.view==='books'?'All books':route.view==='understanding'?'My understanding':'The Library')+' · Atlas OS';
 saveFeedback();replaceIcons();
}
function rerenderPreservingScroll(){const y=window.scrollY;render();window.scrollTo(0,y);}
function modalHeader(eyebrow,title,subtitle=''){return `<div class="dialog-head"><div class="grow"><div class="eyebrow">${esc(eyebrow)}</div><h2 id="modal-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button class="icon-btn" data-action="close-modal" aria-label="Close dialog" autofocus>${icon('close')}</button></div>`;}
function showModal(html,context){
 const modal=$('#modal');if(!modal.open)modalReturnFocus=document.activeElement;
 modalContext=context;modal.innerHTML=html;if(!modal.open)modal.showModal();modal.scrollTop=0;saveFeedback();
}
function openNotes(id){
 const b=getBook(id);if(!b)return;const p=progress(id);
 const fields=NOTE_FIELDS.map(([f,label])=>{
 const prompts={takeaway:'The most important idea I want to remember…',notes:'Useful ideas, examples, evidence, and page or chapter references. Separate the author’s claim from your reaction.',questions:'What do I disagree with? What is missing, uncertain, or dependent on context?',application:'What will I apply, test, explain differently, or keep in mind?'};
 return `<div class="field"><label for="note-${f}">${esc(label)}</label><textarea id="note-${f}" data-book-note="${id}" data-field="${f}" rows="${f==='notes'?6:f==='takeaway'?2:3}" style="${f==='takeaway'?'min-height:85px':''}" placeholder="${esc(prompts[f])}">${esc(p[f])}</textarea></div>`;
 });
 const where=topicById(b.topic)?b.subtopic+' · '+subById(b.topic,b.subtopic).title:b.topic==='reference'?'Reference':'To place · subject unconfirmed';
 showModal(`${modalHeader('Book notes',b.title,b.author)}<div class="dialog-body"><div class="notes-hint">${esc(where)}</div><div class="note-status"><div class="field"><label for="note-status">Reading status</label><select id="note-status" data-book-status="${id}">${Object.entries(STATUS).map(([s,l])=>`<option value="${s}" ${p.status===s?'selected':''}>${l}</option>`).join('')}</select></div><div class="field" id="completed-date-field" ${p.status==='done'?'':'hidden'}><label for="note-finished">Date completed</label><input id="note-finished" type="date" data-finished-date="${id}" value="${esc((p.completedAt||'').slice(0,10))}"></div></div>${readingFields(b)}${fields[0]}${fields[1]}<details class="details-block" ${p.questions||p.application?'open':''}><summary>Question it & put it to use <span class="muted">· optional</span></summary>${fields[2]}${fields[3]}</details><div class="dialog-bottom"><div><span class="save-state">All changes saved on this browser</span><br><button class="back-link" style="font-size:11px" data-action="edit-book" data-id="${id}">Edit title or placement</button></div><div class="row wrap"><button class="btn" data-action="copy-book" data-id="${id}">${icon('copy')}Copy notes</button><button class="btn primary" data-action="close-modal">Done</button></div></div></div>`,{type:'book',id});
}
function metadataSubOptions(tid,selected){
 if(['reference','unassigned'].includes(tid))return `<option value="${tid}">${tid==='reference'?'Reference':'To place'}</option>`;
 return (topicById(tid)?.subtopics||[]).map(s=>`<option value="${s.id}" ${s.id===selected?'selected':''}>${s.id} · ${esc(s.title)}</option>`).join('')+'<option value="__new__">+ Create a subtopic</option>';
}
function openBookEditor(id=null,tid='1',sid='all'){
 const b=id?getBook(id):null;if(id&&!b)return;
 tid=b?.topic||tid||'1';if(!topicById(tid)&&!['reference','unassigned'].includes(tid))tid='1';sid=b?.subtopic||sid;
 if(sid==='all')sid=topicById(tid)?.subtopics[0].id||tid;
 showModal(`${modalHeader(b?'Catalogue details':'Grow your library',b?'Edit book':'Add a book','Every book has one primary topic and subtopic.')}<div class="dialog-body"><form id="book-editor-form"><input type="hidden" name="book-id" value="${esc(b?.id||'')}"><div class="field"><label for="edit-title">Book title</label><input type="text" id="edit-title" name="title" required maxlength="400" value="${esc(b?.title||'')}" placeholder="Title"></div><div class="field"><label for="edit-author">Author <span class="muted">· optional</span></label><input type="text" id="edit-author" name="author" maxlength="400" value="${esc(b?.author||'')}" placeholder="Author or editor"></div><div class="form-grid"><div class="field"><label for="edit-topic">Primary topic</label><select id="edit-topic" name="topic">${topicOptions(tid,null)}</select></div><div class="field"><label for="edit-subtopic">Subtopic</label><select id="edit-subtopic" name="subtopic">${metadataSubOptions(tid,sid)}</select></div></div><div class="field" id="new-subtopic-field" hidden><label for="edit-new-subtopic">New subtopic name</label><input id="edit-new-subtopic" name="new-subtopic" maxlength="160" placeholder="A specific subject within this topic"></div>${!b?`<div class="field"><label for="edit-initial-status">Reading status</label><select id="edit-initial-status" name="initial-status">${Object.entries(STATUS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div><div class="field"><label for="edit-initial-notes">Initial notes <span class="muted">· optional</span></label><textarea id="edit-initial-notes" name="initial-notes" rows="3" placeholder="Why I picked this book; what I hope to learn…"></textarea></div>`:''}<p class="notes-hint">${b?'Existing notes and reading progress stay attached to this book, even when you move it.':'New books are saved in this browser and included in your backups. You can continue taking notes immediately.'}</p><div class="dialog-bottom"><div class="row wrap"><button type="button" class="btn quiet" data-action="${b?'notes':'close-modal'}" ${b?`data-id="${b.id}"`:''}>Cancel</button>${b?.id.startsWith('custom-')?`<button type="button" class="btn danger" data-action="delete-book" data-id="${b.id}">Remove book</button>`:''}</div><button type="submit" class="btn primary">${b?'Save changes':'Add book'} ${icon('check')}</button></div></form></div>`,{type:'catalog',id});
}
function getTheme(){try{return ['system','light','dark'].includes(localStorage.getItem(THEME_KEY))?localStorage.getItem(THEME_KEY):'system';}catch(e){return themeMode||'system';}}
let themeMode='system';
function applyTheme(mode,write=false){
 themeMode=mode;const dark=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme:dark)').matches);
 document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.dataset.atlasTheme=dark?'dark':'light';document.querySelector('meta[name=theme-color]').content='#0b1422';
 if(write)try{localStorage.setItem(THEME_KEY,mode);}catch(e){toast('Appearance changed for this tab. Browser storage is unavailable.');}
}
function openSettings(){
 const theme=getTheme();pendingImport=null;
 const localFile=location.protocol==='file:';
 showModal(`${modalHeader('Your data & preferences','Backup & settings')}<div class="dialog-body"><section class="settings-section"><h3>Appearance</h3><p>Uses the same light, dark, or system preference as your Atlas dashboards when hosted on the same origin.</p><label class="sr-only" for="theme-select">Appearance</label><select id="theme-select">${[['system','Follow system'],['light','Light'],['dark','Dark']].map(([v,l])=>`<option value="${v}" ${theme===v?'selected':''}>${l}</option>`).join('')}</select></section><section class="settings-section"><h3>Keep a copy of your work</h3><p>Backups include your catalogue, check-offs, book notes, page counts, pages read, reading deadlines, section priorities, learning focus, synthesis drafts, and saved understandings. A Markdown export is a readable notebook, not a restorable backup.</p><div class="row wrap"><button class="btn primary" data-action="export-backup">${icon('download')}Download JSON backup</button><button class="btn" data-action="export-notebook">${icon('note')}Export notebook</button></div><p style="margin-top:12px" id="last-backup-label">${state.lastBackupAt?'Last backup requested: '+esc(prettyDate(state.lastBackupAt)):'No backup downloaded from this browser yet.'}</p>${rawAtBoot&&blocked?'<button class="btn danger" data-action="export-recovery">Download unreadable data for recovery</button>':''}</section><section class="settings-section"><h3>Restore a backup</h3><p>Choose a Library JSON backup. You will review it before anything changes. Restoring replaces this dashboard’s records; it does not merge devices. Download a current backup first.</p><label for="import-file" class="field-label">Library backup file</label><input type="file" id="import-file" class="file-input" accept=".json,application/json"><div id="import-feedback" aria-live="polite"></div></section><section class="settings-section"><h3>Where your notes live</h3><div class="notice"><strong>Saved on this browser, not in GitHub or the cloud.</strong><br>Opening the dashboard on another phone, computer, or browser does not automatically bring your notes with it. Move your work using a JSON backup. Clearing site data or using private browsing can remove saved records.</div><p style="margin-top:15px">${localFile?'You are using a local HTML file. Open it in a full browser with JavaScript enabled; a phone’s file preview may show only the layout. Keep using the same file and browser, and export before moving or renaming it. A hosted copy is easier to use on an iPhone.':'Keep using this page in the same browser for consistent saving. A hosted page provides access to the app, not automatic cross-device note syncing.'}</p><p>No accounts, analytics, or connected AI services are included. The webpage loads static Atlas assets; your reading records are not sent to a server. Text you copy or export leaves the app only when you choose to use it elsewhere. Do not place private client information in this general-purpose notebook.</p></section><section class="settings-section"><h3>Your starting catalogue</h3><p>129 identifiable titles from your photographs: 127 placed in 14 learning topics, one travel reference, and one title awaiting placement. Unreadable or obscured items were not invented. All books start unchecked. Use “Edit title or placement” in book notes to correct metadata without losing your work.</p><p>Classification is a filing choice, not validation of a book’s claims. Treat tax editions as dated references and record uncertainty in your notes.</p></section><div class="dialog-bottom"><span class="save-state">All changes saved on this browser</span><button class="btn primary" data-action="close-modal">Done</button></div></div>`,{type:'settings'});
}
function downloadFile(name,content,type='text/plain;charset=utf-8'){
 const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function dateSlug(){return new Date().toISOString().slice(0,10);}
function exportBackup(){
 state.lastBackupAt=now();persist();
 const payload={app:APP,schemaVersion:1,exportedAt:now(),data:state};
 downloadFile(`the-library-backup-${dateSlug()}.json`,JSON.stringify(payload,null,2),'application/json');
 const label=$('#last-backup-label');if(label)label.textContent='Last backup requested: '+prettyDate(state.lastBackupAt);toast('Backup download started. Keep the JSON file somewhere safe.');
}
function bookMarkdown(b){const p=progress(b.id);let result=`## ${b.title}\n${b.author?'\n'+b.author+'\n':''}\nStatus: ${STATUS[p.status]}${p.completedAt?' · Completed '+prettyDate(p.completedAt):''}\n`;const page=pageInfo(b).pages;if(page)result+=`\nPages: ${page} · Read: ${p.status==='done'?page:Math.min(page,state.reading.pagesRead[b.id]||0)}\n`;for(const [f,label] of NOTE_FIELDS){if(p[f]?.trim())result+=`\n### ${label}\n${p[f]}\n`;}return result;}
function topicMarkdown(k){
 const [tid,sid]=k.split(':'),s=synthesis(k);let out=`# ${scopeTitle(tid,sid)}\n\n${sid==='all'?'Whole topic':'Subtopic '+sid} · ${topicById(tid).title}\n\nExported ${prettyDate(now())}\n`;
 if(s.question?.trim())out+=`\n## My guiding question\n${s.question}\n`;
 if(s.published)out+=`\n## My saved understanding\n${s.published.text}\n\nSaved ${prettyDate(s.published.at)}\n`;
 if(s.summary?.trim()&&s.summary!==s.published?.text)out+=`\n## Working synthesis draft\n${s.summary}\n`;
 for(const [f,label] of [['patterns','Recurring ideas'],['tensions','Disagreements and limits'],['application','What changes for me']])if(s[f]?.trim())out+=`\n## ${label}\n${s[f]}\n`;
 if(sid==='all'){const children=snapshots().filter(([key])=>key.startsWith(tid+':')&&!key.endsWith(':all'));if(children.length)out+='\n# Saved subtopic understandings\n'+children.map(([key,syn])=>`\n## ${scopeTitle(...key.split(':'))}\n${syn.published.text}\n`).join('');}
 out+='\n# Book notes\n';const books=booksIn(tid,sid);for(const b of books)if(hasNotes(b.id))out+='\n'+bookMarkdown(b)+'\n---\n';
 if(!books.some(b=>hasNotes(b.id)))out+='\nNo book notes recorded yet.\n';
 return out;
}
function allNotebook(){
 let out=`# The Library — my learning notebook\n\nExported ${prettyDate(now())}. A readable export; use JSON backups to restore the dashboard.\n\n`;
 for(const t of TOPICS){out+=`\n# ${t.id}. ${t.title}\n`;for(const sub of t.subtopics){out+=`\n## ${sub.id} · ${sub.title}\n`;for(const b of booksIn(t.id,sub.id))out+=`\n${bookMarkdown(b)}\n`;}
 for(const [k,s] of Object.entries(state.syntheses).filter(([key])=>key.startsWith(t.id+':'))){out+=`\n## Synthesis: ${scopeTitle(...k.split(':'))}\n`;for(const field of SYN_FIELDS)if(s[field]?.trim())out+=`\n### ${field==='summary'?'Working understanding':field}\n${s[field]}\n`;if(s.published)out+=`\n### Saved understanding\n${s.published.text}\n`;if(s.history?.length)out+='\n### Earlier versions\n'+s.history.map(h=>`\n${prettyDate(h.at)}\n${h.text}\n`).join('');}
 }
 out+='\n# Reference & to place\n';state.catalog.filter(b=>['reference','unassigned'].includes(b.topic)).forEach(b=>out+='\n'+bookMarkdown(b));return out;
}
function synthesisPrompt(k){
 const [tid,sid]=k.split(':');
 return `Help me distill my understanding of “${scopeTitle(tid,sid)}”.\n\nUse ONLY the notes and reflections below. Do not assume I read every book, do not invent agreement between authors, and do not add facts that are missing. My notes may mix authors’ claims with my own reactions; keep that distinction and any uncertainty visible.\n\nWrite a proposed synthesis of about 100–150 words, in clear language, covering the central idea, why it matters, and the most important limitation. Do not rank or endorse political actors, policies, or choices. Do not force a definitive conclusion when the notes are thin or contradictory; instead say what remains unresolved. This is a draft for me to review and rewrite, not a verified expert conclusion.\n\nMY SOURCE MATERIAL\n\n${topicMarkdown(k)}`;
}
async function copyText(content,label='Text'){
 try{if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');await navigator.clipboard.writeText(content);toast(label+' copied.');return;}
 catch(e){
  const target=document.createElement('textarea');target.value=content;target.style.cssText='position:fixed;left:-9999px;top:0;';const host=$('#modal').open?$('#modal'):document.body;host.appendChild(target);target.focus();target.select();let ok=false;try{ok=document.execCommand('copy');}catch(err){}target.remove();
  if(ok){toast(label+' copied.');return;}
 }
 showModal(`${modalHeader('Copy or save',label)}<div class="dialog-body"><p class="notes-hint">Your browser could not copy automatically. Select the text and copy it, or download a text file.</p><textarea id="manual-copy" class="manual-copy" readonly aria-label="Text to copy">${esc(content)}</textarea><div class="dialog-bottom"><button class="btn" data-action="select-copy-text">Select all text</button><button class="btn primary" data-action="download-copy-text">${icon('download')}Download text</button></div></div>`,{type:'copy',text:content});
}
async function previewImport(file){
 pendingImport=null;const feedback=$('#import-feedback');if(!file||!feedback)return;
 try{
  if(file.size>12*1024*1024)throw new Error('This file is too large. Choose a Library JSON backup under 12 MB.');
  const parsed=JSON.parse(await file.text());
  if(parsed.app!==APP||parsed.schemaVersion!==1)throw new Error('This file is not a compatible Library JSON backup. Nothing has changed.');
  const data=normalizeState(parsed.data);pendingImport=data;const s=statsFrom(data),under=Object.values(data.syntheses).filter(x=>x.published?.text).length;
  feedback.innerHTML=`<div class="transfer-preview"><h3>Review this backup</h3><p>${esc(file.name)}<br>${data.catalog.length} books · ${s.done} completed · ${s.notes} with notes · ${under} saved understandings · ${Object.keys(data.reading.goals).length} reading goals</p><p><strong>This replaces your current data.</strong> A copy of this browser’s current records will download first. Keep both backups before closing this page.</p><button class="btn danger" data-action="confirm-import">Back up current & replace</button><button class="btn quiet" data-action="cancel-import">Cancel</button></div>`;
 }catch(e){feedback.innerHTML=`<p class="error-text">${esc(e instanceof SyntaxError?'This file is not valid JSON. Nothing has changed.':e.message)}</p>`;}
}
function statsFrom(data){let done=0,notes=0;for(const b of data.catalog){const p=data.progress[b.id];if(p?.status==='done')done++;if(p&&NOTE_FIELDS.some(([f])=>p[f]?.trim()))notes++;}return {done,notes};}
function confirmImport(){
 if(!pendingImport)return;
 if(!window.confirm('Replace this browser’s Library data with the selected backup? A backup of the current data will download before replacement. This is not a merge.'))return;
 const replacement=clone(pendingImport),before={app:APP,schemaVersion:1,exportedAt:now(),data:state};
 downloadFile(`the-library-before-restore-${Date.now()}.json`,JSON.stringify(before,null,2),'application/json');
 if(blocked&&rawAtBoot)downloadFile(`the-library-unreadable-recovery-${Date.now()}.txt`,rawAtBoot);
 try{localStorage.setItem(KEY,JSON.stringify(replacement));}
 catch(e){$('#import-feedback').innerHTML='<p class="error-text">The browser could not save the restored backup. Current records have not been replaced. Free up storage or use another browser.</p>';return;}
 state=replacement;TOPICS=withCustomTopics(state.customSubtopics);blocked=false;conflict=false;storageError='';rawAtBoot=JSON.stringify(state);pendingImport=null;$('#modal').close();rerenderPreservingScroll();toast('Backup restored. Your books, notes, and understandings are ready.');
}
function publishSynthesis(k){
 if(!validScope(k))return;const s=ensureSynthesis(k);
 if(!s.summary.trim()){toast('Write your understanding first. A few clear sentences are enough.');$('#syn-summary')?.focus();return;}
 if(s.published?.text===s.summary){toast('This version is already in My understanding.');return;}
 if(s.published){s.history=s.history||[];s.history.push(clone(s.published));s.history=s.history.slice(-10);}
 s.published={text:s.summary,at:now()};s.updatedAt=now();const saved=persist();
 if($('#synthesis-badge')){$('#synthesis-badge').textContent='Saved understanding';$('#synthesis-badge').className='pill distilled';}
 if($('#synthesis-history'))$('#synthesis-history').innerHTML=historyHTML(k);
 renderSidebar();toast(saved?'Understanding saved. Find it in My understanding.':'Understanding retained in this tab only. Export a backup now.');
}
function restoreVersion(k,version){
 const s=ensureSynthesis(k),snap=version==='latest'?s.published:s.history?.[Number(version)];if(!snap)return;
 // A deliberate version restore alters only the draft; the latest published summary remains intact.
 if(s.summary?.trim()&&s.summary!==snap.text&&!window.confirm('Replace the current working draft with this saved version? Your saved understanding and version history will remain unchanged.'))return;
 s.summary=snap.text;s.updatedAt=now();persist();rerenderPreservingScroll();toast('Version restored as your working draft.');
}
function routeAfterEdit(){if(route.view==='books')$('#book-results').innerHTML=bookResults();else rerenderPreservingScroll();}

document.addEventListener('click',async event=>{
 const el=event.target.closest('[data-action]');if(!el)return;
 const a=el.dataset.action,id=el.dataset.id,key=el.dataset.key;
 if(a==='edit-priorities')openPriorities();
 else if(a==='reset-priorities'&&modalContext?.type==='priorities'){modalContext.order=seed.topics.map(t=>t.id);$('#priority-list').innerHTML=priorityRows(modalContext.order);$('#priority-feedback').textContent='Original order restored in this preview. Save to apply.';}
 else if(a==='settings')openSettings();
 else if(a==='close-modal')$('#modal').close();
 else if(a==='notes')openNotes(id);
 else if(a==='page-progress'){openNotes(id);$('#reading-total')?.focus();}
 else if(a==='clear-reading-goal'){if(validScope(key)){delete state.reading.goals[key];persist();render();toast('Reading goal cleared. Your page progress is kept.');}}
 else if(a==='new-book')openBookEditor(null,el.dataset.topic||'1',el.dataset.subtopic||'all');
 else if(a==='edit-book')openBookEditor(id);
 else if(a==='delete-book'){
  const b=getBook(id);if(!b||!id.startsWith('custom-'))return;
  if(!window.confirm(`Remove “${b.title}” and its book notes? Saved topic understandings will stay. Export a backup first to keep a recoverable copy.`))return;
  state.catalog=state.catalog.filter(book=>book.id!==id);delete state.progress[id];delete state.reading.pageCounts[id];delete state.reading.pagesRead[id];persist();$('#modal').close();toast('Book removed. Saved topic understandings are unchanged.');
 }
 else if(a==='add-pages'){const form=el.closest('[data-progress-form]'),field=form?.querySelector('[data-progress-page]');if(field)previewProgress(form,Math.min(Number(field.max),Number(field.value||0)+Number(el.dataset.pages)));}
 else if(a==='log-focus-progress')openFocusProgress(el.dataset.topic,el.dataset.subtopic);
 else if(a==='skip-book'){setStatus(id,'skipped');routeAfterEdit();toast('Book excluded from reading goals. Your finish dates, notes and pages are kept.');}
 else if(a==='include-book'){setStatus(id,'unread');routeAfterEdit();toast('Book included again. Your daily target is updated.');}
 else if(a==='stop-reading'){setStatus(id,'unread');routeAfterEdit();toast('Removed from Continue reading. Your pages and notes are kept.');}
 else if(a==='start-reading'){setStatus(id,'reading');routeAfterEdit();toast('Marked as reading.');}
 else if(a==='browse-topics'){$('#topic-grid-section')?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth',block:'start'});$('#topic-grid-section .topic-card')?.focus({preventScroll:true});}
 else if(a==='set-focus'){
  const f={topic:el.dataset.topic,subtopic:el.dataset.subtopic};
  if(validScope(scopeKey(f.topic,f.subtopic))){state.focus=f;persist();rerenderPreservingScroll();toast('Your learning focus is set. Find it on the Topics page.');}
 }
 else if(a==='reset-filters'){ui.q='';ui.status='all';ui.topic='all';render();}
 else if(a==='publish-synthesis')publishSynthesis(key);
 else if(a==='copy-prompt'){if(validScope(key))await copyText(synthesisPrompt(key),'Synthesis prompt');}
 else if(a==='copy-book'){const b=getBook(id);if(b)await copyText(bookMarkdown(b),'Book notes');}
 else if(a==='export-topic'){if(validScope(key)){downloadFile(`library-topic-${key.replace(':','-')}-${dateSlug()}.md`,topicMarkdown(key),'text/markdown;charset=utf-8');toast('Topic notebook download started.');}}
 else if(a==='export-backup')exportBackup();
 else if(a==='export-notebook'){downloadFile(`the-library-notebook-${dateSlug()}.md`,allNotebook(),'text/markdown;charset=utf-8');toast('Readable notebook download started.');}
 else if(a==='export-understandings'){
  const list=snapshots();if(!list.length){toast('Save an understanding before exporting.');return;}
  const content='# My understanding\n\n'+list.map(([k,s])=>`## ${scopeTitle(...k.split(':'))}\n\n${s.published.text}\n\nSaved ${prettyDate(s.published.at)}\n`).join('\n---\n\n');
  downloadFile(`my-understanding-${dateSlug()}.md`,content,'text/markdown;charset=utf-8');toast('Understanding collection download started.');
 }
 else if(a==='confirm-import')confirmImport();
 else if(a==='cancel-import'){pendingImport=null;$('#import-feedback').innerHTML='';$('#import-file').value='';}
 else if(a==='export-recovery')downloadFile(`library-recovery-${Date.now()}.txt`,rawAtBoot);
 else if(a==='restore-version')restoreVersion(key,el.dataset.version);
 else if(a==='select-copy-text'){$('#manual-copy').focus();$('#manual-copy').select();}
 else if(a==='download-copy-text'&&modalContext?.type==='copy')downloadFile(`library-synthesis-prompt-${dateSlug()}.txt`,modalContext.text);
 else if(a==='print')window.print();
});
document.addEventListener('input',event=>{
 const el=event.target;
 if(el.matches?.('[data-progress-slider],[data-progress-page]')){if(el.value!=='')previewProgress(el.closest('[data-progress-form]'),el.value);}
 else if(el.id==='reading-deadline'){saveGoalDate(el);}
 else if(el.id==='reading-total'){$('#reading-current').max=Number(el.value)>0?el.value:100000;}
 else if(el.id==='edit-title'){el.setCustomValidity('');}
 else if(el.id==='library-search'){ui.q=el.value;$('#book-results').innerHTML=bookResults();}
 else if(el.id==='understanding-search'){ui.understandingQ=el.value;$('#understanding-results').innerHTML=understandingResults();}
 else if(el.dataset.bookNote){const id=el.dataset.bookNote,f=el.dataset.field;if(!getBook(id)||!NOTE_FIELDS.some(([name])=>name===f))return;const p=ensureProgress(id);p[f]=el.value;p.updatedAt=now();persist();}
 else if(el.dataset.syn){const k=el.dataset.syn,f=el.dataset.field;if(!validScope(k)||!SYN_FIELDS.includes(f))return;const s=ensureSynthesis(k);s[f]=el.value;s.updatedAt=now();persist();
  if(f==='summary'){const n=words(s.summary),counter=$('#summary-word-count');if(counter){counter.textContent=`${n} words · aim for 150`;counter.classList.toggle('over',n>150);}const badge=$('#synthesis-badge');if(badge){const same=s.published?.text===s.summary;badge.textContent=same?'Saved understanding':'Working draft';badge.className='pill '+(same?'distilled':'');}}
 }
});
document.addEventListener('change',event=>{
 const el=event.target;
 if(el.dataset.priorityTopic&&modalContext?.type==='priorities'){modalContext.order=Reading.movePriority(modalContext.order,el.dataset.priorityTopic,Number(el.value));$('#priority-list').innerHTML=priorityRows(modalContext.order);$('#priority-'+el.dataset.priorityTopic)?.focus({preventScroll:true});$('#priority-feedback').textContent='Order updated in this preview. Save to apply.';}
 else if(el.id==='progress-book-select'){openFocusProgress(el.dataset.topic,el.dataset.subtopic,el.value);$('#progress-book-select')?.focus();}
 else if(el.id==='reading-deadline'){saveGoalDate(el);}
 else if(el.dataset.complete){const id=el.dataset.complete;if(getBook(id)){setStatus(id,el.checked?'done':['reading','skipped'].includes(progress(id).beforeComplete)?progress(id).beforeComplete:'unread');const y=window.scrollY;routeAfterEdit();window.scrollTo(0,y);document.querySelector(`[data-complete="${id}"]`)?.focus({preventScroll:true});}}
 else if(el.dataset.bookStatus){setStatus(el.dataset.bookStatus,el.value);$('#completed-date-field').hidden=el.value!=='done';$('#note-finished').value=(progress(el.dataset.bookStatus).completedAt||'').slice(0,10);const current=$('#reading-current');if(current){current.disabled=el.value==='done';current.value=el.value==='done'?(pageInfo(getBook(el.dataset.bookStatus)).pages||0):(state.reading.pagesRead[el.dataset.bookStatus]||0);}}
 else if(el.dataset.finishedDate){const p=ensureProgress(el.dataset.finishedDate);if(p.status==='done'){p.completedAt=el.value;p.updatedAt=now();persist();}}
 else if(el.id==='scope-select'){navigate(scopeRoute(route.topic,el.value,route.tab));}
 else if(el.id==='library-topic-filter'){ui.topic=el.value;$('#book-results').innerHTML=bookResults();}
 else if(el.id==='library-status-filter'){ui.status=el.value;$('#book-results').innerHTML=bookResults();}
 else if(el.id==='understanding-topic-filter'){ui.understandingTopic=el.value;$('#understanding-results').innerHTML=understandingResults();}
 else if(el.id==='edit-topic'){$('#edit-subtopic').innerHTML=metadataSubOptions(el.value,'');$('#new-subtopic-field').hidden=true;$('#edit-new-subtopic').required=false;}
 else if(el.id==='edit-subtopic'){const fresh=el.value==='__new__';$('#new-subtopic-field').hidden=!fresh;$('#edit-new-subtopic').required=fresh;if(fresh)$('#edit-new-subtopic').focus();}
 else if(el.id==='theme-select')applyTheme(el.value,true);
 else if(el.id==='import-file')previewImport(el.files?.[0]);
});
document.addEventListener('submit',event=>{
 if(event.target.id==='priority-form'&&modalContext?.type==='priorities'){event.preventDefault();state.topicOrder=[...modalContext.order];const saved=persist();$('#modal').close();rerenderPreservingScroll();toast(saved?'Section priorities saved.':'Priorities are in this tab only. Export a backup.');return;}

 if(event.target.dataset.progressForm){
  event.preventDefault();const form=event.target,id=form.dataset.progressForm,b=getBook(id);if(!b||!form.reportValidity()||progress(id).status==='done')return;
  const value=Number(new FormData(form).get('current')),total=pageInfo(b).pages;if(!Reading.validProgress(value,total))return;
  captureGoalDate($('#reading-deadline'));
  state.reading.pagesRead[id]=value;const p=ensureProgress(id);if(value>0&&p.status==='unread'){p.status='reading';p.startedAt=p.startedAt||now();}p.updatedAt=now();
  const saved=persist(),place=form.dataset.place,strip=$('.continue-strip'),x=strip?.scrollLeft||0;
  routeAfterEdit();if($('.continue-strip'))$('.continue-strip').scrollLeft=x;
  const active=document.querySelector(`[data-progress-form="${id}"][data-place="${place}"]`);
  if(active){previewProgress(active,value);active.querySelector('[data-progress-feedback]').textContent=saved?'Progress saved. Your daily target is updated.':'Not saved — export a backup.';active.querySelector('[type="submit"]').focus({preventScroll:true});}
  refreshGoalPreview();return;
 }

 if(event.target.id==='reading-goal-form'){
  event.preventDefault();const form=event.target,key=form.dataset.key,date=new FormData(form).get('deadline');
  if(!form.reportValidity()||!validScope(key)||Reading.dayNumber(date)===null||date<localDate())return;
  state.reading.goals[key]=date;const saved=persist();render();toast(saved?'Reading goal saved. Your daily target follows your remaining pages.':'Goal is in this tab only. Export a backup.');return;
 }
 if(event.target.id==='reading-progress-form'){
  event.preventDefault();const form=event.target,id=form.dataset.id,b=getBook(id);if(!b||!form.reportValidity())return;
  const data=new FormData(form),raw=String(data.get('pages')||''),pages=raw?Number(raw):null,current=Number(data.get('current')||0),done=progress(id).status==='done';
  if((pages!==null&&!Reading.validPages(pages))||!Number.isInteger(current)||current<0||current>100000||(!done&&pages!==null&&current>pages))return;
  captureGoalDate($('#reading-deadline'));
  state.reading.pageCounts[id]=pages;if(!done)state.reading.pagesRead[id]=current;
  if(!done&&current>0&&progress(id).status==='unread'){const p=ensureProgress(id);p.status='reading';p.startedAt=p.startedAt||now();p.updatedAt=now();}
  const saved=persist();openNotes(id);$('#reading-pages-status').textContent=saved?'Pages saved. Section targets updated.':'Not saved — export a backup.';return;
 }
 if(event.target.id!=='book-editor-form')return;event.preventDefault();
 const form=event.target;if(!form.reportValidity())return;const data=new FormData(form),title=String(data.get('title')).trim(),author=String(data.get('author')||'').trim(),tid=String(data.get('topic')),id=String(data.get('book-id')||'');let sid=String(data.get('subtopic'));
 if(!title){$('#edit-title').setCustomValidity('Enter a book title.');$('#edit-title').reportValidity();return;}
 if(sid==='__new__'&&topicById(tid)){
  const name=String(data.get('new-subtopic')||'').trim();if(!name){$('#edit-new-subtopic').focus();return;}
  const existing=topicById(tid).subtopics.find(sub=>sub.title.toLocaleLowerCase()===name.toLocaleLowerCase());
  if(existing)sid=existing.id;
  else {sid=tid+'X'+Date.now().toString(36);state.customSubtopics.push({topic:tid,id:sid,title:name});TOPICS=withCustomTopics(state.customSubtopics);}
 }
 if(!((topicById(tid)&&subById(tid,sid))||(['reference','unassigned'].includes(tid)&&tid===sid)))return;
 if(id){const b=getBook(id);if(!b)return;Object.assign(b,{title,author,topic:tid,subtopic:sid});persist();openNotes(id);toast('Book details updated. Your notes are preserved.');}
 else{const newid='custom-'+(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2,10)}`);state.catalog.push({id:newid,title,author,topic:tid,subtopic:sid});const p=ensureProgress(newid);p.notes=String(data.get('initial-notes')||'');p.updatedAt=now();setStatus(newid,Object.hasOwn(STATUS,data.get('initial-status'))?data.get('initial-status'):'unread');persist();openNotes(newid);toast('Book added to your library.');}
});
$('#modal').addEventListener('close',()=>{modalContext=null;pendingImport=null;rerenderPreservingScroll();if(modalReturnFocus?.isConnected)modalReturnFocus.focus({preventScroll:true});else if(modalReturnFocus?.dataset?.action){const match=[...document.querySelectorAll('[data-action]')].find(el=>el.dataset.action===modalReturnFocus.dataset.action&&el.dataset.id===modalReturnFocus.dataset.id&&el.getClientRects().length);match?.focus({preventScroll:true});}});
$('#modal').addEventListener('click',e=>{if(e.target===$('#modal')){const r=$('#modal').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#modal').close();}});
window.addEventListener('hashchange',()=>{if($('#modal').open)$('#modal').close();render();window.scrollTo(0,0);});
window.addEventListener('storage',event=>{
 if(event.key===THEME_KEY){applyTheme(getTheme());const select=$('#theme-select');if(select)select.value=getTheme();return;}
 if(event.key!==KEY)return;
 // Prevent a stale tab from overwriting another tab's notes. User can export each version before restoring.
 if(event.newValue!==JSON.stringify(state)){conflict=true;saveFeedback();}
});
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{if(getTheme()==='system')applyTheme('system');});
window.addEventListener('beforeunload',event=>{if(storageError||conflict||blocked){event.preventDefault();event.returnValue='Your changes are not saved. Export a backup before leaving.';}});
// Public hooks are intentionally read-only and limited to metadata for diagnostics.
Object.defineProperty(window,'LibraryInfo',{value:Object.freeze({version:'1.5.2',schemaVersion:1,storageKey:KEY,seedBooks:seed.books.length,topics:TOPICS.length}),writable:false});
window.addEventListener('pageshow',refreshGoalPreview);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshGoalPreview();});
applyTheme(getTheme());replaceIcons();render();
})();

