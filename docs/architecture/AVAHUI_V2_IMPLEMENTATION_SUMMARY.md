# AVAHUI PROTOCOL V2 — TỔNG HỢP TRIỂN KHAI BẢO MẬT, DEFI YIELD & HƯỚNG DẪN VẬN HÀNH

**Dự án:** **AvaHui (`avahui-unihack-2026`)** — *Trustless On-Chain ROSCA Platform on Avalanche*  
**Mạng lưới:** Avalanche Fuji C-Chain (`chainId: 43113`)  
**Nhánh triển khai:** `sercurity-quyền`  
**Phạm vi:** Smart Contracts (`@avahui/contracts`), Shared & ABI (`@avahui/shared`, `@avahui/blockchain`), Backend & Indexer (`@avahui/api`), Web3 Client (`@avahui/web`)

---

## 1. TỔNG HỢP CÁC TÍNH NĂNG BẢO MẬT & MỞ RỘNG V2 ĐÃ TRIỂN KHAI

### 1.1. Tầng 1: Smart Contracts (`apps/contracts` — Solidity `0.8.24`)
Đã thiết kế, triển khai và biên dịch thành công toàn bộ hệ thống hợp đồng V1 + V2 (tương thích ngược 100%):

| Hợp đồng / Interface | Đường dẫn tương đối | Chức năng Kỹ thuật & Bảo mật |
| :--- | :--- | :--- |
| **`AvaHuiCircle.sol`** | `apps/contracts/src/AvaHuiCircle.sol` | - **Module A (Sealed-Bid Commit-Reveal):** Đấu giá kín 2 pha (`commitBid` & `revealBid`) sử dụng mã băm miền phân tách `keccak256(abi.encodePacked(address(this), roundNumber, msg.sender, bidAmount, salt))` chống lộ giá trên Mempool và chống MEV Sniping.<br>- **Module B (DeFi Yield Routing):** Tự động gửi vốn thế chấp và tiền đóng góp vào `IYieldVault`, thu hoạch lãi suất trong `settleRound()` và chia đều lãi DeFi trong `withdrawCollateral()`.<br>- **Module C (EIP-712 Invite Voucher):** Hàm `joinCircleWithVoucher` xác thực vé mời dùng 1 lần (`usedInviteNonces[nonce]`) và hạn sử dụng `expiresAt`.<br>- **Module D (Anti-Sybil Nullifier):** Kiểm tra `hasIdentityJoined[identityHash]` đảm bảo mỗi cá nhân duy nhất chỉ tham gia tối đa 1 vị trí (1 slot) trong mỗi dây hụi. |
| **`AvaHuiYieldVault.sol`** | `apps/contracts/src/mocks/AvaHuiYieldVault.sol` | Vault sinh lời chuẩn ERC-4626 (`IYieldVault.sol`) tích hợp cơ chế tính lãi tự động theo thời gian thực (`800 bps = 8.0% APY`) trên vốn thế chấp nhàn rỗi. |
| **`Team1AttestationVerifier.sol`** | `apps/contracts/src/verifiers/Team1AttestationVerifier.sol` | Hợp đồng xác thực định danh chống tấn công Sybil (`ITeam1AttestationVerifier.sol`), lưu trữ `registeredIdentityOf` và phân tầng uy tín `trustTier` (`1..3`). |
| **`MockAvaxUsdcSwap.sol`** | `apps/contracts/src/mocks/MockAvaxUsdcSwap.sol` | Adapter hoán đổi tức thì `AVAX -> mUSDC` trên Avalanche Fuji giúp người dùng mới có ngay thanh khoản đóng thế chấp. |
| **`AvaHuiV2Security.t.sol`** | `apps/contracts/test/unit/AvaHuiV2Security.t.sol` | Bộ kiểm thử bảo mật V2 kiểm chứng đầy đủ 4 module: Commit-Reveal, ERC-4626 Yield, Single-use Invite Voucher và Sybil Nullifier Rejection. |

---

### 1.2. Tầng 2: Gói Dùng Chung & Blockchain ABIs (`packages/shared` & `packages/blockchain`)
- **`@avahui/shared`:**
  - `packages/shared/src/enums/index.ts`: Bổ sung `BiddingMechanism` (`OPEN`, `SEALED_COMMIT_REVEAL`) và các loại giao dịch V2 (`COMMIT_BID`, `REVEAL_BID`, `SWAP_AVAX_TO_USDC`).
  - `packages/shared/src/types/index.ts`: Mở rộng `CircleDetailDto`, `RoundDetailDto`, `CreateCircleFormInput`, `UserProfileDto` và `BidCommitmentDto` với các trường bảo mật & lợi suất V2 (`isSealedBid`, `isYieldEnabled`, `yieldApyBps`, `totalYieldEarnedFormatted`, `isPrivateCircle`, `requiresAttestation`, `isTeam1Verified`, `identityHash`, `trustTier`).
- **`@avahui/blockchain`:**
  - `packages/blockchain/src/abi/`: Cập nhật `AvaHuiCircleABI.ts` và bổ sung `AvaHuiYieldVaultABI.ts`, `Team1VerifierABI.ts`, `MockAvaxUsdcSwapABI.ts`.
  - `packages/blockchain/src/addresses/index.ts`: Bổ sung địa chỉ mặc định trên Avalanche Fuji (`43113`) và Anvil (`31337`) cho `avaHuiYieldVault`, `team1Verifier`, `mockAvaxUsdcSwap`.

