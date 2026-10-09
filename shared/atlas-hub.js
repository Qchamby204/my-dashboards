import {parseActivity,STORAGE_KEY} from './atlas-activity-core.mjs';
const cards=[...document.querySelectorAll('.hub-card')],catalog=new Map(cards.map(c=>[new URL(c.href).pathname.split('/').at(-1).replace('.html',''),c]));
catalog.set('library',catalog.get('the-library'));
function refresh(){
  const now=new Date(),hour=now.getHours(),greeting=hour<12?'Good morning':hour<18?'Good afternoon':'Good evening';
  document.getElementById('hub-greeting').textContent=greeting+', Quinton.';
  document.getElementById('hub-date').textContent=now.toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'});
  document.querySelector('.hub-roster').textContent=cards.length+' dashboards · 4 areas';
  const host=document.getElementById('hub-recents');host.replaceChildren();
  try{
    const events=parseActivity(localStorage.getItem(STORAGE_KEY)).events.filter(e=>['open','launch'].includes(e.type)&&Date.parse(e.at)<=Date.now()).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
    const seen=new Set(),selected=[];for(const e of events){const c=catalog.get(e.app);if(c&&!seen.has(c)){seen.add(c);selected.push(c);}if(selected.length===3)break;}
    if(!selected.length){host.hidden=true;return;}
    const title=document.createElement('h2');title.textContent='Recently opened';const row=document.createElement('div');row.className='hub-recent-row';
    for(const card of selected){const a=document.createElement('a');a.className='hub-recent';a.href=card.href;a.textContent=card.querySelector('h3').textContent;row.append(a);}host.append(title,row);host.hidden=false;
  }catch{host.hidden=true;}
}
refresh();window.addEventListener('focus',refresh);window.addEventListener('storage',e=>{if(e.key===STORAGE_KEY||e.key===null)refresh();});document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});setInterval(refresh,60000);
