import './globals.css';
export const metadata={title:'Órbita · Seu universo de estudos',description:'Seus materiais viram descobertas. Estude com missões, flashcards e desafios.',icons:{icon:[{url:'/favicon.ico',sizes:'16x16 32x32 48x48',type:'image/x-icon'},{url:'/favicon.svg',sizes:'any',type:'image/svg+xml'}],apple:[{url:'/apple-touch-icon.png',sizes:'180x180',type:'image/png'}]}};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
