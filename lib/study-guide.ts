// Guia de estudos por matéria: situação de cada material, números da matéria, erros pendentes,
// recomendações de próximo passo e ritmo até a prova. Módulo puro, usado pela interface e pelos testes.
// Mesmo fuso de lib/rewards.ts (mantido local para o módulo rodar sozinho nos testes).
const dayKey=(d:Date|string)=>new Date(d).toLocaleDateString('en-CA',{timeZone:'America/Sao_Paulo'});

export type GuideQuestion={prompt:string,answer:string,options:string[],explanation:string,source:string};
export type GuideMaterial={id:string,title:string,subject:string,questions:GuideQuestion[]};
export type GuideSession={materialId:string,subject?:string|null,mode:string,total:number,correct:number,createdAt:string,mistakes?:GuideQuestion[],asked?:string[]};
export type GuideExam={id:string,title:string,subject:string,date:string};
export type MaterialState='novo'|'praticar'|'revisar'|'dominado';
export type MaterialProgress={state:MaterialState,sessions:number,lastAccuracy:number|null,bestAccuracy:number|null,lastStudied:string|null,daysSince:number|null};
export type Recommendation={id:string,kind:'mistakes'|'exam'|'practice'|'new'|'generate'|'review'|'done',title:string,reason:string,materialId?:string};

export const MASTERY=.8;
export const WEAK=.7;
export const REVIEW_AFTER_DAYS=7;
const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
const sameSubject=(a:string,b:string)=>a.trim().toLowerCase()===b.trim().toLowerCase();
const daysBetween=(from:string,to:string)=>Math.round((Date.parse(to+'T12:00:00Z')-Date.parse(from+'T12:00:00Z'))/86400000);
const byDate=(a:GuideSession,b:GuideSession)=>a.createdAt.localeCompare(b.createdAt);

export function materialsOf(subject:string,materials:GuideMaterial[]){return materials.filter(m=>sameSubject(m.subject,subject)).sort((a,b)=>collator.compare(a.title,b.title))}
/** Sessões da matéria: pela matéria gravada na sessão ou, em sessões antigas, pelo material. */
export function sessionsOf(subject:string,materials:GuideMaterial[],sessions:GuideSession[]){
 const ids=new Set(materialsOf(subject,materials).map(m=>m.id));
 return sessions.filter(s=>s.subject?sameSubject(s.subject,subject):ids.has(s.materialId)).sort(byDate);
}

/**
 * Resultados que contam para um material: as sessões dele e, nas sessões da matéria inteira
 * (perguntas misturadas de vários arquivos), a parte das perguntas que veio deste material,
 * quando caíram pelo menos 3 delas (ou todas, se ele tiver menos).
 */
function resultsFor(material:GuideMaterial,sessions:GuideSession[]){
 const prompts=new Set(material.questions.map(q=>q.prompt)),min=Math.min(3,prompts.size);
 const results:{correct:number,total:number,createdAt:string}[]=[];
 for(const s of sessions){
 if(s.materialId===material.id){if(s.total>0)results.push(s);continue}
 if(!min||!s.asked?.length||!isMixed(s))continue;
 const asked=s.asked.filter(p=>prompts.has(p));if(asked.length<min)continue;
 const wrong=new Set((s.mistakes||[]).map(q=>q.prompt).filter(p=>prompts.has(p)));
 results.push({correct:asked.length-wrong.size,total:asked.length,createdAt:s.createdAt});
 }
 return results.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
}
// Sessões de matéria inteira ou de revisão misturam perguntas de vários materiais.
const isMixed=(s:GuideSession)=>/^(subject|review):/.test(s.materialId)||s.materialId==='review';

export function materialProgress(material:GuideMaterial,sessions:GuideSession[],now=new Date()):MaterialProgress{
 const own=resultsFor(material,sessions);
 if(!own.length)return {state:'novo',sessions:0,lastAccuracy:null,bestAccuracy:null,lastStudied:null,daysSince:null};
 const last=own.at(-1)!,lastAccuracy=last.correct/last.total,bestAccuracy=Math.max(...own.map(s=>s.correct/s.total));
 const daysSince=daysBetween(dayKey(last.createdAt),dayKey(now));
 const state:MaterialState=lastAccuracy<WEAK?'praticar':daysSince>REVIEW_AFTER_DAYS?'revisar':lastAccuracy>=MASTERY?'dominado':'praticar';
 return {state,sessions:own.length,lastAccuracy,bestAccuracy,lastStudied:last.createdAt,daysSince};
}

