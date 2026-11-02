'use client';
import {useEffect,useRef,useState} from 'react';
import {Compass,Target,RotateCcw,Zap,BookOpen,Sparkles,CalendarDays,CheckCircle2,Circle,Clock3,ArrowRight,LoaderCircle,Send,Trash2,MessageCircle,Repeat,Folders,FileText,Plus} from 'lucide-react';
import {recommendations,materialsOf,materialProgress,pendingMistakes,subjectStats,examPace,subjectsOverview,type GuideMaterial,type GuideSession,type GuideExam,type GuideQuestion,type Recommendation,type MaterialState} from '../lib/study-guide';

type Material=GuideMaterial&{type?:string};
type ChatMessage={role:'user'|'assistant',content:string,at:string,turnId?:string,sources?:string[]};
async function request(path:string,data?:any,method?:string){const r=await fetch('/api/'+path,{method:method||(data?'POST':'GET'),headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{})});const d:any=await r.json();if(!r.ok)throw new Error(d.error||'Não foi possível concluir.');return d}
const pct=(v:number|null)=>v===null?'—':Math.round(v*100)+'%';
const stateLabel:Record<MaterialState,string>={novo:'Não iniciado',praticar:'Precisa de prática',revisar:'Hora de revisar',dominado:'Dominado'};
const recIcon:Record<Recommendation['kind'],any>={mistakes:RotateCcw,exam:CalendarDays,practice:Target,new:BookOpen,generate:Sparkles,review:Repeat,done:CheckCircle2};

/** Renderiza o texto do tutor com parágrafos, listas e negrito simples, sem HTML vindo da IA. */
function RichText({text}:{text:string}){
 const inline=(line:string)=>line.split(/(\*\*[^*]+\*\*)/g).map((part,i)=>part.startsWith('**')&&part.endsWith('**')?<b key={i}>{part.slice(2,-2)}</b>:part);
 const blocks:React.ReactNode[]=[];let list:string[]=[];
 const flush=()=>{if(list.length){blocks.push(<ul key={blocks.length}>{list.map((l,i)=><li key={i}>{inline(l)}</li>)}</ul>);list=[]}};
 for(const raw of text.split('\n')){const line=raw.trim();const item=line.match(/^(?:[-*•]|\d+[.)])\s+(.*)$/);
 if(item){list.push(item[1]);continue}flush();if(!line)continue;
 const heading=line.match(/^#{1,4}\s+(.*)$/);blocks.push(heading?<h4 key={blocks.length}>{inline(heading[1])}</h4>:<p key={blocks.length}>{inline(line)}</p>)}
 flush();return <>{blocks}</>;
}

export function SubjectPicker({materials,sessions,exams,current,onPick,compact=false}:{materials:Material[],sessions:GuideSession[],exams:GuideExam[],current?:string|null,onPick:(subject:string)=>void,compact?:boolean}){
 const overview=subjectsOverview(materials,sessions,exams);if(!overview.length)return null;
 return <section className={'subject-picker'+(compact?' compact':'')}><div className="section-heading"><div><h2>{compact?'Trocar de matéria':'O que você vai estudar agora?'}</h2><p className="muted">Escolha uma matéria. O app passa a orientar seus estudos só nela.</p></div></div>
 <div className="subject-grid">{overview.map(o=>{const progress=o.materials?o.mastered/o.materials:0;return <button key={o.subject} className={'subject-card'+(current&&current.toLowerCase()===o.subject.toLowerCase()?' current':'')} onClick={()=>onPick(o.subject)}>
 <div className="subject-card-top"><span className="mini-icon lilac"><Folders size={20}/></span>{o.nextExam&&<span className={'pill'+(o.nextExam.daysLeft<=7?' urgent':'')}>PROVA {o.nextExam.daysLeft===0?'HOJE':`EM ${o.nextExam.daysLeft} ${o.nextExam.daysLeft===1?'DIA':'DIAS'}`}</span>}</div>
 <h3>{o.subject}</h3><p>{o.materials} {o.materials===1?'material':'materiais'} · {o.practiced} praticados · acertos {pct(o.accuracy)}</p>
 <div className="progress-track"><span style={{width:progress*100+'%'}}/></div><small>{o.mastered} de {o.materials} dominados</small>
 <span className="subject-card-cta">{current&&current.toLowerCase()===o.subject.toLowerCase()?'Estudando agora':'Estudar esta matéria'} <ArrowRight size={15}/></span></button>})}</div></section>;
}

function SubjectTutor({subject,ai}:{subject:string,ai:boolean}){
 const [messages,setMessages]=useState<ChatMessage[]>([]),[text,setText]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const end=useRef<HTMLDivElement>(null);
 useEffect(()=>{let live=true;setLoading(true);setError('');setMessages([]);request('subject-chat?subject='+encodeURIComponent(subject)).then(d=>{if(live)setMessages(d.messages)}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[subject]);
 useEffect(()=>{end.current?.scrollIntoView({block:'nearest'})},[messages.length,busy]);
 async function send(message:string){message=message.trim();if(!message||busy)return;setBusy(true);setError('');setText('');const turnId=crypto.randomUUID();setMessages(v=>[...v,{role:'user',content:message,at:new Date().toISOString(),turnId}]);
 try{const d=await request('subject-chat',{subject,message,turnId});setMessages(d.messages)}catch(e:any){setError(e.message);setMessages(v=>v.filter(m=>m.turnId!==turnId));setText(message)}finally{setBusy(false)}}
 async function clear(){try{await request('subject-chat',{subject},'DELETE');setMessages([])}catch(e:any){setError(e.message)}}
 const suggestions=['Por onde eu começo nesta matéria?','Resuma os pontos mais importantes','Me faça uma pergunta para testar o que sei','Explique o conceito mais difícil com um exemplo'];
 return <section className="panel tutor-panel"><div className="tutor-head"><span className="mini-icon mint"><MessageCircle size={20}/></span><div><h3>Tutor da matéria</h3><p className="muted">Responde com base nos seus materiais de {subject}.</p></div>{messages.length>0&&<button className="icon-button" aria-label="Limpar conversa" title="Limpar conversa" disabled={busy} onClick={clear}><Trash2 size={16}/></button>}</div>
 <div className="tutor-messages">{loading?<p className="muted tutor-empty"><LoaderCircle size={15} className="spin"/> Carregando conversa…</p>:!messages.length?<div className="tutor-empty"><p className="muted">{ai?'Pergunte qualquer coisa sobre a matéria. As respostas citam o material de onde vieram.':'Configure a chave da OpenAI para conversar com o tutor.'}</p>{ai&&<div className="tutor-suggestions">{suggestions.map(s=><button key={s} className="pill-button" onClick={()=>send(s)}>{s}</button>)}</div>}</div>:
 messages.map((m,i)=><article key={i} className={'chat-message '+m.role}><span className="chat-person">{m.role==='user'?'VOCÊ':'TUTOR'}</span><div className="rich-text"><RichText text={m.content}/></div>{m.sources&&m.sources.length>0&&<small className="tutor-sources"><FileText size={12}/>Consultou: {m.sources.join(' · ')}</small>}</article>)}
 {busy&&<article className="chat-message assistant"><span className="chat-person">TUTOR</span><p className="chat-thinking"><LoaderCircle size={15} className="spin"/>Lendo seus materiais…</p></article>}<div ref={end}/></div>
 {error&&<p className="import-error">{error}</p>}
 <form className="tutor-form" onSubmit={e=>{e.preventDefault();send(text)}}><textarea rows={2} maxLength={4000} placeholder={`Pergunte sobre ${subject}…`} value={text} disabled={!ai} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send(text)}}}/><button className="button primary" disabled={!ai||busy||!text.trim()} aria-label="Enviar pergunta"><Send size={16}/></button></form></section>;
}

