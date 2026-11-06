# TỔNG HỢP KẾT QUẢ TRIỂN KHAI TRACK B & HƯỚNG DẪN TÍCH HỢP CHO TRACK A

**Dự án:** **AvaHui (`avahui-unihack-2026`)** — *Trustless On-Chain ROSCA Platform on Avalanche*  
**Mạng lưới:** Avalanche Fuji C-Chain (`chainId: 43113`)  
**Trạng thái Track B:** Hoàn thành 100% (`@avahui/shared`, `@avahui/blockchain`, `@avahui/contracts`, `@avahui/api`)

---

## PHẦN 1: TỔNG HỢP CÔNG VIỆC ĐÃ THỰC HIỆN (TRACK B)

### 1.1. Xây dựng "The Bridge" (`packages/shared` & `packages/blockchain`)
Đã hoàn thiện toàn bộ gói dùng chung để Frontend (Track A) và Backend (Track B) import trực tiếp:
- **`@avahui/shared`** ([`packages/shared/src/index.ts`](../../packages/shared/src/index.ts)):
  - **Enums chuẩn** ([`packages/shared/src/enums/index.ts`](../../packages/shared/src/enums/index.ts)): `AllocationMode`, `CircleStatus`, `RoundStatus`, `MemberStatus`, `TransactionType`, `TransactionStatus`.
  - **Constants & Helpers** ([`packages/shared/src/constants/index.ts`](../../packages/shared/src/constants/index.ts)): `AVALANCHE_FUJI_CHAIN_ID = 43113`, `USDC_DECIMALS = 6`, `USDC_SYMBOL = 'mUSDC'`, bảng quy đổi trạng thái số trên Smart Contract (`0, 1, 2, 3`) sang Enum, hàm `formatTokenUnits()`.
  - **DTO & Response Types** ([`packages/shared/src/types/index.ts`](../../packages/shared/src/types/index.ts)): `UserProfileDto`, `CircleDetailDto`, `RoundDetailDto`, `CircleMemberDto`, `ContributionDto`, `BidDto`, `PayoutDto`, `TransactionRecordDto`, `NotificationItemDto`.
  - **Bộ Mock Data chuẩn** ([`packages/shared/src/mocks/avahuiMockData.ts`](../../packages/shared/src/mocks/avahuiMockData.ts)): `MOCK_CURRENT_USER` và `MOCK_CIRCLES` phục vụ chế độ `NEXT_PUBLIC_USE_MOCK=true` của Track A.
- **`@avahui/blockchain`** ([`packages/blockchain/src/index.ts`](../../packages/blockchain/src/index.ts)):
  - **ABIs dạng `as const`** (hỗ trợ `wagmi` / `viem` auto-complete kiểu dữ liệu): [`MockUSDCABI.ts`](../../packages/blockchain/src/abi/MockUSDCABI.ts), [`AvaHuiFactoryABI.ts`](../../packages/blockchain/src/abi/AvaHuiFactoryABI.ts), [`AvaHuiCircleABI.ts`](../../packages/blockchain/src/abi/AvaHuiCircleABI.ts).
  - **Chain & Contract Addresses**: [`AVALANCHE_FUJI_CHAIN`](../../packages/blockchain/src/chains/index.ts) và hàm [`getContractAddresses(chainId)`](../../packages/blockchain/src/addresses/index.ts).

---

### 1.2. Hệ thống Smart Contracts (`apps/contracts` — Solidity 0.8.24)
Đã xây dựng đầy đủ 3 Smart Contracts cốt lõi kèm thư viện bảo mật `SafeTransferLib` & `ReentrancyGuard`:
1. **[`MockUSDC.sol`](../../apps/contracts/src/mocks/MockUSDC.sol)**:
   - Token ERC-20 (`decimals = 6`, ký hiệu `mUSDC`).
   - Hỗ trợ hàm `faucet(uint256 amount)` (nếu truyền `0` tự động mint `1,000 mUSDC`, giới hạn tối đa `50,000 mUSDC`/lần) và `mint(address to, uint256 amount)`.
