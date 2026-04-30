# knowledge

Plataforma web para publicacao, acompanhamento e descoberta de cursos em ciencias espaciais. O sistema centraliza catalogo de cursos, area administrativa, indicadores de uso, notificacoes por e-mail e agenda integrada com eventos da EUMETSAT.

## Funcionalidades

- Autenticacao com e-mail/senha e opcionalmente Google via NextAuth.
- Recuperacao e alteracao de senha por codigo enviado por e-mail.
- Catalogo autenticado de cursos com leitura, curtidas, avaliacoes e comentarios.
- Administracao de cursos com rascunho, publicacao, imagens, destaque e exclusao.
- Notificacoes internas e fila de e-mail para novos cursos publicados.
- Agenda integrada com eventos da EUMETSAT e exportacao `.ics`.
- Dashboard analitico com visualizacoes, cliques, engajamento e conversao.
- Execucao local ou via Docker Compose.

## Stack

- Next.js 16 com App Router
- React 19
- TypeScript
- Tailwind CSS
- Prisma ORM
- SQLite
- NextAuth
- Nodemailer

## Docker

A imagem da aplicacao usa `node:24-bookworm-slim`.

Sistema base validado no container:

- Debian GNU/Linux 12 (`bookworm`)
- Node.js `v24.15.0`

O Compose sobe a aplicacao web, os route handlers/API do Next.js, o worker de fila de e-mail iniciado pelo servidor, o volume do SQLite e o volume de uploads.

```bash
docker compose up --build
```

A aplicacao fica disponivel em:

```text
http://localhost:3000
```

Volumes usados:

- `sqlite-data`: banco SQLite em `/app/data/knowledge.db`
- `uploads`: arquivos enviados para `/app/public/uploads`

Para trocar a porta local:

```powershell
$env:APP_PORT="8080"
docker compose up --build
```

Para popular o banco do container com dados de exemplo:

```bash
docker compose run --rm --build tools npm run seed
```

## Desenvolvimento Local

```powershell
npm.cmd install
npm.cmd run prisma:migrate
npm.cmd run seed
npm.cmd run dev
```

Depois acesse:

```text
http://localhost:3000
```

Banco SQLite local:

```text
prisma/dev.db
```

## Variaveis de Ambiente

Use `.env.example` ou `docker.env.example` como referencia.

Principais variaveis:

- `DATABASE_URL`: caminho do SQLite.
- `NEXTAUTH_URL`: URL publica da aplicacao.
- `NEXTAUTH_SECRET`: segredo de sessao do NextAuth.
- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET`: login com Google.
- `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: envio de e-mail.
- `SMTP_FROM` e `SMTP_REPLY_TO`: remetente e resposta dos e-mails.
- `EMAIL_DAILY_SEND_LIMIT`, `EMAIL_DAILY_WINDOW_HOURS`, `EMAIL_SEND_CONCURRENCY`: controle da fila de e-mail.

Sem SMTP configurado, o sistema continua funcionando, mas os envios ficam bloqueados ou nao sao entregues ate a configuracao ser ajustada.

## Scripts

- `npm run dev`: sobe o ambiente de desenvolvimento.
- `npm run build`: gera o build de producao.
- `npm run start`: sobe o build localmente.
- `npm run lint`: executa o lint.
- `npm run seed`: popula o SQLite com dados de exemplo.
- `npm run prisma:migrate`: inicializa ou atualiza o schema SQLite local.
- `npm run prisma:generate`: regenera o Prisma Client.
- `npm run studio`: abre o Prisma Studio.
- `npm run emails:process`: processa manualmente a fila de e-mail.
- `npm run docker:build`: cria a imagem Docker.
- `npm run docker:up`: sobe a aplicacao com Docker Compose.
- `npm run docker:down`: derruba a aplicacao Docker.

## Credenciais de Seed

As credenciais abaixo existem apenas para ambientes locais ou bancos populados com `npm run seed`.

```text
Admin:   admin@inpe.local / Admin12345
Usuario: ana@inpe.local   / Usuario12345
```

## Documentacao

- [Arquitetura da aplicacao](docs/application-architecture.md)
- [Operacao e manutencao](docs/maintenance-and-operations.md)
- [Configuracao SMTP com Brevo](docs/smtp-brevo.md)

## Notas

- A maior parte da plataforma fica atras de login.
- Rotas publicas: login, cadastro e recuperacao de senha.
- Publicar um curso nao depende da entrega imediata dos e-mails.
- O inbox interno e criado mesmo quando SMTP nao esta configurado.
- No PowerShell, use `npm.cmd` se a politica local bloquear `npm`.
