# ============================================================================
# @avahui/web — Multi-stage Production Dockerfile (pnpm monorepo)
# ============================================================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/blockchain/package.json ./packages/blockchain/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN pnpm install --frozen-lockfile=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @avahui/shared build
RUN pnpm --filter @avahui/blockchain build
RUN pnpm --filter @avahui/web build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@avahui/web", "start"]
