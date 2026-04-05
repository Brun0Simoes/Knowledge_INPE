# knowledge

Plataforma full-stack para divulgacao de cursos em ciencias espaciais com tres areas autenticadas:

- catalogo editorial para leitura e descoberta dos cursos
- painel administrativo para cadastro, rascunho, publicacao e exclusao
- painel analitico com indicadores, agenda integrada e exportacao `.ics`

## Stack

- `Next.js 16` com `App Router`
- `React 19`
- `TypeScript`
- `Tailwind CSS`
- `Prisma ORM` com `SQLite`
- `NextAuth`
- componentes utilitarios em estilo `shadcn`

## Documentacao

- arquitetura completa: [docs/application-architecture.md](/E:/site_inpe/docs/application-architecture.md)
- operacao e manutencao: [docs/maintenance-and-operations.md](/E:/site_inpe/docs/maintenance-and-operations.md)
- setup SMTP inicial: [docs/smtp-brevo.md](/E:/site_inpe/docs/smtp-brevo.md)

## Como rodar

```bash
npm.cmd install
npm.cmd run prisma:migrate
npm.cmd run seed
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
- `npm run emails:process`: drena manualmente a fila de e-mail

## Prisma Studio

```bash
npm.cmd run studio
```

Banco local:

- `prisma/dev.db`

## Credenciais de seed

- admin: `admin@inpe.local` / `Admin12345`
- usuario: `ana@inpe.local` / `Usuario12345`

## Variaveis de ambiente

Veja `.env.example`.

Principais grupos:

- aplicacao: `DATABASE_URL`, `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- Google: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- SMTP: `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- fila de e-mail: `EMAIL_DAILY_SEND_LIMIT`, `EMAIL_DAILY_WINDOW_HOURS`, `EMAIL_SEND_CONCURRENCY`

## Notas operacionais

- toda a plataforma fica atras de login
- publicar curso nao espera o envio de e-mail terminar
- o inbox interno sempre e criado, mesmo quando o SMTP nao esta configurado
- lotes bloqueados podem ser retomados depois que o SMTP aparece
- se o PowerShell bloquear `npm`, use `npm.cmd`
