import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,realpathSync,existsSync} from 'node:fs';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {randomBytes,scryptSync,randomUUID} from 'node:crypto';

export function dataDirectory(){return resolve(process.env.DATA_DIR||process.env.RAILWAY_VOLUME_MOUNT_PATH||'./data')}
export function assertPersistentVolume(){
 if(!process.env.RAILWAY_ENVIRONMENT_ID)return;
 const mount=process.env.RAILWAY_VOLUME_MOUNT_PATH;
 if(!mount||!existsSync(mount))throw new Error('Anexe um volume persistente ao serviço Railway em /data antes de iniciar.');
 const location=relative(realpathSync(mount),dataDirectory());
 if(location==='..'||location.startsWith('..'+(process.platform==='win32'?'\\':'/'))||isAbsolute(location))throw new Error('DATA_DIR deve ficar dentro do volume persistente do Railway.');
}
export function getDatabase(){
 const root=dataDirectory();
 if(globalThis.__orbitaDatabase?.root===root)return globalThis.__orbitaDatabase.db;
 assertPersistentVolume();mkdirSync(root,{recursive:true,mode:0o700});
 const db=new DatabaseSync(join(root,'orbita.sqlite'),{timeout:5000});
 db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
 const version=Number(db.prepare('PRAGMA user_version').get().user_version);
 if(version>1)throw new Error('Este banco usa uma versão mais nova da Órbita.');
 if(version<1){db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,user_id TEXT NOT NULL,kind TEXT NOT NULL,data TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS records_owner_kind ON records(user_id,kind);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at);
 CREATE TABLE IF NOT EXISTS auth_attempts(key TEXT PRIMARY KEY,failures INTEGER NOT NULL,window_start INTEGER NOT NULL);
 PRAGMA user_version=1;
 COMMIT;`)}
 globalThis.__orbitaDatabase={root,db};return db;
}
export function bootstrapOwner(){
 const db=getDatabase();const email=process.env.ADMIN_EMAIL?.trim().toLowerCase();const password=process.env.ADMIN_PASSWORD;
 if(db.prepare('SELECT COUNT(*) AS count FROM users').get().count>0)return;
 if(!email||!/^\S+@\S+\.\S+$/.test(email)||email.length>254||!password||password.length<12||password.length>128)throw new Error('No primeiro início, configure ADMIN_EMAIL e ADMIN_PASSWORD (12 a 128 caracteres).');
 const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024}).toString('hex');
 db.prepare('INSERT OR IGNORE INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(randomUUID(),email,`scrypt$${salt}$${hash}`,new Date().toISOString());
}
