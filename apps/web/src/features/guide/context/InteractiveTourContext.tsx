'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AllocationMode,
  CircleItem,
  CircleStatus,
  MemberStatus,
  RoundStatus,
} from '@avahui/shared';
import { useAuthSession } from '@/lib/auth/useAuthSession';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Compass,
  Sparkles,
  X,
} from 'lucide-react';

export const TOUR_SANDBOX_CIRCLE_ID = 'tour-sandbox';
const STORAGE_PREFIX = 'avahui_beginner_tour_done_';

export interface TourSealedBidState {
  roundNumber: number;
  bidAmountUsdc: number;
  commitment: string;
  salt: string;
  revealed: boolean;
}

interface TourStepConfig {
  id: string;
  route: string;
  selector: string;
  title: string;
  description: string;
  actionHint?: string;
}

const TOUR_STEPS: TourStepConfig[] = [
  {
    id: 'wallet-faucet',
    route: '/dashboard',
    selector: '[data-tour="wallet-faucet-bar"]',
    title: '1. Ví nhúng & Nút Nhận Vốn Thử (Faucet)',
    description:
      'Đây là số dư mUSDC và nút nhận vốn miễn phí trên mạng thử nghiệm Avalanche Fuji. Hãy bấm trực tiếp vào nút +1,000 trong khung sáng để nạp 1,000 mUSDC mô phỏng!',
    actionHint: 'Bấm nút "+1,000" ở góc phải trên màn hình (hoặc bấm Tiếp theo).',
  },
  {
    id: 'dashboard-stats',
    route: '/dashboard',
    selector: '[data-tour="dashboard-stats"]',
    title: '2. Bảng Tổng quan Tài sản',
    description:
      '4 thẻ này tổng hợp số dây đang tham gia, tổng tiền đã góp, tài sản thế chấp đang khóa bảo chứng trong hợp đồng và tiền quỹ đã nhận về ví.',
  },
  {
    id: 'explore-filters',
    route: '/circles',
    selector: '[data-tour="explore-filters"]',
    title: '3. Tìm kiếm & Lọc Dây hụi',
    description:
      'Bạn có thể lọc dây theo trạng thái (Đang gom / Đang chạy / Đã tất toán) và cơ chế (Cố định / Đấu giá). Tiếp theo, hãy vào thử một dây hụi mô phỏng để tự tay thao tác!',
  },
  {
    id: 'circle-header',
    route: `/circles/${TOUR_SANDBOX_CIRCLE_ID}`,
    selector: '[data-tour="circle-header-summary"]',
    title: '4. Kiểm tra Thông số Dây hụi trước khi tham gia',
    description:
      'Luôn xem 4 thông số cốt lõi: Mức đóng/Kỳ (50 mUSDC), Tổng quỹ/Kỳ (250 mUSDC), Thế chấp khóa (100 mUSDC = 2x chống bùng) cùng nhãn Đấu giá kín & Kho lãi 6.5% APY.',
  },
  {
    id: 'circle-join',
    route: `/circles/${TOUR_SANDBOX_CIRCLE_ID}`,
    selector: '[data-tour="action-console"]',
    title: '5. Tham gia dây & Khóa Thế chấp (Thực hành trực tiếp)',
    description:
      'Bảng Thao Tác ở đây cập nhật theo từng giai đoạn của dây. Hãy bấm nút "Tham gia • Khóa 100.00 mUSDC" ngay trong khung sáng để vào vị trí #5 và mở Kỳ #1!',
    actionHint: 'Bấm trực tiếp nút Tham gia trong Bảng Thao Tác.',
  },
  {
    id: 'circle-round',
    route: `/circles/${TOUR_SANDBOX_CIRCLE_ID}`,
    selector: '[data-tour="action-console"]',
    title: '6. Đóng hụi & Đấu giá kín 2 pha',
    description:
      'Ở Kỳ #1, hãy bấm thử: (1) "Đóng 50.00 mUSDC" → (2) Chọn mức chiết khấu & bấm "Niêm phong" rồi "Mở niêm phong" → (3) Bấm "Tất toán & Giải ngân" để hoàn tất chu kỳ mô phỏng!',
    actionHint: 'Hoặc bấm "Tua nhanh tới Tất toán" bên dưới nếu muốn xem bước rút tiền ngay.',
  },
  {
    id: 'circle-withdraw',
    route: `/circles/${TOUR_SANDBOX_CIRCLE_ID}`,
    selector: '[data-tour="action-console"]',
    title: '7. Rút Thế chấp + Thưởng chiết khấu + Lãi 6.5% APY',
    description:
      'Khi dây tất toán xong, hệ thống tách minh bạch 3 khoản bạn nhận lại (Thế chấp gốc 100 + Thưởng chiết khấu 12.50 + Lãi Vault 1.35 mUSDC). Hãy bấm nút Rút ngay trên UI!',
    actionHint: 'Bấm nút "Rút +113.85 mUSDC" trong Bảng Thao Tác.',
  },
  {
    id: 'profile-credit',
    route: '/profile',
    selector: '[data-tour="profile-credit-score"]',
    title: '8. Điểm Tín Nhiệm Hụi & Xác thực Team1',
    description:
      'Mỗi kỳ đóng đúng hạn (+10 điểm) và mỗi dây hoàn thành (+30 điểm) tự động tích lũy uy tín on-chain tại Hồ sơ. Chúc mừng bạn đã nắm rõ cách dùng AvaHui!',
  },
];

