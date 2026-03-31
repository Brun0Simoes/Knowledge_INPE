# knowledge

Plataforma full-stack em `Next.js` para divulgacao de cursos com:

- vitrine autenticada de cursos
- cadastro/admin de cursos em estilo editorial
- dashboard analitico com sinais de impacto
- `SQLite` + `Prisma ORM`
- inspecao do banco via `Prisma Studio`
- autenticacao por Google e email/senha

## Stack

- `Next.js 16` com `App Router`
- `TypeScript`
- `Tailwind CSS`
- `Prisma ORM` + `SQLite`
- `NextAuth`
- componentes utilitarios em estilo `shadcn`

## Como rodar

1. Instale as dependencias:

```bash
npm.cmd install
```

2. Gere o banco e aplique a migration:

```bash
npm.cmd run prisma:migrate
```

3. Popule o banco com dados ficticios:

```bash
npm.cmd run seed
```

4. Suba o servidor:

```bash
npm.cmd run dev
```

## Scripts

- `npm run dev`: ambiente de desenvolvimento
- `npm run build`: build de producao
- `npm run start`: sobe o build
- `npm run lint`: lint do projeto
- `npm run seed`: popula o SQLite com dados ficticios
- `npm run studio`: abre o Prisma Studio
- `npm run prisma:migrate`: inicializa o schema local do SQLite usado pelo Prisma
- `npm run prisma:generate`: regenera o client Prisma

## Prisma Studio

Para inspecionar o banco local:

```bash
npm.cmd run studio
```

O arquivo SQLite fica em `prisma/dev.db`.

## Credenciais de seed

- Admin: `admin@inpe.local` / `Admin12345`
- Usuario: `ana@inpe.local` / `Usuario12345`

## Variaveis de ambiente

Veja `.env.example`. Em desenvolvimento local o projeto ja inclui valores padrao no `.env`.

Variaveis mais importantes:

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

## Notas

- Toda a plataforma, incluindo a vitrine, fica atras de login.
- Se o PowerShell bloquear `npm`, use `npm.cmd`.
- Publicar curso nao bloqueia a resposta HTTP: os destinatarios entram em fila no SQLite e o worker drena o lote em segundo plano.
- O processador suporta reprocessamento de lotes bloqueados assim que o SMTP for configurado.
- Se o SMTP nao estiver configurado, o lote fica `BLOCKED` e os destinatarios permanecem `PENDING`.

## Notificacoes por e-mail

O envio usa `Prisma` + `SQLite` como fila persistente:

- `EmailBatch` registra o lote por curso publicado.
- `EmailBatchRecipient` registra cada destinatario individualmente.
- `Notification` registra o anuncio da plataforma.
- `UserNotification` registra leitura por usuario.
- a gravacao dos destinatarios ocorre em chunks para suportar milhares de usuarios sem estourar limite do SQLite.
- o servidor inicia um worker automatico que processa a fila em background.
- ha suporte a retry para falhas temporarias e recuperacao de batches interrompidos apos restart.
- batches antigos que ficaram `SKIPPED` por falta de SMTP sao normalizados de volta para `PENDING` assim que o novo processador roda.
- toda publicacao tambem gera notificacao interna no inbox da plataforma.

Scripts uteis:

- `npm.cmd run emails:process`: drena manualmente a fila uma vez.
- `npm.cmd run studio`: inspeciona `EmailBatch` e `EmailBatchRecipient` no Prisma Studio.

## Google Workspace

Se optar por `Google Workspace` como SMTP, configure um teto diario no `.env` para o app nao tentar enviar acima da janela do provedor:

```env
EMAIL_DAILY_SEND_LIMIT="1800"
EMAIL_DAILY_WINDOW_HOURS="24"
```

Isso mantem o excedente em fila e deixa o restante para a proxima janela, sem perder o disparo interno na plataforma.

## SMTP recomendado

Para um SMTP real de baixo atrito, a recomendacao inicial e `Brevo`.

Motivos:

- plano gratis com e-mail transacional
- suporte a SMTP relay padrao
- credenciais simples para conectar ao app
- evolui para plano pago sem trocar a integracao

Configuracao no `.env`:

```env
SMTP_URL=""
SMTP_HOST="smtp-relay.brevo.com"
SMTP_PORT="587"
SMTP_USER="seu-login-smtp@relay.brevo.com"
SMTP_PASS="sua-chave-smtp"
SMTP_FROM="knowledge <no-reply@seudominio.com>"
SMTP_REPLY_TO="contato@seudominio.com"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="true"
SMTP_IGNORE_TLS="false"
```

Observacoes:

- use `SMTP key`, nao `API key`
- para entrega confiavel, autentique seu dominio com DKIM e DMARC no provedor
- o plano gratis serve para validacao e baixo volume; para milhares de usuarios por publicacao, use plano pago
