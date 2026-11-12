'use client';

import { useCallback } from 'react';
import {
  parseUnits,
  keccak256,
  encodePacked,
  decodeEventLog,
  toBytes,
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
import { frontendEnv, requireConfiguredContractAddress } from '@/config/env';
import { circleApi, transactionApi } from '@/lib/api';
import {
  useAvaHuiState,
  useCancelCircleMutation,
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
import { generateMockTxHash, saveCreatorInviteCode } from '@/lib/utils';
import {
  activeFujiChain,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';

const isMockMode = process.env.NEXT_PUBLIC_USE_MOCK === 'true';
const ZERO_ADDRESS =
  '0x0000000000000000000000000000000000000000' as `0x${string}`;
const ZERO_BYTES32 =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`;

export interface SavedSealedBidRecord {
  circleId: string;
  roundNumber: number;
  bidAmountUsdc: number;
  salt: `0x${string}`;
  commitment: `0x${string}`;
  committed: boolean;
  revealed: boolean;
  committedAt: string;
}

function generateCryptoSalt(): `0x${string}` {
  if (typeof window !== 'undefined' && window.crypto?.getRandomValues) {
    const bytes = new Uint8Array(32);
    window.crypto.getRandomValues(bytes);
    return ('0x' +
      Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')) as `0x${string}`;
  }
  const randomHex = Array.from({ length: 64 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join('');
  return `0x${randomHex}` as `0x${string}`;
}

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
  const cancelMutation = useCancelCircleMutation();
  const createCircleMutation = useCreateCircleMutation();

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];

  const requireLiveSigner = useCallback(async () => {
    const signer = await resolveSignerClient(currentUser?.walletAddress);
    if (!signer) {
      throw new Error(
        'Chưa tìm thấy ví ký giao dịch. Vui lòng kết nối Core Wallet / MetaMask hoặc đăng nhập lại bằng Privy.',
      );
    }
    return signer;
  }, [currentUser?.walletAddress]);

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
      const currentAllowance = await getAllowance(ownerAddress, spenderAddress);
      if (currentAllowance < requiredAmount) {
        await approveToken(spenderAddress, requiredAmount * 2n, circleId);
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

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa được triển khai địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();
        await ensureSufficientAllowance(
          signer.account,
          circleAddress,
          collateralBaseUnits,
          circle.id,
        );

        const requiresProtected = Boolean(
          circle.isPrivateInvite || circle.requireTeam1Attestation || inviteCode,
        );
        if (requiresProtected) {
          const nullifier = (currentUser?.identityNullifier ||
            ZERO_BYTES32) as `0x${string}`;
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
    [
      currentUser?.identityNullifier,
      currentUser?.walletAddress,
      ensureSufficientAllowance,
      joinMutation,
      requireLiveSigner,
    ],
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

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();
        await ensureSufficientAllowance(
          signer.account,
          circleAddress,
          contributionBaseUnits,
          circle.id,
        );
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'contribute',
          args: [roundNumber],
          account: signer.account,
          chain: activeFujiChain,
          gas: 500_000n,
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
    [
      contributeMutation,
      currentUser?.walletAddress,
      ensureSufficientAllowance,
      requireLiveSigner,
    ],
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

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'submitBid',
          args: [roundNumber, bidAmountBaseUnits],
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
    [bidMutation, currentUser?.walletAddress, requireLiveSigner],
  );

  /**
   * ACTION 4: Settle Round & Distribute Payout / Auto-Slash
   */
  const executeSettleRound = useCallback(
    async (circle: CircleItem, roundNumber: number): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();

        // Time-warp helper strictly allowed on Local EVM + Dev Demo Tools only
        if (frontendEnv.isLocalEvm && frontendEnv.enableDevDemoTools) {
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
            const targetTs =
              graceDeadline > biddingDeadline
                ? graceDeadline + 2n
                : biddingDeadline + 2n;
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
            // ignore RPC helper error
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
    [currentUser?.walletAddress, requireLiveSigner, settleMutation],
  );

  /**
   * ACTION 5: Withdraw Collateral & Claim Discount + Yield Bonus
   */
  const executeWithdrawCollateral = useCallback(
    async (circle: CircleItem): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'withdrawCollateral',
          account: signer.account,
          chain: activeFujiChain,
          gas: 500_000n,
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
            txType: TransactionType.WITHDRAW_COLLATERAL,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await withdrawMutation.mutateAsync({
        circleId: circle.id,
        skipMock: liveConfirmed,
      });
      return { txHash };
    },
    [currentUser?.walletAddress, requireLiveSigner, withdrawMutation],
  );

  /**
   * ACTION 5B: Cancel Expired Recruiting Circle & Unlock Refunds
   */
  const executeCancelExpiredCircle = useCallback(
    async (circle: CircleItem): Promise<{ txHash: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        const signer = await requireLiveSigner();
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'cancelExpiredCircle',
          account: signer.account,
          chain: activeFujiChain,
          gas: 400_000n,
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
            txType: TransactionType.CANCEL_CIRCLE,
            contractAddress: circleAddress,
            senderAddress: currentUser?.walletAddress,
            circleId: circle.id,
          });
        } catch (e) {
          console.warn('[AvaHui] transactionApi.track error:', e);
        }
      }

      await cancelMutation.mutateAsync({
        circleId: circle.id,
        skipMock: liveConfirmed,
      });
      return { txHash };
    },
    [cancelMutation, currentUser?.walletAddress, requireLiveSigner],
  );

  /**
   * ACTION 6: Create New Circle (Draft -> Factory.createCircle -> configureSecurity -> Auto Join Slot #1 -> Track)
   */
  const executeCreateCircle = useCallback(
    async (
      values: CreateCircleFormInput,
    ): Promise<{ txHash: string; newCircle?: { id: string } }> => {
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

      const trimmedInvite = values.inviteCode?.trim() || '';
      const inviteHash =
        values.isPrivateInvite && trimmedInvite
          ? keccak256(toBytes(trimmedInvite))
          : ZERO_BYTES32;

      if (!isMockMode) {
        const factoryAddress = requireConfiguredContractAddress(
          frontendEnv.factoryAddress,
          'AvaHuiFactory',
        );
        const usdcAddress = requireConfiguredContractAddress(
          frontendEnv.usdcTokenAddress,
          'MockUSDC',
        );
        const signer = await requireLiveSigner();

        try {
          draftRes = await circleApi.createDraft({
            name: values.name,
            description: values.description,
            creatorAddress: signer.account,
            tokenAddress: usdcAddress,
            allocationMode: values.allocationMode,
            maxMembers: values.maxMembers,
            contributionAmount: contributionBaseUnits.toString(),
            collateralAmount: collateralBaseUnits.toString(),
            roundDurationSeconds: values.roundDurationSeconds,
            biddingDurationSeconds: values.biddingDurationSeconds,
            gracePeriodSeconds: values.gracePeriodSeconds,
            minBid: minBidBaseUnits.toString(),
            maxBid: maxBidBaseUnits.toString(),
            isPrivateInvite: Boolean(values.isPrivateInvite),
            inviteCode: values.isPrivateInvite ? trimmedInvite : undefined,
            requireTeam1Attestation: Boolean(values.requireTeam1Attestation),
            isSealedBid:
              values.isSealedBid ?? values.allocationMode === AllocationMode.BIDDING,
            enableYieldVault: values.enableYieldVault ?? true,
          });
        } catch (err) {
          console.warn('[AvaHui] Failed to create circle draft:', err);
        }

        const metadataId = draftRes?.metadataId || `meta_${Date.now()}`;
        const startDeadline = BigInt(
          draftRes?.startDeadlineUnix || Math.floor(Date.now() / 1000) + 7 * 86400,
        );

        txHash = await signer.client.writeContract({
          address: factoryAddress,
          abi: AvaHuiFactoryABI,
          functionName: 'createCircle',
          args: [
            {
              metadataId,
              name: values.name,
              token: usdcAddress,
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

        if (deployedCircleAddress) {
          if (values.isPrivateInvite && trimmedInvite) {
            saveCreatorInviteCode(
              [deployedCircleAddress, draftRes?.id, metadataId],
              trimmedInvite,
            );
          }

          if (values.enableYieldVault === false) {
            const vaultTx = await signer.client.writeContract({
              address: deployedCircleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'setYieldVault',
              args: [ZERO_ADDRESS],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: vaultTx });
          }

          const needsSecurityConfig =
            Boolean(values.isPrivateInvite && inviteHash !== ZERO_BYTES32) ||
            Boolean(values.requireTeam1Attestation);

          if (needsSecurityConfig) {
            const verifierAddr = values.requireTeam1Attestation
              ? requireConfiguredContractAddress(
                  frontendEnv.sybilVerifierAddress,
                  'Team1AttestationVerifier',
                )
              : frontendEnv.sybilVerifierAddress;
            const secTx = await signer.client.writeContract({
              address: deployedCircleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'configureSecurity',
              args: [
                inviteHash,
                Boolean(values.requireTeam1Attestation),
                verifierAddr,
              ],
              account: signer.account,
              chain: activeFujiChain,
            });
            await publicClient.waitForTransactionReceipt({ hash: secTx });
          }

          await ensureSufficientAllowance(
            signer.account,
            deployedCircleAddress,
            collateralBaseUnits,
            draftRes?.id,
          );

          if (needsSecurityConfig) {
            const nullifier = (currentUser?.identityNullifier ||
              ZERO_BYTES32) as `0x${string}`;
            const joinTx = await signer.client.writeContract({
              address: deployedCircleAddress,
              abi: AvaHuiCircleABI,
              functionName: 'joinCircleProtected',
              args: [trimmedInvite, nullifier],
              account: signer.account,
              chain: activeFujiChain,
              gas: 500_000n,
            });
            await publicClient.waitForTransactionReceipt({ hash: joinTx });
          } else {
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
        }

        liveConfirmed = true;
      } else {
        txHash = generateMockTxHash();
      }

      if (!isMockMode && txHash) {
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
    [
      createCircleMutation,
      currentUser?.identityNullifier,
      currentUser?.walletAddress,
      ensureSufficientAllowance,
      requireLiveSigner,
    ],
  );

  /**
   * ACTION 7 (V2): Sealed-Bid Phase 1 — Commit Cryptographic Bid Hash
   * Saves salt locally BEFORE tx (committed=false) and marks committed=true only after receipt.
   */
  const executeCommitBid = useCallback(
    async (
      circle: CircleItem,
      roundNumber: number,
      bidAmountUsdc: number,
    ): Promise<{ txHash: string; commitment: string; salt: string }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const signer = !isMockMode ? await requireLiveSigner() : null;
      const bidderAddress = (signer?.account ||
        currentUser?.walletAddress ||
        '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1') as `0x${string}`;
      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);
      const salt = generateCryptoSalt();

      const commitment = keccak256(
        encodePacked(
          ['address', 'uint8', 'address', 'uint256', 'bytes32'],
          [circleAddress, roundNumber, bidderAddress, bidAmountBaseUnits, salt],
        ),
      );

      const storageKey = `avahui_sealed_bid_${circle.id}_${roundNumber}_${bidderAddress.toLowerCase()}`;
      const draftRecord: SavedSealedBidRecord = {
        circleId: circle.id,
        roundNumber,
        bidAmountUsdc,
        salt,
        commitment,
        committed: false,
        revealed: false,
        committedAt: new Date().toISOString(),
      };
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify(draftRecord));
      }

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && signer) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'commitBid',
          args: [roundNumber, commitment],
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

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ ...draftRecord, committed: true }),
        );
      }

      if (!isMockMode && txHash) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.COMMIT_BID,
            contractAddress: circleAddress,
            senderAddress: bidderAddress,
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
    [commitBidMutation, currentUser?.walletAddress, requireLiveSigner],
  );

  /**
   * ACTION 8 (V2): Sealed-Bid Phase 2 — Reveal Secret Bid + Salt
   * Only marks `revealed = true` AFTER on-chain confirmation!
   */
  const executeRevealBid = useCallback(
    async (
      circle: CircleItem,
      roundNumber: number,
      override?: number | { bidAmountUsdc?: number; salt?: string },
    ): Promise<{ txHash: string; bidAmountUsdc: number }> => {
      const circleAddress = (circle.contractAddress || frontendEnv.factoryAddress) as `0x${string}`;
      const signer = !isMockMode ? await requireLiveSigner() : null;
      const bidderAddress = (signer?.account ||
        currentUser?.walletAddress ||
        '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1') as `0x${string}`;
      const storageKey = `avahui_sealed_bid_${circle.id}_${roundNumber}_${bidderAddress.toLowerCase()}`;

      let savedRecord: SavedSealedBidRecord | null = null;
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(storageKey);
        if (raw) {
          try {
            savedRecord = JSON.parse(raw) as SavedSealedBidRecord;
          } catch {
            savedRecord = null;
          }
        }
      }

      const overrideObj =
        typeof override === 'number'
          ? { bidAmountUsdc: override }
          : override || {};

      const bidAmountUsdc =
        overrideObj.bidAmountUsdc ?? savedRecord?.bidAmountUsdc;
      const salt = (overrideObj.salt?.trim() || savedRecord?.salt) as
        | `0x${string}`
        | undefined;

      if (!bidAmountUsdc || !salt || !/^0x[a-fA-F0-9]{64}$/.test(salt)) {
        throw new Error(
          'Không tìm thấy Salt đấu giá kín trên trình duyệt này. Vui lòng nhập hoặc tải lên file sao lưu Salt để mở niêm phong.',
        );
      }

      const bidAmountBaseUnits = parseUnits(String(bidAmountUsdc), 6);

      let txHash: string | null = null;
      let liveConfirmed = false;

      if (!isMockMode && signer) {
        if (!circle.contractAddress) {
          throw new Error('Dây hụi chưa có địa chỉ Smart Contract.');
        }
        txHash = await signer.client.writeContract({
          address: circleAddress,
          abi: AvaHuiCircleABI,
          functionName: 'revealBid',
          args: [roundNumber, bidAmountBaseUnits, salt],
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

      // Mark revealed ONLY AFTER tx confirmed
      if (typeof window !== 'undefined') {
        const updatedRecord: SavedSealedBidRecord = {
          circleId: circle.id,
          roundNumber,
          bidAmountUsdc,
          salt,
          commitment:
            savedRecord?.commitment ||
            keccak256(
              encodePacked(
                ['address', 'uint8', 'address', 'uint256', 'bytes32'],
                [circleAddress, roundNumber, bidderAddress, bidAmountBaseUnits, salt],
              ),
            ),
          committed: true,
          revealed: true,
          committedAt: savedRecord?.committedAt || new Date().toISOString(),
        };
        window.localStorage.setItem(storageKey, JSON.stringify(updatedRecord));
      }

      if (!isMockMode && txHash) {
        try {
          await transactionApi.trackTransaction({
            txHash,
            txType: TransactionType.REVEAL_BID,
            contractAddress: circleAddress,
            senderAddress: bidderAddress,
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
    [currentUser?.walletAddress, requireLiveSigner, revealBidMutation],
  );

  const getSavedSealedBid = useCallback(
    (circleId: string, roundNumber: number): SavedSealedBidRecord | null => {
      if (typeof window === 'undefined' || !currentUser?.walletAddress) return null;
      const storageKey = `avahui_sealed_bid_${circleId}_${roundNumber}_${currentUser.walletAddress.toLowerCase()}`;
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as SavedSealedBidRecord;
      } catch {
        return null;
      }
    },
    [currentUser?.walletAddress],
  );

  const importSealedBidBackup = useCallback(
    (circleId: string, roundNumber: number, bidAmountUsdc: number, salt: string) => {
      if (typeof window === 'undefined' || !currentUser?.walletAddress) return null;
      if (!/^0x[a-fA-F0-9]{64}$/.test(salt.trim())) {
        throw new Error('Salt phải là chuỗi hex 32-byte (0x + 64 ký tự hex).');
      }
      const storageKey = `avahui_sealed_bid_${circleId}_${roundNumber}_${currentUser.walletAddress.toLowerCase()}`;
      const record: SavedSealedBidRecord = {
        circleId,
        roundNumber,
        bidAmountUsdc,
        salt: salt.trim() as `0x${string}`,
        commitment: ZERO_BYTES32,
        committed: true,
        revealed: false,
        committedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(storageKey, JSON.stringify(record));
      return record;
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
    importSealedBidBackup,
    executeSettleRound,
    executeWithdrawCollateral,
    executeCancelExpiredCircle,
    executeCreateCircle,
    isJoining: joinMutation.isPending,
    isContributing: contributeMutation.isPending,
    isBidding:
      bidMutation.isPending ||
      commitBidMutation.isPending ||
      revealBidMutation.isPending,
    isCommittingBid: commitBidMutation.isPending,
    isRevealingBid: revealBidMutation.isPending,
    isSettling: settleMutation.isPending,
    isWithdrawing: withdrawMutation.isPending,
    isCancelling: cancelMutation.isPending,
    isCreating: createCircleMutation.isPending,
  };
}
