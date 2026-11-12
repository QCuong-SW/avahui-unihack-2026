# ============================================================================
# @avahui/web — Multi-stage Production Dockerfile (pnpm monorepo)
# ============================================================================
FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/web/package.json ./apps/web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/blockchain/package.json ./packages/blockchain/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN pnpm install --frozen-lockfile=false

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_USE_MOCK=false
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
ARG NEXT_PUBLIC_PRIVY_APP_ID=
ARG NEXT_PUBLIC_CHAIN_ID=43113
ARG NEXT_PUBLIC_AVALANCHE_RPC_URL=https://avalanche-fuji-c-chain-rpc.publicnode.com
ARG NEXT_PUBLIC_BLOCK_EXPLORER_URL=https://testnet.snowtrace.io
ARG NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS=
ARG NEXT_PUBLIC_USDC_TOKEN_ADDRESS=
ARG NEXT_PUBLIC_YIELD_VAULT_ADDRESS=
ARG NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS=
ARG NEXT_PUBLIC_ENABLE_DEMO_TOOLS=false
ARG NEXT_PUBLIC_DISABLE_LOCAL_SIGNER=false

ENV NEXT_PUBLIC_USE_MOCK=$NEXT_PUBLIC_USE_MOCK \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_PRIVY_APP_ID=$NEXT_PUBLIC_PRIVY_APP_ID \
    NEXT_PUBLIC_CHAIN_ID=$NEXT_PUBLIC_CHAIN_ID \
    NEXT_PUBLIC_AVALANCHE_RPC_URL=$NEXT_PUBLIC_AVALANCHE_RPC_URL \
    NEXT_PUBLIC_BLOCK_EXPLORER_URL=$NEXT_PUBLIC_BLOCK_EXPLORER_URL \
    NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS=$NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS \
    NEXT_PUBLIC_USDC_TOKEN_ADDRESS=$NEXT_PUBLIC_USDC_TOKEN_ADDRESS \
    NEXT_PUBLIC_YIELD_VAULT_ADDRESS=$NEXT_PUBLIC_YIELD_VAULT_ADDRESS \
    NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS=$NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS \
    NEXT_PUBLIC_ENABLE_DEMO_TOOLS=$NEXT_PUBLIC_ENABLE_DEMO_TOOLS \
    NEXT_PUBLIC_DISABLE_LOCAL_SIGNER=$NEXT_PUBLIC_DISABLE_LOCAL_SIGNER

RUN pnpm --filter @avahui/shared build
RUN pnpm --filter @avahui/blockchain build
RUN pnpm --filter @avahui/web run build:server

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["pnpm", "--filter", "@avahui/web", "start"]
