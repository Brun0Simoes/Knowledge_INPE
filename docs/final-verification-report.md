# Verificacao final da plataforma

Data da verificacao: 2026-05-14.

## Escopo

- formulario de curso com data de inicio e termino
- calendario usando data real do curso
- remocao de login Google
- remocao da preferencia de opt-in de e-mail que nao era mais usada
- banco com usuarios administradores reais e sem usuarios pseudo/teste
- documentacao tecnica
- Docker e banco versionavel
- bootstrap Docker com seed inicial de banco e uploads sem sobrescrever volumes existentes

## Resultado de banco

Resumo sanitizado:

- usuarios `ADMIN`: 2
- usuarios de teste/pseudo: 0
- cursos publicados: 1
- cursos de teste/ficticios: 0
- imagens de curso: 1
- integridade SQLite: `ok`
- chaves estrangeiras: sem violacoes

Nenhuma senha em texto puro foi gravada na documentacao ou no banco.

## Resultado de aplicacao

Fluxos validados:

- login com administradores criados
- dashboard protegida
- playlists do YouTube na dashboard
- calendario integrado
- formulario de novo curso com `Inicio do curso` e `Termino do curso`
- listagem administrativa de cursos
- analytics administrativo
- pagina de curso
- notificacoes internas
- recuperacao de senha
- cadastro
- bootstrap Docker isolado sem volume preexistente

## Evidencias

Screenshots salvos em:

```text
docs/qa-screenshots/final-platform-check/
```

Arquivos principais:

- `01-login.png`
- `02-dashboard-after-login.png`
- `03-admin-courses.png`
- `04-admin-new-course-form.png`
- `05-admin-analytics.png`
- `06-course-detail.png`
- `07-notifications.png`
- `08-forgot-password.png`
- `09-register.png`
- `10-dashboard-full.png`
- `11-database-review.svg`

## Comandos executados

```bash
npm run prisma:generate
npm run prisma:migrate
npm run lint
npm run build
npm audit
docker compose up -d --build
docker compose ps
docker run knowledge-inpe:latest
```

## Observacoes

`npm audit --omit=dev` foi reexecutado apos a atualizacao do SMTP para `nodemailer@8.0.7` via alias `nodemailer8` e encerrou sem vulnerabilidades conhecidas.

CodeRabbit foi solicitado, mas a CLI nao estava instalada no ambiente local. A instalacao via script falhou porque `sh` nao esta disponivel e a tentativa por PowerShell retornou falha de canal SSL/TLS.
