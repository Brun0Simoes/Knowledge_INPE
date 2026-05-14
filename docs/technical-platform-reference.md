# knowledge: referencia tecnica

Este documento descreve a plataforma para manutencao por desenvolvedores. Ele evita expor dados pessoais, credenciais e conteudo sensivel de cursos.

## Stack

- Next.js 16 com App Router e route handlers
- React 19 e TypeScript
- Tailwind CSS
- Prisma ORM 7 com adapter `better-sqlite3`
- SQLite como banco persistente
- NextAuth com `CredentialsProvider`
- Nodemailer para SMTP
- Docker Compose com imagem `node:24-bookworm-slim`

## Execucao

### Local

```bash
npm install
npm run prisma:migrate
npm run seed
npm run dev
```

O banco local padrao usa `DATABASE_URL=file:./prisma/dev.db`.

### Docker

```bash
docker compose up --build
```

O servico `web` executa o build standalone do Next.js. O bootstrap do schema roda no `instrumentation-node.ts`, antes do worker de e-mail.

Em containers novos, se `/app/data/knowledge.db` ainda nao existir, o bootstrap copia o seed embarcado de `/app/seed/knowledge.db`. Arquivos iniciais de upload tambem sao copiados de `/app/seed/uploads` para `/app/public/uploads` somente quando ainda nao existem.

Volumes:

- `sqlite-data`: persiste `/app/data/knowledge.db`
- `uploads`: persiste `/app/public/uploads`

Imagem base:

- Debian GNU/Linux 12 (`bookworm`)
- Node.js 24

## Variaveis de ambiente

Obrigatorias em producao:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL` ou `DOCKER_DATABASE_URL`

Opcionais por integracao:

- `YOUTUBE_API_KEY`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_PLAYLIST_CACHE_SECONDS`
- `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM`, `SMTP_REPLY_TO`
- `EMAIL_DAILY_SEND_LIMIT`
- `EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT`
- `EMAIL_DAILY_WINDOW_HOURS`
- `EMAIL_SEND_CONCURRENCY`

Nao versionar `.env` com valores reais. Use `.env.example` e `docker.env.example` como contratos publicos.
Os exemplos publicos usam Google SMTP (`smtp.gmail.com:587`) com STARTTLS. O codigo de envio permanece independente de provedor.

## Autenticacao

Arquivos principais:

- `lib/auth.ts`
- `lib/auth-secret.ts`
- `types/next-auth.d.ts`
- `proxy.ts`

Fluxo:

1. Login por e-mail/senha em `/login`.
2. `CredentialsProvider` valida senha com `bcryptjs`.
3. Sessao JWT recebe `role`.
4. `proxy.ts` aplica gate inicial para rotas protegidas.
5. Paginas e APIs repetem autorizacao server-side com `requirePageUser`, `requireAdminPage` e `getApiUser`.

O login com Google foi removido. A recuperacao de senha usa codigo por e-mail em `/forgot-password`.

## Cursos

Arquivos principais:

- `components/dashboard/course-form.tsx`
- `lib/schemas/course.ts`
- `lib/courses.ts`
- `app/api/courses/route.ts`
- `app/api/courses/[id]/route.ts`
- `app/api/courses/[id]/publish/route.ts`

Campos editoriais:

- titulo, resumo, descricao e URL externa
- imagem por upload ou URL
- destaque principal
- data/hora de inicio (`startsAt`)
- data/hora de termino (`endsAt`)

`publishedAt` representa a data em que o curso entrou no ar. `startsAt` e `endsAt` representam a data real do curso e alimentam o calendario.

## APIs

Rotas autenticadas:

- `GET /dashboard`: pagina principal protegida
- `GET /courses/[slug]`: detalhe de curso
- `GET /notifications`: inbox interno
- `GET /admin/courses`: administracao de cursos
- `GET /admin/courses/new`: formulario de criacao
- `GET /admin/courses/[id]/edit`: formulario de edicao
- `GET /admin/analytics`: painel analitico

Route handlers:

