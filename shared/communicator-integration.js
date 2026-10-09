/* One learning and practice surface. Uses the existing mc_* and crucible:* records. */
(()=>{
  'use strict';
  function start(){
    const curriculum=window.CrucibleCurriculum,practice=window.CommunicationImprovements;
    if(!curriculum||!practice||window.CommunicatorLearning)return;
    const oldLearn=pageLearn,oldDash=pageDash,oldTrain=pageTrain,oldProgress=pageProgress,oldRender=render,oldDrill=drillView,oldDump=Store.dump;
    let track=curDrill?.topic.crucibleSource?'investing':'communication',reference='blocks',progressView='review';
    const references=[['blocks','Learning blocks'],['statements','Statement mastery'],['arsenal','Evidence & debate'],['workflow','Analysis workflow'],['method','Method'],['arc','Learning roadmap'],['today','Daily routine'],['cadence','Longer exercises']];
    const help=(label,text)=>'<details class="atlas-info"><summary aria-label="'+esc(label)+'"><span aria-hidden="true">i</span></summary><div class="atlas-info-body">'+esc(text)+'</div></details>';
    const button=(label,action,value='',cls='ghost')=>'<button type="button" class="btn '+cls+'" data-learning-action="'+action+'" data-learning-value="'+esc(value)+'">'+label+'</button>';
    function status(){return curriculum.problem?'<p role="alert">'+esc(curriculum.problem)+'</p>':curriculum.pending?'<p role="alert">Investing changes are still in this page and have not saved on this device.</p>'+button('Retry saving investing progress','retry')+button('Export all progress','export'):'';}
    function source(kind,id){
      if(kind==='block'){const b=curriculum.BLOCKS.find(b=>b.id===id);if(b)return {kind,id:b.id,title:b.name,text:[b.what,b.why,'What it unlocks: '+b.unlock,...b.ask].join('\n\n')};}
      if(kind==='statement'){const s=curriculum.STATEMENTS.find(s=>String(s.n)===String(id));if(s)return {kind,id:String(s.n),title:s.name,text:['Checkpoint: '+s.test,...s.items].join('\n\n')};}
      if(kind==='arsenal'){const a=curriculum.ARSENAL[Number(id)];if(a)return {kind,id:String(id),title:a.claim,text:'Opposing case: '+a.steel+'\n\nResponse to examine: '+a.reply+'\n\nEvidence in the curriculum (verify before use): '+a.data};}
      if(kind==='daily'){const b=curriculum.bench();return {kind,id:curriculum.day(),title:b?.title||'Your latest learning',text:(b?b.items.map(i=>i[1]).join('\n\n'):'Choose one idea you learned this week.')+'\n\nMy learning note:\n'+curriculum.note()};}
      if(kind==='note'&&curriculum.note().trim())return {kind,id:curriculum.day(),title:'My learning note · '+curriculum.day(),text:curriculum.note()};
      return null;
    }
    function begin(kind,id){
      const context=source(kind,id);if(!context){toast('Choose a learning source first','Save a learning note or open a block.');return;}
      try{practice.startPreparedPractice({drillId:kind==='arsenal'?'crucible-defend':kind==='statement'?'crucible-statement':'crucible-explain',topic:context.title,source:context});}catch(error){toast('This source could not start a practice',error.message);}
    }
    function open(view='blocks',target){
      track='investing';reference=references.some(([id])=>id===view)?view:'blocks';nav('learn');
      if(target){const el=document.getElementById(target);if(el){el.open=true;el.scrollIntoView({block:'start'});el.querySelector('summary')?.focus({preventScroll:true});}}
    }
    function todayCard(){
      const block=curriculum.nextBlock(),stats=curriculum.stats();
      return '<section class="card communicator-session"><div class="communication-topic-heading"><h2>Today’s investing idea</h2>'+help('About learning and practice','Read the block when you need context, or go straight to a 90-second explanation. Source material and talking points stay together in Learn & prepare. After your rep, review and save. Speaking practice earns communication XP; investing mastery requires the actual exercise.')+'</div>'+status()+
        '<h3>'+esc(block.name)+'</h3><p class="muted">'+esc(block.what)+'</p><div class="communicator-session-actions">'+button('Learn this idea','block',block.id)+button('Practise · 90 seconds','block-rep',block.id,'')+'</div><div class="communicator-session-footer"><span>'+stats.blocks+'/'+stats.total+' investing blocks · '+stats.mastery+'/100 statement mastery</span><details><summary>More investing work</summary><div class="flex">'+button('Analyst routine','reference','today')+button('Investing progress','progress')+'</div></details></div></section>';

    }
    function investingView(){
      return '<section class="card"><label for="communicator-reference">Investing reference</label><select id="communicator-reference">'+references.map(([id,title])=>'<option value="'+id+'"'+(id===reference?' selected':'')+'>'+title+'</option>').join('')+'</select>'+status()+'</section><div class="communicator-analysis" id="communicator-analysis">'+curriculum.view(reference)+'</div>';
    }
    pageLearn=()=>'<section class="card communicator-learning-header"><div class="communication-topic-heading"><h2>Learn</h2>'+button('Communication assessment','assessment')+'</div><div class="communicator-segments" aria-label="Learning subject">'+button('Communication','track','communication',track==='communication'?'':'ghost')+button('Investing','track','investing',track==='investing'?'':'ghost')+'</div></section>'+(track==='investing'?investingView():oldLearn());
    pageDash=()=>{const html=oldDash(),resume=html.match(/^<section class="card communication-resume">[\s\S]*?<\/section>/)?.[0]||'';return resume+todayCard()+html.slice(resume.length);};
    pageTrain=()=>curDrill?oldTrain():oldTrain()+'<section class="card"><h2>Practise your investing knowledge</h2>'+button('Explain my next block · 90 seconds','block-rep',curriculum.nextBlock().id,'')+'<details class="communicator-practice-more"><summary>Other investing exercises</summary><div class="communicator-practice-options">'+button('Evidence & debate','reference','arsenal')+button('Explain my filing checkpoint','statement-rep',String(curriculum.nextStatement().n))+button('Explain my saved learning note','note-rep')+'</div></details></section>';

    function investingProgress(){
      const stats=curriculum.stats();
      return '<details class="card communicator-investing-progress"><summary>Investing progress · '+stats.blocks+'/'+stats.total+' blocks · '+stats.mastery+'/100 mastery</summary>'+status()+'<p>'+stats.notes+' saved learning notes</p><label for="communicator-progress-view">Review investing work</label><select id="communicator-progress-view"><option value="review"'+(progressView==='review'?' selected':'')+'>Weekly review</option><option value="archive"'+(progressView==='archive'?' selected':'')+'>Learning archive</option></select><div class="communicator-analysis">'+curriculum.view(progressView)+'</div></details>';
    }
    pageProgress=()=>investingProgress()+oldProgress();
    Store.dump=()=>({...oldDump(),crucible:curriculum.snapshot()});
    drillView=function(){
      let html=oldDrill();const context=curDrill?.topic.crucibleSource;if(!context)return html;
      const ref=context.kind==='arsenal'?'arsenal':context.kind==='statement'?'statements':context.kind==='daily'||context.kind==='note'?'today':'blocks';
      html=html.replace('<div class="muted">Topic feed: Investing curriculum</div>','<div class="communicator-source-return">'+button('Back to learning','return-source',ref+'|'+context.id)+'</div>');
      // Curriculum reps retain their explicit source rather than offering random topics.
      html=html.replace(/<button[^>]*onclick="launchDrill\(curDrill.drill\)"[^>]*>New topic<\/button>/,'').replace(/<button[^>]*onclick="retireCurrent\(\)"[^>]*>[\s\S]*?Not interested<\/button>/,'');
      return html;
    };
    const oldImport=importData;
    importData=async function(input){
      const file=input.files?.[0];if(!file)return;
      try{
        if(file.size>10*1024*1024)throw Error('This file is too large to import.');
        const raw=JSON.parse(await file.text());if(raw?.tool!=='crucible')return await oldImport(input);
        const payload=curriculum.validate(raw);
        uiConfirm('Import investing progress?','This replaces investing notes, checks and mastery. Communication history and unfinished practice stay as they are.','Import investing progress',()=>{curriculum.replace(payload);render();toast(curriculum.pending?'Investing import not fully saved':'Investing progress imported',curriculum.pending?'Export progress before closing.':'Communication practice kept.');});
      }catch(error){uiNote(error.message||'Could not read this backup.');}finally{input.value='';}
    };
    function decorate(){
      for(const host of document.querySelectorAll('.communicator-analysis')){
        for(const lede of host.querySelectorAll('.lede')){const d=document.createElement('details');d.className='atlas-info';d.innerHTML='<summary aria-label="About this section"><span aria-hidden="true">i</span></summary><div class="atlas-info-body"></div>';lede.before(d);d.lastElementChild.append(lede);}
        for(const block of curriculum.BLOCKS){const body=host.querySelector('#block_'+block.id+' > .body');if(body)body.insertAdjacentHTML('beforeend',button('Practise explaining this · 90 seconds','block-rep',block.id,''));}
        [...host.querySelectorAll('details.level > .body')].forEach((body,i)=>{body.parentElement.id='statement-'+curriculum.STATEMENTS[i].n;body.insertAdjacentHTML('beforeend',button('Practise explaining this filing · 2 minutes','statement-rep',String(curriculum.STATEMENTS[i].n),''));});
        if(reference==='arsenal'&&curPage==='learn'){
          [...host.querySelectorAll('.panel')].filter(p=>p.querySelector('.blockhead')).forEach((panel,i)=>{panel.id='claim-'+i;panel.querySelector('.card')?.insertAdjacentHTML('afterend',button('Practise this response · 90 seconds','arsenal-rep',String(i),''));});
        }
        const note=host.querySelector('#ledger');if(note){note.setAttribute('aria-label','Today’s investing learning note');note.insertAdjacentHTML('afterend',button('Practise explaining my note','note-rep'));}
        for(const table of host.querySelectorAll('.tablewrap')){table.tabIndex=0;table.setAttribute('role','region');table.setAttribute('aria-label','Scrollable investing reference table');}
        for(const label of host.querySelectorAll('.lbl'))if(label.textContent.includes('Claude'))label.textContent=label.textContent.replace('Claude','your assistant');
      }
      document.querySelectorAll('[data-learning-action="track"]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.learningValue===track)));
    }
    render=function(){oldRender();document.querySelectorAll('.season').forEach(n=>n.hidden=true);decorate();};
    function rerenderKeep(){
      const y=window.scrollY,openIds=[...document.querySelectorAll('.communicator-analysis details[open],.communicator-investing-progress[open]')].map(d=>d.id||d.querySelector('summary')?.textContent||d.className),focused=document.activeElement?.getAttribute('data-key');
      render();for(const d of document.querySelectorAll('.communicator-analysis details,.communicator-investing-progress'))if(openIds.includes(d.id||d.querySelector('summary')?.textContent||d.className))d.open=true;
      if(focused)for(const cb of document.querySelectorAll('[data-key]'))if(cb.dataset.key===focused)cb.focus({preventScroll:true});window.scrollTo(0,y);
    }
    document.addEventListener('click',event=>{
      const action=event.target.closest?.('[data-learning-action]');
      if(action){const value=action.dataset.learningValue;switch(action.dataset.learningAction){
        case 'return-source':{const [ref,id]=value.split('|');open(ref,ref==='blocks'?'block_'+id:ref==='statements'?'statement-'+id:ref==='arsenal'?'claim-'+id:undefined);break;}
        case 'track':track=value;nav('learn');break;case 'reference':open(value);break;case 'block':open('blocks','block_'+value);break;
        case 'block-rep':begin('block',value);break;case 'statement-rep':begin('statement',value);break;case 'arsenal-rep':begin('arsenal',value);break;case 'note-rep':begin('note');break;
        case 'progress':nav('progress');break;case 'assessment':nav('assess');break;case 'export':exportData();break;case 'retry':curriculum.retry();rerenderKeep();break;
      }return;}
      const go=event.target.closest?.('.communicator-analysis [data-go]');if(go){open(go.dataset.go);if(go.dataset.openBlocks)for(const id of go.dataset.openBlocks.split(',')){const block=document.getElementById('block_'+id);if(block)block.open=true;}const target=document.getElementById(go.dataset.target||'block_'+go.dataset.openBlocks?.split(',')[0]);target?.scrollIntoView({block:'start'});return;}
      const week=event.target.closest?.('.communicator-analysis [data-review-week]');if(week){curriculum.week(week.dataset.reviewWeek);rerenderKeep();}
    });
    document.addEventListener('change',event=>{
      if(event.target.id==='communicator-reference'){reference=event.target.value;render();return;}
      if(event.target.id==='communicator-progress-view'){progressView=event.target.value;rerenderKeep();return;}
      const cb=event.target.closest?.('.communicator-analysis input[data-key]');if(cb){const saved=curriculum.change('checks',cb.dataset.key,cb.checked);rerenderKeep();if(saved&&cb.checked){const current=[...document.querySelectorAll('.communicator-analysis input[data-key]')].find(n=>n.dataset.key===cb.dataset.key);window.AtlasExperience?.complete(current?.closest('label')||current?.parentElement);}if(!saved)toast('Investing change not saved','Export your progress or retry saving before closing.');}
    });
    document.addEventListener('input',event=>{
      if(event.target.id==='ledger'&&event.target.closest('.communicator-analysis')){const saved=curriculum.change('notes',curriculum.day(),event.target.value);if(!saved)toast('Learning note not saved','Your text is kept in this page. Export or retry before closing.');}
      if(event.target.id==='archive-search'&&event.target.closest('.communicator-analysis')){const result=curriculum.search(event.target.value);document.getElementById('archive-results').innerHTML=result.html;document.getElementById('archive-count').textContent=result.count+' saved days or entries';}
    });
    function route(){const match=location.hash.match(/^#investing(?:-([a-z]+))?$/);if(!match)return;
      const saved=curriculum.snapshot().state,aim={evaluate:'blocks',statements:'statements',process:'workflow'}[saved.goal];
      const existing=Object.values(saved.checks).some(Boolean)||Object.values(saved.notes).some(v=>v.trim());
      track='investing';reference=references.some(([id])=>id===match[1])?match[1]:(aim|| (existing?'blocks':'today'));nav('learn');
    }
    window.addEventListener('hashchange',route);
    window.CommunicatorLearning=Object.freeze({source,begin,open,curriculum});route();render();
  }
  window.addEventListener('communicator-ready',start);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
