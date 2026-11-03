# MASTER SPECIFICATION & MOCK CONTRACT — AVAHUI (ON-CHAIN ROSCA PLATFORM)
**Project Name:** **AvaHui** (*Avalanche + Hụi / On-Chain Saving Circles*)  
**Competition:** **AVALANCHE UNIHACK 2026** — *30 Days to Build on Avalanche (Ho Chi Minh City, Vietnam | 2–30 November 2026)*  
**Tagline:** *"Trustless On-Chain ROSCA (Hụi) Platform on Avalanche with Embedded Wallets & Collateral Protection"*  
**Repository / Workspace Name:** `avahui-platform` (Package Scope: `@avahui/*`)  
**Network:** Avalanche Fuji C-Chain (`chainId: 43113`)  
**Phiên bản Spec:** 2.1 (Parallel Development Spec)  
**Mục tiêu:** Tài liệu chuẩn hóa toàn bộ Giao diện (Frontend), Cơ sở dữ liệu (SQL), Backend API và Smart Contract Interface của **AvaHui** để **2 Developer** có thể code độc lập 100% (Frontend chạy bằng Mock chuẩn, Backend + Contract chạy bằng Script/Swagger) và khớp nối ngay lập tức khi tích hợp.

---

# PHẦN 0: ĐỊNH DANH DỰ ÁN & CẤU TRÚC MONOREPO (`avahui-platform`)

## 0.1. Thông tin định danh thống nhất
- **Tên thương hiệu hiển thị trên UI:** `AvaHui`
- **Badge cuộc thi trên Header / Footer / Landing:** `AVALANCHE UNIHACK 2026 — HO CHI MINH CITY, VIETNAM`
- **Chủ đề giao diện (UI Theme):** Đồng bộ trực tiếp với bộ nhận diện **Avalanche UniHack 2026**:
  - **Primary Accent:** Avalanche Crimson Red (`#E84142`)
  - **Background:** Carbon Black (`#09090B`) & Surface Card (`#121216`) kèm họa tiết ô vuông pixel đỏ đậm ở Banner chính (như poster UniHack).
  - **Status Colors:** Emerald (`#10B981` - Đã đóng tiền / Active), Amber (`#F59E0B` - Đang mở đấu giá / Sắp đến hạn), Rose (`#F43F5E` - Quá hạn / Slashed).
- **Tên các Package trong Monorepo (`pnpm-workspace.yaml`):**
  - `@avahui/web` (`apps/web` — Next.js Frontend)
  - `@avahui/api` (`apps/api` — NestJS Backend + Event Indexer)
  - `@avahui/contracts` (`apps/contracts` — Solidity + Foundry)
  - `@avahui/shared` (`packages/shared` — Shared Enums, Types, DTOs, Mock Data)
  - `@avahui/blockchain` (`packages/blockchain` — ABIs, Contract Addresses, Chain Config)
  - `@avahui/config` (`packages/config` — Shared TSConfig, ESLint)

---

# PHẦN 1: CHỐT QUY TẮC NGHIỆP VỤ (BUSINESS RULES CHUẨN MVP)

Để không phát sinh lỗi làm tròn số học (rounding dust) hoặc kẹt vòng hụi trên Smart Contract, toàn bộ hệ thống **AvaHui** thống nhất áp dụng bộ quy tắc chuẩn dưới đây (giải quyết dứt điểm các câu hỏi mở tại Mục 9 của Master Plan):

## 1.1. Thông số Dây hụi (Circle Configuration)
1. **Token sử dụng:** 1 loại ERC-20 duy nhất cho MVP (`MockUSDC` trên Avalanche Fuji, `decimals = 6`).
2. **Số lượng thành viên (`maxMembers`):** Từ `5` đến `10` người. Tổng số vòng (`totalRounds`) luôn bằng `maxMembers` (mỗi thành viên được nhận hụi đúng 1 lần trong suốt vòng đời dây hụi).
3. **Kích hoạt dây hụi:**
   - Khi mới tạo, dây hụi ở trạng thái `RECRUITING`.
   - Người dùng tham gia (`joinCircle`) trước khi dây hụi đủ người. Không cho phép tham gia hoặc tự ý rời đi sau khi dây hụi đã chuyển sang `ACTIVE`.
   - Ngay khi người thứ `maxMembers` tham gia thành công, Smart Contract tự động chuyển trạng thái dây hụi sang `ACTIVE` và mở **Round 1** ngay lập tức.
   - Nếu quá hạn tuyển người (`startDeadline`) mà chưa đủ `maxMembers`, dây hụi chuyển sang `CANCELLED` và những người đã vào được rút lại 100% tiền thế chấp.
4. **Đơn vị thời gian:** Mọi khoảng thời gian (`roundDuration`, `biddingDuration`, `gracePeriod`) đều lưu bằng **giây (`seconds`)** trên Smart Contract để vừa chạy được cấu hình thực tế (ngày/tuần), vừa cấu hình được `60s - 300s` khi đứng Demo trực tiếp tại **Avalanche UniHack 2026**.

## 1.2. Cơ chế Thế chấp (Collateral) & Xử lý Vi phạm (Default / Slashing)
1. **Thời điểm khóa:** Ngay khi gọi hàm `joinCircle()`, thành viên bắt buộc khóa một khoản thế chấp bằng token `MockUSDC`.
2. **Mức thế chấp bắt buộc (`requiredCollateral`):**
   - Cấu hình theo bội số của tiền đóng 1 kỳ (`contributionAmount`), tối thiểu bằng **100% `contributionAmount`** (1 kỳ đóng) hoặc `2x - 3x` tùy người tạo dây hụi chọn.
3. **Khi thành viên trễ hạn đóng tiền (Default & Auto-Cover bằng Slashing):**
   - Mỗi vòng có hạn đóng tiền là `contributionDeadline`. Sau hạn này là khoảng thời gian ân hạn `gracePeriod`.
   - Nếu hết `contributionDeadline + gracePeriod` mà thành viên `M` vẫn chưa đóng tiền cho vòng hiện tại:
     - Khi bất kỳ ai gọi hàm kết toán vòng (`settleRound`), Smart Contract sẽ tự động đánh dấu thành viên `M` vi phạm ở vòng đó và **trích xuất (slash) đúng một lượng bằng `contributionAmount` từ `lockedCollateral` của `M`** để đắp vào quỹ (`Pot`) của vòng hiện tại.
     - Nhờ cơ chế này, **người nhận tiền của vòng đó vẫn nhận đủ 100% tiền đúng hạn**, dây hụi không bị đứt gãy.
