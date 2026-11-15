'use client';

import { useQuery } from '@tanstack/react-query';
import {
  AUTH_TOKEN_STORAGE_KEY,
  circleApi,
  ListCirclesQuery,
  transactionApi,
  notificationApi,
} from '@/lib/api';
import { useAvaHuiState } from './useAvaHuiMockQuery';
import { getSavedCreatorInviteCode } from '@/lib/utils';
import type { CircleDetailDto, TransactionRecordDto, NotificationItemDto } from '@avahui/shared';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export const CIRCLE_QUERY_KEYS = {
  detail: (id: string) => ['avahui', 'circle', id] as const,
  list: (query?: ListCirclesQuery) => ['avahui', 'circles', query] as const,
  myTransactions: (circleId?: string) => ['avahui', 'transactions', circleId] as const,
  notifications: ['avahui', 'notifications'] as const,
};

/**
 * Dedicated query hook for fetching a single Circle detail (by UUID, metadataId, or contractAddress)
 * Supports live polling when circle is in DRAFT or RECRUITING status to capture Indexer events.
 */
export function useCircleDetailQuery(idOrAddress: string) {
  const { data: mockState } = useAvaHuiState();

  return useQuery<CircleDetailDto | null>({
    queryKey: CIRCLE_QUERY_KEYS.detail(idOrAddress),
    queryFn: async () => {
      if (isMockMode) {
        const found = mockState?.circles.find(
          (c) =>
            c.id === idOrAddress ||
            c.metadataId === idOrAddress ||
            (Boolean(c.contractAddress) &&
              c.contractAddress?.toLowerCase() === idOrAddress.toLowerCase()),
        );
        return found || null;
      }

      try {
        const inviteFromUrl =
          typeof window !== 'undefined'
            ? new URLSearchParams(window.location.search).get('invite') || undefined
            : undefined;
        const liveCircle = await circleApi.getCircleById(idOrAddress, inviteFromUrl);
        if (liveCircle) {
          return {
            ...liveCircle,
            inviteCode:
              liveCircle.inviteCode ||
              getSavedCreatorInviteCode(
                liveCircle.id,
                liveCircle.metadataId,
                liveCircle.contractAddress,
              ),
          };
        }
      } catch (err) {
        console.warn(`[AvaHui] Failed to fetch circle ${idOrAddress} from API:`, err);
      }

      return null;
    },
    refetchInterval: (query) => {
      if (isMockMode) return false;
      const data = query.state.data;
      if (!data) return 2000;
      // If recruiting or active, refresh every 2.5 seconds to sync round & member status quickly
      if (data.status === 'RECRUITING' || data.status === 'ACTIVE') {
        return 2500;
      }
      return false;
    },
    refetchIntervalInBackground: false,
    staleTime: isMockMode ? Infinity : 1500,
    enabled: Boolean(idOrAddress),
  });
}

/**
 * Dedicated query hook for Explore Circles view with live API filtering & pagination
 */
export function useExploreCirclesQuery(query?: ListCirclesQuery) {
  const { data: mockState } = useAvaHuiState();

  return useQuery({
    queryKey: CIRCLE_QUERY_KEYS.list(query),
    queryFn: async () => {
      if (isMockMode) {
        let circles = mockState?.circles || [];
        if (query?.status) {
          circles = circles.filter((c) => c.status === query.status);
        }
        if (query?.mode) {
          circles = circles.filter((c) => c.allocationMode === query.mode);
        }
        return {
          items: circles,
          meta: {
            total: circles.length,
            page: query?.page || 1,
            limit: query?.limit || 20,
            totalPages: 1,
          },
        };
      }

      try {
        const res = await circleApi.listCircles(query);
        if (res && res.items) return res;
      } catch (err) {
        console.warn('[AvaHui] Failed to list circles from API:', err);
      }

      return {
        items: [],
        meta: {
          total: 0,
          page: query?.page || 1,
          limit: query?.limit || 20,
          totalPages: 1,
        },
      };
    },
    refetchInterval: isMockMode ? false : 4000,
    refetchIntervalInBackground: false,
    staleTime: isMockMode ? Infinity : 2000,
  });
}

/**
 * Query hook for current user transactions
 */
export function useMyTransactionsQuery(circleId?: string) {
  const { data: mockState } = useAvaHuiState();

  return useQuery<TransactionRecordDto[]>({
    queryKey: CIRCLE_QUERY_KEYS.myTransactions(circleId),
    queryFn: async () => {
      const hasAuthToken =
        typeof window !== 'undefined' &&
        Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
      if (!isMockMode && hasAuthToken) {
        try {
          const res = await transactionApi.getMyTransactions(circleId);
          if (res && res.length > 0) return res;
        } catch (e) {
          console.warn('[AvaHui] Failed to get transactions from API:', e);
        }
      }
      return isMockMode
        ? circleId
          ? (mockState?.transactions || []).filter((t) => t.circleId === circleId)
          : mockState?.transactions || []
        : [];
    },
    refetchInterval: isMockMode ? false : 5000,
    refetchIntervalInBackground: false,
    staleTime: isMockMode ? Infinity : 2000,
  });
}

/**
 * Query hook for user notifications
 */
export function useNotificationsQuery() {
  const { data: mockState } = useAvaHuiState();

  return useQuery<NotificationItemDto[]>({
    queryKey: CIRCLE_QUERY_KEYS.notifications,
    queryFn: async () => {
      const hasAuthToken =
        typeof window !== 'undefined' &&
        Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY));
      if (!isMockMode && hasAuthToken) {
        try {
          const res = await notificationApi.getMyNotifications();
          if (res && res.length > 0) return res;
        } catch (e) {
          console.warn('[AvaHui] Failed to get notifications from API:', e);
        }
      }
      return isMockMode ? mockState?.notifications || [] : [];
    },
    refetchInterval: isMockMode ? false : 5000,
    refetchIntervalInBackground: false,
    staleTime: isMockMode ? Infinity : 2000,
  });
}
