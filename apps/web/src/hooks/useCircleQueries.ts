'use client';

import { useQuery } from '@tanstack/react-query';
import { circleApi, ListCirclesQuery, transactionApi, notificationApi } from '@/lib/api';
import { useAvaHuiState } from './useAvaHuiMockQuery';
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
        if (liveCircle) return liveCircle;
      } catch (err) {
        console.warn(`[AvaHui] Failed to fetch circle ${idOrAddress} from API:`, err);
      }

      // Fallback to mock state
      const found = mockState?.circles.find(
        (c) =>
          c.id === idOrAddress ||
          c.metadataId === idOrAddress ||
          (Boolean(c.contractAddress) &&
            c.contractAddress?.toLowerCase() === idOrAddress.toLowerCase()),
      );
      return found || null;
    },
    refetchInterval: (query) => {
      if (isMockMode) return false;
      const data = query.state.data;
      if (!data) return 3000;
      // If recruiting or active, refresh every 4 seconds to sync round & member status
      if (data.status === 'RECRUITING' || data.status === 'ACTIVE') {
        return 4000;
      }
      return false;
    },
    staleTime: isMockMode ? Infinity : 2000,
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
        console.warn('[AvaHui] Failed to list circles from API, fallback to mock:', err);
      }

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
    },
    refetchInterval: isMockMode ? false : 5000,
    staleTime: isMockMode ? Infinity : 3000,
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
      if (!isMockMode) {
        try {
          const res = await transactionApi.getMyTransactions(circleId);
          if (res && res.length > 0) return res;
        } catch (e) {
          console.warn('[AvaHui] Failed to get transactions from API:', e);
        }
      }
      return circleId
        ? (mockState?.transactions || []).filter((t) => t.circleId === circleId)
        : mockState?.transactions || [];
    },
    staleTime: isMockMode ? Infinity : 3000,
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
      if (!isMockMode) {
        try {
          const res = await notificationApi.getMyNotifications();
          if (res && res.length > 0) return res;
        } catch (e) {
          console.warn('[AvaHui] Failed to get notifications from API:', e);
        }
      }
      return mockState?.notifications || [];
    },
    staleTime: isMockMode ? Infinity : 4000,
  });
}
