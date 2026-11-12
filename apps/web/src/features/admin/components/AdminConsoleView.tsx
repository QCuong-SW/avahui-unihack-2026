'use client';

import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TransactionType, UserRole } from '@avahui/shared';
import { AvaHuiCircleABI } from '@avahui/blockchain';
import {
  SignedAttestationVoucher,
  adminApi,
  transactionApi,
  verifierApi,
} from '@/lib/api';
import { useAvaHuiState } from '@/hooks/useAvaHuiMockQuery';
import { useTxLifecycle } from '@/features/transactions/hooks/useTxLifecycle';
import {
  activeFujiChain,
  publicClient,
  resolveSignerClient,
} from '@/lib/wagmi/client';
import { shortenAddress } from '@/lib/utils';
import {
  AlertTriangle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Pause,
  Play,
  Shield,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react';

export function AdminConsoleView() {
  const queryClient = useQueryClient();
  const { data: state } = useAvaHuiState();
  const { runTransaction } = useTxLifecycle();

  const currentUser =
    state?.users.find((u) => u.id === state.currentUserId) || state?.users[0];
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const isVerifier =
    currentUser?.role === UserRole.VERIFIER || isAdmin;

  const [userSearch, setUserSearch] = useState('');
  const [attestWallet, setAttestWallet] = useState('');
  const [attestTier, setAttestTier] = useState(2);
  const [attestMessage, setAttestMessage] = useState<string | null>(null);
  const [attestError, setAttestError] = useState<string | null>(null);
  const [signedVoucher, setSignedVoucher] =
    useState<SignedAttestationVoucher | null>(null);
  const [copiedVoucher, setCopiedVoucher] = useState(false);

  const overviewQuery = useQuery({
    queryKey: ['avahui', 'admin', 'overview'],
    queryFn: () => adminApi.getOverview(),
    enabled: Boolean(isAdmin),
    retry: false,
  });

  const usersQuery = useQuery({
    queryKey: ['avahui', 'admin', 'users', userSearch],
    queryFn: () =>
      adminApi.listUsers({
        search: userSearch.trim() || undefined,
        limit: 50,
      }),
    enabled: Boolean(isAdmin),
    retry: false,
  });

  const circlesQuery = useQuery({
    queryKey: ['avahui', 'admin', 'circles'],
    queryFn: () => adminApi.listCircles({ limit: 50 }),
    enabled: Boolean(isAdmin),
    retry: false,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: UserRole }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      adminApi.updateUserStatus(userId, isActive),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
    },
  });

  const moderateCircleMutation = useMutation({
    mutationFn: ({
      circleId,
      isHiddenByAdmin,
      moderationReason,
    }: {
      circleId: string;
      isHiddenByAdmin: boolean;
      moderationReason?: string;
    }) =>
      adminApi.moderateCircle(circleId, {
        isHiddenByAdmin,
        moderationReason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
      queryClient.invalidateQueries({ queryKey: ['avahui', 'app-state'] });
    },
  });

  const issueAttestationMutation = useMutation({
    mutationFn: (payload: { walletAddress: string; trustTier: number }) =>
      verifierApi.issueAttestation({
        walletAddress: payload.walletAddress,
        trustTier: payload.trustTier,
        dispatchOnChain: true,
      }),
    onSuccess: (res) => {
      setAttestError(null);
      setAttestMessage(
        `Đã cấp chứng nhận Team1 cho ${shortenAddress(res.walletAddress)} (Tier ${res.trustTier})${res.txHash ? ` • tx=${shortenAddress(res.txHash, 6)}` : ''}`,
      );
      setAttestWallet('');
      queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
    },
    onError: (err: any) => {
      setAttestMessage(null);
      setAttestError(err?.message || 'Cấp chứng nhận Team1 thất bại.');
    },
  });

  const revokeAttestationMutation = useMutation({
    mutationFn: (walletAddress: string) =>
      verifierApi.revokeAttestation({ walletAddress, dispatchOnChain: true }),
    onSuccess: (res) => {
      setAttestError(null);
      setSignedVoucher(null);
      setAttestMessage(`Đã thu hồi chứng nhận Team1 của ${shortenAddress(res.walletAddress)}.`);
      queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
    },
    onError: (err: any) => {
      setAttestMessage(null);
      setAttestError(err?.message || 'Thu hồi chứng nhận thất bại.');
    },
  });

  const signVoucherMutation = useMutation({
    mutationFn: (payload: { walletAddress: string; trustTier: number }) =>
      verifierApi.signAttestationVoucher({
        walletAddress: payload.walletAddress,
        trustTier: payload.trustTier,
        ttlSeconds: 3600,
      }),
    onSuccess: (res) => {
      setAttestError(null);
      setSignedVoucher(res);
      setAttestMessage(
        `Đã ký Voucher EIP-712 cho ${shortenAddress(res.account)} (hiệu lực 1 giờ). User có thể bấm Claim ngay trong Hồ sơ.`,
      );
    },
    onError: (err: any) => {
      setAttestMessage(null);
      setSignedVoucher(null);
      setAttestError(err?.message || 'Ký Voucher EIP-712 thất bại.');
    },
  });

  const handleGuardianAction = async (
    circleId: string,
    contractAddress: string,
    action: 'pause' | 'unpause' | 'emergencyCancel',
  ) => {
    const labelMap = {
      pause: 'Guardian Pause',
      unpause: 'Guardian Unpause',
      emergencyCancel: 'Guardian Emergency Cancel',
    };
    await runTransaction({
      title: `${labelMap[action]} (${shortenAddress(contractAddress)})`,
      description: 'Thực thi quyền Guardian trực tiếp trên Smart Contract AvaHuiCircle',
      action: async () => {
        const signer = await resolveSignerClient(currentUser?.walletAddress);
        if (!signer) {
          throw new Error('Chưa kết nối ví Guardian (Core / MetaMask).');
        }
        const guardianOnChain = (await publicClient.readContract({
          address: contractAddress as `0x${string}`,
          abi: AvaHuiCircleABI,
          functionName: 'getGuardian',
        })) as `0x${string}`;

        if (guardianOnChain.toLowerCase() !== signer.account.toLowerCase()) {
          throw new Error(
            `Chỉ ví Guardian (${shortenAddress(guardianOnChain)}) mới được phép gọi ${action}(). Ví hiện tại: ${shortenAddress(signer.account)}.`,
          );
        }

        const txHash = await signer.client.writeContract({
          address: contractAddress as `0x${string}`,
          abi: AvaHuiCircleABI,
          functionName: action,
          account: signer.account,
          chain: activeFujiChain,
          gas: 350_000n,
        });
        await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (action === 'emergencyCancel') {
          await transactionApi
            .trackTransaction({
              txHash,
              txType: TransactionType.CANCEL_CIRCLE,
              contractAddress,
              senderAddress: signer.account,
              circleId,
            })
            .catch(() => {});
        }
        queryClient.invalidateQueries({ queryKey: ['avahui', 'admin'] });
        queryClient.invalidateQueries({ queryKey: ['avahui', 'app-state'] });
        return { txHash };
      },
    });
  };

  if (!isVerifier) {
    return (
      <div className="mx-auto max-w-xl rounded-none border border-rose-500/40 bg-surface-card p-8 text-center font-mono space-y-3">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-400" />
        <h1 className="text-lg font-extrabold uppercase text-white">
          Không có quyền truy cập Admin / Verifier
        </h1>
        <p className="text-xs text-zinc-400">
          Khu vực này chỉ dành cho tài khoản có vai trò{' '}
          <code className="text-emerald-400">ADMIN</code> hoặc{' '}
          <code className="text-emerald-400">VERIFIER</code>. Vai trò hiện tại của bạn:{' '}
          <strong className="text-white">{currentUser?.role || 'MEMBER'}</strong>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Shield className="h-4 w-4" />
            <span>RBAC Governance &amp; Team1 Sybil Verifier</span>
          </div>
          <h1 className="mt-1 font-mono text-2xl font-extrabold uppercase tracking-tight text-white">
            AvaHui Admin Console
          </h1>
        </div>
        <span className="rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold uppercase text-emerald-300">
          Role: {currentUser?.role}
        </span>
      </div>

      {/* Overview Stats (Admin) */}
      {isAdmin && overviewQuery.data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 font-mono">
          <div className="rounded-none border border-zinc-800 bg-surface-card p-4">
            <div className="text-[11px] uppercase text-zinc-400">Tổng Users / Team1</div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {overviewQuery.data.users.total}{' '}
              <span className="text-xs font-semibold text-emerald-400">
                ({overviewQuery.data.users.team1Verified} verified)
              </span>
            </div>
          </div>
          <div className="rounded-none border border-zinc-800 bg-surface-card p-4">
            <div className="text-[11px] uppercase text-zinc-400">Dây Hụi Active / Recruiting</div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {overviewQuery.data.circles.active} / {overviewQuery.data.circles.recruiting}
            </div>
          </div>
          <div className="rounded-none border border-zinc-800 bg-surface-card p-4">
            <div className="text-[11px] uppercase text-zinc-400">Tx &amp; Events Indexed</div>
            <div className="mt-1 text-2xl font-extrabold text-white">
              {overviewQuery.data.blockchain.totalTransactions} /{' '}
              {overviewQuery.data.blockchain.totalIndexedEvents}
            </div>
          </div>
          <div className="rounded-none border border-zinc-800 bg-surface-card p-4 space-y-1 text-xs">
            <div className="text-[11px] uppercase text-zinc-400">Trạng thái Hạ tầng</div>
            <div className="flex items-center justify-between">
              <span>Keeper Key:</span>
              <span
                className={
                  overviewQuery.data.blockchain.keeperConfigured
                    ? 'text-emerald-400 font-bold'
                    : 'text-amber-400 font-bold'
                }
              >
                {overviewQuery.data.blockchain.keeperConfigured ? 'READY' : 'MISSING'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Privy Auth:</span>
              <span
                className={
                  overviewQuery.data.blockchain.privyConfigured
                    ? 'text-emerald-400 font-bold'
                    : 'text-amber-400 font-bold'
                }
              >
                {overviewQuery.data.blockchain.privyConfigured ? 'LIVE' : 'SIWE ONLY'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Team1 Anti-Sybil Attestation Issuer Panel (VERIFIER & ADMIN) */}
      <section className="rounded-none border border-emerald-500/30 bg-surface-card p-5 space-y-4">
        <div className="flex items-center gap-2 font-mono text-sm font-bold uppercase text-emerald-300">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Cấp / Thu hồi Chứng nhận Team1 Anti-Sybil</span>
        </div>

        {attestMessage && (
          <div className="flex items-center gap-2 rounded-none border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 font-mono text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{attestMessage}</span>
          </div>
        )}
        {attestError && (
          <div className="flex items-center gap-2 rounded-none border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-mono text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{attestError}</span>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-12 font-mono text-xs">
          <input
            type="text"
            value={attestWallet}
            onChange={(e) => setAttestWallet(e.target.value)}
            placeholder="Địa chỉ ví thành viên (0x...)"
            className="sm:col-span-4 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          />
          <select
            value={attestTier}
            onChange={(e) => setAttestTier(Number(e.target.value))}
            className="sm:col-span-2 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
          >
            <option value={1}>Tier 1 (Basic)</option>
            <option value={2}>Tier 2 (Team1)</option>
            <option value={3}>Tier 3 (KYC)</option>
          </select>
          <button
            type="button"
            disabled={issueAttestationMutation.isPending || !/^0x[a-fA-F0-9]{40}$/.test(attestWallet.trim())}
            onClick={() =>
              issueAttestationMutation.mutate({
                walletAddress: attestWallet.trim(),
                trustTier: attestTier,
              })
            }
            className="sm:col-span-2 flex items-center justify-center gap-1 rounded-none bg-emerald-500 px-3 py-2 font-bold uppercase text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {issueAttestationMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <span>Cấp Verify</span>
            )}
          </button>
          <button
            type="button"
            disabled={signVoucherMutation.isPending || !/^0x[a-fA-F0-9]{40}$/.test(attestWallet.trim())}
            onClick={() =>
              signVoucherMutation.mutate({
                walletAddress: attestWallet.trim(),
                trustTier: attestTier,
              })
            }
            className="sm:col-span-2 flex items-center justify-center gap-1 rounded-none border border-sky-500/40 bg-sky-500/15 px-3 py-2 font-bold uppercase text-sky-300 transition hover:bg-sky-500 hover:text-zinc-950 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Ký Voucher</span>
          </button>
          <button
            type="button"
            disabled={revokeAttestationMutation.isPending || !/^0x[a-fA-F0-9]{40}$/.test(attestWallet.trim())}
            onClick={() => revokeAttestationMutation.mutate(attestWallet.trim())}
            className="sm:col-span-2 flex items-center justify-center gap-1 rounded-none border border-rose-500/40 bg-rose-500/10 px-3 py-2 font-bold uppercase text-rose-300 transition hover:bg-rose-500 hover:text-white disabled:opacity-50"
          >
            <span>Thu hồi</span>
          </button>
        </div>

        {signedVoucher && (
          <div className="rounded-none border border-sky-500/30 bg-zinc-950 p-3 font-mono text-[11px] space-y-2">
            <div className="flex items-center justify-between text-sky-300">
              <span className="font-bold uppercase">EIP-712 Voucher JSON (User tự Claim)</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(signedVoucher, null, 2));
                  setCopiedVoucher(true);
                  setTimeout(() => setCopiedVoucher(false), 1800);
                }}
                className="inline-flex items-center gap-1 rounded-none border border-zinc-700 bg-zinc-900 px-2 py-1 text-[10px] font-bold uppercase text-zinc-200 hover:border-sky-400"
              >
                {copiedVoucher ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{copiedVoucher ? 'Đã chép' : 'Copy JSON'}</span>
              </button>
            </div>
            <pre className="max-h-32 overflow-auto text-[10px] text-zinc-300">
              {JSON.stringify(signedVoucher, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Admin Users Management */}
      {isAdmin && (
        <section className="rounded-none border border-zinc-800 bg-surface-card p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-mono text-sm font-bold uppercase text-white">
              <Users className="h-4 w-4 text-avalanche-red" />
              <span>Quản lý Người dùng &amp; Phân quyền Role</span>
            </div>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Tìm email, tên, ví..."
              className="w-64 rounded-none border border-zinc-700 bg-zinc-900 px-3 py-1.5 font-mono text-xs text-white focus:border-avalanche-red focus:outline-none"
            />
          </div>

          {usersQuery.isError ? (
            <div className="rounded-none border border-amber-500/30 bg-amber-500/10 p-3 font-mono text-xs text-amber-300">
              Không tải được danh sách từ API (`/admin/users`). Hãy đảm bảo Backend đang chạy và bạn đã đăng nhập bằng JWT hợp lệ có role ADMIN.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-xs">
                <thead className="border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                  <tr>
                    <th className="py-2 pr-3">User</th>
                    <th className="py-2 pr-3">Ví chính</th>
                    <th className="py-2 pr-3">Team1</th>
                    <th className="py-2 pr-3">Role</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {(usersQuery.data?.items || []).map((u) => (
                    <tr key={u.id} className="hover:bg-zinc-900/50">
                      <td className="py-2.5 pr-3">
                        <div className="font-bold text-white">
                          {u.displayName || 'Unnamed'}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {u.email || u.privyDid}
                        </div>
                      </td>
                      <td className="py-2.5 pr-3 text-zinc-300">
                        {u.wallets[0]?.address
                          ? shortenAddress(u.wallets[0].address, 6)
                          : '—'}
                      </td>
                      <td className="py-2.5 pr-3">
                        {u.team1Verified ? (
                          <span className="text-emerald-400 font-bold">
                            Verified (T{u.trustTier})
                          </span>
                        ) : (
                          <span className="text-zinc-500">Unverified</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <select
                          value={u.role}
                          disabled={updateRoleMutation.isPending}
                          onChange={(e) =>
                            updateRoleMutation.mutate({
                              userId: u.id,
                              role: e.target.value as UserRole,
                            })
                          }
                          className="rounded-none border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs font-bold text-white"
                        >
                          <option value={UserRole.MEMBER}>MEMBER</option>
                          <option value={UserRole.VERIFIER}>VERIFIER</option>
                          <option value={UserRole.ADMIN}>ADMIN</option>
                        </select>
                      </td>
                      <td className="py-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            updateStatusMutation.mutate({
                              userId: u.id,
                              isActive: !u.isActive,
                            })
                          }
                          className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-bold uppercase ${
                            u.isActive
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-rose-500/20 hover:text-rose-300'
                              : 'border-rose-500/40 bg-rose-500/10 text-rose-300 hover:bg-emerald-500/20 hover:text-emerald-300'
                          }`}
                        >
                          <Ban className="h-3 w-3" />
                          <span>{u.isActive ? 'Active' : 'Suspended'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Admin Circles Moderation */}
      {isAdmin && (
        <section className="rounded-none border border-zinc-800 bg-surface-card p-5 space-y-4">
          <div className="font-mono text-sm font-bold uppercase text-white">
            Kiểm duyệt Dây Hụi (Circles Moderation)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="border-b border-zinc-800 text-[11px] uppercase text-zinc-400">
                <tr>
                  <th className="py-2 pr-3">Dây hụi</th>
                  <th className="py-2 pr-3">Trạng thái</th>
                  <th className="py-2 pr-3">Quyền riêng tư</th>
                  <th className="py-2 pr-3">Hiển thị</th>
                  <th className="py-2">Guardian (On-Chain)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/70">
                {(circlesQuery.data?.items || []).map((c) => (
                  <tr key={c.id} className="hover:bg-zinc-900/50">
                    <td className="py-2.5 pr-3">
                      <div className="font-bold text-white">{c.name}</div>
                      <div className="text-[11px] text-zinc-400">
                        {c.contractAddress ? shortenAddress(c.contractAddress, 6) : c.metadataId}
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-zinc-300">
                      <div>{c.status} ({c.currentMemberCount}/{c.maxMembers})</div>
                      {c.isPaused && (
                        <span className="text-[10px] font-bold uppercase text-rose-400">
                          PAUSED
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {c.isPrivateInvite ? (
                        <span className="text-sky-400">Private Invite</span>
                      ) : (
                        <span className="text-zinc-400">Public</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <button
                        type="button"
                        onClick={() =>
                          moderateCircleMutation.mutate({
                            circleId: c.id,
                            isHiddenByAdmin: !c.isHiddenByAdmin,
                            moderationReason: !c.isHiddenByAdmin
                              ? 'Hidden by Admin moderation'
                              : undefined,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-none border px-2.5 py-1 text-[10px] font-bold uppercase ${
                          c.isHiddenByAdmin
                            ? 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                            : 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        }`}
                      >
                        {c.isHiddenByAdmin ? (
                          <>
                            <EyeOff className="h-3 w-3" />
                            <span>Hidden</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-3 w-3" />
                            <span>Visible</span>
                          </>
                        )}
                      </button>
                    </td>
                    <td className="py-2.5">
                      {c.contractAddress ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              handleGuardianAction(
                                c.id,
                                c.contractAddress!,
                                c.isPaused ? 'unpause' : 'pause',
                              )
                            }
                            className={`inline-flex items-center gap-1 rounded-none border px-2 py-1 text-[10px] font-bold uppercase ${
                              c.isPaused
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500 hover:text-zinc-950'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500 hover:text-zinc-950'
                            }`}
                          >
                            {c.isPaused ? (
                              <>
                                <Play className="h-3 w-3" />
                                <span>Unpause</span>
                              </>
                            ) : (
                              <>
                                <Pause className="h-3 w-3" />
                                <span>Pause</span>
                              </>
                            )}
                          </button>
                          {c.status === 'RECRUITING' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleGuardianAction(
                                  c.id,
                                  c.contractAddress!,
                                  'emergencyCancel',
                                )
                              }
                              className="inline-flex items-center gap-1 rounded-none border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-bold uppercase text-rose-300 hover:bg-rose-500 hover:text-white"
                            >
                              <XCircle className="h-3 w-3" />
                              <span>Cancel</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

