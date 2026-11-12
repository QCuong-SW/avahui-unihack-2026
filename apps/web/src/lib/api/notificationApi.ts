import { apiFetch } from './client';
import type { NotificationItemDto } from '@avahui/shared';

export const notificationApi = {
  getMyNotifications: async (walletAddress?: string): Promise<NotificationItemDto[]> => {
    const res = await apiFetch<
      NotificationItemDto[] | { unreadCount?: number; items?: NotificationItemDto[] }
    >('/notifications', {
      method: 'GET',
      walletAddress,
    });
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.items)) return res.items;
    return [];
  },

  markAsRead: async (id: string, walletAddress?: string): Promise<NotificationItemDto> => {
    return apiFetch<NotificationItemDto>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      walletAddress,
    });
  },

  markAllAsRead: async (walletAddress?: string): Promise<{ updatedCount: number }> => {
    return apiFetch<{ updatedCount: number }>('/notifications/read-all', {
      method: 'PATCH',
      walletAddress,
    });
  },
};
