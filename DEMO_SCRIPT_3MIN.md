# KỊCH BẢN DEMO THỰC CHIẾN AVAHUI — DƯỚI 3 PHÚT (180 GIÂY)
> **Mục tiêu:** Thuyết phục Ban Giám Khảo & Nhà Đầu Tư trong vòng 3 phút: Thấy rõ nỗi đau hụi truyền thống, cách Avahui giải quyết triệt để bằng Blockchain Avalanche, và chứng minh sản phẩm đã chạy thực tế mượt mà từ Đăng nhập, Ví, Đấu giá kín đến Giải ngân tự động.

---

## ⏱️ TỔNG QUAN PHÂN BỔ THỜI GIAN (180 GIÂY)

```
00:00 ──(30s)──> 00:30 ──(35s)──> 01:05 ──(55s)──> 02:00 ──(40s)──> 02:40 ──(20s)──> 03:00
 [Mở đầu & Nỗi đau] [Ví & Vào App]  [Bỏ Thăm Kín]   [Giải Ngân & Slash]  [Tổng kết & Kêu gọi]
```

| Mốc Thời Gian | Phân Cảnh / Màn Hình | Thông Điệp Cốt Lõi | Mục Tiêu Đạt Được |
| :--- | :--- | :--- | :--- |
| **00:00 – 00:30** (30s) | Landing Page (`/`) | Hụi truyền thống vỡ nợ vì phụ thuộc con người; Avahui thay bằng Hợp đồng thông minh | Đập tan định kiến, tạo sự tò mò tức thì |
| **00:30 – 01:05** (35s) | Login & Dashboard (`/dashboard`) | Ví nhúng thân thiện Web2, Faucet 1-click, minh bạch số dư | Chứng minh rào cản Web3 bằng 0 |
| **01:05 – 02:00** (55s) | Chi tiết Dây hụi (`/circles/[id]`) | Bỏ thăm kín 2 bước (Commit-Reveal) chống nhìn trộm giá | Trình diễn tính năng bảo mật độc bản V2 |
| **02:00 – 02:40** (40s) | Smart Action & Lịch sử vòng | Tiền cọc tự bù (Auto-Slash) + Lãi kép 6.5% Yield Vault | Trả lời câu hỏi: "Nếu có người bùng thì sao?" |
| **02:40 – 03:00** (20s) | Dashboard & Tổng kết | Nền tảng tài chính xoay vòng an toàn trên Avalanche | Kêu gọi hành động & mở phiên Q&A tự tin |

---

## 🛠️ CHECKLIST CHUẨN BỊ (2 PHÚT TRƯỚC KHI THUYẾT TRÌNH)

- [ ] **Mở sẵn 2 Tab trình duyệt Chrome:**
  - **Tab 1:** `http://localhost:3000/` (Trang Landing Page chào sân).
  - **Tab 2 (dự phòng):** `http://localhost:3000/circles` hoặc chi tiết 1 dây hụi mẫu đang ở trạng thái `ACTIVE` (để nếu mạng chập chờn có thể chuyển tab demo ngay).
- [ ] **Kiểm tra dịch vụ nền:**
  - Node EVM: Port `8545` đang chạy.
  - Backend API: `http://localhost:3001/api/v1` phản hồi OK.
  - Next.js Web: `http://localhost:3000` tải nhanh dưới 1 giây.
- [ ] **Kiểm tra tài khoản test:**
  - Đảm bảo tài khoản demo (ví dụ `usr_01` / `0x90f8...`) đã có sẵn ít nhất **0.5 AVAX** làm phí gas và **1,000+ mUSDC**. Nếu thiếu, bấm nút **Faucet +1,000 mUSDC** trên thanh Navbar trước khi bắt đầu.
- [ ] **Chế độ hiển thị:**
  - Nhấn `F11` (Full Screen) để ẩn thanh công cụ trình duyệt rườm rà.
  - Thu phóng trình duyệt ở mức **100%** hoặc **110%** để giao diện Cyber-dark hiển thị sắc nét nhất.

---

## 🎬 KỊCH BẢN CHI TIẾT TỪNG GIÂY (ACTION + SPEECH + PRO-TIPS)

---

