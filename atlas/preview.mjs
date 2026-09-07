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
        const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>8500000){res.statusCode=413;res.end('Preview request too large.');return;}chunks.push(chunk);}
        const headers=new Headers();for(const [k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
        headers.set('oai-authenticated-user-id','atlas-preview-only');
        const method=req.method||'GET',body=['GET','HEAD'].includes(method)?undefined:Buffer.concat(chunks);
        const result=await worker.fetch(new Request('http://'+req.headers.host+req.url,{method,headers,body}),{DB:db});
        res.statusCode=result.status;for(const [k,v]of result.headers)res.setHeader(k,v);res.end(Buffer.from(await result.arrayBuffer()));
      }catch(error){res.statusCode=500;res.end('Preview failed.');console.error(error);}
    });
  }};
}
