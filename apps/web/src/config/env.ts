// ============================================================================
// @avahui/web — Frontend Environment Configuration
// ============================================================================

const rpcUrl =
  process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
  'https://api.avax-test.network/ext/bc/C/rpc';

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
    '0xd833215cbcc3f914bd1c9ece3ee7bf8b14f841bb') as `0x${string}`,
  usdcTokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    '0xcfeb869f69431e42cdb54a4f4f105c19c080a601') as `0x${string}`,
  yieldVaultAddress: (process.env.NEXT_PUBLIC_YIELD_VAULT_ADDRESS ||
    '0x254dffcd3277c0b1660f6d42efbb754edababc2b') as `0x${string}`,
  sybilVerifierAddress: (process.env.NEXT_PUBLIC_SYBIL_VERIFIER_ADDRESS ||
    '0xc89ce4735882c9f0f0fe26686c53074e09b0d550') as `0x${string}`,
} as const;
