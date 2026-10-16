# Multi-stage Dockerfile for ChatFlow Backend
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN pnpm install --frozen-lockfile=false

COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/

RUN pnpm --filter @chatflow/shared build
RUN pnpm --filter @chatflow/server build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/shared/ ./packages/shared/
COPY --from=builder /app/apps/server/ ./apps/server/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/node_modules ./apps/server/node_modules

EXPOSE 4000

CMD ["node", "apps/server/dist/index.js"]
