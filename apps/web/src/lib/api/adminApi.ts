import { apiFetch } from './client';
import { UserRole } from '@avahui/shared';

export interface AdminOverviewResponse {
  users: {
    total: number;
    suspended: number;
    admins: number;
    verifiers: number;
    team1Verified: number;
  };
  circles: {
    total: number;
    recruiting: number;
    active: number;
    completed: number;
    cancelled: number;
    privateCircles: number;
    hiddenCircles: number;
  };
  blockchain: {
    totalTransactions: number;
    totalIndexedEvents: number;
    chainId: number;
    indexerEnabled: boolean;
    keeperEnabled: boolean;
    keeperConfigured: boolean;
    privyConfigured: boolean;
  };
}

export interface AdminUserItem {
  id: string;
  privyDid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
  isActive: boolean;
  team1Verified: boolean;
  identityNullifier: string | null;
  trustTier: number;
  wallets: Array<{
    id: string;
    address: string;
    walletClientType: string;
    isPrimary: boolean;
  }>;
  createdAt: string;
}

export interface AdminCircleItem {
  id: string;
  metadataId: string;
  contractAddress: string | null;
  name: string;
  creatorAddress: string;
  allocationMode: string;
  status: string;
  maxMembers: number;
  currentMemberCount: number;
  contributionAmountFormatted: string;
  collateralAmountFormatted: string;
  isPrivateInvite: boolean;
  requireTeam1Attestation: boolean;
  isPaused?: boolean;
  isHiddenByAdmin: boolean;
  moderationReason: string | null;
  createdAt: string;
}

export const adminApi = {
  getOverview: () =>
    apiFetch<AdminOverviewResponse>('/admin/overview', { method: 'GET' }),

  listUsers: (params?: { role?: UserRole; search?: string; page?: number; limit?: number }) =>
    apiFetch<{ items: AdminUserItem[]; meta: { total: number; page: number; totalPages: number } }>(
      '/admin/users',
      { method: 'GET', params },
    ),

  updateUserRole: (userId: string, role: UserRole) =>
    apiFetch<AdminUserItem>(`/admin/users/${encodeURIComponent(userId)}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  updateUserStatus: (userId: string, isActive: boolean) =>
    apiFetch<AdminUserItem>(`/admin/users/${encodeURIComponent(userId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    }),

  listCircles: (params?: { page?: number; limit?: number }) =>
    apiFetch<{ items: AdminCircleItem[]; meta: { total: number; page: number; totalPages: number } }>(
      '/admin/circles',
      { method: 'GET', params },
    ),

  moderateCircle: (
    circleId: string,
    payload: { isHiddenByAdmin: boolean; moderationReason?: string },
  ) =>
    apiFetch<AdminCircleItem>(`/admin/circles/${encodeURIComponent(circleId)}/moderation`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
};

