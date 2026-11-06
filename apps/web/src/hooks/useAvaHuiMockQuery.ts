'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AvaHuiMockState,
  loadMockState,
  markAllNotificationsRead,
  mockContributeRound,
  mockCreateCircle,
  mockFaucetMint,
  mockJoinCircle,
  mockSettleRound,
  mockSubmitBid,
  mockUpdateUserProfile,
  mockWithdrawCollateral,
  resetMockState,
  switchMockUser,
} from '@/stores/avahuiMockEngine';
import { CreateCircleFormInput } from '@avahui/shared';

export const AVAHUI_QUERY_KEYS = {
  mockState: ['avahui', 'mock-state'] as const,
};

export function useAvaHuiState() {
  return useQuery<AvaHuiMockState>({
    queryKey: AVAHUI_QUERY_KEYS.mockState,
    queryFn: () => loadMockState(),
    staleTime: Infinity,
  });
}

export function useSwitchDemoUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (userId: string) => {
      return switchMockUser(userId);
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
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
    },
  });
}

export function useCreateCircleMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCircleFormInput) => {
      await new Promise((r) => setTimeout(r, 700));
      return mockCreateCircle(input);
    },
    onSuccess: ({ state }) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, state);
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
    },
  });
}

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      return mockUpdateUserProfile(displayName);
    },
    onSuccess: (newState) => {
      queryClient.setQueryData(AVAHUI_QUERY_KEYS.mockState, newState);
    },
  });
}
