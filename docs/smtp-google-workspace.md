# SMTP com Google Workspace ou Gmail

Este projeto usa `nodemailer` com configuracao SMTP generica. O provedor atual adotado para os exemplos e para o Docker e Google SMTP, usando `smtp.gmail.com` na porta `587` com STARTTLS.

## Quando usar

Use esta configuracao quando o envio oficial da plataforma sair por uma conta Google Workspace, Gmail institucional ou conta Gmail com senha de app.

## Configuracao

Preencha o `.env` real da aplicacao com os dados do provedor. Nao versionar esse arquivo.

```env
SMTP_URL=""
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="seu-email@seudominio.br"
SMTP_PASS="senha-ou-senha-de-app"
SMTP_FROM="knowledge <seu-email@seudominio.br>"
SMTP_REPLY_TO="contato@seudominio.br"
SMTP_SECURE="false"
SMTP_REQUIRE_TLS="true"
SMTP_IGNORE_TLS="false"
```

Notas:

- `SMTP_SECURE=false` e `SMTP_REQUIRE_TLS=true` indicam conexao na porta `587` com upgrade STARTTLS.
- Para Gmail comum com verificacao em duas etapas, use senha de app.
- Para Google Workspace, a conta precisa ter permissao de SMTP e envio externo conforme as politicas do dominio.
- O valor de `SMTP_FROM` deve ser a propria conta autorizada ou um alias validado no Google Workspace.

## Reiniciar e reprocessar

Depois de ajustar o `.env`, reinicie a aplicacao:

```bash
npm.cmd run dev
```

Para processar a fila manualmente:

```bash
npm.cmd run emails:process
```

No Docker:

```bash
docker compose up -d --build
docker compose run --rm tools npm run emails:process
```

## Resultado esperado

- lotes `BLOCKED` voltam a ser processados apos SMTP valido
- destinatarios `PENDING` passam para `SENT`, `FAILED` ou `SKIPPED`
- novos cursos publicados disparam e-mail automaticamente para usuarios cadastrados
- publicacoes nao reenviam o mesmo curso para quem ja recebeu ou ja entrou na fila

## Limite diario

Para cenarios com `2000+` usuarios, configure a cota diaria de acordo com o limite real da conta.

Exemplo com 90% da janela reservado para notificacoes de cursos e 10% para recuperacao de senha:

```env
EMAIL_DAILY_SEND_LIMIT="1800"
EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT="90"
EMAIL_DAILY_WINDOW_HOURS="24"
```

Assim o inbox interno continua notificando todos imediatamente. Os e-mails que excederem a cota ficam pendentes para a proxima janela, sem duplicar entregas ja enfileiradas ou enviadas.
