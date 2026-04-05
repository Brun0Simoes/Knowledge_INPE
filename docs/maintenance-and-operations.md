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
- `npm run lint`: valida o codigo
- `npm run seed`: popula o banco local
- `npm run studio`: abre o Prisma Studio
- `npm run prisma:migrate`: inicializa/atualiza o schema SQLite
- `npm run prisma:generate`: regenera o client Prisma
- `npm run emails:process`: drena manualmente a fila de e-mail

## Credenciais seeded

- admin: `admin@inpe.local` / `Admin12345`
- usuario: `ana@inpe.local` / `Usuario12345`

## Variaveis de ambiente mais importantes

### Aplicacao

- `DATABASE_URL`
- `NEXTAUTH_URL`
- `NEXTAUTH_SECRET`

### Login Google

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

### SMTP

- `SMTP_URL` ou `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
- `SMTP_FROM`
- `SMTP_REPLY_TO`
- `SMTP_SECURE`
- `SMTP_REQUIRE_TLS`
- `SMTP_IGNORE_TLS`

### Controle de fila

- `EMAIL_DAILY_SEND_LIMIT`
- `EMAIL_DAILY_WINDOW_HOURS`
- `EMAIL_MAX_ATTEMPTS`
- `EMAIL_BATCH_SIZE`
- `EMAIL_SEND_CONCURRENCY`
- `EMAIL_MAX_RECIPIENTS_PER_RUN`

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

### Reprocessar e-mail bloqueado

1. Configurar SMTP no `.env`
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

### O login Google nao aparece

As credenciais `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` nao estao configuradas.

### O curso publicou mas o e-mail nao saiu

Verifique:

- se o SMTP esta configurado
- se o usuario ativou `notificationOptIn`
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
