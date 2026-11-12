declare const process: { env?: Record<string, string | undefined> } | undefined;

export interface ChainContractAddresses {
  mockUSDC: `0x${string}`;
  avaHuiFactory: `0x${string}`;
  avaHuiYieldVault?: `0x${string}`;
  team1Verifier?: `0x${string}`;
  mockAvaxUsdcSwap?: `0x${string}`;
}

export const CONTRACT_ADDRESSES: Record<number, ChainContractAddresses> = {
  // Avalanche Fuji Testnet (43113)
  43113: {
    mockUSDC: (process?.env?.NEXT_PUBLIC_USDC_TOKEN_ADDRESS ||
      process?.env?.USDC_TOKEN_ADDRESS ||
      '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`,
    avaHuiFactory: (process?.env?.NEXT_PUBLIC_ROSCA_FACTORY_ADDRESS ||
      process?.env?.ROSCA_FACTORY_ADDRESS ||
      '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`,
    avaHuiYieldVault: (process?.env?.NEXT_PUBLIC_YIELD_VAULT_ADDRESS ||
      '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0') as `0x${string}`,
    team1Verifier: (process?.env?.NEXT_PUBLIC_TEAM1_VERIFIER_ADDRESS ||
      '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9') as `0x${string}`,
    mockAvaxUsdcSwap: (process?.env?.NEXT_PUBLIC_SWAP_ADAPTER_ADDRESS ||
      '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9') as `0x${string}`,
  },
  // Local Anvil / Hardhat (31337)
  31337: {
    mockUSDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    avaHuiFactory: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    avaHuiYieldVault: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
    team1Verifier: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    mockAvaxUsdcSwap: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9',
  },
};

export function getContractAddresses(chainId = 43113): ChainContractAddresses {
  return CONTRACT_ADDRESSES[chainId] ?? CONTRACT_ADDRESSES[43113];
}

export const DEFAULT_FUJI_ADDRESSES = {
  mockUsdc: '0x5FbDB2315678afecb367f032d93F642f64180aa3' as `0x${string}`,
  avahuiFactory: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512' as `0x${string}`,
  avahuiYieldVault: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0' as `0x${string}`,
  team1Verifier: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9' as `0x${string}`,
  mockAvaxUsdcSwap: '0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9' as `0x${string}`,
} as const;
