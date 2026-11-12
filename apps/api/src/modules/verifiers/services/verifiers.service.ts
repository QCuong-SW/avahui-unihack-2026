import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  createWalletClient,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AVALANCHE_FUJI_CHAIN,
  Team1AttestationVerifierABI,
} from '@avahui/blockchain';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import {
  createFujiPublicClient,
  createFujiRpcTransport,
} from '../../../common/utils/rpc.util';
import {
  IssueAttestationDto,
  RevokeAttestationDto,
  SignAttestationDto,
} from '../dto/verifier.dto';

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

@Injectable()
export class VerifiersService {
  private readonly logger = new Logger(VerifiersService.name);
  private readonly chainId = Number(process.env.CHAIN_ID || 43113);
  private readonly rpcUrl =
    process.env.AVALANCHE_RPC_URL || 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  private readonly publicClient: any = createFujiPublicClient(this.rpcUrl, 5000);

  constructor(private readonly prisma: PrismaService) {}

  private getVerifierAddress(): `0x${string}` | null {
    const addr = process.env.SYBIL_VERIFIER_ADDRESS?.trim();
    if (
      !addr ||
      !/^0x[a-fA-F0-9]{40}$/.test(addr) ||
      addr.toLowerCase() === ZERO_ADDRESS
    ) {
      return null;
    }
    return addr as `0x${string}`;
  }