2. **[`AvaHuiFactory.sol`](../../apps/contracts/src/AvaHuiFactory.sol)**:
   - Kiểm tra chặt chẽ các thông số trong `CreateCircleParams` (`maxMembers` từ `5..10`, `collateralAmount >= contributionAmount`, giới hạn `minBid`/`maxBid <= BasePot / 2`).
   - Khởi tạo instance `AvaHuiCircle` mới, lưu danh sách `getAllCircles()` và phát sự kiện `CircleCreated`.
3. **[`AvaHuiCircle.sol`](../../apps/contracts/src/AvaHuiCircle.sol)**:
   - **`joinCircle()`**: Khóa `collateralAmount` (`mUSDC`), gán `slotIndex` (`1..maxMembers`). Khi người thứ `maxMembers` tham gia, tự động chuyển sang `ACTIVE`, mở Vòng 1 và phát `CircleActivated`.
   - **`contribute(roundNumber)`**: Đóng tiền kỳ hiện tại (`contributionAmount`), phát `ContributionMade`.
   - **`submitBid(roundNumber, bidAmount)`**: Đấu giá chiết khấu cho chế độ `BIDDING`. Chỉ cho phép thành viên chưa từng nhận Payout (`hasReceivedPayout == false`), áp dụng quy tắc Tie-breaker (`bidAmount > highestBid`).
   - **`settleRound(roundNumber)`**:
     - Cho phép kết toán khi: (1) Đủ `maxMembers` đã đóng tiền (và hết giờ đấu giá nếu `BIDDING`), HOẶC (2) Đã quá hạn `contributionDeadline + gracePeriod`.
     - **Auto-Cover Slashing**: Tự động trích `contributionAmount` từ `lockedCollateral` của thành viên trễ hạn để bù vào quỹ, phát `CollateralSlashed`, đảm bảo người thắng luôn nhận đủ 100% Payout đúng hạn.
     - Tự động mở vòng kế tiếp hoặc chuyển dây hụi sang `COMPLETED` khi hoàn tất vòng cuối.
   - **`withdrawCollateral()`**: Hoàn trả thế chấp còn lại + chia đều `totalDiscountPool` cho `maxMembers` (phần dư phép chia nguyên `remainder` được cộng cho `creator` để số dư Contract về đúng `0`).
   - **`cancelExpiredCircle()`**: Hủy dây hụi quá hạn tuyển người (`block.timestamp > startDeadline`) để thành viên rút lại 100% thế chấp.
4. **Bộ Test Foundry & Script Biên dịch**:
   - Unit Tests: [`AvaHuiCircleFixed.t.sol`](../../apps/contracts/test/unit/AvaHuiCircleFixed.t.sol), [`AvaHuiCircleBidding.t.sol`](../../apps/contracts/test/unit/AvaHuiCircleBidding.t.sol), [`AvaHuiSlashing.t.sol`](../../apps/contracts/test/unit/AvaHuiSlashing.t.sol).
   - Fuzz Test: [`AvaHuiAccountingFuzz.t.sol`](../../apps/contracts/test/fuzz/AvaHuiAccountingFuzz.t.sol).
   - Script Deploy & Giả lập: [`DeployFuji.s.sol`](../../apps/contracts/script/DeployFuji.s.sol), [`SimulateLifecycle.s.sol`](../../apps/contracts/script/SimulateLifecycle.s.sol).
   - Script biên dịch bằng Node `solc`: [`scripts/compile-contracts.js`](../../scripts/compile-contracts.js) xuất ABI & Bytecode ra `apps/contracts/out/`.

---

### 1.3. Cơ sở dữ liệu PostgreSQL & Prisma ORM (`apps/api/prisma`)
- Hoàn thiện [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) ánh xạ 100% với 13 bảng và 6 Enums trong [`infrastructure/database/init/01-init-schema.sql`](../../infrastructure/database/init/01-init-schema.sql).
- Xây dựng script nạp dữ liệu mẫu [`apps/api/prisma/seeds/seed.ts`](../../apps/api/prisma/seeds/seed.ts) tạo sẵn 5 tài khoản demo và 2 dây hụi mẫu (`BIDDING` đang ở Vòng 2/5 và `FIXED` đang `RECRUITING`).

