// ============================================================================
// @avahui/web — Interactive Mock Engine (Browser-persisted ROSCA State Machine)
// Implements 100% of Section 1 Business Rules for standalone Frontend testing
// ============================================================================

import {
  AllocationMode,
  BlockchainTransactionItem,
  CIRCLE_CONSTRAINTS,
  CircleItem,
  CircleStatus,
  CreateCircleFormInput,
  MemberStatus,
  MOCK_CIRCLES,
  MOCK_DEMO_USERS,
  MOCK_NOTIFICATIONS,
  MOCK_TRANSACTIONS,
  NotificationItem,
  RoundStatus,
  TransactionStatus,
  TransactionType,
  UserProfile,
} from '@avahui/shared';
import {
  generateMockAddress,
  generateMockTxHash,
} from '@/lib/utils';

const STORAGE_KEY = 'avahui_unihack_2026_mock_state_v1';

export interface AvaHuiMockState {
  currentUserId: string;
  users: UserProfile[];
  circles: CircleItem[];
  transactions: BlockchainTransactionItem[];
  notifications: NotificationItem[];
}

function getInitialState(): AvaHuiMockState {
  return {
    currentUserId: MOCK_DEMO_USERS[0].id,
    users: JSON.parse(JSON.stringify(MOCK_DEMO_USERS)),
    circles: JSON.parse(JSON.stringify(MOCK_CIRCLES)),
    transactions: JSON.parse(JSON.stringify(MOCK_TRANSACTIONS)),
    notifications: JSON.parse(JSON.stringify(MOCK_NOTIFICATIONS)),
  };
}

export function loadMockState(): AvaHuiMockState {
  if (typeof window === 'undefined') {
    return getInitialState();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialState();
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw) as AvaHuiMockState;
  } catch {
    return getInitialState();
  }
}

export function saveMockState(state: AvaHuiMockState): AvaHuiMockState {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  return state;
}

export function resetMockState(): AvaHuiMockState {
  const initial = getInitialState();
  return saveMockState(initial);
}

export function switchMockUser(userId: string): AvaHuiMockState {
  const state = loadMockState();
  const exists = state.users.some((u) => u.id === userId);
  if (exists) {
    state.currentUserId = userId;
  }
  return saveMockState(state);
}

export function markAllNotificationsRead(): AvaHuiMockState {
  const state = loadMockState();
  state.notifications = state.notifications.map((n) =>
    n.userId === state.currentUserId ? { ...n, isRead: true } : n
  );
  return saveMockState(state);
}

export function mockFaucetMint(
  amountUsdc: number = CIRCLE_CONSTRAINTS.FAUCET_MINT_AMOUNT_USDC
): {
  state: AvaHuiMockState;
  txHash: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('User not found');

  const currentBal = parseFloat(user.usdcBalance);
  user.usdcBalance = (currentBal + amountUsdc).toFixed(2);

  const txHash = generateMockTxHash();
  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    txType: TransactionType.FAUCET_MINT,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `+${amountUsdc.toFixed(2)} mUSDC`,
    createdAt: new Date().toISOString(),
  });

  return { state: saveMockState(state), txHash };
}

