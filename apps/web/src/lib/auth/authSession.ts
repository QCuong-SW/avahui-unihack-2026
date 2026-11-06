'use client';

// ============================================================================
// @avahui/web — Authentication & Session Management (Privy-compatible flow)
// Distinguishes Authentication state from Embedded Wallet state
// ============================================================================

export type AuthMethod = 'GOOGLE' | 'EMAIL_OTP' | 'EXTERNAL_WALLET';

export type WalletConnectionState =
  | 'WALLET_CREATED'
  | 'WALLET_CONNECTED_READY'
  | 'WALLET_DISCONNECTED';

export interface AuthSessionState {
  isAuthenticated: boolean;
  userId: string;
  email: string;
  authMethod: AuthMethod | null;
  accessToken: string | null;
  /** Tracks which user IDs have already completed /onboarding/wallet */
  onboardedUserIds: string[];
  /** Independent wallet connection status (never conflated with auth status) */
  walletStatus: WalletConnectionState;
  /** Pending OTP verification state for /login/verify */
  pendingOtp: {
    email: string;
    targetUserId: string;
    code: string;
    expiresAt: number;
    resendAvailableAt: number;
  } | null;
}

const AUTH_STORAGE_KEY = 'avahui_unihack_2026_auth_session_v1';
const AUTH_COOKIE_NAME = 'avahui_auth_token';

const DEFAULT_AUTH_SESSION: AuthSessionState = {
  isAuthenticated: true,
  userId: 'usr_01',
  email: 'minh.nguyen@avahui.io',
  authMethod: 'GOOGLE',
  accessToken: 'prv_mock_jwt_usr_01',
  onboardedUserIds: ['usr_01', 'usr_02', 'usr_03', 'usr_04', 'usr_05'],
  walletStatus: 'WALLET_CONNECTED_READY',
  pendingOtp: null,
};

function setSessionCookie(token: string | null) {
  if (typeof document === 'undefined') return;
  if (token) {
    document.cookie = `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=86400; SameSite=Lax`;
  } else {
    document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export function loadAuthSession(): AuthSessionState {
  if (typeof window === 'undefined') {
    return DEFAULT_AUTH_SESSION;
  }
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(
        AUTH_STORAGE_KEY,
        JSON.stringify(DEFAULT_AUTH_SESSION)
      );
      setSessionCookie(DEFAULT_AUTH_SESSION.accessToken);
      return DEFAULT_AUTH_SESSION;
    }
    const parsed = JSON.parse(raw) as AuthSessionState;
    return {
      ...DEFAULT_AUTH_SESSION,
      ...parsed,
    };
  } catch {
    return DEFAULT_AUTH_SESSION;
  }
}

export function saveAuthSession(session: AuthSessionState): AuthSessionState {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    setSessionCookie(session.isAuthenticated ? session.accessToken : null);
  }
  return session;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Step 1 of Email OTP flow: validates email, generates 6-digit OTP with 5-minute expiry
 * and 60-second resend cooldown.
 */
export function requestEmailOtp(
  email: string,
  targetUserId: string
): AuthSessionState {
  const normalized = email.trim().toLowerCase();
  if (!isValidEmail(normalized)) {
    throw new Error('INVALID_EMAIL');
  }

  const current = loadAuthSession();
  const now = Date.now();

  const updated: AuthSessionState = {
    ...current,
    pendingOtp: {
      email: normalized,
      targetUserId,
      code: '123456',
      expiresAt: now + 5 * 60 * 1000,
      resendAvailableAt: now + 60 * 1000,
    },
  };

  return saveAuthSession(updated);
}

/**
 * Step 2 of Email OTP flow: verifies 6-digit OTP code.
 * Accepts '123456' (or any 6 digits except '000000' which simulates invalid OTP).
 */
export function verifyEmailOtpCode(inputCode: string): {
  session: AuthSessionState;
  requiresWalletOnboarding: boolean;
} {
  const current = loadAuthSession();
  if (!current.pendingOtp) {
    throw new Error('OTP_SESSION_MISSING');
  }

  const cleanCode = inputCode.trim();
  if (!/^\d{6}$/.test(cleanCode) || cleanCode === '000000') {
    throw new Error('INVALID_OTP');
  }

  if (Date.now() > current.pendingOtp.expiresAt) {
    throw new Error('OTP_EXPIRED');
  }

  const { email, targetUserId } = current.pendingOtp;
  const alreadyOnboarded = current.onboardedUserIds.includes(targetUserId);

  const nextSession: AuthSessionState = {
    ...current,
    isAuthenticated: true,
    userId: targetUserId,
    email,
    authMethod: 'EMAIL_OTP',
    accessToken: `prv_jwt_${targetUserId}_${Date.now()}`,
    walletStatus: alreadyOnboarded
      ? 'WALLET_CONNECTED_READY'
      : 'WALLET_CREATED',
    pendingOtp: null,
  };

  return {
    session: saveAuthSession(nextSession),
    requiresWalletOnboarding: !alreadyOnboarded,
  };
}

/**
 * Google / External Wallet login: verifies existing wallet mapping first.
 */
export function authenticateWithProvider(
  method: 'GOOGLE' | 'EXTERNAL_WALLET',
  userId: string,
  email: string,
  forceWalletOnboarding = false
): {
  session: AuthSessionState;
  requiresWalletOnboarding: boolean;
} {
  const current = loadAuthSession();
  const onboardedList = forceWalletOnboarding
    ? current.onboardedUserIds.filter((id) => id !== userId)
    : current.onboardedUserIds;
  const alreadyOnboarded = onboardedList.includes(userId);

  const nextSession: AuthSessionState = {
    ...current,
    isAuthenticated: true,
    userId,
    email,
    authMethod: method,
    accessToken: `prv_jwt_${method.toLowerCase()}_${userId}_${Date.now()}`,
    onboardedUserIds: onboardedList,
    walletStatus: alreadyOnboarded
      ? 'WALLET_CONNECTED_READY'
      : 'WALLET_CREATED',
    pendingOtp: null,
  };

  return {
    session: saveAuthSession(nextSession),
    requiresWalletOnboarding: !alreadyOnboarded,
  };
}

/**
 * Completes Screen 03 (/onboarding/wallet) without duplicating existing wallet.
 */
export function completeWalletOnboarding(): AuthSessionState {
  const current = loadAuthSession();
  const onboardedUserIds = Array.from(
    new Set([...current.onboardedUserIds, current.userId])
  );

  const updated: AuthSessionState = {
    ...current,
    onboardedUserIds,
    walletStatus: 'WALLET_CONNECTED_READY',
  };

  return saveAuthSession(updated);
}

/**
 * Updates independent wallet status (Created / Connected Ready / Disconnected).
 */
export function updateWalletConnectionState(
  walletStatus: WalletConnectionState
): AuthSessionState {
  const current = loadAuthSession();
  return saveAuthSession({
    ...current,
    walletStatus,
  });
}

/**
 * Screen 05 Logout:
 * - Clears authentication session & access token cookie
 * - Preserves `onboardedUserIds` so the user's Embedded Wallet is NEVER deleted
 */
export function logoutAuthSession(): AuthSessionState {
  const current = loadAuthSession();
  const loggedOut: AuthSessionState = {
    isAuthenticated: false,
    userId: current.userId,
    email: '',
    authMethod: null,
    accessToken: null,
    onboardedUserIds: current.onboardedUserIds,
    walletStatus: 'WALLET_CREATED',
    pendingOtp: null,
  };
  return saveAuthSession(loggedOut);
}
