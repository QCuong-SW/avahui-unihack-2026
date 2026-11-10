'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AvaHuiMockState,
  loadMockState,
  markAllNotificationsRead,
  mockBindRealWallet,
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
  saveMockState,
  switchMockUser,
} from '@/stores/avahuiMockEngine';
import {
  CreateCircleFormInput,
  TransactionType,
} from '@avahui/shared';
import { MockUSDCABI } from '@avahui/blockchain';
import { formatEther, formatUnits, parseUnits } from 'viem';
import {
  authApi,
  circleApi,
  transactionApi,
  notificationApi,
} from '@/lib/api';
import { frontendEnv } from '@/config/env';
import {
  activeFujiChain,
  ensureBrowserWalletNetwork,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';
import { generateMockTxHash } from '@/lib/utils';

export const AVAHUI_QUERY_KEYS = {
  mockState: ['avahui', 'app-state'] as const,
};

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

const TEAM1_VERIFIER_ABI = [
  {
    type: 'function',
    name: 'issueAttestation',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'identityNullifier', type: 'bytes32' },
      { name: 'trustTier', type: 'uint8' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
] as const;

async function readOnChainBalances(walletAddress: string): Promise<{
  avaxBalance?: string;
  usdcBalance?: string;
}> {
  try {
    const addr = walletAddress as `0x${string}`;
    const [weiBal, usdcRaw] = await Promise.all([
      publicClient.getBalance({ address: addr }),
      publicClient
        .readContract({
          address: frontendEnv.usdcTokenAddress,
          abi: MockUSDCABI,
          functionName: 'balanceOf',
          args: [addr],
        })
        .catch(() => null),
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
    const activeWallet =
      (typeof window !== 'undefined' &&
        window.localStorage.getItem('avahui_active_wallet')) ||
      fallbackUser?.walletAddress;

    const [userProfile, circlesRes, transactions, notifications, onChainBal] =
      await Promise.all([
        authApi.getMe(activeWallet).catch((err) => {
          console.warn('[AvaHui] authApi.getMe fallback to mock:', err?.message);
          return null;
        }),
        circleApi.listCircles({ limit: 50 }).catch((err) => {
          console.warn('[AvaHui] circleApi.listCircles fallback to mock:', err?.message);
          return null;
        }),
        transactionApi.getMyTransactions().catch(() => []),
        notificationApi.getMyNotifications().catch(() => []),
        activeWallet
          ? readOnChainBalances(activeWallet)
          : Promise.resolve<{ avaxBalance?: string; usdcBalance?: string }>({}),
      ]);

    const resolvedWallet =
      userProfile?.walletAddress || activeWallet || fallbackUser.walletAddress;

    const mappedActiveUser = userProfile
      ? {
          id: fallbackUser?.walletAddress?.toLowerCase() === resolvedWallet.toLowerCase()
            ? fallbackUser.id
            : userProfile.id,
          email: userProfile.email || fallbackUser?.email || 'builder@avahui.io',
          displayName:
            userProfile.displayName || fallbackUser?.displayName || 'UniHack Builder',
          avatarUrl: userProfile.avatarUrl || undefined,
          walletAddress: resolvedWallet,
          avaxBalance:
            onChainBal.avaxBalance ||
            userProfile.avaxBalance ||
            fallbackUser?.avaxBalance ||
            '1000.00',
          usdcBalance:
            onChainBal.usdcBalance ||
            userProfile.usdcBalance ||
            fallbackUser?.usdcBalance ||
            '10000.00',
          usdcAllowance: userProfile.usdcAllowance || '1000.00',
          stats: userProfile.stats,
          isTeam1Verified: true,
        }
      : {
          ...fallbackUser,
          ...(onChainBal.avaxBalance ? { avaxBalance: onChainBal.avaxBalance } : {}),
          ...(onChainBal.usdcBalance ? { usdcBalance: onChainBal.usdcBalance } : {}),
        };

    const userWallet = (mappedActiveUser.walletAddress || '').toLowerCase();
    const mergedUsers = [
      mappedActiveUser,
      ...mockFallback.users.filter(
        (u) => (u.walletAddress || '').toLowerCase() !== userWallet,
      ),
    ];

    if (circlesRes && Array.isArray(circlesRes.items) && circlesRes.items.length > 0) {
      return {
        currentUserId: mappedActiveUser.id,
        users: mergedUsers.map((u) => ({
          ...u,
          isTeam1Verified: u.isTeam1Verified ?? true,
        })),
        circles: circlesRes.items.map((c, idx) => ({
          ...c,
          isSealedBid: c.isSealedBid ?? c.allocationMode === 'BIDDING',
          enableYieldVault: c.enableYieldVault ?? true,
          yieldApyBps: c.yieldApyBps ?? 650,
          accruedYieldFormatted:
            c.accruedYieldFormatted ?? ((idx + 1) * 3.25).toFixed(2),
          inviteCode: c.inviteCode || `AVAHUI-${c.id.slice(-4).toUpperCase()}`,
          requireTeam1Attestation: c.requireTeam1Attestation ?? true,
        })),
        transactions:
          transactions && transactions.length > 0
            ? transactions
            : mockFallback.transactions,
        notifications:
          notifications && notifications.length > 0
            ? notifications
            : mockFallback.notifications,
      };
    }

    return {
      ...mockFallback,
      users: mergedUsers,
      currentUserId: mappedActiveUser.id,
    };
  } catch (err) {
    console.warn('[AvaHui] Failed to fetch live backend state, using mock fallback:', err);
    return loadMockState();
  }
}

export function useAvaHuiState() {
  return useQuery<AvaHuiMockState>({
    queryKey: AVAHUI_QUERY_KEYS.mockState,
    queryFn: () => fetchRealOrMockState(),
    refetchInterval: isMockMode ? false : 3000,
    staleTime: isMockMode ? Infinity : 1500,
  });
}

function invalidateAllCircleQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
  queryClient.invalidateQueries({ queryKey: ['avahui'] });
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
        return { state: loadMockState(), txHash: '' };
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
        return { state: loadMockState(), newCircle: undefined, txHash: '' };
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
    mutationFn: async () => {
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
        return { state: loadMockState(), txHash: '', activated: false };
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
        return { state: loadMockState(), txHash: '' };
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
        return { state: loadMockState(), txHash: '' };
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
          state: loadMockState(),
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
        return { state: loadMockState(), txHash: '', totalReturnedFormatted: '0.00' };
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

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      if (!isMockMode) {
        try {
          await authApi.updateMe({ displayName });
        } catch (e) {
          console.warn('[AvaHui] authApi.updateMe error:', e);
        }
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
        return { state: loadMockState(), txHash: '' };
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
        return { state: loadMockState(), txHash: '' };
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
      const state = loadMockState();
      const user =
        state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const usdcReceived = Math.round(avaxAmount * 5000);

      if (!isMockMode && user?.walletAddress) {
        const signer = await resolveSignerClient(user.walletAddress);
        if (signer) {
          try {
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
            if (balances.usdcBalance) user.usdcBalance = balances.usdcBalance;
            if (balances.avaxBalance) user.avaxBalance = balances.avaxBalance;
            return { state: saveMockState(state), txHash, usdcReceived };
          } catch (e) {
            console.warn('[AvaHui] On-chain swap mint fallback:', e);
          }
        }
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
      const state = loadMockState();
      const user =
        state.users.find((u) => u.id === state.currentUserId) || state.users[0];
      const nullifier = (user?.identityNullifier ||
        `0x9999${(user?.walletAddress || '0'.repeat(42)).slice(2).toLowerCase().padEnd(60, 'a')}`) as `0x${string}`;

      if (!isMockMode && user?.walletAddress) {
        const signer = await resolveSignerClient(user.walletAddress);
        if (signer) {
          try {
            const txHash = await signer.client.writeContract({
              address: frontendEnv.sybilVerifierAddress,
              abi: TEAM1_VERIFIER_ABI,
              functionName: 'issueAttestation',
              args: [signer.account, nullifier, 2],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash });
            await transactionApi
              .trackTransaction({
                txHash,
                txType: TransactionType.VERIFY_ATTESTATION,
                contractAddress: frontendEnv.sybilVerifierAddress,
                senderAddress: signer.account,
              })
              .catch(() => {});
            user.isTeam1Verified = true;
            user.identityNullifier = nullifier;
            return { state: saveMockState(state), txHash, nullifier };
          } catch (e) {
            console.warn('[AvaHui] On-chain issueAttestation fallback:', e);
          }
        }
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
        try {
          await authApi.syncUser({ walletAddress: address }, address);
        } catch {
          // ignore
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
