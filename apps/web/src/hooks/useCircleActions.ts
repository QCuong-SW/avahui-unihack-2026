'use client';

import { useCallback } from 'react';
import {
  parseUnits,
  keccak256,
  encodePacked,
  decodeEventLog,
} from 'viem';
import {
  AvaHuiCircleABI,
  AvaHuiFactoryABI,
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
import {
  activeFujiChain,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';

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
   * Ensure ERC20 allowance is sufficient before contract transferFrom
   */
  const ensureSufficientAllowance = useCallback(
    async (
      ownerAddress: `0x${string}`,
      spenderAddress: `0x${string}`,
      requiredAmount: bigint,
      circleId?: string,
    ) => {
      if (isMockMode) return;
      try {
        const currentAllowance = await getAllowance(ownerAddress, spenderAddress);
        if (currentAllowance < requiredAmount) {
          await approveToken(spenderAddress, requiredAmount * 2n, circleId);
        }
      } catch (e) {
        console.warn('[AvaHui] Allowance check/approve warning:', e);
      }
    },
    [approveToken, getAllowance],
  );

  /**
   * ACTION 1: Join Circle & Lock Collateral (Supports V1 joinCircle & V2 joinCircleProtected)
   */
  const executeJoinCircle = useCallback(
    async (circle: CircleItem, inviteCode?: string): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const collateralBaseUnits = parseUnits(circle.collateralAmountFormatted || '100', 6);

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          await ensureSufficientAllowance(
            signer.account,
            circleAddress,
            collateralBaseUnits,
            circle.id,
          );

          try {
            const requiresProtected = Boolean(circle.isPrivateInvite);
            if (requiresProtected || (inviteCode && circle.isPrivateInvite)) {
              const nullifier = (currentUser?.identityNullifier ||
                `0x9999${signer.account.slice(2).toLowerCase().padEnd(60, 'a')}`) as `0x${string}`;
              txHash = await signer.client.writeContract({
                address: circleAddress,
                abi: AvaHuiCircleABI,
                functionName: 'joinCircleProtected',
                args: [inviteCode || circle.inviteCode || '', nullifier],
                account: signer.account,
                chain: activeFujiChain,
                gas: 500_000n,
              });
            } else {
              txHash = await signer.client.writeContract({
                address: circleAddress,
                abi: AvaHuiCircleABI,
                functionName: 'joinCircle',
                account: signer.account,
                chain: activeFujiChain,
                gas: 500_000n,
              });
            }
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain joinCircle error:', contractErr);
            throw contractErr;
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
            txType: TransactionType.JOIN_CIRCLE,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await joinMutation.mutateAsync({ circleId: circle.id, skipMock: liveConfirmed });
      return { txHash };
    },
    [currentUser?.identityNullifier, currentUser?.walletAddress, ensureSufficientAllowance, joinMutation],
  );

  /**
   * ACTION 2: Contribute to Round
   */
  const executeContribute = useCallback(
    async (circle: CircleItem, roundNumber: number): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const contributionBaseUnits = parseUnits(circle.contributionAmountFormatted || '50', 6);

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          await ensureSufficientAllowance(
            signer.account,
            circleAddress,
            contributionBaseUnits,
            circle.id,
          );
          try {
            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'contribute',
              args: [roundNumber],
              account: signer.account,
              chain: activeFujiChain,
              gas: 500_000n,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain contribute error:', contractErr);
            throw contractErr;
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
            txType: TransactionType.CONTRIBUTE,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await contributeMutation.mutateAsync({
        circleId: circle.id,
        roundNumber,
        skipMock: liveConfirmed,
      });
      return { txHash };
    },
    [contributeMutation, currentUser?.walletAddress, ensureSufficientAllowance],
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
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'submitBid',
              args: [roundNumber, bidAmountBaseUnits],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain submitBid error:', contractErr);
            throw contractErr;
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

      await bidMutation.mutateAsync({
        circleId: circle.id,
        roundNumber,
        bidAmountUsdc,
        skipMock: liveConfirmed,
      });
      return { txHash };
    },
    [bidMutation, currentUser?.walletAddress],
  );

  /**
   * ACTION 4: Settle Round & Distribute Payout / Auto-Slash
   */
  const executeSettleRound = useCallback(
    async (circle: CircleItem, roundNumber: number): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            // If running on Local EVM Node, advance block timestamp if needed so demo settlement can be tested without waiting minutes
            if (frontendEnv.isLocalEvm) {
              try {
                const roundOnChain: any = await publicClient.readContract({
                  address: circleAddress,
                  abi: AvaHuiCircleABI,
                  functionName: 'getRoundInfo',
                  args: [roundNumber],
                });
                const block = await publicClient.getBlock();
                const biddingDeadline = BigInt(roundOnChain[3] || 0);
                const graceDeadline = BigInt(roundOnChain[4] || 0);
                const targetTs = graceDeadline > biddingDeadline ? graceDeadline + 2n : biddingDeadline + 2n;
                if (block.timestamp <= targetTs) {
                  await fetch(frontendEnv.rpcUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      jsonrpc: '2.0',
                      id: Date.now(),
                      method: 'evm_setNextBlockTimestamp',
                      params: [Number(targetTs)],
                    }),
                  });
                }
              } catch {
                // ignore RPC helper error on non-ganache chains
              }
            }

            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'settleRound',
              args: [roundNumber],
              account: signer.account,
              chain: activeFujiChain,
              gas: 750_000n,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain settleRound error:', contractErr);
            throw contractErr;
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

      await settleMutation.mutateAsync({
        circleId: circle.id,
        roundNumber,
        skipMock: liveConfirmed,
      });
      return { txHash };
    },
    [currentUser?.walletAddress, settleMutation],
  );

  /**
   * ACTION 5: Withdraw Collateral & Claim Discount + Yield Bonus
   */
  const executeWithdrawCollateral = useCallback(
    async (circle: CircleItem): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'withdrawCollateral',
              account: signer.account,
              chain: activeFujiChain,
              gas: 500_000n,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain withdrawCollateral error:', contractErr);
            throw contractErr;
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

      await withdrawMutation.mutateAsync({ circleId: circle.id, skipMock: liveConfirmed });
      return { txHash };
    },
    [currentUser?.walletAddress, withdrawMutation],
  );

  /**
   * ACTION 6: Create New Circle (Draft -> On-Chain Factory.createCircle -> Auto Join Slot #1 -> Track)
   */
  const executeCreateCircle = useCallback(
    async (values: CreateCircleFormInput): Promise<{ txHash: string; newCircle?: { id: string } }> => {
      let draftRes: any = null;
      let txHash: string | null = null;
      let deployedCircleAddress: `0x${string}` | null = null;
      let liveConfirmed = false;

      const contributionBaseUnits = parseUnits(String(values.contributionAmountUsdc), 6);
      const collateralBaseUnits = parseUnits(
        String(values.contributionAmountUsdc * (values.collateralMultiplier || 1)),
        6,
      );
      const minBidBaseUnits = values.minBidUsdc
        ? parseUnits(String(values.minBidUsdc), 6)
        : 0n;
      const maxBidBaseUnits = values.maxBidUsdc
        ? parseUnits(String(values.maxBidUsdc), 6)
        : 0n;

      // Step A: Save draft off-chain to NestJS API
      if (!isMockMode) {
        try {
          draftRes = await circleApi.createDraft({
            name: values.name,
            description: values.description,
            creatorAddress: currentUser?.walletAddress || undefined,
            allocationMode: values.allocationMode,
            maxMembers: values.maxMembers,
            contributionAmount: contributionBaseUnits.toString(),
            collateralAmount: collateralBaseUnits.toString(),
            roundDurationSeconds: values.roundDurationSeconds,
            biddingDurationSeconds: values.biddingDurationSeconds,
            gracePeriodSeconds: values.gracePeriodSeconds,
            minBid: minBidBaseUnits.toString(),
            maxBid: maxBidBaseUnits.toString(),
          });
        } catch (err) {
          console.warn('[AvaHui] Failed to create circle draft:', err);
        }
      }

      // Step B: Call AvaHuiFactory.createCircle on-chain
      if (!isMockMode) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            const metadataId = draftRes?.metadataId || `meta_${Date.now()}`;
            const startDeadline = BigInt(
              draftRes?.startDeadlineUnix || Math.floor(Date.now() / 1000) + 7 * 86400,
            );

            txHash = await signer.client.writeContract({
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
                  contributionAmount: contributionBaseUnits,
                  collateralAmount: collateralBaseUnits,
                  roundDuration: BigInt(values.roundDurationSeconds),
                  biddingDuration: BigInt(values.biddingDurationSeconds || 0),
                  gracePeriod: BigInt(values.gracePeriodSeconds || 60),
                  startDeadline,
                  minBid: minBidBaseUnits,
                  maxBid: maxBidBaseUnits,
                },
              ],
              account: signer.account,
              chain: activeFujiChain,
            });

            const receipt = await publicClient.waitForTransactionReceipt({
              hash: txHash as `0x${string}`,
            });

            for (const log of receipt.logs) {
              try {
                const decoded: any = decodeEventLog({
                  abi: AvaHuiFactoryABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === 'CircleCreated' && decoded.args?.circleAddress) {
                  deployedCircleAddress = decoded.args.circleAddress as `0x${string}`;
                  break;
                }
              } catch {
                // ignore unrelated log
              }
            }

            // Auto-join Creator into Slot #1 with collateral lock on the newly deployed circle
            if (deployedCircleAddress) {
              await ensureSufficientAllowance(
                signer.account,
                deployedCircleAddress,
                collateralBaseUnits,
                draftRes?.id,
              );
              const joinTx = await signer.client.writeContract({
                address: deployedCircleAddress,
                abi: AvaHuiCircleABI,
                functionName: 'joinCircle',
                account: signer.account,
                chain: activeFujiChain,
                gas: 500_000n,
              });
              await publicClient.waitForTransactionReceipt({ hash: joinTx });
            }

            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain createCircle failed:', contractErr);
            throw contractErr;
          }
        }
      }

      if (!txHash) {
        txHash = generateMockTxHash();
      }

      // Step C: Track transaction & trigger Backend Indexer sync
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

      const mutationRes = await createCircleMutation.mutateAsync({
        input: values,
        skipMock: liveConfirmed,
      });

      const resolvedCircleId =
        deployedCircleAddress || draftRes?.id || mutationRes?.newCircle?.id;

      return { txHash, newCircle: resolvedCircleId ? { id: resolvedCircleId } : undefined };
    },
    [createCircleMutation, currentUser?.walletAddress, ensureSufficientAllowance],
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
        '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1') as `0x${string}`;
      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);

      const randomHex = Array.from({ length: 64 }, () =>
        Math.floor(Math.random() * 16).toString(16),
      ).join('');
      const salt = `0x${randomHex}` as `0x${string}`;

      const commitment = keccak256(
        encodePacked(
          ['address', 'uint8', 'address', 'uint256', 'bytes32'],
          [circleAddress, roundNumber, bidderAddress, bidAmountBaseUnits, salt],
        ),
      );

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
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'commitBid',
              args: [roundNumber, commitment],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain commitBid failed:', contractErr);
            throw contractErr;
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
        skipMock: liveConfirmed,
      });

      return { txHash, commitment, salt };
    },
    [commitBidMutation, currentUser?.walletAddress],
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
        '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1') as `0x${string}`;
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
      let liveConfirmed = false;

      if (!isMockMode && circle.contractAddress) {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (signer) {
          try {
            txHash = await signer.client.writeContract({
              address: circleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'revealBid',
              args: [roundNumber, bidAmountBaseUnits, salt],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            liveConfirmed = true;
          } catch (contractErr) {
            console.warn('[AvaHui] On-chain revealBid failed:', contractErr);
            throw contractErr;
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
        skipMock: liveConfirmed,
      });

      return { txHash, bidAmountUsdc };
    },
    [currentUser?.walletAddress, revealBidMutation],
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
