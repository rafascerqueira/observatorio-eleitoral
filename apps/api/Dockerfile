FROM node:24.21.0-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/importer/package.json apps/importer/package.json
RUN npm ci --workspace @observatorio/api --workspace @observatorio/contracts --include-workspace-root
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @observatorio/contracts && npm run build -w @observatorio/api
RUN npm prune --omit=dev --workspace @observatorio/api --workspace @observatorio/contracts --include-workspace-root

FROM node:24.21.0-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts ./packages/contracts
COPY --from=build --chown=node:node /app/apps/api ./apps/api
USER node
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
