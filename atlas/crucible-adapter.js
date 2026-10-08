// Runs inside the compiled curriculum closure. Existing keys remain authoritative.
const copy=value=>JSON.parse(JSON.stringify(value));
let recordProblem='',pending=false;
function validate(payload){
  const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
  if(!object(payload)||payload.tool!=='crucible'||![1,2].includes(payload.schemaVersion)||!object(payload.state)||!object(payload.state.checks)||!object(payload.state.notes)||Object.values(payload.state.checks).some(v=>typeof v!=='boolean')||Object.values(payload.state.notes).some(v=>typeof v!=='string'))throw Error('Use a valid Crucible progress backup.');
  const next=copy(payload);if(next.schemaVersion===1){if(next.state.tab==='canon')next.state.tab='blocks';if(next.state.tab==='terminal')next.state.tab='workflow';}next.schemaVersion=2;
  return next;
}
function readRecords(){
  try{
    const raw=localStorage.getItem('crucible:state');
    if(raw!==null)state=validate({tool:'crucible',schemaVersion:Number(localStorage.getItem('crucible:schema-version')||1),state:JSON.parse(raw)}).state;
  }catch{recordProblem='Your investing records could not be read. Export a recovery backup before replacing them.';}
}
readRecords();
function snapshot(){
  const out={tool:'crucible',schemaVersion:2,state:copy(state)};
  if(recordProblem)try{out.unreadableState=localStorage.getItem('crucible:state');out.unreadableVersion=localStorage.getItem('crucible:schema-version');}catch{}
  return out;
}
function write(next){
  try{const raw=JSON.stringify(next);localStorage.setItem('crucible:state',raw);if(localStorage.getItem('crucible:state')!==raw)throw Error();localStorage.setItem('crucible:schema-version','2');pending=false;return true;}
  catch{pending=true;return false;}
}
function change(kind,key,value){
  if(recordProblem)return false;
  if(!['checks','notes'].includes(kind)||typeof key!=='string'||kind==='checks'&&typeof value!=='boolean'||kind==='notes'&&typeof value!=='string')return false;
  // Merge the latest persisted records before editing one field in a stale tab.
  if(!pending)readRecords();if(recordProblem)return false;
  const next=copy(state);if(kind==='checks'?!value:!value.trim())delete next[kind][key];else next[kind][key]=value;
  state=next;return write(next);
}
function replace(payload){const next=validate(payload);state=next.state;recordProblem='';return write(state);}
window.CrucibleCurriculum=Object.freeze({
  BLOCKS,STATEMENTS,ARSENAL,BENCH,TAPE,LEDGER,
  view:id=>(VIEWS_FOR_COMMUNICATOR[id]||viewBlocks)(),
  snapshot,validate,replace,change,retry:()=>write(state),
  get problem(){return recordProblem;},get pending(){return pending;},
  stats:()=>({blocks:blocksDone(),total:BLOCKS.length,mastery:statementScore(),notes:historyEntries().filter(e=>e.note.trim()).length}),
  nextBlock:()=>BLOCKS.find(b=>!state.checks['blocks::'+b.id])||BLOCKS[0],
  nextStatement:()=>STATEMENTS.find(l=>!state.checks['stmt::l'+l.n+'_test'])||STATEMENTS[0],
  day:()=>dateKey(new Date()),bench:()=>benchFor(new Date()),
  note:()=>state.notes[dateKey(new Date())]||'',
  search(query){archiveQuery=query;return {html:archiveResults(),count:historyEntries(query).length};},
  week(value){reviewMonday=value==='today'?mondayOf(new Date()):shiftDay(reviewMonday,Number(value)*7);}
});
const VIEWS_FOR_COMMUNICATOR={today:viewToday,cadence:viewCadence,arc:viewArc,review:viewReview,archive:viewArchive,blocks:viewBlocks,statements:viewStatements,workflow:viewWorkflow,method:viewMethod,arsenal:viewArsenal};
