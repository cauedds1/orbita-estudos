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
