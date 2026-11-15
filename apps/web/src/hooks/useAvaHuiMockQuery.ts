'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AvaHuiMockState,
  loadMockState,
  markAllNotificationsRead,
  mockBindRealWallet,
  mockCancelExpiredCircle,
  mockCommitBid,
  mockContributeRound,
  mockCreateCircle,
  mockFaucetMint,
  mockJoinCircle,
  mockRevealBid,
  mockSettleRound,
  mockSubmitBid,
  mockSwapAvaxToUsdc,
  mockUpdateUserProfile,
  mockVerifyTeam1Attestation,
  mockWithdrawCollateral,
  resetMockState,
  switchMockUser,
} from '@/stores/avahuiMockEngine';
import {
  CreateCircleFormInput,
  TransactionType,
  UserProfile,
  UserRole,
  UserStatsDto,
} from '@avahui/shared';
import { MockUSDCABI, Team1AttestationVerifierABI } from '@avahui/blockchain';
import { formatEther, formatUnits, parseUnits } from 'viem';
import {
  ACTIVE_WALLET_STORAGE_KEY,
  AUTH_TOKEN_STORAGE_KEY,
  SignedAttestationVoucher,
  authApi,
  circleApi,
  transactionApi,
  notificationApi,
  verifierApi,
} from '@/lib/api';
import {
  frontendEnv,
  isConfiguredAddress,
  requireConfiguredContractAddress,
} from '@/config/env';
import {
  activeFujiChain,
  ensureBrowserWalletNetwork,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';
import { generateMockTxHash, getSavedCreatorInviteCode } from '@/lib/utils';

export const AVAHUI_QUERY_KEYS = {
  mockState: ['avahui', 'app-state'] as const,
};

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const EMPTY_USER_STATS: UserStatsDto = {
  activeCirclesCount: 0,
  totalContributed: '0.00',
  totalCollateralLocked: '0.00',
  totalPayoutReceived: '0.00',
};

function createGuestUserProfile(
  walletAddress = '',
  avaxBalance = '0.00',
  usdcBalance = '0.00',
): UserProfile {
  return {
    id: 'guest_unauthenticated',
    role: UserRole.MEMBER,
    isActive: true,
    email: '',
    displayName: 'Guest',
    walletAddress,
    avaxBalance,
    usdcBalance,
    usdcAllowance: '0.00',
    stats: EMPTY_USER_STATS,
    isTeam1Verified: false,
    trustTier: 0,
  };
}

async function readOnChainBalances(walletAddress: string): Promise<{
  avaxBalance?: string;
  usdcBalance?: string;
}> {
  try {
    const addr = walletAddress as `0x${string}`;
    const [weiBal, usdcRaw] = await Promise.all([
      publicClient.getBalance({ address: addr }),
      isConfiguredAddress(frontendEnv.usdcTokenAddress)
        ? publicClient
            .readContract({
              address: frontendEnv.usdcTokenAddress,
              abi: MockUSDCABI,
              functionName: 'balanceOf',
              args: [addr],
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

    return {
      avaxBalance: parseFloat(formatEther(weiBal)).toFixed(2),
      ...(usdcRaw !== null
        ? { usdcBalance: parseFloat(formatUnits(usdcRaw as bigint, 6)).toFixed(2) }
        : {}),
    };
  } catch {
    return {};
  }
}

async function fetchRealOrMockState(): Promise<AvaHuiMockState> {
  if (isMockMode) {
    return loadMockState();
  }

  try {
    const mockFallback = loadMockState();
    const fallbackUser =
      mockFallback.users.find((u) => u.id === mockFallback.currentUserId) ||
      mockFallback.users[0];
    const hasAuthToken =
      typeof window !== 'undefined' &&
      Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
    const activeWallet =
      typeof window !== 'undefined'
        ? window.localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY) || undefined
        : undefined;

    const [userProfile, circlesRes, transactions, notifications, onChainBal] =
      await Promise.all([
        hasAuthToken
          ? authApi.getMe(activeWallet).catch((err) => {
              console.warn('[AvaHui] authApi.getMe fallback to mock:', err?.message);
              return null;
            })
          : Promise.resolve(null),
        circleApi.listCircles({ limit: 50 }).catch((err) => {
          console.warn('[AvaHui] circleApi.listCircles fallback to mock:', err?.message);
          return null;
        }),
        hasAuthToken ? transactionApi.getMyTransactions().catch(() => []) : Promise.resolve([]),
        hasAuthToken ? notificationApi.getMyNotifications().catch(() => []) : Promise.resolve([]),
        activeWallet
          ? readOnChainBalances(activeWallet)
          : Promise.resolve<{ avaxBalance?: string; usdcBalance?: string }>({}),
      ]);

    const resolvedWallet =
      userProfile?.walletAddress || activeWallet || '';

    const mappedActiveUser: UserProfile = userProfile
      ? {
          id: userProfile.id,
          role: userProfile.role ?? UserRole.MEMBER,
          isActive: userProfile.isActive ?? true,
          email: userProfile.email || '',
          displayName: userProfile.displayName || 'Avahui Member',
          avatarUrl: userProfile.avatarUrl || undefined,
          walletAddress: resolvedWallet,
          avaxBalance:
            onChainBal.avaxBalance || userProfile.avaxBalance || '0.00',
          usdcBalance:
            onChainBal.usdcBalance || userProfile.usdcBalance || '0.00',
          usdcAllowance: userProfile.usdcAllowance || '0.00',
          stats: userProfile.stats || EMPTY_USER_STATS,
          isTeam1Verified: Boolean(
            userProfile.team1Attested ?? userProfile.isTeam1Verified ?? false,
          ),
          identityNullifier: userProfile.identityNullifier,
          trustTier: userProfile.trustTier,
        }
      : createGuestUserProfile(
          resolvedWallet,
          onChainBal.avaxBalance || '0.00',
          onChainBal.usdcBalance || '0.00',
        );

    const userWallet = (mappedActiveUser.walletAddress || '').toLowerCase();
    const mergedUsers: UserProfile[] = frontendEnv.enableDevDemoTools
      ? [
          mappedActiveUser,
          ...mockFallback.users.filter(
            (u) => (u.walletAddress || '').toLowerCase() !== userWallet,
          ),
        ]
      : [mappedActiveUser];

    const liveCircles = Array.isArray(circlesRes?.items)
      ? circlesRes.items.map((c) => ({
          ...c,
          isSealedBid: c.isSealedBid ?? c.allocationMode === 'BIDDING',
          enableYieldVault: c.enableYieldVault ?? true,
          yieldApyBps: c.yieldApyBps ?? 650,
          accruedYieldFormatted: c.accruedYieldFormatted ?? '0.00',
          inviteCode:
            c.inviteCode ||
            getSavedCreatorInviteCode(c.id, c.metadataId, c.contractAddress),
          requireTeam1Attestation: c.requireTeam1Attestation ?? false,
        }))
      : [];

    return {
      currentUserId: mappedActiveUser.id,
      users: mergedUsers,
      circles: liveCircles,
      transactions: Array.isArray(transactions) ? transactions : [],
      notifications: Array.isArray(notifications) ? notifications : [],
    };
  } catch (err) {
    console.warn('[AvaHui] Failed to fetch live backend state:', err);
    const guest = createGuestUserProfile();
    return {
      currentUserId: guest.id,
      users: [guest],
      circles: [],
      transactions: [],
      notifications: [],
    };
  }
}

export function useAvaHuiState() {
  return useQuery<AvaHuiMockState>({
    queryKey: AVAHUI_QUERY_KEYS.mockState,
    queryFn: () => fetchRealOrMockState(),
    refetchInterval: isMockMode ? false : 2500,
    refetchIntervalInBackground: false,
    staleTime: isMockMode ? Infinity : 1500,
  });
}

function invalidateAllCircleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
  queryClient.invalidateQueries({ queryKey: ['avahui'] });
}

function getLiveOrFallbackState(
  queryClient: ReturnType<typeof useQueryClient>,
): AvaHuiMockState {
  return (
    queryClient.getQueryData<AvaHuiMockState>(AVAHUI_QUERY_KEYS.mockState) ??
    loadMockState()
  );
}

export function useSwitchDemoUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const state = switchMockUser(userId);
      const targetUser = state.users.find((u) => u.id === userId);
      if (!isMockMode && targetUser && targetUser.walletAddress) {
        try {
          await authApi.syncUser(
            {
              walletAddress: targetUser.walletAddress,
              email: targetUser.email || undefined,
              displayName: targetUser.displayName || undefined,
            },
            targetUser.walletAddress,
          );
        } catch (e) {
          console.warn('[AvaHui] Failed to sync user on switch:', e);
        }
      }
      return state;
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useFaucetMint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      arg?: number | { amountUsdc?: number; skipMock?: boolean },
    ) => {
      const amountUsdc = typeof arg === 'number' ? arg : arg?.amountUsdc;
      const skipMock = typeof arg === 'object' ? arg?.skipMock : false;
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 400));
      return mockFaucetMint(amountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useCreateCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      arg: CreateCircleFormInput | { input: CreateCircleFormInput; skipMock?: boolean },
    ) => {
      const input = 'input' in arg ? arg.input : arg;
      const skipMock = 'skipMock' in arg ? Boolean(arg.skipMock) : false;

      if (skipMock && !isMockMode) {
        return {
          state: getLiveOrFallbackState(queryClient),
          newCircle: undefined,
          txHash: '',
        };
      }

      if (!isMockMode) {
        try {
          const contributionAmount = input.contributionAmountUsdc;
          const collateralAmount =
            input.contributionAmountUsdc * (input.collateralMultiplier || 1);
          const contributionBaseUnits = parseUnits(
            String(contributionAmount),
            6,
          ).toString();
          const collateralBaseUnits = parseUnits(
            String(collateralAmount),
            6,
          ).toString();
          const minBidBaseUnits = input.minBidUsdc
            ? parseUnits(String(input.minBidUsdc), 6).toString()
            : '0';
          const maxBidBaseUnits = input.maxBidUsdc
            ? parseUnits(String(input.maxBidUsdc), 6).toString()
            : '0';

          await circleApi.createDraft({
            name: input.name,
            description: input.description,
            allocationMode: input.allocationMode,
            maxMembers: input.maxMembers,
            contributionAmount: contributionBaseUnits,
            collateralAmount: collateralBaseUnits,
            roundDurationSeconds: input.roundDurationSeconds,
            biddingDurationSeconds: input.biddingDurationSeconds,
            gracePeriodSeconds: input.gracePeriodSeconds,
            minBid: minBidBaseUnits,
            maxBid: maxBidBaseUnits,
          });
        } catch (e) {
          console.warn('[AvaHui] circleApi.createDraft error:', e);
        }
      }

      await new Promise((r) => setTimeout(r, 500));
      return mockCreateCircle(input);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useResetDemoData() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      return resetMockState();
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (notificationId?: string) => {
      if (!isMockMode) {
        if (notificationId) {
          await notificationApi.markAsRead(notificationId);
        } else {
          await notificationApi.markAllAsRead();
        }
        const current = getLiveOrFallbackState(queryClient);
        return {
          ...current,
          notifications: current.notifications.map((n) =>
            !notificationId || n.id === notificationId
              ? { ...n, isRead: true }
              : n,
          ),
        };
      }
      return markAllNotificationsRead();
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useJoinCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { circleId: string; skipMock?: boolean }) => {
      const circleId = typeof arg === 'string' ? arg : arg.circleId;
      const skipMock = typeof arg === 'object' ? Boolean(arg.skipMock) : false;
      if (skipMock && !isMockMode) {
        return {
          state: getLiveOrFallbackState(queryClient),
          txHash: '',
          activated: false,
        };
      }
      await new Promise((r) => setTimeout(r, 400));
      return mockJoinCircle(circleId);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useContributeRoundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
      skipMock,
    }: {
      circleId: string;
      roundNumber: number;
      skipMock?: boolean;
    }) => {
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 400));
      return mockContributeRound(circleId, roundNumber);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useSubmitBidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
      bidAmountUsdc,
      skipMock,
    }: {
      circleId: string;
      roundNumber: number;
      bidAmountUsdc: number;
      skipMock?: boolean;
    }) => {
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 400));
      return mockSubmitBid(circleId, roundNumber, bidAmountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useSettleRoundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
      skipMock,
    }: {
      circleId: string;
      roundNumber: number;
      skipMock?: boolean;
    }) => {
      if (skipMock && !isMockMode) {
        return {
          state: getLiveOrFallbackState(queryClient),
          txHash: '',
          winnerName: '',
          netPayoutFormatted: '0.00',
          slashedMembersCount: 0,
        };
      }
      await new Promise((r) => setTimeout(r, 500));
      return mockSettleRound(circleId, roundNumber);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useWithdrawCollateralMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { circleId: string; skipMock?: boolean }) => {
      const circleId = typeof arg === 'string' ? arg : arg.circleId;
      const skipMock = typeof arg === 'object' ? Boolean(arg.skipMock) : false;
      if (skipMock && !isMockMode) {
        return {
          state: getLiveOrFallbackState(queryClient),
          txHash: '',
          totalReturnedFormatted: '0.00',
        };
      }
      await new Promise((r) => setTimeout(r, 400));
      return mockWithdrawCollateral(circleId);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useCancelCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: string | { circleId: string; skipMock?: boolean }) => {
      const circleId = typeof arg === 'string' ? arg : arg.circleId;
      const skipMock = typeof arg === 'object' ? Boolean(arg.skipMock) : false;
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 350));
      return mockCancelExpiredCircle(circleId);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!isMockMode) {
        const updated = await authApi.updateMe({ displayName });
        const current = getLiveOrFallbackState(queryClient);
        return {
          ...current,
          users: current.users.map((u) =>
            u.id === current.currentUserId
              ? { ...u, displayName: updated.displayName || displayName }
              : u,
          ),
        };
      }
      return mockUpdateUserProfile(displayName);
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useCommitBidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
      commitment,
      skipMock,
    }: {
      circleId: string;
      roundNumber: number;
      commitment: string;
      skipMock?: boolean;
    }) => {
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 350));
      return mockCommitBid(circleId, roundNumber, commitment);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useRevealBidMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
      bidAmountUsdc,
      skipMock,
    }: {
      circleId: string;
      roundNumber: number;
      bidAmountUsdc: number;
      skipMock?: boolean;
    }) => {
      if (skipMock && !isMockMode) {
        return { state: getLiveOrFallbackState(queryClient), txHash: '' };
      }
      await new Promise((r) => setTimeout(r, 350));
      return mockRevealBid(circleId, roundNumber, bidAmountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useSwapAvaxToUsdcMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (avaxAmount: number = 0.05) => {
      const state = getLiveOrFallbackState(queryClient);
      const user =
        state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const usdcReceived = Math.round(avaxAmount * 5000);

      if (!isMockMode) {
        if (!frontendEnv.isLocalEvm) {
          throw new Error(
            'Swap DEX trực tiếp trên mạng thật đang chờ kết nối Trader Joe Router. Trên testnet vui lòng dùng nút Faucet mUSDC.',
          );
        }
        const signer = await resolveSignerClient(user?.walletAddress);
        if (!signer) {
          throw new Error(
            'Chưa có ví ký giao dịch. Vui lòng kết nối Core Wallet / MetaMask hoặc đăng nhập lại.',
          );
        }
        const txHash = await signer.client.writeContract({
          address: frontendEnv.usdcTokenAddress,
          abi: MockUSDCABI,
          functionName: 'faucet',
          args: [parseUnits(String(usdcReceived), 6)],
          account: signer.account,
          chain: activeFujiChain,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        await transactionApi
          .trackTransaction({
            txHash,
            txType: TransactionType.SWAP_TOKEN,
            contractAddress: frontendEnv.usdcTokenAddress,
            senderAddress: signer.account,
          })
          .catch(() => {});
        const balances = await readOnChainBalances(signer.account);
        if (user && balances.usdcBalance) user.usdcBalance = balances.usdcBalance;
        if (user && balances.avaxBalance) user.avaxBalance = balances.avaxBalance;
        return { state, txHash, usdcReceived };
      }

      await new Promise((r) => setTimeout(r, 400));
      return mockSwapAvaxToUsdc(avaxAmount);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useVerifyTeam1AttestationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const state = getLiveOrFallbackState(queryClient);
      const user =
        state.users.find((u) => u.id === state.currentUserId) || state.users[0];

      if (!isMockMode) {
        const status = await verifierApi.getMyStatus();
        if (status.team1Verified || status.onChainVerified) {
          if (user) {
            user.isTeam1Verified = true;
            user.identityNullifier = status.identityNullifier ?? undefined;
          }
          return {
            state,
            txHash: '0x' + '0'.repeat(64),
            nullifier: status.identityNullifier || '',
          };
        }

        if (
          user?.walletAddress &&
          (user.role === UserRole.ADMIN || user.role === UserRole.VERIFIER)
        ) {
          const issued = await verifierApi.issueAttestation({
            walletAddress: user.walletAddress,
            trustTier: 2,
            dispatchOnChain: true,
          });
          user.isTeam1Verified = true;
          user.identityNullifier = issued.identityNullifier;
          return {
            state,
            txHash: issued.txHash || generateMockTxHash(),
            nullifier: issued.identityNullifier,
          };
        }

        throw new Error(
          'Chứng nhận Team1 Anti-Sybil do Verifier/Admin cấp sau khi xác minh danh tính. Vui lòng liên hệ Verifier tại /admin.',
        );
      }

      await new Promise((r) => setTimeout(r, 400));
      return mockVerifyTeam1Attestation();
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useClaimTeam1VoucherMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (voucher: SignedAttestationVoucher) => {
      if (isMockMode) {
        return mockVerifyTeam1Attestation();
      }
      const state = getLiveOrFallbackState(queryClient);
      const user =
        state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const verifierAddress = requireConfiguredContractAddress(
        voucher.verifierAddress || frontendEnv.sybilVerifierAddress,
        'Team1AttestationVerifier',
      );
      const signer = await resolveSignerClient(user?.walletAddress);
      if (!signer) {
        throw new Error(
          'Chưa có ví ký giao dịch. Vui lòng kết nối Core Wallet / MetaMask hoặc đăng nhập Privy.',
        );
      }
      if (signer.account.toLowerCase() !== voucher.account.toLowerCase()) {
        throw new Error(
          `Voucher được ký cho ví ${voucher.account}, không khớp ví đang dùng (${signer.account}).`,
        );
      }
      const txHash = await signer.client.writeContract({
        address: verifierAddress,
        abi: Team1AttestationVerifierABI,
        functionName: 'claimAttestationWithSignature',
        args: [
          voucher.account,
          voucher.identityNullifier,
          Number(voucher.trustTier),
          BigInt(voucher.deadline),
          voucher.signature,
        ],
        account: signer.account,
        chain: activeFujiChain,
        gas: 300_000n,
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      await transactionApi
        .trackTransaction({
          txHash,
          txType: TransactionType.VERIFY_ATTESTATION,
          contractAddress: verifierAddress,
          senderAddress: signer.account,
        })
        .catch(() => {});
      return {
        state,
        txHash,
        nullifier: voucher.identityNullifier,
      };
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}

export function useConnectBrowserWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error(
          'Không tìm thấy ví trình duyệt (Core Wallet / MetaMask). Hệ thống đã tự động gán ví EVM local để bạn thao tác ngay mà không cần cài ví ngoài!',
        );
      }
      const eth = (window as any).ethereum;
      const accounts: string[] = await eth.request({
        method: 'eth_requestAccounts',
      });
      if (!accounts || accounts.length === 0) {
        throw new Error('Người dùng đã từ chối kết nối ví.');
      }
      const address = accounts[0];

      await ensureBrowserWalletNetwork(eth);

      const balances = await readOnChainBalances(address);
      const newState = mockBindRealWallet(
        address,
        balances.avaxBalance,
        balances.usdcBalance,
      );

      if (!isMockMode) {
        const hasRealToken =
          typeof window !== 'undefined' &&
          (window.localStorage.getItem('avahui_auth_token') || '').split('.').length === 3;
        if (hasRealToken) {
          await authApi.syncUser({ walletAddress: address }, address).catch(() => {});
        } else {
          try {
            const challenge = await authApi.requestSiweNonce(address);
            const signature: string = await eth.request({
              method: 'personal_sign',
              params: [challenge.message, address],
            });
            const verified = await authApi.verifySiwe({
              address,
              message: challenge.message,
              signature,
              nonce: challenge.nonce,
            });
            if (typeof window !== 'undefined') {
              window.localStorage.setItem('avahui_auth_token', verified.accessToken);
              window.localStorage.setItem('avahui_active_wallet', address.toLowerCase());
            }
          } catch {
            // User declined SIWE sign or backend offline; keep local wallet binding
          }
        }
      }

      return { state: newState, address };
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      invalidateAllCircleQueries(queryClient);
    },
  });
}