4. **Hoàn trả thế chấp:** Khi dây hụi kết thúc (`COMPLETED` sau vòng thứ `N`), thành viên bấm rút (`withdrawCollateral`) để nhận lại toàn bộ phần `lockedCollateral` còn dư của mình (cộng với tiền thưởng chiết khấu tích lũy nếu có).

## 1.3. Cơ chế Phân phối (Allocation Mechanism: `FIXED` vs `BIDDING`)
Tổng quỹ gốc mỗi vòng:
$$\text{BasePot} = \text{maxMembers} \times \text{contributionAmount}$$

1. **Chế độ Cố định (`FIXED`):**
   - Thứ tự nhận tiền được xác định theo thứ tự tham gia dây hụi (`slotIndex` từ `1` đến `maxMembers`).
   - Ở vòng `r` (`1 <= r <= N`), người nhận là thành viên có `slotIndex == r`.
   - Số tiền người thắng nhận được: $\text{Payout} = \text{BasePot}$. Không có đấu giá.

2. **Chế độ Đấu hụi (`BIDDING` — Đấu giá chiết khấu / Discount Bidding):**
   - Chỉ những thành viên **chưa từng nhận Payout ở các vòng trước (`hasReceivedPayout == false`)** mới được quyền gửi Bid.
   - **Ý nghĩa của `bidAmount`:** Là số tiền chiết khấu (tiền lời) mà người đấu giá chấp nhận bỏ lại cho dây hụi nếu được nhận hụi ở kỳ này.
   - **Giới hạn Bid:** `minBid <= bidAmount <= maxBid` (trong đó `maxBid <= BasePot / 2`).
   - **Xác định người thắng:**
     - Thành viên trả **`bidAmount` cao nhất** sẽ thắng vòng đó.
     - **Xử lý trùng giá (Tie-breaker):** Ai gửi mức giá đó sớm hơn sẽ giữ vị trí dẫn đầu; người gửi sau muốn vượt lên bắt buộc phải đặt `bidAmount > currentHighestBid`.
     - **Trường hợp không có ai đặt Bid khi hết giờ:** Hệ thống tự động chọn thành viên đầu tiên trong danh sách chưa nhận tiền (`hasReceivedPayout == false`) theo thứ tự `slotIndex` với `bidAmount = 0`.
   - **Phân phối dòng tiền trong chế độ `BIDDING` (Tránh lỗi chia lẻ):**
     - Người thắng vòng đó nhận về ngay lập tức:
       $$\text{Payout} = \text{BasePot} - \text{winningBidAmount}$$
     - Khoản tiền chiết khấu `winningBidAmount` được giữ trong Contract (`discountPool`) và chia đều cho toàn bộ `maxMembers` khi rút thế chấp cuối kỳ:
       $$\text{RewardPerMember} = \left\lfloor \frac{\text{TotalDiscountPool}}{\text{maxMembers}} \right\rfloor$$
     - Phần dư cực nhỏ do phép chia nguyên (`remainder < maxMembers` base units) được cộng cho người tạo dây hụi (`creator`) ở lần rút cuối cùng để số dư Contract về đúng bằng `0`.

---

# PHẦN 2: GIAO ƯỚC CHUNG (THE BRIDGE — DÙNG CHUNG CHO CẢ 2 NHÁNH)

Đây là "hợp đồng kỹ thuật" nằm tại `packages/shared` và `packages/blockchain`. Cả **Track A (Frontend)** và **Track B (Backend + Smart Contract)** bắt buộc tuân thủ 100% tên biến, kiểu dữ liệu và chữ ký hàm dưới đây.

## 2.1. Shared Enums (`packages/shared/src/enums.ts`)

```typescript
export enum AllocationMode {
  FIXED = 'FIXED',       // 0 trên Smart Contract
  BIDDING = 'BIDDING',   // 1 trên Smart Contract
}

export enum CircleStatus {
  Draft = 'DRAFT',           // Chỉ tồn tại off-chain khi đang tạo
  Recruiting = 'RECRUITING', // 0 trên SC: Đang gom thành viên
  Active = 'ACTIVE',         // 1 trên SC: Đủ người, đang chạy các vòng
  Completed = 'COMPLETED',   // 2 trên SC: Đã hoàn tất toàn bộ các vòng
  Cancelled = 'CANCELLED',   // 3 trên SC: Hủy do không đủ người đúng hạn
}

export enum RoundStatus {
  Pending = 'PENDING',       // 0 trên SC: Vòng tương lai chưa mở
  Open = 'OPEN',             // 1 trên SC: Đang mở đóng tiền (& đấu giá nếu BIDDING)
  Settled = 'SETTLED',       // 2 trên SC: Đã kết toán và trả Payout xong
}

export enum MemberStatus {
  Active = 'ACTIVE',
  Defaulted = 'DEFAULTED',   // Đã từng vi phạm bị trừ thế chấp
  Withdrawn = 'WITHDRAWN',   // Đã rút thế chấp sau khi kết thúc
}

export enum TransactionType {
  FAUCET_MINT = 'FAUCET_MINT',
  APPROVE_TOKEN = 'APPROVE_TOKEN',
  CREATE_CIRCLE = 'CREATE_CIRCLE',
  JOIN_CIRCLE = 'JOIN_CIRCLE',
  CONTRIBUTE = 'CONTRIBUTE',
  PLACE_BID = 'PLACE_BID',
  SETTLE_ROUND = 'SETTLE_ROUND',
  WITHDRAW_COLLATERAL = 'WITHDRAW_COLLATERAL',
  CANCEL_CIRCLE = 'CANCEL_CIRCLE',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}
```

## 2.2. Smart Contract Interface & Events (`packages/blockchain`)