export function FocusPanel({subject,materials,sessions,exams,ai,onPractice,onFast,onOpen,onReviewMistakes,onAddMaterial}:{subject:string,materials:Material[],sessions:GuideSession[],exams:GuideExam[],ai:boolean,onPractice:(m:Material)=>void,onFast:(m?:Material)=>void,onOpen:(m:Material)=>void,onReviewMistakes:(questions:GuideQuestion[])=>void,onAddMaterial:()=>void}){
 const list=materialsOf(subject,materials) as Material[],stats=subjectStats(subject,materials,sessions),pace=examPace(subject,materials,sessions,exams),mistakes=pendingMistakes(subject,materials,sessions);
 const recs=recommendations(subject,materials,sessions,exams),byId=new Map(list.map(m=>[m.id,m]));
 function act(r:Recommendation){const m=r.materialId?byId.get(r.materialId):undefined;
 if(r.kind==='mistakes')return onReviewMistakes(mistakes);if(r.kind==='exam'||r.kind==='done')return onFast(m||list[0]);if(!m)return;
 if(r.kind==='generate'||!m.questions.length)return onOpen(m);onPractice(m)}
 const cta:Record<Recommendation['kind'],string>={mistakes:'Revisar agora',exam:'Começar missão Fast',practice:'Praticar',new:'Começar',generate:'Preparar desafios',review:'Revisar',done:'Missão Fast'};
 const [first,...others]=recs;const FirstIcon=first?recIcon[first.kind]:Compass;
 return <div className="focus-panel">
 <div className="focus-top">{first?<section className="next-step"><p className="eyebrow"><Compass size={14}/> SEU PRÓXIMO PASSO</p><div className="next-step-body"><span className="next-step-icon"><FirstIcon size={28}/></span><div><h2>{first.title}</h2><p>{first.reason}</p></div></div><button className="button primary" onClick={()=>act(first)}>{cta[first.kind]} <ArrowRight size={17}/></button></section>:<section className="next-step"><p className="eyebrow">SEU PRÓXIMO PASSO</p><h2>Adicione materiais a esta matéria</h2><button className="button primary" onClick={onAddMaterial}><Plus size={17}/>Adicionar material</button></section>}
 <section className="panel focus-stats"><div className="focus-stat-grid"><div><b>{pct(stats.accuracy)}</b><span>acertos</span></div><div><b>{stats.practiced}<small>/{stats.materials}</small></b><span>praticados</span></div><div><b>{stats.mastered}</b><span>dominados</span></div><div><b>{stats.sessions}</b><span>sessões</span></div></div>
 {pace?<div className={'exam-pace'+(pace.exam.daysLeft<=7?' urgent':'')}><CalendarDays size={16}/><span><b>{pace.exam.title}</b> {pace.exam.daysLeft===0?'é hoje':`em ${pace.exam.daysLeft} ${pace.exam.daysLeft===1?'dia':'dias'}`}{pace.remaining?` · ${pace.perDay} ${pace.perDay===1?'material':'materiais'} por dia para cobrir tudo`:' · tudo dominado'}</span></div>:<div className="exam-pace muted"><CalendarDays size={16}/><span>Cadastre a data da prova em Minhas provas para ver o ritmo ideal.</span></div>}
 <button className="text-link" onClick={()=>onFast(list[0])}><Zap size={15}/>Missão Fast desta matéria <ArrowRight size={15}/></button></section></div>
 {others.length>0&&<div className="rec-list">{others.map(r=>{const Icon=recIcon[r.kind];return <button key={r.id} className="rec-item" onClick={()=>act(r)}><span className="mini-icon lilac"><Icon size={18}/></span><div><b>{r.title}</b><small>{r.reason}</small></div><ArrowRight size={16}/></button>})}</div>}
 <div className="focus-columns"><section className="panel roadmap"><div className="tutor-head"><span className="mini-icon peach"><BookOpen size={20}/></span><div><h3>Roteiro da matéria</h3><p className="muted">Domine cada material com {Math.round(.8*100)}% de acertos.</p></div></div>
 <ol>{list.map(m=>{const p=materialProgress(m,sessions);return <li key={m.id} className={'roadmap-item '+p.state}><span className="roadmap-dot">{p.state==='dominado'?<CheckCircle2 size={18}/>:p.state==='novo'?<Circle size={18}/>:<Clock3 size={18}/>}</span><button className="roadmap-title" onClick={()=>onOpen(m)}><b>{m.title}</b><small>{stateLabel[p.state]}{p.lastAccuracy!==null?` · último ${pct(p.lastAccuracy)}`:''}{p.daysSince!==null?` · ${p.daysSince===0?'hoje':p.daysSince===1?'ontem':`há ${p.daysSince} dias`}`:''}</small></button><button className="button secondary small-button" onClick={()=>m.questions.length?onPractice(m):onOpen(m)}>{m.questions.length?(p.state==='novo'?'Começar':'Praticar'):'Preparar'}</button></li>})}</ol></section>
 <SubjectTutor subject={subject} ai={ai}/></div></div>;
}

