// Gera app/dark-theme.css a partir de app/globals.css.
// Cada regra com cor ganha uma cópia sob :root[data-theme="dark"], com as cores convertidas
// conforme o papel (fundo, borda, texto, sombra). Executado antes do build e do dev;
// um teste garante que o arquivo gerado está em dia com globals.css.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const ROOT=':root[data-theme="dark"]';
const HEX=/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b|\bwhite\b/g;

function parseHex(h){
 if(h==='white')return {r:255,g:255,b:255,a:1};
 let x=h.slice(1);if(x.length<=4)x=[...x].map(c=>c+c).join('');
 return {r:parseInt(x.slice(0,2),16),g:parseInt(x.slice(2,4),16),b:parseInt(x.slice(4,6),16),a:x.length===8?parseInt(x.slice(6,8),16)/255:1};
}
function toHsl({r,g,b}){r/=255;g/=255;b/=255;const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return {h:0,s:0,l};const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);const h=max===r?((g-b)/d+(g<b?6:0)):max===g?(b-r)/d+2:(r-g)/d+4;return {h:h*60,s,l}}
function fromHsl({h,s,l}){const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,Math.min(9-k(n),1)));return {r:Math.round(f(0)*255),g:Math.round(f(8)*255),b:Math.round(f(4)*255)}}
function toHex({r,g,b},a=1){const p=v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0');return '#'+p(r)+p(g)+p(b)+(a<1?p(Math.round(a*255)):'')}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const isAccent=({s,l})=>s>=.3&&l>=.3&&l<=.75;

/** Converte uma cor clara do tema original para o tema escuro, conforme o papel. */
export function convert(hex,role,{keepText=false}={}){
 const c=parseHex(hex),hsl=toHsl(c);let {h,s,l}=hsl;
 if(role==='shadow')return toHex({r:0,g:0,b:0},clamp((c.a<1?c.a:.25)*1.8,.08,.6));
 if(role==='text'&&keepText)return toHex(c,c.a);
 if(role==='accent')return toHex(fromHsl({h,s,l:clamp(l+.05,0,.8)}),c.a);
 if(isAccent(hsl)){
 if(role==='text'||role==='border')l=clamp(l+.1,.66,.82);
 return toHex(fromHsl({h,s,l}),c.a);
 }
 // Superfícies que já eram escuras (faixas, botões escuros, avisos) seguem escuras, um pouco acima do fundo.
 if(role==='bg'){if(l<.3)l=clamp(.17+l*.25,.17,.24);else{s=l>.8?s*.45:s*.7;l=l>=.995?.155:.1+(1-l)*.9}}
 else if(role==='border'){s*=.5;l=.2+(1-l)*.9}
 // Texto branco só existe sobre superfícies escuras ou de destaque, que são mantidas; por isso continua branco.
 else{if(l>.9)return toHex(c,c.a);s*=.8;l=.92-l*.45}
 return toHex(fromHsl({h,s,l}),c.a);
}

const VAR_ROLES={'--bg':'bg','--lilac':'bg','--peach':'bg','--mint':'bg','--border':'border','--ink':'text','--muted':'text','--purple':'accent','--purple-dark':'accent'};
function roleOf(prop){
 if(VAR_ROLES[prop])return VAR_ROLES[prop];
 if(/shadow$/.test(prop))return 'shadow';
 if(/^(border|outline)/.test(prop))return 'border';
 if(/^background/.test(prop))return 'bg';
 return 'text';
}

/** Leitor mínimo de CSS: regras soltas e blocos @media (sem aninhamento além disso). */
function parse(css){
 css=css.replace(/\/\*[\s\S]*?\*\//g,'');const out=[];let i=0;
 const block=()=>{let depth=1,start=i;while(i<css.length&&depth){if(css[i]==='{')depth++;else if(css[i]==='}')depth--;i++}return css.slice(start,i-1)};
 const rules=(text,media)=>{let j=0;while(j<text.length){const open=text.indexOf('{',j);if(open<0)break;const close=text.indexOf('}',open);out.push({media,selector:text.slice(j,open).trim(),body:text.slice(open+1,close)});j=close+1}};
 while(i<css.length){
 const ch=css[i];if(/\s/.test(ch)){i++;continue}
 if(css.startsWith('@import',i)){i=css.indexOf(';',css.indexOf(')',i))+1;continue}
 const open=css.indexOf('{',i);if(open<0)break;const prelude=css.slice(i,open).trim();i=open+1;const body=block();
 if(prelude.startsWith('@media'))rules(body,prelude);
 else if(prelude.startsWith('@'))continue;
 else out.push({media:null,selector:prelude,body});
 }
 return out;
}

const prefix=sel=>sel.split(',').map(x=>{x=x.trim();if(x===':root'||x==='html')return ROOT;return x.startsWith(':root')?ROOT+x.slice(5):ROOT+' '+x}).join(',');

export function generate(css){
 const groups=new Map();
 for(const rule of parse(css)){
 const decls=rule.body.split(';').map(d=>d.trim()).filter(Boolean).map(d=>{const k=d.indexOf(':');return [d.slice(0,k).trim(),d.slice(k+1).trim()]});
 // Sobre um fundo de destaque mantido (ex.: botão roxo ou amarelo), o texto da regra também é mantido.
 const accentBg=decls.some(([p,v])=>/^background/.test(p)&&(/var\(--purple/.test(v)||(v.match(HEX)||[]).some(h=>isAccent(toHsl(parseHex(h))))));
 const converted=decls.filter(([,v])=>{HEX.lastIndex=0;return HEX.test(v)}).map(([p,v])=>{const role=roleOf(p);const hexes=v.match(HEX)||[];if(role==='bg'&&/gradient\(/.test(v)&&hexes.some(h=>isAccent(toHsl(parseHex(h)))))return p+':'+v;
 return p+':'+v.replace(HEX,h=>convert(h,role,{keepText:accentBg}))});
 if(!converted.length)continue;
 const key=rule.media||'';if(!groups.has(key))groups.set(key,[]);groups.get(key).push(prefix(rule.selector)+'{'+converted.join(';')+'}');
 }
 let result='/* Gerado por scripts/generate-dark-theme.mjs a partir de globals.css. Não edite à mão. */\n'+ROOT+'{color-scheme:dark}\n';
 for(const [media,list] of groups)result+=media?media+'{\n'+list.join('\n')+'\n}\n':list.join('\n')+'\n';
 return result;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const source=new URL('../app/globals.css',import.meta.url),target=new URL('../app/dark-theme.css',import.meta.url);
 writeFileSync(target,generate(readFileSync(source,'utf8')));
}