---

### 1.4. NestJS Backend API & Blockchain Event Indexer (`apps/api`)
- **Cấu hình Server & Swagger**: Chạy tại `http://localhost:3001/api/v1`, tài liệu Swagger UI tại `http://localhost:3001/api/docs` ([`apps/api/src/main.ts`](../../apps/api/src/main.ts)).
- **Cơ chế Xác thực linh hoạt ([`PrivyAuthGuard`](../../apps/api/src/guards/privy-auth.guard.ts))**:
  - Hỗ trợ giải mã JWT `Bearer <privy_access_token>` từ Privy.
  - Hỗ trợ chế độ **Dev / Demo Fallback**: Cho phép truyền `Authorization: Bearer mock-token` hoặc truyền địa chỉ ví vào header `x-wallet-address: 0x...` để test dễ dàng ở môi trường `development`.
- **10 REST Endpoints hoàn chỉnh**:
  1. `POST /api/v1/auth/sync` — Đồng bộ user & ví nhúng Privy vào bảng `users` + `wallets`.
  2. `GET /api/v1/users/me` — Lấy hồ sơ user và 4 chỉ số thống kê Dashboard (`activeCirclesCount`, `totalContributed`, `totalCollateralLocked`, `totalPayoutReceived`).
  3. `PATCH /api/v1/users/me` — Cập nhật `displayName`, `avatarUrl`.
  4. `POST /api/v1/circles/draft` — Lưu bản nháp dây hụi, trả về `metadataId` để truyền vào hàm `createCircle` trên Smart Contract.
  5. `GET /api/v1/circles` — Danh sách dây hụi (lọc theo `status`, `mode`, `memberAddress`, phân trang).
  6. `GET /api/v1/circles/:id` — Chi tiết đầy đủ 1 dây hụi (hỗ trợ truyền `id` UUID, `metadataId`, hoặc `contractAddress`).
  7. `GET /api/v1/circles/:id/rounds/:roundNumber` — Chi tiết đóng tiền, đấu giá và giải ngân của 1 vòng.
  8. `POST /api/v1/transactions/track` — Ghi nhận `txHash` trạng thái `PENDING` ngay khi user ký giao dịch.
  9. `GET /api/v1/transactions/my` — Lịch sử giao dịch của user hiện tại.
  10. `GET /api/v1/notifications` & `PATCH /api/v1/notifications/:id/read` — Danh sách thông báo & đánh dấu đã đọc.
- **Event Indexer Worker ([`BlockchainIndexerService`](../../apps/api/src/modules/blockchain/services/blockchain-indexer.service.ts))**:
  - Quét log sự kiện định kỳ mỗi `3 giây` với độ trễ an toàn `latestBlock - 2`.
  - Xử lý Idempotent toàn bộ 9 sự kiện (`CircleCreated`, `MemberJoined`, `CircleActivated`, `ContributionMade`, `BidSubmitted`, `CollateralSlashed`, `RoundSettled`, `CircleCompleted`, `CollateralWithdrawn`, `CircleCancelled`) bên trong `prisma.$transaction` qua khóa `UNIQUE (chain_id, tx_hash, log_index)`.

---

## PHẦN 2: CÁC BƯỚC KIỂM THỬ & VẬN HÀNH (VERIFICATION GUIDE)

### Bước 1: Kiểm thử Tự động (Smart Contract Compilation + Unit/Integration Tests)
Chạy tại thư mục gốc của dự án:
```bash
# 1. Biên dịch Smart Contracts bằng solc 0.8.24 (xuất ra apps/contracts/out/)
node scripts/compile-contracts.js

# 2. Chạy bộ Jest Test kiểm tra Smart Contract ABI Parity, Indexer Idempotency & Services
pnpm --filter @avahui/api test

# 3. Kiểm tra Build Production của Backend API
pnpm --filter @avahui/api build
```
*(Nếu máy đã cài Foundry CLI, có thể chạy thêm `forge test -vvv` trong thư mục `apps/contracts` để chạy bộ Unit & Fuzz Test Solidity).*

