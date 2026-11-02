import 'server-only';
import {getDatabase,dataDirectory} from './persistence.mjs';
import {mkdir,readFile,writeFile,rename,unlink,realpath} from 'node:fs/promises';
import {resolve,dirname,sep} from 'node:path';
import {randomUUID} from 'node:crypto';
class Prepared {
 constructor(private sql:string,private values:any[]=[]){ }
 bind(...values:any[]){return new Prepared(this.sql,values)}
 async all(){return {results:getDatabase().prepare(this.sql).all(...this.values)}}
 async first<T=any>():Promise<T|null>{return (getDatabase().prepare(this.sql).get(...this.values) as T)||null}
 async run(){const r=getDatabase().prepare(this.sql).run(...this.values);return {success:true,meta:{changes:Number(r.changes)}}}
}
const db={prepare(sql:string){return new Prepared(sql)}};
const root=()=>resolve(dataDirectory(),'uploads');
async function pathFor(key:string){
 if(!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/.test(key))throw new Error('Chave de arquivo inválida.');
 const base=root();await mkdir(base,{recursive:true,mode:0o700});const target=resolve(base,key);
 if(!target.startsWith(base+sep))throw new Error('Caminho de arquivo inválido.');
 await mkdir(dirname(target),{recursive:true,mode:0o700});
 if(await realpath(dirname(target))!==resolve(await realpath(base),key.split('/')[0]))throw new Error('Diretório de arquivo inválido.');
 return target;
}
const bucket={
 async put(key:string,data:ArrayBuffer,_metadata?:unknown){const path=await pathFor(key),temp=path+'.'+randomUUID()+'.tmp';try{await writeFile(temp,Buffer.from(data),{mode:0o600,flag:'wx'});await rename(temp,path)}catch(e){await unlink(temp).catch(()=>{});throw e}},
 async get(key:string){try{const buffer=await readFile(await pathFor(key));return {body:new Uint8Array(buffer),async arrayBuffer(){return buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength) as ArrayBuffer}}}catch(e:any){if(e.code==='ENOENT')return null;throw e}},
 async delete(key:string){try{await unlink(await pathFor(key))}catch(e:any){if(e.code!=='ENOENT')throw e}}
};
export const env={DB:db,BUCKET:bucket,get OPENAI_API_KEY(){return process.env.OPENAI_API_KEY},get OPENAI_MODEL(){return process.env.OPENAI_MODEL}};
