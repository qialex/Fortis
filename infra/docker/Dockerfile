FROM node:20-alpine AS base
RUN npm install -g pnpm

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml turbo.json ./
COPY packages/ ./packages/
COPY server/ ./server/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app .
RUN pnpm build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/server/express/dist ./server
COPY --from=builder /app/packages/core/dist ./node_modules/@fortis/core
COPY --from=builder /app/packages/adapters/dynamodb/dist ./node_modules/@fortis/adapter-dynamodb
COPY --from=builder /app/packages/adapters/email/ses/dist ./node_modules/@fortis/adapter-ses
COPY --from=builder /app/packages/adapters/email/smtp/dist ./node_modules/@fortis/adapter-smtp
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server/index.js"]
