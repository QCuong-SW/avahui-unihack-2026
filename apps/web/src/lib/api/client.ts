/**
 * AvaHui API Client — HTTP Layer for NestJS Backend
 * Sends verified Bearer tokens (Privy JWT or SIWE JWT) without silent mock spoofing.
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
};

export const AUTH_TOKEN_STORAGE_KEY = 'avahui_auth_token';
export const ACTIVE_WALLET_STORAGE_KEY = 'avahui_active_wallet';

export class ApiError extends Error {
  constructor(
    public status: number,
    public message: string,
    public data?: any,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface RequestOptions extends RequestInit {
  walletAddress?: string;
  token?: string;
  params?: Record<string, string | number | boolean | undefined>;
}

function resolveStoredAuthToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const directToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  if (directToken && directToken !== 'mock-token') {
    return directToken;
  }
  try {
    const rawSession = window.localStorage.getItem(
      'avahui_unihack_2026_auth_session_v2',
    );
    if (rawSession) {
      const parsed = JSON.parse(rawSession);
      if (
        parsed?.isAuthenticated &&
        typeof parsed.accessToken === 'string' &&
        parsed.accessToken.split('.').length === 3
      ) {
        return parsed.accessToken;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  return undefined;
}

function resolveStoredWalletAddress(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const direct = window.localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY);
  if (direct) return direct;
  try {
    const storedState = window.localStorage.getItem(
      'avahui_unihack_2026_mock_state_v2',
    );
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      const curUser = parsedState?.users?.find(
        (u: any) => u.id === parsedState.currentUserId,
      );
      if (curUser?.walletAddress) {
        return curUser.walletAddress;
      }
    }
  } catch {
    // ignore storage parse failure
  }
  return undefined;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const {
    walletAddress,
    token,
    params,
    headers: customHeaders,
    ...fetchOptions
  } = options;

  let url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const authToken = token || resolveStoredAuthToken();
  const activeWallet = walletAddress || resolveStoredWalletAddress();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  if (activeWallet) {
    headers['x-wallet-address'] = activeWallet;
  }

  const response = await fetch(url, {
    ...fetchOptions,
    headers,
  });

  if (!response.ok) {
    let errorData: any;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const errorMsg =
      errorData?.message ||
      errorData?.error ||
      `HTTP ${response.status} Error calling ${endpoint}`;
    throw new ApiError(
      response.status,
      Array.isArray(errorMsg) ? errorMsg.join(', ') : String(errorMsg),
      errorData,
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json() as Promise<T>;
}
