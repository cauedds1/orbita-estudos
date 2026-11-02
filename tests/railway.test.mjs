import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
import {randomBytes,randomUUID} from 'node:crypto';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {pathToFileURL} from 'node:url';
import {getDatabase,bootstrapOwner,assertPersistentVolume} from '../lib/persistence.mjs';

const workspace=resolve('work');mkdirSync(workspace,{recursive:true});
function temporary(){return mkdtempSync(join(workspace,'railway-test-'))}
function cleanup(path){assert.ok(resolve(path).startsWith(workspace+sep));rmSync(path,{recursive:true,force:true})}
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function unusedPort(){const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');const port=socket.address().port;await new Promise(r=>socket.close(r));return port}
function pdfFixture(){const stream='BT /F1 12 Tf 40 750 Td (Equivalent fractions represent the same amount.) Tj ET';const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];let pdf='%PDF-1.4\n';const offsets=[];for(let i=0;i<objects.length;i++){offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`}const xref=pdf.length;return pdf+`xref\n0 6\n0000000000 65535 f \n${offsets.map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`}

test('initialization, password hashing and persistent-volume guard',()=>{
 const path=temporary(),previous=process.env.DATA_DIR;
 try{process.env.DATA_DIR=path;process.env.ADMIN_EMAIL='owner@example.test';process.env.ADMIN_PASSWORD=randomBytes(24).toString('hex');bootstrapOwner();const db=getDatabase();const owner=db.prepare('SELECT * FROM users').get();assert.notEqual(owner.password_hash,process.env.ADMIN_PASSWORD);assert.match(owner.password_hash,/^scrypt\$/);bootstrapOwner();assert.equal(db.prepare('SELECT count(*) AS n FROM users').get().n,1);assert.equal(db.prepare('PRAGMA user_version').get().user_version,1);
 process.env.RAILWAY_ENVIRONMENT_ID='test';delete process.env.RAILWAY_VOLUME_MOUNT_PATH;assert.throws(assertPersistentVolume,/volume persistente/);process.env.RAILWAY_VOLUME_MOUNT_PATH=path;assert.doesNotThrow(assertPersistentVolume);process.env.DATA_DIR=resolve(path,'..','outside');assert.throws(assertPersistentVolume,/dentro do volume/);db.close();
 }finally{if(previous)process.env.DATA_DIR=previous;else delete process.env.DATA_DIR;delete process.env.RAILWAY_ENVIRONMENT_ID;delete process.env.RAILWAY_VOLUME_MOUNT_PATH;delete process.env.ADMIN_EMAIL;delete process.env.ADMIN_PASSWORD;cleanup(path)}
});

test('production server: auth, isolation, study flows and persistence after restart',{timeout:180000},async()=>{
 assert.ok(existsSync('.next/standalone/server.js'),'Execute npm run build primeiro.');
 const dir=temporary(),password=randomBytes(24).toString('hex'),port=await unusedPort(),base='http://127.0.0.1:'+port;let child;let logs='';
 async function start(restart=false){
 child=spawn(process.execPath,['--import',pathToFileURL(resolve('tests/mock-ai.mjs')).href,'scripts/start.mjs'],{cwd:process.cwd(),env:{...process.env,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',DATA_DIR:dir,PORT:String(port),APP_URL:base,COOKIE_SECURE:'false',ADMIN_EMAIL:restart?'':'owner@example.test',ADMIN_PASSWORD:restart?'':password,ALLOW_SIGNUP:restart?'false':'true',OPENAI_API_KEY:'test-transport-only',RAILWAY_ENVIRONMENT_ID:'',RAILWAY_VOLUME_MOUNT_PATH:''},stdio:['ignore','pipe','pipe']});child.stdout.on('data',d=>{logs+=d.toString()});child.stderr.on('data',d=>{logs+=d.toString()});
 for(let i=0;i<150;i++){if(child.exitCode!==null)throw new Error('Servidor encerrou: '+logs.slice(-2000));try{if((await fetch(base+'/api/health')).ok)return}catch{}await delay(150)}throw new Error('Servidor não iniciou: '+logs.slice(-2000));
 }
 async function stop(){if(!child||child.exitCode!==null)return;const exited=once(child,'exit');child.kill('SIGTERM');await Promise.race([exited,delay(5000)]);if(child.exitCode===null){child.kill('SIGKILL');await exited}}
 async function post(path,body,cookie='',origin=base,method='POST'){return fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)})}
 async function login(email,pw){const r=await post('/api/auth/login',{email,password:pw});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/i);return r.headers.get('set-cookie').split(';')[0]}
 try{
 await start();let r=await fetch(base+'/',{redirect:'manual'});assert.equal(r.status,307);assert.match(r.headers.get('location'),/login/);assert.match(await (await fetch(base+'/login')).text(),/E-mail/);
 assert.equal((await fetch(base+'/api/state')).status,401);assert.equal((await fetch(base+'/api/state',{headers:{'oai-authenticated-user-id':'spoof','oai-authenticated-user-email':'spoof@example.test'}})).status,401);
 assert.equal((await post('/api/auth/login',{email:'owner@example.test',password:'wrong'})).status,401);const owner=await login('owner@example.test',password);
 assert.equal((await post('/api/exams',{title:'Prova',date:'2026-12-01'},owner,'https://other.example')).status,403);
 const form=new FormData();form.set('title','Frações');form.set('subject','Matemática');form.set('text','Frações equivalentes representam a mesma quantidade. Multiplicamos numerador e denominador pelo mesmo número.');
 r=await fetch(base+'/api/materials',{method:'POST',headers:{Cookie:owner,Origin:base},body:form});assert.equal(r.status,200);const material=await r.json();
 r=await post('/api/generate',{id:material.id},owner);assert.equal(r.status,200);assert.ok((await r.json()).questions.length);
 r=await post('/api/fast',{id:material.id},owner);assert.equal(r.status,200);assert.ok((await r.json()).fast.questions.length);
 const pdf=pdfFixture(),upload=new FormData();upload.set('title','PDF persistente');upload.set('file',new Blob([pdf],{type:'application/pdf'}),'fractions.pdf');r=await fetch(base+'/api/materials',{method:'POST',headers:{Cookie:owner,Origin:base},body:upload});assert.equal(r.status,200);const file=await r.json();
 r=await post('/api/fast',{id:file.id},owner);assert.equal(r.status,200);assert.match((await r.json()).fast.questions[0].source,/Página 1/);
 r=await fetch(base+'/api/file/'+file.id,{headers:{Cookie:owner}});assert.match(r.headers.get('cache-control'),/no-store/);assert.equal(await r.text(),pdf);
 const invalid=new FormData();invalid.set('title','Inválido');invalid.set('file',new Blob(['not a pdf']),'invalid.pdf');assert.equal((await fetch(base+'/api/materials',{method:'POST',headers:{Cookie:owner,Origin:base},body:invalid})).status,400);
 r=await post('/api/settings',{focusSubject:'Matemática'},owner);assert.equal(r.status,200);assert.deepEqual(await r.json(),{weeklyTarget:5,focusSubject:'Matemática'});assert.equal((await post('/api/settings',{focusSubject:'x'.repeat(101)},owner)).status,400);
 const chatTurn={subject:'Matemática',message:'O que são frações equivalentes?',turnId:randomUUID()};r=await post('/api/subject-chat',chatTurn,owner);assert.equal(r.status,200);let chat=await r.json();assert.equal(chat.messages.length,2);assert.deepEqual(chat.messages[1].sources,['Frações']);
 r=await post('/api/subject-chat',chatTurn,owner);assert.equal((await r.json()).messages.length,2,'mesmo turnId não duplica');
 assert.equal((await fetch(base+'/api/subject-chat?subject='+encodeURIComponent('matemática'),{headers:{Cookie:owner}}).then(x=>x.json())).messages.length,2,'matéria sem diferenciar maiúsculas');
 assert.equal((await post('/api/subject-chat',{subject:'Inexistente',message:'Oi'},owner)).status,404);assert.equal((await post('/api/subject-chat',{subject:'Matemática',message:''},owner)).status,400);
 r=await post('/api/subject-chat',{subject:'Geral',message:'Equivalent fractions?'},owner);assert.equal(r.status,200);assert.deepEqual((await r.json()).messages[1].sources,['PDF persistente']);
 r=await post('/api/topics',{description:'Quero aprender sobre frações equivalentes.',level:'Iniciante'},owner);assert.equal(r.status,200);const topic=await r.json();assert.equal(topic.sections.length,3);
 const message={id:topic.id,message:'Me explique usando pizza.',turnId:randomUUID()};r=await post('/api/topics/chat',message,owner);assert.equal(r.status,200);const chatted=await r.json();assert.equal(chatted.messages.length,2);r=await post('/api/topics/chat',message,owner);assert.equal((await r.json()).revision,chatted.revision);
 r=await post('/api/topics/questions',{id:topic.id},owner);assert.equal(r.status,200);assert.equal((await r.json()).messages.length,2);
 assert.equal((await post('/api/goals',{title:'',type:'sessions',target:1},owner)).status,400);assert.equal((await post('/api/goals',{title:'X',type:'hack',target:1},owner)).status,400);assert.equal((await post('/api/settings',{weeklyTarget:0},owner)).status,400);
 assert.equal((await post('/api/settings',{weeklyTarget:1},owner)).status,200);r=await post('/api/goals',{title:'Primeira sessão',type:'sessions',target:1},owner);assert.equal(r.status,200);const goal=await r.json();
 r=await post('/api/sessions',{materialId:'topic:'+topic.id,title:topic.title,mode:'Simulado',total:2,correct:1,mistakes:[],xp:99999,bonuses:[{id:'x',label:'forjado',xp:99999}]},owner);assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.subject,'Explorar com IA');
 assert.equal(saved.baseXp,20);assert.deepEqual(saved.bonuses.map(b=>b.id),['first-of-day','weekly','goal:'+goal.id]);assert.equal(saved.xp,20+10+50+100);assert.equal(saved.completedGoals[0].id,goal.id);
 r=await post('/api/sessions',{materialId:'topic:'+topic.id,title:topic.title,mode:'Quiz',total:3,correct:3,mistakes:[]},owner);assert.deepEqual((await r.json()).bonuses.map(b=>b.id),['perfect']);
 r=await post('/api/sessions',{materialId:material.id,title:'Frações',mode:'Quiz',total:3,correct:1,mistakes:[]},owner);assert.equal((await r.json()).subject,'Matemática');
 assert.equal((await post('/api/exams',{title:'Prova de frações',subject:'Matemática',date:'2026-12-01'},owner)).status,200);
 r=await post('/api/auth/signup',{email:'student@example.test',password});assert.equal(r.status,200);const student=r.headers.get('set-cookie').split(';')[0];let state=await(await fetch(base+'/api/state',{headers:{Cookie:student}})).json();assert.equal(state.materials.length,0);assert.equal(state.goals.length,0);assert.equal(state.settings.focusSubject,null);assert.equal((await fetch(base+'/api/subject-chat?subject=Matem%C3%A1tica',{headers:{Cookie:student}}).then(x=>x.json())).messages.length,0);assert.equal(state.settings.weeklyTarget,5);await post('/api/goals',{id:goal.id},student,base,'DELETE');assert.equal((await fetch(base+'/api/file/'+file.id,{headers:{Cookie:student}})).status,404);assert.equal((await post('/api/topics/chat',{...message,turnId:randomUUID()},student)).status,404);assert.equal((await post('/api/materials',{id:material.id},student,base,'DELETE')).status,404);
 for(let i=0;i<10;i++)assert.equal((await post('/api/auth/login',{email:'unknown@example.test',password:'incorrect'})).status,401);assert.equal((await post('/api/auth/login',{email:'unknown@example.test',password:'incorrect'})).status,429);
 await stop();await start(true);
 state=await(await fetch(base+'/api/state',{headers:{Cookie:owner}})).json();assert.equal(state.materials.length,2);assert.equal(state.exams.length,1);assert.equal(state.sessions.length,3);assert.equal(state.settings.focusSubject,'Matemática');assert.match(state.materials.find(m=>m.title==='PDF persistente').text,/Página 1/);assert.ok(state.goals[0].completedAt);assert.equal(state.settings.weeklyTarget,1);assert.equal(await(await fetch(base+'/api/file/'+file.id,{headers:{Cookie:owner}})).text(),pdf);const topics=await(await fetch(base+'/api/topics',{headers:{Cookie:owner}})).json();assert.equal(topics.topics[0].messages.length,2);assert.equal((await post('/api/auth/signup',{email:'closed@example.test',password})).status,403);
 assert.equal((await post('/api/auth/logout',{},owner)).status,200);assert.equal((await fetch(base+'/api/state',{headers:{Cookie:owner}})).status,401);
 }finally{await stop();cleanup(dir)}
});
