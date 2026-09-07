import { html, css, js, theme, model } from './assets.mjs';
import { validDate, monday, textValue, dateValue, appValue, minutesValue } from './model.mjs';

const headers = { 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'same-origin' };
function json(data,status=200) { return new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}}); }
class HttpError extends Error { constructor(message,status=400){super(message);this.status=status;} }
async function bodyOf(request) {
  if(!request.headers.get('content-type')?.startsWith('application/json')) throw new HttpError('Send JSON.');
  const body=await request.text(); if(body.length>350000) throw new HttpError('This request is too large.',413);
  try { const value=JSON.parse(body); if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error(); return value; }
  catch { throw new HttpError('This request could not be read.'); }
}
async function ownedProject(db,owner,id) {
  if(!id) return null;
  const row=await db.prepare('SELECT id FROM atlas_projects WHERE id=? AND owner=?').bind(id,owner).first();
  if(!row) throw new HttpError('That project is unavailable.',404); return row.id;
}
async function state(db,owner,week) {
  const result=await db.batch([
    db.prepare("SELECT * FROM atlas_tasks WHERE owner=? ORDER BY created_at DESC").bind(owner),
    db.prepare('SELECT * FROM atlas_projects WHERE owner=? ORDER BY title').bind(owner),
    db.prepare('SELECT * FROM atlas_weeks WHERE owner=? AND week_start=?').bind(owner,week)
  ]);
  return { tasks:result[0].results, projects:result[1].results, week:result[2].results[0]||null };
}
async function api(request,env,url,owner) {
  const db=env.DB;
  if(!db) throw new HttpError('Your saved workspace is temporarily unavailable. Please try again.',503);
  const path=url.pathname, now=new Date().toISOString();
  if(path==='/api/state' && request.method==='GET') {
    const week=url.searchParams.get('week'); if(!validDate(week) || monday(week)!==week) throw new HttpError('Choose a valid week.');
    return json(await state(db,owner,week));
  }
  if(path==='/api/tasks' && request.method==='POST') {
    const b=await bodyOf(request), id=textValue(b.id,80,true), title=textValue(b.title,300,true), app=appValue(b.app_id);
    const project=await ownedProject(db,owner,b.project_id), week=dateValue(b.week_start), due=dateValue(b.due_date), minutes=minutesValue(b.minutes);
    if(week && monday(week)!==week) throw new HttpError('Choose a Monday for the week.');
    // A caller-generated ID makes a repeated save after a network failure safe.
    const existing=await db.prepare('SELECT * FROM atlas_tasks WHERE id=? AND owner=?').bind(id,owner).first();
    if(existing) {
      if(existing.title!==title || existing.app_id!==app || existing.project_id!==project || existing.week_start!==week || existing.due_date!==due || existing.minutes!==minutes)
        throw new HttpError('This commitment was already saved with different details. Close Capture and refresh to edit it.',409);
      return json({id},200);
    }
    await db.prepare('INSERT INTO atlas_tasks (id,owner,title,app_id,project_id,week_start,due_date,minutes,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(id,owner,title,app,project,week,due,minutes,now,now).run();
    return json({id},201);
  }
  if(path.startsWith('/api/tasks/') && request.method==='PATCH') {
    const id=path.slice('/api/tasks/'.length), b=await bodyOf(request);
    const task=await db.prepare('SELECT * FROM atlas_tasks WHERE id=? AND owner=?').bind(id,owner).first();
    if(!task) throw new HttpError('That commitment is unavailable.',404);
    if(!Number.isInteger(b.revision) || b.revision!==task.revision) throw new HttpError('This commitment changed on another device. Refresh and try again.',409);
    let {title,app_id,project_id,week_start,due_date,minutes,status,completed_at,focus_date,focus_slot}=task;
    if(b.action==='edit') {
      title=textValue(b.title,300,true); app_id=appValue(b.app_id); project_id=await ownedProject(db,owner,b.project_id);
      week_start=dateValue(b.week_start); due_date=dateValue(b.due_date); minutes=minutesValue(b.minutes);
      if(week_start && monday(week_start)!==week_start) throw new HttpError('Choose a valid week.');
    } else if(b.action==='complete') { status='done'; completed_at=now; focus_date=null; focus_slot=null; }
    else if(b.action==='reopen') {status='open';completed_at=null;focus_date=null;focus_slot=null;}
    else if(b.action==='archive') {status='archived';focus_date=null;focus_slot=null;}
    else if(b.action==='plan') {week_start=dateValue(b.week_start);if(week_start && monday(week_start)!==week_start) throw new HttpError('Choose a valid week.');}
    else if(b.action==='focus') {
      if(status!=='open') throw new HttpError('Reopen this commitment before choosing it for today.');
      const day=dateValue(b.day); if(!day) throw new HttpError('Choose a day.');
      if(focus_date===day) {focus_date=null;focus_slot=null;}
      else {
        const occupied=await db.prepare('SELECT focus_slot FROM atlas_tasks WHERE owner=? AND focus_date=? AND id<>?').bind(owner,day,id).all();
        focus_slot=[1,2,3].find(slot=>!occupied.results.some(t=>t.focus_slot===slot));
        if(!focus_slot) throw new HttpError('Your three priorities are set. Release one before adding another.',409);
        focus_date=day; week_start=monday(day);
      }
    } else throw new HttpError('Unknown action.');
    try {
      const result=await db.prepare('UPDATE atlas_tasks SET title=?,app_id=?,project_id=?,week_start=?,due_date=?,minutes=?,status=?,completed_at=?,focus_date=?,focus_slot=?,revision=revision+1,updated_at=? WHERE id=? AND owner=? AND revision=?')
        .bind(title,app_id,project_id,week_start,due_date,minutes,status,completed_at,focus_date,focus_slot,now,id,owner,b.revision).run();
      if(!result.meta.changes) throw new HttpError('This commitment changed on another device. Refresh and try again.',409);
    } catch(error) {
      if(String(error.message).includes('UNIQUE')) throw new HttpError('Your priorities changed on another device. Refresh and try again.',409);
      throw error;
    }
    return json({id});
  }
  if(path==='/api/import' && request.method==='POST') {
    const b=await bodyOf(request);
    if(!Array.isArray(b.projects) || !b.projects.length || b.projects.length>1000) throw new HttpError('Choose between 1 and 1,000 projects.');
    const seen=new Set(), entries=b.projects.map(p=>{
      const source=textValue(p.source_id,200,true); if(seen.has(source)) throw new HttpError('Duplicate project IDs.');seen.add(source);
      const title=textValue(p.title,300,true),area=textValue(p.area,120),due=dateValue(p.due_date);
      if(!['open','done'].includes(p.status)) throw new HttpError('Unknown project status.');
      return db.prepare('INSERT INTO atlas_projects (id,owner,source_id,title,area,status,due_date,imported_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(owner,source_id) DO UPDATE SET title=excluded.title,area=excluded.area,status=excluded.status,due_date=excluded.due_date,imported_at=excluded.imported_at')
        .bind(crypto.randomUUID(),owner,source,title,area,p.status,due,now);
    });
    await db.batch(entries); return json({count:entries.length});
  }
  if(path==='/api/week' && request.method==='PUT') {
    const b=await bodyOf(request),week=dateValue(b.week_start);
    if(!week || monday(week)!==week) throw new HttpError('Choose a valid week.');
    if(!Number.isInteger(b.capacity) || b.capacity<0 || b.capacity>10080) throw new HttpError('Use a weekly time budget between 0 and 168 hours.');
    const worked=textValue(b.worked,4000),change=textValue(b.change,4000);
    const existing=await db.prepare('SELECT revision FROM atlas_weeks WHERE owner=? AND week_start=?').bind(owner,week).first();
    if((existing?.revision||0)!==b.revision) throw new HttpError('This review changed on another device. Refresh and try again.',409);
    if(existing) {
      const r=await db.prepare('UPDATE atlas_weeks SET capacity=?,worked=?,change=?,updated_at=?,revision=revision+1 WHERE owner=? AND week_start=? AND revision=?').bind(b.capacity,worked,change,now,owner,week,b.revision).run();
      if(!r.meta.changes) throw new HttpError('This review changed. Refresh and try again.',409);
    } else {
      try { await db.prepare('INSERT INTO atlas_weeks (id,owner,week_start,capacity,worked,change,updated_at) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),owner,week,b.capacity,worked,change,now).run(); }
      catch(error){if(String(error.message).includes('UNIQUE')) throw new HttpError('This review changed. Refresh and try again.',409);throw error;}
    }
    return json({saved:true});
  }
  if(path==='/api/export' && request.method==='GET') {
    const values=await db.batch(['atlas_tasks','atlas_projects','atlas_weeks'].map(table=>db.prepare(`SELECT * FROM ${table} WHERE owner=?`).bind(owner)));
    const clean=values.map(v=>v.results.map(({owner,...rest})=>rest));
    return json({app:'atlas-os',version:1,exportedAt:now,tasks:clean[0],projects:clean[1],weeks:clean[2]});
  }
  throw new HttpError('This page was not found.',404);
}
export default {
  async fetch(request,env) {
    const url=new URL(request.url);
    const user=request.headers.get('oai-authenticated-user-id');
    // This Worker is deployed only behind the Sites dispatcher, which provides identity.
    if(!user) return url.pathname.startsWith('/api/') ? json({error:'Sign in to open your workspace.'},401) : new Response(null,{status:302,headers:{Location:'/signin-with-chatgpt?return_to=%2F',...headers}});
    if(!['GET','HEAD'].includes(request.method)) {
      const origin=request.headers.get('origin');
      if(!origin || origin!==url.origin) return json({error:'This request is not allowed.'},403);
    }
    try {
      if(url.pathname.startsWith('/api/')) return await api(request,env,url,user);
      const assets={'/':[html,'text/html; charset=utf-8'],'/style.css':[css,'text/css; charset=utf-8'],'/app.js':[js,'text/javascript; charset=utf-8'],'/theme.js':[theme,'text/javascript; charset=utf-8'],'/model.mjs':[model,'text/javascript; charset=utf-8']};
      const asset=assets[url.pathname]; if(!asset || !['GET','HEAD'].includes(request.method)) return new Response('Not found',{status:404,headers});
      return new Response(request.method==='HEAD'?null:asset[0],{headers:{...headers,'Content-Type':asset[1],
        'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"}});
    } catch(error) {
      if(error instanceof HttpError) return json({error:error.message},error.status);
      if(error instanceof Error && !/D1|SQL|database/i.test(error.message)) return json({error:error.message},400);
      console.error('Atlas request failed',error?.name);
      return json({error:'We could not save or load your workspace. Your draft is still here. Please try again.'},503);
    }
  }
};
