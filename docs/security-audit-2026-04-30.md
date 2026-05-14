# Auditoria de seguranca - 2026-04-30

## Resumo executivo

Auditoria autorizada executada contra o codigo em `E:\site_inpe` e contra a aplicacao Docker local em `http://127.0.0.1:3000`. O diretorio `eumetsat-calendar-guide/` foi mantido fora do escopo por ser outro projeto.

Foram revisados os pontos principais de uma aplicacao Next.js: Docker/runtime, dependencias, secrets, headers, autenticacao, autorizacao, CSRF, upload, links/redirects, rotas API, XSS/DOM sinks, SSRF por imagens, Host header e abuso de endpoints de login/reset. A revisao posterior do SMTP atualizou o envio para `nodemailer@8.0.7` via alias `nodemailer8`; `npm audit --omit=dev` encerra sem vulnerabilidades conhecidas.

## Superficie revisada

- 17 route handlers em `app/api/**/route.ts`.
- Todas as rotas mutaveis customizadas (`POST`, `PATCH`, `DELETE`) foram revisadas para auth/origin guard.
- Varredura de sinks: `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, `postMessage`, `document.write`, CORS wildcard, subprocessos e `target="_blank"` sem `rel`.
- Varredura de secrets em arquivos versionados sem `.env*`; `.env` existe localmente, mas nao esta versionado.
- Testes dinamicos com payloads de `Origin` malicioso, Host header malicioso, upload SVG, upload PNG falso, otimizador externo do Next e endpoint interno sem segredo.

## Corrigido

### SEC-001 - Dependencias vulneraveis do runtime

- Severidade: Alta antes da correcao.
- Evidencia: `npm audit` apontava `next@16.2.1` em faixa vulneravel.
- Correcao: `next` e `eslint-config-next` atualizados para `16.2.4`; Prisma atualizado para `7.8.0`; overrides aplicados para `postcss`, `hono`, `@hono/node-server` e `cookie`.
- Validacao: `npm audit --audit-level=high` encerrou com codigo 0.

### SEC-002 - Headers e CSP insuficientes

- Severidade: Media.
- Local: `next.config.ts:7`, `next.config.ts:9`, `next.config.ts:25`.
- Risco: clickjacking, MIME sniffing, exposicao de stack/framework e menor protecao contra XSS.
- Correcao: `poweredByHeader: false`; CSP com `default-src 'self'`, `script-src-attr 'none'`, `frame-ancestors 'none'`, `object-src 'none'`; `X-Frame-Options`, `nosniff`, `Referrer-Policy` e `Permissions-Policy`.
- Validacao: `GET /login` retornou os headers esperados e sem `X-Powered-By`.

### SEC-003 - Rotas mutaveis sem CSRF/origin guard explicito

- Severidade: Alta.
- Local: `lib/request-security.ts:7`, `lib/request-security.ts:28`, `lib/request-security.ts:30`.
- Risco: endpoints com cookie de sessao podiam depender apenas de SameSite/browser.
- Correcao: `enforceSameOriginRequest` aplicado a rotas mutaveis customizadas; comparacao usa a origem da requisicao e `NEXTAUTH_URL`, sem confiar em `X-Forwarded-Host`.
- Validacao: `POST /api/auth/register` com `Origin: http://evil.test` retornou `403`; origem local valida nao foi bloqueada.

### SEC-004 - Segredo padrao de sessao em producao/Docker

- Severidade: Alta.
- Local: `lib/auth-secret.ts:8`, `lib/auth-secret.ts:13`, `lib/auth.ts:22`, `docker-compose.yml:7`.
- Risco: qualquer ambiente Docker/producao com segredo default poderia permitir assinatura previsivel de tokens/sessoes.
- Correcao: producao falha se `NEXTAUTH_SECRET` estiver ausente ou fraco; `docker-compose.yml` exige segredo forte; placeholders foram removidos do `Dockerfile`.
- Validacao: Docker com segredo fraco falhou no healthcheck; Docker com segredo temporario forte subiu como `healthy`.

### SEC-005 - Login/reset/cadastro sem limitacao de tentativas no app

- Severidade: Media.
- Local: `lib/rate-limit.ts`, `lib/auth.ts:17`, `lib/auth.ts:45`, `app/api/auth/register/route.ts:32`, `app/api/auth/password-reset/request/route.ts:31`, `app/api/auth/password-reset/confirm/route.ts:30`.
- Risco: brute force e abuso de e-mail/reset em ambiente local ou sem proxy.
- Correcao: rate limit em memoria para login, cadastro, solicitacao de reset e confirmacao de reset.
- Validacao: repeticao de reset retornou `Retry-After`.

### SEC-006 - Upload de imagem permitia formatos ativos/spoofing