Frontend chỉ cần bám vào các hàm và Event này để gắn `wagmi`, Backend chỉ cần bám vào các Event này để viết Indexer.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAvaHuiFactory {
    struct CreateCircleParams {
        string metadataId;            // UUID từ Backend hoặc chuỗi định danh ngắn
        string name;                  // Tên dây hụi
        address token;                // Địa chỉ MockUSDC trên Fuji
        uint8 allocationMode;         // 0 = FIXED, 1 = BIDDING
        uint8 maxMembers;             // 5..10
        uint256 contributionAmount;   // Số tiền đóng mỗi vòng (base units, 6 decimals)
        uint256 collateralAmount;     // Số tiền thế chấp phải khóa khi join
        uint256 roundDuration;        // Thời gian đóng tiền mỗi vòng (giây)
        uint256 biddingDuration;      // Thời gian đấu giá trong vòng (giây, <= roundDuration)
        uint256 gracePeriod;          // Thời gian ân hạn trước khi bị slash (giây)
        uint256 startDeadline;        // Hạn chót phải gom đủ thành viên (unix timestamp)
        uint256 minBid;               // Mức bid tối thiểu (0 nếu FIXED)
        uint256 maxBid;               // Mức bid tối đa (0 nếu FIXED)
    }

    event CircleCreated(
        address indexed circleAddress,
        address indexed creator,
        string metadataId,
        string name,
        address token,
        uint8 allocationMode,
        uint8 maxMembers,
        uint256 contributionAmount,
        uint256 collateralAmount
    );

    function createCircle(CreateCircleParams calldata params) external returns (address circleAddress);
    function getAllCircles() external view returns (address[] memory);
}

interface IAvaHuiCircle {
    // --- EVENTS CHO BACKEND INDEXER ---
    event MemberJoined(
        address indexed circleAddress,
        address indexed member,
        uint8 slotIndex,
        uint256 collateralLocked
    );

    event CircleActivated(
        address indexed circleAddress,
        uint256 startTime,
        uint8 currentRound,
        uint256 contributionDeadline,
        uint256 biddingDeadline
    );

    event ContributionMade(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed member,
        uint256 amount,
        uint256 timestamp
    );

    event BidSubmitted(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed bidder,
        uint256 bidAmount,
        uint256 timestamp
    );

    event CollateralSlashed(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed defaultedMember,
        uint256 slashedAmount,
        uint256 remainingCollateral
    );

    event RoundSettled(
        address indexed circleAddress,
        uint8 indexed roundNumber,
        address indexed recipient,
        uint256 grossPotAmount,
        uint256 winningBidAmount,
        uint256 netPayoutAmount,
        uint8 nextRoundNumber
    );

    event CircleCompleted(
        address indexed circleAddress,
        uint256 totalDiscountPool,
        uint256 timestamp
    );

    event CollateralWithdrawn(
        address indexed circleAddress,
        address indexed member,
        uint256 collateralReturned,
        uint256 discountBonusReturned
    );

    event CircleCancelled(
        address indexed circleAddress,
        uint256 timestamp
    );

    // --- WRITE FUNCTIONS CHO FRONTEND ---
    function joinCircle() external;
    function contribute(uint8 roundNumber) external;
    function submitBid(uint8 roundNumber, uint256 bidAmount) external;
    function settleRound(uint8 roundNumber) external;
    function withdrawCollateral() external;
    function cancelExpiredCircle() external;

    // --- READ FUNCTIONS CHO FRONTEND ---
    function getCircleSummary() external view returns (
        uint8 status,
        uint8 allocationMode,
        uint8 maxMembers,
        uint8 currentMemberCount,
        uint8 currentRound,
        uint256 contributionAmount,
        uint256 collateralAmount,
        uint256 totalDiscountPool
    );
}
```

## 2.3. Giao ước REST API (Giữa Frontend & Backend NestJS)

Toàn bộ API có prefix `/api/v1`. Header xác thực: `Authorization: Bearer <privy_access_token>`.

| Method | Endpoint | Mô tả | Auth |
|---|---|---|---|
| `POST` | `/auth/sync` | Đồng bộ user từ Privy & liên kết địa chỉ Embedded Wallet vào DB | Có |
| `GET` | `/users/me` | Lấy hồ sơ user hiện tại, danh sách ví và thống kê tổng quan Dashboard | Có |
| `PATCH` | `/users/me` | Cập nhật tên hiển thị (`displayName`), avatar | Có |
| `POST` | `/circles/draft` | Tạo bản ghi nháp (lưu mô tả chi tiết, trả về `metadataId` để truyền vào hàm `createCircle` trên SC) | Có |
| `GET` | `/circles` | Danh sách dây hụi (filter theo `status`, `mode`, `memberAddress`, phân trang) | Không/Có |
| `GET` | `/circles/:id` | Chi tiết đầy đủ 1 dây hụi (kèm `members`, `currentRound`, `rounds`, `bids`, `payouts`) | Không/Có |
| `GET` | `/circles/:id/rounds/:roundNumber` | Chi tiết đóng góp & đấu giá của 1 vòng cụ thể | Không/Có |
| `POST` | `/transactions/track` | Frontend báo cho Backend biết vừa gửi 1 `txHash` (trạng thái `PENDING`) để hiển thị ngay | Có |
| `GET` | `/transactions/my` | Lịch sử giao dịch của user hiện tại | Có |
| `GET` | `/notifications` | Danh sách thông báo của user (đến hạn đóng tiền, thắng bid, nhận payout...) | Có |
| `PATCH` | `/notifications/:id/read` | Đánh dấu đã đọc thông báo | Có |

---

# PHẦN 3: TRACK A — ĐẶC TẢ CHI TIẾT GIAO DIỆN (FRONTEND FULL + MOCK)

**Người phụ trách:** Developer Frontend (`@avahui/web`)  
**Nguyên tắc:** Xây dựng biến môi trường `NEXT_PUBLIC_USE_MOCK=true`. Khi bật cờ này, toàn bộ API calls và Blockchain hooks (`useAvaHuiActions`, `useTokenBalance`) đọc/ghi trên State/Mock JSON có độ trễ giả lập `800ms`, giúp xây dựng hoàn thiện 100% UI/UX không cần đợi Backend hay Smart Contract.

## 3.1. Chi tiết từng Màn hình & Tính năng Giao diện

### 1. Thanh điều hướng chung (Top Navbar & Wallet Status Bar)
Hiển thị xuyên suốt mọi trang sau khi đăng nhập:
- **Logo `AvaHui` & Badge `UNIHACK 2026`:** Kèm các menu chính `Dashboard`, `Explore Circles` (Khám phá dây hụi), `Create Circle` (Tạo dây hụi), `My Profile`.
- **Cụm trạng thái Blockchain & Ví nhúng (Privy Embedded Wallet Widget):**
  - Badge mạng lưới: `Avalanche Fuji (43113)` (Báo đỏ kèm nút `Switch Network` nếu lệch mạng).
  - Hiển thị số dư trực quan:
    - Số dư Gas: `1.25 AVAX` (Nếu `< 0.02 AVAX`, hiện cảnh báo vàng *"Sắp hết phí gas"* kèm link tới Fuji Faucet).
    - Số dư Token đóng hụi: `2,500.00 mUSDC`.
  - **Nút `Faucet +1,000 mUSDC`:** Bấm vào gọi hàm `faucet()` trên contract `MockUSDC` để tài khoản demo có tiền test ngay lập tức.
  - Địa chỉ ví rút gọn (`0x71C...89A`) kèm nút Copy nhanh.
- **Chuông thông báo (Notification Popover):** Hiển thị badge số thông báo chưa đọc, bấm vào xổ ra danh sách các sự kiện mới nhất.

### 2. Màn hình Đăng nhập & Khởi tạo Ví (`/login`)
- **Thành phần hiển thị:**
  - Hero Banner mang phong cách **Avalanche UniHack 2026** (nền đen lưới pixel đỏ `#E84142`).
  - Giới thiệu ngắn gọn nền tảng **AvaHui**: Minh bạch dòng tiền bằng Smart Contract trên Avalanche, Tự động bảo vệ bằng Tài sản thế chấp, Không cần cài đặt MetaMask.
  - Nút **Đăng nhập bằng Email / Google** (kích hoạt Modal của Privy).