### PHÂN CẢNH 1: ĐẬP TAN NỖI ĐAU HỤI TRUYỀN THỐNG (00:00 – 00:30 | 30 giây)

- **Màn hình:** `http://localhost:3000/` (Landing Page).
- **Thao tác chuột:**
  1. Giữ chuột tại màn hình Hero với 3 dòng chữ đỏ-trắng ấn tượng: **`HỤI ON-CHAIN / KHÔNG CHỦ HỤI. / KHÔNG VỠ NỢ.`**
  2. Cuộn nhẹ xuống dải 4 chỉ số (0%, 100%–300%, +6.5%, < 2s) và bảng so sánh trực quan.
  3. Bấm nút **`XEM DÂY HỤI LIVE`** hoặc **`ĐĂNG NHẬP / ĐĂNG KÝ`** ở giây thứ 25.

> 🗣️ **Lời thoại thuyết trình:**
> 
> *"Kính chào Ban Giám Khảo và các bạn! Hụi hay Họ là mô hình tiết kiệm xoay vòng ngàn đời của người Việt, giúp hàng triệu người huy động vốn nhanh mà không cần ngân hàng. Nhưng điểm yếu chí mạng khiến hàng loạt dây hụi đổ vỡ là: **Chủ hụi ôm tiền bỏ trốn**, hoặc **người hốt sớm rồi bùng nợ**.*
> 
> *Hôm nay, chúng tôi mang đến **Avahui** — nền tảng chuyển hóa toàn bộ dây hụi truyền thống lên mạng lưới Avalanche. Ở Avahui: **Không có chủ hụi giữ tiền** vì tiền nằm trong Hợp đồng thông minh, và **không lo vỡ nợ** nhờ cơ chế tiền cọc tự động bù đắp tức thì!"*

💡 **Pro-Tip:** Chỉ tay vào thanh chỉ mục `00 // Tổng quan` đang ghim cố định ở cạnh phải để giám khảo thấy độ mượt mà và chỉn chu của giao diện.

---

### PHÂN CẢNH 2: VÀO APP TIỆN LỢI NHƯ WEB2 & NHẬN VỐN (00:30 – 01:05 | 35 giây)

- **Màn hình:** `/login` chuyển tiếp sang `/dashboard`.
- **Thao tác chuột:**
  1. Tại màn Login, bấm nhanh **`Continue with Google`** (hoặc chọn sẵn tài khoản demo).
  2. Vào ngay **Dashboard**. Di chuột lướt nhanh qua 4 thẻ thống kê tổng quan (Tổng tiền cọc, Dây tham gia, Lợi nhuận dự phóng).
  3. Chỉ chuột vào góc trên bên phải: Thanh **Embedded Wallet**.
  4. Bấm 1 nhấp vào nút **`+1,000` (Faucet mUSDC)** để minh họa dòng tiền nạp vào tức thì.

> 🗣️ **Lời thoại thuyết trình:**
> 
> *"Để người dùng phổ thông không bị rào cản kỹ thuật cản trở, Avahui hỗ trợ đăng nhập 1 chạm bằng Google hoặc Email. Hệ thống tự động tạo ví nhúng bảo mật mà người dùng không cần đau đầu quản lý Private Key.*
> 
> *Ngay trên Dashboard, mọi thông số từ số dư, tiền cọc đang khóa đến lợi nhuận đều hiển thị theo thời gian thực. Tôi chỉ cần 1 nhấp chuột vào nút Faucet là nhận ngay token thử nghiệm để bắt đầu tham gia dây hụi."*

💡 **Pro-Tip:** Nếu ban giám khảo là chuyên gia Web3, hãy nhấn mạnh: *"Hệ thống hỗ trợ song song cả ví nhúng Privy lẫn kết nối trực tiếp Core Wallet / MetaMask để ký giao dịch thật."*

---

### PHÂN CẢNH 3: BỎ THĂM KÍN (COMMIT-REVEAL) CHỐNG LỘ GIÁ (01:05 – 02:00 | 55 giây)

