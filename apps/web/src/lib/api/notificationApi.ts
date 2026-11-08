import { apiFetch } from './client';
import type { NotificationItemDto } from '@avahui/shared';

export const notificationApi = {
  getMyNotifications: async (walletAddress?: string): Promise<NotificationItemDto[]> => {
    return apiFetch<NotificationItemDto[]>('/notifications', {
      method: 'GET',
      walletAddress,
    });
  },

  markAsRead: async (id: string, walletAddress?: string): Promise<NotificationItemDto> => {
    return apiFetch<NotificationItemDto>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PATCH',
      walletAddress,
    });
  },
};
