/**
 * AvaHui API Client — HTTP Layer for NestJS Backend
 * Handles automatic JWT/Mock Auth injection, wallet address header, and error handling.
 */

const getApiBaseUrl = (): string => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1';
};

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

export async function apiFetch<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const { walletAddress, token, params, headers: customHeaders, ...fetchOptions } = options;

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

  // Auth header resolution
  let authToken = token;
  if (!authToken && typeof window !== 'undefined') {
    authToken = localStorage.getItem('avahui_auth_token') || 'mock-token';
  }

  // Active wallet address resolution
  let activeWallet = walletAddress;
  if (!activeWallet && typeof window !== 'undefined') {
    try {
      const storedSession = localStorage.getItem('avahui_session');
      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        activeWallet = parsed?.user?.walletAddress || parsed?.walletAddress;
      }
    } catch {
      // ignore JSON parse error
    }
    if (!activeWallet) {
      // Default to demo builder wallet if none found
      activeWallet = '0x71c95911e9a5d330f4d621842ec243ee13432921';
    }
  }

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
      errorData = { message: response.statusText };
    }
    const message =
      errorData?.message || `Request failed with status ${response.status}`;
    throw new ApiError(response.status, Array.isArray(message) ? message.join(', ') : message, errorData);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