export function SubjectPerformance({materials,sessions,exams,onFocus}:{materials:Material[],sessions:GuideSession[],exams:GuideExam[],onFocus:(subject:string)=>void}){
 const overview=subjectsOverview(materials,sessions,exams);if(!overview.length)return null;
 const weakest=overview.filter(o=>o.accuracy!==null).sort((a,b)=>a.accuracy!-b.accuracy!)[0];
 return <section className="performance"><div className="section-heading"><div><h2>Desempenho por matéria</h2><p className="muted">{weakest&&weakest.accuracy!<.7?`${weakest.subject} é a que mais precisa de atenção agora.`:'Acertos, materiais praticados e dominados em cada matéria.'}</p></div></div>
 <div className="performance-list">{overview.map(o=><div key={o.subject} className="performance-row"><div className="performance-name"><b>{o.subject}</b><small>{o.sessions} {o.sessions===1?'sessão':'sessões'}{o.nextExam?` · prova em ${o.nextExam.daysLeft} ${o.nextExam.daysLeft===1?'dia':'dias'}`:''}</small></div>
 <div className="performance-bar"><div className="progress-track"><span className={o.accuracy!==null&&o.accuracy<.7?'weak':''} style={{width:(o.accuracy??0)*100+'%'}}/></div><small>{pct(o.accuracy)} de acertos</small></div>
 <div className="performance-count"><b>{o.practiced}/{o.materials}</b><small>praticados</small></div><div className="performance-count"><b>{o.mastered}</b><small>dominados</small></div>
 <button className="button secondary small-button" onClick={()=>onFocus(o.subject)}>Estudar</button></div>)}</div></section>;
}