export function mockCreateCircle(input: CreateCircleFormInput): {
  state: AvaHuiMockState;
  newCircle: CircleItem;
  txHash: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('User not found');

  const collateralUsdc =
    input.contributionAmountUsdc * input.collateralMultiplier;
  if (parseFloat(user.usdcBalance) < collateralUsdc) {
    throw new Error(
      `Số dư mUSDC không đủ để khóa thế chấp (${collateralUsdc.toFixed(2)} mUSDC). Hãy bấm Faucet trước!`
    );
  }

  user.usdcBalance = (parseFloat(user.usdcBalance) - collateralUsdc).toFixed(2);
  user.stats.activeCirclesCount += 1;
  user.stats.totalCollateralLocked = (
    parseFloat(user.stats.totalCollateralLocked) + collateralUsdc
  ).toFixed(2);

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();
  const newCircle: CircleItem = {
    id: `cir_${Date.now()}`,
    metadataId: `meta_${Date.now()}`,
    contractAddress: generateMockAddress(),
    name: input.name,
    description: input.description,
    creatorAddress: user.walletAddress,
    tokenAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    tokenSymbol: 'mUSDC',
    tokenDecimals: 6,
    allocationMode: input.allocationMode,
    status: CircleStatus.Recruiting,
    maxMembers: input.maxMembers,
    currentMemberCount: 1,
    currentRound: 0,
    totalRounds: input.maxMembers,
    contributionAmount: String(Math.round(input.contributionAmountUsdc * 1e6)),
    contributionAmountFormatted: input.contributionAmountUsdc.toFixed(2),
    collateralAmount: String(Math.round(collateralUsdc * 1e6)),
    collateralAmountFormatted: collateralUsdc.toFixed(2),
    roundDurationSeconds: input.roundDurationSeconds,
    biddingDurationSeconds:
      input.allocationMode === AllocationMode.BIDDING
        ? input.biddingDurationSeconds
        : 0,
    gracePeriodSeconds: input.gracePeriodSeconds,
    startDeadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
    minBid: String(Math.round(input.minBidUsdc * 1e6)),
    minBidFormatted: input.minBidUsdc.toFixed(2),
    maxBid: String(Math.round(input.maxBidUsdc * 1e6)),
    maxBidFormatted: input.maxBidUsdc.toFixed(2),
    totalDiscountPool: '0',
    totalDiscountPoolFormatted: '0.00',
    isSealedBid:
      input.isSealedBid ?? input.allocationMode === AllocationMode.BIDDING,
    isYieldEnabled: input.isYieldEnabled ?? true,
    yieldApyBps: 800,
    totalYieldEarned: String(Math.round(collateralUsdc * 0.0085 * 1e6)),
    totalYieldEarnedFormatted: (collateralUsdc * 0.0085).toFixed(2),
    isPrivateCircle: input.isPrivateCircle ?? false,
    requiresAttestation: input.requiresAttestation ?? true,
    createdAt: nowIso,
    members: [
      {
        slotIndex: 1,
        userId: user.id,
        displayName: user.displayName,
        walletAddress: user.walletAddress,
        initialCollateralFormatted: collateralUsdc.toFixed(2),
        lockedCollateralFormatted: collateralUsdc.toFixed(2),
        slashedCollateralFormatted: '0.00',
        hasReceivedPayout: false,
        wonRoundNumber: null,
        defaultCount: 0,
        status: MemberStatus.Active,
        joinedAt: nowIso,
        joinTxHash: txHash,
      },
    ],
    rounds: [],
  };

  state.circles.unshift(newCircle);
  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: newCircle.contractAddress || '',
    circleId: newCircle.id,
    circleName: newCircle.name,
    txType: TransactionType.CREATE_CIRCLE,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `Locked ${collateralUsdc.toFixed(2)} mUSDC`,
    createdAt: nowIso,
  });

  return { state: saveMockState(state), newCircle, txHash };
}

