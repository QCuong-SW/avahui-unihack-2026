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
  COMMIT_BID = 'COMMIT_BID',
  REVEAL_BID = 'REVEAL_BID',
  SETTLE_ROUND = 'SETTLE_ROUND',
  WITHDRAW_COLLATERAL = 'WITHDRAW_COLLATERAL',
  CANCEL_CIRCLE = 'CANCEL_CIRCLE',
  SWAP_TOKEN = 'SWAP_TOKEN',
  VERIFY_ATTESTATION = 'VERIFY_ATTESTATION',
}

export enum TransactionStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
}

export enum TxLifecycleStep {
  IDLE = 'IDLE',
  SIGNING = 'SIGNING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  SYNCED = 'SYNCED',
  ERROR = 'ERROR',
}
