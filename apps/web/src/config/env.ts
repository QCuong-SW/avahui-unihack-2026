// ============================================================================
// @avahui/web — Frontend Environment Configuration
// ============================================================================

export const frontendEnv = {
  useMock: process.env.NEXT_PUBLIC_USE_MOCK !== 'false',
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  privyAppId: process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'mock_privy_app_id',
  chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 43113),
  rpcUrl:
    process.env.NEXT_PUBLIC_AVALANCHE_RPC_URL ||
    'https://api.avax-test.network/ext/bc/C/rpc',
  explorerUrl:
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://testnet.snowtrace.io',
  factoryAddress: (process.env.NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS ||
    '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`,
  usdcTokenAddress: (process.env.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
    '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`,
} as const;