export function mockJoinCircle(circleId: string): {
  state: AvaHuiMockState;
  txHash: string;
  activated: boolean;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('Không tìm thấy tài khoản hiện tại.');

  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) throw new Error('Không tìm thấy dây hụi.');

  if (circle.status !== CircleStatus.Recruiting) {
    throw new Error('Dây hụi này không còn ở trạng thái tuyển thành viên.');
  }

  const alreadyJoined = circle.members.some(
    (m) => m.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()
  );
  if (alreadyJoined) {
    throw new Error('Bạn đã là thành viên của dây hụi này rồi.');
  }

  const collateralUsdc = parseFloat(circle.collateralAmountFormatted);
  if (parseFloat(user.usdcBalance) < collateralUsdc) {
    throw new Error(
      `Số dư ví không đủ ${collateralUsdc.toFixed(2)} mUSDC để khóa thế chấp. Hãy bấm Faucet trước!`
    );
  }

  user.usdcBalance = (parseFloat(user.usdcBalance) - collateralUsdc).toFixed(2);
  user.stats.activeCirclesCount += 1;
  user.stats.totalCollateralLocked = (
    parseFloat(user.stats.totalCollateralLocked) + collateralUsdc
  ).toFixed(2);

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();
  const nextSlot = circle.currentMemberCount + 1;

  circle.members.push({
    slotIndex: nextSlot,
    userId: user.id,
    displayName: user.displayName,
    walletAddress: user.walletAddress,
    initialCollateralFormatted: collateralUsdc.toFixed(2),
    lockedCollateralFormatted: collateralUsdc.toFixed(2),
    slashedCollateralFormatted: '0.00',
    hasReceivedPayout: false,
    wonRoundNumber: null,
    defaultCount: 0,
    status: MemberStatus.Active,
    joinedAt: nowIso,
    joinTxHash: txHash,
  });

  circle.currentMemberCount = nextSlot;

  let activated = false;
  if (circle.currentMemberCount === circle.maxMembers) {
    activated = true;
    circle.status = CircleStatus.Active;
    circle.currentRound = 1;
    const basePot =
      parseFloat(circle.contributionAmountFormatted) * circle.maxMembers;
    const nowMs = Date.now();

    circle.rounds.push({
      roundNumber: 1,
      status: RoundStatus.Open,
      startTime: nowIso,
      contributionDeadline: new Date(
        nowMs + circle.roundDurationSeconds * 1000
      ).toISOString(),
      biddingDeadline: new Date(
        nowMs + circle.biddingDurationSeconds * 1000
      ).toISOString(),
      graceDeadline: new Date(
        nowMs +
          (circle.roundDurationSeconds + circle.gracePeriodSeconds) * 1000
      ).toISOString(),
      winnerAddress:
        circle.allocationMode === AllocationMode.FIXED
          ? circle.members[0]?.walletAddress || null
          : null,
      winnerName:
        circle.allocationMode === AllocationMode.FIXED
          ? circle.members[0]?.displayName || null
          : null,
      grossPotFormatted: basePot.toFixed(2),
      winningBidFormatted: '0.00',
      netPayoutFormatted: basePot.toFixed(2),
      settlementTxHash: null,
      contributionsCount: 0,
      contributions: [],
      bids: [],
    });

    state.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: user.id,
      circleId: circle.id,
      title: 'Dây hụi đã đủ thành viên & Kích hoạt Vòng #1!',
      body: `Dây hụi "${circle.name}" đã đủ ${circle.maxMembers}/${circle.maxMembers} thành viên và mở Vòng #1.`,
      isRead: false,
      createdAt: nowIso,
    });
  }

  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: circle.contractAddress,
    circleId: circle.id,
    circleName: circle.name,
    txType: TransactionType.JOIN_CIRCLE,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `Slot #${nextSlot} • Locked ${collateralUsdc.toFixed(2)} mUSDC`,
    createdAt: nowIso,
  });

  return { state: saveMockState(state), txHash, activated };
}

export function mockContributeRound(
  circleId: string,
  roundNumber: number
): {
  state: AvaHuiMockState;
  txHash: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('Không tìm thấy tài khoản hiện tại.');

  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) throw new Error('Không tìm thấy dây hụi.');

  if (circle.status !== CircleStatus.Active) {
    throw new Error('Dây hụi chưa ở trạng thái ACTIVE.');
  }

  const member = circle.members.find(
    (m) => m.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()
  );
  if (!member) {
    throw new Error('Bạn không phải thành viên của dây hụi này.');
  }

  const round = circle.rounds.find(
    (r) => r.roundNumber === roundNumber && r.status === RoundStatus.Open
  );
  if (!round) {
    throw new Error(`Vòng #${roundNumber} không ở trạng thái mở đóng góp.`);
  }

  const alreadyPaid = round.contributions.some(
    (c) => c.memberAddress.toLowerCase() === user.walletAddress.toLowerCase()
  );
  if (alreadyPaid) {
    throw new Error(`Bạn đã đóng tiền cho Vòng #${roundNumber} rồi.`);
  }

  const amountUsdc = parseFloat(circle.contributionAmountFormatted);
  if (parseFloat(user.usdcBalance) < amountUsdc) {
    throw new Error(
      `Số dư mUSDC không đủ (${amountUsdc.toFixed(2)} mUSDC). Hãy bấm Faucet trước!`
    );
  }

  user.usdcBalance = (parseFloat(user.usdcBalance) - amountUsdc).toFixed(2);
  user.stats.totalContributed = (
    parseFloat(user.stats.totalContributed) + amountUsdc
  ).toFixed(2);

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();

  round.contributions.push({
    memberAddress: user.walletAddress,
    memberName: user.displayName,
    amountFormatted: amountUsdc.toFixed(2),
    isFromCollateralSlash: false,
    paidAt: nowIso,
    txHash,
  });
  round.contributionsCount = round.contributions.length;

  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: circle.contractAddress,
    circleId: circle.id,
    circleName: circle.name,
    txType: TransactionType.CONTRIBUTE,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `${amountUsdc.toFixed(2)} mUSDC (Round #${roundNumber})`,
    createdAt: nowIso,
  });

  return { state: saveMockState(state), txHash };
}