/**
 * Erros ainda não corrigidos na matéria. Cada pergunta é acompanhada em ordem cronológica:
 * errar marca como pendente; ser feita de novo sem erro (em qualquer sessão: do material,
 * da matéria inteira ou da revisão) resolve. Sessões antigas, sem a lista de perguntas feitas,
 * contam como tendo refeito todas as perguntas do material.
 */
export function pendingMistakes(subject:string,materials:GuideMaterial[],sessions:GuideSession[]){
 const list=materialsOf(subject,materials),byId=new Map(list.map(m=>[m.id,m])),owner=new Map<string,string>();
 for(const m of list)for(const q of m.questions)if(!owner.has(q.prompt))owner.set(q.prompt,m.id);
 const state=new Map<string,{wrong:boolean,q?:GuideQuestion,materialId:string}>();
 for(const s of sessionsOf(subject,materials,sessions)){
 const material=byId.get(s.materialId);
 if(!s.asked&&material){for(const [p,v] of state)if(v.materialId===material.id)state.delete(p);for(const q of material.questions)state.set(q.prompt,{wrong:false,materialId:material.id})}
 for(const p of s.asked||[])state.set(p,{wrong:false,materialId:material?.id||owner.get(p)||''});
 for(const q of s.mistakes||[])if(q?.prompt)state.set(q.prompt,{wrong:true,q,materialId:material?.id||owner.get(q.prompt)||''});
 }
 const order=new Map(list.map((m,i)=>[m.id,i]));
 return [...state.values()].filter(v=>v.wrong&&v.q).map((v,i)=>({...v.q!,materialId:v.materialId,i})).sort((a,b)=>(order.get(a.materialId)??1e9)-(order.get(b.materialId)??1e9)||a.i-b.i).map(({i,...q})=>q);
}

export function nextExam(subject:string,exams:GuideExam[],now=new Date()){
 const today=dayKey(now);const exam=exams.filter(e=>sameSubject(e.subject,subject)&&e.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0];
 return exam?{...exam,daysLeft:daysBetween(today,exam.date)}:null;
}

export function subjectStats(subject:string,materials:GuideMaterial[],sessions:GuideSession[],now=new Date()){
 const list=materialsOf(subject,materials),own=sessionsOf(subject,materials,sessions),progress=list.map(m=>materialProgress(m,sessions,now));
 const total=own.reduce((n,s)=>n+s.total,0),correct=own.reduce((n,s)=>n+s.correct,0);
 return {subject,materials:list.length,practiced:progress.filter(p=>p.state!=='novo').length,mastered:progress.filter(p=>p.state==='dominado').length,
 sessions:own.length,questions:total,accuracy:total?correct/total:null,lastStudied:own.at(-1)?.createdAt||null};
}

/** Quantos materiais por dia, até a prova, para cobrir o que ainda não está dominado. */
export function examPace(subject:string,materials:GuideMaterial[],sessions:GuideSession[],exams:GuideExam[],now=new Date()){
 const exam=nextExam(subject,exams,now);if(!exam)return null;
 const remaining=materialsOf(subject,materials).filter(m=>materialProgress(m,sessions,now).state!=='dominado').length;
 const days=Math.max(exam.daysLeft,1);return {exam,remaining,perDay:remaining?Math.ceil(remaining/days):0};
}