- **Màn hình:** `/circles/[id]` (Chọn 1 dây hụi Bidding đang mở vòng đấu giá).
- **Thao tác chuột:**
  1. Bấm vào chi tiết một dây hụi (ví dụ: *Hụi Nhóm Avahui — Kỳ 5 Người*).
  2. Mở tab **Vòng hiện tại (Current Round)**.
  3. Tại khung **Smart Action Box** bên phải:
     - Chọn mức chiết khấu muốn bỏ thăm (ví dụ: `15 mUSDC`).
     - Bật chế độ **Bỏ thăm kín (Sealed-Bid)**.
     - Bấm nút **`BỎ THĂM KÍN (COMMIT)`** -> Modal xác nhận giao dịch hiện lên -> Bấm xác nhận.
     - Chờ 1 giây popup báo Thành công với mã Hash On-Chain.
  4. Sang pha Mở thăm: Bấm **`MỞ THĂM (REVEAL)`** -> Hệ thống đối chiếu đúng mã băm keccak256 và mở mức giá 15 mUSDC công khai.

> 🗣️ **Lời thoại thuyết trình:**
> 
> *"Đây là cải tiến đột phá nhất của phiên bản V2: **Đấu giá kín Sealed-Bid hai bước**.*
> 
> *Ở hụi truyền thống, bỏ thăm giấy rất dễ bị chủ hụi lén mở trước để thông đồng báo giá cho người thân. Còn trên Web3 thông thường, nếu gửi giá đấu trực tiếp thì các bot MEV sẽ nhìn trộm trong Mempool để trả cao hơn 1 đồng.*
> 
> *Với Avahui: Ở bước 1 (Commit), hệ thống mã hóa mức giá cùng một số bí mật ngẫu nhiên thành mã băm keccak256 đưa lên chuỗi — không một ai biết trước giá. Đến khi hết hạn mở thăm (Reveal), hệ thống mới đối chiếu khóa niêm phong. Tuyệt đối công bằng, minh bạch 100%!"*

💡 **Pro-Tip:** Khi Modal `TransactionLifecycleModal` hiện lên với tia quét Cyber-red, hãy để yên 1.5 giây cho giám khảo kịp nhìn thấy mã `Tx Hash` được xác nhận trên Avalanche.

---

### PHÂN CẢNH 4: TẤT TOÁN KỲ, CƠ CHẾ AUTO-SLASH & LÃI KÉP DEFI (02:00 – 02:40 | 40 giây)

- **Màn hình:** Khung **Smart Action Box** và Tab **Lịch sử vòng / Thành viên & Thế chấp**.
- **Thao tác chuột:**
  1. Bấm nút **`TẤT TOÁN VÒNG (SETTLE ROUND)`**.
  2. Chỉ vào thông báo giải ngân thành công: Tiền hốt hụi được chuyển thẳng vào ví người trả chiết khấu cao nhất.
  3. Mở tab **Thành viên & Thế chấp (Members & Collateral)**: Chỉ vào cột Cọc bảo đảm và tình trạng của người chơi.
  4. Mở hộp thông tin **Yield Vault (+6.5% APY)**: Chỉ vào số lãi đang cộng dồn cho tiền cọc nhàn rỗi.

> 🗣️ **Lời thoại thuyết trình:**
> 
> *"Khi chốt vòng, Hợp đồng thông minh tự động giải ngân thẳng tiền hốt hụi vào ví người thắng cuộc chỉ trong chưa đầy 2 giây của mạng Avalanche.*
> 
> *Vậy câu hỏi lớn nhất là: **Nếu người hốt rồi bùng tiền ở các kỳ sau thì sao?***
> *Avahui giải quyết bằng cơ chế **Auto-Slash cưỡng chế**: Toàn bộ thành viên bắt buộc khóa cọc 100%–300% ngay từ đầu. Nếu bất kỳ ai trễ hạn, hệ thống tự động trích tiền cọc của người đó bù đắp đủ kỳ góp — dây hụi vẫn tiếp tục trơn tru mà các thành viên khác không phải gánh nợ thay!*
> 
> *Đặc biệt, tiền cọc nằm chờ trong suốt chu kỳ không bị nằm chết, mà tự động sinh lời qua kho lãi **Yield Vault 6.5%/năm**. Kết thúc dây, mọi người rút lại 100% tiền cọc cộng thêm phần thưởng lãi kép DeFi!"*