### Bước 2: Khởi chạy PostgreSQL & Nạp Dữ Liệu Mẫu (Seed)
```bash
# 1. Bật container PostgreSQL 17 (tự động chạy 01-init-schema.sql tạo 13 bảng + 6 Enums)
pnpm db:up

# 2. Sinh Prisma Client và nạp dữ liệu mẫu (5 users + 2 dây hụi mẫu)
pnpm --filter @avahui/api prisma:generate
pnpm --filter @avahui/api prisma:seed
```

### Bước 3: Chạy Backend Server & Kiểm thử trên Swagger UI
```bash
pnpm dev:api
```
- Mở trình duyệt truy cập **Swagger UI**: `http://localhost:3001/api/docs`
- Hoặc kiểm tra nhanh bằng `curl` / PowerShell:
```powershell
# Lấy danh sách các dây hụi
curl http://localhost:3001/api/v1/circles

# Lấy chi tiết dây hụi theo metadataId hoặc contractAddress
curl http://localhost:3001/api/v1/circles/meta_001

# Lấy hồ sơ & thống kê Dashboard của user hiện tại (dùng Dev token hoặc header x-wallet-address)
curl -H "Authorization: Bearer mock-token" http://localhost:3001/api/v1/users/me
```

---

## PHẦN 3: HƯỚNG DẪN TÍCH HỢP DÀNH CHO TRACK A (FRONTEND `@avahui/web`)

### 3.1. Cách Import Types, Enums, Mock Data & ABIs
Frontend **không cần tự định nghĩa lại** các Enum, Interface hay ABI. Hãy thêm `"@avahui/shared": "workspace:*"` và `"@avahui/blockchain": "workspace:*"` vào `apps/web/package.json` và import trực tiếp:

```typescript
// 1. Import Enums, Types, Constants và Mock Data từ @avahui/shared
import {
  AllocationMode,
  CircleStatus,
  RoundStatus,
  MemberStatus,
  TransactionType,
  TransactionStatus,
  MOCK_CURRENT_USER,
  MOCK_CIRCLES,
  formatTokenUnits,
  ALLOCATION_MODE_TO_SC,
} from '@avahui/shared';
import type {
  CircleDetailDto,
  RoundDetailDto,
  UserProfileDto,
  TransactionRecordDto,
} from '@avahui/shared';

// 2. Import ABIs, Chain Config và Contract Addresses từ @avahui/blockchain
import {
  AVALANCHE_FUJI_CHAIN,
  MockUSDCABI,
  AvaHuiFactoryABI,
  AvaHuiCircleABI,
  getContractAddresses,
} from '@avahui/blockchain';
```

---

### 3.2. Cấu hình Biến Môi Trường (`apps/web/.env.local`)
- **Khi phát triển UI độc lập bằng Mock Data:**
  ```env
  NEXT_PUBLIC_USE_MOCK=true
  ```
- **Khi ghép nối với Backend API & Avalanche Fuji Testnet (Track B):**
  ```env
  NEXT_PUBLIC_USE_MOCK=false
  NEXT_PUBLIC_API_URL=http://localhost:3001/api/v1
  NEXT_PUBLIC_CHAIN_ID=43113
  NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
  NEXT_PUBLIC_USDC_TOKEN_ADDRESS=<địa_chỉ_MockUSDC_sau_khi_deploy>
  NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS=<địa_chỉ_AvaHuiFactory_sau_khi_deploy>
  ```

---

### 3.3. Quy chuẩn Xác thực (Headers gửi lên Backend API)
Mọi request gọi tới `http://localhost:3001/api/v1/*` cần đính kèm:
```http
Authorization: Bearer <privy_access_token>
x-wallet-address: <địa_chỉ_ví_embedded_wallet_của_user>
```
> **Mẹo cho Frontend khi code chưa gắn Privy thật:** Ở môi trường `development`, `PrivyAuthGuard` của Backend cho phép truyền `Authorization: Bearer mock-token` kèm `x-wallet-address: 0x71C95911E9a5D330f4D621842EC243EE13432921` để đăng nhập thẳng vào tài khoản Demo `Minh Nguyễn`.

---

### 3.4. Luồng Phối Hợp Giữa Frontend, Backend API & Smart Contract (4 Luồng Quan Trọng)

