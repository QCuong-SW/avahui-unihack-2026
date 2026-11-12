// ============================================================================
// @avahui/web — Frontend Environment Configuration
// ============================================================================

const rpcUrl =
  process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
  'https://avalanche-fuji-c-chain-rpc.publicnode.com';

const privyAppId =
  process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'mock_privy_app_id';

const isLocalEvm =
  rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost');

const hasRealPrivyAppId = Boolean(
  privyAppId &&
    !privyAppId.startsWith('mock_') &&
    privyAppId !== 'your_privy_app_id_here',
);

const enableDevDemoTools =
  process.env.NEXT_PUBLIC_ENABLE_DEMO_TOOLS === 'true' ||
  (isLocalEvm && process.env.NEXT_PUBLIC_ENABLE_DEMO_TOOLS !== 'false');

const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as `0x${string}`;

export function isConfiguredAddress(
  address?: string | null,
): address is `0x${string}` {
  return Boolean(
    address &&
      /^0x[a-fA-F0-9]{40}$/.test(address) &&
      address.toLowerCase() !== ZERO_ADDRESS,
  );
}

export function requireConfiguredContractAddress(
  address: string | undefined | null,
  contractLabel: string,
): `0x${string}` {
  if (!isConfiguredAddress(address)) {
    throw new Error(
      `Smart Contract ${contractLabel} chưa được triển khai trên mạng này. Vui lòng chạy deploy trước khi thực hiện giao dịch.`,
    );
  }
  return address;
}

export const frontendEnv = {
  useMock: process.env.NEXT_PUBLIC_USE_MOCK === 'true',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  privyAppId,
  hasRealPrivyAppId,
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 43113),
  rpcUrl,
  isLocalEvm,
  enableDevDemoTools,
  allowLocalAutoSigner:
    isLocalEvm && process.env.NEXT_PUBLIC_DISABLE_LOCAL_SIGNER !== 'true',
  explorerUrl:
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://testnet.snowtrace.io',
  factoryAddress: (process.env.NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS ||
    ZERO_ADDRESS) as `0x${string}`,
  usdcTokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    ZERO_ADDRESS) as `0x${string}`,
  yieldVaultAddress: (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS ||
    ZERO_ADDRESS) as `0x${string}`,
  sybilVerifierAddress: (process.env.NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS ||
    ZERO_ADDRESS) as `0x${string}`,
} as const;
