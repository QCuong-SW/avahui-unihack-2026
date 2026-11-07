# LƯU Ý QUAN TRỌNG & XỬ LÝ SỰ CỐ KHI KIỂM THỬ / GHÉP NỐI (TRACK A & TRACK B)

Tài liệu này tổng hợp toàn bộ **các thay đổi cấu hình hạ tầng thực tế trong quá trình triển khai Track B** (như việc đổi port PostgreSQL sang `5433`, cơ chế build package dùng chung, CORS, định dạng số tiền/thời gian...) và **8 vấn đề phổ biến nhất mà Developer Track A (`@avahui/web`) có thể gặp phải** khi kiểm thử và ghép nối, kèm cách xử lý dứt điểm.

---

## 1. Các Thay Đổi Cấu Hình Hạ Tầng Cần Lưu Ý Ngay (Infrastructure Notes)

### 1.1. Cổng PostgreSQL Docker đã đổi từ `5432` sang `5433` (`localhost:5433`)
- **Bối cảnh thực tế:** Trên nhiều máy Windows của lập trình viên thường đã cài sẵn dịch vụ PostgreSQL chạy ngầm ở cổng mặc định `5432`. Khi bật thêm Docker PostgreSQL ở cổng `5432`, hai tiến trình sẽ xung đột cổng khiến Prisma kết nối nhầm vào PostgreSQL của Windows và báo lỗi:
  > `Authentication failed against database server at localhost, the provided database credentials for avahui_user are not valid.`
- **Thay đổi đã áp dụng:**
  - Container `avahui-postgres` trong [`docker-compose.yml`](../../docker-compose.yml) đã được ánh xạ ra cổng **`5433`** trên máy host (`5433:5432`).
  - Biến `DATABASE_URL` trong [`.env.example`](../../.env.example) và [`apps/api/.env.example`](../../apps/api/.env.example) đã được cập nhật thành:
    ```env
    POSTGRES_PORT=5433
    DATABASE_URL=postgresql://avahui_user:avahui_secret_password_change_me@localhost:5433/avahui_db?schema=public
    ```
- **Lưu ý cho Track A khi kéo code (`git pull`):**
  - Nếu máy của Track A **đã tạo file `.env` hoặc `apps/api/.env` từ trước**, hãy kiểm tra và đổi `:5432/` thành `:5433/` trong `DATABASE_URL` (hoặc copy lại từ `.env.example`), sau đó chạy lại `pnpm db:up` để Docker mở cổng `5433`.
  - Frontend (`apps/web`) **không kết nối trực tiếp vào cổng `5433`** mà chỉ gọi qua Backend API ở cổng **`3001`** (`http://localhost:3001/api/v1`).

---

### 1.2. Cơ chế Build của `@avahui/shared` và `@avahui/blockchain`
- Hai package `@avahui/shared` và `@avahui/blockchain` được cấu hình xuất ra thư mục `dist/` (`./dist/index.js` và `./dist/index.d.ts`) để Node.js bên phía NestJS (`@avahui/api`) chạy được ở cả chế độ `start:dev` lẫn `start:prod`.
- Trong [`apps/api/package.json`](../../apps/api/package.json), các script `prebuild`, `prestart`, `prestart:dev` đã được gắn tự động để biên dịch `@avahui/shared` và `@avahui/blockchain` trước khi Backend chạy.
- **Lưu ý cho Track A:**
  - Nếu Track A vừa pull code về và mở `apps/web` ngay mà chưa từng chạy `pnpm dev:api` hay `pnpm build`, IDE (VS Code / WebStorm) có thể báo đỏ `Cannot find module '@avahui/shared'` vì thư mục `packages/shared/dist` chưa được sinh ra.
  - **Cách xử lý (chỉ cần chạy 1 lần sau khi `pnpm install`):**
    ```powershell
    pnpm --filter @avahui/shared build
    pnpm --filter @avahui/blockchain build
    ```
  - Nếu dùng Next.js 14/15 trong `apps/web`, khuyến khích thêm cấu hình sau vào `apps/web/next.config.mjs` (hoặc `next.config.js`) để Next.js transpile mượt mà các workspace packages:
    ```javascript
    const nextConfig = {
      transpilePackages: ['@avahui/shared', '@avahui/blockchain'],
    };
    export default nextConfig;
    ```

---

## 2. Danh Sách 8 Vấn Đề Track A Có Thể Gặp Phải Khi Kiểm Thử & Ghép Nối