export function mockSubmitBid(
  circleId: string,
  roundNumber: number,
  bidAmountUsdc: number
): {
  state: AvaHuiMockState;
  txHash: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('Không tìm thấy tài khoản hiện tại.');

  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) throw new Error('Không tìm thấy dây hụi.');

  if (circle.status !== CircleStatus.Active) {
    throw new Error('Dây hụi không ở trạng thái ACTIVE.');
  }
  if (circle.allocationMode !== AllocationMode.BIDDING) {
    throw new Error('Dây hụi này thuộc chế độ FIXED, không sử dụng đấu giá.');
  }

  const member = circle.members.find(
    (m) => m.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()
  );
  if (!member) {
    throw new Error('Bạn không phải thành viên của dây hụi này.');
  }
  if (member.hasReceivedPayout) {
    throw new Error(
      `Bạn đã nhận Payout ở Vòng #${member.wonRoundNumber} nên không được đấu giá các vòng sau.`
    );
  }

  const round = circle.rounds.find(
    (r) => r.roundNumber === roundNumber && r.status === RoundStatus.Open
  );
  if (!round) {
    throw new Error(`Vòng #${roundNumber} không mở đấu giá.`);
  }

  const minBid = parseFloat(circle.minBidFormatted);
  const maxBid = parseFloat(circle.maxBidFormatted);
  if (bidAmountUsdc < minBid || bidAmountUsdc > maxBid) {
    throw new Error(
      `Giá đấu phải nằm trong khoảng ${minBid.toFixed(2)} – ${maxBid.toFixed(2)} mUSDC.`
    );
  }

  const currentHighest = round.bids.reduce(
    (max, b) => Math.max(max, parseFloat(b.bidAmountFormatted)),
    0
  );
  if (bidAmountUsdc <= currentHighest) {
    throw new Error(
      `Giá đấu mới (${bidAmountUsdc.toFixed(2)} mUSDC) phải lớn hơn mức dẫn đầu hiện tại (${currentHighest.toFixed(2)} mUSDC).`
    );
  }

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();

  round.bids.forEach((b) => {
    b.isWinningBid = false;
  });
  round.bids.push({
    bidderAddress: user.walletAddress,
    bidderName: user.displayName,
    bidAmountFormatted: bidAmountUsdc.toFixed(2),
    isWinningBid: true,
    createdAt: nowIso,
    txHash,
  });

  const grossPot = parseFloat(round.grossPotFormatted);
  round.winningBidFormatted = bidAmountUsdc.toFixed(2);
  round.netPayoutFormatted = (grossPot - bidAmountUsdc).toFixed(2);

  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: circle.contractAddress,
    circleId: circle.id,
    circleName: circle.name,
    txType: TransactionType.PLACE_BID,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `Bid ${bidAmountUsdc.toFixed(2)} mUSDC (Round #${roundNumber})`,
    createdAt: nowIso,
  });

  return { state: saveMockState(state), txHash };
}