- `POST /api/auth/register`: cria usuario
- `POST /api/auth/password-reset/request`: solicita codigo de recuperacao
- `POST /api/auth/password-reset/confirm`: altera senha com codigo
- `GET /api/calendar/events`: retorna agenda combinada
- `GET /api/calendar/export`: exporta `.ics`
- `POST /api/courses`: cria curso
- `PATCH /api/courses/[id]`: edita curso
- `DELETE /api/courses/[id]`: remove curso
- `POST /api/courses/[id]/publish`: publica curso
- `POST /api/courses/[id]/events`: registra view/clique
- `POST /api/courses/[id]/like`: alterna curtida
- `POST /api/courses/[id]/reviews`: salva avaliacao
- `POST /api/courses/[id]/comments`: publica comentario
- `PATCH /api/notifications/[id]`: marca alerta como lido/nao lido
- `POST /api/notifications/mark-all-read`: marca todos como lidos
- `POST /api/internal/email/process`: drena fila mediante segredo
- `GET /api/youtube/playlists`: atualiza playlists do canal configurado

Rotas mutaveis aplicam `enforceSameOriginRequest` para reduzir risco de CSRF.

## Calendario

Arquivos principais:

- `lib/calendar-events.ts`
- `lib/calendar-shared.ts`
- `components/calendar/training-calendar-panel.tsx`
- `app/api/calendar/events/route.ts`
- `app/api/calendar/export/route.ts`

Fontes:

- cursos publicados da plataforma
- eventos externos EUMETSAT

Cursos usam `startsAt` e `endsAt` quando informados. Se um curso legado nao tiver esses campos, a plataforma cai para `publishedAt` apenas como fallback.

## E-mail

Arquivos principais:

- `lib/mailer.ts`
- `lib/email-queue-worker.ts`
- `lib/password-reset.ts`
- `prisma/process-email-queue.ts`

Tecnica:

- `EmailBatch` representa o lote.
- `EmailBatchRecipient` representa cada destinatario.
- O envio de novos cursos vai para todos os usuarios cadastrados.
- A fila respeita limite diario por janela.
- `EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT=90` reserva 90% do limite para avisos de curso; o restante fica para recuperacao de senha.
- Destinatarios ja enfileirados/entregues para um curso nao recebem duplicidade.
- Prioridade considera uso da plataforma: views, cliques, curtidas, comentarios e avaliacoes.

Sem SMTP valido, a aplicacao continua operando e o lote fica bloqueado/pendente para reprocessamento.
O provedor documentado para operacao atual e Google Workspace/Gmail via `smtp.gmail.com`.

## YouTube

Arquivos principais:

- `lib/youtube-playlists.ts`
- `app/api/youtube/playlists/route.ts`
- `components/dashboard/youtube-playlists-section.tsx`

A dashboard carrega playlists do canal configurado por `YOUTUBE_CHANNEL_ID`. Com `YOUTUBE_API_KEY`, usa YouTube Data API. Sem chave, usa fallback publico com cache curto e conteudo de reserva.

## Banco de dados

Principais tabelas:

- `User`
- `Course`, `CourseImage`
- `CourseEvent`, `CourseLike`, `CourseReview`, `CourseComment`
- `Notification`, `UserNotification`
- `EmailBatch`, `EmailBatchRecipient`
- `PasswordResetCode`
- tabelas NextAuth: `Account`, `Session`, `VerificationToken`

Revisao final do banco versionado:

- usuarios: somente administradores operacionais
- cursos publicados: 1
- cursos ficticios/teste: 0
- e-mails pseudo/teste: 0
- `PRAGMA integrity_check`: `ok`
- `PRAGMA foreign_key_check`: sem violacoes

## Seed

`npm run seed` limpa dados operacionais e recria:

- administradores definidos em `prisma/seed.ts`
- curso inicial publicado
- imagem inicial associada

As senhas administrativas sao geradas aleatoriamente a cada execucao do seed e aparecem somente no terminal.

## Revisao de seguranca

Medidas aplicadas:

- login apenas por credenciais
- senhas com hash `bcryptjs`
- rate limit em login, cadastro e recuperacao de senha
- codigos de recuperacao com hash e expiração
- validacao Zod em entradas de API
- validacao de origem nas rotas mutaveis
- URLs externas exigem HTTPS
- uploads limitados por tipo, tamanho e assinatura de arquivo
- fila SMTP desacoplada da publicacao

`npm audit` aponta uma vulnerabilidade transitiva em `nodemailer` via `next-auth/@auth/core`, sem correcao automatica disponivel no momento da revisao. O codigo da plataforma nao passa `envelope.size` nem `name` controlado por usuario ao Nodemailer.

## Validacao final

Comandos usados:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run lint
npm run build
npm audit
docker compose up -d --build
```

Tambem foram feitos testes autenticados em navegador e HTTP para login, dashboard, admin, formulario com datas, curso, calendario, YouTube, notificacoes, cadastro e recuperacao de senha.
