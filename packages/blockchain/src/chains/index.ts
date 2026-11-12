export const PUBLICNODE_FUJI_RPC_URL =
  'https://avalanche-fuji-c-chain-rpc.publicnode.com';
export const OFFICIAL_FUJI_RPC_URL =
  'https://api.avax-test.network/ext/bc/C/rpc';
export const FUJI_FALLBACK_RPC_URLS = [
  PUBLICNODE_FUJI_RPC_URL,
  OFFICIAL_FUJI_RPC_URL,
] as const;

export function isLocalRpcUrl(rpcUrl?: string | null): boolean {
  return Boolean(
    rpcUrl && (rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')),
  );
}

/**
 * Returns a deduplicated RPC URL list for Avalanche Fuji.
 * When `preferCorsSafe` is true and only the official endpoint is configured,
 * PublicNode is placed first to avoid browser CORS preflight rejections and Cloudflare 1015 limits.
 */
export function getFujiRpcUrls(
  primaryRpc?: string | null,
  preferCorsSafe = false,
): string[] {
  const trimmed = primaryRpc?.trim();
  if (trimmed && isLocalRpcUrl(trimmed)) {
    return [trimmed];
  }
  const ordered =
    preferCorsSafe && (!trimmed || trimmed === OFFICIAL_FUJI_RPC_URL)
      ? [PUBLICNODE_FUJI_RPC_URL, OFFICIAL_FUJI_RPC_URL]
      : [trimmed || PUBLICNODE_FUJI_RPC_URL, ...FUJI_FALLBACK_RPC_URLS];
  return Array.from(new Set(ordered.filter(Boolean)));
}

export const AVALANCHE_FUJI_CHAIN = {
  id: 43113,
  name: 'Avalanche Fuji',
  nativeCurrency: {
    decimals: 18,
    name: 'Avalanche',
    symbol: 'AVAX',
  },
  rpcUrls: {
    default: {
      http: [PUBLICNODE_FUJI_RPC_URL],
    },
  },
  blockExplorers: {
    default: {
      name: 'Snowtrace Fuji',
      url: 'https://testnet.snowtrace.io',
    },
  },
  testnet: true,
} as const;

export const avalancheFujiConfig = AVALANCHE_FUJI_CHAIN;