function createInitialSandboxCircle(): CircleItem {
  const nowIso = new Date().toISOString();
  const baseAddr = (idx: number) =>
    `0x000000000000000000000000000000000000d00${idx}`;
  return {
    id: TOUR_SANDBOX_CIRCLE_ID,
    metadataId: TOUR_SANDBOX_CIRCLE_ID,
    contractAddress: '0xDemo000000000000000000000000000000002026',
    chainId: 43113,
    name: 'Dây Hụi Tập Sự (Mô phỏng Tương tác)',
    description:
      'Dây hụi giả lập dành riêng cho chế độ hướng dẫn — mọi thao tác đều chạy trên bộ nhớ trình duyệt và không tốn token thật.',
    creatorAddress: baseAddr(1),
    tokenAddress: '0x0000000000000000000000000000000000000000',
    tokenSymbol: 'mUSDC',
    tokenDecimals: 6,
    allocationMode: AllocationMode.BIDDING,
    status: CircleStatus.Recruiting,
    maxMembers: 5,
    currentMemberCount: 4,
    currentRound: 0,
    totalRounds: 5,
    contributionAmount: '50000000',
    contributionAmountFormatted: '50.00',
    collateralAmount: '100000000',
    collateralAmountFormatted: '100.00',
    collateralMultiplier: 2,
    roundDurationSeconds: 180,
    biddingDurationSeconds: 120,
    gracePeriodSeconds: 60,
    startDeadline: new Date(Date.now() + 7 * 86400 * 1000).toISOString(),
    minBid: '5000000',
    minBidFormatted: '5.00',
    maxBid: '40000000',
    maxBidFormatted: '40.00',
    totalDiscountPool: '0',
    totalDiscountPoolFormatted: '0.00',
    isSealedBid: true,
    enableYieldVault: true,
    yieldApyBps: 650,
    accruedYieldFormatted: '0.00',
    isPrivateInvite: false,
    requireTeam1Attestation: false,
    isPaused: false,
    createdAt: nowIso,
    members: [1, 2, 3, 4].map((slot) => ({
      slotIndex: slot,
      userId: `demo_user_${slot}`,
      displayName: `Thành viên Mẫu #${slot}`,
      walletAddress: baseAddr(slot),
      lockedCollateral: '100000000',
      lockedCollateralFormatted: '100.00',
      initialLockedAmountFormatted: '100.00',
      slashedCollateralFormatted: '0.00',
      hasReceivedPayout: false,
      wonRoundNumber: null,
      defaultCount: 0,
      status: MemberStatus.Active,
      team1Verified: slot <= 2,
      trustTier: slot <= 2 ? 1 : 0,
    })),
    rounds: [],
  };
}

interface InteractiveTourContextValue {
  isTourActive: boolean;
  tourStepIndex: number;
  sandboxUsdcBalance: string;
  sandboxAvaxBalance: string;
  sandboxCircle: CircleItem;
  sandboxSavedSealedBid: TourSealedBidState | null;
  sandboxActions: {
    fauceted: boolean;
    joined: boolean;
    contributed: boolean;
    committed: boolean;
    revealed: boolean;
    settled: boolean;
    withdrawn: boolean;
  };
  startTour: () => void;
  exitTour: () => void;
  performSandboxFaucet: () => void;
  performSandboxJoin: (walletAddress: string, displayName: string) => void;
  performSandboxContribute: (walletAddress: string, displayName: string) => void;
  performSandboxCommitBid: (bidUsdc: number) => void;
  performSandboxRevealBid: (walletAddress: string, displayName: string) => void;
  performSandboxSettleRound: (walletAddress: string, displayName: string) => void;
  performSandboxWithdraw: (walletAddress: string) => void;
  fastForwardToCompletedCircle: (walletAddress: string, displayName: string) => void;
}

