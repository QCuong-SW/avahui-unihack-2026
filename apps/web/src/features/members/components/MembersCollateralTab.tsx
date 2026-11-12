'use client';

import React from 'react';
import { CircleItem, MemberStatus } from '@avahui/shared';
import { formatUsdc, shortenAddress } from '@/lib/utils';
import { MEMBER_STATUS_META } from '@/lib/constants/glossary';
import { HoverHint } from '@/components/ui/HoverHint';
import {
  CheckCircle2,
  Clock,
  Crown,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';

interface MembersCollateralTabProps {
  circle: CircleItem;
  currentUserAddress: string;
}

export function MembersCollateralTab({
  circle,
  currentUserAddress,
}: MembersCollateralTabProps) {
  const slots = Array.from({ length: circle.maxMembers }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto rounded-none border border-zinc-800 bg-zinc-900/50">
      <table className="w-full text-left font-mono text-xs">
        <thead className="border-b border-zinc-800 bg-zinc-900/90 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
          <tr>
            <th className="px-3.5 py-3">Vị trí</th>
            <th className="px-3.5 py-3">Thành viên</th>
            <th className="px-3.5 py-3">Nhận quỹ</th>
            <th className="px-3.5 py-3">
              <HoverHint
                hint={`Mỗi thành viên khóa ${formatUsdc(circle.collateralAmountFormatted)} mUSDC thế chấp khi gia nhập`}
                side="top"
              >
                <span className="cursor-help underline decoration-dotted">
                  Thế chấp
                </span>
              </HoverHint>
            </th>
            <th className="px-3.5 py-3">
              <HoverHint
                hint="Số tiền bị trích từ thế chấp do không đóng tiền đúng hạn"
                side="top"
              >
                <span className="cursor-help underline decoration-dotted">
                  Trích thế chấp
                </span>
              </HoverHint>
            </th>
            <th className="px-3.5 py-3">Trạng thái</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/70">
          {slots.map((slotNum) => {
            const member = circle.members.find((m) => m.slotIndex === slotNum);
            const isMe =
              member &&
              member.walletAddress.toLowerCase() ===
                currentUserAddress.toLowerCase();
            const isCreator =
              member &&
              member.walletAddress.toLowerCase() ===
                circle.creatorAddress.toLowerCase();

            if (!member) {
              return (
                <tr
                  key={slotNum}
                  className="bg-zinc-950/30 text-zinc-500 italic"
                >
                  <td className="px-3.5 py-3 font-mono font-bold">
                    #{slotNum}
                  </td>
                  <td className="px-3.5 py-3" colSpan={5}>
                    <span className="inline-flex items-center gap-1.5 text-amber-400/80 uppercase text-[11px]">
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Slot trống</span>
                    </span>
                  </td>
                </tr>
              );
            }

            return (
              <tr
                key={slotNum}
                className={
                  isMe ? 'bg-avalanche-red/10' : 'hover:bg-zinc-900/40'
                }
              >
                <td className="px-3.5 py-3 font-mono font-bold text-white">
                  #{slotNum}
                </td>

                <td className="px-3.5 py-3">
                  <div className="flex items-center gap-1.5 font-bold text-white">
                    <span className="font-sans font-bold">{member.displayName}</span>
                    {isMe && (
                      <span className="rounded-none bg-avalanche-red px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">
                        BẠN
                      </span>
                    )}
                    {isCreator && (
                      <HoverHint hint="Người khởi tạo dây hụi" side="top">
                        <span className="inline-flex items-center rounded-none bg-amber-500/20 p-1 text-amber-300">
                          <Crown className="h-3 w-3" />
                        </span>
                      </HoverHint>
                    )}
                    {member.team1Verified && (
                      <HoverHint
                        hint={`Đã xác thực Team1 (Tier ${member.trustTier || 1})`}
                        side="top"
                      >
                        <span className="inline-flex items-center gap-0.5 rounded-none border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                          <ShieldCheck className="h-3 w-3" />
                          <span>T{member.trustTier || 1}</span>
                        </span>
                      </HoverHint>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-zinc-500">
                    {shortenAddress(member.walletAddress, 4)}
                  </div>
                </td>

                <td className="px-3.5 py-3">
                  {member.hasReceivedPayout ? (
                    <span className="inline-flex items-center gap-1 rounded-none bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 uppercase">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Vòng #{member.wonRoundNumber}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-none bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400 uppercase">
                      <Clock className="h-3 w-3" />
                      <span>Chưa nhận</span>
                    </span>
                  )}
                </td>

                <td className="px-3.5 py-3 font-mono font-bold text-amber-300">
                  <span className="inline-flex items-center gap-1">
                    <Lock className="h-3 w-3" />
                    {formatUsdc(member.lockedCollateralFormatted)}
                  </span>
                </td>

                <td className="px-3.5 py-3 font-mono">
                  {parseFloat(member.slashedCollateralFormatted || '0') > 0 ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-rose-400">
                      <ShieldAlert className="h-3 w-3" />
                      <span>-{formatUsdc(member.slashedCollateralFormatted || '0')}</span>
                    </span>
                  ) : (
                    <span className="text-zinc-500">0.00</span>
                  )}
                </td>

                <td className="px-3.5 py-3">
                  <span
                    className={`rounded-none px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider ${
                      member.status === MemberStatus.Active
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : member.status === MemberStatus.Defaulted
                        ? 'bg-rose-500/15 text-rose-400'
                        : 'bg-sky-500/15 text-sky-400'
                    }`}
                  >
                    {MEMBER_STATUS_META[member.status]?.label || member.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