---

### 1.3. Tầng 3: Backend API, Event Indexer & Autonomous Keeper (`apps/api`)
- **Mở rộng `BlockchainIndexerService` (`apps/api/src/modules/blockchain/services/blockchain-indexer.service.ts`):**
  - Giải mã và đồng bộ bất biến (idempotent) thêm 4 sự kiện on-chain V2: `BidCommitted`, `BidRevealed`, `YieldHarvested`, `AttestationVerified`.
- **Triển khai `AutonomousKeeperService` (`apps/api/src/modules/blockchain/services/autonomous-keeper.service.ts`):**
  - Tự động quét các vòng hụi đang mở đã qua thời hạn `graceDeadline` / `contributionDeadline` để kích hoạt kết toán tự động.
- **Bổ sung REST API Endpoints V2 (Swagger UI `/api/docs`):**
  - `POST /api/v1/circles/:id/invites`: Tạo vé mời chữ ký số dùng 1 lần (`voucherHash`, `nonce`, `expiresAt`, `inviteUrl`).
  - `POST /api/v1/circles/:id/invites/verify`: Xác minh tính hợp lệ và thời hạn của vé mời trước khi gọi hàm on-chain.
  - `POST /api/v1/auth/attestation`: Cấp mã băm định danh duy nhất (`identityHash`) và chữ ký chứng thực chống Sybil (`Team1Attestation`).
  - `POST /api/v1/auth/faucet-check`: Kiểm tra giới hạn tần suất nhận token thử nghiệm (Rate-Limited Cooldown Faucet).

---

### 1.4. Tầng 4: Giao Diện Web3 (`apps/web` — Next.js 14 + Viem)
- **Khởi tạo Dây hụi V2 (`apps/web/src/features/circles/components/CreateCircleView.tsx`):**
  - Tích hợp 4 tùy chọn cấu hình V2: *Sealed-Bid (Commit-Reveal)*, *ERC-4626 DeFi Yield (8% APY)*, *Team1 Sybil Attestation*, và *Private Invite Voucher (EIP-712)*.
- **Header Bảo mật & Link Mời 1-Click (`apps/web/src/features/circles/components/CircleHeader.tsx`):**
  - Hiển thị các huy hiệu trạng thái `SEALED-BID`, `YIELD 8% APY`, `TEAM1 SYBIL-SAFE` và nút **Invite Link** tạo & sao chép đường dẫn vé mời chữ ký số vào bộ nhớ tạm.
- **Bảng Điều khiển Đấu giá Kín 2 Pha & Lợi suất DeFi (`apps/web/src/features/circles/components/SmartActionBox.tsx`):**
  - Hỗ trợ quy trình 2 bước: **`1. Commit Sealed Bid (Ẩn giá)`** (tự động sinh `salt` 32-byte, tính `keccak256` hash và lưu vào `localStorage`) $\to$ **`2. Reveal Sealed Bid`** (đối chiếu `salt` và mở thăm).
  - Hiển thị thanh **ERC-4626 Yield Vault (8% APY)** tính lãi thời gian thực và cộng trực tiếp vào số tiền rút thế chấp cuối kỳ.
- **1-Click Swap `AVAX -> mUSDC` & Hồ sơ Định danh (`EmbeddedWalletBar.tsx` & `ProfileView.tsx`):**
  - Tích hợp nút **Swap** đổi nhanh `0.25 AVAX -> +10.00 mUSDC` ngay trên thanh công cụ ví và thẻ xác thực **Team1 Sybil Attestation** trong trang Hồ sơ cá nhân.
- **Sửa lỗi thứ tự React Hooks (`DashboardView.tsx` & `CircleDetailView.tsx`):**
  - Đảm bảo toàn bộ các React Hooks (`useMyTransactionsQuery`, tính toán `actionItems`) tuân thủ Rules of Hooks khi chuyển từ trạng thái `isLoading` sang dữ liệu thật từ Backend API.

---

## 2. HƯỚNG DẪN CHẠY THỬ NGHIỆM FULL-STACK & KIỂM THỬ

### 2.1. Khởi chạy Database PostgreSQL & Nạp dữ liệu mẫu
```bash
pnpm db:up
pnpm --filter @avahui/api exec prisma db push
pnpm --filter @avahui/api prisma:seed
```

### 2.2. Biên dịch Smart Contracts & Chạy Bộ Kiểm thử Tự động
```bash
# Biên dịch toàn bộ 15 Smart Contracts & Interfaces (Solidity 0.8.24)
node scripts/compile-contracts.js

# Chạy bộ kiểm thử Jest (Unit + E2E Circle Lifecycle + V2 Security)
pnpm --filter @avahui/api test
```

### 2.3. Khởi chạy Giao diện Web3 (`3000`) & Backend Swagger API (`3001`)
```bash
# Terminal 1: Chạy NestJS Backend API & Event Indexer
pnpm --filter @avahui/api start:dev

# Terminal 2: Chạy Next.js Frontend Web3
pnpm --filter @avahui/web dev
```
- **Giao diện Web3:** `http://localhost:3000`
- **Tài liệu Swagger API:** `http://localhost:3001/api/docs`