const DEFAULT_ACTIONS = {
  fauceted: false,
  joined: false,
  contributed: false,
  committed: false,
  revealed: false,
  settled: false,
  withdrawn: false,
};

const InteractiveTourContext = createContext<InteractiveTourContextValue | null>(null);

export function useInteractiveTour() {
  const ctx = useContext(InteractiveTourContext);
  if (!ctx) {
    return {
      isTourActive: false,
      tourStepIndex: 0,
      sandboxUsdcBalance: '0.00',
      sandboxAvaxBalance: '0.0250',
      sandboxCircle: createInitialSandboxCircle(),
      sandboxSavedSealedBid: null,
      sandboxActions: DEFAULT_ACTIONS,
      startTour: () => {},
      exitTour: () => {},
      performSandboxFaucet: () => {},
      performSandboxJoin: () => {},
      performSandboxContribute: () => {},
      performSandboxCommitBid: () => {},
      performSandboxRevealBid: () => {},
      performSandboxSettleRound: () => {},
      performSandboxWithdraw: () => {},
      fastForwardToCompletedCircle: () => {},
    } as InteractiveTourContextValue;
  }
  return ctx;
}

interface SpotlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function InteractiveTourProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const { data: session } = useAuthSession();

  const [askNewUserOpen, setAskNewUserOpen] = useState(false);
  const [isTourActive, setIsTourActive] = useState(false);
  const [tourStepIndex, setTourStepIndex] = useState(0);

  // Simulated sandbox state
  const [sandboxUsdc, setSandboxUsdc] = useState(0);
  const [sandboxCircle, setSandboxCircle] = useState<CircleItem>(() =>
    createInitialSandboxCircle(),
  );
  const [sandboxSavedSealedBid, setSandboxSavedSealedBid] =
    useState<TourSealedBidState | null>(null);
  const [sandboxActions, setSandboxActions] = useState(DEFAULT_ACTIONS);

  // Spotlight geometry tracking
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);
  const [viewport, setViewport] = useState({ w: 1280, h: 800 });

  const storageKey = `${STORAGE_PREFIX}${session?.userId || 'guest'}`;

  const resetSandboxData = useCallback(() => {
    setSandboxUsdc(0);
    setSandboxCircle(createInitialSandboxCircle());
    setSandboxSavedSealedBid(null);
    setSandboxActions(DEFAULT_ACTIONS);
  }, []);

  const markSeen = useCallback(() => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  // Trigger "Bạn có phải người mới không?" once right after first authenticated login
  useEffect(() => {
    if (!session?.isAuthenticated || isTourActive) return;
    const isHidden =
      pathname === '/' ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/onboarding/wallet');
    if (isHidden) return;

    try {
      if (!localStorage.getItem(storageKey)) {
        setAskNewUserOpen(true);
      }
    } catch {
      // ignore
    }
  }, [isTourActive, pathname, session?.isAuthenticated, storageKey]);

  const startTour = useCallback(() => {
    markSeen();
    setAskNewUserOpen(false);
    resetSandboxData();
    setTourStepIndex(0);
    setIsTourActive(true);
    router.push(TOUR_STEPS[0].route);
  }, [markSeen, resetSandboxData, router]);

  const exitTour = useCallback(() => {
    markSeen();
    setAskNewUserOpen(false);
    setIsTourActive(false);
    setSpotlightRect(null);
    if (pathname.includes(TOUR_SANDBOX_CIRCLE_ID)) {
      router.push('/dashboard');
    }
  }, [markSeen, pathname, router]);

  const handleSkipWelcome = () => {
    markSeen();
    setAskNewUserOpen(false);
  };

  // Navigate automatically whenever tourStepIndex changes
  const activeStep = TOUR_STEPS[tourStepIndex] || TOUR_STEPS[0];

  useEffect(() => {
    if (!isTourActive) return;
    if (pathname !== activeStep.route) {
      router.push(activeStep.route);
    }
  }, [activeStep.route, isTourActive, pathname, router]);

  // Measure target element & keep spotlight locked while scrolling / resizing / DOM updating
  useEffect(() => {
    if (!isTourActive) {
      setSpotlightRect(null);
      return;
    }

    let cancelled = false;
    let scrolledOnce = false;

    const measure = () => {
      if (cancelled) return;
      setViewport({ w: window.innerWidth, h: window.innerHeight });
      const el = document.querySelector(activeStep.selector) as HTMLElement | null;
      if (!el) {
        setSpotlightRect(null);
        return;
      }
      if (!scrolledOnce) {
        scrolledOnce = true;
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      }
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        const pad = 6;
        setSpotlightRect({
          top: Math.max(4, r.top - pad),
          left: Math.max(4, r.left - pad),
          width: r.width + pad * 2,
          height: r.height + pad * 2,
        });
      }
    };

    measure();
    const timer = window.setInterval(measure, 180);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [activeStep.selector, activeStep.id, isTourActive, pathname, sandboxCircle.status, sandboxActions]);

  // =========================================================================
  // SIMULATED IN-MEMORY SANDBOX ACTIONS (EXECUTED WHEN CLICKING REAL UI)
  // =========================================================================
  const performSandboxFaucet = useCallback(() => {
    setSandboxUsdc((prev) => prev + 1000);
    setSandboxActions((prev) => ({ ...prev, fauceted: true }));
  }, []);

  const performSandboxJoin = useCallback(
    (walletAddress: string, displayName: string) => {
      const addr = walletAddress || '0xYou000000000000000000000000000000005';
      const nowIso = new Date().toISOString();
      setSandboxUsdc((prev) => Math.max(0, prev - 100));
      setSandboxCircle((prev) => {
        const already = prev.members.some(
          (m) => m.walletAddress.toLowerCase() === addr.toLowerCase(),
        );
        const members = already
          ? prev.members
          : [
              ...prev.members,
              {
                slotIndex: 5,
                userId: session?.userId || 'you',
                displayName: displayName || 'Bạn (Tài khoản tập)',
                walletAddress: addr,
                lockedCollateral: '100000000',
                lockedCollateralFormatted: '100.00',
                initialLockedAmountFormatted: '100.00',
                slashedCollateralFormatted: '0.00',
                hasReceivedPayout: false,
                wonRoundNumber: null,
                defaultCount: 0,
                status: MemberStatus.Active,
                team1Verified: true,
                trustTier: 1,
                joinedAt: nowIso,
              },
            ];

        // Open Round #1 with the 4 sample peers already paid so learner only pays their own share
        const peerContribs = members.slice(0, 4).map((m, idx) => ({
          id: `tour_c_${idx + 1}`,
          roundNumber: 1,
          memberAddress: m.walletAddress,
          memberName: m.displayName,
          amount: '50000000',
          amountFormatted: '50.00',
          isFromCollateralSlash: false,
          paidAt: nowIso,
          txHash: `0xdemo00000000000000000000000000000000000000000000000000000000000${idx + 1}`,
        }));

        return {
          ...prev,
          status: CircleStatus.Active,
          currentMemberCount: members.length,
          currentRound: 1,
          members,
          rounds: [
            {
              id: 'tour_round_1',
              roundNumber: 1,
              status: RoundStatus.Open,
              startTime: nowIso,
              contributionDeadline: new Date(Date.now() + 180_000).toISOString(),
              biddingDeadline: new Date(Date.now() + 120_000).toISOString(),
              graceDeadline: new Date(Date.now() + 240_000).toISOString(),
              winnerAddress: null,
              winnerName: null,
              grossPotFormatted: '250.00',
              winningBidFormatted: '0.00',
              netPayoutFormatted: '250.00',
              settlementTxHash: null,
              contributionsCount: peerContribs.length,
              contributions: peerContribs,
              bids: [],
            },
          ],
        };
      });
      setSandboxActions((prev) => ({ ...prev, joined: true }));
    },
    [session?.userId],
  );

  const performSandboxContribute = useCallback(
    (walletAddress: string, displayName: string) => {
      const addr = walletAddress || '0xYou000000000000000000000000000000005';
      const nowIso = new Date().toISOString();
      setSandboxUsdc((prev) => Math.max(0, prev - 50));
      setSandboxCircle((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) => {
          if (r.roundNumber !== prev.currentRound) return r;
          const exists = r.contributions.some(
            (c) => c.memberAddress.toLowerCase() === addr.toLowerCase(),
          );
          if (exists) return r;
          const contributions = [
            ...r.contributions,
            {
              id: 'tour_c_you',
              roundNumber: r.roundNumber,
              memberAddress: addr,
              memberName: displayName || 'Bạn (Tài khoản tập)',
              amount: '50000000',
              amountFormatted: '50.00',
              isFromCollateralSlash: false,
              paidAt: nowIso,
              txHash:
                '0xdemo000000000000000000000000000000000000000000000000000000000099',
            },
          ];
          return {
            ...r,
            contributionsCount: contributions.length,
            contributions,
          };
        }),
      }));
      setSandboxActions((prev) => ({ ...prev, contributed: true }));
    },
    [],
  );

  const performSandboxCommitBid = useCallback((bidUsdc: number) => {
    const cleanBid = Number.isFinite(bidUsdc) && bidUsdc >= 5 ? bidUsdc : 15;
    setSandboxSavedSealedBid({
      roundNumber: 1,
      bidAmountUsdc: cleanBid,
      commitment:
        '0x9c4ef80172b5e4c83a91c0d62199b0e4471b0d1e9a4c6e801b2f3d4c5a6ba12f',
      salt: '0x71ab9200deadbeef42cafe990123456789abcdef0123456789abcdef01234567',
      revealed: false,
    });
    setSandboxActions((prev) => ({ ...prev, committed: true }));
  }, []);

  const performSandboxRevealBid = useCallback(
    (walletAddress: string, displayName: string) => {
      const addr = walletAddress || '0xYou000000000000000000000000000000005';
      const nowIso = new Date().toISOString();
      const bidAmt = sandboxSavedSealedBid?.bidAmountUsdc || 15;
      setSandboxSavedSealedBid((prev) =>
        prev ? { ...prev, revealed: true } : null,
      );
      setSandboxCircle((prev) => ({
        ...prev,
        rounds: prev.rounds.map((r) => {
          if (r.roundNumber !== prev.currentRound) return r;
          const netPayout = Math.max(0, 250 - bidAmt);
          return {
            ...r,
            winnerAddress: addr,
            winnerName: displayName || 'Bạn (Tài khoản tập)',
            winningBidFormatted: bidAmt.toFixed(2),
            netPayoutFormatted: netPayout.toFixed(2),
            bids: [
              ...r.bids,
              {
                id: 'tour_bid_you',
                roundNumber: r.roundNumber,
                bidderAddress: addr,
                bidderName: displayName || 'Bạn (Tài khoản tập)',
                bidAmountFormatted: bidAmt.toFixed(2),
                isWinningBid: true,
                isSealedReveal: true,
                createdAt: nowIso,
                txHash:
                  '0xdemo000000000000000000000000000000000000000000000000000000000101',
              },
            ],
          };
        }),
      }));
      setSandboxActions((prev) => ({ ...prev, revealed: true }));
    },
    [sandboxSavedSealedBid?.bidAmountUsdc],
  );

  const fastForwardToCompletedCircle = useCallback(
    (walletAddress: string, displayName: string) => {
      const addr = walletAddress || '0xYou000000000000000000000000000000005';
      const nowIso = new Date().toISOString();
      const base = createInitialSandboxCircle();
      const members = [
        ...base.members.map((m) => ({
          ...m,
          hasReceivedPayout: true,
          wonRoundNumber: m.slotIndex,
        })),
        {
          slotIndex: 5,
          userId: session?.userId || 'you',
          displayName: displayName || 'Bạn (Tài khoản tập)',
          walletAddress: addr,
          lockedCollateral: '100000000',
          lockedCollateralFormatted: '100.00',
          initialLockedAmountFormatted: '100.00',
          slashedCollateralFormatted: '0.00',
          hasReceivedPayout: true,
          wonRoundNumber: 1,
          defaultCount: 0,
          status: MemberStatus.Active,
          team1Verified: true,
          trustTier: 1,
          joinedAt: nowIso,
        },
      ];

      const bidAmt = sandboxSavedSealedBid?.bidAmountUsdc || 15;
      const roundNet = Math.max(0, 250 - bidAmt);

      setSandboxCircle({
        ...base,
        status: CircleStatus.Completed,
        currentMemberCount: 5,
        currentRound: 5,
        totalDiscountPoolFormatted: '62.50', // 62.50 / 5 = +12.50 mUSDC each
        accruedYieldFormatted: '6.75', // 6.75 / 5 = +1.35 mUSDC each
        members,
        rounds: [
          {
            id: 'tour_round_1_settled',
            roundNumber: 1,
            status: RoundStatus.Settled,
            startTime: nowIso,
            contributionDeadline: nowIso,
            biddingDeadline: nowIso,
            graceDeadline: nowIso,
            winnerAddress: addr,
            winnerName: displayName || 'Bạn (Tài khoản tập)',
            grossPotFormatted: '250.00',
            winningBidFormatted: bidAmt.toFixed(2),
            netPayoutFormatted: roundNet.toFixed(2),
            settlementTxHash:
              '0xdemo000000000000000000000000000000000000000000000000000000000201',
            settledAt: nowIso,
            contributionsCount: 5,
            contributions: [],
            bids: [],
          },
        ],
      });
      setSandboxActions({
        fauceted: true,
        joined: true,
        contributed: true,
        committed: true,
        revealed: true,
        settled: true,
        withdrawn: false,
      });
    },
    [sandboxSavedSealedBid?.bidAmountUsdc, session?.userId],
  );

  const performSandboxSettleRound = useCallback(
    (walletAddress: string, displayName: string) => {
      const bidAmt = sandboxSavedSealedBid?.bidAmountUsdc || 15;
      const roundNet = Math.max(0, 250 - bidAmt);
      setSandboxUsdc((prev) => prev + roundNet);
      fastForwardToCompletedCircle(walletAddress, displayName);
      setTourStepIndex((idx) => (idx < 6 ? 6 : idx));
    },
    [fastForwardToCompletedCircle, sandboxSavedSealedBid?.bidAmountUsdc],
  );

  const performSandboxWithdraw = useCallback((walletAddress: string) => {
    const addr = walletAddress || '0xYou000000000000000000000000000000005';
    setSandboxUsdc((prev) => prev + 113.85);
    setSandboxCircle((prev) => ({
      ...prev,
      members: prev.members.map((m) =>
        m.walletAddress.toLowerCase() === addr.toLowerCase()
          ? {
              ...m,
              status: MemberStatus.Withdrawn,
              lockedCollateral: '0',
              lockedCollateralFormatted: '0.00',
            }
          : m,
      ),
    }));
    setSandboxActions((prev) => ({ ...prev, withdrawn: true }));
  }, []);

  const value = useMemo<InteractiveTourContextValue>(
    () => ({
      isTourActive,
      tourStepIndex,
      sandboxUsdcBalance: sandboxUsdc.toFixed(2),
      sandboxAvaxBalance: '0.0250',
      sandboxCircle,
      sandboxSavedSealedBid,
      sandboxActions,
      startTour,
      exitTour,
      performSandboxFaucet,
      performSandboxJoin,
      performSandboxContribute,
      performSandboxCommitBid,
      performSandboxRevealBid,
      performSandboxSettleRound,
      performSandboxWithdraw,
      fastForwardToCompletedCircle,
    }),
    [
      isTourActive,
      tourStepIndex,
      sandboxUsdc,
      sandboxCircle,
      sandboxSavedSealedBid,
      sandboxActions,
      startTour,
      exitTour,
      performSandboxFaucet,
      performSandboxJoin,
      performSandboxContribute,
      performSandboxCommitBid,
      performSandboxRevealBid,
      performSandboxSettleRound,
      performSandboxWithdraw,
      fastForwardToCompletedCircle,
    ],
  );

  // Compute safe Coachmark Popover coordinates beside/below/above spotlightRect
  const popoverStyle = useMemo<React.CSSProperties>(() => {
    const cardW = Math.min(360, viewport.w - 24);
    if (!spotlightRect) {
      return {
        position: 'fixed',
        bottom: 24,
        right: 16,
        width: cardW,
        zIndex: 70,
      };
    }

    const spaceBelow = viewport.h - (spotlightRect.top + spotlightRect.height);
    const spaceAbove = spotlightRect.top;
    const spaceLeft = spotlightRect.left;
    const spaceRight = viewport.w - (spotlightRect.left + spotlightRect.width);

    let top = spotlightRect.top + spotlightRect.height + 12;
    let left = Math.max(
      12,
      Math.min(viewport.w - cardW - 12, spotlightRect.left),
    );

    if (spotlightRect.width < viewport.w * 0.65 && spaceLeft >= cardW + 20) {
      // Place cleanly to the left of tall right-column Action Console
      left = spotlightRect.left - cardW - 14;
      top = Math.max(
        60,
        Math.min(viewport.h - 260, spotlightRect.top + 16),
      );
    } else if (
      spotlightRect.width < viewport.w * 0.65 &&
      spaceRight >= cardW + 20
    ) {
      left = spotlightRect.left + spotlightRect.width + 14;
      top = Math.max(60, Math.min(viewport.h - 260, spotlightRect.top + 16));
    } else if (spaceBelow >= 230) {
      top = spotlightRect.top + spotlightRect.height + 12;
    } else if (spaceAbove >= 230) {
      top = Math.max(56, spotlightRect.top - 225);
    } else {
      top = Math.max(56, viewport.h - 250);
    }

    return {
      position: 'fixed',
      top,
      left,
      width: cardW,
      zIndex: 70,
    };
  }, [spotlightRect, viewport.h, viewport.w]);

  const myDemoWallet =
    session?.walletAddress || '0xYou000000000000000000000000000000005';
  const myDemoName = 'Bạn (Tài khoản tập)';

  return (
    <InteractiveTourContext.Provider value={value}>
      {/* Persistent Top Ribbon when Interactive UI Tour Mode is running */}
      {isTourActive && (
        <div className="sticky top-0 z-[65] border-b border-amber-500/50 bg-zinc-950/95 px-3 sm:px-6 py-2 backdrop-blur-md">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 font-mono text-xs">
            <div className="flex items-center gap-2 text-amber-200">
              <Compass className="h-4 w-4 text-amber-400 animate-spin" style={{ animationDuration: '8s' }} />
              <span className="font-extrabold uppercase tracking-wider text-amber-300">
                HƯỚNG DẪN TƯƠNG TÁC TRÊN UI
              </span>
              <span className="hidden sm:inline text-zinc-400">
                • Dữ liệu mô phỏng an toàn, bấm trực tiếp vào vùng phát sáng (không tốn tiền thật)
              </span>
            </div>
            <button
              type="button"
              onClick={exitTour}
              className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-[11px] font-bold uppercase text-zinc-200 hover:border-rose-500/60 hover:text-rose-300"
            >
              <X className="h-3.5 w-3.5" />
              <span>Thoát hướng dẫn</span>
            </button>
          </div>
        </div>
      )}

      {children}

      {/* 1. FIRST-LOGIN WELCOME PROMPT ("Bạn có phải người mới không?") */}
      {askNewUserOpen && !isTourActive && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Hỏi người mới sử dụng AvaHui"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in"
        >
          <div className="w-full max-w-md rounded-none border border-zinc-700 bg-surface-card p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="flex items-start justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 rounded-none border border-avalanche-red/40 bg-avalanche-red/10 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-avalanche-red">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Chào mừng tới AvaHui</span>
              </div>
              <button
                type="button"
                onClick={handleSkipWelcome}
                aria-label="Đóng"
                className="rounded-none p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h2 className="font-mono text-lg font-extrabold uppercase tracking-tight text-white">
                Bạn có phải người mới sử dụng không?
              </h2>
              <p className="text-xs sm:text-sm leading-relaxed text-zinc-300">
                Chọn <strong className="text-white">Bắt đầu hướng dẫn</strong> để đi từng bước trực tiếp ngay trên giao diện thật của app với dữ liệu mô phỏng an toàn — tập nhận vốn, khóa thế chấp, đóng hụi, đấu giá kín và rút tất toán mà{' '}
                <strong className="text-emerald-400">không tốn tiền thật</strong>.
              </p>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={handleSkipWelcome}
                className="flex-1 rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-500 hover:text-white"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={startTour}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-none border border-avalanche-red bg-avalanche-red px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-avalanche-red/25 transition hover:bg-avalanche-darkRed"
              >
                <span>Bắt đầu hướng dẫn</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. LIVE UI SPOTLIGHT CUTOUT (4 BACKDROP PANELS SO CENTER IS CLICKABLE!) + COACHMARK */}
      {isTourActive && (
        <>
          {spotlightRect ? (
            <>
              {/* Top mask */}
              <div
                className="fixed left-0 right-0 top-0 z-[55] bg-black/65 transition-all duration-200"
                style={{ height: Math.max(0, spotlightRect.top) }}
              />
              {/* Bottom mask */}
              <div
                className="fixed bottom-0 left-0 right-0 z-[55] bg-black/65 transition-all duration-200"
                style={{
                  top: spotlightRect.top + spotlightRect.height,
                }}
              />
              {/* Left mask */}
              <div
                className="fixed left-0 z-[55] bg-black/65 transition-all duration-200"
                style={{
                  top: spotlightRect.top,
                  height: spotlightRect.height,
                  width: Math.max(0, spotlightRect.left),
                }}
              />
              {/* Right mask */}
              <div
                className="fixed right-0 z-[55] bg-black/65 transition-all duration-200"
                style={{
                  top: spotlightRect.top,
                  height: spotlightRect.height,
                  left: spotlightRect.left + spotlightRect.width,
                }}
              />
              {/* Glowing target ring (pointer-events-none so real UI clicks pass through!) */}
              <div
                className="pointer-events-none fixed z-[60] border-2 border-avalanche-red shadow-[0_0_24px_rgba(232,65,66,0.75)] transition-all duration-200"
                style={{
                  top: spotlightRect.top,
                  left: spotlightRect.left,
                  width: spotlightRect.width,
                  height: spotlightRect.height,
                }}
              />
            </>
          ) : (
            <div className="fixed inset-0 z-[55] bg-black/65" />
          )}

          {/* Floating Coachmark Popover */}
          <div
            role="dialog"
            aria-label={activeStep.title}
            style={popoverStyle}
            className="rounded-none border-2 border-avalanche-red bg-zinc-950 p-4 shadow-2xl space-y-3 font-sans"
          >
            <div className="flex items-center justify-between gap-2 border-b border-zinc-800 pb-2">
              <span className="font-mono text-[11px] font-extrabold uppercase tracking-wider text-avalanche-red">
                Bước {tourStepIndex + 1} / {TOUR_STEPS.length}
              </span>
              <button
                type="button"
                onClick={exitTour}
                aria-label="Thoát hướng dẫn"
                className="rounded-none p-1 text-zinc-400 hover:bg-zinc-900 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <h3 className="font-mono text-sm font-extrabold text-white">
              {activeStep.title}
            </h3>

            <p className="text-xs leading-relaxed text-zinc-300">
              {activeStep.description}
            </p>

            {activeStep.actionHint && (
              <div className="rounded-none border border-amber-500/40 bg-amber-500/10 px-2.5 py-2 text-[11px] font-medium text-amber-200">
                {activeStep.actionHint}
              </div>
            )}

            {/* Interactive step feedback badges */}
            {tourStepIndex === 0 && sandboxActions.fauceted && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã nhận +1,000 mUSDC mô phỏng!</span>
              </div>
            )}

            {tourStepIndex === 4 && sandboxActions.joined && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã tham gia Slot #5 &amp; mở Kỳ #1! Bấm Tiếp theo →</span>
              </div>
            )}

            {tourStepIndex === 5 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-mono text-[10px] text-zinc-400">
                  {sandboxActions.contributed ? '✓ Đóng tiền' : '○ Đóng tiền'} •{' '}
                  {sandboxActions.committed ? '✓ Niêm phong' : '○ Niêm phong'} •{' '}
                  {sandboxActions.revealed ? '✓ Mở giá' : '○ Mở giá'}
                </div>
                {!sandboxActions.settled && (
                  <button
                    type="button"
                    onClick={() => {
                      fastForwardToCompletedCircle(myDemoWallet, myDemoName);
                      setTourStepIndex(6);
                    }}
                    className="font-mono text-[11px] font-bold text-sky-300 underline hover:text-white"
                  >
                    Tua nhanh tới Tất toán →
                  </button>
                )}
              </div>
            )}

            {tourStepIndex === 6 && !sandboxActions.settled && (
              <button
                type="button"
                onClick={() => fastForwardToCompletedCircle(myDemoWallet, myDemoName)}
                className="w-full rounded-none border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 font-mono text-[11px] font-bold text-amber-200 hover:bg-amber-500/20"
              >
                Mở trạng thái Đã tất toán để thử Rút tiền
              </button>
            )}

            {tourStepIndex === 6 && sandboxActions.withdrawn && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Đã rút +113.85 mUSDC mô phỏng về ví!</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 border-t border-zinc-800 pt-2.5 font-mono text-xs">
              <button
                type="button"
                disabled={tourStepIndex === 0}
                onClick={() => setTourStepIndex((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-[11px] font-bold uppercase text-zinc-300 hover:text-white disabled:opacity-40"
              >
                <ArrowLeft className="h-3 w-3" />
                <span>Trước</span>
              </button>

              {tourStepIndex < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const nextIdx = tourStepIndex + 1;
                    if (nextIdx === 6 && !sandboxActions.settled) {
                      fastForwardToCompletedCircle(myDemoWallet, myDemoName);
                    }
                    setTourStepIndex(nextIdx);
                  }}
                  className="inline-flex items-center gap-1 rounded-none border border-avalanche-red bg-avalanche-red px-3.5 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-avalanche-darkRed"
                >
                  <span>Tiếp theo</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    exitTour();
                    router.push('/dashboard');
                  }}
                  className="inline-flex items-center gap-1 rounded-none border border-emerald-500 bg-emerald-500 px-3.5 py-1.5 text-[11px] font-bold uppercase text-zinc-950 hover:bg-emerald-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Hoàn thành</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </InteractiveTourContext.Provider>
  );
}

