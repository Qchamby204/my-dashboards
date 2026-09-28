/* Pure Library reading calculations. Dates are local calendar dates, not elapsed hours. */
(() => {
'use strict';
const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
const validPages=n=>Number.isInteger(n)&&n>0&&n<=100000;
const validProgress=(value,total)=>validPages(total)&&Number.isInteger(value)&&value>=0&&value<=total;
function dayNumber(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const [y,m,d]=value.split('-').map(Number);if(y<1900||y>9999)return null;
 const ms=Date.UTC(y,m-1,d),date=new Date(ms);
 return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?ms/86400000:null;
}
const empty=()=>({pageCounts:{},pagesRead:{},goals:{}});
function normalize(raw,catalog,validScope){
 const out=empty();if(raw===undefined)return out;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Invalid reading goals. Nothing has been replaced.');
 const ids=new Set(catalog.map(b=>b.id));
 for(const field of ['pageCounts','pagesRead','goals']){
  const values=raw[field]??{};
  if(!values||typeof values!=='object'||Array.isArray(values))throw Error('Invalid reading records. Nothing has been replaced.');
  for(const [key,value] of Object.entries(values)){
   if(field==='goals'){
    if(!validScope(key)||dayNumber(value)===null)throw Error('Invalid reading deadline. Nothing has been replaced.');
   }else{
    if(!ids.has(key))continue;
    if(field==='pageCounts'?value!==null&&!validPages(value):!Number.isInteger(value)||value<0||value>100000)throw Error('Invalid page count. Nothing has been replaced.');
   }
   out[field][key]=value;
  }
 }
 if(raw.daily!==undefined){
  if(!raw.daily||typeof raw.daily!=='object'||Array.isArray(raw.daily))throw Error('Invalid daily reading log. Nothing has been replaced.');
  out.daily={};
  for(const [date,entries] of Object.entries(raw.daily)){
   if(dayNumber(date)===null||!entries||typeof entries!=='object'||Array.isArray(entries))throw Error('Invalid daily reading log. Nothing has been replaced.');
   out.daily[date]={};
   for(const [id,pages] of Object.entries(entries)){
    if(!ids.has(id))continue;
    if(!Number.isInteger(pages)||pages<0||pages>100000)throw Error('Invalid daily page count. Nothing has been replaced.');
    out.daily[date][id]=pages;
   }
  }
 }
 return out;
}
// Credit only newly logged pages. Re-saving a page is idempotent; corrections
// reduce today's credit without rewriting previous days or inventing old history.
function logProgress(reading,id,value,today){
 if(dayNumber(today)===null||!Number.isInteger(value)||value<0||value>100000)throw Error('Invalid reading progress.');
 const previous=reading.pagesRead[id]||0;
 if(value!==previous){
  reading.daily??={};reading.daily[today]??={};
  reading.daily[today][id]=Math.max(0,Math.min(value,(reading.daily[today][id]||0)+value-previous));
 }
 reading.pagesRead[id]=value;
}
function pageInfo(book,reading,references,seedBooks){
 if(own(reading.pageCounts,book.id))return {pages:reading.pageCounts[book.id],confirmed:reading.pageCounts[book.id]!==null,reference:null};
 const original=seedBooks.find(b=>b.id===book.id),ref=references[book.id];
 // Never attach the old title's reference count to a renamed/replaced catalogue record.
 if(original&&book.title===original.title&&book.author===original.author&&ref&&validPages(ref.pages))return {pages:ref.pages,confirmed:false,reference:ref};
 return {pages:null,confirmed:false,reference:null};
}
function summary(books,progress,reading,references,seedBooks,deadline,today){
 let total=0,read=0,unknown=0,unknownRemaining=0,estimated=0,skipped=0,todayRead=0;
 for(const book of books){
  if(progress[book.id]?.status==='skipped'){skipped++;continue;}
  const info=pageInfo(book,reading,references,seedBooks),done=progress[book.id]?.status==='done';
  if(!info.pages){unknown++;if(!done)unknownRemaining++;continue;}
  total+=info.pages;if(!info.confirmed)estimated++;
  const bookRead=done?info.pages:Math.min(info.pages,reading.pagesRead[book.id]||0);
  read+=bookRead;todayRead+=Math.min(bookRead,reading.daily?.[today]?.[book.id]||0);
 }
 const remaining=total-read,start=dayNumber(today),end=dayNumber(deadline);
 const days=start!==null&&end!==null?end-start+1:null;
 const todayTarget=days!==null&&days>0?Math.ceil((remaining+todayRead)/days):null;
 return {total,read,remaining,unknown,unknownRemaining,estimated,days,skipped,included:books.length-skipped,
  todayRead,todayTarget,todayRemaining:todayTarget===null?null:Math.max(0,todayTarget-todayRead),
  overdue:days!==null&&days<=0&&(remaining>0||unknownRemaining>0),
  complete:books.length-skipped>0&&remaining===0&&unknownRemaining===0,
  daily:days!==null&&days>0?Math.ceil(remaining/days):null};
}
function normalizeOrder(raw,ids){
 if(raw===undefined)return [...ids];
 if(!Array.isArray(raw)||raw.length!==ids.length||new Set(raw).size!==ids.length||raw.some(id=>!ids.includes(id)))throw Error('Invalid section priorities. Nothing has been replaced.');
 return [...raw];
}
function movePriority(order,id,rank){
 if(!order.includes(id)||!Number.isInteger(rank)||rank<1||rank>order.length)throw Error('Choose a valid priority.');
 const next=order.filter(value=>value!==id);next.splice(rank-1,0,id);return next;
}
window.LibraryReading=Object.freeze({normalizeOrder,movePriority,validPages,validProgress,dayNumber,empty,normalize,logProgress,pageInfo,summary});
})();
