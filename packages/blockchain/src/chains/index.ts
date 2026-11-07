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
      http: ['https://api.avax-test.network/ext/bc/C/rpc'],
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
