/**
 * AvaHui API Client — HTTP Layer for NestJS Backend
 * Sends verified Bearer tokens (Privy JWT or SIWE JWT) with automatic
 * cold-start wakeup retries for Render / cloud deployments.
 */

export const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
};

export const RENDER_PRODUCTION_HEALTH_URL =
  'https://avahui-api.onrender.com/api/v1/health';

export const AUTH_TOKEN_STORAGE_KEY = 'avahui_auth_token';
export const ACTIVE_WALLET_STORAGE_KEY = 'avahui_active_wallet';
export const BACKEND_AWAKE_EVENT = 'avahui:backend-awake';

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
  timeoutMs?: number;
  retries?: number;
}

/**
 * Pings the configured backend /health endpoint (and Render production URL in parallel)
 * to wake up sleeping instances and keep Neon PostgreSQL connection pools warm.
 */
export async function wakeUpBackendServer(timeoutMs = 12_000): Promise<boolean> {
  const baseUrl = getApiBaseUrl().replace(/\/+$/, '');
  const primaryHealthUrl = `${baseUrl}/health`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  // Also ping Render cloud URL in background if primary is localhost
  if (!primaryHealthUrl.includes('avahui-api.onrender.com')) {
    fetch(RENDER_PRODUCTION_HEALTH_URL, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
    }).catch(() => {});
  }

  try {
    const res = await fetch(primaryHealthUrl, {
      method: 'GET',
      mode: 'cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (res.ok) {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(BACKEND_AWAKE_EVENT));
      }
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
    retries,
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

  const method = (fetchOptions.method || 'GET').toUpperCase();
  const maxRetries = retries ?? (method === 'GET' ? 2 : 1);
  // Generous 65s timeout to allow Render/Cloud free-tier cold starts to complete
  const timeoutMs = options.timeoutMs ?? 65_000;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    const signal = options.signal || controller.signal;

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers,
        signal,
      });

      // Retry automatically if Render edge returns 502/503/504 while container is booting
      if (
        (response.status === 502 ||
          response.status === 503 ||
          response.status === 504) &&
        attempt < maxRetries
      ) {
        await sleep(2500 * (attempt + 1));
        continue;
      }

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

      return (await response.json()) as T;
    } catch (fetchErr: any) {
      lastError = fetchErr;
      if (fetchErr instanceof ApiError) {
        throw fetchErr;
      }
      if (attempt < maxRetries) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      if (fetchErr?.name === 'AbortError') {
        throw new ApiError(
          408,
          'Yêu cầu tới máy chủ quá thời gian chờ (timeout). Máy chủ đang khởi động lại, vui lòng thử lại ngay.',
        );
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw lastError;
}
