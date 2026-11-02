import test from 'node:test';
import assert from 'node:assert/strict';
import {materialProgress,pendingMistakes,recommendations,subjectStats,examPace,nextExam,subjectsOverview,sessionsOf} from '../lib/study-guide.ts';

const q=p=>({prompt:p,answer:'a',options:['a','b','c','d'],explanation:'',source:''});
const M=(id,title,subject='Banco de Dados',questions=[q('x')])=>({id,title,subject,questions});
const at=day=>new Date(day+'T15:00:00Z');
const S=(materialId,day,correct,total=5,mistakes=[])=>({materialId,mode:'Quiz',total,correct,createdAt:at(day).toISOString(),mistakes});
const now=at('2026-11-20');

test('situação do material: novo, praticar, dominado e revisar',()=>{
 const m=M('a','Tema 2');
 assert.equal(materialProgress(m,[],now).state,'novo');
 assert.equal(materialProgress(m,[S('a','2026-11-19',2)],now).state,'praticar');
 assert.equal(materialProgress(m,[S('a','2026-11-18',5)],now).state,'dominado');
 assert.equal(materialProgress(m,[S('a','2026-11-01',5)],now).state,'revisar','acertou tudo, mas há mais de 7 dias');
 const p=materialProgress(m,[S('a','2026-11-10',5),S('a','2026-11-19',3)],now);
 assert.deepEqual([p.state,p.sessions,p.lastAccuracy,p.bestAccuracy,p.daysSince],['praticar',2,.6,1,1],'vale o último resultado');
});

test('erros pendentes: só os da última sessão de cada material, sem repetição',()=>{
 const mats=[M('a','Tema 2'),M('b','Tema 3'),M('c','Outro','Redes')];
 const sessions=[S('a','2026-11-10',3,5,[q('p1'),q('p2')]),S('a','2026-11-15',4,5,[q('p2')]),S('b','2026-11-16',4,5,[q('p2'),q('p3')]),S('c','2026-11-16',0,5,[q('r1')])];
 assert.deepEqual(pendingMistakes('Banco de Dados',mats,sessions).map(x=>x.prompt),['p2','p3']);
 const review={materialId:'review:Banco de Dados',subject:'Banco de Dados',mode:'Quiz',total:2,correct:1,createdAt:at('2026-11-17').toISOString(),asked:['p2','p3'],mistakes:[q('p3')]};
 assert.deepEqual(pendingMistakes('Banco de Dados',mats,[...sessions,review]).map(x=>x.prompt),['p3'],'p2 foi corrigido na revisão; p3 continua');
});

test('recomendações seguem prioridade: prova próxima, erros, mais fraco, próximo novo, revisão',()=>{
 const mats=[M('a','Tema 2'),M('b','Tema 3'),M('c','Tema 10'),M('d','Tema 11',undefined,[]),M('e','Tema 1')];
 const sessions=[S('a','2026-11-19',2,5,[q('p1')]),S('b','2026-11-19',3),S('e','2026-11-01',5)];
 let recs=recommendations('Banco de Dados',mats,sessions,[],now,10);
 assert.deepEqual(recs.map(r=>r.kind+':'+(r.materialId||'')),['mistakes:','practice:a','practice:b','new:c','review:e']);
 assert.match(recs[1].reason,/40%/);
 const exam=[{id:'x',title:'P1',subject:'banco de dados',date:'2026-11-23'}];
 recs=recommendations('Banco de Dados',mats,sessions,exam,now);
 assert.equal(recs[0].kind,'exam');assert.equal(recs[0].materialId,'a','começa pelo mais fraco');assert.equal(recs.length,4);
 assert.equal(recommendations('Banco de Dados',[M('d','Só texto',undefined,[])],[],[],now)[0].kind,'generate');
 assert.equal(recommendations('Banco de Dados',[M('a','Tema 2')],[S('a','2026-11-19',5)],[],now)[0].kind,'done');
 assert.deepEqual(recommendations('Vazia',mats,sessions,[],now),[]);
});

test('números da matéria, prova e ritmo',()=>{
 const mats=[M('a','Tema 2'),M('b','Tema 3'),M('c','Tema 4'),M('z','Rede','Redes')];
 const sessions=[S('a','2026-11-19',5),S('b','2026-11-19',2),{...S('old','2026-11-18',1),subject:'Banco de Dados'},S('z','2026-11-19',5)];
 const st=subjectStats('Banco de Dados',mats,sessions,now);
 assert.deepEqual([st.materials,st.practiced,st.mastered,st.sessions,st.questions],[3,2,1,3,15]);assert.equal(st.accuracy,8/15);
 assert.equal(sessionsOf('Banco de Dados',mats,sessions).length,3,'inclui sessão de material apagado com matéria gravada');
 const exams=[{id:'1',title:'Antiga',subject:'Banco de Dados',date:'2026-11-01'},{id:'2',title:'P2',subject:'Banco de Dados',date:'2026-11-21'}];
 assert.equal(nextExam('Banco de Dados',exams,now).title,'P2');assert.equal(nextExam('Banco de Dados',exams,now).daysLeft,1);
 assert.deepEqual((({remaining,perDay})=>({remaining,perDay}))(examPace('Banco de Dados',mats,sessions,exams,now)),{remaining:2,perDay:2});
 assert.deepEqual(subjectsOverview(mats,sessions,exams,now).map(o=>[o.subject,o.materials,!!o.nextExam]),[['Banco de Dados',3,true],['Redes',1,false]]);
});
