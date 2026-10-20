# Origem pública das imagens de compartilhamento: lida na compilação (páginas pré-renderizadas) e na execução (páginas dinâmicas),
# por isso o mesmo valor nos dois estágios.
ARG SITE_URL=http://localhost:3000

FROM node:24.21.0-alpine AS build
ARG SITE_URL
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 SITE_URL=$SITE_URL
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/importer/package.json apps/importer/package.json
RUN npm ci
COPY packages/contracts packages/contracts
COPY apps/web apps/web
RUN npm run build -w @observatorio/contracts && npm run build -w @observatorio/web

FROM node:24.21.0-alpine
ARG SITE_URL
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000 SITE_URL=$SITE_URL
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
