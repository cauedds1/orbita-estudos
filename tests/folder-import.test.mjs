import test from 'node:test';
import assert from 'node:assert/strict';
import {planImport,cleanName,groupBySubject} from '../app/folder-import.ts';

const e=(path,size=1000)=>({path,size,file:path});

test('limpa numeração e sufixos dos nomes',()=>{
 assert.equal(cleanName('01 - Desenvolvimento Web (HTML5, CSS)'),'Desenvolvimento Web (HTML5, CSS)');
 assert.equal(cleanName('Tema 2 - conteudo completo.txt',{extension:true}),'Tema 2');
 assert.equal(cleanName('Tema 8 (Prepare) - conteúdo completo.txt',{extension:true}),'Tema 8 (Prepare)');
 assert.equal(cleanName('00 - Resumo e gabarito.md',{extension:true}),'Resumo e gabarito');
 assert.equal(cleanName('2024.pdf',{extension:true}),'2024','não apaga um nome que é só número');
});

test('cada subpasta vira uma matéria, na ordem das pastas',()=>{
 const {items,skipped}=planImport([
 e('Faculdade/LEIA-ME.md'),
 e('Faculdade/03 - Banco de Dados/Tema 10 - conteudo completo.txt'),
 e('Faculdade/03 - Banco de Dados/Tema 2 - conteudo completo.txt'),
 e('Faculdade/03 - Banco de Dados/00 - Resumo e gabarito.md'),
 e('Faculdade/01 - Desenvolvimento Web/Tema 2 - conteudo completo.txt'),
 e('Faculdade/01 - Desenvolvimento Web/Extras/Slides.pdf'),
 e('Faculdade/01 - Desenvolvimento Web/imagem.png'),
 e('Faculdade/01 - Desenvolvimento Web/grande.pdf',16*1024*1024),
 e('Faculdade/01 - Desenvolvimento Web/vazio.txt',0),
 e('Faculdade/.git/config.txt'),e('Faculdade/02 - Arquitetura/Thumbs.db'),
 ]);
 assert.deepEqual(groupBySubject(items).map(g=>[g.subject,g.items.map(i=>i.title)]),[
 ['Desenvolvimento Web',['Extras · Slides','Tema 2']],
 ['Banco de Dados',['Resumo e gabarito','Tema 2','Tema 10']],
 ]);
 assert.deepEqual(skipped.map(s=>s.reason),['arquivo de instruções','formato não suportado (use PDF, TXT ou MD)','maior que 15 MB','arquivo vazio']);
});

test('pula o que já está na biblioteca e evita títulos repetidos',()=>{
 const {items,skipped}=planImport([e('Banco/Tema 2.txt'),e('Banco/Tema 2.md'),e('Banco/Tema 3.txt')],[{title:'Tema 3',subject:'Banco'}]);
 assert.deepEqual(items.map(i=>i.title),['Tema 2 (2)','Tema 2']);
 assert.deepEqual(skipped,[{path:'Banco/Tema 3.txt',reason:'já está na biblioteca'}]);
 assert.equal(planImport([e('solto.txt')]).items[0].subject,'Geral');
});
