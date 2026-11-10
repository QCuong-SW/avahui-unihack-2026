'use client';

import { useCallback, useState } from 'react';
import { parseUnits, formatUnits } from 'viem';
import { MockUSDCABI } from '@avahui/blockchain';
import { TransactionType } from '@avahui/shared';
import {
  activeFujiChain,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';
import { frontendEnv } from '@/config/env';
import { transactionApi } from '@/lib/api';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import { useAvaHuiState, useFaucetMint } from '@/hooks/useAvaHuiMockQuery';
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
        return 0n;
      }
    },
    [],
  );

  /**
   * Mint testnet mUSDC via Faucet on-chain
   */
  const requestFaucet = useCallback(
    async (amountUsdc: number = 1000) => {
      return runTransaction({
        title: `Faucet +${amountUsdc.toLocaleString()} mUSDC`,
        description: 'Nhận token thử nghiệm trực tiếp từ Smart Contract MockUSDC',
        action: async () => {
          setIsOperating(true);
          try {
            const amountBaseUnits = parseUnits(String(amountUsdc), 6);
            let txHash: string | null = null;
            let liveConfirmed = false;

            if (!isMockMode) {
              const signer = await resolveSignerClient(currentUser?.walletAddress);
              if (!signer) {
                throw new Error(
                  'Chưa có ví ký giao dịch. Vui lòng kết nối Core Wallet / MetaMask hoặc đăng nhập Privy.',
                );
              }
              txHash = await signer.client.writeContract({
                address: frontendEnv.usdcTokenAddress,
                abi: MockUSDCABI,
                functionName: 'faucet',
                args: [amountBaseUnits],
                account: signer.account,
                chain: activeFujiChain,
              });
              await publicClient.waitForTransactionReceipt({
                hash: txHash as `0x${string}`,
              });
              liveConfirmed = true;
            } else {
              txHash = generateMockTxHash();
            }

            if (!isMockMode && txHash) {
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

            await mockFaucetMutation.mutateAsync({
              amountUsdc,
              skipMock: liveConfirmed,
            });

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

            if (!isMockMode) {
              const signer = await resolveSignerClient(currentUser?.walletAddress);
              if (!signer) {
                throw new Error(
                  'Chưa có ví ký giao dịch. Vui lòng kết nối Core Wallet / MetaMask hoặc đăng nhập Privy.',
                );
              }
              txHash = await signer.client.writeContract({
                address: frontendEnv.usdcTokenAddress,
                abi: MockUSDCABI,
                functionName: 'approve',
                args: [spenderAddress, amountBaseUnits],
                account: signer.account,
                chain: activeFujiChain,
              });
              await publicClient.waitForTransactionReceipt({
                hash: txHash as `0x${string}`,
              });
            } else {
              txHash = generateMockTxHash();
            }

            if (!isMockMode && txHash) {
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

  return {
    getBalance,
    getAllowance,
    requestFaucet,
    approveToken,
    isOperating,
  };
}