export function mockSettleRound(
  circleId: string,
  roundNumber: number
): {
  state: AvaHuiMockState;
  txHash: string;
  winnerName: string;
  netPayoutFormatted: string;
  slashedMembersCount: number;
} {
  const state = loadMockState();
  const caller = state.users.find((u) => u.id === state.currentUserId);
  if (!caller) throw new Error('Không tìm thấy tài khoản hiện tại.');

  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) throw new Error('Không tìm thấy dây hụi.');

  if (circle.status !== CircleStatus.Active) {
    throw new Error('Dây hụi không ở trạng thái ACTIVE.');
  }

  const round = circle.rounds.find(
    (r) => r.roundNumber === roundNumber && r.status === RoundStatus.Open
  );
  if (!round) {
    throw new Error(`Vòng #${roundNumber} đã được kết toán hoặc không tồn tại.`);
  }

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();
  const contributionUsdc = parseFloat(circle.contributionAmountFormatted);

  let slashedMembersCount = 0;
  for (const member of circle.members) {
    const hasPaid = round.contributions.some(
      (c) =>
        c.memberAddress.toLowerCase() === member.walletAddress.toLowerCase()
    );
    if (!hasPaid) {
      slashedMembersCount += 1;
      const currentLocked = parseFloat(member.lockedCollateralFormatted);
      const slashAmount = Math.min(currentLocked, contributionUsdc);

      member.lockedCollateralFormatted = Math.max(
        0,
        currentLocked - slashAmount
      ).toFixed(2);
      member.slashedCollateralFormatted = (
        parseFloat(member.slashedCollateralFormatted || '0') + slashAmount
      ).toFixed(2);
      member.defaultCount += 1;
      member.status = MemberStatus.Defaulted;

      const memberUser = state.users.find(
        (u) =>
          u.walletAddress.toLowerCase() === member.walletAddress.toLowerCase()
      );
      if (memberUser) {
        memberUser.stats.totalCollateralLocked = Math.max(
          0,
          parseFloat(memberUser.stats.totalCollateralLocked) - slashAmount
        ).toFixed(2);
      }

      round.contributions.push({
        memberAddress: member.walletAddress,
        memberName: member.displayName,
        amountFormatted: slashAmount.toFixed(2),
        isFromCollateralSlash: true,
        paidAt: nowIso,
        txHash,
      });
    }
  }
  round.contributionsCount = round.contributions.length;

  let winnerMember = circle.members[0];
  let winningBidUsdc = 0;

  if (circle.allocationMode === AllocationMode.FIXED) {
    const slotMember = circle.members.find((m) => m.slotIndex === roundNumber);
    winnerMember =
      slotMember ||
      circle.members.find((m) => !m.hasReceivedPayout) ||
      circle.members[0];
    winningBidUsdc = 0;
  } else {
    const sortedBids = [...round.bids].sort(
      (a, b) =>
        parseFloat(b.bidAmountFormatted) - parseFloat(a.bidAmountFormatted)
    );
    let foundBidder = undefined;
    for (const bid of sortedBids) {
      const m = circle.members.find(
        (mem) =>
          mem.walletAddress.toLowerCase() ===
            bid.bidderAddress.toLowerCase() && !mem.hasReceivedPayout
      );
      if (m) {
        foundBidder = {
          member: m,
          bidUsdc: parseFloat(bid.bidAmountFormatted),
        };
        break;
      }
    }

    if (foundBidder) {
      winnerMember = foundBidder.member;
      winningBidUsdc = foundBidder.bidUsdc;
    } else {
      winnerMember =
        circle.members.find((m) => !m.hasReceivedPayout) || circle.members[0];
      winningBidUsdc = 0;
    }
  }

  const grossPotUsdc = contributionUsdc * circle.maxMembers;
  const netPayoutUsdc = grossPotUsdc - winningBidUsdc;

  winnerMember.hasReceivedPayout = true;
  winnerMember.wonRoundNumber = roundNumber;

  circle.totalDiscountPoolFormatted = (
    parseFloat(circle.totalDiscountPoolFormatted) + winningBidUsdc
  ).toFixed(2);
  circle.totalDiscountPool = String(
    Math.round(parseFloat(circle.totalDiscountPoolFormatted) * 1e6)
  );

  const winnerUser = state.users.find(
    (u) =>
      u.walletAddress.toLowerCase() ===
      winnerMember.walletAddress.toLowerCase()
  );
  if (winnerUser) {
    winnerUser.usdcBalance = (
      parseFloat(winnerUser.usdcBalance) + netPayoutUsdc
    ).toFixed(2);
    winnerUser.stats.totalPayoutReceived = (
      parseFloat(winnerUser.stats.totalPayoutReceived) + netPayoutUsdc
    ).toFixed(2);
  }

  round.status = RoundStatus.Settled;
  round.winnerAddress = winnerMember.walletAddress;
  round.winnerName = winnerMember.displayName;
  round.grossPotFormatted = grossPotUsdc.toFixed(2);
  round.winningBidFormatted = winningBidUsdc.toFixed(2);
  round.netPayoutFormatted = netPayoutUsdc.toFixed(2);
  round.settlementTxHash = txHash;
  round.settledAt = nowIso;

  if (roundNumber < circle.maxMembers) {
    const nextR = roundNumber + 1;
    circle.currentRound = nextR;
    const nowMs = Date.now();
    const nextFixedWinner =
      circle.allocationMode === AllocationMode.FIXED
        ? circle.members.find((m) => m.slotIndex === nextR)
        : undefined;

    circle.rounds.push({
      roundNumber: nextR,
      status: RoundStatus.Open,
      startTime: nowIso,
      contributionDeadline: new Date(
        nowMs + circle.roundDurationSeconds * 1000
      ).toISOString(),
      biddingDeadline: new Date(
        nowMs + circle.biddingDurationSeconds * 1000
      ).toISOString(),
      graceDeadline: new Date(
        nowMs +
          (circle.roundDurationSeconds + circle.gracePeriodSeconds) * 1000
      ).toISOString(),
      winnerAddress: nextFixedWinner?.walletAddress || null,
      winnerName: nextFixedWinner?.displayName || null,
      grossPotFormatted: grossPotUsdc.toFixed(2),
      winningBidFormatted: '0.00',
      netPayoutFormatted: grossPotUsdc.toFixed(2),
      settlementTxHash: null,
      contributionsCount: 0,
      contributions: [],
      bids: [],
    });
  } else {
    circle.status = CircleStatus.Completed;
    state.notifications.unshift({
      id: `notif_${Date.now()}`,
      userId: caller.id,
      circleId: circle.id,
      title: `Dây hụi "${circle.name}" đã hoàn tất!`,
      body: `Toàn bộ ${circle.maxMembers} vòng đã kết toán xong. Bạn có thể rút lại thế chấp và tiền thưởng chiết khấu ngay bây giờ.`,
      isRead: false,
      createdAt: nowIso,
    });
  }

  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: caller.walletAddress,
    senderName: caller.displayName,
    contractAddress: circle.contractAddress,
    circleId: circle.id,
    circleName: circle.name,
    txType: TransactionType.SETTLE_ROUND,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `Payout ${netPayoutUsdc.toFixed(2)} mUSDC → ${winnerMember.displayName}`,
    createdAt: nowIso,
  });

  return {
    state: saveMockState(state),
    txHash,
    winnerName: winnerMember.displayName || 'Thành viên',
    netPayoutFormatted: netPayoutUsdc.toFixed(2),
    slashedMembersCount,
  };
}

