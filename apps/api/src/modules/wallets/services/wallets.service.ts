import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  createWalletClient,
  formatEther,
  parseEther,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { AVALANCHE_FUJI_CHAIN } from '@avahui/blockchain';
import { PrismaService } from '../../../database/prisma.service';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { normalizeAddress } from '../../../common/utils/format.util';
import {
  createFujiPublicClient,
  createFujiRpcTransport,
} from '../../../common/utils/rpc.util';
import { UsersService } from '../../users/services/users.service';

const DRIP_AMOUNT_AVAX = '0.02';
const MIN_ELIGIBLE_BALANCE = parseEther('0.015');
const SERVER_MIN_RESERVE = parseEther('0.02');
const DRIP_COOLDOWN_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class WalletsService {
  private readonly logger = new Logger(WalletsService.name);
  private readonly rpcUrl =
    process.env.AVALANCHE_RPC_URL || 'https://avalanche-fuji-c-chain-rpc.publicnode.com';
  private readonly publicClient: any = createFujiPublicClient(this.rpcUrl, 5000);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
  ) {}

  private getDripSignerKey(): `0x${string}` | null {
    const pk =
      process.env.GAS_DRIP_PRIVATE_KEY?.trim() ||
      process.env.KEEPER_PRIVATE_KEY?.trim();
    if (!pk || !/^0x[a-fA-F0-9]{64}$/.test(pk)) {
      return null;
    }
    return pk as `0x${string}`;
  }

  async getGasFaucetStatus(authUser: AuthenticatedUser) {
    const profile = await this.usersService.getCurrentUserProfile(authUser);
    const userRow = await this.prisma.user.findUnique({
      where: { id: profile.id },
      select: { lastGasDripAt: true },
    });
    const dripKey = this.getDripSignerKey();
    const walletAddress = profile.walletAddress
      ? normalizeAddress(profile.walletAddress)
      : null;

    const lastDripMs = userRow?.lastGasDripAt?.getTime() ?? 0;
    const nextEligibleAtMs = lastDripMs ? lastDripMs + DRIP_COOLDOWN_MS : 0;
    const cooldownActive = nextEligibleAtMs > Date.now();

    let currentBalanceWei = 0n;
    if (walletAddress && !process.env.JEST_WORKER_ID) {
      try {
        currentBalanceWei = await this.publicClient.getBalance({
          address: walletAddress as `0x${string}`,
        });
      } catch {
        currentBalanceWei = 0n;
      }
    }

    return {
      configured: Boolean(dripKey),
      walletAddress,
      currentAvaxBalance: formatEther(currentBalanceWei),
      dripAmountAvax: DRIP_AMOUNT_AVAX,
      eligible:
        Boolean(dripKey) &&
        Boolean(walletAddress) &&
        !cooldownActive &&
        currentBalanceWei < MIN_ELIGIBLE_BALANCE,
      cooldownActive,
      nextEligibleAt: cooldownActive
        ? new Date(nextEligibleAtMs).toISOString()
        : null,
    };
  }

  /** Sends a small capped Fuji gas stipend to newly onboarded Privy wallets (< 0.015 AVAX). */
  async dripTestnetGas(authUser: AuthenticatedUser) {
    const dripKey = this.getDripSignerKey();
    if (!dripKey) {
      throw new ServiceUnavailableException(
        'Gas dripper server key chưa được cấu hình.',
      );
    }

    const profile = await this.usersService.getCurrentUserProfile(authUser);
    const walletAddress = profile.walletAddress
      ? normalizeAddress(profile.walletAddress)
      : null;
    if (!walletAddress) {
      throw new BadRequestException(
        'Tài khoản chưa có địa chỉ ví để nhận AVAX phí gas.',
      );
    }

    const userRow = await this.prisma.user.findUnique({
      where: { id: profile.id },
      select: { lastGasDripAt: true },
    });
    if (userRow?.lastGasDripAt) {
      const elapsed = Date.now() - userRow.lastGasDripAt.getTime();
      if (elapsed < DRIP_COOLDOWN_MS) {
        const hoursLeft = Math.ceil((DRIP_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
        throw new BadRequestException(
          `Mỗi tài khoản chỉ được nhận gas miễn phí 1 lần / 24h (vui lòng thử lại sau ~${hoursLeft} giờ).`,
        );
      }
    }

    const recipientBal = await this.publicClient.getBalance({
      address: walletAddress as `0x${string}`,
    });
    if (recipientBal >= MIN_ELIGIBLE_BALANCE) {
      throw new BadRequestException(
        `Ví của bạn hiện đã có ${formatEther(recipientBal)} AVAX đủ dùng phí gas.`,
      );
    }

    const dripAccount = privateKeyToAccount(dripKey);
    const dripAmount = parseEther(DRIP_AMOUNT_AVAX);
    const serverBal = await this.publicClient.getBalance({
      address: dripAccount.address,
    });
    if (serverBal < dripAmount + SERVER_MIN_RESERVE) {
      throw new ServiceUnavailableException(
        'Quỹ gas server trên Fuji hiện không đủ số dư dự phòng. Vui lòng dùng Avalanche Fuji Faucet.',
      );
    }

    // Reserve cooldown timestamp before sending tx to prevent concurrent double-drip
    const claimed = await this.prisma.user.updateMany({
      where: {
        id: profile.id,
        OR: [
          { lastGasDripAt: null },
          { lastGasDripAt: { lte: new Date(Date.now() - DRIP_COOLDOWN_MS) } },
        ],
      },
      data: { lastGasDripAt: new Date() },
    });
    if (claimed.count !== 1) {
      throw new BadRequestException(
        'Yêu cầu nhận gas đang được xử lý hoặc vẫn trong thời gian cooldown 24h.',
      );
    }

    try {
      const walletClient: any = createWalletClient({
        account: dripAccount,
        chain: AVALANCHE_FUJI_CHAIN as any,
        transport: createFujiRpcTransport(this.rpcUrl),
      });
      const txHash = await walletClient.sendTransaction({
        to: walletAddress as `0x${string}`,
        value: dripAmount,
        account: dripAccount,
        chain: null,
      });
      await this.publicClient.waitForTransactionReceipt({ hash: txHash });

      await this.prisma.notification.create({
        data: {
          userId: profile.id,
          title: `Đã cấp +${DRIP_AMOUNT_AVAX} AVAX phí gas Fuji`,
          body: `Hệ thống đã chuyển ${DRIP_AMOUNT_AVAX} AVAX vào ví ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)} để bạn ký giao dịch on-chain.`,
        },
      });

      this.logger.log(
        `Dripped ${DRIP_AMOUNT_AVAX} AVAX gas to ${walletAddress} (tx=${txHash})`,
      );

      return {
        toAddress: walletAddress,
        amountAvax: DRIP_AMOUNT_AVAX,
        txHash,
      };
    } catch (err) {
      await this.prisma.user.update({
        where: { id: profile.id },
        data: { lastGasDripAt: userRow?.lastGasDripAt ?? null },
      });
      throw err;
    }
  }
}

