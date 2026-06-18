# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV TZ=America/Sao_Paulo

FROM base AS deps

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

ENV DATABASE_URL=file:./prisma/dev.db

COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM base AS tools

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=file:./data/knowledge.db
ENV NEXTAUTH_URL=http://localhost:3000/knowledge

CMD ["npm", "run", "prisma:migrate"]

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL=file:./prisma/dev.db
ENV NEXTAUTH_URL=http://localhost:3000/knowledge

RUN npm run build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public

RUN mkdir -p /app/.next /app/data /app/public/uploads \
  && chown -R nextjs:nodejs /app

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma/dev.db ./seed/knowledge.db
COPY --from=builder --chown=nextjs:nodejs /app/public/uploads/courses/minicurso-processamento-e-visualizacao-de-dados-de-queimadas-2026-a46bd962-1fe3-440e-ac7e-39de006dbf1b.jpg ./seed/uploads/courses/minicurso-processamento-e-visualizacao-de-dados-de-queimadas-2026-a46bd962-1fe3-440e-ac7e-39de006dbf1b.jpg

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