export function mockWithdrawCollateral(circleId: string): {
  state: AvaHuiMockState;
  txHash: string;
  totalReturnedFormatted: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('Không tìm thấy tài khoản hiện tại.');

  const circle = state.circles.find((c) => c.id === circleId);
  if (!circle) throw new Error('Không tìm thấy dây hụi.');

  if (circle.status !== CircleStatus.Completed) {
    throw new Error('Chỉ có thể rút thế chấp khi dây hụi đã COMPLETED.');
  }

  const member = circle.members.find(
    (m) => m.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()
  );
  if (!member) {
    throw new Error('Bạn không phải thành viên của dây hụi này.');
  }
  if (member.status === MemberStatus.Withdrawn) {
    throw new Error('Bạn đã rút thế chấp và tiền thưởng của dây hụi này rồi.');
  }

  const lockedReturned = parseFloat(member.lockedCollateralFormatted);
  const bonusPerMember =
    parseFloat(circle.totalDiscountPoolFormatted) / circle.maxMembers;
  const yieldPerMember =
    (parseFloat(circle.totalYieldEarnedFormatted || '0') || 0) /
    circle.maxMembers;
  const totalReturn = lockedReturned + bonusPerMember + yieldPerMember;

  user.usdcBalance = (parseFloat(user.usdcBalance) + totalReturn).toFixed(2);
  user.stats.totalCollateralLocked = Math.max(
    0,
    parseFloat(user.stats.totalCollateralLocked) - lockedReturned
  ).toFixed(2);

  member.lockedCollateralFormatted = '0.00';
  member.status = MemberStatus.Withdrawn;

  const txHash = generateMockTxHash();
  const nowIso = new Date().toISOString();

  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: circle.contractAddress,
    circleId: circle.id,
    circleName: circle.name,
    txType: TransactionType.WITHDRAW_COLLATERAL,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `+${totalReturn.toFixed(2)} mUSDC (Thế chấp + Lời)`,
    createdAt: nowIso,
  });

  return {
    state: saveMockState(state),
    txHash,
    totalReturnedFormatted: totalReturn.toFixed(2),
  };
}