- **Luồng xử lý trên UI:**
  1. Người dùng nhập Email + OTP hoặc chọn Google.
  2. Privy tự động tạo Embedded Wallet ngầm cho người dùng.
  3. Frontend hiện trạng thái *"Đang khởi tạo ví an toàn & đồng bộ tài khoản..."*, gọi `POST /api/v1/auth/sync` gửi kèm địa chỉ ví Privy.
  4. Chuyển hướng vào `/dashboard`.

### 3. Màn hình Tổng quan (`/dashboard`)
Chia làm 4 khu vực rõ ràng:
- **Khu vực 1 — 4 Thẻ Thống kê cá nhân (Stat Cards):**
  1. *Dây hụi đang tham gia:* Số lượng dây hụi `ACTIVE` + `RECRUITING` của tôi.
  2. *Tổng tiền đã đóng:* Tổng `mUSDC` đã đóng góp qua các kỳ.
  3. *Tài sản thế chấp đang khóa:* Tổng `mUSDC` đang nằm trong các Smart Contract làm thế chấp.
  4. *Tổng tiền hụi đã nhận:* Tổng `mUSDC` đã hốt hụi về ví.
- **Khu vực 2 — Cần thực hiện ngay (Action Required Banner/List):**
  - Liệt kê các vòng hụi mà người dùng **chưa đóng tiền** trong kỳ hiện tại hoặc **đủ điều kiện bấm nhận Payout**, kèm đồng hồ đếm ngược và nút thao tác nhanh (`Đóng ngay 100 mUSDC` / `Nhận Payout`).
- **Khu vực 3 — Dây hụi của tôi (`My Circles`):**
  - Tabs lọc: `Đang chạy (Active)` | `Đang chờ đủ người (Recruiting)` | `Đã kết thúc (Completed)`.
  - Mỗi thẻ dây hụi (Circle Card) hiển thị: Tên dây hụi, Badge chế độ (`FIXED` hoặc `BIDDING`), Số thành viên (`5/5`), Kỳ hiện tại (`Round 2/5`), Số tiền đóng mỗi kỳ (`100 mUSDC`), Tổng quỹ mỗi vòng (`500 mUSDC`), Trạng thái của bản thân trong vòng hiện tại (*"Đã đóng"* / *"Chưa đóng"* / *"Đã hốt hụi ở kỳ 1"*).
- **Khu vực 4 — Dây hụi đang mở tuyển thành viên (`Explore Recruiting Circles`):**
  - Hiển thị các dây hụi đang ở trạng thái `RECRUITING` để người dùng bấm vào xem và tham gia.

### 4. Màn hình Tạo Dây Hụi Mới (`/circles/create`)
Form chia làm 2 cột: **Cột trái (Nhập thông số)** và **Cột phải (Live Financial Preview — Bảng tính nhẩm tự động)**.
- **Cột trái — Các trường nhập liệu (React Hook Form + Zod):**
  1. `Tên dây hụi` (Bắt buộc, 3–60 ký tự, VD: *"Hụi Tiết Kiệm Builders UniHack"*).
  2. `Mô tả & Quy định nhóm` (Tùy chọn, tối đa 500 ký tự).
  3. `Chế độ phân phối (Allocation Mode)`: Radio Card chọn giữa:
     - **Cố định (`FIXED`):** Nhận tiền lần lượt theo thứ tự tham gia (`Slot 1 -> Slot N`).
     - **Đấu giá (`BIDDING`):** Thành viên chưa hốt hụi đấu giá mức chiết khấu để được nhận trước.
  4. `Số lượng thành viên tối đa (maxMembers)`: Slider hoặc Select từ `5` đến `10` người.
  5. `Số tiền đóng mỗi kỳ (contributionAmount)`: Nhập số `mUSDC` (VD: `100 mUSDC`).
  6. `Mức thế chấp bắt buộc (collateralAmount)`: Chọn nhanh theo hệ số `1x`, `2x`, hoặc `3x` tiền đóng 1 kỳ (VD: `100 mUSDC`).
  7. `Cấu hình thời gian (Hỗ trợ Preset "Chế độ Demo Nhanh UniHack" & "Chế độ Thực tế")`:
     - Nút gạt **"Demo Mode (Tính bằng phút/giây trên Fuji Testnet)"**: Cho phép nhập thời gian mỗi kỳ = `180 giây`, thời gian đấu giá = `120 giây`, thời gian ân hạn = `60 giây`.
     - Nếu ở chế độ thường: Nhập theo Ngày / Giờ (Frontend tự quy đổi ra `seconds` khi gửi lên Contract).
  8. `Giới hạn giá đấu (Chỉ hiện khi chọn BIDDING)`:
     - `Mức Bid tối thiểu (minBid)` (VD: `2 mUSDC`).
     - `Mức Bid tối đa (maxBid)` (VD: `50 mUSDC`).
- **Cột phải — Bảng xem trước quy tắc tài chính (Preview Card):**
  - Tự động tính và hiển thị rõ:
    - Tổng số vòng: `= maxMembers` vòng.
    - Tổng quỹ mỗi vòng (`Base Pot`): `maxMembers * contributionAmount` (VD: `5 * 100 = 500 mUSDC`).
    - Số tiền cần chuẩn bị khi tham gia: `collateralAmount` (khóa ngay khi Join).
  - Nút hành động: **`Tạo Dây Hụi On-Chain`** (Gọi `POST /circles/draft` lấy `metadataId` -> Gọi `AvaHuiFactory.createCircle(...)` ký bằng ví Privy).