- Severidade: Alta.
- Local: `lib/uploads.ts:9`, `lib/uploads.ts:37`, `lib/uploads.ts:86`, `components/dashboard/course-form.tsx:427`.
- Risco: SVG ou HTML disfarçado como imagem poderia ser armazenado no mesmo dominio.
- Correcao: permitido apenas JPG/PNG/WEBP; assinatura binaria verificada; extensao deriva do MIME aprovado; input do cliente removeu SVG.
- Validacao: upload SVG retornou `400`; PNG falso com HTML retornou `400`.

### SEC-007 - Otimizador de imagem podia buscar hosts externos

- Severidade: Media.
- Local: `components/courses/course-image.tsx:5`, `next.config.ts`.
- Risco: `next/image` com host curinga virava fetch server-side para URL editorial externa.
- Correcao: removido remote pattern curinga; imagens externas agora carregam no navegador com `<img referrerPolicy="no-referrer">`.
- Validacao: `/_next/image?url=https://example.com/test.jpg...` retornou `400`.

### SEC-008 - Endpoint interno de e-mail aceitava segredo fraco/comparacao simples

- Severidade: Media.
- Local: `app/api/internal/email/process/route.ts:1`, `app/api/internal/email/process/route.ts:10`, `app/api/internal/email/process/route.ts:37`, `lib/mailer.ts:931`.
- Risco: acionamento indevido do processamento interno de e-mails se endpoint fosse exposto com segredo default.
- Correcao: segredo ausente/fraco e negado; comparacao usa `timingSafeEqual`.
- Validacao: `POST /api/internal/email/process` sem segredo retornou `401`.

### SEC-009 - Host header poisoning no export `.ics`

- Severidade: Media.
- Local: `app/api/calendar/export/route.ts:26`, `lib/app-origin.ts:6`.
- Risco: links internos no arquivo `.ics` podiam ser montados com `Host`/`X-Forwarded-Host` malicioso.
- Correcao: export usa origem canonica configurada por `NEXTAUTH_URL`.
- Validacao: chamada autenticada com `Host: evil.test` retornou `.ics` sem `evil.test`.

### SEC-010 - Links/redirects externos sem normalizacao completa

- Severidade: Media.
- Local: `lib/utils.ts:116`, `lib/utils.ts:140`, `lib/eumetsat-events.ts:101`, `lib/eumetsat-events.ts:222`.
- Risco: callback URL `//host` e URLs vindas de feed externo poderiam virar navegacao inesperada se uma origem externa enviasse dados malformados.
- Correcao: callbacks aceitam apenas paths internos normalizados; URLs do feed EUMETSAT aceitam somente `http:`/`https:`.
- Validacao: callback malicioso nao retornou redirect para origem externa; links `.ics` e UI nao usam Host malicioso.

## Residual

### SEC-R1 - Advisories moderados em `next-auth@4` resolvidos no mailer proprio

- Severidade: Baixa/Media.
- Evidencia anterior: `npm audit` listava `nodemailer` via resolucao de peer opcional do `next-auth@4`.
- Correcao posterior: o mailer proprio importa `nodemailer@8.0.7` pelo alias npm `nodemailer8`, e o peer opcional do NextAuth fica ausente porque a aplicacao nao usa Email Provider do NextAuth.
- Validacao: `npm ci`, `npm audit --omit=dev`, `npm run lint` e `npm run build` executados com sucesso.

### SEC-R2 - Uploads ainda ficam sob `public/uploads`

- Severidade: Baixa/Media apos as correcoes.
- Evidencia: `lib/uploads.ts` salva em `public/uploads/courses`.
- Risco restante: armazenar uploads dentro de `public/` amplia impacto se uma validacao futura for relaxada.
- Mitigacao atual: apenas JPG/PNG/WEBP com assinatura binaria, nomes aleatorios e `X-Content-Type-Options: nosniff`.
- Recomendacao futura: mover novos uploads para `data/uploads` ou storage externo e servir por rota controlada.

### SEC-R3 - Rate limit em memoria nao substitui edge/proxy

- Severidade: Baixa/Media em producao publica.
- Evidencia: `lib/rate-limit.ts` usa `globalThis`.
- Risco restante: limites reiniciam com o processo e nao sincronizam entre replicas.
- Recomendacao futura: usar nginx/Cloudflare/WAF ou Redis quando a aplicacao for publicada.

## Validacoes executadas

- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd audit --audit-level=high`
- `docker compose build web`
- `docker compose up -d web`
- Healthcheck Docker `healthy`
- Testes dinamicos locais: headers/CSP, CSRF com `Origin` malicioso, otimizador externo, endpoint interno sem segredo, login admin, upload SVG, upload PNG falso, Host header malicioso no `.ics`, rate limit de reset e callback malicioso.
