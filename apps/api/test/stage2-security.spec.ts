import * as crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllocationMode, UserRole } from '@avahui/shared';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, parseEther, toBytes } from 'viem';
import { PrivyAuthGuard } from '../src/guards/privy-auth.guard';
import { RolesGuard } from '../src/guards/roles.guard';
import { TokenVerifierService } from '../src/modules/auth/services/token-verifier.service';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { UsersService } from '../src/modules/users/services/users.service';
import { CirclesService } from '../src/modules/circles/services/circles.service';
import { TransactionsService } from '../src/modules/transactions/services/transactions.service';
import { BlockchainIndexerService } from '../src/modules/blockchain/services/blockchain-indexer.service';
import { AdminService } from '../src/modules/admin/services/admin.service';
import { NotificationsService } from '../src/modules/notifications/services/notifications.service';
import { VerifiersService } from '../src/modules/verifiers/services/verifiers.service';
import { AiService } from '../src/modules/ai/services/ai.service';
import { WalletsService } from '../src/modules/wallets/services/wallets.service';

describe('Stage 2 — Auth Verification, SIWE, RBAC Roles & Private Circle Security', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      ALLOW_DEV_MOCK_AUTH: 'false',
      PRIVY_APP_ID: '',
      PRIVY_APP_SECRET: '',
      PRIVY_VERIFICATION_KEY: '',
      BOOTSTRAP_ADMIN_EMAILS: '',
      AUTH_JWT_SECRET: 'test_super_secret_jwt_key_at_least_32_characters',
      AI_ENABLED: 'false',
      AI_API_KEY: '',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  function makeHttpContext(headers: Record<string, string>, user?: any) {
    const req: any = { headers, user };
    return {
      request: req,
      ctx: {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getHandler: () => (() => {}),
        getClass: () => class DummyController {},
      } as any,
    };
  }

  it('blocks missing tokens, Bearer 0x address spoofing, and fake unsigned JWTs', async () => {
    const mockPrisma: any = {
      user: { findUnique: jest.fn(() => null) },
      wallet: { findUnique: jest.fn(() => null) },
    };
    const verifier = new TokenVerifierService();
    const guard = new PrivyAuthGuard(mockPrisma, verifier);

    // 1. Missing Bearer token
    await expect(
      guard.canActivate(makeHttpContext({}).ctx),
    ).rejects.toThrow(UnauthorizedException);

    // 2. Address spoofing via Bearer 0x...
    await expect(
      guard.canActivate(
        makeHttpContext({
          authorization: 'Bearer 0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        }).ctx,
      ),
    ).rejects.toThrow(UnauthorizedException);

    // 3. Mock token
    await expect(
      guard.canActivate(
        makeHttpContext({ authorization: 'Bearer mock-token' }).ctx,
      ),
    ).rejects.toThrow(UnauthorizedException);

    // 4. Forged unsigned HS256 JWT
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: 'avahui-api',
        sub: 'did:privy:attacker',
        wallet_address: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    const forgedJwt = `${header}.${payload}.forged_signature`;

    await expect(
      guard.canActivate(
        makeHttpContext({ authorization: `Bearer ${forgedJwt}` }).ctx,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('verifies ES256 Privy JWTs cryptographically and enforces account suspension', async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();

    process.env.PRIVY_APP_ID = 'cm_real_privy_app_id';
    process.env.PRIVY_VERIFICATION_KEY = publicPem;

    const signEs256PrivyJwt = (sub: string) => {
      const header = Buffer.from(JSON.stringify({ alg: 'ES256', typ: 'JWT' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: 'privy.io',
          aud: 'cm_real_privy_app_id',
          sub,
          email: 'verifier@avahui.io',
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      ).toString('base64url');
      const input = `${header}.${payload}`;
      const sig = crypto
        .sign('sha256', Buffer.from(input), {
          key: privateKey,
          dsaEncoding: 'ieee-p1363',
        })
        .toString('base64url');
      return `${input}.${sig}`;
    };

    let activeState = true;
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn(({ where }) =>
          where.privyDid === 'did:privy:real_verifier_1'
            ? {
                id: 'usr_uuid_v1',
                privyDid: 'did:privy:real_verifier_1',
                email: 'verifier@avahui.io',
                role: 'VERIFIER',
                isActive: activeState,
                wallets: [
                  {
                    address: '0xffcf8fdee72ac11b5c542428b35eef5769c409f0',
                    isPrimary: true,
                  },
                ],
              }
            : null,
        ),
      },
      wallet: { findUnique: jest.fn(() => null) },
    };

    const verifier = new TokenVerifierService();
    const guard = new PrivyAuthGuard(mockPrisma, verifier);
    const token = signEs256PrivyJwt('did:privy:real_verifier_1');

    const { ctx, request } = makeHttpContext({
      authorization: `Bearer ${token}`,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user.role).toBe(UserRole.VERIFIER);
    expect(request.user.privyDid).toBe('did:privy:real_verifier_1');

    // Suspended user is blocked with 403 Forbidden
    activeState = false;
    await expect(
      guard.canActivate(makeHttpContext({ authorization: `Bearer ${token}` }).ctx),
    ).rejects.toThrow(ForbiddenException);
  });

  it('completes SIWE nonce -> personal_sign -> JWT issuance and blocks nonce replay', async () => {
    const account = privateKeyToAccount(
      '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    );
    const nonces = new Map<string, any>();
    const users = new Map<string, any>();
    const wallets = new Map<string, any>();

    const mockPrisma: any = {
      authNonce: {
        create: jest.fn(({ data }) => {
          const rec = { id: `nonce_${nonces.size + 1}`, ...data, usedAt: null };
          nonces.set(data.nonce, rec);
          return rec;
        }),
        findUnique: jest.fn(({ where }) => nonces.get(where.nonce) || null),
        updateMany: jest.fn(({ where, data }) => {
          for (const rec of nonces.values()) {
            if (rec.id === where.id && rec.usedAt === null) {
              rec.usedAt = data.usedAt;
              return { count: 1 };
            }
          }
          return { count: 0 };
        }),
      },
      wallet: {
        findUnique: jest.fn(({ where }) => wallets.get(where.address) || null),
      },
      user: {
        findUnique: jest.fn(({ where }) => {
          for (const u of users.values()) {
            if (u.id === where.id || u.privyDid === where.privyDid) return u;
          }
          return null;
        }),
        upsert: jest.fn(({ where, create }) => {
          const existing = users.get(where.privyDid);
          if (existing) return existing;
          const user = {
            id: 'usr_siwe_1',
            privyDid: create.privyDid,
            email: null,
            displayName: create.displayName,
            role: UserRole.ADMIN,
            isActive: true,
            team1Verified: false,
            identityNullifier: null,
            trustTier: 0,
            wallets: [
              {
                id: 'wal_1',
                address: account.address.toLowerCase(),
                walletClientType: 'external_siwe',
                isPrimary: true,
              },
            ],
          };
          users.set(user.privyDid, user);
          wallets.set(account.address.toLowerCase(), {
            ...user.wallets[0],
            userId: user.id,
            user,
          });
          return user;
        }),
      },
      circleMember: { updateMany: jest.fn(() => ({ count: 0 })) },
    };

    const mockUsersService: any = {
      getUserProfileById: jest.fn(async (id: string) => {
        for (const u of users.values()) {
          if (u.id === id) return u;
        }
        return null;
      }),
    };

    const verifier = new TokenVerifierService();
    const authService = new AuthService(mockPrisma, mockUsersService, verifier);

    const challenge = await authService.requestSiweNonce(account.address);
    const signature = await account.signMessage({ message: challenge.message });

    const loginRes = await authService.verifySiweSignature({
      address: account.address,
      message: challenge.message,
      signature,
    });

    expect(loginRes.accessToken.split('.').length).toBe(3);

    // Guard accepts the newly signed SIWE JWT
    const guard = new PrivyAuthGuard(mockPrisma, verifier);
    const { ctx, request } = makeHttpContext({
      authorization: `Bearer ${loginRes.accessToken}`,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(request.user.walletAddress).toBe(account.address.toLowerCase());
    expect(request.user.role).toBe(UserRole.ADMIN);

    // Replay attack with same nonce fails
    await expect(
      authService.verifySiweSignature({
        address: account.address,
        message: challenge.message,
        signature,
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('enforces RolesGuard, blocks wallet hijacking in syncUser, and protects private circles', async () => {
    const reflector = {
      getAllAndOverride: jest.fn(() => [UserRole.ADMIN]),
    } as unknown as Reflector;
    const rolesGuard = new RolesGuard(reflector);

    expect(() =>
      rolesGuard.canActivate(
        makeHttpContext({}, { privyDid: 'did:privy:m1', role: UserRole.MEMBER }).ctx,
      ),
    ).toThrow(ForbiddenException);

    expect(
      rolesGuard.canActivate(
        makeHttpContext({}, { privyDid: 'did:privy:a1', role: UserRole.ADMIN }).ctx,
      ),
    ).toBe(true);

    // Wallet hijack protection in syncUser
    const mockPrismaSync: any = {
      wallet: {
        findUnique: jest.fn(() => ({
          userId: 'victim_id',
          user: { privyDid: 'did:privy:victim' },
        })),
      },
    };
    const authService = new AuthService(
      mockPrismaSync,
      {} as any,
      new TokenVerifierService(),
    );
    await expect(
      authService.syncUser(
        { privyDid: 'did:privy:attacker', role: UserRole.MEMBER },
        { walletAddress: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1' },
      ),
    ).rejects.toThrow(ConflictException);

    // Admin self-demotion blocked
    const adminService = new AdminService({
      user: { findUnique: jest.fn(() => ({ id: 'admin_1', role: 'ADMIN' })) },
    } as any);
    await expect(
      adminService.updateUserRole(
        { id: 'admin_1', privyDid: 'did:privy:admin_1', role: UserRole.ADMIN },
        'admin_1',
        { role: UserRole.MEMBER },
      ),
    ).rejects.toThrow(ForbiddenException);

    // Private circle read protection
    const inviteCode = 'VIP-UNIHACK';
    const privateCircle = {
      id: 'cir_priv_1',
      metadataId: 'meta_priv_1',
      contractAddress: null,
      chainId: 43113,
      name: 'Private VIP Circle',
      description: null,
      creatorAddress: '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
      tokenAddress: '0x5fbdb2315678afecb367f032d93f642f64180aa3',
      allocationMode: AllocationMode.FIXED,
      status: 'RECRUITING',
      maxMembers: 5,
      currentMemberCount: 1,
      currentRound: 0,
      totalRounds: 5,
      contributionAmount: 100000000n,
      collateralAmount: 100000000n,
      roundDurationSeconds: 300,
      biddingDurationSeconds: 0,
      gracePeriodSeconds: 60,
      startDeadline: new Date(),
      minBid: 0n,
      maxBid: 0n,
      totalDiscountPool: 0n,
      isPrivateInvite: true,
      inviteCodeHash: keccak256(toBytes(inviteCode)).toLowerCase(),
      requireTeam1Attestation: false,
      isHiddenByAdmin: false,
      creationTxHash: null,
      createdAt: new Date(),
      members: [],
      rounds: [],
    };

    const circlesService = new CirclesService({
      circle: { findFirst: jest.fn(() => privateCircle) },
      wallet: { findMany: jest.fn(() => []) },
    } as any);

    // Stranger without inviteCode is denied
    await expect(
      circlesService.getCircleById('cir_priv_1', {
        privyDid: 'did:privy:stranger',
        walletAddress: '0xd03ea8624c8c5987235048901fb614fdca89b117',
        role: UserRole.MEMBER,
      }),
    ).rejects.toThrow(ForbiddenException);

    // Caller with valid inviteCode is allowed
    const allowed = await circlesService.getCircleById(
      'cir_priv_1',
      undefined,
      inviteCode,
    );
    expect(allowed.name).toBe('Private VIP Circle');
    expect(allowed.isPrivateInvite).toBe(true);
  });

  it('verifies Privy linked wallet ownership via Privy server lookup during syncUser', async () => {
    process.env.PRIVY_APP_ID = 'cm_real_privy_app';
    process.env.PRIVY_APP_SECRET = 'privy_app_secret_real_test_value';

    const verifier = new TokenVerifierService();
    jest.spyOn(verifier, 'fetchPrivyUserIdentity').mockResolvedValue({
      privyDid: 'did:privy:real_user_99',
      verifiedWallets: ['0x1111111111111111111111111111111111111111'],
      email: 'verified.privy@avahui.io',
      displayName: 'Verified Privy User',
    });

    const createdUsers: any[] = [];
    const mockPrisma: any = {
      wallet: {
        findUnique: jest.fn(() => null),
        create: jest.fn(async ({ data }) => data),
      },
      user: {
        upsert: jest.fn(async ({ create }) => {
          const u = { id: `usr_real_${createdUsers.length + 1}`, ...create };
          createdUsers.push(u);
          return u;
        }),
      },
      circleMember: { updateMany: jest.fn(async () => ({ count: 0 })) },
    };
    const mockUsersService: any = {
      getUserProfileById: jest.fn(async (id: string) =>
        createdUsers.find((u) => u.id === id),
      ),
    };

    const authService = new AuthService(mockPrisma, mockUsersService, verifier);
    const authUser = {
      privyDid: 'did:privy:real_user_99',
      role: UserRole.MEMBER,
      authType: 'privy' as const,
      tokenWalletVerified: false,
    };

    // Unlinked wallet address must be rejected even with a valid Privy JWT
    await expect(
      authService.syncUser(authUser, {
        walletAddress: '0x2222222222222222222222222222222222222222',
        email: 'spoofed@evil.com',
      }),
    ).rejects.toThrow(ForbiddenException);

    // Verified linked wallet succeeds and uses Privy server email/displayName
    const profile = await authService.syncUser(authUser, {
      walletAddress: '0x1111111111111111111111111111111111111111',
      email: 'spoofed@evil.com',
    });
    expect(profile.email).toBe('verified.privy@avahui.io');
    expect(profile.displayName).toBe('Verified Privy User');
    expect(profile.role).toBeUndefined();

    // Only server-verified Privy email in BOOTSTRAP_ADMIN_EMAILS receives ADMIN
    process.env.BOOTSTRAP_ADMIN_EMAILS = 'admin@avahui.io';
    jest.spyOn(verifier, 'fetchPrivyUserIdentity').mockResolvedValueOnce({
      privyDid: 'did:privy:real_admin_1',
      verifiedWallets: ['0x3333333333333333333333333333333333333333'],
      email: 'admin@avahui.io',
      displayName: 'Real Admin',
    });
    const adminProfile = await authService.syncUser(
      {
        privyDid: 'did:privy:real_admin_1',
        role: UserRole.MEMBER,
        authType: 'privy',
        tokenWalletVerified: false,
      },
      {
        walletAddress: '0x3333333333333333333333333333333333333333',
      },
    );
    expect(adminProfile.role).toBe(UserRole.ADMIN);

    // Sync without walletAddress yet still stores verified email & ADMIN role
    jest.spyOn(verifier, 'fetchPrivyUserIdentity').mockResolvedValueOnce({
      privyDid: 'did:privy:real_admin_nowallet',
      verifiedWallets: [],
      email: 'admin@avahui.io',
      displayName: 'No Wallet Admin',
    });
    const noWalletProfile = await authService.syncUser(
      {
        privyDid: 'did:privy:real_admin_nowallet',
        role: UserRole.MEMBER,
        authType: 'privy',
        tokenWalletVerified: false,
      },
      {},
    );
    expect(noWalletProfile.email).toBe('admin@avahui.io');
    expect(noWalletProfile.role).toBe(UserRole.ADMIN);
  });

  it('enriches and promotes Privy bootstrap ADMIN profile even when /users/me runs before /auth/sync', async () => {
    process.env.PRIVY_APP_ID = 'cm_real_privy_app';
    process.env.PRIVY_APP_SECRET = 'privy_app_secret_real_test_value';
    process.env.BOOTSTRAP_ADMIN_EMAILS = 'admin@avahui.io';

    const verifier = new TokenVerifierService();
    jest.spyOn(verifier, 'fetchPrivyUserIdentity').mockResolvedValue({
      privyDid: 'did:privy:first_admin',
      verifiedWallets: ['0x4444444444444444444444444444444444444444'],
      email: 'admin@avahui.io',
      displayName: 'First Admin',
    });

    let storedUser: any = {
      id: 'usr_existing_1',
      privyDid: 'did:privy:first_admin',
      role: UserRole.MEMBER,
      isActive: true,
      email: null,
      displayName: 'AvaHui Builder',
      avatarUrl: null,
      team1Verified: false,
      identityNullifier: null,
      trustTier: 0,
      wallets: [],
    };
    const mockPrisma: any = {
      user: {
        findUnique: jest.fn(async () => storedUser),
        update: jest.fn(async ({ data }) => {
          storedUser = { ...storedUser, ...data };
          return storedUser;
        }),
      },
      wallet: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => {
          storedUser.wallets = [{ id: 'w1', ...data }];
          return storedUser.wallets[0];
        }),
      },
      circleMember: { count: jest.fn(async () => 0) },
      contribution: { aggregate: jest.fn(async () => ({ _sum: { amount: 0n } })) },
      collateral: { aggregate: jest.fn(async () => ({ _sum: { currentLockedAmount: 0n } })) },
      payout: { aggregate: jest.fn(async () => ({ _sum: { netAmount: 0n } })) },
    };

    const usersService = new UsersService(mockPrisma, verifier);
    const profile = await usersService.getCurrentUserProfile({
      privyDid: 'did:privy:first_admin',
      role: UserRole.MEMBER,
      authType: 'privy',
      tokenWalletVerified: false,
    });

    expect(profile.email).toBe('admin@avahui.io');
    expect(profile.displayName).toBe('First Admin');
    expect(profile.role).toBe(UserRole.ADMIN);
    expect(profile.walletAddress).toBe('0x4444444444444444444444444444444444444444');
  });

  it('prevents getMyTransactions IDOR leak when user has no linked wallets', async () => {
    const findManyMock = jest.fn(async () => [{ id: 'tx_other_user' }]);
    const txService = new TransactionsService({
      wallet: { findMany: jest.fn(async () => []) },
      blockchainTransaction: { findMany: findManyMock },
    } as any);

    const results = await txService.getMyTransactions({
      id: 'usr_nowallet',
      privyDid: 'did:privy:nowallet',
      role: UserRole.MEMBER,
      walletAddress: null,
    });

    expect(results).toEqual([]);
    expect(findManyMock).not.toHaveBeenCalled();
  });

  it('persists V2 circle flags and syncs Team1 attestation & yield events in indexer', async () => {
    let createdDraft: any = null;
    const circlesService = new CirclesService({
      wallet: { findMany: jest.fn(async () => []) },
      circle: {
        create: jest.fn(async ({ data }) => {
          createdDraft = {
            id: 'cir_v2_1',
            ...data,
            totalDiscountPool: data.totalDiscountPool ?? '0',
            totalYieldEarned: '0',
            createdAt: new Date(),
            members: [],
            rounds: [],
          };
          return createdDraft;
        }),
        findFirst: jest.fn(async () => createdDraft),
      },
    } as any);

    const draft = await circlesService.createDraft(
      {
        privyDid: 'did:privy:creator_v2',
        walletAddress: '0x1111111111111111111111111111111111111111',
      },
      {
        name: 'V2 Open Bid No Vault',
        allocationMode: AllocationMode.BIDDING,
        maxMembers: 5,
        contributionAmount: '50000000',
        collateralAmount: '50000000',
        roundDurationSeconds: 300,
        biddingDurationSeconds: 180,
        gracePeriodSeconds: 60,
        isSealedBid: false,
        enableYieldVault: false,
      },
    );

    expect(draft.circle.isSealedBid).toBe(false);
    expect(draft.circle.enableYieldVault).toBe(false);
    expect(draft.circle.accruedYieldFormatted).toBe('0.00');

    const storedUser: any = {
      id: 'usr_t1',
      team1Verified: false,
      identityNullifier: null,
      trustTier: 0,
    };
    const dbEvents = new Set<string>();
    const indexer = new BlockchainIndexerService({
      blockchainEvent: {
        findUnique: jest.fn(async ({ where }) =>
          dbEvents.has(`${where.chainId_txHash_logIndex.txHash}:${where.chainId_txHash_logIndex.logIndex}`)
            ? { id: 'ev' }
            : null,
        ),
        create: jest.fn(async ({ data }) => {
          dbEvents.add(`${data.txHash}:${data.logIndex}`);
          return data;
        }),
      },
      wallet: {
        findUnique: jest.fn(async () => ({ userId: 'usr_t1' })),
      },
      user: {
        update: jest.fn(async ({ data }) => Object.assign(storedUser, data)),
      },
      circle: {
        findUnique: jest.fn(async () => createdDraft),
        update: jest.fn(async ({ data }) => Object.assign(createdDraft, data)),
      },
      circleMember: {
        findMany: jest.fn(async () => []),
      },
      $transaction: jest.fn(async (cb) => cb({
        blockchainEvent: {
          create: jest.fn(async ({ data }) => {
            dbEvents.add(`${data.txHash}:${data.logIndex}`);
            return data;
          }),
        },
        wallet: { findUnique: jest.fn(async () => ({ userId: 'usr_t1' })) },
        user: { update: jest.fn(async ({ data }) => Object.assign(storedUser, data)) },
        circle: {
          findUnique: jest.fn(async () => createdDraft),
          update: jest.fn(async ({ data }) => Object.assign(createdDraft, data)),
        },
        circleMember: { findMany: jest.fn(async () => []) },
      })),
    } as any);

    await indexer.processDecodedEvent({
      chainId: 43113,
      txHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      logIndex: 0,
      blockNumber: 1n,
      blockTimestamp: new Date(),
      contractAddress: '0x2222222222222222222222222222222222222222',
      eventName: 'AttestationIssued',
      args: {
        account: '0x1111111111111111111111111111111111111111',
        identityNullifier: '0x' + 'ab'.repeat(32),
        trustTier: 2,
      },
    });
    expect(storedUser.team1Verified).toBe(true);
    expect(storedUser.trustTier).toBe(2);

    await indexer.processDecodedEvent({
      chainId: 43113,
      txHash: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      logIndex: 0,
      blockNumber: 2n,
      blockTimestamp: new Date(),
      contractAddress: '0x2222222222222222222222222222222222222222',
      eventName: 'AttestationRevoked',
      args: {
        account: '0x1111111111111111111111111111111111111111',
      },
    });
    expect(storedUser.team1Verified).toBe(false);
    expect(storedUser.trustTier).toBe(0);
  });

  it('marks all unread notifications as read via NotificationsService.markAllAsRead', async () => {
    const updateMany = jest.fn(async () => ({ count: 4 }));
    const mockPrisma: any = {
      notification: { updateMany },
    };
    const mockUsers: any = {
      getCurrentUserProfile: jest.fn(async () => ({ id: 'usr_notif_1' })),
    };

    const service = new NotificationsService(mockPrisma, mockUsers);
    const result = await service.markAllAsRead({ privyDid: 'did:privy:notif' });

    expect(result).toEqual({ updatedCount: 4 });
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: 'usr_notif_1', isRead: false },
      data: { isRead: true },
    });
  });

  it('stores signed EIP-712 Team1 voucher and exposes non-expired pendingVoucher in getMyAttestationStatus', async () => {
    const signerPk =
      '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
    const recipient = '0x1111111111111111111111111111111111111111';
    process.env.SYBIL_VERIFIER_ADDRESS =
      '0x2222222222222222222222222222222222222222';
    process.env.VERIFIER_ISSUER_PRIVATE_KEY = signerPk;

    let storedUser: any = {
      id: 'usr_v1',
      privyDid: 'did:privy:v1',
      team1Verified: false,
      identityNullifier: null,
      trustTier: 0,
      pendingVoucher: null,
    };
    const createdNotifs: any[] = [];

    const mockPrisma: any = {
      wallet: {
        findUnique: jest.fn(async ({ where }) =>
          where.address === recipient ? { userId: 'usr_v1', address: recipient } : null,
        ),
      },
      user: {
        findUnique: jest.fn(async () => storedUser),
        update: jest.fn(async ({ data }) => {
          storedUser = { ...storedUser, ...data };
          return storedUser;
        }),
      },
      notification: {
        create: jest.fn(async ({ data }) => {
          createdNotifs.push(data);
          return data;
        }),
      },
    };

    const verifiers = new VerifiersService(mockPrisma);
    (verifiers as any).publicClient = {
      readContract: jest.fn(async () => 0n),
    };

    const voucher = await verifiers.signAttestationVoucher(
      { privyDid: 'did:privy:admin' },
      { walletAddress: recipient, trustTier: 2, ttlSeconds: 3600 },
    );

    expect(voucher.account).toBe(recipient);
    expect(voucher.nonce).toBe('0');
    expect(voucher.signature).toMatch(/^0x[a-fA-F0-9]+$/);
    expect(storedUser.pendingVoucher).toEqual(voucher);
    expect(createdNotifs.length).toBe(1);

    const statusBefore = await verifiers.getMyAttestationStatus({
      id: 'usr_v1',
      privyDid: 'did:privy:v1',
      walletAddress: recipient,
    });
    expect(statusBefore.pendingVoucher).toEqual(voucher);

    // Expired vouchers or already-verified accounts should suppress pendingVoucher
    storedUser.pendingVoucher = {
      ...voucher,
      deadline: String(Math.floor(Date.now() / 1000) - 60),
    };
    const statusExpired = await verifiers.getMyAttestationStatus({
      id: 'usr_v1',
      privyDid: 'did:privy:v1',
      walletAddress: recipient,
    });
    expect(statusExpired.pendingVoucher).toBeNull();
  });

  it('syncs CirclePaused and CircleUnpaused events from BlockchainIndexerService', async () => {
    let circleState: any = {
      id: 'circle_pause_1',
      contractAddress: '0x3333333333333333333333333333333333333333',
      isPaused: false,
    };

    const indexer = new BlockchainIndexerService({
      blockchainEvent: {
        findUnique: jest.fn(async () => null),
      },
      $transaction: jest.fn(async (fn) =>
        fn({
          blockchainEvent: {
            findUnique: jest.fn(async () => null),
            create: jest.fn(async ({ data }) => data),
          },
          circle: {
            findUnique: jest.fn(async () => circleState),
            update: jest.fn(async ({ data }) => {
              circleState = { ...circleState, ...data };
              return circleState;
            }),
          },
          circleMember: { findMany: jest.fn(async () => []) },
        }),
      ),
    } as any);

    await indexer.processDecodedEvent({
      chainId: 43113,
      txHash: '0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      logIndex: 0,
      blockNumber: 10n,
      blockTimestamp: new Date(),
      contractAddress: circleState.contractAddress,
      eventName: 'CirclePaused',
      args: { guardian: '0x9999999999999999999999999999999999999999' },
    });
    expect(circleState.isPaused).toBe(true);

    await indexer.processDecodedEvent({
      chainId: 43113,
      txHash: '0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
      logIndex: 0,
      blockNumber: 11n,
      blockTimestamp: new Date(),
      contractAddress: circleState.contractAddress,
      eventName: 'CircleUnpaused',
      args: { guardian: '0x9999999999999999999999999999999999999999' },
    });
    expect(circleState.isPaused).toBe(false);
  });

  it('computes deterministic risk score, cycle yield, and bid recommendation in AiService.getCircleAdvisor', async () => {
    const mockCirclesService: any = {
      getCircleById: jest.fn(async () => ({
        id: 'circle_ai_1',
        name: 'Fuji Alpha',
        contributionAmountFormatted: '50.00',
        collateralAmountFormatted: '100.00',
        minBidFormatted: '2.00',
        maxBidFormatted: '20.00',
        allocationMode: AllocationMode.BIDDING,
        maxMembers: 5,
        currentRound: 1,
        roundDurationSeconds: 604800,
        requireTeam1Attestation: true,
        isSealedBid: true,
        enableYieldVault: true,
        isPaused: false,
        members: [{ defaultCount: 0 }, { defaultCount: 0 }],
        rounds: [
          {
            roundNumber: 1,
            bids: [{ bidAmountFormatted: '4.00' }],
          },
        ],
      })),
    };

    const aiService = new AiService(mockCirclesService);
    const advice = await aiService.getCircleAdvisor('circle_ai_1');

    // safetyScore = 55 + 20 (2x collateral) + 10 (Team1) + 8 (Sealed) + 7 (Yield) = 100 -> riskScore = 0
    expect(advice.circleId).toBe('circle_ai_1');
    expect(advice.riskScore).toBe(0);
    expect(advice.riskLevel).toBe('LOW');
    expect(advice.collateralRatio).toBe(2);
    expect(Number(advice.estimatedCycleYieldUsdc)).toBeGreaterThan(0);
    expect(advice.bidRecommendation).toMatchObject({
      minBidUsdc: 2,
      maxBidUsdc: 20,
      currentHighestBidUsdc: 4,
      optimalBidUsdc: 5,
    });
    expect(advice.aiPowered).toBe(false);
    expect(advice.model).toBe('deterministic-risk-engine-v1');
  });

  it('enforces 24h cooldown and sufficient-balance rejection in WalletsService.dripTestnetGas', async () => {
    process.env.GAS_DRIP_PRIVATE_KEY =
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

    const recipient = '0x1111111111111111111111111111111111111111';
    let lastDripAt: Date | null = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago

    const mockPrisma: any = {
      user: {
        findUnique: jest.fn(async () => ({ lastGasDripAt: lastDripAt })),
        updateMany: jest.fn(async () => ({ count: 1 })),
        update: jest.fn(async ({ data }) => {
          lastDripAt = data.lastGasDripAt;
          return { lastGasDripAt: lastDripAt };
        }),
      },
      notification: { create: jest.fn(async ({ data }) => data) },
    };
    const mockUsersService: any = {
      getCurrentUserProfile: jest.fn(async () => ({
        id: 'usr_gas_1',
        walletAddress: recipient,
      })),
    };

    const walletsService = new WalletsService(mockPrisma, mockUsersService);
    (walletsService as any).publicClient = {
      getBalance: jest.fn(async () => parseEther('0.02')),
      waitForTransactionReceipt: jest.fn(async () => ({ status: 'success' })),
    };

    // 1. Rejects when within 24h cooldown
    await expect(
      walletsService.dripTestnetGas({ privyDid: 'did:privy:gas1' }),
    ).rejects.toThrow(BadRequestException);

    // 2. Rejects when recipient wallet already has >= 0.015 AVAX
    lastDripAt = null;
    await expect(
      walletsService.dripTestnetGas({ privyDid: 'did:privy:gas1' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('hydrates getCircleConfig and paused status on CircleCreated from RPC', async () => {
    let savedCircle: any = null;
    const mockTx: any = {
      blockchainEvent: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
      },
      circle: {
        upsert: jest.fn(async ({ create }) => {
          savedCircle = create;
          return { id: 'circle_cfg_1', ...create };
        }),
      },
      blockchainTransaction: {
        findUnique: jest.fn(async () => null),
        create: jest.fn(async ({ data }) => data),
        update: jest.fn(async ({ data }) => data),
        upsert: jest.fn(async ({ create }) => create),
      },
    };
    const indexer = new BlockchainIndexerService({
      blockchainEvent: { findUnique: jest.fn(async () => null) },
      $transaction: jest.fn(async (fn) => fn(mockTx)),
    } as any);

    const startDl = 1_800_000_000n;
    (indexer as any).publicClient = {
      readContract: jest.fn(async ({ functionName }: { functionName: string }) => {
        if (functionName === 'inviteCodeHash') return '0x' + '00'.repeat(32);
        if (functionName === 'requireAttestation') return true;
        if (functionName === 'yieldVault') return '0x2222222222222222222222222222222222222222';
        if (functionName === 'paused') return true;
        if (functionName === 'getCircleConfig') {
          return [
            'meta_chain_cfg',
            'On-Chain Synced',
            '0x1111111111111111111111111111111111111111',
            '0x3333333333333333333333333333333333333333',
            600n,
            300n,
            120n,
            startDl,
            2_000000n,
            25_000000n,
          ];
        }
        return undefined;
      }),
    };

    await indexer.processDecodedEvent({
      chainId: 43113,
      txHash: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
      logIndex: 0,
      blockNumber: 55n,
      blockTimestamp: new Date(),
      contractAddress: '0x4444444444444444444444444444444444444444',
      eventName: 'CircleCreated',
      args: {
        circleAddress: '0x5555555555555555555555555555555555555555',
        creator: '0x1111111111111111111111111111111111111111',
        metadataId: 'meta_chain_cfg',
        name: 'On-Chain Synced',
        token: '0x3333333333333333333333333333333333333333',
        allocationMode: 1,
        maxMembers: 5,
        contributionAmount: '50000000',
        collateralAmount: '50000000',
      },
    });

    expect(savedCircle).toMatchObject({
      roundDurationSeconds: 600,
      biddingDurationSeconds: 300,
      gracePeriodSeconds: 120,
      minBid: '2000000',
      maxBid: '25000000',
      isPaused: true,
      requireTeam1Attestation: true,
      enableYieldVault: true,
    });
  });

  it('caches getEstimatedPoolYield in CirclesService for 15 seconds across repeated detail reads', async () => {
    const circleRow: any = {
      id: '9f8e7d6c-5b4a-3210-fedc-ba9876543210',
      metadataId: 'meta_cache_1',
      contractAddress: '0x6666666666666666666666666666666666666666',
      chainId: 43113,
      name: 'Cached Yield Circle',
      description: 'desc',
      creatorAddress: '0x1111111111111111111111111111111111111111',
      tokenAddress: '0x3333333333333333333333333333333333333333',
      allocationMode: 'FIXED',
      status: 'ACTIVE',
      maxMembers: 5,
      currentMemberCount: 5,
      currentRound: 1,
      totalRounds: 5,
      contributionAmount: BigInt(50_000000),
      collateralAmount: BigInt(50_000000),
      roundDurationSeconds: 300,
      biddingDurationSeconds: 0,
      gracePeriodSeconds: 60,
      startDeadline: new Date(),
      minBid: BigInt(0),
      maxBid: BigInt(0),
      totalDiscountPool: BigInt(0),
      isSealedBid: false,
      enableYieldVault: true,
      yieldApyBps: 650,
      totalYieldEarned: BigInt(0),
      isPrivateInvite: false,
      inviteCodeHash: null,
      requireTeam1Attestation: false,
      isPaused: false,
      isHiddenByAdmin: false,
      creationTxHash: '0x11',
      createdAt: new Date(),
      members: [],
      rounds: [],
    };
    const mockPrisma: any = {
      circle: { findFirst: jest.fn(async () => circleRow) },
      wallet: { findMany: jest.fn(async () => []) },
      user: { findMany: jest.fn(async () => []) },
    };
    const circlesService = new CirclesService(mockPrisma);
    const readContract = jest.fn(async () => 1_250000n);
    (circlesService as any).publicClient = { readContract };

    const first = await circlesService.getCircleById(circleRow.id);
    const second = await circlesService.getCircleById(circleRow.id);

    expect(first.accruedYieldFormatted).toBe('1.25');
    expect(second.accruedYieldFormatted).toBe('1.25');
    expect(readContract).toHaveBeenCalledTimes(1);
  });

  it('supports Gemini LLM response parsing and graceful fallback in AiService.getCircleAdvisor', async () => {
    process.env.AI_ENABLED = 'true';
    process.env.AI_API_KEY = 'test-gemini-key';
    process.env.AI_MODEL = 'gemini-2.5-flash';

    const mockCirclesService: any = {
      getCircleById: jest.fn(async () => ({
        id: 'circle_ai_gemini',
        name: 'Fuji Gemini Test',
        contributionAmountFormatted: '50.00',
        collateralAmountFormatted: '50.00',
        minBidFormatted: '2.00',
        maxBidFormatted: '25.00',
        allocationMode: AllocationMode.BIDDING,
        maxMembers: 5,
        currentRound: 1,
        roundDurationSeconds: 600,
        requireTeam1Attestation: false,
        isSealedBid: true,
        enableYieldVault: true,
        isPaused: false,
        members: [],
        rounds: [{ roundNumber: 1, bids: [] }],
      })),
    };

    const aiService = new AiService(mockCirclesService);
    const fetchSpy = jest.spyOn(global, 'fetch' as any);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'Dây hụi an toàn tốt. Mức đấu giá 10 mUSDC tối ưu.' }],
            },
          },
        ],
      }),
    } as any);

    const aiResult = await aiService.getCircleAdvisor('circle_ai_gemini');
    expect(aiResult.aiPowered).toBe(true);
    expect(aiResult.model).toBe('gemini-2.5-flash');
    expect(aiResult.summary).toContain('Dây hụi an toàn tốt');

    fetchSpy.mockRejectedValueOnce(new Error('Gemini timeout'));
    const fallbackResult = await aiService.getCircleAdvisor('circle_ai_gemini');
    expect(fallbackResult.aiPowered).toBe(false);
    expect(fallbackResult.model).toBe('deterministic-risk-engine-v1');

    fetchSpy.mockRestore();
  });
});

