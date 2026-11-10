import * as crypto from 'crypto';
import { ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AllocationMode, UserRole } from '@avahui/shared';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, toBytes } from 'viem';
import { PrivyAuthGuard } from '../src/guards/privy-auth.guard';
import { RolesGuard } from '../src/guards/roles.guard';
import { TokenVerifierService } from '../src/modules/auth/services/token-verifier.service';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { CirclesService } from '../src/modules/circles/services/circles.service';
import { AdminService } from '../src/modules/admin/services/admin.service';

describe('Stage 2 — Auth Verification, SIWE, RBAC Roles & Private Circle Security', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      ALLOW_DEV_MOCK_AUTH: 'false',
      AUTH_JWT_SECRET: 'test_super_secret_jwt_key_at_least_32_characters',
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
});