const pct=(v:number)=>Math.round(v*100)+'%';
export function recommendations(subject:string,materials:GuideMaterial[],sessions:GuideSession[],exams:GuideExam[],now=new Date(),limit=4):Recommendation[]{
 const list=materialsOf(subject,materials);if(!list.length)return [];
 const rows=list.map(m=>({m,p:materialProgress(m,sessions,now)}));
 const mistakes=pendingMistakes(subject,materials,sessions),exam=nextExam(subject,exams,now);
 const weak=rows.filter(r=>r.p.state==='praticar').sort((a,b)=>(a.p.lastAccuracy??0)-(b.p.lastAccuracy??0));
 const fresh=rows.filter(r=>r.p.state==='novo'),stale=rows.filter(r=>r.p.state==='revisar').sort((a,b)=>(b.p.daysSince??0)-(a.p.daysSince??0));
 const recs:Recommendation[]=[];
 const examRec=():Recommendation|null=>{if(!exam||exam.daysLeft>14)return null;const target=(weak[0]||fresh.find(r=>r.m.questions.length)||stale[0]||rows[0]).m;const left=rows.filter(r=>r.p.state!=='dominado').length;
 return {id:'exam',kind:'exam',materialId:target.id,title:exam.daysLeft===0?`Prova hoje: revisão Fast de ${target.title}`:`Prova em ${exam.daysLeft} ${exam.daysLeft===1?'dia':'dias'}: missão Fast`,reason:`${exam.title} · ${left?`${left} ${left===1?'material ainda precisa':'materiais ainda precisam'} de atenção`:'todos os materiais estão em dia'}. Comece por ${target.title}.`}};
 const urgent=exam&&exam.daysLeft<=7?examRec():null;if(urgent)recs.push(urgent);
 if(mistakes.length)recs.push({id:'mistakes',kind:'mistakes',title:`Refazer ${mistakes.length} ${mistakes.length===1?'pergunta errada':'perguntas erradas'}`,reason:'Voltar ao que você errou fixa mais do que reler o conteúdo.'});
 for(const r of weak.slice(0,2))recs.push({id:'practice:'+r.m.id,kind:'practice',materialId:r.m.id,title:`Praticar de novo: ${r.m.title}`,reason:`Último resultado: ${pct(r.p.lastAccuracy!)} de acertos. A meta é ${pct(MASTERY)}.`});
 const ready=fresh.find(r=>r.m.questions.length),unprepared=rows.filter(r=>!r.m.questions.length);
 if(ready)recs.push({id:'new:'+ready.m.id,kind:'new',materialId:ready.m.id,title:`Começar: ${ready.m.title}`,reason:`${fresh.length===1?'É o único material':`É o próximo dos ${fresh.length} materiais`} ainda não praticados.`});
 // Vários arquivos sem desafios: preparar todos de uma vez, depois praticar a matéria inteira.
 if(unprepared.length>=2)recs.push({id:'generate-all',kind:'generate',title:`Preparar os ${unprepared.length} materiais da matéria`,reason:'A IA cria as perguntas de todos os arquivos que faltam, um por vez. Depois você pratica a matéria inteira, misturando os temas.'});
 else if(unprepared.length===1&&!ready)recs.push({id:'generate:'+unprepared[0].m.id,kind:'generate',materialId:unprepared[0].m.id,title:`Preparar: ${unprepared[0].m.title}`,reason:'A IA cria perguntas a partir deste material para você praticar.'});
 if(stale[0])recs.push({id:'review:'+stale[0].m.id,kind:'review',materialId:stale[0].m.id,title:`Revisar: ${stale[0].m.title}`,reason:`Estudado há ${stale[0].p.daysSince} dias. Revisar agora ajuda a não esquecer.`});
 if(!urgent){const later=examRec();if(later)recs.push(later)}
 const unique=recs.filter((r,i)=>!r.materialId||r.kind==='exam'||recs.findIndex(x=>x.materialId===r.materialId&&x.kind!=='exam')===i);
 if(!unique.length)return [{id:'done',kind:'done',title:'Tudo em dia nesta matéria',reason:'Faça uma missão Fast para manter o ritmo, ou escolha outra matéria.'}];
 return unique.slice(0,limit);
}

export function subjectsOverview(materials:GuideMaterial[],sessions:GuideSession[],exams:GuideExam[],now=new Date()){
 const names=[...new Map(materials.map(m=>[m.subject.trim().toLowerCase(),m.subject])).values()].sort(collator.compare);
 return names.map(name=>({...subjectStats(name,materials,sessions,now),nextExam:nextExam(name,exams,now)}));
}
