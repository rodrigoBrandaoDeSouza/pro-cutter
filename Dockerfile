# pro-cutter: imagem de produção (app web + migrações + seed inicial)
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: usado pelos motores do Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY . .
# O Prisma lê DATABASE_URL ao gerar o cliente; o valor real vem na execução
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci --no-audit --no-fund
RUN npm run build -w @pro-cutter/web

FROM base AS final
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app /app
USER node
EXPOSE 3000
CMD ["sh", "/app/docker/iniciar.sh"]
