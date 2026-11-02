export type StudyQuestion={prompt:string,answer:string,options:string[],explanation:string,source:string};
type StudyMaterial={id:string,title:string,subject:string,questions:StudyQuestion[]};
export function buildStudyPlan<T extends StudyMaterial>(materials:T[],subject:string,limit=Number.POSITIVE_INFINITY){
 const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
 const files=materials.filter(m=>m.subject===subject).sort((a,b)=>collator.compare(a.title,b.title));
 const ready=files.filter(m=>m.questions.length>0),pending=files.filter(m=>!m.questions.length);
 const questions:StudyQuestion[]=[],covered=new Set<string>();
 // Alternate files so a large first chapter cannot occupy the whole session.
 const rounds=Math.max(0,...ready.map(m=>m.questions.length));
 for(let i=0;i<rounds&&questions.length<limit;i++)for(const file of ready){
  if(questions.length>=limit)break;const q=file.questions[i];if(!q)continue;
  questions.push({...q,source:file.title+' · '+q.source});covered.add(file.id);
 }
 return {subject,files,ready,pending,questions,coveredFiles:covered.size,totalQuestions:ready.reduce((n,m)=>n+m.questions.length,0)};
}
export async function prepareSubjectMaterials<T extends StudyMaterial>(materials:T[],subject:string,generate:(material:T)=>Promise<T>,options:{shouldStop?:()=>boolean,onUpdate?:(material:T)=>void,onProgress?:(done:number,total:number)=>void}={}){
 let updated=[...materials],done=0,error='';const pending=buildStudyPlan(materials,subject).pending;
 for(const material of pending){
  if(options.shouldStop?.())break;
  try{const result=await generate(material);if(result.id!==material.id||result.subject!==subject)throw new Error('A resposta não corresponde ao arquivo selecionado.');updated=updated.map(m=>m.id===result.id?result:m);options.onUpdate?.(result);done++;options.onProgress?.(done,pending.length)}catch(e){error=e instanceof Error?e.message:'Não foi possível preparar este arquivo.';break}
 }
 return {materials:updated,plan:buildStudyPlan(updated,subject),done,total:pending.length,error,cancelled:!!options.shouldStop?.()};
}
