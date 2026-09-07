/* Shared validation for the private editor, backup review, and API. */
export function validateHeraldRecords(raw){
  const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
  const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
  if(!object(raw)||!Array.isArray(raw.videos)||raw.videos.length>1000||!object(raw.cadence)||!Array.isArray(raw.leads))throw Error('Choose a complete Herald backup.');
  if(raw.leads.length)throw Error('This transfer includes legacy contact records. Use Connect existing apps to bring only content and publishing details.');
  const json=JSON.stringify(raw);
  if(new TextEncoder().encode(json).length>1500000)throw Error('Choose a Herald backup smaller than 1.5 MB.');
  const walk=(x,depth=0)=>{if(depth>30)throw Error('This backup is too deeply nested.');if(object(x)||Array.isArray(x))for(const [k,v] of Object.entries(x)){if(['__proto__','constructor','prototype'].includes(k))throw Error('This backup contains an unsupported field.');walk(v,depth+1);}};walk(raw);
  const next=JSON.parse(json),ids=new Set();
  for(const v of next.videos){
    if(!object(v)||typeof v.id!=='string'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(v.id))throw Error('A Herald record ID is invalid.');
    if(ids.has(v.id))throw Error('The Herald has duplicate video IDs.');ids.add(v.id);
    if(v.parentId!=null&&v.parentId!==''&&(typeof v.parentId!=='string'||!/^[a-zA-Z0-9:_-]{1,200}$/.test(v.parentId)))throw Error('A Herald parent ID is invalid.');
    if(typeof v.title!=='string'||!v.title.trim()||v.title.length>500)throw Error('Give each idea a title of 500 characters or fewer.');
    if(!['draft','optimized','approved','produced','scheduled','published'].includes(v.status)||!['long','short'].includes(v.fmt))throw Error('A Herald stage or format is invalid.');
    for(const key of ['sched','publishedDay'])if(v[key]!=null&&v[key]!==''&&!date(v[key]))throw Error('A Herald '+(key==='sched'?'planned':'publication')+' date is invalid.');
    for(const key of ['script','kw','vert'])if(v[key]!=null&&typeof v[key]!=='string')throw Error('A Herald '+key+' must be text.');
    if(v.vert?.length>120)throw Error('Keep the audience to 120 characters or fewer.');
    for(const key of ['opt','pub','metrics'])if(v[key]!==undefined&&!object(v[key]))throw Error('A Herald '+key+' record is invalid.');
    for(const item of Object.values(v.opt||{}))if(!object(item)||(item.t!==undefined&&typeof item.t!=='string')||(item.d!==undefined&&typeof item.d!=='boolean'))throw Error('A Herald checklist is invalid.');
    v.script??='';v.vert??='';v.kw??='';v.opt??={};v.pub??={};v.metrics??={};
    if(v.status==='optimized')v.status='approved';
    for(const k of ['title','desc','thumb','broll','emph','tags','blog','cta'])v.opt[k]={t:'',d:false,...v.opt[k]};
  }
  for(const key of ['weeks','sys','goals'])if(next[key]!==undefined&&!object(next[key]))throw Error('A Herald settings record is invalid.');
  for(const key of ['capture','roadmap'])if(next[key]!==undefined&&!Array.isArray(next[key]))throw Error('A Herald idea list is invalid.');
  return {weeks:{},capture:[],roadmap:[],sys:{once:{},w:{},m:{}},goals:{},...next};
}
