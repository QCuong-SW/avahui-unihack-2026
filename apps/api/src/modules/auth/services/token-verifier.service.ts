import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { UserRole } from '@avahui/shared';
import { normalizeAddress } from '../../../common/utils/format.util';

export interface VerifiedTokenPayload {
  privyDid: string;
  email?: string;
  walletAddress?: string;
  role?: UserRole;
  authType: 'privy' | 'siwe' | 'dev_mock';
  tokenWalletVerified: boolean;
}

export interface PrivyVerifiedUserIdentity {
  privyDid: string;
  verifiedWallets: string[];
  email?: string;
  displayName?: string;
}

interface JwkCacheEntry {
  keys: Map<string, crypto.KeyObject>;
  fetchedAt: number;
}

const JWKS_CACHE_TTL_MS = 10 * 60 * 1000;
const JWKS_MIN_REFRESH_INTERVAL_MS = 15 * 1000;

@Injectable()
export class TokenVerifierService {
  private readonly logger = new Logger(TokenVerifierService.name);
  private jwksCache: JwkCacheEntry | null = null;
  private warnedFallbackSecret = false;

  isDevMockAuthAllowed(): boolean {
    return (
      process.env.NODE_ENV !== 'production' &&
      String(process.env.ALLOW_DEV_MOCK_AUTH ?? 'false').toLowerCase() === 'true'
    );
  }

  hasRealPrivyServerCredentials(): boolean {
    const appId = process.env.PRIVY_APP_ID?.trim();
    const secret = process.env.PRIVY_APP_SECRET?.trim();
    if (
      !appId ||
      !secret ||
      appId.startsWith('mock_') ||
      appId === 'your_privy_app_id_here' ||
      secret.startsWith('mock_') ||
      secret === 'your_privy_app_secret_here'
    ) {
      return false;
    }
    return true;
  }

  /** Checks whether a server-verified email is allowlisted as a bootstrap ADMIN. */
  isBootstrapAdminEmail(email?: string | null): boolean {
    if (!email) return false;
    const configured = process.env.BOOTSTRAP_ADMIN_EMAILS || '';
    const allowlist = configured
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    return allowlist.includes(email.trim().toLowerCase());
  }

  async fetchPrivyUserIdentity(
    privyDid: string,
  ): Promise<PrivyVerifiedUserIdentity | null> {
    if (!this.hasRealPrivyServerCredentials() || !privyDid) {
      return null;
    }

    const appId = process.env.PRIVY_APP_ID!.trim();
    const secret = process.env.PRIVY_APP_SECRET!.trim();
    const basicToken = Buffer.from(`${appId}:${secret}`).toString('base64');

    try {
      const res = await fetch(
        `https://auth.privy.io/api/v1/users/${encodeURIComponent(privyDid)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${basicToken}`,
            'privy-app-id': appId,
          },
        },
      );
      if (!res.ok) {
        this.logger.warn(
          `Privy user lookup returned HTTP ${res.status} for ${privyDid}`,
        );
        return null;
      }

      const data = (await res.json()) as {
        id?: string;
        linked_accounts?: Array<Record<string, any>>;
      };
      const accounts = Array.isArray(data.linked_accounts)
        ? data.linked_accounts
        : [];

      const verifiedWallets = accounts
        .filter(
          (acc) =>
            acc?.type === 'wallet' &&
            typeof acc?.address === 'string' &&
            /^0x[a-fA-F0-9]{40}$/.test(acc.address),
        )
        .map((acc) => normalizeAddress(acc.address));

      const emailAcc = accounts.find(
        (acc) => acc?.type === 'email' && typeof acc?.address === 'string',
      );
      const googleAcc = accounts.find(
        (acc) => acc?.type === 'google_oauth' && typeof acc?.email === 'string',
      );

