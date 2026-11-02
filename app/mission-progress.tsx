export default function MissionProgress({mode,answers,correctAnswers}:{mode:string,answers:string[],correctAnswers:string[]}){
 if(mode!=='Quiz'&&mode!=='Flashcards')return null;
 let streak=0;for(let i=answers.length-1;i>=0&&answers[i]===correctAnswers[i];i--)streak++;
 const learned=answers.filter((a,i)=>a===correctAnswers[i]).length;
 const target=Math.min(3,correctAnswers.length),complete=streak>=target;
 return <aside className={'mission-progress'+(complete?' achieved':'')} aria-label="Sua missão nesta sessão"><div><span className="eyebrow">{mode==='Flashcards'?'MISSÃO MEMÓRIA':'DESAFIO DO COMBO'}</span><strong>{complete?`${streak} ${mode==='Flashcards'?'cartas lembradas':'acertos'} em sequência!`:`Conquiste ${target} ${mode==='Flashcards'?'cartas de memória':'acertos seguidos'}`}</strong><p>{complete?'Missão cumprida! Até onde você consegue chegar?':answers.length&&streak===0?'Uma nova tentativa começa agora. Use a explicação para avançar.':'Cada resposta é mais um passo. Sem cronômetro, no seu ritmo.'}</p></div><div className="mission-dots" aria-label={`${Math.min(streak,target)} de ${target} passos`}>{Array.from({length:target},(_,i)=><span key={i} className={i<streak?'lit':''}>{i<streak?'★':'☆'}</span>)}</div><small>{learned} {mode==='Flashcards'?'cartas lembradas':'conceitos acertados'} · {answers.length}/{correctAnswers.length} concluídos</small></aside>;
}
