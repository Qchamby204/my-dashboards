import {DatabaseSync} from 'node:sqlite';
import {createHash,randomBytes} from 'node:crypto';
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function openStore(path){
 const db=new DatabaseSync(path);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS devices(id TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,subscription TEXT NOT NULL,prefs TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,created INTEGER NOT NULL,updated INTEGER NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS deliveries(device TEXT NOT NULL,key TEXT NOT NULL,day TEXT NOT NULL,status TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(device,key),FOREIGN KEY(device) REFERENCES devices(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS skips(device TEXT NOT NULL,reminder TEXT NOT NULL,day TEXT NOT NULL,PRIMARY KEY(device,reminder,day),FOREIGN KEY(device) REFERENCES devices(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS completion_links(device TEXT PRIMARY KEY,token_hash TEXT NOT NULL UNIQUE,created INTEGER NOT NULL,FOREIGN KEY(device) REFERENCES devices(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS completions(device TEXT NOT NULL,app TEXT NOT NULL,day TEXT NOT NULL,done INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(device,app,day),FOREIGN KEY(device) REFERENCES devices(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);`);
 return db;
}
export function newToken(){return randomBytes(32).toString('base64url');}
export function readDevice(db,token){if(typeof token!=='string'||token.length!==43)return null;return db.prepare('SELECT * FROM devices WHERE token_hash=?').get(hash(token));}