  private getIssuerPrivateKey(): `0x${string}` | null {
    const isLocal =
      this.rpcUrl.includes('127.0.0.1') || this.rpcUrl.includes('localhost');
    const pk =
      process.env.VERIFIER_ISSUER_PRIVATE_KEY?.trim() ||
      (isLocal ? process.env.DEPLOYER_PRIVATE_KEY?.trim() : undefined);
    if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      return null;
    }
    return pk as `0x${string}`;
  }

  private resolveNullifier(
    walletAddress: string,
    explicitNullifier?: string,
  ): `0x${string}` {
    if (explicitNullifier) {
      return explicitNullifier.toLowerCase() as `0x${string}`;
    }
    return keccak256(toBytes(`TEAM1_AVAHUI_V1:${normalizeAddress(walletAddress)}`));
  }

  async getMyAttestationStatus(authUser: AuthenticatedUser) {
    const user = authUser.id
      ? await this.prisma.user.findUnique({ where: { id: authUser.id } })
      : await this.prisma.user.findUnique({
          where: { privyDid: authUser.privyDid },
        });

    const walletAddress = authUser.walletAddress
      ? normalizeAddress(authUser.walletAddress)
      : null;

    let onChainVerified = false;
    const verifierAddress = this.getVerifierAddress();
    if (
      verifierAddress &&
      walletAddress &&
      user?.identityNullifier &&
      !process.env.JEST_WORKER_ID
    ) {
      try {
        onChainVerified = (await this.publicClient.readContract({
          address: verifierAddress,
          abi: Team1AttestationVerifierABI,
          functionName: 'verifyMemberAttestation',
          args: [
            walletAddress as `0x${string}`,
            user.identityNullifier as `0x${string}`,
          ],
        })) as boolean;
      } catch {
        onChainVerified = false;
      }
    }

    const rawPending = (user as any)?.pendingVoucher as
      | { deadline?: string }
      | null
      | undefined;
    const isPendingValid =
      !user?.team1Verified &&
      Boolean(rawPending?.deadline) &&
      Number(rawPending?.deadline) > Math.floor(Date.now() / 1000);

    return {
      walletAddress,
      team1Verified: Boolean(user?.team1Verified),
      onChainVerified,
      identityNullifier: user?.identityNullifier ?? null,
      trustTier: user?.trustTier ?? 0,
      pendingVoucher: isPendingValid ? rawPending : null,
    };
  }

  async issueAttestation(
    actor: AuthenticatedUser,
    dto: IssueAttestationDto,
  ) {
    const walletAddress = normalizeAddress(dto.walletAddress);
    const identityNullifier = this.resolveNullifier(
      walletAddress,
      dto.identityNullifier,
    );
    const trustTier = dto.trustTier ?? 2;

    const walletRecord = await this.prisma.wallet.findUnique({
      where: { address: walletAddress },
      include: { user: true },
    });

    const existingNullifierOwner = await this.prisma.user.findUnique({
      where: { identityNullifier },
    });
    if (
      existingNullifierOwner &&
      walletRecord?.userId &&
      existingNullifierOwner.id !== walletRecord.userId
    ) {
      throw new ConflictException(
        'Identity nullifier is already bound to another user',
      );
    }

    let txHash: string | null = null;
    const verifierAddress = this.getVerifierAddress();
    const issuerKey = this.getIssuerPrivateKey();

    if (dto.dispatchOnChain !== false && verifierAddress && issuerKey) {
      const account = privateKeyToAccount(issuerKey);
      const walletClient: any = createWalletClient({
        account,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: createFujiRpcTransport(this.rpcUrl),
      });

      txHash = await walletClient.writeContract({
        address: verifierAddress,
        abi: Team1AttestationVerifierABI,
        functionName: 'issueAttestation',
        args: [walletAddress as `0x${string}`, identityNullifier, trustTier],
        account,
        chain: null,
      });
      await this.publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
      this.logger.log(
        `Verifier ${actor.privyDid} issued Team1 attestation for ${walletAddress} (tx=${txHash})`,
      );
    }

    if (walletRecord) {
      await this.prisma.user.update({
        where: { id: walletRecord.userId },
        data: {
          team1Verified: true,
          identityNullifier,
          trustTier,
          pendingVoucher: Prisma.DbNull,
        },
      });
    }

    return {
      walletAddress,
      identityNullifier,
      trustTier,
      team1Verified: true,
      txHash,
      issuedBy: actor.privyDid,
    };
  }

  async signAttestationVoucher(
    actor: AuthenticatedUser,
    dto: SignAttestationDto,
  ) {
    const verifierAddress = this.getVerifierAddress();
    const issuerKey = this.getIssuerPrivateKey();
    if (!verifierAddress || !issuerKey) {
      throw new BadRequestException(
        'SYBIL_VERIFIER_ADDRESS and VERIFIER_ISSUER_PRIVATE_KEY must be configured to sign EIP-712 attestations',
      );
    }

    const walletAddress = normalizeAddress(dto.walletAddress);
    const identityNullifier = this.resolveNullifier(
      walletAddress,
      dto.identityNullifier,
    );
    const trustTier = dto.trustTier ?? 2;
    const deadline = BigInt(
      Math.floor(Date.now() / 1000) + (dto.ttlSeconds ?? 3600),
    );

    const nonce = (await this.publicClient.readContract({
      address: verifierAddress,
      abi: Team1AttestationVerifierABI,
      functionName: 'nonces',
      args: [walletAddress as `0x${string}`],
    })) as bigint;

    const account = privateKeyToAccount(issuerKey);
    const signature = await account.signTypedData({
      domain: {
        name: 'Team1AttestationVerifier',
        version: '1',
        chainId: this.chainId,
        verifyingContract: verifierAddress,
      },
      types: {
        Team1Attestation: [
          { name: 'account', type: 'address' },
          { name: 'identityNullifier', type: 'bytes32' },
          { name: 'trustTier', type: 'uint8' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' },
        ],
      },
      primaryType: 'Team1Attestation',
      message: {
        account: walletAddress as `0x${string}`,
        identityNullifier,
        trustTier,
        nonce,
        deadline,
      },
    });

    this.logger.log(
      `Verifier ${actor.privyDid} signed EIP-712 Team1 voucher for ${walletAddress}`,
    );

    const voucher = {
      verifierAddress,
      account: walletAddress,
      identityNullifier,
      trustTier,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    };

    const walletRecord =
      typeof this.prisma.wallet?.findUnique === 'function'
        ? await this.prisma.wallet.findUnique({ where: { address: walletAddress } })
        : null;

    if (walletRecord && typeof this.prisma.user?.update === 'function') {
      await this.prisma.user.update({
        where: { id: walletRecord.userId },
        data: { pendingVoucher: voucher as unknown as Prisma.InputJsonValue },
      });
      if (typeof this.prisma.notification?.create === 'function') {
        await this.prisma.notification.create({
          data: {
            userId: walletRecord.userId,
            title: 'Đã có Voucher xác minh Team1 (EIP-712)',
            body: 'Verifier đã ký voucher Anti-Sybil cho ví của bạn. Mở mục Hồ sơ để bấm tự Claim on-chain.',
          },
        });
      }
    }

    return voucher;
  }

  async revokeAttestation(
    actor: AuthenticatedUser,
    dto: RevokeAttestationDto,
  ) {
    const walletAddress = normalizeAddress(dto.walletAddress);
    let txHash: string | null = null;

    const verifierAddress = this.getVerifierAddress();
    const issuerKey = this.getIssuerPrivateKey();

    if (dto.dispatchOnChain !== false && verifierAddress && issuerKey) {
      const account = privateKeyToAccount(issuerKey);
      const walletClient: any = createWalletClient({
        account,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: createFujiRpcTransport(this.rpcUrl),
      });
      txHash = await walletClient.writeContract({
        address: verifierAddress,
        abi: Team1AttestationVerifierABI,
        functionName: 'revokeAttestation',
        args: [walletAddress as `0x${string}`],
        account,
        chain: null,
      });
      await this.publicClient.waitForTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
    }

    const walletRecord = await this.prisma.wallet.findUnique({
      where: { address: walletAddress },
    });
    if (walletRecord) {
      await this.prisma.user.update({
        where: { id: walletRecord.userId },
        data: { team1Verified: false, trustTier: 0 },
      });
    }

    return {
      walletAddress,
      team1Verified: false,
      txHash,
      revokedBy: actor.privyDid,
    };
  }
}
