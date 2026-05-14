# knowledge

Plataforma web para publicacao, acompanhamento e descoberta de cursos em ciencias espaciais. O sistema centraliza catalogo de cursos, area administrativa, indicadores de uso, notificacoes por e-mail e agenda integrada com eventos da EUMETSAT.

## Funcionalidades

- Autenticacao com e-mail/senha via NextAuth.
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
- Nodemailer 8 (`nodemailer8` no `package.json`, alias npm para evitar peer opcional antigo do NextAuth)

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

Para popular o banco do container com os dados operacionais iniciais:

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
- `YOUTUBE_API_KEY`: opcional; usa a YouTube Data API para carregar playlists do canal VLab CoE Brasil.
- `YOUTUBE_CHANNEL_ID`: opcional; canal usado na consulta de playlists. Padrao: `UCVdve-LRCP08M3gwXTPNmpg`.
- `YOUTUBE_PLAYLIST_CACHE_SECONDS`: intervalo minimo de sincronizacao das playlists no servidor. Padrao: `60`.
- `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`: envio de e-mail. O exemplo padrao usa Google SMTP (`smtp.gmail.com:587`).
- `SMTP_FROM` e `SMTP_REPLY_TO`: remetente e resposta dos e-mails.
- `EMAIL_DAILY_SEND_LIMIT`: limite total de envios por janela.
- `EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT`: percentual do limite reservado para avisos de novos cursos. O restante fica reservado para recuperacao de senha. O padrao e `90`.
- `EMAIL_DAILY_WINDOW_HOURS` e `EMAIL_SEND_CONCURRENCY`: janela e concorrencia da fila de e-mail.

Sem SMTP configurado, o sistema continua funcionando, mas os envios ficam bloqueados ou nao sao entregues ate a configuracao ser ajustada.

## Scripts

- `npm run dev`: sobe o ambiente de desenvolvimento.
- `npm run build`: gera o build de producao.
- `npm run start`: sobe o build localmente.
- `npm run lint`: executa o lint.
- `npm run seed`: popula o SQLite com administradores e curso inicial.
- `npm run prisma:migrate`: inicializa ou atualiza o schema SQLite local.
- `npm run prisma:generate`: regenera o Prisma Client.
- `npm run studio`: abre o Prisma Studio.
- `npm run emails:process`: processa manualmente a fila de e-mail.
- `npm run docker:build`: cria a imagem Docker.
- `npm run docker:up`: sobe a aplicacao com Docker Compose.
- `npm run docker:down`: derruba a aplicacao Docker.

## Credenciais de Seed

O seed gera senhas administrativas aleatorias no momento da execucao e imprime esses valores apenas no terminal. Nao ha senhas fixas documentadas no repositorio.

## Documentacao

- [Arquitetura da aplicacao](docs/application-architecture.md)
- [Operacao e manutencao](docs/maintenance-and-operations.md)
- [Referencia tecnica de API, Docker e banco](docs/technical-platform-reference.md)
- [Configuracao SMTP com Google Workspace ou Gmail](docs/smtp-google-workspace.md)

## Notas

- A maior parte da plataforma fica atras de login.
- Rotas publicas: login, cadastro e recuperacao de senha.
- Publicar um curso nao depende da entrega imediata dos e-mails.
- E-mails de novos cursos sao enfileirados para todos os usuarios cadastrados, priorizados por uso da plataforma, sem reenviar o mesmo curso para quem ja entrou na fila.
- A dashboard carrega playlists do canal VLab CoE Brasil e atualiza essa area periodicamente pelo navegador.
- O inbox interno e criado mesmo quando SMTP nao esta configurado.
- No PowerShell, use `npm.cmd` se a politica local bloquear `npm`.