#### Luồng 1: Đăng nhập & Đồng bộ Ví (`/login` -> `/dashboard`)
1. Sau khi Privy xác thực và tạo Embedded Wallet (`wallet.address`), Frontend gọi:
   ```http
   POST /api/v1/auth/sync
   {
     "walletAddress": "0x71C95911E9a5D330f4D621842EC243EE13432921",
     "email": "builder@avahui.io",
     "displayName": "Minh Nguyễn"
   }
   ```
2. API trả về đúng cấu trúc `UserProfileDto` (gồm cả `stats` 4 thẻ trên Dashboard).

#### Luồng 2: Tạo Dây Hụi Mới (`/circles/create`)
1. **Bước 1 (Lưu nháp Off-chain):** Gọi `POST /api/v1/circles/draft` truyền thông tin form (`name`, `description`, `allocationMode`, `maxMembers`, `contributionAmount`, `collateralAmount`, `roundDurationSeconds`...).
2. **Bước 2 (Nhận `metadataId`):** Backend trả về `{ id, metadataId, startDeadlineUnix, ... }`.
3. **Bước 3 (Gọi Smart Contract `AvaHuiFactory.createCircle`):**
   - Dùng `metadataId` và `startDeadlineUnix` vừa nhận để gọi hàm `createCircle(params)` trên `AvaHuiFactory` với `AvaHuiFactoryABI`.
4. **Bước 4 (Track Transaction):** Ngay khi ví ký xong và trả về `txHash`, gọi `POST /api/v1/transactions/track`:
   ```json
   {
     "txHash": "0x...",
     "txType": "CREATE_CIRCLE",
     "contractAddress": "<ROSCA_FACTORY_ADDRESS>",
     "circleId": "<id_hoặc_metadataId>"
   }
   ```
5. Khi giao dịch được confirm trên Fuji, **Event Indexer của Track B** tự động bắt sự kiện `CircleCreated`, cập nhật `contractAddress` và đổi trạng thái dây hụi từ `DRAFT` sang `RECRUITING`.

#### Luồng 3: Tham gia Dây Hụi (`joinCircle`) & Đóng Tiền (`contribute`)
Vì sử dụng token ERC-20 (`MockUSDC` - 6 decimals), Frontend luôn thực hiện 2 bước:
1. Kiểm tra `allowance(userAddress, circleContractAddress)` trên `MockUSDC`. Nếu `< requiredAmount` (`collateralAmount` khi Join, hoặc `contributionAmount` khi Contribute) thì gọi `MockUSDC.approve(circleContractAddress, requiredAmount)` trước.
2. Gọi `AvaHuiCircle.joinCircle()` hoặc `AvaHuiCircle.contribute(roundNumber)`.
3. Gửi `txHash` về `POST /api/v1/transactions/track` (với `txType: "JOIN_CIRCLE"` hoặc `"CONTRIBUTE"`).

#### Luồng 4: Đấu giá (`submitBid`), Kết toán (`settleRound`) & Rút Thế chấp (`withdrawCollateral`)
- **Đấu giá (`BIDDING`):** Gọi `AvaHuiCircle.submitBid(roundNumber, bidAmountBaseUnits)` (lưu ý `bidAmount` nhân `10^6`, phải `> highestBid` hiện tại và nằm trong `[minBid, maxBid]`).
- **Kết toán vòng (`settleRound`):** Nút `Kết toán Vòng #R` trên UI bật sáng khi:
  - `round.contributionsCount == circle.maxMembers` (và đã qua `biddingDeadline` nếu là `BIDDING`), **HOẶC**
  - Thời gian hiện tại đã vượt quá `round.graceDeadline` (kích hoạt chế độ tự động tịch thu thế chấp của người trễ hạn).
- **Lấy dữ liệu cập nhật:** Sau khi giao dịch confirm (~2-3 giây trên Avalanche Fuji), Frontend chỉ cần refetch `GET /api/v1/circles/:id` (hoặc truyền `contractAddress` vào `:id`) để nhận toàn bộ dữ liệu đã được format sẵn (`*Formatted`).