💡 **Pro-Tip:** Đây là đoạn ghi điểm quyết định giải thưởng! Hãy nói dõng dạc, nhấn mạnh 2 cụm từ: **"Tiền cọc tự động bù đắp"** và **"Tiền cọc nằm chờ vẫn tự sinh lãi"**.

---

### PHÂN CẢNH 5: TỔNG KẾT & KÊU GỌI HÀNH ĐỘNG (02:40 – 03:00 | 20 giây)

- **Màn hình:** Quay lại Dashboard (`/dashboard`) hoặc Banner cuối trang Landing Page.
- **Thao tác chuột:** Rê chuột lên logo Avahui và chỉ vào địa chỉ ví on-chain đã xác nhận giao dịch.

> 🗣️ **Lời thoại thuyết trình:**
> 
> *"Tóm lại, Avahui mang văn hóa tài chính cộng đồng lâu đời của người Việt bước vào kỷ nguyên Web3: **Không còn rủi ro chủ hụi giật tiền, không còn nỗi lo vỡ nợ, và tối ưu hóa lợi nhuận vốn nhàn rỗi**.*
> 
> *Toàn bộ mã nguồn hợp đồng thông minh, backend indexer và frontend đã được kiểm thử đồng bộ và đang chạy trực tiếp. Xin trân trọng cảm ơn Ban Giám Khảo và mời quý vị cùng trải nghiệm thử nghiệm ngay hôm nay!"*

---

## 🎯 4 TỪ KHÓA ĂN ĐIỂM CẦN NHẮC ĐI NHẮC LẠI

1. **"Không chủ hụi — Không vỡ nợ"** (Định vị thương hiệu ghim vào đầu giám khảo).
2. **"Đấu giá kín Commit-Reveal"** (Bảo mật cryptographic, chống lộ giá và chống bot MEV).
3. **"Thế chấp Auto-Slash"** (Bảo chứng tài chính thực thi bằng code, không tin vào lời hứa).
4. **"Lãi kép 6.5%/năm"** (Tối ưu hóa vốn nhàn rỗi chuẩn DeFi trên Avalanche).

---

## 🛡️ PHƯƠNG ÁN DỰ PHÒNG KHI GẶP SỰ CỐ (PLAN B)

| Tình huống phát sinh | Cách xử lý tức thì (trong 3 giây) | Câu nói đỡ tình huống |
| :--- | :--- | :--- |
| **Giao dịch on-chain bị treo hoặc RPC phản hồi chậm (> 5s)** | Không đứng chờ quay vòng. Chuyển ngay sang tab bên cạnh đã mở sẵn 1 dây hụi có lịch sử vòng hoàn tất. | *"Trong khi khối Avalanche đang chờ xác nhận hoàn tất giao dịch ngầm, xin mời Ban Giám Khảo xem tab Lịch Sử của vòng trước đã được ghi nhận bất biến trên chuỗi."* |
| **Bấm Faucet token bị báo lỗi mạng** | Đổi sang tài khoản mẫu `usr_02` hoặc `usr_03` từ menu Account ở góc phải (đã nạp sẵn token). | *"Tôi sẽ chuyển nhanh sang ví của thành viên thứ hai trong dây hụi để minh họa góc nhìn của người bỏ thăm chiết khấu."* |
| **Giám khảo hỏi: "Nếu giá mUSDC biến động hay smart contract bị hack?"** | Trả lời ngắn gọn: Avahui dùng stablecoin USDC chuẩn tài sản bảo đảm 1:1 USD. Hợp đồng tuân thủ bảo vệ ReentrancyGuard, SafeTransferLib và kế thừa mẫu Factory độc lập cho từng dây. | *"Avahui tách biệt mỗi dây hụi thành 1 contract độc lập. Kể cả một dây có tranh chấp cũng không bao giờ ảnh hưởng đến tiền của các dây khác."* |
| **Giám khảo hỏi: "Nếu 1 người tạo 10 ví ảo vào thâu tóm dây hụi thì sao?"** | Nhắc ngay đến module V2 **Team1 Anti-Sybil Attestation**: | *"Avahui tích hợp chuẩn Team1 Attestation cấp nullifier duy nhất cho mỗi cá nhân thật, đảm bảo nguyên tắc 1-Human-1-Slot không thể gian lận."* |