### Vấn đề #1: Lỗi `ERR_CONNECTION_REFUSED` khi gọi `http://localhost:3001/api/v1` hoặc mở `/api/docs`
- **Triệu chứng:** Trình duyệt báo *"Không thể truy cập trang web này (localhost đã từ chối kết nối)"* hoặc Frontend gọi `fetch` bị `Failed to fetch`.
- **Nguyên nhân:** Server Backend (`@avahui/api`) chưa được bật hoặc vừa bị tắt.
- **Cách khắc phục:**
  1. Đảm bảo Docker PostgreSQL đang chạy: `pnpm db:up`
  2. Mở 1 cửa sổ terminal riêng và giữ lệnh sau chạy liên tục:
     ```powershell
     pnpm dev:api
     ```
  3. Đợi terminal hiện dòng:
     `[AvaHuiAPI] AvaHui Backend API running on http://localhost:3001/api/v1`

---

### Vấn đề #2: Lỗi CORS khi Next.js chạy lệch cổng (ví dụ `localhost:3002` hoặc `127.0.0.1:3000`)
- **Triệu chứng:** Console trình duyệt báo lỗi `Access to fetch at 'http://localhost:3001/api/v1/...' from origin 'http://localhost:3002' has been blocked by CORS policy`.
- **Giải pháp đã tích hợp sẵn ở Track B:**
  - Trong [`apps/api/src/main.ts`](../../apps/api/src/main.ts), khi `NODE_ENV !== 'production'`, Backend đã được cấu hình **cho phép tự động mọi cổng trên `localhost:*` và `127.0.0.1:*`** (dù Next.js chạy ở port `3000`, `3002` hay `3005` đều không bị chặn CORS).
  - Khi deploy Production, chỉ cần khai báo đúng domain vào biến `CORS_ORIGIN` trong `.env`.

---

