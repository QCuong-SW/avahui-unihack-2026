'use client';

import React, { useState } from 'react';
import {
  useAvaHuiState,
  useMarkNotificationsRead,
} from '@/hooks/useAvaHuiMockQuery';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';

export function NotificationPopover() {
  const { data: state } = useAvaHuiState();
  const markReadMutation = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);

  if (!state) return null;

  const userNotifs = state.notifications.filter(
    (n) => n.userId === state.currentUserId
  );
  const unreadCount = userNotifs.filter((n) => !n.isRead).length;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-none border border-zinc-800 bg-zinc-900 p-2 text-zinc-300 transition hover:border-zinc-700 hover:text-white"
        title="Thông báo vòng hụi"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-none border border-zinc-950 bg-avalanche-red px-1 font-mono text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 sm:w-80 max-w-[calc(100vw-1.5rem)] rounded-none border border-zinc-800 bg-surface-card p-3 shadow-2xl z-50 animate-scale-in origin-top-right">
          <div className="mb-2 flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
              Thông báo ({unreadCount})
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markReadMutation.mutate(undefined)}
                className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-avalanche-red hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                <span>Đọc tất cả</span>
              </button>
            )}
          </div>

          {userNotifs.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              Chưa có thông báo nào cho tài khoản này.
            </div>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {userNotifs.map((n) => (
                <div
                  key={n.id}
                  onClick={() => {
                    if (!n.isRead) markReadMutation.mutate(n.id);
                  }}
                  className={`cursor-pointer rounded-none border p-2.5 text-xs transition-colors ${
                    n.isRead
                      ? 'border-zinc-800/80 bg-zinc-900/40 text-zinc-400'
                      : 'border-avalanche-red/40 bg-avalanche-red/10 text-zinc-100'
                  }`}
                >
                  <div className="font-semibold">{n.title}</div>
                  <p className="mt-0.5 text-[11px] text-zinc-400">{n.body}</p>
                  {n.circleId && (
                    <Link
                      href={`/circles/${n.circleId}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!n.isRead) markReadMutation.mutate(n.id);
                        setOpen(false);
                      }}
                      className="mt-1.5 inline-block font-mono text-[11px] font-semibold text-avalanche-red hover:underline"
                    >
                      Xem dây hụi →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
