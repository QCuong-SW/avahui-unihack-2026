import { apiFetch } from './client';

export interface AttestationStatusResponse {
  walletAddress: string | null;
  team1Verified: boolean;
  onChainVerified: boolean;
  identityNullifier: string | null;
  trustTier: number;
}

export interface IssueAttestationResponse {
  walletAddress: string;
  identityNullifier: string;
  trustTier: number;
  team1Verified: boolean;
  txHash: string | null;
  issuedBy: string;
}

export interface SignedAttestationVoucher {
  verifierAddress: `0x${string}`;
  account: `0x${string}`;
  identityNullifier: `0x${string}`;
  trustTier: number;
  nonce: string;
  deadline: string;
  signature: `0x${string}`;
}

export const verifierApi = {
  getMyStatus: () =>
    apiFetch<AttestationStatusResponse>('/verifiers/attestations/me', {
      method: 'GET',
    }),

  issueAttestation: (payload: {
    walletAddress: string;
    identityNullifier?: string;
    trustTier?: number;
    dispatchOnChain?: boolean;
  }) =>
    apiFetch<IssueAttestationResponse>('/verifiers/attestations/issue', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  signAttestationVoucher: (payload: {
    walletAddress: string;
    identityNullifier?: string;
    trustTier?: number;
    ttlSeconds?: number;
  }) =>
    apiFetch<SignedAttestationVoucher>('/verifiers/attestations/sign', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revokeAttestation: (payload: {
    walletAddress: string;
    dispatchOnChain?: boolean;
  }) =>
    apiFetch<{ walletAddress: string; team1Verified: boolean; txHash: string | null }>(
      '/verifiers/attestations/revoke',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),
};

