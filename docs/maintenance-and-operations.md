# knowledge: operacao e manutencao

## Comandos principais

```bash
npm.cmd install
npm.cmd run prisma:migrate
npm.cmd run seed
npm.cmd run dev
```

## Scripts

- `npm run dev`: sobe a aplicacao em desenvolvimento
- `npm run build`: gera o build de producao
- `npm run start`: executa o build de producao
- `npm run docker:build`: cria a imagem Docker de producao
- `npm run docker:up`: sobe web, APIs e worker com Docker Compose
- `npm run docker:down`: derruba os containers do Compose
- `npm run lint`: valida o codigo
- `npm run seed`: popula o banco local
- `npm run studio`: abre o Prisma Studio
- `npm run prisma:migrate`: inicializa/atualiza o schema SQLite
- `npm run prisma:generate`: regenera o client Prisma
- `npm run emails:process`: drena manualmente a fila de e-mail

## Docker

```bash
docker compose up --build
```

O servico `web` usa o build standalone do Next.js e carrega paginas, route handlers/API e o worker de fila de e-mail no mesmo container. O schema SQLite e inicializado automaticamente durante o boot do servidor.

Use `docker.env.example` como referencia para configurar variaveis no `.env` lido pelo Compose. O banco do container usa `DOCKER_DATABASE_URL` para nao conflitar com o `DATABASE_URL` local.

Volumes persistentes:

- `sqlite-data`: banco em `/app/data/knowledge.db`
- `uploads`: arquivos enviados em `/app/public/uploads`

Comandos uteis:

```bash
docker compose run --rm --build tools npm run seed
docker compose run --rm --build tools npm run emails:process
docker compose logs -f web
docker compose down
```

## Credenciais seeded

O seed cria administradores operacionais e gera senhas aleatorias no momento da execucao. As senhas aparecem somente no terminal do operador e nao devem ser copiadas para documentacao, commits ou issues.

## Variaveis de ambiente mais importantes

### Aplicacao

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### YouTube

- `YOUTUBE_API_KEY`
- `YOUTUBE_CHANNEL_ID`
- `YOUTUBE_PLAYLIST_CACHE_SECONDS`

### SMTP

- `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`
- `SMTP_IGNORE_TLS`

Os exemplos versionados usam Google SMTP (`smtp.gmail.com:587`) com STARTTLS e limite diario padrao de `2000` mensagens para Google Workspace pago. A plataforma continua usando Nodemailer generico, entao outro SMTP pode ser usado se essas variaveis forem substituidas no `.env`.

### Controle de fila

- `EMAIL_DAILY_SEND_LIMIT`
- `EMAIL_DAILY_WINDOW_HOURS`
- `EMAIL_MAX_ATTEMPTS`
- `EMAIL_BATCH_SIZE`
- `EMAIL_SEND_CONCURRENCY`
- `EMAIL_MAX_RECIPIENTS_PER_RUN`
- `EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT`

## Fluxos operacionais

### Publicar um curso

1. Criar ou editar em `Publicacoes`
2. Garantir ao menos uma imagem
3. Publicar
4. Conferir:
   - dashboard
   - aba de notificacoes
   - `EmailBatch` no Prisma Studio
   - calendario e `.ics`

Ao publicar um novo curso, a fila de e-mail inclui todos os usuarios cadastrados. O envio respeita `EMAIL_DAILY_SEND_LIMIT`; com o padrao `2000`, `1800` envios da janela ficam para avisos de curso e `200` ficam para recuperacao de senha. Se a cota acabar, os destinatarios pendentes ficam em `EmailBatchRecipient` e continuam no processamento seguinte sem reenviar para quem ja recebeu ou ja entrou na fila daquele curso.

### Reprocessar e-mail bloqueado

1. Configurar SMTP no `.env` com Google Workspace/Gmail ou outro provedor autorizado
2. Reiniciar a aplicacao
3. Rodar `npm.cmd run emails:process`
4. Verificar `EmailBatch` e `EmailBatchRecipient`

### Inspecionar o banco

```bash
npm.cmd run studio
```

Tabelas mais usadas no dia a dia:

- `Course`
- `CourseImage`
- `Notification`
- `UserNotification`
- `EmailBatch`
- `EmailBatchRecipient`

## Troubleshooting

### O curso publicou mas o e-mail nao saiu

Verifique:

- se o SMTP esta configurado
- se o lote ficou `BLOCKED`, `QUEUED` ou `COMPLETED_WITH_ERRORS`

### O calendario externo ficou vazio

- confirme conectividade com `trainingevents.eumetsat.int`
- verifique se a estrutura XML do endpoint mudou
- confirme se `/api/calendar/events` segue retornando `200`

### O formulario perdeu conteudo

O draft local depende do navegador:

- limpar cache/storage remove o rascunho
- trocar de navegador ou dispositivo nao carrega o mesmo draft

## O que foi reforcado nesta revisao

- sincronizacao do token de sessao passou a usar janela curta, reduzindo consultas repetidas
- formularios e botoes principais passaram a tratar falhas de rede
- validacoes booleanas de preferencia ficaram estritas na API
- comentarios foram adicionados nos modulos de maior complexidade para acelerar manutencao futura