export function mockUpdateUserProfile(displayName: string): AvaHuiMockState {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('User not found');

  const trimmed = displayName.trim();
  if (trimmed.length >= 2) {
    user.displayName = trimmed;
    state.circles.forEach((c) => {
      c.members.forEach((m) => {
        if (m.walletAddress.toLowerCase() === user.walletAddress.toLowerCase()) {
          m.displayName = trimmed;
        }
      });
    });
  }

  return saveMockState(state);
}

export function mockSwapAvaxToUsdc(avaxAmount: number = 0.25): {
  state: AvaHuiMockState;
  txHash: string;
  usdcOutFormatted: string;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('User not found');

  const currentAvax = parseFloat(user.avaxBalance.replace(/[^0-9.]/g, '')) || 0;
  const safeAvaxIn = Math.min(Math.max(0.05, avaxAmount), Math.max(0.05, currentAvax));
  const usdcOut = safeAvaxIn * 40; // 1 AVAX = 40 mUSDC on MockAvaxUsdcSwap

  user.avaxBalance = Math.max(0.01, currentAvax - safeAvaxIn).toFixed(3);
  user.usdcBalance = (
    (parseFloat(user.usdcBalance.replace(/[^0-9.]/g, '')) || 0) + usdcOut
  ).toFixed(2);

  const txHash = generateMockTxHash();
  state.transactions.unshift({
    id: `tx_${Date.now()}`,
    chainId: 43113,
    txHash,
    senderAddress: user.walletAddress,
    senderName: user.displayName,
    contractAddress: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
    txType: TransactionType.SWAP_AVAX_TO_USDC,
    status: TransactionStatus.CONFIRMED,
    blockNumber: 38510000 + state.transactions.length,
    amountFormatted: `${safeAvaxIn.toFixed(2)} AVAX -> +${usdcOut.toFixed(2)} mUSDC`,
    createdAt: new Date().toISOString(),
  });

  return {
    state: saveMockState(state),
    txHash,
    usdcOutFormatted: usdcOut.toFixed(2),
  };
}

export function mockVerifyTeam1Attestation(): {
  state: AvaHuiMockState;
  identityHash: string;
  trustTier: number;
} {
  const state = loadMockState();
  const user = state.users.find((u) => u.id === state.currentUserId);
  if (!user) throw new Error('User not found');

  const identityHash =
    user.identityHash ||
    `0x${user.walletAddress.slice(2).padEnd(64, 'a').slice(0, 64)}`;
  user.isTeam1Verified = true;
  user.identityHash = identityHash;
  user.trustTier = 2;

  return {
    state: saveMockState(state),
    identityHash,
    trustTier: 2,
  };
}
