import {
  createPublicClient,
  createWalletClient,
  custom,
  defineChain,
  http,
  fallback,
  type WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { frontendEnv } from '@/config/env';

export const FUJI_CHAIN_ID = avalancheFuji.id; // 43113

export const activeFujiChain = frontendEnv.isLocalEvm
  ? defineChain({
      id: 43113,
      name: 'Avalanche Fuji (Local EVM)',
      nativeCurrency: { name: 'Avalanche', symbol: 'AVAX', decimals: 18 },
      rpcUrls: {
        default: { http: [frontendEnv.rpcUrl] },
        public: { http: [frontendEnv.rpcUrl] },
      },
    })
  : avalancheFuji;

/**
 * Public Client for Avalanche Fuji (or Local EVM Node mimicking Chain ID 43113)
 */
export const publicClient = createPublicClient({
  chain: activeFujiChain,
  transport: frontendEnv.isLocalEvm
    ? http(frontendEnv.rpcUrl)
    : fallback([
        http(frontendEnv.rpcUrl),
        http('https://api.avax-test.network/ext/bc/C/rpc'),
        http('https://avalanche-fuji-c-chain-rpc.publicnode.com'),
      ]),
});

/**
 * Local deterministic Ganache accounts (#0 -> #4) used ONLY when connected to Local EVM RPC.
 * Enables seamless on-chain signing across all 5 demo builders without requiring 5 manual MetaMask imports.
 */
const LOCAL_DEV_PRIVATE_KEYS: Record<string, `0x${string}`> = {
  '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1':
    '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
  '0xffcf8fdee72ac11b5c542428b35eef5769c409f0':
    '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
  '0x22d491bde2303f2f43325b2108d26f1eaba1e32b':
    '0x6370fd033278c143179d81c5526140625662b8daa446c22ee2d73db3707e620c',
  '0xe11ba2b4d45eaed5996cd0823791e0c93114882d':
    '0x646f1ce2fdad0e6deeeb5c7e8e5543bdde65e86029e2fd9fc169899c440a7913',
  '0xd03ea8624c8c5987235048901fb614fdca89b117':
    '0xadd53f9a7e588d003326d1cbf9e4a43c061aadd9bc938c843a79e7b4fd2ad743',
};

export interface ResolvedSigner {
  client: WalletClient;
  account: `0x${string}`;
  isLocalAutoSigner: boolean;
}

/**
 * Resolves the active EVM transaction signer:
 * 1. Injected browser wallet (Core Wallet / MetaMask) when connected & matching the active user
 * 2. Local EVM Dev Signer when running against http://127.0.0.1:8545
 */
export async function resolveSignerClient(
  preferredAddress?: string,
): Promise<ResolvedSigner | null> {
  const normPreferred = preferredAddress?.toLowerCase();

  if (typeof window !== 'undefined' && (window as any).ethereum) {
    try {
      const browserClient = createWalletClient({
        chain: activeFujiChain,
        transport: custom((window as any).ethereum),
      });
      const addresses = await browserClient.getAddresses();
      if (addresses && addresses.length > 0) {
        const matched = normPreferred
          ? addresses.find((a) => a.toLowerCase() === normPreferred)
          : addresses[0];
        if (matched) {
          return {
            client: browserClient,
            account: matched,
            isLocalAutoSigner: false,
          };
        }
      }
    } catch {
      // Fall back to local auto signer if browser wallet isn't unlocked or on wrong account
    }
  }

  if (frontendEnv.isLocalEvm) {
    const devKey =
      (normPreferred && LOCAL_DEV_PRIVATE_KEYS[normPreferred]) ||
      (!normPreferred
        ? Object.values(LOCAL_DEV_PRIVATE_KEYS)[0]
        : undefined);
    if (devKey) {
      const devAccount = privateKeyToAccount(devKey);
      const localClient = createWalletClient({
        account: devAccount,
        chain: activeFujiChain,
        transport: http(frontendEnv.rpcUrl),
      });
      return {
        client: localClient,
        account: devAccount.address,
        isLocalAutoSigner: true,
      };
    }
  }

  return null;
}

/**
 * Prompts browser wallet to switch to or add Avalanche Fuji (or Local Fuji RPC)
 */
export async function ensureBrowserWalletNetwork(eth: any): Promise<void> {
  const chainIdHex = '0xa869'; // 43113
  try {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    });
  } catch (switchErr: any) {
    if (switchErr?.code === 4902) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: chainIdHex,
            chainName: frontendEnv.isLocalEvm
              ? 'Avalanche Fuji (Local EVM)'
              : 'Avalanche Fuji Testnet',
            nativeCurrency: {
              name: 'Avalanche',
              symbol: 'AVAX',
              decimals: 18,
            },
            rpcUrls: [frontendEnv.rpcUrl],
            blockExplorerUrls: ['https://testnet.snowtrace.io/'],
          },
        ],
      });
    }
  }
}
