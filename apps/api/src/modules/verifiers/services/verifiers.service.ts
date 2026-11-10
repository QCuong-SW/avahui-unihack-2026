import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  AVALANCHE_FUJI_CHAIN,
  Team1AttestationVerifierABI,
} from '@avahui/blockchain';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
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
    process.env.AVALANCHE_RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc';

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
        const publicClient: any = createPublicClient({
          chain: AVALANCHE_FUJI_CHAIN as any,
          transport: http(this.rpcUrl),
        });
        onChainVerified = (await publicClient.readContract({
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

    return {
      walletAddress,
      team1Verified: Boolean(user?.team1Verified),
      onChainVerified,
      identityNullifier: user?.identityNullifier ?? null,
      trustTier: user?.trustTier ?? 0,
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
      const publicClient: any = createPublicClient({
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: http(this.rpcUrl),
      });
      const walletClient: any = createWalletClient({
        account,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: http(this.rpcUrl),
      });

      txHash = await walletClient.writeContract({
        address: verifierAddress,
        abi: Team1AttestationVerifierABI,
        functionName: 'issueAttestation',
        args: [walletAddress as `0x${string}`, identityNullifier, trustTier],
        account,
        chain: null,
      });
      await publicClient.waitForTransactionReceipt({
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

    const publicClient: any = createPublicClient({
      chain: AVALANCHE_FUJI_CHAIN as any,
      transport: http(this.rpcUrl),
    });
    const nonce = (await publicClient.readContract({
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

    return {
      verifierAddress,
      account: walletAddress,
      identityNullifier,
      trustTier,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    };
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
      const publicClient: any = createPublicClient({
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: http(this.rpcUrl),
      });
      const walletClient: any = createWalletClient({
        account,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: http(this.rpcUrl),
      });
      txHash = await walletClient.writeContract({
        address: verifierAddress,
        abi: Team1AttestationVerifierABI,
        functionName: 'revokeAttestation',
        args: [walletAddress as `0x${string}`],
        account,
        chain: null,
      });
      await publicClient.waitForTransactionReceipt({
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