### 5. Màn hình Chi tiết Dây Hụi (`/circles/[id]`) — Màn hình Trung tâm
Bố cục gồm **Header thông tin**, **Cột phải (Khung Thao tác thông minh — Smart Action Box)** và **Cột trái (4 Tabs thông tin chi tiết)**.

#### A. Header Dây hụi:
- Tên dây hụi, Badge trạng thái (`RECRUITING` / `ACTIVE` / `COMPLETED` / `CANCELLED`), Badge chế độ (`FIXED` / `BIDDING`).
- Địa chỉ Smart Contract của dây hụi kèm nút mở trên **Snowtrace Fuji Explorer**.
- Thanh thông số nhanh: `Mức đóng: 100 mUSDC/vòng` | `Tổng quỹ: 500 mUSDC` | `Thế chấp yêu cầu: 100 mUSDC` | `Vòng hiện tại: 2 / 5`.

#### B. Khung Thao tác Thông minh (Smart Action Box — Thay đổi theo trạng thái):
1. **Khi `status == RECRUITING`:**
   - Hiển thị thanh tiến độ gom người: `3 / 5 thành viên đã tham gia` + Hạn chót gom người.
   - Nếu User chưa tham gia: Hiển thị bước 1 `Approve 100 mUSDC` -> bước 2 `Tham gia & Khóa 100 mUSDC Thế chấp`.
   - Nếu User đã tham gia: Hiển thị *"Bạn đã ở vị trí Slot #2. Chờ thêm 2 thành viên nữa để dây hụi tự động kích hoạt."*
2. **Khi `status == ACTIVE` (Đang ở Vòng `R`):**
   - Hiển thị **Đồng hồ đếm ngược (Countdown)** tới hạn đóng tiền (`contributionDeadline`) và hạn đấu giá (`biddingDeadline`).
   - **Khối 1 — Nghĩa vụ đóng tiền kỳ này:**
     - Nếu chưa đóng: Nút **`Đóng hụi Vòng #R (100 mUSDC)`** (tự động kiểm tra `allowance`, nếu thiếu thì bật bước `Approve` trước).
     - Nếu đã đóng: Badge xanh **`Đã hoàn thành đóng góp Vòng #R`** kèm link `txHash`.
   - **Khối 2 — Đấu giá nhận hụi (Chỉ hiện khi `allocationMode == BIDDING` và trong thời gian đấu giá):**
     - Hiển thị: *"Mức Bid cao nhất hiện tại: **12 mUSDC** (bởi `An Trần`) — Người thắng sẽ thực nhận **488 mUSDC**"*.
     - Nếu User chưa từng nhận Payout ở các vòng trước: Hiển thị ô nhập `Số tiền chiết khấu muốn đặt (mUSDC)` + Nút **`Gửi Giá Đấu (Submit Bid)`** (Validate phải `> currentHighestBid` và nằm trong `[minBid, maxBid]`).
     - Nếu User đã từng nhận Payout ở vòng trước: Hiển thị thông báo *"Bạn đã nhận hụi ở Vòng #1 nên không tham gia đấu giá các vòng sau."*
   - **Khối 3 — Kết toán vòng & Phân phối tiền (`Settle & Payout`):**
     - Nút **`Kết toán Vòng #R & Chuyển Payout`** sẽ sáng lên (Enable) khi thỏa mãn **1 trong 2 điều kiện**:
       - *Điều kiện chuẩn:* Toàn bộ `maxMembers` đã đóng tiền xong (và đã hết giờ đấu giá nếu là chế độ `BIDDING`).
       - *Điều kiện xử lý vi phạm (Slashing):* Đã quá thời gian `contributionDeadline + gracePeriod` mà vẫn có người chưa đóng tiền -> Bấm nút này sẽ kích hoạt `settleRound(R)`: Contract tự động tịch thu thế chấp của người trễ hạn bù vào quỹ và chuyển Payout cho người thắng!
3. **Khi `status == COMPLETED`:**
   - Hiển thị tổng kết dây hụi: Tổng số vòng đã hoàn tất, tiền thưởng chiết khấu mỗi thành viên nhận thêm (`discountBonus`).
   - Nút **`Rút Thế chấp & Tiền thưởng (Withdraw Collateral)`**.

#### C. 4 Tabs Thông tin chi tiết (Cột chính):
- **Tab 1 — Vòng hiện tại (`Current Round`):** Bảng trạng thái đóng tiền của từng thành viên, Bảng lịch sử đặt giá (Bid Feed) và thông tin người dự kiến nhận tiền kỳ này.
- **Tab 2 — Thành viên & Thế chấp (`Members & Collateral`):** Danh sách thành viên (`Slot #1` -> `Slot #N`), trạng thái đã hốt hụi chưa, số dư thế chấp còn lại, số lần trễ hạn bị phạt.
- **Tab 3 — Lịch sử các Vòng & Payout (`Rounds & Payouts`):** Timeline từ Vòng 1 đến Vòng N, người nhận tiền, Tổng quỹ, Tiền chiết khấu, Thực nhận, Link Transaction trên Explorer.
- **Tab 4 — Lịch sử Giao dịch On-Chain (`Transactions`):** Danh sách mọi sự kiện đã diễn ra trong dây hụi kèm `blockNumber`, thời gian và `txHash`.

### 6. Màn hình Hồ sơ & Lịch sử Cá nhân (`/profile`)
- Chỉnh sửa tên hiển thị (`displayName`), xem địa chỉ Embedded Wallet và bảng toàn bộ lịch sử giao dịch cá nhân trên **AvaHui**.

### 7. Component Trạng thái Giao dịch Chuẩn (`TransactionLifecycleModal`)
Mọi hành động gọi Blockchain trên UI đều mở Modal hiển thị rõ **4 bước tiến trình**:
1. `Wallet Signing`: Đang chờ ví nhúng Privy ký xác nhận...
2. `Submitted to Avalanche Fuji`: Đã phát tán giao dịch (hiển thị `txHash`), đang chờ mạng xác nhận...
3. `Confirmed On-Chain`: Smart Contract đã thực thi thành công tại Block `#...`.
4. `Synced`: Backend đã cập nhật lịch sử và làm mới giao diện.

---

## 3.2. Bộ Mock Data Chuẩn cho Frontend (`packages/shared/src/mocks/avahuiMockData.ts`)

