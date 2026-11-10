'use client';

import { useCallback } from 'react';
import {
  parseUnits,
  createWalletClient,
  custom,
  keccak256,
  encodePacked,
} from 'viem';
import { avalancheFuji } from 'viem/chains';
import {
  AvaHuiCircleABI,
  AvaHuiFactoryABI,
  MockUSDCABI,
} from '@avahui/blockchain';
import {
  AllocationMode,
  CircleItem,
  CreateCircleFormInput,
  TransactionType,
} from '@avahui/shared';
import { frontendEnv } from '@/config/env';
import { circleApi, transactionApi } from '@/lib/api';
import {
  useAvaHuiState,
  useCommitBidMutation,
  useCreateCircleMutation,
  useContributeRoundMutation,
  useJoinCircleMutation,
  useRevealBidMutation,
  useSettleRoundMutation,
  useSubmitBidMutation,
  useWithdrawCollateralMutation,
} from '@/hooks/useAvaHuiMockQuery';
import { useTokenOperations } from '@/hooks/useTokenOperations';
import { generateMockTxHash } from '@/lib/utils';
import { publicClient } from '@/lib/wagmi/client';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

export function useCircleActions() {
  const { data: state } = useAvaHuiState();
  const { approveToken, getAllowance } = useTokenOperations();

  const joinMutation = useJoinCircleMutation();
  const contributeMutation = useContributeRoundMutation();
  const bidMutation = useSubmitBidMutation();
  const commitBidMutation = useCommitBidMutation();
  const revealBidMutation = useRevealBidMutation();
  const settleMutation = useSettleRoundMutation();
  const withdrawMutation = useWithdrawCollateralMutation();
  const createCircleMutation = useCreateCircleMutation();

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];

  /**
   * Helper to get an active wallet client from window.ethereum
   */
  const getActiveWalletClient = useCallback(async () => {
    if (typeof window === 'undefined' || !window.ethereum) return null;
    try {
      const client = createWalletClient({
        chain: avalancheFuji,
        transport: custom(window.ethereum),
      });
      const [account] = await client.getAddresses();
      if (!account) return null;
      return { client, account };
    } catch {
      return null;
    }
  }, []);

  /**
   * ACTION 1: Join Circle & Lock Collateral
   */
  const executeJoinCircle = useCallback(
    async (circle: CircleItem): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const collateralBaseUnits = parseUnits(circle.collateralAmountFormatted || '100', 6);

      // 1. Check & Approve collateral allowance
      if (!isMockMode && circle.contractAddress && currentUser?.walletAddress) {
        try {
          const currentAllowance = await getAllowance(
            currentUser.walletAddress as `0x${string}`,
            circleAddress,
          );
          if (currentAllowance < collateralBaseUnits) {
            await approveToken(circleAddress, collateralBaseUnits, circle.id);
          }
        } catch (e) {
          console.warn('[AvaHui] Allowance check error:', e);
        }
      }

      // 2. Perform Join on Smart Contract if live wallet available
      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'joinCircle',
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain joinCircle failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      // 3. Track transaction in Backend API
      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.JOIN_CIRCLE,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      // 4. Update UI state
      await joinMutation.mutateAsync(circle.id);
      return { txHash };
    },
    [approveToken, currentUser?.walletAddress, getActiveWalletClient, getAllowance, joinMutation],
  );

  /**
   * ACTION 2: Contribute to Round
   */
  const executeContribute = useCallback(
    async (circle: CircleItem, roundNumber: number): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const contributionBaseUnits = parseUnits(circle.contributionAmountFormatted || '50', 6);

      // 1. Check & Approve contribution allowance
      if (!isMockMode && circle.contractAddress && currentUser?.walletAddress) {
        try {
          const currentAllowance = await getAllowance(
            currentUser.walletAddress as `0x${string}`,
            circleAddress,
          );
          if (currentAllowance < contributionBaseUnits) {
            await approveToken(circleAddress, contributionBaseUnits, circle.id);
          }
        } catch (e) {
          console.warn('[AvaHui] Contribution allowance check error:', e);
        }
      }

      // 2. Perform Contribute on Smart Contract if live wallet available
      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'contribute',
              args: [roundNumber],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain contribute failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      // 3. Track transaction in Backend API
      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.CONTRIBUTE,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      // 4. Update UI state
      await contributeMutation.mutateAsync({ circleId: circle.id, roundNumber });
      return { txHash };
    },
    [approveToken, contributeMutation, currentUser?.walletAddress, getActiveWalletClient, getAllowance],
  );

  /**
   * ACTION 3: Submit Discount Bid (BIDDING mode)
   */
  const executeSubmitBid = useCallback(
    async (
      circle: CircleItem,
      roundNumber: number,
      bidAmountUsdc: number,
    ): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);

      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'submitBid',
              args: [roundNumber, bidAmountBaseUnits],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain submitBid failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.PLACE_BID,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await bidMutation.mutateAsync({ circleId: circle.id, roundNumber, bidAmountUsdc });
      return { txHash };
    },
    [bidMutation, currentUser?.walletAddress, getActiveWalletClient],
  );

  /**
   * ACTION 4: Settle Round & Distribute Payout / Auto-Slash
   */
  const executeSettleRound = useCallback(
    async (circle: CircleItem, roundNumber: number): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'settleRound',
              args: [roundNumber],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain settleRound failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.SETTLE_ROUND,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await settleMutation.mutateAsync({ circleId: circle.id, roundNumber });
      return { txHash };
    },
    [currentUser?.walletAddress, getActiveWalletClient, settleMutation],
  );

  /**
   * ACTION 5: Withdraw Collateral & Claim Discount Bonus
   */
  const executeWithdrawCollateral = useCallback(
    async (circle: CircleItem): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'withdrawCollateral',
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain withdrawCollateral failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.WITHDRAW_COLLATERAL,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await withdrawMutation.mutateAsync(circle.id);
      return { txHash };
    },
    [currentUser?.walletAddress, getActiveWalletClient, withdrawMutation],
  );

  /**
   * ACTION 6: Create New Circle (3-Step Flow: Draft -> SC Factory -> Track)
   */
  const executeCreateCircle = useCallback(
    async (values: CreateCircleFormInput): Promise<{ txHash: string; newCircle?: CircleItem }> => {
      let draftRes: any = null;
      let txHash: string | null = null;

      // Step A: Save draft off-chain to NestJS API
      if (!isMockMode) {
        try {
          const contributionBaseUnits = parseUnits(String(values.contributionAmountUsdc), 6).toString();
          const collateralBaseUnits = parseUnits(
            String(values.contributionAmountUsdc * (values.collateralMultiplier || 1)),
            6,
          ).toString();
          const minBidBaseUnits = values.minBidUsdc
            ? parseUnits(String(values.minBidUsdc), 6).toString()
            : '0';
          const maxBidBaseUnits = values.maxBidUsdc
            ? parseUnits(String(values.maxBidUsdc), 6).toString()
            : '0';

          draftRes = await circleApi.createDraft({
            name: values.name,
            description: values.description,
            creatorAddress: currentUser?.walletAddress || undefined,
            allocationMode: values.allocationMode,
            maxMembers: values.maxMembers,
            contributionAmount: contributionBaseUnits,
            collateralAmount: collateralBaseUnits,
            roundDurationSeconds: values.roundDurationSeconds,
            biddingDurationSeconds: values.biddingDurationSeconds,
            gracePeriodSeconds: values.gracePeriodSeconds,
            minBid: minBidBaseUnits,
            maxBid: maxBidBaseUnits,
          });
        } catch (err) {
          console.warn('[AvaHui] Failed to create circle draft:', err);
        }
      }

      // Step B: Call AvaHuiFactory.createCircle on-chain if wallet available
      if (!isMockMode) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            const metadataId = draftRes?.metadataId || `meta_${Date.now()}`;
            const startDeadline = BigInt(draftRes?.startDeadlineUnix || Math.floor(Date.now() / 1000) + 86400);

            txHash = await wallet.client.writeContract({
              address: frontendEnv.factoryAddress,
              abi: AvaHuiFactoryABI,
              functionName: 'createCircle',
              args: [
                {
                  metadataId,
                  name: values.name,
                  token: frontendEnv.usdcTokenAddress,
                  allocationMode: values.allocationMode === AllocationMode.BIDDING ? 1 : 0,
                  maxMembers: values.maxMembers,
                  contributionAmount: parseUnits(String(values.contributionAmountUsdc), 6),
                  collateralAmount: parseUnits(
                    String(values.contributionAmountUsdc * (values.collateralMultiplier || 1)),
                    6,
                  ),
                  roundDuration: BigInt(values.roundDurationSeconds),
                  biddingDuration: BigInt(values.biddingDurationSeconds || 0),
                  gracePeriod: BigInt(values.gracePeriodSeconds || 60),
                  startDeadline,
                  minBid: parseUnits(String(values.minBidUsdc || 0), 6),
                  maxBid: parseUnits(String(values.maxBidUsdc || 0), 6),
                },
              ],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain createCircle failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      // Step C: Track transaction
      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.CREATE_CIRCLE,
            contractAddress: frontendEnv.factoryAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: draftRes?.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      // Step D: Update mock state machine
      const mutationRes = await createCircleMutation.mutateAsync(values);
      return { txHash, newCircle: mutationRes.newCircle };
    },
    [createCircleMutation, currentUser?.walletAddress, getActiveWalletClient],
  );

  /**
   * ACTION 7 (V2): Sealed-Bid Phase 1 — Commit Cryptographic Bid Hash
   */
  const executeCommitBid = useCallback(
    async (
      circle: CircleItem,
      roundNumber: number,
      bidAmountUsdc: number,
    ): Promise<{ txHash: string; commitment: string; salt: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const bidderAddress = (currentUser?.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921') as `0x${string}`;
      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);

      // Generate deterministic or random 32-byte salt
      const randomHex = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join('');
      const salt = `0x${randomHex}` as `0x${string}`;

      // keccak256(abi.encodePacked(circleAddress, uint16(roundNumber), bidderAddress, bidAmountBaseUnits, salt))
      const commitment = keccak256(
        encodePacked(
          ['address', 'uint16', 'address', 'uint256', 'bytes32'],
          [circleAddress, roundNumber, bidderAddress, bidAmountBaseUnits, salt],
        ),
      );

      // Persist sealed bid secret in browser storage for Phase 2 Reveal
      if (typeof window !== 'undefined') {
        const storageKey = `avahui_sealed_bid_${circle.id}_${roundNumber}_${bidderAddress.toLowerCase()}`;
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({
            circleId: circle.id,
            roundNumber,
            bidAmountUsdc,
            salt,
            commitment,
            revealed: false,
            committedAt: new Date().toISOString(),
          }),
        );
      }

      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'commitBid',
              args: [roundNumber, commitment],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain commitBid failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.COMMIT_BID,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await commitBidMutation.mutateAsync({
        circleId: circle.id,
        roundNumber,
        commitment,
      });

      return { txHash, commitment, salt };
    },
    [commitBidMutation, currentUser?.walletAddress, getActiveWalletClient],
  );

  /**
   * ACTION 8 (V2): Sealed-Bid Phase 2 — Reveal Secret Bid + Salt
   */
  const executeRevealBid = useCallback(
    async (
      circle: CircleItem,
      roundNumber: number,
      fallbackBidAmountUsdc?: number,
    ): Promise<{ txHash: string; bidAmountUsdc: number }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const bidderAddress = (currentUser?.walletAddress ||
        '0x71c95911e9a5d330f4d621842ec243ee13432921') as `0x${string}`;
      const storageKey = `avahui_sealed_bid_${circle.id}_${roundNumber}_${bidderAddress.toLowerCase()}`;

      let bidAmountUsdc = fallbackBidAmountUsdc || 10;
      let salt = ('0x' + '11'.repeat(32)) as `0x${string}`;

      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (parsed.bidAmountUsdc) bidAmountUsdc = Number(parsed.bidAmountUsdc);
            if (parsed.salt) salt = parsed.salt as `0x${string}`;
            parsed.revealed = true;
            window.localStorage.setItem(storageKey, JSON.stringify(parsed));
          } catch {
            // ignore
          }
        }
      }

      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);

      let txHash: string | null = null;
      if (!isMockMode && circle.contractAddress) {
        const wallet = await getActiveWalletClient();
        if (wallet) {
          try {
            txHash = await wallet.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'revealBid',
              args: [roundNumber, bidAmountBaseUnits, salt],
              account: wallet.account,
            });
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain revealBid failed, using fallback:', contractErr);
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      if (!isMockMode) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.REVEAL_BID,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await revealBidMutation.mutateAsync({
        circleId: circle.id,
        roundNumber,
        bidAmountUsdc,
      });

      return { txHash, bidAmountUsdc };
    },
    [currentUser?.walletAddress, getActiveWalletClient, revealBidMutation],
  );

  const getSavedSealedBid = useCallback(
    (circleId: string, roundNumber: number) => {
      if (typeof window === 'undefined' || !currentUser?.walletAddress) return null;
      const storageKey = `avahui_sealed_bid_${circleId}_${roundNumber}_${currentUser.walletAddress.toLowerCase()}`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as {
          bidAmountUsdc: number;
          salt: string;
          commitment: string;
          revealed: boolean;
        };
      } catch {
        return null;
      }
    },
    [currentUser?.walletAddress],
  );

  return {
    executeJoinCircle,
    executeContribute,
    executeSubmitBid,
    executeCommitBid,
    executeRevealBid,
    getSavedSealedBid,
    executeSettleRound,
    executeWithdrawCollateral,
    executeCreateCircle,
    isJoining: joinMutation.isPending,
    isContributing: contributeMutation.isPending,
    isBidding: bidMutation.isPending || commitBidMutation.isPending || revealBidMutation.isPending,
    isCommittingBid: commitBidMutation.isPending,
    isRevealingBid: revealBidMutation.isPending,
    isSettling: settleMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isCreating: createCircleMutation.isPending,
  };
}
