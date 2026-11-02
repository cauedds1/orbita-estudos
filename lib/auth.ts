import 'server-only';
import {cookies} from 'next/headers';
import {randomBytes,createHash,scrypt,timingSafeEqual,randomUUID} from 'node:crypto';
import {getDatabase} from './persistence.mjs';

export const COOKIE_NAME='orbita_session';
const lifespan=7*24*60*60*1000;
const digest=(text:string)=>createHash('sha256').update(text).digest('hex');
const derive=(password:string,salt:string)=>new Promise<Buffer>((resolve,reject)=>scrypt(password,salt,64,{N:16384,r:8,p:1,maxmem:64*1024*1024},(error,key)=>error?reject(error):resolve(key)));
export const signupAllowed=()=>process.env.ALLOW_SIGNUP==='true';
export function sameOrigin(req:Request){
 const origin=req.headers.get('origin');if(!origin)return false;
 try{const host=req.headers.get('host')||new URL(req.url).host;const protocol=(req.headers.get('x-forwarded-proto')||new URL(req.url).protocol.replace(':','')).split(',')[0].trim();const expected=process.env.APP_URL?new URL(process.env.APP_URL).origin:protocol+'://'+host;return new URL(origin).origin===expected}catch{return false}
}
export async function getUser(){
 const token=(await cookies()).get(COOKIE_NAME)?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
 const db=getDatabase();const user=db.prepare('SELECT u.id,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').get(digest(token),Date.now()) as {id:string,email:string}|undefined;
 return user?{userId:user.id,email:user.email,displayName:user.email.split('@')[0]}:null;
}
export async function authenticate(email:string,password:string){
 const db=getDatabase();const key=digest(email);const now=Date.now();const attempt=db.prepare('SELECT failures,window_start FROM auth_attempts WHERE key=?').get(key) as {failures:number,window_start:number}|undefined;
 if(attempt&&now-attempt.window_start<15*60*1000&&attempt.failures>=10)return {limited:true} as const;
 const user=db.prepare('SELECT id,email,password_hash FROM users WHERE email=?').get(email) as {id:string,email:string,password_hash:string}|undefined;
 const [version,salt,hash]=(user?.password_hash||'scrypt$00000000000000000000000000000000$'+'0'.repeat(128)).split('$');
 const actual=await derive(password,salt);const expected=Buffer.from(hash,'hex');
 const valid=version==='scrypt'&&expected.length===actual.length&&timingSafeEqual(actual,expected)&&!!user;
 if(!valid){db.prepare('INSERT INTO auth_attempts(key,failures,window_start) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET failures=CASE WHEN ?-window_start>=900000 THEN 1 ELSE failures+1 END,window_start=CASE WHEN ?-window_start>=900000 THEN ? ELSE window_start END').run(key,now,now,now,now);return {invalid:true} as const}
 db.prepare('DELETE FROM auth_attempts WHERE key=?').run(key);return {user:user!} as const;
}
export async function createUser(email:string,password:string){
 const salt=randomBytes(16).toString('hex'),hash=(await derive(password,salt)).toString('hex'),id=randomUUID();
 getDatabase().prepare('INSERT INTO users(id,email,password_hash,created_at) VALUES(?,?,?,?)').run(id,email,`scrypt$${salt}$${hash}`,new Date().toISOString());return {id,email};
}
export async function createSession(userId:string){
 const db=getDatabase();db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(Date.now());const token=randomBytes(32).toString('hex'),expires=Date.now()+lifespan;db.prepare('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)').run(digest(token),userId,expires);
 (await cookies()).set(COOKIE_NAME,token,{httpOnly:true,secure:process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='false',sameSite:'lax',path:'/',expires:new Date(expires)});
}
export async function destroySession(){const jar=await cookies(),token=jar.get(COOKIE_NAME)?.value;if(token)getDatabase().prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token));jar.set(COOKIE_NAME,'',{httpOnly:true,secure:process.env.NODE_ENV==='production'&&process.env.COOKIE_SECURE!=='false',sameSite:'lax',path:'/',maxAge:0})}
