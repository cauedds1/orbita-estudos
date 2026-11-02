import test from 'node:test';
import assert from 'node:assert/strict';
import {computeBonuses,streakOf,weekStart,weekCount,goalProgress,goalState,levelInfo,medalStatus,sessionBaseXp} from '../lib/rewards.ts';

// Datas em UTC; o fuso das regras é America/Sao_Paulo (UTC-3).
const at=(day,hour=15)=>new Date(`${day}T${String(hour).padStart(2,'0')}:00:00Z`);
const s=(day,{mode='Quiz',total=4,correct=2,hour=15}={})=>({mode,total,correct,xp:sessionBaseXp(total,correct),createdAt:at(day,hour).toISOString()});

test('sequência e semana usam o fuso de São Paulo',()=>{
 assert.equal(streakOf([s('2026-11-01'),s('2026-11-02'),s('2026-11-03')],at('2026-11-03')),3);
 assert.equal(streakOf([s('2026-11-01'),s('2026-11-02')],at('2026-11-03')),2,'hoje ainda sem estudo mantém a sequência de ontem');
 assert.equal(streakOf([s('2026-11-01')],at('2026-11-03')),0);
 // 01:00 UTC do dia 3 ainda é dia 2 em São Paulo.
 assert.equal(streakOf([s('2026-11-03',{hour:1})],at('2026-11-02',20)),1);
 assert.equal(weekStart('2026-11-08'),'2026-11-02');assert.equal(weekStart('2026-11-02'),'2026-11-02');
 assert.equal(weekCount([s('2026-11-01'),s('2026-11-02'),s('2026-11-04')],at('2026-11-05')),2);
});

test('bônus de sessão: gabarito, primeira do dia, sequência e meta semanal',()=>{
 const now=at('2026-11-04');
 const perfect={...s('2026-11-04',{total:4,correct:4})};
 let r=computeBonuses({previous:[s('2026-11-02'),s('2026-11-03')],session:perfect,goals:[],weeklyTarget:3,now});
 assert.deepEqual(r.bonuses.map(b=>b.id),['perfect','first-of-day','streak','weekly']);
 assert.equal(r.bonuses.find(b=>b.id==='streak').xp,15);
 r=computeBonuses({previous:[s('2026-11-04')],session:s('2026-11-04',{total:2,correct:2}),goals:[],weeklyTarget:9,now});
 assert.deepEqual(r.bonuses,[],'segunda sessão do dia, 2 perguntas não contam como gabarito');
 r=computeBonuses({previous:[s('2026-11-02'),s('2026-11-03'),s('2026-11-04')],session:s('2026-11-04'),goals:[],weeklyTarget:3,now});
 assert.ok(!r.bonuses.some(b=>b.id==='weekly'),'meta semanal só paga uma vez');
});

test('objetivos: progresso desde a criação, prazo e conclusão',()=>{
 const goal={id:'g1',title:'Dez acertos',type:'correct',target:5,deadline:'2026-11-10',createdAt:at('2026-11-02',12).toISOString(),completedAt:null,reward:100};
 const before=[s('2026-11-01',{correct:4}),s('2026-11-03',{correct:3})];
 assert.equal(goalProgress(goal,before),3,'sessões antes da criação não contam');
 const r=computeBonuses({previous:before,session:s('2026-11-04',{correct:2}),goals:[goal],weeklyTarget:99,now:at('2026-11-04')});
 assert.deepEqual(r.completedGoalIds,['g1']);assert.equal(r.bonuses.at(-1).xp,100);
 assert.equal(goalState(goal,at('2026-11-11')),'expirado');assert.equal(goalState({...goal,completedAt:'x'},at('2026-11-11')),'concluido');
 assert.equal(goalProgress(goal,[s('2026-11-11',{correct:4})]),0,'depois do prazo não conta');
});

test('níveis e medalhas com data de desbloqueio',()=>{
 assert.deepEqual([levelInfo(0).level,levelInfo(0).title],[1,'Explorador']);
 assert.deepEqual([levelInfo(450).level,levelInfo(450).title,levelInfo(450).needed],[4,'Aprendiz',150]);
 const sessions=[s('2026-11-01'),s('2026-11-02',{total:3,correct:3}),s('2026-11-03',{mode:'Fast',hour:2})];
 const medals=Object.fromEntries(medalStatus(sessions,[{id:'g',completedAt:at('2026-11-03').toISOString()}]).map(m=>[m.id,m]));
 assert.equal(medals['primeiro-passo'].unlockedAt,sessions[0].createdAt);
 assert.equal(medals['gabaritou'].unlockedAt,sessions[1].createdAt);
 assert.equal(medals['em-chamas'].progress,2,'03/11 02h UTC ainda é 02/11 em São Paulo');assert.equal(medals['em-chamas'].unlockedAt,null);
 assert.ok(medals['coruja'].unlockedAt,'02h UTC = 23h em São Paulo');
 assert.ok(medals['foco'].unlockedAt);
 assert.equal(medals['constancia'].unlockedAt,null);assert.equal(medals['constancia'].progress,3);
});