      return {
        privyDid: data.id || privyDid,
        verifiedWallets,
        email: emailAcc?.address || googleAcc?.email || undefined,
        displayName:
          typeof googleAcc?.name === 'string' && googleAcc.name.trim()
            ? googleAcc.name.trim()
            : undefined,
      };
    } catch (err) {
      this.logger.warn(
        `Privy user lookup failed for ${privyDid}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private getJwtSecret(): string {
    const configured = process.env.AUTH_JWT_SECRET?.trim();
    if (configured && configured.length >= 16) {
      return configured;
    }
    if (process.env.NODE_ENV === 'production') {
      throw new InternalServerErrorException(
        'AUTH_JWT_SECRET must be configured in production',
      );
    }
    if (!this.warnedFallbackSecret) {
      this.warnedFallbackSecret = true;
      this.logger.warn(
        'AUTH_JWT_SECRET not configured; using ephemeral local development secret for SIWE JWTs',
      );
    }
    return 'avahui_local_dev_siwe_jwt_secret_change_in_prod';
  }

  signSiweJwt(params: {
    privyDid: string;
    walletAddress: string;
    role?: UserRole;
    expiresInSeconds?: number;
  }): string {
    const now = Math.floor(Date.now() / 1000);
    const ttl = params.expiresInSeconds ?? 24 * 60 * 60;
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
      iss: 'avahui-api',
      typ: 'siwe',
      sub: params.privyDid,
      privyDid: params.privyDid,
      wallet_address: normalizeAddress(params.walletAddress),
      role: params.role ?? UserRole.MEMBER,
      iat: now,
      exp: now + ttl,
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signingInput = `${headerB64}.${payloadB64}`;
    const signature = crypto
      .createHmac('sha256', this.getJwtSecret())
      .update(signingInput)
      .digest('base64url');

    return `${signingInput}.${signature}`;
  }

  async verifyAccessToken(
    token: string,
    devWalletHeader?: string,
  ): Promise<VerifiedTokenPayload | null> {
    if (!token) return null;

    const parts = token.split('.');
    if (parts.length === 3) {
      try {
        const headerJson = Buffer.from(parts[0], 'base64url').toString('utf8');
        const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
        const header = JSON.parse(headerJson) as {
          alg?: string;
          kid?: string;
        };
        const payload = JSON.parse(payloadJson) as Record<string, any>;

        if (header.alg === 'HS256' && payload.iss === 'avahui-api') {
          return this.verifySiweJwtParts(parts[0], parts[1], parts[2], payload);
        }

        if (header.alg === 'ES256' || header.alg === 'RS256') {
          return await this.verifyPrivyJwtParts(
            parts[0],
            parts[1],
            parts[2],
            header,
            payload,
          );
        }
      } catch {
        return null;
      }
    }

    if (this.isDevMockAuthAllowed()) {
      return this.parseExplicitDevMockToken(token, devWalletHeader);
    }

    return null;
  }

  private verifySiweJwtParts(
    headerB64: string,
    payloadB64: string,
    signatureB64: string,
    payload: Record<string, any>,
  ): VerifiedTokenPayload | null {
    const signingInput = `${headerB64}.${payloadB64}`;
    const expectedSig = crypto
      .createHmac('sha256', this.getJwtSecret())
      .update(signingInput)
      .digest();
    const providedSig = Buffer.from(signatureB64, 'base64url');

    if (
      expectedSig.length !== providedSig.length ||
      !crypto.timingSafeEqual(expectedSig, providedSig)
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }

    const walletRaw = String(payload.wallet_address || '');
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletRaw)) {
      return null;
    }

    const privyDid = String(payload.sub || payload.privyDid || '');
    if (!privyDid) return null;

    return {
      privyDid,
      walletAddress: normalizeAddress(walletRaw),
      role: Object.values(UserRole).includes(payload.role)
        ? (payload.role as UserRole)
        : UserRole.MEMBER,
      authType: 'siwe',
      tokenWalletVerified: true,
    };
  }

  private async verifyPrivyJwtParts(
    headerB64: string,
    payloadB64: string,
    signatureB64: string,
    header: { alg?: string; kid?: string },
    payload: Record<string, any>,
  ): Promise<VerifiedTokenPayload | null> {
    const appId = process.env.PRIVY_APP_ID?.trim();
    const configuredPem = process.env.PRIVY_VERIFICATION_KEY?.trim();

    if (
      (!appId ||
        appId.startsWith('mock_') ||
        appId === 'your_privy_app_id_here') &&
      !configuredPem
    ) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) {
      return null;
    }
    if (payload.iss !== 'privy.io') {
      return null;
    }
    if (appId) {
      const audMatch = Array.isArray(payload.aud)
        ? payload.aud.includes(appId)
        : payload.aud === appId;
      if (!audMatch) return null;
    }

    const key = await this.resolvePrivyVerificationKey(
      appId,
      configuredPem,
      header.kid,
    );
    if (!key) return null;

    const signingInput = Buffer.from(`${headerB64}.${payloadB64}`, 'utf8');
    const sigBuf = Buffer.from(signatureB64, 'base64url');
    const isValid =
      header.alg === 'ES256'
        ? crypto.verify(
            'sha256',
            signingInput,
            { key, dsaEncoding: 'ieee-p1363' },
            sigBuf,
          )
        : crypto.verify('sha256', signingInput, key, sigBuf);

    if (!isValid) return null;

    const privyDid = String(payload.sub || '');
    if (!privyDid) return null;

    const claimWallet =
      typeof payload.wallet_address === 'string' &&
      /^0x[a-fA-F0-9]{40}$/.test(payload.wallet_address)
        ? normalizeAddress(payload.wallet_address)
        : undefined;

    return {
      privyDid,
      email: typeof payload.email === 'string' ? payload.email : undefined,
      walletAddress: claimWallet,
      authType: 'privy',
      tokenWalletVerified: Boolean(claimWallet),
    };
  }

  private async resolvePrivyVerificationKey(
    appId?: string,
    configuredPem?: string,
    kid?: string,
  ): Promise<crypto.KeyObject | null> {
    if (configuredPem) {
      const normalizedPem = configuredPem.replace(/\\n/g, '\n');
      return crypto.createPublicKey(normalizedPem);
    }

    if (!appId) return null;

    const now = Date.now();
    const cacheValid =
      this.jwksCache && now - this.jwksCache.fetchedAt < JWKS_CACHE_TTL_MS;

    if (cacheValid && this.jwksCache) {
      if (kid && this.jwksCache.keys.has(kid)) {
        return this.jwksCache.keys.get(kid) ?? null;
      }
      if (!kid && this.jwksCache.keys.size === 1) {
        return Array.from(this.jwksCache.keys.values())[0];
      }
      if (now - this.jwksCache.fetchedAt < JWKS_MIN_REFRESH_INTERVAL_MS) {
        return null;
      }
    }

    try {
      const jwksUrl = `https://auth.privy.io/api/v1/apps/${encodeURIComponent(appId)}/jwks.json`;
      const res = await fetch(jwksUrl, { method: 'GET' });
      if (!res.ok) return null;
      const body = (await res.json()) as { keys?: Array<Record<string, any>> };
      const keysMap = new Map<string, crypto.KeyObject>();
      for (const jwk of body.keys || []) {
        const keyObj = crypto.createPublicKey({
          key: jwk as any,
          format: 'jwk',
        });
        keysMap.set(String(jwk.kid || 'default'), keyObj);
      }
      this.jwksCache = { keys: keysMap, fetchedAt: now };

      if (kid && keysMap.has(kid)) {
        return keysMap.get(kid) ?? null;
      }
      return keysMap.size > 0 ? Array.from(keysMap.values())[0] : null;
    } catch (err) {
      this.logger.warn(
        `Failed to fetch Privy JWKS: ${(err as Error).message}`,
      );
      return null;
    }
  }

  private parseExplicitDevMockToken(
    token: string,
    devWalletHeader?: string,
  ): VerifiedTokenPayload | null {
    if (token === 'dev-token-usr_01HXYZ1') {
      return {
        privyDid: 'did:privy:usr_01',
        email: 'minh.nguyen@avahui.io',
        walletAddress: normalizeAddress(
          devWalletHeader && /^0x[a-fA-F0-9]{40}$/.test(devWalletHeader)
            ? devWalletHeader
            : '0x90f8bf6a479f320ead074411a4b0e7944ea8c9c1',
        ),
        authType: 'dev_mock',
        tokenWalletVerified: false,
      };
    }

    if (token.startsWith('dev-did:')) {
      const did = token.slice('dev-did:'.length).trim();
      if (!did) return null;
      return {
        privyDid: did.startsWith('did:privy:') ? did : `did:privy:${did}`,
        walletAddress:
          devWalletHeader && /^0x[a-fA-F0-9]{40}$/.test(devWalletHeader)
            ? normalizeAddress(devWalletHeader)
            : undefined,
        authType: 'dev_mock',
        tokenWalletVerified: false,
      };
    }

    return null;
  }
}