```typescript
import {
  AllocationMode,
  CircleStatus,
  RoundStatus,
  MemberStatus,
} from '../enums';

export const MOCK_CURRENT_USER = {
  id: 'usr_01HXYZ1',
  email: 'builder@avahui.io',
  displayName: 'Minh Nguyễn (UniHack Builder)',
  walletAddress: '0x71C95911E9a5D330f4D621842EC243EE13432921',
  avaxBalance: '1.45',
  usdcBalance: '2500.00', // 2,500 mUSDC
  stats: {
    activeCirclesCount: 2,
    totalContributed: '400.00',
    totalCollateralLocked: '300.00',
    totalPayoutReceived: '485.00',
  },
};

export const MOCK_CIRCLES = [
  // 1. Dây hụi đang ACTIVE ở chế độ BIDDING (Đang ở Vòng 2/5)
  {
    id: 'cir_bidding_active_01',
    metadataId: 'meta_001',
    contractAddress: '0x9A676e781A523b5d0C0e43731313A708CB607508',
    name: 'Hụi Đầu Tư Avalanche Builders — Kỳ Ngắn',
    description: 'Dây hụi 5 người chế độ đấu giá chiết khấu tại Avalanche UniHack 2026 TP.HCM.',
    creatorAddress: '0x71C95911E9a5D330f4D621842EC243EE13432921',
    tokenAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    tokenSymbol: 'mUSDC',
    tokenDecimals: 6,
    allocationMode: AllocationMode.BIDDING,
    status: CircleStatus.Active,
    maxMembers: 5,
    currentMemberCount: 5,
    currentRound: 2,
    totalRounds: 5,
    contributionAmount: '100000000', // 100 mUSDC
    contributionAmountFormatted: '100.00',
    collateralAmount: '100000000',   // 100 mUSDC
    collateralAmountFormatted: '100.00',
    roundDurationSeconds: 300,       // 5 phút / vòng (để demo)
    biddingDurationSeconds: 180,     // 3 phút đầu mở đấu giá
    gracePeriodSeconds: 60,          // 1 phút ân hạn
    minBid: '2000000',               // 2 mUSDC
    maxBid: '40000000',              // 40 mUSDC
    totalDiscountPool: '15000000',   // 15 mUSDC tích lũy từ vòng 1
    createdAt: '2026-11-02T07:00:00Z',
    members: [
      {
        slotIndex: 1,
        userId: 'usr_01HXYZ1',
        displayName: 'Minh Nguyễn (Bạn)',
        walletAddress: '0x71C95911E9a5D330f4D621842EC243EE13432921',
        lockedCollateralFormatted: '100.00',
        hasReceivedPayout: false,
        wonRoundNumber: null,
        defaultCount: 0,
        status: MemberStatus.Active,
      },
      {
        slotIndex: 2,
        userId: 'usr_02',
        displayName: 'Hoàng Lê',
        walletAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        lockedCollateralFormatted: '100.00',
        hasReceivedPayout: true,
        wonRoundNumber: 1,
        defaultCount: 0,
        status: MemberStatus.Active,
      },
      {
        slotIndex: 3,
        userId: 'usr_03',
        displayName: 'Tuấn Phạm',
        walletAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
        lockedCollateralFormatted: '100.00',
        hasReceivedPayout: false,
        wonRoundNumber: null,
        defaultCount: 0,
        status: MemberStatus.Active,
      },
      {
        slotIndex: 4,
        userId: 'usr_04',
        displayName: 'An Trần',
        walletAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
        lockedCollateralFormatted: '100.00',
        hasReceivedPayout: false,
        wonRoundNumber: null,
        defaultCount: 0,
        status: MemberStatus.Active,
      },
      {
        slotIndex: 5,
        userId: 'usr_05',
        displayName: 'Bảo Đặng',
        walletAddress: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
        lockedCollateralFormatted: '100.00',
        hasReceivedPayout: false,
        wonRoundNumber: null,
        defaultCount: 0,
        status: MemberStatus.Active,
      },
    ],
    rounds: [
      {
        roundNumber: 1,
        status: RoundStatus.Settled,
        startTime: '2026-11-02T07:05:00Z',
        contributionDeadline: '2026-11-02T07:10:00Z',
        biddingDeadline: '2026-11-02T07:08:00Z',
        graceDeadline: '2026-11-02T07:11:00Z',
        winnerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        winnerName: 'Hoàng Lê',
        grossPotFormatted: '500.00',
        winningBidFormatted: '15.00',
        netPayoutFormatted: '485.00',
        settlementTxHash: '0x88a1b2c3d4e5f60123456789abcdef0123456789abcdef0123456789abcdef01',
        contributionsCount: 5,
      },
      {
        roundNumber: 2,
        status: RoundStatus.Open,
        startTime: '2026-11-02T08:00:00Z',
        contributionDeadline: '2026-11-02T16:00:00Z',
        biddingDeadline: '2026-11-02T15:50:00Z',
        graceDeadline: '2026-11-02T16:30:00Z',
        winnerAddress: null,
        winnerName: null,
        grossPotFormatted: '500.00',
        winningBidFormatted: '12.00',
        netPayoutFormatted: '488.00',
        settlementTxHash: null,
        contributionsCount: 3,
        contributions: [
          {
            memberAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            memberName: 'Hoàng Lê',
            amountFormatted: '100.00',
            paidAt: '2026-11-02T08:01:12Z',
            txHash: '0x1111...aaaa',
          },
          {
            memberAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            memberName: 'Tuấn Phạm',
            amountFormatted: '100.00',
            paidAt: '2026-11-02T08:02:05Z',
            txHash: '0x2222...bbbb',
          },
          {
            memberAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            memberName: 'An Trần',
            amountFormatted: '100.00',
            paidAt: '2026-11-02T08:03:40Z',
            txHash: '0x3333...cccc',
          },
        ],
        bids: [
          {
            bidderAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            bidderName: 'Tuấn Phạm',
            bidAmountFormatted: '8.00',
            createdAt: '2026-11-02T08:02:30Z',
            txHash: '0x4444...dddd',
          },
          {
            bidderAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
            bidderName: 'An Trần',
            bidAmountFormatted: '12.00',
            createdAt: '2026-11-02T08:04:00Z',
            txHash: '0x5555...eeee',
          },
        ],
      },
    ],
  },

  // 2. Dây hụi đang RECRUITING ở chế độ FIXED
  {
    id: 'cir_fixed_recruiting_02',
    metadataId: 'meta_002',
    contractAddress: '0x0B306BF915C4d645ff596e518fAf3F9669b97016',
    name: 'Hụi Xoay Vòng Cố Định — Sinh Viên TP.HCM',
    description: 'Mỗi kỳ đóng 50 mUSDC, nhận lần lượt theo thứ tự tham gia, không cần đấu giá.',
    creatorAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    tokenAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    tokenSymbol: 'mUSDC',
    tokenDecimals: 6,
    allocationMode: AllocationMode.FIXED,
    status: CircleStatus.Recruiting,
    maxMembers: 5,
    currentMemberCount: 3,
    currentRound: 0,
    totalRounds: 5,
    contributionAmount: '50000000',
    contributionAmountFormatted: '50.00',
    collateralAmount: '50000000',
    collateralAmountFormatted: '50.00',
    roundDurationSeconds: 180,
    biddingDurationSeconds: 0,
    gracePeriodSeconds: 60,
    minBid: '0',
    maxBid: '0',
    totalDiscountPool: '0',
    createdAt: '2026-11-02T08:15:00Z',
    members: [],
    rounds: [],
  },
];
```

