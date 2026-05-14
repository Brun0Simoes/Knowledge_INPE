# SMTP real com Brevo

Este projeto ja esta preparado para envio automatico ao publicar um curso.
O que falta para entrega real e somente conectar um provedor SMTP valido.

## Quando usar

Use `Brevo` para validar SMTP real rapidamente e sem alterar o codigo da aplicacao.

## Passos

1. Crie sua conta em [Brevo](https://www.brevo.com/).
2. Na conta Brevo, autentique seu dominio de envio.
3. Crie um sender, por exemplo `knowledge <no-reply@seudominio.com>`.
4. Em `SMTP`, copie:
   - login SMTP
   - SMTP key
5. Preencha o arquivo `.env`:

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

6. Reinicie a aplicacao:

```bash
npm.cmd run dev
```

7. Reprocese a fila:

```bash
npm.cmd run emails:process
```

## Resultado esperado

- lotes `BLOCKED` passam a ser processados
- destinatarios `PENDING` viram `SENT`
- novos cursos publicados disparam email automaticamente para todos os usuarios cadastrados

## Limite importante

Plano gratis nao e suficiente para milhares de usuarios por publicacao.
Se voce pretende enviar para `2000+` usuarios a cada curso, suba para plano pago ou use creditos/pre-pago do provedor.

## Alternativa com Google Workspace

Se o projeto usar `Google Workspace` e publicar no maximo um curso por dia, ajuste o app para respeitar a janela diaria:

```env
EMAIL_DAILY_SEND_LIMIT="1800"
EMAIL_USER_NOTIFICATIONS_DAILY_PERCENT="90"
EMAIL_DAILY_WINDOW_HOURS="24"
```

Assim o inbox interno continua notificando todos imediatamente, `1620` envios da janela ficam reservados para avisos de curso e `180` ficam reservados para recuperacao de senha. O e-mail segue em fila quando a cota do dia estiver perto do limite, sem reenviar o mesmo curso para quem ja recebeu.
