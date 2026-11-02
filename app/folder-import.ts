// Planeja a importação de uma pasta inteira: cada subpasta de primeiro nível vira uma matéria,
// cada arquivo PDF/TXT/MD vira um material. Módulo puro, sem acesso ao navegador.

export type ImportEntry<F=unknown>={path:string,size:number,file:F};
export type ImportItem<F=unknown>={title:string,subject:string,path:string,file:F};
export type ImportSkip={path:string,reason:string};

export const MAX_FILE_BYTES=15*1024*1024;
const SUPPORTED=/\.(pdf|txt|md)$/i;
const INSTRUCTIONS=/^(leia-?me|readme)(\.[^.]+)?$/i;
const SYSTEM=/^(thumbs\.db|desktop\.ini|\.ds_store)$/i;

/** "01 - Banco de Dados" → "Banco de Dados"; "Tema 2 - conteudo completo.txt" → "Tema 2". */
export function cleanName(name:string,{extension=false}={}){
 let n=extension?name.replace(/\.[^.]+$/,''):name;
 n=n.replace(/^\s*\d+\s*[-–—._)]\s*/,'').replace(/\s*[-–—]\s*conte[uú]do\s+completo\s*$/i,'').replace(/[_\s]+/g,' ').trim();
 return n||name.trim();
}

export function planImport<F>(entries:ImportEntry<F>[],existing:{title:string,subject:string}[]=[]){
 const items:ImportItem<F>[]=[],skipped:ImportSkip[]=[];
 const taken=new Set(existing.map(m=>(m.subject+'\u0000'+m.title).toLowerCase()));const planned=new Set<string>();
 for(const e of entries){
 const parts=e.path.replace(/\\/g,'/').split('/').filter(Boolean),name=parts.at(-1)||'';
 if(!name||parts.some(p=>p.startsWith('.'))||SYSTEM.test(name))continue;
 if(INSTRUCTIONS.test(name)){skipped.push({path:e.path,reason:'arquivo de instruções'});continue}
 if(!SUPPORTED.test(name)){skipped.push({path:e.path,reason:'formato não suportado (use PDF, TXT ou MD)'});continue}
 if(!e.size){skipped.push({path:e.path,reason:'arquivo vazio'});continue}
 if(e.size>MAX_FILE_BYTES){skipped.push({path:e.path,reason:'maior que 15 MB'});continue}
 const subject=(parts.length>=3?cleanName(parts[1]):parts.length===2?cleanName(parts[0]):'Geral').slice(0,100);
 const inner=parts.slice(2,-1).map(p=>cleanName(p));
 let title=[...inner,cleanName(name,{extension:true})].join(' · ').slice(0,150);
 const key=(t:string)=>(subject+'\u0000'+t).toLowerCase();
 if(taken.has(key(title))){skipped.push({path:e.path,reason:'já está na biblioteca'});continue}
 for(let n=2;planned.has(key(title));n++)title=`${title.replace(/ \(\d+\)$/,'')} (${n})`;
 planned.add(key(title));items.push({title,subject,path:e.path,file:e.file});
 }
 const collator=new Intl.Collator('pt-BR',{numeric:true,sensitivity:'base'});
 items.sort((a,b)=>collator.compare(a.path,b.path));
 return {items,skipped};
}

export function groupBySubject<F>(items:ImportItem<F>[]){
 const groups=new Map<string,ImportItem<F>[]>();for(const i of items){if(!groups.has(i.subject))groups.set(i.subject,[]);groups.get(i.subject)!.push(i)}
 return [...groups].map(([subject,list])=>({subject,items:list}));
}
