import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortenAddress(address?: string | null, chars = 4): string {
  if (!address) return '';
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

export function formatUsdc(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function generateMockTxHash(): string {
  const hexChars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 64; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

export function generateMockAddress(): string {
  const hexChars = '0123456789abcdef';
  let result = '0x';
  for (let i = 0; i < 40; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

const INVITE_STORAGE_PREFIX = 'avahui_creator_invite_';

/** Persists creator's plaintext private invite code locally under one or more circle keys. */
export function saveCreatorInviteCode(
  circleKeys: Array<string | null | undefined>,
  inviteCode?: string | null,
): void {
  if (typeof window === 'undefined' || !inviteCode?.trim()) return;
  const trimmed = inviteCode.trim();
  for (const key of circleKeys) {
    if (key) {
      window.localStorage.setItem(
        `${INVITE_STORAGE_PREFIX}${key.toLowerCase()}`,
        trimmed,
      );
    }
  }
}

/** Reads creator's locally saved invite code by circle id, metadataId, or contractAddress. */
export function getSavedCreatorInviteCode(
  ...circleKeys: Array<string | null | undefined>
): string | undefined {
  if (typeof window === 'undefined') return undefined;
  for (const key of circleKeys) {
    if (!key) continue;
    const saved = window.localStorage.getItem(
      `${INVITE_STORAGE_PREFIX}${key.toLowerCase()}`,
    );
    if (saved) return saved;
  }
  return undefined;
}

/**
 * Computes withdrawable collateral, discount pool share, and ERC-4626 yield share
 * matching `AvaHuiCircle.withdrawCollateral()`.
 */
export function computeWithdrawBreakdown(
  circle: {
    status?: string;
    maxMembers: number;
    totalDiscountPoolFormatted?: string;
    accruedYieldFormatted?: string;
  },
  member: {
    lockedCollateralFormatted?: string;
  },
) {
  const collateralUsdc = parseFloat(member.lockedCollateralFormatted || '0') || 0;
  const membersCount = Math.max(1, circle.maxMembers || 1);
  const isCompleted = circle.status === 'COMPLETED';
  const discountBonusUsdc = isCompleted
    ? (parseFloat(circle.totalDiscountPoolFormatted || '0') || 0) / membersCount
    : 0;
  const yieldBonusUsdc = isCompleted
    ? (parseFloat(circle.accruedYieldFormatted || '0') || 0) / membersCount
    : 0;

  return {
    collateralUsdc,
    discountBonusUsdc,
    yieldBonusUsdc,
    totalClaimableUsdc: collateralUsdc + discountBonusUsdc + yieldBonusUsdc,
  };
}
