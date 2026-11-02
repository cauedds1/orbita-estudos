import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generate,convert} from '../scripts/generate-dark-theme.mjs';

test('app/dark-theme.css está em dia com globals.css',()=>{
 assert.equal(readFileSync('app/dark-theme.css','utf8'),generate(readFileSync('app/globals.css','utf8')),'Execute node scripts/generate-dark-theme.mjs');
});
test('conversão de cores: fundo claro escurece, texto escuro clareia, destaque mantém o tom',()=>{
 const L=h=>{const n=parseInt(h.slice(1,7),16);return (Math.max(n>>16,n>>8&255,n&255)+Math.min(n>>16,n>>8&255,n&255))/510};
 assert.ok(L(convert('#ffffff','bg'))<.2);assert.ok(L(convert('#292933','text'))>.8);
 assert.ok(L(convert('#eae9ee','border'))>L(convert('#ffffff','bg')),'borda mais clara que o cartão');
 assert.equal(convert('#7760cd','bg'),'#7760cd');assert.match(convert('#7760cd15','shadow'),/^#000000/);
 assert.equal(convert('#ffffff','text',{keepText:true}),'#ffffff');
});
const css=generate(':root{--bg:#fafaf8}.a{color:#292933;background:#fff}@media(max-width:5px){.b,.c:hover{border:1px solid #eee}}.d{margin:0}@keyframes x{to{color:#000}}');
test('gera seletores com prefixo, inclusive dentro de @media',()=>{
 assert.match(css,/:root\[data-theme="dark"\]\{--bg:#/);assert.match(css,/:root\[data-theme="dark"\] \.a\{color:#[0-9a-f]{6};background:#/);
 assert.match(css,/@media\(max-width:5px\)\{\n:root\[data-theme="dark"\] \.b,:root\[data-theme="dark"\] \.c:hover\{border:1px solid #/);
 assert.doesNotMatch(css,/\.d\{/);assert.doesNotMatch(css,/keyframes/);
});
