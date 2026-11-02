// Regras de recompensa: bônus de XP, níveis, metas, objetivos e medalhas.
// Módulo puro (sem acesso a banco ou DOM), usado pelo servidor e pela interface.

export type Bonus={id:string,label:string,xp:number};
export type RewardSession={mode:string,total:number,correct:number,xp:number,baseXp?:number,createdAt:string,bonuses?:Bonus[]};
export type GoalType='sessions'|'correct'|'xp'|'perfect';
export type Goal={id:string,title:string,type:GoalType,target:number,deadline?:string|null,createdAt:string,completedAt?:string|null,reward:number};
export type GoalState='concluido'|'ativo'|'expirado';

export const TIME_ZONE='America/Sao_Paulo';
export const XP_PER_LEVEL=150;
export const DEFAULT_WEEKLY_TARGET=5;
export const GOAL_REWARD=100;
export const BONUS={perfect:25,firstOfDay:10,streakPerDay:5,streakCap:7,weekly:50};

export const GOAL_TYPES:Record<GoalType,{label:string,unit:string,max:number}>={
 sessions:{label:'Concluir sessões',unit:'sessões',max:500},
 correct:{label:'Acertar questões',unit:'acertos',max:5000},
 xp:{label:'Ganhar XP em sessões',unit:'XP',max:50000},
 perfect:{label:'Gabaritar sessões',unit:'sessões perfeitas',max:200},
};

export const dayKey=(d:Date|string)=>new Date(d).toLocaleDateString('en-CA',{timeZone:TIME_ZONE});
const hourOf=(d:Date|string)=>Number(new Intl.DateTimeFormat('en-US',{timeZone:TIME_ZONE,hour:'numeric',hourCycle:'h23'}).format(new Date(d)));
const shiftDay=(key:string,days:number)=>{const d=new Date(key+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)};
/** Segunda-feira (chave AAAA-MM-DD) da semana que contém o dia informado. */
export const weekStart=(key:string)=>{const dow=new Date(key+'T12:00:00Z').getUTCDay();return shiftDay(key,-((dow+6)%7))};

export const isPerfect=(s:Pick<RewardSession,'total'|'correct'>)=>s.total>=3&&s.correct===s.total;
export const baseXpOf=(s:RewardSession)=>s.baseXp??s.xp;
export const sessionBaseXp=(total:number,correct:number)=>correct*15+(total-correct)*5;

/** Dias seguidos com pelo menos uma sessão, terminando hoje (ou ontem, se hoje ainda não houve estudo). */
export function streakOf(sessions:Pick<RewardSession,'createdAt'>[],now=new Date()){
 const days=new Set(sessions.map(s=>dayKey(s.createdAt)));let cursor=dayKey(now);if(!days.has(cursor))cursor=shiftDay(cursor,-1);
 let streak=0;while(days.has(cursor)){streak++;cursor=shiftDay(cursor,-1)}return streak;
}
export function weekCount(sessions:Pick<RewardSession,'createdAt'>[],now=new Date()){const start=weekStart(dayKey(now));return sessions.filter(s=>{const k=dayKey(s.createdAt);return k>=start&&k<=dayKey(now)}).length}

function inGoalWindow(goal:Goal,s:RewardSession){if(s.createdAt<goal.createdAt)return false;return !goal.deadline||dayKey(s.createdAt)<=goal.deadline}
export function goalProgress(goal:Goal,sessions:RewardSession[]){
 return sessions.filter(s=>inGoalWindow(goal,s)).reduce((n,s)=>n+(goal.type==='sessions'?1:goal.type==='correct'?s.correct:goal.type==='xp'?baseXpOf(s):isPerfect(s)?1:0),0);
}
export function goalState(goal:Goal,now=new Date()):GoalState{if(goal.completedAt)return 'concluido';return goal.deadline&&dayKey(now)>goal.deadline?'expirado':'ativo'}

/**
 * Bônus de uma sessão recém-concluída. `previous` são as sessões anteriores do usuário.
 * Retorna os bônus e os objetivos que esta sessão concluiu (para marcar como concluídos).
 */
export function computeBonuses({previous,session,goals,weeklyTarget,now=new Date()}:{previous:RewardSession[],session:RewardSession,goals:Goal[],weeklyTarget:number,now?:Date}){
 const bonuses:Bonus[]=[];const today=dayKey(now);const all=[...previous,session];
 if(isPerfect(session))bonuses.push({id:'perfect',label:'Gabarito perfeito',xp:BONUS.perfect});
 if(!previous.some(s=>dayKey(s.createdAt)===today)){
 bonuses.push({id:'first-of-day',label:'Primeira sessão do dia',xp:BONUS.firstOfDay});
 const streak=streakOf(all,now);if(streak>=2)bonuses.push({id:'streak',label:`Sequência de ${streak} dias`,xp:Math.min(streak,BONUS.streakCap)*BONUS.streakPerDay});
 }
 if(weekCount(previous,now)<weeklyTarget&&weekCount(all,now)>=weeklyTarget)bonuses.push({id:'weekly',label:'Meta semanal batida',xp:BONUS.weekly});
 const completed=goals.filter(g=>goalState(g,now)==='ativo'&&goalProgress(g,all)>=g.target);
 for(const g of completed)bonuses.push({id:'goal:'+g.id,label:`Objetivo: ${g.title}`,xp:g.reward});
 return {bonuses,completedGoalIds:completed.map(g=>g.id)};
}

