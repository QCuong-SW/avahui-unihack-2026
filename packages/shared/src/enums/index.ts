// ============================================================================
// @avahui/shared — Shared Enums (Single Source of Truth)
// ============================================================================

export enum AllocationMode {
  FIXED = 'FIXED',       // 0 on Smart Contract
  BIDDING = 'BIDDING',   // 1 on Smart Contract
}

export enum CircleStatus {
  Draft = 'DRAFT',           // Off-chain draft before tx confirmation
  Recruiting = 'RECRUITING', // 0 on SC: Recruiting members & locking collateral
  Active = 'ACTIVE',         // 1 on SC: Full members, rounds running
  Completed = 'COMPLETED',   // 2 on SC: All rounds settled
  Cancelled = 'CANCELLED',   // 3 on SC: Cancelled due to start deadline expiry
}

export enum RoundStatus {
  Pending = 'PENDING',       // 0 on SC: Future round not opened yet
  Open = 'OPEN',             // 1 on SC: Open for contributions (& bidding if BIDDING)
  Settled = 'SETTLED',       // 2 on SC: Round settled and payout distributed
}

export enum MemberStatus {
  Active = 'ACTIVE',
  Defaulted = 'DEFAULTED',   // Has missed deadline and had collateral slashed
  Withdrawn = 'WITHDRAWN',   // Has withdrawn remaining collateral after circle completion
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

export enum TxLifecycleStep {
  IDLE = 'IDLE',
  SIGNING = 'SIGNING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  SYNCED = 'SYNCED',
  ERROR = 'ERROR',
}
