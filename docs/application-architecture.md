# knowledge: arquitetura da aplicacao

## Visao geral

`knowledge` e uma plataforma autenticada para divulgacao de cursos em ciencias espaciais. A aplicacao combina tres frentes:

- catalogo editorial para usuarios autenticados
- painel administrativo para cadastro, edicao, publicacao e exclusao de cursos
- painel analitico e operacional para acompanhar impacto, agenda e notificacoes

A stack principal e:

- `Next.js 16` com `App Router`
- `React 19`
- `TypeScript`
- `Prisma ORM` com `SQLite`
- `NextAuth` para autenticacao
- `Tailwind CSS` com componentes utilitarios em estilo `shadcn`

## Organizacao de pastas

### `app/`

Mantem o roteamento do App Router.

- `app/(auth)` agrupa login e cadastro
- `app/(protected)` agrupa dashboards e paginas protegidas
- `app/api` concentra route handlers usados pelo frontend

### `components/`

Guarda os componentes de UI e fluxos client-side.

- `components/auth` formularios de login e cadastro
- `components/calendar` painel de calendario integrado
- `components/courses` cards, interacoes e CTA do curso
- `components/dashboard` widgets administrativos
- `components/layout` navegacao, tema, idioma e menu do usuario
- `components/providers` providers de sessao e preferencias visuais
- `components/ui` primitives reutilizaveis

### `lib/`

Concentra regras de negocio e adaptadores.

- `access.ts` guardas de acesso para paginas e APIs
- `auth.ts` configuracao do NextAuth
- `analytics.ts` agregacao de metricas
- `calendar-events.ts` unificacao de eventos internos e externos
- `course-draft-storage.ts` persistencia local tipo draft
- `courses.ts` parsing e normalizacao do formulario de cursos
- `mailer.ts` fila de e-mail persistente e processamento em background
- `notifications.ts` fan-out de notificacoes internas
- `prisma.ts` singleton do Prisma com adapter SQLite
- `server-preferences.ts` leitura server-side de tema e idioma
- `ui-settings.ts` dicionarios e preferencias globais
- `utils.ts` helpers puros

### `prisma/`

- `schema.prisma` modelagem completa
- `migrate.ts` bootstrap/migracao local
- `seed.ts` dados operacionais iniciais com senhas administrativas geradas em tempo de execucao
- `process-email-queue.ts` drenagem manual da fila de e-mail

## Fluxo de autenticacao

### Tecnica utilizada

- `NextAuth` com estrategia de sessao em `JWT`
- `CredentialsProvider` para e-mail/senha
- `proxy.ts` para gate otimista de rotas protegidas

### Fluxo

1. O usuario entra por `login` ou `register`.
2. `proxy.ts` redireciona anonimos para `/login`.
3. Paginas e route handlers repetem a validacao com `requirePageUser`, `requireAdminPage` e `getApiUser`.
4. O callback `jwt` sincroniza perfil e permissao com o banco em janela curta, reduzindo consultas repetidas.

## Fluxo de cursos

### Criacao e edicao

- O admin usa `components/dashboard/course-form.tsx`.
- O formulario envia `FormData` para `/api/courses` ou `/api/courses/[id]`.
- `lib/courses.ts` valida texto via `zod`, valida arquivos e normaliza URLs.
- Imagens locais viram arquivos persistidos; imagens externas entram como links na mesma galeria.

### Draft local

Tecnica utilizada:

- `localStorage` para texto e flags
- `IndexedDB` para objetos `File`
- debounce + flush em `beforeunload` e `pagehide`

Resultado:

- erro de API nao limpa os campos
- reload acidental nao perde o formulario
- arquivos locais tambem sobrevivem no mesmo navegador

### Publicacao

1. O admin publica via `/api/courses/[id]/publish`.
2. O curso muda para `PUBLISHED`.
3. Se estiver marcado como destaque, os demais destaques publicados sao removidos.
4. O sistema cria:
   - notificacao interna para todos os usuarios
   - lote de e-mail para todos os usuarios cadastrados, com prioridade por uso da plataforma
5. O calendario invalida o cache para refletir o novo evento.

### Exclusao

- `DELETE /api/courses/[id]` apaga curso, notificacoes relacionadas e uploads locais vinculados.
- O curso some das dashboards, da pagina publica e do calendario.

## Calendario integrado

### Fontes de dados

- eventos internos: cursos publicados projetados como eventos
- eventos externos: feed publico da EUMETSAT

### Tecnica utilizada

- agregacao server-side em `lib/calendar-events.ts`
- cache em memoria com TTL curto
- polling client-side em `training-calendar-panel.tsx`
- invalidez explicita do cache quando cursos mudam
- exportacao `.ics` filtrada por mes, fonte e formato

### Filtros disponiveis

- `ALL`
- `EUMETSAT`
- `INPE`
- `PLATFORM`

## Notificacoes internas

### Modelos

- `Notification` representa o anuncio
- `UserNotification` representa a entrega/estado de leitura por usuario

### Fluxo

1. Ao publicar curso, cria-se uma notificacao base.
2. Os destinatarios sao gravados em chunks para nao exceder limites do SQLite.
3. A aba `Alertas` e o badge no header leem esses registros.
4. Cada usuario marca notificacoes como lidas sem afetar os demais.

## Fila de e-mail

### Tecnica utilizada

- `EmailBatch` e `EmailBatchRecipient` como fila persistente
- `nodemailer` com suporte a SMTP pool
- claim atomico de lotes para evitar processamento duplicado
- recuperacao de lotes travados apos restart
- controle de limite diario para provedores como Gmail/Workspace

### Estados principais

- lote: `QUEUED`, `PROCESSING`, `COMPLETED`, `COMPLETED_WITH_ERRORS`, `BLOCKED`
- destinatario: `PENDING`, `PROCESSING`, `SENT`, `FAILED`, `SKIPPED`

### Comportamento

- publicar curso nao espera o SMTP terminar
- sem SMTP, o lote fica `BLOCKED`
- ao configurar SMTP e reprocessar, o lote volta a andar

## Analytics

### Origem dos dados

- `CourseEvent` para `VIEW` e `CLICK_EXTERNAL`
- `CourseLike`
- `CourseReview`
- `CourseComment`

### Score de impacto

O score atual pondera:

- visualizacoes
- cliques para o Moodle
- curtidas
- comentarios
- nota media

Esse calculo fica em `lib/analytics.ts` e alimenta:

- ranking de impacto
- leitura de conversao
- resposta social

## Tema e idioma

### Tecnica utilizada

- cookies para persistir idioma e tema
- leitura server-side em `server-preferences.ts`
- provider client-side para reagir imediatamente sem perder consistencia entre paginas

Idiomas atuais:

- `pt-BR`
- `en`
- `es`

## Banco de dados

Principais entidades:

- `User`, `Account`, `Session`, `VerificationToken`
- `Course`, `CourseImage`, `CourseEvent`, `CourseLike`, `CourseReview`, `CourseComment`
- `Notification`, `UserNotification`
- `EmailBatch`, `EmailBatchRecipient`

O relacionamento foi desenhado para separar claramente:

- cadastro de pessoas
- cadastro/editorial de cursos
- interacoes sociais
- operacao de notificacao/e-mail

## Pontos de atencao para manutencao

- o feed externo depende da estrutura XML publica da EUMETSAT
- uploads locais vao para `public/uploads`
- a fila de e-mail depende de credenciais SMTP validas
- o draft do formulario e local ao navegador, nao sincronizado entre dispositivos
- o `proxy` faz apenas gate otimista; autorizacao real continua no servidor