---

# PHẦN 4: TRACK B — ĐẶC TẢ DATABASE SQL, BACKEND & SMART CONTRACT

**Người phụ trách:** Developer Backend + Blockchain (`@avahui/api` & `@avahui/contracts`)  
**Nguyên tắc:** Phát triển và kiểm thử độc lập với Frontend bằng **Foundry Test/Script** và **Swagger UI (`http://localhost:3001/api/docs`)**.

## 4.1. Thiết kế Cơ sở dữ liệu SQL Đầy đủ (PostgreSQL DDL)

```sql
-- 1. KHỞI TẠO EXTENSION & ENUMS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE allocation_mode AS ENUM ('FIXED', 'BIDDING');
CREATE TYPE circle_status AS ENUM ('DRAFT', 'RECRUITING', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE round_status AS ENUM ('PENDING', 'OPEN', 'SETTLED');
CREATE TYPE member_status AS ENUM ('ACTIVE', 'DEFAULTED', 'WITHDRAWN');
CREATE TYPE tx_type AS ENUM (
    'FAUCET_MINT',
    'APPROVE_TOKEN',
    'CREATE_CIRCLE',
    'JOIN_CIRCLE',
    'CONTRIBUTE',
    'PLACE_BID',
    'SETTLE_ROUND',
    'WITHDRAW_COLLATERAL',
    'CANCEL_CIRCLE'
);
CREATE TYPE tx_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- 2. BẢNG USERS (Hồ sơ người dùng)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    privy_did VARCHAR(128) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. BẢNG WALLETS (Liên kết tài khoản với Embedded Wallet)
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address VARCHAR(42) NOT NULL UNIQUE,
    wallet_client_type VARCHAR(50) NOT NULL DEFAULT 'privy',
    is_primary BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_wallets_user_id ON wallets(user_id);
CREATE INDEX idx_wallets_address ON wallets(address);

-- 4. BẢNG CIRCLES (Thông tin dây hụi & trạng thái đồng bộ từ Contract)
CREATE TABLE circles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metadata_id VARCHAR(64) NOT NULL UNIQUE,
    contract_address VARCHAR(42) UNIQUE,
    chain_id INTEGER NOT NULL DEFAULT 43113,
    name VARCHAR(120) NOT NULL,
    description TEXT,
    creator_address VARCHAR(42) NOT NULL,
    token_address VARCHAR(42) NOT NULL,
    allocation_mode allocation_mode NOT NULL,
    status circle_status NOT NULL DEFAULT 'DRAFT',
    max_members SMALLINT NOT NULL CHECK (max_members BETWEEN 5 AND 10),
    current_member_count SMALLINT NOT NULL DEFAULT 0,
    current_round SMALLINT NOT NULL DEFAULT 0,
    total_rounds SMALLINT NOT NULL CHECK (total_rounds BETWEEN 5 AND 10),
    contribution_amount NUMERIC(78, 0) NOT NULL,
    collateral_amount NUMERIC(78, 0) NOT NULL,
    round_duration_seconds INTEGER NOT NULL,
    bidding_duration_seconds INTEGER NOT NULL DEFAULT 0,
    grace_period_seconds INTEGER NOT NULL,
    start_deadline TIMESTAMPTZ NOT NULL,
    min_bid NUMERIC(78, 0) NOT NULL DEFAULT 0,
    max_bid NUMERIC(78, 0) NOT NULL DEFAULT 0,
    total_discount_pool NUMERIC(78, 0) NOT NULL DEFAULT 0,
    creation_tx_hash VARCHAR(66),
    activated_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_circles_status ON circles(status);
CREATE INDEX idx_circles_creator ON circles(creator_address);
CREATE INDEX idx_circles_contract ON circles(contract_address);

-- 5. BẢNG CIRCLE_MEMBERS (Thành viên trong từng dây hụi)
CREATE TABLE circle_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    member_address VARCHAR(42) NOT NULL,
    slot_index SMALLINT NOT NULL,
    status member_status NOT NULL DEFAULT 'ACTIVE',
    has_received_payout BOOLEAN NOT NULL DEFAULT FALSE,
    won_round_number SMALLINT,
    default_count SMALLINT NOT NULL DEFAULT 0,
    join_tx_hash VARCHAR(66) NOT NULL,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, member_address),
    UNIQUE (circle_id, slot_index)
);
CREATE INDEX idx_circle_members_address ON circle_members(member_address);

-- 6. BẢNG COLLATERALS (Theo dõi tài sản thế chấp của từng thành viên)
CREATE TABLE collaterals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    member_id UUID NOT NULL UNIQUE REFERENCES circle_members(id) ON DELETE CASCADE,
    member_address VARCHAR(42) NOT NULL,
    initial_locked_amount NUMERIC(78, 0) NOT NULL,
    current_locked_amount NUMERIC(78, 0) NOT NULL,
    total_slashed_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    withdrawn_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    discount_bonus_claimed NUMERIC(78, 0) NOT NULL DEFAULT 0,
    is_withdrawn BOOLEAN NOT NULL DEFAULT FALSE,
    withdraw_tx_hash VARCHAR(66),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. BẢNG ROUNDS (Các vòng hụi của từng Circle)
CREATE TABLE rounds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    status round_status NOT NULL DEFAULT 'PENDING',
    start_time TIMESTAMPTZ,
    contribution_deadline TIMESTAMPTZ,
    bidding_deadline TIMESTAMPTZ,
    grace_deadline TIMESTAMPTZ,
    winner_address VARCHAR(42),
    gross_pot_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    winning_bid_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    net_payout_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    settled_at TIMESTAMPTZ,
    settlement_tx_hash VARCHAR(66),
    UNIQUE (circle_id, round_number)
);
CREATE INDEX idx_rounds_circle_status ON rounds(circle_id, status);

-- 8. BẢNG CONTRIBUTIONS (Lịch sử đóng tiền từng vòng)
CREATE TABLE contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    member_address VARCHAR(42) NOT NULL,
    amount NUMERIC(78, 0) NOT NULL,
    is_from_collateral_slash BOOLEAN NOT NULL DEFAULT FALSE,
    tx_hash VARCHAR(66) NOT NULL,
    contributed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, round_number, member_address)
);
CREATE INDEX idx_contributions_member ON contributions(member_address);

-- 9. BẢNG BIDS (Lịch sử đấu giá trong vòng hụi)
CREATE TABLE bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    bidder_address VARCHAR(42) NOT NULL,
    bid_amount NUMERIC(78, 0) NOT NULL,
    is_winning_bid BOOLEAN NOT NULL DEFAULT FALSE,
    tx_hash VARCHAR(66) NOT NULL,
    placed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_bids_round ON bids(round_id, bid_amount DESC);

-- 10. BẢNG PAYOUTS (Lịch sử giải ngân hụi từng vòng)
CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
    round_id UUID NOT NULL UNIQUE REFERENCES rounds(id) ON DELETE CASCADE,
    round_number SMALLINT NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    gross_amount NUMERIC(78, 0) NOT NULL,
    discount_amount NUMERIC(78, 0) NOT NULL DEFAULT 0,
    net_amount NUMERIC(78, 0) NOT NULL,
    tx_hash VARCHAR(66) NOT NULL,
    paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (circle_id, round_number),
    UNIQUE (circle_id, recipient_address)
);

-- 11. BẢNG BLOCKCHAIN_TRANSACTIONS (Theo dõi trạng thái giao dịch)
CREATE TABLE blockchain_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 43113,
    tx_hash VARCHAR(66) NOT NULL UNIQUE,
    sender_address VARCHAR(42) NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    circle_id UUID REFERENCES circles(id) ON DELETE SET NULL,
    tx_type tx_type NOT NULL,
    status tx_status NOT NULL DEFAULT 'PENDING',
    block_number BIGINT,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);
CREATE INDEX idx_tx_sender ON blockchain_transactions(sender_address);

-- 12. BẢNG BLOCKCHAIN_EVENTS (Lưu Event thô & chống xử lý trùng lặp)
CREATE TABLE blockchain_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chain_id INTEGER NOT NULL DEFAULT 43113,
    tx_hash VARCHAR(66) NOT NULL,
    log_index INTEGER NOT NULL,
    block_number BIGINT NOT NULL,
    block_timestamp TIMESTAMPTZ NOT NULL,
    contract_address VARCHAR(42) NOT NULL,
    event_name VARCHAR(80) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT TRUE,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chain_id, tx_hash, log_index)
);
CREATE INDEX idx_events_block_number ON blockchain_events(block_number);

-- 13. BẢNG INDEXER_STATE (Lưu con trỏ block cuối cùng đã quét)
CREATE TABLE indexer_state (
    chain_id INTEGER PRIMARY KEY,
    last_processed_block BIGINT NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 14. BẢNG NOTIFICATIONS (Thông báo cho người dùng)
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    circle_id UUID REFERENCES circles(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read);
```

