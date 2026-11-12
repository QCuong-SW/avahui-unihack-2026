import { createPublicClient, fallback, http } from 'viem';
import {
  AVALANCHE_FUJI_CHAIN,
  getFujiRpcUrls,
  isLocalRpcUrl,
} from '@avahui/blockchain';

/** Builds a resilient viem transport with PublicNode fallback on Fuji testnet. */
export function createFujiRpcTransport(rpcUrl?: string, timeoutMs = 4000) {
  const urls = getFujiRpcUrls(rpcUrl, !isLocalRpcUrl(rpcUrl));
  if (urls.length <= 1) {
    return http(urls[0] || 'http://127.0.0.1:8545', { timeout: timeoutMs });
  }
  return fallback(urls.map((url) => http(url, { timeout: timeoutMs })));
}

/** Creates a Fuji publicClient tuned for Avalanche 2s block times (`pollingInterval: 1000ms`). */
export function createFujiPublicClient(rpcUrl?: string, timeoutMs = 4000): any {
  return createPublicClient({
    chain: AVALANCHE_FUJI_CHAIN as any,
    pollingInterval: 1_000,
    transport: createFujiRpcTransport(rpcUrl, timeoutMs),
  });
}

