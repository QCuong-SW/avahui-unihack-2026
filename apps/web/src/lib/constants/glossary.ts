import {
  AllocationMode,
  CircleStatus,
  MemberStatus,
  RoscaCreditTier,
  RoundStatus,
} from '@avahui/shared';

export const ALLOCATION_MODE_META: Record<
  AllocationMode,
  { shortLabel: string; label: string; description: string }
> = {
  [AllocationMode.BIDDING]: {
    shortLabel: 'Đấu giá',
    label: 'Đấu giá chiết khấu',
    description:
      'Người cần vốn bỏ giá chiết khấu kín; ai trả chiết khấu cao nhất nhận quỹ trước, phần chiết khấu chia đều cho cả nhóm khi tất toán.',
  },
  [AllocationMode.FIXED]: {
    shortLabel: 'Cố định',
    label: 'Nhận quỹ theo thứ tự',
    description:
      'Mỗi kỳ giải ngân tuần tự từ vị trí Slot #1 đến Slot cuối cùng, không cần đấu giá.',
  },
};

export const CIRCLE_STATUS_META: Record<
  CircleStatus,
  { label: string; description: string }
> = {
  [CircleStatus.Draft]: {
    label: 'Bản nháp',
    description: 'Dây hụi đang chuẩn bị khởi tạo trên blockchain.',
  },
  [CircleStatus.Recruiting]: {
    label: 'Đang gom thành viên',
    description: 'Đang mở cho thành viên tham gia đủ số lượng để kích hoạt Kỳ #1.',
  },
  [CircleStatus.Active]: {
    label: 'Đang vận hành',
    description: 'Đang mở đóng góp và giải ngân tuần tự theo từng kỳ.',
  },
  [CircleStatus.Completed]: {
    label: 'Đã tất toán toàn bộ',
    description: 'Tất cả các kỳ đã hoàn tất; thành viên có thể rút thế chấp, thưởng chiết khấu và lãi Vault.',
  },
  [CircleStatus.Cancelled]: {
    label: 'Đã hủy',
    description: 'Dây hụi bị hủy trước khi kích hoạt; vốn khóa được hoàn trả cho thành viên.',
  },
};

export const ROUND_STATUS_META: Record<
  RoundStatus,
  { label: string }
> = {
  [RoundStatus.Pending]: { label: 'Chờ mở kỳ' },
  [RoundStatus.Open]: { label: 'Đang mở' },
  [RoundStatus.Settled]: { label: 'Đã tất toán' },
};

export const MEMBER_STATUS_META: Record<
  MemberStatus,
  { label: string; description: string }
> = {
  [MemberStatus.Active]: {
    label: 'Đang tham gia',
    description: 'Thành viên đang đóng góp đúng hạn.',
  },
  [MemberStatus.Defaulted]: {
    label: 'Đã trích thế chấp',
    description: 'Từng trễ hạn đóng hụi nên hợp đồng đã tự động trích thế chấp bù vào quỹ kỳ.',
  },
  [MemberStatus.Withdrawn]: {
    label: 'Đã rút tất toán',
    description: 'Đã rút thế chấp gốc, thưởng chiết khấu và lãi Yield Vault về ví.',
  },
};

export const CREDIT_TIER_META: Record<
  RoscaCreditTier,
  { label: string; badgeClass: string; hint: string }
> = {
  NEW: {
    label: 'Thành viên mới',
    badgeClass: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    hint: 'Khởi đầu từ 500 điểm. Đóng đúng hạn và hoàn thành dây hụi để tăng điểm uy tín.',
  },
  TRUSTED: {
    label: 'Uy tín',
    badgeClass: 'border-sky-500/40 bg-sky-500/15 text-sky-300',
    hint: 'Điểm Tín Nhiệm từ 650–849 nhờ kỷ luật đóng hụi đều đặn.',
  },
  EXPERT: {
    label: 'Lão luyện',
    badgeClass: 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300',
    hint: 'Điểm Tín Nhiệm 850+ với lịch sử hoàn thành nhiều dây hụi không trễ hạn.',
  },
};

export interface GlossaryItem {
  term: string;
  englishAlias: string;
  definition: string;
}

export const ROSCA_GLOSSARY_ITEMS: GlossaryItem[] = [
  {
    term: 'Tổng quỹ kỳ (Gross Pot)',
    englishAlias: 'Gross Pot',
    definition:
      'Tổng số tiền mUSDC quy tụ trong 1 kỳ (= Mức đóng mỗi kỳ × Số thành viên) trước khi trừ mức chiết khấu nếu là dây đấu giá.',
  },
  {
    term: 'Thế chấp bảo chứng (Collateral)',
    englishAlias: 'Collateral (1x – 2x)',
    definition:
      'Số mUSDC khóa trong hợp đồng thông minh khi vào dây (mặc định bằng 1–2 lần mức đóng). Dùng để tự động bù quỹ nếu có người trễ hạn và được hoàn lại 100% lúc kết thúc.',
  },
  {
    term: 'Đấu giá kín 2 pha (Niêm phong / Mở niêm phong)',
    englishAlias: 'Sealed-Bid Commit-Reveal',
    definition:
      'Trong 2/3 thời gian đầu của vòng đấu giá, bạn gửi mã băm niêm phong (Commit) kèm Salt bí mật để người khác không nhìn trộm giá. Ở 1/3 thời gian cuối, bạn xác nhận mở niêm phong (Reveal) để hệ thống so giá công bằng.',
  },
  {
    term: 'Tiền nhận ròng (Payout)',
    englishAlias: 'Net Payout',
    definition:
      'Số mUSDC người thắng đấu giá (hoặc người tới lượt Slot ở chế độ Cố định) thực sự nhận về ví trong kỳ đó, bằng Tổng quỹ kỳ trừ đi Mức chiết khấu thắng cuộc.',
  },
  {
    term: 'Trích thế chấp (Slashing)',
    englishAlias: 'Auto-Slash',
    definition:
      'Cơ chế bảo vệ nhóm tự động: nếu thành viên không đóng tiền trước hạn tất toán, hợp đồng tự động trích từ quỹ thế chấp của người đó để bù đủ quỹ kỳ cho người nhận.',
  },
  {
    term: 'Lãi Yield Vault (6.5% APY)',
    englishAlias: 'ERC-4626 Yield Vault',
    definition:
      'Vốn thế chấp nhàn rỗi trong hợp đồng được đưa vào kho sinh lời ERC-4626 trên Avalanche để tạo thêm lợi suất 6.5%/năm, chia lại cho thành viên khi tất toán dây.',
  },
  {
    term: 'Chứng thực Team1 (Chống tạo nhiều ví)',
    englishAlias: 'Team1 Anti-Sybil Attestation',
    definition:
      'Chữ ký định danh EIP-712 xác nhận mỗi người thật chỉ chiếm tối đa 1 vị trí trong dây hụi được bật bảo vệ Team1.',
  },
  {
    term: 'Điểm Tín Nhiệm Hụi (0–1000)',
    englishAlias: 'ROSCA Credit Score',
    definition:
      'Thước đo uy tín dựa trên dữ liệu đóng hụi on-chain: cộng điểm cho mỗi kỳ đóng đúng hạn và dây hoàn tất, trừ điểm nếu bị trích thế chấp do trễ hạn.',
  },
];

