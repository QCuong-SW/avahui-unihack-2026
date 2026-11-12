'use client';

import { useCallback, useState } from 'react';
import { parseUnits, formatUnits, createWalletClient, custom } from 'viem';
import { avalancheFuji } from 'viem/chains';
import { MockUSDCABI } from '@avahui/blockchain';
import { TransactionType } from '@avahui/shared';
import { publicClient } from '@/lib/wagmi/client';
import { frontendEnv } from '@/config/env';
import { transactionApi } from '@/lib/api';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import {
  useAvaHuiState,
  useFaucetMint,
  useSwapAvaxMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { generateMockTxHash } from '@/lib/utils';

declare global {
  interface Window {
    ethereum?: any;
  }
}

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export function useTokenOperations() {
  const { data: state } = useAvaHuiState();
  const { runTransaction } = useTxLifecycle();
  const mockFaucetMutation = useFaucetMint();
  const mockSwapMutation = useSwapAvaxMutation();
  const [isOperating, setIsOperating] = useState(false);

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];

  /**
   * Check token balance on-chain via Viem public client
   */
  const getBalance = useCallback(
    async (walletAddress: `0x${string}`): Promise<string> => {
      try {
        const balance = await publicClient.readContract({
          address: frontendEnv.usdcTokenAddress,
          abi: MockUSDCABI,
          functionName: 'balanceOf',
          args: [walletAddress],
        });
        return formatUnits(balance, 6);
      } catch (err) {
        console.warn('[AvaHui] Failed to read on-chain mUSDC balance:', err);
        return currentUser?.usdcBalance?.replace(/[^0-9.]/g, '') || '0.00';
      }
    },
    [currentUser],
  );

  /**
   * Check allowance on-chain
   */
  const getAllowance = useCallback(
    async (
      ownerAddress: `0x${string}`,
      spenderAddress: `0x${string}`,
    ): Promise<bigint> => {
      try {
        const allowance = await publicClient.readContract({
          address: frontendEnv.usdcTokenAddress,
          abi: MockUSDCABI,
          functionName: 'allowance',
          args: [ownerAddress, spenderAddress],
        });
        return allowance;
      } catch (err) {
        console.warn('[AvaHui] Failed to read on-chain allowance:', err);
        return parseUnits('1000000', 6);
      }
    },
    [],
  );

  /**
   * Mint testnet mUSDC via Faucet
   * If real injected/embedded wallet is present, calls on-chain faucet; otherwise records transaction and triggers mock mint.
   */
  const requestFaucet = useCallback(
    async (amountUsdc: number = 1000) => {
      return runTransaction({
        title: `Faucet +${amountUsdc.toLocaleString()} mUSDC`,
        description: 'Nhận token thử nghiệm trên mạng Avalanche Fuji Testnet',
        action: async () => {
          setIsOperating(true);
          try {
            const amountBaseUnits = parseUnits(String(amountUsdc), 6);
            let txHash: string | null = null;

            if (
              !isMockMode &&
              typeof window !== 'undefined' &&
              window.ethereum &&
              currentUser?.walletAddress
            ) {
              try {
                const walletClient = createWalletClient({
                  chain: avalancheFuji,
                  transport: custom(window.ethereum),
                });
                const [account] = await walletClient.getAddresses();
                if (account) {
                  txHash = await walletClient.writeContract({
                    address: frontendEnv.usdcTokenAddress,
                    abi: MockUSDCABI,
                    functionName: 'faucet',
                    args: [amountBaseUnits],
                    account,
                  });
                }
              } catch (walletErr) {
                console.warn('[AvaHui] On-chain faucet call reverted/rejected, falling back:', walletErr);
              }
            }

            if (!txHash) {
              txHash = generateMockTxHash();
            }

            // Track transaction in backend API
            if (!isMockMode) {
              try {
                await transactionApi.trackTransaction({
                  txHash,
                  txType: TransactionType.FAUCET_MINT,
                  contractAddress: frontendEnv.usdcTokenAddress,
                  senderAddress: currentUser?.walletAddress,
                });
              } catch (e) {
                console.warn('[AvaHui] transactionApi.trackTransaction error:', e);
              }
            }

            // Update UI state
            await mockFaucetMutation.mutateAsync(amountUsdc);

            return { txHash };
          } finally {
            setIsOperating(false);
          }
        },
      });
    },
    [currentUser?.walletAddress, mockFaucetMutation, runTransaction],
  );

  /**
   * Approve Token for Smart Contract Spender
   */
  const approveToken = useCallback(
    async (spenderAddress: `0x${string}`, amountBaseUnits: bigint, circleId?: string) => {
      return runTransaction({
        title: 'Cấp quyền chi tiêu mUSDC (Approve)',
        description: 'Phê duyệt hạn mức để Smart Contract tham gia hoặc đóng hụi',
        action: async () => {
          setIsOperating(true);
          try {
            let txHash: string | null = null;

            if (
              !isMockMode &&
              typeof window !== 'undefined' &&
              window.ethereum &&
              currentUser?.walletAddress
            ) {
              try {
                const walletClient = createWalletClient({
                  chain: avalancheFuji,
                  transport: custom(window.ethereum),
                });
                const [account] = await walletClient.getAddresses();
                if (account) {
                  txHash = await walletClient.writeContract({
                    address: frontendEnv.usdcTokenAddress,
                    abi: MockUSDCABI,
                    functionName: 'approve',
                    args: [spenderAddress, amountBaseUnits],
                    account,
                  });
                }
              } catch (walletErr) {
                console.warn('[AvaHui] On-chain approve call reverted/rejected:', walletErr);
              }
            }

            if (!txHash) {
              txHash = generateMockTxHash();
            }

            // Track transaction in backend API
            if (!isMockMode) {
              try {
                await transactionApi.trackTransaction({
                  txHash,
                  txType: TransactionType.APPROVE_TOKEN,
                  contractAddress: frontendEnv.usdcTokenAddress,
                  senderAddress: currentUser?.walletAddress,
                  circleId,
                });
              } catch (e) {
                console.warn('[AvaHui] transactionApi.trackTransaction error:', e);
              }
            }

            return { txHash };
          } finally {
            setIsOperating(false);
          }
        },
      });
    },
    [currentUser?.walletAddress, runTransaction],
  );

  /**
   * V2: 1-Click Swap AVAX -> mUSDC via MockAvaxUsdcSwap Adapter
   */
  const swapAvaxToUsdc = useCallback(
    async (avaxAmount: number = 0.25) => {
      const expectedUsdc = (avaxAmount * 40).toFixed(2);
      return runTransaction({
        title: `Quick Swap ${avaxAmount} AVAX -> +${expectedUsdc} mUSDC`,
        description:
          'Hoán đổi tức thì AVAX sang mUSDC trên Avalanche Fuji để khóa thế chấp',
        action: async () => {
          setIsOperating(true);
          try {
            const res = await mockSwapMutation.mutateAsync(avaxAmount);
            return { txHash: res.txHash };
          } finally {
            setIsOperating(false);
          }
        },
      });
    },
    [mockSwapMutation, runTransaction],
  );

  return {
    getBalance,
    getAllowance,
    requestFaucet,
    swapAvaxToUsdc,
    approveToken,
    isOperating,
  };
}
