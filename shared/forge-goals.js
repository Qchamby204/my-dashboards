(()=>{
  'use strict';
  const M=window.ForgeGoalModel,P=window.ForgeGoalPlans,KEY='forge:goals:v1';
  const goalPlaces=new Map();let goalVisit=0;
  let data=M.blank(),raw=null,blocked=false,failed=false,active=null,error='',status='',homeScroll=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(label,action,attrs='')=>`<button type="button" data-goal-action="${action}" ${attrs}>${label}</button>`;
  // Decorative equipment scenes identify the page; saved training metrics remain text.
  const art=kind=>{
    const scenes={
      home:'<path d="M40 115h240"/><rect x="54" y="92" width="15" height="46" rx="4" fill="#ffffff08"/><rect x="76" y="81" width="19" height="68" rx="5" fill="#ffffff08"/><rect x="225" y="81" width="19" height="68" rx="5" fill="#ffffff08"/><rect x="251" y="92" width="15" height="46" rx="4" fill="#ffffff08"/><circle cx="160" cy="70" r="30" stroke="#91b6b5"/><path d="M160 52v19l11 8m-19-44h16m-8-6v6" stroke="#91b6b5"/><path d="M119 157h82" opacity=".4"/>',
      bench:'<path d="M62 157V44m196 113V44M62 76h17m179 0h-17M36 70h248"/><rect x="47" y="52" width="14" height="36" rx="3" fill="#ffffff08"/><rect x="68" y="46" width="18" height="48" rx="4" fill="#ffffff08"/><rect x="234" y="46" width="18" height="48" rx="4" fill="#ffffff08"/><rect x="259" y="52" width="14" height="36" rx="3" fill="#ffffff08"/><rect x="105" y="115" width="110" height="16" rx="6" stroke="#91b6b5" fill="#ffffff08"/><path d="M122 132v28m76-28v28M108 160h28m48 0h28" stroke="#91b6b5"/>',
      deadlift:'<path d="M35 118h250"/><circle cx="87" cy="118" r="40" fill="#ffffff08"/><circle cx="87" cy="118" r="26" opacity=".45"/><circle cx="87" cy="118" r="6" fill="#e6bd7b"/><circle cx="233" cy="118" r="40" fill="#ffffff08"/><circle cx="233" cy="118" r="26" opacity=".45"/><circle cx="233" cy="118" r="6" fill="#e6bd7b"/><path d="M137 65h46m-23 0V29m-9 10 9-10 9 10" stroke="#91b6b5"/><path d="M44 160h232" opacity=".4"/>',
      run:'<path d="M18 160h284M26 142h80m91 0h97M37 124h58m116 0h72" opacity=".35"/><circle cx="184" cy="38" r="11" fill="#ffffff08"/><path d="m140 71 26-11 26 26 31 4m-56-29-18 44 31 24-13 34m-18-58-30 41H96"/><path d="M77 60h33m-49 23h38m-51 23h30" stroke="#91b6b5"/>',
      dunk:'<rect x="179" y="22" width="101" height="64" rx="4" fill="#ffffff08"/><path d="M229 86v74m-18-101h37v27m-53 0h66m-58 0 7 28h37l7-28m-43 1 7 26m18-26-7 26"/><circle cx="103" cy="90" r="24" stroke="#91b6b5" fill="#ffffff08"/><path d="M79 90h48m-24-24c-13 14-13 34 0 48m0-48c13 14 13 34 0 48M80 47c39-33 88-35 116-13" stroke="#91b6b5"/><path d="M58 162h216" opacity=".4"/>'
    };
    return `<svg class="fg-feature-art" data-illustration="${esc(kind)}" viewBox="0 0 320 190" fill="none" aria-hidden="true"><path d="M26 175h268" stroke="currentColor" stroke-opacity=".18"/><circle cx="292" cy="33" r="4" fill="currentColor" opacity=".3"/><circle cx="28" cy="37" r="2" fill="currentColor" opacity=".5"/><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${scenes[kind]||scenes.home}</g></svg>`;
  };
  const feature=(kind,rail,title,body,actions,{home=false}={})=>`<section class="fg-feature${home?' fg-starting-point':''}" aria-label="${home?'Your training focus':'Current goal session'}"><div class="fg-feature-rail">${esc(rail)}</div><div class="fg-feature-body"><div class="fg-feature-title"><${home?'h1':'h2'}${home?'':' id="fg-session-title"'}>${esc(title)}</${home?'h1':'h2'}></div>${art(kind)}${body}</div><div class="fg-feature-footer fg-actions">${actions}</div></section>`;
  const info=(title,body)=>`<details class="fg-info"><summary aria-label="${esc(title)}"><span aria-hidden="true">i</span><span>${esc(title)}</span></summary><div>${body}</div></details>`;
  function read(){blocked=false;try{raw=localStorage.getItem(KEY);data=raw?M.validate(JSON.parse(raw)):M.blank();}catch{blocked=true;}state.goals=data;}
  function persist(){
    try{
      const current=localStorage.getItem(KEY);
      if(current!==raw)throw Error('Goal training changed in another tab. Download your work, then reload to use the latest saved copy.');
      const next=JSON.stringify(M.validate(data));localStorage.setItem(KEY,next);
      if(localStorage.getItem(KEY)!==next)throw Error('Could not verify this save.');
      raw=next;failed=false;error='';state.goals=data;return true;
    }catch(e){failed=true;status='';error=e.message||'Could not save goal training. Keep this tab open and retry.';return false;}
  }
  function plan(id=active){return data.plans[id]||M.fresh();}
  function editPlan(){if(!data.plans[active])data.plans[active]=M.fresh();return data.plans[active];}
  function selected(){const p=plan(),b=P[active].build(p.base);return {p,b,w:b.weeks[p.week]};}
  function name(id,p,w,d){const b=P[id].build(p.base);return b.days[`${b.weeks[w].phase}_${d}`]||b.days[d];}
  function notice(){return (blocked||failed?`<div class="fg-error" role="alert">${esc(blocked?'Your goal records could not be read. Download the original records before restoring a backup.':'Not saved on this device. Your changes are still in this tab. '+error)}<div class="fg-actions">${button('Download goal backup','backup')}${!blocked?button('Retry saving','retry'):''}${button('Reload saved copy','reload')}</div></div>`:'')+(error&&!failed?`<p class="fg-error" role="alert">${esc(error)}</p>`:'')+(status?`<p class="fg-status" role="status">${esc(status)}</p>`:'');}
  function suggestedWeek(){
    const days=[
      ['Mon','lower','Above the Rim A','Deadlift A','Jump first · heavy pull'],
      ['Tue','upper','Bench A','5K run','Easy run*'],
      ['Wed','rest','Rest','','Recovery'],
      ['Thu','lower','Above the Rim B','Deadlift B','Jump first · technique'],
      ['Fri','rest','Rest','','Recovery'],
      ['Sat','upper','Bench B','5K run','Quality run*'],
      ['Sun','rest','Rest','','Recovery']
    ];
    return `<section class="fg-week-guide" aria-labelledby="fg-week-guide-title"><div class="fg-week-guide-heading"><h3 id="fg-week-guide-title">Suggested goal week</h3><span>4 training days · 2 goals per day</span></div><ol class="fg-week-strip" aria-label="Suggested weekly training order">${days.map(([day,type,first,second,note])=>`<li class="fg-week-day fg-week-${type}"><span class="fg-week-dayname">${day}</span><strong>${first}</strong>${second?`<span class="fg-week-then" aria-label="then">↓</span><strong>${second}</strong>`:''}<small>${note}</small></li>`).join('')}</ol>${info('How to pair the sessions','<p><strong>Follow the order shown.</strong> Warm up, complete your jump work while fresh, then deadlift. On bench and running days, bench comes first. A and B mean the first and second sessions in the selected training week.</p><p><strong>Running order.</strong> In weeks 2–7, Tuesday is the easy run (Run 2), and Saturday is the quality run (Run 1). In week 1, do the baseline trial on Tuesday before the easy run on Saturday. In week 8, do the primer on Tuesday and the final trial on Saturday.</p><p><strong>Combined lower-body days.</strong> These are pairings of your existing plans, not a reduced-volume program. Review the extra split squats, hamstring work and other accessories before stacking both full sessions; shorten the jump block if quality drops.</p><p><strong>Test week.</strong> Follow each plan’s primer, rest and test instructions. Move a test if needed to preserve its prescribed recovery; separate bench and the 5K trial by several hours when possible.</p><p><strong>Flexible days.</strong> This is a suggested rhythm, not a dated schedule. Shift the days to fit your week while preserving recovery. Log each goal separately; the strip does not mark sessions complete.</p>')}</section>`;
  }
  function home(){
    const chosen=data.goal&&P[data.goal],p=chosen&&plan(chosen.id),next=p&&M.next(p);
    const question=chosen?feature(chosen.id,chosen.phase,chosen.title,`<p class="fg-feature-target">${esc(chosen.target)} <span>${esc(chosen.unit)}</span></p><p>${esc(M.metric(chosen.id,p))}</p><p>${Object.keys(p.completed).length}/16 sessions saved${next?` · Next: Week ${next.week+1} · ${next.day==='d1'?'A':'B'}`:''}</p>`,button('Continue your chosen plan','open',`data-goal="${chosen.id}" class="fg-primary"`),{home:true}):feature('home','Your training focus','Choose your next challenge','<p>Choose a goal to work toward. Your regular four-day split is below.</p>',Object.values(P).map(c=>button(esc(c.title),'choose-focus',`data-goal="${c.id}"`)).join(''),{home:true});
    return `${question}<section class="fg-home" aria-labelledby="fg-title"><header class="fg-section-title"><div><div class="fg-kicker">Separate sessions · 8 weeks</div><h2 id="fg-title">Goal training</h2></div>${info('About goal training','<p>Each goal has two sessions per week and its own set log. Your regular split and its session totals stay separate. A saved session may contain fewer sets than prescribed; its log shows exactly what you did.</p><p>Bench targets 315 lb this block. Deadlift, 5K and dunking are phase one of longer goals.</p>')}</header>${notice()}<div class="fg-grid">${Object.values(P).map(c=>{
      const p=plan(c.id),n=M.next(p),count=Object.keys(p.completed).length;
      const started=Object.keys(p.done).length>0;
      return `<button type="button" class="fg-card fg-${c.color}" data-goal-action="open" data-goal="${c.id}" ${blocked?'disabled':''}><span class="fg-card-top"><span>${esc(c.title)}</span><span class="fg-badge">${c.phase}</span></span><strong class="fg-target">${esc(c.target)} <small>${esc(c.unit)}</small></strong><span class="fg-metric">${esc(M.metric(c.id,p))}</span><span class="fg-progress" role="progressbar" aria-label="${c.title} sessions saved" aria-valuemin="0" aria-valuemax="16" aria-valuenow="${count}"><span style="width:${count/16*100}%"></span></span><span class="fg-card-bottom"><span>${count}/16 sessions</span><span>${n?`Week ${n.week+1} · ${n.day==='d1'?'A':'B'}`:'Block logged'}</span></span><span class="fg-card-cta">${started?'Continue':'Open plan'} <span aria-hidden="true">↗</span></span></button>`;
    }).join('')}</div><details class="fg-week-guide-disclosure"><summary>Weekly training guide</summary>${suggestedWeek()}</details>${recent()}<div class="fg-backup-row">${button('Back up goals','backup')}${button('Restore goal backup','import')}</div></section>`;
  }
  function recent(){
    const entries=Object.entries(data.plans).flatMap(([id,p])=>Object.entries(p.completed).map(([k,date])=>({id,k,date,p}))).sort((a,b)=>b.date.localeCompare(a.date));
    if(!entries.length)return '';
    return `<details class="fg-log"><summary>Goal session log <span>${entries.length} saved</span></summary>${entries.map(({id,k,date,p})=>{const [w,d]=k.split('-'),c=M.counts(id,p,+w,d);return `<button type="button" data-goal-action="history" data-goal="${id}" data-week="${w}" data-day="${d}"><span><strong>${P[id].title}</strong> · Week ${+w+1} ${d==='d1'?'A':'B'}<small>${c.logged}/${c.total} sets logged</small></span><time datetime="${date}">${new Date(date).toLocaleDateString(undefined,{month:'short',day:'numeric'})}</time></button>`;}).join('')}</details>`;
  }
  function field(label,key,value,type='number',attrs='',hint=''){
    return `<label><span id="fg-label-${key}">${label}</span><input aria-labelledby="fg-label-${key}" name="${key}" value="${esc(value||'')}" type="${type}" ${attrs} ${hint?`aria-describedby="fg-hint-${key}"`:''} ${type==='number'?'inputmode="decimal" step="any"':''}>${hint?`<small id="fg-hint-${key}">${hint}</small>`:''}</label>`;
  }
  function editor(k,e){
    const p=plan(),v=M.defaults(active,p,k);
    let fields='';
    if(active==='run')fields=field('Total time (mm:ss)','w',v.w,'text','inputmode="text" placeholder="15:00" required')+field('Distance completed','distance',v.distance,'number','min="0.001" placeholder="1.5" required')+`<label>Distance unit<select name="unit"><option value="mi" ${v.unit!=='km'?'selected':''}>Miles</option><option value="km" ${v.unit==='km'?'selected':''}>Kilometres</option></select></label>`;
    else if(e.reach)fields=field('Best touch (inches)','w',v.w,'number','min="0.5" max="200" required');
    else if(active==='dunk')fields=field('Weight, reps or note (optional)','w',v.w,'text','maxlength="500" placeholder="e.g. 35 lb × 6 each leg"');
    else fields=field('Weight (lb)','w',v.w,'number','min="0"','Use 0 for bodyweight.')+field(e.rl||'Reps','r',v.r,'number','min="0.1" required');
    const set=M.locate(active,k,p.base).set+1,effort=active!=='dunk'?`<details class="fg-effort" ${v.e?'open':''}><summary>Effort (optional)</summary>${field('RPE (1–10)','e',v.e,'number','min="1" max="10"')}</details>`:'';
    return `<form class="fg-editor" data-key="${k}" aria-label="${esc(e.n)}, set ${set}"><div class="fg-editor-heading"><strong>Set ${set} of ${e.sets}</strong><span>${p.done[k]?'Editing saved set':'Unfinished entry'}</span></div><div class="fg-fields">${fields}</div>${active==='run'?`<p class="fg-run-result" role="status" aria-live="polite">${runResult(v)}</p><small>Use the time and distance for this set. Shorter runs count, including runs under 3 miles.</small>`:''}${effort}<div class="fg-actions"><button type="submit" class="fg-primary">${active==='dunk'&&!e.reach?'Mark done':'Save set'}</button>${p.done[k]?button('Clear set','clear',`data-key="${k}"`):''}${button('Close','close-editor')}</div><small>Entries stay in this browser. Unfinished fields are saved as a draft.</small></form>`;
  }
  function exercises(){
    const {p,w}=selected(),next=currentSet(p,w),where=next?M.locate(active,next,p.base):null;
    return w[p.day].map((e,ei)=>`<section data-current="${where?.week===p.week&&where?.day===p.day&&where?.exercise===ei}" class="fg-exercise ${e.main?'fg-main':''}" aria-labelledby="fg-ex-${ei}"><div class="fg-ex-top"><h3 id="fg-ex-${ei}">${esc(e.n)}</h3><strong>${esc(e.rx)}</strong></div><div class="fg-sets">${Array.from({length:e.sets},(_,s)=>{
      const k=M.key(p.week,p.day,ei,s),v=p.done[k];let label=''+(s+1);
      if(v)label=active==='run'?`${v.w}${v.distance?' · '+v.distance+' '+v.unit:''}`:e.reach?v.w+' in':active==='dunk'?'✓':`${v.w!==''?v.w+' × ':''}${v.r}${e.rl?' '+e.rl.toLowerCase():''}`;
      return button(esc(label+(k===next?' · '+(p.draft?'Editing':'Next'):'')),'set',`data-key="${k}" ${k===next?'aria-current="step"':''} class="fg-set ${v?'fg-done':''}" aria-label="${esc(e.n)}, set ${s+1}, ${v?esc(label):'not logged'}${k===next?', '+(p.draft?'editing':'next set'):''}" aria-expanded="${p.draft?.key===k}"`);
    }).join('')}</div>${p.draft&&M.locate(active,p.draft.key,p.base)?.exercise===ei&&p.draft.key.startsWith(`${p.week}-${p.day}-`)?editor(p.draft.key,e):''}<div class="fg-rest-line"><span>Rest · ${esc(e.rest)}</span>${restSeconds(e.rest)?button('Start rest','rest',`data-seconds="${restSeconds(e.rest)}" aria-label="Start rest for ${esc(e.n)}"`):''}</div>${e.note?`<details class="fg-ex-guidance"><summary>Exercise guidance</summary><p class="fg-ex-note">${esc(e.note)}</p></details>`:''}</section>`).join('');
  }
  function runResult(v){
    const stats=M.runStats(v);
    return stats?`${M.format(stats.pace)} / mile · ${stats.mph.toFixed(1)} mph average`:'Enter time and distance to see your average mile pace and speed.';
  }
  function runSummary(p){
    const {stats,unmeasured}=M.runTotals(p,p.week,p.day);
    if(!stats&&!unmeasured)return '';
    return `<section class="fg-run-summary" aria-label="Logged run totals"><strong>Logged run totals</strong>${stats?`<div class="fg-pace-grid"><div><small>Distance</small><strong>${Number(stats.miles.toFixed(3))} mi</strong></div><div><small>Total time</small><strong>${M.format(stats.seconds)}</strong></div><div><small>Average / mile</small><strong>${M.format(stats.pace)}</strong></div><div><small>Average speed</small><strong>${stats.mph.toFixed(1)} mph</strong></div></div>`:''}<small>${unmeasured?`${unmeasured} older set${unmeasured===1?' has':'s have'} time only. Add distance to include ${unmeasured===1?'it':'them'} in these totals. `:''}Totals use the sets you logged; rest between sets is excluded.</small></section>`;
  }
  function restSeconds(s){const m=s.match(/(\d+)(?: to (\d+))? (sec|min)/);return m?Number(m[2]||m[1])*(m[3]==='min'?60:1):0;}
  function pacePanel(){
    const p=plan(),sec=M.seconds(p.base)/5;
    return `<section class="fg-pace"><form id="fg-base-form"><label>Latest 5K time trial<input name="base" value="${p.baseConfirmed?esc(p.base):''}" placeholder="mm:ss" inputmode="text" required></label><button type="submit">Update paces</button></form>${!p.baseConfirmed?'<p>Preview paces use 28:00 until you log your first time trial.</p>':''}<div class="fg-pace-grid">${[['Easy',`${M.format(sec+60)}–${M.format(sec+90)}`],['Tempo',M.format(sec+15)],['Intervals',M.format(sec-5)]].map(([n,v])=>`<div><small>${n} / km</small><strong>${v}</strong></div>`).join('')}</div></section>`;
  }
  function rememberGoal(){if(active){const p=plan();goalPlaces.set(active,{y:window.scrollY||0,week:p.week,day:p.day});}}
  function currentSet(p,w){
    if(p.draft)return p.draft.key;
    for(let exercise=0;exercise<w[p.day].length;exercise++)for(let set=0;set<w[p.day][exercise].sets;set++){const key=M.key(p.week,p.day,exercise,set);if(!p.done[key])return key;}
    return null;
  }
  function currentSession(){
    const {p,w}=selected(),day=name(active,p,p.week,p.day),count=M.counts(active,p,p.week,p.day),key=currentSet(p,w),where=key?M.locate(active,key,p.base):null;
    return notice()+feature(active,`Current session · Week ${p.week+1} · ${p.day==='d1'?'A':'B'}`,day.title,`<p>${count.logged}/${count.total} sets ${failed?'entered · not saved':'logged'}${!failed&&p.completed[`${p.week}-${p.day}`]?' · Session saved':''}</p>${where?`<p class="fg-current-next">${p.draft?'Continue':'Next'}: ${esc(where.e.n)} · Set ${where.set+1}${where.week!==p.week||where.day!==p.day?` · Week ${where.week+1} ${where.day==='d1'?'A':'B'}`:''}</p>`:''}`,key?button(p.draft?'Resume unfinished set':'Log next set','next-set',`data-key="${key}" class="fg-primary"`):button(p.completed[`${p.week}-${p.day}`]?'Update saved session':'Finish session','finish','class="fg-primary"')).replace('class="fg-feature"','class="fg-feature fg-current-session"');
  }
  function detail(){
    const c=P[active],{p,b,w}=selected(),day=name(active,p,p.week,p.day),ct=M.counts(active,p,p.week,p.day),done=p.completed[`${p.week}-${p.day}`];
    return `<section class="fg-detail fg-${c.color}" aria-label="${c.title} plan"><header class="fg-detail-head">${button('← Forge','home')}<span>${esc(c.phase)} · ${esc(c.title)}</span></header><header class="fg-detail-title"><h1 tabindex="-1" id="fg-detail-title">${esc(c.title)}</h1><p>${esc(c.aim)} · ${esc(M.metric(active,p))}</p></header>${currentSession()}${active==='run'?pacePanel():''}${active==='dunk'?info('Touch height and the rim','<p>The rim is 120 inches. Your best touch is measured from the floor, not the height of your jump. The supplied plan estimates a dunk needs roughly 126–129 inches, depending on your hands.</p>'):''}<nav class="fg-weeks" aria-label="Training week">${b.weeks.map((_,i)=>button(`Week ${i+1}${p.completed[`${i}-d1`]&&p.completed[`${i}-d2`]?' ✓':''}`,'week',`data-week="${i}" aria-label="Week ${i+1}" aria-pressed="${i===p.week}"`)).join('')}</nav><div class="fg-phase"><strong>Week ${p.week+1} · ${esc(b.phases[w.phase].name)}</strong>${info('This week',`<p>${esc(w.note)}</p>`)}</div><nav class="fg-days" aria-label="Goal session">${['d1','d2'].map(d=>button(esc(name(active,p,p.week,d).title)+(p.completed[`${p.week}-${d}`]?' ✓':''),'day',`data-day="${d}" aria-pressed="${d===p.day}"`)).join('')}</nav><div class="fg-session-intro"><p>${esc(day.purpose)}</p><span>${ct.logged}/${ct.total} sets ${failed?'entered · not saved':'logged'}${!failed&&done?' · Session saved':''}</span></div>${exercises()}${active==='run'?runSummary(p):''}<footer class="fg-session-footer"><span>${ct.logged}/${ct.total} sets ${failed?'entered · not saved':'logged'}</span>${button(done?'Update saved session':'Finish session','finish','class="fg-primary"')}${done?button('Next session →','next'):''}<small>${done?`Saved ${new Date(done).toLocaleDateString()}`:'Finish saves the session with the sets you logged.'}</small></footer>${info('How to run this plan',c.rules)}</section>`;
  }
  function paint(){
    const host=document.getElementById('forge-goals');if(!host)return;
    if(state.goals&&state.goals!==data){data=state.goals;try{raw=localStorage.getItem(KEY);blocked=false;failed=false;}catch{failed=true;error='Could not read saved goal training.';}}
    // The regular split remains mounted, keeping its own draft and live workout intact.
    const goalOpen=!!active;document.getElementById('app').classList.toggle('fg-goal-open',goalOpen);
    const app=document.getElementById('app');app.querySelector('.fg-starting-point')?.remove();
    host.innerHTML=active?detail():home();
    if(active){const detail=host.querySelector('.fg-detail'),opening=detail?.querySelector('.fg-current-session');if(opening){const head=detail.querySelector('.fg-detail-head'),title=detail.querySelector('.fg-detail-title');if(head&&title)opening.after(head,title);}}

    if(!active){const prompt=host.querySelector('.fg-starting-point');if(prompt)app.querySelector('.appbar')?.after(prompt);}
    window.CoreAppFinish?.layoutOpening?.();
  }
  function focusTitle(){document.getElementById('fg-detail-title')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  function open(id,week,day){
    if(blocked)return;
    rememberGoal();const place=week===undefined?goalPlaces.get(id):null,visit=++goalVisit;
    if(!active)homeScroll=window.scrollY;
    active=id;error='';status='';const p=editPlan(),n=M.next(p);
    if(week!==undefined){p.week=week;p.day=day;}else if(p.draft){const at=M.locate(id,p.draft.key,p.base);p.week=at.week;p.day=at.day;}else if(place){p.week=place.week;p.day=place.day;}else if(n){p.week=n.week;p.day=n.day;}
    persist();paint();focusTitle();
    if(place){window.scrollTo({top:place.y,behavior:'instant'});if(typeof requestAnimationFrame==='function')requestAnimationFrame(()=>{if(active===id&&visit===goalVisit&&document.activeElement===document.getElementById('fg-detail-title'))window.scrollTo({top:place.y,behavior:'instant'});});}
    if(location.hash!==`#goal-${id}`)location.hash=`goal-${id}`;
  }
  function saveSet(form){
    const p=editPlan(),k=form.dataset.key,at=M.locate(active,k,p.base),values=Object.fromEntries(new FormData(form));
    try{M.validateEntry(active,at.e,values);}catch(e){error=e.message;paint();document.querySelector('.fg-error')?.scrollIntoView({block:'nearest'});return;}
    const replacedTrial=active==='run'&&p.done[k]&&M.fullTrial(at.e,p.done[k])&&p.base===p.done[k].w;
    p.done[k]={...values,at:new Date().toISOString()};p.draft=null;
    status='Set saved.';
    if(active==='run'&&at.e.n==='5k time trial'){
      // Short runs stay in the log without replacing a completed 5K benchmark.
      const latest=M.latestTrial(p);
      if(latest&&(M.fullTrial(at.e,values)||replacedTrial)){p.base=latest;p.baseConfirmed=true;}else if(replacedTrial){p.base='28:00';p.baseConfirmed=false;}
      status=M.fullTrial(at.e,values)?'Run saved. Paces updated from your latest completed 5K.':'Run saved with your actual distance, mile pace and speed.';
    }
    const saved=persist();paint();if(saved)window.AtlasExperience?.complete(document.querySelector(`[data-goal-action="set"][data-key="${k}"]`));document.querySelector(`[data-goal-action="set"][data-key="${k}"]`)?.focus({preventScroll:true});
  }
  function backup(){
    const payload=blocked?{app:'forge-goals-recovery',raw}: {app:'forge-goals',version:1,exportedAt:new Date().toISOString(),goals:data};
    const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=blocked?'forge-goals-original-records.json':'forge-goals-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),4000);
  }
  function importBackup(){
    const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
    input.onchange=async()=>{try{const file=input.files[0];if(!file)return;if(file.size>10*1024*1024)throw Error('Choose a backup under 10 MB.');const o=JSON.parse(await file.text()),next=M.validate(o.goals);window.ForgeSession.confirmAction('Restore goal backup?','This replaces your goal training logs. Your regular Forge workouts stay unchanged.','Restore goals',()=>{raw=localStorage.getItem(KEY);data=M.clone(next);blocked=false;state.goals=data;status='Goal backup restored.';persist();active=null;paint();});}catch(e){error=e.message;paint();}};input.click();
  }
  function click(e){
    const el=e.target.closest('[data-goal-action]');if(!el)return;
    const a=el.dataset.goalAction;
    if(a==='backup'){backup();return;}if(a==='import'){importBackup();return;}
    if(a==='reload'){window.ForgeSession.confirmAction('Reload saved goals?','Download a backup first if this tab has unsaved work.','Reload',()=>location.reload());return;}
    if(blocked)return;
    if(a==='retry'){if(persist())status='Changes saved on this device.';paint();return;}
    if(a==='choose-focus'&&Object.hasOwn(P,el.dataset.goal)&&!data.goal){data.goal=el.dataset.goal;if(persist()){paint();open(data.goal);}else paint();return;}
    if(a==='open'||a==='history'){open(el.dataset.goal,a==='history'?Number(el.dataset.week):undefined,el.dataset.day);return;}
    if(a==='home'){rememberGoal();active=null;status='';error='';location.hash='';paint();window.scrollTo({top:homeScroll,behavior:'instant'});document.querySelector('[data-goal-action="open"]')?.focus({preventScroll:true});return;}
    if(a==='rest'){startTimer(Number(el.dataset.seconds));return;}
    if(a==='next-set'){
      const p=editPlan(),key=p.draft?.key||el.dataset.key,where=M.locate(active,key,p.base);if(!where)return;
      if(!p.draft)p.draft={key,values:M.defaults(active,p,key)};
      p.week=where.week;p.day=where.day;status='';error='';persist();paint();
      const editor=document.querySelector('.fg-editor');editor?.scrollIntoView({block:'center',behavior:'instant'});editor?.querySelector('input')?.focus({preventScroll:true});return;
    }

    const p=editPlan();status='';error='';
    if(a==='week')p.week=Number(el.dataset.week);
    if(a==='day')p.day=el.dataset.day;
    if(a==='set'){
      const k=el.dataset.key;
      if(p.draft?.key===k)p.draft=null;
      else{if(p.draft){error='Save or close your unfinished set before opening another.';paint();return;}const values=M.defaults(active,p,k);p.draft={key:k,values};}
    }
    if(a==='close-editor')p.draft=null;
    if(a==='clear'){
      const cleared=M.locate(active,el.dataset.key,p.base),removed=p.done[el.dataset.key];delete p.done[el.dataset.key];p.draft=null;
      if(active==='run'&&removed&&M.fullTrial(cleared.e,removed)){const latest=M.latestTrial(p);if(latest){p.base=latest;p.baseConfirmed=true;}else if(p.base===removed.w){p.base='28:00';p.baseConfirmed=false;}}
      if(!M.counts(active,p,p.week,p.day).logged)delete p.completed[`${p.week}-${p.day}`];
    }
    if(a==='finish'){
      const c=M.counts(active,p,p.week,p.day);
      if(!c.logged){error='Log at least one set before finishing this session.';paint();return;}
      if(p.draft){error='Save or close the unfinished set before finishing.';paint();return;}
      p.completed[`${p.week}-${p.day}`]=p.completed[`${p.week}-${p.day}`]||new Date().toISOString();status='Session saved to your goal training log.';
    }
    if(a==='next'){const n=M.next(p);if(n){p.week=n.week;p.day=n.day;}else status='All 16 sessions are saved. Review your week 8 test results.';}
    const saved=persist();paint();if(saved&&a==='finish')window.AtlasExperience?.complete(document.querySelector('[data-goal-action="finish"]'));
    if(a==='set')document.querySelector('.fg-editor input')?.focus({preventScroll:true});
    if(['week','day','next'].includes(a))document.querySelector('.fg-phase')?.scrollIntoView({block:'start'});
  }
  function ready(){
    read();
    window.ForgeGoals=Object.freeze({paint,snapshot:()=>M.clone(data),validate:M.validate,get failed(){return failed;},get blocked(){return blocked;}});
    document.getElementById('app').addEventListener('click',click);
    document.addEventListener('click',event=>{if(event.target.closest?.('#atlas-page-navigation [data-page-key],#atlas-page-menu [data-page-key]'))rememberGoal();},true);
    document.getElementById('app').addEventListener('input',e=>{
      const f=e.target.closest('.fg-editor');if(!f||blocked)return;
      const p=editPlan();p.draft={key:f.dataset.key,values:Object.fromEntries(new FormData(f))};persist();
      const result=f.querySelector('.fg-run-result');if(result)result.textContent=runResult(p.draft.values);
      // Keep typing uninterrupted; announce write failures without replacing the form.
      if(failed){let warning=f.querySelector('.fg-inline-error');if(!warning){warning=document.createElement('p');warning.className='fg-inline-error';warning.setAttribute('role','alert');f.append(warning);}warning.textContent='Draft could not be saved. Keep this tab open and back up your goals.';}
    });
    document.getElementById('app').addEventListener('submit',e=>{
      if(!e.target.matches('.fg-editor,#fg-base-form'))return;e.preventDefault();if(blocked)return;
      if(e.target.matches('.fg-editor')){saveSet(e.target);return;}
      const value=new FormData(e.target).get('base').trim(),sec=M.seconds(value);
      if(!sec||sec<600||sec>3600){error='Enter a 5K time between 10:00 and 60:00.';paint();return;}
      const p=editPlan();p.base=value;p.baseConfirmed=true;status='Paces updated.';persist();paint();
    });
    window.addEventListener('beforeunload',e=>{if(failed){e.preventDefault();e.returnValue='';}});
    window.addEventListener('storage',e=>{if(e.key!==KEY||failed)return;read();paint();});
    window.addEventListener('hashchange',()=>{const id=location.hash.replace('#goal-','');if(id===active)return;if(Object.hasOwn(P,id))open(id);else{active=null;paint();window.scrollTo({top:homeScroll,behavior:'instant'});}});
    const id=location.hash.replace('#goal-','');if(Object.hasOwn(P,id)&&!blocked)open(id);else paint();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
})();
