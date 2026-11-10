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
  switchMockUser,
} from '@/stores/avahuiMockEngine';
import { CreateCircleFormInput } from '@avahui/shared';
import { parseUnits } from 'viem';
import {
  authApi,
  circleApi,
  transactionApi,
  notificationApi,
} from '@/lib/api';

export const AVAHUI_QUERY_KEYS = {
  mockState: ['avahui', 'app-state'] as const,
};

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

async function fetchRealOrMockState(): Promise<AvaHuiMockState> {
  if (isMockMode) {
    return loadMockState();
  }

  try {
    const [userProfile, circlesRes, transactions, notifications] = await Promise.all([
      authApi.getMe().catch((err) => {
        console.warn('[AvaHui] authApi.getMe fallback to mock:', err?.message);
        return null;
      }),
      circleApi.listCircles({ limit: 50 }).catch((err) => {
        console.warn('[AvaHui] circleApi.listCircles fallback to mock:', err?.message);
        return null;
      }),
      transactionApi.getMyTransactions().catch(() => []),
      notificationApi.getMyNotifications().catch(() => []),
    ]);

    const mockFallback = loadMockState();

    if (circlesRes && Array.isArray(circlesRes.items) && circlesRes.items.length > 0) {
      const mappedActiveUser = userProfile ? {
        id: userProfile.id,
        email: userProfile.email || 'builder@avahui.io',
        displayName: userProfile.displayName || 'UniHack Builder',
        avatarUrl: userProfile.avatarUrl || undefined,
        walletAddress: userProfile.walletAddress || '0x71c95911e9a5d330f4d621842ec243ee13432921',
        avaxBalance: userProfile.avaxBalance || '0.5 AVAX',
        usdcBalance: userProfile.usdcBalance || '1,000.00 mUSDC',
        usdcAllowance: userProfile.usdcAllowance || '1,000.00 mUSDC',
        stats: userProfile.stats,
      } : (mockFallback.users.find(u => u.id === mockFallback.currentUserId) || mockFallback.users[0]);

      const userWallet = (mappedActiveUser.walletAddress || '').toLowerCase();
      const mergedUsers = userProfile
        ? [mappedActiveUser, ...mockFallback.users.filter(u => (u.walletAddress || '').toLowerCase() !== userWallet)]
        : mockFallback.users;

      return {
        currentUserId: mappedActiveUser.id,
        users: mergedUsers.map((u) => ({
          ...u,
          isTeam1Verified: u.isTeam1Verified ?? true,
        })),
        circles: circlesRes.items.map((c, idx) => ({
          ...c,
          isSealedBid: c.isSealedBid ?? (c.allocationMode === 'BIDDING'),
          enableYieldVault: c.enableYieldVault ?? true,
          yieldApyBps: c.yieldApyBps ?? 650,
          accruedYieldFormatted: c.accruedYieldFormatted ?? ((idx + 1) * 3.25).toFixed(2),
          inviteCode: c.inviteCode || `AVAHUI-${c.id.slice(-4).toUpperCase()}`,
          requireTeam1Attestation: c.requireTeam1Attestation ?? true,
        })),
        transactions: transactions && transactions.length > 0 ? transactions : mockFallback.transactions,
        notifications: notifications && notifications.length > 0 ? notifications : mockFallback.notifications,
      };
    }

    return mockFallback;
  } catch (err) {
    console.warn('[AvaHui] Failed to fetch live backend state, using mock fallback:', err);
    return loadMockState();
  }
}

export function useAvaHuiState() {
  return useQuery<AvaHuiMockState>({
    queryKey: AVAHUI_QUERY_KEYS.mockState,
    queryFn: () => fetchRealOrMockState(),
    refetchInterval: isMockMode ? false : 4000,
    staleTime: isMockMode ? Infinity : 2000,
  });
}

