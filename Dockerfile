# pro-cutter: imagem de produção enxuta
#  - app: saída "standalone" do Next (só os arquivos que o servidor usa)
#  - seed inicial empacotado num único arquivo (esbuild)
#  - migrações: só o CLI do Prisma
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
# openssl: usado pelo motor de migrações do Prisma
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

FROM base AS build
COPY . .
# O Prisma lê DATABASE_URL ao gerar o cliente; o valor real vem na execução
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm ci --no-audit --no-fund
RUN NEXT_STANDALONE=1 npm run build -w @pro-cutter/web
# Seed da marcenaria inicial num arquivo só; os módulos nativos vêm do standalone
RUN npx esbuild packages/db/prisma/seed.ts --bundle --platform=node --format=esm \
  --target=node24 --outfile=/saida/seed.mjs \
  --external:@node-rs/argon2 --external:pg --external:@prisma/adapter-pg --external:@prisma/client \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"
# Projetos fictícios de demonstração (opcional: docker compose exec app node seed-demo.mjs)
RUN npx esbuild apps/web/scripts/seed-demo.ts --bundle --platform=node --format=esm \
  --target=node24 --outfile=/saida/seed-demo.mjs \
  --external:@node-rs/argon2 --external:pg --external:@prisma/adapter-pg --external:@prisma/client \
  --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"

FROM base AS migracoes
WORKDIR /app/db
COPY packages/db/prisma ./prisma
COPY packages/db/prisma.config.ts ./
RUN rm -f prisma/seed.ts \
  && echo '{"name":"migracoes","private":true,"type":"module"}' > package.json \
  && npm install --no-audit --no-fund prisma@7.10.1 dotenv@18.0.10 \
  && npm cache clean --force

FROM base AS final
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=migracoes --chown=node:node /app/db /app/db
COPY --from=build --chown=node:node /app/apps/web/.next/standalone /app
COPY --from=build --chown=node:node /app/apps/web/.next/static /app/apps/web/.next/static
COPY --from=build --chown=node:node /saida/ /app/apps/web/
COPY --chown=node:node docker/iniciar.sh /app/iniciar.sh
USER node
EXPOSE 3000
CMD ["sh", "/app/iniciar.sh"]