export const LEVEL_TITLES:[number,string][]=[[1,'Explorador'],[3,'Aprendiz'],[5,'Navegador'],[8,'Astronauta'],[12,'Cometa'],[16,'Estrela'],[20,'Supernova'],[30,'Galáxia']];
export function levelInfo(xp:number){
 const level=Math.floor(xp/XP_PER_LEVEL)+1;const title=[...LEVEL_TITLES].reverse().find(([min])=>level>=min)![1];
 const next=LEVEL_TITLES.find(([min])=>min>level);
 return {level,title,into:xp%XP_PER_LEVEL,needed:XP_PER_LEVEL-xp%XP_PER_LEVEL,nextTitle:next?{level:next[0],title:next[1]}:null};
}

type Stats={sessions:number,perfect:number,fast:number,modes:number,correct:number,xp:number,bestStreak:number,night:number,early:number,goals:number};
export type MedalTier='bronze'|'prata'|'ouro';
export type MedalDef={id:string,name:string,description:string,icon:string,tier:MedalTier,target:number,stat:keyof Stats};
export const MEDALS:MedalDef[]=[
 {id:'primeiro-passo',name:'Primeiro passo',description:'Conclua sua primeira sessão.',icon:'rocket',tier:'bronze',target:1,stat:'sessions'},
 {id:'constancia',name:'Constância',description:'Conclua 10 sessões.',icon:'book',tier:'prata',target:10,stat:'sessions'},
 {id:'maratonista',name:'Maratonista',description:'Conclua 50 sessões.',icon:'mountain',tier:'ouro',target:50,stat:'sessions'},
 {id:'gabaritou',name:'Gabaritou',description:'Acerte tudo em uma sessão com 3+ perguntas.',icon:'star',tier:'bronze',target:1,stat:'perfect'},
 {id:'mira-certeira',name:'Mira certeira',description:'Gabarite 10 sessões.',icon:'crosshair',tier:'ouro',target:10,stat:'perfect'},
 {id:'em-chamas',name:'Em chamas',description:'Estude 3 dias seguidos.',icon:'flame',tier:'bronze',target:3,stat:'bestStreak'},
 {id:'imparavel',name:'Imparável',description:'Estude 7 dias seguidos.',icon:'flame',tier:'prata',target:7,stat:'bestStreak'},
 {id:'lenda',name:'Lenda da órbita',description:'Estude 30 dias seguidos.',icon:'crown',tier:'ouro',target:30,stat:'bestStreak'},
 {id:'relampago',name:'Relâmpago',description:'Conclua 5 missões Fast.',icon:'zap',tier:'prata',target:5,stat:'fast'},
 {id:'versatil',name:'Versátil',description:'Pratique Flashcards, Quiz, Simulado e Fast.',icon:'compass',tier:'prata',target:4,stat:'modes'},
 {id:'centena',name:'Centena',description:'Acumule 100 acertos.',icon:'check',tier:'prata',target:100,stat:'correct'},
 {id:'mil-xp',name:'Mil XP',description:'Acumule 1.000 XP.',icon:'gem',tier:'ouro',target:1000,stat:'xp'},
 {id:'coruja',name:'Coruja',description:'Estude entre 22h e 5h.',icon:'moon',tier:'bronze',target:1,stat:'night'},
 {id:'madrugador',name:'Madrugador',description:'Estude entre 5h e 8h.',icon:'sunrise',tier:'bronze',target:1,stat:'early'},
 {id:'foco',name:'Foco no alvo',description:'Conclua seu primeiro objetivo.',icon:'target',tier:'bronze',target:1,stat:'goals'},
 {id:'conquistador',name:'Conquistador',description:'Conclua 5 objetivos.',icon:'trophy',tier:'ouro',target:5,stat:'goals'},
];
export type MedalStatus=MedalDef&{progress:number,unlockedAt:string|null};

/** Situação de cada medalha, com a data em que foi desbloqueada (reproduzindo o histórico em ordem). */
export function medalStatus(sessions:RewardSession[],goals:Goal[]):MedalStatus[]{
 const events=[...sessions.map(s=>({at:s.createdAt,s})),...goals.filter(g=>g.completedAt).map(g=>({at:g.completedAt!,s:null as RewardSession|null}))].sort((a,b)=>a.at.localeCompare(b.at));
 const stats:Stats={sessions:0,perfect:0,fast:0,modes:0,correct:0,xp:0,bestStreak:0,night:0,early:0,goals:0};
 const modes=new Set<string>(),unlocked:Record<string,string>={};let lastDay='',run=0;
 for(const {at,s} of events){
 if(s){
 stats.sessions++;stats.correct+=s.correct;stats.xp+=s.xp;if(isPerfect(s))stats.perfect++;if(s.mode==='Fast')stats.fast++;
 if(['Flashcards','Quiz','Simulado','Fast'].includes(s.mode)){modes.add(s.mode);stats.modes=modes.size}
 const h=hourOf(at);if(h>=22||h<5)stats.night++;else if(h<8)stats.early++;
 const day=dayKey(at);if(day!==lastDay){run=lastDay&&shiftDay(lastDay,1)===day?run+1:1;lastDay=day;stats.bestStreak=Math.max(stats.bestStreak,run)}
 }else stats.goals++;
 for(const m of MEDALS)if(!unlocked[m.id]&&stats[m.stat]>=m.target)unlocked[m.id]=at;
 }
 return MEDALS.map(m=>({...m,progress:Math.min(stats[m.stat],m.target),unlockedAt:unlocked[m.id]||null}));
}
