export type StudyQuestion={prompt:string,answer:string,options:string[],explanation:string,source:string,materialTitle?:string};
type StudyMaterial={id:string,title:string,subject:string,questions:StudyQuestion[],filename?:string|null,studyPath?:string,studyOrder?:number,text?:string};
function documentQuestions(file:StudyMaterial){
 const questions=[...file.questions];
 const pages=questions.map(q=>q.source.match(/(?:p[aá]g(?:ina)?\.?|page)\s*(\d+)/i)?.[1]).map(n=>n?Number(n):null);
 if(pages.every(n=>n!==null))return questions.map((q,i)=>({q,page:pages[i]!})).sort((a,b)=>a.page-b.page).map(x=>x.q);
 const positions=questions.map(q=>q.source.trim().length>=15&&file.text?file.text.indexOf(q.source.trim()):-1);
 if(positions.every(n=>n>=0))return questions.map((q,i)=>({q,position:positions[i]})).sort((a,b)=>a.position-b.position).map(x=>x.q);
 return questions;
}
export function buildStudyPlan<T extends StudyMaterial>(materials:T[],subject:string,limit=Number.POSITIVE_INFINITY){
 const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
 const files=materials.filter(m=>m.subject===subject).sort((a,b)=>(a.studyOrder??Number.MAX_SAFE_INTEGER)-(b.studyOrder??Number.MAX_SAFE_INTEGER)||collator.compare(a.studyPath||a.filename||a.title,b.studyPath||b.filename||b.title)||collator.compare(a.title,b.title));
 const ready=files.filter(m=>m.questions.length>0),pending=files.filter(m=>!m.questions.length);
 const questions:StudyQuestion[]=[],covered=new Set<string>();
 // Finish one chapter before the next; preserve the document's question order.
 for(const file of ready)for(const q of documentQuestions(file)){
  if(questions.length>=limit)break;
  questions.push({...q,materialTitle:file.title,source:file.title+' · '+q.source});covered.add(file.id);
 }
 return {subject,files,ready,pending,questions,coveredFiles:covered.size,totalQuestions:ready.reduce((n,m)=>n+m.questions.length,0)};
}
export function studySegment(questions:StudyQuestion[],mode:string,step=0){
 const size=mode==='Quiz'?10:30,count=Math.max(1,Math.ceil(questions.length/size));
 const selected=Math.min(Math.max(0,Math.floor(step)||0),count-1),start=selected*size;
 return {questions:questions.slice(start,start+size),count,step:selected,start,end:Math.min(start+size,questions.length)};
}
export async function prepareSubjectMaterials<T extends StudyMaterial>(materials:T[],subject:string,generate:(material:T)=>Promise<T>,options:{shouldStop?:()=>boolean,onUpdate?:(material:T)=>void,onProgress?:(done:number,total:number)=>void}={}){
 let updated=[...materials],done=0,error='';const pending=buildStudyPlan(materials,subject).pending;
 for(const material of pending){
  if(options.shouldStop?.())break;
  try{const result=await generate(material);if(result.id!==material.id||result.subject!==subject)throw new Error('A resposta não corresponde ao arquivo selecionado.');updated=updated.map(m=>m.id===result.id?result:m);options.onUpdate?.(result);done++;options.onProgress?.(done,pending.length)}catch(e){error=e instanceof Error?e.message:'Não foi possível preparar este arquivo.';break}
 }
 return {materials:updated,plan:buildStudyPlan(updated,subject),done,total:pending.length,error,cancelled:!!options.shouldStop?.()};
}
