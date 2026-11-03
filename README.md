# 🔺 AvaHui (`avahui-unihack-2026`)

> **Trustless On-Chain ROSCA (Hụi) Platform on Avalanche with Embedded Wallets & Collateral Protection.**  
> Built for **AVALANCHE UNIHACK 2026** — *30 Days to Build on Avalanche (Ho Chi Minh City, Vietnam | 2–30 November 2026).*

---

## 1. Kiến trúc Monorepo (Package-by-Feature)

Dự án được quản lý bằng `pnpm workspace`, tách biệt rõ ràng giữa **Frontend**, **Backend**, **Smart Contract** và **Database / Docker Infrastructure**:

```text
avahui-unihack-2026/
│
├── apps/
│   ├── web/                        # @avahui/web — Next.js Frontend (Feature-based architecture)
│   │   ├── src/app/                # App Router ((auth), dashboard, circles, profile)
│   │   ├── src/components/         # Shared UI (ui, layout, common)
│   │   ├── src/features/           # Package-by-Feature modules:
│   │   │   ├── auth/
│   │   │   ├── wallet/
│   │   │   ├── circles/
│   │   │   ├── members/
│   │   │   ├── contributions/
│   │   │   ├── bidding/
│   │   │   ├── payouts/
│   │   │   ├── collateral/
│   │   │   └── transactions/
│   │   ├── src/hooks/
│   │   ├── src/lib/                # (api, privy, wagmi, utils)
│   │   ├── src/stores/
│   │   ├── src/types/
│   │   └── src/config/
│   │
│   ├── api/                        # @avahui/api — NestJS Backend & Blockchain Indexer
│   │   ├── prisma/                 # Prisma schema & migrations
│   │   └── src/
│   │       ├── modules/            # Modular Feature Architecture:
│   │       │   ├── auth/
│   │       │   ├── users/
│   │       │   ├── wallets/
│   │       │   ├── circles/
│   │       │   ├── members/
│   │       │   ├── rounds/
│   │       │   ├── contributions/
│   │       │   ├── bidding/
│   │       │   ├── payouts/
│   │       │   ├── collateral/
│   │       │   ├── transactions/
│   │       │   ├── blockchain/
│   │       │   ├── notifications/
│   │       │   └── ai/
│   │       ├── common/
│   │       ├── config/
│   │       ├── database/
│   │       ├── guards/
│   │       ├── interceptors/
│   │       └── filters/
│   │
│   └── contracts/                  # @avahui/contracts — Solidity + Foundry (Avalanche Fuji)
│       ├── src/                    # Smart Contracts (interfaces, libraries, mocks)
│       ├── test/                   # (unit, fuzz, invariant)
│       ├── script/                 # Deployment scripts
│       └── foundry.toml
│
├── packages/
│   ├── shared/                     # @avahui/shared — Shared Enums, Types, Constants, Mock Data
│   ├── blockchain/                 # @avahui/blockchain — ABIs, Contract Addresses, Chain Config
│   └── config/                     # @avahui/config — Shared TSConfig & ESLint
│
├── infrastructure/
│   ├── docker/                     # Dockerfiles cho web, api, postgres
│   └── database/                   # Standalone PostgreSQL init SQL, migrations, seeds
│       └── init/01-init-schema.sql # Tự động khởi tạo 13 bảng + Enums khi bật container
│
├── docs/                           # Tài liệu Kiến trúc, Business Rules, API & Spec
│   └── architecture/AVAHUI_MASTER_SPEC_AND_MOCK.md
│
├── scripts/                        # Automation scripts
├── .env.example                    # Biến môi trường mẫu cấp Root / Docker Compose
├── .gitignore
├── .dockerignore
├── docker-compose.yml              # Quản lý PostgreSQL & Full-stack Deployment
├── pnpm-workspace.yaml
└── package.json
```

---

## 2. Cấu hình Biến môi trường (`.env`)

Mỗi thành phần đều có file `.env.example` riêng biệt:

1. **Root (Docker Compose):** Copy `.env.example` -> `.env`
2. **Frontend (`apps/web`):** Copy `apps/web/.env.example` -> `apps/web/.env.local`
3. **Backend (`apps/api`):** Copy `apps/api/.env.example` -> `apps/api/.env`
4. **Smart Contracts (`apps/contracts`):** Copy `apps/contracts/.env.example` -> `apps/contracts/.env`
5. **Database (`infrastructure/database`):** Copy `infrastructure/database/.env.example` -> `infrastructure/database/.env`

---

## 3. Khởi chạy Database & Docker

### Chế độ 1: Chạy riêng PostgreSQL bằng Docker để code Local (Dev Mode)
```bash
docker compose up -d postgres
```
*(Container `avahui-postgres` sẽ tự động chạy script `infrastructure/database/init/01-init-schema.sql` để tạo toàn bộ bảng và Enums ở lần khởi tạo đầu tiên).*

### Chế độ 2: Build & Deploy toàn bộ hệ thống bằng Docker (PostgreSQL + Backend API + Frontend Web)
```bash
docker compose --profile deploy up -d --build
```

---

## 4. Tài liệu Đặc tả & Phát triển Song song

Xem chi tiết toàn bộ Business Rules, Giao ước ABI/Event, REST API, SQL Schema và Mock Data tại:
- [`docs/architecture/AVAHUI_MASTER_SPEC_AND_MOCK.md`](./docs/architecture/AVAHUI_MASTER_SPEC_AND_MOCK.md)