### Vấn đề #3: Lỗi `401 Unauthorized` khi gọi các API cần đăng nhập (`/users/me`, `/circles/draft`, `/transactions/track`)
- **Nguyên nhân:** Quên truyền header `Authorization: Bearer <token>` hoặc truyền sai định dạng.
- **Cách xử lý chuẩn cho Track A:**
  - Trong axios/fetch interceptor của `apps/web/src/lib/api`:
    ```typescript
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${privyAccessToken || 'mock-token'}`,
    };
    if (walletAddress) {
      headers['x-wallet-address'] = walletAddress;
    }
    ```
  - Nhờ cơ chế fallback trong [`PrivyAuthGuard`](../../apps/api/src/guards/privy-auth.guard.ts), ngay cả khi Track A chưa cấu hình `PRIVY_APP_ID` thật, chỉ cần gửi `Authorization: Bearer mock-token` và `x-wallet-address: <địa_chỉ_ví>` là Backend sẽ tự động nhận diện đúng user theo ví đó!

---

### Vấn đề #4: Nhầm lẫn giữa Số tiền `Base Units (6 decimals)` và `Formatted String`
- **Triệu chứng:**
  - Hiển thị trên giao diện bị gấp `1,000,000` lần (VD: hiện `100,000,000 mUSDC` thay vì `100.00 mUSDC`).
  - Hoặc khi tạo dây hụi / đặt bid trên Smart Contract chỉ truyền `100` thay vì `100000000` (`100 * 10^6`) khiến giao dịch revert `BidOutOfBounds()` hoặc đóng có `0.0001 mUSDC`.
- **Quy tắc bắt buộc khi ghép nối:**
  1. **Khi HIỂN THỊ lên UI:** Luôn dùng các trường có đuôi `*Formatted` do Backend trả về sẵn:
     - `circle.contributionAmountFormatted` (`"100.00"`)
     - `circle.collateralAmountFormatted` (`"100.00"`)
     - `round.grossPotFormatted` (`"500.00"`), `round.winningBidFormatted` (`"12.00"`), `round.netPayoutFormatted` (`"488.00"`)
     - `member.lockedCollateralFormatted` (`"100.00"`)
  2. **Khi GỬI LÊN Backend (`POST /circles/draft`) hoặc Smart Contract (`createCircle`, `submitBid`, `approve`):**
     - Luôn đổi sang đơn vị cơ sở (`base units`, `decimals = 6`) bằng `parseUnits(valueString, 6)` của `viem`:
       ```typescript
       import { parseUnits } from 'viem';
       const contributionBaseUnits = parseUnits('100', 6); // 100000000n
       ```

---

### Vấn đề #5: Giao dịch `joinCircle()` hoặc `contribute()` bị Revert trên Smart Contract
- **Triệu chứng:** Bấm *"Tham gia dây hụi"* hoặc *"Đóng hụi"* thì ví báo lỗi `SafeTransferFromFailed()` / `InsufficientAllowance()` hoặc `InsufficientBalance()`.
- **Nguyên nhân:**
  1. Ví của user mới tạo chưa có `mUSDC` (chưa bấm Faucet).
  2. Chưa gọi hàm `MockUSDC.approve(circleContractAddress, amount)` trước khi gọi `joinCircle()` hoặc `contribute()`.
- **Cách xử lý trên UI Track A:**
  - Nút **`Faucet +1,000 mUSDC`** trên thanh Navbar gọi hàm `faucet(1000000000n)` (hoặc `faucet(0n)` — Contract tự hiểu là mint `1,000 mUSDC`) trên contract `MockUSDC`.
  - Trước khi gọi `joinCircle()`, kiểm tra `allowance(userWallet, circleAddress)`: nếu `< BigInt(circle.collateralAmount)` thì gọi `approve(circleAddress, maxUint256)` (hoặc đúng số tiền cần khóa) và đợi `waitForTransactionReceipt` xong rồi mới gọi `joinCircle()`.

---

### Vấn đề #6: Dây hụi vừa tạo xong trên Smart Contract nhưng chưa thấy ngay ở `GET /api/v1/circles`
- **Nguyên nhân:**
  - Endpoint `GET /api/v1/circles` mặc định ẩn các bản ghi đang ở trạng thái `DRAFT` (chỉ hiện từ `RECRUITING`, `ACTIVE`, `COMPLETED`, `CANCELLED`).
  - Sau khi `AvaHuiFactory.createCircle()` được confirm trên mạng Avalanche Fuji, **Event Indexer** của Backend quét định kỳ mỗi `3 giây` (`INDEXER_POLL_INTERVAL_MS=3000`) với độ trễ an toàn `2 blocks` (~4–6 giây) để chuyển trạng thái từ `DRAFT` sang `RECRUITING`.
- **Cách xử lý mượt mà trên UI Track A:**
  - Ngay sau khi `POST /api/v1/circles/draft` trả về `{ id, metadataId }`, Frontend đã có thể điều hướng sang `/circles/${metadataId}` (vì `GET /api/v1/circles/:id` vẫn trả về đầy đủ chi tiết ngay cả khi đang `DRAFT`) và bật polling `refetchInterval: 3000` (React Query) cho đến khi `circle.status === 'RECRUITING'`.

---

### Vấn đề #7: Lỗi `InvalidStartDeadline` hoặc `InvalidBidBounds` khi gọi `AvaHuiFactory.createCircle`
- **Nguyên nhân:** Smart Contract [`AvaHuiFactory.sol`](../../apps/contracts/src/AvaHuiFactory.sol) kiểm tra rất chặt các điều kiện:
  1. `startDeadline` (tính bằng Unix timestamp **giây**, không phải mili-giây!) bắt buộc phải `> block.timestamp` hiện tại. (Hàm `POST /api/v1/circles/draft` đã trả sẵn trường `startDeadlineUnix` tính bằng giây để Frontend truyền thẳng vào Contract!).
  2. Nếu `allocationMode == 1` (`BIDDING`):
     - `biddingDuration` phải `> 0` và `<= roundDuration`.
     - `maxBid` phải `> 0`, `>= minBid` và **`<= (maxMembers * contributionAmount) / 2`** (không vượt quá 50% tổng quỹ 1 vòng).
  3. Nếu `allocationMode == 0` (`FIXED`): truyền `biddingDuration = 0`, `minBid = 0`, `maxBid = 0`.

---

### Vấn đề #8: Đồng bộ Địa chỉ Smart Contract sau khi Deploy mới lên Fuji Testnet
- **Triệu chứng:** Frontend tương tác với Contract A nhưng Backend Indexer lại đang lắng nghe ở Contract B (hoặc `0x0000...`).
- **Quy trình chuẩn khi Deploy Contract mới:**
  Sau khi chạy script deploy lên Avalanche Fuji, cần cập nhật **cùng một cặp địa chỉ `MockUSDC` và `AvaHuiFactory`** vào cả 2 nơi:
  1. `apps/api/.env` (và `.env` gốc):
     ```env
     USDC_TOKEN_ADDRESS=0x...
     ROSCA_FACTORY_ADDRESS=0x...
     ```
  2. `apps/web/.env.local`:
     ```env
     NEXT_PUBLIC_USDC_TOKEN_ADDRESS=0x...
     NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS=0x...
     ```
  3. Khởi động lại `pnpm dev:api` để `BlockchainIndexerService` bắt đầu quét sự kiện từ `ROSCA_FACTORY_ADDRESS` mới.

---

## 3. Checklist Nhanh Cho Track A Trước Khi Bắt Đầu Ghép Nối

```powershell
# 1. Cài đặt dependencies & build 2 package cầu nối
pnpm install
pnpm --filter @avahui/shared build
pnpm --filter @avahui/blockchain build

# 2. Khởi chạy Docker PostgreSQL (cổng 5433) & nạp dữ liệu mẫu
pnpm db:up
pnpm --filter @avahui/api prisma:generate
pnpm --filter @avahui/api prisma:seed

# 3. Khởi chạy Backend API (cổng 3001)
pnpm dev:api

# 4. Mở trình duyệt kiểm tra Swagger UI
# -> http://localhost:3001/api/docs
```
