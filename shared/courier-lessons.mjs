/* Stable lesson identity shared by original Courier and private Atlas Practice. */
const text=(v,max=500)=>typeof v==='string'?v.slice(0,max):'';
const list=v=>Array.isArray(v)?v:[];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function validDay(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
  const [y,m,d]=value.split('-').map(Number),date=new Date(Date.UTC(y,m-1,d));
  return y>=1900&&date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d;
}
export function courierLessonId(day,blockId,lesson,position){
  return 'lesson/'+JSON.stringify([day,text(blockId,80),text(lesson.track,80),text(lesson.sequence,120),Number.isSafeInteger(lesson.index)?lesson.index:position]);
}
export function lessonItems(manifest){
  const out=[],seen=new Set();
  for(const day of list(manifest?.days)){
    if(!object(day)||!validDay(day.date))continue;
    for(const block of list(day.blocks))for(const [position,lesson]of list(block?.lessons).entries()){
      if(!object(lesson)||!text(lesson.title)||!text(lesson.track))continue;
      const id=courierLessonId(day.date,block.id,lesson,position);
      if(seen.has(id))continue;seen.add(id);
      out.push({id,day:day.date,title:text(lesson.title),track:text(lesson.label||lesson.track,120),task:text(lesson.task,3000),drill:text(lesson.drill,3000)});
    }
  }
  return out.sort((a,b)=>b.day.localeCompare(a.day));
}
