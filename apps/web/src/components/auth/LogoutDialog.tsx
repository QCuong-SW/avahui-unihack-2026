'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useLogoutMutation } from '@/lib/auth/useAuthSession';
import { HoverHint } from '@/components/ui/HoverHint';
import { AvahuiLogo } from '@/components/ui/AvahuiLogo';
import { Info, Loader2, X } from 'lucide-react';

interface LogoutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LogoutDialog({ isOpen, onClose }: LogoutDialogProps) {
  const router = useRouter();
  const logoutMutation = useLogoutMutation();

  if (!isOpen) return null;

  const handleConfirmLogout = async () => {
    await logoutMutation.mutateAsync();
    onClose();
    router.push('/login');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-fade-in">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-dialog-title"
        className="w-full max-w-sm rounded-none border border-zinc-800 bg-surface-card p-6 shadow-2xl animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3">
          <AvahuiLogo size={40} roundedClass="rounded-none" />
          <button
            type="button"
            onClick={onClose}
            disabled={logoutMutation.isPending}
            className="rounded-none p-1 text-zinc-400 transition hover:bg-zinc-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h3
          id="logout-dialog-title"
          className="mt-4 font-mono text-lg font-extrabold uppercase tracking-wider text-white"
        >
          Đăng xuất khỏi Avahui?
        </h3>
        <p className="mt-1.5 font-mono text-xs leading-relaxed text-zinc-400">
          Bạn sẽ cần đăng nhập lại để tiếp tục quản lý các vòng hụi.
        </p>

        <HoverHint
          side="top"
          hint="Đăng xuất không xóa tài khoản, không xóa Embedded Wallet và không hủy các giao dịch hay nghĩa vụ đóng góp trên chuỗi"
          className="mt-4 flex w-full"
        >
          <div className="flex w-full items-center gap-2 rounded-none border border-zinc-800 bg-zinc-900/60 px-3 py-2 font-mono text-[11px] text-zinc-400">
            <Info className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>Embedded Wallet vẫn được bảo toàn trên Avalanche Fuji</span>
          </div>
        </HoverHint>

        <div className="mt-6 flex items-center justify-end gap-2.5 font-mono text-xs">
          <button
            type="button"
            onClick={onClose}
            disabled={logoutMutation.isPending}
            className="rounded-none border border-zinc-700 bg-zinc-900 px-4 py-2 font-bold uppercase tracking-wider text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleConfirmLogout}
            disabled={logoutMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-none bg-avalanche-red px-4 py-2 font-bold uppercase tracking-wider text-white transition hover:bg-avalanche-darkRed disabled:opacity-60"
          >
            {logoutMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Đang đăng xuất...</span>
              </>
            ) : (
              <span>Logout</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
