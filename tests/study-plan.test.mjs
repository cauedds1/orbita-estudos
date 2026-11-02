import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStudyPlan,prepareSubjectMaterials,studySegment} from '../app/study-plan.ts';
const q=n=>({prompt:'Pergunta '+n,answer:'Sim',options:['Sim','Não','Talvez','Nunca'],explanation:'Explicação',source:'Página '+n});
const file=(id,subject,questions=[])=>({id,title:'Tema '+id,subject,questions});
test('seleção separa matérias e mantém referências aos arquivos originais',()=>{
 const a=file('1','Banco de Dados',[q(1),q(2)]),b=file('2','Banco de Dados',[q(3)]),c=file('3','Redes',[q(4)]);
 const p=buildStudyPlan([c,b,a],'Banco de Dados');assert.deepEqual(p.files.map(f=>f.id),['1','2']);assert.deepEqual(p.questions.map(x=>x.prompt),['Pergunta 1','Pergunta 2','Pergunta 3']);assert.equal(p.questions[2].source,'Tema 2 · Página 3');assert.equal(a.questions[0].source,'Página 1');assert.equal(p.coveredFiles,2);
 assert.equal(buildStudyPlan([a,b,c],'Matéria removida').questions.length,0);
});
test('limita o banco preservando os capítulos em sequência',()=>{
 const p=buildStudyPlan([file('1','A',Array.from({length:100},(_,i)=>q(i))),file('2','A',[q(101),q(102)]),file('3','B',[q(200)])],'A',100);assert.equal(p.questions.length,100);assert.equal(p.totalQuestions,102);assert.equal(p.questions[1].prompt,'Pergunta 1');assert.ok(!p.questions.some(x=>x.prompt==='Pergunta 200'));
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

test('numeração original e ajuste manual prevalecem sobre nomes e ordem de upload',()=>{
 const a={...file('a','A',[q(3),q(1),q(2)]),title:'Avançado',filename:'10 - Avançado.pdf'},b={...file('b','A',[q(1)]),title:'Introdução',filename:'2 - Introdução.pdf'};
 let p=buildStudyPlan([a,b],'A');assert.deepEqual(p.files.map(m=>m.id),['b','a']);assert.deepEqual(p.questions.map(q=>q.prompt),['Pergunta 1','Pergunta 1','Pergunta 2','Pergunta 3']);assert.equal(p.questions[1].materialTitle,'Avançado');assert.equal(a.questions[0].prompt,'Pergunta 3');
 p=buildStudyPlan([{...a,studyOrder:0},{...b,studyOrder:1}],'A');assert.equal(p.files[0].id,'a');
 const nested=buildStudyPlan([{...a,studyPath:'Curso/A/02 Aplicações/01.pdf'},{...b,studyPath:'Curso/A/01 Fundamentos/10.pdf'}],'A');assert.equal(nested.files[0].id,'b');
});
test('fontes literais recuperam a sequência e fontes sem posição mantêm a ordem original',()=>{
 const first='Fundamentos apresentados no começo.',last='Aplicação que encerra o conteúdo.';
 let p=buildStudyPlan([{...file('1','A',[{...q(2),source:last},{...q(1),source:first}]),text:first+' '+last}],'A');assert.equal(p.questions[0].prompt,'Pergunta 1');
 p=buildStudyPlan([file('1','A',[{...q(2),source:'Sem localização'},{...q(1),source:first}])],'A');assert.equal(p.questions[0].prompt,'Pergunta 2');
});
test('etapas dão acesso a todo o conteúdo sem sorteio, repetição ou salto',()=>{
 const bank=Array.from({length:73},(_,i)=>q(i));for(const mode of ['Quiz','Flashcards','Simulado']){const parts=Array.from({length:studySegment(bank,mode).count},(_,i)=>studySegment(bank,mode,i));assert.deepEqual(parts.flatMap(p=>p.questions),bank);assert.equal(parts.at(-1).end,73);assert.deepEqual(studySegment(bank,mode,999).questions,parts.at(-1).questions)}
 assert.equal(studySegment([],'Quiz').questions.length,0);
});
