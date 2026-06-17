#!/usr/bin/env bash
# docker-publish.sh
#
# Builda e publica as imagens Docker do projeto no registry interno do INPE.
#
# Imagens publicadas:
#   registry.cptec.inpe.br/knowledge        — app de produção (Next.js standalone)
#   registry.cptec.inpe.br/knowledge-tools  — utilitários (migração de banco, seed)
#
# Cada imagem recebe duas tags:
#   :latest   — aponta sempre para o build mais recente
#   :<sha>    — hash curto do commit atual, para rastreabilidade e rollback
#
# Pré-requisitos:
#   - Docker com suporte a buildx (incluso no Docker Desktop e Docker Engine >= 23)
#   - Acesso à rede interna do INPE (o registry não requer autenticação nessa rede)
#   - Git com ao menos um commit no repositório
#
# Uso:
#   bash scripts/docker-publish.sh
#   npm run docker:publish
#
# Compatível com: macOS (Intel e Apple Silicon), Linux e Windows (Git Bash / WSL)

set -euo pipefail

REGISTRY="registry.cptec.inpe.br"
IMAGE="${REGISTRY}/knowledge"
IMAGE_TOOLS="${REGISTRY}/knowledge-tools"

# A imagem final deve rodar em x86_64 no servidor de produção do INPE.
PLATFORM="linux/amd64"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

GIT_SHA="$(git rev-parse --short HEAD)"
BUILDER_NAME="knowledge-inpe-builder"

# O driver padrão "docker" não consegue exportar imagens cross-arch diretamente para
# um registry. O driver "docker-container" resolve isso, mas roda em rede isolada e
# não enxerga o DNS interno do INPE. Por isso usamos --load (carrega no daemon local)
# e depois docker push pelo host, que tem acesso à rede interna.
if ! docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
  echo "==> Creating buildx builder ${BUILDER_NAME}"
  docker buildx create --name "${BUILDER_NAME}" --driver docker-container >/dev/null
fi
docker buildx use "${BUILDER_NAME}"

# --- Imagem principal (app) ---
echo "==> Building ${IMAGE}:latest (${IMAGE}:${GIT_SHA}) for ${PLATFORM}"
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${IMAGE}:latest" \
  -t "${IMAGE}:${GIT_SHA}" \
  --load \
  .

echo "==> Pushing ${IMAGE}:latest"
docker push "${IMAGE}:latest"

echo "==> Pushing ${IMAGE}:${GIT_SHA}"
docker push "${IMAGE}:${GIT_SHA}"

# --- Imagem tools (migração de banco) ---
# Usa o estágio "tools" do Dockerfile, que contém tsx e o fonte completo
# necessários para executar prisma/migrate.ts em produção antes de subir o app.
echo "==> Building ${IMAGE_TOOLS}:latest (${IMAGE_TOOLS}:${GIT_SHA}) for ${PLATFORM}"
docker buildx build \
  --platform "${PLATFORM}" \
  --target tools \
  -t "${IMAGE_TOOLS}:latest" \
  -t "${IMAGE_TOOLS}:${GIT_SHA}" \
  --load \
  .

echo "==> Pushing ${IMAGE_TOOLS}:latest"
docker push "${IMAGE_TOOLS}:latest"

echo "==> Pushing ${IMAGE_TOOLS}:${GIT_SHA}"
docker push "${IMAGE_TOOLS}:${GIT_SHA}"

echo "==> Done. Published ${IMAGE}:latest, ${IMAGE}:${GIT_SHA}, ${IMAGE_TOOLS}:latest and ${IMAGE_TOOLS}:${GIT_SHA} for ${PLATFORM}"
