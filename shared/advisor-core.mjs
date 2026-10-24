// Advisor Guild: deliberate practice, assessed mastery and operating results stay separate.
export const KEY='advisor-guild:v1';
export const VERSION=1;
export const TREES=[
 {id:'growth',name:'Business development',short:'Growth',target:8,unit:'qualified discovery meetings',color:'#edb679',skills:['Positioning','Prospecting','Relationship building','Referrals','Marketing and content','Consultative selling','Pipeline management'],rules:['Meeting held with a prospective household','Fit assessed against written client criteria','Needs and agreed next step recorded'],detail:'One prospective household counts once per season. Repeated follow-ups do not create another meeting unit.'},
 {id:'discovery',name:'Client discovery',short:'Discovery',target:4,unit:'discovery-file audits',color:'#90c8e5',skills:['Active listening','Questioning','Financial fact finding','Values and goals','Risk assessment','Family awareness','Diagnosis'],rules:['Financial circumstances, goals and time horizons checked','Motivations, priorities, risk and constraints checked','Family and professional relationships checked','Missing information resolved or assigned'],detail:'Audit one completed discovery file against all six discovery elements. Each file counts once per season.'},
 {id:'planning',name:'Financial planning',short:'Planning',target:4,unit:'planning case analyses',color:'#b8b0e7',skills:['Financial management','Retirement and decumulation','Tax planning','Corporate planning','Insurance and risk','Estate and legacy','Scenario modelling','Integration and prioritization'],rules:['One planning decision and assumptions documented','At least two reasonable options compared','Calculations checked and corrected','Recommendation, trade-offs and next actions documented'],detail:'A focused case is sufficient. Compare the status quo where relevant. Use a distinct case/decision code; an unchecked analysis is unfinished.'},
 {id:'investing',name:'Investment management',short:'Investing',target:2,unit:'investment analyses',color:'#8cd3b8',skills:['Investment evidence','Asset allocation','Portfolio construction','Product due diligence','Tax-aware investing','Implementation and rebalancing','Performance interpretation'],rules:['One investment question and reasonable alternatives defined','Exposure, costs, risks and liquidity assessed','Tax considerations and conclusion documented','Calculations and factual claims checked'],detail:'Compare reasonable alternatives for the specific question. Research hours and portfolio returns do not earn units.'},
 {id:'communication',name:'Communication and education',short:'Communication',target:4,unit:'explanation drills',color:'#e7acb9',skills:['Plain-language explanation','Storytelling and analogy','Visual explanation','Meeting leadership','Written communication','Presentation and camera','Understanding checks'],rules:['A two-to-three-minute explanation recorded','Technical accuracy reviewed','Feedback obtained','One revised version completed'],detail:'Record yourself explaining one topic. Keep recordings in your approved tools; save only an anonymous reference here.'},
 {id:'coaching',name:'Behavioural coaching',short:'Coaching',target:4,unit:'coaching drills',color:'#d5baec',skills:['Behavioural awareness','Emotional attunement','Decision framing','Constructive challenge','Volatility coaching','Accountability','Adaptability'],rules:['A distinct scenario and emotional concern identified','Reasonable options explored','A response practised and feedback obtained','One improvement and a follow-up recorded'],detail:'A role-play counts as practice, never as a client outcome. Appropriate plan changes are not failures.'},
 {id:'relationships',name:'Client relationships',short:'Relationships',target:4,unit:'relationship reviews',color:'#e5ce8b',skills:['Expectation setting','Proactive care','Personal understanding','Value articulation','Difficult conversations','Family engagement','Relationship renewal'],rules:['One household’s priorities and commitments reviewed','Service or relationship gaps assessed','A next useful action or reason none is needed recorded'],detail:'One household review counts once per season. Use an anonymous code, without client names or identifying details.'},
 {id:'execution',name:'Execution and coordination',short:'Execution',target:4,unit:'implementation audits',color:'#9cc5bb',skills:['Action planning','Prioritization','Specialist coordination','Operational accuracy','Follow-through','Quality control','Progress monitoring'],rules:['Instructions, owners and deadlines checked','Completion evidence and dependencies reviewed','Each gap resolved or assigned to an owner'],detail:'Audit one implementation case. Sending an instruction is not evidence of completed implementation.'},
 {id:'leadership',name:'Practice leadership',short:'Leadership',target:4,unit:'weekly operating reviews',color:'#e5b89c',skills:['Business strategy','Practice economics','Process design','Delegation','Team development','Technology fluency','Capacity and continuity'],rules:['Commitments and capacity reviewed','Three weekly priorities chosen','Delegated work reviewed','Decisions and owners recorded'],detail:'One operating review per seven-day season week. Use a distinct evidence code; additional reviews in the same week do not add credit.'},
 {id:'judgment',name:'Judgment and stewardship',short:'Judgment',target:2,unit:'decision reviews',color:'#b7c8eb',skills:['Ethical reasoning','Suitability judgment','Critical thinking','Uncertainty','Scope awareness','Confidentiality and security','Documentation','Continuing competence'],rules:['A difficult decision, facts and alternatives documented','Conflicts and limits of competence considered','Rationale and what would change the decision recorded'],detail:'Review the reasoning, including specialist input where needed. XP cannot offset a conduct issue.'}
];
export const METRICS=[
 {id:'discovery',name:'Discovery completeness',target:100,unit:'reviewed discovery records',pass:'Records meeting all six discovery elements',help:'Circumstances; goals/amounts/time horizons; priorities/motivations; risk/constraints; relevant relationships; missing information and next steps.'},
 {id:'followup',name:'Meeting follow-through',target:100,unit:'meetings requiring a summary',pass:'Summaries and next steps sent within two business days',help:'Count only meetings requiring a written follow-through. Two business days excludes weekends; apply your actual local holidays.'},
 {id:'actions',name:'Advisor action reliability',target:95,unit:'advisor-owned actions due',pass:'Actions completed by the agreed deadline',help:'Use the original agreed deadline. Record justified changes in your approved task system. Client and specialist dependencies are separate.'},
 {id:'service',name:'Service commitment delivery',target:100,unit:'promised reviews and contacts due',pass:'Commitments delivered by their due date',help:'Use the service commitments actually agreed with the household. Record dependencies and reschedules separately.'},
 {id:'checking',name:'Pre-delivery checking',target:100,unit:'planning deliverables issued',pass:'Deliverables with completed input, assumption and calculation checks',help:'Include all issued deliverables in the denominator, including ones requiring correction.'},
 {id:'issues',name:'Issue resolution',target:100,unit:'identified issues due for resolution',pass:'Issues resolved by the agreed deadline',help:'Report issues openly. A missing issue log is not evidence of zero issues or perfect performance.'}
];
export const TRAITS=['Integrity','Discernment','Empathy','Curiosity','Clarity','Courage','Composure','Discipline','Diligence','Humility and coachability','Adaptability','Patience'];
export const RATINGS=['Foundational: needs substantial guidance','Developing: handles straightforward work with support','Proficient: handles routine situations independently','Advanced: handles complex situations and anticipates problems','Expert: sustained quality across varied situations; develops others'];
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;}
export function addDays(s,n){if(!validDate(s))throw Error('Choose a valid date.');const d=new Date(s+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function daysBetween(a,b){return Math.round((Date.parse(b+'T12:00:00Z')-Date.parse(a+'T12:00:00Z'))/86400000);}
export const tree=id=>TREES.find(t=>t.id===id);
export const uid=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export function newSeason(start=today()){return {id:uid(),start,targets:Object.fromEntries(TREES.map(t=>[t.id,t.target])),focus:['discovery','planning','communication']};}
export function emptyState(start=today()){return {version:VERSION,seasons:[newSeason(start)],entries:[],assessments:[],reliability:[],outcomes:[]};}
const fail=message=>{throw Error(message);};
const count=n=>Number.isSafeInteger(n)&&n>=0&&n<=1000000;
const text=(v,max=700)=>typeof v==='string'&&v.length<=max;
const code=s=>String(s).trim().toUpperCase();
const json=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
function array(a,name){if(!Array.isArray(a)||a.length>20000)fail('Invalid '+name+'.');const ids=new Set();for(const v of a){if(!v||typeof v!=='object'||Array.isArray(v)||!text(v.id,100)||!v.id||ids.has(v.id))fail('Invalid or duplicate '+name+' ID.');ids.add(v.id);}}
function safeObject(v,depth=0){if(depth>25)fail('Record is too deeply nested.');if(v&&typeof v==='object')for(const k of Object.keys(v)){if(['__proto__','prototype','constructor'].includes(k))fail('Invalid record key.');safeObject(v[k],depth+1);}}
export function validateState(s){
 safeObject(s);if(!s||s.version!==VERSION)fail('Unsupported Advisor Guild backup.');
 for(const key of ['seasons','entries','assessments','reliability','outcomes'])array(s[key],key);
 if(!s.seasons.length)fail('A season is required.');
 const ordered=[...s.seasons].sort((a,b)=>a.start.localeCompare(b.start));
 for(const [i,a]of ordered.entries()){
  if(!validDate(a.start)||!a.targets||Object.keys(a.targets).length!==TREES.length||TREES.some(t=>!count(a.targets[t.id])||a.targets[t.id]<1||a.targets[t.id]>100))fail('Season targets must be whole numbers from 1 to 100.');
  if(!Array.isArray(a.focus)||a.focus.length>3||new Set(a.focus).size!==a.focus.length||a.focus.some(id=>!tree(id)))fail('Choose up to three focus trees.');
  if(i&&a.start<=addDays(ordered[i-1].start,27))fail('Seasons cannot overlap.');
 }
 const references=new Set(),weeks=new Set();
 for(const e of s.entries){
  const t=tree(e.treeId),a=s.seasons.find(a=>a.id===e.seasonId);
  if(!t||!a||!t.skills.includes(e.skill)||!validDate(e.date)||e.date<a.start||e.date>addDays(a.start,27)||!['practice','live'].includes(e.source)||!text(e.reference,80)||!e.reference.trim()||!text(e.evidence)||!e.evidence.trim()||typeof e.void!=='boolean'||!Array.isArray(e.checks)||e.checks.length!==t.rules.length||!e.checks.every(v=>v===true))fail('Invalid or incomplete practice entry.');
  if(!e.void){const key=a.id+':'+t.id+':'+code(e.reference);if(references.has(key))fail('That evidence code already counts for this tree and season.');references.add(key);
   if(t.id==='leadership'){const w=a.id+':'+Math.floor(daysBetween(a.start,e.date)/7);if(weeks.has(w))fail('Only one operating review counts per season week.');weeks.add(w);}
  }
 }
 for(const a of s.assessments){const t=tree(a.treeId);if(!t||!(t.skills.includes(a.skill)||TRAITS.includes(a.skill))||!validDate(a.date)||!['self','colleague','client'].includes(a.assessor)||!Number.isInteger(a.score)||a.score<1||a.score>5||!text(a.evidence)||!a.evidence.trim())fail('Assessment needs a valid skill, rating and dated evidence.');}
 for(const r of s.reliability){if(!s.seasons.some(a=>a.id===r.seasonId)||!METRICS.some(m=>m.id===r.metricId)||!count(r.passed)||!count(r.eligible)||r.passed>r.eligible)fail('Completed cannot exceed eligible; use non-negative whole numbers.');}
 if(new Set(s.reliability.map(r=>r.seasonId+':'+r.metricId)).size!==s.reliability.length)fail('Duplicate execution snapshot.');
 for(const o of s.outcomes){if(!['conversion','retention','flows','households'].includes(o.kind)||!validDate(o.start)||!validDate(o.end)||!validDate(o.asOf)||o.start>o.end||o.end>o.asOf||!Number.isFinite(o.a)||!Number.isFinite(o.b)||o.a<0||o.b<0||o.a>1e12||o.b>1e12)fail('Invalid outcome window or amounts.');
  if(o.kind!=='flows'&&(!count(o.a)||!count(o.b)))fail('Household counts must be whole numbers.');
  if(['conversion','retention'].includes(o.kind)&&o.a>o.b)fail('Successful households cannot exceed eligible households.');
  if(o.kind==='conversion'&&daysBetween(o.end,o.asOf)<90)fail('Allow 90 days after the cohort end before reporting conversion.');
  if(o.kind==='retention'&&![365,366].includes(daysBetween(o.start,o.end)))fail('Retention needs a complete 12-month window (365 or 366 days).');
 }
 return s;
}
export function addEntry(s,input,now=today()){
 if(input.date>now)fail('Future-dated practice cannot earn credit.');
 const next=structuredClone(s),entry={...input,id:uid(),void:false};next.entries.push(entry);validateState(next);return next;
}
export function stats(s,seasonId,now=today()){
 const a=s.seasons.find(x=>x.id===seasonId);if(!a)fail('Season not found.');
 const active=s.entries.filter(e=>!e.void&&e.date<=now),season=active.filter(e=>e.seasonId===seasonId),xp=active.length*25;
 return {xp,level:1+Math.floor(xp/250),levelXP:xp%250,seasonXP:season.length*25,units:season.length,
  trees:TREES.map(t=>{const n=season.filter(e=>e.treeId===t.id).length;return {id:t.id,count:n,target:a.targets[t.id],progress:Math.min(100,100*n/a.targets[t.id]),xp:active.filter(e=>e.treeId===t.id).length*25};}),
  assessments:s.assessments.filter(a=>a.date<=now)};
}
export function rate(passed,eligible,target){if(!count(passed)||!count(eligible)||passed>eligible)fail('Invalid rate.');return {value:eligible?100*passed/eligible:null,gap:eligible?Math.max(0,Math.ceil(target*eligible/100)-passed):null};}
export function mergeBackup(current,incoming){
 validateState(current);validateState(incoming);const next=structuredClone(current);
 for(const key of ['seasons','entries','assessments','reliability','outcomes'])for(const v of incoming[key]){const old=next[key].find(x=>x.id===v.id);if(old&&json(old)!==json(v))fail('Backup conflicts with an existing '+key+' record. No records were replaced.');if(!old)next[key].push(structuredClone(v));}
 return validateState(next);
}
