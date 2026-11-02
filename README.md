# Órbita — pronta para Railway

Plataforma de estudos com materiais PDF/texto, modo Fast, flashcards, quizzes, simulados, temas gerados com IA e chat de estudo.

## Deploy no Railway

1. Crie um serviço a partir de `cauedds1/orbita-estudos`, branch `main`. O Railway usa o `Dockerfile` e o `railway.json` deste repositório.
2. **Anexe um volume persistente ao serviço (sugestão: montado em `/data`) antes de iniciar.** Banco SQLite, contas, sessões, conversas e arquivos ficam juntos nesse volume. Sem volume a aplicação recusa iniciar no Railway, para evitar perda silenciosa dos dados.
3. Nas variáveis do serviço, configure:

| Variável | Valor |
| --- | --- |
| `ADMIN_EMAIL` | Seu e-mail para a primeira conta |
| `ADMIN_PASSWORD` | Uma senha própria com 12 a 128 caracteres |
| `OPENAI_API_KEY` | Sua chave OpenAI, marcada como segredo |
| `OPENAI_MODEL` | `gpt-4.1-mini`, ou outro modelo compatível com Responses, PDFs e saída estruturada |
| `ALLOW_SIGNUP` | `false` para acesso privado; `true` somente se quiser permitir novos cadastros |
| `APP_URL` | Opcional. URL pública completa, por exemplo `https://seu-servico.up.railway.app`. Se usar domínio próprio, coloque aqui o domínio pelo qual os usuários acessam |

4. Faça o deploy e gere um domínio público em *Settings → Networking* do serviço. Não é preciso definir `APP_URL`: a origem é conferida pelos cabeçalhos `Host`/`X-Forwarded-Proto` enviados pelo proxy do Railway.
5. Acesse o domínio e entre com `ADMIN_EMAIL` e `ADMIN_PASSWORD`.

O banco fica no caminho do volume (`RAILWAY_VOLUME_MOUNT_PATH`, injetado pelo Railway); `DATA_DIR` só é necessário para usar uma subpasta dentro do volume. Não sobrescreva o comando de inicialização do Docker: ele inicializa o banco e a conta antes do servidor. `PORT` é fornecida pelo Railway; o servidor escuta em `0.0.0.0`. A checagem de saúde é `GET /api/health`.

Use **uma réplica e um único serviço** com este volume SQLite. Para escalar em múltiplas réplicas, adapte a persistência para PostgreSQL e armazenamento de objetos. Configure os backups do volume no Railway: o volume mantém os dados entre deploys, mas não substitui backup.

### Conta e segurança

A primeira conta é criada somente quando o banco está vazio. Alterar `ADMIN_PASSWORD` depois não redefine uma conta já existente. As senhas são armazenadas com scrypt e salt; os cookies de sessão são HttpOnly, SameSite e Secure em produção. A sessão expira em 7 dias. As operações verificam a conta no servidor, sem confiar em cabeçalhos de identidade enviados pelo cliente. Dez tentativas incorretas em 15 minutos limitam novos logins daquela conta.

O cadastro público fica desligado por padrão. Não há serviço de e-mail ou recuperação automática de senha nesta versão: guarde a senha inicial em seu gerenciador de senhas. Nenhuma chave ou senha deve entrar no GitHub.

A chave OpenAI configurada anteriormente para o Sites não é transportada automaticamente ao Railway. Configure `OPENAI_API_KEY` no novo serviço. A chave criada no início deste projeto tinha validade de 30 dias; confirme sua validade antes de usá-la.

### Dados da versão anterior

Este deploy inicia um banco próprio. Os materiais e as conversas da publicação anterior no Sites/Cloudflare não são copiados automaticamente. O histórico de migrações `drizzle/` é preservado apenas como referência da versão anterior; as migrações do servidor atual são executadas no início e controladas por `PRAGMA user_version` em `lib/persistence.mjs`.

## Conquistas e recompensas

A aba **Conquistas**, dentro de **Meu progresso**, reúne nível, meta semanal, objetivos pessoais e medalhas. As regras ficam em `lib/rewards.ts`, compartilhadas pelo servidor e pela interface.

- **Bônus de XP** (calculados no servidor ao salvar a sessão; valores enviados pelo navegador são ignorados): gabarito perfeito com 3+ perguntas (+25), primeira sessão do dia (+10), sequência de dias (+5 por dia, até +35), meta semanal batida (+50) e objetivo concluído (+100).
- **Meta semanal**: de 1 a 21 sessões por semana (segunda a domingo, fuso de São Paulo); padrão 5.
- **Objetivos**: concluir sessões, acertar questões, ganhar XP ou gabaritar sessões, com prazo opcional. Contam somente as sessões feitas depois da criação do objetivo.
- **Níveis**: a cada 150 XP, com títulos de Explorador a Galáxia.
- **Medalhas**: 16 medalhas (bronze, prata e ouro), calculadas a partir do histórico, com a data de desbloqueio.

## Matéria em foco

No Início, o aluno escolhe **o que vai estudar agora**. Com uma matéria em foco (salva na conta), o app passa a girar em torno dela:

- **Próximo passo**: recomendação do que fazer agora, em ordem de prioridade: prova em até 7 dias (missão Fast), perguntas erradas ainda não corrigidas, materiais com menos de 70% de acertos, próximo material não iniciado (ou preparar desafios, se ainda não tiver), materiais dominados há mais de 7 dias (revisão espaçada) e prova em até 14 dias.
- **Números da matéria**: acertos, materiais praticados e dominados (80%+ no último resultado), sessões e ritmo até a prova (materiais por dia para cobrir o que falta).
- **Roteiro**: cada material com sua situação (não iniciado, precisa de prática, hora de revisar, dominado).
- **Tutor da matéria**: chat que responde com base nos materiais da matéria e cita as fontes. A cada pergunta, os trechos mais relevantes são selecionados (busca por termos), em vez de enviar todos os arquivos à IA. O texto de PDFs é extraído uma vez e guardado.
- **Matéria inteira**: Flashcards, Quiz e Simulado misturam perguntas de todos os arquivos da matéria (`app/study-plan.ts`). Essas sessões contam no roteiro: cada material recebe crédito pelas perguntas dele que caíram (com pelo menos 3, ou todas se tiver menos), e os erros entram na revisão.
- **Preparar todos**: com 2 ou mais arquivos sem desafios, o próximo passo é preparar a matéria inteira; a IA processa um arquivo por vez, com progresso e opção de parar após o arquivo atual.
- **Praticar, Modo Fast e Biblioteca** seguem a matéria em foco (o seletor de Praticar troca o foco); **Revisar erros** refaz os erros pendentes dela. Um erro sai da lista quando a pergunta é respondida certo em qualquer sessão posterior.
- Sem matéria em foco, o Início sugere continuar na última matéria estudada.
- **Meu progresso** mostra o desempenho por matéria e aponta a que mais precisa de atenção.

As regras ficam em `lib/study-guide.ts`; o tutor, em `app/api/subject-service.ts`.

## Importar pastas

Em **Adicionar material → Pasta**, escolha (ou arraste) a pasta principal. Cada subpasta vira uma matéria e cada arquivo PDF, TXT ou MD vira um material; numeração e sufixos como “- conteudo completo” são removidos dos nomes (`03 - Banco de Dados/Tema 2 - conteudo completo.txt` → “Tema 2” em “Banco de Dados”). Antes de importar aparece uma prévia por matéria. Arquivos LEIA-ME/README, de outros formatos, vazios ou com mais de 15 MB são ignorados, e os que já estão na biblioteca são pulados, então reimportar a mesma pasta não duplica nada. A regra fica em `app/folder-import.ts`.

Na biblioteca, “Todas as matérias” mostra uma seção por matéria, com os materiais em ordem natural (Tema 2, Tema 3, Tema 10).

## Modo escuro

O botão de sol/lua no topo alterna entre claro e escuro; a escolha fica salva no navegador. Sem escolha salva, o app segue o tema do sistema. O tema é aplicado antes da primeira pintura, sem piscar.

`app/dark-theme.css` é gerado por `scripts/generate-dark-theme.mjs` a partir de `app/globals.css` (fundos claros escurecem, textos escuros clareiam, cores de destaque e superfícies escuras são mantidas). Ele é regenerado automaticamente em `npm run dev` e `npm run build`; não edite o arquivo gerado. Um teste falha se ele estiver desatualizado.

## Desenvolvimento local

Requer Node.js 24 e npm.

1. Execute `npm ci`.
2. Copie `.env.example` para `.env.local` e preencha a conta inicial e a chave de IA. Não reutilize a senha de exemplo de nenhum tutorial.
3. Execute `npm run dev` e abra a URL mostrada no terminal.

Para testar o mesmo servidor de produção usado no Docker:

```sh
npm run build
npm start
```

`DATA_DIR` local usa `./data` por padrão, ignorado pelo Git. O servidor de produção usa cookies seguros; para um teste local sem HTTPS apenas, defina `COOKIE_SECURE=false`. Não use essa opção no Railway.

## Verificações

```sh
npm run typecheck
npm run build
npm test
```

Os testes criam bancos temporários em `work/`, usam contas descartáveis e um simulador local da API de IA. Não consomem créditos nem enviam dados de teste à OpenAI. Verificam autenticação, CSRF, isolamento por usuário, upload/download, geração, temas/chat, persistência após reinício e logout. O build deve ser executado antes dos testes do servidor.

## Estrutura

- `app/`: interface e rotas Next.js.
- `lib/runtime.ts`: banco e arquivos persistentes usados pelas rotas.
- `lib/persistence.mjs`: inicialização do banco e conta inicial.
- `lib/auth.ts`: autenticação e sessões.
- `scripts/start.mjs`: inicialização de produção.
- `Dockerfile` / `railway.json`: deploy no Railway.

O guia criado a partir de uma descrição usa conhecimento da IA, sem pesquisa na internet. O modo Fast confere os trechos citados no material e aceita PDFs com texto extraível de até 200 páginas.
