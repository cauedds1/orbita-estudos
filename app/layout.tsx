import './globals.css';
import './dark-theme.css';
export const metadata={title:'Órbita · Seu universo de estudos',description:'Seus materiais viram descobertas. Estude com missões, flashcards e desafios.'};
// Aplica o tema antes da primeira pintura: escolha salva no navegador ou, sem escolha, o tema do sistema.
const themeScript=`(function(){try{var t=localStorage.getItem('orbita-theme');var d=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=d?'dark':'light'}catch(e){}})()`;
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body>{children}</body></html>}
