// Development only: the same built Worker, with an isolated in-memory SQLite workspace.
// This module is never copied into the production archive. No live identity or DB is used.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
export function previewDatabase(){
  const sqlite=new DatabaseSync(':memory:');
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  return {
    prepare(sql){let values=[];return {bind(...args){values=args;return this;},first(){return sqlite.prepare(sql).get(...values)||null;},all(){return {results:sqlite.prepare(sql).all(...values)};},run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...values).changes)}};},execute(){return /^\s*SELECT/i.test(sql)?this.all():this.run();}};},
    batch(statements){sqlite.exec('BEGIN');try{const r=statements.map(s=>s.execute());sqlite.exec('COMMIT');return r;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}
  };
}
export function atlasPreview(){
  return {name:'atlas-worker-preview',async configureServer(server){
    const db=previewDatabase();
    const {default:worker}=await import('../dist/server/index.js');
    server.httpServer?.once('close',()=>db.close());
    server.middlewares.use(async(req,res)=>{
      try{
        // Restrict this demo bridge to the documented preview host.
        if(req.headers.host!=='terminal.local:4173'&&req.headers.host!=='127.0.0.1:4173'){res.statusCode=403;res.end('Preview host required.');return;}
        const previewURL=new URL(req.url,'http://'+req.headers.host),viewport=previewURL.searchParams.get('viewport');
        // A real iframe viewport exercises responsive CSS without device emulation.
        // Only this isolated development adapter serves the sizing controls.
        if(req.method==='GET'&&previewURL.pathname==='/'&&['320','390'].includes(viewport)){
          res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');
          res.end(`<!doctype html><html lang="en"><head><title>Atlas responsive QA</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#20252e;color:white;font:16px system-ui"><nav style="padding:12px">Isolated test workspace · ${viewport}px <a href="/" style="color:#b9d4ff;margin-left:16px">Desktop preview</a> <a href="/?viewport=390" style="color:#b9d4ff;margin-left:16px">390px preview</a> <a href="/?viewport=320" style="color:#b9d4ff;margin-left:16px">320px preview</a></nav><iframe title="Atlas mobile workspace" src="/?preview=frame" style="display:block;border:0;margin:auto;width:${viewport}px;height:844px"></iframe></body></html>`);return;
        }
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>13000000){res.statusCode=413;res.end('Preview request too large.');return;}chunks.push(chunk);}
        const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
        headers.set('oai-authenticated-user-id','atlas-preview-only');
        const method=req.method||'GET',body=['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks);
        const result=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method,headers,body}),{DB:db});
        res.statusCode=result.status;for(const [k,v]of result.headers)res.setHeader(k,v);
        if(req.method==='GET'&&previewURL.pathname==='/'&&!previewURL.searchParams.has('preview'))res.end((await result.text()).replace('</main>','<footer><a href="/?viewport=390">Open mobile layout preview</a></footer></main>'));
        else res.end(Buffer.from(await result.arrayBuffer()));
      }catch(error){res.statusCode=500;res.end('Preview failed.');console.error(error);}
    });
  }};
}
