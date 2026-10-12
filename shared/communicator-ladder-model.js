/* Progress is derived from verified mc_reps; no second XP or streak ledger. */
(function(root){
 'use strict';
 const challenges=[
  {id:'clear-point',title:'Make one clear point',skill:'clarity',time:60,prompt:'Explain what a financial plan helps someone decide, without naming a product.',focus:'One point → one example → why it matters.',rubric:['The main point came first','One concrete example made it clear','Ended with why it matters'],steps:['Speak to someone who has never worked in finance.','Give one main point, one concrete example, and one practical implication.','Keep it within 60 seconds; leave out the extra detail.']},
  {id:'make-it-land',title:'Make the idea land',skill:'story',time:75,prompt:'Explain why preparing for an important meeting is worth the effort.',focus:'A short situation → a complication → a useful outcome.',rubric:['Used a specific situation rather than general claims','The complication made the point meaningful','The ending gave the listener something useful'],steps:['Use a fictional situation, not confidential information.','Show what someone wanted, what got in the way, and what preparation changed.','Finish with one takeaway the listener can use.']},
  {id:'listen-first',title:'Listen before responding',skill:'listen',time:60,prompt:'A colleague says: “Every new process adds more work. I need fewer steps, not another system.”',focus:'Reflect their concern → check understanding → ask one question.',rubric:['Represented the concern fairly','Checked understanding before giving advice','Asked one useful open question'],steps:['First summarise the concern in words the colleague would recognise.','Check whether you understood them correctly.','Ask one open question. Resist launching into your solution.']},
  {id:'handle-objection',title:'Handle an objection',skill:'sales',time:90,prompt:'A prospective client says: “I already have an advisor. Why would I talk to you?”',focus:'Acknowledge → explore → answer briefly → invite a response.',rubric:['Acknowledged their position without defensiveness','Asked before assuming what they need','Gave a concise response without promises or pressure'],steps:['Use this as a fictional rehearsal.','Acknowledge their position and ask a useful question about what they value.','Give a brief response without criticising their advisor or promising outcomes.','Invite their response, then stop talking.']},
  {id:'stay-composed',title:'Recover from an interruption',skill:'adapt',time:90,prompt:'Recommend shortening a weekly team meeting while keeping it useful.',focus:'Keep your thread when someone challenges the tradeoff.',rubric:['Acknowledged and answered the interruption','Returned to the original point without restarting','Finished with a clear next step'],steps:['State your recommendation and one reason.','Around halfway through, reveal the interruption below and answer it out loud.','Return to your point and finish with one next step.'],interruption:'“What would we lose by shortening it?”'}
 ];
 // Resolve original skill names at registration; these IDs are the trainer's IDs.
 const get=id=>challenges.find(c=>c.id===id);
 function validate(value){if(value===undefined)return;if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||!get(value.id)||typeof value.performed!=='boolean'||typeof value.revealed!=='boolean')throw Error('Invalid skill-ladder attempt.');}
 function drill(id){const c=get(id);if(!c)throw Error('Unknown challenge.');return {id:'ladder-'+c.id,name:'Skill ladder · '+c.title,skill:c.skill,time:c.time,cats:['custom'],ladder:true,steps:t=>['Your challenge: <b>'+t+'</b>',...c.steps],rubric:c.rubric.slice()};}
 function snapshot(reps,today){
  const unique=new Set(),candidates=[],rows=[];
  for(const r of reps||[]){try{validate(r.challenge);}catch{continue;}
   const stamp=new Date(r.date),day=stamp.getFullYear()+'-'+String(stamp.getMonth()+1).padStart(2,'0')+'-'+String(stamp.getDate()).padStart(2,'0');
   if(!r.challenge||!r.id||unique.has(r.id)||!Number.isFinite(Date.parse(r.date))||day>today)continue;
   const c=get(r.challenge.id),d=drill(c.id),scores=r.rubricScores;
   if(r.drill!==d.name||r.topic!==c.prompt||r.scoreOrigin!=='self'||r.rubricVersion!==1||!Array.isArray(scores)||scores.length!==c.rubric.length||scores.some(n=>!Number.isInteger(n)||n<1||n>5)||r.score!==Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*20))continue;
   unique.add(r.id);candidates.push(r);
  }
  candidates.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));
  const earned=new Set();for(const r of candidates){const index=challenges.findIndex(c=>c.id===r.challenge.id),c=challenges[index];if(challenges.slice(0,index).some(c=>!earned.has(c.id)))continue;rows.push(r);if(r.challenge.performed&&(!c.interruption||r.challenge.revealed)&&r.rubricScores.every(n=>n>=4))earned.add(c.id);}
  let preceding=true;
  const stages=challenges.map(c=>{const attempts=rows.filter(r=>r.challenge.id===c.id),passed=attempts.some(r=>r.challenge.performed&&(!c.interruption||r.challenge.revealed)&&r.rubricScores.every(n=>n>=4)),unlocked=preceding;preceding=preceding&&passed;return {...c,unlocked,passed,best:attempts.length?Math.max(...attempts.map(r=>r.score)):null,latest:attempts.at(-1)||null,attempts:attempts.length};});
  const completed=stages.filter(s=>s.passed&&s.unlocked).length,next=stages.find(s=>s.unlocked&&!s.passed)||stages.slice().sort((a,b)=>(a.best??0)-(b.best??0))[0];
  return {stages,completed,total:stages.length,next,attempts:rows.length};
 }
 root.CommunicatorLadderModel={challenges,get,drill,validate,snapshot};
})(typeof window==='undefined'?globalThis:window);
