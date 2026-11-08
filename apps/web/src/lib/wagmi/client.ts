import { createPublicClient, http, fallback } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { frontendEnv } from '@/config/env';

/**
 * Public Client for Avalanche Fuji Testnet (Chain ID 43113)
 * Handles high-reliability JSON-RPC read requests with fallback.
 */
export const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: fallback([
    http(frontendEnv.rpcUrl),
    http('https://api.avax-test.network/ext/bc/C/rpc'),
    http('https://avalanche-fuji-c-chain-rpc.publicnode.com'),
  ]),
});

export const FUJI_CHAIN_ID = avalancheFuji.id; // 43113