export function useSwitchDemoUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      const state = switchMockUser(userId);
      // In live mode, sync selected user's wallet to backend
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
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useFaucetMint() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (amountUsdc?: number) => {
      await new Promise((r) => setTimeout(r, 600));
      return mockFaucetMint(amountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useCreateCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCircleFormInput) => {
      // 1. If live mode, save draft to NestJS Backend & PostgreSQL
      if (!isMockMode) {
        try {
          const contributionAmount = input.contributionAmountUsdc;
          const collateralAmount = input.contributionAmountUsdc * (input.collateralMultiplier || 1);
          const contributionBaseUnits = parseUnits(String(contributionAmount), 6).toString();
          const collateralBaseUnits = parseUnits(String(collateralAmount), 6).toString();
          const minBidBaseUnits = input.minBidUsdc ? parseUnits(String(input.minBidUsdc), 6).toString() : '0';
          const maxBidBaseUnits = input.maxBidUsdc ? parseUnits(String(input.maxBidUsdc), 6).toString() : '0';

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

      await new Promise((r) => setTimeout(r, 700));
      return mockCreateCircle(input);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useJoinCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (circleId: string) => {
      await new Promise((r) => setTimeout(r, 600));
      return mockJoinCircle(circleId);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useContributeRoundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
    }: {
      circleId: string;
      roundNumber: number;
    }) => {
      await new Promise((r) => setTimeout(r, 600));
      return mockContributeRound(circleId, roundNumber);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
    }: {
      circleId: string;
      roundNumber: number;
      bidAmountUsdc: number;
    }) => {
      await new Promise((r) => setTimeout(r, 600));
      return mockSubmitBid(circleId, roundNumber, bidAmountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useSettleRoundMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      circleId,
      roundNumber,
    }: {
      circleId: string;
      roundNumber: number;
    }) => {
      await new Promise((r) => setTimeout(r, 700));
      return mockSettleRound(circleId, roundNumber);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useWithdrawCollateralMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (circleId: string) => {
      await new Promise((r) => setTimeout(r, 600));
      return mockWithdrawCollateral(circleId);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
    }: {
      circleId: string;
      roundNumber: number;
      commitment: string;
    }) => {
      await new Promise((r) => setTimeout(r, 400));
      return mockCommitBid(circleId, roundNumber, commitment);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
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
    }: {
      circleId: string;
      roundNumber: number;
      bidAmountUsdc: number;
    }) => {
      await new Promise((r) => setTimeout(r, 400));
      return mockRevealBid(circleId, roundNumber, bidAmountUsdc);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useSwapAvaxToUsdcMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (avaxAmount: number = 0.05) => {
      await new Promise((r) => setTimeout(r, 500));
      return mockSwapAvaxToUsdc(avaxAmount);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useVerifyTeam1AttestationMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await new Promise((r) => setTimeout(r, 500));
      return mockVerifyTeam1Attestation();
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}

export function useConnectBrowserWalletMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error(
          'Không tìm thấy ví trình duyệt (Core Wallet / MetaMask). Vui lòng cài đặt tiện ích mở rộng trước!'
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

      // Auto-switch or add Avalanche Fuji Testnet (43113 / 0xa869)
      try {
        await eth.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0xa869' }],
        });
      } catch (switchErr: any) {
        if (switchErr?.code === 4902) {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: '0xa869',
                chainName: 'Avalanche Fuji Testnet',
                nativeCurrency: {
                  name: 'Avalanche',
                  symbol: 'AVAX',
                  decimals: 18,
                },
                rpcUrls: ['https://api.avax-test.network/ext/bc/C/rpc'],
                blockExplorerUrls: ['https://testnet.snowtrace.io/'],
              },
            ],
          });
        }
      }

      // Query native AVAX balance on Fuji
      let avaxFormatted: string | undefined = undefined;
      try {
        const hexBal: string = await eth.request({
          method: 'eth_getBalance',
          params: [address, 'latest'],
        });
        const wei = BigInt(hexBal);
        avaxFormatted = (Number(wei) / 1e18).toFixed(3);
      } catch {
        // ignore
      }

      const newState = mockBindRealWallet(address, avaxFormatted);

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
      queryClient.invalidateQueries({ queryKey: AVAHUI_QUERY_KEYS.mockState });
    },
  });
}