---

## 4.2. Kiến trúc Backend NestJS (`@avahui/api` — Gom gọn 6 Modules)

1. **`AuthModule` (`/auth`):** Verify token Privy (`PrivyAuthGuard`), đồng bộ `users` & `wallets`.
2. **`UsersModule` (`/users`):** Quản lý hồ sơ và trả về 4 chỉ số thống kê Dashboard.
3. **`CirclesModule` (`/circles`):** Quản lý bản nháp tạo dây hụi (`POST /circles/draft`) và cung cấp toàn bộ API đọc chi tiết dây hụi, thành viên, vòng hụi, đóng góp, đấu giá, giải ngân, thế chấp.
4. **`TransactionsModule` (`/transactions`):** Ghi nhận `txHash` trạng thái `PENDING` từ Frontend và trả về lịch sử giao dịch.
5. **`BlockchainModule` (Event Indexer Worker):**
   - Quét logs định kỳ mỗi `3 giây` trên Avalanche Fuji với độ trễ an toàn `latestBlock - 2`.
   - Đảm bảo tính Idempotent tuyệt đối qua khóa `UNIQUE (chain_id, tx_hash, log_index)` trong `prisma.$transaction`.
6. **`NotificationsModule` (`/notifications`):** Quản lý thông báo cho thành viên dây hụi.

---

## 4.3. Đặc tả Smart Contract (`@avahui/contracts`)

- **`MockUSDC.sol`:** ERC-20 (`decimals = 6`) có hàm `faucet(uint256 amount)` cho phép nhận token test trực tiếp trên giao diện.
- **`AvaHuiFactory.sol`:** Triển khai các contract `AvaHuiCircle` mới, lưu danh sách địa chỉ và phát Event `CircleCreated`.
- **`AvaHuiCircle.sol`:** Quản lý toàn bộ vòng đời dây hụi (`joinCircle`, `contribute`, `submitBid`, `settleRound`, `withdrawCollateral`, `cancelExpiredCircle`) với `SafeERC20` và `ReentrancyGuard`.

---

# PHẦN 5: QUY TRÌNH PHÁT TRIỂN SONG SONG & GHÉP NỐI (INTEGRATION PLAYBOOK)

| Hạng mục | Developer A (`@avahui/contracts` + `@avahui/api`) | Developer B (`@avahui/web` + UI/UX + Privy) |
|---|---|---|
| **Môi trường chạy** | Foundry (`forge test`, `anvil`) + Docker PostgreSQL + NestJS (`port 3001`) | Next.js (`port 3000`) với cờ `NEXT_PUBLIC_USE_MOCK=true` |
| **Nguồn dữ liệu** | Dùng Foundry script bắn giao dịch giả lập trên local/Fuji -> Indexer tự quét Event ghi vào PostgreSQL -> Kiểm tra qua Swagger | Đọc từ `avahuiMockData.ts` và các hook giả lập (`useAvaHuiActionsMock`) |
| **Khi ghép nối** | Đẩy ABI + Địa chỉ Contract trên Fuji vào `@avahui/blockchain`, bật NestJS ở port `3001`. | Đổi `NEXT_PUBLIC_USE_MOCK=false`, kết nối trực tiếp API + Smart Contract trên Fuji. |
