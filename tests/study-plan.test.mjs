import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyPlan,prepareSubjectMaterials} from '../app/study-plan.ts';
const q=n=>({prompt:'Pergunta '+n,answer:'Sim',options:['Sim','Não','Talvez','Nunca'],explanation:'Explicação',source:'Página '+n});
const file=(id,subject,questions=[])=>({id,title:'Tema '+id,subject,questions});
test('seleção separa matérias e mantém referências aos arquivos originais',()=>{
 const a=file('1','Banco de Dados',[q(1),q(2)]),b=file('2','Banco de Dados',[q(3)]),c=file('3','Redes',[q(4)]);
 const p=buildStudyPlan([c,b,a],'Banco de Dados');assert.deepEqual(p.files.map(f=>f.id),['1','2']);assert.deepEqual(p.questions.map(x=>x.prompt),['Pergunta 1','Pergunta 3','Pergunta 2']);assert.equal(p.questions[1].source,'Tema 2 · Página 3');assert.equal(a.questions[0].source,'Página 1');assert.equal(p.coveredFiles,2);
 assert.equal(buildStudyPlan([a,b,c],'Matéria removida').questions.length,0);
});
test('limita o banco de sessão sem preencher tudo com o primeiro arquivo',()=>{
 const p=buildStudyPlan([file('1','A',Array.from({length:100},(_,i)=>q(i))),file('2','A',[q(101),q(102)]),file('3','B',[q(200)])],'A',100);assert.equal(p.questions.length,100);assert.equal(p.totalQuestions,102);assert.equal(p.questions[1].prompt,'Pergunta 101');assert.ok(!p.questions.some(x=>x.prompt==='Pergunta 200'));
});
test('prepara somente pendências da matéria escolhida e reaproveita atividades',async()=>{
 const materials=[file('1','A',[q(1)]),file('2','A'),file('3','B')],calls=[],updates=[];
 const result=await prepareSubjectMaterials(materials,'A',async m=>{calls.push(m.id);return {...m,questions:[q(2)]}},{onUpdate:m=>updates.push(m.id)});
 assert.deepEqual(calls,['2']);assert.deepEqual(updates,['2']);assert.equal(result.plan.pending.length,0);assert.equal(result.plan.questions.length,2);assert.equal(materials[1].questions.length,0);assert.equal(result.materials[2].questions.length,0);
 await prepareSubjectMaterials(result.materials,'A',async()=>{assert.fail('Não deve gerar novamente')});
});
test('cancelar interrompe a fila e preserva os arquivos já preparados',async()=>{
 let stop=false;const calls=[];const result=await prepareSubjectMaterials([file('1','A'),file('2','A')],'A',async m=>{calls.push(m.id);return {...m,questions:[q(1)]}},{onUpdate:()=>{stop=true},shouldStop:()=>stop});
 assert.deepEqual(calls,['1']);assert.equal(result.plan.ready.length,1);assert.equal(result.plan.pending.length,1);assert.equal(result.cancelled,true);
});
test('erro ou conteúdo sem perguntas não troca para outra matéria nem exemplo',async()=>{
 const result=await prepareSubjectMaterials([file('1','A'),file('2','A'),file('3','B',[q(99)])],'A',async m=>{if(m.id==='2')throw new Error('Falha de conexão');return {...m,questions:[q(1)]}});
 assert.equal(result.error,'Falha de conexão');assert.equal(result.plan.pending.length,1);assert.deepEqual(result.plan.questions.map(q=>q.prompt),['Pergunta 1']);
 const empty=await prepareSubjectMaterials([file('1','A')],'A',async m=>m);assert.equal(empty.plan.questions.length,0);assert.equal(empty.plan.pending.length,1);
 const missing=await prepareSubjectMaterials([file('1','A',[q(1)])],'B',async()=>{assert.fail('Não deve acessar arquivos de A')});assert.equal(missing.plan.questions.length,0);
});
